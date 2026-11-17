import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { calculateSheetDefenses, type SheetCombatEquipment, type SheetDamageType } from '../combatDefenses'
import { calculateQuickDamage, type QuickReaction, type QuickResource, previewResource } from '../combatQuickActions'
import './MasterCombatConsole.css'

type Resource = 'pv' | 'ps' | 'pr'
type Direction = -1 | 1
type TargetKind = 'all' | 'character' | 'enemy'
type TargetSort = 'initiative' | 'health' | 'name'
type Reaction = QuickReaction
type DefenseMode = 'sheet' | 'ignore'
type PenetrationMode = 'none' | 'flat' | 'percent' | 'all'
type Participant = {
  id: string
  kind: 'character' | 'enemy'
  name: string
  emoji: string | null
  initiative: number | null
  sheetData: Record<string, any>
  defenseStats: { dexterity: number; resistance: number; combat: number; mental: number }
  maxResources: { pv: number; ps: number; pr: number }
}
type CombatEvent = {
  id: string
  target_id: string
  target_name: string
  target_kind: string
  resource: Resource
  delta: number
  previous_value: number
  new_value: number
  note: string
  created_at: string
  action_id?: string | null
  reversed_at?: string | null
  reverses_event_id?: string | null
}
type DiceResult = { formula: string; rolls: number[]; total: number; modifier: number }

type StoredQuickAction = {
  id: string; name: string; resource: Resource; amount: string; damageType: SheetDamageType
  reaction: Reaction; defenseMode: DefenseMode; mitigation: string
  penetrationMode: PenetrationMode; penetrationFlat: string; penetrationPercent: string
  note: string; direction: Direction
}
type ActiveCondition = { id: string; character_id: string; emoji: string; name: string; severity: string; duration_label?: string | null }
type PreviewRow = {
  participant: Participant; key: string; old: number | null; max: number | undefined
  damage: ReturnType<typeof calculateQuickDamage>; damageNext: number | null
  recoverNext: number | null; damageEffect: number; recoveryEffect: number; blocked: string
}
const getEquipment = (p: Participant, byCharacter: Record<string, SheetCombatEquipment[]>): SheetCombatEquipment[] => {
  if (p.kind === 'character') return byCharacter[p.id] ?? []
  const items = p.sheetData?.inventory?.items
  if (!Array.isArray(items)) return []
  return items.filter((item: Record<string, any>) => item?.equipped === true).map((item: Record<string, any>) => ({
    name: String(item.name ?? ''), equipmentType: String(item.equipmentType ?? ''),
    armorClass: String(item.armorClass ?? ''), armorCoverage: String(item.armorCoverage ?? ''),
    protectionTier: String(item.protectionTier ?? ''), protectionMode: String(item.protectionMode ?? 'resistencia'),
    kitType: String(item.kitType ?? ''), kitSkills: Array.isArray(item.kitSkills) ? item.kitSkills as string[] : [],
    kitSkillBonus: Number(item.kitSkillBonus ?? 0),
  }))
}
const getDefenses = (p: Participant, equipment: SheetCombatEquipment[]) => {
  const kitBonus = (skill: string) => p.kind !== 'character' ? 0 : equipment.filter(item =>
    ['equip_simple', 'equip_standard', 'equip_rare'].includes(String(item.kitType)) &&
    (item.kitSkills ?? []).includes(skill) && Number.isSafeInteger(item.kitSkillBonus) && (item.kitSkillBonus ?? 0) > 0,
  ).reduce((sum, item) => sum + (item.kitSkillBonus ?? 0), 0)
  return calculateSheetDefenses(equipment, { ...p.defenseStats,
    resistance: p.defenseStats.resistance + kitBonus('RESISTÊNCIA'),
    mental: p.defenseStats.mental + kitBonus('MENTAL') })
}
const emptyDamage = (resource: QuickResource) => calculateQuickDamage({
  incoming: 0, resource, damageType: 'cortante_perfurante', reaction: 'none',
  useDefenses: false, defenses: null, extraReduction: 0,
  penetrationFlat: 0, penetrationPercent: 0, specialBruteProtectionOnly: false,
})

