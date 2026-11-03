/**
 * Temas de temporada do HäxBag.
 *
 * Para adicionar um tema comum:
 * 1. Copie um dos objetos abaixo.
 * 2. Dê a ele uma chave única (ex.: bosque_sombrio).
 * 3. Altere label e as cores.
 *
 * Os estilos gerais em seasonThemes.css usam estas variáveis automaticamente.
 * Só adicione CSS específico quando o tema precisar de efeitos exclusivos.
 */

export type SeasonTheme = {
  label: string
  primary: string
  secondary: string
  glow: string
  bg: string
  surface: string
  surfaceAlt: string
  line: string
  onPrimary: string
}

export const seasonThemes = {
  default: {
    label: 'Padrão HäxBag',
    primary: '#c8b5ff',
    secondary: '#7958cf',
    glow: 'rgba(190,170,255,.20)',
    bg: '#0e0b17',
    surface: '#181323',
    surfaceAlt: '#251b36',
    line: '#493765',
    onPrimary: '#ffffff',
  },
  crimson: {
    label: 'Lua de Sangue',
    primary: '#ff334f',
    secondary: '#b5122e',
    glow: 'rgba(255,35,65,.22)',
    bg: '#080809',
    surface: '#111114',
    surfaceAlt: '#1b1115',
    line: '#64202e',
    onPrimary: '#ffffff',
  },
  forest: {
    label: 'Floresta Esquecida',
    primary: '#9be8b7',
    secondary: '#397b58',
    glow: 'rgba(139,224,178,.19)',
    bg: '#09130f',
    surface: '#122019',
    surfaceAlt: '#1c3024',
    line: '#3b6249',
    onPrimary: '#ffffff',
  },
  frost: {
    label: 'Inverno Eterno',
    primary: '#b9e8ff',
    secondary: '#4b88b5',
    glow: 'rgba(169,222,248,.20)',
    bg: '#09131d',
    surface: '#121f2c',
    surfaceAlt: '#1b3041',
    line: '#3c617c',
    onPrimary: '#ffffff',
  },
  arcane: {
    label: 'Arcano',
    primary: '#e7c5ff',
    secondary: '#8754c5',
    glow: 'rgba(223,184,255,.20)',
    bg: '#120b1b',
    surface: '#1c1428',
    surfaceAlt: '#2b1c40',
    line: '#5a3d78',
    onPrimary: '#ffffff',
  },
  ghost_vale: {
    label: 'Vale Fantasma',
    primary: '#ffc078',
    secondary: '#c85d27',
    glow: 'rgba(255,158,75,.19)',
    bg: '#080a0d',
    surface: '#11161b',
    surfaceAlt: '#1b252d',
    line: '#46535d',
    onPrimary: '#ffffff',
  },
  crimson_vale: {
    label: 'Vale Carmesim',
    primary: '#ff5268',
    secondary: '#a91f38',
    glow: 'rgba(255,55,85,.20)',
    bg: '#09090c',
    surface: '#151216',
    surfaceAlt: '#24151c',
    line: '#653044',
    onPrimary: '#ffffff',
  },
  celestial_sands: {
    label: 'Areias Celestes',
    primary: '#5865F2',
    secondary: '#7289DA',
    glow: 'rgba(88, 101, 242, 0.28)',
    bg: '#1E1F22',
    surface: '#2B2D31',
    surfaceAlt: '#313338',
    line: '#404249',
    onPrimary: '#ffffff',
  },

  /*
   * MODELO PARA NOVOS TEMAS
   *
   * bosque_sombrio: {
   *   label: 'Bosque Sombrio',
   *   primary: '#78b88a',
   *   secondary: '#315c40',
   *   glow: 'rgba(120,184,138,.20)',
   *   bg: '#0b120e',
   *   surface: '#142019',
   *   surfaceAlt: '#1d3024',
   *   line: '#385744',
   *   onPrimary: '#ffffff',
   * },
   */
} satisfies Record<string, SeasonTheme>

export type SeasonThemeKey = keyof typeof seasonThemes
