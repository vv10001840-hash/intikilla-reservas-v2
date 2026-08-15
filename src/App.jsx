import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { api } from './api'

const STORAGE_KEY = 'intikilla_reservas_v2'
const SYNC_CHANNEL = 'intikilla_reservas_sync'
const ADMIN_USER = 'admin@intikilla.pe'
const ADMIN_PASSWORD = 'admin'

// Numero de WhatsApp del restaurante en formato internacional sin espacios
// ni "+", tal como lo exige la API de enlaces wa.me. Reemplazar por el
// numero real de IntiKilla antes de la sustentacion.
const RESTAURANT_WHATSAPP = '984110445'

const HORARIOS = ['12:00', '13:00', '14:00', '19:00', '20:00', '21:00']

const MESAS_INICIALES = [
  { id: 1, capacidad: 2, zona: 'Salon', estado: 'Activa' },
  { id: 2, capacidad: 2, zona: 'Salon', estado: 'Activa' },
  { id: 3, capacidad: 4, zona: 'Terraza', estado: 'Activa' },
  { id: 4, capacidad: 4, zona: 'Terraza', estado: 'Activa' },
  { id: 5, capacidad: 6, zona: 'Privado', estado: 'Activa' },
  { id: 6, capacidad: 6, zona: 'Salon', estado: 'Activa' },
  { id: 7, capacidad: 8, zona: 'Patio', estado: 'Activa' },
  { id: 8, capacidad: 8, zona: 'Patio', estado: 'Mantenimiento' },
]

const RESERVAS_DEMO = [
  {
    id: 'demo-1',
    cliente: 'Mariela Quispe',
    email: 'mariela@email.com',
    telefono: '987 451 220',
    fecha: '2026-07-05',
    hora: '19:00',
    mesa: 3,
    personas: 4,
    estado: 'Confirmada',
    origen: 'Web',
    notas: 'Cumpleanos',
  },
  {
    id: 'demo-2',
    cliente: 'Carlos Ramos',
    email: 'carlos@email.com',
    telefono: '912 334 098',
    fecha: '2026-07-06',
    hora: '20:00',
    mesa: 5,
    personas: 6,
    estado: 'Pendiente',
    origen: 'Telefono',
    notas: 'Silla para nino',
  },
  {
    id: 'demo-3',
    cliente: 'Lucia Torres',
    email: 'lucia@email.com',
    telefono: '955 120 030',
    fecha: '2026-07-09',
    hora: '13:00',
    mesa: 1,
    personas: 2,
    estado: 'Confirmada',
    origen: 'Web',
    notas: '',
  },
]

const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'nueva', label: 'Nueva reserva' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'mesas', label: 'Mesas' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'configuracion', label: 'Configuracion' },
]

