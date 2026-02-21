import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

const Register = () => {
  const { currentUser, loading } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && currentUser) {
      navigate('/student')
    }
  }, [currentUser, loading, navigate])

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (formData.password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo‘lishi kerak')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Parollar mos kelmadi')
      return
    }

    setSubmitting(true)

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      )

      await setDoc(doc(db, 'users', credential.user.uid), {
        fullName: formData.fullName,
        email: formData.email,
        role: 'student',
        groupId: ''
      })

      navigate('/student')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Bu email allaqachon mavjud')
      } else {
        setError("Ro‘yxatdan o‘tishda xatolik yuz berdi")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-cyan-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg"
      >
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">Ro‘yxatdan o‘tish</h2>

        <label className="mb-2 block text-sm font-medium text-gray-700">To‘liq ism</label>
        <input
          type="text"
          required
          value={formData.fullName}
          onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
          className="mb-4 w-full rounded border px-3 py-2 outline-none ring-green-500 focus:ring"
          placeholder="Ism Familiya"
        />

        <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="mb-4 w-full rounded border px-3 py-2 outline-none ring-green-500 focus:ring"
          placeholder="email@example.com"
        />

        <label className="mb-2 block text-sm font-medium text-gray-700">Parol</label>
        <input
          type="password"
          required
          value={formData.password}
          onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
          className="mb-4 w-full rounded border px-3 py-2 outline-none ring-green-500 focus:ring"
          placeholder="Kamida 6 ta belgi"
        />

        <label className="mb-2 block text-sm font-medium text-gray-700">Parolni tasdiqlang</label>
        <input
          type="password"
          required
          value={formData.confirmPassword}
          onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
          className="mb-2 w-full rounded border px-3 py-2 outline-none ring-green-500 focus:ring"
          placeholder="Parolni qayta kiriting"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          disabled={submitting}
          className="w-full rounded bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
        >
          {submitting ? 'Yaratilmoqda...' : 'Ro‘yxatdan o‘tish'}
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Akkountingiz bormi?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Kirish
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Register
