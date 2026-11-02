import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import BottomNav from './components/BottomNav'
import LoadingScreen from './components/LoadingScreen'

// Lazy load per halaman
const HomePage         = lazy(() => import('./pages/HomePage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const PocketsPage      = lazy(() => import('./pages/PocketsPage'))
const WishlistPage     = lazy(() => import('./pages/WishlistPage'))
const InsightsPage     = lazy(() => import('./pages/InsightsPage'))
const SettingsPage     = lazy(() => import('./pages/SettingsPage'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="app-shell">
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/"           element={<HomePage />} />
                <Route path="/transaksi"  element={<TransactionsPage />} />
                <Route path="/tabungan"   element={<PocketsPage />} />
                <Route path="/wishlist"   element={<WishlistPage />} />
                <Route path="/insights"   element={<InsightsPage />} />
                <Route path="/pengaturan" element={<SettingsPage />} />
                <Route path="*"           element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            <BottomNav />
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