const EMPTY_FORM = {
  cliente: '',
  email: '',
  telefono: '',
  fecha: '',
  hora: '19:00',
  personas: 2,
  mesa: '',
  notas: '',
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(dateString) {
  if (!dateString) return 'Sin fecha'
  const date = new Date(`${dateString}T00:00:00`)
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getMonthDays(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const startsOn = new Date(year, month, 1).getDay()
  const prefix = Array.from({ length: startsOn }, () => null)
  const days = Array.from({ length: totalDays }, (_, index) => index + 1)
  return [...prefix, ...days]
}

function makeReservation(values, origen = 'Admin') {
  return {
    id: crypto.randomUUID(),
    cliente: values.cliente.trim(),
    email: values.email.trim(),
    telefono: values.telefono.trim(),
    fecha: values.fecha,
    hora: values.hora,
    mesa: Number(values.mesa),
    personas: Number(values.personas),
    estado: 'Confirmada',
    origen,
    notas: values.notas.trim(),
  }
}

function loadReservations() {
  try {
    const guardadas = localStorage.getItem(STORAGE_KEY)
    return guardadas ? JSON.parse(guardadas) : RESERVAS_DEMO
  } catch {
    return RESERVAS_DEMO
  }
}

function reservationsReducer(state, action) {
  switch (action.type) {
    case 'create':
      return [action.reservation, ...state]
    case 'cancel':
      return state.map((reserva) =>
        reserva.id === action.id ? { ...reserva, estado: 'Cancelada' } : reserva,
      )
    case 'change-status':
      return state.map((reserva) =>
        reserva.id === action.id ? { ...reserva, estado: action.estado } : reserva,
      )
    case 'sync':
      return JSON.stringify(state) === JSON.stringify(action.reservations)
        ? state
        : action.reservations
    default:
      return state
  }
}

function App() {
  const [reservas, dispatchReservations] = useReducer(
    reservationsReducer,
    undefined,
    loadReservations,
  )
  const [mesas, setMesas] = useState(MESAS_INICIALES)
  const [isAdmin, setIsAdmin] = useState(false)
  const [section, setSection] = useState('dashboard')
  const [clientStep, setClientStep] = useState('admin-login')
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [clientDraft, setClientDraft] = useState({
    fecha: getToday(),
    hora: '19:00',
    personas: 2,
    mesa: '',
  })

  const syncRemoteState = useCallback(async () => {
    const state = await api.getState()
    dispatchReservations({ type: 'sync', reservations: state.reservas })
    setMesas(state.mesas)
    return state
  }, [])

  useEffect(() => {
    // Mientras MySQL responde se conserva el cache local para que la interfaz no quede vacia.
    syncRemoteState().catch(() => {})
  }, [syncRemoteState])

  useEffect(() => {
    if (!('EventSource' in window)) return undefined
    const events = new EventSource('/api/events')
    events.addEventListener('state-updated', () => {
      syncRemoteState().catch(() => {})
    })
    return () => events.close()
  }, [syncRemoteState])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservas))

    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL)
      channel.postMessage(reservas)
      channel.close()
    }
  }, [reservas])

  useEffect(() => {
    const syncReservations = (nextReservations) => {
      if (Array.isArray(nextReservations)) {
        dispatchReservations({ type: 'sync', reservations: nextReservations })
      }
    }

    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        syncReservations(JSON.parse(event.newValue))
      } catch {
        // Se conserva el estado actual si otra pestaña escribió datos inválidos.
      }
    }

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(SYNC_CHANNEL) : null
    if (channel) {
      channel.onmessage = (event) => syncReservations(event.data)
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      channel?.close()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const activeReservas = useMemo(
    () => reservas.filter((reserva) => reserva.estado !== 'Cancelada'),
    [reservas],
  )

  const createReservation = useCallback(async (values, origen = 'Admin') => {
    const nuevaReserva = makeReservation(values, origen)
    const reservation = await api.createReservation(nuevaReserva)
    dispatchReservations({ type: 'create', reservation })
    return reservation
  }, [])

  const cancelReservation = useCallback(async (id) => {
    const reservation = await api.updateReservation(id, 'Cancelada')
    dispatchReservations({ type: 'change-status', id, estado: reservation.estado })
  }, [])

  const changeReservationStatus = useCallback(async (id, estado) => {
    const reservation = await api.updateReservation(id, estado)
    dispatchReservations({ type: 'change-status', id, estado: reservation.estado })
  }, [])

  const updateTable = useCallback(async (id, estado) => {
    const mesa = await api.updateTable(id, estado)
    setMesas((current) => current.map((item) => (item.id === mesa.id ? mesa : item)))
  }, [])

  const isTableTaken = useCallback(
    (mesaId, fecha, hora) =>
      activeReservas.some(
        (reserva) =>
          reserva.mesa === Number(mesaId) && reserva.fecha === fecha && reserva.hora === hora,
      ),
    [activeReservas],
  )

  const availableTables = useCallback(
    (fecha, hora, personas) =>
      mesas.filter(
        (mesa) =>
          mesa.estado === 'Activa' &&
          mesa.capacidad >= Number(personas) &&
          !isTableTaken(mesa.id, fecha, hora),
      ),
    [isTableTaken, mesas],
  )

  const goClient = useCallback(() => {
    setIsAdmin(false)
    setClientStep('inicio')
  }, [])

  if (!isAdmin) {
    return (
      <ClientExperience
        clientStep={clientStep}
        setClientStep={setClientStep}
        clientDraft={clientDraft}
        setClientDraft={setClientDraft}
        mesas={mesas}
        isTableTaken={isTableTaken}
        selectedReservation={selectedReservation}
        setSelectedReservation={setSelectedReservation}
        createReservation={createReservation}
        onAdminAccess={() => setClientStep('admin-login')}
        onAdminLogin={() => setIsAdmin(true)}
      />
    )
  }

  return (
    <AdminExperience
      section={section}
      setSection={setSection}
      reservas={reservas}
      activeReservas={activeReservas}
      mesas={mesas}
      updateTable={updateTable}
      createReservation={createReservation}
      cancelReservation={cancelReservation}
      changeReservationStatus={changeReservationStatus}
      isTableTaken={isTableTaken}
      availableTables={availableTables}
      onLogout={goClient}
    />
  )
}

