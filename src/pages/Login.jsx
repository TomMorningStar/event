import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

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
    <div className="page center">
      <form className="panel login" onSubmit={submit}>
        <h1>Вход в админку</h1>
        <input placeholder="Логин" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoComplete="username" />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy || !login || !password}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
