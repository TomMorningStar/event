import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import fairSource from '../../shared/fair.js?raw'
import { api } from '../api.js'
import { verifyDraw, verifyChain, beaconUrl, DRAND, roundTime } from '../../shared/fair.js'

const STATUS = { pending: 'Ожидает drand', done: 'Завершён', cancelled: 'Отменён' }
const CHECKS = [
  { group: 'list', title: 'Список билетов', text: 'совпадает с опубликованным' },
  { group: 'random', title: 'Случайное число drand', text: 'подлинное, подпись сети верна' },
  { group: 'calc', title: 'Расчёт победителя', text: 'совпадает' },
  { group: 'time', title: 'Проверка времени фиксации', text: 'пройдена' },
]
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—')
const dt = (s) => (s ? new Date(s).toLocaleString('ru-RU') : '—')

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
    <div className={`fair-draw ${d.status}`}>
      <div className="fd-head">
        <div>
          <div className="fd-title">{d.prizeTitle}</div>
          <div className="muted small">Розыгрыш №{d.drawNo} · {STATUS[d.status]}{d.cancelReason ? ` — ${d.cancelReason}` : ''}</div>
        </div>
      </div>

      {d.ticket ? (
        <div className="fd-ticket">
          <span>Билет победителя</span>
          <b>№ {d.ticket}</b>
        </div>
      ) : (
        <p className="muted">Победитель ещё не определён. Раунд drand №{d.round}.</p>
      )}

      {d.status !== 'pending' && (
        <>
          <ul className="checks">
            {CHECKS.map((c) => {
              const st = groupState(c.group)
              return (
                <li key={c.group} className={st}>
                  <span className="mark">{st === 'ok' ? '✔' : st === 'bad' ? '✘' : '•'}</span>
                  <span>
                    <b>{c.title}</b>
                    <small>{st === 'bad' ? 'не совпадает!' : c.text}</small>
                  </span>
                </li>
              )
            })}
          </ul>

          {steps && (
            <div className={`verify ${allOk ? 'ok' : 'bad'}`}>
              <div className="verify-sum">
                {allOk ? '✅ Результат подтверждён: расчёт повторён в вашем браузере' : '❌ Проверка не пройдена'}
              </div>
              {steps.filter((s) => !s.ok).map((s, i) => (
                <div key={i} className="verify-step">✘ {s.name}</div>
              ))}
            </div>
          )}

          <div className="fd-actions">
            <button className="btn primary" onClick={check} disabled={busy}>{busy ? 'Проверяем…' : 'Проверить'}</button>
            <button className="btn" onClick={saveProof}>Скачать файл для независимой проверки</button>
            <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? 'Скрыть доказательства' : 'Посмотреть доказательства'}</button>
          </div>
        </>
      )}

      {open && (
        <>
          {steps && (
            <div className="verify-all">
              {steps.map((s, i) => (
                <div key={i} className="verify-step">
                  <span>{s.ok ? '✔' : '✘'}</span> {s.name}
                  {s.detail && <code className="small"> {short(s.detail)}</code>}
                </div>
              ))}
            </div>
          )}
          <dl className="fd-data">
            <dt>Код фиксации</dt><dd><code>{d.commitment}</code></dd>
            <dt>Предыдущий код</dt><dd><code>{d.prevCommitment || '— (первый розыгрыш)'}</code></dd>
            <dt>Зафиксировано</dt><dd>{dt(d.committedAt)}</dd>
            <dt>Раунд drand</dt>
            <dd>
              <a href={beaconUrl(d.round)} target="_blank" rel="noreferrer">№ {d.round}</a> (выпущен {dt(new Date(roundTime(d.round)).toISOString())})
            </dd>
            <dt>listHash</dt><dd><code>{d.listHash}</code> · <a href={`/api/admin/lists/${d.listHash}.txt`}>скачать список</a></dd>
            <dt>Билетов в списке</dt><dd>{d.ticketCount.toLocaleString('ru-RU')}</dd>
            <dt>Исключено (уже выиграли)</dt><dd>{d.excludedCount}{d.excludedCount > 0 && <>: <code>{d.excluded.join(', ')}</code></>}</dd>
            <dt>poolHash</dt><dd><code>{d.poolHash}</code></dd>
            <dt>Размер пула</dt><dd>{d.poolSize.toLocaleString('ru-RU')}</dd>
            {d.randomness && (<><dt>Число drand</dt><dd><code>{d.randomness}</code></dd></>)}
            {d.signature && (<><dt>BLS-подпись</dt><dd><code>{d.signature}</code></dd></>)}
            {d.index !== undefined && (<><dt>Индекс в пуле</dt><dd>{d.index}</dd></>)}
          </dl>
        </>
      )}
    </div>
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
    <section className="panel">
      <h2>Исходный код алгоритма</h2>
      <p className="muted small">
        Весь выбор победителя — один файл <code>shared/fair.js</code>. Его же вызывают сервер при розыгрыше, эта страница и скрипт проверки,
        отдельной «боевой» версии нет. Функции <code>buildPool</code> и <code>chooseWinner</code> — единственное, что определяет победителя.
      </p>
      {hash && (
        <p className="small">
          SHA-256 файла: <code className="break">{hash}</code>
        </p>
      )}
      <div className="code-actions">
        <button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Копировать код'}</button>
      </div>
      <pre className="code"><code>{fairSource}</code></pre>
    </section>
  )
}

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

  if (!data) return <div className="page center">{error || 'Загрузка…'}</div>
  const draws = [...data.draws].reverse()
  const chainOk = verifyChain(data.draws)

  return (
    <div className="page fair">
      <Link to="/admin" className="back">← Админка</Link>
      <h1>🔒 Проверка честности розыгрыша</h1>
      <p className="muted">
        Победитель определяется случайным числом независимой международной сети drand. Перед розыгрышем мы фиксируем список билетов и
        будущий раунд случайности, поэтому изменить результат после этого невозможно. Нажмите «Проверить» напротив любого приза.
      </p>

      {draws.length > 0 && (
        <div className={`verify ${chainOk ? 'ok' : 'bad'}`}>
          {chainOk ? '✅ Журнал розыгрышей цельный: ни одна запись не менялась задним числом' : '❌ Цепочка записей журнала нарушена'}
        </div>
      )}

      <section className="fair-list">
        {draws.length === 0 && <p className="muted">Розыгрышей пока не было</p>}
        {draws.map((d) => (
          <DrawCard key={d.id} d={d} getList={getList} />
        ))}
      </section>

      <section className="panel">
        <h2>Как это работает</h2>
        <ol className="how">
          <li>Номера всех билетов сортируются и хэшируются (SHA-256) — это <b>listHash</b>. Файл со списком номеров публичный, ФИО и телефонов в нём нет.</li>
          <li>При нажатии «Разыграть» сервер <b>заранее</b> фиксирует и публикует пул участников, его хэш и номер <b>будущего</b> раунда drand. Все эти данные склеиваются в <b>код фиксации</b>, а он связан с кодом предыдущего розыгрыша в цепочку.</li>
          <li>
            <a href="https://drand.love" target="_blank" rel="noreferrer">drand</a> — публичный генератор случайности League of Entropy
            (Cloudflare, EPFL, Protocol Labs, университеты и др.). Число раунда не может знать заранее никто, включая нас.
          </li>
          <li>Индекс победителя вычисляется из числа drand по открытой формуле: <code>SHA-256("fair-v1|число|poolHash|номер розыгрыша")</code> с отбраковкой — все билеты равновероятны.</li>
          <li>Кнопка «Проверить» повторяет все вычисления прямо в вашем браузере, проверяет подпись drand и сверяет число с api.drand.sh.</li>
        </ol>
        <h3>Как убедиться, что сам сайт не обманывает</h3>
        <ul className="how">
          <li>Скачайте «файл для независимой проверки» и запустите его в отдельном инструменте: <code>node scripts/verify.mjs proof-1.json</code>. Он берёт число напрямую у drand и считает всё заново, сайт для этого не нужен.</li>
          <li>Откройте раунд на api.drand.sh по ссылке в доказательствах и сравните число с опубликованным.</li>
          <li>Сравните «код фиксации» с тем, что организатор опубликовал в своих соцсетях <b>до</b> выхода раунда. Только такая публикация независимо подтверждает время фиксации: время на самом сайте — это слова сервера.</li>
        </ul>
        <p className="muted small">
          Сеть drand: quicknet, chain hash <code>{short(DRAND.chainHash)}</code>. Исходный код алгоритма — ниже и в файле <code>shared/fair.js</code>.
        </p>
      </section>

      <section className="panel">
        <h2>Текущий список билетов</h2>
        {data.listHash ? (
          <p>
            {data.count.toLocaleString('ru-RU')} билетов · listHash <code className="break">{data.listHash}</code> ·{' '}
            <a href={`/api/admin/lists/${data.listHash}.txt`}>скачать номера</a>
          </p>
        ) : (
          <p className="muted">Список ещё не загружен</p>
        )}
      </section>

      <SourceCode />
    </div>
  )
}
