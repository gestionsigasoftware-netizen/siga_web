import { Component } from 'react'
import { logClientError } from '../lib/errorLogging'
import { sentryCaptureException } from '../lib/sentry'

// Sin esto, un error de render en cualquier pantalla dejaba a un
// pastor real viendo una pagina en blanco, sin ningun mensaje ni forma
// de recuperarse salvo adivinar que debia recargar.
export default class ErrorBoundary extends Component {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error, info) {
    logClientError(error, 'react-error-boundary')
    sentryCaptureException(error, { componentStack: info?.componentStack })
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="min-h-svh flex items-center justify-center p-6 bg-surface">
        <div className="card max-w-sm w-full text-center p-8">
          <h1 className="font-semibold text-lg">Algo salió mal</h1>
          <p className="text-sm text-secondary mt-2">
            SIGAP encontró un error inesperado. Ya quedó registrado para
            revisión. Intenta recargar la página.
          </p>
          <button type="button" className="btn-primary justify-center mt-5 w-full" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
