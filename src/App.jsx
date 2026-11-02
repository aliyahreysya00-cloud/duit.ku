import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import BottomNav from './components/BottomNav'
import LoadingScreen from './components/LoadingScreen'

// Lazy load semua halaman untuk code splitting
const AuthPage         = lazy(() => import('./pages/AuthPage'))
const HomePage         = lazy(() => import('./pages/HomePage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const PocketsPage      = lazy(() => import('./pages/PocketsPage'))
const WishlistPage     = lazy(() => import('./pages/WishlistPage'))
const SettingsPage     = lazy(() => import('./pages/SettingsPage'))

function AppRoutes() {
  const { user } = useAuth()

  // user === undefined berarti masih loading session
  if (user === undefined) {
    return <LoadingScreen message="Bentar ya, lagi nyiapin semuanya... 🐣" />
  }

  // Belum login → tampilkan halaman auth
  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="*" element={<AuthPage />} />
        </Routes>
      </Suspense>
    )
  }

  // Sudah login → tampilkan app
  return (
    <div className="app-shell">
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/"            element={<HomePage />} />
          <Route path="/transaksi"   element={<TransactionsPage />} />
          <Route path="/tabungan"    element={<PocketsPage />} />
          <Route path="/wishlist"    element={<WishlistPage />} />
          <Route path="/pengaturan"  element={<SettingsPage />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
