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
  const [filters, setFilters] = useState({ q: '', sort: 'count_desc', min: '', max: '', winners: false })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const reset = () => setFilters({ q: '', sort: 'count_desc', min: '', max: '', winners: false })
  const dirty = filters.q || filters.min || filters.max || filters.winners || filters.sort !== 'count_desc'

  useEffect(() => {
    const id = setTimeout(() => {
      setApplied(filters)
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [filters])

  useEffect(() => {
    let stop = false
    api
      .clients({
        q: applied.q,
        sort: applied.sort,
        min: applied.min,
        max: applied.max,
        winners: applied.winners ? '1' : '0',
        page,
      })
      .then(
        (d) => !stop && (setData(d), setError('')),
        (e) => {
          if (e.status === 401) return nav('/login', { replace: true })
          setError(e.message)
        },
      )
    return () => {
      stop = true
    }
  }, [applied, page, nav])

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
          value={filters.q}
          onChange={set('q')}
          autoFocus
        />
        <div className="filters">
          <label>
            Сортировка
            <select value={filters.sort} onChange={set('sort')}>
              <option value="count_desc">Больше билетов</option>
              <option value="count_asc">Меньше билетов</option>
              <option value="name_asc">ФИО А → Я</option>
              <option value="name_desc">ФИО Я → А</option>
            </select>
          </label>
          <label>
            Билетов от
            <input type="number" min="0" inputMode="numeric" value={filters.min} onChange={set('min')} placeholder="0" />
          </label>
          <label>
            до
            <input type="number" min="0" inputMode="numeric" value={filters.max} onChange={set('max')} placeholder="∞" />
          </label>
          <label className="check">
            <input type="checkbox" checked={filters.winners} onChange={set('winners')} />
            Только победители
          </label>
          {dirty && <button className="btn" onClick={reset}>Сбросить</button>}
        </div>
        {error && <div className="error">{error}</div>}
        {data && (
          <p className="muted small">
            Найдено {fmt(data.total)} из {fmt(data.totalClients)} клиентов · {fmt(data.totalTickets)} билетов
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
