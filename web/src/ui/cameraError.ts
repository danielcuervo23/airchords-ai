/** Turns a getUserMedia failure (or 'unsupported') into a plain Spanish message. Never empty. */
export function cameraErrorMessage(err: unknown): string {
  if (err === 'unsupported') {
    return 'Este navegador no puede usar la cámara. Prueba con Chrome, Edge, Firefox o Safari actualizados, y abre la página con https.';
  }
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'No tenemos permiso para usar la cámara. Toca el ícono de la cámara junto a la dirección de la página, elige «Permitir» y pulsa Reintentar.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No encontramos ninguna cámara en este dispositivo. Conecta una y pulsa Reintentar.';
    case 'NotReadableError':
    case 'AbortError':
      return 'La cámara está ocupada. Cierra la otra app o pestaña que la esté usando (por ejemplo, una videollamada) y pulsa Reintentar.';
    default:
      return 'No pudimos encender la cámara. Revisa que esté conectada y pulsa Reintentar.';
  }
}
