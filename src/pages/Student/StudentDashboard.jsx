import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../firebase/config'

const statusLabels = {
  present: 'Keldi',
  late: 'Kechikdi',
  absent: 'Kelmadi'
}

const claimLabels = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  used: 'Ishlatilgan'
}

const StudentDashboard = () => {
  const { currentUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState(null)
  const [lessons, setLessons] = useState([])
  const [attendance, setAttendance] = useState([])
  const [myScores, setMyScores] = useState([])
  const [ranking, setRanking] = useState([])
  const [claims, setClaims] = useState([])
  const [shopSettings, setShopSettings] = useState({ pointsRequired: 40, discountPercent: 10, monthDuration: 1 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [studentsSnap, myScoresSnap, myClaimsSnap, settingsDoc] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(query(collection(db, 'lessonScores'), where('studentId', '==', currentUser.id))),
        getDocs(query(collection(db, 'discountClaims'), where('studentId', '==', currentUser.id))),
        getDoc(doc(db, 'shopSettings', 'main'))
      ])

      const students = studentsSnap.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .sort((a, b) => Number(b.totalPoints || 0) - Number(a.totalPoints || 0))

      setRanking(students)
      setMyScores(myScoresSnap.docs.map(item => ({ id: item.id, ...item.data() })))
      setClaims(
        myClaimsSnap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0))
      )

      if (settingsDoc.exists()) {
        setShopSettings(settingsDoc.data())
      }

      if (!currentUser.groupId) {
        setGroup(null)
        setLessons([])
      } else {
        const groupDoc = await getDoc(doc(db, 'groups', currentUser.groupId))
        setGroup(groupDoc.exists() ? { id: groupDoc.id, ...groupDoc.data() } : null)

        const lessonSnap = await getDocs(
          query(collection(db, 'lessons'), where('groupId', '==', currentUser.groupId))
        )

        setLessons(
          lessonSnap.docs
            .map(item => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        )
      }

      const attendanceSnap = await getDocs(
        query(collection(db, 'attendance'), where('studentId', '==', currentUser.id))
      )

      setAttendance(
        attendanceSnap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      )
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser?.id) loadData()
  }, [currentUser?.id])

  const myRank = useMemo(() => ranking.findIndex(item => item.id === currentUser.id) + 1, [ranking, currentUser.id])
  const totalPoints = Number(currentUser.totalPoints || 0)

  const canClaimDiscount =
    totalPoints >= Number(shopSettings.pointsRequired || 40) &&
    !claims.some(item => item.status === 'pending')

  const handleClaimDiscount = async () => {
    setClaimLoading(true)
    setError('')
    setSuccess('')

    try {
      await addDoc(collection(db, 'discountClaims'), {
        studentId: currentUser.id,
        pointsRequired: Number(shopSettings.pointsRequired || 40),
        discountPercent: Number(shopSettings.discountPercent || 10),
        monthDuration: Number(shopSettings.monthDuration || 1),
        status: 'pending',
        requestedAt: serverTimestamp()
      })

      setSuccess('Chegirma so‘rovi yuborildi. Admin tasdiqlashini kuting.')
      await loadData()
    } catch {
      setError('Chegirma so‘rovini yuborishda xatolik')
    } finally {
      setClaimLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="Talaba paneli"
      sections={[
        { id: 'student-overview', label: 'Umumiy natija' },
        { id: 'student-group', label: 'Mening guruhim' },
        { id: 'student-lessons', label: 'Darslar' },
        { id: 'student-scores', label: 'Ballarim' },
        { id: 'student-ranking', label: 'Reyting' },
        { id: 'student-shop', label: 'Do‘kon' },
        { id: 'student-attendance', label: 'Davomat' }
      ]}
    >
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="space-y-6">
          <section id="student-overview" className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Jami ball</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{totalPoints}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Reytingdagi o‘rningiz</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{myRank || '-'}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Chegirma olish uchun kerak</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{shopSettings.pointsRequired || 40} ball</p>
            </div>
          </section>

          <section id="student-group" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold">Mening guruhim</h2>
            {group ? <p className="text-gray-700">{group.name}</p> : <p className="text-gray-600">Sizga guruh biriktirilmagan.</p>}
          </section>

          <section id="student-lessons" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold">Darslar va materiallar</h2>
            <div className="space-y-3">
              {lessons.length === 0 && <p>Darslar mavjud emas.</p>}
              {lessons.map(lesson => (
                <div key={lesson.id} className="rounded border p-3">
                  <p className="font-semibold">{lesson.title}</p>
                  <p className="text-sm text-gray-600">{lesson.description}</p>
                  {lesson.materialUrl && (
                    <a href={lesson.materialUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Materialni ko‘rish
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section id="student-scores" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold">Mening ballarim</h2>
            <div className="space-y-2">
              {myScores.length === 0 && <p>Ball yozuvlari yo‘q.</p>}
              {myScores
                .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
                .map(item => {
                  const lesson = lessons.find(lessonItem => lessonItem.id === item.lessonId)
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <p className="text-slate-800">{lesson?.title || item.lessonId}</p>
                      <p className="font-semibold text-slate-900">{Number(item.points || 0)} ball</p>
                    </div>
                  )
                })}
            </div>
          </section>

          <section id="student-ranking" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold">Talabalar reytingi</h2>
            <div className="space-y-2">
              {ranking.slice(0, 20).map((student, index) => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-800">{index + 1}. {student.fullName}</p>
                  <p className="font-semibold text-slate-900">{Number(student.totalPoints || 0)} ball</p>
                </div>
              ))}
            </div>
          </section>

          <section id="student-shop" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold">Do‘kon va chegirma</h2>
            <p className="text-sm text-slate-700">
              Har {shopSettings.pointsRequired || 40} ball uchun {shopSettings.discountPercent || 10}% chegirma ({shopSettings.monthDuration || 1} oy)
            </p>
            <button onClick={handleClaimDiscount} disabled={!canClaimDiscount || claimLoading} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
              {claimLoading ? 'Yuborilmoqda...' : 'Chegirma so‘rovini yuborish'}
            </button>
            {!canClaimDiscount && <p className="mt-2 text-sm text-amber-700">Yetarli ball yo‘q yoki pending so‘rov mavjud.</p>}

            <div className="mt-4 space-y-2">
              <p className="font-medium text-slate-800">So‘rovlar tarixi:</p>
              {claims.length === 0 && <p className="text-sm text-slate-500">So‘rovlar yo‘q.</p>}
              {claims.map(claim => (
                <div key={claim.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                  <p>
                    {claim.discountPercent}% / {claim.monthDuration} oy ({claim.pointsRequired} ball)
                  </p>
                  <p className="font-medium">{claimLabels[claim.status] || claim.status}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="student-attendance" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-3 text-lg font-semibold">Davomat tarixi</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border p-2">Sana</th>
                    <th className="border p-2">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 && (
                    <tr>
                      <td className="border p-2" colSpan="2">Davomat yozuvlari topilmadi</td>
                    </tr>
                  )}
                  {attendance.map(item => (
                    <tr key={item.id}>
                      <td className="border p-2">{item.date}</td>
                      <td className="border p-2">{statusLabels[item.status] || item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(error || success) && (
            <div>
              {error && <p className="rounded bg-red-100 p-3 text-red-700">{error}</p>}
              {success && <p className="rounded bg-emerald-100 p-3 text-emerald-700">{success}</p>}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

export default StudentDashboard
