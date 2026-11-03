
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Auth from './Auth'
import './App.css'
import {
  KISATSUTAI_FAMILY_TIERS,
  KISATSUTAI_RANKS,
  KISATSUTAI_ARCHETYPES,
  KISATSUTAI_RANK_STATUS,
  KISATSUTAI_PROMOTIONS,
} from './systems/kisatsutai/data'

type Campaign = {
  id: string
  name: string
  description: string | null
  system_name: string | null
  currency_config: {
  currencies: {
    id: string
    name: string
    symbol: string
    conversionRate: number
  }[]
} | null
  created_by: string
  role: string
}

type Character = {
  id: string
  campaign_id: string
  user_id: string
  name: string
  emoji?: string | null
  archetype: string | null
  level: number
  strength: number
  visibility: 'private' | 'campaign' | 'selected'
  current_player_id: string | null
  created_at: string
}

type CampaignMember = {
  user_id: string
  role: string
  display_name: string
}

type CharacterGrant = {
  user_id: string
}

type Season = { id: string; campaign_id: string; name: string; description: string | null; season_number: number; status: 'draft' | 'active' | 'completed' | 'archived'; theme_key?: string | null }
type CharacterSheet = { id: string; character_id: string; season_id: string; sheet_data: Record<string, unknown> }
type Item = {
  id: string
  character_id: string
  name: string
  description: string | null
  category: string
  quantity: number
  weight: number
  unit_price: number
  currency_id: string | null
  metadata: Record<string, unknown> | null
  sale_blocked: boolean
}

type CampaignShop = {
  id: string
  campaign_id: string
  name: string
  description: string | null
  is_visible: boolean
}

type CampaignShopItem = {
  id: string
  shop_id: string
  name: string
  description: string | null
  category: string
  weight: number
  unit_price: number
  currency_id: string | null
  quantity: number | null
  metadata: Record<string, unknown> | null
  purchase_blocked: boolean
}

function displayNameForMembers(session: Session | null) {
  return session?.user.user_metadata?.display_name ||
    session?.user.email?.split('@')[0] ||
    'Você'
}

type CurrencyTransaction = {
  id: string
  character_id: string
  campaign_id: string
  currency_id: string
  amount_delta: number
  balance_after: number
  description: string | null
  created_by: string | null
  created_at: string
}


const categories = [
  'Todos',
  'Armas',
  'Equipamento',
  'Consumíveis',
  'Tesouros',
  'Diversos',
]

const availableEmojis = [
  '📦', '⚔️', '🗡️', '🏹', '🛡️', '🪄',
  '🧪', '🧴', '🍖', '🍷', '🧀', '🧭',
  '🔑', '📜', '📕', '💎', '💰', '🪙',
  '💍', '👑', '🪶', '🪓', '🔨', '⛏️',
  '🔥', '❄️', '🌿', '💀', '🐉', '✨',
  '🦑', '🐦‍⬛',
]

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedCampaignId,
  )
  const isMaster = selectedCampaign?.role === 'master'
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null)
  const [campaignMembers, setCampaignMembers] = useState<CampaignMember[]>([])
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null)
  const [characterGrants, setCharacterGrants] = useState<CharacterGrant[]>([])
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [currencyBalances, setCurrencyBalances] = useState<Record<string, number>>({})
  const [currencyAmount, setCurrencyAmount] = useState('')
  const [currencyDescription, setCurrencyDescription] = useState('')
  const [currencyActionLoading, setCurrencyActionLoading] = useState(false)
  const [currencyLoading, setCurrencyLoading] = useState(false)
  const [showCurrencyHistory, setShowCurrencyHistory] = useState(false)
  const [currencyTransactions, setCurrencyTransactions] = useState<CurrencyTransaction[]>([])
  const [currencyHistoryLoading, setCurrencyHistoryLoading] = useState(false)
  const [currencyDraftName, setCurrencyDraftName] = useState('')
  const [currencyDraftSymbol, setCurrencyDraftSymbol] = useState('')
  const [currencyDraftRate, setCurrencyDraftRate] = useState('1')
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null)
  const [currencyConfigSaving, setCurrencyConfigSaving] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [selectedItemDetails, setSelectedItemDetails] = useState<Item | null>(null)
  const [saleQuantity, setSaleQuantity] = useState('1')
  const [shopSaleQuantities, setShopSaleQuantities] = useState<Record<string, string>>({})
  const [saleShopId, setSaleShopId] = useState('')
  const [saleLoading, setSaleLoading] = useState(false)
  const [shops, setShops] = useState<CampaignShop[]>([])
  const [shopItems, setShopItems] = useState<CampaignShopItem[]>([])
  const [selectedShopId, setSelectedShopId] = useState('')
  const [shopPurchaseCharacterId, setShopPurchaseCharacterId] = useState('')
  const [shopPurchaseQuantities, setShopPurchaseQuantities] = useState<Record<string, string>>({})

  const [showShopForm, setShowShopForm] = useState(false)
  const [editingShopId, setEditingShopId] = useState<string | null>(null)
  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')

  const [showShopItemForm, setShowShopItemForm] = useState(false)
  const [editingShopItemId, setEditingShopItemId] = useState<string | null>(null)
  const [shopItemName, setShopItemName] = useState('')
  const [shopItemDescription, setShopItemDescription] = useState('')
  const [shopItemCategory, setShopItemCategory] = useState('Diversos')
  const [shopItemRarity, setShopItemRarity] = useState('comum')
  const [shopItemWeight, setShopItemWeight] = useState('0')
  const [shopItemPrice, setShopItemPrice] = useState('0')
  const [shopItemCurrencyId, setShopItemCurrencyId] = useState('')
  const [shopItemStock, setShopItemStock] = useState('')
  const [shopItemEmoji, setShopItemEmoji] = useState('📦')
  const [shopItemCategories, setShopItemCategories] = useState<string[]>(['Diversos'])
  const [shopItemEquipmentType, setShopItemEquipmentType] = useState<'none' | 'armor' | 'protection'>('none')
  const [shopItemArmorClass, setShopItemArmorClass] = useState<'leve' | 'media' | 'pesada'>('leve')
  const [shopItemArmorCoverage, setShopItemArmorCoverage] = useState<'cortante_perfurante' | 'especial_bruto' | 'todos'>('cortante_perfurante')
  const [shopItemProtectionTier, setShopItemProtectionTier] = useState<'basica' | 'moderada' | 'avancada'>('basica')
  const [shopItemProtectionMode, setShopItemProtectionMode] = useState<'resistencia' | 'sanidade'>('resistencia')
  const [shopItemWeaponClass, setShopItemWeaponClass] = useState('improvised')
  const [shopItemScarcityLevel, setShopItemScarcityLevel] = useState<'1' | '2' | '3' | '4'>('1')
  const [shopItemScarcityExhausted, setShopItemScarcityExhausted] = useState(false)

  const [shopLoading, setShopLoading] = useState(false)
  const [shopPurchaseLoading, setShopPurchaseLoading] = useState<string | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [masterShieldSeasonId, setMasterShieldSeasonId] = useState('')
  const [masterShieldSheets, setMasterShieldSheets] = useState<Record<string, Record<string, any>>>({})
  const [, setMasterShieldGrantRows] = useState<Array<{ character_id: string; user_id: string }>>([])
  const [masterShieldLoading, setMasterShieldLoading] = useState(false)
  const [seasonNameDraft, setSeasonNameDraft] = useState('')
  const [seasonDescriptionDraft, setSeasonDescriptionDraft] = useState('')
  const [seasonThemeSaving, setSeasonThemeSaving] = useState(false)
  const seasonThemes = {
    default: { label: 'Padrão HäxBag', primary: '#c8b5ff', secondary: '#7958cf', glow: 'rgba(190,170,255,.20)', bg: '#0e0b17', surface: '#181323', surfaceAlt: '#251b36', line: '#493765', onPrimary: '#ffffff' },
    crimson: { label: 'Lua de Sangue', primary: '#ff334f', secondary: '#b5122e', glow: 'rgba(255,35,65,.22)', bg: '#080809', surface: '#111114', surfaceAlt: '#1b1115', line: '#64202e', onPrimary: '#ffffff' },
    forest: { label: 'Floresta Esquecida', primary: '#9be8b7', secondary: '#397b58', glow: 'rgba(139,224,178,.19)', bg: '#09130f', surface: '#122019', surfaceAlt: '#1c3024', line: '#3b6249', onPrimary: '#ffffff' },
    frost: { label: 'Inverno Eterno', primary: '#b9e8ff', secondary: '#4b88b5', glow: 'rgba(169,222,248,.20)', bg: '#09131d', surface: '#121f2c', surfaceAlt: '#1b3041', line: '#3c617c', onPrimary: '#ffffff' },
    arcane: { label: 'Arcano', primary: '#e7c5ff', secondary: '#8754c5', glow: 'rgba(223,184,255,.20)', bg: '#120b1b', surface: '#1c1428', surfaceAlt: '#2b1c40', line: '#5a3d78', onPrimary: '#ffffff' },
    ghost_vale: { label: 'Vale Fantasma', primary: '#ffc078', secondary: '#c85d27', glow: 'rgba(255,158,75,.19)', bg: '#080a0d', surface: '#11161b', surfaceAlt: '#1b252d', line: '#46535d', onPrimary: '#ffffff' },
    crimson_vale: { label: 'Vale Carmesim', primary: '#ff5268', secondary: '#a91f38', glow: 'rgba(255,55,85,.20)', bg: '#09090c', surface: '#151216', surfaceAlt: '#24151c', line: '#653044', onPrimary: '#ffffff' },
    celestial_sands: { label: 'Areias Celestes', primary: '#5865F2', secondary: '#7289DA', glow: 'rgba(88, 101, 242, 0.28)', bg: '#1E1F22', surface: '#2B2D31', surfaceAlt: '#313338', line: '#404249', onPrimary: '#ffffff' },
  } as const
  const activeSeason = seasons.find(entry => entry.id === selectedSeasonId)
  const activeThemeKey = activeSeason?.theme_key && activeSeason.theme_key in seasonThemes ? activeSeason.theme_key as keyof typeof seasonThemes : 'default'
  const activeTheme = seasonThemes[activeThemeKey]

  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonDescription, setNewSeasonDescription] = useState('')
  const [sheet, setSheet] = useState<CharacterSheet | null>(null)
  const [sheetDraft, setSheetDraft] = useState('{}')
  const [statusAdjustments, setStatusAdjustments] = useState<Record<string, string>>({ pv: '+10', ps: '+10', pr: '+10' })
  const [breathingTestResult, setBreathingTestResult] = useState<{ rolls: number[]; best: number; total: number; dt: number; success: boolean; recovery: number; applied: number; group: string } | null>(null)
  const [combatActionResult, setCombatActionResult] = useState<string>('')
  const [blockDamageReduction, setBlockDamageReduction] = useState<number | null>(null)
  const [blockIncomingDamage, setBlockIncomingDamage] = useState('')
  const [physicalDamageType, setPhysicalDamageType] = useState<'cortante_perfurante' | 'especial_bruto'>('cortante_perfurante')
  const [physicalDamageAmount, setPhysicalDamageAmount] = useState('')
  const [sanityDamageAmount, setSanityDamageAmount] = useState('')
  const [dodgeTarget, setDodgeTarget] = useState('')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetSaving, setSheetSaving] = useState(false)
  const [editingSheet, setEditingSheet] = useState(false)

  const [activePage, setActivePage] = useState<
  'sheets' | 'characters' | 'campaigns' | 'shops' | 'master-shield'
