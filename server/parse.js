import * as XLSX from 'xlsx'

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Шаблон Excel: колонка A — номер билета, B — ФИО, C — телефон. Первая строка — заголовок. */
export function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  if (rows.length < 2) throw new Error('Файл пустой')

  const stats = { total: rows.length - 1, invalid: 0, duplicates: 0 }
  const seen = new Set()
  const tickets = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const ticket = norm(row[0])
    const name = norm(row[1])
    let phone = norm(row[2])
    if (phone && !phone.startsWith('+') && /^\d{10,}$/.test(phone)) {
      if (phone.length === 11 && phone[0] === '8') phone = '7' + phone.slice(1)
      phone = '+' + phone
    }
    if (!ticket || !name || !phone) {
      stats.invalid++
      continue
    }
    if (seen.has(ticket)) {
      stats.duplicates++
      continue
    }
    seen.add(ticket)
    tickets.push([ticket, name, phone])
  }
  stats.accepted = tickets.length
  stats.participants = new Set(tickets.map((t) => t[2])).size
  return { tickets, stats }
}

/** +79389040257 -> +7938904**** (последние 4 цифры скрыты) */
export function maskPhone(phone) {
  let left = 4
  const chars = [...phone]
  for (let i = chars.length - 1; i >= 0 && left > 0; i--) {
    if (/\d/.test(chars[i])) {
      chars[i] = '*'
      left--
    }
  }
  return chars.join('')
}

export function templateBuffer() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Номер билета', 'ФИО', 'Телефон'],
    ['12345678', 'Иванов Иван Иванович', '+79001234567'],
  ])
  ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Билеты')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
