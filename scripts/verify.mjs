#!/usr/bin/env node
import fs from 'node:fs'
import { verifyDraw, beaconUrl } from '../shared/fair.js'

const file = process.argv[2]
if (!file) {
  console.error('Использование: node scripts/verify.mjs proof-1.json')
  process.exit(2)
}

const get = async (url) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json()
}

const proof = JSON.parse(fs.readFileSync(file, 'utf8'))
if (proof.format !== 'fair-proof-v1') throw new Error('Неизвестный формат файла')
const draws = [proof.draw]
const listFor = async () => proof.list

let failed = 0
for (const d of draws) {
  console.log(`\n#${d.drawNo} «${d.prizeTitle}» — ${d.status}`)
  if (d.status === 'pending') {
    console.log('  ожидает раунд drand', d.round)
    continue
  }
  const steps = verifyDraw(d, await listFor(d.listHash))
  try {
    const b = await get(beaconUrl(d.round))
    steps.push({ name: 'Число совпадает с api.drand.sh', ok: b.randomness === d.randomness })
  } catch (e) {
    steps.push({ name: 'api.drand.sh недоступен: ' + e.message, ok: false })
  }
  for (const s of steps) console.log(`  ${s.ok ? '✔' : '✘'} ${s.name}`)
  console.log(`  → победитель: билет ${d.ticket}`)
  if (!steps.every((s) => s.ok)) failed++
}

console.log(failed ? `\n❌ Не прошли проверку: ${failed}` : `\n✅ Все ${draws.length} розыгрышей подтверждены`)
process.exit(failed ? 1 : 0)