>('campaigns')
  const [sheetCharacterView, setSheetCharacterView] = useState(false)

  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [showCharacterForm, setShowCharacterForm] = useState(false)
  const [showCharacterManagement, setShowCharacterManagement] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [copyPreviousSheet] = useState(true);
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [campaignInviteLink, setCampaignInviteLink] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [systemName, setSystemName] = useState('')
  const [campaignSystemChoice, setCampaignSystemChoice] = useState('')

  const [characterName, setCharacterName] = useState('')
  const [characterEmoji, setCharacterEmoji] = useState('⚔️')
  const [characterRanks, setCharacterRanks] = useState<Record<string, string>>({})
  const [archetype, setArchetype] = useState('')
  const [primaryArchetype, setPrimaryArchetype] = useState('')
  const [secondaryArchetype, setSecondaryArchetype] = useState('')
  const [characterRank, setCharacterRank] = useState('zaidan')
  const [characterLevel, setCharacterLevel] = useState('1')

  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemRarity, setNewItemRarity] = useState('comum')
  const [newItemCategory, setNewItemCategory] = useState('Diversos')
  const [newItemCategories, setNewItemCategories] = useState<string[]>(['Diversos'])
  const [newWeaponClass, setNewWeaponClass] = useState('improvised')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemWeight, setNewItemWeight] = useState('0')
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('0')
  const [newItemCurrencyId, setNewItemCurrencyId] = useState('')
  const [newItemEmoji, setNewItemEmoji] = useState('📦')
  const [newEquipmentType, setNewEquipmentType] = useState<'none' | 'armor' | 'protection'>('none')
  const [newArmorClass, setNewArmorClass] = useState<'leve' | 'media' | 'pesada'>('leve')
  const [newArmorCoverage, setNewArmorCoverage] = useState<'cortante_perfurante' | 'especial_bruto' | 'todos'>('cortante_perfurante')
  const [newProtectionTier, setNewProtectionTier] = useState<'basica' | 'moderada' | 'avancada'>('basica')
  const [newProtectionMode, setNewProtectionMode] = useState<'resistencia' | 'sanidade'>('resistencia')
  const [newScarcityLevel, setNewScarcityLevel] = useState<'1' | '2' | '3' | '4'>('1')
  const [newScarcityExhausted, setNewScarcityExhausted] = useState(false)

  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [emojiPickerItem, setEmojiPickerItem] = useState<Item | null>(null)
  const [emojiPickerCharacter, setEmojiPickerCharacter] = useState<Character | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sortBy, setSortBy] = useState('created')
  const [updatingQuantityItemId, setUpdatingQuantityItemId] = useState<string | null>(null)
  const [usingScarcityItemId, setUsingScarcityItemId] = useState<string | null>(null)

  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) setInviteCode(invite)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error: sessionError } =
        await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user.id) {
      setCampaigns([])
      setCharacters([])
      setItems([])
      setSelectedCampaignId('')
      setSelectedCharacterId('')
      return
    }

    let cancelled = false

    async function loadCampaigns() {
      setLoading(true)
      setError('')

      const { data: memberships, error: membershipError } =
        await supabase
          .from('campaign_members')
          .select('campaign_id, role')
          .eq('user_id', session!.user.id)

      if (cancelled) return

      if (membershipError) {
        setError(`Erro ao carregar campanhas: ${membershipError.message}`)
        setLoading(false)
        return
      }

      if (!memberships?.length) {
        setCampaigns([])
        setCharacters([])
        setItems([])
        setSelectedCampaignId('')
        setSelectedCharacterId('')
        setLoading(false)
        return
      }

      const ids = memberships.map((member) => member.campaign_id)

      const { data, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, name, description, system_name, currency_config, created_by')
        .in('id', ids)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (campaignError) {
        setError(`Erro ao carregar campanhas: ${campaignError.message}`)
        setLoading(false)
        return
      }

      const result: Campaign[] = (data ?? []).map((campaign) => ({
        ...campaign,
        role:
          memberships.find((member) => member.campaign_id === campaign.id)
            ?.role ?? 'player',
      }))

      setCampaigns(result)

      const preferredCampaignId = typeof session!.user.user_metadata?.primary_campaign_id === 'string'
        ? session!.user.user_metadata.primary_campaign_id
        : ''
      setSelectedCampaignId((current) =>
        result.some((campaign) => campaign.id === current)
          ? current
          : result.some((campaign) => campaign.id === preferredCampaignId)
            ? preferredCampaignId
            : result[0]?.id ?? '',
      )

      setLoading(false)
    }

    void loadCampaigns()

    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  useEffect(() => {
    if (!selectedCampaignId) { setSeasons([]); setSelectedSeasonId(''); return }
    let cancelled = false
    async function loadSeasons() {
      const { data, error: seasonsError } = await supabase.from('campaign_seasons').select('id,campaign_id,name,description,season_number,status,theme_key').eq('campaign_id', selectedCampaignId).order('season_number', { ascending: true })
      if (cancelled) return
      if (seasonsError) { setError(`Erro ao carregar temporadas: ${seasonsError.message}`); setSeasons([]); setSelectedSeasonId(''); return }
      const rows = (data ?? []) as Season[]
      setSeasons(rows)
      setSelectedSeasonId(current => rows.some(row => row.id === current) ? current : (rows.find(row => row.status === 'active')?.id ?? rows[0]?.id ?? ''))
    }
    void loadSeasons()
    return () => { cancelled = true }
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId || !masterShieldSeasonId || !characters.length) { setMasterShieldSheets({}); setMasterShieldGrantRows([]); return }
    let cancelled = false
    async function loadMasterShieldSheets() {
      setMasterShieldLoading(true)
      const ids = characters.map(character => character.id)
      const [{ data, error: loadError }, { data: grants, error: grantsError }] = await Promise.all([
        supabase.from('character_sheets').select('character_id,sheet_data').eq('season_id', masterShieldSeasonId).in('character_id', ids),
        supabase.from('character_visibility').select('character_id,user_id').in('character_id', ids),
      ])
      if (cancelled) return
      if (loadError || grantsError) { setError(`Erro ao carregar dados do Escudo do mestre: ${(loadError || grantsError)?.message}`); setMasterShieldSheets({}); setMasterShieldGrantRows([]) }
      else {
        const result: Record<string, Record<string, any>> = {}
        for (const row of data ?? []) result[row.character_id] = (row.sheet_data ?? {}) as Record<string, any>
        setMasterShieldSheets(result)
        setMasterShieldGrantRows((grants ?? []) as Array<{ character_id: string; user_id: string }>)
      }
      setMasterShieldLoading(false)
    }
    void loadMasterShieldSheets()
    const channel = supabase
      .channel(`master-shield-${masterShieldSeasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_sheets', filter: `season_id=eq.${masterShieldSeasonId}` }, payload => {
        const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as { character_id?: string; sheet_data?: Record<string, any> } | undefined
        if (row?.character_id && payload.eventType !== 'DELETE' && row.sheet_data) {
          setMasterShieldSheets(current => ({ ...current, [row.character_id!]: row.sheet_data! }))
        }
        if (payload.eventType === 'DELETE' && row?.character_id) {
          setMasterShieldSheets(current => { const next = { ...current }; delete next[row.character_id!]; return next })
        }
        // Reconsulta para manter o painel consistente também em inclusões e alterações de participação.
        void loadMasterShieldSheets()
      })
      .subscribe()
    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [selectedCampaignId, masterShieldSeasonId, characters])

  useEffect(() => {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    setSeasonNameDraft(season?.name ?? '')
    setSeasonDescriptionDraft(season?.description ?? '')
  }, [selectedSeasonId, seasons])

useEffect(() => {
  if (!selectedCampaignId) {
    setShops([])
    setShopItems([])
    setSelectedShopId('')
    return
  }

  let cancelled = false

  async function loadShops() {
    setShopLoading(true)

    const { data: shopData, error: shopError } = await supabase
      .from('campaign_shops')
      .select('id, campaign_id, name, description, is_visible')
      .eq('campaign_id', selectedCampaignId)
      .order('created_at', { ascending: true })

    if (cancelled) return

    if (shopError) {
      setError(`Erro ao carregar lojas: ${shopError.message}`)
      setShops([])
      setShopItems([])
      setShopLoading(false)
      return
    }

const loadedShops = (shopData ?? []) as CampaignShop[]

const accessibleShops = isMaster
  ? loadedShops
  : loadedShops.filter(shop => shop.is_visible)

setShops(accessibleShops)

setSelectedShopId(current =>
  accessibleShops.some(shop => shop.id === current)
    ? current
    : accessibleShops[0]?.id ?? ''
)

if (accessibleShops.length === 0) {
      setShopItems([])
      setShopLoading(false)
      return
    }

    const shopIds = accessibleShops.map(shop => shop.id)

    const { data: itemData, error: itemError } = await supabase
      .from('campaign_shop_items')
      .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: true })

    if (cancelled) return

    if (itemError) {
      setError(`Erro ao carregar produtos das lojas: ${itemError.message}`)
      setShopItems([])
    } else {
      setShopItems((itemData ?? []) as CampaignShopItem[])
    }

    setShopLoading(false)
  }

  void loadShops()

  return () => {
    cancelled = true
  }
}, [selectedCampaignId, isMaster])

  useEffect(() => {
    if (!selectedCharacterId || !selectedSeasonId) { setSheet(null); setSheetDraft('{}'); return }
    let cancelled = false
    async function loadSheet() {
      setSheetLoading(true)
      const { data, error: sheetError } = await supabase.from('character_sheets').select('id,character_id,season_id,sheet_data').eq('character_id', selectedCharacterId).eq('season_id', selectedSeasonId).maybeSingle()
      if (cancelled) return
      if (sheetError) { setError(`Erro ao carregar ficha: ${sheetError.message}`); setSheet(null); setSheetDraft('{}') }
      else { const value = (data ?? null) as CharacterSheet | null; setSheet(value); setSheetDraft(JSON.stringify(value?.sheet_data ?? {}, null, 2)) }
      setSheetLoading(false)
    }
    void loadSheet()
    return () => { cancelled = true }
  }, [selectedCharacterId, selectedSeasonId])

  useEffect(() => {
    if (!selectedSeasonId || !characters.length || !String(selectedCampaign?.system_name || '').toLowerCase().includes('kisatsutai')) {
      setCharacterRanks({})
      return
    }
    let cancelled = false
    async function loadCharacterRanks() {
      const ids = characters.map(character => character.id)
      const { data } = await supabase.from('character_sheets').select('character_id,sheet_data').eq('season_id', selectedSeasonId).in('character_id', ids)
      if (cancelled) return
      const ranks: Record<string, string> = {}
      for (const row of data ?? []) {
        const sheetData = (row.sheet_data ?? {}) as Record<string, any>
        const progression = sheetData.progression ?? {}
        ranks[row.character_id] = String(progression.rankName || KISATSUTAI_RANKS.find(rank => rank.id === progression.rankId)?.name || 'Graduação não definida')
      }
      setCharacterRanks(ranks)
    }
    void loadCharacterRanks()
    return () => { cancelled = true }
  }, [selectedSeasonId, selectedCampaign?.system_name, characters])

  useEffect(() => {
    if (!selectedCampaignId) {
      setCharacters([])
      setSelectedCharacterId('')
      setItems([])
      return
    }

    let cancelled = false

    async function loadCharacters() {
      setError('')

      const { data, error: characterError } = await supabase
        .from('characters')
        .select(
          'id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at',
        )
        .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (characterError) {
        setError(`Erro ao carregar personagens: ${characterError.message}`)
        setCharacters([])
        setSelectedCharacterId('')
        setLoading(false)
        return
      }

      const result = (data ?? []) as Character[]
      setCharacters(result)

      setSelectedCharacterId((current) =>
        result.some((character) => character.id === current)
          ? current
          : result[0]?.id ?? '',
      )
    }

    void loadCharacters()

    return () => {
      cancelled = true
    }
  }, [selectedCampaignId])

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignMembers([])
      return
    }

    let cancelled = false

    async function loadCampaignMembers() {
      const { data: memberships, error: membersError } = await supabase
        .from('campaign_members')
        .select('user_id, role')
        .eq('campaign_id', selectedCampaignId)

      if (cancelled) return
      if (membersError) {
        setError(`Erro ao carregar membros da campanha: ${membersError.message}`)
        setCampaignMembers([])
        return
      }

      const userIds = (memberships ?? []).map((member) => member.user_id)
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
        : { data: [], error: null }

      if (cancelled) return
      if (profilesError) {
        setError(`Erro ao carregar nomes dos membros: ${profilesError.message}`)
      }

      setCampaignMembers((memberships ?? []).map((member) => ({
        user_id: member.user_id,
        role: member.role,
        display_name:
          profiles?.find((profile) => profile.id === member.user_id)?.display_name ||
          (member.user_id === session?.user.id ? displayNameForMembers(session) : 'Jogador'),
      })))
    }

    void loadCampaignMembers()
    return () => { cancelled = true }
  }, [selectedCampaignId, session?.user.id])

  useEffect(() => {
    if (!selectedCharacterId || !session?.user?.id) {
      setCharacterGrants([])
      return
    }

    let cancelled = false
    async function loadCharacterGrants() {
      let query = supabase
        .from('character_visibility')
        .select('user_id')
        .eq('character_id', selectedCharacterId)

      // Mestres precisam da lista completa para administrar acessos;
      // jogadores só precisam confirmar a própria concessão.
      if (campaigns.find(campaign => campaign.id === selectedCampaignId)?.role !== 'master') {
        query = query.eq('user_id', session!.user.id)
      }

      const { data, error: grantsError } = await query
      if (cancelled) return
      if (grantsError) {
        setError(`Erro ao carregar permissões do personagem: ${grantsError.message}`)
        setCharacterGrants([])
      } else {
        setCharacterGrants((data ?? []) as CharacterGrant[])
      }
    }
    void loadCharacterGrants()
    return () => { cancelled = true }
  }, [selectedCharacterId, selectedCampaignId, campaigns, session?.user?.id])

  // CARREGAMENTO DA CARTEIRA
  useEffect(() => {
    if (!selectedCharacterId) {
      setCurrencyBalances({})
      setCurrencyLoading(false)
      return
    }

    let cancelled = false

    async function loadCurrencyBalances() {
      setCurrencyLoading(true)

      const { data, error: currencyError } = await supabase.rpc(
        'get_character_currency',
        {
          p_character_id: selectedCharacterId,
        },
      )

      if (cancelled) return

      if (currencyError) {
        setError(`Erro ao carregar carteira: ${currencyError.message}`)
        setCurrencyBalances({})
      } else {
        setCurrencyBalances(
          data && typeof data === 'object'
            ? data as Record<string, number>
            : {},
        )
      }

      setCurrencyLoading(false)
    }

    void loadCurrencyBalances()

    return () => {
      cancelled = true
    }
  }, [selectedCharacterId])

  // CARREGAMENTO DO INVENTÁRIO
  useEffect(() => {
    if (!selectedCharacterId) {
      setItems([])
      setItemsLoading(false)
      return
    }

    let cancelled = false

    async function loadItems() {
      setItemsLoading(true)
      setError('')

      const { data, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
        .eq('character_id', selectedCharacterId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (itemsError) {
        setError(`Erro ao carregar inventário: ${itemsError.message}`)
        setItems([])
      } else {
        setItems((data ?? []) as Item[])
      }

      setItemsLoading(false)
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [selectedCharacterId])

async function saveShop() {
  if (!selectedCampaignId || !shopName.trim() || shopLoading) return

  setShopLoading(true)
  setError('')
  setNotice('')

  const payload = {
    campaign_id: selectedCampaignId,
    name: shopName.trim(),
    description: shopDescription.trim() || null,
  }

  try {
    if (editingShopId) {
      const { data, error: updateError } = await supabase
        .from('campaign_shops')
        .update({
          name: payload.name,
          description: payload.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingShopId)
        .select('id, campaign_id, name, description, is_visible')
        .single()

      if (updateError) throw updateError

      setShops(current =>
        current.map(shop => shop.id === editingShopId
          ? data as CampaignShop
          : shop
        )
      )

      setNotice('Loja atualizada com sucesso!')
    } else {
      const { data, error: insertError } = await supabase
        .from('campaign_shops')
        .insert({
  ...payload,
  is_visible: false,
})
        .select('id, campaign_id, name, description, is_visible')
        .single()

      if (insertError) throw insertError

      const newShop = data as CampaignShop
      setShops(current => [...current, newShop])
      setSelectedShopId(newShop.id)
      setNotice('Loja criada com sucesso!')
    }

    setShopName('')
    setShopDescription('')
    setEditingShopId(null)
    setShowShopForm(false)
  } catch (err) {
    setError(`Não foi possível salvar a loja: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setShopLoading(false)
  }
}

async function toggleShopVisibility(shop: CampaignShop) {
  if (!isMaster || !selectedCampaignId || shopLoading) return

  const nextVisibility = !shop.is_visible

  setShopLoading(true)
  setError('')
  setNotice('')

  try {
    const { data, error: updateError } = await supabase
      .from('campaign_shops')
      .update({
        is_visible: nextVisibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shop.id)
      .eq('campaign_id', selectedCampaignId)
      .select('id, campaign_id, name, description, is_visible')
      .single()

    if (updateError) throw updateError

    setShops(current =>
      current.map(entry =>
        entry.id === shop.id
          ? data as CampaignShop
          : entry
      )
    )

    setNotice(
      nextVisibility
        ? `A loja "${shop.name}" agora está visível para os jogadores.`
        : `A loja "${shop.name}" agora está oculta para os jogadores.`
    )
  } catch (err) {
    setError(`Não foi possível alterar a visibilidade: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setShopLoading(false)
  }
}

function editShop(shop: CampaignShop) {
  setEditingShopId(shop.id)
  setShopName(shop.name)
  setShopDescription(shop.description ?? '')
  setShowShopForm(true)
}

async function deleteShop(shop: CampaignShop) {
  if (!window.confirm(
    `Deseja excluir a loja "${shop.name}" e todos os seus produtos?`
  )) return

  setShopLoading(true)
  setError('')
  setNotice('')

  const { error: deleteError } = await supabase
    .from('campaign_shops')
    .delete()
    .eq('id', shop.id)

  if (deleteError) {
    setError(`Não foi possível excluir a loja: ${deleteError.message}`)
    setShopLoading(false)
    return
  }

  setShops(current => current.filter(entry => entry.id !== shop.id))
  setShopItems(current => current.filter(item => item.shop_id !== shop.id))

  if (selectedShopId === shop.id) {
    const remaining = shops.filter(entry => entry.id !== shop.id)
    setSelectedShopId(remaining[0]?.id ?? '')
  }

  setNotice('Loja excluída com sucesso.')
  setShopLoading(false)
}


async function saveShopItem() {
  if (!selectedShopId) {
    setError('Selecione uma loja antes de cadastrar o produto.')
    return
  }

  if (!shopItemName.trim()) {
    setError('Informe o nome do produto.')
    return
  }

  if (!shopItemCategories.length) {
    setError('Selecione pelo menos uma classificação para o produto.')
    return
  }

  if (shopLoading) {
    setError('Aguarde a operação atual terminar antes de salvar o produto.')
    return
  }

  const price = Number(shopItemPrice.replace(',', '.'))
  const automaticWeight = getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass)
  const weight = automaticWeight ?? Number(shopItemWeight.replace(',', '.'))
  const stockText = shopItemStock.trim()
  const stock = stockText === '' ? null : Number(stockText)

  if (!Number.isFinite(price) || price < 0) {
    setError('Informe um preço válido, igual ou maior que zero.')
    return
  }

  if (!Number.isFinite(weight) || weight < 0) {
    setError('Informe um peso válido, igual ou maior que zero.')
    return
  }

  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    setError('O estoque deve ser um número inteiro igual ou maior que zero.')
    return
  }

  if (price > 0 && !shopItemCurrencyId) {
    setError('Selecione a moeda utilizada neste produto.')
    return
  }

  setShopLoading(true)
  setError('')
  setNotice('')

  const payload = {
    shop_id: selectedShopId,
    name: shopItemName.trim(),
    description: shopItemDescription.trim() || null,
    category: shopItemCategories[0] ?? shopItemCategory.trim() ?? 'Diversos',
    weight,
    unit_price: price,
    currency_id: price > 0 ? shopItemCurrencyId : null,
    quantity: stock,
    metadata: {
      ...(editingShopItemId ? shopItems.find(item => item.id === editingShopItemId)?.metadata ?? {} : {}),
      icon: shopItemEmoji.trim() || '📦',
      rarity: shopItemRarity,
      categories: shopItemCategories.length ? shopItemCategories : [shopItemCategory],
      equipmentType: shopItemEquipmentType,
      armorClass: shopItemEquipmentType === 'armor' ? shopItemArmorClass : null,
      armorCoverage: shopItemEquipmentType === 'armor' ? (shopItemArmorClass === 'pesada' ? 'todos' : shopItemArmorCoverage) : null,
      protectionTier: shopItemEquipmentType === 'protection' ? shopItemProtectionTier : null,
      protectionMode: shopItemEquipmentType === 'protection' ? shopItemProtectionMode : null,
      scarcityLevel: shopItemCategories.includes('Consumíveis') ? Number(shopItemScarcityLevel) : null,
      scarcityDie: shopItemCategories.includes('Consumíveis') ? ({ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' } as Record<string, string>)[shopItemScarcityLevel] : null,
      scarcityCharge: shopItemCategories.includes('Consumíveis') ? ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[shopItemScarcityLevel] : null,
      scarcityExhausted: shopItemCategories.includes('Consumíveis') ? shopItemScarcityExhausted : false,
      weaponClass: shopItemCategories.includes('Armas') ? shopItemWeaponClass : null,
      weaponDamage: shopItemCategories.includes('Armas') ? ({ improvised: '1d4', advanced: '1d6', special: '1d8', black_red: '1d10', mutable: '1d12' } as Record<string, string>)[shopItemWeaponClass] || '1d4' : null,
      weaponWeight: shopItemCategories.includes('Armas') ? weight : null,
    },
  }

  try {
    if (editingShopItemId) {
      const { data, error: updateError } = await supabase
        .from('campaign_shop_items')
        .update({
          name: payload.name,
          description: payload.description,
          category: payload.category,
          weight: payload.weight,
          unit_price: payload.unit_price,
          currency_id: payload.currency_id,
          quantity: payload.quantity,
          metadata: payload.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingShopItemId)
        .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
        .single()

      if (updateError) throw updateError

      setShopItems(current =>
        current.map(item =>
          item.id === editingShopItemId
            ? data as CampaignShopItem
            : item
        )
      )

      setNotice('Produto atualizado com sucesso!')
    } else {
      const { data, error: insertError } = await supabase
        .from('campaign_shop_items')
        .insert(payload)
        .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
        .single()

      if (insertError) throw insertError

      setShopItems(current => [...current, data as CampaignShopItem])
      setNotice('Produto cadastrado com sucesso!')
    }

    setEditingShopItemId(null)
    setShopItemName('')
    setShopItemDescription('')
    setShopItemCategory('Diversos')
    setShopItemRarity('comum')
    setShopItemWeight('0')
    setShopItemPrice('0')
    setShopItemCurrencyId('')
    setShopItemStock('')
    setShopItemEmoji('📦')
    setShopItemCategories(['Diversos'])
    setShopItemEquipmentType('none')
    setShopItemArmorClass('leve')
    setShopItemArmorCoverage('cortante_perfurante')
    setShopItemProtectionTier('basica')
    setShopItemProtectionMode('resistencia')
    setShopItemWeaponClass('improvised')
    setShopItemScarcityLevel('1')
    setShopItemScarcityExhausted(false)
    setShowShopItemForm(false)
  } catch (err) {
    const dbError = err as { message?: string; code?: string; details?: string; hint?: string }
    const reason = [
      dbError?.message ?? (err instanceof Error ? err.message : String(err)),
      dbError?.code ? `Código: ${dbError.code}` : '',
      dbError?.details ? `Detalhes: ${dbError.details}` : '',
      dbError?.hint ? `Sugestão do banco: ${dbError.hint}` : '',
    ].filter(Boolean).join(' · ')
    setError(`Não foi possível salvar o produto: ${reason}`)
  } finally {
    setShopLoading(false)
  }
}

function editShopItem(item: CampaignShopItem) {
  setEditingShopItemId(item.id)
  setShopItemName(item.name)
  setShopItemDescription(item.description ?? '')
  setShopItemCategory(item.category)
  setShopItemCategories(Array.isArray(item.metadata?.categories) ? item.metadata.categories.filter((value): value is string => typeof value === 'string') : [item.category])
  setShopItemRarity(typeof item.metadata?.rarity === 'string' ? item.metadata.rarity.toLocaleLowerCase('pt-BR') : 'comum')
  setShopItemEquipmentType(item.metadata?.equipmentType === 'armor' || item.metadata?.equipmentType === 'protection' ? item.metadata.equipmentType : 'none')
  setShopItemArmorClass(item.metadata?.armorClass === 'media' || item.metadata?.armorClass === 'pesada' ? item.metadata.armorClass : 'leve')
  setShopItemArmorCoverage(item.metadata?.armorCoverage === 'especial_bruto' || item.metadata?.armorCoverage === 'todos' ? item.metadata.armorCoverage : 'cortante_perfurante')
  setShopItemProtectionTier(item.metadata?.protectionTier === 'moderada' || item.metadata?.protectionTier === 'avancada' ? item.metadata.protectionTier : 'basica')
  setShopItemProtectionMode(item.metadata?.protectionMode === 'sanidade' ? 'sanidade' : 'resistencia')
  setShopItemWeaponClass(typeof item.metadata?.weaponClass === 'string' ? item.metadata.weaponClass : 'improvised')
  setShopItemScarcityLevel(['1', '2', '3', '4'].includes(String(item.metadata?.scarcityLevel ?? '1')) ? String(item.metadata?.scarcityLevel ?? '1') as '1' | '2' | '3' | '4' : '1')
  setShopItemScarcityExhausted(item.metadata?.scarcityExhausted === true)
  setShopItemWeight(String(item.weight))
  setShopItemPrice(String(item.unit_price))
  setShopItemCurrencyId(item.currency_id ?? '')
  setShopItemStock(item.quantity === null ? '' : String(item.quantity))
  setShopItemEmoji(
    typeof item.metadata?.icon === 'string'
      ? item.metadata.icon
      : '📦'
  )
  setShowShopItemForm(true)
}

async function deleteShopItem(item: CampaignShopItem) {
  if (!window.confirm(`Deseja excluir o produto "${item.name}"?`)) return

  setShopLoading(true)
  setError('')
  setNotice('')

  const { error: deleteError } = await supabase
    .from('campaign_shop_items')
    .delete()
    .eq('id', item.id)

  if (deleteError) {
    setError(`Não foi possível excluir o produto: ${deleteError.message}`)
    setShopLoading(false)
    return
  }

  setShopItems(current =>
    current.filter(entry => entry.id !== item.id)
  )

  setNotice('Produto excluído com sucesso.')
  setShopLoading(false)
}


async function purchaseShopItem(
  item: CampaignShopItem,
  quantity: number = 1,
) {
  if (!shopPurchaseCharacterId || shopPurchaseLoading) {
    setError('Selecione um personagem antes de comprar.')
    return
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    setError('Informe uma quantidade válida.')
    return
  }

  if (item.quantity !== null && item.quantity < quantity) {
    setError('Não há estoque suficiente deste produto.')
    return
  }

  setShopPurchaseLoading(item.id)
  setError('')
  setNotice('')

  try {
    const { data, error: purchaseError } = await supabase.rpc(
      'purchase_campaign_shop_item',
      {
        p_shop_item_id: item.id,
        p_character_id: shopPurchaseCharacterId,
        p_quantity: quantity,
      },
    )

    if (purchaseError) throw purchaseError

    // Atualiza o inventário do personagem
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .eq('character_id', shopPurchaseCharacterId)
      .order('created_at', { ascending: true })

    if (inventoryError) throw inventoryError

    setItems((inventoryData ?? []) as Item[])

    // Atualiza a carteira
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      'get_character_currency',
      { p_character_id: shopPurchaseCharacterId },
    )

    if (balanceError) throw balanceError

    setCurrencyBalances(
      balanceData && typeof balanceData === 'object'
        ? balanceData as Record<string, number>
        : {},
    )

    // Atualiza o estoque do produto
    const { data: updatedItem, error: stockError } = await supabase
      .from('campaign_shop_items')
      .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
      .eq('id', item.id)
      .maybeSingle()

    if (stockError) throw stockError

    if (updatedItem) {
      setShopItems(current =>
        current.map(entry =>
          entry.id === item.id
            ? updatedItem as CampaignShopItem
            : entry
        )
      )
    }

    const result = data as {
      item_name?: string
      quantity?: number
      total_price?: number
    }

    setNotice(
      `${result.quantity ?? quantity}x ${result.item_name ?? item.name} comprado com sucesso!`,
    )
    setShopPurchaseQuantities(current => ({
  ...current,
  [item.id]: '1',
}))
  } catch (err) {
    setError(`Não foi possível concluir a compra: ${
      err instanceof Error ? err.message : String(err)
    }`)
  } finally {
    setShopPurchaseLoading(null)
  }
}

async function setItemRestriction(
  type: 'inventory' | 'shop',
  itemId: string,
  blocked: boolean,
) {
  setError('')
  setNotice('')

  try {
    const { error: restrictionError } = await supabase.rpc(
      'set_item_restriction',
      {
        p_target_type: type,
        p_target_id: itemId,
        p_blocked: blocked,
      },
    )

    if (restrictionError) throw restrictionError

    if (type === 'inventory') {
      setItems(current =>
        current.map(item =>
          item.id === itemId
            ? { ...item, sale_blocked: blocked }
            : item
        )
      )

      setSelectedItemDetails(current =>
        current?.id === itemId
          ? { ...current, sale_blocked: blocked }
          : current
      )

      setNotice(
        blocked
          ? 'Venda do item bloqueada pelo mestre.'
          : 'Venda do item liberada.'
      )
    } else {
      setShopItems(current =>
        current.map(item =>
          item.id === itemId
            ? { ...item, purchase_blocked: blocked }
            : item
        )
      )

      setNotice(
        blocked
          ? 'Compra do item bloqueada pelo mestre.'
          : 'Compra do item liberada.'
      )
    }
  } catch (err) {
    setError(
      `Não foi possível alterar o bloqueio: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

async function sellInventoryItem(item: Item, requestedQuantity?: number) {
  const quantity = requestedQuantity ?? Number(saleQuantity)

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    setError('Informe uma quantidade válida.')
    return
  }

  if (quantity > item.quantity) {
    setError('Você não possui essa quantidade do item.')
    return
  }

  if (saleLoading) return

  const isShopItem = Boolean(
    item.metadata?.shop_id && item.metadata?.shop_item_id
  )

const destinationShopId = selectedShopId || saleShopId

if (!isShopItem && !destinationShopId) {
  setError('Selecione a loja que receberá o item.')
  return
}

  const total = Number(item.unit_price) * quantity

  const confirmed = window.confirm(
    `Vender ${quantity}x ${item.name} por ${total.toLocaleString('pt-BR')}?`
  )

  if (!confirmed) return

  setSaleLoading(true)
  setError('')
  setNotice('')

  // Primeira etapa: realizar a venda no banco.
  const { data, error: saleError } = await supabase.rpc(
    'sell_character_inventory_item',
    {
      p_inventory_item_id: item.id,
      p_shop_id: isShopItem ? null : destinationShopId,
      p_quantity: quantity,
    },
  )

  if (saleError) {
    setError(`Não foi possível vender o item: ${saleError.message}`)
    setSaleLoading(false)
    return
  }

  // A venda já foi concluída. Não devemos desfazer esse sucesso
  // visualmente caso alguma consulta de atualização falhe.
  const result = data as {
    item_name?: string
    quantity?: number
    total_price?: number
  }

  setNotice(
    `${result.quantity ?? quantity}x ${result.item_name ?? item.name} vendido(s) por ${Number(result.total_price ?? total).toLocaleString('pt-BR')}.`
  )

  setSelectedItemDetails(null)
  setSaleQuantity('1')
  setSaleShopId('')

  // Segunda etapa: atualizar os dados exibidos na página.
  const refreshErrors: string[] = []

  try {
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .eq('character_id', item.character_id)
      .order('created_at', { ascending: true })

    if (inventoryError) throw inventoryError

    setItems((inventoryData ?? []) as Item[])
  } catch (err) {
    refreshErrors.push('inventário')
  }

  try {
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      'get_character_currency',
      { p_character_id: item.character_id },
    )

    if (balanceError) throw balanceError

    setCurrencyBalances(
      balanceData && typeof balanceData === 'object'
        ? balanceData as Record<string, number>
        : {},
    )
  } catch (err) {
    refreshErrors.push('carteira')
  }

  if (shops.length > 0) {
    try {
      const { data: shopData, error: shopError } = await supabase
        .from('campaign_shop_items')
        .select('id, shop_id, name, description, category, weight, unit_price, currency_id, quantity, metadata, purchase_blocked')
        .in('shop_id', shops.map(shop => shop.id))
        .order('created_at', { ascending: true })

      if (shopError) throw shopError

      setShopItems((shopData ?? []) as CampaignShopItem[])
    } catch (err) {
      refreshErrors.push('estoque das lojas')
    }
  }

  if (refreshErrors.length > 0) {
    setError(
      `A venda foi realizada, mas não foi possível atualizar: ${refreshErrors.join(', ')}. Recarregue a página para sincronizar os dados.`
    )
  }

  setSaleLoading(false)
}

async function loadCurrencyHistory() {
  if (!selectedCharacterId || currencyHistoryLoading) return

  setCurrencyHistoryLoading(true)

  const { data, error: historyError } = await supabase
    .from('character_currency_transactions')
    .select('id, character_id, campaign_id, currency_id, amount_delta, balance_after, description, created_by, created_at')
    .eq('character_id', selectedCharacterId)
    .order('created_at', { ascending: false })

  if (historyError) {
    setError(`Erro ao carregar histórico: ${historyError.message}`)
    setCurrencyTransactions([])
  } else {
    setCurrencyTransactions((data ?? []) as CurrencyTransaction[])
  }

  setCurrencyHistoryLoading(false)
}

async function toggleCurrencyHistory() {
  const nextState = !showCurrencyHistory

  setShowCurrencyHistory(nextState)

  if (nextState) {
    setCurrencyTransactions([])
    await loadCurrencyHistory()
  }
}

async function clearCurrencyHistory() {
  if (!selectedCharacterId || currencyHistoryLoading) return

  const confirmed = window.confirm(
    'Tem certeza que deseja apagar todo o histórico de transações deste personagem? Os saldos das moedas NÃO serão alterados. Esta ação não pode ser desfeita.'
  )

  if (!confirmed) return

  setCurrencyHistoryLoading(true)
  setError('')
  setNotice('')

  const { data, error: deleteError } = await supabase
    .from('character_currency_transactions')
    .delete()
    .eq('character_id', selectedCharacterId)
    .select('id')

  if (deleteError) {
    setError(`Não foi possível limpar o histórico: ${deleteError.message}`)
  } else if (!data || data.length === 0) {
    setError('Nenhuma transação foi apagada. Verifique as permissões.')
  } else {
    setCurrencyTransactions([])
    setNotice('Histórico de transações apagado com sucesso.')
  }

  setCurrencyHistoryLoading(false)
}

async function saveCampaignCurrencyConfig(nextCurrencies: NonNullable<Campaign['currency_config']>['currencies']) {
  if (!selectedCampaign || !isMaster || currencyConfigSaving) return
  setCurrencyConfigSaving(true)
  setError('')
  setNotice('')
  const nextConfig = { currencies: nextCurrencies }
  const { data, error: updateError } = await supabase
    .from('campaigns')
    .update({ currency_config: nextConfig })
    .eq('id', selectedCampaign.id)
    .select('id, name, description, system_name, currency_config, created_by')
    .maybeSingle()
  if (updateError || !data) {
    setError(`Não foi possível salvar as moedas: ${updateError?.message ?? 'nenhum registro atualizado; verifique as permissões da campanha.'}`)
    setCurrencyConfigSaving(false)
    return false
  }
  setCampaigns(current => current.map(campaign => campaign.id === selectedCampaign.id ? { ...campaign, currency_config: data.currency_config } : campaign))
  setNotice('Configuração de moedas salva. A primeira moeda da lista é a moeda do sistema.')
  setCurrencyConfigSaving(false)
  return true
}

async function addCampaignCurrency() {
  if (!selectedCampaign || !currencyDraftName.trim() || !currencyDraftSymbol.trim()) {
    setError('Informe o nome e o símbolo da moeda.')
    return
  }
  const rate = Number(currencyDraftRate.replace(',', '.'))
  if (!Number.isFinite(rate) || rate <= 0) {
    setError('A taxa de conversão deve ser maior que zero.')
    return
  }
  const current = selectedCampaign.currency_config?.currencies ?? []
  const next = [...current, { id: crypto.randomUUID(), name: currencyDraftName.trim(), symbol: currencyDraftSymbol.trim(), conversionRate: rate }]
  await saveCampaignCurrencyConfig(next)
  if (!currencyConfigSaving) {
    setCurrencyDraftName('')
    setCurrencyDraftSymbol('')
    setCurrencyDraftRate('1')
  }
}

function beginEditingCampaignCurrency(currency: NonNullable<Campaign['currency_config']>['currencies'][number]) {
  setEditingCurrencyId(currency.id)
  setCurrencyDraftName(currency.name)
  setCurrencyDraftSymbol(currency.symbol)
  setCurrencyDraftRate(String(currency.conversionRate))
}

async function saveEditedCampaignCurrency() {
  if (!selectedCampaign || !editingCurrencyId || !currencyDraftName.trim() || !currencyDraftSymbol.trim()) {
    setError('Informe o nome e o símbolo da moeda.')
    return
  }
  const rate = Number(currencyDraftRate.replace(',', '.'))
  if (!Number.isFinite(rate) || rate <= 0) {
    setError('A taxa de conversão deve ser maior que zero.')
    return
  }
  const current = selectedCampaign.currency_config?.currencies ?? []
  const next = current.map(currency => currency.id === editingCurrencyId
    ? { ...currency, name: currencyDraftName.trim(), symbol: currencyDraftSymbol.trim(), conversionRate: rate }
    : currency)
  const saved = await saveCampaignCurrencyConfig(next)
  if (!saved) return
  setEditingCurrencyId(null)
  setCurrencyDraftName('')
  setCurrencyDraftSymbol('')
  setCurrencyDraftRate('1')
}

async function handleCurrencyAdjustment(action: 'add' | 'remove') {
  if (!selectedCharacterId || !selectedCampaign || currencyActionLoading) return

  const currency = selectedCampaign.currency_config?.currencies?.[0]

  if (!currency) {
    setError('Esta campanha ainda não possui moedas configuradas.')
    return
  }

  const amount = Number(currencyAmount.replace(',', '.'))

  if (!Number.isFinite(amount) || amount <= 0) {
    setError('Informe um valor válido e maior que zero.')
    return
  }

  setCurrencyActionLoading(true)
  setError('')
  setNotice('')

  const { data, error: adjustmentError } = await supabase.rpc(
    'adjust_character_currency',
    {
      p_character_id: selectedCharacterId,
      p_currency_id: currency.id,
      p_amount: action === 'add' ? amount : -amount,
      p_description: currencyDescription.trim() || null,
    },
  )

  if (adjustmentError) {
    setError(`Não foi possível movimentar a carteira: ${adjustmentError.message}`)
    setCurrencyActionLoading(false)
    return
  }

  setCurrencyBalances(current => ({
    ...current,
    [currency.id]: Number(data),
  }))

  setCurrencyAmount('')
  setCurrencyDescription('')
  setNotice(
    action === 'add'
      ? 'Dinheiro adicionado à carteira!'
      : 'Dinheiro retirado da carteira!',
  )

  setCurrencyActionLoading(false)
}

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(`Não foi possível sair: ${signOutError.message}`)
    }
  }

  async function saveCampaignDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingCampaignId || !isMaster || !campaignName.trim()) return

    setLoading(true)
    setError('')
    setNotice('')

    const normalizedSystemName = systemName.trim() || null
    const existingCurrencies = campaigns.find(campaign => campaign.id === editingCampaignId)?.currency_config?.currencies ?? []
    const shouldAddDefaultYen = Boolean(normalizedSystemName?.toLowerCase().includes('kisatsutai')) && existingCurrencies.length === 0
    const campaignUpdate: Record<string, unknown> = {
      name: campaignName.trim(),
      description: campaignDescription.trim() || null,
      system_name: normalizedSystemName,
      ...(shouldAddDefaultYen ? { currency_config: { currencies: [{ id: crypto.randomUUID(), name: 'Iene', symbol: '¥', conversionRate: 1 }] } } : {}),
    }

    const { data, error: updateError } = await supabase
      .from('campaigns')
      .update(campaignUpdate)
      .eq('id', editingCampaignId)
      .select('id, name, description, system_name, currency_config, created_by')
      .maybeSingle()

    if (updateError || !data) {
      setError(`Não foi possível atualizar a campanha: ${updateError?.message ?? 'nenhum registro atualizado. Verifique as permissões RLS.'}`)
      setLoading(false)
      return
    }

    setCampaigns(current => current.map(campaign =>
      campaign.id === editingCampaignId ? { ...campaign, ...data } : campaign
    ))
    setCampaignName('')
    setCampaignDescription('')
    setSystemName('')
    setCampaignSystemChoice('')
    setEditingCampaignId(null)
    setShowCampaignForm(false)
    setNotice('Campanha atualizada com sucesso!')
    setLoading(false)
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!campaignName.trim()) return

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: createError } = await supabase.rpc(
      'create_campaign',
      {
        p_name: campaignName.trim(),
        p_description: campaignDescription.trim() || null,
        p_system_name: systemName.trim() || null,
      },
    )

    if (createError) {
      setError(`Não foi possível criar a campanha: ${createError.message}`)
      setLoading(false)
      return
    }

    const newCampaignId = data as string

    const { data: membership, error: membershipError } = await supabase
      .from('campaign_members')
      .select('campaign_id, role')
      .eq('campaign_id', newCampaignId)
      .eq('user_id', session!.user.id)
      .maybeSingle()

    if (membershipError || !membership) {
      setError(
        'A campanha foi criada, mas não consegui confirmar sua participação. Atualize a página.',
      )
      setLoading(false)
      return
    }

    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name, description, system_name, currency_config, created_by')
      .eq('id', newCampaignId)
      .single()

    if (fetchError || !campaign) {
      setError('A campanha foi criada. Atualize a página para carregá-la.')
      setLoading(false)
      return
    }

    let campaignToUse = campaign
    if (String(campaign.system_name ?? '').toLowerCase().includes('kisatsutai') && !(campaign.currency_config?.currencies?.length)) {
      const defaultCurrencyConfig = { currencies: [{ id: crypto.randomUUID(), name: 'Iene', symbol: '¥', conversionRate: 1 }] }
      const { data: updatedCampaign, error: currencyInitError } = await supabase
        .from('campaigns')
        .update({ currency_config: defaultCurrencyConfig })
        .eq('id', newCampaignId)
        .select('id, name, description, system_name, currency_config, created_by')
        .single()
      if (currencyInitError || !updatedCampaign) {
        setError(`Campanha criada, mas não foi possível configurar o Iene automaticamente: ${currencyInitError?.message ?? 'erro desconhecido'}. Você pode adicioná-lo nas configurações de moedas.`)
      } else {
        campaignToUse = updatedCampaign
      }
    }

    setCampaigns((current) => [
      ...current,
      { ...campaignToUse, role: membership.role },
    ])
    setSelectedCampaignId(newCampaignId)
    setCharacters([])
    setItems([])
    setSelectedCharacterId('')
    setCampaignName('')
    setCampaignDescription('')
    setSystemName('')
    setCampaignSystemChoice('')
    setShowCampaignForm(false)
    setNotice('Campanha criada e salva!')
    setLoading(false)
  }

  async function createCampaignInvite() {
    if (inviteLoading) return
    if (!selectedCampaignId) {
      setError('Selecione uma campanha antes de gerar o convite.')
      return
    }
    if (!isMaster) {
      setError('Somente o mestre da campanha pode gerar convites.')
      return
    }

    setInviteLoading(true)
    setError('')
    setNotice('')

    try {
      const { data, error: inviteError } = await supabase.rpc(
        'create_campaign_invite',
        { p_campaign_id: selectedCampaignId },
      )

      if (inviteError) {
        throw new Error(inviteError.message)
      }

      // A RPC normalmente retorna o token como texto. Também aceitamos
      // formatos JSON caso a função SQL tenha sido criada como RETURNS json.
      let token = ''
      if (typeof data === 'string') {
        token = data.trim()
      } else if (data && typeof data === 'object') {
        const result = data as Record<string, unknown>
        const candidate = result.token ?? result.invite_token ?? result.create_campaign_invite
        if (typeof candidate === 'string') token = candidate.trim()
      }

      if (!token) {
        throw new Error(
          `A função do Supabase respondeu, mas não retornou um token válido. Resposta: ${JSON.stringify(data)}`,
        )
      }

      const link = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`
      setCampaignInviteLink(link)
      setNotice('Convite criado. Copie o link e compartilhe com os jogadores.')
    } catch (inviteError) {
      const message = inviteError instanceof Error
        ? inviteError.message
        : String(inviteError)
      setError(`Não foi possível gerar o convite: ${message}`)
    } finally {
      setInviteLoading(false)
    }
  }

  async function joinCampaignWithInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteCode.trim() || inviteLoading) return
    setInviteLoading(true); setError(''); setNotice('')
    const { data, error: joinError } = await supabase.rpc('join_campaign_by_invite', { p_token: inviteCode.trim() })
    if (joinError || !data) {
      setError(`Não foi possível entrar na campanha: ${joinError?.message ?? 'convite inválido'}`)
      setInviteLoading(false)
      return
    }
    const joinedId = typeof data === 'string' ? data : String(data)
    const { data: campaign, error: campaignError } = await supabase.from('campaigns').select('id,name,description,system_name,currency_config,created_by').eq('id', joinedId).single()
    if (campaignError || !campaign) {
      setError(`Você entrou na campanha, mas não foi possível carregá-la: ${campaignError?.message ?? ''}`)
      setInviteLoading(false)
      return
    }
    setCampaigns(current =>
  current.some(entry => entry.id === campaign.id)
    ? current
    : [
        ...current,
        {
          ...campaign,
          currency_config: (campaign as Campaign).currency_config ?? null,
          role: 'player',
        },
      ],
)
    setSelectedCampaignId(campaign.id); setInviteCode(''); setCampaignInviteLink('')
    window.history.replaceState({}, '', window.location.pathname)
    setNotice(`Você entrou na campanha ${campaign.name}!`)
    setInviteLoading(false)
  }

  async function createSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedCampaignId || !isMaster || !newSeasonName.trim()) return
    setLoading(true); setError(''); setNotice('')
    const nextNumber = Math.max(0, ...seasons.map(season => season.season_number)) + 1
    const { data: created, error: createError } = await supabase.from('campaign_seasons').insert({ campaign_id: selectedCampaignId, name: newSeasonName.trim(), description: newSeasonDescription.trim() || null, season_number: nextNumber, status: seasons.some(season => season.status === 'active') ? 'draft' : 'active', created_by: session!.user.id }).select('id,campaign_id,name,description,season_number,status,theme_key').single()
    if (createError || !created) { setError(`Não foi possível criar a temporada: ${createError?.message ?? 'resposta vazia'}`); setLoading(false); return }
    const season = created as Season
    for (const character of characters) {
      let initialData: Record<string, unknown> = {}
      if (copyPreviousSheet && selectedSeasonId) {
        const { data: previous, error: previousError } = await supabase.from('character_sheets').select('sheet_data').eq('character_id', character.id).eq('season_id', selectedSeasonId).maybeSingle()
        if (previousError) { setError(`Temporada criada, mas não foi possível copiar a ficha de ${character.name}: ${previousError.message}`); setLoading(false); return }
        initialData = (previous?.sheet_data ?? {}) as Record<string, unknown>
      }
      const { data: newSheet, error: newSheetError } = await supabase.from('character_sheets').insert({ character_id: character.id, season_id: season.id, sheet_data: initialData, created_by: session!.user.id }).select('id,character_id,season_id,sheet_data').single()
      if (newSheetError) { setError(`Temporada criada, mas a ficha de ${character.name} não foi inicializada: ${newSheetError.message}`); setLoading(false); return }
      const { error: versionError } = await supabase.from('character_sheet_versions').insert({ character_sheet_id: newSheet.id, character_id: character.id, season_id: season.id, sheet_data: initialData, milestone_type: 'season_start', milestone_name: `Início da temporada ${season.name}`, notes: 'Snapshot automático no início da temporada.', created_by: session!.user.id })
      if (versionError) { setError(`Ficha de ${character.name} criada, mas o snapshot inicial falhou: ${versionError.message}`); setLoading(false); return }
    }
    setSeasons(current => [...current, season].sort((a,b) => a.season_number-b.season_number)); setSelectedSeasonId(season.id); setNewSeasonName(''); setNewSeasonDescription(''); setNotice(`Temporada “${season.name}” criada.`); setLoading(false)
  }

  async function saveSeasonTheme(themeKey: keyof typeof seasonThemes) {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster || seasonThemeSaving) return
    setSeasonThemeSaving(true)
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ theme_key: themeKey }).eq('id', season.id).select('id,campaign_id,name,description,season_number,status,theme_key').single()
    setSeasonThemeSaving(false)
    if (updateError || !data) { setError(`Não foi possível salvar o tema: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry))
    setNotice(`Tema “${seasonThemes[themeKey].label}” aplicado à temporada.`)
  }

  async function saveSeasonDetails() {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster || !seasonNameDraft.trim()) return
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ name: seasonNameDraft.trim(), description: seasonDescriptionDraft.trim() || null }).eq('id', season.id).select('id,campaign_id,name,description,season_number,status,theme_key').single()
    if (updateError || !data) { setError(`Não foi possível atualizar a temporada: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry)); setNotice('Dados da temporada atualizados.')
  }

  async function changeSeasonStatus(status: Season['status']) {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster) return
    if (status === 'active' && seasons.some(entry => entry.status === 'active' && entry.id !== season.id)) { setError('Já existe uma temporada ativa. Conclua ou arquive a atual antes de ativar outra.'); return }
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ status }).eq('id', season.id).select('id,campaign_id,name,description,season_number,status,theme_key').single()
    if (updateError || !data) { setError(`Não foi possível mudar o status: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry)); setNotice(`Status da temporada: ${status}.`)
  }

  async function toggleSeasonParticipation(participates: boolean) {
    if (!selectedCharacterId || !selectedSeasonId || !canEditSelectedSheet || sheetSaving) return
    let parsed: Record<string, unknown>
    try {
      const value: unknown = JSON.parse(sheetDraft || '{}')
      parsed = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    } catch {
      setError('Não foi possível atualizar a participação porque os dados da ficha estão inválidos. Salve ou corrija a edição primeiro.')
      return
    }
    parsed = { ...parsed, seasonParticipation: participates }
    setSheetSaving(true)
    setError('')
    if (sheet) {
      const { data, error: updateError } = await supabase.from('character_sheets').update({ sheet_data: parsed }).eq('id', sheet.id).select('id,character_id,season_id,sheet_data').single()
      if (updateError || !data) {
        setError(`Não foi possível salvar a participação: ${updateError?.message ?? 'resposta vazia'}`)
        setSheetSaving(false)
        return
      }
      setSheet(data as CharacterSheet)
    } else {
      const { data, error: insertError } = await supabase.from('character_sheets').insert({ character_id: selectedCharacterId, season_id: selectedSeasonId, sheet_data: parsed, created_by: session!.user.id }).select('id,character_id,season_id,sheet_data').single()
      if (insertError || !data) {
        setError(`Não foi possível salvar a participação: ${insertError?.message ?? 'resposta vazia'}`)
        setSheetSaving(false)
        return
      }
      setSheet(data as CharacterSheet)
    }
    setSheetDraft(JSON.stringify(parsed, null, 2))
    setMasterShieldSheets(current => ({ ...current, [selectedCharacterId]: parsed as Record<string, any> }))
    setNotice(participates ? 'Personagem incluído nesta temporada.' : 'Personagem removido desta temporada. A ficha e o histórico foram preservados.')
    setSheetSaving(false)
  }

  async function saveCharacterSheet() {
    if (!selectedCharacterId || !selectedSeasonId || !canEditSelectedSheet) return
    let parsed: Record<string, unknown>
    try { const value: unknown = JSON.parse(sheetDraft); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A ficha precisa ser um objeto JSON.'); parsed = value as Record<string, unknown> }
    catch (e) { setError(e instanceof Error ? e.message : 'JSON inválido.'); return }
    // O salvamento geral da ficha não deve alterar PV, PS ou PR atuais.
    // Esses três campos são persistidos exclusivamente por saveCharacterConditions().
    if (sheet) {
      const persistedStatus = sheet.sheet_data.status && typeof sheet.sheet_data.status === 'object' && !Array.isArray(sheet.sheet_data.status)
        ? sheet.sheet_data.status as Record<string, unknown>
        : {}
      const persistedCurrent = persistedStatus.current && typeof persistedStatus.current === 'object' && !Array.isArray(persistedStatus.current)
        ? persistedStatus.current as Record<string, unknown>
        : {}
      const draftStatus = parsed.status && typeof parsed.status === 'object' && !Array.isArray(parsed.status)
        ? parsed.status as Record<string, unknown>
        : {}
      const draftCurrent = draftStatus.current && typeof draftStatus.current === 'object' && !Array.isArray(draftStatus.current)
        ? draftStatus.current as Record<string, unknown>
        : {}

      parsed = {
        ...parsed,
        status: {
          ...draftStatus,
          current: {
            ...draftCurrent,
            ...persistedCurrent,
          },
        },
      }
    }

    setSheetSaving(true); setError('')
    if (sheet) {
      const { data, error: updateError } = await supabase.from('character_sheets').update({ sheet_data: parsed }).eq('id', sheet.id).select('id,character_id,season_id,sheet_data').single()
      if (updateError || !data) { setError(`Não foi possível salvar a ficha: ${updateError?.message ?? 'resposta vazia'}`); setSheetSaving(false); return }
      setSheet(data as CharacterSheet)
    } else {
      const { data, error: insertError } = await supabase.from('character_sheets').insert({ character_id: selectedCharacterId, season_id: selectedSeasonId, sheet_data: parsed, created_by: session!.user.id }).select('id,character_id,season_id,sheet_data').single()
      if (insertError || !data) { setError(`Não foi possível criar a ficha: ${insertError?.message ?? 'resposta vazia'}`); setSheetSaving(false); return }
      setSheet(data as CharacterSheet)
    }
    let strengthSyncFailed = false
    const sheetStrength = (parsed.attributes as Record<string, unknown> | undefined)?.strength
    if (typeof sheetStrength === 'number' && Number.isInteger(sheetStrength) && sheetStrength >= 0 && sheetStrength <= 100) {
      const { data: updatedCharacter, error: strengthError } = await supabase
        .from('characters')
        .update({ strength: sheetStrength })
        .eq('id', selectedCharacterId)
        .select('id, campaign_id, user_id, name, archetype, level, strength, visibility, current_player_id, created_at')
        .maybeSingle()
      if (strengthError) {
        strengthSyncFailed = true
        setError(`Ficha salva, mas não foi possível sincronizar a Força com a capacidade de carga: ${strengthError.message}`)
      } else if (updatedCharacter) {
        setCharacters(current => current.map(character => character.id === selectedCharacterId ? updatedCharacter as Character : character))
      }
    }
    setSheetDraft(JSON.stringify(parsed, null, 2));
    if (!strengthSyncFailed) setNotice('Ficha salva.');
    setSheetSaving(false)
  }

  async function saveCharacterConditions(draftOverride?: Record<string, unknown>) {
    if (!selectedCharacterId || !selectedSeasonId || !canEditSelectedSheet) return

    let parsed: Record<string, unknown>
    try {
      const value: unknown = draftOverride ?? JSON.parse(sheetDraft)
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('A ficha precisa ser um objeto JSON.')
      }
      parsed = value as Record<string, unknown>
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido.')
      return
    }

    const status = parsed.status && typeof parsed.status === 'object' && !Array.isArray(parsed.status)
      ? parsed.status as Record<string, unknown>
      : {}
    const current = status.current && typeof status.current === 'object' && !Array.isArray(status.current)
      ? status.current as Record<string, unknown>
      : {}

    const rawValues = [current.pv, current.ps, current.pr]
    const values = rawValues.map(value => value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value))
    if (values.some(value => !Number.isFinite(value))) {
      setError('PV, PS e PR precisam ter valores numéricos válidos antes de salvar.')
      return
    }
    if (values.some(value => value < 0)) {
      setError('PV, PS e PR não podem ser negativos.')
      return
    }

    setSheetSaving(true)
    setError('')
    setNotice('')

    try {
      let targetSheet = sheet

      // Uma ficha nova precisa ser criada uma única vez; depois disso, as
      // alterações de condições passam exclusivamente pela RPC.
      if (!targetSheet) {
        const { data: inserted, error: insertError } = await supabase
          .from('character_sheets')
          .insert({
            character_id: selectedCharacterId,
            season_id: selectedSeasonId,
            sheet_data: parsed,
            created_by: session!.user.id,
          })
          .select('id,character_id,season_id,sheet_data')
          .single()

        if (insertError || !inserted) {
          throw new Error(`Não foi possível criar a ficha: ${insertError?.message ?? 'resposta vazia'}`)
        }
        targetSheet = inserted as CharacterSheet
        setSheet(targetSheet)
      }

      const { data, error: rpcError } = await supabase.rpc('update_character_conditions', {
        p_sheet_id: targetSheet.id,
        p_pv: values[0],
        p_ps: values[1],
        p_pr: values[2],
      })

      if (rpcError || !data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Não foi possível salvar as condições: ${rpcError?.message ?? 'resposta vazia'}`)
      }

      const savedSheetData = data as Record<string, unknown>
      const savedStatus = savedSheetData.status && typeof savedSheetData.status === 'object'
        ? savedSheetData.status as Record<string, unknown>
        : status

      setSheet({ ...targetSheet, sheet_data: savedSheetData })
      // Mantém eventuais alterações locais de outros campos no rascunho,
      // mas substitui status.current pelos valores efetivamente gravados.
      setSheetDraft(JSON.stringify({
        ...parsed,
        status: {
          ...status,
          ...savedStatus,
          current: {
            ...current,
            ...(savedStatus.current && typeof savedStatus.current === 'object'
              ? savedStatus.current as Record<string, unknown>
              : {}),
          },
        },
      }, null, 2))
      setNotice('PV, PS e PR atualizados com sucesso!')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar as condições.')
    } finally {
      setSheetSaving(false)
    }
  }

  async function createSheetMilestone() {
    if (!sheet || !selectedCharacterId || !selectedSeasonId || !isMaster) return
    let parsed: Record<string, unknown>
    try { const value: unknown = JSON.parse(sheetDraft); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A ficha precisa ser um objeto JSON.'); parsed = value as Record<string, unknown> }
    catch (e) { setError(e instanceof Error ? e.message : 'JSON inválido.'); return }
    const { error: saveError } = await supabase.from('character_sheets').update({ sheet_data: parsed }).eq('id', sheet.id)
    if (saveError) { setError(`Não foi possível salvar antes do marco: ${saveError.message}`); return }
    const milestoneName = window.prompt('Nome deste marco (ex.: Após a missão):')
    if (!milestoneName?.trim()) return
    const { error: milestoneError } = await supabase.from('character_sheet_versions').insert({ character_sheet_id: sheet.id, character_id: selectedCharacterId, season_id: selectedSeasonId, sheet_data: parsed, milestone_type: 'manual', milestone_name: milestoneName.trim(), created_by: session!.user.id })
    if (milestoneError) { setError(`Ficha salva, mas não foi possível registrar o marco: ${milestoneError.message}`); return }
    setSheet({ ...sheet, sheet_data: parsed }); setNotice('Marco do histórico registrado.')
  }

  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedCampaignId || !characterName.trim()) return

    const kisatsutaiCampaign = String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai')
    const level = kisatsutaiCampaign ? 1 : Number(characterLevel)
    if (kisatsutaiCampaign) {
  if (!primaryArchetype || !secondaryArchetype) {
    setError('Selecione os dois arquétipos.')
    return
  }

  const forbidden =
    (primaryArchetype === 'Linha de Frente' && secondaryArchetype === 'Suporte') ||
    (primaryArchetype === 'Suporte' && secondaryArchetype === 'Linha de Frente') ||
    (primaryArchetype === 'Defensor' && secondaryArchetype === 'Flanco') ||
    (primaryArchetype === 'Flanco' && secondaryArchetype === 'Defensor')

  if (forbidden) {
    setError('Essa combinação de arquétipos não é permitida.')
    return
  }
}

    if (!kisatsutaiCampaign && (!Number.isInteger(level) || level < 1 || level > 999)) {
      setError('O nível deve ser um número inteiro entre 1 e 999.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: createError } = await supabase.rpc(
      'create_character',
      {
        p_campaign_id: selectedCampaignId,
        p_name: characterName.trim(),
        p_archetype: kisatsutaiCampaign
  ? primaryArchetype
  : archetype.trim() || null,
        p_level: level,
      },
    )

    if (createError) {
      setError(`Não foi possível criar o personagem: ${createError.message}`)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Não foi possível confirmar a criação do personagem.')
      setLoading(false)
      return
    }

    let createdCharacter = data as Character
    const { data: emojiUpdated, error: emojiError } = await supabase.from('characters').update({ emoji: characterEmoji }).eq('id', createdCharacter.id).select('id,campaign_id,user_id,name,emoji,archetype,level,strength,visibility,current_player_id,created_at').single()
    if (emojiError) { setError(`Personagem criado, mas não foi possível salvar o emoji: ${emojiError.message}. Execute a migração SQL fornecida.`); setLoading(false); return }
    createdCharacter = emojiUpdated as Character
    if (kisatsutaiCampaign && selectedSeasonId) {
const initialSheetData = {
  identity: {
    primaryArchetype,
    secondaryArchetype,
  },
  progression: {
    system: 'Kisatsutai',
    rankId: characterRank,
    rankName: KISATSUTAI_RANKS.find(
      rank => rank.id === characterRank
    )?.name || 'Zaidan',
  },
}

  const { data: newSheet, error: sheetError } = await supabase
    .from('character_sheets')
    .insert({
      character_id: createdCharacter.id,
      season_id: selectedSeasonId,
      sheet_data: initialSheetData,
      created_by: session!.user.id,
    })
    .select('id,character_id,season_id,sheet_data')
    .single()

  if (sheetError) {
    setError(`Personagem criado, mas houve um erro ao inicializar sua ficha: ${sheetError.message}`)
  } else {
    setSheet(newSheet as CharacterSheet)
    setSheetDraft(JSON.stringify(initialSheetData, null, 2))
  }
}
    setCharacters((current) =>
      current.some((character) => character.id === createdCharacter.id)
        ? current.map((character) =>
            character.id === createdCharacter.id ? createdCharacter : character,
          )
        : [...current, createdCharacter],
    )
    setSelectedCharacterId(createdCharacter.id)
setCharacterName('')
setCharacterEmoji('⚔️')
setArchetype('')
setPrimaryArchetype('')
setSecondaryArchetype('')
setCharacterLevel('1')
setCharacterRank('zaidan')
    setShowCharacterForm(false)
    setNotice('Personagem criado e salvo!')
    setLoading(false)
  }

function openCharacterEmojiPicker(character: Character) {
  setError('')
  setEmojiPickerCharacter(character)
}

async function changeCharacterEmoji(character: Character, emoji: string) {
  if (!availableEmojis.includes(emoji)) {
    setError('Selecione um emoji disponível na lista.')
    return
  }

  const { data, error: updateError } = await supabase
    .from('characters')
    .update({ emoji })
    .eq('id', character.id)
    .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
    .single()

  if (updateError || !data) {
    setError(`Não foi possível atualizar o emoji: ${updateError?.message ?? 'personagem não encontrado'}`)
    return
  }

  setCharacters(current => current.map(entry => entry.id === character.id ? data as Character : entry))
  setEmojiPickerCharacter(null)
  setError('')
  setNotice(`Emoji de ${character.name} atualizado.`)
}

async function deleteCharacter(character: Character) {
  if (!isMaster || deletingCharacterId) return

  const confirmed = window.confirm(
    `ATENÇÃO: deseja excluir definitivamente "${character.name}"?\n\n` +
    'Todas as fichas, versões históricas, itens e permissões deste personagem serão apagados.\n\n' +
    'Esta ação não pode ser desfeita.'
  )

  if (!confirmed) return

  setDeletingCharacterId(character.id)
  setError('')
  setNotice('')

  try {
    const { error: deleteError } = await supabase.rpc(
      'delete_character',
      { p_character_id: character.id }
    )

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    const remainingCharacters = characters.filter(
      entry => entry.id !== character.id
    )

    setCharacters(remainingCharacters)

    if (selectedCharacterId === character.id) {
      setSelectedCharacterId(remainingCharacters[0]?.id ?? '')
      setItems([])
      setSheet(null)
      setSheetDraft('{}')
      setCharacterGrants([])
      setSheetCharacterView(false)
    }

    setNotice(`Personagem "${character.name}" excluído permanentemente.`)
  } catch (deleteError) {
    const message = deleteError instanceof Error
      ? deleteError.message
      : String(deleteError)

    setError(`Não foi possível excluir o personagem: ${message}`)
  } finally {
    setDeletingCharacterId(null)
  }
}

  async function changeCharacterPlayer(userId: string) {
    if (!selectedCharacter || !isMaster) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')
    const { data, error: updateError } = await supabase
      .from('characters')
      .update({ current_player_id: userId || null })
      .eq('id', selectedCharacter.id)
      .select('id, campaign_id, user_id, name, emoji, archetype, level, strength, visibility, current_player_id, created_at')
      .maybeSingle()
    setVisibilitySaving(false)
    if (updateError || !data) {
      setError(`Não foi possível definir o jogador atual: ${updateError?.message ?? 'permissão negada'}`)
      return
    }
    setCharacters(current => current.map(character => character.id === selectedCharacter.id ? data as Character : character))
    setNotice('Jogador atual do personagem atualizado.')
  }

  async function changeCharacterVisibility(visibility: Character['visibility']) {
    if (!selectedCharacter || !isMaster) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')

    const { data, error: visibilityError } = await supabase
      .from('characters')
      .update({ visibility })
      .eq('id', selectedCharacter.id)
      .select('id, campaign_id, user_id, name, archetype, level, strength, visibility, current_player_id, created_at')
      .maybeSingle()

    setVisibilitySaving(false)
    if (visibilityError || !data) {
      setError(`Não foi possível alterar a visibilidade: ${visibilityError?.message ?? 'permissão negada'}`)
      return
    }

    setCharacters((current) => current.map((character) =>
      character.id === selectedCharacter.id ? data as Character : character
    ))
    setNotice('Visibilidade do personagem atualizada.')
  }

  async function toggleCharacterGrant(userId: string, shouldGrant: boolean) {
    if (!selectedCharacter || !isMaster || userId === selectedCharacter.user_id) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')

    if (shouldGrant) {
      const { error: grantError } = await supabase
        .from('character_visibility')
        .insert({
          character_id: selectedCharacter.id,
          user_id: userId,
          granted_by: session!.user.id,
        })
      if (grantError && !grantError.message.toLowerCase().includes('duplicate')) {
        setError(`Não foi possível autorizar o jogador: ${grantError.message}`)
        setVisibilitySaving(false)
        return
      }
      setCharacterGrants((current) =>
        current.some((grant) => grant.user_id === userId) ? current : [...current, { user_id: userId }]
      )
    } else {
      const { error: revokeError } = await supabase
        .from('character_visibility')
        .delete()
        .eq('character_id', selectedCharacter.id)
        .eq('user_id', userId)
      if (revokeError) {
        setError(`Não foi possível remover a autorização: ${revokeError.message}`)
        setVisibilitySaving(false)
        return
      }
      setCharacterGrants((current) => current.filter((grant) => grant.user_id !== userId))
    }

    setVisibilitySaving(false)
    setNotice('Permissões do personagem atualizadas.')
  }

  async function useScarcityItem(item: Item) {
    const metadata = item.metadata ?? {}
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [item.category]
    if (!categories.includes('Consumíveis') || metadata.scarcityExhausted === true || usingScarcityItemId) return

    const currentLevel = Math.min(4, Math.max(1, Number(metadata.scarcityLevel) || 1))
    const diceByLevel: Record<number, number> = { 1: 12, 2: 8, 3: 6, 4: 4 }
    const chargeByLevel: Record<number, number> = { 1: 7, 2: 5, 3: 3, 4: 1 }
    const die = diceByLevel[currentLevel]
    const roll = Math.floor(Math.random() * die) + 1
    const exhausted = roll === 1 && currentLevel === 4
    const nextLevel = roll === 1 && currentLevel < 4 ? currentLevel + 1 : currentLevel
    const nextMetadata = {
      ...metadata,
      scarcityLevel: nextLevel,
      scarcityDie: `d${diceByLevel[nextLevel]}`,
      scarcityCharge: exhausted ? 0 : chargeByLevel[nextLevel],
      scarcityLastRoll: roll,
      scarcityLastDie: `d${die}`,
      scarcityUses: (Number(metadata.scarcityUses) || 0) + 1,
      scarcityExhausted: exhausted,
    }

    setUsingScarcityItemId(item.id)
    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({ metadata: nextMetadata, ...(exhausted ? { unit_price: 0 } : {}) })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id')
      .maybeSingle()
    setUsingScarcityItemId(null)

    if (updateError || !data) {
      setError(`Não foi possível registrar o uso: ${updateError?.message || 'sem retorno do banco'}`)
      return
    }

    const updatedItem = data as Item
    setItems(current => current.map(entry => entry.id === updatedItem.id ? updatedItem : entry))
    setSelectedItemDetails(updatedItem)
    setNotice(exhausted
      ? `${item.name}: saiu 1 no d4. O item está esgotado!`
      : roll === 1
        ? `${item.name}: saiu 1 no d${die}. Escassez avançou para o nível ${nextLevel} (${nextMetadata.scarcityDie}).`
        : `${item.name}: ${roll} no d${die}. O nível de escassez permanece em ${currentLevel}.`)
  }

  function getAutomaticItemWeight(
    categories: string[],
    equipmentType: 'none' | 'armor' | 'protection',
    armorClass: 'leve' | 'media' | 'pesada',
    weaponClass: string,
  ): number | null {
    if (categories.includes('Armas')) {
      const weaponWeights: Record<string, number> = { improvised: 0.5, advanced: 1, special: 1, black_red: 1.5, mutable: 2 }
      return weaponWeights[weaponClass] ?? 0.5
    }
    if (equipmentType === 'armor') return armorClass === 'pesada' ? 6 : armorClass === 'media' ? 4 : 2
    if (equipmentType === 'protection') return 0
    return null
  }

  function resetItemForm() {
    setEditingItem(null)
    setNewItemName('')
    setNewItemDescription('')
    setNewItemCategory('Diversos')
    setNewItemCategories(['Diversos'])
    setNewWeaponClass('improvised')
    setNewItemQuantity('1')
    setNewItemWeight('0')
    setNewItemUnitPrice('0')
    setNewItemCurrencyId(selectedCampaign?.currency_config?.currencies?.[0]?.id ?? '')
    setNewItemEmoji('📦')
    setNewEquipmentType('none')
    setNewArmorClass('leve')
    setNewArmorCoverage('cortante_perfurante')
    setNewProtectionTier('basica')
    setNewProtectionMode('resistencia')
    setNewScarcityLevel('1')
    setNewScarcityExhausted(false)
    setNewItemRarity('comum')
  }

  function startEditingItem(item: Item) {
    setSelectedCharacterId(item.character_id)
    setEditingItem(item)
    setNewItemUnitPrice(String(item.unit_price ?? 0))
    setNewItemCurrencyId(item.currency_id ?? '')
    setNewItemName(item.name)
    setNewItemDescription(item.description ?? '')
    setNewItemCategory(item.category)
    setNewItemRarity(typeof item.metadata?.rarity === 'string' ? item.metadata.rarity : 'comum')
    setNewScarcityLevel(['1', '2', '3', '4'].includes(String(item.metadata?.scarcityLevel ?? '1')) ? String(item.metadata?.scarcityLevel ?? '1') as '1' | '2' | '3' | '4' : '1')
    setNewScarcityExhausted(item.metadata?.scarcityExhausted === true)
    setNewItemCategories(Array.isArray(item.metadata?.categories) ? item.metadata.categories.filter((value): value is string => typeof value === 'string') : [item.category])
    setNewWeaponClass(typeof item.metadata?.weaponClass === 'string' ? item.metadata.weaponClass : 'improvised')
    setNewEquipmentType(item.metadata?.equipmentType === 'armor' || item.metadata?.equipmentType === 'protection' ? item.metadata.equipmentType : 'none')
    setNewArmorClass(item.metadata?.armorClass === 'media' || item.metadata?.armorClass === 'pesada' ? item.metadata.armorClass : 'leve')
    setNewArmorCoverage(item.metadata?.armorCoverage === 'especial_bruto' || item.metadata?.armorCoverage === 'todos' ? item.metadata.armorCoverage : 'cortante_perfurante')
    setNewProtectionTier(item.metadata?.protectionTier === 'moderada' || item.metadata?.protectionTier === 'avancada' ? item.metadata.protectionTier : 'basica')
    setNewProtectionMode(item.metadata?.protectionMode === 'sanidade' ? 'sanidade' : 'resistencia')
    setNewItemQuantity(String(item.quantity))
    setNewItemWeight(String(item.weight))
    setNewItemEmoji(
      typeof item.metadata?.icon === 'string'
        ? item.metadata.icon
        : '📦',
    )
    setShowItemForm(true)
    setError('')
    setNotice('')
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if ((!selectedCharacterId && !editingItem) || !newItemName.trim()) return

    const quantity = Number(newItemQuantity)
    const weight = Number(newItemWeight.replace(',', '.'))

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      setError('A quantidade deve ser um número inteiro entre 1 e 999.')
      return
    }

    if (!Number.isFinite(weight) || weight < 0 || weight > 100000) {
      setError('Informe um peso válido igual ou maior que zero.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    const itemData = {
      name: newItemName.trim(),
      description: newItemDescription.trim() || null,
      category: newItemCategories[0] ?? newItemCategory,
      quantity,
      weight,
      unit_price: newItemCategories.includes('Consumíveis') && newScarcityExhausted ? 0 : (Number(newItemUnitPrice.replace(',', '.')) || 0),
      currency_id: newItemCurrencyId || null,
      metadata: {
  ...(editingItem?.metadata ?? {}),
  icon: newItemEmoji,
  rarity: newItemRarity,
  categories: newItemCategories.length ? newItemCategories : [newItemCategory],
  equipmentType: newEquipmentType,
  armorClass: newEquipmentType === 'armor' ? newArmorClass : null,
  armorCoverage: newEquipmentType === 'armor' ? (newArmorClass === 'pesada' ? 'todos' : newArmorCoverage) : null,
  protectionTier: newEquipmentType === 'protection' ? newProtectionTier : null,
  protectionMode: newEquipmentType === 'protection' ? newProtectionMode : null,
  scarcityLevel: newItemCategories.includes('Consumíveis') ? Number(newScarcityLevel) : null,
  scarcityDie: newItemCategories.includes('Consumíveis') ? ({ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' } as Record<string, string>)[newScarcityLevel] : null,
  scarcityCharge: newItemCategories.includes('Consumíveis') ? (newScarcityExhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel]) : null,
  scarcityExhausted: newItemCategories.includes('Consumíveis') ? newScarcityExhausted : false,
  weaponClass: newItemCategories.includes('Armas') ? newWeaponClass : null,
  weaponDamage: newItemCategories.includes('Armas') ? ({ improvised: '1d4', advanced: '1d6', special: '1d8', black_red: '1d10', mutable: '1d12' } as Record<string,string>)[newWeaponClass] || '1d4' : null,
  weaponWeight: newItemCategories.includes('Armas') ? weight : null,
},
    }

    let savedItem: Item | null = null

    if (editingItem) {
      const { data, error: updateError } = await supabase
        .from('inventory_items')
        .update(itemData)
        .eq('id', editingItem.id)
        .eq('character_id', editingItem.character_id)
        .select(
          'id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id',
        )
        .maybeSingle()

      if (updateError) {
        setError(`Não foi possível atualizar o item: ${updateError.message}`)
        setLoading(false)
        return
      }

      if (!data) {
        setError(
          'O item não foi atualizado. Verifique as permissões no Supabase.',
        )
        setLoading(false)
        return
      }

      savedItem = data as Item
    } else {
      const { data, error: insertError } = await supabase
        .from('inventory_items')
        .insert({
          character_id: selectedCharacterId,
          ...itemData,
        })
        .select(
          'id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id',
        )
        .single()

      if (insertError) {
        setError(`Não foi possível salvar o item: ${insertError.message}`)
        setLoading(false)
        return
      }

      savedItem = data as Item
    }

    if (!savedItem) {
      setError('Não foi possível confirmar o salvamento do item.')
      setLoading(false)
      return
    }

    if (editingItem) {
      setItems((current) =>
        current.map((item) =>
          item.id === savedItem!.id ? savedItem! : item,
        ),
      )
      setNotice(`"${savedItem.name}" foi atualizado!`)
    } else {
      setItems((current) => [...current, savedItem!])
      setNotice('Item salvo no inventário!')
    }

    resetItemForm()
    setShowItemForm(false)
    setActiveCategory('Todos')
    setSearch('')
    setLoading(false)
  }

  async function changeItemEmoji(item: Item, emoji: string) {
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({
        metadata: {
          ...(item.metadata ?? {}),
          icon: emoji,
        },
      })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select(
        'id, character_id, name, description, category, quantity, weight, metadata',
      )
      .maybeSingle()

    if (updateError) {
      setError(`Não foi possível alterar o emoji: ${updateError.message}`)
      return
    }

    if (!data) {
      setError(
        'O emoji não foi alterado. Verifique as permissões de acesso no Supabase.',
      )
      return
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? (data as Item) : entry,
      ),
    )

    setEmojiPickerItem(null)
    setNotice(`Emoji de "${item.name}" atualizado!`)
  }

  async function changeItemQuantity(item: Item, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return
    if (updatingQuantityItemId === item.id) return

    setUpdatingQuantityItemId(item.id)
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .maybeSingle()

    setUpdatingQuantityItemId(null)

    if (updateError) {
      setError(`Não foi possível alterar a quantidade: ${updateError.message}`)
      return
    }
    if (!data) {
      setError('A quantidade não foi alterada. Verifique as permissões no Supabase.')
      return
    }

    setItems((current) => current.map((entry) => entry.id === item.id ? (data as Item) : entry))
    setNotice(`Quantidade de "${item.name}" atualizada para ${data.quantity}.`)
  }

  async function toggleFavorite(item: Item) {
    const isFavorite = item.metadata?.favorite === true
    const metadata = { ...(item.metadata ?? {}), favorite: !isFavorite }
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('inventory_items')
      .update({ metadata })
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .maybeSingle()

    if (updateError) {
      setError(`Não foi possível atualizar o favorito: ${updateError.message}`)
      return
    }
    if (!data) {
      setError('O favorito não foi atualizado. Verifique as permissões no Supabase.')
      return
    }

    setItems((current) => current.map((entry) => entry.id === item.id ? (data as Item) : entry))
    setNotice(!isFavorite ? `"${item.name}" adicionado aos favoritos.` : `"${item.name}" removido dos favoritos.`)
  }

  async function duplicateItem(item: Item) {
    setError('')
    setNotice('')

    const { data, error: insertError } = await supabase
      .from('inventory_items')
      .insert({
        character_id: item.character_id,
        name: `${item.name} (cópia)`,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        weight: item.weight,
        unit_price: item.unit_price ?? 0,
        currency_id: item.currency_id ?? null,
        metadata: { ...(item.metadata ?? {}), favorite: false },
      })
      .select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked')
      .single()

    if (insertError) {
      setError(`Não foi possível duplicar o item: ${insertError.message}`)
      return
    }

    setItems((current) => [...current, data as Item])
    setNotice(`Cópia de "${item.name}" criada.`)
  }

  async function removeItem(item: Item) {
    const confirmed = window.confirm(
      `Deseja remover "${item.name}" do inventário?`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    const { data, error: deleteError } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', item.id)
      .eq('character_id', item.character_id)
      .select('id')

    if (deleteError) {
      setError(`Não foi possível remover o item: ${deleteError.message}`)
      return
    }

    if (!data?.length) {
      setError(
        'Nenhum item foi removido. Verifique as permissões de acesso no Supabase.',
      )
      return
    }

    let removalDamageMessage = ''
    if (item.metadata?.equipmentType === 'protection' && sheet?.id && selectedCharacterId === item.character_id) {
      const tier = item.metadata?.protectionTier
      const rolls = tier === 'avancada' ? [12, 12, 4] : tier === 'moderada' ? [8, 8] : [8]
      const results = rolls.map(sides => Math.floor(Math.random() * sides) + 1)
      const damage = results.reduce((sum, value) => sum + value, 0)
      const sheetData = sheet.sheet_data as Record<string, any>
      const status = sheetData.status && typeof sheetData.status === 'object' ? sheetData.status : {}
      const current = status.current && typeof status.current === 'object' ? status.current : {}
      const currentPS = Number(current.ps ?? ((Number(sheetData.skills && (sheetData.skills as any).mental) || 0) * 10))
      const nextData = { ...sheetData, status: { ...status, current: { ...current, ps: Math.max(0, currentPS - damage) } } }
      const { error: statusError } = await supabase.from('character_sheets').update({ sheet_data: nextData }).eq('id', sheet.id)
      if (!statusError) {
        setSheet({ ...sheet, sheet_data: nextData })
        setSheetDraft(JSON.stringify(nextData, null, 2))
        removalDamageMessage = ` Dano de sanidade pela perda da proteção: ${results.join(' + ')} = ${damage}.`
      } else {
        setError(`O item foi removido, mas não foi possível aplicar o dano de sanidade: ${statusError.message}`)
      }
    }

    setItems((current) =>
      current.filter((entry) => entry.id !== item.id),
    )
    setNotice(`${item.name} foi removido do inventário.${removalDamageMessage}`)
  }

  const seasonPartyCharacters = characters.filter(character => masterShieldSheets[character.id]?.seasonParticipation === true)
  // A party inclui sempre o mestre da campanha e os jogadores atribuídos
  // aos personagens participantes da temporada.
  const masterShieldPartyUserIds = new Set(
    seasonPartyCharacters.map(character => character.current_player_id).filter((id): id is string => Boolean(id)),
  )
  campaignMembers.filter(member => member.role === 'master').forEach(member => {
    masterShieldPartyUserIds.add(member.user_id)
  })
  const masterShieldPartyMembers = campaignMembers.filter(member => masterShieldPartyUserIds.has(member.user_id))

  const displayName =
    session?.user.user_metadata?.display_name ||
    session?.user.email?.split('@')[0] ||
    'Aventureiro'

  const selectedCharacter = characters.find(
    (character) => character.id === selectedCharacterId,
  )
  // O acesso explícito registrado em character_visibility é uma concessão
  // válida por si só; não deve depender do valor atual de visibility.
  // A campanha também é uma fonte de acesso para personagens compartilhados.
  const hasExplicitCharacterGrant = Boolean(
    session?.user?.id && characterGrants.some(
      grant => grant.user_id === session.user.id,
    ),
  )
  const canAccessSelectedCharacter = Boolean(
    selectedCharacter && session?.user?.id && (
      isMaster ||
      selectedCharacter.user_id === session.user.id ||
      selectedCharacter.visibility === 'campaign' ||
      hasExplicitCharacterGrant
    ),
  )
  // Quem recebeu acesso ao personagem pode consultar a carteira e ajustar
  // as condições atuais da ficha; o banco continua validando a permissão.
  const canEditSelectedSheet = canAccessSelectedCharacter

  async function changeMemberRole(member: CampaignMember) {
    if (!selectedCampaignId || !isMaster || memberActionLoading) return

    const newRole = member.role === 'master' ? 'player' : 'master'
    const action = newRole === 'master' ? 'promover' : 'rebaixar'

    if (
      member.role === 'master' &&
      campaignMembers.filter((entry) => entry.role === 'master').length <= 1
    ) {
      setError('A campanha precisa ter pelo menos um mestre.')
      return
    }

    const confirmed = window.confirm(
      `Deseja ${action} ${member.display_name} ${
        newRole === 'master' ? 'a mestre' : 'a jogador'
      }?`,
    )
    if (!confirmed) return

    setMemberActionLoading(member.user_id)
    setError('')
    setNotice('')

    const { error: rpcError } = await supabase.rpc('set_campaign_member_role', {
      p_campaign_id: selectedCampaignId,
      p_user_id: member.user_id,
      p_role: newRole,
    })

    if (rpcError) {
      setError(`Não foi possível alterar o cargo: ${rpcError.message}`)
      setMemberActionLoading(null)
      return
    }

    setCampaignMembers((current) =>
      current.map((entry) =>
        entry.user_id === member.user_id ? { ...entry, role: newRole } : entry,
      ),
    )

    if (member.user_id === session?.user.id) {
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === selectedCampaignId
            ? { ...campaign, role: newRole }
            : campaign,
        ),
      )
    }

    setNotice(
      `${member.display_name} agora é ${newRole === 'master' ? 'mestre' : 'jogador'}.`,
    )
    setMemberActionLoading(null)
  }

  async function removeCampaignMember(member: CampaignMember) {
    if (!selectedCampaignId || !isMaster || memberActionLoading) return

    if (
      member.role === 'master' &&
      campaignMembers.filter((entry) => entry.role === 'master').length <= 1
    ) {
      setError('Não é possível remover o último mestre da campanha.')
      return
    }

    const confirmed = window.confirm(
      `Tem certeza de que deseja remover ${member.display_name} desta campanha?`,
    )
    if (!confirmed) return

    setMemberActionLoading(member.user_id)
    setError('')
    setNotice('')

    const { error: rpcError } = await supabase.rpc('remove_campaign_member', {
      p_campaign_id: selectedCampaignId,
      p_user_id: member.user_id,
    })

    if (rpcError) {
      setError(`Não foi possível remover o membro: ${rpcError.message}`)
      setMemberActionLoading(null)
      return
    }

    setCampaignMembers((current) =>
      current.filter((entry) => entry.user_id !== member.user_id),
    )

    if (member.user_id === session?.user.id) {
      setCampaigns((current) =>
        current.filter((campaign) => campaign.id !== selectedCampaignId),
      )
      setSelectedCampaignId('')
      setNotice('Você saiu da campanha.')
    } else {
      setNotice(`${member.display_name} foi removido da campanha.`)
    }

    setMemberActionLoading(null)
  }

  const filteredItems = items
    .filter((item) => {
      const matchesCategory =
        activeCategory === 'Todos' || item.category === activeCategory || (Array.isArray(item.metadata?.categories) && item.metadata.categories.includes(activeCategory))
      const term = search.trim().toLowerCase()
      const matchesSearch =
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
      const matchesFavorite = !favoriteOnly || item.metadata?.favorite === true
      return matchesCategory && matchesSearch && matchesFavorite
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name, 'pt-BR')
        case 'category': return a.category.localeCompare(b.category, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR')
        case 'weight': return Number(b.weight) - Number(a.weight)
        case 'quantity': return Number(b.quantity) - Number(a.quantity)
        case 'created':
        default: return items.indexOf(a) - items.indexOf(b)
      }
    })

  const totalObjects = items.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  )

  const totalWeight = items.reduce((sum, item) => {
    const unitWeight = Number(item.weight) || 0
    return sum + unitWeight * (Number(item.quantity) || 0)
  }, 0)

  const maxCapacity = 10 + 2 * (selectedCharacter?.strength ?? 0)
  const remainingCapacity = maxCapacity - totalWeight
  const capacityPercent = Math.min(
    100,
    (totalWeight / maxCapacity) * 100,
  )

  if (authLoading) {
    return <main style={centerStyle}>Verificando sua sessão...</main>
  }

  if (!session) return <Auth />

  return (
    <div className={`app-shell theme-${activeThemeKey}`} style={{'--season-primary': activeTheme.primary, '--season-secondary': activeTheme.secondary, '--season-glow': activeTheme.glow, '--season-bg': activeTheme.bg, '--season-surface': activeTheme.surface, '--season-surface-alt': activeTheme.surfaceAlt, '--season-line': activeTheme.line, '--season-line-soft': activeTheme.glow.replace(/\.\d+\)/, '.14)'), '--season-muted': '#b9b4c2', '--season-on-primary': activeTheme.onPrimary,  '--season-panel-tint': activeTheme.surfaceAlt, '--purple': activeTheme.primary, '--purple-bright': activeTheme.primary, '--purple-dark': activeTheme.secondary} as React.CSSProperties}>
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="HäxBag, início">
          <span className="brand-mark">H</span>
          <span>
            Häx<span className="brand-light">Bag</span>
          </span>
        </a>

        <div className="workspace-label">ESPAÇO DE JOGO</div>

        <div style={{ padding: '0 12px' }}>
          <label style={labelStyle}>Campanha selecionada</label>
          <select
            value={selectedCampaignId}
            onChange={async (event) => {
              const campaignId = event.target.value
              setSelectedCampaignId(campaignId)
              const { error: preferenceError } = await supabase.auth.updateUser({ data: { primary_campaign_id: campaignId || null } })
              if (preferenceError) setError(`Campanha selecionada, mas não foi possível salvar como principal: ${preferenceError.message}`)
              else setNotice('Campanha principal atualizada para este perfil.')
            }}
            style={inputStyle}
          >
            <option value="">Selecione uma campanha</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowCampaignForm((value) => !value)}
            style={secondaryButtonStyle}
          >
            + Nova campanha
          </button>
        </div>

        <div className="nav-label">MENU PRINCIPAL</div>

        <nav className="navigation">
          <a className="nav-link" href="#inicio"><span>◫</span> Visão geral</a>
          {isMaster && <button className={`nav-link ${activePage === 'master-shield' ? 'active' : ''}`} onClick={() => setActivePage('master-shield')} disabled={!selectedCampaignId}>
            <span>♜</span> Escudo do mestre
          </button>}
          <button className={`nav-link ${activePage === 'sheets' ? 'active' : ''}`} onClick={() => { setActivePage('sheets'); setSheetCharacterView(false) }} disabled={!selectedCampaignId}>
            <span>▧</span> Fichas <span className="nav-count">{characters.length}</span>
          </button>
          <button className={`nav-link ${activePage === 'characters' ? 'active' : ''}`} onClick={() => setActivePage('characters')} disabled={!selectedCampaignId}>
            <span>♙</span> Personagens <span className="nav-count">{characters.length}</span>
          </button>
          <button className={`nav-link ${activePage === 'shops' ? 'active' : ''}`} onClick={() => setActivePage('shops')} disabled={!selectedCampaignId}>
            <span>♜</span> Lojas <span className="nav-count">{shops.length}</span>
          </button>
          <button className={`nav-link ${activePage === 'campaigns' ? 'active' : ''}`} onClick={() => { setActivePage('campaigns'); setShowCampaignForm(false) }}>
            <span>⚑</span> Campanhas
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="invite-card">
            <div className="invite-icon">✧</div>
            <strong>Convide seu grupo.</strong>
            <p>{!selectedCampaignId
              ? 'Escolha uma campanha para gerar um convite e reunir seus jogadores.'
              : isMaster
                ? 'Compartilhe um link e traga novos jogadores para esta campanha.'
                : 'Tem um convite? Acesse campanhas para entrar em uma nova aventura.'}</p>
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: 10, width: '100%' }}
onClick={() => {
  resetItemForm()
  setShowItemForm(true)
}}
              disabled={inviteLoading}
            >
              {inviteLoading ? 'Gerando convite…' : selectedCampaignId && isMaster ? 'Gerar convite' : 'Ver campanhas'}
            </button>
            {campaignInviteLink && selectedCampaignId && isMaster && (
              <button
                type="button"
                className="nav-link"
                style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  void navigator.clipboard.writeText(campaignInviteLink)
                  setNotice('Link copiado!')
                }}
              >
                Copiar link do convite
              </button>
            )}
          </div>

          <div className="profile">
            <div className="avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{displayName}</strong>
              <small>{session.user.email}</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content" id="inicio">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Campanhas</span>
            <span className="crumb-slash">/</span>
            <strong>{selectedCampaign?.name ?? 'Suas campanhas'}</strong>
          </div>

          <div className="topbar-right">
            <span className="online-dot" />
            Conectado
            <button
              type="button"
              onClick={handleSignOut}
              style={secondaryButtonStyle}
            >
              Sair
            </button>
          </div>
        </header>

        <div className={`page-content page-${activePage}`}>
          <style>{`
          .page-content.page-shops > * {
  display: none !important;
}

.page-content.page-shops > .shops-page-panel {
  display: block !important;
}
            .page-content.page-master-shield > * { display: none !important; }
            .page-content.page-master-shield > .master-shield-page-panel { display: block !important; }
            .page-content.page-sheets > * { display: none !important; }
            .page-content.page-sheets > .sheet-page-panel { display: block !important; }
            .page-content.page-characters > * { display: none !important; }
            .page-content.page-characters > .characters-page-panel { display: block !important; }
            .page-content.page-campaigns > * { display: none !important; }
            .page-content.page-campaigns > .campaigns-page-panel { display: block !important; }
            .page-content.page-campaigns > #inventario {
              display: block !important;
            }
            .page-content.page-inventory > .season-sheet-section { display: none !important; }
          `}</style>
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span /> SUA JORNADA COMEÇA AQUI
              </div>

<h1>
  {activePage === 'shops'
      ? 'Lojas da campanha'
      : activePage === 'sheets'
        ? 'Fichas de personagens'
        : activePage === 'characters'
          ? 'Personagens'
          : 'Campanhas'}
  <span className="title-period">.</span>
</h1>

<p className="page-description">
  {activePage === 'shops'
      ? 'Explore os estabelecimentos e encontre novos itens para sua aventura.'
      : activePage === 'sheets'
        ? 'Consulte e atualize as fichas por temporada.'
        : activePage === 'characters'
          ? 'Crie personagens e gerencie quem pode acessá-los.'
          : 'Organize suas campanhas e escolha qual deseja administrar.'}
</p>

            </div>

            {activePage === 'campaigns' && (
              <button
                className="primary-button"
                onClick={() => setShowCampaignForm((value) => !value)}
              >
                + Criar campanha
              </button>
            )}
          </section>

          {activePage === 'master-shield' && selectedCampaign && isMaster && (
            <section className="inventory-section master-shield-page-panel">
              <section className="master-shield" aria-labelledby="master-shield-title">
                <div className="master-shield-heading"><div><span className="master-shield-eyebrow">PAINEL DO MESTRE</span><h2 id="master-shield-title">Escudo do mestre</h2><p>Resumo rápido das informações básicas da party.</p></div><span className="master-shield-icon" aria-hidden="true">♜</span></div>
                <div className="master-shield-grid">
                  <article className="master-shield-stat"><span>Campanha</span><strong>{selectedCampaign.name}</strong></article>
                  <article className="master-shield-stat"><span>Sistema</span><strong>{selectedCampaign.system_name || 'Não definido'}</strong></article>
                  <article className="master-shield-stat"><span>Integrantes da party</span><strong>{masterShieldPartyMembers.length}</strong></article>
                  <article className="master-shield-stat"><span>Personagens</span><strong>{characters.length}</strong></article>
                </div>
                {selectedCampaign.description && <div className="master-shield-description"><strong>Descrição da campanha</strong><p>{selectedCampaign.description}</p></div>}
                <div className="master-shield-columns">
                  <div><h3>Integrantes da party</h3>{masterShieldPartyMembers.length ? <ul>{masterShieldPartyMembers.map(member => <li key={member.user_id}><span>{member.display_name}</span><small>{member.role === 'master' ? 'Mestre' : 'Jogador'}</small></li>)}</ul> : <p className="master-shield-empty">Nenhum integrante encontrado.</p>}</div>
                  <div>
                    <h3>Personagens da temporada</h3>
                    <label style={labelStyle}>Temporada<select value={masterShieldSeasonId} onChange={e => setMasterShieldSeasonId(e.target.value)} style={inputStyle}><option value="">Selecione uma temporada</option>{seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name}</option>)}</select></label>
                    {masterShieldLoading ? <p className="master-shield-empty">Carregando personagens...</p> : !masterShieldSeasonId ? <p className="master-shield-empty">Selecione uma temporada para visualizar os personagens.</p> : characters.length ? <div className="master-shield-character-list">{characters.map(character => {
                      const data = masterShieldSheets[character.id]
                      if (!data || data.seasonParticipation !== true) return null
                      const family = KISATSUTAI_FAMILY_TIERS[String(data.family?.tier ?? '5') as keyof typeof KISATSUTAI_FAMILY_TIERS] || KISATSUTAI_FAMILY_TIERS['5']
                      const rankId = String(data.progression?.rankId ?? 'zaidan')
                      const rank = KISATSUTAI_RANK_STATUS[rankId] || { pv: 0, ps: 0, pr: 0 }
                      const n = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
                      const allocations = data.progression?.allocations ?? {}
                      const allocated = (key: string) => ['family','class','progression'].reduce((sum, source) => sum + Math.max(0,n(allocations[source]?.[key])),0)
                      const attr = (key: string, bonus: number) => Math.min(5,Math.max(0,n(data.attributes?.[key])+allocated(key)+bonus))
                      const skill = (key: string) => Math.min(12,Math.max(0,n(data.skills?.[key])+allocated(key)))
                      const maxes = { pv: skill('vigor')*10+family.pv+rank.pv+n(data.progression?.classStatus?.pv)+n(data.progression?.statusBonuses?.pv), ps: skill('mental')*10+family.ps+rank.ps+n(data.progression?.classStatus?.ps)+n(data.progression?.statusBonuses?.ps), pr: (attr('breathing',family.breathing)+skill('ability'))*10+family.pr+rank.pr+n(data.progression?.classStatus?.pr)+n(data.progression?.statusBonuses?.pr) }
                      const current = data.status?.current ?? {}
                      const stats = ([['PV',maxes.pv],['PS',maxes.ps],['PR',maxes.pr]] as const).map(([key,max]) => {
                        const id=key.toLowerCase() as 'pv'|'ps'|'pr'
                        const rawValue=n(current[id] ?? max)
                        // PV pode ultrapassar o máximo normal; PS e PR continuam limitados.
                        const value=Math.max(0,key==='PV'?rawValue:Math.min(max,rawValue))
                        const extra=key==='PV'?Math.max(0,value-max):0
                        return {key,max,value,extra,pct:max>0?Math.min(100,value/max*100):0,extraPct:max>0?Math.min(100,extra/max*100):0}
                      })
                      return <button type="button" className="master-shield-character" key={character.id} onClick={() => { setSelectedSeasonId(masterShieldSeasonId); setSelectedCharacterId(character.id); setSheetCharacterView(true); setActivePage('sheets') }}><div className="master-shield-character-title"><strong>{character.emoji ? `${character.emoji} ` : ''}{character.name}</strong><small>{String(data.progression?.rankName || KISATSUTAI_RANKS.find(entry=>entry.id===rankId)?.name || character.archetype || 'Sem graduação')}</small></div><div className="master-shield-bars">{stats.map(stat=><div className="master-shield-bar-row" key={stat.key}><span>{stat.key}</span><strong>{stat.value} / {stat.max}</strong><div className="master-shield-bar"><i style={{width:`${stat.pct}%`}}/></div>{stat.extra>0&&<><span className="master-shield-extra-name">PV Ex.</span><strong className="master-shield-extra-value">+ {stat.extra}</strong><div className="master-shield-bar master-shield-bar-extra"><i style={{width:`${stat.extraPct}%`}}/></div></>}</div>)}</div><small className="master-shield-open-hint">Clique para abrir a ficha</small></button>
                    })}{!characters.some(character => masterShieldSheets[character.id]?.seasonParticipation === true) && <p className="master-shield-empty">Nenhum personagem possui ficha nesta temporada.</p>}</div> : <p className="master-shield-empty">Ainda não há personagens cadastrados.</p>}
                  </div>
                </div>
              </section>
            </section>
          )}

          {activePage === 'sheets' && selectedCampaignId && (
            <section className="inventory-section sheet-page-panel">
            {isMaster && selectedCampaignId && !sheetCharacterView && (
  <form className="add-form" onSubmit={createSeason}>
    <h3>Criar nova temporada</h3>

    <label style={labelStyle}>
      Nome da temporada
      <input
        value={newSeasonName}
        onChange={e => setNewSeasonName(e.target.value)}
        placeholder="Ex.: A Jornada Começa"
        required
        style={inputStyle}
      />
    </label>

    <label style={labelStyle}>
      Descrição
      <input
        value={newSeasonDescription}
        onChange={e => setNewSeasonDescription(e.target.value)}
        placeholder="Uma breve descrição da temporada"
        style={inputStyle}
      />
    </label>

    <button className="primary-button" type="submit">
      Criar temporada
    </button>
  </form>
)}
              {!sheetCharacterView ? <>
                <div className="inventory-heading"><div><h2>Fichas de personagens</h2><p>Escolha um personagem para abrir sua ficha.</p></div></div>
                {characters.length === 0 ? <div className="empty-state"><h3>Nenhum personagem nesta campanha</h3><p>Crie um personagem antes de montar sua ficha.</p><button className="primary-button" onClick={() => { setActivePage('characters'); setShowCharacterForm(true) }}>Criar personagem</button></div> : <div className="item-grid">{characters.map(character => <article className="item-card" key={character.id}><div className="item-art">{character.emoji || '⚔️'}</div><div className="item-category">{String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') ? 'KISATSUTAI' : `NÍVEL ${character.level}`}</div><h3>{character.name}</h3><p className="item-description">{character.archetype || 'Arquétipo não definido'}</p>{String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') && <p className="item-description">⛩️ {characterRanks[character.id] || 'Graduação não definida'}</p>}<button className="primary-button" onClick={() => { setSelectedCharacterId(character.id); setSheetCharacterView(true) }}>Abrir ficha</button></article>)}</div>}
              </> : <>
                <div className="inventory-heading"><div><h2>Ficha de {selectedCharacter?.name ?? 'personagem'}</h2><p>{selectedCampaign?.name} · Kisatsutai RPG</p></div><button className="secondary-button" onClick={() => setSheetCharacterView(false)}>← Lista de personagens</button></div>
                <label style={labelStyle}>Temporada<select value={selectedSeasonId} onChange={e => setSelectedSeasonId(e.target.value)} style={inputStyle}><option value="">Selecione uma temporada</option>{seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name} ({season.status})</option>)}</select></label>
                {selectedSeasonId && !sheetLoading && <label className={`season-participation-toggle ${(() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() ? 'is-participating' : ''}`}><input type="checkbox" checked={(() => { try { return (() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() } catch { return false } })()} disabled={!canEditSelectedSheet || sheetSaving} onChange={e => { void toggleSeasonParticipation(e.target.checked) }} /><span><strong>{(() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() ? 'Participando desta temporada' : 'Não participa desta temporada'}</strong><small>{sheetSaving ? 'Salvando participação…' : 'Altere esta opção para incluir ou retirar o personagem. A ficha e o histórico permanecem preservados.'}</small></span><b className="season-participation-status">{sheetSaving ? '…' : (() => { try { return JSON.parse(sheetDraft || '{}').seasonParticipation === true } catch { return false } })() ? 'ATIVO' : 'INATIVO'}</b></label>}
                {isMaster && selectedSeasonId && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,margin:'12px 0'}}><label style={labelStyle}>Nome da temporada<input value={seasonNameDraft} onChange={e=>setSeasonNameDraft(e.target.value)} style={inputStyle}/></label><label style={labelStyle}>Descrição<input value={seasonDescriptionDraft} onChange={e=>setSeasonDescriptionDraft(e.target.value)} style={inputStyle}/></label><button className="primary-button" type="button" onClick={()=>void saveSeasonDetails()}>Salvar detalhes da temporada</button><label style={labelStyle}>Status<select value={seasons.find(s=>s.id===selectedSeasonId)?.status ?? 'draft'} onChange={e=>void changeSeasonStatus(e.target.value as Season['status'])} style={inputStyle}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="completed">Concluída</option><option value="archived">Arquivada</option></select></label></div>}
                {selectedSeasonId && <div className="season-theme-panel">
                  <div className="season-theme-heading"><div><strong>Identidade visual</strong><small>Tema desta temporada: <b>{activeTheme.label}</b></small></div><span className="season-theme-current-swatch" style={{background:`linear-gradient(135deg,${activeTheme.primary},${activeTheme.secondary})`}} /></div>
                  {isMaster ? <div className="season-theme-options">{(Object.entries(seasonThemes) as [keyof typeof seasonThemes, typeof seasonThemes[keyof typeof seasonThemes]][]).map(([key,theme])=><button key={key} type="button" disabled={seasonThemeSaving} onClick={()=>void saveSeasonTheme(key)} className={`season-theme-option ${activeThemeKey===key?'active':''}`}><span className="season-theme-swatches"><i style={{background:theme.primary}}/><i style={{background:theme.secondary}}/></span><span>{theme.label}</span>{activeThemeKey===key&&<b>✓</b>}</button>)}</div> : <small>O mestre escolhe o tema desta temporada.</small>}
                </div>}

                {!selectedSeasonId ? <p>Crie ou selecione uma temporada para editar a ficha.</p> : sheetLoading ? <p>Carregando ficha…</p> : <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',margin:'14px 0'}}>
                    <p style={{color:'var(--season-muted, #b9b4c2)',margin:0}}>Consulte os dados calculados da ficha. As alterações ficam concentradas no modo de edição.</p>
                    {canEditSelectedSheet && <button className="primary-button" type="button" onClick={()=>setEditingSheet(value=>!value)}>{editingSheet?'Fechar edição':'Editar ficha'}</button>}
                  </div>
                  {(() => {
                    let data: Record<string, any> = {}
                    try { data = JSON.parse(sheetDraft) } catch { data = {} }
                    const read = (path: string, fallback: any = 0) => path.split('.').reduce((obj: any, key) => obj && typeof obj === 'object' ? obj[key] : undefined, data) ?? fallback
                    const write = (path: string, value: any) => {
                      const next = { ...data }
                      const parts = path.split('.')
                      let node: Record<string, any> = next
                      for (const part of parts.slice(0, -1)) {
                        if (!node[part] || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part] = {}
                        else node[part] = { ...node[part] }
                        node = node[part]
                      }
                      node[parts[parts.length - 1]] = value
                      setSheetDraft(JSON.stringify(next, null, 2))
                    }
                    const familyTierKey = String(read('family.tier', '5')) as keyof typeof KISATSUTAI_FAMILY_TIERS
                    const familyTier = KISATSUTAI_FAMILY_TIERS[familyTierKey] || KISATSUTAI_FAMILY_TIERS['5']
                    const isKisatsutaiSheet = String(read('progression.system', selectedCampaign?.system_name || 'Kisatsutai')).toLowerCase().includes('kisatsutai')
                    const allocationSources = ['family', 'hierarchy', 'extra'] as const
                    const familyAllocationKeys = ['strength','agility','defense','breathing','intellect'] as const

                    const allocationLabels: Record<string,string> = {strength:'Força',agility:'Agilidade',defense:'Defesa',breathing:'Respiração',intellect:'Intelecto',vigor:'Vigor',mental:'Mental',combat:'Combate',dexterity:'Destreza',resistance:'Resistência',ability:'Habilidade'}
                    const skillKeys = ['vigor','mental','combat','dexterity','resistance','ability'] as const
                    const allocation = (source: string, key: string) => { if (!(familyAllocationKeys as readonly string[]).includes(key)) return 0; const own = Math.max(0, Math.floor(Number(read(`progression.allocations.${source}.${key}`, 0)) || 0)); const legacyClass = source === 'extra' ? Math.max(0, Math.floor(Number(read(`progression.allocations.class.${key}`, 0)) || 0)) : 0; return own + legacyClass }
                    const allocationPool = (source: typeof allocationSources[number]) => source === 'family' ? (isKisatsutaiSheet ? familyTier.points : 0) : source === 'hierarchy' ? rankAttributePoints : numRaw('progression.extraAttributePoints') + numRaw('progression.attributePoints') + numRaw('progression.manualExtraAttributePoints')
                    const familyTierMinimum = (key: typeof familyAllocationKeys[number]) => isKisatsutaiSheet ? Math.max(0, Number(familyTier[key]) || 0) : 0
                    const familyTierMinimumTotal = familyAllocationKeys.reduce((sum, key) => sum + familyTierMinimum(key), 0)
                    // Pontos extras de atributos concedidos por graduação, conforme benefícios explicitamente documentados.
                    // Graduações sem quantidade definida no material não concedem pontos automáticos aqui.
                    const rankIdForAttributes = String(read('progression.rankId', 'zaidan'))
                    const rankIdForStatus = rankIdForAttributes
                    const rankAttributePointsById: Record<string, number> = { zaidan: 1, mizunoto: 1, mizunoe: 2, hinoto: 4, hinoe: 5, kinoto: 5, kinoe: 6, 'hashira-inferior': 10 }
                    const rankAttributePoints = isKisatsutaiSheet ? (rankAttributePointsById[rankIdForAttributes] ?? 0) : 0
                    const numRaw = (path: string) => { const value = Number(read(path, 0)); return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }
                    const num = (path: string) => {
                      const match = path.match(/^(attributes|skills)\.(.+)$/)
                      // Não há bases de perícia definidas por família/tier no material; portanto, a base é 0.
                      const base = match?.[1] === 'skills' ? 0 : numRaw(path)
                      if (!match) return base
                      const key = match[2]
                      const sourceBonus = match[1] === 'attributes'
                        ? allocationSources.reduce((sum, source) => sum + allocation(source, key), 0)
                        : skillKeys.includes(key as typeof skillKeys[number])
                          ? (['hierarchy','intellect','extra'] as const).reduce((sum, source) => sum + Math.max(0, Math.floor(Number(read(`skills.pointAllocations.${source}.${key}`, 0)) || 0)), 0)
                          : 0
                      return Math.min(match[1] === 'attributes' ? 5 : 12, base + sourceBonus)
                    }
                    const effectiveAttribute = (path: string, bonus: number) => Math.min(5, Math.max(0, num(path) + (isKisatsutaiSheet ? bonus : 0)))
                    const agility = Math.floor(effectiveAttribute('attributes.agility', familyTier.agility))
                    const movementActions = 1 + Math.floor(agility / 2)
                    const extraActions = agility % 2
                    const dexterity = Math.min(12, num('skills.dexterity'))
                    const intellect = Math.floor(effectiveAttribute('attributes.intellect', familyTier.intellect))
                    const choices: string[] = Array.isArray(read('skills.intelligenceChoices', [])) ? read('skills.intelligenceChoices', []) : []
                    const mainAllocations = Array.from({ length: intellect }, (_, i) => choices[i] === 'extra' ? 'extra' : 'main')
                    const mainPoints = mainAllocations.filter(v => v === 'main').length * 5
                    const extraLevels = mainAllocations.filter(v => v === 'extra').length
                    const skillLabels: Record<typeof skillKeys[number], string> = {vigor:'Vigor',mental:'Mental',combat:'Combate',dexterity:'Destreza',resistance:'Resistência',ability:'Habilidade'}
                    const rankBenefitsText = KISATSUTAI_RANKS.find(rank => rank.id === rankIdForStatus)?.benefits || ''
                    const rankSkillPointsMatch = rankBenefitsText.match(/(\d+) pontos? de perícias?/i)
                    const hierarchySkillPool = isKisatsutaiSheet ? Number(rankSkillPointsMatch?.[1] || 0) : 0
                    const extraSkillPool = numRaw('progression.classSkillPoints') + numRaw('progression.manualExtraSkillPoints')
                    const skillAllocations = (source: 'hierarchy'|'intellect'|'extra', key: typeof skillKeys[number]) => Math.max(0, Math.floor(Number(read(`skills.pointAllocations.${source}.${key}`, 0)) || 0))
                    const skillPool = (source: 'hierarchy'|'intellect'|'extra') => source === 'hierarchy' ? hierarchySkillPool : source === 'intellect' ? mainPoints : extraSkillPool
                    const skillTotalUsed = (source: 'hierarchy'|'intellect'|'extra') => skillKeys.reduce((sum,key)=>sum+skillAllocations(source,key),0)
                    const skillAllocatedTotal = (key: typeof skillKeys[number]) => skillAllocations('hierarchy',key)+skillAllocations('intellect',key)+skillAllocations('extra',key)
                    const setSkillAllocation = (key: typeof skillKeys[number], value: number) => {
                      const next = { ...data, skills: { ...(data.skills || {}), pointAllocations: { ...(data.skills?.pointAllocations || {}) } } }
                      let left = Math.max(0, Math.min(12, Math.floor(Number(value)||0)))
                      for (const source of ['hierarchy','intellect','extra'] as const) {
                        const otherSpent = skillKeys.reduce((sum,item)=>sum+skillAllocations(source,item),0)-skillAllocations(source,key)
                        const capacity = Math.max(0,skillPool(source)-otherSpent)
                        const assigned = Math.min(left,capacity)
                        next.skills.pointAllocations[source] = { ...(next.skills.pointAllocations[source] || {}), [key]: assigned }
                        left -= assigned
                      }
                      setSheetDraft(JSON.stringify(next,null,2))
                    }
                    const vigor = Math.min(12, num('skills.vigor'))
                    const mental = Math.min(12, num('skills.mental'))
                    const breathing = effectiveAttribute('attributes.breathing', familyTier.breathing)
                    const ability = Math.min(12, num('skills.ability'))
                    const defense = effectiveAttribute('attributes.defense', familyTier.defense)
                    const reactions = defense + 1
                    const combat = Math.min(12, num('skills.combat'))
                    const resistance = Math.min(12, num('skills.resistance'))
                    const strength = effectiveAttribute('attributes.strength', familyTier.strength)
                    const rankName = String(
  read(
    'progression.rankName',
    KISATSUTAI_RANKS.find(rank => rank.id === rankIdForStatus)?.name || 'Zaidan'
  )
)
                    const hierarchyGroup = KISATSUTAI_RANKS.find(rank => rank.id === rankIdForStatus)?.group || 'Carpa'
                    const baseDamageByGroup: Record<string,string> = { Carpa:'1d4', Raposa:'1d6', Tigre:'1d8', Dragão:'1d10', Corvo:'1d12' }
                    const equippedWeapon = items.find(item => item.character_id === selectedCharacterId && item.metadata?.equipped === true && Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas'))
                    const equippedWeaponDamage = equippedWeapon ? String(equippedWeapon.metadata?.weaponDamage || '—') : '—'
                    const equippedArmor = items.find(item => item.character_id === selectedCharacterId && item.metadata?.equipped === true && item.metadata?.equipmentType === 'armor')
                    const equippedProtection = items.filter(item => item.character_id === selectedCharacterId && item.metadata?.equipped === true && item.metadata?.equipmentType === 'protection')
                    const armorClass = String(equippedArmor?.metadata?.armorClass || 'leve')
                    const armorDexterity = !equippedArmor ? dexterity : armorClass === 'pesada' ? 0 : armorClass === 'media' ? Math.floor(dexterity / 2) : dexterity
                    const armorResistance = armorClass === 'pesada' ? resistance * 2 + 8 : armorClass === 'media' ? resistance + 6 : Math.floor(resistance / 2) + 4
                    const armorCovers = (type: 'cortante_perfurante' | 'especial_bruto') => !!equippedArmor && (armorClass === 'pesada' || equippedArmor.metadata?.armorCoverage === type)
                    const protectionFraction = (item: Item) => item.metadata?.protectionTier === 'avancada' ? 1 : item.metadata?.protectionTier === 'moderada' ? 0.5 : 0.25
                    const physicalProtection = equippedProtection.filter(item => item.metadata?.protectionMode !== 'sanidade').reduce((sum, item) => sum + Math.floor(resistance * protectionFraction(item)), 0)
                    const sanityProtection = equippedProtection.filter(item => item.metadata?.protectionMode === 'sanidade').reduce((sum, item) => sum + Math.floor(mental * protectionFraction(item)), 0)
                    const baseDamage = baseDamageByGroup[hierarchyGroup] || '—'
                    const rollD20 = () => Math.floor(Math.random()*20)+1
                    const performCombatRoll = (kind: 'Ataque bruto'|'Ataque ágil'|'Bloqueio'|'Esquiva', dodgeDt?: string) => {
                      const constitution = Number(read('attributes.constitution', 0)) || resistance + vigor
                      const attribute = kind === 'Ataque bruto' ? strength : kind === 'Bloqueio' ? defense : agility
                      const bonus = kind === 'Bloqueio' ? constitution : kind === 'Esquiva' ? dexterity : combat
                      const diceCount = Math.max(1, Math.floor(attribute))
                      const dice = Array.from({ length: diceCount }, () => rollD20())
                      const diceTotal = dice.reduce((sum, value) => sum + value, 0)
                      const total = 1 + diceTotal + bonus
                      const diceDescription = `${diceCount}d20 = [${dice.join(', ')}] (soma ${diceTotal})`

                      if (kind === 'Bloqueio') {
                        const target = dodgeDt !== undefined && dodgeDt.trim() !== '' ? Number(dodgeDt) : null
                        const validTarget = target !== null && Number.isFinite(target) && target >= 0
                        const critical = dice.includes(20)
                        const succeeded = validTarget && total >= target!
                        const outcome = critical
                          ? 'Crítico: nega 100% do dano.'
                          : !validTarget
                            ? 'Informe a DT do inimigo no campo ao lado das reações.'
                            : succeeded
                              ? `Sucesso contra DT ${target}: nega 50% do dano.`
                              : `Falha contra DT ${target}: nega 25% do dano.`
                        setBlockIncomingDamage('')
                        setBlockDamageReduction(critical ? null : !validTarget ? null : succeeded ? 0.5 : 0.25)
                        setCombatActionResult(`Bloqueio: ${diceDescription}; 1 + ${diceTotal} + Constituição (${bonus}) = ${total}. ${outcome}`)
                      } else if (kind === 'Esquiva') {
                        const target = dodgeDt !== undefined && dodgeDt.trim() !== '' ? Number(dodgeDt) : null
                        const validTarget = target !== null && Number.isFinite(target) && target >= 0
                        const outcome = validTarget ? (total >= target! ? `Sucesso contra DT ${target}: nega o dano completamente.` : `Falha contra DT ${target}: não evita o dano.`) : 'Informe a DT do inimigo no campo ao lado das reações.'
                        setCombatActionResult(`Esquiva: ${diceDescription}; 1 + ${diceTotal} + Destreza (${bonus}) = ${total}. ${outcome}`)
                      } else {
                        setCombatActionResult(`${kind}: ${diceDescription}; 1 + ${diceTotal} + Combate (${bonus}) = ${total}.`)
                      }
                      return total
                    }
                    const applyBlockedDamage = () => {
                      const incoming = Number(blockIncomingDamage)
                      if (!Number.isFinite(incoming) || incoming < 0 || blockDamageReduction === null) {
                        setError('Informe um dano inimigo válido (zero ou maior).')
                        return
                      }
                      const prevented = Math.floor(incoming * blockDamageReduction)
                      const remaining = incoming - prevented
                      const currentStatus = data.status && typeof data.status === 'object' && !Array.isArray(data.status)
                        ? data.status as Record<string, any> : {}
                      const currentValues = currentStatus.current && typeof currentStatus.current === 'object'
                        ? currentStatus.current as Record<string, any> : {}
                      const maxPV = Number(derived[0][1]) || 0
                      const currentPVValue = Number(currentValues.pv ?? maxPV)
                      const currentPV = Number.isFinite(currentPVValue) ? Math.max(0, currentPVValue) : maxPV
                      const nextPV = Math.max(0, currentPV - remaining)
                      const next = {
                        ...data,
                        status: {
                          ...currentStatus,
                          current: {
                            ...currentValues,
                            pv: nextPV,
                            ps: Number(currentValues.ps ?? derived[1][1]),
                            pr: Number(currentValues.pr ?? derived[2][1]),
                          },
                        },
                      }
                      setSheetDraft(JSON.stringify(next, null, 2))
                      void saveCharacterConditions(next)
                      setCombatActionResult(previous => `${previous} Dano recebido: ${incoming}. Dano negado: ${prevented}. Dano aplicado aos PV: ${remaining}. PV restantes: ${nextPV}.`)
                      setBlockDamageReduction(null)
                      setBlockIncomingDamage('')
                      setError('')
                    }
                    const rankStatus = isKisatsutaiSheet ? (KISATSUTAI_RANK_STATUS[rankIdForStatus] || { pv: 0, ps: 0, pr: 0 }) : { pv: 0, ps: 0, pr: 0 }
                    const customClassPV = num('progression.classStatus.pv')
                    const customClassPS = num('progression.classStatus.ps')
                    const customClassPR = num('progression.classStatus.pr')
                    const classPV = rankStatus.pv + customClassPV
                    const classPS = rankStatus.ps + customClassPS
                    const classPR = rankStatus.pr + customClassPR
                    const progressionPV = num('progression.statusBonuses.pv')
                    const progressionPS = num('progression.statusBonuses.ps')
                    const progressionPR = num('progression.statusBonuses.pr')
                    const familyPV = isKisatsutaiSheet ? familyTier.pv : 0
                    const familyPS = isKisatsutaiSheet ? familyTier.ps : 0
                    const familyPR = isKisatsutaiSheet ? familyTier.pr : 0
                    const derived = [
                      ['Pontos de Vida (PV)', vigor * 10 + familyPV + classPV + progressionPV, `Vigor × 10 (${vigor * 10}) + família (${familyPV}) + classe (${classPV}) + progressão (${progressionPV})`],
                      ['Pontos de Sanidade (PS)', mental * 10 + familyPS + classPS + progressionPS, `Mental × 10 (${mental * 10}) + família (${familyPS}) + classe (${classPS}) + progressão (${progressionPS})`],
                      ['Pontos de Respiração (PR)', (breathing + ability) * 10 + familyPR + classPR + progressionPR, `(Respiração + Habilidade) × 10 + família (${familyPR}) + classe (${classPR}) + progressão (${progressionPR})`],
                    ] as const
                    const field = (path: string, label: string, type: 'number' | 'text' = 'number', hint?: string) => { const limit = path.startsWith('attributes.') ? 5 : path.startsWith('skills.') ? 12 : undefined; return <label key={path} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{label}<input type={type} min={type === 'number' ? 0 : undefined} max={type === 'number' ? limit : undefined} step="1" value={String(read(path, type === 'number' ? 0 : ''))} onChange={e => write(path, type === 'number' ? Math.min(limit ?? 999, Math.max(0, e.target.value === '' ? 0 : Number(e.target.value))) : e.target.value)} style={inputStyle}/>{hint && <small style={{color:'var(--season-muted, #b9b4c2)'}}>{hint}{limit ? ` · máximo ${limit}` : ''}</small>}</label> }
                    const area = (path: string, label: string) => <label key={path} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{label}<textarea rows={3} value={String(read(path, ''))} onChange={e=>write(path,e.target.value)} style={{...inputStyle,fontFamily:'inherit',resize:'vertical'}}/></label>
                    const panel = (title: string, children: any) => <details className="sheet-editor-accordion" style={{padding:16,margin:'14px 0',border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:12,background:'var(--season-bg, var(--season-bg, #100e19))'}}><summary>{title}</summary><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,marginTop:14}}>{children}</div></details>
                    return (
                      <>
  {isKisatsutaiSheet && (
    <section
      aria-label="Graduação atual"
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 20px',
        margin: '0 0 18px',
        border: '1px solid var(--season-line, rgba(255,255,255,.12))',
        borderRadius: 16,
        background: 'linear-gradient(115deg, var(--season-surface, #19151d) 0%, var(--season-bg, #100e19) 100%)',
        boxShadow: '0 8px 24px rgba(0,0,0,.16)',
      }}
    >
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 4, background: 'var(--season-accent, #e58a36)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{
          width: 46, height: 46, flex: '0 0 46px', display: 'grid', placeItems: 'center',
          borderRadius: 13, border: '1px solid var(--season-line, rgba(255,255,255,.14))',
          background: 'var(--season-surface-alt, rgba(255,255,255,.06))',
          color: 'var(--season-accent, #e58a36)', fontSize: 22, fontWeight: 800,
        }}>✦</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <small style={{ color: 'var(--season-muted, #b9b4c2)', fontSize: 10, fontWeight: 800, letterSpacing: '1.5px' }}>GRADUAÇÃO ATUAL</small>
            <span style={{ width: 4, height: 4, borderRadius: 99, background: 'var(--season-accent, #e58a36)' }} />
            <small style={{ color: 'var(--season-muted, #b9b4c2)', fontSize: 10, fontWeight: 700, letterSpacing: '.7px' }}>KISATSUTAI</small>
          </div>
          <h2 style={{ margin: 0, color: 'var(--season-text, inherit)', fontSize: 'clamp(20px, 3vw, 26px)', lineHeight: 1.15, fontWeight: 850, overflowWrap: 'anywhere' }}>{rankName}</h2>
          <div style={{ marginTop: 5, color: 'var(--season-muted, #b9b4c2)', fontSize: 12 }}>Hierarquia do caçador</div>
        </div>
      </div>
      <div style={{ flex: '0 0 auto', alignSelf: 'stretch', display: 'flex', alignItems: 'center', paddingLeft: 12, borderLeft: '1px solid var(--season-line, rgba(255,255,255,.12))', color: 'var(--season-accent, #e58a36)', fontSize: 11, fontWeight: 800, letterSpacing: '.8px', textAlign: 'right' }}>RANK<br/>ATUAL</div>
    </section>
  )}
                      {editingSheet && canEditSelectedSheet ? (<fieldset
                        disabled={!editingSheet || !canEditSelectedSheet}
                        className="character-sheet-editor"
                        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                      >
                      {(() => {
                        const system = String(read('progression.system', selectedCampaign?.system_name || 'Kisatsutai'))
                        const kisatsutai = system.toLowerCase().includes('kisatsutai')
                        const tierKey = String(read('family.tier', '5')) as keyof typeof KISATSUTAI_FAMILY_TIERS
                        const tier = KISATSUTAI_FAMILY_TIERS[tierKey] || KISATSUTAI_FAMILY_TIERS['5']
                        const rankId = String(read('progression.rankId', 'zaidan'))
                        const rank = KISATSUTAI_RANKS.find(entry => entry.id === rankId) || KISATSUTAI_RANKS[0]
                        const promotionLog: any[] = Array.isArray(read('progression.promotionLog', [])) ? read('progression.promotionLog', []) : []
                        const benefitsApplied: string[] = Array.isArray(read('progression.appliedPromotionIds', [])) ? read('progression.appliedPromotionIds', []) : []
                        const changeRank = (nextId: string) => {
                          const oldRank = KISATSUTAI_RANKS.find(entry => entry.id === rankId)
                          const nextRank = KISATSUTAI_RANKS.find(entry => entry.id === nextId)
                          const transition = `${rankId}>${nextId}`
                          if (promotionLog.some(entry => entry.transition === transition)) { setError('Esta promoção já está registrada no histórico. Confira o registro existente para evitar duplicar benefícios.'); return }
                          const promotionId = `${Date.now()}-${transition}`
                          const description = window.prompt('Descrição desta promoção (motivo, missão, observações):', '') ?? ''
                          const next = { ...data, progression: { ...(data.progression || {}), rankId: nextId, rankName: nextRank?.name || nextId, promotionLog: [...promotionLog, { id: promotionId, transition, from: oldRank?.name || rankId, to: nextRank?.name || nextId, at: new Date().toISOString(), description, benefitReference: KISATSUTAI_PROMOTIONS[transition] || 'Benefícios incrementais não definidos no material.', applied: false }] } }
                          setSheetDraft(JSON.stringify(next, null, 2))
                        }
                        return <section style={{padding:16,margin:'14px 0',border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:12,background:'var(--season-surface, var(--season-bg, #100e19))'}}>
                          <h3 style={{marginTop:0}}>Gerenciador de Família, Classe, Progressão e Atributos</h3>
                          <label style={labelStyle}>Sistema de progressão<select value={system} onChange={e=>write('progression.system',e.target.value)} style={inputStyle}><option value="Kisatsutai">Kisatsutai</option><option value="Personalizado">Personalizado</option></select></label>
                          {kisatsutai ? <>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Classe / hierarquia do caçador<select value={rankId} onChange={e=>changeRank(e.target.value)} style={inputStyle}>{KISATSUTAI_RANKS.map(entry=><option key={entry.id} value={entry.id}>{entry.group} · {entry.name}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:12}}>
                              <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><small>FOCO EXIGIDO</small><div style={{fontSize:22,fontWeight:800}}>{rank.focus}</div></div>
                              <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><small>GRUPO</small><div style={{fontSize:22,fontWeight:800}}>{rank.group}</div></div>
                            </div>
                            <p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}><strong>Referência de benefícios da classe:</strong> {rank.benefits}</p>
                            <div style={{marginTop:12,padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><strong>Status concedidos pela classe</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>A classe selecionada adiciona automaticamente os bônus documentados. Para classes sem valores definidos no material, o bônus automático fica em zero até confirmação do mestre.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:10}}>{(['pv','ps','pr'] as const).map(key=><div key={key} style={{padding:10,borderRadius:8,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>{key.toUpperCase()} da classe</small><div style={{fontSize:22,fontWeight:800}}>+{rankStatus[key]}</div></div>)}</div><strong style={{fontSize:12}}>Bônus adicionais personalizados</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:8}}>{field('progression.classStatus.pv','PV adicional')}{field('progression.classStatus.ps','PS adicional')}{field('progression.classStatus.pr','PR adicional')}</div></div>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Tier da família<select value={tierKey} onChange={e=>write('family.tier',e.target.value)} style={inputStyle}>{Object.entries(KISATSUTAI_FAMILY_TIERS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:8,marginTop:10}}>{[['PV',tier.pv],['PS',tier.ps],['PR',tier.pr],['Força',tier.strength],['Agilidade',tier.agility],['Defesa',tier.defense],['Respiração',tier.breathing],['Intelecto',tier.intellect],['Pontos base da família',tier.points],['Foco',tier.focus]].map(([label,value])=><div key={String(label)} style={{padding:9,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:8,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small style={{color:'var(--season-muted, #b9b4c2)'}}>{label}</small><div style={{fontSize:19,fontWeight:800}}>{value}</div></div>)}</div>
                            <div style={{marginTop:16,padding:18,border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 24%, transparent))',borderRadius:18,background:'linear-gradient(150deg,var(--season-surface-alt, var(--season-surface-alt, #211c31)),var(--season-surface, var(--season-bg, #100e19)))',boxShadow:'0 14px 34px rgba(0,0,0,.18)'}}>
                              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}><div style={{width:38,height:38,flex:'0 0 38px',display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 18%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 25%, transparent))',fontSize:18}}>✦</div><div><div style={{fontSize:10,letterSpacing:1.5,fontWeight:800,color:'var(--season-primary, var(--season-primary, #b49aff))',textTransform:'uppercase'}}>Desenvolvimento</div><strong style={{display:'block',fontSize:17,marginTop:2}}>Distribuição de Pontos de Atributos</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'4px 0 0',lineHeight:1.5}}>Distribua os pontos de Família, Hierarquia e Extras neste único gerenciador.</p></div></div>
                              {(()=>{
                                const distributablePool = allocationSources.reduce((sum, source) => sum + allocationPool(source), 0)
                                const totalPool = distributablePool + familyTierMinimumTotal
                                const spentTotal = familyTierMinimumTotal + familyAllocationKeys.reduce((sum, key) => sum + allocationSources.reduce((part, source) => part + allocation(source, key), 0), 0)
                                const available = Math.max(0, totalPool - spentTotal)

                                const setCombinedAllocation = (key: typeof familyAllocationKeys[number], rawValue: number) => {
                                  const base = numRaw(`attributes.${key}`)
                                  const lockedMinimum = familyTierMinimum(key)
                                  const other = allocationSources.reduce((sum, source) => sum + allocation(source, key), 0)
                                  const requestedAllocation = Math.max(0, Math.floor(rawValue || 0) - lockedMinimum)
                                  const maxByAttribute = Math.max(0, 5 - base - lockedMinimum)
                                  const maxByPool = Math.max(0, distributablePool - (spentTotal - familyTierMinimumTotal) + other)
                                  let left = Math.max(0, Math.min(requestedAllocation, maxByAttribute, maxByPool))
                                  const next = { ...data, progression: { ...(data.progression || {}), allocations: { ...((data.progression || {}).allocations || {}) } } }
                                  for (const source of allocationSources) {
                                    const sourcePool = allocationPool(source)
                                    const otherSpent = familyAllocationKeys.reduce((sum, item) => sum + allocation(source, item), 0) - allocation(source, key)
                                    const capacity = Math.max(0, sourcePool - otherSpent)
                                    const assigned = Math.min(left, capacity)
                                    next.progression.allocations[source] = { ...((next.progression.allocations || {})[source] || {}), [key]: assigned }
                                    if (source === 'extra' && next.progression.allocations.class) next.progression.allocations.class = { ...next.progression.allocations.class, [key]: 0 }
                                    left -= assigned
                                  }
                                  setSheetDraft(JSON.stringify(next, null, 2))
                                }
                                return <div style={{padding:'16px 2px'}}>
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                                    <div><strong style={{fontSize:15}}>Pontos para distribuir</strong><div style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',marginTop:3}}>Mínimo familiar bloqueado + pontos de Família, Hierarquia e Extras</div></div>
                                    <span style={{fontSize:11,color:available>0?'#a8dfbd':'var(--season-muted, #b9b4c2)',fontWeight:700}}>{available} disponíveis</span>
                                  </div>
                                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:14}}>
                                    {allocationSources.map((source,index)=>{
                                      const labels: Record<typeof allocationSources[number],string> = {family:'Família',hierarchy:'Hierarquia',extra:'Extra'}
                                      const pool = allocationPool(source)
                                      const used = familyAllocationKeys.reduce((sum,key)=>sum+allocation(source,key),0)
                                      const ratio = pool>0?Math.min(100,used/pool*100):0
                                      const accents = ['#ff5575','#8bc8a7','#c2a0ed']
                                      return <div key={source} style={{minWidth:0,padding:'13px 14px',borderRadius:15,background:'rgba(255,255,255,.045)',border:'1px solid color-mix(in srgb, '+accents[index]+' 24%, transparent)'}}>
                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:12}}><strong style={{display:'flex',alignItems:'center',gap:8,fontSize:14}}><span style={{width:9,height:9,borderRadius:'50%',background:accents[index],flex:'0 0 9px'}}/>{labels[source]}</strong><small style={{color:'var(--season-muted, #b9b4c2)',fontWeight:700,whiteSpace:'nowrap'}}>{Math.max(0,pool-used)} livres</small></div>
                                        <div style={{display:'flex',alignItems:'baseline',gap:5}}><strong style={{fontSize:29,lineHeight:1,fontWeight:800}}>{used}</strong><span style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>/ {pool} pontos usados</span></div>
                                        <div style={{height:7,background:'rgba(255,255,255,.10)',borderRadius:99,overflow:'hidden',marginTop:13}}><div style={{height:'100%',width:ratio+'%',background:accents[index],borderRadius:99,transition:'width .2s'}}/></div>
                                      </div>
                                    })}
                                  </div>
                                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:9,marginTop:16}}>
                                    {familyAllocationKeys.map(key=>{
                                      const allocated = allocationSources.reduce((sum, source) => sum + allocation(source, key), 0)
                                      const lockedMinimum = familyTierMinimum(key)
                                      const current = allocated + lockedMinimum
                                      const base = numRaw(`attributes.${key}`)
                                      const other = allocationSources.reduce((sum, source) => sum + allocation(source, key), 0)
                                      const max = lockedMinimum + Math.max(0, Math.min(5 - base - lockedMinimum, distributablePool - (spentTotal - familyTierMinimumTotal) + other))
                                      return <label key={key} style={{...labelStyle,fontSize:11,display:'flex',flexDirection:'column',gap:6,margin:0,padding:'10px 11px',borderRadius:10,background:'color-mix(in srgb, var(--season-surface-alt, #211c31) 28%, transparent)',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 12%, transparent))'}}><span style={{color:'var(--season-muted, #b9b4c2)',fontWeight:650}}>{allocationLabels[key]}{lockedMinimum>0&&<small style={{display:'block',fontWeight:500,color:'#9de0b8'}}>Mínimo familiar: +{lockedMinimum} (bloqueado)</small>}</span><input type="number" min={lockedMinimum} max={Math.max(lockedMinimum,max)} value={current} onChange={e=>setCombinedAllocation(key, Number(e.target.value))} style={{...inputStyle,margin:0,padding:'8px 9px',fontSize:15,fontWeight:700,borderRadius:8}}/><small style={{color:'var(--season-muted)',fontWeight:700}}>Total: {base + current}/5</small></label>
                                    })}
                                  </div>
                                  <small style={{display:'block',marginTop:11,color:'var(--season-muted, #b9b4c2)',lineHeight:1.5}}>Os bônus fixos de tier e hierarquia aparecem como mínimo bloqueado e não podem ser reduzidos.</small>
                                </div>
                              })()}
                              <div style={{marginTop:14,padding:13,borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 9%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 16%, transparent))'}}>
                                <label style={{...labelStyle,display:'block',margin:0}}>Pontos extras
                                  <input type="number" min="0" step="1" value={numRaw('progression.manualExtraAttributePoints')} onChange={e=>write('progression.manualExtraAttributePoints',Math.max(0,Math.floor(Number(e.target.value)||0)))} style={{...inputStyle,marginTop:7}} />
                                </label>
                                <small style={{display:'block',marginTop:6,color:'var(--season-muted, #b9b4c2)'}}>Adicione aqui pontos de atributos concedidos por recompensas, eventos ou decisões do mestre. Eles serão somados à barra Extra.</small>
                              </div>
                            </div>
                            <div style={{marginTop:22,padding:18,border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 24%, transparent))',borderRadius:18,background:'linear-gradient(150deg,var(--season-surface-alt, var(--season-surface-alt, #211c31)),var(--season-surface, var(--season-bg, #100e19)))',boxShadow:'0 14px 34px rgba(0,0,0,.18)'}}>
                              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}><div style={{width:38,height:38,flex:'0 0 38px',display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 18%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 25%, transparent))',fontSize:18}}>✦</div><div><div style={{fontSize:10,letterSpacing:1.5,fontWeight:800,color:'var(--season-primary, #b49aff)',textTransform:'uppercase'}}>Desenvolvimento</div><strong style={{display:'block',fontSize:17,marginTop:2}}>Distribuição de Pontos de Perícias</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'4px 0 0',lineHeight:1.5}}>Distribua os pontos de Hierarquia, Intelecto e Extras entre as perícias.</p></div></div>
                              <p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'0 0 12px'}}>Cada ponto aumenta um nível da perícia. Limite: 12 por perícia.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:9}}>{(['hierarchy','intellect','extra'] as const).map((source,index)=>{const labels={hierarchy:'Hierarquia',intellect:'Intelecto',extra:'Extra'};const colors=['#8bc8a7','#8fb8d8','#c2a0ed'];const pool=skillPool(source);const used=skillTotalUsed(source);const ratio=pool>0?Math.min(100,used/pool*100):0;return <div key={source} style={{minWidth:0,padding:'13px 14px',borderRadius:15,background:'rgba(255,255,255,.045)',border:`1px solid ${colors[index]}44`}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:12}}><strong style={{display:'flex',alignItems:'center',gap:8,fontSize:14}}><span style={{width:9,height:9,borderRadius:'50%',background:colors[index],flex:'0 0 9px'}}/>{labels[source]}</strong><small style={{color:'var(--season-muted, #b9b4c2)',fontWeight:700,whiteSpace:'nowrap'}}>{Math.max(0,pool-used)} livres</small></div><div style={{display:'flex',alignItems:'baseline',gap:5}}><strong style={{fontSize:29,lineHeight:1,fontWeight:800}}>{used}</strong><span style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>/ {pool} pontos usados</span></div><div style={{height:7,background:'rgba(255,255,255,.10)',borderRadius:99,overflow:'hidden',marginTop:13}}><div style={{height:'100%',width:ratio+'%',background:colors[index]}}/></div></div>})}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:9,marginTop:16}}>{skillKeys.map(key=>{const current=num(`skills.${key}`);const extra=skillAllocatedTotal(key);return <label key={key} style={{...labelStyle,fontSize:11,display:'flex',flexDirection:'column',gap:6,margin:0,padding:'10px 11px',borderRadius:10,background:'color-mix(in srgb, var(--season-surface-alt, #211c31) 28%, transparent)',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 12%, transparent))'}}><span style={{color:'var(--season-muted, #b9b4c2)',fontWeight:650}}>{skillLabels[key]}</span><input type="number" min="0" max={12} value={extra} onChange={e=>setSkillAllocation(key,Number(e.target.value))} style={{...inputStyle,margin:0,padding:'8px 9px',fontSize:15,fontWeight:700,borderRadius:8}}/><small style={{color:'var(--season-muted)',fontWeight:700}}>Total: {current}/12</small></label>})}</div><small style={{display:'block',marginTop:11,color:'var(--season-muted, #b9b4c2)',lineHeight:1.5}}>Os bônus fixos de tier e hierarquia aparecem como mínimo bloqueado e não podem ser reduzidos.</small><div style={{marginTop:28,padding:13,borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 9%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 16%, transparent))'}}><label style={{...labelStyle,display:'block',margin:0}}>Pontos extras<input type="number" min="0" step="1" value={numRaw('progression.manualExtraSkillPoints')} onChange={e=>write('progression.manualExtraSkillPoints',Math.max(0,Math.floor(Number(e.target.value)||0)))} style={{...inputStyle,marginTop:7}} /></label><small style={{display:'block',marginTop:6,color:'var(--season-muted, #b9b4c2)'}}>Adicione aqui pontos de perícia concedidos por recompensas, eventos ou decisões do mestre. Eles serão somados à barra Extra.</small></div><div style={{marginTop:16,padding:14,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><strong>Desenvolvimento por Intelecto</strong><p style={{fontSize:13,color:'var(--season-muted, #b9b4c2)'}}>Para cada ponto de Intelecto, escolha entre receber 5 pontos para distribuir nas perícias principais ou evoluir um nível de treinamento em uma perícia extra.</p>{Array.from({length:intellect},(_,i)=><label key={i} style={{...labelStyle,display:'grid',gridTemplateColumns:'90px 1fr',alignItems:'center',gap:10,marginTop:8}}>Ponto {i+1}<select value={mainAllocations[i]} onChange={e=>{const next=[...mainAllocations];next[i]=e.target.value as 'main' | 'extra';write('skills.intelligenceChoices',next)}} style={inputStyle}><option value="main">5 pontos para o distribuidor</option><option value="extra">+1 nível em perícia extra</option></select></label>)}<div style={{marginTop:10,color:'#eee'}}>Pontos para perícias principais: <strong>{mainPoints}</strong> · Níveis de treinamento extra: <strong>{extraLevels}</strong></div></div></div>
                            <div style={{marginTop:14}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><strong>Histórico de promoções</strong><button
  type="button"
  className="secondary-button"
  disabled={!promotionLog.length}
  onClick={() => {
    if (window.confirm('Limpar todo o histórico de promoções desta ficha? Esta ação não pode ser desfeita.')) {
      const next = {
        ...data,
        progression: {
          ...(data.progression || {}),
          promotionLog: [],
          appliedPromotionIds: [],
        },
      }

      setSheetDraft(JSON.stringify(next, null, 2))
    }
  }}
>
  Limpar histórico
</button></div>{promotionLog.length===0?<p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}>Nenhuma promoção registrada nesta ficha.</p>:promotionLog.map((entry:any)=><div key={entry.id} style={{padding:10,marginTop:8,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:8}}><strong>{entry.from} → {entry.to}</strong><div style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>{new Date(entry.at).toLocaleString('pt-BR')} · {entry.applied?'Benefícios marcados como aplicados':'Benefícios pendentes de conferência'}</div>{entry.description&&<p style={{fontSize:13,marginBottom:4}}>{entry.description}</p>}<p style={{fontSize:13,marginBottom:0}}>{entry.benefitReference}</p></div>)}</div>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
  <button
    className="secondary-button"
    type="button"
    onClick={() => {
      const updated = promotionLog.map(entry => ({
        ...entry,
        applied: true,
      }))

      const next = {
        ...data,
        progression: {
          ...(data.progression || {}),
          promotionLog: updated,
          appliedPromotionIds: Array.from(
            new Set([
              ...benefitsApplied,
              ...promotionLog.map(entry => entry.transition),
            ])
          ),
        },
      }

      setSheetDraft(JSON.stringify(next, null, 2))
    }}
  >
    Marcar promoções registradas como conferidas
  </button>
</div>
                          </> : <>
                            <p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}>Progressão genérica: configure o modelo usado por esta campanha sem impor níveis numéricos.</p>
                            {(['model','currentStage','experience','nextRequirement'] as const).map(key=><label key={key} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{({model:'Modelo (nível, XP, tier, patente...)',currentStage:'Nível / estágio atual',experience:'Experiência / XP atual',nextRequirement:'Requisito para avançar'} as Record<string,string>)[key]}<input type={key==='experience'?'number':'text'} value={String(read(`progression.${key}`,''))} onChange={e=>write(`progression.${key}`,key==='experience'?Number(e.target.value):e.target.value)} style={inputStyle}/></label>)}
                            <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><strong>Bônus de status da progressão</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:8}}>{field('progression.statusBonuses.pv','Bônus de PV')}{field('progression.statusBonuses.ps','Bônus de PS')}{field('progression.statusBonuses.pr','Bônus de PR')}</div></div><label style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>Regras de progressão<textarea rows={3} value={String(read('progression.rules',''))} onChange={e=>write('progression.rules',e.target.value)} style={inputStyle}/></label>
                          </>}

                        </section>
                      })()}
                      {panel('1. Identidade', <>{field('identity.sex','Sexo','text')}{field('identity.family','Família','text')}{field('identity.age','Idade')}{field('identity.height','Altura','text')}{field('identity.weight','Peso','text')}{(['primaryArchetype', 'secondaryArchetype'] as const).map((key) => {
  const otherKey = key === 'primaryArchetype'
    ? 'secondaryArchetype'
    : 'primaryArchetype'

  const current = String(read(`identity.${key}`, ''))
  const other = String(read(`identity.${otherKey}`, ''))

  const isForbidden = (a: string, b: string) =>
    (a === 'Linha de Frente' && b === 'Suporte') ||
    (a === 'Suporte' && b === 'Linha de Frente') ||
    (a === 'Defensor' && b === 'Flanco') ||
    (a === 'Flanco' && b === 'Defensor')

  return (
    <label key={key} style={{...labelStyle, display:'flex', flexDirection:'column', gap:6}}>
      {key === 'primaryArchetype' ? 'Arquétipo primário' : 'Arquétipo secundário'}
      <select
        value={current}
        onChange={e => {
          const next = e.target.value
          if (other && isForbidden(next, other)) {
            setError('Essa combinação de arquétipos não é permitida.')
            return
          }
          write(`identity.${key}`, next)
        }}
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map(archetype => (
          <option
            key={archetype}
            value={archetype}
            disabled={Boolean(other && isForbidden(archetype, other))}
          >
            {archetype}
          </option>
        ))}
      </select>
    </label>
  )
})}
{field('identity.path','Caminho','text')}{field('identity.breathing','Respiração','text')}{area('identity.appearance','Aparência')}{area('identity.beliefs','Crenças')}{area('identity.lore','História / lore')}</>)}
                      {panel('2. Status', <>{derived.map(([label,value,hint])=><div key={label} style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small style={{color:'var(--season-muted, #b9b4c2)'}}>{label.toUpperCase()}</small><div style={{fontSize:26,fontWeight:800}}>{value}</div><small style={{color:'var(--season-muted, #b9b4c2)'}}>{hint}</small></div>)}</>)}

                      {panel('3. Combate', <><div style={{marginTop:14}}><div style={{padding:12,marginBottom:12,borderRadius:10,background:'var(--season-surface-alt, #211c31)'}}><strong>Dano base · {hierarchyGroup}</strong><div style={{fontSize:24,fontWeight:800}}>{baseDamage}</div><small>Definido automaticamente pela hierarquia.</small></div><div style={{padding:12,marginBottom:12,borderRadius:10,background:'var(--season-surface-alt, #211c31)'}}><strong>Arma equipada</strong>{equippedWeapon ? <><div style={{fontSize:18,fontWeight:800}}>{equippedWeapon.name}</div><small>Dano extra: {equippedWeaponDamage} · Carga: {String(equippedWeapon.metadata?.weaponWeight ?? equippedWeapon.weight)} kg</small></> : <p>Nenhuma arma equipada. Equipe uma arma pelo Inventário.</p>}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, #211c31)'}}><small>DANO EXTRA DA ARMA EQUIPADA</small><div style={{fontSize:20,fontWeight:800}}>{equippedWeaponDamage}</div><small>Definido pela classificação da arma no inventário.</small></div>{field('combat.armor','Armadura')}{field('combat.mentalArmor','Armadura Mental')}{field('combat.essence','Essência')}{field('combat.critical','Crítico','text')}<div className="sheet-movement-card" style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}>
  <small>DESLOCAMENTO</small>
<div className="sheet-movement-values">
  <strong>
    {equippedArmor && equippedArmor.metadata?.armorClass !== 'leve' && (
      <small className="armor-dexterity-value">
        {Math.max(1, Math.floor(
          (movementActions * dexterity) /
          (equippedArmor.metadata?.armorClass === 'media' ? 2 : 4)
        ))}
      </small>
    )}
    {Math.max(1, movementActions * dexterity)}
  </strong>
</div>
  <small>Ações de Movimento × Destreza</small>
</div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>AÇÕES DE MOVIMENTO</small><div style={{fontSize:24,fontWeight:800}}>{movementActions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>AÇÕES EXTRAS</small><div style={{fontSize:24,fontWeight:800}}>{extraActions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>REAÇÕES</small><div style={{fontSize:24,fontWeight:800}}>{reactions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>CONTRA-ATAQUE</small><div style={{fontSize:24,fontWeight:800}}>{combat+dexterity}</div><small>Combate + Destreza</small></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>CONSTITUIÇÃO</small><div style={{fontSize:24,fontWeight:800}}>{resistance+vigor}</div><small>Resistência + Vigor</small></div></div>{area('combat.actions','Observações de ações e regras de combate')}</div></>)}

                      {panel('4. Fluxos', <>{area('flows.details','Fluxos desbloqueados e detalhes')}</>)}
                      {panel('5. Habilidades & Respirações', <>{area('abilities.archetype','Habilidades do arquétipo')}{area('abilities.path','Habilidades do caminho')}{area('abilities.conditions','Condições')}{field('breathing.type','Tipo de respiração','text')}{area('breathing.forms','Formas de respiração')}{area('breathing.concentration','Técnica de concentração')}</>)}
                      {panel('Anotações', area('notes','Anotações gerais'))}
                      </fieldset>) : (<section className="character-sheet-summary">
                        <header className="sheet-summary-header">
                          <div className="sheet-summary-identity"><span className="sheet-eyebrow">FICHA DE PERSONAGEM</span><h2>{String(read('identity.name', selectedCharacter?.name || 'Personagem'))}</h2><p>
  {String(read('identity.family', 'Família não definida'))}
  {' · '}
  {String(read('identity.primaryArchetype', selectedCharacter?.archetype || 'Arquétipo não definido'))}
  {' + '}
  {String(read('identity.secondaryArchetype', 'Arquétipo secundário não definido'))}
</p></div>
                          <div className="sheet-summary-progression">{[['Classe',read('progression.rankName', KISATSUTAI_RANKS.find(entry=>entry.id===rankIdForStatus)?.name || 'Não definida')],['Tier familiar',familyTier.label],['Foco',read('progression.classFocus',familyTier.focus)],['Pontos de perícia',read('progression.classSkillPoints',0)]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
                          <div className="sheet-summary-season">{seasons.find(entry => entry.id === selectedSeasonId)?.name || 'Temporada'}</div>
                        </header>
                        <div className="sheet-summary-status">{derived.map(([label,value], index) => {
                          const keys = ['pv', 'ps', 'pr'] as const
                          const key = keys[index]
                          const currentPath = `status.current.${key}`
                          const rawCurrent = Number(read(currentPath, value))
                          const current = Math.max(0, key === 'pv' ? (Number.isFinite(rawCurrent) ? rawCurrent : value) : Math.min(value, Number.isFinite(rawCurrent) ? rawCurrent : value))
                          const adjust = (delta: number) => {
                            if (!canEditSelectedSheet) return
                            // Fichas antigas podem ainda não ter status.current.
                            // Inicializa os três valores com os máximos calculados,
                            // preservando qualquer valor atual já registrado.
                            const existingCurrent = (data.status?.current && typeof data.status.current === 'object')
                              ? data.status.current
                              : {}
                            const currentDefaults = {
                              pv: Number(existingCurrent.pv ?? derived[0][1]),
                              ps: Number(existingCurrent.ps ?? derived[1][1]),
                              pr: Number(existingCurrent.pr ?? derived[2][1]),
                            }
                            const next = {
                              ...data,
                              status: {
                                ...(data.status || {}),
                                current: {
                                  ...currentDefaults,
                                  [key]: Math.max(0, key === 'pv' ? current + delta : Math.min(value, current + delta)),
                                },
                              },
                            }
                            setSheetDraft(JSON.stringify(next, null, 2))
                            void saveCharacterConditions(next)
                          }
                          const applyTypedAdjustment = () => {
                            const raw = (statusAdjustments[key] ?? '').trim()
                            if (!/^[+-]\d+$/.test(raw) || Number(raw) === 0) {
                              setError('Digite um valor inteiro com sinal, como +10 ou -10.')
                              return
                            }
                            adjust(Number(raw))
                            setError('')
                            setNotice(`${key.toUpperCase()} ajustado em ${raw} e salvo automaticamente.`)
                          }
                          const colors = [{accent:'#f28b9b',glow:'rgba(242,139,155,.18)'},{accent:'var(--season-primary)',glow:'var(--season-glow)'},{accent:'#75c9ee',glow:'rgba(117,201,238,.18)'}][index]
                          const percent = value > 0 ? Math.min(current / value * 100, 100) : 0
                          const extraPV = key === 'pv' ? Math.max(0, current - value) : 0
                          const extraPercent = value > 0 ? Math.min(extraPV / value * 100, 100) : 0
                          return <article key={label} className="sheet-summary-status-card" style={{position:'relative',overflow:'hidden'}}>
                            <span>{label.replace('Pontos de ', '').replace(/\s\(.+\)/, '')}</span>
                            <strong style={{display:'block',fontSize:24,margin:'5px 0'}}>{current}<small style={{fontSize:13,fontWeight:500,opacity:.7}}> / {value}</small></strong>
                            <div style={{height:6,borderRadius:99,background:'rgba(255,255,255,.12)',overflow:'hidden',margin:'8px 0 4px'}}><div style={{height:'100%',width:`${percent}%`,borderRadius:99,background:colors.accent,boxShadow:`0 0 12px ${colors.glow}`,transition:'width .2s ease'}}/></div>
                            {extraPV > 0 && <><div style={{height:6,borderRadius:99,background:'rgba(255,255,255,.12)',overflow:'hidden',margin:'0 0 6px'}}><div style={{height:'100%',width:`${extraPercent}%`,borderRadius:99,background:'linear-gradient(90deg,#f6b84a,#ff7b45)',boxShadow:'0 0 12px rgba(246,184,74,.3)',transition:'width .2s ease'}}/></div><small style={{display:'block',color:'#ffc875',marginBottom:6}}>＋{extraPV} PV excedentes · barra extra</small></>}
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                              <small style={{opacity:.7}}>{Math.round(percent)}% disponível</small>
                              {canEditSelectedSheet && <div style={{display:'flex',gap:6}}>
                                <button type="button" aria-label={`Diminuir ${key.toUpperCase()}`} disabled={current <= 0} onClick={()=>adjust(-1)} style={{width:32,height:30,borderRadius:9,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.07)',color:'inherit',fontSize:19,cursor:current<=0?'not-allowed':'pointer',opacity: current <= 0 ? 0.4 : 1}}>−</button>
                                <button type="button" aria-label={`Aumentar ${key.toUpperCase()}`} disabled={key !== 'pv' && current >= value} onClick={()=>adjust(1)} style={{width:32,height:30,borderRadius:9,border:'1px solid '+colors.accent,background:colors.glow,color:'inherit',fontSize:19,cursor:key !== 'pv' && current>=value?'not-allowed':'pointer',opacity: key !== 'pv' && current >= value ? 0.4 : 1}}>+</button>
                              </div>}
                            </div>
                            {canEditSelectedSheet && <div style={{display:'flex',gap:7,marginTop:10}}>
                              <input type="text" inputMode="numeric" aria-label={`Ajuste de ${key.toUpperCase()}`} value={statusAdjustments[key] ?? ''} onChange={event=>setStatusAdjustments(previous=>({...previous,[key]:event.target.value}))} onKeyDown={event=>{if(event.key==='Enter')applyTypedAdjustment()}} placeholder="+10 ou -10" style={{minWidth:0,width:'100%',padding:'8px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,.18)',background:'rgba(0,0,0,.2)',color:'inherit',font:'inherit'}} />
                              <button type="button" onClick={applyTypedAdjustment} style={{whiteSpace:'nowrap',padding:'7px 11px',borderRadius:9,border:'1px solid '+colors.accent,background:colors.glow,color:'inherit',fontWeight:700,cursor:'pointer'}}>Aplicar</button>
                            </div>}
                            {key === 'pv' && <div className="status-card-damage-control"><strong>Aplicar dano físico</strong><label>Tipo de dano<select value={physicalDamageType} onChange={event=>setPhysicalDamageType(event.target.value as 'cortante_perfurante'|'especial_bruto')}><option value="cortante_perfurante">Cortante / Perfurante</option><option value="especial_bruto">Especial / Bruto</option></select></label><label>Dano recebido<input type="number" min="0" value={physicalDamageAmount} onChange={event=>setPhysicalDamageAmount(event.target.value)} placeholder="Quantidade" /></label><small>{armorCovers(physicalDamageType) ? `Armadura: ${armorResistance} · Proteção: ${physicalProtection}` : `Proteção: ${physicalProtection}`}</small><button type="button" disabled={!canEditSelectedSheet || physicalDamageAmount.trim()==='' || Number(physicalDamageAmount)<0} onClick={()=>{const incoming=Math.max(0,Number(physicalDamageAmount)||0);const armorBlock=armorCovers(physicalDamageType)?armorResistance:0;const reduced=Math.max(0,incoming-armorBlock-physicalProtection);const currentPV=Number(read('status.current.pv',derived[0][1]));const nextPV=Math.max(0,currentPV-reduced);const next={...data,status:{...(data.status||{}),current:{...((data.status as any)?.current||{}),pv:nextPV,ps:Number(read('status.current.ps',derived[1][1])),pr:Number(read('status.current.pr',derived[2][1]))}}};setSheetDraft(JSON.stringify(next,null,2));void saveCharacterConditions(next);setNotice(`Dano ${physicalDamageType==='cortante_perfurante'?'cortante/perfurante':'especial/bruto'}: ${incoming}. Redução: ${incoming-reduced}. PV perdidos: ${reduced}.`);setPhysicalDamageAmount('')}}>Aplicar aos PV</button></div>}
                            {key === 'ps' && <div className="status-card-damage-control sanity"><strong>Aplicar dano de sanidade</strong><label>Dano recebido<input type="number" min="0" value={sanityDamageAmount} onChange={event=>setSanityDamageAmount(event.target.value)} placeholder="Quantidade" /></label><small>Proteção de sanidade equipada: {sanityProtection}</small><button type="button" disabled={!canEditSelectedSheet || sanityDamageAmount.trim()==='' || Number(sanityDamageAmount)<0} onClick={()=>{const incoming=Math.max(0,Number(sanityDamageAmount)||0);const reduced=Math.max(0,incoming-sanityProtection);const currentPS=Number(read('status.current.ps',derived[1][1]));const nextPS=Math.max(0,currentPS-reduced);const next={...data,status:{...(data.status||{}),current:{...((data.status as any)?.current||{}),pv:Number(read('status.current.pv',derived[0][1])),ps:nextPS,pr:Number(read('status.current.pr',derived[2][1]))}}};setSheetDraft(JSON.stringify(next,null,2));void saveCharacterConditions(next);setNotice(`Dano de sanidade: ${incoming}. Redução: ${incoming-reduced}. PS perdidos: ${reduced}.`);setSanityDamageAmount('')}}>Aplicar aos PS</button></div>}
                            {key === 'pr' && isKisatsutaiSheet && (() => {
                              const rank = KISATSUTAI_RANKS.find(entry => entry.id === rankIdForStatus) || KISATSUTAI_RANKS[0]
                              const group = rank.group
                              const dtByGroup: Record<string, number> = { Raposa: 20, Tigre: 19, Dragão: 18, Corvo: 17 }
                              const dt = dtByGroup[group]
                              const runBreathingTest = () => {
                                if (group === 'Carpa' || !dt) return
                                const diceCount = Math.max(1, Math.floor(1 + breathing))
                                const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 20) + 1)
                                const best = Math.max(...rolls)
                                const total = best + vigor
                                const success = total >= dt
                                const recovery = Math.floor(value / (success ? 4 : 8))
                                const applied = Math.min(recovery, Math.max(0, value - current))
                                setBreathingTestResult({ rolls, best, total, dt, success, recovery, applied, group })
                                if (canEditSelectedSheet && applied > 0) {
                                  const next = { ...data, status: { ...(data.status || {}), current: { ...((data.status || {}).current || {}), pr: current + applied } } }
                                  setSheetDraft(JSON.stringify(next, null, 2))
                                  void saveCharacterConditions(next)
                                  setNotice(`Teste de Respiração: ${success ? 'sucesso' : 'falha'}. ${applied} PR recuperados e salvos automaticamente.`)
                                }
                              }
                              return <div style={{marginTop:12,padding:12,borderRadius:10,background:'rgba(117,201,238,.08)',border:'1px solid rgba(117,201,238,.22)'}}>
                                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong style={{fontSize:13}}>Teste de Respiração · {group}</strong><small style={{opacity:.75}}>{group === 'Carpa' ? 'Sem teste' : `DT ${dt}`}</small></div>
                                {group === 'Carpa' ? <small style={{display:'block',marginTop:7,opacity:.8}}>Este grupo não realiza o teste de Respiração.</small> : <>
                                  <small style={{display:'block',marginTop:5,opacity:.8}}>{1 + breathing}d20 · maior resultado + Vigor ({vigor})</small>
                                  <button type="button" onClick={runBreathingTest} style={{marginTop:9,padding:'8px 12px',borderRadius:9,border:'1px solid rgba(117,201,238,.55)',background:'rgba(117,201,238,.16)',color:'inherit',fontWeight:700,cursor:'pointer'}}>Rolar teste</button>
                                  {breathingTestResult && breathingTestResult.group === group && <div style={{marginTop:9,fontSize:13}}><div>Dados: {breathingTestResult.rolls.join(' · ')} → maior: <strong>{breathingTestResult.best}</strong></div><div>Resultado: <strong>{breathingTestResult.best} + {vigor} = {breathingTestResult.total}</strong> / DT {breathingTestResult.dt} — <strong style={{color:breathingTestResult.success?'#8de0a5':'#f0a0a0'}}>{breathingTestResult.success?'Sucesso':'Falha'}</strong></div><div>Recuperação: {breathingTestResult.recovery} PR ({breathingTestResult.success?'¼':'⅛'} do máximo) · aplicado: <strong>{breathingTestResult.applied} PR</strong></div></div>}
                                </>}
                              </div>
                            })()}
                          </article>
                        })}</div>
                        <div className="sheet-summary-attributes">{[['Força',strength],['Agilidade',agility],['Defesa',defense],['Respiração',breathing],['Intelecto',intellect]].map(([label,value])=><article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
                        <div className="sheet-summary-grid">
                          <article className="sheet-summary-card"><h3>Perícias</h3><div className="sheet-summary-values">{[['Vigor',vigor],['Mental',mental],['Combate',combat],['Destreza',dexterity],['Resistência',resistance],['Habilidade',ability]].map(([label,value])=><div key={String(label)} className={String(label)==='Destreza'?'sheet-dexterity-with-armor':''}><span>{label}</span><strong>{String(label)==='Destreza' && equippedArmor ? <><small className="armor-dexterity-value">{armorDexterity}</small>{value}</> : value}</strong></div>)}</div></article>
<article className="sheet-summary-card">
  <h3>Combate</h3>
  <div className="sheet-summary-values">
    {[
      ['Dano base', baseDamage],
      ['Dano extra', equippedWeaponDamage],
      ['Deslocamento', Math.max(1, movementActions * dexterity)],
      ['Ações', movementActions + extraActions],
      ['Reações', reactions],
      ['Contra-ataque', combat + dexterity],
      ['Constituição', resistance + vigor],
      ...(isKisatsutaiSheet ? [['Essência', read('combat.essence', '—')]] : [])
    ].map(([label, value]) => (
      <div key={String(label)}>
        <span>{label}</span>
        <strong>
          {String(label) === 'Deslocamento' &&
            equippedArmor &&
            equippedArmor.metadata?.armorClass !== 'leve' && (
              <small className="armor-dexterity-value">
                {Math.max(
                  1,
                  Math.floor(
                    Number(value) /
                    (equippedArmor.metadata?.armorClass === 'media' ? 2 : 4)
                  )
                )}
              </small>
            )}
          {value}
        </strong>
      </div>
    ))}
  </div>
</article>
                        </div>

                        <div className="sheet-summary-notes"><h3>Resumo do personagem</h3><p>{String(read('identity.appearance','Aparência não registrada'))}</p><p>{String(read('identity.beliefs',''))}</p><p>{String(read('identity.lore',''))}</p></div>
                        <p className="sheet-summary-hint">Esta é uma visão resumida. {canEditSelectedSheet ? 'Clique em “Editar ficha” para acessar todos os campos e detalhes.' : 'Você não tem permissão para editar esta ficha.'}</p>
                      </section>)}
                        <section className="combat-actions-panel">
                          <div className="combat-actions-heading"><div><span className="combat-eyebrow">TURNO DO PERSONAGEM</span><h3>Ações</h3><p>Escolha uma ação para rolar os dados automaticamente.</p></div><div className="combat-d20-mark">D20</div></div>
                          <div className="combat-action-grid">
                            <button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Ataque bruto')}><span className="combat-action-icon">⚔</span><strong>Ataque Bruto</strong><small>1 + {strength}d20 + Combate</small></button>
                            <button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Ataque ágil')}><span className="combat-action-icon">➶</span><strong>Ataque Ágil</strong><small>1 + {agility}d20 + Combate</small></button>
                          </div>
                          <div className="combat-reactions-section">
                            <div className="combat-reactions-heading"><h3>Reações</h3><p>Escolha uma ação para rolar os dados automaticamente.</p></div>
                            <div className="combat-action-grid combat-reactions-grid">
                              <button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Bloqueio', dodgeTarget)}><span className="combat-action-icon">▣</span><strong>Bloqueio</strong><small>1 + {defense}d20 + Constituição</small></button>
                              <button type="button" className="combat-action-card" onClick={()=>performCombatRoll('Esquiva', dodgeTarget)}><span className="combat-action-icon">↗</span><strong>Esquiva</strong><small>1 + {agility}d20 + Destreza</small></button>
                              <button type="button" className="combat-action-card" onClick={()=>{const enemy=dodgeTarget.trim()===''?null:Number(dodgeTarget);const dt=combat+dexterity;const validEnemy=enemy!==null&&Number.isFinite(enemy)&&enemy>=0;setCombatActionResult(validEnemy?`Contra-ataque: resultado do inimigo ${enemy} ${enemy<dt?'<':'≥'} sua DT ${dt}. ${enemy<dt?'Contra-ataque bem-sucedido.':'Contra-ataque não sucedido.'}`:'Informe a DT do inimigo no campo ao lado das reações.' )}}><span className="combat-action-icon">↶</span><strong>Contra-ataque</strong><small>DT: {combat+dexterity}</small></button>
                              <label className="combat-dodge-target-inline combat-reactions-dt-card" htmlFor="combat-dodge-target">DT do inimigo<input id="combat-dodge-target" type="number" min="0" step="1" value={dodgeTarget} onChange={event=>setDodgeTarget(event.target.value)} placeholder="DT" /></label>
                            </div>
                          </div>
                          <div className="combat-action-result"><div className="combat-result-title"><span>Resultado da rolagem</span><span className="combat-result-die">D20</span></div><p>{combatActionResult || 'Nenhuma ação rolada ainda. Escolha uma das ações acima.'}</p>{blockDamageReduction !== null && <div className="combat-block-damage-entry"><div className="combat-block-damage-heading"><strong>Dano recebido</strong><button type="button" className="combat-block-damage-close" onClick={()=>{setBlockDamageReduction(null);setBlockIncomingDamage('')}} aria-label="Fechar dano total do inimigo">Fechar</button></div><label htmlFor="combat-incoming-damage">Dano total do inimigo<input id="combat-incoming-damage" type="number" min="0" step="1" value={blockIncomingDamage} onChange={event=>setBlockIncomingDamage(event.target.value)} placeholder="Informe o dano recebido" /></label><div className="combat-block-damage-preview">Será negado: <strong>{blockIncomingDamage.trim() !== '' && Number.isFinite(Number(blockIncomingDamage)) ? Math.floor(Math.max(0, Number(blockIncomingDamage)) * blockDamageReduction) : '—'}</strong> · Será descontado dos PV: <strong>{blockIncomingDamage.trim() !== '' && Number.isFinite(Number(blockIncomingDamage)) ? Math.max(0, Number(blockIncomingDamage) - Math.floor(Math.max(0, Number(blockIncomingDamage)) * blockDamageReduction)) : '—'}</strong></div><button type="button" className="combat-counter-button" onClick={applyBlockedDamage} disabled={blockIncomingDamage.trim() === '' || !Number.isFinite(Number(blockIncomingDamage)) || Number(blockIncomingDamage) < 0}>Aplicar dano aos PV</button></div>}</div>
                          <details className="combat-rules"><summary>Consultar regras das ações</summary><div className="combat-rules-grid"><p><strong>Ataque Bruto</strong><span>1 + Força d20 + Combate.</span></p><p><strong>Ataque Ágil</strong><span>1 + Agilidade d20 + Combate.</span></p><p><strong>Bloqueio</strong><span>1 + Defesa d20 + Constituição. Falha: nega ¼ do dano; sucesso: nega ½ do dano; crítico (20 natural): dano completo negado.</span></p><p><strong>Esquiva</strong><span>1 + Agilidade d20 + Destreza. Se alcançar a DT, nega o dano completamente.</span></p><p><strong>Contra-ataque</strong><span>O resultado do inimigo precisa ser menor que sua DT de Contra-ataque (valor do contra-ataque: {combat+dexterity}).</span></p></div></details>
                        </section>
                    </>
                    )

                  })()}
                  {editingSheet && canEditSelectedSheet && <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button className="primary-button" type="button" disabled={sheetSaving} onClick={()=>void saveCharacterSheet()}>{sheetSaving?'Salvando…':'Salvar ficha'}</button><button className="secondary-button" type="button" disabled={!sheet} onClick={()=>void createSheetMilestone()}>Registrar marco no histórico</button></div>}
                

{canAccessSelectedCharacter && selectedCharacter && (
  <section className="inventory-section sheet-inventory-section" id="ficha-inventario">
    <div className="inventory-heading">
      <div>
        <h3>Inventário</h3>
      </div>
      <button
        type="button"
        className="primary-button"
        onClick={() => {
  if (showItemForm) {
    resetItemForm()
    setShowItemForm(false)
  } else {
    resetItemForm()
    setShowItemForm(true)
  }
}}
        disabled={loading}
      >
        + Adicionar item
      </button>
    </div>

{showItemForm &&
  (selectedCharacterId || editingItem) &&
  createPortal(
    <div className="item-modal-overlay">
      <div
        className="item-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-modal-title"
      >
        <form className="add-form item-editor-form" onSubmit={createItem}>
                    <div className="form-heading">
                      <div>
                        <h3>{editingItem ? 'Editar item' : 'Novo item'}</h3>
                        <p>
                          {editingItem
                            ? 'Altere os dados do item e salve as mudanças.'
                            : 'O item será associado ao personagem selecionado.'}
                        </p>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span>{editingItem ? '✎' : '✧'}</span>
                        <button type="button" className="secondary-button" onClick={() => { resetItemForm(); setShowItemForm(false) }}>Fechar</button>
                      </div>
                    </div>

                    <label>
                      Nome do item
                      <input
                        value={newItemName}
                        onChange={(event) => setNewItemName(event.target.value)}
                        placeholder="Ex.: Espada de prata"
                        maxLength={100}
                        required
                      />
                    </label>

                    <label>
                      Descrição
                      <input
                        value={newItemDescription}
                        onChange={(event) =>
                          setNewItemDescription(event.target.value)
                        }
                        placeholder="Detalhes do item (opcional)"
                        maxLength={1000}
                      />
                    </label>

                    <div className="form-row">
                      <div className="emoji-field">
                        <label>Emoji do item</label>

                        <div className="emoji-grid">
                          {availableEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={
                                newItemEmoji === emoji
                                  ? 'emoji-option selected'
                                  : 'emoji-option'
                              }
                              onClick={() => setNewItemEmoji(emoji)}
                              aria-label={`Selecionar emoji ${emoji}`}
                              aria-pressed={newItemEmoji === emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

<p className="emoji-preview">
  <span className="emoji-preview-label">Emoji selecionado:</span>
  <span className="emoji-preview-icon">{newItemEmoji}</span>
</p>
                      </div>

                      <section className="item-classifications-panel">
                        <div className="item-classifications-heading">
                          <div><strong>Classificações do item</strong><p>Marque todas as opções que se aplicam. Um item pode ter várias classificações.</p></div>
                          <span>{newItemCategories.length} selecionada{newItemCategories.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="item-classifications-grid">
                          {categories.filter(category => category !== 'Todos').map(category => (
                            <label key={category} className={newItemCategories.includes(category) ? 'item-classification-option selected' : 'item-classification-option'}>
                              <input type="checkbox" checked={newItemCategories.includes(category)} onChange={event => {
                                const next = event.target.checked ? [...newItemCategories, category] : newItemCategories.filter(value => value !== category)
                                setNewItemCategories(next)
                                if (next.length) setNewItemCategory(next[0])
                                const automaticWeight = getAutomaticItemWeight(next, newEquipmentType, newArmorClass, newWeaponClass)
                                if (automaticWeight !== null) setNewItemWeight(String(automaticWeight))
                              }} />
                              <span className="item-classification-check">{newItemCategories.includes(category) ? '✓' : '+'}</span>
                              <span>{category}</span>
                            </label>
                          ))}
                        </div>
                        {!newItemCategories.length && <p className="item-classifications-hint">Selecione pelo menos uma classificação.</p>}
                      </section>

                      {newItemCategories.includes('Consumíveis') && (
                        <section className="scarcity-editor-card">
                          <div className="scarcity-editor-heading">
                            <span className="scarcity-editor-icon">⌛</span>
                            <div><strong>Sistema de escassez</strong><p>Define a chance de o consumível se esgotar conforme é utilizado.</p></div>
                          </div>
                          <label>Nível inicial de escassez
                            <select value={newScarcityLevel} disabled={newScarcityExhausted} onChange={event => setNewScarcityLevel(event.target.value as '1' | '2' | '3' | '4')}>
                              <option value="1">Nível 1 — d12</option>
                              <option value="2">Nível 2 — d8</option>
                              <option value="3">Nível 3 — d6</option>
                              <option value="4">Nível 4 — d4</option>
                            </select>
                          </label>
                          <div className="scarcity-level-preview">
                            <div><span>Dado ao usar</span><strong>{{ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' }[newScarcityLevel]}</strong></div>
                            <div><span>Carga</span><strong>{newScarcityExhausted ? 0 : ({ '1': 7, '2': 5, '3': 3, '4': 1 } as Record<string, number>)[newScarcityLevel]}</strong></div>
                          </div>
                          <p className="scarcity-editor-note">Ao usar, role o dado indicado. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p>
                          <label className="scarcity-exhausted-toggle"><input type="checkbox" checked={newScarcityExhausted} disabled={newScarcityExhausted} onChange={event => setNewScarcityExhausted(event.target.checked)} /><span><strong>Item esgotado</strong><small>Marque para impedir novas rolagens. Desmarque para reativar o consumível.</small></span></label>
                        </section>
                      )}

<label style={labelStyle}>
  Raridade
</label>

<select
  value={newItemRarity}
  onChange={event => setNewItemRarity(event.target.value)}
  style={inputStyle}
>
  <option value="comum">Comum</option>
  <option value="incomum">Incomum</option>
  <option value="raro">Raro</option>
  <option value="épico">Épico</option>
  <option value="mítico">Mítico</option>
  <option value="relíquia">Relíquia</option>
</select>

                      <label>
                        Tipo de equipamento
                        <select value={newEquipmentType} onChange={event => { const nextType = event.target.value as 'none' | 'armor' | 'protection'; setNewEquipmentType(nextType); const automaticWeight = getAutomaticItemWeight(newItemCategories, nextType, newArmorClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}>
                          <option value="none">Item comum</option>
                          <option value="armor">Armadura</option>
                          <option value="protection">Proteção</option>
                        </select>
                      </label>

                      {newEquipmentType === 'armor' && <>
                        <label>Tipo de armadura<select value={newArmorClass} onChange={event => { const nextClass = event.target.value as 'leve' | 'media' | 'pesada'; setNewArmorClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, nextClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>
                        {newArmorClass !== 'pesada' && <label>Tipos de dano protegidos<select value={newArmorCoverage} onChange={event => setNewArmorCoverage(event.target.value as 'cortante_perfurante' | 'especial_bruto')}><option value="cortante_perfurante">Cortante e perfurante</option><option value="especial_bruto">Especial e bruto</option></select></label>}
                        <div className="equipment-rules-preview">
  <strong>Regras da armadura</strong>
  <p>
    Carga: {newArmorClass === 'leve' ? 2 : newArmorClass === 'media' ? 4 : 6}
  </p>
  <p>
    Proteção: {newArmorClass === 'leve'
      ? '(Resistência ÷ 2) + 4'
      : newArmorClass === 'media'
        ? 'Resistência + 6'
        : '(Resistência × 2) + 8'}
  </p>
  <p>
    Destreza de armadura: {newArmorClass === 'leve'
      ? 'Destreza integral'
      : newArmorClass === 'media'
        ? '½ dos pontos de destreza'
        : '0'}
  </p>
  <p>
    Penalidades: {newArmorClass === 'media'
      ? '−5 em Reflexo; metade do deslocamento'
      : newArmorClass === 'pesada'
        ? '−10 em Reflexo e Corrida; ¼ do deslocamento'
        : 'Sem penalidade; deslocamento normal'}
  </p>
</div>
                      </>}

                      {newEquipmentType === 'protection' && <>
                        <label>Nível de proteção<select value={newProtectionTier} onChange={event => setNewProtectionTier(event.target.value as 'basica' | 'moderada' | 'avancada')}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label>
                        <label>Tipo de resistência<select value={newProtectionMode} onChange={event => setNewProtectionMode(event.target.value as 'resistencia' | 'sanidade')}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label>
                        <div className="equipment-rules-preview"><strong>Regras da proteção</strong><p>Carga: 0</p><p>Proteção: {newProtectionTier === 'basica' ? '¼' : newProtectionTier === 'moderada' ? '½' : 'integral'} dos pontos de {newProtectionMode === 'resistencia' ? 'resistência' : 'mental'}.</p><p>Dano de sanidade ao perder: {newProtectionTier === 'basica' ? '1d8' : newProtectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}.</p></div>
                      </>}

                      {newItemCategories.includes('Armas') && <>
                        <label>Classificação da arma<select value={newWeaponClass} onChange={event => { const nextClass = event.target.value; setNewWeaponClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, nextClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="improvised">Improvisada — 1d4 · 0,5 kg</option><option value="advanced">Lâmina avançada — 1d6 · 1 kg</option><option value="special">Lâmina especial — 1d8 · 1 kg</option><option value="black_red">Lâmina preta/vermelha — 1d10 · 1,5 kg</option><option value="mutable">Lâmina mutável — 1d12 · 2 kg</option></select></label>
                        <div className="equipment-rules-preview"><strong>Configuração da arma</strong><p>Dano extra: {{improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}[newWeaponClass]}</p><p>Carga: {{improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}[newWeaponClass]} kg</p></div>
                      </>}

                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          max="999"
                          step="1"
                          value={newItemQuantity}
                          onChange={(event) =>
                            setNewItemQuantity(event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Peso por unidade (kg)
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          step="0.1"
                          value={newItemWeight}
                          onChange={(event) => setNewItemWeight(event.target.value)}
                          disabled={getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null}
                          required
                        />
                        <small>{getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null
                          ? 'Peso definido automaticamente pela classificação e bloqueado para manter as regras do equipamento.'
                          : 'Informe o peso por unidade deste item.'}</small>
                      </label>
                    </div>

<label>
  Valor unitário
  <input
    type="number"
    min="0"
    step="0.01"
    value={newScarcityExhausted && newItemCategories.includes('Consumíveis') ? '0' : newItemUnitPrice}
    onChange={event => setNewItemUnitPrice(event.target.value)}
    disabled={newScarcityExhausted && newItemCategories.includes('Consumíveis')}
    placeholder="Ex.: 500"
  />
</label>

<label>
  Moeda
  <select
    value={newItemCurrencyId}
    onChange={event => setNewItemCurrencyId(event.target.value)}
  >
    <option value="">Sem moeda definida</option>
    {selectedCampaign?.currency_config?.currencies?.map((currency, index) => (
      <option key={currency.id} value={currency.id}>
        {index === 0 ? '★ Moeda do sistema — ' : ''}{currency.name} ({currency.symbol})
      </option>
    ))}
  </select>
</label>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading
                        ? 'Salvando...'
                        : editingItem
                          ? 'Salvar alterações'
                          : 'Salvar item'}
                    </button>
        </form>
      </div>
    </div>,
    document.body
  )}

    <div className="sheet-capacity-overview" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:12,margin:'4px 0 18px'}}>
      <div style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line, rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>▤</span> Objetos</div>
        <div style={{fontSize:27,fontWeight:800,lineHeight:1.15,color:'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{totalObjects}</div>
        <div style={{fontSize:12,marginTop:5,color:'var(--season-muted,#aaa2b5)'}}>{totalObjects === 1 ? 'item na mochila' : 'itens na mochila'}</div>
      </div>
      <div style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line, rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>⚖</span> Peso carregado</div>
        <div style={{fontSize:27,fontWeight:800,lineHeight:1.15,color:'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{totalWeight.toFixed(1)}<span style={{fontSize:14,fontWeight:650,marginLeft:4}}>kg</span></div>
        <div style={{fontSize:12,marginTop:5,color:'var(--season-muted,#aaa2b5)'}}>peso total dos itens</div>
      </div>
      <div style={{padding:'15px 17px',borderRadius:14,border:'1px solid var(--season-line, rgba(160,140,190,.2))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(140,120,170,.12)),var(--season-surface,rgba(20,18,28,.72)))',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9,color:'var(--season-muted,#aaa2b5)',fontSize:12,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase'}}><span aria-hidden="true" style={{fontSize:17}}>🎒</span> Capacidade livre</div>
        <div style={{fontSize:27,fontWeight:800,lineHeight:1.15,color:remainingCapacity < 0 ? '#ff8b8b' : 'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{remainingCapacity.toFixed(1)}<span style={{fontSize:14,fontWeight:650,marginLeft:4}}>kg</span></div>
        <div style={{fontSize:12,marginTop:5,color:'var(--season-muted,#aaa2b5)'}}>{remainingCapacity < 0 ? 'acima do limite de carga' : 'disponíveis para carregar'}</div>
      </div>
      <div style={{gridColumn:'1 / -1',padding:'12px 15px',borderRadius:12,border:'1px solid var(--season-line,rgba(160,140,190,.16))',background:'var(--season-bg,rgba(10,9,15,.28))'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:8,fontSize:12}}><span style={{color:'var(--season-muted,#aaa2b5)',fontWeight:650}}>Uso da capacidade</span><strong style={{color:'var(--season-text,#f4efff)',fontVariantNumeric:'tabular-nums'}}>{capacityPercent.toFixed(0)}%</strong></div>
        <div role="progressbar" aria-label="Capacidade utilizada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.max(0,capacityPercent))} style={{height:8,overflow:'hidden',borderRadius:99,background:'var(--season-line,rgba(160,140,190,.22))'}}><div style={{height:'100%',width:`${Math.min(100,Math.max(0,capacityPercent))}%`,borderRadius:99,background:remainingCapacity < 0 ? 'linear-gradient(90deg,#e78b62,#e45f70)' : 'linear-gradient(90deg,var(--season-secondary,#8d70cf),var(--season-primary,#c8b5ff))',transition:'width .25s ease'}} /></div>
      </div>
    </div>

    <div className="inventory-toolbar">
      <div className="category-tabs">
        {categories.map(category => (
          <button key={category} className={activeCategory === category ? 'category-tab selected' : 'category-tab'} onClick={() => setActiveCategory(category)}>
            {category}
          </button>
        ))}
      </div>
      <div className="inventory-extra-controls">
        <label className="search-box">
          <span>⌕</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar item..." aria-label="Buscar item" />
          <kbd>/</kbd>
        </label>
        <button type="button" className={favoriteOnly ? 'category-tab selected' : 'category-tab'} onClick={() => setFavoriteOnly(current => !current)} aria-pressed={favoriteOnly}>
          {favoriteOnly ? '★ Favoritos' : '☆ Favoritos'}
        </button>
        <label className="inventory-sort-label">
          <span>Ordenar:</span>
          <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Ordenar itens">
            <option value="created">Adicionados</option>
            <option value="name">Nome</option>
            <option value="category">Categoria</option>
            <option value="weight">Maior peso</option>
            <option value="quantity">Maior quantidade</option>
          </select>
        </label>
      </div>
    </div>

    {itemsLoading ? (
      <div className="empty-state"><p>Carregando inventário...</p></div>
    ) : filteredItems.length === 0 ? (
      <div className="empty-state">
        <span>▤</span>
        <h3>{items.length === 0 ? 'Mochila vazia' : 'Nenhum item encontrado'}</h3>
        <p>{items.length === 0 ? 'Adicione o primeiro item deste personagem.' : 'Tente outra busca ou selecione outra categoria.'}</p>
        {items.length === 0 ? (
          <button type="button" onClick={() => {
  resetItemForm()
  setShowItemForm(true)
}}>Adicionar primeiro item</button>
        ) : (
          <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setFavoriteOnly(false) }}>Limpar filtros</button>
        )}
      </div>
    ) : (
      <div className="item-grid">
        {filteredItems.map(item => (
          <article className="item-card inventory-item-card" key={item.id} onClickCapture={event => {
  const target = event.target as HTMLElement
  if (target.closest('button, input, select, textarea, a, [role=\"button\"]')) return
  setSelectedItemDetails(item)
}}
style={{cursor:'pointer'}}>
            <div className="item-card-top">
              <button type="button" className="item-art" onClick={event => { event.stopPropagation(); setEmojiPickerItem(item) }} title="Clique para alterar o emoji" aria-label={`Alterar emoji de ${item.name}`} style={{cursor:'pointer',font:'inherit',fontSize:28}}>
                {typeof item.metadata?.icon === 'string' ? item.metadata.icon : '📦'}
              </button>
              <div className="item-actions">
                <button type="button" className="item-menu" title={item.metadata?.favorite === true ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-label={item.metadata?.favorite === true ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`} aria-pressed={item.metadata?.favorite === true} onClick={event => { event.stopPropagation(); void toggleFavorite(item) }}>{item.metadata?.favorite === true ? '★' : '☆'}</button>
                <button type="button" className="item-menu" title="Duplicar item" aria-label={`Duplicar ${item.name}`} disabled={loading} onClick={event => { event.stopPropagation(); void duplicateItem(item) }}>⧉</button>
                {item.metadata?.equipmentType === 'armor' && <button type="button" className={`item-menu equipment-card-icon armor-card-icon ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} title={item.metadata?.equipped === true ? 'Desequipar armadura' : 'Equipar armadura'} aria-label={item.metadata?.equipped === true ? `Desequipar ${item.name}` : `Equipar ${item.name}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => { event.stopPropagation(); const nextEquipped=item.metadata?.equipped!==true; if(nextEquipped){ const others=items.filter(entry=>entry.character_id===item.character_id && entry.id!==item.id && entry.metadata?.equipmentType==='armor' && entry.metadata?.equipped===true); for(const other of others) await supabase.from('inventory_items').update({metadata:{...(other.metadata||{}),equipped:false}}).eq('id',other.id) } const {data,error}=await supabase.from('inventory_items').update({metadata:{...(item.metadata||{}),equipped:nextEquipped}}).eq('id',item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle(); if(error||!data){setError(`Não foi possível alterar a armadura: ${error?.message||'sem retorno'}`);return} setItems(current=>current.map(entry=>entry.id===item.id?data as Item:entry.character_id===item.character_id&&entry.metadata?.equipmentType==='armor'&&entry.id!==item.id?{...entry,metadata:{...(entry.metadata||{}),equipped:false}}:entry)); setNotice(nextEquipped?`${item.name} equipada.`:`${item.name} desequipada.`) }}>{item.metadata?.equipped===true?'✓':'🛡'}</button>}
                {item.metadata?.equipmentType === 'protection' && <button type="button" className={`item-menu equipment-card-icon protection-card-icon ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} title={item.metadata?.equipped === true ? 'Desequipar proteção' : 'Equipar proteção'} aria-label={item.metadata?.equipped === true ? `Desequipar ${item.name}` : `Equipar ${item.name}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => { event.stopPropagation(); const nextEquipped=item.metadata?.equipped!==true; const {data,error}=await supabase.from('inventory_items').update({metadata:{...(item.metadata||{}),equipped:nextEquipped}}).eq('id',item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle(); if(error||!data){setError(`Não foi possível alterar a proteção: ${error?.message||'sem retorno'}`);return} setItems(current=>current.map(entry=>entry.id===item.id?data as Item:entry)); setNotice(nextEquipped?`${item.name} equipada.`:`${item.name} desequipada.`) }}>{item.metadata?.equipped===true?'✓':'✧'}</button>}
                {Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas') && <button type="button" className={`item-menu equipment-card-icon weapon-card-icon ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} title={item.metadata?.equipped === true ? 'Desequipar arma' : 'Equipar arma'} aria-label={item.metadata?.equipped === true ? `Desequipar ${item.name}` : `Equipar ${item.name}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => { event.stopPropagation(); const nextEquipped = item.metadata?.equipped !== true; if (nextEquipped) { const otherEquipped = items.filter(entry => entry.character_id === item.character_id && entry.id !== item.id && entry.metadata?.equipped === true && Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas')); for (const other of otherEquipped) { await supabase.from('inventory_items').update({metadata:{...(other.metadata || {}),equipped:false}}).eq('id',other.id) } } const {data,error: equipError}=await supabase.from('inventory_items').update({metadata:{...(item.metadata || {}),equipped:nextEquipped}}).eq('id',item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle(); if (equipError || !data) { setError(`Não foi possível alterar a arma equipada: ${equipError?.message || 'sem retorno'}`); return } setItems(current=>current.map(entry=>entry.id===item.id?data as Item:entry.id!==item.id&&entry.character_id===item.character_id&&entry.metadata?.equipped===true&&Array.isArray(entry.metadata?.categories)&&entry.metadata.categories.includes('Armas')?{...entry,metadata:{...(entry.metadata||{}),equipped:false}}:entry)); setNotice(nextEquipped?`${item.name} equipada.`:`${item.name} desequipada.`) }}>{item.metadata?.equipped === true ? '✓' : '⚔'}</button>}
                <button type="button" className="item-menu" title="Editar item" aria-label={`Editar ${item.name}`} disabled={loading} onClick={event => {
  event.stopPropagation()
  startEditingItem(item)
}}>✎</button>
                <button type="button" className="item-menu" title="Remover item" aria-label={`Remover ${item.name}`} disabled={loading} onClick={event => { event.stopPropagation(); void removeItem(item) }}>×</button>
              </div>
            </div>
            
            <div className="item-category">{item.category}</div>
            <h3>{item.name}</h3>
            <p className="item-description">{item.description || 'Sem descrição.'}</p>
            {(item.metadata?.equipmentType === 'armor' || item.metadata?.equipmentType === 'protection' || (Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas'))) && <div className="inventory-equipment-controls" aria-label={`Equipamento de ${item.name}`}>
              <span className="inventory-equipment-label">EQUIPAMENTO</span>
              <button type="button" className={`inventory-equip-button ${item.metadata?.equipped === true ? 'is-equipped' : ''}`} aria-pressed={item.metadata?.equipped === true} onClick={async event => {
                event.stopPropagation();
                const isWeapon = Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas');
                const type = isWeapon ? 'weapon' : item.metadata?.equipmentType;
                const nextEquipped = item.metadata?.equipped !== true;
                const others = nextEquipped && (type === 'weapon' || type === 'armor') ? items.filter(entry => entry.character_id === item.character_id && entry.id !== item.id && entry.metadata?.equipped === true && (type === 'weapon' ? Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas') : entry.metadata?.equipmentType === 'armor')) : [];
                for (const other of others) {
                  const { error: otherError } = await supabase.from('inventory_items').update({ metadata: { ...(other.metadata || {}), equipped: false } }).eq('id', other.id);
                  if (otherError) { setError(`Não foi possível atualizar outro equipamento: ${otherError.message}`); return; }
                }
                const { data, error: equipError } = await supabase.from('inventory_items').update({ metadata: { ...(item.metadata || {}), equipped: nextEquipped } }).eq('id', item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle();
                if (equipError || !data) { setError(`Não foi possível alterar o equipamento: ${equipError?.message || 'sem retorno'}`); return; }
                setItems(current => current.map(entry => entry.id === item.id ? data as Item : others.some(other => other.id === entry.id) ? { ...entry, metadata: { ...(entry.metadata || {}), equipped: false } } : entry));
                setNotice(nextEquipped ? `${item.name} equipado(a).` : `${item.name} desequipado(a).`);
              }}>
                <span className="inventory-equip-symbol">{item.metadata?.equipped === true ? '✓' : item.metadata?.equipmentType === 'armor' ? '🛡' : item.metadata?.equipmentType === 'protection' ? '✧' : '⚔'}</span>
                {item.metadata?.equipped === true ? 'Equipado · Desequipar' : item.metadata?.equipmentType === 'armor' ? 'Equipar armadura' : item.metadata?.equipmentType === 'protection' ? 'Equipar proteção' : 'Equipar arma'}
              </button>
            </div>}
            <div className="item-footer">
              <span>⚖ {`${(Number(item.weight) || 0).toFixed(1)} kg / un.`}</span>
              <div className="quantity-controls" aria-label={`Quantidade de ${item.name}`}>
                <button type="button" className="quantity-button" onClick={event => { event.stopPropagation(); void changeItemQuantity(item, Number(item.quantity)-1) }} disabled={Number(item.quantity)<=1 || updatingQuantityItemId===item.id} aria-label={`Diminuir quantidade de ${item.name}`}>−</button>
                <span className="quantity" aria-live="polite">{item.quantity}</span>
                <button type="button" className="quantity-button" onClick={event => { event.stopPropagation(); void changeItemQuantity(item, Number(item.quantity)+1) }} disabled={Number(item.quantity)>=999 || updatingQuantityItemId===item.id} aria-label={`Aumentar quantidade de ${item.name}`}>+</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    )}
    <small style={{display:'block',marginTop:12,color:'var(--season-muted, #b9b4c2)'}}>
      Os itens pertencem ao personagem selecionado na campanha. Alterações, equipamentos e quantidades são sincronizados com a ficha.
    </small>
  </section>
)}

{canAccessSelectedCharacter && selectedCampaign?.currency_config?.currencies?.length && (
  <section className="inventory-section currency-wallet" style={{display:'grid',gridTemplateColumns:'minmax(0,1.05fr) minmax(0,.95fr)',columnGap:22,rowGap:0,alignItems:'start',width:'100%',boxSizing:'border-box',position:'relative',isolation:'isolate',overflow:'hidden',padding:24,borderRadius:24,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'radial-gradient(ellipse at 8% 0%,var(--season-accent-soft,rgba(220,135,65,.16)),transparent 42%),linear-gradient(145deg,var(--season-surface,rgba(20,18,25,.96)),var(--season-surface-alt,rgba(255,255,255,.035)))',boxShadow:'0 18px 48px rgba(0,0,0,.16)'}}>
    <style>{`
      .currency-wallet > .inventory-heading { grid-column: 1 / -1; width: 100%; box-sizing: border-box; }
      .currency-wallet > .currency-balances-grid { grid-column: 1; width: 100%; min-width: 0; align-self: stretch; }
      .currency-wallet > .currency-actions { grid-column: 2; width: 100%; min-width: 0; align-self: stretch; }
      @media (max-width: 760px) {
        .currency-wallet { grid-template-columns: minmax(0, 1fr) !important; }
        .currency-wallet > .inventory-heading,
        .currency-wallet > .currency-balances-grid,
        .currency-wallet > .currency-actions { grid-column: 1 !important; }
      }
      .currency-wallet .currency-balance { min-width: 0; }
      .currency-wallet .currency-actions input { max-width: 100%; }
      /* Refinamento visual da carteira */

/* Cartões das moedas */
.currency-wallet .currency-balance {
  position: relative;
  overflow: hidden;
  min-width: 0;
  border-radius: 20px !important;
  transition: transform .22s ease,
              border-color .22s ease,
              box-shadow .22s ease;
}

.currency-wallet .currency-balance::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at top right,
    var(--season-accent-soft, rgba(220,135,65,.16)),
    transparent 65%
  );
  pointer-events: none;
}

.currency-wallet .currency-balance:hover {
  transform: translateY(-4px);
  border-color: var(--season-accent, currentColor) !important;
  box-shadow: 0 14px 30px rgba(0,0,0,.20) !important;
}

/* Painel de movimentações */
.currency-wallet .currency-actions {
  border-radius: 20px !important;
  backdrop-filter: blur(12px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.06),
    0 12px 28px rgba(0,0,0,.12);
}

/* Campos */
.currency-wallet input,
.currency-wallet select,
.currency-wallet textarea {
  transition: border-color .2s ease,
              box-shadow .2s ease;
}

.currency-wallet input:focus,
.currency-wallet select:focus,
.currency-wallet textarea:focus {
  outline: none;
  border-color: var(--season-accent, currentColor) !important;
  box-shadow: 0 0 0 3px var(--season-accent-soft, rgba(220,135,65,.15));
}

/* Histórico */
.currency-wallet .currency-history-entry {
  border-radius: 14px;
  transition: background .2s ease,
              transform .2s ease;
}

.currency-wallet .currency-history-entry:hover {
  transform: translateX(3px);
  background: var(--season-surface-alt, rgba(255,255,255,.07));
}

/* Botões */
.currency-wallet button {
  transition: transform .18s ease,
              filter .18s ease;
}

.currency-wallet button:hover:not(:disabled) {
  filter: brightness(1.08);
}

.currency-wallet button:active:not(:disabled) {
  transform: scale(.97);
}

/* Telas menores */
@media (max-width: 760px) {
  .currency-wallet {
    padding: 18px !important;
  }
}

/* Respeita preferência por movimento reduzido */
@media (prefers-reduced-motion: reduce) {
  .currency-wallet * {
    transition: none !important;
    transform: none !important;
  }
}
  /* ===== HÄXBAG — CARTEIRA PREMIUM ===== */

.currency-wallet {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(220, 135, 65, .16);
  border-radius: 24px !important;
  background:
    radial-gradient(
      ellipse at 100% 0%,
      rgba(220, 135, 65, .09),
      transparent 42%
    ),
    var(--season-surface, #171717);
  box-shadow:
    0 18px 45px rgba(0, 0, 0, .20),
    inset 0 1px 0 rgba(255, 255, 255, .035);
}

/* Cabeçalho */
.currency-wallet h2,
.currency-wallet h3 {
  letter-spacing: -.035em;
}

/* Cartões de saldo */
.currency-wallet .currency-balance {
  border: 1px solid rgba(255, 255, 255, .075) !important;
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, .055),
      rgba(255, 255, 255, .012)
    ) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .055),
    0 8px 22px rgba(0, 0, 0, .13);
}

.currency-wallet .currency-balance:hover {
  border-color: rgba(220, 135, 65, .38) !important;
}

/* Valores monetários */
.currency-wallet .currency-balance strong,
.currency-wallet .currency-balance b {
  font-variant-numeric: tabular-nums;
  letter-spacing: -.045em;
}

/* Painel de movimentações */
.currency-wallet .currency-actions {
  border: 1px solid rgba(220, 135, 65, .13) !important;
  background:
    linear-gradient(
      145deg,
      rgba(220, 135, 65, .055),
      rgba(255, 255, 255, .018)
    ) !important;
}

/* Histórico */
.currency-wallet .currency-history-entry {
  border: 1px solid rgba(255, 255, 255, .045);
  background: rgba(255, 255, 255, .018);
  padding: 12px;
}

.currency-wallet .currency-history-entry:hover {
  border-color: rgba(220, 135, 65, .22);
}

/* Campos */
.currency-wallet input,
.currency-wallet select,
.currency-wallet textarea {
  border-radius: 12px !important;
  background-color: rgba(0, 0, 0, .16) !important;
}

/* Botões */
.currency-wallet button {
  border-radius: 12px;
  font-weight: 600;
}

.currency-wallet button:hover:not(:disabled) {
  box-shadow: 0 5px 16px rgba(220, 135, 65, .12);
}

/* Responsividade */
@media (max-width: 760px) {
  .currency-wallet {
    border-radius: 18px !important;
  }
}
    `}</style>
    <div className="inventory-heading" style={{position:'relative',alignItems:'center',gap:16,marginBottom:24,paddingBottom:18,borderBottom:'1px solid var(--season-line,rgba(255,255,255,.12))'}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <div aria-hidden="true" style={{width:58,height:58,flex:'0 0 58px',display:'grid',placeItems:'center',borderRadius:19,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'linear-gradient(145deg,var(--season-accent-soft,rgba(220,135,65,.20)),var(--season-surface-alt,rgba(255,255,255,.04)))',fontSize:28,boxShadow:'0 10px 28px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.12)'}}>👛</div>
        <div>
          <h3 style={{margin:'0 0 5px',fontSize:24,fontWeight:850,letterSpacing:'-.04em'}}>Carteira</h3>
          <p style={{margin:0,fontSize:13}}>Recursos de <strong>{selectedCharacter?.name ?? 'este personagem'}</strong></p>
          <small style={{display:'block',marginTop:5,opacity:.68}}>Saldos e histórico de movimentações</small>
        </div>
      </div>
      <span style={{marginLeft:'auto',padding:'6px 10px',borderRadius:999,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'var(--season-surface-alt,rgba(255,255,255,.05))',fontSize:11,fontWeight:750,letterSpacing:'.08em',textTransform:'uppercase',whiteSpace:'nowrap'}}>Finanças</span>
    </div>

<div className="currency-tabs">
  <button
    type="button"
    className={!showCurrencyHistory ? 'currency-tab active' : 'currency-tab'}
    onClick={() => {
      if (showCurrencyHistory) void toggleCurrencyHistory()
    }}
  >
    👛 Carteira
  </button>

  <button
    type="button"
    className={showCurrencyHistory ? 'currency-tab active' : 'currency-tab'}
    onClick={() => {
      if (!showCurrencyHistory) void toggleCurrencyHistory()
    }}
  >
    ▤ Histórico
  </button>
</div>


{!showCurrencyHistory ? (
  <>
    <div className="currency-balances-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,210px),1fr))',gap:14,marginBottom:24}}>
      {selectedCampaign.currency_config.currencies.map((currency, index) => (
        <div className="currency-balance" key={currency.id} style={{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',gap:14,minHeight:132,padding:19,borderRadius:19,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'linear-gradient(145deg,var(--season-surface-alt,rgba(255,255,255,.09)),var(--season-surface,rgba(0,0,0,.10)))',boxShadow:'0 12px 28px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.07)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <span style={{fontSize:12,fontWeight:700,letterSpacing:'.045em',color:'var(--season-muted, #aaa)'}}>{currency.name}</span>
            <span aria-hidden="true" style={{width:34,height:34,display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-accent-soft,rgba(220,135,65,.16))',color:'var(--season-accent,currentColor)',fontSize:16}}>{index===0?'◈':'◇'}</span>
          </div>
          <strong style={{fontSize:'clamp(25px,3.4vw,33px)',lineHeight:1.12,fontWeight:850,letterSpacing:'-.035em',fontVariantNumeric:'tabular-nums',overflowWrap:'anywhere'}}><span style={{fontSize:'.78em',opacity:.8,marginRight:5}}>{currency.symbol}</span>{(currencyBalances[currency.id] ?? 0).toLocaleString('pt-BR')}</strong>
          <span style={{fontSize:11,color:'var(--season-muted, #aaa)',opacity:.8}}>Saldo disponível</span>
        </div>
      ))}
    </div>

    {currencyLoading ? (
      <p>Carregando carteira...</p>
    ) : (
      <div className="currency-actions" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:14,alignItems:'end',padding:18,borderRadius:18,border:'1px solid var(--season-line,rgba(255,255,255,.12))',background:'var(--season-surface-alt,rgba(255,255,255,.035))'}}>
        <label style={{display:'grid',gap:8,fontSize:12,fontWeight:750,letterSpacing:'.035em',color:'var(--season-muted, #aaa)'}}>
          VALOR
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={currencyAmount}
            onChange={event => setCurrencyAmount(event.target.value)}
            placeholder="Quanto deseja movimentar?"
            style={{width:'100%',minHeight:46,boxSizing:'border-box',padding:'11px 13px',borderRadius:12,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'var(--season-surface,rgba(0,0,0,.16))',color:'var(--season-text,inherit)',outlineColor:'var(--season-accent,currentColor)'}}
          />
        </label>

        <label style={{display:'grid',gap:8,fontSize:12,fontWeight:750,letterSpacing:'.035em',color:'var(--season-muted, #aaa)'}}>
          DESCRIÇÃO (OPCIONAL)
          <input
            type="text"
            value={currencyDescription}
            onChange={event => setCurrencyDescription(event.target.value)}
            placeholder="Ex.: Recompensa de missão"
            style={{width:'100%',minHeight:46,boxSizing:'border-box',padding:'11px 13px',borderRadius:12,border:'1px solid var(--season-line,rgba(255,255,255,.16))',background:'var(--season-surface,rgba(0,0,0,.16))',color:'var(--season-text,inherit)',outlineColor:'var(--season-accent,currentColor)'}}
          />
        </label>

        <div className="currency-buttons" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',gridColumn:'1 / -1'}}>
          <button
            type="button"
            className="currency-action-button currency-action-add"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,minHeight:44,padding:'10px 16px',borderRadius:12,border:'1px solid rgba(94,205,145,.42)',background:'linear-gradient(135deg, rgba(55,174,112,.22), rgba(55,174,112,.10))',color:'var(--text-primary, inherit)',fontWeight:700,letterSpacing:'.01em',boxShadow:'0 3px 12px rgba(30,140,85,.10)',cursor:'pointer',transition:'transform .18s ease, box-shadow .18s ease'}}
            disabled={currencyActionLoading || !canAccessSelectedCharacter}
            onClick={() => void handleCurrencyAdjustment('add')}
          >
            <span className="currency-action-icon" aria-hidden="true" style={{display:'grid',placeItems:'center',width:23,height:23,borderRadius:8,background:'rgba(65,190,125,.18)',fontSize:18,lineHeight:1}}>＋</span>
            <span>{currencyActionLoading ? 'Processando…' : 'Adicionar saldo'}</span>
          </button>

          <button
            type="button"
            className="currency-action-button currency-action-remove"
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,minHeight:44,padding:'10px 16px',borderRadius:12,border:'1px solid rgba(224,117,117,.38)',background:'linear-gradient(135deg, rgba(205,82,82,.17), rgba(205,82,82,.07))',color:'var(--text-primary, inherit)',fontWeight:700,letterSpacing:'.01em',boxShadow:'0 3px 12px rgba(150,50,50,.08)',cursor:'pointer',transition:'transform .18s ease, box-shadow .18s ease'}}
            disabled={currencyActionLoading || !canAccessSelectedCharacter}
            onClick={() => void handleCurrencyAdjustment('remove')}
          >
            <span className="currency-action-icon" aria-hidden="true" style={{display:'grid',placeItems:'center',width:23,height:23,borderRadius:8,background:'rgba(220,105,105,.16)',fontSize:18,lineHeight:1}}>−</span>
            <span>Retirar saldo</span>
          </button>
        </div>
      </div>
    )}
  </>
) : (
<div className="currency-history-page">
  <div className="currency-history-page-header">
    <div className="currency-history-title">
      <div>
        <span className="currency-section-eyebrow">FINANÇAS DA CAMPANHA</span>
        <h3>Histórico de transações</h3>
        <p>Acompanhe todas as movimentações desta carteira.</p>
      </div>

      <button
        type="button"
        className="secondary-button currency-back-button"
        onClick={() => void toggleCurrencyHistory()}
      >
        ← Voltar à carteira
      </button>
    </div>

    <div className="currency-history-summary">
      <div>
        <span>Movimentações registradas</span>
        <strong>{currencyTransactions.length}</strong>
      </div>

      <button
        type="button"
        className="currency-clear-button"
        disabled={currencyHistoryLoading || currencyTransactions.length === 0}
        onClick={() => void clearCurrencyHistory()}
      >
        <span>🗑</span> Limpar histórico
      </button>
    </div>
  </div>

  {currencyHistoryLoading ? (
    <div className="currency-history-empty">
      <p>Carregando histórico...</p>
    </div>
  ) : currencyTransactions.length === 0 ? (
    <div className="currency-history-empty">
      <span>📜</span>
      <strong>Nenhuma movimentação encontrada</strong>
      <p>Quando uma moeda for adicionada ou retirada, ela aparecerá aqui.</p>
    </div>
  ) : (
    <div className="currency-history-list">
      {currencyTransactions.map(transaction => {
        const currency = selectedCampaign?.currency_config?.currencies
          ?.find(item => item.id === transaction.currency_id)

        const isEntry = transaction.amount_delta > 0

        return (
          <article
            className={`currency-history-entry ${isEntry ? 'is-entry' : 'is-withdrawal'}`}
            key={transaction.id}
          >
            <div className="currency-history-icon">
              {isEntry ? '↙' : '↗'}
            </div>

            <div className="currency-history-info">
              <strong>{isEntry ? 'Entrada' : 'Retirada'}</strong>
              <span>{transaction.description || 'Sem descrição'}</span>
              <small>
                {new Date(transaction.created_at).toLocaleString('pt-BR')}
              </small>
            </div>

            <div className="currency-history-values">
              <strong>
                {isEntry ? '+' : '−'}
                {currency?.symbol ?? ''}
                {Math.abs(transaction.amount_delta).toLocaleString('pt-BR')}
              </strong>
              <small>
                Saldo após movimentação: {currency?.symbol ?? ''}
                {transaction.balance_after.toLocaleString('pt-BR')}
              </small>
            </div>
          </article>
        )
      })}
    </div>
  )}
</div>
)}

  </section>
)}

                </>}
              </>}
            </section>
          )}
          {activePage === 'characters' && selectedCampaignId && (
  <section className="inventory-section characters-page-panel">
    <div className="inventory-heading">
      <div>
        <h2>{showCharacterManagement ? 'Gerenciar personagens' : 'Personagens'}</h2>
        <p>
          {showCharacterManagement
            ? 'Área administrativa da campanha.'
            : 'Personagens da campanha selecionada.'}
        </p>
      </div>

      {showCharacterManagement ? (
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowCharacterManagement(false)}
        >
          ← Voltar aos personagens
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isMaster && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowCharacterManagement(true)}
            >
              ⚙ Gerenciar personagens
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCharacterForm(true)}
          >
            + Novo personagem
          </button>
        </div>
      )}
    </div>

    {!showCharacterManagement && showCharacterForm && (
      <form className="add-form" onSubmit={createCharacter}>
        <label>
          Nome
          <input
            value={characterName}
            onChange={e => setCharacterName(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <div className="emoji-field">
          <label>Emoji do personagem</label>
          <div className="emoji-grid">
            {availableEmojis.map((emoji) => (
              <button key={emoji} type="button" className={characterEmoji === emoji ? 'emoji-option selected' : 'emoji-option'} onClick={() => setCharacterEmoji(emoji)} aria-label={`Selecionar emoji ${emoji}`} aria-pressed={characterEmoji === emoji}>{emoji}</button>
            ))}
          </div>
          <small>Selecione um dos emojis disponíveis para representar o personagem.</small>
        </div>

{String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') ? (
  <>
    <label>
      Arquétipo primário
      <select
        value={primaryArchetype}
        onChange={e => setPrimaryArchetype(e.target.value)}
        required
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map(item => (
          <option
            key={item}
            value={item}
            disabled={
              (item === 'Linha de Frente' && secondaryArchetype === 'Suporte') ||
              (item === 'Suporte' && secondaryArchetype === 'Linha de Frente') ||
              (item === 'Defensor' && secondaryArchetype === 'Flanco') ||
              (item === 'Flanco' && secondaryArchetype === 'Defensor')
            }
          >
            {item}
          </option>
        ))}
      </select>
    </label>

    <label>
      Arquétipo secundário
      <select
        value={secondaryArchetype}
        onChange={e => setSecondaryArchetype(e.target.value)}
        required
        style={inputStyle}
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map(item => (
          <option
            key={item}
            value={item}
            disabled={
              (item === 'Linha de Frente' && primaryArchetype === 'Suporte') ||
              (item === 'Suporte' && primaryArchetype === 'Linha de Frente') ||
              (item === 'Defensor' && primaryArchetype === 'Flanco') ||
              (item === 'Flanco' && primaryArchetype === 'Defensor')
            }
          >
            {item}
          </option>
        ))}
      </select>
    </label>
  </>
) : (
  <label>
    Arquétipo
    <input
      value={archetype}
      onChange={e => setArchetype(e.target.value)}
      style={inputStyle}
    />
  </label>
)}

{String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') ? (
  <>
    <label>
      Arquétipo primário
      <select
        value={primaryArchetype}
        onChange={(event) => setPrimaryArchetype(event.target.value)}
        required
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map(item => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>

    <label>
      Arquétipo secundário
      <select
        value={secondaryArchetype}
        onChange={(event) => setSecondaryArchetype(event.target.value)}
        required
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map(item => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>

    <label>
      Graduação
      <select
        value={characterRank}
        onChange={(event) => setCharacterRank(event.target.value)}
        required
      >
        {KISATSUTAI_RANKS.map(rank => (
          <option key={rank.id} value={rank.id}>
            {rank.name}
          </option>
        ))}
      </select>
    </label>
  </>
) : (
  <label>
    Nível
    <input
      type="number"
      min="1"
      max="999"
      value={characterLevel}
      onChange={(event) => setCharacterLevel(event.target.value)}
      required
    />
  </label>
)}

        <button className="primary-button" type="submit" disabled={loading}>
          Salvar personagem
        </button>
      </form>
    )}

