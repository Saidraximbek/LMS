import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const ProtectedRoute = ({ allowedRoles }) => {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner text="Yuklanmoqda..." />
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