function ClientExperience({
  clientStep,
  setClientStep,
  clientDraft,
  setClientDraft,
  mesas,
  isTableTaken,
  selectedReservation,
  setSelectedReservation,
  createReservation,
  onAdminAccess,
  onAdminLogin,
}) {
  const updateDraft = (field, value) => {
    setClientDraft((current) => ({ ...current, [field]: value }))
  }

  const mesasParaCliente = useMemo(
    () =>
      mesas
        .filter(
          (mesa) =>
            mesa.estado === 'Activa' && mesa.capacidad >= Number(clientDraft.personas),
        )
        .map((mesa) => ({
          ...mesa,
          ocupada: isTableTaken(mesa.id, clientDraft.fecha, clientDraft.hora),
        })),
    [clientDraft.fecha, clientDraft.hora, clientDraft.personas, isTableTaken, mesas],
  )

  const draftTableAvailable = mesasParaCliente.some(
    (mesa) => mesa.id === Number(clientDraft.mesa) && !mesa.ocupada,
  )

  if (clientStep === 'admin-login') {
    return <AdminLogin onAdminLogin={onAdminLogin} onClientHome={() => setClientStep('inicio')} />
  }

  return (
    <div className="client-app">
      <header className="client-topbar">
        <button className="brand-button" onClick={() => setClientStep('inicio')}>
          <span className="brand-mark">IK</span>
          <span>IntiKilla</span>
        </button>
        <nav className="client-nav" aria-label="Navegacion principal">
          <button onClick={() => setClientStep('inicio')}>Inicio</button>
          <button onClick={() => setClientStep('disponibilidad')}>Reservar</button>
          <button onClick={onAdminAccess}>Admin</button>
        </nav>
      </header>

      {clientStep === 'inicio' && (
        <main className="client-home">
          <section className="client-hero">
            <div>
              <p className="eyebrow">Reservas online</p>
              <h1>Reserva tu mesa en IntiKilla</h1>
              <p>
                Cocina peruana contemporanea, atencion calida y mesas listas para compartir.
              </p>
              <button className="primary-action" onClick={() => setClientStep('disponibilidad')}>
                Reservar ahora
              </button>
            </div>
            <div className="hero-preview" aria-label="Vista de mesa reservada">
              <span>Hoy</span>
              <strong>19:00</strong>
              <small>Mesa familiar disponible</small>
            </div>
          </section>

          <section className="quick-links">
            <button onClick={() => setClientStep('disponibilidad')}>Horario</button>
            <button onClick={() => setClientStep('disponibilidad')}>Mesas</button>
            <button onClick={() => setClientStep('disponibilidad')}>Confirmar reserva</button>
          </section>
        </main>
      )}

      {clientStep === 'disponibilidad' && (
        <main className="client-flow">
          <section className="flow-panel">
            <p className="step-label">1. Elige fecha y hora</p>
            <div className="inline-fields">
              <label>
                Fecha
                <input
                  type="date"
                  value={clientDraft.fecha}
                  onChange={(event) => updateDraft('fecha', event.target.value)}
                />
              </label>
              <label>
                Hora
                <select
                  value={clientDraft.hora}
                  onChange={(event) => updateDraft('hora', event.target.value)}
                >
                  {HORARIOS.map((hora) => (
                    <option key={hora}>{hora}</option>
                  ))}
                </select>
              </label>
            </div>

            <p className="step-label">2. Numero de personas</p>
            <input
              className="compact-number"
              type="number"
              aria-label="Numero de personas"
              min="1"
              max="12"
              value={clientDraft.personas}
              onChange={(event) => updateDraft('personas', event.target.value)}
            />

            <p className="step-label">3. Mesas disponibles</p>
            <div className="availability-legend" aria-label="Leyenda de disponibilidad">
              <span className="free">Libre</span>
              <span className="occupied">Ocupada</span>
            </div>
            <div className="table-options">
              {mesasParaCliente.map((mesa) => (
                <button
                  key={mesa.id}
                  className={`${Number(clientDraft.mesa) === mesa.id ? 'selected' : ''} ${
                    mesa.ocupada ? 'occupied' : ''
                  }`}
                  disabled={mesa.ocupada}
                  onClick={() => updateDraft('mesa', mesa.id)}
                >
                  Mesa {mesa.id}
                  <small>{mesa.ocupada ? 'Ocupada' : `Libre · ${mesa.capacidad} pers.`}</small>
                </button>
              ))}
              {mesasParaCliente.length === 0 && (
                <p className="empty-copy">No hay mesas con capacidad suficiente.</p>
              )}
            </div>
            {mesasParaCliente.length > 0 &&
              mesasParaCliente.every((mesa) => mesa.ocupada) && (
                <p className="form-error" role="status">
                  Conflicto de horario: todas las mesas están ocupadas.
                </p>
              )}
            {clientDraft.mesa && !draftTableAvailable && (
              <p className="form-error" role="status">
                Conflicto detectado: elige una mesa libre antes de continuar.
              </p>
            )}

            <div className="panel-actions">
              <button
                className="primary-action"
                disabled={!draftTableAvailable}
                onClick={() => setClientStep('datos')}
              >
                Continuar
              </button>
            </div>
          </section>
        </main>
      )}

      {clientStep === 'datos' && (
        <ClientDetails
          clientDraft={clientDraft}
          createReservation={createReservation}
          setSelectedReservation={setSelectedReservation}
          setClientStep={setClientStep}
        />
      )}

      {clientStep === 'confirmacion' && (
        <ConfirmationMobile
          reservation={selectedReservation}
          onBack={() => {
            setClientDraft({ fecha: getToday(), hora: '19:00', personas: 2, mesa: '' })
            setClientStep('inicio')
          }}
        />
      )}
    </div>
  )
}

