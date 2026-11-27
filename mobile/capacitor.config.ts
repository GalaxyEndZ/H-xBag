import type { CapacitorConfig } from '@capacitor/cli'

// Identificador provisório: escolha o ID definitivo ANTES da publicação na loja.
const config: CapacitorConfig = {
  appId: 'com.haxbag.mobile',
  appName: 'HäxBag',
  webDir: '../dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
