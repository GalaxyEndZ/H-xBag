
import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Auth from './Auth'
import './App.css'

type Campaign = {
  id: string
  name: string
  description: string | null
  system_name: string | null
  created_by: string
  role: string
}

type Character = {
  id: string
  campaign_id: string
  user_id: string
  name: string
  archetype: string | null
  level: number
  strength: number
  visibility: 'private' | 'campaign' | 'selected'
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
  metadata: Record<string, unknown> | null
}

function displayNameForMembers(session: Session | null) {
  return session?.user.user_metadata?.display_name ||
    session?.user.email?.split('@')[0] ||
    'Você'
}

const KISATSUTAI_FAMILY_TIERS = {
  '1': { label: 'Tier 1 — Família principal', pv: 30, ps: 25, pr: 60, strength: 1, agility: 1, defense: 1, breathing: 2, intellect: 1, points: 7, focus: 24 },
  '2': { label: 'Tier 2 — Família muito influente', pv: 25, ps: 20, pr: 40, strength: 0, agility: 1, defense: 0, breathing: 2, intellect: 1, points: 5, focus: 12 },
  '3': { label: 'Tier 3 — Envolvimento direto', pv: 20, ps: 15, pr: 20, strength: 0, agility: 0, defense: 0, breathing: 1, intellect: 1, points: 3, focus: 6 },
  '4': { label: 'Tier 4 — Conhecimento dos Kisatsutai', pv: 15, ps: 10, pr: 10, strength: 0, agility: 0, defense: -1, breathing: 1, intellect: 1, points: 2, focus: 4 },
  '5': { label: 'Tier 5 — Sem relação com Kisatsutai', pv: 10, ps: 5, pr: 5, strength: -1, agility: 0, defense: -1, breathing: -1, intellect: 0, points: 0, focus: 2 },
} as const

const KISATSUTAI_RANKS = [
  { id: 'zaidan', name: 'Zaidan', group: 'Carpa', focus: '1', benefits: '+15 PV, +10 PS, +0 PR; 20 pontos de perícias principais; +1 atributo extra; dano 1d4; formas Carpa e Raposa.' },
  { id: 'mizunoto', name: 'Mizunoto', group: 'Raposa', focus: '2', benefits: '+30 PV, +25 PS, +5 PR; 25 pontos de perícias; +1 atributo extra; dano 1d6; fluxo Raposa.' },
  { id: 'mizunoe', name: 'Mizunoe', group: 'Raposa', focus: '4', benefits: '+35 PV, +30 PS, +10 PR; 25 pontos de perícias; +2 atributos extras; dano 1d6; fluxo Raposa.' },
  { id: 'kanoto', name: 'Kanoto', group: 'Raposa', focus: '6', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'kanoe', name: 'Kanoe', group: 'Tigre', focus: '10', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'tsuchinoto', name: 'Tsuchinoto', group: 'Tigre', focus: '14', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'tsuchinoe', name: 'Tsuchinoe', group: 'Tigre', focus: '18', benefits: 'Benefícios totais não definidos no material.' },
  { id: 'hinoto', name: 'Hinoto', group: 'Dragão', focus: '24', benefits: '+40 PV, +35 PS, +20 PR; 28 pontos de perícias; +4 atributos extras; Concentração Total Aprimorada (DT19); dano 1d10.' },
  { id: 'hinoe', name: 'Hinoe', group: 'Dragão', focus: '28', benefits: '+41 PV, +36 PS, +25 PR; 28 pontos de perícias; +5 atributos extras; técnica aprimorada DT19; dano 1d10.' },
  { id: 'kinoto', name: 'Kinoto', group: 'Dragão', focus: '32', benefits: '+42 PV, +37 PS, +30 PR; 29 pontos de perícias; +5 atributos extras; técnica aprimorada DT19; dano 1d10.' },
  { id: 'kinoe', name: 'Kinoe (Tsuguko)', group: 'Corvo', focus: '44', benefits: '+44 PV, +39 PS, +35 PR; 29 pontos de perícias; +6 atributos extras; técnica completa DT18; dano 1d12; fluxo Corvo.' },
  { id: 'hashira-inferior', name: 'Hashira Inferior (Shinkai)', group: 'Corvo', focus: '92', benefits: '+56 PV, +51 PS, +80 PR; 35 pontos de perícias; +10 atributos extras; técnica perfeita DT17; não gasta PR nas formas Tigre e Raposa; dano 1d12.' },
  { id: 'hashira-superior', name: 'Hashira Superior (Saikou)', group: 'Corvo', focus: 'Ilimitado', benefits: 'Benefícios totais não definidos no material.' },
] as const

const KISATSUTAI_RANK_STATUS: Record<string, { pv: number; ps: number; pr: number }> = {
  zaidan: { pv: 15, ps: 10, pr: 0 },
  mizunoto: { pv: 30, ps: 25, pr: 5 },
  mizunoe: { pv: 35, ps: 30, pr: 10 },
  hinoto: { pv: 40, ps: 35, pr: 20 },
  hinoe: { pv: 41, ps: 36, pr: 25 },
  kinoto: { pv: 42, ps: 37, pr: 30 },
  kinoe: { pv: 44, ps: 39, pr: 35 },
  'hashira-inferior': { pv: 56, ps: 51, pr: 80 },
}