function AdminLogin({ onAdminLogin, onClientHome }) {
  const [form, setForm] = useState({ user: ADMIN_USER, password: '' })
  const [error, setError] = useState('')

  const handleLogin = (event) => {
    event.preventDefault()
    if (form.user.trim() === ADMIN_USER && form.password === ADMIN_PASSWORD) {
      setError('')
      onAdminLogin()
      return
    }
    setError('Usuario o contrasena incorrectos.')
  }

  return (
    <main className="login-screen">
      <header className="login-topbar">
        <div className="sidebar-brand">
          <span className="brand-mark">IK</span>
          <div>
            <strong>IntiKilla</strong>
            <small>Acceso administrador</small>
          </div>
        </div>
        <button className="ghost-action" onClick={onClientHome}>
          Portal cliente
        </button>
      </header>

      <section className="login-card">
        <h1>Iniciar sesion</h1>
        <form onSubmit={handleLogin}>
          <label>
            Usuario
            <input
              type="email"
              value={form.user}
              onChange={(event) => setForm((current) => ({ ...current, user: event.target.value }))}
            />
          </label>
          <label>
            Contrasena
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="admin"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="dark-action" type="submit">
            Ingresar al panel
          </button>
        </form>
      </section>
    </main>
  )
}

function ClientDetails({ clientDraft, createReservation, setSelectedReservation, setClientStep }) {
  const [form, setForm] = useState({
    cliente: '',
    email: '',
    telefono: '',
    notas: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.cliente.trim() || !form.email.trim() || !form.telefono.trim()) {
      setError('Completa tus datos de contacto.')
      return
    }

    setSaving(true)
    try {
      const reservation = await createReservation({ ...clientDraft, ...form }, 'Web')
      setSelectedReservation(reservation)
      setClientStep('confirmacion')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="client-flow">
      <form className="flow-panel details-panel" onSubmit={handleSubmit}>
        <p className="step-label">4. Completa tus datos</p>
        <label>
          Nombre completo
          <input
            type="text"
            value={form.cliente}
            onChange={(event) => updateForm('cliente', event.target.value)}
            placeholder="Ej. Ana Vargas"
          />
        </label>
        <label>
          Correo electronico
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateForm('email', event.target.value)}
            placeholder="ana@email.com"
          />
        </label>
        <label>
          Telefono
          <input
            type="tel"
            value={form.telefono}
            onChange={(event) => updateForm('telefono', event.target.value)}
            placeholder="987 654 321"
          />
        </label>
        <label>
          Nota opcional
          <textarea
            value={form.notas}
            onChange={(event) => updateForm('notas', event.target.value)}
            placeholder="Alergias, ocasion especial..."
          />
        </label>
        <div className="reservation-summary">
          Mesa {clientDraft.mesa} · {formatDate(clientDraft.fecha)} · {clientDraft.hora}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" type="submit" disabled={saving}>
          {saving ? 'Registrando...' : 'Confirmar reserva'}
        </button>
      </form>
    </main>
  )
}

// Arma el enlace de la API de WhatsApp (wa.me) con el mensaje de la reserva
// ya escrito, para que el cliente solo tenga que presionar "Enviar".
function buildWhatsappLink(reservation) {
  const mensaje = [
    'Hola IntiKilla, quiero confirmar mi reserva:',
    `Cliente: ${reservation.cliente}`,
    `Fecha: ${formatDate(reservation.fecha)}`,
    `Hora: ${reservation.hora}`,
    `Mesa: ${reservation.mesa}`,
    `Personas: ${reservation.personas}`,
  ].join('\n')

  return `https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(mensaje)}`
}

