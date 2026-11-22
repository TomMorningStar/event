import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

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

  if (!state) return <div className="page center">{error || 'Загрузка…'}</div>
  const { tickets, prizes } = state
  const s = tickets.stats

  return (
    <div className="page admin">
      <header className="admin-head">
        <h1>Админка розыгрыша</h1>
        <div>
          <a className="btn" href="/" target="_blank" rel="noreferrer">Клиентская страница ↗</a>
          <Link className="btn" to="/admin/clients">Клиенты</Link>
          <Link className="btn" to="/admin/fair">Проверка</Link>
          <button className="btn" onClick={logout}>Выйти</button>
        </div>
      </header>

      {error && <div className="error banner">{error}</div>}

      <section className="panel">
        <h2>1. Список билетов</h2>
        <p className="muted">
          Формат файла: колонка A — номер билета, B — ФИО, C — телефон (первая строка — заголовок).{' '}
          <a href="/api/admin/template">Скачать шаблон</a>
        </p>
        <label
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onFile(e.dataTransfer.files[0])
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onFile(e.target.files[0])} />
          {busy === 'upload' ? 'Обрабатываем файл… (большие файлы — до минуты)' : 'Перетащите Excel сюда или нажмите, чтобы выбрать файл'}
        </label>
        {tickets.count > 0 ? (
          <div className="stats">
            <div><b>{fmt(tickets.count)}</b><span>билетов в розыгрыше</span></div>
            <div><b>{fmt(s?.participants)}</b><span>уникальных телефонов</span></div>
            <div><b>{fmt(s?.noName)}</b><span>без ФИО (участвуют)</span></div>
            <div className="warn"><b>{fmt(s?.invalid)}</b><span>без телефона (пропущены)</span></div>
            <div className="warn"><b>{fmt(s?.duplicates)}</b><span>дубликатов номера</span></div>
            <div className="file">listHash: <code className="break">{tickets.listHash}</code></div>
            <div className="file">{tickets.fileName} · {new Date(tickets.uploadedAt).toLocaleString('ru-RU')}</div>
          </div>
        ) : (
          <p className="muted">Файл ещё не загружен</p>
        )}
      </section>

      <section className="panel">
        <h2>2. Призы и розыгрыш</h2>
        <form className="row" onSubmit={addPrize}>
          <input placeholder="Название приза, например: iPhone 17" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <button className="btn primary" disabled={!title.trim() || !!busy}>Добавить приз</button>
        </form>

        {prizes.length === 0 && <p className="muted">Призов пока нет</p>}
        <div className="admin-prizes">
          {prizes.map((p) => (
            <div key={p.id} className={`admin-prize ${p.winner ? 'won' : ''}`}>
              <div className="ap-main">
                <div className="ap-title">🎁 {p.title}</div>
                {p.winner ? (
                  <dl className="winner">
                    <dt>ФИО</dt><dd>{p.winner.name}</dd>
                    <dt>Билет</dt><dd>{p.winner.ticket}</dd>
                    <dt>Телефон</dt><dd>{p.winner.phone}</dd>
                    <dt>Время</dt><dd>{new Date(p.winner.drawnAt).toLocaleString('ru-RU')}</dd>
                    <dt>drand</dt><dd>раунд №{p.winner.round}, индекс {p.winner.index} из {p.winner.poolSize}</dd>
                  </dl>
                ) : p.pending ? (
                  <div className="muted">
                    ⏳ Ждём раунд drand №{p.pending.round} ({new Date(p.pending.revealAt).toLocaleTimeString('ru-RU')})
                    <div className="small">Код фиксации: <code className="break">{p.pending.commitment}</code></div>
                    {p.pending.error && <div className="error small">{p.pending.error} — повторяем…</div>}
                  </div>
                ) : (
                  <div className="muted">Победитель не выбран</div>
                )}
              </div>
              <div className="ap-actions">
                {p.winner ? (
                  <button
                    className="btn"
                    disabled={!!busy}
                    onClick={() => cancel(p)}
                  >
                    Отменить результат
                  </button>
                ) : p.pending ? null : (
                  <button className="btn primary" disabled={!!busy || tickets.count === 0} onClick={() => run('draw', () => api.draw(p.id))}>
                    🎲 Разыграть
                  </button>
                )}
                <button
                  className="btn danger"
                  disabled={!!busy || !!p.pending}
                  onClick={() => confirm(`Удалить приз «${p.title}»${p.winner ? ' (результат останется в публичном журнале как отменённый)' : ''}?`) && run('del', () => api.deletePrize(p.id))}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
        {state.history?.length > 0 && (
          <details className="history">
            <summary>Отменённые результаты ({state.history.length})</summary>
            {state.history.map((d) => (
              <div key={d.id} className="muted small">
                #{d.drawNo} «{d.prizeTitle}» — билет {d.ticket ?? '—'}, {d.name ?? ''} {d.phone ?? ''} · отменён {new Date(d.cancelledAt).toLocaleString('ru-RU')}: {d.cancelReason}
              </div>
            ))}
          </details>
        )}
      </section>
    </div>
  )
}
