// Подпись, которую сервер ставит билетам без ФИО (см. server/parse.js)
const NO_NAME = 'Не указано ФИО'

/** ФИО участника; заглушку «Не указано ФИО» показываем приглушённо. */
export function PersonName({ name, className = '' }) {
  const empty = !name || name === NO_NAME
  return <div className={`${className} ${empty ? 'is-noname' : ''}`}>{empty ? NO_NAME : name}</div>
}

/** plural(5, ['билет', 'билета', 'билетов']) → 'билетов' */
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
