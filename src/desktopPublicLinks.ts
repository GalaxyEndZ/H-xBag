/** Compartilhamentos saem sempre pelo site HTTPS, não pelo protocolo local do Electron. */
export function publicHaxbagLink(values: Record<string, string>): string {
  let url: URL
  if (window.location.protocol === 'haxbag:') {
    const configured = String(import.meta.env.VITE_HAXBAG_PUBLIC_URL || '').trim()
    if (!configured) return ''
    try {
      url = new URL(configured)
      if (url.protocol !== 'https:') return ''
    } catch { return '' }
  } else {
    url = new URL(window.location.href)
  }
  url.search = ''
  url.hash = ''
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value)
  return url.toString()
}
export const DESKTOP_PUBLIC_URL_HELP = 'Para compartilhar convites pelo aplicativo, configure VITE_HAXBAG_PUBLIC_URL com o endereço HTTPS do site e gere o aplicativo novamente.'