{!showCharacterManagement ? (
  <div className="item-grid">
    {characters.map(character => (
      <article className="item-card" key={character.id}>
        <div className="item-art">{character.emoji || '⚔️'}</div>
        <h3>{character.name}</h3>
        <p>
          {character.archetype || 'Arquétipo não definido'}{!String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') && <> · Nível {character.level}</>}
        </p>
        {String(selectedCampaign?.system_name || '').toLowerCase().includes('kisatsutai') && <p className="item-description">⛩️ {characterRanks[character.id] || 'Graduação não definida'}</p>}
        <button type="button" className="secondary-button" onClick={() => openCharacterEmojiPicker(character)}>Alterar emoji</button>

        <button
          className="primary-button"
          onClick={() => {
            setSelectedCharacterId(character.id)
            setActivePage('sheets')
            setSheetCharacterView(true)
          }}
        >
          Abrir ficha
        </button>
      </article>
    ))}
  </div>
) : (
  <div className="item-grid">
    {characters.map(character => (
      <article className="item-card" key={character.id}>
        <div className="item-art">{character.emoji || '⚔️'}</div>
        <h3>{character.name}</h3>
        <p>
          {character.archetype || 'Arquétipo não definido'}{!String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') && <> · Nível {character.level}</>}
        </p>
        {String(selectedCampaign?.system_name || '').toLowerCase().includes('kisatsutai') && <p className="item-description">⛩️ {characterRanks[character.id] || 'Graduação não definida'}</p>}
        <button type="button" className="secondary-button" onClick={() => openCharacterEmojiPicker(character)}>Alterar emoji</button>

        <button
          className="primary-button"
          onClick={() => {
            setSelectedCharacterId(character.id)
            setActivePage('sheets')
            setSheetCharacterView(true)
          }}
        >
          Abrir ficha
        </button>

        {isMaster && (
          <button
            type="button"
            className="secondary-button"
            style={{
              marginTop: 8,
              width: '100%',
              borderColor: '#b94b55',
              color: '#ff929a',
            }}
            disabled={deletingCharacterId !== null}
            onClick={() => void deleteCharacter(character)}
          >
            {deletingCharacterId === character.id
              ? 'Excluindo...'
              : 'Excluir personagem'}
          </button>
        )}
      </article>
    ))}
  </div>
)}
</section>
)}

