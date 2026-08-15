import React from 'react'

// ErrorBoundary: captura errores de renderizado inesperados en cualquier
// parte del árbol de componentes y evita que toda la aplicación se rompa.
// Forma parte de la estrategia de mantenimiento/monitoreo continuo:
// aquí es donde en producción se conectaría un servicio externo
// (Sentry, LogRocket, etc.) para reportar el error automáticamente.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Punto único de registro de errores de UI. Se deja en consola para
    // depuración local; en un entorno real se enviaría a un servicio de
    // monitoreo (ej. Sentry.captureException(error, { extra: errorInfo })).
    console.error('IntiKilla - error no controlado en la interfaz:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h1>Ocurrió un problema inesperado</h1>
          <p>
            La aplicación encontró un error y no pudo continuar con esta vista.
            Puedes intentar recargar la sección.
          </p>
          <button className="dark-action" onClick={this.handleReset}>
            Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
