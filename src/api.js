export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(body.error ?? 'No se pudo completar la operacion.', response.status)
  return body
}

export const api = {
  getState: () => request('/api/state'),
  createReservation: (reservation) => request('/api/reservas', { method: 'POST', body: JSON.stringify(reservation) }),
  updateReservation: (id, estado) => request(`/api/reservas/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  updateTable: (id, estado) => request(`/api/mesas/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
}
