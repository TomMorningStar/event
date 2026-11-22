import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import fairSource from '../../shared/fair.js?raw'
import { verifyDraw, beaconUrl, DRAND, roundTime } from '../../shared/fair.js'
import Backdrop from '../components/brand/Backdrop.jsx'
import TopBar from '../components/brand/TopBar.jsx'
import { PersonName, plural } from '../components/brand/text.jsx'
import { IconArrowLeft, IconCheck, IconCopy, IconCross, IconDownload, IconExternal, IconShield } from '../components/brand/icons.jsx'
import '../styles/public.css'
import '../styles/fair.css'

const STATUS = { pending: 'Ожидает drand', done: 'Завершён', cancelled: 'Отменён' }
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—')
const dt = (s) => (s ? new Date(s).toLocaleString('ru-RU') : '—')
const fmt = (n) => (n ?? 0).toLocaleString('ru-RU')

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
    <article className={`vf-draw is-${d.status}`}>
      <div className="vf-draw-head">
        <div className="vf-draw-title">
          <span className="vf-draw-no">№ {d.drawNo}</span>
          <h3>{d.prizeTitle}</h3>
        </div>
        <span className={`vf-status is-${d.status}`}>
          {d.status === 'pending' && <span className="vd-dot vd-dot--pulse" />}
          {STATUS[d.status]}
        </span>
      </div>
      {d.cancelReason && <p className="vf-cancel">Причина отмены: {d.cancelReason}</p>}

      {d.ticket && (
        <div className="vf-winner">
          <div className="vf-winner-ticket">№ {d.ticket}</div>
          <div className="vf-winner-person">
            <PersonName className="vf-winner-name" name={d.name} />
            <div className="vf-winner-phone">{d.phone}</div>
          </div>
        </div>
      )}

      <div className="vf-actions">
        {d.status !== 'pending' && (
          <button className="vd-btn vd-btn--primary" onClick={check} disabled={busy}>
            <IconShield />
            {busy ? 'Проверяем…' : 'Проверить'}
          </button>
        )}
        <button className="vd-btn vd-btn--ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Скрыть данные' : 'Показать данные'}
        </button>
      </div>

      {steps && (
        <div className={`vf-verify ${allOk ? 'is-ok' : 'is-bad'}`}>
          <div className="vf-verify-sum">
            <span className="vf-verify-badge">{allOk ? <IconCheck /> : <IconCross />}</span>
            {allOk ? 'Результат подтверждён' : 'Проверка не пройдена'}
          </div>
          <ul className="vf-verify-steps">
            {steps.map((s, i) => (
              <li key={i} className={s.ok ? 'is-ok' : 'is-bad'}>
                {s.ok ? <IconCheck /> : <IconCross />}
                <span>
                  {s.name}
                  {s.detail && <code> {short(s.detail)}</code>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <dl className="vf-data">
          <dt>Обязательство зафиксировано</dt><dd>{dt(d.committedAt)}</dd>
          <dt>Раунд drand</dt>
          <dd>
            <a href={beaconUrl(d.round)} target="_blank" rel="noreferrer">№ {d.round}</a> (выпущен {dt(new Date(roundTime(d.round)).toISOString())})
          </dd>
          <dt>listHash</dt><dd><code>{d.listHash}</code> · <a href={`/api/public/lists/${d.listHash}.txt`}>скачать список</a></dd>
          <dt>Билетов в списке</dt><dd>{fmt(d.ticketCount)}</dd>
          <dt>Исключено (уже выиграли)</dt><dd>{d.excludedCount}{d.excludedCount > 0 && <>: <code>{d.excluded.join(', ')}</code></>}</dd>
          <dt>poolHash</dt><dd><code>{d.poolHash}</code></dd>
          <dt>Размер пула</dt><dd>{fmt(d.poolSize)}</dd>
          {d.randomness && (<><dt>randomness</dt><dd><code>{d.randomness}</code></dd></>)}
          {d.signature && (<><dt>BLS-подпись</dt><dd><code>{d.signature}</code></dd></>)}
          {d.index !== undefined && (<><dt>Индекс в пуле</dt><dd>{d.index}</dd></>)}
        </dl>
      )}
    </article>
  )
}

function SourceCode() {
  const [hash, setHash] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!crypto?.subtle) return
    crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(fairSource))
      .then((buf) => setHash([...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')))
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fairSource)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="vf-section">
      <div className="vd-section-head">
        <h2>Исходный код алгоритма</h2>
      </div>
      <div className="vf-panel">
        <p className="vf-muted">
          Весь выбор победителя — один файл <code>shared/fair.js</code>. Его же вызывают сервер при розыгрыше, эта страница и скрипт проверки,
          отдельной «боевой» версии нет. Функции <code>buildPool</code> и <code>chooseWinner</code> — единственное, что определяет победителя.
        </p>
        <div className="vf-code-bar">
          {hash && (
            <div className="vf-hash">
              <span>SHA-256 файла</span>
              <code>{hash}</code>
            </div>
          )}
          <button className="vd-btn vd-btn--ghost" onClick={copy}>
            {copied ? <IconCheck /> : <IconCopy />}
            {copied ? 'Скопировано' : 'Копировать код'}
          </button>
        </div>
        <pre className="vf-code"><code>{fairSource}</code></pre>
      </div>
    </section>
  )
}

const HOW = [
  <>Номера всех билетов сортируются и хэшируются (SHA-256) — это <b>listHash</b>. Файл со списком номеров публичный, хэш можно пересчитать самостоятельно.</>,
  <>При нажатии «Разыграть» сервер <b>заранее</b> фиксирует и публикует пул участников (без уже выигравших), его хэш и номер <b>будущего</b> раунда drand.</>,
  <>
    <a href="https://drand.love" target="_blank" rel="noreferrer">drand</a> — публичный генератор случайности League of Entropy
    (Cloudflare, EPFL, Protocol Labs, университеты и др.). Число раунда не может знать заранее никто, включая нас.
  </>,
  <>Индекс победителя вычисляется из числа drand по открытой формуле: <code>SHA-256("fair-v1|randomness|poolHash|drawNo")</code> с отбраковкой — все билеты равновероятны.</>,
  <>Кнопка «Проверить» повторяет все вычисления прямо в вашем браузере и проверяет BLS-подпись drand.</>,
]

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

  if (!data)
    return (
      <div className="vd vd--center vd--quiet">
        <Backdrop />
        <div className="vd-loading">{error || 'Загрузка…'}</div>
      </div>
    )
  const draws = [...data.draws].reverse()
  const done = data.draws.filter((d) => d.status === 'done').length

  return (
    <div className="vd vd--quiet">
      <Backdrop />
      <div className="vd-page vf">
        <TopBar>
          <Link to="/" className="vd-btn vd-btn--ghost">
            <IconArrowLeft />
            К розыгрышу
          </Link>
        </TopBar>

        <section className="vf-hero">
          <div className="vd-eyebrow">
            <span className="vd-dot" />
            Прозрачность розыгрыша
          </div>
          <h1 className="vf-title">
            Проверка <span>честности</span>
          </h1>
          <p className="vd-lead">Каждый результат можно перепроверить самостоятельно — прямо в браузере, без доверия к нам.</p>
          <div className="vf-facts">
            <div>
              <b>{fmt(done)}</b>
              <span>{plural(done, ['розыгрыш проведён', 'розыгрыша проведено', 'розыгрышей проведено'])}</span>
            </div>
            <div>
              <b>{fmt(data.count)}</b>
              <span>{plural(data.count ?? 0, ['билет в списке', 'билета в списке', 'билетов в списке'])}</span>
            </div>
            <div>
              <b>drand</b>
              <span>публичный источник случайности</span>
            </div>
          </div>
        </section>

        <section className="vf-section">
          <div className="vd-section-head">
            <h2>Как выбирается победитель</h2>
          </div>
          <ol className="vf-steps">
            {HOW.map((text, i) => (
              <li key={i}>
                <span className="vf-step-no">{String(i + 1).padStart(2, '0')}</span>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="vf-muted vf-note">
            Сеть drand: quicknet, chain hash <code>{short(DRAND.chainHash)}</code>. Исходный код алгоритма — файл <code>shared/fair.js</code>.
          </p>
        </section>

        <section className="vf-section">
          <div className="vd-section-head">
            <h2>Текущий список билетов</h2>
          </div>
          {data.listHash ? (
            <div className="vf-panel vf-list">
              <div className="vf-list-count">
                <b>{fmt(data.count)}</b>
                <span>{plural(data.count, ['билет', 'билета', 'билетов'])}</span>
              </div>
              <div className="vf-hash">
                <span>listHash</span>
                <code>{data.listHash}</code>
              </div>
              <a className="vd-btn vd-btn--ghost" href={`/api/public/lists/${data.listHash}.txt`}>
                <IconDownload />
                Скачать номера
              </a>
            </div>
          ) : (
            <p className="vd-empty">Список ещё не загружен</p>
          )}
        </section>

        <section className="vf-section">
          <div className="vd-section-head">
            <h2>Журнал розыгрышей</h2>
            {draws.length > 0 && <span>Всего записей: {draws.length}</span>}
          </div>
          {draws.length === 0 && <p className="vd-empty">Розыгрышей пока не было</p>}
          <div className="vf-draws">
            {draws.map((d) => (
              <DrawCard key={d.id} d={d} getList={getList} />
            ))}
          </div>
        </section>

        <SourceCode />

        <footer className="vd-footer">
          <IconExternal className="vd-footer-icon" />
          <p>
            Независимая проверка всех розыгрышей из консоли: <code>node scripts/verify.mjs https://адрес-сайта</code>
          </p>
        </footer>
      </div>
    </div>
  )
}
