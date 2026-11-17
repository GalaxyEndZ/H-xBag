/** Personalização exclusivamente local à página de Perfil.
 * A paleta da temporada não é alterada nem salva por este módulo.
 */
export type ProfileAppearance = {
  accent: string
  frame: 'classic' | 'gold' | 'arcane' | 'shadow'
  layout: 'classic' | 'compact' | 'gallery'
}

export const defaultProfileAppearance: ProfileAppearance = {
  accent: '#d9bd8b', frame: 'classic', layout: 'classic',
}

export const profileFrameNames: Record<ProfileAppearance['frame'], string> = {
  classic: 'Clássica', gold: 'Dourada', arcane: 'Arcana', shadow: 'Sombria',
}

const hexRgb = (hex: string): [number,number,number] => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  const value = match ? match[1] : 'd9bd8b'
  return [0,2,4].map(index => parseInt(value.slice(index, index + 2),16)) as [number,number,number]
}
const rgbHex = (rgb: [number,number,number]) => `#${rgb.map(n => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('')}`
const mix = (from: [number,number,number], to: [number,number,number], amount: number): [number,number,number] =>
  from.map((n,index) => n*(1-amount) + to[index]*amount) as [number,number,number]
const luminance = (rgb: [number,number,number]) => {
  const channels = rgb.map(value => {
    const s = value/255
    return s <= 0.04045 ? s / 12.92 : ((s+0.055)/1.055)**2.4
  })
  return .2126*channels[0] + .7152*channels[1] + .0722*channels[2]
}

/** Cores legíveis para o tema escuro, mesmo que a pessoa selecione um tom muito escuro. */
export function profileThemePalette(input: ProfileAppearance) {
  const requested = hexRgb(input.accent)
  let primary = requested
  for (let n=0; n<8 && luminance(primary)<.30; n++) primary=mix(primary,[244,243,235],.18)
  const dark:[number,number,number] = [10,13,19]
  const surface:[number,number,number] = [20,24,31]
  const primaryHex=rgbHex(primary)
  return {
    primary:primaryHex,
    secondary:rgbHex(mix(primary,dark,.44)),
    glow:`rgba(${primary.map(Math.round).join(',')},.25)`,
    bg:rgbHex(mix(dark,primary,.045)),
    surface:rgbHex(mix(surface,primary,.070)),
    surfaceAlt:rgbHex(mix([29,35,44],primary,.13)),
    line:rgbHex(mix([49,55,65],primary,.19)),
    onPrimary:'#12151a',
  }
}
