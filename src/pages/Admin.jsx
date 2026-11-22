import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Backdrop from '../components/brand/Backdrop.jsx'
import TopBar from '../components/brand/TopBar.jsx'
import AdminNav from '../components/brand/AdminNav.jsx'
import { PersonName } from '../components/brand/text.jsx'
import { IconCross, IconDownload, IconPlay, IconPlus, IconTrash, IconUndo, IconUpload } from '../components/brand/icons.jsx'
import '../styles/public.css'
import '../styles/forms.css'
import '../styles/admin.css'

const fmt = (n) => (n ?? 0).toLocaleString('ru-RU')

export default function Admin() {
  const nav = useNavigate()
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [title, setTitle] = useState('')
  const fileRef = useRef(null)

  const run = async (label, fn) => {
    setBusy(label)
    setError('')
    try {
      setState(await fn())
    } catch (e) {
      if (e.status === 401) return nav('/login', { replace: true })
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    run('load', api.adminState)

  }, [])

  const hasPending = state?.prizes.some((p) => p.pending)
  useEffect(() => {
    if (!hasPending) return
    const id = setInterval(() => api.adminState().then(setState, () => {}), 2000)
    return () => clearInterval(id)
  }, [hasPending])

  const cancel = (p) => {
    const reason = prompt('Результат будет отменён, отмена попадёт в публичный журнал. Укажите причину:')
    if (reason === null) return
    run('rm', () => api.removeWinner(p.id, reason))
  }

  const onFile = (file) => {
    if (!file) return
    const hasWinners = state?.prizes.some((p) => p.winner)
    if (hasWinners && !confirm('Список билетов будет заменён. Уже выбранные победители сохранятся. Продолжить?')) return
    run('upload', () => api.upload(file))
    if (fileRef.current) fileRef.current.value = ''
  }

  const addPrize = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    run('prize', () => api.addPrize(title.trim()))
    setTitle('')
  }

  const logout = async () => {
    await api.logout()
    nav('/login', { replace: true })
  }

  if (!state)
    return (
      <div className="vd vd--center vd--quiet">
        <Backdrop />
        <div className="vd-loading">{error || 'Загрузка…'}</div>
      </div>
    )
  const { tickets, prizes } = state
  const s = tickets.stats
  const won = prizes.filter((p) => p.winner).length

  return (
    <div className="vd vd--quiet">
      <Backdrop />
      <div className="vd-page va">
        <TopBar>
          <AdminNav onLogout={logout} />
        </TopBar>

        <section className="va-hero">
          <div className="vd-eyebrow">
            <span className="vd-dot" />
            Панель управления
          </div>
          <h1 className="va-title">
            Розыгрыш <span>призов</span>
          </h1>
          <p className="vd-lead">
            Загрузите список билетов, добавьте призы и проводите розыгрыш — результат сразу появится на экране розыгрыша.
          </p>
        </section>

        {error && (
          <div className="vd-alert" role="alert">
            <IconCross />
            {error}
          </div>
        )}

        <section className="va-section">
          <div className="va-section-head">
            <span className="va-section-no">01</span>
            <h2>Список билетов</h2>
          </div>
          <div className="va-panel">
            <div className="va-help">
              <p>
                Формат файла: колонка <b>A</b> — номер билета, <b>B</b> — ФИО, <b>C</b> — телефон (первая строка — заголовок).
              </p>
              <a className="vd-btn vd-btn--ghost" href="/api/admin/template">
                <IconDownload />
                Скачать шаблон
              </a>
            </div>
            <label
              className={`va-drop ${busy === 'upload' ? 'is-busy' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onFile(e.dataTransfer.files[0])
              }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onFile(e.target.files[0])} />
              <span className="va-drop-icon">
                <IconUpload />
              </span>
              {busy === 'upload' ? (
                <>
                  <b>Обрабатываем файл…</b>
                  <small>Большие файлы — до минуты</small>
                </>
              ) : (
                <>
                  <b>Перетащите Excel сюда или нажмите, чтобы выбрать файл</b>
                  <small>Форматы .xlsx, .xls, .csv</small>
                </>
              )}
            </label>
            {tickets.count > 0 ? (
              <>
                <div className="va-stats">
                  <div className="va-stat is-main"><b>{fmt(tickets.count)}</b><span>билетов в розыгрыше</span></div>
                  <div className="va-stat"><b>{fmt(s?.participants)}</b><span>уникальных телефонов</span></div>
                  <div className="va-stat"><b>{fmt(s?.noName)}</b><span>без ФИО (участвуют)</span></div>
                  <div className={`va-stat is-warn ${s?.invalid ? '' : 'is-zero'}`}><b>{fmt(s?.invalid)}</b><span>без телефона (пропущены)</span></div>
                  <div className={`va-stat is-warn ${s?.duplicates ? '' : 'is-zero'}`}><b>{fmt(s?.duplicates)}</b><span>дубликатов номера</span></div>
                </div>
                <dl className="va-file">
                  <dt>Файл</dt>
                  <dd>{tickets.fileName} · {new Date(tickets.uploadedAt).toLocaleString('ru-RU')}</dd>
                  <dt>listHash</dt>
                  <dd><code>{tickets.listHash}</code></dd>
                </dl>
              </>
            ) : (
              <p className="va-empty">Файл ещё не загружен</p>
            )}
          </div>
        </section>

        <section className="va-section">
          <div className="va-section-head">
            <span className="va-section-no">02</span>
            <h2>Призы и розыгрыш</h2>
          </div>
          <div className="va-panel">
            <form className="va-add" onSubmit={addPrize}>
              <input
                className="vd-input"
                placeholder="Название приза, например: iPhone 17"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <button className="vd-btn vd-btn--primary" disabled={!title.trim() || !!busy}>
                <IconPlus />
                Добавить приз
              </button>
            </form>

            {prizes.length === 0 && <p className="va-empty">Призов пока нет</p>}
            {prizes.length > 0 && (
              <p className="va-count">
                Разыграно {won} из {prizes.length}
              </p>
            )}
            <div className="va-prizes">
              {prizes.map((p, i) => (
                <article key={p.id} className={`va-prize ${p.winner ? 'is-won' : p.pending ? 'is-pending' : ''}`}>
                  <div className="va-prize-main">
                    <div className="va-prize-head">
                      <span className="va-prize-no">Приз {String(i + 1).padStart(2, '0')}</span>
                      {p.winner ? (
                        <span className="va-tag is-won">Разыгран</span>
                      ) : p.pending ? (
                        <span className="va-tag is-pending"><span className="vd-dot vd-dot--pulse" />Идёт розыгрыш</span>
                      ) : (
                        <span className="va-tag is-idle">Ожидает</span>
                      )}
                    </div>
                    <h3 className="va-prize-title">{p.title}</h3>
                    {p.winner ? (
                      <dl className="va-winner">
                        <div><dt>ФИО</dt><dd><PersonName name={p.winner.name} /></dd></div>
                        <div className="va-w-ticket"><dt>Билет</dt><dd>№ {p.winner.ticket}</dd></div>
                        <div><dt>Телефон</dt><dd>{p.winner.phone}</dd></div>
                        <div><dt>Время</dt><dd>{new Date(p.winner.drawnAt).toLocaleString('ru-RU')}</dd></div>
                        <div className="va-w-drand"><dt>drand</dt><dd>раунд №{p.winner.round}, индекс {p.winner.index} из {p.winner.poolSize}</dd></div>
                      </dl>
                    ) : p.pending ? (
                      <div className="va-pending">
                        <div className="va-pending-row">
                          <span className="va-spinner" />
                          Ждём раунд drand №{p.pending.round} ({new Date(p.pending.revealAt).toLocaleTimeString('ru-RU')})
                        </div>
                        <small>Код фиксации: <code>{p.pending.commitment}</code></small>
                        {p.pending.error && <small className="va-err">{p.pending.error} — повторяем…</small>}
                      </div>
                    ) : (
                      <p className="va-idle">Победитель не выбран</p>
                    )}
                  </div>
                  <div className="va-actions">
                    {p.winner ? (
                      <button className="vd-btn vd-btn--ghost" disabled={!!busy} onClick={() => cancel(p)}>
                        <IconUndo />
                        Отменить результат
                      </button>
                    ) : p.pending ? null : (
                      <button className="vd-btn vd-btn--primary" disabled={!!busy || tickets.count === 0} onClick={() => run('draw', () => api.draw(p.id))}>
                        <IconPlay />
                        Разыграть
                      </button>
                    )}
                    <button
                      className="vd-btn vd-btn--danger"
                      disabled={!!busy || !!p.pending}
                      onClick={() => confirm(`Удалить приз «${p.title}»${p.winner ? ' (результат останется в публичном журнале как отменённый)' : ''}?`) && run('del', () => api.deletePrize(p.id))}
                    >
                      <IconTrash />
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {state.history?.length > 0 && (
              <details className="va-history">
                <summary>Отменённые результаты ({state.history.length})</summary>
                <ul>
                  {state.history.map((d) => (
                    <li key={d.id}>
                      <b>#{d.drawNo} «{d.prizeTitle}»</b> — билет {d.ticket ?? '—'}, {d.name ?? ''} {d.phone ?? ''} · отменён{' '}
                      {new Date(d.cancelledAt).toLocaleString('ru-RU')}: {d.cancelReason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
