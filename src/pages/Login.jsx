import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const redirectByRole = (role, navigate) => {
  if (role === 'admin') navigate('/admin')
  else if (role === 'teacher') navigate('/teacher')
  else if (role === 'student') navigate('/student')
}

const Login = () => {
  const { login, currentUser, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && currentUser) {
      redirectByRole(currentUser.role, navigate)
    }
  }, [currentUser, loading, navigate])

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password)
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setError("Email yoki parol noto'g'ri")
      } else {
        setError('Kirishda xatolik yuz berdi')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg"
      >
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">LMS tizimiga kirish</h2>

        <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="mb-4 w-full rounded border px-3 py-2 outline-none ring-blue-500 focus:ring"
          placeholder="email@example.com"
        />

        <label className="mb-2 block text-sm font-medium text-gray-700">Parol</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mb-2 w-full rounded border px-3 py-2 outline-none ring-blue-500 focus:ring"
          placeholder="******"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {submitting ? 'Tekshirilmoqda...' : 'Kirish'}
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Akkountingiz yo‘qmi?{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:underline">
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Login
