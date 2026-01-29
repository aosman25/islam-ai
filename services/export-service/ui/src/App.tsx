import { Routes, Route, NavLink } from 'react-router-dom'
import { BookFiltersProvider } from './contexts/BookFiltersContext'
import BooksPage from './pages/BooksPage'
import JobsPage from './pages/JobsPage'

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <BookFiltersProvider>
      <div className="min-h-screen bg-slate-50">
        {/* Top nav */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <h1 className="text-base font-bold text-slate-800">
                المكتبة الإسلامية — خدمة التصدير
              </h1>
              <nav className="flex gap-2">
                <NavItem to="/">الكتب</NavItem>
                <NavItem to="/jobs">المهام</NavItem>
              </nav>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<BooksPage />} />
            <Route path="/jobs" element={<JobsPage />} />
          </Routes>
        </main>
      </div>
    </BookFiltersProvider>
  )
}
