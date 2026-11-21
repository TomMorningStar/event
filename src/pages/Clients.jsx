import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const fmt = (n) => (n ?? 0).toLocaleString('ru-RU')

function ClientRow({ c }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`client ${c.winner ? 'won' : ''}`}>
      <button className="client-main" onClick={() => setOpen((o) => !o)}>
        <span className="c-name">{c.name}{c.winner && <span className="badge">🏆 победитель</span>}</span>
        <span className="c-phone">{c.phone}</span>
        <span className="c-count">{fmt(c.count)} бил.</span>
        <span className="c-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="c-tickets">
          {c.tickets.map((t) => (
            <span key={t} className="chip">№ {t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Clients() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  // поиск с задержкой, чтобы не дёргать сервер на каждую букву
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    let stop = false
    api.clients(query, page).then(
      (d) => !stop && (setData(d), setError('')),
      (e) => {
        if (e.status === 401) return nav('/login', { replace: true })
        setError(e.message)
      },
    )
    return () => {
      stop = true
    }
  }, [query, page, nav])

  return (
    <div className="page admin">
      <header className="admin-head">
        <h1>Клиенты</h1>
        <div>
          <Link className="btn" to="/admin">← Админка</Link>
        </div>
      </header>

      <section className="panel">
        <input
          className="search"
          placeholder="Поиск по ФИО, телефону или номеру билета"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        {error && <div className="error">{error}</div>}
        {data && (
          <p className="muted small">
            Найдено {fmt(data.total)} из {fmt(data.totalClients)} клиентов
          </p>
        )}

        <div className="client-list">
          {data?.items.map((c) => (
            <ClientRow key={c.phone} c={c} />
          ))}
          {data && data.items.length === 0 && <p className="muted">Ничего не найдено</p>}
        </div>

        {data && data.pages > 1 && (
          <div className="pager">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
            <span>{page} / {data.pages}</span>
            <button className="btn" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>→</button>
          </div>
        )}
      </section>
    </div>
  )
}
