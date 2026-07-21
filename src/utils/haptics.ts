/**
 * Triggers haptic vibration feedback if supported by the client device.
 * @param pattern duration in ms or pattern array (e.g. 50, [50, 50, 50])
 */
export function triggerHapticFeedback(pattern: number | number[] = 50): void {
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors (e.g. user gesture permissions)
    }
  }
}
