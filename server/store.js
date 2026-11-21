import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { canonicalList, listText, listHash, buildPool, roundAt, roundTime, pickIndex, verifyBeacon, beaconUrl, DRAND } from '../shared/fair.js'

const DIR = path.resolve('data')
const LISTS_DIR = path.join(DIR, 'lists')
const TICKETS_FILE = path.join(DIR, 'tickets.json')
const STATE_FILE = path.join(DIR, 'state.json')
fs.mkdirSync(LISTS_DIR, { recursive: true })

const DRAW_DELAY_SECONDS = Math.max(6, Number(process.env.DRAW_DELAY_SECONDS) || 15)

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}
function writeJson(file, data) {
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data))
  fs.renameSync(tmp, file)
}
const fail = (message, status) => Object.assign(new Error(message), { status })

// { tickets: [[ticket,name,phone]], listHash, stats, fileName, uploadedAt }
let ticketsDb = readJson(TICKETS_FILE, { tickets: [], listHash: null, stats: null, fileName: null, uploadedAt: null })
// { prizes: [{id,title}], draws: [...] }
let state = readJson(STATE_FILE, { prizes: [], draws: [] })
state.draws ??= []
delete state.winners

const saveState = () => writeJson(STATE_FILE, state)

let byTicket = null // Map ticket -> [ticket,name,phone]
let sortedCache = null
function index() {
  if (!byTicket) {
    byTicket = new Map(ticketsDb.tickets.map((t) => [t[0], t]))
    sortedCache = canonicalList(ticketsDb.tickets.map((t) => t[0]))
  }
  return { byTicket, sorted: sortedCache }
}

export const getTicketsMeta = () => ({
  count: ticketsDb.tickets.length,
  listHash: ticketsDb.listHash,
  stats: ticketsDb.stats,
  fileName: ticketsDb.fileName,
  uploadedAt: ticketsDb.uploadedAt,
})
export const getTickets = () => ticketsDb.tickets
export const getState = () => state

export const listFile = (hash) => (/^[0-9a-f]{64}$/.test(hash) ? path.join(LISTS_DIR, hash + '.txt') : null)

export function setTickets(tickets, stats, fileName) {
  if (state.draws.some((d) => d.status === 'pending')) throw fail('Идёт розыгрыш — дождитесь результата', 409)
  const sorted = canonicalList(tickets.map((t) => t[0]))
  const hash = listHash(sorted)
  fs.writeFileSync(path.join(LISTS_DIR, hash + '.txt'), listText(sorted))
  ticketsDb = { tickets, listHash: hash, stats, fileName, uploadedAt: new Date().toISOString() }
  writeJson(TICKETS_FILE, ticketsDb)
  byTicket = null
  clientsCache = null
}

export function addPrize(title) {
  const prize = { id: crypto.randomUUID(), title }
  state.prizes.push(prize)
  saveState()
  return prize
}

export function deletePrize(id) {
  if (state.draws.some((d) => d.prizeId === id && d.status === 'pending')) throw fail('Идёт розыгрыш этого приза', 409)
  // записи розыгрышей остаются в публичном журнале
  state.prizes = state.prizes.filter((p) => p.id !== id)
  state.draws.forEach((d) => {
    if (d.prizeId === id && d.status === 'done') {
      d.status = 'cancelled'
      d.cancelledAt = new Date().toISOString()
      d.cancelReason = 'Приз удалён'
    }
  })
  saveState()
}

export function cancelWinner(prizeId, reason) {
  const d = state.draws.find((x) => x.prizeId === prizeId && x.status === 'done')
  if (!d) throw fail('Нет результата для отмены', 404)
  d.status = 'cancelled'
  d.cancelledAt = new Date().toISOString()
  d.cancelReason = reason || 'Без причины'
  saveState()
}

export const activeDraw = (prizeId) => state.draws.find((d) => d.prizeId === prizeId && d.status !== 'cancelled')

