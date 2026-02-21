import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { deleteApp, initializeApp } from 'firebase/app'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { app, db, storage } from '../../firebase/config'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'

const TeacherDashboard = () => {
  const { currentUser } = useAuth()

  const [groups, setGroups] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [groupStudents, setGroupStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [lessonScores, setLessonScores] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    groupId: '',
    file: null,
    materialUrl: ''
  })

  const [studentForm, setStudentForm] = useState({
    fullName: '',
    email: '',
    password: '',
    groupId: ''
  })

  const [attendanceGroupId, setAttendanceGroupId] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0])
  const [attendanceStatus, setAttendanceStatus] = useState({})

  const [scoreLessonId, setScoreLessonId] = useState('')
  const [scoreMap, setScoreMap] = useState({})

  const [studentGroupMap, setStudentGroupMap] = useState({})

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const ownGroupsSnap = await getDocs(
        query(collection(db, 'groups'), where('teacherId', '==', currentUser.id))
      )
      const ownGroups = ownGroupsSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      setGroups(ownGroups)

      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')))
      const studentsData = studentsSnap.docs.map(item => ({ id: item.id, ...item.data() }))
      setAllStudents(studentsData)

      const ownGroupIds = new Set(ownGroups.map(group => group.id))
      const ownStudents = studentsData.filter(student => ownGroupIds.has(student.groupId))
      setGroupStudents(ownStudents)

      const map = {}
      studentsData
        .filter(student => !student.groupId || ownGroupIds.has(student.groupId))
        .forEach(student => {
          map[student.id] = student.groupId || ''
        })
      setStudentGroupMap(map)

      if (ownGroups.length === 1) {
        setLessonForm(prev => ({ ...prev, groupId: ownGroups[0].id }))
        setStudentForm(prev => ({ ...prev, groupId: ownGroups[0].id }))
        setAttendanceGroupId(ownGroups[0].id)
      }

      if (ownGroups.length > 0) {
        const [lessonSnaps, attendanceSnaps, scoreSnaps] = await Promise.all([
          Promise.all(
            ownGroups.map(group => getDocs(query(collection(db, 'lessons'), where('groupId', '==', group.id))))
          ),
          Promise.all(
            ownGroups.map(group =>
              getDocs(query(collection(db, 'attendance'), where('groupId', '==', group.id)))
            )
          ),
          Promise.all(
            ownGroups.map(group =>
              getDocs(query(collection(db, 'lessonScores'), where('groupId', '==', group.id)))
            )
          )
        ])

        const mergedLessons = lessonSnaps
          .flatMap(snap => snap.docs.map(item => ({ id: item.id, ...item.data() })))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

        const mergedAttendance = attendanceSnaps.flatMap(snap =>
          snap.docs.map(item => ({ id: item.id, ...item.data() }))
        )

        const mergedScores = scoreSnaps.flatMap(snap =>
          snap.docs.map(item => ({ id: item.id, ...item.data() }))
        )

        setLessons(mergedLessons)
        setAttendanceRecords(mergedAttendance)
        setLessonScores(mergedScores)

        if (mergedLessons.length > 0 && !scoreLessonId) {
          setScoreLessonId(mergedLessons[0].id)
        }
      } else {
        setLessons([])
        setAttendanceRecords([])
        setLessonScores([])
      }
    } catch {
      setError("Ma'lumotlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser?.id) loadData()
  }, [currentUser?.id])

  useEffect(() => {
    if (!scoreLessonId) return

    const currentLessonScores = lessonScores.filter(item => item.lessonId === scoreLessonId)
    const nextMap = {}
    currentLessonScores.forEach(item => {
      nextMap[item.studentId] = item.points
    })
    setScoreMap(nextMap)
  }, [scoreLessonId, lessonScores])

  const handleCreateStudent = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    let secondaryApp
    try {
      const secondaryName = `secondary-student-${Date.now()}`
      secondaryApp = initializeApp(app.options, secondaryName)
      const secondaryAuth = getAuth(secondaryApp)

      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        studentForm.email,
        studentForm.password
      )

      await setDoc(doc(db, 'users', credential.user.uid), {
        fullName: studentForm.fullName,
        email: studentForm.email,
        role: 'student',
        groupId: studentForm.groupId,
        totalPoints: 0
      })

      await signOut(secondaryAuth)

      setStudentForm({
        fullName: '',
        email: '',
        password: '',
        groupId: groups.length === 1 ? groups[0].id : ''
      })
      setSuccess("Yangi o'quvchi yaratildi")
      await loadData()
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Bu email allaqachon mavjud')
      else if (err.code === 'auth/weak-password') setError('Parol kamida 6 ta bo‘lishi kerak')
      else setError("Yangi o'quvchi yaratishda xatolik")
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp)
      setSaving(false)
    }
  }

  const handleLessonSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setUploadProgress(0)
    setError('')
    setSuccess('')

    try {
      let materialUrl = lessonForm.materialUrl.trim()

      if (lessonForm.file) {
        const storageRef = ref(
          storage,
          `materials/${lessonForm.groupId}/${Date.now()}-${lessonForm.file.name}`
        )
        const uploadTask = uploadBytesResumable(storageRef, lessonForm.file)

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            snapshot => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              setUploadProgress(progress)
            },
            reject,
            resolve
          )
        })

        materialUrl = await getDownloadURL(storageRef)
      }

      const payload = {
        title: lessonForm.title,
        description: lessonForm.description,
        groupId: lessonForm.groupId,
        materialUrl,
        createdAt: serverTimestamp()
      }

      const lessonRef = await addDoc(collection(db, 'lessons'), payload)
      setLessons(prev => [
        { id: lessonRef.id, ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } },
        ...prev
      ])

      if (!scoreLessonId) setScoreLessonId(lessonRef.id)

      setLessonForm(prev => ({ ...prev, title: '', description: '', file: null, materialUrl: '' }))
      setSuccess('Dars saqlandi')
    } catch {
      setError('Dars yaratishda xatolik')
    } finally {
      setSaving(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteLesson = async lessonId => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await deleteDoc(doc(db, 'lessons', lessonId))
      setLessons(prev => prev.filter(item => item.id !== lessonId))
      setSuccess('Dars o‘chirildi')
    } catch {
      setError('Darsni o‘chirishda xatolik')
    } finally {
      setSaving(false)
    }
  }

  const handleAssignStudent = async studentId => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateDoc(doc(db, 'users', studentId), { groupId: studentGroupMap[studentId] || '' })
      setSuccess('Talaba guruhi yangilandi')
      await loadData()
    } catch {
      setError('Talabani biriktirishda xatolik')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAttendance = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      for (const student of studentsForSelectedGroup) {
        const status = attendanceStatus[student.id]
        if (!status) continue

        const existingSnap = await getDocs(
          query(
            collection(db, 'attendance'),
            where('studentId', '==', student.id),
            where('groupId', '==', attendanceGroupId),
            where('date', '==', attendanceDate)
          )
        )

        if (!existingSnap.empty) {
          await updateDoc(doc(db, 'attendance', existingSnap.docs[0].id), { status })
        } else {
          await addDoc(collection(db, 'attendance'), {
            studentId: student.id,
            groupId: attendanceGroupId,
            date: attendanceDate,
            status
          })
        }
      }

      setSuccess('Davomat saqlandi')
      await loadData()
    } catch {
      setError('Davomatni saqlashda xatolik')
    } finally {
      setSaving(false)
    }
  }

  const recalculateStudentPoints = async studentId => {
    const scoresSnap = await getDocs(
      query(collection(db, 'lessonScores'), where('studentId', '==', studentId))
    )
    const totalPoints = scoresSnap.docs.reduce((sum, item) => sum + Number(item.data().points || 0), 0)
    await updateDoc(doc(db, 'users', studentId), { totalPoints })
  }

  const handleSaveScores = async () => {
    if (!scoreLessonId) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const lesson = lessons.find(item => item.id === scoreLessonId)
      if (!lesson) {
        setError('Dars topilmadi')
        return
      }

      const students = groupStudents.filter(student => student.groupId === lesson.groupId)

      for (const student of students) {
        const pointsValue = Number(scoreMap[student.id] || 0)
        if (Number.isNaN(pointsValue)) continue

        const existingSnap = await getDocs(
          query(
            collection(db, 'lessonScores'),
            where('lessonId', '==', scoreLessonId),
            where('studentId', '==', student.id)
          )
        )

        const payload = {
          lessonId: scoreLessonId,
          studentId: student.id,
          groupId: lesson.groupId,
          points: pointsValue,
          teacherId: currentUser.id,
          updatedAt: serverTimestamp()
        }

        if (!existingSnap.empty) {
          await updateDoc(doc(db, 'lessonScores', existingSnap.docs[0].id), payload)
        } else {
          await addDoc(collection(db, 'lessonScores'), {
            ...payload,
            createdAt: serverTimestamp()
          })
        }

        await recalculateStudentPoints(student.id)
      }

      setSuccess('Ballar saqlandi va reyting yangilandi')
      await loadData()
    } catch {
      setError('Ball saqlashda xatolik')
    } finally {
      setSaving(false)
    }
  }

  const studentsForSelectedGroup = groupStudents.filter(student => student.groupId === attendanceGroupId)

  const ranking = [...groupStudents]
    .sort((a, b) => Number(b.totalPoints || 0) - Number(a.totalPoints || 0))
    .slice(0, 15)

  const scoreLesson = lessons.find(item => item.id === scoreLessonId)
  const scoreStudents = scoreLesson
    ? groupStudents.filter(student => student.groupId === scoreLesson.groupId)
    : []

  return (
    <DashboardLayout
      title="O‘qituvchi paneli"
      sections={[
        { id: 'teacher-overview', label: 'Umumiy ko‘rsatkichlar' },
        { id: 'teacher-create-student', label: "Yangi o'quvchi" },
        { id: 'teacher-lessons', label: 'Darslar' },
        { id: 'teacher-scores', label: 'Ball berish' },
        { id: 'teacher-ranking', label: 'Reyting' },
        { id: 'teacher-assign', label: 'Talaba biriktirish' },
        { id: 'teacher-attendance', label: 'Davomat' }
      ]}
    >
      {loading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div className="space-y-6">
          <section id="teacher-overview" className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Mening guruhlarim</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{groups.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Talabalar soni</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{groupStudents.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Jami ball yozuvlari</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{lessonScores.length}</p>
            </div>
          </section>

          <section id="teacher-create-student" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Yangi o‘quvchi yaratish</h2>
            <form onSubmit={handleCreateStudent} className="grid gap-3 md:grid-cols-2">
              <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="To‘liq ism" value={studentForm.fullName} onChange={e => setStudentForm(prev => ({ ...prev, fullName: e.target.value }))} required />
              <input type="email" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Email" value={studentForm.email} onChange={e => setStudentForm(prev => ({ ...prev, email: e.target.value }))} required />
              <input type="password" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Parol" value={studentForm.password} onChange={e => setStudentForm(prev => ({ ...prev, password: e.target.value }))} required />
              <select className="rounded-lg border border-slate-300 px-3 py-2" value={studentForm.groupId} onChange={e => setStudentForm(prev => ({ ...prev, groupId: e.target.value }))} required>
                <option value="">Guruhni tanlang</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60 md:col-span-2">O‘quvchini yaratish</button>
            </form>
          </section>

          <section id="teacher-lessons" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Dars yaratish</h2>
            <form onSubmit={handleLessonSubmit} className="mb-5 grid gap-3 md:grid-cols-2">
              <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Dars nomi" value={lessonForm.title} onChange={e => setLessonForm(prev => ({ ...prev, title: e.target.value }))} required />
              <select className="rounded-lg border border-slate-300 px-3 py-2" value={lessonForm.groupId} onChange={e => setLessonForm(prev => ({ ...prev, groupId: e.target.value }))} required>
                <option value="">Guruhni tanlang</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <textarea className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Dars tavsifi" value={lessonForm.description} onChange={e => setLessonForm(prev => ({ ...prev, description: e.target.value }))} rows={3} required />
              <input type="url" className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Material link (ixtiyoriy)" value={lessonForm.materialUrl} onChange={e => setLessonForm(prev => ({ ...prev, materialUrl: e.target.value }))} />
              <input type="file" accept=".pdf,image/*,video/*" className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2" onChange={e => setLessonForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))} />
              <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60 md:col-span-2">Darsni saqlash</button>
              {saving && uploadProgress > 0 && (
                <div className="md:col-span-2 text-sm text-slate-600">Yuklanmoqda: {uploadProgress}%</div>
              )}
            </form>

            <div className="space-y-3">
              {lessons.map(lesson => (
                <div key={lesson.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{lesson.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{lesson.description}</p>
                  <p className="mt-1 text-sm text-slate-500">Guruh: {groups.find(g => g.id === lesson.groupId)?.name || lesson.groupId}</p>
                  <div className="mt-3 flex gap-4 text-sm">
                    {lesson.materialUrl && <a href={lesson.materialUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Material</a>}
                    <button onClick={() => handleDeleteLesson(lesson.id)} className="text-rose-600 hover:underline">O‘chirish</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="teacher-scores" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Dars bo‘yicha ball berish</h2>
            <div className="mb-3">
              <select className="rounded-lg border border-slate-300 px-3 py-2" value={scoreLessonId} onChange={e => setScoreLessonId(e.target.value)}>
                <option value="">Darsni tanlang</option>
                {lessons.map(lesson => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title} ({groups.find(g => g.id === lesson.groupId)?.name || lesson.groupId})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {scoreStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-800">{student.fullName}</p>
                  <input type="number" min="0" max="100" className="w-24 rounded-lg border border-slate-300 px-3 py-2" value={scoreMap[student.id] ?? ''} onChange={e => setScoreMap(prev => ({ ...prev, [student.id]: e.target.value }))} />
                </div>
              ))}
            </div>

            <button onClick={handleSaveScores} disabled={saving || !scoreLessonId} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">Ballarni saqlash</button>
          </section>

          <section id="teacher-ranking" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Talabalar reytingi</h2>
            <div className="space-y-2">
              {ranking.map((student, index) => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <p className="text-slate-800">{index + 1}. {student.fullName}</p>
                  <p className="font-semibold text-slate-900">{Number(student.totalPoints || 0)} ball</p>
                </div>
              ))}
            </div>
          </section>

          <section id="teacher-assign" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Talaba biriktirish</h2>
            <div className="space-y-2">
              {allStudents
                .filter(student => !student.groupId || groups.some(group => group.id === student.groupId))
                .map(student => (
                  <div key={student.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center">
                    <p className="font-medium text-slate-800 md:w-1/3">{student.fullName}</p>
                    <select className="rounded-lg border border-slate-300 px-3 py-2 md:w-1/3" value={studentGroupMap[student.id] || ''} onChange={e => setStudentGroupMap(prev => ({ ...prev, [student.id]: e.target.value }))}>
                      <option value="">Biriktirilmagan</option>
                      {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                    <button onClick={() => handleAssignStudent(student.id)} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-60">Saqlash</button>
                  </div>
                ))}
            </div>
          </section>

          <section id="teacher-attendance" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Davomat</h2>
            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <select className="rounded-lg border border-slate-300 px-3 py-2" value={attendanceGroupId} onChange={e => setAttendanceGroupId(e.target.value)}>
                <option value="">Guruhni tanlang</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <input type="date" className="rounded-lg border border-slate-300 px-3 py-2" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              {studentsForSelectedGroup.map(student => (
                <div key={student.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-800">{student.fullName}</p>
                  <select className="rounded-lg border border-slate-300 px-3 py-2" value={attendanceStatus[student.id] || ''} onChange={e => setAttendanceStatus(prev => ({ ...prev, [student.id]: e.target.value }))}>
                    <option value="">Tanlang</option>
                    <option value="present">Keldi</option>
                    <option value="late">Kechikdi</option>
                    <option value="absent">Kelmadi</option>
                  </select>
                </div>
              ))}
            </div>
            <button onClick={handleSaveAttendance} disabled={saving || !attendanceGroupId} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60">Davomatni saqlash</button>
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

export default TeacherDashboard
