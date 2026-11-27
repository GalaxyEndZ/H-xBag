/** Detecta exclusivamente o runtime nativo Capacitor, sem afetar o site ou o Electron. */
type CapacitorBridge = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

export function isHaxbagMobileNative(): boolean {
  if (typeof window === 'undefined') return false
  const bridge = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
  if (!bridge?.isNativePlatform?.()) return false
  const platform = bridge.getPlatform?.()
  return platform === 'android' || platform === 'ios'
}

/** Executar antes da montagem do React para evitar que o layout pisque. */
export function initializeHaxbagMobile(): void {
  if (!isHaxbagMobileNative()) return
  document.documentElement.classList.add('hb-native-mobile')
  document.body.classList.add('hb-native-mobile')
  document.documentElement.dataset.haxbagRuntime = 'mobile'
}
