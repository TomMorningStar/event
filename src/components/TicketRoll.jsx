import { useEffect, useMemo, useState } from 'react'

const CELLS = 26

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

/**
 * Анимация выбора билета: цифры номера крутятся барабанами и по очереди останавливаются,
 * затем проявляются ФИО и телефон победителя.
 */
export default function TicketRoll({ winner, prizeTitle, sample, onDone }) {
  const digits = [...winner.ticket]
  const total = 2.6 + (digits.length - 1) * 0.45
  const [phase, setPhase] = useState('roll') // roll -> reveal
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
        hue: Math.floor(Math.random() * 360),
        rot: Math.floor(Math.random() * 720),
        key: i,
      })),
    [],
  )

  const revealed = phase === 'reveal'
  return (
    <div className={`roll ${revealed ? 'revealed' : ''}`}>
      <div className="roll-prize">🎁 {prizeTitle}</div>
      <div className="roll-label">Номер билета</div>
      <div className="reels" key={winner.id}>
        {digits.map((d, i) => (
          <Reel key={i} digit={Number(d)} index={i} />
        ))}
      </div>
      <div className={`roll-person ${revealed ? '' : 'blurred'}`}>
        <div className="roll-name">{revealed ? winner.name : shuffle?.name}</div>
        <div className="roll-phone">{revealed ? winner.phone : shuffle?.phone}</div>
      </div>
      {revealed && (
        <div className="confetti" aria-hidden>
          {confetti.map((c) => (
            <i
              key={c.key}
              style={{
                left: `${c.left}%`,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.dur}s`,
                background: `hsl(${c.hue} 90% 60%)`,
                '--rot': `${c.rot}deg`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