function ConfirmationMobile({ reservation, onBack }) {
  if (!reservation) return null

  const emailEnviado = reservation.notificacionEmail?.sent === true

  return (
    <main className="confirmation-stage">
      <section className="phone-frame">
        <div className="phone-header">IntiKilla</div>
        <div className="success-dot">OK</div>
        <h2>Reserva confirmada</h2>
        <p>Te esperamos en IntiKilla.</p>
        <div className="ticket">
          <strong>{reservation.cliente}</strong>
          <span>{formatDate(reservation.fecha)} · {reservation.hora}</span>
          <span>Mesa {reservation.mesa} · {reservation.personas} personas</span>
        </div>

        {emailEnviado ? (
          <p className="notification-status ok">
            Te enviamos un correo de confirmación a {reservation.email}.
          </p>
        ) : (
          <p className="notification-status">
            Guarda estos datos: no pudimos confirmar el envío del correo.
          </p>
        )}

        <a
          className="whatsapp-action"
          href={buildWhatsappLink(reservation)}
          target="_blank"
          rel="noreferrer"
        >
          Confirmar por WhatsApp
        </a>

        <button className="back-home-action" onClick={onBack}>
          Volver al inicio
        </button>
      </section>
    </main>
  )
}

function AdminExperience({
  section,
  setSection,
  reservas,
  activeReservas,
  mesas,
  updateTable,
  createReservation,
  cancelReservation,
  changeReservationStatus,
  isTableTaken,
  availableTables,
  onLogout,
}) {
  const title = ADMIN_NAV.find((item) => item.id === section)?.label ?? 'Dashboard'

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">IK</span>
          <div>
            <strong>IntiKilla</strong>
            <small>Reservas</small>
          </div>
        </div>
        <nav aria-label="Menu administrador">
          {ADMIN_NAV.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="admin-area">
        <header className="admin-topbar">
          <div>
            <small>Acceso administrador</small>
            <h1>{title}</h1>
          </div>
          <button className="ghost-action" onClick={onLogout}>
            Ver portal cliente
          </button>
        </header>

        <main className="admin-content">
          {section === 'dashboard' && (
            <Dashboard
              reservas={reservas}
              activeReservas={activeReservas}
              mesas={mesas}
              setSection={setSection}
            />
          )}
          {section === 'reservas' && (
            <ReservationsAdmin
              reservas={reservas}
              cancelReservation={cancelReservation}
              changeReservationStatus={changeReservationStatus}
              setSection={setSection}
            />
          )}
          {section === 'nueva' && (
            <NewReservationAdmin
              reservas={activeReservas}
              createReservation={createReservation}
              availableTables={availableTables}
            />
          )}
          {section === 'calendario' && (
            <CalendarAdmin reservas={activeReservas} isTableTaken={isTableTaken} />
          )}
          {section === 'mesas' && (
            <TablesAdmin mesas={mesas} updateTable={updateTable} activeReservas={activeReservas} />
          )}
          {section === 'reportes' && <Reports reservas={reservas} mesas={mesas} />}
          {section === 'configuracion' && <Settings />}
        </main>
      </div>
    </div>
  )
}

function Dashboard({ reservas, activeReservas, mesas, setSection }) {
  const today = getToday()
  const todayReservations = activeReservas.filter((reserva) => reserva.fecha === today)
  const pending = reservas.filter((reserva) => reserva.estado === 'Pendiente')
  const ocupadas = new Set(todayReservations.map((reserva) => reserva.mesa)).size
  const porcentaje = Math.round((ocupadas / mesas.length) * 100)

  return (
    <div className="dashboard-layout">
      <section className="metrics-grid">
        <Metric label="Reservas hoy" value={todayReservations.length} />
        <Metric label="Ocupacion" value={`${porcentaje}%`} />
        <Metric label="Pendientes" value={pending.length} />
        <Metric label="Mesas activas" value={mesas.filter((mesa) => mesa.estado === 'Activa').length} />
      </section>

      <section className="dashboard-panels">
        <div className="panel">
          <div className="panel-heading">
            <h2>Calendario de ocupacion</h2>
            <button onClick={() => setSection('calendario')}>Ver</button>
          </div>
          <MiniCalendar reservas={activeReservas} />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Reservas del dia</h2>
            <button onClick={() => setSection('reservas')}>Gestionar</button>
          </div>
          <div className="stack-list">
            {todayReservations.slice(0, 5).map((reserva) => (
              <article key={reserva.id} className="compact-row">
                <strong>{reserva.hora}</strong>
                <span>{reserva.cliente}</span>
                <small>Mesa {reserva.mesa}</small>
              </article>
            ))}
            {todayReservations.length === 0 && <p className="empty-copy">Sin reservas para hoy.</p>}
          </div>
        </div>
      </section>
    </div>
  )
}

