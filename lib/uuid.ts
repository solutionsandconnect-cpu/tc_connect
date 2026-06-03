// Génère un identifiant unique compatible avec tous les navigateurs (mobiles inclus).
// `crypto.randomUUID()` n'existe pas sur certains navigateurs mobiles ou en contexte
// non sécurisé (HTTP) — on prévoit donc des solutions de repli.
export function randomUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      // UUID v4 généré à partir de getRandomValues
      const bytes = crypto.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {
    /* ignore et bascule sur le repli ci-dessous */
  }
  // Dernier recours (toujours unique en pratique)
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}
