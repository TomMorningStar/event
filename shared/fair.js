import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { bls12_381 as bls } from '@noble/curves/bls12-381.js'

export const ALGO_VERSION = 'fair-v1'

export const DRAND = {
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  publicKey:
    '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  genesisTime: 1692803367,
  period: 3,
  scheme: 'bls-unchained-g1-rfc9380',
  dst: 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_',
  relays: ['https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com'],
}

export const sha256Hex = (text) => bytesToHex(sha256(utf8ToBytes(text)))

export function canonicalList(tickets) {
  return [...new Set(tickets.map(String))].sort()
}
export const listText = (sorted) => sorted.join('\n')
export const listHash = (sorted) => sha256Hex(listText(sorted))

export function buildPool(sortedList, excluded) {
  const ex = new Set(excluded)
  return sortedList.filter((t) => !ex.has(t))
}

export function roundAt(timeMs) {
  const t = timeMs / 1000 - DRAND.genesisTime
  return Math.floor(t / DRAND.period) + 1
}

export const roundTime = (round) => (DRAND.genesisTime + (round - 1) * DRAND.period) * 1000

export const beaconUrl = (round, relay = DRAND.relays[0]) => `${relay}/${DRAND.chainHash}/public/${round}`

export function verifyBeacon({ round, randomness, signature }) {
  try {
    const rb = new Uint8Array(8)
    new DataView(rb.buffer).setBigUint64(0, BigInt(round))
    const msg = bls.shortSignatures.hash(sha256(rb), DRAND.dst)
    const okSig = bls.shortSignatures.verify(hexToBytes(signature), msg, hexToBytes(DRAND.publicKey))
    const okRand = bytesToHex(sha256(hexToBytes(signature))) === randomness
    return okSig && okRand
  } catch {
    return false
  }
}

const TWO256 = 1n << 256n

export function pickIndex(randomness, poolHash, drawNo, n) {
  if (!Number.isInteger(n) || n <= 0) throw new Error('Пустой пул')
  const N = BigInt(n)
  const limit = TWO256 - (TWO256 % N)
  const seed = sha256Hex(`${ALGO_VERSION}|${randomness}|${poolHash}|${drawNo}`)
  for (let c = 0; ; c++) {
    const h = BigInt('0x' + sha256Hex(`${seed}|${c}`))
    if (h < limit) return { seed, index: Number(h % N), attempts: c + 1 }
  }
}

export function chooseWinner(pool, poolHash, drawNo, randomness) {
  const { seed, index } = pickIndex(randomness, poolHash, drawNo, pool.length)
  return { seed, index, ticket: pool[index] }
}

export function commitmentHash(d) {
  return sha256Hex(JSON.stringify([ALGO_VERSION, d.drawNo, d.prevCommitment || '', d.listHash, d.poolHash, d.round, d.rule, d.committedAt]))
}

export function verifyChain(draws) {
  return draws.every((d, i) => d.commitment === commitmentHash(d) && (d.prevCommitment || '') === (i ? draws[i - 1].commitment : ''))
}

export function verifyDraw(draw, sortedList) {
  const steps = []
  const add = (group, name, ok, detail = '') => steps.push({ group, name, ok, detail })

  const lh = listHash(sortedList)
  add('list', 'Хэш списка билетов совпадает', lh === draw.listHash, lh)

  const pool = buildPool(sortedList, draw.excluded || [])
  const ph = listHash(pool)
  add('list', 'Хэш пула (список минус исключённые) совпадает', ph === draw.poolHash, ph)
  add('list', 'Размер пула совпадает', pool.length === draw.poolSize, String(pool.length))

  add('random', 'BLS-подпись drand валидна, randomness = SHA-256(signature)', verifyBeacon(draw), `раунд ${draw.round}`)

  const { index, ticket } = chooseWinner(pool, draw.poolHash, draw.drawNo, draw.randomness)
  add('calc', 'Индекс победителя пересчитан', index === draw.index, String(index))
  add('calc', 'Билет победителя совпадает', ticket === draw.ticket, ticket)

  add(
    'time',
    'Раунд drand выпущен позже времени фиксации',
    new Date(draw.committedAt).getTime() < roundTime(draw.round),
    `фиксация ${draw.committedAt}, раунд ${draw.round} выпущен ${new Date(roundTime(draw.round)).toISOString()}`,
  )
  add('time', 'Код фиксации совпадает с данными розыгрыша', commitmentHash(draw) === draw.commitment, draw.commitment)

  return steps
}