const Metric = memo(function Metric({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
})

function ReservationsAdmin({
  reservas,
  cancelReservation,
  changeReservationStatus,
  setSection,
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Todas')
  const [error, setError] = useState('')

  const updateStatus = async (id, estado) => {
    setError('')
    try {
      await changeReservationStatus(id, estado)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const cancel = async (id) => {
    setError('')
    try {
      await cancelReservation(id)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const filtered = useMemo(
    () =>
      reservas.filter((reserva) => {
        const matchQuery =
          reserva.cliente.toLowerCase().includes(query.toLowerCase()) ||
          String(reserva.mesa).includes(query)
        const matchStatus = status === 'Todas' || reserva.estado === status
        return matchQuery && matchStatus
      }),
    [query, reservas, status],
  )

  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div>
          <h2>Gestion de reservas</h2>
          <p>{filtered.length} registros encontrados</p>
        </div>
        <button className="dark-action" onClick={() => setSection('nueva')}>
          Nueva reserva
        </button>
      </div>

      <div className="filters-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente o mesa"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>Todas</option>
          <option>Confirmada</option>
          <option>Pendiente</option>
          <option>Cancelada</option>
        </select>
      </div>
      {error && <p className="form-error" role="status">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Mesa</th>
              <th>Personas</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((reserva) => (
              <ReservationRow
                key={reserva.id}
                reserva={reserva}
                onStatusChange={updateStatus}
                onCancel={cancel}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Fila de la tabla de reservas: se memoriza porque en el panel de admin la
// lista se re-renderiza en cada tecla escrita en el buscador (query), y sin
// memo cada <tr> se reconstruiría aunque sus datos no hayan cambiado.
const ReservationRow = memo(function ReservationRow({ reserva, onStatusChange, onCancel }) {
  return (
    <tr>
      <td>
        <strong>{reserva.cliente}</strong>
        <small>{reserva.origen}</small>
      </td>
      <td>{formatDate(reserva.fecha)}</td>
      <td>{reserva.hora}</td>
      <td>Mesa {reserva.mesa}</td>
      <td>{reserva.personas}</td>
      <td>
        <select
          className="status-select"
          value={reserva.estado}
          onChange={(event) => onStatusChange(reserva.id, event.target.value)}
        >
          <option>Confirmada</option>
          <option>Pendiente</option>
          <option>Cancelada</option>
        </select>
      </td>
      <td>
        <button
          className="cancel-action"
          disabled={reserva.estado === 'Cancelada'}
          aria-label={`Cancelar reserva de ${reserva.cliente}`}
          onClick={() => onCancel(reserva.id)}
        >
          Cancelar
        </button>
      </td>
    </tr>
  )
})

function NewReservationAdmin({ reservas, createReservation, availableTables }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, fecha: getToday() })
  const [message, setMessage] = useState('')

  const mesasDisponibles = availableTables(form.fecha, form.hora, form.personas)
  const conflicto =
    form.mesa &&
    reservas.some(
      (reserva) =>
        reserva.fecha === form.fecha &&
        reserva.hora === form.hora &&
        reserva.mesa === Number(form.mesa),
    )

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.cliente.trim() || !form.fecha || !form.mesa) {
      setMessage('Completa cliente, fecha y mesa.')
      return
    }
    if (conflicto) {
      setMessage(`La mesa ${form.mesa} ya esta reservada en ese horario.`)
      return
    }

    try {
      await createReservation(form, 'Telefono')
      setMessage('Reserva telefonica registrada correctamente.')
      setForm({ ...EMPTY_FORM, fecha: getToday() })
    } catch (requestError) {
      setMessage(requestError.message)
    }
  }

  return (
    <section className="two-column">
      <form className="panel reservation-editor" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <h2>Nueva reserva</h2>
        </div>

        <label>
          Nombre del cliente
          <input
            value={form.cliente}
            onChange={(event) => updateForm('cliente', event.target.value)}
            placeholder="Ej. Andrea Molina"
          />
        </label>
        <label>
          Correo
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateForm('email', event.target.value)}
            placeholder="cliente@email.com"
          />
        </label>
        <label>
          Telefono
          <input
            value={form.telefono}
            onChange={(event) => updateForm('telefono', event.target.value)}
            placeholder="999 888 777"
          />
        </label>

        <div className="inline-fields">
          <label>
            Fecha
            <input
              type="date"
              value={form.fecha}
              onChange={(event) => updateForm('fecha', event.target.value)}
            />
          </label>
          <label>
            Hora
            <select value={form.hora} onChange={(event) => updateForm('hora', event.target.value)}>
              {HORARIOS.map((hora) => (
                <option key={hora}>{hora}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="inline-fields">
          <label>
            Personas
            <input
              type="number"
              min="1"
              max="12"
              value={form.personas}
              onChange={(event) => updateForm('personas', event.target.value)}
            />
          </label>
          <label>
            Mesa
            <select value={form.mesa} onChange={(event) => updateForm('mesa', event.target.value)}>
              <option value="">Seleccionar</option>
              {mesasDisponibles.map((mesa) => (
                <option key={mesa.id} value={mesa.id}>
                  Mesa {mesa.id} · {mesa.capacidad} pers.
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Observaciones
          <textarea
            value={form.notas}
            onChange={(event) => updateForm('notas', event.target.value)}
            placeholder="Solicitud especial"
          />
        </label>

        {message && <p className={message.includes('correctamente') ? 'form-ok' : 'form-error'}>{message}</p>}

        <button className="dark-action" type="submit">
          Registrar reserva
        </button>
      </form>

      <aside className="side-note">
        <strong>Disponibilidad</strong>
        <p>{mesasDisponibles.length} mesas libres para la seleccion actual.</p>
        {conflicto && <span>Conflicto detectado</span>}
      </aside>
    </section>
  )
}

function CalendarAdmin({ reservas, isTableTaken }) {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(getToday())
  const selectedReservations = reservas.filter((reserva) => reserva.fecha === selectedDate)

  return (
    <section className="calendar-layout">
      <div className="panel">
        <div className="panel-heading">
          <h2>Calendario de reservas</h2>
          <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
            {[0, 1, 2, 3, 4].map((offset) => {
              const date = new Date()
              date.setDate(date.getDate() + offset)
              const iso = date.toISOString().slice(0, 10)
              return (
                <option key={iso} value={iso}>
                  {formatDate(iso)}
                </option>
              )
            })}
          </select>
        </div>
        <MiniCalendar reservas={reservas} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      </div>

      <div className="panel">
        <div className="panel-heading">
          <h2>{formatDate(selectedDate)}</h2>
          <span className="pill">{selectedReservations.length} reservas</span>
        </div>
        <div className="schedule-list">
          {HORARIOS.map((hora) => (
            <article key={hora} className="schedule-row">
              <strong>{hora}</strong>
              <span>{selectedReservations.filter((reserva) => reserva.hora === hora).length} reservas</span>
              <small>{isTableTaken(1, selectedDate, hora) ? 'Mesa 1 ocupada' : 'Mesa 1 libre'}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const MiniCalendar = memo(function MiniCalendar({ reservas, selectedDate, setSelectedDate }) {
  const currentDate = new Date()
  const days = getMonthDays(currentDate)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const reservationsByDate = useMemo(() => {
    return reservas.reduce((acc, reserva) => {
      acc[reserva.fecha] = (acc[reserva.fecha] || 0) + 1
      return acc
    }, {})
  }, [reservas])

  return (
    <div className="mini-calendar">
      {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => (
        <strong key={`${day}-${index}`}>{day}</strong>
      ))}
      {days.map((day, index) => {
        if (!day) return <span key={`blank-${index}`} />
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const count = reservationsByDate[dateString] || 0
        const isSelected = selectedDate === dateString

        return (
          <button
            key={dateString}
            className={`${count > 0 ? 'busy' : ''} ${isSelected ? 'selected' : ''}`}
            onClick={() => setSelectedDate?.(dateString)}
          >
            <span>{day}</span>
            {count > 0 && <small>{count}</small>}
          </button>
        )
      })}
    </div>
  )
})

function TablesAdmin({ mesas, updateTable, activeReservas }) {
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [selectedTime, setSelectedTime] = useState('19:00')

  const [error, setError] = useState('')

  const toggleMesa = async (mesa) => {
    setError('')
    try {
      await updateTable(mesa.id, mesa.estado === 'Activa' ? 'Mantenimiento' : 'Activa')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="two-column">
      <div className="panel">
        <div className="panel-heading">
          <h2>Gestion de mesas</h2>
          <div className="inline-actions">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <select value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)}>
              {HORARIOS.map((hora) => (
                <option key={hora}>{hora}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="floor-map">
          {mesas.map((mesa) => {
            const occupied = activeReservas.some(
              (reserva) =>
                reserva.fecha === selectedDate &&
                reserva.hora === selectedTime &&
                reserva.mesa === mesa.id,
            )
            return (
              <TableButton key={mesa.id} mesa={mesa} occupied={occupied} onToggle={toggleMesa} />
            )
          })}
        </div>
      </div>

      <aside className="side-note">
        <strong>Resumen</strong>
        <p>{mesas.filter((mesa) => mesa.estado === 'Activa').length} mesas activas</p>
        <p>{mesas.filter((mesa) => mesa.estado === 'Mantenimiento').length} en mantenimiento</p>
        <span>Click sobre una mesa para cambiar su estado.</span>
        {error && <p className="form-error" role="status">{error}</p>}
      </aside>
    </section>
  )
}

// Botón de mesa en el mapa del piso: memorizado por la misma razón que
// ReservationRow, ya que TablesAdmin re-renderiza el mapa completo cada vez
// que cambia la fecha/hora seleccionada en el panel.
const TableButton = memo(function TableButton({ mesa, occupied, onToggle }) {
  return (
    <button
      className={`${occupied ? 'occupied' : ''} ${mesa.estado !== 'Activa' ? 'maintenance' : ''}`}
      onClick={() => onToggle(mesa)}
    >
      <strong>M{mesa.id}</strong>
      <span>{mesa.capacidad}</span>
    </button>
  )
})

function Reports({ reservas, mesas }) {
  const total = reservas.length
  const confirmadas = reservas.filter((reserva) => reserva.estado === 'Confirmada').length
  const canceladas = reservas.filter((reserva) => reserva.estado === 'Cancelada').length
  const ocupacion = Math.round((confirmadas / Math.max(total, 1)) * 100)
  const bars = HORARIOS.map((hora) => ({
    hora,
    total: reservas.filter((reserva) => reserva.hora === hora && reserva.estado !== 'Cancelada').length,
  }))
  const maxBar = Math.max(...bars.map((bar) => bar.total), 1)

  return (
    <div className="dashboard-layout">
      <section className="metrics-grid">
        <Metric label="Reservas totales" value={total} />
        <Metric label="Confirmadas" value={confirmadas} />
        <Metric label="Canceladas" value={canceladas} />
        <Metric label="Conversion" value={`${ocupacion}%`} />
      </section>

      <section className="dashboard-panels">
        <div className="panel report-panel">
          <div className="panel-heading">
            <h2>Reservas por hora</h2>
          </div>
          <div className="bar-chart">
            {bars.map((bar) => (
              <div key={bar.hora}>
                <span style={{ height: `${Math.max((bar.total / maxBar) * 100, 10)}%` }} />
                <small>{bar.hora}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <h2>Mesas por zona</h2>
          </div>
          <div className="stack-list">
            {['Salon', 'Terraza', 'Privado', 'Patio'].map((zona) => (
              <article key={zona} className="compact-row">
                <strong>{zona}</strong>
                <span>{mesas.filter((mesa) => mesa.zona === zona).length} mesas</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Settings() {
  const [settings, setSettings] = useState({
    nombre: 'IntiKilla',
    direccion: 'Av. El Sol 128, Cusco',
    telefono: '(084) 555-010',
    email: 'reservas@intikilla.pe',
    apertura: '12:00',
    cierre: '22:00',
  })
  const [saved, setSaved] = useState(false)

  const updateSettings = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  return (
    <section className="two-column">
      <form
        className="panel reservation-editor"
        onSubmit={(event) => {
          event.preventDefault()
          setSaved(true)
        }}
      >
        <div className="panel-heading">
          <h2>Configuracion</h2>
        </div>
        {Object.entries(settings).map(([key, value]) => (
          <label key={key}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
            <input value={value} onChange={(event) => updateSettings(key, event.target.value)} />
          </label>
        ))}
        {saved && <p className="form-ok">Configuracion guardada en esta sesion.</p>}
        <button className="dark-action" type="submit">
          Guardar cambios
        </button>
      </form>

      <aside className="side-note">
        <strong>Reglas mock</strong>
        <p>Tiempo por reserva: 90 minutos</p>
        <p>Capacidad maxima: 40 personas</p>
        <span>Datos editables solo en memoria local.</span>
      </aside>
    </section>
  )
}

export default App
