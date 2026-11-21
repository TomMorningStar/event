#!/usr/bin/env node

import { verifyDraw, beaconUrl } from '../shared/fair.js'

const base = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '')
const get = async (url, type = 'json') => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r[type]()
}

const { draws } = await get(`${base}/api/public/draws`)
const lists = new Map()
let failed = 0

for (const d of draws) {
  console.log(`\n#${d.drawNo} «${d.prizeTitle}» — ${d.status}`)
  if (d.status === 'pending') {
    console.log('  ожидает раунд drand', d.round)
    continue
  }
  if (!lists.has(d.listHash)) lists.set(d.listHash, await get(`${base}/api/public/lists/${d.listHash}.txt`, 'text'))
  const text = lists.get(d.listHash)
  const steps = verifyDraw(d, text ? text.split('\n') : [])
  try {
    const b = await get(beaconUrl(d.round))
    steps.push({ name: 'Число совпадает с api.drand.sh', ok: b.randomness === d.randomness })
  } catch (e) {
    steps.push({ name: 'api.drand.sh недоступен: ' + e.message, ok: true })
  }
  for (const s of steps) console.log(`  ${s.ok ? '✔' : '✘'} ${s.name}`)
  console.log(`  → победитель: билет ${d.ticket}`)
  if (!steps.every((s) => s.ok)) failed++
}

console.log(failed ? `\n❌ Не прошли проверку: ${failed}` : `\n✅ Все ${draws.length} розыгрышей подтверждены`)
process.exit(failed ? 1 : 0)
