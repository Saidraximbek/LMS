const LoadingSpinner = ({ text = 'Iltimos kuting...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <p className="text-gray-700">{text}</p>
    </div>
  )
}

export default LoadingSpinner
