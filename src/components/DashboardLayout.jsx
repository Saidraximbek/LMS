import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const roleLabels = {
  admin: 'Admin',
  teacher: "O'qituvchi",
  student: 'Talaba'
}

const roleColors = {
  admin: 'bg-rose-100 text-rose-700',
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700'
}

const DashboardLayout = ({ title, children, sections = [] }) => {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const contentRef = useRef(null)
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  useEffect(() => {
    if (!sections.length) return
    if (!sections.some(section => section.id === activeSection)) {
      setActiveSection(sections[0].id)
    }
  }, [sections, activeSection])

  useEffect(() => {
    if (!sections.length || !contentRef.current) return

    const allowedIds = new Set(sections.map(section => section.id))
    const sectionNodes = contentRef.current.querySelectorAll('section[id]')

    sectionNodes.forEach(node => {
      if (!allowedIds.has(node.id)) return
      node.style.display = node.id === activeSection ? '' : 'none'
    })
  }, [sections, activeSection])

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">LMS boshqaruv tizimi</p>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-medium text-slate-800">{currentUser?.fullName}</p>
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  roleColors[currentUser?.role] || 'bg-slate-100 text-slate-700'
                }`}
              >
                {roleLabels[currentUser?.role]}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {sections.length > 0 ? (
          <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
            <aside className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:mb-0 lg:h-fit">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Bo‘limlar
              </p>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {sections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      activeSection === section.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </aside>

            <div ref={contentRef}>{children}</div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}

export default DashboardLayout
