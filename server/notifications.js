// Integración con la API externa de Resend (https://resend.com) para enviar
// el correo de confirmación cuando se registra una reserva. Se llama por
// HTTP directamente con fetch (Node 20+ ya lo trae nativo), sin librerías
// adicionales.
//
// Requiere las variables de entorno RESEND_API_KEY y NOTIFICATIONS_FROM_EMAIL
// (ver .env.example). Si no están configuradas, la reserva se sigue
// registrando con normalidad: el envío de correo nunca bloquea ni revierte
// la operación principal, solo se registra en consola.

const RESEND_API_URL = 'https://api.resend.com/emails'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ))
}

function buildEmailHtml(reservation) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color:#222;">
      <h2 style="color:#7a1f2b; margin-bottom: 4px;">Reserva confirmada</h2>
      <p>Hola ${escapeHtml(reservation.cliente)},</p>
      <p>Tu reserva en <strong>IntiKilla</strong> quedó registrada con estos datos:</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding:4px 0;"><strong>Fecha</strong></td><td>${escapeHtml(reservation.fecha)}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Hora</strong></td><td>${escapeHtml(reservation.hora)}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Mesa</strong></td><td>Mesa ${escapeHtml(String(reservation.mesa))}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Personas</strong></td><td>${escapeHtml(String(reservation.personas))}</td></tr>
      </table>
      <p style="margin-top:16px;">Te esperamos. Si necesitas modificar o cancelar tu reserva, responde este correo o comunícate con el restaurante.</p>
      <p style="color:#888; font-size:12px;">IntiKilla Reservas — notificación automática.</p>
    </div>
  `
}

/**
 * Envía el correo de confirmación de una reserva a través de la API de Resend.
 * Nunca lanza: siempre resuelve con { sent: boolean, reason?: string } para
 * que quien la llame decida qué hacer sin arriesgar la transacción principal.
 */
export async function sendConfirmationEmail(reservation) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.NOTIFICATIONS_FROM_EMAIL

  if (!apiKey || !fromEmail) {
    console.warn('Notificaciones: RESEND_API_KEY/NOTIFICATIONS_FROM_EMAIL no configuradas, se omite el envio de correo.')
    return { sent: false, reason: 'not_configured' }
  }
  if (!reservation.email) {
    return { sent: false, reason: 'missing_recipient' }
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: reservation.email,
        subject: 'Confirmación de tu reserva en IntiKilla',
        html: buildEmailHtml(reservation),
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      console.error('Resend respondio con error:', response.status, body)
      return { sent: false, reason: 'api_error' }
    }

    return { sent: true }
  } catch (error) {
    console.error('No se pudo enviar el correo de confirmacion:', error.message)
    return { sent: false, reason: 'network_error' }
  }
}
