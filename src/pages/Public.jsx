import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import TicketRoll from '../components/TicketRoll.jsx'
import Backdrop from '../components/brand/Backdrop.jsx'
import TopBar from '../components/brand/TopBar.jsx'
import { PersonName, plural } from '../components/brand/text.jsx'
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

function Idle({ data, sample }) {
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
      <Carousel sample={sample} />
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

function Announce({ stage }) {
  return (
    <div className="vd-scene vd-announce">
      <div className="vd-eyebrow vd-eyebrow--center">
        <span className="vd-dot vd-dot--pulse" />
        Сейчас разыгрывается
      </div>
      <h2 className="vd-announce-prize" key={stage.prizeId}>{stage.title}</h2>
      <p className="vd-announce-hint">Скоро узнаем имя победителя</p>
    </div>
  )
}

function Pending({ stage, sample }) {
  const [now, setNow] = useState(Date.now())
  const [t, setT] = useState(sample[0])
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      if (sample.length) setT(sample[Math.floor(Math.random() * sample.length)])
    }, 90)
    return () => clearInterval(id)
  }, [sample])
  const left = Math.max(0, Math.ceil((new Date(stage.revealAt).getTime() - now) / 1000))
  return (
    <div className="vd-scene vd-pending">
      <div className="vd-eyebrow vd-eyebrow--center">
        <span className="vd-dot vd-dot--pulse" />
        Определяем победителя
      </div>
      <h2 className="vd-scene-title">{stage.title}</h2>
      <div className="vd-pending-spin">{t?.ticket ?? '•••••••'}</div>
      <div className="vd-countdown">
        {left > 0 ? (
          <>
            <div className="vd-countdown-num">{left}</div>
            <div className="vd-countdown-text">
              Победитель будет объявлен
              <span>через {left} {plural(left, ['секунду', 'секунды', 'секунд'])}</span>
            </div>
          </>
        ) : (
          <>
            <div className="vd-countdown-num vd-countdown-num--wait" />
            <div className="vd-countdown-text">Ещё мгновение…</div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Public() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [sample, setSample] = useState([])
  const sampleCount = useRef(-1)
  const watched = useRef(new Set())

  useEffect(() => {
    let stop = false
    const load = async () => {
      try {
        const d = await api.publicState()
        if (stop) return
        setError(false)
        const st = d.stage
        if (st?.phase === 'spinning') watched.current.add(st.prizeId)
        else if (!st || st.phase === 'announce') watched.current.clear()
        setData(d)
        if (sampleCount.current !== d.ticketCount) {
          sampleCount.current = d.ticketCount
          setSample(d.sample)
        }
      } catch {
        if (!stop) setError(true)
      }
    }
    load()
    const id = setInterval(load, 1500)
    return () => {
      stop = true
      clearInterval(id)
    }
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

  const stage = data.stage
  const prizesWon = data.prizes.filter((p) => p.winner).length
  const live = stage?.phase === 'spinning'
  const status = stage
    ? stage.phase === 'announce'
      ? 'Скоро разыгрываем'
      : stage.phase === 'spinning'
        ? 'Определяем победителя'
        : 'Поздравляем!'
    : data.prizes.length > 0 && prizesWon === data.prizes.length
      ? 'Розыгрыш завершён'
      : prizesWon > 0
        ? 'Идёт розыгрыш'
        : 'Скоро начнём'
  const stageClass = !stage ? 'vd-stage--idle' : stage.phase === 'winner' ? 'vd-stage--roll' : stage.phase === 'spinning' ? 'vd-stage--pending' : 'vd-stage--announce'
  const prizes = data.prizes.map((p, i) => ({ p, i })).sort((a, b) => Boolean(a.p.winner) - Boolean(b.p.winner))

  return (
    <div className="vd">
      <Backdrop />
      <div className="vd-page">
        <TopBar>
          <div className={`vd-status ${live ? 'vd-status--live' : ''}`}>
            <span className={`vd-dot ${live ? 'vd-dot--pulse' : ''}`} />
            {status}
          </div>
        </TopBar>

        <section className={`vd-stage ${stageClass}`}>
          {!stage && <Idle data={data} sample={sample} />}
          {stage?.phase === 'announce' && <Announce stage={stage} />}
          {stage?.phase === 'spinning' && <Pending stage={stage} sample={sample} />}
          {stage?.phase === 'winner' && (
            <TicketRoll
              key={stage.winner.id}
              winner={stage.winner}
              prizeTitle={stage.title}
              sample={sample}
              instant={!watched.current.has(stage.prizeId)}
            />
          )}
        </section>

        <Marquee sample={sample} />

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
            {prizes.map(({ p, i }) => (
              <article key={p.id} className={`vd-prize ${p.winner ? 'is-won' : ''} ${!p.winner && p.live ? 'is-drawing' : ''}`}>
                <div className="vd-prize-head">
                  <span className="vd-prize-no">Приз {String(i + 1).padStart(2, '0')}</span>
                  {p.winner && <span className="vd-badge">Победитель</span>}
                </div>
                <div className="vd-prize-title">{p.title}</div>
                {p.winner ? (
                  <div className="vd-prize-winner">
                    <div className="vd-pw-ticket">№ {p.winner.ticket}</div>
                    <PersonName className="vd-pw-name" name={p.winner.name} />
                    <div className="vd-pw-phone">{p.winner.phone}</div>
                  </div>
                ) : (
                  <div className="vd-prize-wait">
                    {p.live ? (
                      <>
                        <span className="vd-dot vd-dot--pulse" />
                        Сейчас на сцене
                      </>
                    ) : (
                      'Ожидает розыгрыша'
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