const resourceLabels: Record<Resource, string> = { pv: 'Pontos de Vida', ps: 'Pontos de Sanidade', pr: 'Recurso' }
const resourceShort: Record<Resource, string> = { pv: 'Vida', ps: 'Sanidade', pr: 'Recurso' }
const resourceKeys: Resource[] = ['pv', 'ps', 'pr']
const amountPresets = [1, 5, 10, 25]
const diceTypes = [4, 6, 8, 10, 12, 20, 100]
const targetKey = (p: Participant) => `${p.kind}:${p.id}`
const readResource = (p: Participant | undefined, resource: Resource): number | null => {
  const raw = p?.sheetData?.status?.current?.[resource]
  if (raw === undefined || raw === null || raw === '') return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : null
}
const limitResource = (current: number, max: number | undefined, resource: Resource, delta: number) => {
  let result = Math.max(0, Math.min(1000000, current + delta))
  if (delta > 0 && resource !== 'pv' && max !== undefined && Number.isFinite(max)) {
    result = Math.max(current, Math.min(result, max))
  }
  return result
}
const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function MasterCombatConsole({ campaignId, seasonId, participants, activeTurnKey, onAdjusted, onDiceTower, onConditions, playerResourceCode, playerResourceName, enemyResourceCode, enemyResourceName, specialBruteProtectionOnly }: {
  campaignId: string
  seasonId: string
  participants: Participant[]
  activeTurnKey: string
  onAdjusted: () => void
  onDiceTower: () => void
  onConditions: () => void
  playerResourceCode: string
  playerResourceName: string
  enemyResourceCode: string
  enemyResourceName: string
  specialBruteProtectionOnly: boolean
}) {
  const [selected, setSelected] = useState('')
  const [multiMode, setMultiMode] = useState(false)
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, Reaction>>({})
  const [penetrationMode, setPenetrationMode] = useState<PenetrationMode>('none')
  const [penetrationFlat, setPenetrationFlat] = useState('0')
  const [penetrationPercent, setPenetrationPercent] = useState('0')
  const [quickName, setQuickName] = useState('')
  const [presetDirection, setPresetDirection] = useState<Direction>(-1)
  const [quickActions, setQuickActions] = useState<StoredQuickAction[]>([])
  const [conditionsByTarget, setConditionsByTarget] = useState<Record<string, ActiveCondition[]>>({})
  const [conditionError, setConditionError] = useState('')
  const [undoEventId, setUndoEventId] = useState<string | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [followTurn, setFollowTurn] = useState(true)
  const [targetSearch, setTargetSearch] = useState('')
  const [targetFilter, setTargetFilter] = useState<TargetKind>('all')
  const [targetSort, setTargetSort] = useState<TargetSort>('initiative')
  const [onlyWounded, setOnlyWounded] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [resource, setResource] = useState<Resource>('pv')
  const [amount, setAmount] = useState('1')
  const [mitigation, setMitigation] = useState('0')
  const [damageType, setDamageType] = useState<SheetDamageType>('cortante_perfurante')
  const [reaction, setReaction] = useState<Reaction>('none')
  const [defenseMode, setDefenseMode] = useState<DefenseMode>('sheet')
  const [equipmentByCharacter, setEquipmentByCharacter] = useState<Record<string, SheetCombatEquipment[]>>({})
  const [equipmentStatus, setEquipmentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [equipmentRevision, setEquipmentRevision] = useState(0)
  const [note, setNote] = useState('')
  const [pendingDirection, setPendingDirection] = useState<Direction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<CombatEvent[]>([])
  const [historyError, setHistoryError] = useState('')
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'selected'>('all')
  const [historyResourceFilter, setHistoryResourceFilter] = useState<'all' | Resource>('all')
  const [diceSides, setDiceSides] = useState(20)
  const [diceCount, setDiceCount] = useState(1)
  const [diceModifier, setDiceModifier] = useState(0)
  const [rollResult, setRollResult] = useState<DiceResult | null>(null)

  useEffect(() => {
    setSelected('')
    setMultiMode(false)
    setMultiSelected([])
    setReactionOverrides({})
    setPenetrationMode('none')
    setPenetrationFlat('0')
    setPenetrationPercent('0')
    setQuickName('')
    setPresetDirection(-1)
    setConditionsByTarget({})
    setUndoEventId(null)
    setFollowTurn(true)
    setTargetSearch('')
    setTargetFilter('all')
    setTargetSort('initiative')
    setOnlyWounded(false)
    setFocusMode(false)
    setResource('pv')
    setAmount('1')
    setMitigation('0')
    setDamageType('cortante_perfurante')
    setReaction('none')
    setDefenseMode('sheet')
    setNote('')
    setPendingDirection(null)
    setError('')
    setMessage('')
    setHistoryFilter('all')
    setHistoryResourceFilter('all')
  }, [campaignId, seasonId])

  useEffect(() => {
    setMultiSelected(keys => keys.filter(key => participants.some(p => targetKey(p) === key)))
  }, [participants])

  useEffect(() => {
    setSelected(current => {
      const activeValid = Boolean(activeTurnKey && participants.some(p => targetKey(p) === activeTurnKey))
      if (followTurn && !multiMode && activeValid) return activeTurnKey
      if (participants.some(p => targetKey(p) === current)) return current
      return activeValid ? activeTurnKey : (participants[0] ? targetKey(participants[0]) : '')
    })
  }, [activeTurnKey, participants, followTurn, multiMode])

  const sceneCharacterIds = useMemo(() => participants.filter(p => p.kind === 'character').map(p => p.id).sort(), [participants])
  const sceneCharacterKey = sceneCharacterIds.join('|')
  useEffect(() => {
    let cancelled = false
    setEquipmentStatus('loading')
    setEquipmentByCharacter({})
    const ids = sceneCharacterKey ? sceneCharacterKey.split('|') : []
    if (!ids.length) { setEquipmentStatus('ready'); return }
    void (async () => {
      try {
        const { data, error: fetchError } = await supabase.from('inventory_items')
          .select('character_id,name,metadata').in('character_id', ids)
        if (cancelled) return
        if (fetchError) { setEquipmentStatus('error'); return }
        const equipped: Record<string, SheetCombatEquipment[]> = {}
        for (const item of data ?? []) {
        const metadata = item.metadata as Record<string, any> | null
        if (metadata?.equipped !== true) continue
        const id = String(item.character_id)
        const list = equipped[id] ?? (equipped[id] = [])
        list.push({ name: item.name, equipmentType: String(metadata.equipmentType ?? ''),
          armorClass: String(metadata.armorClass ?? ''), armorCoverage: String(metadata.armorCoverage ?? ''),
          protectionTier: String(metadata.protectionTier ?? ''), protectionMode: String(metadata.protectionMode ?? 'resistencia'),
          kitType: String(metadata.kitType ?? ''), kitSkills: Array.isArray(metadata.kitSkills) ? metadata.kitSkills as string[] : [],
          kitSkillBonus: Number(metadata.kitSkillBonus ?? 0) })
      }
        setEquipmentByCharacter(equipped)
        setEquipmentStatus('ready')
      } catch {
        if (!cancelled) setEquipmentStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [campaignId, seasonId, sceneCharacterKey, equipmentRevision])

  useEffect(() => { setPendingDirection(null) }, [selected, resource, amount, mitigation, damageType, reaction, defenseMode, note, equipmentStatus, multiSelected, multiMode, penetrationFlat, penetrationPercent, penetrationMode])

  const selectedParticipant = participants.find(p => targetKey(p) === selected)
  const activeParticipant = participants.find(p => targetKey(p) === activeTurnKey)
  const resourceCode = (kind: Participant['kind'] | undefined, key: Resource) => key !== 'pr' ? key.toUpperCase() : kind === 'enemy' ? enemyResourceCode : playerResourceCode
  const resourceLongName = (kind: Participant['kind'] | undefined, key: Resource) => key !== 'pr' ? resourceLabels[key] : kind === 'enemy' ? enemyResourceName : playerResourceName
  const currentValue = readResource(selectedParticipant, resource)
  const maximumValue = selectedParticipant?.maxResources[resource]
  const rawAmount = Number(amount)
  const amountValid = amount.trim() !== '' && Number.isInteger(rawAmount) && rawAmount >= 1 && rawAmount <= 100000
  const amountValue = amountValid ? rawAmount : 0
  const selectedEquipmentReady = !selectedParticipant || selectedParticipant.kind === 'enemy' || equipmentStatus === 'ready'
  const selectedEquipment = useMemo(() => selectedParticipant
    ? getEquipment(selectedParticipant, equipmentByCharacter) : [], [selectedParticipant, equipmentByCharacter])
  const selectedDefenses = useMemo(() => selectedParticipant && selectedEquipmentReady
    ? getDefenses(selectedParticipant, selectedEquipment) : null,
    [selectedParticipant, selectedEquipment, selectedEquipmentReady])
  const rawMitigation = Number(mitigation)
  const mitigationValid = mitigation.trim() !== '' && Number.isInteger(rawMitigation) && rawMitigation >= 0 && rawMitigation <= 100000
  const mitigationValue = mitigationValid ? rawMitigation : 0
  const rawPenFlat = Number(penetrationFlat)
  const rawPenPercent = Number(penetrationPercent)
  const penFlatValid = penetrationFlat.trim() !== '' && Number.isInteger(rawPenFlat) && rawPenFlat >= 0 && rawPenFlat <= 100000
  const penPercentValid = penetrationPercent.trim() !== '' && Number.isInteger(rawPenPercent) && rawPenPercent >= 0 && rawPenPercent <= 100
  const penValid = penetrationMode === 'flat' ? penFlatValid : penetrationMode === 'percent' ? penPercentValid : true
  const effectivePenFlat = penetrationMode === 'flat' && penFlatValid ? rawPenFlat : 0
  const effectivePenPercent = penetrationMode === 'all' ? 100 : penetrationMode === 'percent' && penPercentValid ? rawPenPercent : 0
  const autoDefenseEnabled = defenseMode === 'sheet' && resource !== 'pr'
  const damageInputValid = amountValid && (resource === 'pr' || mitigationValid) && (resource !== 'pv' || penValid) && (!autoDefenseEnabled || selectedEquipmentReady)
  const selectedDamage = calculateQuickDamage({ incoming: amountValue, resource, damageType, reaction,
    useDefenses: autoDefenseEnabled, defenses: selectedDefenses, extraReduction: mitigationValue,
    penetrationFlat: effectivePenFlat, penetrationPercent: effectivePenPercent, specialBruteProtectionOnly })
  const reactionPrevented = selectedDamage.reactionPrevented
  const physicalReduction = selectedDamage.armorPrevented + selectedDamage.protectionPrevented
  const sanityReduction = selectedDamage.sanityPrevented
  const extraReduction = selectedDamage.extraPrevented
  const netDamage = damageInputValid ? selectedDamage.net : 0
  const armorCoverage = selectedDefenses?.armorCovers(damageType) ?? false
  const physicalProtectionUsed = selectedDefenses && (damageType === 'especial_bruto' || !specialBruteProtectionOnly)
    ? selectedDefenses.physicalProtection : 0
  const canRecover = resource === 'pv' || (maximumValue !== undefined && Number.isInteger(maximumValue) && maximumValue >= 0 && maximumValue <= 1000000)
  const previewDamage = currentValue === null || !damageInputValid ? null : limitResource(currentValue, maximumValue, resource, -netDamage)
  const previewRecover = currentValue === null || !canRecover ? null : limitResource(currentValue, maximumValue, resource, amountValue)
  const damageEffect = currentValue === null || previewDamage === null ? 0 : currentValue - previewDamage
  const recoveryEffect = currentValue === null || previewRecover === null ? 0 : previewRecover - currentValue
  const canApply = Boolean(selectedParticipant && currentValue !== null && amountValid && !busy && seasonId)
  const canDamage = canApply && damageInputValid && netDamage > 0 && damageEffect > 0
  const canRecoverNow = canApply && canRecover && recoveryEffect > 0

  const chosenTargets = useMemo(() => multiMode
    ? participants.filter(p => multiSelected.includes(targetKey(p)))
    : selectedParticipant ? [selectedParticipant] : [],
    [participants, multiSelected, multiMode, selectedParticipant])
  const previewRows = useMemo((): PreviewRow[] => chosenTargets.map(participant => {
    const old = readResource(participant, resource)
    const max = participant.maxResources[resource]
    const ready = !autoDefenseEnabled || participant.kind === 'enemy' || equipmentStatus === 'ready'
    const defenses = autoDefenseEnabled && ready
      ? getDefenses(participant, getEquipment(participant, equipmentByCharacter)) : null
    const individualReaction = multiMode ? (reactionOverrides[targetKey(participant)] ?? reaction) : reaction
    const damage = ready && amountValid && (resource === 'pr' || mitigationValid) && penValid
      ? calculateQuickDamage({ incoming: amountValue, resource, damageType, reaction: individualReaction,
        useDefenses: autoDefenseEnabled, defenses, extraReduction: mitigationValue,
        penetrationFlat: effectivePenFlat, penetrationPercent: effectivePenPercent, specialBruteProtectionOnly })
      : emptyDamage(resource)
    const damageNext = old !== null && ready ? previewResource(old, max, resource, -damage.net) : null
    const recoverNext = old !== null && (resource === 'pv' || (Number.isInteger(max) && max >= 0 && max <= 1000000))
      ? previewResource(old, max, resource, amountValue) : null
    const blocked = old === null ? 'Recurso não inicializado na ficha'
      : !ready ? (equipmentStatus === 'error' ? 'Equipamento indisponível' : 'Carregando defesa')
      : resource !== 'pv' && recoverNext === null ? 'Máximo inválido para recuperar' : ''
    return { participant, key: targetKey(participant), old, max, damage, damageNext, recoverNext,
      damageEffect: old !== null && damageNext !== null ? old - damageNext : 0,
      recoveryEffect: old !== null && recoverNext !== null ? recoverNext - old : 0, blocked }
  }), [chosenTargets, resource, autoDefenseEnabled, equipmentStatus, equipmentByCharacter, amountValid,
    mitigationValid, penValid, amountValue, damageType, reaction, reactionOverrides, multiMode, mitigationValue,
    effectivePenFlat, effectivePenPercent, specialBruteProtectionOnly])
  const groupBlocked = previewRows.filter(row => row.blocked)
  const groupDamageRows = previewRows.filter(row => row.damageEffect > 0 && !row.blocked)
  const groupRecoveryRows = previewRows.filter(row => row.recoveryEffect > 0 && !row.blocked)
  const isBatchReady = chosenTargets.length > 0 && chosenTargets.length <= 50 && !groupBlocked.length &&
    amountValid && mitigationValid && penValid && !busy && !undoBusy && Boolean(seasonId)
  const groupCanDamage = isBatchReady && groupDamageRows.length > 0
  const groupCanRecover = isBatchReady && groupRecoveryRows.length > 0
  const totalDamage = groupDamageRows.reduce((sum, row) => sum + row.damageEffect, 0)
  const totalRecovery = groupRecoveryRows.reduce((sum, row) => sum + row.recoveryEffect, 0)
  const canDamageAction = multiMode ? groupCanDamage : canDamage
  const canRecoverAction = multiMode ? groupCanRecover : canRecoverNow

  const presetStorageKey = `haxbag-combat-presets:v113:${campaignId}:${seasonId}`
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(presetStorageKey) || '[]')
      setQuickActions(Array.isArray(parsed) ? parsed.filter(item => item && typeof item.name === 'string' &&
        typeof item.id === 'string').slice(0, 12) as StoredQuickAction[] : [])
    } catch { setQuickActions([]) }
  }, [presetStorageKey])
  const savePresets = (next: StoredQuickAction[]) => {
    setQuickActions(next)
    try { window.localStorage.setItem(presetStorageKey, JSON.stringify(next)) }
    catch { setError('Não foi possível salvar atalhos neste navegador; verifique o armazenamento.') }
  }
  const storePreset = () => {
    const name = quickName.trim().slice(0, 42)
    if (!name || quickActions.length >= 12 || !amountValid || !mitigationValid || !penValid) return
    savePresets([...quickActions, { id: crypto.randomUUID(), name, resource, amount, damageType,
      reaction, defenseMode, mitigation, penetrationMode, penetrationFlat, penetrationPercent, note,
      direction: presetDirection }])
    setQuickName('')
    setMessage(`Ação "${name}" salva neste navegador. Alvos não são salvos.`)
  }
  const preparePreset = (item: StoredQuickAction) => {
    if (busy) return
    setReactionOverrides({})
    setResource(item.resource)
    setAmount(item.amount)
    setDamageType(item.damageType)
    setReaction(item.reaction)
    setDefenseMode(item.defenseMode)
    setMitigation(item.mitigation)
    setPenetrationMode(item.penetrationMode || 'none')
    setPenetrationFlat(item.penetrationFlat || '0')
    setPenetrationPercent(item.penetrationPercent || '0')
    setNote(item.note)
    setPresetDirection(item.direction)
    setPendingDirection(null)
    setMessage(`Ação "${item.name}" preparada. Selecione os alvos e confirme; nada foi aplicado.`)
  }
  const [historySearch, setHistorySearch] = useState('')
  const [historyLimit, setHistoryLimit] = useState(60)

  const refreshConditions = useCallback(async () => {
    if (!campaignId) return
    try {
      const [character, enemy] = await Promise.all([
        supabase.rpc('hax_list_active_conditions', { p_campaign_id: campaignId, p_character_id: null }),
        supabase.rpc('hax_list_enemy_conditions', { p_campaign_id: campaignId, p_enemy_id: null }),
      ])
      if (character.error || enemy.error) {
        setConditionError('As condições não puderam ser carregadas. Use a Central de Condições.')
        return
      }
      const grouped: Record<string, ActiveCondition[]> = {}
      for (const [kind, items] of [['character', character.data], ['enemy', enemy.data]] as const) {
        for (const assignment of (items ?? []) as ActiveCondition[]) {
          const key = `${kind}:${assignment.character_id}`
          ;(grouped[key] ??= []).push(assignment)
        }
      }
      setConditionsByTarget(grouped)
      setConditionError('')
    } catch { setConditionError('Não foi possível consultar as condições atuais.') }
  }, [campaignId])
  useEffect(() => { void refreshConditions() }, [refreshConditions, seasonId])

  const active = useMemo(() => participants.filter(p => p.initiative !== null), [participants])
  const woundedCount = useMemo(() => participants.filter(p => {
    const current = readResource(p, 'pv')
    const max = p.maxResources.pv
    return current !== null && max > 0 && current > 0 && current < max
  }).length, [participants])
  const criticalCount = useMemo(() => participants.filter(p => {
    const current = readResource(p, 'pv')
    const max = p.maxResources.pv
    return current !== null && max > 0 && current <= Math.floor(max * .25)
  }).length, [participants])
  const filteredParticipants = useMemo(() => {
    const q = normalizeSearch(targetSearch.trim())
    const health = (p: Participant) => {
      const current = readResource(p, 'pv')
      const max = p.maxResources.pv
      return current === null || max <= 0 ? Number.POSITIVE_INFINITY : Math.min(1, current / max)
    }
    return participants.filter(p => {
      const pv = readResource(p, 'pv')
      const max = p.maxResources.pv
      return (targetFilter === 'all' || p.kind === targetFilter) &&
        (!q || normalizeSearch(p.name).includes(q)) &&
        (!onlyWounded || (pv !== null && max > 0 && pv < max))
    }).sort((a, b) => {
      if (targetSort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
      if (targetSort === 'health') return health(a) - health(b) || a.name.localeCompare(b.name, 'pt-BR')
      const aTurn = targetKey(a) === activeTurnKey ? 1 : 0
      const bTurn = targetKey(b) === activeTurnKey ? 1 : 0
      if (aTurn !== bTurn) return bTurn - aTurn
      return (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) || a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [participants, targetFilter, targetSearch, targetSort, onlyWounded, activeTurnKey])

  const refresh = useCallback(async () => {
    if (!campaignId || !seasonId) { setHistory([]); return }
    setHistoryBusy(true)
    try {
      const { data, error: loadError } = await supabase.from('hax_combat_events')
        .select('id,target_id,target_name,target_kind,resource,delta,previous_value,new_value,note,created_at,applied_at,action_id,reversed_at,reverses_event_id')
        .eq('campaign_id', campaignId).eq('season_id', seasonId)
        .order('applied_at', { ascending: false }).limit(historyLimit)
      if (loadError) setHistoryError('Não foi possível carregar o registro. Confira se as migrações V110 e V113 foram aplicadas.')
      else { setHistory((data ?? []) as CombatEvent[]); setHistoryError('') }
    } catch {
      setHistoryError('Falha de conexão ao consultar o registro de combate.')
    } finally {
      setHistoryBusy(false)
    }
  }, [campaignId, seasonId, historyLimit])

  useEffect(() => {
    void refresh()
    if (!campaignId || !seasonId) return
    const channel = supabase.channel(`hax-combat-${campaignId}-${seasonId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hax_combat_events', filter: `campaign_id=eq.${campaignId}` }, () => { void refresh() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [campaignId, seasonId, refresh])

  const filteredHistory = useMemo(() => history.filter(event =>
    (historyFilter === 'all' || Boolean(selectedParticipant && event.target_id === selectedParticipant.id && event.target_kind === selectedParticipant.kind)) &&
    (historyResourceFilter === 'all' || event.resource === historyResourceFilter) &&
    (!historySearch.trim() || normalizeSearch(`${event.target_name} ${event.note}`).includes(normalizeSearch(historySearch.trim()))),
  ), [history, historyFilter, historyResourceFilter, selectedParticipant, historySearch])


  async function apply(direction: Direction) {
    if (!(direction < 0 ? canDamageAction : canRecoverAction)) return
    const rows = direction < 0 ? groupDamageRows : groupRecoveryRows
    if (!rows.length || groupBlocked.length) return
    const batchNote = [note.trim(), `${direction < 0 ? 'Dano' : 'Recuperação'} · bruto ${amountValue} · ${resource.toUpperCase()} · ${resource === 'pv' ? damageType : 'recurso'} · ${defenseMode === 'sheet' ? 'defesas da ficha' : 'sem defesas'} · reação ${reaction} · pen. ${penetrationMode}`].filter(Boolean).join(' · ')
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: adjustError } = await supabase.rpc('hax_combat_apply_batch', {
        p_campaign_id: campaignId,
        p_season_id: seasonId,
        p_resource: resource,
        p_action_id: crypto.randomUUID(),
        p_note: batchNote.slice(0, 160),
        p_changes: rows.map(row => ({ target_kind: row.participant.kind,
          target_id: row.participant.id,
          expected_value: row.old,
          delta: direction < 0 ? -row.damage.net : amountValue,
          max_value: row.max ?? null,
          detail: direction < 0 ? `reação -${row.damage.reactionPrevented}, armadura -${row.damage.armorPrevented}, proteção -${row.damage.protectionPrevented + row.damage.sanityPrevented}, extra -${row.damage.extraPrevented}, líquido ${row.damage.net}` : 'recuperação' })),
      })
      if (adjustError) {
        setError(`Ação não aplicada: ${adjustError.message}. Se alguém alterou a ficha, atualize o painel e tente novamente.`)
        return
      }
      const sum = direction < 0 ? totalDamage : totalRecovery
      setMessage(`Ação concluída em ${rows.length} alvo(s), com ${sum} ponto(s) de ${resource.toUpperCase()} efetivamente ${direction < 0 ? 'removidos' : 'recuperados'}.`)
      setPendingDirection(null)
      setReactionOverrides({})
      setMitigation('0')
      setReaction('none')
      setPenetrationMode('none')
      onAdjusted()
      void refresh()
    } catch (caught) {
      setError(`Falha de conexão: ${caught instanceof Error ? caught.message : 'tente novamente'}.`)
    } finally { setBusy(false) }
  }

  async function reverseEvent(event: CombatEvent) {
    if (busy || undoBusy || event.reversed_at || event.reverses_event_id) return
    setUndoBusy(true)
    setError('')
    try {
      const { error: undoError } = await supabase.rpc('hax_combat_reverse_event', { p_event_id: event.id })
      if (undoError) { setError(`Não foi possível desfazer: ${undoError.message}`); return }
      setUndoEventId(null)
      setMessage(`Revertida a alteração de ${event.target_name}. A reversão ficou registrada no histórico.`)
      onAdjusted()
      void refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha de conexão ao desfazer.')
    } finally { setUndoBusy(false) }
  }

  function exportRecentHistory() {
    const rows = [['Data', 'Alvo', 'Tipo', 'Recurso', 'Anterior', 'Novo', 'Diferença', 'Observação'],
      ...filteredHistory.map(event => [new Date(event.created_at).toLocaleString('pt-BR'), event.target_name,
        event.target_kind, event.resource.toUpperCase(), String(event.previous_value), String(event.new_value),
        String(event.new_value - event.previous_value), event.note])]
    const safeCell = (value: string) => {
      // Previne execução de fórmulas ao abrir CSV em planilhas.
      const escaped = /^\s*[=+\-@]/.test(value) ? `'${value}` : value
      return `"${escaped.replace(/"/g, '""')}"`
    }
    const csv = '\uFEFF' + rows.map(row => row.map(safeCell).join(';')).join('\r\n')
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = href
    link.download = `haxbag-combate-${seasonId.slice(0, 8)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
  }

  function prepareFromHistory(event: CombatEvent) {
    const p = participants.find(p => p.id === event.target_id && p.kind === event.target_kind)
    const effective = Math.abs(event.new_value - event.previous_value)
    if (!p || effective === 0 || effective > 100000 || busy) return
    setFollowTurn(false)
    setMultiMode(false)
    setMultiSelected([])
    setSelected(targetKey(p))
    setTargetFilter('all')
    setOnlyWounded(false)
    setResource(event.resource)
    setAmount(String(effective))
    setMitigation('0')
    setDefenseMode('ignore')
    setReaction('none')
    setReactionOverrides({})
    setPenetrationMode('none')
    setNote(event.note.slice(0, 120))
    setPendingDirection(null)
    setError('')
    setMessage(`Ajuste de ${p.name} preparado com ${effective} ${resourceCode(p.kind, event.resource)}. Confira e confirme antes de aplicar.`)
  }

  function roll() {
    const count = Math.max(1, Math.min(10, diceCount))
    const sides = diceTypes.includes(diceSides) ? diceSides : 20
    const mod = Math.max(-100, Math.min(100, diceModifier))
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    const total = rolls.reduce((sum, result) => sum + result, 0) + mod
    setRollResult({ formula: `${count}d${sides}${mod > 0 ? `+${mod}` : mod < 0 ? mod : ''}`, rolls, total, modifier: mod })
  }

  return <section className="hb-combat-console" id="hb-ms-combat" aria-labelledby="hb-ms-combat-title">
    <header className="hb-cc-head">
      <div>
        <span className="hb-cc-eyebrow">⚔ ESCUDO DO MESTRE / CONTROLE DE ENCONTRO</span>
        <h3 id="hb-ms-combat-title">Ações rápidas de combate</h3>
        <p>Selecione um ou vários alvos, confira as defesas de cada ficha e confirme alterações auditáveis.</p>
      </div>
      <div className="hb-cc-overview" aria-label="Resumo dos participantes">
        <div><strong>{participants.length}</strong><small>Em cena</small></div>
        <div><strong>{active.length}</strong><small>Iniciativa</small></div>
        <div><strong>{woundedCount}</strong><small>Feridos</small></div>
        <div className={criticalCount ? 'hb-cc-critical' : ''}><strong>{criticalCount}</strong><small>Críticos</small></div>
      </div>
      <button type="button" className={`hb-cc-focus-toggle ${focusMode ? 'is-on' : ''}`} aria-pressed={focusMode} onClick={() => setFocusMode(value => !value)}>
        {focusMode ? '▣ Mostrar ferramentas' : '◧ Modo foco'}
      </button>
    </header>

    <div className={`hb-cc-layout ${focusMode ? 'is-focus' : ''}`}>
      <aside className="hb-cc-panel hb-cc-targets" aria-label="Escolher alvo">
        <div className="hb-cc-panel-title"><div><span className="hb-cc-step">01</span><h4>{multiMode ? 'Alvos' : 'Alvo'}</h4></div><small>{filteredParticipants.length} disponíveis</small></div>
        <div className="hb-cc-multitoggle" role="group" aria-label="Modo de seleção">
          <button type="button" className={!multiMode ? 'is-active' : ''} aria-pressed={!multiMode} disabled={busy} onClick={() => { setMultiMode(false); setMultiSelected([]); setReactionOverrides({}); setPendingDirection(null) }}>◎ Individual</button>
          <button type="button" className={multiMode ? 'is-active' : ''} aria-pressed={multiMode} disabled={busy} onClick={() => { setMultiMode(true); setFollowTurn(false); setMultiSelected(selected ? [selected] : []); setReactionOverrides({}); setPendingDirection(null) }}>☷ Área / grupo</button>
        </div>
        <label className="hb-cc-target-search"><span className="hb-cc-sr-only">Buscar participante</span><input type="search" value={targetSearch} onChange={event => setTargetSearch(event.target.value)} placeholder="Buscar personagem ou inimigo..."/></label>
        <div className="hb-cc-filters" role="group" aria-label="Filtrar participantes">
          {([['all', 'Todos'], ['character', 'Personagens'], ['enemy', 'Inimigos']] as const).map(([key, label]) =>
            <button key={key} type="button" className={targetFilter === key ? 'is-selected' : ''} aria-pressed={targetFilter === key} onClick={() => setTargetFilter(key)}>{label}</button>
          )}
        </div>
        <div className="hb-cc-target-options">
          <label className="hb-cc-target-sort">Ordem
            <select value={targetSort} onChange={event => setTargetSort(event.target.value as TargetSort)}>
              <option value="initiative">Iniciativa</option>
              <option value="health">Menor vida</option>
              <option value="name">Nome A–Z</option>
            </select>
          </label>
          <label className="hb-cc-wounded-filter"><input type="checkbox" checked={onlyWounded} onChange={event => setOnlyWounded(event.target.checked)}/> Feridos / caídos</label>
        </div>
        {multiMode && <div className="hb-cc-group-select"><strong>{multiSelected.length} de 50 selecionados</strong><span><button type="button" disabled={busy} onClick={() => setMultiSelected(keys => [...new Set([...keys, ...filteredParticipants.map(targetKey)])].slice(0, 50))}>Selecionar filtrados</button><button type="button" disabled={busy} onClick={() => setMultiSelected([])}>Limpar</button></span></div>}
        <div className="hb-cc-target-list">
          {filteredParticipants.length ? filteredParticipants.map(p => {
            const pv = readResource(p, 'pv')
            const max = p.maxResources.pv
            const pct = pv !== null && max > 0 ? Math.max(0, Math.min(100, pv / max * 100)) : 0
            const isSelected = multiMode ? multiSelected.includes(targetKey(p)) : targetKey(p) === selected
            const isTurn = targetKey(p) === activeTurnKey
            return <button key={targetKey(p)} type="button" className={`hb-cc-target ${isSelected ? 'is-selected' : ''} ${isTurn ? 'is-turn' : ''}`} aria-pressed={isSelected} disabled={busy || (multiMode && !isSelected && multiSelected.length >= 50)} onClick={() => {
                setFollowTurn(false)
                if (multiMode) setMultiSelected(keys => keys.includes(targetKey(p))
                  ? keys.filter(key => key !== targetKey(p)) : [...keys, targetKey(p)].slice(0, 50))
                setSelected(targetKey(p)); setError(''); setMessage('')
              }}>
              {multiMode && <span className={`hb-cc-select-box ${isSelected ? 'is-on' : ''}`} aria-hidden="true">{isSelected ? '✓' : '+'}</span>}<span className="hb-cc-avatar" aria-hidden="true">{p.emoji || (p.kind === 'enemy' ? '⚔' : '♙')}</span>
              <span className="hb-cc-target-main"><span className="hb-cc-target-top"><strong>{p.name}</strong>{isTurn && <em>Turno</em>}</span><span className="hb-cc-target-meta">{p.kind === 'enemy' ? 'Inimigo' : 'Personagem'} · {p.initiative !== null ? `Inic. ${p.initiative}` : 'Sem iniciativa'}</span>{(conditionsByTarget[targetKey(p)]?.length ?? 0) > 0 && <span className="hb-cc-condition-pill" title="Condições ativas">◈ {conditionsByTarget[targetKey(p)].length}</span>}{pv !== null && max > 0 && pv <= Math.floor(max * .25) && <span className="hb-cc-danger-tag">{pv === 0 ? 'Caído' : 'PV crítico'}</span>}<span className="hb-cc-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} className={pct <= 25 ? 'is-low' : ''}/></span></span>
              <span className="hb-cc-target-pv">{pv === null ? 'PV —' : `${pv}${max > 0 ? `/${max}` : ''}`}</span>
            </button>
          }) : <div className="hb-cc-empty">{participants.length ? 'Nenhum participante corresponde ao filtro.' : 'Adicione participantes à party para começar.'}</div>}
        </div>
        {!multiMode && <button type="button" className={`hb-cc-follow ${followTurn ? 'is-on' : ''}`} onClick={() => setFollowTurn(current => !current)} aria-pressed={followTurn} disabled={!activeParticipant || busy}>
          <span aria-hidden="true">{followTurn ? '◎' : '◯'}</span> {followTurn ? 'Seguindo o turno atual' : 'Seguir turno automaticamente'}
        </button>}
        {activeParticipant && !followTurn && !multiMode && <button type="button" className="hb-cc-turn-jump" onClick={() => setSelected(activeTurnKey)} disabled={busy}>Selecionar quem está no turno: {activeParticipant.name} ↗</button>}
      </aside>

      <div className="hb-cc-panel hb-cc-editor">
        <div className="hb-cc-panel-title"><div><span className="hb-cc-step">02</span><h4>{multiMode ? 'Ajuste em grupo' : 'Aplicar ajuste'}</h4></div>{selectedParticipant && <span className="hb-cc-target-type">{selectedParticipant.kind === 'enemy' ? '⚔ INIMIGO' : '♙ PERSONAGEM'}</span>}</div>
        {selectedParticipant ? <>
          {multiMode && <div className="hb-cc-group-heading"><strong>☷ Ação sobre {chosenTargets.length} participante(s)</strong><small>As resistências e os limites de recursos são calculados individualmente. O alvo abaixo é apenas uma referência para visualizar a ficha.</small></div>}
          <div className="hb-cc-selected-header"><span className="hb-cc-selected-avatar" aria-hidden="true">{selectedParticipant.emoji || (selectedParticipant.kind === 'enemy' ? '⚔' : '♙')}</span><span><small>ALVO SELECIONADO</small><strong>{selectedParticipant.name}</strong></span>{selected === activeTurnKey && <span className="hb-cc-live-tag">● Em turno</span>}</div>
          <div className="hb-cc-active-conditions"><div className="hb-cc-active-head"><strong>◈ Condições do alvo em foco</strong><button type="button" onClick={() => void refreshConditions()} disabled={busy}>↻ Atualizar</button></div>
            {conditionError && <small className="hb-cc-validation">{conditionError}</small>}
            <div className="hb-cc-active-list">{(conditionsByTarget[selected] ?? []).map(condition => <span className={`hb-cc-condition-tag severity-${condition.severity}`} key={condition.id} title={condition.duration_label || 'Sem duração definida'}>{condition.emoji} {condition.name}</span>)}
              {!(conditionsByTarget[selected]?.length) && <small>Nenhuma condição ativa encontrada.</small>}</div>
            <button type="button" className="hb-cc-inline-link" onClick={onConditions}>Gerenciar condições manualmente ↗</button>
          </div>
          <div className="hb-cc-vitals" role="group" aria-label="Escolher recurso para alterar">
            {resourceKeys.map(key => {
              const current = readResource(selectedParticipant, key)
              const max = selectedParticipant.maxResources[key]
              const percent = current !== null && max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0
              return <button key={key} type="button" className={`hb-cc-vital ${resource === key ? 'is-selected' : ''}`} aria-pressed={resource === key} disabled={busy} onClick={() => { setResource(key); setMitigation('0'); setReaction('none'); setError(''); setMessage('') }} title={resourceLabels[key]}>
                <span className="hb-cc-vital-label">{resourceCode(selectedParticipant.kind, key)} <small>{key === 'pr' ? (selectedParticipant.kind === 'enemy' ? enemyResourceName : playerResourceName) : resourceShort[key]}</small></span>
                <strong>{current === null ? '—' : current} <small>{max > 0 ? `/ ${max}` : ''}</small></strong>
                <span className="hb-cc-bar" aria-hidden="true"><span className={percent <= 25 ? 'is-low' : ''} style={{ width: `${percent}%` }}/></span>
                {key === 'pv' && current !== null && max > 0 && current > max && <em>+{current - max} extra</em>}
              </button>
            })}
          </div>
          <div className="hb-cc-input-zone">
            <div className="hb-cc-amount-heading"><label htmlFor="hb-cc-amount">Quantidade</label><span>{resourceCode(selectedParticipant.kind, resource)} · {resourceLongName(selectedParticipant.kind, resource)}</span></div>
            <div className="hb-cc-amount-controls"><button type="button" onClick={() => setAmount(value => String(Math.max(1, (Number(value) || 1) - 1)))} disabled={busy} aria-label="Diminuir quantidade">−</button><input id="hb-cc-amount" type="number" min="1" max="100000" step="1" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} disabled={busy} aria-invalid={amount !== '' && !amountValid}/><button type="button" onClick={() => setAmount(value => String(Math.min(100000, (Number(value) || 0) + 1)))} disabled={busy} aria-label="Aumentar quantidade">+</button></div>
            <div className="hb-cc-presets" role="group" aria-label="Quantidades rápidas">{amountPresets.map(preset => <button type="button" key={preset} className={amount === String(preset) ? 'is-selected' : ''} onClick={() => setAmount(String(preset))} disabled={busy}>{preset}</button>)}</div>
            {(resource === 'pv' || resource === 'ps') && <div className="hb-cc-defense-panel">
              <div className="hb-cc-defense-header"><div><strong>🛡 Resistência pelas defesas</strong><small>Calculada com armadura e proteções realmente equipadas no alvo</small></div><button type="button" className="hb-cc-defense-refresh" onClick={() => setEquipmentRevision(n => n + 1)} disabled={busy || equipmentStatus === 'loading'}>↻ Atualizar</button></div>
              <div className="hb-cc-defense-modes" role="group" aria-label="Uso de defesas"><button type="button" aria-pressed={defenseMode === 'sheet'} className={defenseMode === 'sheet' ? 'is-selected' : ''} disabled={busy} onClick={() => setDefenseMode('sheet')}>Usar defesas da ficha</button><button type="button" aria-pressed={defenseMode === 'ignore'} className={defenseMode === 'ignore' ? 'is-selected' : ''} disabled={busy} onClick={() => setDefenseMode('ignore')}>Ignorar defesas</button></div>
              {resource === 'pv' && <label className="hb-cc-defense-select">Tipo de dano
                <select value={damageType} disabled={busy} onChange={event => setDamageType(event.target.value as SheetDamageType)}><option value="cortante_perfurante">Cortante / Perfurante</option><option value="especial_bruto">Especial / Bruto</option></select>
              </label>}
              {resource === 'pv' && <label className="hb-cc-defense-select">Resultado da reação (decidido pelo mestre)
                <select value={reaction} disabled={busy} onChange={event => setReaction(event.target.value as Reaction)}>
                  <option value="none">Sem reação</option><option value="block_miss">Bloqueio falhou · nega ¼</option><option value="block_success">Bloqueio teve sucesso · nega ½</option><option value="block_critical">Bloqueio crítico · nega tudo</option><option value="dodge_success">Esquiva teve sucesso · nega tudo</option>
                </select>
              </label>}
              {resource === 'pv' && <div className="hb-cc-penetration">
                <div className="hb-cc-subheading"><strong>Penetração de armadura</strong><small>Não ignora proteções físicas</small></div>
                <div className="hb-cc-penetration-types" role="group" aria-label="Tipo de penetração de armadura">
                  {([['none','Nenhuma'],['flat','Fixa'],['percent','Percentual'],['all','Total']] as const).map(([mode,label]) => <button key={mode} type="button" disabled={busy} aria-pressed={penetrationMode===mode} className={penetrationMode===mode?'is-selected':''} onClick={()=>setPenetrationMode(mode)}>{label}</button>)}
                </div>
                {penetrationMode === 'flat' && <label>Redução fixa da resistência da armadura<input type="number" inputMode="numeric" min="0" max="100000" value={penetrationFlat} onChange={event=>setPenetrationFlat(event.target.value)} aria-invalid={!penFlatValid}/></label>}
                {penetrationMode === 'percent' && <label>Percentual ignorado (0–100%)<input type="number" inputMode="numeric" min="0" max="100" value={penetrationPercent} onChange={event=>setPenetrationPercent(event.target.value)} aria-invalid={!penPercentValid}/></label>}
                {!penValid && <small className="hb-cc-validation">Informe uma penetração válida.</small>}
                {autoDefenseEnabled && selectedDefenses && <small>Armadura: {selectedDamage.armorValue} → {selectedDamage.effectiveArmor} de resistência efetiva.</small>}
              </div>}
              {autoDefenseEnabled && !selectedEquipmentReady && <div className="hb-cc-defense-warning" role="status">{equipmentStatus === 'error' ? 'Não foi possível consultar equipamentos. Atualize as defesas ou escolha Ignorar defesas conscientemente.' : 'Consultando armaduras e proteções equipadas…'}</div>}
              {selectedDefenses && autoDefenseEnabled && <div className="hb-cc-defense-stats">
                {resource === 'pv' ? <><div><small>Armadura {armorCoverage ? 'ativa' : 'sem cobertura'}</small><strong>{armorCoverage ? selectedDefenses.armorResistance : 0}</strong><span>{selectedDefenses.armor?.name ?? 'Sem armadura equipada'}</span></div><div><small>Proteção física {physicalProtectionUsed ? 'ativa' : 'não aplicável'}</small><strong>{physicalProtectionUsed}</strong><span>{specialBruteProtectionOnly && damageType === 'cortante_perfurante' ? 'Regra do sistema: apenas Especial/Bruto' : 'Defesas equipadas'}</span></div></> : <div><small>Proteção de sanidade</small><strong>{selectedDefenses.sanityProtection}</strong><span>Itens de proteção mental equipados</span></div>}
              </div>}
              {defenseMode === 'ignore' && <div className="hb-cc-defense-warning">Defesas de equipamentos ignoradas neste ataque; a reação escolhida ainda é aplicada.</div>}
            </div>}
            {resource !== 'pr' && <div className="hb-cc-mitigation">
              <div><label htmlFor="hb-cc-mitigation">Redução adicional manual</label><small>Condições, habilidades ou efeitos específicos ainda não incluídos nas defesas da ficha</small></div>
              <div className="hb-cc-mitigation-controls"><input id="hb-cc-mitigation" type="number" inputMode="numeric" min="0" max="100000" step="1" value={mitigation} disabled={busy} aria-invalid={!mitigationValid} onChange={event => setMitigation(event.target.value)}/><button type="button" onClick={() => setMitigation('0')} disabled={busy || mitigation === '0'}>Zerar</button></div>
              {!mitigationValid && <small className="hb-cc-validation">A redução deve ser um inteiro de 0 a 100.000.</small>}
              {amountValid && mitigationValid && (resource !== 'pv' && resource !== 'ps' || !autoDefenseEnabled || selectedEquipmentReady) && <div className="hb-cc-damage-breakdown">
                <span>Dano bruto <b>{amountValue}</b></span>{reactionPrevented > 0 && <span>− Reação <b>{reactionPrevented}</b></span>}
                {physicalReduction + sanityReduction > 0 && <><span>− Armadura <b>{selectedDamage.armorPrevented}</b></span><span>− Proteções <b>{selectedDamage.protectionPrevented + sanityReduction}</b></span></>}
                {extraReduction > 0 && <span>− Redução adicional <b>{extraReduction}</b></span>}
                <strong>Dano líquido <b>{netDamage}</b></strong>
              </div>}
              {amountValid && damageInputValid && netDamage === 0 && <small className="hb-cc-defense-absorbed">✓ Dano totalmente evitado. Nenhum PV/PS será descontado.</small>}
            </div>}
            {!amountValid && <small className="hb-cc-validation">Informe um número inteiro entre 1 e 100.000.</small>}
          </div>
          <div className="hb-cc-notes"><label htmlFor="hb-cc-note">Motivo <span>(opcional)</span></label><div className="hb-cc-reasons">{['Ataque', 'Habilidade', 'Condição', 'Descanso'].map(reason => <button type="button" key={reason} onClick={() => setNote(reason)} disabled={busy} aria-pressed={note === reason}>{reason}</button>)}</div><input id="hb-cc-note" value={note} onChange={event => setNote(event.target.value)} maxLength={120} placeholder="Ex.: golpe após a redução por armadura" disabled={busy}/><small>{note.length}/120 caracteres</small></div>
          {multiMode && <div className="hb-cc-group-preview" aria-live="polite">
            <div className="hb-cc-subheading"><strong>Prévia por participante</strong><small>{chosenTargets.length} alvos · as defesas são independentes</small></div>
            {chosenTargets.length === 0 ? <p>Selecione até 50 alvos na coluna à esquerda.</p> : <div className="hb-cc-group-list">{previewRows.map(row => <div className={`hb-cc-group-row ${row.blocked ? 'is-blocked' : ''}`} key={row.key}>
              <span><strong>{row.participant.name}</strong><small>{row.blocked || `${resourceCode(row.participant.kind,resource)}: ${row.old} atual`}</small>
              {resource === 'pv' && <select aria-label={`Reação defensiva de ${row.participant.name}`} value={reactionOverrides[row.key] ?? reaction} disabled={busy} onChange={event => setReactionOverrides(previous => ({ ...previous, [row.key]: event.target.value as Reaction }))}>
                <option value="none">Sem reação</option><option value="block_miss">Bloqueio falhou (¼)</option><option value="block_success">Bloqueio sucesso (½)</option><option value="block_critical">Bloqueio crítico</option><option value="dodge_success">Esquiva sucesso</option>
              </select>}</span>
              <span><small>Redução {row.damage.reactionPrevented + row.damage.armorPrevented + row.damage.protectionPrevented + row.damage.sanityPrevented + row.damage.extraPrevented}</small><strong>{row.old ?? '—'} → {row.damageNext ?? '—'} <em>−{row.damageEffect}</em></strong></span>
              <span><small>Recuperação</small><strong>{row.old ?? '—'} → {row.recoverNext ?? '—'} <em>+{row.recoveryEffect}</em></strong></span>
            </div>)}</div>}
            {groupBlocked.length > 0 && <p role="alert" className="hb-cc-validation">{groupBlocked.length} participante(s) indisponíveis. Corrija o recurso/equipamentos ou retire esses alvos da seleção antes de confirmar.</p>}
            <div className="hb-cc-group-totals"><span>Dano efetivo <b>{totalDamage}</b> em {groupDamageRows.length}</span><span>Recuperação efetiva <b>{totalRecovery}</b> em {groupRecoveryRows.length}</span></div>
          </div>}
          <div className="hb-cc-operations"><button type="button" className="hb-cc-damage" onClick={() => setPendingDirection(-1)} disabled={!canDamageAction}><span aria-hidden="true">−</span><span><strong>{resource === 'pv' ? 'Aplicar dano' : resource === 'ps' ? 'Aplicar dano de sanidade' : 'Reduzir recurso'}</strong><small>{canDamageAction ? (multiMode ? `${totalDamage} no total · ${groupDamageRows.length} alvos` : `−${damageEffect} ${resourceCode(selectedParticipant.kind, resource)} → ${previewDamage}`) : 'Sem efeito disponível'}</small></span></button><button type="button" className="hb-cc-heal" onClick={() => setPendingDirection(1)} disabled={!canRecoverAction}><span aria-hidden="true">+</span><span><strong>Recuperar</strong><small>{canRecoverAction ? (multiMode ? `${totalRecovery} no total · ${groupRecoveryRows.length} alvos` : `+${recoveryEffect} ${resourceCode(selectedParticipant.kind, resource)} → ${previewRecover}`) : 'No limite ou indisponível'}</small></span></button></div>
          <p className="hb-cc-hint">As defesas são calculadas com as perícias da ficha e os equipamentos marcados como equipados. Reações dependem da decisão do mestre; condições temporárias, modificadores e kits especiais podem exigir ajuste manual. PS e o terceiro recurso respeitam o limite de recuperação; PV pode ultrapassá-lo.</p>
          {pendingDirection !== null && <div className="hb-cc-confirm" role="group" aria-label="Confirmar ajuste de recurso">
            <div><strong>Confirmar {pendingDirection < 0 ? 'dano/redução' : 'recuperação'}?</strong>
              <p><b>{multiMode ? `${chosenTargets.length} participantes selecionados` : selectedParticipant.name}</b> · {resourceCode(selectedParticipant.kind, resource)}</p>
              <p><b>{pendingDirection < 0 ? totalDamage : totalRecovery} ponto(s) efetivos</b> em {pendingDirection < 0 ? groupDamageRows.length : groupRecoveryRows.length} alvo(s). Os participantes sem alteração não serão registrados.</p>
              {pendingDirection < 0 && <p>Dano bruto {amountValue}. Reduções específicas de cada alvo aparecem na prévia.</p>}
              {note.trim() && <small>Motivo: {note.trim()}</small>}
              <small>As fichas serão verificadas novamente no servidor; alterações concorrentes cancelam toda a ação.</small>
            </div>
            <div className="hb-cc-confirm-actions"><button type="button" onClick={() => setPendingDirection(null)} disabled={busy}>Cancelar</button>
              <button type="button" className={pendingDirection < 0 ? 'is-damage' : 'is-heal'} onClick={() => void apply(pendingDirection)} disabled={!(pendingDirection < 0 ? canDamageAction : canRecoverAction) || busy}>{busy ? 'Salvando…' : 'Confirmar com segurança'}</button></div>
          </div>}

        </> : <div className="hb-cc-empty hb-cc-editor-empty">Selecione um personagem ou inimigo ao lado para ajustar os recursos.</div>}
        {error && <p role="alert" className="hb-cc-alert is-error">{error}</p>}
        {message && <p role="status" className="hb-cc-alert is-success">✓ {message}</p>}
      </div>

      {!focusMode && <div className="hb-cc-panel hb-cc-utilities">
        <div className="hb-cc-panel-title"><div><span className="hb-cc-step">03</span><h4>Ferramentas e registro</h4></div></div>
        <div className="hb-cc-quick-library">
          <div className="hb-cc-subheading"><strong>★ Ações favoritas</strong><small>Até 12 atalhos neste navegador</small></div>
          {quickActions.length ? <div className="hb-cc-quick-cards">{quickActions.map(item => <div className="hb-cc-quick-card" key={item.id}><button type="button" onClick={() => preparePreset(item)} disabled={busy}><strong>{item.name}</strong><small>{item.direction < 0 ? 'Dano' : 'Cura'} · {item.amount} {item.resource.toUpperCase()} · {item.penetrationMode !== 'none' ? 'com penetração' : 'sem penetração'}</small></button><button type="button" className="hb-cc-delete-preset" aria-label={`Excluir ação ${item.name}`} title="Excluir ação" disabled={busy} onClick={() => savePresets(quickActions.filter(saved => saved.id !== item.id))}>×</button></div>)}</div> : <p className="hb-cc-muted">Salve ataques e recuperações recorrentes para preparar o cálculo com um clique.</p>}
          <div className="hb-cc-quick-add"><input aria-label="Nome do novo ataque ou ação" placeholder="Ex.: Golpe pesado, cura básica" maxLength={42} value={quickName} onChange={event => setQuickName(event.target.value)} />
            <select aria-label="Tipo de ação favorita" value={presetDirection} onChange={event => setPresetDirection(Number(event.target.value) as Direction)}><option value={-1}>Dano / reduzir</option><option value={1}>Recuperar</option></select>
            <button type="button" disabled={busy || !quickName.trim() || quickActions.length >= 12 || !amountValid || !mitigationValid || !penValid} onClick={storePreset}>＋ Salvar ação</button>
          </div>
          <small className="hb-cc-muted">Ações salvas não armazenam alvos nem executam alterações automaticamente.</small>
        </div>
        <div className="hb-cc-dice-box"><div className="hb-cc-subheading"><strong>🎲 Rolagem de apoio</strong><small>Local — não altera a ficha</small></div><div className="hb-cc-dice-fields"><label>Dados<select value={diceCount} onChange={event => setDiceCount(Number(event.target.value))}>{Array.from({ length: 10 }, (_, i) => i + 1).map(count => <option key={count} value={count}>{count}×</option>)}</select></label><label>Faces<select value={diceSides} onChange={event => setDiceSides(Number(event.target.value))}>{diceTypes.map(sides => <option value={sides} key={sides}>d{sides}</option>)}</select></label><label>Modificador<input type="number" min="-100" max="100" step="1" value={diceModifier} onChange={event => setDiceModifier(Math.max(-100, Math.min(100, Math.trunc(Number(event.target.value) || 0))))}/></label></div><button type="button" className="hb-cc-roll" onClick={roll}>Rolar dados</button>{rollResult && <div className="hb-cc-roll-result" role="status" aria-live="polite"><div><small>{rollResult.formula}</small><strong>{rollResult.total}</strong></div><span>Resultados: {rollResult.rolls.join(' + ')}{rollResult.modifier !== 0 ? ` (${rollResult.modifier > 0 ? '+' : ''}${rollResult.modifier} no total)` : ''}</span><button type="button" disabled={busy || rollResult.total < 1 || rollResult.total > 100000} onClick={() => { setAmount(String(rollResult.total)); setMitigation('0'); setPendingDirection(null); setMessage('Resultado enviado para Quantidade. As defesas serão aplicadas na prévia, se ativadas.') }}>Usar {rollResult.total} como quantidade ↗</button></div>}</div>
        <div className="hb-cc-tool-links"><button type="button" onClick={onDiceTower}>🎲 Torre de Dados <span aria-hidden="true">↗</span></button><button type="button" onClick={onConditions}>◈ Condições <span aria-hidden="true">↗</span></button></div>
        <div className="hb-cc-history-heading"><div><strong>◷ Últimas alterações</strong><small>Até {historyLimit} registros recentes · confirmação e desfazer com auditoria</small></div><button type="button" onClick={() => void refresh()} disabled={historyBusy} aria-label="Atualizar registro de combate">{historyBusy ? '…' : '↻'} Atualizar</button></div>
        <div className="hb-cc-history-tools"><label className="hb-cc-history-limit">Registros <select aria-label="Quantidade máxima de registros" value={historyLimit} onChange={event => setHistoryLimit(Number(event.target.value))}><option value={60}>60</option><option value={120}>120</option><option value={200}>200</option></select></label><input type="search" aria-label="Buscar no histórico" placeholder="Buscar alvo ou motivo..." value={historySearch} onChange={event=>setHistorySearch(event.target.value)}/><button type="button" disabled={!filteredHistory.length} onClick={exportRecentHistory}>↓ Exportar CSV</button></div>
        <div className="hb-cc-history-filters"><label>Alvos<select value={historyFilter} onChange={event => setHistoryFilter(event.target.value as typeof historyFilter)}><option value="all">Todos</option><option value="selected" disabled={!selectedParticipant}>Alvo selecionado</option></select></label><label>Recurso<select value={historyResourceFilter} onChange={event => setHistoryResourceFilter(event.target.value as typeof historyResourceFilter)}><option value="all">Todos</option>{resourceKeys.map(key => <option key={key} value={key}>{key.toUpperCase()}</option>)}</select></label></div>
        {historyError && <p role="alert" className="hb-cc-history-error">{historyError}</p>}
        <div className="hb-cc-history-list" aria-label="Histórico recente do combate">
          {filteredHistory.length ? filteredHistory.map(event => {
            const applied = event.new_value - event.previous_value
            const latestForResource = history.find(item => item.target_kind === event.target_kind && item.target_id === event.target_id && item.resource === event.resource)
            const isUndoable = applied !== 0 && latestForResource?.id === event.id && !event.reversed_at && !event.reverses_event_id && !busy && !undoBusy
            return <div className="hb-cc-history-item" key={event.id}>
              <span className={`hb-cc-history-sign ${applied < 0 ? 'is-negative' : applied > 0 ? 'is-positive' : ''}`}>{applied < 0 ? '−' : applied > 0 ? '+' : '='}</span>
              <span className="hb-cc-history-text"><strong>{event.target_name} <em>{event.target_kind === 'enemy' ? 'Inimigo' : 'Personagem'}</em></strong>
                <small>{resourceCode(event.target_kind === 'enemy' ? 'enemy' : 'character', event.resource)} {applied > 0 ? '+' : ''}{applied} · {event.previous_value} → {event.new_value}</small>
                {event.note && <span className="hb-cc-history-note">{event.note}</span>}
                {event.reversed_at && <span className="hb-cc-history-reversed">↶ Alteração desfeita</span>}
                {event.reverses_event_id && <span className="hb-cc-history-reversed">↶ Registro de reversão</span>}
                <div className="hb-cc-history-actions"><button className="hb-cc-history-repeat" type="button" disabled={busy || !participants.some(p => p.id === event.target_id && p.kind === event.target_kind) || applied === 0 || Math.abs(applied) > 100000} onClick={() => prepareFromHistory(event)}>Preparar ↗</button>
                  <button type="button" className="hb-cc-history-undo" disabled={!isUndoable} onClick={() => setUndoEventId(event.id)}>↶ Desfazer</button></div>
                {undoEventId === event.id && <div className="hb-cc-history-undo-confirm" role="group" aria-label="Confirmar reversão"><small>Reverter {applied > 0 ? '+' : ''}{applied} em {event.target_name}? A ficha deve permanecer no valor {event.new_value}.</small><div><button type="button" onClick={()=>setUndoEventId(null)} disabled={undoBusy}>Cancelar</button><button type="button" disabled={undoBusy} onClick={()=>void reverseEvent(event)}>{undoBusy ? 'Revertendo…' : 'Confirmar reversão'}</button></div></div>}
              </span><time title={new Date(event.created_at).toLocaleString('pt-BR')} dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          }) : <div className="hb-cc-empty">{history.length ? 'Nenhum registro corresponde aos filtros.' : 'Nenhum ajuste registrado nesta temporada.'}</div>}
        </div>
      </div>}
    </div>
  </section>
}
