/**
 * ПРОЗРАЧНЫЙ (PROVABLY FAIR) АЛГОРИТМ ВЫБОРА ПОБЕДИТЕЛЯ
 * =====================================================
 * Этот файл можно публиковать целиком. Один и тот же код используется
 * сервером при розыгрыше, страницей /fair и скриптом scripts/verify.mjs.
 *
 * Источник случайности — drand (League of Entropy, https://drand.love):
 * публичный маяк, который каждые 3 секунды выпускает случайное число,
 * подписанное порогово (BLS) независимыми организациями (Cloudflare, EPFL,
 * Protocol Labs, университеты и др.). Число раунда N невозможно узнать или
 * повлиять на него до момента его выпуска — ни нам, ни кому-либо ещё.
 *
 * Порядок розыгрыша:
 *  1. Список билетов: только номера, отсортированные (стандартная сортировка
 *     строк JS), уникальные, через "\n". listHash = SHA-256 этого текста.
 *     Файл списка публикуется — по нему любой может проверить хэш.
 *  2. Пул розыгрыша = список минус уже выигравшие билеты (excluded, тоже
 *     публикуется). poolHash = SHA-256 пула в том же формате.
 *  3. ДО выпуска случайности фиксируется и публикуется обязательство:
 *     listHash, excluded, poolHash, размер пула и номер БУДУЩЕГО раунда drand.
 *  4. Когда раунд выпущен, берём его randomness, проверяем BLS-подпись
 *     публичным ключом drand и детерминированно вычисляем индекс победителя:
 *        seed  = SHA-256("fair-v1|" + randomness + "|" + poolHash + "|" + drawNo)
 *        h_c   = SHA-256(seed + "|" + c),  c = 0, 1, 2, ...
 *        берём первый h_c < 2^256 - (2^256 mod N), index = h_c mod N
 *     (отбраковка устраняет смещение по модулю — все билеты строго равновероятны).
 *  5. Победитель = pool[index].
 *
 * Мы не можем подобрать результат: пул и раунд зафиксированы раньше, чем
 * появилась случайность, а случайность выпускает не наш сервер.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { bls12_381 as bls } from '@noble/curves/bls12-381.js'

export const ALGO_VERSION = 'fair-v1'

/** Сеть drand "quicknet" — параметры с https://api.drand.sh/<chainHash>/info */
export const DRAND = {
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  publicKey:
    '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  genesisTime: 1692803367, // секунды
  period: 3, // секунды
  scheme: 'bls-unchained-g1-rfc9380',
  dst: 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_',
  relays: ['https://api.drand.sh', 'https://api2.drand.sh', 'https://api3.drand.sh', 'https://drand.cloudflare.com'],
}

export const sha256Hex = (text) => bytesToHex(sha256(utf8ToBytes(text)))

/** Канонический текст списка: уникальные номера, отсортированы, через \n */
export function canonicalList(tickets) {
  return [...new Set(tickets.map(String))].sort()
}
export const listText = (sorted) => sorted.join('\n')
export const listHash = (sorted) => sha256Hex(listText(sorted))

/** Пул = отсортированный список без исключённых билетов (порядок сохраняется) */
export function buildPool(sortedList, excluded) {
  const ex = new Set(excluded)
  return sortedList.filter((t) => !ex.has(t))
}

/** Номер раунда drand, который будет выпущен в момент времени timeMs (или сразу после) */
export function roundAt(timeMs) {
  const t = timeMs / 1000 - DRAND.genesisTime
  return Math.floor(t / DRAND.period) + 1
}
/** Время выпуска раунда (мс) */
export const roundTime = (round) => (DRAND.genesisTime + (round - 1) * DRAND.period) * 1000

export const beaconUrl = (round, relay = DRAND.relays[0]) => `${relay}/${DRAND.chainHash}/public/${round}`

/**
 * Проверка маяка drand: BLS-подпись раунда валидна для публичного ключа сети,
 * и randomness = SHA-256(signature). Возвращает true/false.
 */
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

/** Детерминированный равномерный индекс в [0, n) */
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

/**
 * Полная проверка записи розыгрыша.
 * draw: { drawNo, listHash, excluded, poolHash, poolSize, round, randomness, signature, index, ticket }
 * sortedList: массив номеров из опубликованного файла списка.
 * Возвращает массив шагов { name, ok, detail }.
 */
export function verifyDraw(draw, sortedList) {
  const steps = []
  const add = (name, ok, detail = '') => steps.push({ name, ok, detail })

  const lh = listHash(sortedList)
  add('Хэш списка билетов совпадает', lh === draw.listHash, lh)

  const pool = buildPool(sortedList, draw.excluded || [])
  const ph = listHash(pool)
  add('Хэш пула (список минус исключённые) совпадает', ph === draw.poolHash, ph)
  add('Размер пула совпадает', pool.length === draw.poolSize, String(pool.length))

  add(
    'Раунд drand выбран после фиксации пула',
    draw.committedAt ? new Date(draw.committedAt).getTime() < roundTime(draw.round) : true,
    `фиксация ${draw.committedAt}, раунд ${draw.round} выпущен ${new Date(roundTime(draw.round)).toISOString()}`,
  )

  add('BLS-подпись drand валидна, randomness = SHA-256(signature)', verifyBeacon(draw), `раунд ${draw.round}`)

  const { index } = pickIndex(draw.randomness, draw.poolHash, draw.drawNo, pool.length)
  add('Индекс победителя пересчитан', index === draw.index, String(index))
  add('Билет победителя совпадает', pool[index] === draw.ticket, pool[index])

  return steps
}
