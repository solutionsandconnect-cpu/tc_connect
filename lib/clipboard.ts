// Copie de texte robuste, compatible iOS Safari et contextes non-HTTPS.
// navigator.clipboard n'existe qu'en contexte sécurisé (HTTPS ou localhost) —
// sur une IP locale en http:// (test mobile), il faut un fallback execCommand.
export async function copyText(text: string): Promise<boolean> {
  // 1. API moderne (HTTPS / localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // on bascule sur le fallback
    }
  }

  // 2. Fallback : textarea temporaire + execCommand('copy')
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)

    // iOS exige une sélection explicite via un Range
    const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent)
    if (isIOS) {
      const range = document.createRange()
      range.selectNodeContents(textarea)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      textarea.setSelectionRange(0, text.length)
    } else {
      textarea.select()
    }

    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
