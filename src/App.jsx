import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/Admin/AdminDashboard'
import TeacherDashboard from './pages/Teacher/TeacherDashboard'
import StudentDashboard from './pages/Student/StudentDashboard'
import LoadingSpinner from './components/LoadingSpinner'

const App = () => {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser ? (
            <Navigate
              to={
                currentUser.role === 'admin'
                  ? '/admin'
                  : currentUser.role === 'teacher'
                    ? '/teacher'
                    : '/student'
              }
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
        <Route path="/teacher" element={<TeacherDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/student" element={<StudentDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
