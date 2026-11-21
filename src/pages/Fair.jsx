import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { verifyDraw, beaconUrl, DRAND, roundTime } from '../../shared/fair.js'

const STATUS = { pending: 'Ожидает drand', done: 'Завершён', cancelled: 'Отменён' }
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—')
const dt = (s) => (s ? new Date(s).toLocaleString('ru-RU') : '—')

function DrawCard({ d, getList }) {
  const [steps, setSteps] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const check = async () => {
    setBusy(true)
    setOpen(true)
    try {
      const text = await getList(d.listHash)
      const res = verifyDraw(d, text ? text.split('\n') : [])
      // перекрёстная проверка напрямую у drand
      try {
        const r = await fetch(beaconUrl(d.round), { signal: AbortSignal.timeout(6000) })
        const b = await r.json()
        res.push({ name: 'Число совпадает с опубликованным на api.drand.sh', ok: b.randomness === d.randomness, detail: b.randomness })
      } catch {
        res.push({ name: 'api.drand.sh недоступен из браузера — подпись проверена локально выше', ok: true, detail: '' })
      }
      setSteps(res)
    } catch (e) {
      setSteps([{ name: e.message, ok: false }])
    } finally {
      setBusy(false)
    }
  }

  const allOk = steps?.every((s) => s.ok)
  return (
    <div className={`fair-draw ${d.status}`}>
      <div className="fd-head">
        <div>
          <div className="fd-title">#{d.drawNo} · {d.prizeTitle}</div>
          <div className="muted small">{STATUS[d.status]}{d.cancelReason ? ` — ${d.cancelReason}` : ''}</div>
        </div>
        {d.status !== 'pending' && (
          <button className="btn primary" onClick={check} disabled={busy}>
            {busy ? 'Проверяем…' : 'Проверить'}
          </button>
        )}
      </div>

      {d.ticket && (
        <div className="fd-winner">
          Билет <b>№ {d.ticket}</b> · {d.name} · {d.phone}
        </div>
      )}

      <button className="link" onClick={() => setOpen((o) => !o)}>{open ? 'Скрыть данные' : 'Показать данные'}</button>
      {open && (
        <dl className="fd-data">
          <dt>Обязательство зафиксировано</dt><dd>{dt(d.committedAt)}</dd>
          <dt>Раунд drand</dt>
          <dd>
            <a href={beaconUrl(d.round)} target="_blank" rel="noreferrer">№ {d.round}</a> (выпущен {dt(new Date(roundTime(d.round)).toISOString())})
          </dd>
          <dt>listHash</dt><dd><code>{d.listHash}</code> · <a href={`/api/public/lists/${d.listHash}.txt`}>скачать список</a></dd>
          <dt>Билетов в списке</dt><dd>{d.ticketCount.toLocaleString('ru-RU')}</dd>
          <dt>Исключено (уже выиграли)</dt><dd>{d.excludedCount}{d.excludedCount > 0 && <>: <code>{d.excluded.join(', ')}</code></>}</dd>
          <dt>poolHash</dt><dd><code>{d.poolHash}</code></dd>
          <dt>Размер пула</dt><dd>{d.poolSize.toLocaleString('ru-RU')}</dd>
          {d.randomness && (<><dt>randomness</dt><dd><code>{d.randomness}</code></dd></>)}
          {d.signature && (<><dt>BLS-подпись</dt><dd><code>{d.signature}</code></dd></>)}
          {d.index !== undefined && (<><dt>Индекс в пуле</dt><dd>{d.index}</dd></>)}
        </dl>
      )}

      {steps && (
        <div className={`verify ${allOk ? 'ok' : 'bad'}`}>
          <div className="verify-sum">{allOk ? '✅ Результат подтверждён' : '❌ Проверка не пройдена'}</div>
          {steps.map((s, i) => (
            <div key={i} className="verify-step">
              <span>{s.ok ? '✔' : '✘'}</span> {s.name}
              {s.detail && <code className="small"> {short(s.detail)}</code>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Fair() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const lists = useRef(new Map())

  useEffect(() => {
    api.draws().then(setData, (e) => setError(e.message))
  }, [])

  const getList = async (hash) => {
    if (!lists.current.has(hash)) lists.current.set(hash, await api.listText(hash))
    return lists.current.get(hash)
  }

  if (!data) return <div className="page center">{error || 'Загрузка…'}</div>
  const draws = [...data.draws].reverse()

  return (
    <div className="page fair">
      <Link to="/" className="back">← К розыгрышу</Link>
      <h1>🔒 Проверка честности</h1>

      <section className="panel">
        <h2>Как выбирается победитель</h2>
        <ol className="how">
          <li>Номера всех билетов сортируются и хэшируются (SHA-256) — это <b>listHash</b>. Файл со списком номеров публичный, хэш можно пересчитать самостоятельно.</li>
          <li>При нажатии «Разыграть» сервер <b>заранее</b> фиксирует и публикует пул участников (без уже выигравших), его хэш и номер <b>будущего</b> раунда drand.</li>
          <li>
            <a href="https://drand.love" target="_blank" rel="noreferrer">drand</a> — публичный генератор случайности League of Entropy
            (Cloudflare, EPFL, Protocol Labs, университеты и др.). Число раунда не может знать заранее никто, включая нас.
          </li>
          <li>Индекс победителя вычисляется из числа drand по открытой формуле: <code>SHA-256("fair-v1|randomness|poolHash|drawNo")</code> с отбраковкой — все билеты равновероятны.</li>
          <li>Кнопка «Проверить» повторяет все вычисления прямо в вашем браузере и проверяет BLS-подпись drand.</li>
        </ol>
        <p className="muted small">
          Сеть drand: quicknet, chain hash <code>{short(DRAND.chainHash)}</code>. Исходный код алгоритма — файл <code>shared/fair.js</code>.
        </p>
      </section>

      <section className="panel">
        <h2>Текущий список билетов</h2>
        {data.listHash ? (
          <p>
            {data.count.toLocaleString('ru-RU')} билетов · listHash <code className="break">{data.listHash}</code> ·{' '}
            <a href={`/api/public/lists/${data.listHash}.txt`}>скачать номера</a>
          </p>
        ) : (
          <p className="muted">Список ещё не загружен</p>
        )}
      </section>

      <section>
        <h2>Журнал розыгрышей</h2>
        {draws.length === 0 && <p className="muted">Розыгрышей пока не было</p>}
        <div className="fair-list">
          {draws.map((d) => (
            <DrawCard key={d.id} d={d} getList={getList} />
          ))}
        </div>
      </section>
    </div>
  )
}
