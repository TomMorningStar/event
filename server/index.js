import './env.js'
import express from 'express'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { parseWorkbook, maskPhone, templateBuffer } from './parse.js'
import * as store from './store.js'

const { ADMIN_LOGIN, ADMIN_PASSWORD, JWT_SECRET, PORT = 3001 } = process.env
if (!ADMIN_LOGIN || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('Заполните ADMIN_LOGIN, ADMIN_PASSWORD и JWT_SECRET в .env')
  process.exit(1)
}
const ALLOW_MULTIPLE = process.env.ALLOW_MULTIPLE_WINS === 'true'
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use(cookieParser())
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

const safeEq = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

const attempts = new Map()
app.post('/api/login', (req, res) => {
  const ip = req.ip
  const a = attempts.get(ip)
  const active = a && a.until > Date.now()
  if (active && a.n >= 5) return res.status(429).json({ error: 'Слишком много попыток, подождите минуту' })

  const { login, password } = req.body || {}
  if (safeEq(login, ADMIN_LOGIN) && safeEq(password, ADMIN_PASSWORD)) {
    attempts.delete(ip)
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: COOKIE_SECURE, maxAge: 12 * 3600e3 })
    return res.json({ ok: true })
  }
  attempts.set(ip, { n: (active ? a.n : 0) + 1, until: Date.now() + 60e3 })
  res.status(401).json({ error: 'Неверный логин или пароль' })
})
app.post('/api/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

const requireAdmin = (req, res, next) => {
  try {
    jwt.verify(req.cookies.token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Требуется вход' })
  }
}
app.get('/api/admin/me', requireAdmin, (_req, res) => res.json({ ok: true }))

const adminState = () => {
  const { prizes, draws } = store.getState()
  return {
    tickets: store.getTicketsMeta(),
    prizes: prizes.map((p) => {
      const d = store.activeDraw(p.id)
      return { ...p, pending: d?.status === 'pending' ? { round: d.round, revealAt: d.revealAt, error: d.lastError } : null, winner: d?.status === 'done' ? d : null }
    }),
    history: draws.filter((d) => d.status === 'cancelled').map(({ excluded, ...d }) => d),
  }
}
const handle = (fn) => (req, res) => {
  try {
    fn(req)
    res.json(adminState())
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
}

app.get('/api/admin/template', requireAdmin, (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="template.xlsx"')
  res.send(templateBuffer())
})
app.get('/api/admin/state', requireAdmin, (_req, res) => res.json(adminState()))

app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' })
  let parsed
  try {
    parsed = parseWorkbook(req.file.buffer)
  } catch (e) {
    return res.status(400).json({ error: 'Не удалось прочитать файл: ' + e.message })
  }
  if (!parsed.tickets.length) return res.status(400).json({ error: 'В файле нет подходящих билетов' })
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  handle(() => store.setTickets(parsed.tickets, parsed.stats, name))(req, res)
})

app.post('/api/admin/prizes', requireAdmin, (req, res) => {
  const title = String(req.body?.title ?? '').trim().slice(0, 200)
  if (!title) return res.status(400).json({ error: 'Введите название приза' })
  handle(() => store.addPrize(title))(req, res)
})
app.delete('/api/admin/prizes/:id', requireAdmin, handle((req) => store.deletePrize(req.params.id)))
app.post('/api/admin/prizes/:id/draw', requireAdmin, handle((req) => store.startDraw(req.params.id, ALLOW_MULTIPLE)))
app.delete(
  '/api/admin/prizes/:id/winner',
  requireAdmin,
  handle((req) => store.cancelWinner(req.params.id, String(req.body?.reason ?? '').trim().slice(0, 300))),
)

app.get('/api/admin/clients', requireAdmin, (req, res) => {
  const num = (v) => Math.max(0, parseInt(v) || 0)
  res.json(
    store.searchClients({
      q: req.query.q,
      page: Math.max(1, parseInt(req.query.page) || 1),
      sort: req.query.sort,
      min: num(req.query.min),
      max: num(req.query.max),
      winners: req.query.winners === '1',
    }),
  )
})

const publicDraw = ({ name, phone, ...d }, withExcluded) => ({
  ...d,
  excluded: withExcluded ? d.excluded : undefined,
  excludedCount: d.excluded.length,
  name: d.status === 'pending' ? undefined : name,
  phone: phone ? maskPhone(phone) : undefined,
})

app.get('/api/public/state', (_req, res) => {
  const { prizes } = store.getState()
  const all = store.getTickets()
  const sample = []
  for (let i = 0; i < Math.min(60, all.length); i++) {

    const t = all[crypto.randomInt(all.length)]
    sample.push({ ticket: t[0], name: t[1], phone: maskPhone(t[2]) })
  }
  res.json({
    ticketCount: all.length,
    listHash: store.getTicketsMeta().listHash,
    sample,
    prizes: prizes.map((p) => {
      const d = store.activeDraw(p.id)
      return {
        id: p.id,
        title: p.title,
        pending: d?.status === 'pending' ? publicDraw(d, false) : null,
        winner: d?.status === 'done' ? publicDraw(d, false) : null,
      }
    }),
  })
})

app.get('/api/public/draws', (_req, res) => {
  res.json({ ...store.getTicketsMeta(), stats: undefined, fileName: undefined, draws: store.getState().draws.map((d) => publicDraw(d, true)) })
})

app.get('/api/public/lists/:hash.txt', (req, res) => {
  const file = store.listFile(req.params.hash)
  if (!file || !fs.existsSync(file)) return res.status(404).send('not found')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.sendFile(file)
})

const dist = path.resolve('dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`))