const KISATSUTAI_PROMOTIONS: Record<string, string> = {
  'zaidan>mizunoto': '+15 PV, +15 PS, +5 PR, +5 pontos de perícias, +1 foco; dano 1d4 → 1d6; desbloqueia fluxo Raposa.',
  'mizunoto>mizunoe': '+5 PV, +5 PS, +5 PR, +1 atributo extra, +2 foco.',
  'mizunoe>kanoto': '+1 PV, +1 PS, +5 PR, +1 ponto de perícia principal, +2 foco.',
  'hinoto>hinoe': 'Registro inconsistente no material: menciona +1 PR, +1 PS, +5 PR, +1 ponto de atributo e +6 foco. Confirmar com o mestre antes de aplicar.',
  'kinoto>kinoe': '+2 PV, +2 PS, +5 PR, +1 ponto de atributo, técnica completa DT18, dano 1d10 → 1d12, fluxo Corvo, +12 foco e formas Corvo.',
  'kinoe>hashira-inferior': '+12 PV, +12 PS, +45 PR, +6 perícias principais, +4 atributos extras, técnica perfeita DT17, formas Tigre/Raposa sem custo de PR e +48 foco.',
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
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null)
  const [campaignMembers, setCampaignMembers] = useState<CampaignMember[]>([])
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null)
  const [characterGrants, setCharacterGrants] = useState<CharacterGrant[]>([])
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [seasonNameDraft, setSeasonNameDraft] = useState('')
  const [seasonDescriptionDraft, setSeasonDescriptionDraft] = useState('')
  const [seasonThemeSaving, setSeasonThemeSaving] = useState(false)
  const seasonThemes = {
    default: { label: 'Padrão HäxBag', primary: '#c8b5ff', secondary: '#7958cf', glow: 'rgba(190,170,255,.20)', bg: '#0e0b17', surface: '#181323', surfaceAlt: '#251b36', line: '#493765' },
    crimson: { label: 'Lua de Sangue', primary: '#ff334f', secondary: '#b5122e', glow: 'rgba(255,35,65,.22)', bg: '#080809', surface: '#111114', surfaceAlt: '#1b1115', line: '#64202e' },
    forest: { label: 'Floresta Esquecida', primary: '#9be8b7', secondary: '#397b58', glow: 'rgba(139,224,178,.19)', bg: '#09130f', surface: '#122019', surfaceAlt: '#1c3024', line: '#3b6249' },
    frost: { label: 'Inverno Eterno', primary: '#b9e8ff', secondary: '#4b88b5', glow: 'rgba(169,222,248,.20)', bg: '#09131d', surface: '#121f2c', surfaceAlt: '#1b3041', line: '#3c617c' },
    arcane: { label: 'Arcano', primary: '#e7c5ff', secondary: '#8754c5', glow: 'rgba(223,184,255,.20)', bg: '#120b1b', surface: '#1c1428', surfaceAlt: '#2b1c40', line: '#5a3d78' },
    ghost_vale: { label: 'Vale Fantasma', primary: '#ffc078', secondary: '#c85d27', glow: 'rgba(255,158,75,.19)', bg: '#080a0d', surface: '#11161b', surfaceAlt: '#1b252d', line: '#46535d' },
    crimson_vale: { label: 'Vale Carmesim', primary: '#ff5268', secondary: '#a91f38', glow: 'rgba(255,55,85,.20)', bg: '#09090c', surface: '#151216', surfaceAlt: '#24151c', line: '#653044' },  
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
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetSaving, setSheetSaving] = useState(false)
  const [editingSheet, setEditingSheet] = useState(false)

  const [activePage, setActivePage] = useState<'inventory' | 'sheets' | 'characters' | 'campaigns'>('inventory')
  const [sheetCharacterView, setSheetCharacterView] = useState(false)

  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showCharacterForm, setShowCharacterForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [copyPreviousSheet] = useState(true);
  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [campaignInviteLink, setCampaignInviteLink] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [systemName, setSystemName] = useState('')

  const [characterName, setCharacterName] = useState('')
  const [archetype, setArchetype] = useState('')
  const [characterLevel, setCharacterLevel] = useState('1')

  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Diversos')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemWeight, setNewItemWeight] = useState('0')
  const [newItemEmoji, setNewItemEmoji] = useState('📦')

  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [emojiPickerItem, setEmojiPickerItem] = useState<Item | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sortBy, setSortBy] = useState('created')
  const [updatingQuantityItemId, setUpdatingQuantityItemId] = useState<string | null>(null)

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
        .select('id, name, description, system_name, created_by')
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

      setSelectedCampaignId((current) =>
        result.some((campaign) => campaign.id === current)
          ? current
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
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    setSeasonNameDraft(season?.name ?? '')
    setSeasonDescriptionDraft(season?.description ?? '')
  }, [selectedSeasonId, seasons])

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
          'id, campaign_id, user_id, name, archetype, level, strength, visibility, created_at',
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
    const currentCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId)
    if (!selectedCharacterId || currentCampaign?.role !== 'master') {
      setCharacterGrants([])
      return
    }

    let cancelled = false
    async function loadCharacterGrants() {
      const { data, error: grantsError } = await supabase
        .from('character_visibility')
        .select('user_id')
        .eq('character_id', selectedCharacterId)

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
  }, [selectedCharacterId, selectedCampaignId, campaigns])

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
        .select(
          'id, character_id, name, description, category, quantity, weight, metadata',
        )
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

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(`Não foi possível sair: ${signOutError.message}`)
    }
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
      .select('id, name, description, system_name, created_by')
      .eq('id', newCampaignId)
      .single()

    if (fetchError || !campaign) {
      setError('A campanha foi criada. Atualize a página para carregá-la.')
      setLoading(false)
      return
    }

    setCampaigns((current) => [
      ...current,
      { ...campaign, role: membership.role },
    ])
    setSelectedCampaignId(newCampaignId)
    setCharacters([])
    setItems([])
    setSelectedCharacterId('')
    setCampaignName('')
    setCampaignDescription('')
    setSystemName('')
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
    const { data: campaign, error: campaignError } = await supabase.from('campaigns').select('id,name,description,system_name,created_by').eq('id', joinedId).single()
    if (campaignError || !campaign) {
      setError(`Você entrou na campanha, mas não foi possível carregá-la: ${campaignError?.message ?? ''}`)
      setInviteLoading(false)
      return
    }
    setCampaigns(current => current.some(entry => entry.id === campaign.id) ? current : [...current, { ...campaign, role: 'player' }])
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

  async function saveCharacterSheet() {
    if (!selectedCharacterId || !selectedSeasonId || !isMaster) return
    let parsed: Record<string, unknown>
    try { const value: unknown = JSON.parse(sheetDraft); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A ficha precisa ser um objeto JSON.'); parsed = value as Record<string, unknown> }
    catch (e) { setError(e instanceof Error ? e.message : 'JSON inválido.'); return }
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
        .select('id, campaign_id, user_id, name, archetype, level, strength, visibility, created_at')
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

    const kisatsutaiCampaign = String(selectedCampaign?.system_name || '').toLowerCase().includes('kisatsutai')
    const level = kisatsutaiCampaign ? 1 : Number(characterLevel)

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
        p_archetype: archetype.trim() || null,
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

    const createdCharacter = data as Character
    setCharacters((current) =>
      current.some((character) => character.id === createdCharacter.id)
        ? current.map((character) =>
            character.id === createdCharacter.id ? createdCharacter : character,
          )
        : [...current, createdCharacter],
    )
    setSelectedCharacterId(createdCharacter.id)
    setCharacterName('')
    setArchetype('')
    setCharacterLevel('1')
    setShowCharacterForm(false)
    setNotice('Personagem criado e salvo!')
    setLoading(false)
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

  async function changeCharacterVisibility(visibility: Character['visibility']) {
    if (!selectedCharacter || !isMaster) return
    setVisibilitySaving(true)
    setError('')
    setNotice('')

    const { data, error: visibilityError } = await supabase
      .from('characters')
      .update({ visibility })
      .eq('id', selectedCharacter.id)
      .select('id, campaign_id, user_id, name, archetype, level, strength, visibility, created_at')
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

  function resetItemForm() {
    setEditingItem(null)
    setNewItemName('')
    setNewItemDescription('')
    setNewItemCategory('Diversos')
    setNewItemQuantity('1')
    setNewItemWeight('0')
    setNewItemEmoji('📦')
  }

  function startEditingItem(item: Item) {
    setEditingItem(item)
    setNewItemName(item.name)
    setNewItemDescription(item.description ?? '')
    setNewItemCategory(item.category)
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

    if (!selectedCharacterId || !newItemName.trim()) return

    const quantity = Number(newItemQuantity)
    const weight = Number(newItemWeight)

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
      category: newItemCategory,
      quantity,
      weight,
      metadata: {
        ...(editingItem?.metadata ?? {}),
        icon: newItemEmoji,
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
          'id, character_id, name, description, category, quantity, weight, metadata',
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
          'id, character_id, name, description, category, quantity, weight, metadata',
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
      .select('id, character_id, name, description, category, quantity, weight, metadata')
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
      .select('id, character_id, name, description, category, quantity, weight, metadata')
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
        metadata: { ...(item.metadata ?? {}), favorite: false },
      })
      .select('id, character_id, name, description, category, quantity, weight, metadata')
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

    setItems((current) =>
      current.filter((entry) => entry.id !== item.id),
    )
    setNotice(`${item.name} foi removido do inventário.`)
  }

  const displayName =
    session?.user.user_metadata?.display_name ||
    session?.user.email?.split('@')[0] ||
    'Aventureiro'

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.id === selectedCampaignId,
  )

  const selectedCharacter = characters.find(
    (character) => character.id === selectedCharacterId,
  )

  const isMaster = selectedCampaign?.role === 'master'


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
        activeCategory === 'Todos' || item.category === activeCategory
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

  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item.weight) * Number(item.quantity),
    0,
  )

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
    <div className={`app-shell theme-${activeThemeKey}`} style={{'--season-primary': activeTheme.primary, '--season-secondary': activeTheme.secondary, '--season-glow': activeTheme.glow, '--season-bg': activeTheme.bg, '--season-surface': activeTheme.surface, '--season-surface-alt': activeTheme.surfaceAlt, '--season-line': activeTheme.line, '--season-line-soft': activeTheme.glow.replace(/\.\d+\)/, '.14)'), '--season-muted': '#b9b4c2', '--season-on-primary': activeTheme.bg,  '--season-panel-tint': activeTheme.surfaceAlt, '--purple': activeTheme.primary, '--purple-bright': activeTheme.primary, '--purple-dark': activeTheme.secondary} as React.CSSProperties}>
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
            onChange={(event) => setSelectedCampaignId(event.target.value)}
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
          <a className="nav-link" href="#inicio">
            <span>◫</span> Visão geral
          </a>
          <button className={`nav-link ${activePage === 'inventory' ? 'active' : ''}`} onClick={() => setActivePage('inventory')}>
            <span>▤</span> Inventário <span className="nav-count">{items.length}</span>
          </button>
          <button className={`nav-link ${activePage === 'sheets' ? 'active' : ''}`} onClick={() => { setActivePage('sheets'); setSheetCharacterView(false) }} disabled={!selectedCampaignId}>
            <span>▧</span> Fichas <span className="nav-count">{characters.length}</span>
          </button>
          <button className={`nav-link ${activePage === 'characters' ? 'active' : ''}`} onClick={() => setActivePage('characters')} disabled={!selectedCampaignId}>
            <span>♙</span> Personagens <span className="nav-count">{characters.length}</span>
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
                if (selectedCampaignId && isMaster) {
                  void createCampaignInvite()
                } else {
                  setActivePage('campaigns')
                }
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
            .page-content.page-sheets > * { display: none !important; }
            .page-content.page-sheets > .sheet-page-panel { display: block !important; }
            .page-content.page-characters > * { display: none !important; }
            .page-content.page-characters > .characters-page-panel { display: block !important; }
            .page-content.page-campaigns > * { display: none !important; }
            .page-content.page-campaigns > .campaigns-page-panel { display: block !important; }
            .page-content.page-inventory > .season-sheet-section { display: none !important; }
          `}</style>
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span /> SUA JORNADA COMEÇA AQUI
              </div>
              <h1>
                {activePage === 'inventory' ? 'Seu inventário' : activePage === 'sheets' ? 'Fichas de personagens' : activePage === 'characters' ? 'Personagens' : 'Campanhas'}<span className="title-period">.</span>
              </h1>
              <p className="page-description">
                {activePage === 'inventory' ? 'Organize os itens e acompanhe a carga do personagem.' : activePage === 'sheets' ? 'Consulte e atualize as fichas por temporada.' : activePage === 'characters' ? 'Crie personagens e gerencie quem pode acessá-los.' : 'Organize suas campanhas e escolha qual deseja administrar.'}
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
                {characters.length === 0 ? <div className="empty-state"><h3>Nenhum personagem nesta campanha</h3><p>Crie um personagem antes de montar sua ficha.</p><button className="primary-button" onClick={() => { setActivePage('characters'); setShowCharacterForm(true) }}>Criar personagem</button></div> : <div className="item-grid">{characters.map(character => <article className="item-card" key={character.id}><div className="item-art">▧</div><div className="item-category">NÍVEL {character.level}</div><h3>{character.name}</h3><p className="item-description">{character.archetype || 'Arquétipo não definido'}</p><button className="primary-button" onClick={() => { setSelectedCharacterId(character.id); setSheetCharacterView(true) }}>Abrir ficha</button></article>)}</div>}
              </> : <>
                <div className="inventory-heading"><div><h2>Ficha de {selectedCharacter?.name ?? 'personagem'}</h2><p>{selectedCampaign?.name} · Kisatsutai RPG</p></div><button className="secondary-button" onClick={() => setSheetCharacterView(false)}>← Lista de personagens</button></div>
                <label style={labelStyle}>Temporada<select value={selectedSeasonId} onChange={e => setSelectedSeasonId(e.target.value)} style={inputStyle}><option value="">Selecione uma temporada</option>{seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name} ({season.status})</option>)}</select></label>
                {isMaster && selectedSeasonId && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,margin:'12px 0'}}><label style={labelStyle}>Nome da temporada<input value={seasonNameDraft} onChange={e=>setSeasonNameDraft(e.target.value)} style={inputStyle}/></label><label style={labelStyle}>Descrição<input value={seasonDescriptionDraft} onChange={e=>setSeasonDescriptionDraft(e.target.value)} style={inputStyle}/></label><button className="primary-button" type="button" onClick={()=>void saveSeasonDetails()}>Salvar detalhes da temporada</button><label style={labelStyle}>Status<select value={seasons.find(s=>s.id===selectedSeasonId)?.status ?? 'draft'} onChange={e=>void changeSeasonStatus(e.target.value as Season['status'])} style={inputStyle}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="completed">Concluída</option><option value="archived">Arquivada</option></select></label></div>}
                {selectedSeasonId && <div className="season-theme-panel">
                  <div className="season-theme-heading"><div><strong>Identidade visual</strong><small>Tema desta temporada: <b>{activeTheme.label}</b></small></div><span className="season-theme-current-swatch" style={{background:`linear-gradient(135deg,${activeTheme.primary},${activeTheme.secondary})`}} /></div>
                  {isMaster ? <div className="season-theme-options">{(Object.entries(seasonThemes) as [keyof typeof seasonThemes, typeof seasonThemes[keyof typeof seasonThemes]][]).map(([key,theme])=><button key={key} type="button" disabled={seasonThemeSaving} onClick={()=>void saveSeasonTheme(key)} className={`season-theme-option ${activeThemeKey===key?'active':''}`}><span className="season-theme-swatches"><i style={{background:theme.primary}}/><i style={{background:theme.secondary}}/></span><span>{theme.label}</span>{activeThemeKey===key&&<b>✓</b>}</button>)}</div> : <small>O mestre escolhe o tema desta temporada.</small>}
                </div>}

                {!selectedSeasonId ? <p>Crie ou selecione uma temporada para editar a ficha.</p> : sheetLoading ? <p>Carregando ficha…</p> : <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',margin:'14px 0'}}>
                    <p style={{color:'var(--season-muted, #b9b4c2)',margin:0}}>Consulte os dados calculados da ficha. As alterações ficam concentradas no modo de edição.</p>
                    {isMaster && <button className="primary-button" type="button" onClick={()=>setEditingSheet(value=>!value)}>{editingSheet?'Fechar edição':'Editar ficha'}</button>}
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
                    const allocationSources = ['family', 'class', 'progression'] as const
                    const familyAllocationKeys = ['strength','agility','defense','breathing','intellect'] as const
                    const allocationKeysFor = (_source: typeof allocationSources[number]) => familyAllocationKeys
                    const allocationLabels: Record<string,string> = {strength:'Força',agility:'Agilidade',defense:'Defesa',breathing:'Respiração',intellect:'Intelecto',vigor:'Vigor',mental:'Mental',combat:'Combate',dexterity:'Destreza',resistance:'Resistência',ability:'Habilidade'}
                    const allocation = (source: string, key: string) => { if (!(familyAllocationKeys as readonly string[]).includes(key)) return 0; return Math.max(0, Math.floor(Number(read(`progression.allocations.${source}.${key}`, 0)) || 0)) }
                    const allocationPool = (source: typeof allocationSources[number]) => source === 'family' ? (isKisatsutaiSheet ? familyTier.points : 0) : source === 'class' ? numRaw('progression.extraAttributePoints') + numRaw('progression.classSkillPoints') : numRaw('progression.attributePoints') + numRaw('progression.skillPoints')
                    const numRaw = (path: string) => { const value = Number(read(path, 0)); return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }
                    const num = (path: string) => {
                      const base = numRaw(path)
                      const match = path.match(/^(attributes|skills)\.(.+)$/)
                      if (!match) return base
                      const key = match[2]
                      const sourceBonus = allocationSources.reduce((sum, source) => sum + allocation(source, key), 0)
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
                    const vigor = Math.min(12, num('skills.vigor'))
                    const mental = Math.min(12, num('skills.mental'))
                    const breathing = effectiveAttribute('attributes.breathing', familyTier.breathing)
                    const ability = Math.min(12, num('skills.ability'))
                    const defense = effectiveAttribute('attributes.defense', familyTier.defense)
                    const reactions = defense + 1
                    const combat = Math.min(12, num('skills.combat'))
                    const resistance = Math.min(12, num('skills.resistance'))
                    const strength = effectiveAttribute('attributes.strength', familyTier.strength)
                    const rankIdForStatus = String(read('progression.rankId', 'zaidan'))
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
                    const panel = (title: string, children: any) => <section style={{padding:16,margin:'14px 0',border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:12,background:'var(--season-bg, var(--season-bg, #100e19))'}}><h3 style={{marginTop:0}}>{title}</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>{children}</div></section>
                    return (
                      editingSheet && isMaster ? (<fieldset
                        disabled={!editingSheet || !isMaster}
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
                          <h3 style={{marginTop:0}}>Progressão, classe e família</h3>
                          <label style={labelStyle}>Sistema de progressão<select value={system} onChange={e=>write('progression.system',e.target.value)} style={inputStyle}><option value="Kisatsutai">Kisatsutai</option><option value="Personalizado">Personalizado</option></select></label>
                          {kisatsutai ? <>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Classe / hierarquia do caçador<select value={rankId} onChange={e=>changeRank(e.target.value)} style={inputStyle}>{KISATSUTAI_RANKS.map(entry=><option key={entry.id} value={entry.id}>{entry.group} · {entry.name}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:12}}>
                              <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><small>FOCO EXIGIDO</small><div style={{fontSize:22,fontWeight:800}}>{rank.focus}</div></div>
                              <div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><small>GRUPO</small><div style={{fontSize:22,fontWeight:800}}>{rank.group}</div></div>
                            </div>
                            <p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}><strong>Referência de benefícios da classe:</strong> {rank.benefits}</p>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:10}}>{field('progression.classSkillPoints','Pontos de perícias da classe')}{field('progression.classFocus','Foco adicional da classe')}{field('progression.extraAttributePoints','Pontos de atributos concedidos pela classe')}</div>
                            <div style={{marginTop:12,padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><strong>Status concedidos pela classe</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}>A classe selecionada adiciona automaticamente os bônus documentados. Para classes sem valores definidos no material, o bônus automático fica em zero até confirmação do mestre.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:10}}>{(['pv','ps','pr'] as const).map(key=><div key={key} style={{padding:10,borderRadius:8,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>{key.toUpperCase()} da classe</small><div style={{fontSize:22,fontWeight:800}}>+{rankStatus[key]}</div></div>)}</div><strong style={{fontSize:12}}>Bônus adicionais personalizados</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:8}}>{field('progression.classStatus.pv','PV adicional')}{field('progression.classStatus.ps','PS adicional')}{field('progression.classStatus.pr','PR adicional')}</div></div>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Tier da família<select value={tierKey} onChange={e=>write('family.tier',e.target.value)} style={inputStyle}>{Object.entries(KISATSUTAI_FAMILY_TIERS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:8,marginTop:10}}>{[['PV',tier.pv],['PS',tier.ps],['PR',tier.pr],['Força',tier.strength],['Agilidade',tier.agility],['Defesa',tier.defense],['Respiração',tier.breathing],['Intelecto',tier.intellect],['Pontos base da família',tier.points],['Foco',tier.focus]].map(([label,value])=><div key={String(label)} style={{padding:9,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:8,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small style={{color:'var(--season-muted, #b9b4c2)'}}>{label}</small><div style={{fontSize:19,fontWeight:800}}>{value}</div></div>)}</div>
                            <div style={{marginTop:14,padding:16,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:14,background:'linear-gradient(145deg,var(--season-surface-alt, var(--season-surface-alt, #211c31)) 0%,var(--season-surface, var(--season-bg, #100e19)) 100%)',boxShadow:'0 8px 24px rgba(0,0,0,.16)'}}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><strong style={{fontSize:15}}>Pontos da família</strong><div style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',marginTop:3}}>Distribuição entre os cinco atributos principais</div></div><span style={{padding:'5px 10px',borderRadius:999,background:'var(--season-line, var(--season-surface-alt, #211c31))',color:'var(--season-on-primary, var(--season-bg, #100e19))',fontSize:11,fontWeight:700}}>TIER {tierKey}</span></div>
                              {(()=>{const total=allocationPool('family');const spent=familyAllocationKeys.reduce((sum,key)=>sum+allocation('family',key),0);const remaining=Math.max(0,total-spent);const percent=total>0?Math.min(100,spent/total*100):0;return <><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9,marginTop:14}}>{[['Total',total],['Usados',spent],['Disponíveis',remaining]].map(([label,value],i)=><div key={String(label)} style={{padding:'11px 12px',borderRadius:10,background:i===2?'rgba(91,170,133,.13)':'rgba(255,255,255,.045)',border:'1px solid '+(i===2?'rgba(111,194,151,.35)':'var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 14%, transparent))')}}><small style={{color:'var(--season-muted, #b9b4c2)',fontSize:11}}>{label}</small><div style={{fontSize:25,fontWeight:800,lineHeight:1.25,marginTop:2,color:i===2?'#9de0b8':'#fff'}}>{value}</div></div>)}</div><div style={{height:7,background:'rgba(255,255,255,.09)',borderRadius:99,overflow:'hidden',marginTop:12}}><div style={{height:'100%',width:percent+'%',background:'linear-gradient(90deg,var(--season-secondary, var(--season-muted, #b9b4c2)),#70c49b)',borderRadius:99,transition:'width .2s'}}/></div></>})()}
                              <small style={{display:'block',marginTop:10,color:'var(--season-muted, #b9b4c2)',lineHeight:1.5}}>Os pontos distribuíveis de Família, Classe e Progressão só podem ser alocados em FOR, AGI, DEF, RES e INT.</small>
                            </div>
                            <div style={{marginTop:16,padding:18,border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 24%, transparent))',borderRadius:18,background:'linear-gradient(150deg,var(--season-surface-alt, var(--season-surface-alt, #211c31)),var(--season-surface, var(--season-bg, #100e19)))',boxShadow:'0 14px 34px rgba(0,0,0,.18)'}}>
                              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:16}}><div style={{width:38,height:38,flex:'0 0 38px',display:'grid',placeItems:'center',borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 18%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 25%, transparent))',fontSize:18}}>✦</div><div><div style={{fontSize:10,letterSpacing:1.5,fontWeight:800,color:'var(--season-primary, var(--season-primary, #b49aff))',textTransform:'uppercase'}}>Desenvolvimento</div><strong style={{display:'block',fontSize:17,marginTop:2}}>Distribuição de pontos</strong><p style={{fontSize:12,color:'var(--season-muted, #b9b4c2)',margin:'4px 0 0',lineHeight:1.5}}>Gerencie separadamente os pontos recebidos por cada origem.</p></div></div>
                              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
                              {allocationSources.map(source=>{const pool=allocationPool(source);const sourceKeys=allocationKeysFor(source);const spent=sourceKeys.reduce((sum,key)=>sum+allocation(source,key),0);const remaining=pool-spent;const percent=pool>0?Math.min(100,spent/pool*100):0;const sourceName=source==='family'?'Família':source==='class'?'Classe':'Progressão';const accent=source==='family'?'var(--season-primary, var(--season-primary, #b49aff))':source==='class'?'#8fb8d8':'#91c9ad';return <div key={source} style={{minWidth:0,padding:14,border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 18%, transparent))',borderRadius:14,background:'linear-gradient(155deg,rgba(255,255,255,.055),rgba(255,255,255,.018))'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:99,background:accent,boxShadow:'0 0 12px var(--season-glow)'}}/><strong style={{fontSize:14}}>{sourceName}</strong></div><span style={{fontSize:11,color:remaining>0?'#a8dfbd':'var(--season-muted, #b9b4c2)',fontWeight:700}}>{remaining} livres</span></div><div style={{display:'flex',alignItems:'baseline',gap:5,marginTop:13}}><strong style={{fontSize:27,lineHeight:1,color:'#fff'}}>{spent}</strong><span style={{fontSize:12,color:'var(--season-muted, #b9b4c2)'}}> / {pool} pontos usados</span></div><div style={{height:6,background:'rgba(255,255,255,.09)',borderRadius:99,overflow:'hidden',marginTop:10}}><div style={{height:'100%',width:percent+'%',background:`linear-gradient(90deg,${accent},${accent}bb)`,borderRadius:99,transition:'width .2s'}}/></div><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:9,marginTop:14}}>{sourceKeys.map(key=>{const isSkill=['vigor','mental','combat','dexterity','resistance','ability'].includes(key);const base=numRaw(`${isSkill?'skills':'attributes'}.${key}`);const other=allocationSources.filter(item=>item!==source).reduce((sum,item)=>sum+allocation(item,key),0);const max=Math.max(0,(isSkill?12:5)-base-other);return <label key={key} style={{...labelStyle,fontSize:11,display:'flex',flexDirection:'column',gap:6,margin:0,padding:'9px 10px',borderRadius:10,background:'color-mix(in srgb, var(--season-surface-alt, #211c31) 28%, transparent)',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 12%, transparent))'}}><span style={{color:'var(--season-muted, #b9b4c2)',fontWeight:650}}>{allocationLabels[key]}</span><input type="number" min="0" max={Math.min(max,Math.max(0,pool-spent+allocation(source,key)))} value={allocation(source,key)} onChange={e=>{const wanted=Math.max(0,Math.min(Math.floor(Number(e.target.value)||0),max,pool-spent+allocation(source,key)));write(`progression.allocations.${source}.${key}`,wanted)}} style={{...inputStyle,margin:0,padding:'8px 9px',fontSize:15,fontWeight:700,borderRadius:8}}/></label>})}</div></div>})}
                              </div>
                              <div style={{marginTop:14,padding:13,borderRadius:12,background:'var(--season-glow, color-mix(in srgb, var(--season-primary, #b49aff) 9%, transparent))',border:'1px solid var(--season-line-soft, color-mix(in srgb, var(--season-primary, #b49aff) 16%, transparent))'}}><div style={{fontSize:11,fontWeight:800,letterSpacing:1,color:'var(--season-primary, var(--season-primary, #b49aff))',textTransform:'uppercase',marginBottom:9}}>Pontos de perícia da progressão</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>{field('progression.skillPoints','Pontos de perícias da progressão')}{field('progression.attributePoints','Pontos de atributos da progressão')}</div></div>
                            </div>
                            <div style={{marginTop:12,padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10}}><strong>Benefícios por grupo</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:8}}>{field('progression.damageBase','Dano base da classe','text')}{field('progression.unlockedFlows','Fluxos desbloqueados','text')}{field('progression.formLevels','Níveis de formas','text')}</div><small style={{color:'var(--season-muted, #b9b4c2)'}}>Registre separadamente dano base, fluxos e níveis de formas. Esses campos não alteram automaticamente outros valores.</small></div>
                            <p style={{color:'var(--season-muted, #b9b4c2)',fontSize:12}}>Os benefícios de classe são referências totais do material. Preencha os bônus de status acima apenas quando confirmar os valores aplicáveis ao personagem; não some novamente benefícios já incorporados.</p>
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
                      {panel('1. Identidade', <>{field('identity.name','Nome','text')}{field('identity.sex','Sexo','text')}{field('identity.family','Família','text')}{field('identity.age','Idade')}{field('identity.height','Altura','text')}{field('identity.weight','Peso','text')}{field('identity.primaryArchetype','Arquétipo primário','text')}{field('identity.secondaryArchetype','Arquétipo secundário','text')}{field('identity.path','Caminho','text')}{field('identity.breathing','Respiração','text')}{area('identity.appearance','Aparência')}{area('identity.beliefs','Crenças')}{area('identity.lore','História / lore')}</>)}
                      {panel('2. Status', <>{derived.map(([label,value,hint])=><div key={label} style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small style={{color:'var(--season-muted, #b9b4c2)'}}>{label.toUpperCase()}</small><div style={{fontSize:26,fontWeight:800}}>{value}</div><small style={{color:'var(--season-muted, #b9b4c2)'}}>{hint}</small></div>)}</>)}
                      <div style={{padding:16,margin:'14px 0',border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:12,background:'var(--season-bg, var(--season-bg, #100e19))'}}><h3 style={{marginTop:0}}>3. Atributos</h3><p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}>Valores-base do personagem. A Força é sincronizada com a capacidade de carga do inventário.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12}}>{field('attributes.strength','Força','number','Efetivo com família: '+strength+' · Capacidade: '+(10+2*strength)+' kg')}{field('attributes.agility','Agilidade','number','A cada 2 pontos: 1 Ação de Movimento; ímpar concede 1 Ação Extra.')}{field('attributes.defense','Defesa','number','Efetivo com família: '+defense+' · Cada ponto concede 1 Reação.')}{field('attributes.breathing','Respiração','number','Efetivo com família: '+breathing+' · Cada ponto concede +10 PR.')}{field('attributes.intellect','Intelecto','number','Efetivo com família: '+intellect+' · Cada ponto concede uma escolha de desenvolvimento.')}</div><div style={{marginTop:12,padding:12,borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))',color:'#eee'}}><strong>Capacidade de carga: {10+2*strength} kg</strong></div></div>
                      <div style={{padding:16,margin:'14px 0',border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:12,background:'var(--season-bg, var(--season-bg, #100e19))'}}><h3 style={{marginTop:0}}>4. Perícias</h3><p style={{color:'var(--season-muted, #b9b4c2)',fontSize:13}}>Cada ponto de Vigor concede +10 PV; Mental concede +10 PS; Habilidade concede +10 PR. Combate é usado nos ataques corpo a corpo e Destreza na esquiva.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{field('skills.vigor','Vigor')}{field('skills.mental','Mental')}{field('skills.combat','Combate')}{field('skills.dexterity','Destreza')}{field('skills.resistance','Resistência')}{field('skills.ability','Habilidade')}</div><div style={{marginTop:16,padding:14,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><strong>Desenvolvimento por Intelecto</strong><p style={{fontSize:13,color:'var(--season-muted, #b9b4c2)'}}>Para cada ponto de Intelecto, escolha entre receber 5 pontos para distribuir nas perícias principais ou evoluir um nível de treinamento em uma perícia extra.</p>{Array.from({length:intellect},(_,i)=><label key={i} style={{...labelStyle,display:'grid',gridTemplateColumns:'90px 1fr',alignItems:'center',gap:10,marginTop:8}}>Ponto {i+1}<select value={mainAllocations[i]} onChange={e=>{const next=[...mainAllocations];next[i]=e.target.value as 'main' | 'extra';write('skills.intelligenceChoices',next)}} style={inputStyle}><option value="main">5 pontos em perícias principais</option><option value="extra">+1 nível em perícia extra</option></select></label>)}<div style={{marginTop:10,color:'#eee'}}>Pontos para perícias principais: <strong>{mainPoints}</strong> · Níveis de treinamento extra: <strong>{extraLevels}</strong></div></div>{area('skills.main','Distribuição das perícias principais')}{area('skills.extra','Perícias extras')}{area('skills.training','Detalhes dos treinamentos')}</div>
                      <div style={{padding:16,margin:'14px 0',border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:12,background:'var(--season-bg, var(--season-bg, #100e19))'}}><h3 style={{marginTop:0}}>5. Combate</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{field('combat.baseDamage','Dano base')}{field('combat.extraDamage','Dano extra')}{field('combat.armor','Armadura')}{field('combat.mentalArmor','Armadura Mental')}{field('combat.essence','Essência')}{field('combat.critical','Crítico','text')}<div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>DESLOCAMENTO</small><div style={{fontSize:24,fontWeight:800}}>{movementActions*dexterity}</div><small>Ações de Movimento × Destreza</small></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>AÇÕES DE MOVIMENTO</small><div style={{fontSize:24,fontWeight:800}}>{movementActions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>AÇÕES EXTRAS</small><div style={{fontSize:24,fontWeight:800}}>{extraActions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>REAÇÕES</small><div style={{fontSize:24,fontWeight:800}}>{reactions}</div></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>CONTRA-ATAQUE</small><div style={{fontSize:24,fontWeight:800}}>{combat+dexterity}</div><small>Combate + Destreza</small></div><div style={{padding:12,border:'1px solid var(--season-line, var(--season-surface-alt, #211c31))',borderRadius:10,background:'var(--season-surface-alt, var(--season-surface-alt, #211c31))'}}><small>CONSTITUIÇÃO</small><div style={{fontSize:24,fontWeight:800}}>{resistance+vigor}</div><small>Resistência + Vigor</small></div></div>{area('combat.actions','Observações de ações e regras de combate')}</div>
                      {panel('6. Fluxos', <>{area('flows.details','Fluxos desbloqueados e detalhes')}</>)}
                      {panel('7. Habilidades & Respirações', <>{area('abilities.archetype','Habilidades do arquétipo')}{area('abilities.path','Habilidades do caminho')}{area('abilities.conditions','Condições')}{field('breathing.type','Tipo de respiração','text')}{area('breathing.forms','Formas de respiração')}{area('breathing.concentration','Técnica de concentração')}</>)}
                      {panel('Anotações', area('notes','Anotações gerais'))}
                      </fieldset>) : (<section className="character-sheet-summary">
                        <header className="sheet-summary-header">
                          <div className="sheet-summary-identity"><span className="sheet-eyebrow">FICHA DE PERSONAGEM</span><h2>{String(read('identity.name', selectedCharacter?.name || 'Personagem'))}</h2><p>{String(read('identity.family', 'Família não definida'))} · {String(read('identity.primaryArchetype', selectedCharacter?.archetype || 'Arquétipo não definido'))}</p></div>
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
                            if (!isMaster) return
                            const next = { ...data, status: { ...(data.status || {}), current: { ...((data.status || {}).current || {}), [key]: Math.max(0, key === 'pv' ? current + delta : Math.min(value, current + delta)) } } }
                            setSheetDraft(JSON.stringify(next, null, 2))
                          }
                          const applyTypedAdjustment = () => {
                            const raw = (statusAdjustments[key] ?? '').trim()
                            if (!/^[+-]\d+$/.test(raw) || Number(raw) === 0) {
                              setError('Digite um valor inteiro com sinal, como +10 ou -10.')
                              return
                            }
                            adjust(Number(raw))
                            setError('')
                            setNotice(`${key.toUpperCase()} ajustado em ${raw}. Clique em “Salvar status” para confirmar.`)
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
                              {isMaster && <div style={{display:'flex',gap:6}}>
                                <button type="button" aria-label={`Diminuir ${key.toUpperCase()}`} disabled={current <= 0} onClick={()=>adjust(-1)} style={{width:32,height:30,borderRadius:9,border:'1px solid rgba(255,255,255,.16)',background:'rgba(255,255,255,.07)',color:'inherit',fontSize:19,cursor:current<=0?'not-allowed':'pointer',opacity: current <= 0 ? 0.4 : 1}}>−</button>
                                <button type="button" aria-label={`Aumentar ${key.toUpperCase()}`} disabled={key !== 'pv' && current >= value} onClick={()=>adjust(1)} style={{width:32,height:30,borderRadius:9,border:'1px solid '+colors.accent,background:colors.glow,color:'inherit',fontSize:19,cursor:key !== 'pv' && current>=value?'not-allowed':'pointer',opacity: key !== 'pv' && current >= value ? 0.4 : 1}}>+</button>
                              </div>}
                            </div>
                            {isMaster && <div style={{display:'flex',gap:7,marginTop:10}}>
                              <input type="text" inputMode="numeric" aria-label={`Ajuste de ${key.toUpperCase()}`} value={statusAdjustments[key] ?? ''} onChange={event=>setStatusAdjustments(previous=>({...previous,[key]:event.target.value}))} onKeyDown={event=>{if(event.key==='Enter')applyTypedAdjustment()}} placeholder="+10 ou -10" style={{minWidth:0,width:'100%',padding:'8px 10px',borderRadius:9,border:'1px solid rgba(255,255,255,.18)',background:'rgba(0,0,0,.2)',color:'inherit',font:'inherit'}} />
                              <button type="button" onClick={applyTypedAdjustment} style={{whiteSpace:'nowrap',padding:'7px 11px',borderRadius:9,border:'1px solid '+colors.accent,background:colors.glow,color:'inherit',fontWeight:700,cursor:'pointer'}}>Aplicar</button>
                            </div>}
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
                                if (isMaster && applied > 0) {
                                  const next = { ...data, status: { ...(data.status || {}), current: { ...((data.status || {}).current || {}), pr: current + applied } } }
                                  setSheetDraft(JSON.stringify(next, null, 2))
                                  setNotice(`Teste de Respiração: ${success ? 'sucesso' : 'falha'}. ${applied} PR recuperados no rascunho; salve os status para confirmar.`)
                                }
                              }
                              return <div style={{marginTop:12,padding:12,borderRadius:10,background:'rgba(117,201,238,.08)',border:'1px solid rgba(117,201,238,.22)'}}>
                                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong style={{fontSize:13}}>Teste de Respiração · {group}</strong><small style={{opacity:.75}}>{group === 'Carpa' ? 'Sem teste' : `DT ${dt}`}</small></div>
                                {group === 'Carpa' ? <small style={{display:'block',marginTop:7,opacity:.8}}>Este grupo não realiza o teste de Respiração.</small> : <>
                                  <small style={{display:'block',marginTop:5,opacity:.8}}>{1 + breathing}d20 · maior resultado + Vigor ({vigor})</small>
                                  <button type="button" onClick={runBreathingTest} style={{marginTop:9,padding:'8px 12px',borderRadius:9,border:'1px solid rgba(117,201,238,.55)',background:'rgba(117,201,238,.16)',color:'inherit',fontWeight:700,cursor:'pointer'}}>Rolar teste</button>
                                  {breathingTestResult && breathingTestResult.group === group && <div style={{marginTop:9,fontSize:13}}><div>Dados: {breathingTestResult.rolls.join(' · ')} → maior: <strong>{breathingTestResult.best}</strong></div><div>Resultado: <strong>{breathingTestResult.best} + {vigor} = {breathingTestResult.total}</strong> / DT {breathingTestResult.dt} — <strong style={{color:breathingTestResult.success?'#8de0a5':'#f0a0a0'}}>{breathingTestResult.success?'Sucesso':'Falha'}</strong></div><div>Recuperação: {breathingTestResult.recovery} PR ({breathingTestResult.success?'¼':'⅛'} do máximo) · aplicado: <strong>{breathingTestResult.applied} PR</strong></div>{isMaster && <small style={{opacity:.75}}>O valor aplicado fica no rascunho. Use “Salvar status” para confirmar.</small>}</div>}
                                </>}
                              </div>
                            })()}
                          </article>
                        })}</div>
                        {isMaster && <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}><button className="primary-button" type="button" disabled={sheetSaving} onClick={()=>void saveCharacterSheet()}>{sheetSaving?'Salvando…':'Salvar status'}</button></div>}
                        <div className="sheet-summary-attributes">{[['Força',strength],['Agilidade',agility],['Defesa',defense],['Respiração',breathing],['Intelecto',intellect]].map(([label,value])=><article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
                        <div className="sheet-summary-grid">
                          <article className="sheet-summary-card"><h3>Perícias</h3><div className="sheet-summary-values">{[['Vigor',vigor],['Mental',mental],['Combate',combat],['Destreza',dexterity],['Resistência',resistance],['Habilidade',ability]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div></article>
                          <article className="sheet-summary-card"><h3>Combate</h3><div className="sheet-summary-values">{[['Dano base',read('combat.baseDamage','—')],['Dano extra',read('combat.extraDamage','—')],['Deslocamento',movementActions*dexterity],['Ações',movementActions+extraActions],['Reações',reactions],['Contra-ataque',combat+dexterity],['Constituição',resistance+vigor]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div></article>
                        </div>
                        <div className="sheet-summary-notes"><h3>Resumo do personagem</h3><p>{String(read('identity.appearance','Aparência não registrada'))}</p><p>{String(read('identity.beliefs',''))}</p><p>{String(read('identity.lore',''))}</p></div>
                        <p className="sheet-summary-hint">Esta é uma visão resumida. {isMaster ? 'Clique em “Editar ficha” para acessar todos os campos e detalhes.' : 'Somente o mestre pode editar a ficha.'}</p>
                      </section>)
                    )

                  })()}
                  {editingSheet && isMaster && <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button className="primary-button" type="button" disabled={sheetSaving} onClick={()=>void saveCharacterSheet()}>{sheetSaving?'Salvando…':'Salvar ficha'}</button><button className="secondary-button" type="button" disabled={!sheet} onClick={()=>void createSheetMilestone()}>Registrar marco no histórico</button></div>}
                </>}
              </>}
            </section>
          )}
          {activePage === 'characters' && selectedCampaignId && <section className="inventory-section characters-page-panel"><div className="inventory-heading"><div><h2>Personagens</h2><p>Personagens da campanha selecionada.</p></div><button className="primary-button" onClick={()=>setShowCharacterForm(true)}>+ Novo personagem</button></div>{showCharacterForm&&<form className="add-form" onSubmit={createCharacter}><label>Nome<input value={characterName} onChange={e=>setCharacterName(e.target.value)} required style={inputStyle}/></label><label>Arquétipo<input value={archetype} onChange={e=>setArchetype(e.target.value)} style={inputStyle}/></label>{!String(selectedCampaign?.system_name||'').toLowerCase().includes('kisatsutai')&&<label>Nível<input type="number" min="1" max="999" value={characterLevel} onChange={e=>setCharacterLevel(e.target.value)} style={inputStyle}/></label>}<button className="primary-button" type="submit" disabled={loading}>Salvar personagem</button></form>}<div className="item-grid">{characters.map(character=><article className="item-card" key={character.id}><h3>{character.name}</h3><p>{character.archetype||'Arquétipo não definido'} · Nível {character.level}</p><button className="primary-button" onClick={()=>{setSelectedCharacterId(character.id);setActivePage('sheets');setSheetCharacterView(true)}}>Abrir ficha</button></article>)}</div></section>}
          {activePage === 'campaigns' && <section className="inventory-section campaigns-page-panel"><h2>Campanhas</h2>
            {inviteCode && <form className="add-form" onSubmit={joinCampaignWithInvite}><h3>Entrar com convite</h3><p>Um convite foi detectado no link. Confirme o código para entrar na campanha.</p><label>Código do convite<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required style={inputStyle}/></label><button className="primary-button" type="submit" disabled={inviteLoading}>{inviteLoading?'Entrando…':'Entrar na campanha'}</button></form>}
            <form className="add-form" onSubmit={joinCampaignWithInvite}><h3>Tenho um convite</h3><label>Código ou token<input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} required style={inputStyle} placeholder="Cole aqui o código recebido"/></label><button className="secondary-button" type="submit" disabled={inviteLoading || !inviteCode.trim()}>Usar convite</button></form>
            {showCampaignForm&&<form className="add-form" onSubmit={createCampaign}><label>Nome<input value={campaignName} onChange={e=>setCampaignName(e.target.value)} required style={inputStyle}/></label><label>Sistema<input value={systemName} onChange={e=>setSystemName(e.target.value)} style={inputStyle}/></label><label>Descrição<input value={campaignDescription} onChange={e=>setCampaignDescription(e.target.value)} style={inputStyle}/></label><button className="primary-button" type="submit" disabled={loading}>Criar campanha</button></form>}
            <div className="item-grid">{campaigns.map(campaign=><article className="item-card" key={campaign.id}><h3>{campaign.name}</h3><p>{campaign.system_name||'Sistema não definido'}</p><button className="primary-button" onClick={()=>{setSelectedCampaignId(campaign.id);setActivePage('inventory')}}>Selecionar campanha</button></article>)}</div>
            {selectedCampaign && isMaster && <div className="add-form" style={{marginTop:20}}><h3>Convites de campanha</h3><p>Gere um link para convidar jogadores para <strong>{selectedCampaign.name}</strong>.</p><button type="button" className="primary-button" onClick={()=>void createCampaignInvite()} disabled={inviteLoading}>{inviteLoading?'Gerando…':'Gerar convite'}</button>{campaignInviteLink&&<label>Link para compartilhar<input readOnly value={campaignInviteLink} onFocus={e=>e.currentTarget.select()} style={inputStyle}/><button type="button" className="secondary-button" onClick={()=>{void navigator.clipboard.writeText(campaignInviteLink);setNotice('Link copiado!')}}>Copiar link</button></label>}</div>}
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
                      <label>
                        Classe ou arquétipo
                        <input
                          value={archetype}
                          onChange={(event) => setArchetype(event.target.value)}
                          placeholder="Ex.: Andarilho"
                          maxLength={100}
                        />
                      </label>

                      {!String(selectedCampaign?.system_name||'').toLowerCase().includes('kisatsutai') && <label>
                        Nível
                        <input type="number" min="1" max="999" value={characterLevel} onChange={(event) => setCharacterLevel(event.target.value)} required />
                      </label>}
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
                        <div className="item-art">♙</div>
                        <div className="item-category">
                          NÍVEL {character.level}
                        </div>
                        <h3>{character.name}</h3>
                        <p className="item-description">
                          {character.archetype || 'Arquétipo não definido'}
                        </p>
                        <small style={{ display: 'block', color: 'var(--season-muted, #b9b4c2)', margin: '8px 0' }}>
                          {character.visibility === 'campaign' ? '🌐 Toda a campanha' : character.visibility === 'selected' ? '👥 Jogadores selecionados' : '🔒 Privado'}
                        </small>
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
                      <span> · </span>
                      Nível {selectedCharacter.level}
                    </p>
                  </div>

                  {isMaster && (
                    <div style={{ minWidth: 220, padding: '12px', border: '1px solid var(--season-line, var(--season-surface-alt, #211c31))', borderRadius: 10, background: 'var(--season-bg, var(--season-bg, #100e19))' }}>
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

              <section className="inventory-section" id="inventario">
                <div className="inventory-heading">
                  <div>
                    <h2>Mochila</h2>
                    <p>
                      {selectedCharacter
                        ? `Pertences de ${selectedCharacter.name}.`
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

                {showItemForm && selectedCharacterId && (
                  <form className="add-form" onSubmit={createItem}>
                    <div className="form-heading">
                      <div>
                        <h3>{editingItem ? 'Editar item' : 'Novo item'}</h3>
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
                          Emoji selecionado: <span>{newItemEmoji}</span>
                        </p>
                      </div>

                      <label>
                        Categoria
                        <select
                          value={newItemCategory}
                          onChange={(event) =>
                            setNewItemCategory(event.target.value)
                          }
                        >
                          {categories
                            .filter((category) => category !== 'Todos')
                            .map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                        </select>
                      </label>

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
                          onChange={(event) =>
                            setNewItemWeight(event.target.value)
                          }
                          required
                        />
                      </label>
                    </div>

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
                      <article className="item-card" key={item.id}>
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
                              onClick={() => startEditingItem(item)}
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              className="item-menu"
                              onClick={() => void removeItem(item)}
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

                        <div className="item-footer">
                          <span>
                            ⚖ {Number(item.weight).toFixed(1)} kg / un.
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
            </>
          )}

          {loading && <p role="status">Salvando ou carregando...</p>}

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
