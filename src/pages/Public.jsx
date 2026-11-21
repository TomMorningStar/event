import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import TicketRoll from '../components/TicketRoll.jsx'

function Carousel({ sample }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!sample.length) return
    const id = setInterval(() => setI((x) => x + 1), 2600)
    return () => clearInterval(id)
  }, [sample.length])
  if (!sample.length) return <div className="idle-empty">Билеты ещё не загружены</div>
  const t = sample[i % sample.length]
  return (
    <div className="idle">
      <div className="roll-label">Участники розыгрыша</div>
      <div className="ticket-card" key={i}>
        <div className="ticket-no">{t.ticket}</div>
        <div className="ticket-name">{t.name}</div>
        <div className="ticket-phone">{t.phone}</div>
      </div>
    </div>
  )
}

function Marquee({ sample }) {
  if (sample.length < 5) return null
  const items = sample.slice(0, 30)
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="chip">
            № {t.ticket}
          </span>
        ))}
      </div>
    </div>
  )
}

function Pending({ prize, sample }) {
  const d = prize.pending
  const [now, setNow] = useState(Date.now())
  const [t, setT] = useState(sample[0])
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      if (sample.length) setT(sample[Math.floor(Math.random() * sample.length)])
    }, 90)
    return () => clearInterval(id)
  }, [sample])
  const left = Math.max(0, Math.ceil((new Date(d.revealAt).getTime() - now) / 1000))
  return (
    <div className="pending">
      <div className="roll-prize">🎁 {prize.title}</div>
      <div className="roll-label">Пул участников зафиксирован</div>
      <div className="pending-spin">{t?.ticket ?? '••••••••'}</div>
      <div className="pending-info">
        {left > 0 ? (
          <>Случайное число выпустит drand через <b>{left} с</b> — раунд №{d.round}</>
        ) : (
          <>Получаем случайное число drand, раунд №{d.round}…</>
        )}
      </div>
      <div className="pending-hash">
        В пуле {d.poolSize.toLocaleString('ru-RU')} билетов · poolHash <code>{d.poolHash.slice(0, 16)}…</code>
      </div>
    </div>
  )
}

export default function Public() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const seen = useRef(null) // id победителей, уже известных странице
  const [queue, setQueue] = useState([]) // победители, ожидающие анимации
  const [revealed, setRevealed] = useState(() => new Set()) // id, показанные в списке
  const sampleRef = useRef([])

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const d = await api.publicState()
        if (stop) return
        setError(false)
        setData(d)
        sampleRef.current = d.sample
        const winners = d.prizes.filter((p) => p.winner).map((p) => ({ ...p.winner, prizeTitle: p.title }))
        if (seen.current === null) {
          seen.current = new Set(winners.map((w) => w.id))
          setRevealed(new Set(seen.current))
        } else {
          const fresh = winners.filter((w) => !seen.current.has(w.id))
          if (fresh.length) {
            fresh.forEach((w) => seen.current.add(w.id))
            setQueue((q) => [...q, ...fresh])
          }
          // отменённые победители
          const ids = new Set(winners.map((w) => w.id))
          setRevealed((r) => new Set([...r].filter((id) => ids.has(id))))
        }
      } catch {
        if (!stop) setError(true)
      }
    }
    load()
    const id = setInterval(load, 2500)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  const current = queue[0]
  const pendingPrize = data?.prizes.find((p) => p.pending)
  const onDone = useCallback(() => {
    setQueue((q) => {
      if (q[0]) setRevealed((r) => new Set(r).add(q[0].id))
      return q.slice(1)
    })
  }, [])

  if (!data) return <div className="page center">{error ? 'Нет связи с сервером…' : 'Загрузка…'}</div>

  return (
    <div className="page public">
      <header className="hero">
        <h1>🎉 Розыгрыш призов</h1>
        <p>Участвует билетов: <b>{data.ticketCount.toLocaleString('ru-RU')}</b></p>
      </header>

      <Marquee sample={data.sample} />

      <section className="stage">
        {current ? (
          <TicketRoll
            key={current.id}
            winner={current}
            prizeTitle={current.prizeTitle}
            sample={sampleRef.current}
            onDone={onDone}
          />
        ) : pendingPrize ? (
          <Pending prize={pendingPrize} sample={data.sample} />
        ) : (
          <Carousel sample={data.sample} />
        )}
      </section>

      <section className="prizes">
        <h2>Призы</h2>
        {data.prizes.length === 0 && <p className="muted">Призы пока не добавлены</p>}
        <div className="prize-grid">
          {data.prizes.map((p) => {
            const show = p.winner && revealed.has(p.winner.id)
            return (
              <div key={p.id} className={`prize ${show ? 'won' : ''}`}>
                <div className="prize-title">🎁 {p.title}</div>
                {show ? (
                  <div className="prize-winner">
                    <div className="pw-ticket">№ {p.winner.ticket}</div>
                    <div className="pw-name">{p.winner.name}</div>
                    <div className="pw-phone">{p.winner.phone}</div>
                  </div>
                ) : (
                  <div className="muted">{p.winner || p.pending ? 'Определяется…' : 'Ожидает розыгрыша'}</div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <footer className="fair-footer">
        🔒 Победители выбираются публичным генератором случайности drand и проверяемым алгоритмом.{' '}
        <Link to="/fair">Проверить честность розыгрыша →</Link>
      </footer>
    </div>
  )
}
