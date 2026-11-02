import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/',            icon: '🏠', label: 'Beranda'  },
  { to: '/transaksi',   icon: '💸', label: 'Catat'    },
  { to: '/tabungan',    icon: '🐷', label: 'Nabung'   },
  { to: '/wishlist',    icon: '✨', label: 'Wishlist' },
  { to: '/pengaturan',  icon: '⚙️', label: 'Atur'     },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      {navItems.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`
          }
          aria-label={label}
        >
          <span className="bottom-nav__icon" aria-hidden="true">{icon}</span>
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
