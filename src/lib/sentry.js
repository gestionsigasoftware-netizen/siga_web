import * as Sentry from '@sentry/react'

// Queda apagado hasta que exista VITE_SENTRY_DSN -- para activarlo no
// hace falta tocar codigo: solo crear la cuenta en sentry.io, tomar el
// DSN del proyecto y agregarlo como variable de entorno en Cloudflare
// (ver docs/fixes/monitoreo-errores-frontend-2026-09-11.md).
const dsn = import.meta.env.VITE_SENTRY_DSN

export function inicializarSentry() {
  if (!dsn) return
  Sentry.init({ dsn, tracesSampleRate: 0 })
}

export function sentryCaptureException(error, extra) {
  if (!dsn) return
  Sentry.captureException(error, extra ? { extra } : undefined)
}
