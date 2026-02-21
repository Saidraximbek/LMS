import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { deleteApp, initializeApp } from 'firebase/app'
import { app, db } from '../../firebase/config'
import DashboardLayout from '../../components/DashboardLayout'

const statusLabels = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
  used: 'Ishlatilgan'
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [groups, setGroups] = useState([])
  const [payments, setPayments] = useState([])
  const [claims, setClaims] = useState([])

  const [teacherForm, setTeacherForm] = useState({ fullName: '', email: '', password: '' })
  const [groupName, setGroupName] = useState('')
  const [assignments, setAssignments] = useState({})

  const [shopSettings, setShopSettings] = useState({
    pointsRequired: 40,
    discountPercent: 10,
    monthDuration: 1
  })

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [teacherSnap, studentSnap, groupSnap, paymentSnap, claimsSnap, settingsDoc] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(collection(db, 'groups')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'discountClaims')),
        getDoc(doc(db, 'shopSettings', 'main'))
      ])

      const teachersData = teacherSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      const studentsData = studentSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      const groupsData = groupSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      const paymentsData = paymentSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      const claimsData = claimsSnap.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0))

      setTeachers(teachersData)
      setStudents(studentsData)
      setGroups(groupsData)
      setPayments(paymentsData)
      setClaims(claimsData)

      if (settingsDoc.exists()) {
        setShopSettings(settingsDoc.data())
      } else {
        await setDoc(doc(db, 'shopSettings', 'main'), shopSettings)
      }

      const assignmentData = {}
      groupsData.forEach(group => {
        assignmentData[group.id] = group.teacherId || ''
      })
      setAssignments(assignmentData)
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateTeacher = async e => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    setSuccess('')

    let secondaryApp
    try {
      const secondaryName = `secondary-${Date.now()}`
      secondaryApp = initializeApp(app.options, secondaryName)
      const secondaryAuth = getAuth(secondaryApp)

      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        teacherForm.email,
        teacherForm.password
      )

      await setDoc(doc(db, 'users', credential.user.uid), {
        fullName: teacherForm.fullName,
        email: teacherForm.email,
        role: 'teacher',
        groupId: ''
      })

      await signOut(secondaryAuth)
      setTeacherForm({ fullName: '', email: '', password: '' })
      setSuccess("O'qituvchi yaratildi")
      await loadData()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Bu email allaqachon mavjud')
      else if (err.code === 'auth/weak-password') setError('Parol kamida 6 ta bo‘lishi kerak')
      else setError("O'qituvchi yaratishda xatolik")
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp)
      setActionLoading(false)
    }
  }

  const handleCreateGroup = async e => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await addDoc(collection(db, 'groups'), { name: groupName, teacherId: '' })
      setGroupName('')
      setSuccess('Guruh yaratildi')
      await loadData()
    } catch {
      setError('Guruh yaratishda xatolik')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssignTeacher = async groupId => {
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await updateDoc(doc(db, 'groups', groupId), { teacherId: assignments[groupId] || '' })
      setSuccess("O'qituvchi biriktirildi")
      await loadData()
    } catch {
      setError('Biriktirishda xatolik')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteGroup = async groupId => {
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await deleteDoc(doc(db, 'groups', groupId))
      setSuccess('Guruh o‘chirildi')
      await loadData()
    } catch {
      setError('Guruhni o‘chirishda xatolik')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveShopSettings = async e => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await setDoc(doc(db, 'shopSettings', 'main'), {
        pointsRequired: Number(shopSettings.pointsRequired || 40),
        discountPercent: Number(shopSettings.discountPercent || 10),
        monthDuration: Number(shopSettings.monthDuration || 1),
        updatedAt: serverTimestamp()
      })
      setSuccess('Do‘kon sozlamalari saqlandi')
      await loadData()
    } catch {
      setError('Sozlamalarni saqlashda xatolik')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClaimAction = async (claim, action) => {
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      if (claim.status !== 'pending') {
        setError('Faqat pending so‘rovga amal bajariladi')
        return
      }

      if (action === 'approve') {
        const student = students.find(item => item.id === claim.studentId)
        const currentPoints = Number(student?.totalPoints || 0)
        const required = Number(claim.pointsRequired || shopSettings.pointsRequired || 40)

        if (currentPoints < required) {
          setError('Talabada yetarli ball yo‘q')
          return
        }

        await updateDoc(doc(db, 'users', claim.studentId), {
          totalPoints: currentPoints - required
        })

        await updateDoc(doc(db, 'discountClaims', claim.id), {
          status: 'approved',
          approvedAt: serverTimestamp()
        })

        setSuccess('So‘rov tasdiqlandi va ball yechildi')
      } else {
        await updateDoc(doc(db, 'discountClaims', claim.id), {
          status: 'rejected',
          approvedAt: serverTimestamp()
        })
        setSuccess('So‘rov rad etildi')
      }

      await loadData()
    } catch {
      setError('So‘rovni boshqarishda xatolik')
    } finally {
      setActionLoading(false)
    }
  }

  const ranking = useMemo(
    () => [...students].sort((a, b) => Number(b.totalPoints || 0) - Number(a.totalPoints || 0)),
    [students]
  )

  const totalRevenue = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return (
    <DashboardLayout
      title="Admin paneli"
      sections={[
        { id: 'admin-overview', label: 'Umumiy ko‘rsatkichlar' },
        { id: 'admin-create', label: 'Yaratish' },
        { id: 'admin-assign', label: 'Biriktirish' },
        { id: 'admin-ranking', label: 'Reyting' },
        { id: 'admin-shop', label: 'Do‘kon sozlamalari' },
        { id: 'admin-claims', label: 'Chegirma so‘rovlari' }
      ]}
    >
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="space-y-6">
          <section id="admin-overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><p className="text-sm text-slate-500">Guruhlar</p><p className="mt-2 text-3xl font-bold text-slate-900">{groups.length}</p></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><p className="text-sm text-slate-500">Talabalar</p><p className="mt-2 text-3xl font-bold text-slate-900">{students.length}</p></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><p className="text-sm text-slate-500">To‘lovlar</p><p className="mt-2 text-3xl font-bold text-slate-900">{payments.length}</p></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><p className="text-sm text-slate-500">Jami tushum</p><p className="mt-2 text-3xl font-bold text-slate-900">{totalRevenue.toLocaleString('uz-UZ')} so‘m</p></div>
          </section>

          <section id="admin-create" className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Yangi o‘qituvchi</h2>
              <form onSubmit={handleCreateTeacher} className="space-y-3">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="To‘liq ism" value={teacherForm.fullName} onChange={e => setTeacherForm(prev => ({ ...prev, fullName: e.target.value }))} required />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="email" placeholder="Email" value={teacherForm.email} onChange={e => setTeacherForm(prev => ({ ...prev, email: e.target.value }))} required />
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="password" placeholder="Parol" value={teacherForm.password} onChange={e => setTeacherForm(prev => ({ ...prev, password: e.target.value }))} required />
                <button disabled={actionLoading} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60">Yaratish</button>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Yangi guruh</h2>
              <form onSubmit={handleCreateGroup} className="space-y-3">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Guruh nomi" value={groupName} onChange={e => setGroupName(e.target.value)} required />
                <button disabled={actionLoading} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-60">Yaratish</button>
              </form>
            </div>
          </section>

          <section id="admin-assign" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Guruhga o‘qituvchi biriktirish</h2>
            <div className="space-y-3">
              {groups.map(group => (
                <div key={group.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center">
                  <p className="font-medium text-slate-800 md:w-1/4">{group.name}</p>
                  <select className="rounded-lg border border-slate-300 px-3 py-2 md:w-1/3" value={assignments[group.id] || ''} onChange={e => setAssignments(prev => ({ ...prev, [group.id]: e.target.value }))}>
                    <option value="">Biriktirilmagan</option>
                    {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
                  </select>
                  <button onClick={() => handleAssignTeacher(group.id)} disabled={actionLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-60">Saqlash</button>
                  <button onClick={() => handleDeleteGroup(group.id)} disabled={actionLoading} className="rounded-lg bg-rose-600 px-4 py-2 text-white disabled:opacity-60">O‘chirish</button>
                </div>
              ))}
            </div>
          </section>

          <section id="admin-ranking" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Talabalar umumiy reytingi</h2>
            <div className="space-y-2">
              {ranking.map((student, index) => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-800">{index + 1}. {student.fullName}</p>
                  <p className="font-semibold text-slate-900">{Number(student.totalPoints || 0)} ball</p>
                </div>
              ))}
            </div>
          </section>

          <section id="admin-shop" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Do‘kon sozlamalari</h2>
            <form onSubmit={handleSaveShopSettings} className="grid gap-3 md:grid-cols-3">
              <input type="number" min="1" className="rounded-lg border border-slate-300 px-3 py-2" value={shopSettings.pointsRequired} onChange={e => setShopSettings(prev => ({ ...prev, pointsRequired: e.target.value }))} placeholder="Chegirma uchun ball" required />
              <input type="number" min="1" className="rounded-lg border border-slate-300 px-3 py-2" value={shopSettings.discountPercent} onChange={e => setShopSettings(prev => ({ ...prev, discountPercent: e.target.value }))} placeholder="Chegirma foizi" required />
              <input type="number" min="1" className="rounded-lg border border-slate-300 px-3 py-2" value={shopSettings.monthDuration} onChange={e => setShopSettings(prev => ({ ...prev, monthDuration: e.target.value }))} placeholder="Oy soni" required />
              <button disabled={actionLoading} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60 md:col-span-3">Sozlamani saqlash</button>
            </form>
          </section>

          <section id="admin-claims" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Chegirma so‘rovlari</h2>
            <div className="space-y-2">
              {claims.length === 0 && <p className="text-slate-500">So‘rovlar yo‘q.</p>}
              {claims.map(claim => {
                const student = students.find(item => item.id === claim.studentId)
                return (
                  <div key={claim.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <p className="text-slate-800">{student?.fullName || claim.studentId} - {claim.discountPercent}% / {claim.monthDuration} oy ({claim.pointsRequired} ball)</p>
                      <p className="text-sm font-medium text-slate-600">{statusLabels[claim.status] || claim.status}</p>
                    </div>
                    {claim.status === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => handleClaimAction(claim, 'approve')} className="rounded bg-emerald-600 px-3 py-1 text-white">Tasdiqlash</button>
                        <button onClick={() => handleClaimAction(claim, 'reject')} className="rounded bg-rose-600 px-3 py-1 text-white">Rad etish</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {(error || success) && (
            <div>
              {error && <p className="rounded-xl bg-rose-100 px-4 py-3 text-rose-700">{error}</p>}
              {success && <p className="rounded-xl bg-emerald-100 px-4 py-3 text-emerald-700">{success}</p>}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

export default AdminDashboard
