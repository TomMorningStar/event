async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Ошибка ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
})

export const api = {
  publicState: () => request('/api/public/state'),
  login: (login, password) => request('/api/login', json('POST', { login, password })),
  logout: () => request('/api/logout', json('POST')),
  adminState: () => request('/api/admin/state'),
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('/api/admin/upload', { method: 'POST', body: fd })
  },
  addPrize: (title) => request('/api/admin/prizes', json('POST', { title })),
  deletePrize: (id) => request(`/api/admin/prizes/${id}`, json('DELETE')),
  draw: (id) => request(`/api/admin/prizes/${id}/draw`, json('POST')),
  removeWinner: (id, reason) => request(`/api/admin/prizes/${id}/winner`, json('DELETE', { reason })),
  clients: (params) => request(`/api/admin/clients?${new URLSearchParams(params)}`),
  draws: () => request('/api/admin/draws'),
  listText: async (hash) => {
    const r = await fetch(`/api/admin/lists/${hash}.txt`, { credentials: 'same-origin' })
    if (!r.ok) throw new Error('Файл списка не найден')
    return r.text()
  },
}
