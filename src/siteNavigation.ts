/**
 * Navegação do HäxBag com a History API nativa.
 * Usa query params hb_* para manter links existentes (convites, OAuth e âncoras).
 * Nenhuma navegação exige atualizar a página ou instalar um roteador externo.
 */
export const HAX_PAGES = [
  'overview', 'player-table', 'sheets', 'campaigns', 'customization',
  'shops', 'master-shield', 'master-chest', 'missions', 'investigation',
  'bestiary', 'enemies', 'profile', 'conditions', 'dice-tower', 'minigames',
] as const
export type HaxPage = typeof HAX_PAGES[number]

export const HAX_PROFILE_SECTIONS = ['overview', 'journey', 'studio', 'legacy', 'friends', 'account'] as const
export type HaxProfileSection = typeof HAX_PROFILE_SECTIONS[number]

export const HAX_SOCIAL_TABS = ['feed', 'friends', 'following', 'followers', 'discover', 'messages', 'blocked', 'referral', 'communities', 'saved', 'events', 'notifications', 'activity', 'moderation', 'administration', 'showcase', 'tablefinder', 'trends', 'insights', 'security', 'characternews'] as const
export type HaxSocialTab = typeof HAX_SOCIAL_TABS[number]

export type HaxLocation = {
  page: HaxPage
  section: HaxProfileSection
  tab: HaxSocialTab
  campaign: string
  season: string
  character: string
  sheet: boolean
  enemy: string
  enemySheet: boolean
}

const PARAMS = {
  page: 'hb_page', section: 'hb_section', tab: 'hb_tab',
  campaign: 'hb_campaign', season: 'hb_season', character: 'hb_character',
  sheet: 'hb_sheet', enemy: 'hb_enemy', enemySheet: 'hb_enemy_sheet',
} as const
const allowed = <T extends string>(value: string | null, values: readonly T[], fallback: T): T =>
  values.find(item => item === value) ?? fallback

export function readHaxLocation(search: string): HaxLocation {
  const params = new URLSearchParams(search)
  const page = allowed(params.get(PARAMS.page), HAX_PAGES, 'overview')
  return {
    page,
    section: allowed(params.get(PARAMS.section), HAX_PROFILE_SECTIONS, 'overview'),
    tab: allowed(params.get(PARAMS.tab), HAX_SOCIAL_TABS, 'feed'),
    campaign: params.get(PARAMS.campaign) ?? '',
    season: params.get(PARAMS.season) ?? '',
    character: params.get(PARAMS.character) ?? '',
    sheet: params.get(PARAMS.sheet) === '1',
    enemy: params.get(PARAMS.enemy) ?? '',
    enemySheet: params.get(PARAMS.enemySheet) === '1',
  }
}

/** Retorna URL relativa, sem descartar ?invite=, tokens de cadastro nem #âncoras. */
export function haxLocationUrl(href: string, location: HaxLocation): string {
  const url = new URL(href)
  Object.values(PARAMS).forEach(param => url.searchParams.delete(param))
  url.searchParams.set(PARAMS.page, location.page)
  if (location.page === 'profile') {
    url.searchParams.set(PARAMS.section, location.section)
    if (location.section === 'friends') url.searchParams.set(PARAMS.tab, location.tab)
  }
  if (location.campaign) url.searchParams.set(PARAMS.campaign, location.campaign)
  if (location.season) url.searchParams.set(PARAMS.season, location.season)
  if (location.page === 'sheets' && location.sheet && location.character) {
    url.searchParams.set(PARAMS.character, location.character)
    url.searchParams.set(PARAMS.sheet, '1')
  }
  if (location.page === 'enemies' && location.enemySheet && location.enemy) {
    url.searchParams.set(PARAMS.enemy, location.enemy)
    url.searchParams.set(PARAMS.enemySheet, '1')
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/** Só ações de navegação criam etapas; seleção automática inicial substitui a URL. */
export function haxShouldPush(previous: HaxLocation, next: HaxLocation): boolean {
  if (previous.page !== next.page) return true
  if (next.page === 'profile') {
    if (previous.section !== next.section) return true
    if (next.section === 'friends' && previous.tab !== next.tab) return true
  }
  if (previous.campaign && next.campaign && previous.campaign !== next.campaign) return true
  if (previous.season && next.season && previous.season !== next.season && previous.campaign === next.campaign) return true
  if (next.page === 'sheets' && previous.sheet !== next.sheet) return true
  if (next.page === 'sheets' && next.sheet && previous.character && next.character && previous.character !== next.character && previous.campaign === next.campaign) return true
  if (next.page === 'enemies' && previous.enemySheet !== next.enemySheet) return true
  if (next.page === 'enemies' && next.enemySheet && previous.enemy && next.enemy && previous.enemy !== next.enemy && previous.campaign === next.campaign) return true
  return false
}