{activePage === 'shops' && (
  <section className="inventory-section shops-page-panel">
    {!selectedCampaignId ? (
      <div className="empty-state">
        <h3>Nenhuma campanha selecionada</h3>
        <p>Selecione uma campanha para acessar suas lojas.</p>
      </div>
    ) : (
      <>
        <div className="inventory-heading shops-heading">
          <div>
            <span className="shops-eyebrow">✦ COMÉRCIO DA CAMPANHA</span>
            <h2>Mercado da campanha</h2>
            <p>
              {isMaster
                ? 'Administre estabelecimentos e seus produtos.'
                : 'Confira os produtos disponíveis para sua aventura.'}
            </p>
          </div>

          {isMaster && (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setEditingShopId(null)
                setShopName('')
                setShopDescription('')
                setShowShopForm(value => !value)
              }}
            >
              + Nova loja
            </button>
          )}
        </div>

        {isMaster && showShopForm && (
          <form
            className="add-form"
            onSubmit={event => {
              event.preventDefault()
              void saveShop()
            }}
          >
            <h3>{editingShopId ? 'Editar loja' : 'Criar loja'}</h3>

            <label style={labelStyle}>
              Nome da loja
              <input
                value={shopName}
                onChange={event => setShopName(event.target.value)}
                placeholder="Ex.: Mercado de Eldoria"
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Descrição
              <textarea
                value={shopDescription}
                onChange={event => setShopDescription(event.target.value)}
                placeholder="Conte um pouco sobre este estabelecimento..."
                style={inputStyle}
              />
            </label>

            <div className="form-row">
              <button
                className="primary-button"
                type="submit"
                disabled={shopLoading}
              >
                {shopLoading ? 'Salvando...' : 'Salvar loja'}
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowShopForm(false)
                  setEditingShopId(null)
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {shopLoading && shops.length === 0 ? (
          <div className="empty-state">
            <p>Carregando lojas...</p>
          </div>
        ) : shops.length === 0 ? (
          <div className="empty-state">
            <h3>Esta campanha ainda não possui lojas</h3>
            <p>
              {isMaster
                ? 'Crie a primeira loja para começar a montar o catálogo.'
                : 'O mestre ainda não cadastrou nenhum estabelecimento.'}
            </p>
          </div>
        ) : (
          <>
            <div className="shops-list shop-cards-grid">
              {shops.map(shop => {
                const isSelected = selectedShopId === shop.id

                return (
                  <article
                    className={`item-card shop-card ${isSelected ? 'is-selected' : ''}`}
                    key={shop.id}
                    style={{
                      borderColor: isSelected
                        ? 'var(--season-primary, #b49aff)'
                        : undefined,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedShopId(shop.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="item-art">🏪</div>
                      <h3>{shop.name}</h3>
                      <p className="item-description">
                        {shop.description || 'Um estabelecimento da campanha.'}
                      </p>
                      <small>
                        {shopItems.filter(item => item.shop_id === shop.id).length}
                        {' '}produto(s)
                      </small>
                    </button>

                    {isMaster && (
                      <div className="form-row" style={{ marginTop: 12 }}>
                        <button
  type="button"
  className="secondary-button"
  disabled={shopLoading}
  onClick={() => void toggleShopVisibility(shop)}
>
  {shopLoading
    ? 'Atualizando...'
    : shop.is_visible
      ? 'Ocultar dos jogadores'
      : 'Revelar aos jogadores'}
</button>
<small
  style={{
    display: 'block',
    marginTop: 8,
    color: 'var(--season-muted, #b9b4c2)',
  }}
>
  {shop.is_visible
    ? '🌐 Visível para os jogadores'
    : '🔒 Oculta para os jogadores'}
</small>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editShop(shop)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={shopLoading}
                          onClick={() => void deleteShop(shop)}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            {selectedShopId && (
              <div style={{ marginTop: 28 }}>
                {(() => {
                  const selectedShop = shops.find(
                    shop => shop.id === selectedShopId
                  )

                  if (!selectedShop) return null

                  const visibleItems = shopItems.filter(
                    item => item.shop_id === selectedShopId
                  )

                  return (
                    <>
                      <div className="inventory-heading shop-catalog-heading">
                        <div>
                          <span className="shops-eyebrow">✦ ESTABELECIMENTO SELECIONADO</span>
                          <h2>{selectedShop.name}</h2>
                          <p>Catálogo de produtos</p>
                        </div>

                        {isMaster && (
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              setEditingShopItemId(null)
                              setShopItemName('')
                              setShopItemDescription('')
                              setShopItemCategory('Diversos')
                              setShopItemRarity('comum')
                              setShopItemWeight('0')
                              setShopItemPrice('0')
                              setShopItemCurrencyId(selectedCampaign?.currency_config?.currencies?.[0]?.id ?? '')
                              setShopItemStock('')
                              setShopItemEmoji('📦')
                              setShopItemCategories(['Diversos'])
                              setShopItemEquipmentType('none')
                              setShopItemArmorClass('leve')
                              setShopItemArmorCoverage('cortante_perfurante')
                              setShopItemProtectionTier('basica')
                              setShopItemProtectionMode('resistencia')
                              setShopItemWeaponClass('improvised')
                              setShopItemScarcityLevel('1')
                              setShopItemScarcityExhausted(false)
                              setShowShopItemForm(value => !value)
                            }}
                          >
                            + Novo produto
                          </button>
                        )}
                      </div>

{true && (
  <section className="inventory-section" style={{ marginBottom: 24 }}>
    <div className="inventory-heading">
      <div>
        <h2>Vender itens</h2>
        <p>Venda itens do inventário do seu personagem para esta loja.</p>
      </div>
    </div>

    <label style={labelStyle}>
      Personagem
      <select
        value={selectedCharacterId}
        onChange={event => setSelectedCharacterId(event.target.value)}
        style={inputStyle}
      >
        {characters
          .filter(character => character.user_id === session?.user.id)
          .map(character => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
      </select>
    </label>

    <div className="item-grid">
      {items
        .filter(item => item.character_id === selectedCharacterId)
        .map(item => (
          <article className="item-card shop-sale-item-card" key={item.id}>
            <div className="item-art">
              {typeof item.metadata?.icon === 'string'
                ? item.metadata.icon
                : '📦'}
            </div>

            <h3 className="shop-sale-item-name" title={item.name}>{item.name}</h3>
            <p>Disponível: {item.quantity}</p>
            <p>
              Valor unitário: {Number(item.unit_price).toLocaleString('pt-BR')}
            </p>

            <label style={labelStyle}>
              Quantidade
              <input
                type="number"
                min="1"
                max={item.quantity}
                value={shopSaleQuantities[item.id] ?? '1'}
                onChange={event =>
                  setShopSaleQuantities(current => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                style={inputStyle}
              />
            </label>

            <button
              type="button"
              className="primary-button"
              disabled={saleLoading || !!item.sale_blocked}
              onClick={() =>
                void sellInventoryItem(
                  item,
                  Number(shopSaleQuantities[item.id] ?? '1')
                )
              }
            >
              {item.sale_blocked
                ? 'Venda bloqueada'
                : saleLoading
                  ? 'Vendendo...'
                  : 'Vender'}
            </button>
          </article>
        ))}
    </div>
  </section>
)}

                      {isMaster && showShopItemForm && (
                        <form
                          className="add-form shop-item-editor"
                          onSubmit={event => {
                            event.preventDefault()
                            void saveShopItem()
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1.5fr) minmax(220px, .8fr)',
                            gap: 22,
                            alignItems: 'start',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ marginBottom: 20 }}>
                              <h3 style={{ marginBottom: 6 }}>
                                {editingShopItemId ? 'Editar produto' : 'Novo produto'}
                              </h3>
                              <p style={{ margin: 0, color: 'var(--season-muted, #aaa)' }}>
                                Preencha as informações para adicionar este item ao catálogo de {selectedShop.name}.
                              </p>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                              <strong style={{ display: 'block', marginBottom: 12 }}>Identificação</strong>
                              <label style={labelStyle}>
                                Nome do produto
                                <input
                                  value={shopItemName}
                                  onChange={event => setShopItemName(event.target.value)}
                                  placeholder="Ex.: Poção de cura menor"
                                  required
                                  maxLength={80}
                                  style={inputStyle}
                                />
                              </label>

                              <label style={labelStyle}>
                                Descrição
                                <textarea
                                  value={shopItemDescription}
                                  onChange={event => setShopItemDescription(event.target.value)}
                                  placeholder="Descreva os efeitos, a aparência ou alguma característica..."
                                  rows={3}
                                  maxLength={500}
                                  style={{ ...inputStyle, resize: 'vertical' }}
                                />
                                <small style={{ color: 'var(--season-muted, #aaa)' }}>
                                  {shopItemDescription.length}/500 caracteres
                                </small>
                              </label>

                              <section className="item-classifications-panel">
                                <div className="item-classifications-heading">
                                  <div><strong>Classificações do item</strong><p>Marque todas as opções que se aplicam. O produto terá as mesmas categorias quando comprado.</p></div>
                                  <span>{shopItemCategories.length} selecionada{shopItemCategories.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="item-classifications-grid">
                                  {categories.filter(category => category !== 'Todos').map(category => (
                                    <label key={category} className={shopItemCategories.includes(category) ? 'item-classification-option selected' : 'item-classification-option'}>
                                      <input type="checkbox" checked={shopItemCategories.includes(category)} onChange={event => {
                                        const next = event.target.checked ? [...shopItemCategories, category] : shopItemCategories.filter(value => value !== category)
                                        setShopItemCategories(next)
                                        if (next.length) setShopItemCategory(next[0])
                                        const automaticWeight = getAutomaticItemWeight(next, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass)
                                        if (automaticWeight !== null) setShopItemWeight(String(automaticWeight))
                                      }} />
                                      <span className="item-classification-check">{shopItemCategories.includes(category) ? '✓' : '+'}</span>
                                      <span>{category}</span>
                                    </label>
                                  ))}
                                </div>
                                {!shopItemCategories.length && <p className="item-classifications-hint">Selecione pelo menos uma classificação.</p>}
                              </section>

                              <div className="item-rarity-field">
                                <label htmlFor="shop-item-rarity">Raridade</label>
                                <select id="shop-item-rarity" value={shopItemRarity} onChange={event => setShopItemRarity(event.target.value)}>
                                  <option value="comum">Comum</option><option value="incomum">Incomum</option><option value="raro">Raro</option><option value="épico">Épico</option><option value="mítico">Mítico</option><option value="relíquia">Relíquia</option>
                                </select>
                              </div>

                              <label style={labelStyle}>Tipo de equipamento
                                <select value={shopItemEquipmentType} onChange={event => { const nextType = event.target.value as 'none' | 'armor' | 'protection'; setShopItemEquipmentType(nextType); const automaticWeight = getAutomaticItemWeight(shopItemCategories, nextType, shopItemArmorClass, shopItemWeaponClass); if (automaticWeight !== null) setShopItemWeight(String(automaticWeight)) }} style={inputStyle}>
                                  <option value="none">Item comum</option><option value="armor">Armadura</option><option value="protection">Proteção</option>
                                </select>
                              </label>

                              {shopItemEquipmentType === 'armor' && <>
                                <label style={labelStyle}>Tipo de armadura<select value={shopItemArmorClass} onChange={event => { const nextClass = event.target.value as 'leve' | 'media' | 'pesada'; setShopItemArmorClass(nextClass); const automaticWeight = getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, nextClass, shopItemWeaponClass); if (automaticWeight !== null) setShopItemWeight(String(automaticWeight)) }} style={inputStyle}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>
                                {shopItemArmorClass !== 'pesada' && <label style={labelStyle}>Tipos de dano protegidos<select value={shopItemArmorCoverage} onChange={event => setShopItemArmorCoverage(event.target.value as 'cortante_perfurante' | 'especial_bruto')} style={inputStyle}><option value="cortante_perfurante">Cortante e perfurante</option><option value="especial_bruto">Especial e bruto</option></select></label>}
                                <div className="equipment-rules-preview"><strong>Regras da armadura</strong><p>Carga: {shopItemArmorClass === 'leve' ? 2 : shopItemArmorClass === 'media' ? 4 : 6} kg</p><p>Proteção: {shopItemArmorClass === 'leve' ? '(Resistência ÷ 2) + 4' : shopItemArmorClass === 'media' ? 'Resistência + 6' : '(Resistência × 2) + 8'}</p><p>Destreza: {shopItemArmorClass === 'leve' ? 'Integral' : shopItemArmorClass === 'media' ? '½ dos pontos' : '0'}</p><p>Penalidades: {shopItemArmorClass === 'media' ? '−5 em Reflexo; metade do deslocamento' : shopItemArmorClass === 'pesada' ? '−10 em Reflexo e Corrida; ¼ do deslocamento' : 'Sem penalidade'}</p></div>
                              </>}

                              {shopItemEquipmentType === 'protection' && <>
                                <label style={labelStyle}>Nível de proteção<select value={shopItemProtectionTier} onChange={event => setShopItemProtectionTier(event.target.value as 'basica' | 'moderada' | 'avancada')} style={inputStyle}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label>
                                <label style={labelStyle}>Tipo de resistência<select value={shopItemProtectionMode} onChange={event => setShopItemProtectionMode(event.target.value as 'resistencia' | 'sanidade')} style={inputStyle}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label>
                                <div className="equipment-rules-preview"><strong>Regras da proteção</strong><p>Carga: 0 kg</p><p>Proteção: {shopItemProtectionTier === 'basica' ? '¼' : shopItemProtectionTier === 'moderada' ? '½' : 'integral'} dos pontos de {shopItemProtectionMode === 'resistencia' ? 'resistência' : 'mental'}.</p><p>Dano de sanidade ao perder: {shopItemProtectionTier === 'basica' ? '1d8' : shopItemProtectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}.</p></div>
                              </>}

                              {shopItemCategories.includes('Armas') && <>
                                <label style={labelStyle}>Classificação da arma<select value={shopItemWeaponClass} onChange={event => { const nextClass = event.target.value; setShopItemWeaponClass(nextClass); const automaticWeight = getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, nextClass); if (automaticWeight !== null) setShopItemWeight(String(automaticWeight)) }} style={inputStyle}><option value="improvised">Improvisada — 1d4 · 0,5 kg</option><option value="advanced">Lâmina avançada — 1d6 · 1 kg</option><option value="special">Lâmina especial — 1d8 · 1 kg</option><option value="black_red">Lâmina preta/vermelha — 1d10 · 1,5 kg</option><option value="mutable">Lâmina mutável — 1d12 · 2 kg</option></select></label>
                                <div className="equipment-rules-preview"><strong>Configuração da arma</strong><p>Dano extra: {{improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}[shopItemWeaponClass]}</p><p>Carga: {{improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}[shopItemWeaponClass]} kg</p></div>
                              </>}

                              {shopItemCategories.includes('Consumíveis') && <section className="scarcity-editor-card"><div className="scarcity-editor-heading"><span className="scarcity-editor-icon">⌛</span><div><strong>Sistema de escassez</strong><p>Define a chance de o consumível se esgotar conforme é utilizado.</p></div></div><label>Nível inicial de escassez<select value={shopItemScarcityLevel} onChange={event => setShopItemScarcityLevel(event.target.value as '1' | '2' | '3' | '4')}><option value="1">Nível 1 — d12</option><option value="2">Nível 2 — d8</option><option value="3">Nível 3 — d6</option><option value="4">Nível 4 — d4</option></select></label><div className="scarcity-level-preview"><div><span>Dado ao usar</span><strong>{{ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' }[shopItemScarcityLevel]}</strong></div><div><span>Carga</span><strong>{{ '1': 7, '2': 5, '3': 3, '4': 1 }[shopItemScarcityLevel]}</strong></div></div><p className="scarcity-editor-note">Ao usar, role o dado indicado. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p><label className="scarcity-exhausted-toggle"><input type="checkbox" checked={shopItemScarcityExhausted} onChange={event => setShopItemScarcityExhausted(event.target.checked)} /><span><strong>Item esgotado</strong><small>Marque para impedir novas rolagens. Desmarque para reativar o consumível.</small></span></label></section>}

                            </div>

                            <div style={{ marginBottom: 20 }}>
                              <strong style={{ display: 'block', marginBottom: 12 }}>Preço e inventário</strong>
                              <div className="form-row">
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Preço por unidade
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={shopItemPrice}
                                    onChange={event => setShopItemPrice(event.target.value)}
                                    style={inputStyle}
                                  />
                                </label>
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Moeda
                                  <select
                                    value={shopItemCurrencyId}
                                    onChange={event => setShopItemCurrencyId(event.target.value)}
                                    style={inputStyle}
                                  >
                                    <option value="">Sem moeda definida</option>
                                    {(selectedCampaign?.currency_config?.currencies ?? []).map((currency, index) => (
                                      <option key={currency.id} value={currency.id}>
                                        {index === 0 ? '★ Moeda do sistema — ' : ''}{currency.name} ({currency.symbol})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="form-row">
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Estoque disponível
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={shopItemStock}
                                    onChange={event => setShopItemStock(event.target.value)}
                                    placeholder="Ilimitado"
                                    style={inputStyle}
                                  />
                                  <small style={{ color: 'var(--season-muted, #aaa)' }}>
                                    Deixe vazio para não limitar a quantidade.
                                  </small>
                                </label>
                                <label style={{ ...labelStyle, flex: 1, minWidth: 130 }}>
                                  Peso por unidade (kg)
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={shopItemWeight}
                                    onChange={event => setShopItemWeight(event.target.value)}
                                    disabled={getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass) !== null}
                                    style={inputStyle}
                                  />
                                  <small style={{ color: 'var(--season-muted, #aaa)' }}>{getAutomaticItemWeight(shopItemCategories, shopItemEquipmentType, shopItemArmorClass, shopItemWeaponClass) !== null ? 'Peso definido automaticamente pelas regras do equipamento.' : 'Informe o peso por unidade deste item.'}</small>
                                </label>
                              </div>
                            </div>

                            <div>
                              <strong style={{ display: 'block', marginBottom: 10 }}>Ícone do produto</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                {availableEmojis.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    aria-label={`Usar ícone ${emoji}`}
                                    aria-pressed={shopItemEmoji === emoji}
                                    onClick={() => setShopItemEmoji(emoji)}
                                    style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 10,
                                      border: `1px solid ${shopItemEmoji === emoji ? 'var(--season-primary, #b49aff)' : 'var(--season-line, #44375f)'}`,
                                      background: shopItemEmoji === emoji ? 'var(--season-surface-alt, rgba(180,154,255,.16))' : 'var(--season-surface, transparent)',
                                      color: 'inherit',
                                      fontSize: 19,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <label style={{ ...labelStyle, marginTop: 12 }}>
                                Ou informe outro emoji
                                <input
                                  value={shopItemEmoji}
                                  onChange={event => setShopItemEmoji(event.target.value)}
                                  placeholder="📦"
                                  style={{ ...inputStyle, maxWidth: 150 }}
                                  maxLength={8}
                                />
                              </label>
                            </div>

                            <div className="form-row" style={{ marginTop: 24 }}>
                              <button
                                type="button"
                                className="primary-button"
                                disabled={shopLoading}
                                onClick={() => void saveShopItem()}
                              >
                                {shopLoading ? 'Salvando...' : editingShopItemId ? 'Salvar alterações' : 'Adicionar ao catálogo'}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={shopLoading}
                                onClick={() => {
                                  setShowShopItemForm(false)
                                  setEditingShopItemId(null)
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>

                          <aside
                            aria-label="Prévia do produto"
                            style={{
                              position: 'sticky',
                              top: 18,
                              padding: 18,
                              borderRadius: 16,
                              border: '1px solid var(--season-line, rgba(180,154,255,.25))',
                              background: 'var(--season-surface, rgba(20,18,30,.7))',
                              minWidth: 0,
                            }}
                          >
                            <small style={{ color: 'var(--season-muted, #aaa)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                              Prévia no catálogo
                            </small>
                            <div style={{ textAlign: 'center', padding: '22px 8px 18px' }}>
                              <div style={{ fontSize: 52, lineHeight: 1.2, marginBottom: 12 }}>
                                {shopItemEmoji || '📦'}
                              </div>
                              <div className="item-category">{shopItemCategory.trim() || 'Diversos'}</div>
                              <div style={{ display: 'inline-flex', marginTop: 7, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--season-line)', color: 'var(--season-primary)', fontSize: 11, textTransform: 'capitalize' }}>{shopItemRarity}</div>
                              <h3 style={{ margin: '8px 0' }}>{shopItemName.trim() || 'Nome do produto'}</h3>
                              <p className="item-description" style={{ minHeight: 42 }}>
                                {shopItemDescription.trim() || 'A descrição do produto aparecerá aqui.'}
                              </p>
                            </div>
                            <div style={{ borderTop: '1px solid var(--season-line, rgba(180,154,255,.2))', paddingTop: 14, display: 'grid', gap: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--season-muted, #aaa)' }}>Preço</span>
                                <strong>
                                  {(() => {
                                    const currency = selectedCampaign?.currency_config?.currencies?.find(item => item.id === shopItemCurrencyId)
                                    const price = Number(shopItemPrice.replace(',', '.'))
                                    return price > 0 ? `${currency?.symbol ?? ''}${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` · ${currency.name}` : ''}` : 'Gratuito'
                                  })()}
                                </strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--season-muted, #aaa)' }}>Estoque</span>
                                <strong>{shopItemStock.trim() === '' ? 'Ilimitado' : `${shopItemStock} un.`}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--season-muted, #aaa)' }}>Peso</span>
                                <strong>{shopItemWeight || '0'} kg</strong>
                              </div>
                            </div>
                          </aside>
                        </form>
                      )}

                      {visibleItems.length === 0 ? (
                        <div className="empty-state">
                          <h3>Catálogo vazio</h3>
                          <p>Esta loja ainda não possui produtos.</p>
                        </div>
                      ) : (
                        <div className="item-grid">
                          {visibleItems.map(item => {
                            const currency = selectedCampaign?.currency_config?.currencies?.find(
                              entry => entry.id === item.currency_id
                            )

                            const outOfStock =
                              item.quantity !== null && item.quantity <= 0

                            return (
                              <article className="item-card shop-product-card" key={item.id}>
                                <div className="item-art shop-product-art">
                                  {typeof item.metadata?.icon === 'string'
                                    ? item.metadata.icon
                                    : '📦'}
                                </div>

                                <div className="item-category shop-product-category">
                                  {item.category}
                                </div>

                                <h3 className="shop-product-title">{item.name}</h3>

                                <p className="item-description">
                                  {item.description || 'Sem descrição.'}
                                </p>

      <div className="item-economic-details shop-product-economics">
                                  <div>
                                    <span>Preço</span>
                                    <strong>
                                      {currency?.symbol ?? ''}
                                      {' '}
                                      {Number(item.unit_price).toLocaleString('pt-BR')}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>Peso</span>
                                    <strong>
                                      {Number(item.weight).toLocaleString('pt-BR')} kg
                                    </strong>
                                  </div>
                                </div>

                                <p className={`shop-product-stock ${outOfStock ? 'is-empty' : ''}`}>
                                  <span className="shop-stock-dot" />
                                  {item.quantity === null
                                    ? 'Estoque ilimitado'
                                    : outOfStock
                                      ? 'Esgotado'
                                      : `Disponível: ${item.quantity} unidade(s)`}
                                </p>

{isMaster && (
  <div className="form-row">
    <button
      type="button"
      className="secondary-button"
      onClick={() => editShopItem(item)}
    >
      Editar
    </button>

    <button
      type="button"
      className="secondary-button"
      disabled={shopLoading}
      onClick={() => void deleteShopItem(item)}
    >
      Excluir
    </button>

    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        color: 'var(--season-text, #f4f0fa)',
        fontSize: 13,
      }}
    >
      <input
        type="checkbox"
        className="restriction-checkbox"
        checked={!!item.purchase_blocked}
        onChange={event =>
          void setItemRestriction(
            'shop',
            item.id,
            event.target.checked
          )
        }
      />
      Bloquear compra pelos jogadores
    </label>
  </div>
)}

<label className="shop-purchase-field" style={labelStyle}>
  Comprar para
  <select
    value={shopPurchaseCharacterId}
    onChange={event => setShopPurchaseCharacterId(event.target.value)}
    style={inputStyle}
  >
    <option value="">Selecione seu personagem</option>
    {characters
      .filter(character => character.user_id === session?.user.id)
      .map(character => (
        <option key={character.id} value={character.id}>
          {character.name}
        </option>
      ))}
  </select>
</label>

<label className="shop-purchase-field" style={labelStyle}>
  Quantidade
  <input
    type="number"
    min="1"
    max={item.quantity === null ? undefined : item.quantity}
    value={shopPurchaseQuantities[item.id] ?? '1'}
    onChange={event =>
      setShopPurchaseQuantities(current => ({
        ...current,
        [item.id]: event.target.value,
      }))
    }
    style={inputStyle}
  />
  {item.quantity !== null && (
    <small>Disponível: {item.quantity} unidade(s)</small>
  )}
</label>

{item.purchase_blocked && (
  <p style={{ color: '#e6a36d', fontSize: 13 }}>
    🔒 Compra bloqueada pelo mestre.
  </p>
)}

<button
  type="button"
  className="primary-button shop-buy-button"
  disabled={
    outOfStock ||
    !!item.purchase_blocked ||
    shopPurchaseLoading !== null ||
    !shopPurchaseCharacterId ||
    !characters.some(character =>
      character.id === shopPurchaseCharacterId &&
      character.user_id === session?.user.id
    )
  }
  onClick={() =>
    void purchaseShopItem(
      item,
      Number(shopPurchaseQuantities[item.id] ?? '1')
    )
  }
>
  {shopPurchaseLoading === item.id
    ? 'Comprando...'
    : item.purchase_blocked
      ? 'Compra bloqueada'
      : outOfStock
        ? 'Esgotado'
        : `Comprar ${shopPurchaseQuantities[item.id] ?? '1'} unidade(s)`}
</button>
                              </article>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </>
    )}
  </section>
)}

          {activePage === 'campaigns' && <section className="inventory-section campaigns-page-panel"><h2>Campanhas</h2>
            {inviteCode && <form className="add-form" onSubmit={joinCampaignWithInvite}><h3>Entrar com convite</h3><p>Um convite foi detectado no link. Confirme o código para entrar na campanha.</p><label>Código do convite<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required style={inputStyle}/></label><button className="primary-button" type="submit" disabled={inviteLoading}>{inviteLoading?'Entrando…':'Entrar na campanha'}</button></form>}
            <form className="add-form" onSubmit={joinCampaignWithInvite}><h3>Tenho um convite</h3><label>Código ou token<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required style={inputStyle} placeholder="Cole aqui o código recebido"/></label><button className="secondary-button" type="submit" disabled={inviteLoading || !inviteCode.trim()}>Usar convite</button></form>
            {showCampaignForm&&<form className="add-form" onSubmit={editingCampaignId ? saveCampaignDetails : createCampaign}><h3>{editingCampaignId ? 'Editar campanha' : 'Criar campanha'}</h3><label>Nome<input value={campaignName} onChange={e=>setCampaignName(e.target.value)} required style={inputStyle}/></label><label>Sistema<select value={campaignSystemChoice} onChange={e=>{const choice=e.target.value;setCampaignSystemChoice(choice);if(choice==='kisatsutai')setSystemName('Kisatsutai');else if(choice==='other')setSystemName('')}} style={inputStyle}><option value=''>Selecione um sistema</option><option value='kisatsutai'>Kisatsutai</option><option value='other'>Outro sistema</option></select></label>{campaignSystemChoice==='other'&&<label>Nome do sistema<input value={systemName} onChange={e=>setSystemName(e.target.value)} placeholder='Ex.: Dungeons & Dragons 5e' required style={inputStyle}/></label>}<label>Descrição<input value={campaignDescription} onChange={e=>setCampaignDescription(e.target.value)} style={inputStyle}/></label><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="primary-button" type="submit" disabled={loading}>{loading ? 'Salvando…' : editingCampaignId ? 'Salvar alterações' : 'Criar campanha'}</button><button className="secondary-button" type="button" onClick={()=>{setShowCampaignForm(false);setEditingCampaignId(null);setCampaignName('');setCampaignDescription('');setSystemName('');setCampaignSystemChoice('')}}>Cancelar</button></div></form>}
            <div className="item-grid">{campaigns.map(campaign=><article className="item-card" key={campaign.id}><h3>{campaign.name}</h3><p>{campaign.system_name||'Sistema não definido'}</p><button className="primary-button" onClick={()=>{setSelectedCampaignId(campaign.id);setActivePage('campaigns')}}>Selecionar campanha</button>{campaign.role === 'master' && <button type="button" className="secondary-button" onClick={()=>{setSelectedCampaignId(campaign.id);setCampaignName(campaign.name);setCampaignDescription(campaign.description ?? '');setSystemName(campaign.system_name ?? '');setCampaignSystemChoice(!campaign.system_name?'':campaign.system_name.toLowerCase().includes('kisatsutai')?'kisatsutai':'other');setEditingCampaignId(campaign.id);setShowCampaignForm(true)}}>Editar campanha</button>}</article>)}</div>
            {selectedCampaign && isMaster && <div className="add-form" style={{marginTop:20}}><h3>Convites de campanha</h3><p>Gere um link para convidar jogadores para <strong>{selectedCampaign.name}</strong>.</p><button type="button" className="primary-button" onClick={()=>void createCampaignInvite()} disabled={inviteLoading}>{inviteLoading?'Gerando…':'Gerar convite'}</button>{campaignInviteLink&&<label>Link para compartilhar<input readOnly value={campaignInviteLink} onFocus={e=>e.currentTarget.select()} style={inputStyle}/><button type="button" className="secondary-button" onClick={()=>{void navigator.clipboard.writeText(campaignInviteLink);setNotice('Link copiado!')}}>Copiar link</button></label>}</div>}

            {selectedCampaign && isMaster && (
  <section className="inventory-section" style={{ marginBottom: 16 }}>
    <div className="inventory-heading"><div><h3>Moedas da campanha</h3><p>A primeira moeda é a moeda do sistema, usada por padrão na carteira e nos novos produtos.</p></div></div>
    {(selectedCampaign.currency_config?.currencies ?? []).map((currency, index) => (
      <div key={currency.id} className="currency-balance" style={{ gap: 10 }}>
        <span>{currency.name} ({currency.symbol}) {index === 0 ? '· Moeda do sistema' : ''}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" disabled={currencyConfigSaving} onClick={() => beginEditingCampaignCurrency(currency)}>Editar</button>
          {index > 0 && <button type="button" className="secondary-button" disabled={currencyConfigSaving} onClick={() => void saveCampaignCurrencyConfig([currency, ...(selectedCampaign.currency_config?.currencies ?? []).filter(item => item.id !== currency.id)])}>Definir como principal</button>}
          <button type="button" className="secondary-button" disabled={currencyConfigSaving} onClick={() => { if (window.confirm(`Remover ${currency.name}? Produtos e registros antigos que usam essa moeda podem ficar sem correspondência.`)) void saveCampaignCurrencyConfig((selectedCampaign.currency_config?.currencies ?? []).filter(item => item.id !== currency.id)) }}>Remover</button>
        </div>
      </div>
    ))}
    <div className="form-row" style={{ marginTop: 12 }}>
      <label style={{ ...labelStyle, flex: 2, minWidth: 130 }}>Nome<input value={currencyDraftName} onChange={event => setCurrencyDraftName(event.target.value)} placeholder="Ex.: Iene" style={inputStyle} /></label>
      <label style={{ ...labelStyle, flex: 1, minWidth: 90 }}>Símbolo<input value={currencyDraftSymbol} onChange={event => setCurrencyDraftSymbol(event.target.value)} placeholder="¥" style={inputStyle} /></label>
      <label style={{ ...labelStyle, flex: 1, minWidth: 110 }}>Conversão<input type="number" min="0.000001" step="any" value={currencyDraftRate} onChange={event => setCurrencyDraftRate(event.target.value)} style={inputStyle} /></label>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button type="button" className="primary-button" disabled={currencyConfigSaving} onClick={() => void (editingCurrencyId ? saveEditedCampaignCurrency() : addCampaignCurrency())}>{currencyConfigSaving ? 'Salvando…' : editingCurrencyId ? 'Salvar edição da moeda' : 'Adicionar moeda'}</button>
      {editingCurrencyId && <button type="button" className="secondary-button" onClick={() => { setEditingCurrencyId(null); setCurrencyDraftName(''); setCurrencyDraftSymbol(''); setCurrencyDraftRate('1') }}>Cancelar edição</button>}
    </div>
  </section>
)}
          {selectedCampaign && isMaster && (
            <section className="inventory-section">
              <div className="inventory-heading">
                <div>
                  <h2>Membros da campanha</h2>
                  <p>
                    {campaignMembers.length} membro(s) ·{' '}
                    {campaignMembers.filter((member) => member.role === 'master').length}{' '}
                    mestre(s)
                  </p>
                </div>
              </div>

              {campaignMembers.length === 0 ? (
                <div className="empty-state">
                  <p>Não foi possível carregar os membros desta campanha.</p>
                </div>
              ) : (
                <div className="item-grid">
                  {campaignMembers.map((member) => {
                    const isSelf = member.user_id === session?.user.id
                    const isLastMaster =
                      member.role === 'master' &&
                      campaignMembers.filter((entry) => entry.role === 'master').length <= 1

                    return (
                      <article className="item-card" key={member.user_id}>
                        <div className="item-art">
                          {member.role === 'master' ? '👑' : '♙'}
                        </div>
                        <div className="item-category">
                          {member.role === 'master' ? 'MESTRE' : 'JOGADOR'}
                        </div>
                        <h3>
                          {member.display_name}
                          {isSelf ? ' (você)' : ''}
                        </h3>
                        <p className="item-description">
                          {member.role === 'master'
                            ? 'Pode administrar os membros da campanha.'
                            : 'Participante da campanha.'}
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={memberActionLoading !== null || isLastMaster}
                            onClick={() => void changeMemberRole(member)}
                            title={isLastMaster ? 'A campanha precisa ter pelo menos um mestre.' : undefined}
                          >
                            {memberActionLoading === member.user_id
                              ? 'Aguarde...'
                              : member.role === 'master'
                                ? 'Rebaixar a jogador'
                                : 'Promover a mestre'}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={memberActionLoading !== null || isLastMaster}
                            onClick={() => void removeCampaignMember(member)}
                            title={isLastMaster ? 'O último mestre não pode ser removido.' : undefined}
                          >
                            Remover
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

            {selectedCampaign && isMaster && (
              <section className="inventory-section character-access-settings">
                <div className="inventory-heading"><div><h2>Acesso do personagem</h2><p>Selecione um personagem da campanha para definir quem controla e quem pode visualizá-lo.</p></div></div>
                <div style={{ maxWidth: 460, marginBottom: 16 }}>
                  <label style={labelStyle} htmlFor="character-access-selector">Personagem</label>
                  <select
                    id="character-access-selector"
                    value={selectedCharacterId}
                    onChange={(event) => setSelectedCharacterId(event.target.value)}
                    disabled={visibilitySaving || characters.length === 0}
                    style={inputStyle}
                  >
                    <option value="">Selecione um personagem...</option>
                    {characters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.emoji ? `${character.emoji} ` : ''}{character.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!selectedCharacter ? (
                  <div className="empty-state">
                    <p>{characters.length === 0 ? 'Esta campanha ainda não possui personagens.' : 'Escolha um personagem acima para configurar os acessos.'}</p>
                  </div>
                ) : (
                <div style={{ minWidth: 220, padding: '12px', border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))', borderRadius: 10, background: 'var(--season-bg, var(--season-bg, #100e19))' }}>
                      <label style={labelStyle} htmlFor="character-current-player">Jogador atual</label>
                      <select
                        id="character-current-player"
                        value={selectedCharacter.current_player_id ?? ''}
                        onChange={(event) => void changeCharacterPlayer(event.target.value)}
                        disabled={visibilitySaving}
                        style={{ ...inputStyle, marginBottom: 12 }}
                      >
                        <option value="">Sem jogador atribuído</option>
                        {campaignMembers.filter(member => member.role !== 'master').map(member => (
                          <option key={member.user_id} value={member.user_id}>{member.display_name}</option>
                        ))}
                      </select>
                      <small style={{ display: 'block', color: 'var(--season-muted, #b9b4c2)', lineHeight: 1.5, marginBottom: 12 }}>
                        Este jogador aparecerá como integrante da party no Escudo do mestre quando o personagem participar da temporada.
                      </small>
                      <label style={labelStyle} htmlFor="character-visibility">Visibilidade</label>
                      <select
                        id="character-visibility"
                        value={selectedCharacter.visibility ?? 'private'}
                        onChange={(event) => void changeCharacterVisibility(event.target.value as Character['visibility'])}
                        disabled={visibilitySaving}
                        style={inputStyle}
                      >
                        <option value="private">Privado</option>
                        <option value="campaign">Toda a campanha</option>
                        <option value="selected">Jogadores selecionados</option>
                      </select>
                      <small style={{ display: 'block', color: 'var(--season-muted, #b9b4c2)', lineHeight: 1.5 }}>
                        {selectedCharacter.visibility === 'campaign'
                          ? 'Todos os membros da campanha podem ver este personagem.'
                          : selectedCharacter.visibility === 'selected'
                            ? 'Somente os jogadores autorizados, o proprietário e os mestres podem vê-lo.'
                            : 'Somente o proprietário e os mestres podem ver este personagem.'}
                      </small>
                      {selectedCharacter.visibility === 'selected' && (
                        <div style={{ marginTop: 12 }}>
                          <strong style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Acesso dos jogadores</strong>
                          {campaignMembers.filter((member) => member.role !== 'master' && member.user_id !== selectedCharacter.user_id).map((member) => (
                            <label key={member.user_id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, margin: '8px 0', color: '#f4f0fa' }}>
                              <input
                                type="checkbox"
                                checked={characterGrants.some((grant) => grant.user_id === member.user_id)}
                                disabled={visibilitySaving}
                                onChange={(event) => void toggleCharacterGrant(member.user_id, event.target.checked)}
                              />
                              {member.display_name}
                            </label>
                          ))}
                          {campaignMembers.filter((member) => member.role !== 'master' && member.user_id !== selectedCharacter.user_id).length === 0 && (
                            <small style={{ color: 'var(--season-muted, #b9b4c2)' }}>Não há outros jogadores na campanha.</small>
                          )}
                        </div>
                      )}
                    </div>
                )}
              </section>
            )}

          </section>}


          {error && (
            <div className="notice" role="alert">
              <span>!</span> {error}
              <button
                onClick={() => setError('')}
                aria-label="Fechar aviso"
              >
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="notice" role="status">
              <span>✓</span> {notice}
              <button
                onClick={() => setNotice('')}
                aria-label="Fechar aviso"
              >
                ×
              </button>
            </div>
          )}

          {/* O formulário de campanha fica somente na página Campanhas. */}

          {selectedCampaign && (
            <section className="character-banner">
              <div className="banner-art">
                <span>✧</span>
                <div className="rune rune-one">ᚱ</div>
                <div className="rune rune-two">ᚨ</div>
                <div className="banner-orb" />
              </div>

              <div className="character-info">
                <div className="character-tag">
                  <span /> CAMPANHA ATIVA
                </div>
                <h2>{selectedCampaign.name}</h2>
                <p>
                  {selectedCampaign.system_name || 'Sistema não definido'}
                  <span> · </span>
                  {isMaster ? 'Mestre' : 'Jogador'}
                </p>
                <div className="character-meta">
                  <span>{characters.length} personagem(ns)</span>
                </div>
              </div>
            </section>
          )}

          {!selectedCampaignId && (
            <div className="empty-state">
              <span>⚑</span>
              <h3>Vamos começar uma aventura?</h3>
              <p>Crie sua primeira campanha para adicionar personagens e itens.</p>
              <button onClick={() => setShowCampaignForm(true)}>
                Criar campanha
              </button>
            </div>
          )}

          {selectedCampaignId && (
            <>
              <section className="inventory-section">
                <div className="inventory-heading">
                  <div>
                    <h2>Personagens</h2>
                    <p>Personagens salvos na campanha selecionada.</p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => setShowCharacterForm((value) => !value)}
                  >
                    {showCharacterForm ? 'Cancelar' : '+ Novo personagem'}
                  </button>
                </div>

                {showCharacterForm && (
                  <form className="add-form" onSubmit={createCharacter}>
                    <div className="form-heading">
                      <div>
                        <h3>Novo personagem</h3>
                        <p>Preencha os dados básicos do aventureiro.</p>
                      </div>
                      <span>♙</span>
                    </div>

                    <label>
                      Nome
                      <input
                        value={characterName}
                        onChange={(event) =>
                          setCharacterName(event.target.value)
                        }
                        placeholder="Ex.: Kaelen Vento Cinzento"
                        required
                        maxLength={100}
                      />
                    </label>

                    <div className="form-row">
{String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') ? (
  <>
    <label>
      Arquétipo primário
      <select
        value={primaryArchetype}
        onChange={(event) => setPrimaryArchetype(event.target.value)}
        required
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>

    <label>
      Arquétipo secundário
      <select
        value={secondaryArchetype}
        onChange={(event) => setSecondaryArchetype(event.target.value)}
        required
      >
        <option value="">Selecione...</option>
        {KISATSUTAI_ARCHETYPES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  </>
) : (
  <label>
    Classe ou arquétipo
    <input
      value={archetype}
      onChange={(event) => setArchetype(event.target.value)}
      placeholder="Ex.: Andarilho"
      maxLength={100}
    />
  </label>
)}

{!String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') && (
    <label>
      Nível
      <input
        type="number"
        min="1"
        max="999"
        value={characterLevel}
        onChange={(event) => setCharacterLevel(event.target.value)}
        required
      />
    </label>
  )}
</div>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? 'Salvando...' : 'Salvar personagem'}
                    </button>
                  </form>
                )}

                {characters.length === 0 ? (
                  <div className="empty-state">
                    <span>♙</span>
                    <h3>Nenhum personagem ainda</h3>
                    <p>Crie o primeiro personagem desta campanha.</p>
                    <button onClick={() => setShowCharacterForm(true)}>
                      Criar personagem
                    </button>
                  </div>
                ) : (
                  <div className="item-grid">
                    {characters.map((character) => (
                      <article
                        className="item-card"
                        key={character.id}
                        style={{
                          outline:
                            selectedCharacterId === character.id
                              ? '1px solid var(--season-primary)'
                              : undefined,
                        }}
                      >
                        <div className="item-art">{character.emoji || '⚔️'}</div>
<div className="item-category">
  {String(selectedCampaign?.system_name || '')
    .toLowerCase()
    .includes('kisatsutai')
    ? 'PERSONAGEM'
    : `NÍVEL ${character.level}`}
</div>
                        <h3>{character.name}</h3>
                        <p className="item-description">
                          {character.archetype || 'Arquétipo não definido'}
                        </p>
                        {String(selectedCampaign?.system_name || '').toLowerCase().includes('kisatsutai') && <p className="item-description">⛩️ {characterRanks[character.id] || 'Graduação não definida'}</p>}
                        <small style={{ display: 'block', color: 'var(--season-muted, #b9b4c2)', margin: '8px 0' }}>
                          {character.visibility === 'campaign' ? '🌐 Toda a campanha' : character.visibility === 'selected' ? '👥 Jogadores selecionados' : '🔒 Privado'}
                        </small>
                        <button type="button" className="secondary-button" onClick={() => openCharacterEmojiPicker(character)}>Alterar emoji</button>
                        <button
                          className="primary-button"
                          onClick={() => {
                            setSelectedCharacterId(character.id)
                            setNotice(`${character.name} selecionado.`)
                          }}
                        >
                          {selectedCharacterId === character.id
                            ? 'Personagem selecionado'
                            : 'Selecionar personagem'}
                        </button>

                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>TIPOS DE ITEM</span>
                    <span className="stat-icon purple">▤</span>
                  </div>
                  <div className="stat-number">
                    {items.length}<small> tipos</small>
                  </div>
                  <div className="stat-note">No personagem selecionado</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>OBJETOS NA MOCHILA</span>
                    <span className="stat-icon gold">▣</span>
                  </div>
                  <div className="stat-number">
                    {totalObjects}<small> unidades</small>
                  </div>
                  <div className="stat-note">Somando as quantidades</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>PESO TOTAL</span>
                    <span className="stat-icon blue">⚖</span>
                  </div>
                  <div className="stat-number">
                    {totalWeight.toFixed(1)}<small> kg</small>
                  </div>
                  <div className="stat-note">Peso estimado dos itens</div>
                </div>
              </section>

              {selectedCharacter && (
                <section className="character-banner capacity-banner">
                  <div className="banner-art">
                    <span>✧</span>
                    <div className="banner-orb" />
                  </div>

                  <div className="character-info">
                    <div className="character-tag">
                      <span /> PERSONAGEM ATIVO
                    </div>
                    <h2>{selectedCharacter.name}</h2>
<p>
  {selectedCharacter.archetype || 'Aventureiro'}
{!String(selectedCampaign?.system_name || 'Kisatsutai').toLowerCase().includes('kisatsutai') && (
    <>
      <span> · </span>
      Nível {selectedCharacter.level}
    </>
  )}
</p>
                  </div>

                  <div className="banner-divider" />

                  <div className="banner-stat">
                    <span>CAPACIDADE DE CARGA</span>

                    <strong>
                      {totalWeight.toFixed(1)}
                      <small> / {maxCapacity} kg</small>
                    </strong>

                    <div className="progress-track">
                      <div
                        style={{
                          width: `${capacityPercent}%`,
                          background:
                            totalWeight > maxCapacity
                              ? '#e66b78'
                              : undefined,
                        }}
                      />
                    </div>

                    <small className="stat-caption">
                      {remainingCapacity >= 0
                        ? `${remainingCapacity.toFixed(1)} kg disponíveis`
                        : `${Math.abs(remainingCapacity).toFixed(1)} kg acima do limite`}
                    </small>


                    <small className="stat-caption">
                      10 kg base + 2 kg por ponto de Força
                    </small>
                  </div>
                </section>
              )}

              {false && activePage === 'campaigns' && (
              <section className="inventory-section" id="inventario">
                <div className="inventory-heading">
                  <div>
                    <h2>Mochila</h2>
                    <p>
                      {selectedCharacter
                        ? `Pertences de ${selectedCharacter?.name}.`
                        : 'Selecione um personagem para gerenciar seus itens.'}
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    disabled={!selectedCharacterId || loading}
                    onClick={() => {
                      if (showItemForm) {
                        resetItemForm()
                        setShowItemForm(false)
                      } else {
                        resetItemForm()
                        setShowItemForm(true)
                      }
                    }}
                  >
                    {showItemForm ? 'Cancelar' : '+ Adicionar item'}
                  </button>
                </div>

                {showItemForm &&
                  (selectedCharacterId || editingItem) &&
                  createPortal(
                    (
                      <div className="item-modal-overlay">
                        <div
                          className="item-modal-content"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="item-modal-title"
                        >
                          <form
                            className="add-form item-editor-form"
                            onSubmit={createItem}
                          >
                    <div className="form-heading">
                      <div>
                            <h3 id="item-modal-title">
                              {editingItem ? 'Editar item' : 'Novo item'}
                            </h3>
                        <p>
                          {editingItem
                            ? 'Altere os dados do item e salve as mudanças.'
                            : 'O item será associado ao personagem selecionado.'}
                        </p>
                      </div>
                      <span>{editingItem ? '✎' : '✧'}</span>
                    </div>

                    <label>
                      Nome do item
                      <input
                        value={newItemName}
                        onChange={(event) => setNewItemName(event.target.value)}
                        placeholder="Ex.: Espada de prata"
                        maxLength={100}
                        required
                      />
                    </label>

                    <label>
                      Descrição
                      <input
                        value={newItemDescription}
                        onChange={(event) =>
                          setNewItemDescription(event.target.value)
                        }
                        placeholder="Detalhes do item (opcional)"
                        maxLength={1000}
                      />
                    </label>

                    <div className="form-row">
                      <div className="emoji-field">
                        <label>Emoji do item</label>

                        <div className="emoji-grid">
                          {availableEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={
                                newItemEmoji === emoji
                                  ? 'emoji-option selected'
                                  : 'emoji-option'
                              }
                              onClick={() => setNewItemEmoji(emoji)}
                              aria-label={`Selecionar emoji ${emoji}`}
                              aria-pressed={newItemEmoji === emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

<p className="emoji-preview">
  <span className="emoji-preview-label">Emoji selecionado:</span>
  <span className="emoji-preview-icon">{newItemEmoji}</span>
</p>
                      </div>

                      <section className="item-classifications-panel">
                        <div className="item-classifications-heading">
                          <div><strong>Classificações do item</strong><p>Marque todas as opções que se aplicam. Um item pode ter várias classificações.</p></div>
                          <span>{newItemCategories.length} selecionada{newItemCategories.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="item-classifications-grid">
                          {categories.filter(category => category !== 'Todos').map(category => (
                            <label key={category} className={newItemCategories.includes(category) ? 'item-classification-option selected' : 'item-classification-option'}>
                              <input type="checkbox" checked={newItemCategories.includes(category)} onChange={event => {
                                const next = event.target.checked ? [...newItemCategories, category] : newItemCategories.filter(value => value !== category)
                                setNewItemCategories(next)
                                if (next.length) setNewItemCategory(next[0])
                                const automaticWeight = getAutomaticItemWeight(next, newEquipmentType, newArmorClass, newWeaponClass)
                                if (automaticWeight !== null) setNewItemWeight(String(automaticWeight))
                              }} />
                              <span className="item-classification-check">{newItemCategories.includes(category) ? '✓' : '+'}</span>
                              <span>{category}</span>
                            </label>
                          ))}
                        </div>
                        {!newItemCategories.length && <p className="item-classifications-hint">Selecione pelo menos uma classificação.</p>}
                      </section>

                      {newItemCategories.includes('Consumíveis') && (
                        <section className="scarcity-editor-card">
                          <div className="scarcity-editor-heading">
                            <span className="scarcity-editor-icon">⌛</span>
                            <div><strong>Sistema de escassez</strong><p>Define a chance de o consumível se esgotar conforme é utilizado.</p></div>
                          </div>
                          <label>Nível inicial de escassez
                            <select value={newScarcityLevel} onChange={event => setNewScarcityLevel(event.target.value as '1' | '2' | '3' | '4')}>
                              <option value="1">Nível 1 — d12</option>
                              <option value="2">Nível 2 — d8</option>
                              <option value="3">Nível 3 — d6</option>
                              <option value="4">Nível 4 — d4</option>
                            </select>
                          </label>
                          <div className="scarcity-level-preview">
                            <div><span>Dado ao usar</span><strong>{{ '1': 'd12', '2': 'd8', '3': 'd6', '4': 'd4' }[newScarcityLevel]}</strong></div>
                            <div><span>Carga</span><strong>{{ '1': 7, '2': 5, '3': 3, '4': 1 }[newScarcityLevel]}</strong></div>
                          </div>
                          <p className="scarcity-editor-note">Ao usar, role o dado indicado. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p>
                          <label className="scarcity-exhausted-toggle"><input type="checkbox" checked={newScarcityExhausted} onChange={event => setNewScarcityExhausted(event.target.checked)} /><span><strong>Item esgotado</strong><small>Marque para impedir novas rolagens. Desmarque para reativar o consumível.</small></span></label>
                        </section>
                      )}

<label className="item-rarity-field">
  Raridade

  <select
    value={newItemRarity}
    onChange={event => setNewItemRarity(event.target.value)}
  >
    <option value="comum">Comum</option>
    <option value="incomum">Incomum</option>
    <option value="raro">Raro</option>
    <option value="épico">Épico</option>
    <option value="mítico">Mítico</option>
    <option value="relíquia">Relíquia</option>
  </select>
</label>

                      <label>
                        Tipo de equipamento
                        <select value={newEquipmentType} onChange={event => { const nextType = event.target.value as 'none' | 'armor' | 'protection'; setNewEquipmentType(nextType); const automaticWeight = getAutomaticItemWeight(newItemCategories, nextType, newArmorClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}>
                          <option value="none">Item comum</option>
                          <option value="armor">Armadura</option>
                          <option value="protection">Proteção</option>
                        </select>
                      </label>

                      {newEquipmentType === 'armor' && <>
                        <label>Tipo de armadura<select value={newArmorClass} onChange={event => { const nextClass = event.target.value as 'leve' | 'media' | 'pesada'; setNewArmorClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, nextClass, newWeaponClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>
                        {newArmorClass !== 'pesada' && <label>Tipos de dano protegidos<select value={newArmorCoverage} onChange={event => setNewArmorCoverage(event.target.value as 'cortante_perfurante' | 'especial_bruto')}><option value="cortante_perfurante">Cortante e perfurante</option><option value="especial_bruto">Especial e bruto</option></select></label>}
                        <div className="equipment-rules-preview"><strong>Regras da armadura</strong><p>Carga: {newArmorClass === 'leve' ? 2 : newArmorClass === 'media' ? 4 : 6}</p><p>Resistência adicional: {newArmorClass === 'leve' ? '½ dos pontos de resistência + 4' : newArmorClass === 'media' ? '+6 pontos' : '2× os pontos de resistência + 8'}</p><p>Destreza de armadura: {newArmorClass === 'leve' ? 'Destreza integral' : newArmorClass === 'media' ? 'Metade do valor de destreza' : '0'}</p><p>Penalidades: {newArmorClass === 'media' ? '−5 em Reflexo; ½ do deslocamento' : newArmorClass === 'pesada' ? '−10 em Reflexo e Corrida; ¼ do deslocamento' : 'Sem penalidade; deslocamento normal'}</p></div>
                      </>}

                      {newEquipmentType === 'protection' && <>
                        <label>Nível de proteção<select value={newProtectionTier} onChange={event => setNewProtectionTier(event.target.value as 'basica' | 'moderada' | 'avancada')}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label>
                        <label>Tipo de resistência<select value={newProtectionMode} onChange={event => setNewProtectionMode(event.target.value as 'resistencia' | 'sanidade')}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label>
                        <div className="equipment-rules-preview"><strong>Regras da proteção</strong><p>Carga: 0</p><p>Proteção: {newProtectionTier === 'basica' ? '¼' : newProtectionTier === 'moderada' ? '½' : 'integral'} dos pontos de {newProtectionMode === 'resistencia' ? 'resistência' : 'mental'}.</p><p>Dano de sanidade ao perder: {newProtectionTier === 'basica' ? '1d8' : newProtectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}.</p></div>
                      </>}

                      {newItemCategories.includes('Armas') && <>
                        <label>Classificação da arma<select value={newWeaponClass} onChange={event => { const nextClass = event.target.value; setNewWeaponClass(nextClass); const automaticWeight = getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, nextClass); if (automaticWeight !== null) setNewItemWeight(String(automaticWeight)) }}><option value="improvised">Improvisada — 1d4 · 0,5 kg</option><option value="advanced">Lâmina avançada — 1d6 · 1 kg</option><option value="special">Lâmina especial — 1d8 · 1 kg</option><option value="black_red">Lâmina preta/vermelha — 1d10 · 1,5 kg</option><option value="mutable">Lâmina mutável — 1d12 · 2 kg</option></select></label>
                        <div className="equipment-rules-preview"><strong>Configuração da arma</strong><p>Dano extra: {{improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'}[newWeaponClass]}</p><p>Carga: {{improvised:0.5,advanced:1,special:1,black_red:1.5,mutable:2}[newWeaponClass]} kg</p></div>
                      </>}

                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          max="999"
                          step="1"
                          value={newItemQuantity}
                          onChange={(event) =>
                            setNewItemQuantity(event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Peso por unidade (kg)
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          step="0.1"
                          value={newItemWeight}
                          onChange={(event) => setNewItemWeight(event.target.value)}
                          disabled={getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null}
                          required
                        />
                        <small>{getAutomaticItemWeight(newItemCategories, newEquipmentType, newArmorClass, newWeaponClass) !== null
                          ? 'Peso definido automaticamente pela classificação e bloqueado para manter as regras do equipamento.'
                          : 'Informe o peso por unidade deste item.'}</small>
                      </label>
                    </div>

<label>
  Valor unitário
  <input
    type="number"
    min="0"
    step="0.01"
    value={newItemUnitPrice}
    onChange={event => setNewItemUnitPrice(event.target.value)}
    placeholder="Ex.: 500"
  />
</label>

<label>
  Moeda
  <select
    value={newItemCurrencyId}
    onChange={event => setNewItemCurrencyId(event.target.value)}
  >
    <option value="">Sem moeda definida</option>
    {selectedCampaign?.currency_config?.currencies?.map((currency, index) => (
      <option key={currency.id} value={currency.id}>
        {index === 0 ? '★ Moeda do sistema — ' : ''}{currency.name} ({currency.symbol})
      </option>
    ))}
  </select>
</label>

                        <div className="item-editor-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={loading}
                            onClick={() => {
                              resetItemForm()
                              setShowItemForm(false)
                            }}
                          >
                            Cancelar
                          </button>

                          <button
                            className="primary-button"
                            type="submit"
                            disabled={loading}
                          >
                            {loading
                              ? 'Salvando...'
                              : editingItem
                                ? 'Salvar alterações'
                                : 'Salvar item'}
                          </button>
                        </div>
                          </form>
                        </div>
                      </div>
                    ),
                    document.body
                  )}

                <div className="inventory-toolbar">
                  <div className="category-tabs">
                    {categories.map((category) => (
                      <button
                        key={category}
                        className={
                          activeCategory === category
                            ? 'category-tab selected'
                            : 'category-tab'
                        }
                        onClick={() => setActiveCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  <div className="inventory-extra-controls">
                    <label className="search-box">
                      <span>⌕</span>
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar item..."
                        aria-label="Buscar item"
                      />
                      <kbd>/</kbd>
                    </label>

                    <button
                      type="button"
                      className={favoriteOnly ? 'category-tab selected' : 'category-tab'}
                      onClick={() => setFavoriteOnly((current) => !current)}
                      aria-pressed={favoriteOnly}
                    >
                      {favoriteOnly ? '★ Favoritos' : '☆ Favoritos'}
                    </button>

                    <label className="inventory-sort-label">
                      <span>Ordenar:</span>
                      <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar itens">
                        <option value="created">Adicionados</option>
                        <option value="name">Nome</option>
                        <option value="category">Categoria</option>
                        <option value="weight">Maior peso</option>
                        <option value="quantity">Maior quantidade</option>
                      </select>
                    </label>
                  </div>
                </div>

                {itemsLoading ? (
                  <div className="empty-state">
                    <p>Carregando inventário...</p>
                  </div>
                ) : !selectedCharacterId ? (
                  <div className="empty-state">
                    <span>♙</span>
                    <h3>Selecione um personagem</h3>
                    <p>Escolha um personagem para ver seus pertences.</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="empty-state">
                    <span>▤</span>
                    <h3>
                      {items.length === 0
                        ? 'Mochila vazia'
                        : 'Nenhum item encontrado'}
                    </h3>
                    <p>
                      {items.length === 0
                        ? 'Adicione o primeiro item deste personagem.'
                        : 'Tente outra busca ou selecione outra categoria.'}
                    </p>
                    {items.length === 0 ? (
                      <button onClick={() => setShowItemForm(true)}>
                        Adicionar primeiro item
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSearch('')
                          setActiveCategory('Todos')
                        }}
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="item-grid">
                    {filteredItems.map((item) => (
                      <article
  className="item-card inventory-item-card"
  key={item.id}
  onClick={() => {
    setSelectedItemDetails(item)
}}
  style={{ cursor: 'pointer' }}
>
                        <div className="item-card-top">
                          <button
                            type="button"
                            className="item-art"
                            onClick={() => setEmojiPickerItem(item)}
                            title="Clique para alterar o emoji"
                            aria-label={`Alterar emoji de ${item.name}`}
                            style={{
                              cursor: 'pointer',
                              font: 'inherit',
                              fontSize: '28px',
                            }}
                          >
                            {typeof item.metadata?.icon === 'string'
                              ? item.metadata.icon
                              : '📦'}
                          </button>

                          <div className="item-actions">
                            <button
                              type="button"
                              className="item-menu"
                              title={item.metadata?.favorite === true ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                              aria-label={item.metadata?.favorite === true ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
                              aria-pressed={item.metadata?.favorite === true}
                              onClick={() => void toggleFavorite(item)}
                            >
                              {item.metadata?.favorite === true ? '★' : '☆'}
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              title="Duplicar item"
                              aria-label={`Duplicar ${item.name}`}
                              disabled={loading}
                              onClick={() => void duplicateItem(item)}
                            >
                              ⧉
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              title="Editar item"
                              aria-label={`Editar ${item.name}`}
                              disabled={loading}
                              onClick={(event) => {
                                event.stopPropagation()
                                startEditingItem(item)
                              }}
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              onClick={(event) => {
  event.stopPropagation()
  void removeItem(item)
}}
                              title="Remover item"
                              aria-label={`Remover ${item.name}`}
                              disabled={loading}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="item-category">{item.category}</div>
                        <h3>{item.name}</h3>
                        <p className="item-description">
                          {item.description || 'Sem descrição.'}
                        </p>

{(item.metadata?.equipmentType === 'armor' || item.metadata?.equipmentType === 'protection' || (Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas'))) && (
                          <div className="inventory-equipment-controls" aria-label={`Equipamento de ${item.name}`}>
                            <span className="inventory-equipment-label">EQUIPAMENTO</span>
                            <button
                              type="button"
                              className={`inventory-equip-button ${item.metadata?.equipped === true ? 'is-equipped' : ''}`}
                              aria-pressed={item.metadata?.equipped === true}
                              onClick={async (event) => {
                                event.stopPropagation();
                                const isWeapon = Array.isArray(item.metadata?.categories) && item.metadata.categories.includes('Armas');
                                const type = isWeapon ? 'weapon' : item.metadata?.equipmentType;
                                const nextEquipped = item.metadata?.equipped !== true;
                                const others = nextEquipped && (type === 'weapon' || type === 'armor')
                                  ? items.filter(entry => entry.character_id === item.character_id && entry.id !== item.id && entry.metadata?.equipped === true && (type === 'weapon' ? Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas') : entry.metadata?.equipmentType === 'armor'))
                                  : [];
                                for (const other of others) {
                                  const { error: otherError } = await supabase.from('inventory_items').update({ metadata: { ...(other.metadata || {}), equipped: false } }).eq('id', other.id);
                                  if (otherError) { setError(`Não foi possível atualizar outro equipamento: ${otherError.message}`); return; }
                                }
                                const { data, error: equipError } = await supabase.from('inventory_items').update({ metadata: { ...(item.metadata || {}), equipped: nextEquipped } }).eq('id', item.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id').maybeSingle();
                                if (equipError || !data) { setError(`Não foi possível alterar o equipamento: ${equipError?.message || 'sem retorno'}`); return; }
                                setItems(current => current.map(entry => entry.id === item.id ? data as Item : others.some(other => other.id === entry.id) ? { ...entry, metadata: { ...(entry.metadata || {}), equipped: false } } : entry));
                                setNotice(nextEquipped ? `${item.name} equipado(a).` : `${item.name} desequipado(a).`);
                              }}
                            >
                              <span className="inventory-equip-symbol">{item.metadata?.equipped === true ? '✓' : item.metadata?.equipmentType === 'armor' ? '🛡' : item.metadata?.equipmentType === 'protection' ? '✧' : '⚔'}</span>
                              {item.metadata?.equipped === true ? 'Equipado · Desequipar' : item.metadata?.equipmentType === 'armor' ? 'Equipar armadura' : item.metadata?.equipmentType === 'protection' ? 'Equipar proteção' : 'Equipar arma'}
                            </button>
                          </div>
                        )}

                        <div className="item-footer">
                          <span>
                            ⚖ {`${(Number(item.weight) || 0).toFixed(1)} kg / un.`}
                          </span>
                          <div className="quantity-controls" aria-label={`Quantidade de ${item.name}`}>
                            <button
                              type="button"
                              className="quantity-button"
                              onClick={() => void changeItemQuantity(item, Number(item.quantity) - 1)}
                              disabled={Number(item.quantity) <= 1 || updatingQuantityItemId === item.id}
                              aria-label={`Diminuir quantidade de ${item.name}`}
                            >−</button>
                            <span className="quantity" aria-live="polite">{item.quantity}</span>
                            <button
                              type="button"
                              className="quantity-button"
                              onClick={() => void changeItemQuantity(item, Number(item.quantity) + 1)}
                              disabled={Number(item.quantity) >= 999 || updatingQuantityItemId === item.id}
                              aria-label={`Aumentar quantidade de ${item.name}`}
                            >+</button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              )}
            </>
          )}

          {loading && <p role="status">Salvando ou carregando...</p>}

          {emojiPickerCharacter && (
            <div className="emoji-modal-backdrop" onClick={() => setEmojiPickerCharacter(null)}>
              <section className="emoji-modal" role="dialog" aria-modal="true" aria-labelledby="character-emoji-modal-title" onClick={(event) => event.stopPropagation()}>
                <div className="emoji-modal-heading">
                  <div>
                    <h3 id="character-emoji-modal-title">Escolher emoji</h3>
                    <p>{emojiPickerCharacter.name}</p>
                  </div>
                  <button type="button" className="item-menu" onClick={() => setEmojiPickerCharacter(null)} aria-label="Fechar seletor de emoji">×</button>
                </div>
                <div className="emoji-grid">
                  {availableEmojis.map((emoji) => (
                    <button key={emoji} type="button" className={emojiPickerCharacter.emoji === emoji ? 'emoji-option selected' : 'emoji-option'} onClick={() => void changeCharacterEmoji(emojiPickerCharacter, emoji)} aria-label={`Usar emoji ${emoji}`} aria-pressed={emojiPickerCharacter.emoji === emoji}>{emoji}</button>
                  ))}
                </div>
                <button type="button" className="secondary-button" onClick={() => setEmojiPickerCharacter(null)}>Cancelar</button>
              </section>
            </div>
          )}

          {emojiPickerItem && (
            <div
              className="emoji-modal-backdrop"
              onClick={() => setEmojiPickerItem(null)}
            >
              <section
                className="emoji-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="emoji-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="emoji-modal-heading">
                  <div>
                    <h3 id="emoji-modal-title">Escolher emoji</h3>
                    <p>{emojiPickerItem.name}</p>
                  </div>

                  <button
                    type="button"
                    className="item-menu"
                    onClick={() => setEmojiPickerItem(null)}
                    aria-label="Fechar seletor de emoji"
                  >
                    ×
                  </button>
                </div>

                <div className="emoji-grid">
                  {availableEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={
                        emojiPickerItem.metadata?.icon === emoji
                          ? 'emoji-option selected'
                          : 'emoji-option'
                      }
                      onClick={() =>
                        void changeItemEmoji(emojiPickerItem, emoji)
                      }
                      aria-label={`Usar emoji ${emoji}`}
                      aria-pressed={emojiPickerItem.metadata?.icon === emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEmojiPickerItem(null)}
                >
                  Cancelar
                </button>
              </section>
            </div>
          )}

{selectedItemDetails && createPortal((
  <div className="modal-overlay" onClick={() => setSelectedItemDetails(null)} style={{position:'fixed',inset:0,zIndex:10000,display:'grid',placeItems:'center',padding:20,background:'rgba(5,5,9,.78)',backdropFilter:'blur(7px)'}}>
    <div className="item-details-modal item-details-redesigned" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selectedItemDetails.name}`} onClick={event => event.stopPropagation()} style={{position:'relative',width:'min(100%,520px)',maxHeight:'min(85vh,760px)',overflowY:'auto',padding:28,borderRadius:20,border:'1px solid var(--season-line,rgba(255,255,255,.14))',background:'var(--season-surface,#17151f)',color:'var(--season-text,#f4f0fa)',boxShadow:'0 24px 80px rgba(0,0,0,.5)'}}>
      <button type="button" className="item-menu" onClick={() => setSelectedItemDetails(null)} aria-label="Fechar detalhes" style={{position:'absolute',right:16,top:16,width:36,height:36,borderRadius:10,fontSize:20}}>✕</button>
<div className="item-details-header">
  <div className="item-art">
    {typeof selectedItemDetails.metadata?.icon === 'string'
      ? selectedItemDetails.metadata.icon
      : '📦'}
  </div>

  <div className="item-details-heading">
    <small>{selectedItemDetails.category}</small>

<p className="item-rarity">
  <strong>Raridade:</strong>
  <span>
    {typeof selectedItemDetails.metadata?.rarity === 'string'
      ? selectedItemDetails.metadata.rarity.charAt(0).toLocaleUpperCase('pt-BR') +
        selectedItemDetails.metadata.rarity.slice(1)
      : 'Comum'}
  </span>
</p>

    <h2>{selectedItemDetails.name}</h2>
    <p>{selectedItemDetails.description || 'Sem descrição.'}</p>
  </div>
</div>
      {((selectedItemDetails.metadata?.equipmentType === 'armor' || selectedItemDetails.metadata?.equipmentType === 'protection') || (Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Armas'))) && <button type="button" className="equipment-toggle-button" onClick={async()=>{
        const isWeapon=Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Armas');
        const equipmentType=isWeapon?'weapon':selectedItemDetails.metadata?.equipmentType;
        const nextEquipped=selectedItemDetails.metadata?.equipped!==true;
        // Uma arma e uma armadura por personagem; proteções podem coexistir.
        if(nextEquipped && (equipmentType==='armor' || equipmentType==='weapon')) {
          const others=items.filter(entry=>entry.character_id===selectedItemDetails.character_id && entry.id!==selectedItemDetails.id && entry.metadata?.equipped===true && (equipmentType==='armor' ? entry.metadata?.equipmentType==='armor' : Array.isArray(entry.metadata?.categories) && entry.metadata.categories.includes('Armas')));
          for(const other of others) {
            const {error:unequipError}=await supabase.from('inventory_items').update({metadata:{...(other.metadata||{}),equipped:false}}).eq('id',other.id);
            if(unequipError){setError(`Não foi possível substituir o equipamento: ${unequipError.message}`);return}
          }
          if(others.length) setItems(current=>current.map(entry=>others.some(other=>other.id===entry.id)?{...entry,metadata:{...(entry.metadata||{}),equipped:false}}:entry));
        }
        const {data,error}=await supabase.from('inventory_items').update({metadata:{...(selectedItemDetails.metadata||{}),equipped:nextEquipped}}).eq('id',selectedItemDetails.id).select('id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked').maybeSingle();
        if(error||!data){setError(`Não foi possível alterar equipamento: ${error?.message||'sem retorno'}`);return}
        setItems(current=>current.map(entry=>entry.id===selectedItemDetails.id?data as Item:entry));setSelectedItemDetails(data as Item);setNotice(nextEquipped?(isWeapon?'Arma equipada.':equipmentType==='armor'?'Armadura equipada.':'Proteção equipada.'):'Equipamento desativado.');
      }}>{selectedItemDetails.metadata?.equipped===true?'✓ Equipado · Desequipar':(Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Armas'))?'⚔ Equipar arma':'Equipar item'}</button>}

      {((Array.isArray(selectedItemDetails.metadata?.categories) && selectedItemDetails.metadata.categories.includes('Consumíveis')) || selectedItemDetails.category === 'Consumíveis') && (() => {
        const level = Math.min(4, Math.max(1, Number(selectedItemDetails.metadata?.scarcityLevel) || 1))
        const die = ({ 1: 'd12', 2: 'd8', 3: 'd6', 4: 'd4' } as Record<number, string>)[level]
        const exhausted = selectedItemDetails.metadata?.scarcityExhausted === true
        return <section className="scarcity-use-card">
          <div className="scarcity-use-heading"><span>⌛</span><div><h3>Escassez do consumível</h3><p>{exhausted ? 'Este item está esgotado.' : `Nível ${level} · ${die} · Carga ${({ 1: 7, 2: 5, 3: 3, 4: 1 } as Record<number, number>)[level]}`}</p></div></div>
          <div className="scarcity-use-stats"><div><small>Última rolagem</small><strong>{selectedItemDetails.metadata?.scarcityLastRoll ? `${selectedItemDetails.metadata.scarcityLastRoll} em ${selectedItemDetails.metadata.scarcityLastDie || '—'}` : 'Ainda não usado'}</strong></div><div><small>Usos registrados</small><strong>{Number(selectedItemDetails.metadata?.scarcityUses) || 0}</strong></div></div>
          <p>Role o dado indicado ao usar. Resultado 1 aumenta um nível; no nível 4, resultado 1 esgota o item.</p>
          <button type="button" className="primary-button" disabled={exhausted || usingScarcityItemId === selectedItemDetails.id} onClick={() => void useScarcityItem(selectedItemDetails)}>{usingScarcityItemId === selectedItemDetails.id ? 'Rolando dado...' : exhausted ? 'Item esgotado' : `🎲 Rolar ${die} · Registrar uso`}</button>
        </section>
      })()}
      <div className="item-economic-details">
        <div><span>Valor unitário</span><strong>{selectedItemDetails.currency_id ? `${selectedCampaign?.currency_config?.currencies?.find(currency => currency.id === selectedItemDetails.currency_id)?.symbol ?? ''} ` : ''}{Number(selectedItemDetails.unit_price ?? 0).toLocaleString('pt-BR')}</strong></div>
        <div><span>Valor total</span><strong>{selectedItemDetails.currency_id ? `${selectedCampaign?.currency_config?.currencies?.find(currency => currency.id === selectedItemDetails.currency_id)?.symbol ?? ''} ` : ''}{(Number(selectedItemDetails.unit_price ?? 0) * Number(selectedItemDetails.quantity ?? 0)).toLocaleString('pt-BR')}</strong></div>
      </div>
      <div className="item-sale-section">
  <h3>Vender para uma loja</h3>

  {isMaster && (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: '12px 0',
      fontSize: 13,
    }}
  >
    <input
      type="checkbox"
      className="restriction-checkbox"
      checked={!!selectedItemDetails.sale_blocked}
      onChange={event =>
        void setItemRestriction(
          'inventory',
          selectedItemDetails.id,
          event.target.checked
        )
      }
    />
    Bloquear venda deste item
  </label>
)}

{selectedItemDetails.sale_blocked && (
  <p style={{ color: '#e6a36d', fontSize: 13 }}>
    🔒 A venda deste item foi bloqueada pelo mestre.
  </p>
)}

  {!(selectedItemDetails.metadata?.shop_id &&
     selectedItemDetails.metadata?.shop_item_id) && (
    <label style={labelStyle}>
      Loja que receberá o item

      <select
        value={saleShopId}
        onChange={event => setSaleShopId(event.target.value)}
        style={inputStyle}
      >
        <option value="">Selecione uma loja</option>

        {shops.map(shop => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>
    </label>
  )}

  <label style={labelStyle}>
    Quantidade para vender

    <input
      type="number"
      min="1"
      max={selectedItemDetails.quantity}
      value={saleQuantity}
      onChange={event => setSaleQuantity(event.target.value)}
      style={inputStyle}
    />
  </label>

  <p>
    Valor da venda:{' '}
    <strong>
      {(
        Number(selectedItemDetails.unit_price) *
        Number(saleQuantity || 0)
      ).toLocaleString('pt-BR')}
    </strong>
  </p>

  <button
    type="button"
    className="primary-button"
    disabled={saleLoading || !!selectedItemDetails.sale_blocked}
    onClick={() => void sellInventoryItem(selectedItemDetails)}
  >
    {saleLoading
    ? 'Vendendo...'
    : selectedItemDetails.sale_blocked
      ? 'Venda bloqueada'
      : 'Vender item'}
  </button>
</div>
      {selectedItemDetails.metadata?.equipmentType === 'armor' && <section className="equipment-rules-preview"><h3>Armadura {selectedItemDetails.metadata?.armorClass === 'media' ? 'média' : selectedItemDetails.metadata?.armorClass === 'pesada' ? 'pesada' : 'leve'}</h3><p>Tipos protegidos: {selectedItemDetails.metadata?.armorCoverage === 'todos' ? 'Cortante, perfurante, especial e bruto' : selectedItemDetails.metadata?.armorCoverage === 'especial_bruto' ? 'Especial e bruto' : 'Cortante e perfurante'}</p><p>Carga por unidade: {Number(selectedItemDetails.weight || 0).toLocaleString('pt-BR')} kg</p><p>Resistência: {selectedItemDetails.metadata?.armorClass === 'media' ? '+6' : selectedItemDetails.metadata?.armorClass === 'pesada' ? 'Dobro dos pontos + 8' : 'Metade dos pontos + 4'}</p><p>Destreza de armadura: {selectedItemDetails.metadata?.armorClass === 'media' ? 'Metade da destreza' : selectedItemDetails.metadata?.armorClass === 'pesada' ? '0' : 'Igual à destreza'}</p><p>Penalidades: {selectedItemDetails.metadata?.armorClass === 'media' ? '−5 em Reflexo; deslocamento pela metade' : selectedItemDetails.metadata?.armorClass === 'pesada' ? '−10 em Reflexo e Corrida; deslocamento a ¼' : 'Nenhuma'}</p></section>}
      {selectedItemDetails.metadata?.equipmentType === 'protection' && <section className="equipment-rules-preview"><h3>Proteção {selectedItemDetails.metadata?.protectionTier === 'moderada' ? 'moderada' : selectedItemDetails.metadata?.protectionTier === 'avancada' ? 'avançada' : 'básica'}</h3><p>Carga: 0</p><p>Tipo: {selectedItemDetails.metadata?.protectionMode === 'sanidade' ? 'Resistência de sanidade' : 'Resistência contra dano especial e bruto'}</p><p>Valor protegido: {selectedItemDetails.metadata?.protectionTier === 'basica' ? '¼' : selectedItemDetails.metadata?.protectionTier === 'moderada' ? '½' : 'Integral'}</p><p>Dano de sanidade ao perder: {selectedItemDetails.metadata?.protectionTier === 'basica' ? '1d8' : selectedItemDetails.metadata?.protectionTier === 'moderada' ? '2d8' : '2d12 + 1d4'}</p></section>}
<section className="item-basic-stats">
  <div className="item-stat-card">
    <small>Quantidade</small>
    <strong>{selectedItemDetails.quantity}</strong>
  </div>

  <div className="item-stat-card">
    <small>Peso por unidade</small>
    <strong>{Number(selectedItemDetails.weight).toFixed(1)} kg</strong>
  </div>

  <div className="item-stat-card">
    <small>Peso total</small>
    <strong>
      {(Number(selectedItemDetails.weight) * Number(selectedItemDetails.quantity)).toFixed(1)} kg
    </strong>
  </div>
</section>
    </div>
  </div>
), document.body)}

          <footer className="page-footer">
            <span>
              HäxBag
              <span className="footer-separator"> · </span>
              Seu inventário, suas regras.
            </span>
            <span>
              FEITO PARA QUEM VIVE GRANDES AVENTURAS <span>✧</span>
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}

const centerStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--season-bg, #100e19)',
  color: '#f4f0fa',
  fontFamily: 'sans-serif',
} as const

const labelStyle = {
  display: 'block',
  color: 'var(--season-muted, #b9b4c2)',
  fontSize: '12px',
  marginBottom: '6px',
} as const

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))',
  background: 'var(--season-bg, var(--season-bg, #100e19))',
  color: '#f4f0fa',
  marginBottom: '8px',
} as const

const secondaryButtonStyle = {
  padding: '8px 12px',
  border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))',
  borderRadius: '8px',
  background: 'var(--season-surface-alt, var(--season-surface-alt, #211c31))',
  color: 'var(--season-primary, var(--season-primary, #b49aff))',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '12px',
} as const

export default App
