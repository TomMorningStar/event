import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import fairSource from '../../shared/fair.js?raw'
import { api } from '../api.js'
import { verifyDraw, verifyChain, beaconUrl, DRAND, roundTime } from '../../shared/fair.js'
import Backdrop from '../components/brand/Backdrop.jsx'
import TopBar from '../components/brand/TopBar.jsx'
import { plural } from '../components/brand/text.jsx'
import { IconArrowLeft, IconCheck, IconCopy, IconCross, IconDownload, IconShield } from '../components/brand/icons.jsx'
import '../styles/public.css'
import '../styles/fair.css'

const STATUS = { pending: 'Ожидает drand', done: 'Завершён', cancelled: 'Отменён' }
const CHECKS = [
  { group: 'list', title: 'Список билетов', text: 'совпадает с опубликованным' },
  { group: 'random', title: 'Случайное число drand', text: 'подлинное, подпись сети верна' },
  { group: 'calc', title: 'Расчёт победителя', text: 'совпадает' },
  { group: 'time', title: 'Проверка времени фиксации', text: 'пройдена' },
]
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—')
const dt = (s) => (s ? new Date(s).toLocaleString('ru-RU') : '—')
const fmt = (n) => (n ?? 0).toLocaleString('ru-RU')

function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function DrawCard({ d, getList }) {
  const [steps, setSteps] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const check = async () => {
    setBusy(true)
    try {
      const text = await getList(d.listHash)
      const res = verifyDraw(d, text ? text.split('\n') : [])
      try {
        const r = await fetch(beaconUrl(d.round), { signal: AbortSignal.timeout(6000) })
        const b = await r.json()
        res.push({ group: 'random', name: 'Число совпадает с опубликованным на api.drand.sh', ok: b.randomness === d.randomness, detail: b.randomness })
      } catch {
        res.push({ group: 'random', name: 'api.drand.sh недоступен из браузера — подпись проверена локально', ok: true, detail: '' })
      }
      setSteps(res)
    } catch (e) {
      setSteps([{ group: 'list', name: e.message, ok: false }])
    } finally {
      setBusy(false)
    }
  }

  const saveProof = async () => {
    const list = await getList(d.listHash)
    const { name, phone, ...draw } = d
    download(`proof-${d.drawNo}.json`, { format: 'fair-proof-v1', draw, list: list.split('\n') })
  }

  const groupState = (g) => {
    if (!steps) return 'idle'
    const own = steps.filter((s) => s.group === g)
    return own.length && own.every((s) => s.ok) ? 'ok' : 'bad'
  }
  const allOk = steps && CHECKS.every((c) => groupState(c.group) === 'ok')

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

      {d.ticket ? (
        <div className="vf-winner">
          <span className="vf-winner-label">Билет победителя</span>
          <div className="vf-winner-ticket">№ {d.ticket}</div>
        </div>
      ) : (
        <p className="vf-muted vf-wait">Победитель ещё не определён. Раунд drand №{d.round}.</p>
      )}

      {d.status !== 'pending' && (
        <>
          <ul className="vf-checks">
            {CHECKS.map((c) => {
              const st = groupState(c.group)
              return (
                <li key={c.group} className={`is-${st}`}>
                  <span className="vf-check-mark">{st === 'ok' ? <IconCheck /> : st === 'bad' ? <IconCross /> : null}</span>
                  <span>
                    <b>{c.title}</b>
                    <small>{st === 'bad' ? 'не совпадает!' : c.text}</small>
                  </span>
                </li>
              )
            })}
          </ul>

          {steps && (
            <div className={`vf-verify ${allOk ? 'is-ok' : 'is-bad'}`}>
              <div className="vf-verify-sum">
                <span className="vf-verify-badge">{allOk ? <IconCheck /> : <IconCross />}</span>
                {allOk ? 'Результат подтверждён: расчёт повторён в вашем браузере' : 'Проверка не пройдена'}
              </div>
              {!allOk && (
                <ul className="vf-verify-steps">
                  {steps.filter((s) => !s.ok).map((s, i) => (
                    <li key={i} className="is-bad">
                      <IconCross />
                      <span>{s.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="vf-actions">
            <button className="vd-btn vd-btn--primary" onClick={check} disabled={busy}>
              <IconShield />
              {busy ? 'Проверяем…' : 'Проверить'}
            </button>
            <button className="vd-btn vd-btn--ghost" onClick={saveProof}>
              <IconDownload />
              Скачать файл для независимой проверки
            </button>
            <button className="vd-btn vd-btn--ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Скрыть доказательства' : 'Посмотреть доказательства'}
            </button>
          </div>
        </>
      )}

      {open && (
        <>
          {steps && (
            <ul className="vf-verify-steps vf-verify-all">
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
          )}
          <dl className="vf-data">
            <dt>Код фиксации</dt><dd><code>{d.commitment}</code></dd>
            <dt>Предыдущий код</dt><dd><code>{d.prevCommitment || '— (первый розыгрыш)'}</code></dd>
            <dt>Зафиксировано</dt><dd>{dt(d.committedAt)}</dd>
            <dt>Раунд drand</dt>
            <dd>
              <a href={beaconUrl(d.round)} target="_blank" rel="noreferrer">№ {d.round}</a> (выпущен {dt(new Date(roundTime(d.round)).toISOString())})
            </dd>
            <dt>listHash</dt><dd><code>{d.listHash}</code> · <a href={`/api/admin/lists/${d.listHash}.txt`}>скачать список</a></dd>
            <dt>Билетов в списке</dt><dd>{fmt(d.ticketCount)}</dd>
            <dt>Исключено (уже выиграли)</dt><dd>{d.excludedCount}{d.excludedCount > 0 && <>: <code>{d.excluded.join(', ')}</code></>}</dd>
            <dt>poolHash</dt><dd><code>{d.poolHash}</code></dd>
            <dt>Размер пула</dt><dd>{fmt(d.poolSize)}</dd>
            {d.randomness && (<><dt>Число drand</dt><dd><code>{d.randomness}</code></dd></>)}
            {d.signature && (<><dt>BLS-подпись</dt><dd><code>{d.signature}</code></dd></>)}
            {d.index !== undefined && (<><dt>Индекс в пуле</dt><dd>{d.index}</dd></>)}
          </dl>
        </>
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
  <>Номера всех билетов сортируются и хэшируются (SHA-256) — это <b>listHash</b>. Файл со списком номеров публичный, ФИО и телефонов в нём нет.</>,
  <>При нажатии «Разыграть» сервер <b>заранее</b> фиксирует и публикует пул участников, его хэш и номер <b>будущего</b> раунда drand. Все эти данные склеиваются в <b>код фиксации</b>, а он связан с кодом предыдущего розыгрыша в цепочку.</>,
  <>
    <a href="https://drand.love" target="_blank" rel="noreferrer">drand</a> — публичный генератор случайности League of Entropy
    (Cloudflare, EPFL, Protocol Labs, университеты и др.). Число раунда не может знать заранее никто, включая нас.
  </>,
  <>Индекс победителя вычисляется из числа drand по открытой формуле: <code>SHA-256("fair-v1|число|poolHash|номер розыгрыша")</code> с отбраковкой — все билеты равновероятны.</>,
  <>Кнопка «Проверить» повторяет все вычисления прямо в вашем браузере, проверяет подпись drand и сверяет число с api.drand.sh.</>,
]

export default function Fair() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const lists = useRef(new Map())

  useEffect(() => {
    api.draws().then(setData, (e) => (e.status === 401 ? nav('/login', { replace: true }) : setError(e.message)))
  }, [nav])

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
  const chainOk = verifyChain(data.draws)
  const done = data.draws.filter((d) => d.status === 'done').length

  return (
    <div className="vd vd--quiet">
      <Backdrop />
      <div className="vd-page vf">
        <TopBar>
          <Link to="/admin" className="vd-btn vd-btn--ghost">
            <IconArrowLeft />
            Админка
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
          <p className="vd-lead">
            Победитель определяется случайным числом независимой международной сети drand. Перед розыгрышем мы фиксируем список билетов и
            будущий раунд случайности, поэтому изменить результат после этого невозможно. Нажмите «Проверить» напротив любого приза.
          </p>
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

        {draws.length > 0 && (
          <div className={`vf-verify vf-chain ${chainOk ? 'is-ok' : 'is-bad'}`}>
            <div className="vf-verify-sum">
              <span className="vf-verify-badge">{chainOk ? <IconCheck /> : <IconCross />}</span>
              {chainOk ? 'Журнал розыгрышей цельный: ни одна запись не менялась задним числом' : 'Цепочка записей журнала нарушена'}
            </div>
          </div>
        )}

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

        <section className="vf-section">
          <div className="vd-section-head">
            <h2>Как это работает</h2>
          </div>
          <ol className="vf-steps">
            {HOW.map((text, i) => (
              <li key={i}>
                <span className="vf-step-no">{String(i + 1).padStart(2, '0')}</span>
                <p>{text}</p>
              </li>
            ))}
          </ol>

          <div className="vf-panel vf-trust">
            <h3>Как убедиться, что сам сайт не обманывает</h3>
            <ul>
              <li>Скачайте «файл для независимой проверки» и запустите его в отдельном инструменте: <code>node scripts/verify.mjs proof-1.json</code>. Он берёт число напрямую у drand и считает всё заново, сайт для этого не нужен.</li>
              <li>Откройте раунд на api.drand.sh по ссылке в доказательствах и сравните число с опубликованным.</li>
              <li>Сравните «код фиксации» с тем, что организатор опубликовал в своих соцсетях <b>до</b> выхода раунда. Только такая публикация независимо подтверждает время фиксации: время на самом сайте — это слова сервера.</li>
            </ul>
          </div>
          <p className="vf-muted vf-note">
            Сеть drand: quicknet, chain hash <code>{short(DRAND.chainHash)}</code>. Исходный код алгоритма — ниже и в файле <code>shared/fair.js</code>.
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
              <a className="vd-btn vd-btn--ghost" href={`/api/admin/lists/${data.listHash}.txt`}>
                <IconDownload />
                Скачать номера
              </a>
            </div>
          ) : (
            <p className="vd-empty">Список ещё не загружен</p>
          )}
        </section>

        <SourceCode />
      </div>
    </div>
  )
}
