import { useEffect, useMemo, useState } from 'react'
import { PersonName } from './brand/text.jsx'

const CELLS = 26
// фирменные цвета ВКУСДОМ: лайм, белый, оттенки зелёного
const CONFETTI_COLORS = ['#c7d301', '#ffffff', '#c7d301', '#1b6644', '#e3ec6b', '#005a35']

function Reel({ digit, index }) {
  const [go, setGo] = useState(false)
  const strip = useMemo(() => {
    const arr = Array.from({ length: CELLS - 1 }, () => Math.floor(Math.random() * 10))
    arr.push(digit)
    return arr
  }, [digit])

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  const duration = 2.6 + index * 0.45
  return (
    <span className="reel">
      <span
        className="reel-strip"
        style={{
          transform: go ? `translateY(calc(var(--h) * -${CELLS - 1}))` : 'translateY(0)',
          transitionDuration: `${duration}s`,
        }}
      >
        {strip.map((d, i) => (
          <span key={i} className="reel-cell">
            {d}
          </span>
        ))}
      </span>
    </span>
  )
}

export default function TicketRoll({ winner, prizeTitle, sample, onDone }) {
  const digits = [...winner.ticket]
  const total = 2.6 + (digits.length - 1) * 0.45
  const [phase, setPhase] = useState('roll')
  const [shuffle, setShuffle] = useState(sample[0])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('reveal'), total * 1000 + 300)
    const t2 = setTimeout(() => onDone?.(), total * 1000 + 4500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [total, onDone])

  useEffect(() => {
    if (phase !== 'roll' || !sample.length) return
    const id = setInterval(() => setShuffle(sample[Math.floor(Math.random() * sample.length)]), 80)
    return () => clearInterval(id)
  }, [phase, sample])

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 4 === 0,
        rot: Math.floor(Math.random() * 720),
        key: i,
      })),
    [],
  )

  const revealed = phase === 'reveal'
  return (
    <div className={`roll vd-roll ${revealed ? 'revealed' : ''}`}>
      <div className="vd-eyebrow vd-eyebrow--center">
        <span className={`vd-dot ${revealed ? '' : 'vd-dot--pulse'}`} />
        {revealed ? 'Поздравляем!' : 'Определяем победителя'}
      </div>
      <h2 className="vd-scene-title">
        {revealed ? (
          <>
            У нас есть <span>победитель!</span>
          </>
        ) : (
          <>
            Какой билет <span>победит?</span>
          </>
        )}
      </h2>
      <div className="vd-win-ticket">
        <div className="vd-win-top">
          <span>{revealed ? 'Выигравший билет' : 'Номер билета'}</span>
          <span className="vd-win-prize">{prizeTitle}</span>
        </div>
        <div className="reels" key={winner.id}>
          {digits.map((d, i) => (
            <Reel key={i} digit={Number(d)} index={i} />
          ))}
        </div>
        <div className={`roll-person ${revealed ? '' : 'blurred'}`}>
          <PersonName className="roll-name" name={revealed ? winner.name : shuffle?.name} />
          <div className="roll-phone">{revealed ? winner.phone : shuffle?.phone}</div>
        </div>
      </div>
      {revealed && (
        <div className="confetti" aria-hidden>
          {confetti.map((c) => (
            <i
              key={c.key}
              className={c.round ? 'is-round' : ''}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.dur}s`,
                background: c.color,
                '--rot': `${c.rot}deg`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
