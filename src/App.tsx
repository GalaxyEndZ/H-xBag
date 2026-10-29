
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
  const [strengthDraft, setStrengthDraft] = useState('0')

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

  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showCharacterForm, setShowCharacterForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)

  const [campaignName, setCampaignName] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [systemName, setSystemName] = useState('')
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  const [characterName, setCharacterName] = useState('')
  const [archetype, setArchetype] = useState('')
  const [characterLevel, setCharacterLevel] = useState('1')
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)

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

  useEffect(() => {
    const character = characters.find(
      (entry) => entry.id === selectedCharacterId,
    )

    setStrengthDraft(String(character?.strength ?? 0))
  }, [selectedCharacterId, characters])

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

  if (!data) {
    setError('Não foi possível criar a campanha: nenhum dado retornado.')
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


  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!session?.user.id) {
      setError('Você precisa estar conectado para criar um personagem.')
      return
    }

    if (!selectedCampaignId) {
      setError('Selecione uma campanha antes de criar um personagem.')
      return
    }

    if (!characterName.trim()) {
      setError('Informe o nome do personagem.')
      return
    }

    const level = Number(characterLevel)

    if (!Number.isInteger(level) || level < 1) {
      setError('O nível precisa ser um número inteiro maior que zero.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: createError } = await supabase
      .from('characters')
      .insert({
        campaign_id: selectedCampaignId,
        user_id: session.user.id,
        name: characterName.trim(),
        archetype: archetype.trim() || null,
        level,
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
    setEditingCharacter(null)
    setShowCharacterForm(false)
    setNotice('Personagem criado e salvo!')
    setLoading(false)
  }

  async function updateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingCampaign || !campaignName.trim()) return

    setLoading(true)
    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('campaigns')
      .update({
        name: campaignName.trim(),
        description: campaignDescription.trim() || null,
        system_name: systemName.trim() || null,
      })
      .eq('id', editingCampaign.id)
      .select('id, name, description, system_name, created_by')
      .maybeSingle()

    if (updateError) {
      setError(`Não foi possível atualizar a campanha: ${updateError.message}`)
      setLoading(false)
      return
    }

    if (!data) {
      setError(
        'A campanha não foi atualizada. Verifique as permissões no Supabase.',
      )
      setLoading(false)
      return
    }

    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === editingCampaign.id
          ? { ...data, role: campaign.role }
          : campaign,
      ),
    )

    setCampaignName('')
    setCampaignDescription('')
    setSystemName('')
    setEditingCampaign(null)
    setShowCampaignForm(false)
    setNotice('Campanha atualizada com sucesso!')
    setLoading(false)
  }


  async function deleteCampaign(campaign: Campaign) {
    if (campaign.role !== 'master') {
      setError('Somente um mestre pode excluir esta campanha.')
      return
    }

    const confirmed = window.confirm(
      `ATENÇÃO: deseja excluir permanentemente a campanha "${campaign.name}"?\n\n` +
      'Personagens, inventários, membros e permissões relacionados também poderão ser excluídos. Esta ação não pode ser desfeita.',
    )

    if (!confirmed) return

    setLoading(true)
    setError('')
    setNotice('')

    const { error: deleteError } = await supabase.rpc(
      'delete_campaign',
      { p_campaign_id: campaign.id },
    )

    if (deleteError) {
      setError(`Não foi possível excluir a campanha: ${deleteError.message}`)
      setLoading(false)
      return
    }

    setCampaigns((current) =>
      current.filter((entry) => entry.id !== campaign.id),
    )

    if (selectedCampaignId === campaign.id) {
      setSelectedCampaignId('')
      setSelectedCharacterId('')
      setCharacters([])
      setItems([])
      setCampaignMembers([])
      setCharacterGrants([])
      setShowCharacterForm(false)
      setShowItemForm(false)
      setShowCampaignForm(false)
      setEditingCampaign(null)
      resetItemForm()
      setEmojiPickerItem(null)
    }

    setNotice(`Campanha "${campaign.name}" excluída com sucesso.`)
    setLoading(false)
  }


  const startEditingCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setCampaignName(campaign.name)
    setCampaignDescription(campaign.description ?? '')
    setSystemName(campaign.system_name ?? '')
    setError('')
    setNotice('')
    setShowCampaignForm(true)
  }

  const startEditingCharacter = (character: Character) => {
    setEditingCharacter(character)
    setSelectedCharacterId(character.id)
    setCharacterName(character.name)
    setArchetype(character.archetype ?? '')
    setCharacterLevel(String(character.level))
    setError('')
    setNotice('')
    setShowCharacterForm(true)
  }

  async function removeCharacter(character: Character) {
    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir o personagem "${character.name}"? Os itens do inventário dele também podem ser afetados.`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    const { data, error: deleteError } = await supabase
      .from('characters')
      .delete()
      .eq('id', character.id)
      .eq('campaign_id', character.campaign_id)
      .select('id')

    if (deleteError) {
      setError(
        `Não foi possível excluir o personagem: ${deleteError.message}`,
      )
      return
    }

    if (!data?.length) {
      setError(
        'Nenhum personagem foi excluído. Verifique as permissões no Supabase.',
      )
      return
    }

    setCharacters((current) =>
      current.filter((entry) => entry.id !== character.id),
    )

    if (selectedCharacterId === character.id) {
      setSelectedCharacterId('')
      setItems([])
      setShowItemForm(false)
      resetItemForm()
      setEmojiPickerItem(null)
    }

    if (editingCharacter?.id === character.id) {
      setEditingCharacter(null)
      setCharacterName('')
      setArchetype('')
      setCharacterLevel('1')
      setShowCharacterForm(false)
    }

    setNotice(`Personagem "${character.name}" excluído com sucesso.`)
  }


  async function saveStrength() {
    if (!selectedCharacter) return

    const strength = Number(strengthDraft)

    if (
      strengthDraft.trim() === '' ||
      !Number.isInteger(strength) ||
      strength < 0 ||
      strength > 100
    ) {
      setError('A Força deve ser um número inteiro entre 0 e 100.')
      return
    }

    setError('')
    setNotice('')

    const { data, error: updateError } = await supabase
      .from('characters')
      .update({ strength })
      .eq('id', selectedCharacter.id)
      .select(
        'id, campaign_id, user_id, name, archetype, level, strength, visibility, created_at',
      )
      .maybeSingle()

    if (updateError) {
      setError(`Não foi possível salvar a Força: ${updateError.message}`)
      return
    }

    if (!data) {
      setError(
        'A Força não foi alterada. Verifique as permissões no Supabase.',
      )
      return
    }

    setCharacters((current) =>
      current.map((character) =>
        character.id === selectedCharacter.id
          ? (data as Character)
          : character,
      ),
    )

    setStrengthDraft(String(strength))
    setNotice(`Força de ${selectedCharacter.name} atualizada!`)
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
          <a className="nav-link active" href="#inventario">
            <span>▤</span> Inventário
            <span className="nav-count">{items.length}</span>
          </a>
          <button
            className="nav-link"
            onClick={() => setShowCharacterForm((value) => !value)}
            disabled={!selectedCampaignId}
          >
            <span>♙</span> Personagens
            <span className="nav-count">{characters.length}</span>
          </button>
          <button
            className="nav-link"
            onClick={() => setShowCampaignForm((value) => !value)}
          >
            <span>⚑</span> Campanhas
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="invite-card">
            <div className="invite-icon">✧</div>
            <strong>A aventura é melhor em grupo.</strong>
            <p>O compartilhamento de campanhas será nossa próxima evolução.</p>
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

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span /> SUA JORNADA COMEÇA AQUI
              </div>
              <h1>
                Seu inventário<span className="title-period">.</span>
              </h1>
              <p className="page-description">
                Organize campanhas, personagens e tudo o que carregam.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setShowCampaignForm((value) => !value)}
            >
              + Criar campanha
            </button>
          </section>

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

          {showCampaignForm && (
            <form
              className="add-form"
              onSubmit={editingCampaign ? updateCampaign : createCampaign}
            >
              <div className="form-heading">
                <div>
                  <h3>{editingCampaign ? 'Editar campanha' : 'Nova campanha'}</h3>
                  <p>
                    {editingCampaign
                      ? 'Altere os dados da campanha.'
                      : 'Você será registrado com o papel definido pelo banco.'}
                  </p>
                </div>
                <span>✧</span>
              </div>

              <label>
                Nome da campanha
                <input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="Ex.: As Terras Esquecidas"
                  required
                  maxLength={100}
                />
              </label>

              <label>
                Sistema de RPG (opcional)
                <input
                  value={systemName}
                  onChange={(event) => setSystemName(event.target.value)}
                  placeholder="Ex.: D&D 5e, Tormenta 20..."
                  maxLength={100}
                />
              </label>

              <label>
                Descrição (opcional)
                <input
                  value={campaignDescription}
                  onChange={(event) =>
                    setCampaignDescription(event.target.value)
                  }
                  placeholder="Uma breve descrição da aventura"
                  maxLength={500}
                />
              </label>

              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? 'Salvando...'
                  : editingCampaign
                    ? 'Salvar alterações'
                    : 'Criar campanha'}
              </button>
            </form>
          )}

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


                {isMaster && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEditingCampaign(selectedCampaign)}
                      disabled={loading}
                    >
                      Editar campanha
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void deleteCampaign(selectedCampaign)}
                      disabled={loading}
                      style={{ borderColor: '#b84d5a', color: '#ff9aa5' }}
                    >
                      Excluir campanha
                    </button>
                  </div>
                )}

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
                            className="secondary-button"
                            onClick={() => void changeMemberRole(member)}
                            disabled={!!memberActionLoading || isLastMaster}
                          >
                            {member.role === 'master' ? 'Tornar jogador' : 'Promover a mestre'}
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => void removeCampaignMember(member)}
                              disabled={!!memberActionLoading || isLastMaster}
                            >
                              Remover membro
                            </button>
                          )}
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
                    type="button"
                    onClick={() => {
                      if (showCharacterForm) {
                        setShowCharacterForm(false)
                        setEditingCharacter(null)
                        setCharacterName('')
                        setArchetype('')
                        setCharacterLevel('1')
                      } else {
                        setEditingCharacter(null)
                        setCharacterName('')
                        setArchetype('')
                        setCharacterLevel('1')
                        setError('')
                        setNotice('')
                        setShowCharacterForm(true)
                      }
                    }}
                  >
                    {showCharacterForm ? 'Cancelar' : '+ Novo personagem'}
                  </button>
                </div>

                {showCharacterForm && (
                  <form className="add-form" onSubmit={createCharacter}>
                    <div className="form-heading">
                      <div>
                        <h3>{editingCharacter ? 'Editar personagem' : 'Novo personagem'}</h3>
                        <p>
                          {editingCharacter
                            ? 'Altere os dados do personagem.'
                            : 'Preencha os dados básicos do aventureiro.'}
                        </p>
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
                      {loading
                        ? 'Salvando...'
                        : editingCharacter
                          ? 'Salvar alterações'
                          : 'Salvar personagem'}
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
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
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


                          {(character.user_id === session.user.id || isMaster) && (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                  setError('')
                                  setNotice('')
                                  startEditingCharacter(character)
                                }}
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => void removeCharacter(character)}
                                disabled={loading}
                                title="Excluir personagem"
                              >
                                Excluir
                              </button>
                            </>
                          )}

                        </div>
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

                    <div className="strength-editor">
                      <label htmlFor="character-strength">Força</label>

                      <input
                        id="character-strength"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={strengthDraft}
                        onChange={(event) =>
                          setStrengthDraft(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void saveStrength()}
                      >
                        Salvar
                      </button>
                    </div>

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