/** Шаг 1: фиксация обязательства (пул + будущий раунд drand) */
export function startDraw(prizeId, allowMultiple) {
  const prize = state.prizes.find((p) => p.id === prizeId)
  if (!prize) throw fail('Приз не найден', 404)
  if (activeDraw(prizeId)) throw fail('Этот приз уже разыгран или разыгрывается', 409)
  if (!ticketsDb.tickets.length) throw fail('Список билетов пуст — загрузите Excel', 400)

  const { byTicket, sorted } = index()
  const done = state.draws.filter((d) => d.status === 'done')
  const wonTickets = new Set(done.map((d) => d.ticket))
  const wonPhones = new Set(done.map((d) => byTicket.get(d.ticket)?.[2] ?? d.phone))
  const excluded = sorted.filter((t) => wonTickets.has(t) || (!allowMultiple && wonPhones.has(byTicket.get(t)[2])))
  const pool = buildPool(sorted, excluded)
  if (!pool.length) throw fail('Не осталось подходящих участников', 400)

  const now = Date.now()
  const round = roundAt(now + DRAW_DELAY_SECONDS * 1000)
  const draw = {
    id: crypto.randomUUID(),
    drawNo: state.draws.length + 1,
    prizeId,
    prizeTitle: prize.title,
    status: 'pending',
    committedAt: new Date(now).toISOString(),
    rule: allowMultiple ? 'exclude-won-tickets' : 'exclude-won-phones',
    listHash: ticketsDb.listHash,
    ticketCount: sorted.length,
    excluded,
    poolSize: pool.length,
    poolHash: listHash(pool),
    chainHash: DRAND.chainHash,
    round,
    revealAt: new Date(roundTime(round)).toISOString(),
  }
  state.draws.push(draw)
  saveState()
  scheduleFinalize(draw)
  return draw
}

async function fetchBeacon(round) {
  let lastErr
  for (const relay of DRAND.relays) {
    try {
      const r = await fetch(beaconUrl(round, relay), { signal: AbortSignal.timeout(5000) })
      if (!r.ok) throw new Error(`${relay}: HTTP ${r.status}`)
      const b = await r.json()
      if (b.round !== round) throw new Error(`${relay}: не тот раунд`)
      if (!verifyBeacon(b)) throw new Error(`${relay}: подпись не прошла проверку`)
      return b
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

/** Шаг 2: раунд вышел — берём случайность drand и вычисляем победителя */
async function finalize(drawId) {
  const draw = state.draws.find((d) => d.id === drawId)
  if (!draw || draw.status !== 'pending') return
  let beacon
  try {
    beacon = await fetchBeacon(draw.round)
  } catch (e) {
    draw.lastError = String(e.message || e)
    console.warn(`drand раунд ${draw.round}: ${draw.lastError}, повтор через 3 с`)
    return setTimeout(() => finalize(drawId), 3000)
  }
  const { sorted, byTicket } = index()
  const pool = buildPool(sorted, draw.excluded)
  if (listHash(pool) !== draw.poolHash) throw new Error('Пул изменился — такого быть не должно')
  const { index: idx, seed } = pickIndex(beacon.randomness, draw.poolHash, draw.drawNo, pool.length)
  const t = byTicket.get(pool[idx])
  Object.assign(draw, {
    status: 'done',
    randomness: beacon.randomness,
    signature: beacon.signature,
    seed,
    index: idx,
    ticket: t[0],
    name: t[1],
    phone: t[2],
    drawnAt: new Date().toISOString(),
  })
  delete draw.lastError
  saveState()
}

function scheduleFinalize(draw) {
  const wait = Math.max(0, roundTime(draw.round) - Date.now()) + 1200
  setTimeout(() => finalize(draw.id), wait)
}

// после перезапуска сервера довести незавершённые розыгрыши
state.draws.filter((d) => d.status === 'pending').forEach(scheduleFinalize)

// ---------- клиенты ----------
let clientsCache = null
function clients() {
  if (!clientsCache) {
    const map = new Map()
    for (const [ticket, name, phone] of ticketsDb.tickets) {
      let c = map.get(phone)
      if (!c) map.set(phone, (c = { phone, name, tickets: [] }))
      c.tickets.push(ticket)
    }
    clientsCache = [...map.values()]
      .map((c) => ({ ...c, tickets: c.tickets.sort(), search: `${c.name} ${c.phone} ${c.phone.replace(/\D/g, '')}`.toLowerCase() }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }
  return clientsCache
}

export function searchClients(q, page, size = 50) {
  const all = clients()
  const query = String(q || '').trim().toLowerCase()
  const digits = query.replace(/\D/g, '')
  const found = !query
    ? all
    : all.filter((c) => c.search.includes(query) || (digits.length >= 3 && (c.search.includes(digits) || c.tickets.some((t) => t.includes(digits)))))
  const wonPhones = new Set(state.draws.filter((d) => d.status === 'done').map((d) => d.phone))
  const start = (page - 1) * size
  return {
    total: found.length,
    totalClients: all.length,
    page,
    pages: Math.max(1, Math.ceil(found.length / size)),
    items: found.slice(start, start + size).map(({ search, ...c }) => ({ ...c, count: c.tickets.length, winner: wonPhones.has(c.phone) })),
  }
}
