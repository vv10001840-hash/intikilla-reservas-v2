import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'

let resolveInitialState

async function renderApp() {
  render(<App />)
  await act(async () => {
    resolveInitialState()
    await Promise.resolve()
  })
}

beforeEach(() => {
  localStorage.clear()
  delete window.EventSource
  global.fetch = jest.fn(async (path, options = {}) => {
    const reservations = [
      {
        id: 'demo-1', cliente: 'Mariela Quispe', email: 'mariela@email.com', telefono: '987 451 220', fecha: '2026-07-05', hora: '19:00', mesa: 3, personas: 4, estado: 'Confirmada', origen: 'Web', notas: 'Cumpleanos',
      },
      {
        id: 'demo-2', cliente: 'Carlos Ramos', email: 'carlos@email.com', telefono: '912 334 098', fecha: '2026-07-06', hora: '20:00', mesa: 5, personas: 6, estado: 'Pendiente', origen: 'Telefono', notas: 'Silla para nino',
      },
      {
        id: 'demo-3', cliente: 'Lucia Torres', email: 'lucia@email.com', telefono: '955 120 030', fecha: '2026-07-09', hora: '13:00', mesa: 1, personas: 2, estado: 'Confirmada', origen: 'Web', notas: '',
      },
    ]
    const mesas = [
      { id: 1, capacidad: 2, zona: 'Salon', estado: 'Activa' }, { id: 2, capacidad: 2, zona: 'Salon', estado: 'Activa' }, { id: 3, capacidad: 4, zona: 'Terraza', estado: 'Activa' }, { id: 4, capacidad: 4, zona: 'Terraza', estado: 'Activa' }, { id: 5, capacidad: 6, zona: 'Privado', estado: 'Activa' }, { id: 6, capacidad: 6, zona: 'Salon', estado: 'Activa' }, { id: 7, capacidad: 8, zona: 'Patio', estado: 'Activa' }, { id: 8, capacidad: 8, zona: 'Patio', estado: 'Mantenimiento' },
    ]
    if (path === '/api/state') {
      return new Promise((resolve) => {
        resolveInitialState = () => resolve({ ok: true, json: async () => ({ reservas: reservations, mesas }) })
      })
    }
    if (path === '/api/reservas' && options.method === 'POST') {
      const body = JSON.parse(options.body)
      return {
        ok: true,
        json: async () => ({
          ...body,
          id: 'nueva-1',
          estado: 'Confirmada',
          notificacionEmail: { sent: true },
        }),
      }
    }
    if (String(path).startsWith('/api/reservas/demo-1') && options.method === 'PATCH') {
      return { ok: true, json: async () => ({ ...reservations[0], estado: 'Cancelada' }) }
    }
    return { ok: true, json: async () => ({}) }
  })
})

test('muestra las mesas libres y ocupadas antes de reservar', async () => {
  await renderApp()

  fireEvent.click(screen.getByRole('button', { name: /portal cliente/i }))
  fireEvent.click(screen.getByRole('button', { name: /reservar ahora/i }))
  fireEvent.change(screen.getByLabelText(/fecha/i), {
    target: { value: '2026-07-05' },
  })
  fireEvent.change(screen.getByLabelText(/hora/i), {
    target: { value: '19:00' },
  })
  fireEvent.change(screen.getByLabelText(/numero de personas/i), {
    target: { value: '4' },
  })

  expect(screen.getByRole('button', { name: /mesa 3 ocupada/i })).toBeDisabled()
  expect(screen.getAllByText('Libre').length).toBeGreaterThan(0)
})

test('permite al administrador cancelar una reserva desde el listado', async () => {
  await renderApp()

  fireEvent.change(screen.getByLabelText(/contrasena/i), {
    target: { value: 'admin' },
  })
  fireEvent.click(screen.getByRole('button', { name: /ingresar al panel/i }))
  fireEvent.click(screen.getByRole('button', { name: /^reservas$/i }))

  const row = screen.getByText('Mariela Quispe').closest('tr')
  fireEvent.click(
    within(row).getByRole('button', { name: /cancelar reserva de mariela quispe/i }),
  )

  await waitFor(() => expect(within(row).getByRole('combobox')).toHaveValue('Cancelada'))
})

test('al completar una reserva se informa el envio de correo y se ofrece confirmar por WhatsApp', async () => {
  await renderApp()

  fireEvent.click(screen.getByRole('button', { name: /portal cliente/i }))
  fireEvent.click(screen.getByRole('button', { name: /reservar ahora/i }))
  fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: '2026-07-08' } })
  fireEvent.click(screen.getByRole('button', { name: /^mesa 1/i }))
  fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

  fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Ana Vargas' } })
  fireEvent.change(screen.getByLabelText(/correo electronico/i), { target: { value: 'ana@email.com' } })
  fireEvent.change(screen.getByLabelText(/telefono/i), { target: { value: '987654321' } })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /confirmar reserva/i }))
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(await screen.findByText(/te enviamos un correo de confirmaci[oó]n/i)).toBeInTheDocument()
  const whatsappLink = screen.getByRole('link', { name: /confirmar por whatsapp/i })
  expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('wa.me'))
})
