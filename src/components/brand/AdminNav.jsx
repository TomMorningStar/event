import { NavLink, useNavigate } from 'react-router-dom'
import { api } from '../../api.js'
import { IconExternal, IconLogout } from './icons.jsx'

/** Навигация админки для правой части TopBar. */
export default function AdminNav({ onLogout }) {
  const nav = useNavigate()
  const logout =
    onLogout ??
    (async () => {
      await api.logout()
      nav('/login', { replace: true })
    })
  const cls = ({ isActive }) => `va-nav-link ${isActive ? 'is-active' : ''}`
  return (
    <nav className="va-nav" aria-label="Разделы админки">
      <NavLink to="/admin" end className={cls}>
        Розыгрыш
      </NavLink>
      <NavLink to="/admin/clients" className={cls}>
        Клиенты
      </NavLink>
      <NavLink to="/admin/fair" className={cls}>
        Проверка
      </NavLink>
      <a className="va-nav-link" href="/" target="_blank" rel="noreferrer">
        Экран розыгрыша
        <IconExternal />
      </a>
      <button type="button" className="va-nav-link va-nav-logout" onClick={logout}>
        <IconLogout />
        Выйти
      </button>
    </nav>
  )
}
