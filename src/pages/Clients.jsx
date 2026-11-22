import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Backdrop from '../components/brand/Backdrop.jsx'
import TopBar from '../components/brand/TopBar.jsx'
import AdminNav from '../components/brand/AdminNav.jsx'
import { PersonName, plural } from '../components/brand/text.jsx'
import { IconArrowLeft, IconArrowRight, IconChevron, IconCross, IconSearch } from '../components/brand/icons.jsx'
import '../styles/public.css'
import '../styles/forms.css'
import '../styles/admin.css'
import '../styles/clients.css'

const fmt = (n) => (n ?? 0).toLocaleString('ru-RU')

function ClientRow({ c }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`vc-row ${c.winner ? 'is-won' : ''} ${open ? 'is-open' : ''}`}>
      <button className="vc-row-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="vc-name">
          <PersonName name={c.name} />
          {c.winner && <span className="vc-badge">Победитель</span>}
        </span>
        <span className="vc-phone">{c.phone}</span>
        <span className="vc-count">
          <b>{fmt(c.count)}</b>
          <span>{plural(c.count, ['билет', 'билета', 'билетов'])}</span>
        </span>
        <span className="vc-arrow"><IconChevron /></span>
      </button>
      {open && (
        <div className="vc-tickets">
          {c.tickets.map((t) => (
            <span key={t} className="vc-ticket">№ {t}</span>
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
    <div className="vd vd--quiet">
      <Backdrop />
      <div className="vd-page va">
        <TopBar>
          <AdminNav />
        </TopBar>

        <section className="va-hero">
          <div className="vd-eyebrow">
            <span className="vd-dot" />
            Покупатели
          </div>
          <h1 className="va-title">Клиенты</h1>
          <p className="vd-lead">Покупатели сгруппированы по номеру телефона. Нажмите на строку, чтобы увидеть все билеты клиента.</p>
        </section>

        <section className="va-section">
          <div className="va-panel">
            <div className="vc-search">
              <IconSearch />
              <input
                className="vd-input"
                placeholder="Поиск по ФИО, телефону или номеру билета"
                value={filters.q}
                onChange={set('q')}
                autoFocus
              />
            </div>
            <div className="vc-filters">
              <label className="vd-field">
                <span>Сортировка</span>
                <select className="vd-select" value={filters.sort} onChange={set('sort')}>
                  <option value="count_desc">Больше билетов</option>
                  <option value="count_asc">Меньше билетов</option>
                  <option value="name_asc">ФИО А → Я</option>
                  <option value="name_desc">ФИО Я → А</option>
                </select>
              </label>
              <label className="vd-field">
                <span>Билетов от</span>
                <input className="vd-input" type="number" min="0" inputMode="numeric" value={filters.min} onChange={set('min')} placeholder="0" />
              </label>
              <label className="vd-field">
                <span>до</span>
                <input className="vd-input" type="number" min="0" inputMode="numeric" value={filters.max} onChange={set('max')} placeholder="∞" />
              </label>
              <label className="vd-check">
                <input type="checkbox" checked={filters.winners} onChange={set('winners')} />
                <span className="vd-check-box" />
                Только победители
              </label>
              {dirty && (
                <button className="vd-btn vd-btn--ghost" onClick={reset}>
                  <IconCross />
                  Сбросить
                </button>
              )}
            </div>

            {error && (
              <div className="vd-alert vc-alert" role="alert">
                <IconCross />
                {error}
              </div>
            )}
            {data && (
              <p className="vc-summary">
                Найдено <b>{fmt(data.total)}</b> из {fmt(data.totalClients)} клиентов · {fmt(data.totalTickets)}{' '}
                {plural(data.totalTickets ?? 0, ['билет', 'билета', 'билетов'])}
              </p>
            )}

            {data && data.items.length > 0 && (
              <div className="vc-cols" aria-hidden>
                <span>ФИО</span>
                <span>Телефон</span>
                <span>Билеты</span>
                <span />
              </div>
            )}
            <div className="vc-list">
              {data?.items.map((c) => (
                <ClientRow key={c.phone} c={c} />
              ))}
              {data && data.items.length === 0 && <p className="vc-empty">Ничего не найдено</p>}
            </div>

            {data && data.pages > 1 && (
              <div className="vc-pager">
                <button className="vd-btn vd-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Предыдущая страница">
                  <IconArrowLeft />
                </button>
                <span>
                  Страница <b>{page}</b> из {data.pages}
                </span>
                <button className="vd-btn vd-btn--ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} aria-label="Следующая страница">
                  <IconArrowRight />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
