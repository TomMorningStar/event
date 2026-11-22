import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Backdrop from '../components/brand/Backdrop.jsx'
import { IconArrowLeft, IconCross } from '../components/brand/icons.jsx'
import logoUrl from '../assets/brand/logo-vertical.svg'
import '../styles/public.css'
import '../styles/forms.css'

export default function Login() {
  const nav = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.login(login, password)
      nav('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vd vd--center vd--quiet">
      <Backdrop />
      <div className="vl">
        <form className="vl-card" onSubmit={submit}>
          <img className="vl-logo" src={logoUrl} alt="ВКУСДОМ — гипермаркет" />
          <h1 className="vl-title">Вход в админку</h1>
          <p className="vl-sub">Управление розыгрышем призов</p>

          <label className="vd-field">
            <span>Логин</span>
            <input
              className="vd-input"
              placeholder="Введите логин"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>
          <label className="vd-field">
            <span>Пароль</span>
            <input
              className="vd-input"
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div className="vd-alert" role="alert">
              <IconCross />
              {error}
            </div>
          )}

          <button className="vd-btn vd-btn--primary vd-btn--block" disabled={busy || !login || !password}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <Link to="/" className="vl-back">
          <IconArrowLeft />
          На страницу розыгрыша
        </Link>
      </div>
    </div>
  )
}
