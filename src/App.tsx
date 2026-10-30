
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

type Season = { id: string; campaign_id: string; name: string; description: string | null; season_number: number; status: 'draft' | 'active' | 'completed' | 'archived' }
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
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonDescription, setNewSeasonDescription] = useState('')
  const [copyPreviousSheet, setCopyPreviousSheet] = useState(true)
  const [sheet, setSheet] = useState<CharacterSheet | null>(null)
  const [sheetDraft, setSheetDraft] = useState('{}')
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetSaving, setSheetSaving] = useState(false)

  const [activePage, setActivePage] = useState<'inventory' | 'sheets' | 'characters' | 'campaigns'>('inventory')
  const [sheetCharacterView, setSheetCharacterView] = useState(false)

  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showCharacterForm, setShowCharacterForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)

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
      const { data, error: seasonsError } = await supabase.from('campaign_seasons').select('id,campaign_id,name,description,season_number,status').eq('campaign_id', selectedCampaignId).order('season_number', { ascending: true })
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
    if (!selectedCampaignId || !isMaster || inviteLoading) return
    setInviteLoading(true); setError(''); setNotice('')
    const { data, error: inviteError } = await supabase.rpc('create_campaign_invite', { p_campaign_id: selectedCampaignId })
    if (inviteError || !data) {
      setError(`Não foi possível gerar o convite: ${inviteError?.message ?? 'resposta vazia'}`)
      setInviteLoading(false)
      return
    }
    const token = typeof data === 'string' ? data : String(data)
    const link = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`
    setCampaignInviteLink(link)
    setNotice('Convite criado. Copie o link e compartilhe com os jogadores.')
    setInviteLoading(false)
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
    const { data: created, error: createError } = await supabase.from('campaign_seasons').insert({ campaign_id: selectedCampaignId, name: newSeasonName.trim(), description: newSeasonDescription.trim() || null, season_number: nextNumber, status: seasons.some(season => season.status === 'active') ? 'draft' : 'active', created_by: session!.user.id }).select('id,campaign_id,name,description,season_number,status').single()
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

  async function saveSeasonDetails() {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster || !seasonNameDraft.trim()) return
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ name: seasonNameDraft.trim(), description: seasonDescriptionDraft.trim() || null }).eq('id', season.id).select('id,campaign_id,name,description,season_number,status').single()
    if (updateError || !data) { setError(`Não foi possível atualizar a temporada: ${updateError?.message ?? 'resposta vazia'}`); return }
    setSeasons(current => current.map(entry => entry.id === season.id ? data as Season : entry)); setNotice('Dados da temporada atualizados.')
  }

  async function changeSeasonStatus(status: Season['status']) {
    const season = seasons.find(entry => entry.id === selectedSeasonId)
    if (!season || !isMaster) return
    if (status === 'active' && seasons.some(entry => entry.status === 'active' && entry.id !== season.id)) { setError('Já existe uma temporada ativa. Conclua ou arquive a atual antes de ativar outra.'); return }
    const { data, error: updateError } = await supabase.from('campaign_seasons').update({ status }).eq('id', season.id).select('id,campaign_id,name,description,season_number,status').single()
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

    const level = Number(characterLevel)

    if (!Number.isInteger(level) || level < 1 || level > 999) {
      setError('O nível deve ser um número inteiro entre 1 e 999.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: createError } = await supabase
      .from('characters')
      .insert({
        campaign_id: selectedCampaignId,
        user_id: session!.user.id,
        name: characterName.trim(),
        archetype: archetype.trim() || null,
        level,
        strength: 0,
      })
      .select(
        'id, campaign_id, user_id, name, archetype, level, strength, visibility, created_at',
      )
      .single()

    if (createError) {
      setError(`Não foi possível criar o personagem: ${createError.message}`)
      setLoading(false)
      return
    }

    setCharacters((current) => [...current, data as Character])
    setSelectedCharacterId(data.id)
    setCharacterName('')
    setArchetype('')
    setCharacterLevel('1')
    setShowCharacterForm(false)
    setNotice('Personagem criado e salvo!')
    setLoading(false)
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
    <div className="app-shell">
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
          <button className={`nav-link ${activePage === 'campaigns' ? 'active' : ''}`} onClick={() => { setActivePage('campaigns'); setShowCampaignForm(true) }}>
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
              {!sheetCharacterView ? <>
                <div className="inventory-heading"><div><h2>Fichas de personagens</h2><p>Escolha um personagem para abrir sua ficha.</p></div></div>
                {characters.length === 0 ? <div className="empty-state"><h3>Nenhum personagem nesta campanha</h3><p>Crie um personagem antes de montar sua ficha.</p><button className="primary-button" onClick={() => { setActivePage('characters'); setShowCharacterForm(true) }}>Criar personagem</button></div> : <div className="item-grid">{characters.map(character => <article className="item-card" key={character.id}><div className="item-art">▧</div><div className="item-category">NÍVEL {character.level}</div><h3>{character.name}</h3><p className="item-description">{character.archetype || 'Arquétipo não definido'}</p><button className="primary-button" onClick={() => { setSelectedCharacterId(character.id); setSheetCharacterView(true) }}>Abrir ficha</button></article>)}</div>}
              </> : <>
                <div className="inventory-heading"><div><h2>Ficha de {selectedCharacter?.name ?? 'personagem'}</h2><p>{selectedCampaign?.name} · Kisatsutai RPG</p></div><button className="secondary-button" onClick={() => setSheetCharacterView(false)}>← Lista de personagens</button></div>
                <label style={labelStyle}>Temporada<select value={selectedSeasonId} onChange={e => setSelectedSeasonId(e.target.value)} style={inputStyle}><option value="">Selecione uma temporada</option>{seasons.map(season => <option key={season.id} value={season.id}>T{season.season_number} · {season.name} ({season.status})</option>)}</select></label>
                {isMaster && selectedSeasonId && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,margin:'12px 0'}}><label style={labelStyle}>Nome da temporada<input value={seasonNameDraft} onChange={e=>setSeasonNameDraft(e.target.value)} style={inputStyle}/></label><label style={labelStyle}>Descrição<input value={seasonDescriptionDraft} onChange={e=>setSeasonDescriptionDraft(e.target.value)} style={inputStyle}/></label><button className="primary-button" type="button" onClick={()=>void saveSeasonDetails()}>Salvar detalhes da temporada</button><label style={labelStyle}>Status<select value={seasons.find(s=>s.id===selectedSeasonId)?.status ?? 'draft'} onChange={e=>void changeSeasonStatus(e.target.value as Season['status'])} style={inputStyle}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="completed">Concluída</option><option value="archived">Arquivada</option></select></label></div>}
                {isMaster && <form onSubmit={createSeason} style={{display:'grid',gap:8,margin:'16px 0',padding:14,border:'1px solid #493568',borderRadius:10}}><h3>Nova temporada</h3><label style={labelStyle}>Nome<input required value={newSeasonName} onChange={e=>setNewSeasonName(e.target.value)} style={inputStyle} placeholder={`Temporada ${seasons.length+1}`}/></label><label style={labelStyle}>Descrição<input value={newSeasonDescription} onChange={e=>setNewSeasonDescription(e.target.value)} style={inputStyle}/></label><label><input type="checkbox" checked={copyPreviousSheet} onChange={e=>setCopyPreviousSheet(e.target.checked)}/> Copiar ficha da temporada selecionada</label><button className="primary-button" type="submit" disabled={loading || !newSeasonName.trim()}>Criar temporada</button></form>}
                {!selectedSeasonId ? <p>Crie ou selecione uma temporada para editar a ficha.</p> : sheetLoading ? <p>Carregando ficha…</p> : <>
                  <p style={{color:'#c9bed8'}}>Ficha organizada por identidade, status, atributos, perícias, combate, fluxos e habilidades. Os valores derivados são calculados automaticamente.</p>
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
                    const num = (path: string) => Math.max(0, Number(read(path, 0)) || 0)
                    const agility = Math.floor(num('attributes.agility'))
                    const movementActions = Math.floor(agility / 2)
                    const extraActions = agility % 2
                    const dexterity = num('skills.dexterity')
                    const intellect = Math.floor(num('attributes.intellect'))
                    const choices: string[] = Array.isArray(read('skills.intelligenceChoices', [])) ? read('skills.intelligenceChoices', []) : []
                    const mainAllocations = Array.from({ length: intellect }, (_, i) => choices[i] === 'extra' ? 'extra' : 'main')
                    const mainPoints = mainAllocations.filter(v => v === 'main').length * 5
                    const extraLevels = mainAllocations.filter(v => v === 'extra').length
                    const vigor = num('skills.vigor')
                    const mental = num('skills.mental')
                    const breathing = num('attributes.breathing')
                    const ability = num('skills.ability')
                    const defense = num('attributes.defense')
                    const combat = num('skills.combat')
                    const resistance = num('skills.resistance')
                    const strength = num('attributes.strength')
                    const derived = [
                      ['Pontos de Vida (PV)', vigor * 10, '10 PV por ponto de Vigor'],
                      ['Pontos de Sanidade (PS)', mental * 10, '10 PS por ponto de Mental'],
                      ['Pontos de Respiração (PR)', (breathing + ability) * 10, '10 PR por ponto de Respiração e Habilidade'],
                    ] as const
                    const field = (path: string, label: string, type: 'number' | 'text' = 'number', hint?: string) => <label key={path} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{label}<input type={type} min={type === 'number' ? 0 : undefined} step="1" value={String(read(path, type === 'number' ? 0 : ''))} onChange={e => write(path, type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value)} style={inputStyle}/>{hint && <small style={{color:'#b9a9d0'}}>{hint}</small>}</label>
                    const area = (path: string, label: string) => <label key={path} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{label}<textarea rows={3} value={String(read(path, ''))} onChange={e=>write(path,e.target.value)} style={{...inputStyle,fontFamily:'inherit',resize:'vertical'}}/></label>
                    const panel = (title: string, children: any) => <section style={{padding:16,margin:'14px 0',border:'1px solid #493568',borderRadius:12,background:'#17131e'}}><h3 style={{marginTop:0}}>{title}</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>{children}</div></section>
                    return <>
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
                          const next = { ...data, progression: { ...(data.progression || {}), rankId: nextId, rankName: nextRank?.name || nextId, promotionLog: [...promotionLog, { id: promotionId, transition, from: oldRank?.name || rankId, to: nextRank?.name || nextId, at: new Date().toISOString(), benefitReference: KISATSUTAI_PROMOTIONS[transition] || 'Benefícios incrementais não definidos no material.', applied: false }] } }
                          setSheetDraft(JSON.stringify(next, null, 2))
                        }
                        return <section style={{padding:16,margin:'14px 0',border:'1px solid #7955a6',borderRadius:12,background:'#1c1626'}}>
                          <h3 style={{marginTop:0}}>Progressão, classe e família</h3>
                          <label style={labelStyle}>Sistema de progressão<select value={system} onChange={e=>write('progression.system',e.target.value)} style={inputStyle}><option value="Kisatsutai">Kisatsutai</option><option value="Personalizado">Personalizado</option></select></label>
                          {kisatsutai ? <>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Classe / hierarquia do caçador<select value={rankId} onChange={e=>changeRank(e.target.value)} style={inputStyle}>{KISATSUTAI_RANKS.map(entry=><option key={entry.id} value={entry.id}>{entry.group} · {entry.name}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10,marginTop:12}}>
                              <div style={{padding:12,border:'1px solid #63428a',borderRadius:10}}><small>FOCO EXIGIDO</small><div style={{fontSize:22,fontWeight:800}}>{rank.focus}</div></div>
                              <div style={{padding:12,border:'1px solid #63428a',borderRadius:10}}><small>GRUPO</small><div style={{fontSize:22,fontWeight:800}}>{rank.group}</div></div>
                            </div>
                            <p style={{color:'#d7c9e7',fontSize:13}}><strong>Referência de benefícios da classe:</strong> {rank.benefits}</p>
                            <p style={{color:'#b9a9d0',fontSize:12}}>Os benefícios listados são referências do material, não são somados automaticamente aos atributos/status para evitar duplicação. Aplique os valores confirmados pelo mestre na ficha.</p>
                            <label style={{...labelStyle,display:'block',marginTop:12}}>Tier da família<select value={tierKey} onChange={e=>write('family.tier',e.target.value)} style={inputStyle}>{Object.entries(KISATSUTAI_FAMILY_TIERS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))',gap:8,marginTop:10}}>{[['PV',tier.pv],['PS',tier.ps],['PR',tier.pr],['Força',tier.strength],['Agilidade',tier.agility],['Defesa',tier.defense],['Respiração',tier.breathing],['Intelecto',tier.intellect],['Pontos livres',tier.points],['Foco',tier.focus]].map(([label,value])=><div key={String(label)} style={{padding:9,border:'1px solid #493568',borderRadius:8,background:'#21182f'}}><small style={{color:'#b9a9d0'}}>{label}</small><div style={{fontSize:19,fontWeight:800}}>{value}</div></div>)}</div>
                            <div style={{marginTop:14}}><strong>Histórico de promoções</strong>{promotionLog.length===0?<p style={{color:'#b9a9d0',fontSize:13}}>Nenhuma promoção registrada nesta ficha.</p>:promotionLog.map((entry:any)=><div key={entry.id} style={{padding:10,marginTop:8,border:'1px solid #493568',borderRadius:8}}><strong>{entry.from} → {entry.to}</strong><div style={{fontSize:12,color:'#b9a9d0'}}>{new Date(entry.at).toLocaleString('pt-BR')} · {entry.applied?'Benefícios marcados como aplicados':'Benefícios pendentes de conferência'}</div><p style={{fontSize:13,marginBottom:0}}>{entry.benefitReference}</p></div>)}</div>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><button className="secondary-button" type="button" onClick={()=>{const updated=promotionLog.map(entry=>({...entry,applied:true}));write('progression.promotionLog',updated);write('progression.appliedPromotionIds',Array.from(new Set([...benefitsApplied,...promotionLog.map(entry=>entry.transition)])))}}>Marcar promoções registradas como conferidas</button></div>
                          </> : <>
                            <p style={{color:'#c9bed8',fontSize:13}}>Progressão genérica: configure o modelo usado por esta campanha sem impor níveis numéricos.</p>
                            {(['model','currentStage','experience','nextRequirement'] as const).map(key=><label key={key} style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>{({model:'Modelo (nível, XP, tier, patente...)',currentStage:'Nível / estágio atual',experience:'Experiência / XP atual',nextRequirement:'Requisito para avançar'} as Record<string,string>)[key]}<input type={key==='experience'?'number':'text'} value={String(read(`progression.${key}`,''))} onChange={e=>write(`progression.${key}`,key==='experience'?Number(e.target.value):e.target.value)} style={inputStyle}/></label>)}
                            <label style={{...labelStyle,display:'flex',flexDirection:'column',gap:6}}>Regras de progressão<textarea rows={3} value={String(read('progression.rules',''))} onChange={e=>write('progression.rules',e.target.value)} style={inputStyle}/></label>
                          </>}
                        </section>
                      })()}
                      {panel('1. Identidade', <>{field('identity.name','Nome','text')}{field('identity.sex','Sexo','text')}{field('identity.family','Família','text')}{field('identity.age','Idade')}{field('identity.height','Altura','text')}{field('identity.weight','Peso','text')}{field('identity.primaryArchetype','Arquétipo primário','text')}{field('identity.secondaryArchetype','Arquétipo secundário','text')}{field('identity.path','Caminho','text')}{field('identity.breathing','Respiração','text')}{field('identity.rank','Classe / patente','text')}{area('identity.appearance','Aparência')}{area('identity.beliefs','Crenças')}{area('identity.lore','História / lore')}</>)}
                      {panel('2. Status', <>{derived.map(([label,value,hint])=><div key={label} style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small style={{color:'#c9bed8'}}>{label.toUpperCase()}</small><div style={{fontSize:26,fontWeight:800}}>{value}</div><small style={{color:'#b9a9d0'}}>{hint}</small></div>)}</>)}
                      <div style={{padding:16,margin:'14px 0',border:'1px solid #493568',borderRadius:12,background:'#17131e'}}><h3 style={{marginTop:0}}>3. Atributos</h3><p style={{color:'#c9bed8',fontSize:13}}>Valores-base do personagem. A Força é sincronizada com a capacidade de carga do inventário.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12}}>{field('attributes.strength','Força','number','Capacidade de carga: '+(10+2*strength)+' kg')}{field('attributes.agility','Agilidade','number','A cada 2 pontos: 1 Ação de Movimento; ímpar concede 1 Ação Extra.')}{field('attributes.defense','Defesa','number','Cada ponto concede 1 Reação.')}{field('attributes.breathing','Respiração','number','Cada ponto concede +10 PR.')}{field('attributes.intellect','Intelecto','number','Cada ponto concede uma escolha de desenvolvimento.')}</div><div style={{marginTop:12,padding:12,borderRadius:10,background:'#21182f',color:'#eee'}}><strong>Capacidade de carga: {10+2*strength} kg</strong></div></div>
                      <div style={{padding:16,margin:'14px 0',border:'1px solid #493568',borderRadius:12,background:'#17131e'}}><h3 style={{marginTop:0}}>4. Perícias</h3><p style={{color:'#c9bed8',fontSize:13}}>Cada ponto de Vigor concede +10 PV; Mental concede +10 PS; Habilidade concede +10 PR. Combate é usado nos ataques corpo a corpo e Destreza na esquiva.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{field('skills.vigor','Vigor')}{field('skills.mental','Mental')}{field('skills.combat','Combate')}{field('skills.dexterity','Destreza')}{field('skills.resistance','Resistência')}{field('skills.ability','Habilidade')}</div><div style={{marginTop:16,padding:14,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><strong>Desenvolvimento por Intelecto</strong><p style={{fontSize:13,color:'#c9bed8'}}>Para cada ponto de Intelecto, escolha entre receber 5 pontos para distribuir nas perícias principais ou evoluir um nível de treinamento em uma perícia extra.</p>{Array.from({length:intellect},(_,i)=><label key={i} style={{...labelStyle,display:'grid',gridTemplateColumns:'90px 1fr',alignItems:'center',gap:10,marginTop:8}}>Ponto {i+1}<select value={mainAllocations[i]} onChange={e=>{const next=[...mainAllocations];next[i]=e.target.value as 'main' | 'extra';write('skills.intelligenceChoices',next)}} style={inputStyle}><option value="main">5 pontos em perícias principais</option><option value="extra">+1 nível em perícia extra</option></select></label>)}<div style={{marginTop:10,color:'#eee'}}>Pontos para perícias principais: <strong>{mainPoints}</strong> · Níveis de treinamento extra: <strong>{extraLevels}</strong></div></div>{area('skills.main','Distribuição das perícias principais')}{area('skills.extra','Perícias extras')}{area('skills.training','Detalhes dos treinamentos')}</div>
                      <div style={{padding:16,margin:'14px 0',border:'1px solid #493568',borderRadius:12,background:'#17131e'}}><h3 style={{marginTop:0}}>5. Combate</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{field('combat.baseDamage','Dano base')}{field('combat.extraDamage','Dano extra')}{field('combat.armor','Armadura')}{field('combat.mentalArmor','Armadura Mental')}{field('combat.essence','Essência')}{field('combat.critical','Crítico','text')}<div style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small>DESLOCAMENTO</small><div style={{fontSize:24,fontWeight:800}}>{movementActions*dexterity}</div><small>Ações de Movimento × Destreza</small></div><div style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small>AÇÕES DE MOVIMENTO</small><div style={{fontSize:24,fontWeight:800}}>{movementActions}</div></div><div style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small>AÇÕES EXTRAS</small><div style={{fontSize:24,fontWeight:800}}>{extraActions}</div></div><div style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small>REAÇÕES</small><div style={{fontSize:24,fontWeight:800}}>{defense}</div></div><div style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small>CONTRA-ATAQUE</small><div style={{fontSize:24,fontWeight:800}}>{combat+dexterity}</div><small>Combate + Destreza</small></div><div style={{padding:12,border:'1px solid #63428a',borderRadius:10,background:'#21182f'}}><small>CONSTITUIÇÃO</small><div style={{fontSize:24,fontWeight:800}}>{resistance+vigor}</div><small>Resistência + Vigor</small></div></div>{area('combat.actions','Observações de ações e regras de combate')}</div>
                      {panel('6. Fluxos', <>{area('attributes.fluxes','Fluxos de atributos')}{area('flows.details','Detalhes dos fluxos')}</>)}
                      {panel('7. Habilidades & Respirações', <>{area('abilities.archetype','Habilidades do arquétipo')}{area('abilities.path','Habilidades do caminho')}{area('abilities.conditions','Condições')}{field('breathing.type','Tipo de respiração','text')}{area('breathing.forms','Formas de respiração')}{area('breathing.concentration','Técnica de concentração')}</>)}
                      {panel('Anotações', area('notes','Anotações gerais'))}
                    </>
                  })()}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="primary-button" type="button" disabled={!isMaster||sheetSaving} onClick={()=>void saveCharacterSheet()}>{sheetSaving?'Salvando…':'Salvar ficha'}</button><button className="secondary-button" type="button" disabled={!isMaster||!sheet} onClick={()=>void createSheetMilestone()}>Registrar marco no histórico</button></div>
                  {!isMaster&&<small>Somente mestres podem editar as fichas nesta versão.</small>}
                </>}
              </>}
            </section>
          )}
          {activePage === 'characters' && selectedCampaignId && <section className="inventory-section characters-page-panel"><div className="inventory-heading"><div><h2>Personagens</h2><p>Personagens da campanha selecionada.</p></div><button className="primary-button" onClick={()=>setShowCharacterForm(true)}>+ Novo personagem</button></div>{showCharacterForm&&<form className="add-form" onSubmit={createCharacter}><label>Nome<input value={characterName} onChange={e=>setCharacterName(e.target.value)} required style={inputStyle}/></label><label>Arquétipo<input value={archetype} onChange={e=>setArchetype(e.target.value)} style={inputStyle}/></label><label>Nível<input type="number" min="1" value={characterLevel} onChange={e=>setCharacterLevel(e.target.value)} style={inputStyle}/></label><button className="primary-button" type="submit" disabled={loading}>Salvar personagem</button></form>}<div className="item-grid">{characters.map(character=><article className="item-card" key={character.id}><h3>{character.name}</h3><p>{character.archetype||'Arquétipo não definido'} · Nível {character.level}</p><button className="primary-button" onClick={()=>{setSelectedCharacterId(character.id);setActivePage('sheets');setSheetCharacterView(true)}}>Abrir ficha</button></article>)}</div></section>}
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

                      <label>
                        Nível
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={characterLevel}
                          onChange={(event) =>
                            setCharacterLevel(event.target.value)
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
                              ? '1px solid #9565dc'
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
                        <small style={{ display: 'block', color: '#c9bed8', margin: '8px 0' }}>
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
                    <div style={{ minWidth: 220, padding: '12px', border: '1px solid #493568', borderRadius: 10, background: '#17131e' }}>
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
                      <small style={{ display: 'block', color: '#c9bed8', lineHeight: 1.5 }}>
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
                            <small style={{ color: '#c9bed8' }}>Não há outros jogadores na campanha.</small>
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
  background: '#0c0b10',
  color: '#f4f0fa',
  fontFamily: 'sans-serif',
} as const

const labelStyle = {
  display: 'block',
  color: '#c9bed8',
  fontSize: '12px',
  marginBottom: '6px',
} as const

const inputStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #493568',
  background: '#17131e',
  color: '#f4f0fa',
  marginBottom: '8px',
} as const

const secondaryButtonStyle = {
  padding: '8px 12px',
  border: '1px solid #493568',
  borderRadius: '8px',
  background: '#21172f',
  color: '#d8c6ff',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '12px',
} as const

export default App
