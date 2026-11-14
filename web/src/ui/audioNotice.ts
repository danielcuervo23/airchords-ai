/**
 * iOS keeps an AudioContext 'suspended' until a user gesture resumes it, and moves it to
 * 'interrupted' (or back to 'suspended') during a phone call. Any state other than 'running'
 * means no sound, so the instrument asks for a tap. 'closed' means the session ended.
 */
export function audioNotice(state: string): string | null {
  return state === 'running' || state === 'closed' ? null : 'Toca para activar el sonido';
}
