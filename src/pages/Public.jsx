import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import TicketRoll from '../components/TicketRoll.jsx'
import Backdrop from '../components/brand/Backdrop.jsx'
import { PersonName, plural } from '../components/brand/text.jsx'
import logoUrl from '../assets/brand/logo-horizontal.svg'
import signUrl from '../assets/brand/sign.svg'
import '../styles/public.css'

const fmt = (n) => (n ?? 0).toLocaleString('ru-RU')

function Carousel({ sample }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!sample.length) return
    const id = setInterval(() => setI((x) => x + 1), 2600)
    return () => clearInterval(id)
  }, [sample.length])
  const t = sample.length ? sample[i % sample.length] : null
  return (
    <div className="vd-ticket-stack">
      <div className="vd-ticket-back vd-ticket-back--lime" />
      <div className="vd-ticket-back vd-ticket-back--glass" />
      <div className="vd-ticket" key={i}>
        <div className="vd-ticket-top">
          <img src={signUrl} alt="" />
          <span>Билет участника</span>
        </div>
        {t ? (
          <>
            <div className="vd-ticket-no">№ {t.ticket}</div>
            <div className="vd-ticket-person">
              <PersonName className="vd-ticket-name" name={t.name} />
              <div className="vd-ticket-phone">{t.phone}</div>
            </div>
          </>
        ) : (
          <>
            <div className="vd-ticket-no vd-ticket-no--empty">№ ••••••</div>
            <div className="vd-ticket-person">
              <div className="vd-ticket-name">Билеты ещё не загружены</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Idle({ data }) {
  const total = data.prizes.length
  const won = data.prizes.filter((p) => p.winner).length
  const lead =
    total > 0 && won === total
      ? 'Все призы разыграны. Поздравляем победителей!'
      : won > 0
        ? 'Розыгрыш идёт прямо сейчас — следите за экраном.'
        : 'Совсем скоро мы узнаем имена счастливых победителей.'
  return (
    <div className="vd-idle">
      <div className="vd-hero">
        <div className="vd-eyebrow">
          <span className="vd-dot" />
          Розыгрыш призов
        </div>
        <h1 className="vd-title">
          Время
          <br />
          <span>подарков.</span>
        </h1>
        <p className="vd-lead">{lead}</p>
        <div className="vd-stats">
          <div>
            <b>{fmt(data.ticketCount)}</b>
            <span>{plural(data.ticketCount, ['билет участвует', 'билета участвуют', 'билетов участвуют'])}</span>
          </div>
          <div className="vd-stats-sep" />
          <div>
            <b>{fmt(total)}</b>
            <span>{plural(total, ['приз в розыгрыше', 'приза в розыгрыше', 'призов в розыгрыше'])}</span>
          </div>
        </div>
      </div>
      <Carousel sample={data.sample} />
    </div>
  )
}

function Marquee({ sample }) {
  if (sample.length < 5) return null
  const items = sample.slice(0, 30)
  return (
    <div className="vd-marquee" aria-hidden>
      <div className="vd-marquee-track">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="vd-chip">
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
    <div className="vd-scene vd-pending">
      <div className="vd-eyebrow vd-eyebrow--center">
        <span className="vd-dot vd-dot--pulse" />
        Пул участников зафиксирован
      </div>
      <h2 className="vd-scene-title">{prize.title}</h2>
      <div className="vd-pending-spin">{t?.ticket ?? '•••••••'}</div>
      <div className="vd-countdown">
        {left > 0 ? (
          <>
            <div className="vd-countdown-num">{left}</div>
            <div className="vd-countdown-text">
              {plural(left, ['секунда', 'секунды', 'секунд'])} до случайного числа
              <span>drand, раунд №{d.round}</span>
            </div>
          </>
        ) : (
          <>
            <div className="vd-countdown-num vd-countdown-num--wait" />
            <div className="vd-countdown-text">
              Получаем случайное число
              <span>drand, раунд №{d.round}…</span>
            </div>
          </>
        )}
      </div>
      <div className="vd-pending-meta">
        В пуле {fmt(d.poolSize)} {plural(d.poolSize, ['билет', 'билета', 'билетов'])} · poolHash{' '}
        <code>{d.poolHash.slice(0, 16)}…</code>
      </div>
    </div>
  )
}

export default function Public() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const seen = useRef(null)
  const [queue, setQueue] = useState([])
  const [revealed, setRevealed] = useState(() => new Set())
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

  if (!data)
    return (
      <div className="vd vd--center">
        <Backdrop />
        <div className="vd-loading">
          <img src={signUrl} alt="" />
          {error ? 'Нет связи с сервером…' : 'Загрузка…'}
        </div>
      </div>
    )

  const prizesWon = data.prizes.filter((p) => p.winner && revealed.has(p.winner.id)).length
  const status = current
    ? 'Определяем победителя'
    : pendingPrize
      ? 'Пул зафиксирован'
      : data.prizes.length > 0 && prizesWon === data.prizes.length
        ? 'Розыгрыш завершён'
        : prizesWon > 0
          ? 'Идёт розыгрыш'
          : 'Скоро начнём'
  const live = Boolean(current || pendingPrize)

  return (
    <div className="vd">
      <Backdrop />
      <div className="vd-page">
        <header className="vd-top">
          <img className="vd-logo" src={logoUrl} alt="ВКУСДОМ — гипермаркет" />
          <div className={`vd-status ${live ? 'vd-status--live' : ''}`}>
            <span className={`vd-dot ${live ? 'vd-dot--pulse' : ''}`} />
            {status}
          </div>
        </header>

        <section className={`vd-stage ${current ? 'vd-stage--roll' : pendingPrize ? 'vd-stage--pending' : 'vd-stage--idle'}`}>
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
            <Idle data={data} />
          )}
        </section>

        <Marquee sample={data.sample} />

        <section className="vd-prizes">
          <div className="vd-section-head">
            <h2>Призы</h2>
            {data.prizes.length > 0 && (
              <span>
                Разыграно {prizesWon} из {data.prizes.length}
              </span>
            )}
          </div>
          {data.prizes.length === 0 && <p className="vd-empty">Призы пока не добавлены</p>}
          <div className="vd-prize-grid">
            {data.prizes.map((p, i) => {
              const show = p.winner && revealed.has(p.winner.id)
              const drawing = !show && (p.winner || p.pending)
              return (
                <article key={p.id} className={`vd-prize ${show ? 'is-won' : ''} ${drawing ? 'is-drawing' : ''}`}>
                  <div className="vd-prize-head">
                    <span className="vd-prize-no">Приз {String(i + 1).padStart(2, '0')}</span>
                    {show && <span className="vd-badge">Победитель</span>}
                  </div>
                  <div className="vd-prize-title">{p.title}</div>
                  {show ? (
                    <div className="vd-prize-winner">
                      <div className="vd-pw-ticket">№ {p.winner.ticket}</div>
                      <PersonName className="vd-pw-name" name={p.winner.name} />
                      <div className="vd-pw-phone">{p.winner.phone}</div>
                    </div>
                  ) : (
                    <div className="vd-prize-wait">
                      {drawing ? (
                        <>
                          <span className="vd-dot vd-dot--pulse" />
                          Определяется…
                        </>
                      ) : (
                        'Ожидает розыгрыша'
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <footer className="vd-footer">
          <svg className="vd-footer-icon" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2.5 4 5.6v6.1c0 4.7 3.3 8.6 8 9.8 4.7-1.2 8-5.1 8-9.8V5.6l-8-3.1Z" />
            <path d="m8.5 12.2 2.4 2.4 4.7-4.9" />
          </svg>
          <p>
            Победители выбираются публичным генератором случайности drand и проверяемым алгоритмом.{' '}
            <Link to="/fair">Проверить честность розыгрыша →</Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
