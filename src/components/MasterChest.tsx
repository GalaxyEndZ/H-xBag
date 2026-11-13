import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './MasterChest.css'

type CharacterOption = { id: string; campaign_id: string; name: string; emoji?: string | null }
type CurrencyOption = { id: string; name: string; symbol: string }

type ChestMetadata = Record<string, unknown> & {
  icon?: string
  rarity?: string
  tags?: string[]
  notes?: string
  categories?: string[]
}

type ChestItem = {
  id: string
  campaign_id: string
  name: string
  description: string | null
  category: string
  quantity: number
  is_infinite: boolean
  weight: number
  unit_price: number
  currency_id: string | null
  sale_blocked: boolean
  status: 'available' | 'reserved'
  metadata: ChestMetadata | null
  created_at: string
  updated_at: string
}

type InventoryTemplate = {
  id: string
  character_id: string
  name: string
  description: string | null
  category: string
  quantity: number
  weight: number
  unit_price: number | null
  currency_id: string | null
  sale_blocked: boolean | null
  metadata: Record<string, unknown> | null
}
const sanitizeInventoryMetadata = (metadata: Record<string, unknown> | null) => {
  const result = { ...(metadata ?? {}) }
  for (const key of ['notes', 'equipped', 'favorite', 'manualOrder', 'isEquipped', 'selected', 'deliveryMessage', 'notifyOnDelivery']) delete result[key]
  if (result.equipmentType === 'cybernetic') {
    result.cyberneticEquipped = false
    const cyberData = result.cyberneticData
    if (cyberData && typeof cyberData === 'object' && !Array.isArray(cyberData))
      result.cyberneticData = { ...(cyberData as Record<string, unknown>), status: 'stored' }
  }
  return result
}
type BundlePreset = {
  id: string
  name: string
  lines: Array<{ itemId: string; quantity: number }>
  createdAt: number
}

type LootEntry = { itemId: string; weight: number }
type LootTable = {
  id: string
  campaign_id: string
  name: string
  description: string
  icon: string
  entries: LootEntry[]
  created_at: string
  updated_at: string
}
type LootDraft = { name: string; description: string; icon: string; entries: LootEntry[] }
type LootDraw = {
  lootId: string
  lootName: string
  item: ChestItem
  probability: number
  eligibleCount: number
  excludedCount: number
  drawnAt: number
}
const emptyLootDraft = (): LootDraft => ({ name: '', description: '', icon: '🎲', entries: [] })
const isInfinite = (item?: ChestItem | null) => Boolean(item?.is_infinite)
const stockLabel = (item: ChestItem) => isInfinite(item) ? '∞ Ilimitado' : `${item.quantity} un.`
const hasStock = (item: ChestItem, required = 1) => isInfinite(item) || item.quantity >= required
const lootItemIsAvailable = (item?: ChestItem) => Boolean(item && item.status === 'available' && hasStock(item))
const validLootEntries = (value: unknown): LootEntry[] => Array.isArray(value) ? value.filter((entry): entry is LootEntry =>
  Boolean(entry && typeof entry === 'object' && typeof entry.itemId === 'string' &&
    Number.isInteger(entry.weight) && entry.weight >= 1 && entry.weight <= 1000)).slice(0, 30) : []
const formatChance = (weight: number, total: number) => total ? `${(weight * 100 / total).toLocaleString('pt-BR', {maximumFractionDigits: 1})}%` : '—'
// A edição pode ficar vazia temporariamente, mas o valor persistido deve ser sempre 1–1000.
const parseLootChance = (text: string | undefined, fallback = 1) => {
  if (text === undefined) return fallback
  const number = Number(text)
  return text.trim() !== '' && Number.isInteger(number) && number >= 1 && number <= 1000 ? number : 1
}

type DropStarter = {
  id: string
  label: string
  icon: string
  description: string
  updates: Partial<ItemDraft>
}

type DeliveryRecord = {
  id: string
  item_name: string
  character_name: string
  quantity: number
  created_at: string
}

type ItemDraft = {
  name: string
  description: string
  category: string
  categories: string[]
  rarity: string
  icon: string
  quantity: string
  infiniteStock: boolean
  weight: string
  unitPrice: string
  currencyId: string
  tags: string
  notes: string
  status: 'available' | 'reserved'
  saleBlocked: boolean
  dropType: 'item' | 'money'
  equipmentType: 'none' | 'armor' | 'protection' | 'cybernetic'
  armorClass: 'leve' | 'media' | 'pesada'
  armorCoverage: 'cortante_perfurante' | 'especial_bruto'
  protectionTier: 'basica' | 'moderada' | 'avancada'
  protectionMode: 'resistencia' | 'sanidade'
  weaponClass: 'improvised' | 'advanced' | 'special' | 'black_red' | 'mutable'
  scarcityLevel: '1' | '2' | '3' | '4'
  scarcityExhausted: boolean
  scarcityMode: 'fixed' | 'random'
  scarcityMinLevel: string
  scarcityMaxLevel: string
  moneyMode: 'fixed' | 'range'
  moneyMin: string
  moneyMax: string
  cyberneticCategory: string
  cyberneticLocation: string
  cyberneticLoad: string
  cyberneticEffects: string
  notifyOnDelivery: boolean
  deliveryMessage: string
}

const CATEGORIES = ['Diversos', 'Armas', 'Equipamento', 'Kits', 'Consumíveis', 'Tesouros', 'Materiais', 'Artefatos', 'Documentos', 'Missões']
const RARITIES = [
  { value: 'comum', label: 'Comum' },
  { value: 'incomum', label: 'Incomum' },
  { value: 'raro', label: 'Raro' },
  { value: 'épico', label: 'Épico' },
  { value: 'mítico', label: 'Mítico' },
  { value: 'relíquia', label: 'Relíquia' },
]
const ICONS = ['🦾', '🎒', '⚙️', '🧥', '📦', '⚔️', '🗡️', '🏹', '🛡️', '🪄', '🧪', '🧴', '🍖', '🍷', '🧀', '🧭', '🔑', '🗝️', '📜', '📕', '💎', '💰', '🪙', '💍', '👑', '🪶', '🪓', '🔨', '⛏️', '🔥', '❄️', '🌿', '💀', '🐉', '✨', '🦑', '🐦‍⬛']
const emptyDraft = (): ItemDraft => ({
  name: '', description: '', category: 'Diversos', categories: ['Diversos'], rarity: 'comum', icon: '📦',
  quantity: '1', infiniteStock: false, weight: '0', unitPrice: '0', currencyId: '', tags: '', notes: '',
  status: 'available', saleBlocked: false, dropType: 'item',
  equipmentType: 'none', armorClass: 'leve', armorCoverage: 'cortante_perfurante',
  protectionTier: 'basica', protectionMode: 'resistencia', weaponClass: 'improvised',
  scarcityLevel: '1', scarcityExhausted: false,
  scarcityMode: 'fixed', scarcityMinLevel: '1', scarcityMaxLevel: '4',
  moneyMode: 'fixed', moneyMin: '100', moneyMax: '1000',
  cyberneticCategory: 'Outro', cyberneticLocation: '', cyberneticLoad: '0', cyberneticEffects: '',
  notifyOnDelivery: false, deliveryMessage: '',
})
const DROP_STARTERS: DropStarter[] = [
  { id: 'weapon', label: 'Arma', icon: '⚔️', description: 'Dano e peso por classe', updates: { icon: '⚔️', category: 'Armas', categories: ['Armas'], weaponClass: 'advanced', weight: '1' } },
  { id: 'armor', label: 'Armadura', icon: '🛡️', description: 'Cobertura configurável', updates: { icon: '🛡️', category: 'Equipamento', categories: ['Equipamento'], equipmentType: 'armor', armorClass: 'leve', weight: '2' } },
  { id: 'protection', label: 'Proteção', icon: '✨', description: 'Resistência ou sanidade', updates: { icon: '✨', category: 'Equipamento', categories: ['Equipamento'], equipmentType: 'protection', weight: '0' } },
  { id: 'consumable', label: 'Consumível', icon: '🧪', description: 'Escassez e cargas', updates: { icon: '🧪', category: 'Consumíveis', categories: ['Consumíveis'], scarcityLevel: '1', weight: '7' } },
  { id: 'kit', label: 'Kit', icon: '🎒', description: 'Conjunto de itens e ferramentas', updates: { icon: '🎒', category: 'Kits', categories: ['Kits'] } },
  { id: 'treasure', label: 'Tesouro', icon: '💎', description: 'Recompensa com valor', updates: { icon: '💎', category: 'Tesouros', categories: ['Tesouros'] } },
  { id: 'cybernetic', label: 'Cibernética', icon: '🦾', description: 'Implante para CyberFlower', updates: { icon: '🦾', category: 'Equipamento', categories: ['Equipamento'], equipmentType: 'cybernetic' } },
]
const presetsStorageKey = (campaignId: string) => `haxbag:master-chest:bundle-presets:${campaignId}`
const readBundlePresets = (campaignId: string): BundlePreset[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(presetsStorageKey(campaignId)) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((entry): entry is BundlePreset =>
      Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string' &&
        typeof entry.name === 'string' && Array.isArray(entry.lines)))
      .slice(0, 12).map(entry => ({
        id: entry.id, name: entry.name.slice(0, 60), createdAt: Number(entry.createdAt) || 0,
        lines: entry.lines.filter(line => line && typeof line.itemId === 'string' &&
          Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999999).slice(0, 30),
      }))
  } catch { return [] }
}

const asNumber = (value: unknown) => {
  const result = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  return Number.isFinite(result) ? result : 0
}
const rarityLabel = (value: string) => RARITIES.find(item => item.value === value)?.label ?? 'Comum'
const rarityTone = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const isMoneyDrop = (item: ChestItem) => item.metadata?.dropType === 'money'
const moneyRange = (item: ChestItem): { min: number; max: number } | null => {
  const metadata = item.metadata
  if (metadata?.dropType !== 'money' || metadata?.rewardMode !== 'range') return null
  const min = Number(metadata.rewardMin)
  const max = Number(metadata.rewardMax)
  return Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max >= min && max <= 1000000000 ? { min, max } : null
}
const scarcityRange = (item: ChestItem): { min: number; max: number } | null => {
  const metadata = item.metadata
  if (metadata?.scarcityMode !== 'random') return null
  const min = Number(metadata.scarcityMinLevel)
  const max = Number(metadata.scarcityMaxLevel)
  return Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max >= min && max <= 4 ? { min, max } : null
}
const rewardSummary = (item: ChestItem, currencies: CurrencyOption[]) => {
  const money = moneyRange(item)
  if (money) return `${currencyValue(money.min, item.currency_id, currencies)}–${currencyValue(money.max, item.currency_id, currencies)} por unidade (sorteado na entrega)`
  const scarcity = scarcityRange(item)
  if (scarcity) return `Escassez aleatória: nível ${scarcity.min} a ${scarcity.max} (sorteado na entrega)`
  if (isMoneyDrop(item)) return `${currencyValue(item.unit_price, item.currency_id, currencies)} por unidade`
  return ''
}
const itemIcon = (item: ChestItem) => typeof item.metadata?.icon === 'string' ? item.metadata.icon : '📦'
const itemRarity = (item: ChestItem) => typeof item.metadata?.rarity === 'string' ? item.metadata.rarity : 'comum'
const itemTags = (item: ChestItem) => Array.isArray(item.metadata?.tags)
  ? item.metadata.tags.filter((tag): tag is string => typeof tag === 'string') : []
const itemCategories = (item: Pick<ChestItem, 'category' | 'metadata'>): string[] => {
  const categories = Array.isArray(item.metadata?.categories)
    ? item.metadata.categories.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  return [...new Set([item.category, ...categories].filter(Boolean))]
}
const suggestedItemWeight = (draft: ItemDraft): number | null => {
  if (draft.categories.includes('Armas')) {
    const weights: Record<ItemDraft['weaponClass'], number> = {
      improvised: .5, advanced: 1, special: 1, black_red: 1.5, mutable: 2,
    }
    return weights[draft.weaponClass]
  }
  if (!draft.categories.includes('Equipamento')) return null
  if (draft.equipmentType === 'armor') return draft.armorClass === 'pesada' ? 6 : draft.armorClass === 'media' ? 4 : 2
  if (draft.equipmentType === 'protection') return 0
  return null
}
const scarcityRules: Record<ItemDraft['scarcityLevel'], { die: string; charge: number }> = {
  '1': { die: 'd12', charge: 7 }, '2': { die: 'd8', charge: 5 },
  '3': { die: 'd6', charge: 3 }, '4': { die: 'd4', charge: 1 },
}
const isArmorDraft = (draft: ItemDraft) => draft.dropType === 'item'
  && draft.categories.includes('Equipamento') && draft.equipmentType === 'armor'
const isConsumableDraft = (draft: ItemDraft) => draft.dropType === 'item'
  && draft.categories.includes('Consumíveis') && !isArmorDraft(draft)
const draftEffectiveWeight = (draft: ItemDraft) => isConsumableDraft(draft)
  ? (draft.scarcityExhausted ? 0 : scarcityRules[draft.scarcityLevel].charge)
  : asNumber(draft.weight)
const draftEffectivePrice = (draft: ItemDraft) => isConsumableDraft(draft) && draft.scarcityExhausted ? 0 : asNumber(draft.unitPrice)
const maybeValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
const currencyValue = (value: number, id: string | null, currencies: CurrencyOption[]) => {
  const currency = currencies.find(option => option.id === id)
  return `${currency?.symbol ? `${currency.symbol} ` : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`
}
const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const csvCell = (value: string | number) => {
  const input = String(value)
  const safe = /^[\s]*[=+@\-\t\r]/.test(input) && typeof value === 'string' ? `'${input}` : input
  return `"${safe.replace(/"/g, '""')}"`
}
function exportCsv(filename: string, rows: Array<Array<string | number>>) {
  const data = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function MasterChest({ campaignId, characters, currencyOptions, onDelivered }: {
  campaignId: string
  characters: CharacterOption[]
  currencyOptions: CurrencyOption[]
  onDelivered: () => void
}) {
  const [items, setItems] = useState<ChestItem[]>([])
  const [history, setHistory] = useState<DeliveryRecord[]>([])
  const [loots, setLoots] = useState<LootTable[]>([])
  const [lootError, setLootError] = useState('')
  const [lootSearch, setLootSearch] = useState('')
  const [lootEditor, setLootEditor] = useState<{ id?: string; updatedAt?: string } | null>(null)
  const [lootDraft, setLootDraft] = useState<LootDraft>(emptyLootDraft)
  const [lootChanceInputs, setLootChanceInputs] = useState<Record<string, string>>({})
  const [lootDirty, setLootDirty] = useState(false)
  const [lootDiscardConfirm, setLootDiscardConfirm] = useState(false)
  const [lootSelectedItem, setLootSelectedItem] = useState('')
  const [lootDelete, setLootDelete] = useState<LootTable | null>(null)
  const [lootResult, setLootResult] = useState<LootDraw | null>(null)
  const [lootBatchResults, setLootBatchResults] = useState<LootDraw[]>([])
  const [lootRequestedCount, setLootRequestedCount] = useState<1 | 3 | 5>(1)
  const [lootDrawHistory, setLootDrawHistory] = useState<LootDraw[]>([])
  const [templateCharacter, setTemplateCharacter] = useState('')
  const [inventoryTemplates, setInventoryTemplates] = useState<InventoryTemplate[]>([])
  const [templateSearch, setTemplateSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [templateQuantities, setTemplateQuantities] = useState<Record<string, number>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [tab, setTab] = useState<'items' | 'loots' | 'history'>('items')
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPeriod, setHistoryPeriod] = useState<'all' | '7' | '30'>('all')
  const [historyRecipient, setHistoryRecipient] = useState('all')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'infinite'>('all')
  const [lowStockThreshold, setLowStockThreshold] = useState(3)
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(`haxbag:master-chest:low-stock:${campaignId}`))
      setLowStockThreshold(Number.isInteger(stored) && stored >= 1 && stored <= 99 ? stored : 3)
    } catch { setLowStockThreshold(3) }
  }, [campaignId])
  const changeLowStockThreshold = (value: number) => {
    const next = Math.max(1, Math.min(99, Math.floor(value)))
    if (!Number.isFinite(next)) return
    setLowStockThreshold(next)
    try { localStorage.setItem(`haxbag:master-chest:low-stock:${campaignId}`, String(next)) } catch { /* Preferência opcional */ }
  }
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [stockEditor, setStockEditor] = useState<ChestItem | null>(null)
  const [stockDirection, setStockDirection] = useState<'add' | 'remove'>('add')
  const [stockAmount, setStockAmount] = useState('1')
  const [bundle, setBundle] = useState<Record<string, number>>({})
  const [bundleOpen, setBundleOpen] = useState(false)
  const [bundleRecipients, setBundleRecipients] = useState<string[]>([])
  const [bundleRecipientSearch, setBundleRecipientSearch] = useState('')
  const [bundlePresets, setBundlePresets] = useState<BundlePreset[]>([])
  const [bundlePresetName, setBundlePresetName] = useState('')
  const [pendingPresetDelete, setPendingPresetDelete] = useState<string | null>(null)
  const [starterPending, setStarterPending] = useState<DropStarter | null>(null)
  const [sort, setSort] = useState(() => {
    try { return localStorage.getItem('haxbag:chest:sort') || 'newest' } catch { return 'newest' }
  })
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('haxbag:chest:view') === 'list' ? 'list' : 'grid' } catch { return 'grid' }
  })
  useEffect(() => { try { localStorage.setItem('haxbag:chest:view', view) } catch { /* preferência opcional */ } }, [view])
  useEffect(() => { try { localStorage.setItem('haxbag:chest:sort', sort) } catch { /* preferência opcional */ } }, [sort])
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit' | 'duplicate'; itemId?: string; updatedAt?: string } | null>(null)
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft)
  const [importedMetadata, setImportedMetadata] = useState<ChestMetadata | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [deliveryItem, setDeliveryItem] = useState<ChestItem | null>(null)
  const [recipients, setRecipients] = useState<string[]>([])
  const [deliveryQuantity, setDeliveryQuantity] = useState('1')
  const [deleteItem, setDeleteItem] = useState<ChestItem | null>(null)
  const requestVersion = useRef(0)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`haxbag:master-chest:favorites:${campaignId}`) || '[]') as unknown
      setFavorites(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [])
    } catch { setFavorites([]) }
  }, [campaignId])
  const toggleFavorite = (id: string) => {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
      try { localStorage.setItem(`haxbag:master-chest:favorites:${campaignId}`, JSON.stringify(next)) } catch { /* Favoritos locais opcionais. */ }
      return next
    })
  }
  const charactersInCampaign = useMemo(() => characters.filter(c => c.campaign_id === campaignId), [characters, campaignId])
  const visibleRecipients = useMemo(() => charactersInCampaign.filter(c => c.name.toLocaleLowerCase('pt-BR').includes(recipientSearch.toLocaleLowerCase('pt-BR'))), [charactersInCampaign, recipientSearch])
  const visibleHistory = useMemo(() => history.filter(entry => {
    if (!`${entry.item_name} ${entry.character_name}`.toLocaleLowerCase('pt-BR').includes(historySearch.toLocaleLowerCase('pt-BR'))) return false
    if (historyRecipient !== 'all' && entry.character_name !== historyRecipient) return false
    if (historyPeriod !== 'all') {
      const cutoff = Date.now() - Number(historyPeriod) * 24 * 60 * 60 * 1000
      if (new Date(entry.created_at).getTime() < cutoff) return false
    }
    return true
  }), [history, historySearch, historyRecipient, historyPeriod])
  const historyRecipients = useMemo(() => [...new Set(history.map(entry => entry.character_name))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [history])
  const visibleHistoryUnits = visibleHistory.reduce((sum, entry) => sum + entry.quantity, 0)
  const visibleHistoryCharacters = new Set(visibleHistory.map(entry => entry.character_name)).size
  useEffect(() => {
    setBundlePresets(readBundlePresets(campaignId))
    setPendingPresetDelete(null)
    setBundlePresetName('')
  }, [campaignId])
  const persistBundlePresets = (next: BundlePreset[]) => {
    try {
      localStorage.setItem(presetsStorageKey(campaignId), JSON.stringify(next))
      setBundlePresets(next)
      return true
    } catch {
      setError('Não foi possível salvar os modelos neste navegador. Confira as permissões de armazenamento local.')
      return false
    }
  }


  useEffect(() => {
    let cancelled = false
    setInventoryTemplates([])
    if (!templateCharacter || !charactersInCampaign.some(character => character.id === templateCharacter)) return
    void supabase.from('inventory_items')
      .select('id,character_id,name,description,category,quantity,weight,unit_price,currency_id,sale_blocked,metadata')
      .eq('character_id', templateCharacter).order('name')
      .then(({data, error}) => {
        if (cancelled) return
        if (error) setError(`Não foi possível consultar o inventário: ${error.message}`)
        else setInventoryTemplates((data ?? []) as InventoryTemplate[])
      })
    return () => { cancelled = true }
  }, [templateCharacter, charactersInCampaign])

  const importTemplate = async (item: InventoryTemplate) => {
    if (busy) return
    const count = Math.floor(templateQuantities[item.id] ?? item.quantity)
    if (!Number.isInteger(count) || count < 1 || count > 999999) {
      setError('Informe uma quantidade válida para copiar ao baú.'); return
    }
    setBusy('import')
    setError('')
    const metadata = sanitizeInventoryMetadata(item.metadata)
    const categories = Array.isArray(metadata.categories)
      ? metadata.categories.filter((value): value is string => typeof value === 'string') : []
    const {error: importError} = await supabase.from('master_chest_items').insert({
      campaign_id: campaignId, name: item.name, description: item.description,
      category: item.category || categories[0] || 'Diversos', quantity: count, is_infinite: false,
      weight: item.weight, unit_price: item.unit_price ?? 0,
      currency_id: item.currency_id, sale_blocked: item.sale_blocked ?? false,
      status: 'available', metadata: {
        ...metadata, categories: categories.length ? categories : [item.category],
        importedFromInventory: true,
      },
    })
    if (importError) setError(`Não foi possível copiar: ${importError.message}`)
    else {
      setNotice(`${item.name} copiado para o Baú do Mestre com suas propriedades de inventário.`)
      await refresh(true)
    }
    setBusy('')
  }

  const refresh = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current
    if (!quiet) setLoading(true)
    const [stock, deliveries, lootTables] = await Promise.all([
      supabase.from('master_chest_items').select('id,campaign_id,name,description,category,quantity,is_infinite,weight,unit_price,currency_id,sale_blocked,status,metadata,created_at,updated_at')
        .eq('campaign_id', campaignId).order('created_at', { ascending: false }),
      supabase.from('master_chest_delivery_history').select('id,item_name,character_name,quantity,created_at')
        .eq('campaign_id', campaignId).order('created_at', { ascending: false }).limit(300),
      supabase.from('master_chest_loots').select('id,campaign_id,name,description,icon,entries,created_at,updated_at')
        .eq('campaign_id', campaignId).order('created_at', { ascending: false }),
    ])
    if (version !== requestVersion.current) return
    if (stock.error) setError(`Não foi possível abrir o baú: ${stock.error.message}. Confira master_chest_v50.sql e execute master_chest_infinite_v67.sql no Supabase.`)
    else { setItems((stock.data ?? []) as ChestItem[]); setError('') }
    if (deliveries.error && !stock.error) setError(`Histórico indisponível: ${deliveries.error.message}. Execute master_chest_v50.sql.`)
    else if (!deliveries.error) setHistory((deliveries.data ?? []) as DeliveryRecord[])
    if (lootTables.error) {
      setLoots([])
      setLootError(`Loots indisponíveis: ${lootTables.error.message}. Execute supabase/master_chest_loots_v65.sql para ativar esta função.`)
    } else {
      const rows = (lootTables.data ?? []) as LootTable[]
      setLoots(rows.map(row => ({ ...row, entries: validLootEntries(row.entries) })))
      setLootError('')
    }
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    setItems([])
    setHistory([])
    setLoots([])
    setLootResult(null)
    setLootBatchResults([])
    setLootRequestedCount(1)
    setLootDrawHistory([])
    setLootEditor(null)
    setLootDelete(null)
    setLootSearch('')
    setLootError('')
    setTab('items')
    setSearch('')
    setHistorySearch('')
    setHistoryRecipient('all')
    setHistoryPeriod('all')
    setRecipientSearch('')
    setCategoryFilter('all')
    setRarityFilter('all')
    setStatusFilter('all')
    setStockFilter('all')
    setOnlyFavorites(false)
    setBundle({})
    setBundleOpen(false)
    setBundleRecipients([])
    setBundleRecipientSearch('')
    setStockEditor(null)
    setEditor(null)
    setImportedMetadata(null)
    setEditorDirty(false)
    setDiscardConfirm(false)
    setDeliveryItem(null)
    setDeleteItem(null)
    setError('')
    setNotice('')
    void refresh()
    return () => { requestVersion.current++ }
  }, [refresh])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR')
    return items.filter(item => {
      if (categoryFilter !== 'all' && !itemCategories(item).includes(categoryFilter)) return false
      if (rarityFilter !== 'all' && itemRarity(item) !== rarityFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (stockFilter === 'low' && (isInfinite(item) || item.quantity > lowStockThreshold)) return false
      if (stockFilter === 'infinite' && !isInfinite(item)) return false
      if (onlyFavorites && !favorites.includes(item.id)) return false
      if (!q) return true
      return [item.name, item.description ?? '', ...itemCategories(item), ...itemTags(item)]
        .some(value => value.toLocaleLowerCase('pt-BR').includes(q))
    }).sort((a, b) => {
      if (sort === 'favorites') return Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) || a.name.localeCompare(b.name, 'pt-BR')
      if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
      if (sort === 'quantity') return Number(isInfinite(b)) - Number(isInfinite(a)) || b.quantity - a.quantity || a.name.localeCompare(b.name, 'pt-BR')
      if (sort === 'quantity-low') return Number(isInfinite(a)) - Number(isInfinite(b)) || a.quantity - b.quantity || a.name.localeCompare(b.name, 'pt-BR')
      if (sort === 'rarity') return RARITIES.findIndex(r => r.value === itemRarity(b)) - RARITIES.findIndex(r => r.value === itemRarity(a))
      if (sort === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [items, search, categoryFilter, rarityFilter, statusFilter, stockFilter, onlyFavorites, favorites, sort, lowStockThreshold])

  const filteredLoots = loots.filter(loot =>
    `${loot.name} ${loot.description} ${loot.entries.map(entry => items.find(item => item.id === entry.itemId)?.name || '').join(' ')}`
      .toLocaleLowerCase('pt-BR').includes(lootSearch.trim().toLocaleLowerCase('pt-BR')))
  const lootOdds = (loot: LootTable | LootDraft) => {
    const eligible = loot.entries.filter(entry => lootItemIsAvailable(items.find(item => item.id === entry.itemId)))
    return { eligible, totalWeight: eligible.reduce((sum, entry) => sum + entry.weight, 0) }
  }

  // Totais numéricos representam somente as pilhas finitas: infinito não pode ser somado.
  const finiteAvailable = items.filter(item => item.status === 'available' && !isInfinite(item))
  const infiniteStockCount = items.filter(item => item.status === 'available' && isInfinite(item)).length
  const totalStock = finiteAvailable.reduce((total, item) => total + item.quantity, 0)
  const stockWeight = finiteAvailable.reduce((total, item) => total + item.weight * item.quantity, 0)
  const variableScarcityInStock = finiteAvailable.some(item => scarcityRange(item) !== null)
  const variableMoneyInStock = finiteAvailable.some(item => moneyRange(item) !== null)
  const stockValueByCurrency = useMemo(() => {
    const totals = new Map<string, number>()
    items.filter(item => item.status === 'available' && !isInfinite(item)).forEach(item => {
      const key = item.currency_id || ''
      totals.set(key, (totals.get(key) || 0) + item.unit_price * item.quantity)
    })
    return [...totals.entries()].filter(([, amount]) => amount > 0)
  }, [items])
  const availableFiltered = filtered.filter(item => item.status === 'available' && hasStock(item))
  const addFilteredToBundle = () => {
    const remaining = Math.max(0, 30 - Object.keys(bundle).length)
    const eligible = availableFiltered.filter(item => !(item.id in bundle)).slice(0, remaining)
    if (!eligible.length) {
      setNotice('Não há novos drops disponíveis para adicionar, ou a remessa já atingiu o limite de 30 tipos.')
      return
    }
    setBundle(current => ({ ...current, ...Object.fromEntries(eligible.map(item => [item.id, 1])) }))
    setNotice(`${eligible.length} tipo(s) de drop adicionado(s) à remessa, com 1 unidade de cada.`)
  }
  const saveBundlePreset = () => {
    if (bundleEntries.length < 1 || bundleEntries.length > 30) { setError('Separe de 1 a 30 tipos de drop antes de salvar um modelo.'); return }
    if (bundlePresets.length >= 12) { setError('Você pode guardar até 12 modelos de remessa por campanha. Apague algum para criar outro.'); return }
    if (bundleEntries.some(line => !line.item || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999999)) {
      setError('Revise as quantidades e retire drops excluídos antes de salvar o modelo.'); return
    }
    const name = bundlePresetName.trim().slice(0, 60) || `Remessa ${bundlePresets.length + 1}`
    const preset: BundlePreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, name, createdAt: Date.now(),
      lines: bundleEntries.map(line => ({ itemId: line.id, quantity: line.quantity })),
    }
    if (persistBundlePresets([...bundlePresets, preset])) {
      setBundlePresetName('')
      setNotice(`Modelo “${name}” salvo somente neste navegador.`)
      setError('')
    }
  }
  const loadBundlePreset = (preset: BundlePreset) => {
    const matched = preset.lines.filter(line => items.some(item => item.id === line.itemId))
    if (!matched.length) { setError('Os drops deste modelo não estão mais no baú.'); return }
    setBundle(Object.fromEntries(matched.map(line => [line.itemId, line.quantity])))
    setBundleRecipients([])
    setBundleRecipientSearch('')
    const unavailable = matched.filter(line => {
      const item = items.find(candidate => candidate.id === line.itemId)
      return !item || item.status !== 'available' || !hasStock(item, line.quantity)
    }).length
    setNotice(`Modelo “${preset.name}” carregado. ${preset.lines.length - matched.length} item(ns) removido(s) não foram carregados.${unavailable ? ` Revise ${unavailable} item(ns) reservados ou sem estoque.` : ''}`)
    setError('')
  }
  const removeBundlePreset = (id: string) => {
    if (persistBundlePresets(bundlePresets.filter(preset => preset.id !== id))) {
      setPendingPresetDelete(null)
      setNotice('Modelo de remessa removido deste navegador.')
    }
  }
  const reserved = items.filter(item => item.status === 'reserved').length
  const totalDelivered = history.reduce((total, record) => total + record.quantity, 0)
  const categoryList = [...new Set(items.flatMap(itemCategories))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const lowStockCount = items.filter(item => !isInfinite(item) && item.quantity <= lowStockThreshold && item.status === 'available').length
  const categoryInsights = useMemo(() => Object.entries(items.reduce<Record<string, number>>((acc, item) => {
    itemCategories(item).forEach(category => { acc[category] = (acc[category] ?? 0) + 1 })
    return acc
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 5), [items])
  const rarityInsights = useMemo(() => RARITIES.map(rarity => ({
    ...rarity,
    count: items.filter(item => itemRarity(item) === rarity.value).length,
  })).filter(entry => entry.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR')).slice(0, 4), [items])
  const readyLoots = useMemo(() => loots.filter(loot => loot.entries.some(entry => lootItemIsAvailable(items.find(item => item.id === entry.itemId)))).length, [loots, items])
  const stalledLoots = useMemo(() => loots.filter(loot => loot.entries.length > 0 && !loot.entries.some(entry => lootItemIsAvailable(items.find(item => item.id === entry.itemId)))).length, [loots, items])
  const latestDelivery = useMemo(() => history.reduce<DeliveryRecord | null>((latest, record) => {
    if (!latest) return record
    return new Date(record.created_at).getTime() > new Date(latest.created_at).getTime() ? record : latest
  }, null), [history])
  const favoriteCount = items.filter(item => favorites.includes(item.id)).length
  const bundleEntries = useMemo(() => Object.entries(bundle).map(([id, quantity]) => ({
    id, item: items.find(candidate => candidate.id === id), quantity,
  })), [bundle, items])
  const bundleCount = Object.keys(bundle).length
  const bundleTotal = bundleEntries.reduce((total, line) => total + line.quantity, 0)
  const bundleWeight = bundleEntries.reduce((total, line) => total + (line.item?.weight || 0) * line.quantity, 0)
  const bundleMissing = bundleEntries.filter(line => !line.item || line.item.status !== 'available' || !hasStock(line.item, line.quantity)).length
  const bundleInvalid = bundleEntries.some(line => !line.item || line.item.status !== 'available' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999999 || !hasStock(line.item, line.quantity * bundleRecipients.length))
  const bundleRecipientsVisible = charactersInCampaign.filter(character => character.name.toLocaleLowerCase('pt-BR').includes(bundleRecipientSearch.toLocaleLowerCase('pt-BR')))
  const toggleBundleItem = (item: ChestItem) => {
    if (!bundle[item.id] && Object.keys(bundle).length >= 30) {
      setNotice('Uma remessa pode conter no máximo 30 tipos de drop.')
      return
    }
    setBundle(current => {
      const next = { ...current }
      if (next[item.id]) delete next[item.id]
      else next[item.id] = 1
      return next
    })
    setNotice('')
  }

  const applyDropStarter = (starter: DropStarter) => {
    setDraft({ ...emptyDraft(), ...starter.updates })
    setEditorDirty(true)
    setDiscardConfirm(false)
    setStarterPending(null)
    setError('')
  }
  const startEditor = (item?: ChestItem, duplicate = false, fromInventory = false) => {
    setError('')
    setNotice('')
    setEditorDirty(false)
    setDiscardConfirm(false)
    setStarterPending(null)
    setImportedMetadata(fromInventory && item ? { ...(item.metadata ?? {}), importedFromInventory: true } : null)
    if (!item) { setDraft(emptyDraft()); setEditor({ mode: 'new' }); return }
    const meta = item.metadata ?? {}
    setDraft({
      name: duplicate ? `${item.name} (cópia)` : item.name,
      description: item.description ?? '', category: item.category,
      categories: itemCategories(item),
      rarity: itemRarity(item), icon: itemIcon(item), quantity: String(item.quantity), infiniteStock: isInfinite(item),
      weight: String(item.weight), unitPrice: String(item.unit_price ?? 0),
      currencyId: item.currency_id ?? '', tags: itemTags(item).join(', '),
      notes: typeof meta.notes === 'string' && !fromInventory ? meta.notes : '',
      notifyOnDelivery: meta.notifyOnDelivery === true && typeof meta.deliveryMessage === 'string' && meta.deliveryMessage.trim().length > 0,
      deliveryMessage: typeof meta.deliveryMessage === 'string' && !fromInventory ? meta.deliveryMessage : '',
      status: fromInventory ? 'available' : item.status, saleBlocked: item.sale_blocked,
      dropType: meta.dropType === 'money' ? 'money' : 'item',
      equipmentType: maybeValue(meta.equipmentType, ['none','armor','protection','cybernetic'], 'none'),
      armorClass: maybeValue(meta.armorClass, ['leve','media','pesada'], 'leve'),
      armorCoverage: maybeValue(meta.armorCoverage, ['cortante_perfurante','especial_bruto'], 'cortante_perfurante'),
      protectionTier: maybeValue(meta.protectionTier, ['basica','moderada','avancada'], 'basica'),
      protectionMode: maybeValue(meta.protectionMode, ['resistencia','sanidade'], 'resistencia'),
      weaponClass: maybeValue(meta.weaponClass, ['improvised','advanced','special','black_red','mutable'], 'improvised'),
      scarcityLevel: maybeValue(String(meta.scarcityLevel ?? '1'), ['1','2','3','4'], '1'),
      scarcityExhausted: meta.scarcityExhausted === true,
      scarcityMode: meta.scarcityMode === 'random' ? 'random' : 'fixed',
      scarcityMinLevel: String(meta.scarcityMinLevel ?? '1'),
      scarcityMaxLevel: String(meta.scarcityMaxLevel ?? '4'),
      moneyMode: meta.rewardMode === 'range' ? 'range' : 'fixed',
      moneyMin: String(meta.rewardMin ?? '100'), moneyMax: String(meta.rewardMax ?? '1000'),
      cyberneticCategory: typeof (meta.cyberneticData as Record<string, unknown> | undefined)?.category === 'string'
        ? String((meta.cyberneticData as Record<string, unknown>).category) : 'Outro',
      cyberneticLocation: typeof (meta.cyberneticData as Record<string, unknown> | undefined)?.location === 'string'
        ? String((meta.cyberneticData as Record<string, unknown>).location) : '',
      cyberneticLoad: String((meta.cyberneticData as Record<string, unknown> | undefined)?.biologicalLoad ?? meta.biologicalLoad ?? 0),
      cyberneticEffects: typeof (meta.cyberneticData as Record<string, unknown> | undefined)?.effects === 'string'
        ? String((meta.cyberneticData as Record<string, unknown>).effects) : '',
    })
    setEditor(fromInventory ? { mode: 'new' } : {
      mode: duplicate ? 'duplicate' : 'edit', itemId: item.id, updatedAt: item.updated_at,
    })
  }
  const startEditorFromInventory = (item: InventoryTemplate) => {
    const metadata = sanitizeInventoryMetadata(item.metadata)
    const copyCount = templateQuantities[item.id] ?? item.quantity
    startEditor({
      id: item.id, campaign_id: campaignId, name: item.name, description: item.description,
      category: item.category, quantity: copyCount, is_infinite: false, weight: item.weight,
      unit_price: item.unit_price ?? 0, currency_id: item.currency_id,
      sale_blocked: item.sale_blocked ?? false, status: 'available',
      metadata, created_at: '', updated_at: '',
    }, false, true)
    setImportOpen(false)
  }
  const setField = <K extends keyof ItemDraft>(field: K, value: ItemDraft[K]) => {
    setDraft(current => ({ ...current, [field]: value }))
    setEditorDirty(true)
    setDiscardConfirm(false)
    setStarterPending(null)
  }
  const toggleCategory = (category: string) => {
    setDraft(current => {
      const categories = current.categories.includes(category)
        ? current.categories.filter(value => value !== category)
        : [...current.categories, category]
      if (!categories.length) return current
      return { ...current, categories, category: categories.includes(current.category) ? current.category : categories[0] }
    })
    setEditorDirty(true)
    setDiscardConfirm(false)
  }
  const closeEditor = () => {
    if (busy) return
    if (editorDirty) { setDiscardConfirm(true); return }
    setEditor(null)
    setImportedMetadata(null)
  }
  const discardEditor = () => {
    if (busy) return
    setEditor(null)
    setImportedMetadata(null)
    setEditorDirty(false)
    setDiscardConfirm(false)
    setStarterPending(null)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const requestedQuantity = Number(draft.quantity)
    const quantity = draft.infiniteStock && (!Number.isInteger(requestedQuantity) || requestedQuantity < 1 || requestedQuantity > 999999) ? 1 : requestedQuantity
    const rawWeight = draft.weight.trim() ? Number(draft.weight.replace(',', '.')) : NaN
    const rawPrice = draft.unitPrice.trim() ? Number(draft.unitPrice.replace(',', '.')) : NaN
    const isMoney = draft.dropType === 'money'
    const isConsumable = isConsumableDraft(draft)
    const equipmentTypeForSave = !isMoney && draft.categories.includes('Equipamento') ? draft.equipmentType : 'none' 
    const moneyMin = Number(draft.moneyMin)
    const moneyMax = Number(draft.moneyMax)
    const scarcityMin = Number(draft.scarcityMinLevel)
    const scarcityMax = Number(draft.scarcityMaxLevel)
    const weight = isConsumable && draft.scarcityMode === 'random'
      ? scarcityRules[String(scarcityMin) as ItemDraft['scarcityLevel']]?.charge ?? 7
      : isConsumable ? draftEffectiveWeight(draft) : rawWeight
    const randomMoney = isMoney && draft.moneyMode === 'range'
    const randomScarcity = isConsumable && draft.scarcityMode === 'random'
    const price = randomMoney ? moneyMin : isConsumable && draft.scarcityExhausted ? 0 : rawPrice
    if (!draft.name.trim()) { setError('Informe o nome do drop.'); return }
    if (draft.notifyOnDelivery && !draft.deliveryMessage.trim()) { setError('Escreva a mensagem que o jogador receberá ou desative a opção.'); return }
    if (draft.deliveryMessage.length > 2000) { setError('A mensagem pode ter no máximo 2.000 caracteres.'); return }
    if (isMoney && !draft.currencyId) { setError('Selecione a moeda que será creditada na carteira.'); return }
    if (randomMoney && (!Number.isInteger(moneyMin) || !Number.isInteger(moneyMax) || moneyMin < 1 || moneyMax > 1000000000 || moneyMin > moneyMax)) {
      setError('Informe um intervalo de dinheiro válido, com mínimo e máximo inteiros entre 1 e 1.000.000.000.'); return
    }
    if (isMoney && !randomMoney && (!Number.isInteger(rawPrice) || rawPrice < 1 || rawPrice > 1000000000)) {
      setError('O valor fixo de dinheiro precisa ser um número inteiro positivo.'); return
    }
    if (randomScarcity && (!Number.isInteger(scarcityMin) || !Number.isInteger(scarcityMax) || scarcityMin < 1 || scarcityMax > 4 || scarcityMin > scarcityMax)) {
      setError('O intervalo de escassez precisa ficar entre os níveis 1 e 4, com mínimo menor ou igual ao máximo.'); return
    }
    if (!isMoney && (!draft.categories.length || !draft.categories.includes(draft.category))) { setError('Escolha pelo menos uma classificação e uma categoria principal.'); return }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999999) { setError('A quantidade deve ser um número inteiro entre 1 e 999.999.'); return }
    if (!Number.isFinite(weight) || weight < 0 || weight > 100000) { setError('O peso precisa estar entre 0 e 100.000 kg.'); return }
    if (!Number.isFinite(price) || price < 0 || price > 1000000000) { setError('Informe um valor unitário válido e não negativo.'); return }
    const biologicalLoad = Number(draft.cyberneticLoad.trim() ? draft.cyberneticLoad.replace(',', '.') : 0)
    if (equipmentTypeForSave === 'cybernetic' && (!Number.isFinite(biologicalLoad) || biologicalLoad < 0 || biologicalLoad > 100000)) { setError('Informe uma carga biológica válida (0 a 100.000).'); return }
    const original = editor?.itemId ? items.find(item => item.id === editor.itemId) : undefined
    const tags = [...new Set(draft.tags.split(',').map(tag => tag.trim()).filter(Boolean))].slice(0, 15)
    const sourceMetadata = original?.metadata ?? importedMetadata ?? {}
    const payload = {
      campaign_id: campaignId, name: draft.name.trim(), description: draft.description.trim() || null,
      category: isMoney ? 'Dinheiro' : draft.category, quantity, is_infinite: draft.infiniteStock, weight: isMoney ? 0 : weight, unit_price: price,
      currency_id: draft.currencyId || null, sale_blocked: isMoney ? true : draft.saleBlocked, status: draft.status,
      metadata: {
        ...sourceMetadata,
        rewardMode: randomMoney ? 'range' : 'fixed',
        rewardMin: randomMoney ? moneyMin : null,
        rewardMax: randomMoney ? moneyMax : null,
        scarcityMode: randomScarcity ? 'random' : 'fixed',
        scarcityMinLevel: randomScarcity ? scarcityMin : null,
        scarcityMaxLevel: randomScarcity ? scarcityMax : null,
        dropType: draft.dropType, icon: draft.icon.trim() || (isMoney ? '💰' : '📦'), rarity: draft.rarity,
        tags, notes: draft.notes.trim(),
        notifyOnDelivery: draft.notifyOnDelivery && Boolean(draft.deliveryMessage.trim()),
        deliveryMessage: draft.notifyOnDelivery ? draft.deliveryMessage.trim() : '',
        categories: [draft.category, ...draft.categories.filter(category => category !== draft.category)],
        equipmentType: equipmentTypeForSave,
        cybernetic: equipmentTypeForSave === 'cybernetic',
        cyberneticEquipped: false,
        biologicalLoad: equipmentTypeForSave === 'cybernetic' ? biologicalLoad : null,
        cyberneticData: equipmentTypeForSave === 'cybernetic' ? {
          ...((sourceMetadata.cyberneticData && typeof sourceMetadata.cyberneticData === 'object' && !Array.isArray(sourceMetadata.cyberneticData))
            ? sourceMetadata.cyberneticData as Record<string, unknown> : {}),
          name: draft.name.trim(), category: draft.cyberneticCategory,
          description: draft.description.trim(), location: draft.cyberneticLocation.trim(),
          biologicalLoad, cost: String(price), effects: draft.cyberneticEffects.trim(), status: 'stored',
        } : null,
        armorClass: equipmentTypeForSave === 'armor' ? draft.armorClass : null,
        armorCoverage: equipmentTypeForSave === 'armor' ? (draft.armorClass === 'pesada' ? 'todos' : draft.armorCoverage) : null,
        protectionTier: equipmentTypeForSave === 'protection' ? draft.protectionTier : null,
        protectionMode: equipmentTypeForSave === 'protection' ? draft.protectionMode : null,
        weaponClass: draft.categories.includes('Armas') ? draft.weaponClass : null,
        weaponDamage: draft.categories.includes('Armas') ? ({improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'} as Record<string,string>)[draft.weaponClass] : null,
        weaponWeight: draft.categories.includes('Armas') ? weight : null,
        scarcityLevel: isConsumable ? (randomScarcity ? scarcityMin : Number(draft.scarcityLevel)) : null,
        scarcityDie: isConsumable ? scarcityRules[randomScarcity ? String(scarcityMin) as ItemDraft['scarcityLevel'] : draft.scarcityLevel].die : null,
        scarcityCharge: isConsumable ? weight : null,
        scarcityExhausted: isConsumable && !randomScarcity ? draft.scarcityExhausted : false,
      },
    }
    setBusy('save')
    setError('')
    const result = editor?.mode === 'edit' && editor.itemId
      ? await supabase.from('master_chest_items').update(payload).eq('id', editor.itemId).eq('campaign_id', campaignId).eq('updated_at', editor.updatedAt).select('id').single()
      : await supabase.from('master_chest_items').insert(payload).select('id').single()
    if (result.error) setError(result.error.code === 'PGRST116' ? 'Esse drop foi alterado desde que você abriu o editor. Feche, atualize o baú e edite novamente para não substituir mudanças recentes.' : `Não foi possível salvar o item: ${result.error.message}`)
    else {
      setEditor(null)
      setImportedMetadata(null)
      setEditorDirty(false)
      setDiscardConfirm(false)
      setNotice(editor?.mode === 'edit' ? 'Item atualizado no baú.' : 'Novo drop guardado no baú.')
      await refresh(true)
    }
    setBusy('')
  }

  const openStockEditor = (item: ChestItem) => {
    setStockEditor(item)
    setStockAmount('1')
    setStockDirection('add')
    setError('')
    setNotice('')
  }
  const adjustStock = async () => {
    if (!stockEditor || busy || isInfinite(stockEditor)) return
    const amount = Number(stockAmount)
    if (!Number.isInteger(amount) || amount < 1 || amount > 999999) { setError('Informe uma quantidade inteira válida.'); return }
    const delta = amount * (stockDirection === 'add' ? 1 : -1)
    if (stockEditor.quantity + delta < 1 || stockEditor.quantity + delta > 999999) { setError('O estoque final precisa ficar entre 1 e 999.999. Para remover todas as unidades, exclua o item.'); return }
    setBusy('stock')
    setError('')
    const result = await supabase.rpc('master_chest_adjust_stock', { p_chest_item_id: stockEditor.id, p_delta: delta })
    if (result.error) setError(`Não foi possível alterar o estoque: ${result.error.message}`)
    else { setNotice(`Estoque de ${stockEditor.name} atualizado para ${result.data} unidade(s).`); setStockEditor(null); await refresh(true) }
    setBusy('')
  }
  const toggleInfiniteStock = async () => {
    if (!stockEditor || busy) return
    setBusy('stock-mode')
    setError('')
    const nextMode = !isInfinite(stockEditor)
    const { data, error: updateError } = await supabase.from('master_chest_items')
      .update({ is_infinite: nextMode })
      .eq('id', stockEditor.id).eq('campaign_id', campaignId)
      .eq('updated_at', stockEditor.updated_at).select('id').maybeSingle()
    if (updateError) setError(`Não foi possível alterar o modo de estoque: ${updateError.message}`)
    else if (!data) { setError('Outro mestre alterou este drop. Atualize o Baú e tente novamente.'); await refresh(true) }
    else {
      setNotice(nextMode ? `Estoque infinito ativado para ${stockEditor.name}.` : `Estoque limitado restaurado para ${stockEditor.name}.`)
      setStockEditor(null)
      await refresh(true)
    }
    setBusy('')
  }
  const openBundle = () => {
    setBundleOpen(true)
    setBundleRecipients([])
    setBundleRecipientSearch('')
    setError('')
    setNotice('')
  }
  const deliverBundle = async () => {
    if (busy || !bundleCount) return
    if (bundleRecipients.length < 1 || bundleRecipients.length > 50) { setError('Escolha de 1 a 50 personagens.'); return }
    if (bundleInvalid) { setError('Há drops indisponíveis ou sem estoque suficiente. Revise sua remessa.'); return }
    const payload = bundleEntries.map(line => ({ id: line.item!.id, quantity: line.quantity }))
    setBusy('bundle')
    setError('')
    const result = await supabase.rpc('master_chest_deliver_bundle', {
      p_items: payload, p_character_ids: bundleRecipients,
    })
    if (result.error) setError(`Não foi possível enviar a remessa: ${result.error.message}`)
    else {
      const recipientsCount = bundleRecipients.length
      setBundleOpen(false)
      setBundle({})
      setBundleRecipients([])
      setNotice(`Remessa com ${payload.length} tipos de drop entregue a ${recipientsCount} personagem${recipientsCount === 1 ? '' : 's'}!`)
      await refresh(true)
      onDelivered()
    }
    setBusy('')
  }

  const toggleReserved = async (item: ChestItem) => {
    if (busy) return
    setBusy(`status:${item.id}`)
    setError('')
    const newStatus = item.status === 'reserved' ? 'available' : 'reserved'
    const { data: updated, error: updateError } = await supabase.from('master_chest_items').update({ status: newStatus })
      .eq('id', item.id).eq('campaign_id', campaignId).eq('updated_at', item.updated_at).select('id').maybeSingle()
    if (updateError) setError(updateError.message)
    else if (!updated) { setError('Este drop foi alterado em outra sessão. Atualize o baú antes de mudar a reserva.'); await refresh(true) }
    else { setNotice(newStatus === 'reserved' ? 'Item reservado. Não poderá ser entregue até ser liberado.' : 'Item liberado para distribuição.'); await refresh(true) }
    setBusy('')
  }

  const confirmDelete = async () => {
    if (!deleteItem || busy) return
    setBusy('delete')
    setError('')
    const { error: deleteError } = await supabase.from('master_chest_items').delete()
      .eq('id', deleteItem.id).eq('campaign_id', campaignId)
    if (deleteError) setError(`Erro ao excluir: ${deleteError.message}`)
    else { setNotice(`"${deleteItem.name}" removido do baú.`); setDeleteItem(null); await refresh(true) }
    setBusy('')
  }

  const openDelivery = (item: ChestItem) => {
    setDeliveryItem(item)
    setRecipients([])
    setRecipientSearch('')
    setDeliveryQuantity('1')
    setNotice('')
    setError('')
  }
  const deliver = async () => {
    if (!deliveryItem || busy) return
    const quantity = asNumber(deliveryQuantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999999) { setError('Informe uma quantidade inteira entre 1 e 999.999.'); return }
    if (!recipients.length || recipients.length > 50) { setError('Selecione entre 1 e 50 personagens.'); return }
    if (!hasStock(deliveryItem, recipients.length * quantity)) { setError('O estoque não é suficiente para essa distribuição.'); return }
    setBusy('delivery')
    setError('')
    const { error: deliveryError } = await supabase.rpc('master_chest_deliver_batch', {
      p_chest_item_id: deliveryItem.id,
      p_character_ids: recipients,
      p_quantity: quantity,
    })
    if (deliveryError) setError(`Não foi possível distribuir: ${deliveryError.message}`)
    else {
      const count = recipients.length
      setDeliveryItem(null)
      setNotice(`${quantity} × ${deliveryItem.name} entregue a ${count} personagem${count === 1 ? '' : 's'}!${moneyRange(deliveryItem) || scarcityRange(deliveryItem) ? ' Consulte o histórico para conferir os resultados sorteados.' : ''}`)
      await refresh(true)
      onDelivered()
    }
    setBusy('')
  }

  const openLootEditor = (loot?: LootTable, duplicate = false) => {
    if (busy) return
    setLootDraft(loot ? { name: duplicate ? `${loot.name} (cópia)`.slice(0, 80) : loot.name, description: loot.description || '', icon: loot.icon || '🎲',
      entries: validLootEntries(loot.entries).map(entry => ({ ...entry })) } : emptyLootDraft())
    setLootEditor(loot && !duplicate ? { id: loot.id, updatedAt: loot.updated_at } : {})
    setLootChanceInputs({})
    setLootDirty(false)
    setLootDiscardConfirm(false)
    setLootSelectedItem('')
    setError('')
  }
  const closeLootEditor = () => {
    if (busy) return
    if (lootDirty) { setLootDiscardConfirm(true); return }
    setLootEditor(null)
  }
  const setLootField = <K extends keyof LootDraft>(field: K, value: LootDraft[K]) => {
    setLootDraft(current => ({ ...current, [field]: value }))
    setLootDirty(true)
    setLootDiscardConfirm(false)
  }
  const addLootOption = () => {
    if (!lootSelectedItem || lootDraft.entries.length >= 30 || lootDraft.entries.some(line => line.itemId === lootSelectedItem)) return
    if (!items.some(item => item.id === lootSelectedItem)) return
    setLootChanceInputs(current => { const next = { ...current }; delete next[lootSelectedItem]; return next })
    setLootField('entries', [...lootDraft.entries, { itemId: lootSelectedItem, weight: 1 }])
    setLootSelectedItem('')
  }
  const changeLootChance = (itemId: string, text: string) => {
    // Permite apagar tudo e digitar novamente, sem gravar 0/NaN no loot.
    if (!/^\d{0,4}$/.test(text)) return
    setLootChanceInputs(current => ({ ...current, [itemId]: text }))
    setLootDirty(true)
    setLootDiscardConfirm(false)
    const number = Number(text)
    if (text !== '' && Number.isInteger(number) && number >= 1 && number <= 1000) {
      setLootDraft(current => ({ ...current, entries: current.entries.map(entry =>
        entry.itemId === itemId ? { ...entry, weight: number } : entry) }))
    }
  }
  const finalizeLootChance = (itemId: string) => {
    const text = lootChanceInputs[itemId]
    if (text === undefined) return
    const chance = parseLootChance(text)
    setLootChanceInputs(current => ({ ...current, [itemId]: String(chance) }))
    setLootDraft(current => ({ ...current, entries: current.entries.map(entry =>
      entry.itemId === itemId ? { ...entry, weight: chance } : entry) }))
  }
  const applyLootWeights = (mode: 'equal' | 'rarity') => {
    if (busy || !lootDraft.entries.length) return
    setLootChanceInputs({})
    const byRarity: Record<string, number> = { 'comum': 100, 'incomum': 50, 'raro': 25, 'épico': 12, 'mítico': 5, 'relíquia': 2 }
    setLootField('entries', lootDraft.entries.map(entry => {
      const item = items.find(candidate => candidate.id === entry.itemId)
      return { ...entry, weight: mode === 'equal' ? 1 : (byRarity[item ? itemRarity(item) : 'comum'] ?? 100) }
    }))
  }
  const saveLoot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !lootEditor) return
    if (!lootDraft.name.trim() || lootDraft.name.trim().length > 80) { setError('O loot precisa ter um nome de até 80 caracteres.'); return }
    // Campos vazios ou inválidos voltam a 1 antes de montar o payload para o Supabase.
    const entriesToSave = lootDraft.entries.map(entry => ({ ...entry,
      weight: parseLootChance(lootChanceInputs[entry.itemId], entry.weight) }))
    if (entriesToSave.length < 1 || entriesToSave.length > 30) { setError('Escolha de 1 a 30 drops para este loot.'); return }
    if (new Set(entriesToSave.map(line => line.itemId)).size !== entriesToSave.length ||
      entriesToSave.some(line => !items.some(item => item.id === line.itemId) || !Number.isInteger(line.weight) || line.weight < 1 || line.weight > 1000)) {
      setError('Revise os drops e suas chances (1 a 1.000). Não pode haver duplicados ou itens excluídos.'); return
    }
    setBusy('loot-save')
    setError('')
    const payload = { campaign_id: campaignId, name: lootDraft.name.trim(),
      description: lootDraft.description.trim(), icon: lootDraft.icon.trim() || '🎲',
      entries: entriesToSave }
    const result = lootEditor.id
      ? await supabase.from('master_chest_loots').update(payload).eq('id', lootEditor.id)
        .eq('campaign_id', campaignId).eq('updated_at', lootEditor.updatedAt).select('id').maybeSingle()
      : await supabase.from('master_chest_loots').insert(payload).select('id').maybeSingle()
    if (result.error) setError(`Não foi possível salvar o loot: ${result.error.message}`)
    else if (!result.data) setError('Esse loot foi alterado em outra sessão. Atualize a página e tente novamente.')
    else {
      setNotice(`Loot “${payload.name}” ${lootEditor.id ? 'atualizado' : 'criado'} com ${payload.entries.length} opções.`)
      setLootEditor(null)
      setLootDirty(false)
      await refresh(true)
    }
    setBusy('')
  }
  const removeLoot = async () => {
    if (!lootDelete || busy) return
    setBusy('loot-delete')
    setError('')
    const { data, error: deleteError } = await supabase.from('master_chest_loots').delete()
      .eq('id', lootDelete.id).eq('campaign_id', campaignId).eq('updated_at', lootDelete.updated_at).select('id').maybeSingle()
    if (deleteError) setError(`Não foi possível excluir o loot: ${deleteError.message}`)
    else if (!data) setError('Esse loot foi alterado em outra sessão. Atualize a página antes de excluir.')
    else {
      setNotice(`Loot “${lootDelete.name}” excluído. Nenhum item do Baú foi removido.`)
      if (lootResult?.lootId === lootDelete.id) { setLootResult(null); setLootBatchResults([]) }
      setLootDelete(null)
      await refresh(true)
    }
    setBusy('')
  }
  const drawLoot = async (loot: LootTable, requestedCount: 1 | 3 | 5 = 1) => {
    if (busy) return
    const entries = validLootEntries(loot.entries)
    if (!entries.length) { setError('Este loot não tem drops válidos. Edite suas opções.'); return }
    setBusy('loot-roll')
    setError('')
    setNotice('')
    // Verifica o estoque no momento do sorteio. A sequência simula o consumo,
    // mas não altera o banco: somente a entrega real remove unidades do Baú.
    const { data, error: drawError } = await supabase.from('master_chest_items')
      .select('id,campaign_id,name,description,category,quantity,is_infinite,weight,unit_price,currency_id,sale_blocked,status,metadata,created_at,updated_at')
      .eq('campaign_id', campaignId).in('id', entries.map(entry => entry.itemId))
    if (drawError) { setError(`Não foi possível verificar o estoque do loot: ${drawError.message}`); setBusy(''); return }
    const freshItems = (data ?? []) as ChestItem[]
    const freshMap = new Map(freshItems.map(item => [item.id, item]))
    setItems(current => current
      .filter(item => !entries.some(entry => entry.itemId === item.id) || freshMap.has(item.id))
      .map(item => freshMap.get(item.id) || item))
    const remaining = new Map(freshItems.map(item => [item.id, item.quantity]))
    const draws: LootDraw[] = []
    for (let index = 0; index < requestedCount; index++) {
      const available = entries.flatMap(entry => {
        const item = freshMap.get(entry.itemId)
        return lootItemIsAvailable(item) && item && (isInfinite(item) || (remaining.get(item.id) ?? 0) > 0)
          ? [{ item, weight: entry.weight }] : []
      })
      const totalWeight = available.reduce((sum, option) => sum + option.weight, 0)
      if (!totalWeight) break
      const random = typeof crypto !== 'undefined' && 'getRandomValues' in crypto
        ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
        : Math.random()
      let draw = random * totalWeight
      const selected = available.find(option => (draw -= option.weight) < 0) ?? available[available.length - 1]
      if (!isInfinite(selected.item)) remaining.set(selected.item.id, (remaining.get(selected.item.id) ?? 0) - 1)
      draws.push({ lootId: loot.id, lootName: loot.name, item: selected.item,
        probability: selected.weight / totalWeight * 100, eligibleCount: available.length,
        excludedCount: entries.length - available.length, drawnAt: Date.now() + index })
    }
    if (!draws.length) {
      setLootResult(null)
      setLootBatchResults([])
      setError('Nenhum drop deste loot está disponível: confira as reservas e o estoque.')
      setBusy('')
      return
    }
    setLootResult(draws[0])
    setLootBatchResults(draws)
    setLootRequestedCount(requestedCount)
    setLootDrawHistory(current => [...draws, ...current].slice(0, 15))
    if (draws.length < requestedCount) setNotice(`Foram sorteados ${draws.length} de ${requestedCount} drops: não há estoque suficiente para continuar a sequência.`)
    setBusy('')
  }
  const addDrawnDropsToBundle = () => {
    if (!lootBatchResults.length) return
    const additions = new Map<string, number>()
    lootBatchResults.forEach(result => additions.set(result.item.id, (additions.get(result.item.id) ?? 0) + 1))
    const newTypes = [...additions.keys()].filter(id => !bundle[id]).length
    if (Object.keys(bundle).length + newTypes > 30) {
      setError('A remessa aceita até 30 tipos de drops. Remova alguns itens antes de adicionar os sorteados.')
      return
    }
    const invalid = [...additions.entries()].find(([id, quantity]) => {
      const item = items.find(candidate => candidate.id === id)
      return !lootItemIsAvailable(item) || !item || !hasStock(item, (bundle[id] ?? 0) + quantity)
    })
    if (invalid) {
      setError('Não há estoque suficiente para somar todos os resultados à remessa. Ajuste a remessa ou atualize o Baú.')
      return
    }
    setBundle(current => {
      const next = { ...current }
      additions.forEach((quantity, id) => { next[id] = (next[id] ?? 0) + quantity })
      return next
    })
    setError('')
    setNotice(`${lootBatchResults.length} resultado(s) adicionados à remessa. Revise os destinatários antes de confirmar a entrega.`)
  }
  const exportLoots = () => exportCsv('haxbag-bau-loots.csv', [
    ['Loot', 'Descrição', 'Drop', 'Chance relativa', 'Chance efetiva', 'Estoque', 'Situação'],
    ...filteredLoots.flatMap(loot => {
      const odds = lootOdds(loot)
      return loot.entries.map(line => {
        const item = items.find(entry => entry.id === line.itemId)
        return [loot.name, loot.description, item?.name ?? 'Item excluído', line.weight,
          odds.eligible.some(entry => entry.itemId === line.itemId) ? formatChance(line.weight, odds.totalWeight) : 'Fora do sorteio',
          item ? (isInfinite(item) ? 'Infinito' : item.quantity) : 0, !item ? 'Item removido' : item.status === 'reserved' ? 'Reservado' : !hasStock(item) ? 'Esgotado' : 'Disponível']
      })
    }),
  ])

  const exportStock = () => exportCsv('haxbag-bau-itens.csv', [
    ['Item', 'Categoria principal', 'Classificações', 'Raridade', 'Quantidade', 'Peso/un.', 'Valor/un.', 'Moeda', 'Status', 'Descrição', 'Marcadores'],
    ...filtered.map(item => [item.name, item.category, itemCategories(item).join(', '), rarityLabel(itemRarity(item)), isInfinite(item) ? 'Infinito' : item.quantity, item.weight, item.unit_price,
      currencyOptions.find(currency => currency.id === item.currency_id)?.name ?? 'Sem moeda', item.status === 'reserved' ? 'Reservado' : 'Disponível', item.description ?? '', itemTags(item).join(', ')]),
  ])
  const exportHistory = () => exportCsv('haxbag-bau-entregas.csv', [
    ['Data', 'Item', 'Personagem', 'Quantidade'], ...visibleHistory.map(record => [formatDate(record.created_at), record.item_name, record.character_name, record.quantity]),
  ])

  return <div className="mc-page">
    <header className="mc-hero">
      <div className="mc-hero-copy">
        <span className="mc-eyebrow">✦ ARSENAL DA CAMPANHA · ACESSO DO MESTRE</span>
        <h1><span aria-hidden="true">🗝️</span> Baú do Mestre</h1>
        <p>Prepare o próximo encontro, organize recompensas e entregue drops aos personagens sem sair da campanha.</p>
        <div className="mc-hero-actions">
          <button type="button" className="mc-button mc-primary" onClick={() => startEditor()}>＋ Criar drop</button>
          <button type="button" className="mc-button mc-ghost" onClick={() => { setTab('loots'); openLootEditor() }}>🎲 Criar loot</button>
          <button type="button" className="mc-button mc-ghost" onClick={openBundle} disabled={!bundleCount && !bundlePresets.length}>↗ Remessas e modelos {bundleCount ? `(${bundleCount})` : ''}</button>
          <button type="button" className="mc-button mc-ghost" onClick={() => setImportOpen(value => !value)}>⇢ Copiar do inventário</button>
          <button type="button" className="mc-button mc-ghost" onClick={() => void refresh()} disabled={loading || Boolean(busy)}>↻ Atualizar</button>
        </div>
      </div>
      <div className="mc-hero-art" aria-hidden="true"><span className="mc-chest-glyph">✧</span><span className="mc-chest-icon">▣</span><span className="mc-chest-engraving">HÄXBAG · LOOT VAULT</span></div>
    </header>

    {importOpen && <section className="mc-inventory-import" aria-label="Copiar itens do inventário comum">
      <div className="mc-import-header"><div><span className="mc-eyebrow">COMPATIBILIDADE COM O INVENTÁRIO</span><h2>Copiar itens existentes</h2><p>Use um item de qualquer personagem desta campanha como modelo. A cópia preserva categoria, equipamento, raridade, preço, peso e demais propriedades; o item original não é removido.</p></div><button type="button" className="mc-button mc-ghost" onClick={() => setImportOpen(false)}>Fechar</button></div>
      <div className="mc-import-controls">
        <label>Inventário de origem <select value={templateCharacter} onChange={event => setTemplateCharacter(event.target.value)}><option value="">Selecione um personagem</option>{charactersInCampaign.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
        <label>Pesquisar item <input type="search" placeholder="Nome ou categoria..." value={templateSearch} onChange={event => setTemplateSearch(event.target.value)}/></label>
      </div>
      {templateCharacter && <div className="mc-import-list">
        {inventoryTemplates.filter(item => [item.name, item.category, item.description ?? '', ...(Array.isArray(item.metadata?.categories) ? item.metadata.categories : []), ...(Array.isArray(item.metadata?.tags) ? item.metadata.tags : [])].filter(value => typeof value === 'string').join(' ').toLocaleLowerCase('pt-BR').includes(templateSearch.toLocaleLowerCase('pt-BR'))).map(item => <div className="mc-import-item" key={item.id}>
          <span className="mc-import-icon">{typeof item.metadata?.icon === 'string' ? item.metadata.icon : '📦'}</span>
          <div><strong>{item.name}</strong><small>{item.category} · {item.quantity} no inventário · {item.weight} kg/un.</small></div>
          <label>Copiar unidades <input type="number" min="1" max="999999" value={templateQuantities[item.id] ?? item.quantity} onChange={event => setTemplateQuantities(current => ({...current,[item.id]:Number(event.target.value)}))}/></label>
          <div className="mc-import-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => startEditorFromInventory(item)}>Editar cópia</button><button type="button" className="mc-button mc-primary" disabled={Boolean(busy)} onClick={() => void importTemplate(item)}>Copiar direto</button></div>
        </div>)}
        {inventoryTemplates.length === 0 && <p>Nenhum item encontrado neste inventário.</p>}
        {inventoryTemplates.length > 0 && !inventoryTemplates.some(item => [item.name, item.category, item.description ?? '', ...(Array.isArray(item.metadata?.categories) ? item.metadata.categories : []), ...(Array.isArray(item.metadata?.tags) ? item.metadata.tags : [])].filter(value => typeof value === 'string').join(' ').toLocaleLowerCase('pt-BR').includes(templateSearch.toLocaleLowerCase('pt-BR'))) && <p>Não há itens correspondentes à busca.</p>}
      </div>}
    </section>}

    <div className="mc-stats" aria-label="Resumo do baú">
      <div className="mc-stat"><span>TIPOS DE ITEM</span><strong>{items.length}</strong><small>recompensas cadastradas</small></div>
      <div className="mc-stat"><span>EM ESTOQUE</span><strong>{totalStock.toLocaleString('pt-BR')}</strong><small>unidades finitas disponíveis</small></div>
      <div className="mc-stat mc-infinity-stat"><span>ESTOQUE INFINITO</span><strong>∞ {infiniteStockCount}</strong><small>tipos disponíveis sem limite</small></div>
      <button type="button" className="mc-stat mc-stat-interactive" onClick={() => { setTab('items'); setStockFilter('low'); setStatusFilter('available') }} title={`Mostrar drops com até ${lowStockThreshold} unidades disponíveis`}><span>ESTOQUE BAIXO</span><strong>{lowStockCount}</strong><small>drops disponíveis com até {lowStockThreshold} unidades</small></button>
      <div className="mc-stat"><span>RESERVADOS</span><strong>{reserved}</strong><small>itens aguardando liberação</small></div>
      <div className="mc-stat"><span>ENTREGAS</span><strong>{totalDelivered}</strong><small>unidades nas últimas 300 entregas</small></div>
    </div>

    <div className="mc-stock-overview" aria-label="Indicadores do estoque disponível">
      <div><span>⚖ Peso de estoque finito</span><strong>{stockWeight.toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg</strong>{variableScarcityInStock && <small>Referência: o peso real de consumíveis com escassez aleatória depende do nível sorteado.</small>}</div>
      <div><span>◇ Valor de estoque finito</span><strong>{stockValueByCurrency.length ? `${stockValueByCurrency.length} moeda(s)` : 'Sem valor'}</strong><small>{stockValueByCurrency.map(([currencyId, amount]) => currencyValue(amount, currencyId || null, currencyOptions)).join(' · ') || 'Nenhum preço cadastrado'}{variableMoneyInStock ? ' · valores aleatórios calculados pelo mínimo' : ''}</small></div>
      <div><span>✓ Drops prontos</span><strong>{items.filter(item => item.status === 'available' && hasStock(item)).length}</strong></div>
    </div>

    <section className="mc-curation-grid" aria-label="Curadoria do baú do mestre">
      <article className="mc-curation-card mc-curation-card-categories">
        <div className="mc-curation-head"><span className="mc-eyebrow">CURADORIA</span><h2>Linhas do baú</h2><p>As categorias mais presentes ajudam a perceber onde a campanha está mais abastecida.</p></div>
        {categoryInsights.length > 0 ? <div className="mc-curation-list">{categoryInsights.map(([category, count]) => <div className="mc-curation-row" key={category}><div><strong>{category}</strong><small>{count} {count === 1 ? 'item' : 'itens'} com esta classificação</small></div><span>{count}</span></div>)}</div> : <p className="mc-curation-empty">Ainda não há categorias suficientes para analisar.</p>}
      </article>

      <article className="mc-curation-card mc-curation-card-rarity">
        <div className="mc-curation-head"><span className="mc-eyebrow">RARIDADE & COLEÇÃO</span><h2>Curva de valor</h2><p>Veja rapidamente onde estão as peças mais comuns, valiosas e favoritas do baú.</p></div>
        <div className="mc-curation-pill-row">
          <span className="mc-curation-pill">★ {favoriteCount} favorito(s)</span>
          <span className="mc-curation-pill">🎯 {availableFiltered.length} disponíveis nos filtros</span>
          <span className="mc-curation-pill">🧩 {bundlePresets.length} modelo(s) salvo(s)</span>
        </div>
        {rarityInsights.length > 0 ? <div className="mc-curation-list">{rarityInsights.map(entry => <div className="mc-curation-row" key={entry.value}><div><strong>{entry.label}</strong><small>Distribuição atual no acervo do mestre</small></div><span>{entry.count}</span></div>)}</div> : <p className="mc-curation-empty">Cadastre drops para compor a distribuição por raridade.</p>}
      </article>

      <article className="mc-curation-card mc-curation-card-rhythm">
        <div className="mc-curation-head"><span className="mc-eyebrow">RITMO DE SESSÃO</span><h2>Pulso da campanha</h2><p>Acompanhe o estado dos loots, das entregas e da remessa atual sem sair do Baú.</p></div>
        <div className="mc-curation-metrics">
          <div><span>Loots prontos</span><strong>{readyLoots}</strong><small>{stalledLoots ? `${stalledLoots} sem drops disponíveis` : 'Todos com itens aptos para sorteio'}</small></div>
          <div><span>Remessa ativa</span><strong>{bundleCount}</strong><small>{bundleCount ? `${bundleRecipients.length} destinatário(s) selecionado(s)` : 'Nenhum drop separado no momento'}</small></div>
        </div>
        {latestDelivery ? <div className="mc-curation-latest"><span>Última entrega</span><strong>{latestDelivery.item_name}</strong><small>Para {latestDelivery.character_name} · ×{latestDelivery.quantity} · {formatDate(latestDelivery.created_at)}</small></div> : <p className="mc-curation-empty">Ainda não há entregas registradas nesta campanha.</p>}
        <div className="mc-curation-actions">
          <button type="button" className="mc-button mc-ghost" onClick={() => setTab('loots')}>Abrir loots</button>
          <button type="button" className="mc-button mc-ghost" onClick={() => setTab('history')}>Ver histórico</button>
          <button type="button" className="mc-button mc-primary" onClick={openBundle} disabled={!bundleCount && !bundlePresets.length}>Preparar remessa</button>
        </div>
      </article>
    </section>
    {bundleCount > 0 && <aside className="mc-bundle-strip" aria-label="Remessa em preparo">
      <div className="mc-bundle-strip-icon" aria-hidden="true">🎒</div>
      <div><strong>{bundleCount} {bundleCount === 1 ? 'drop separado' : 'drops separados'} para entrega</strong><span>{bundleTotal} unidade(s) · {bundleWeight.toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg por personagem · {bundleMissing ? `${bundleMissing} indisponível(is)` : 'pronto para revisão'}</span></div>
      <button type="button" className="mc-button mc-primary" onClick={openBundle}>Revisar remessa ↗</button>
      <button type="button" className="mc-button mc-ghost" onClick={() => setBundle({})} aria-label="Esvaziar remessa">Limpar</button>
    </aside>}
    {(error || notice) && <div className={`mc-feedback ${error ? 'mc-error' : 'mc-success'}`} role={error ? 'alert' : 'status'}>
      <span>{error ? '⚠' : '✓'}</span><p>{error || notice}</p><button type="button" aria-label="Fechar mensagem" onClick={() => { setError(''); setNotice('') }}>×</button>
    </div>}

    <div className="mc-main">
      <div className="mc-main-header">
        <div className="mc-tabs" role="tablist" aria-label="Seções do baú">
          <button type="button" role="tab" aria-selected={tab === 'items'} className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>▦ Itens <span>{items.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'loots'} className={tab === 'loots' ? 'active' : ''} onClick={() => setTab('loots')}>🎲 Loots <span>{loots.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>◷ Histórico <span>{history.length}</span></button>
        </div>
        <div className="mc-main-header-actions">
          <button type="button" className="mc-button mc-ghost mc-export" onClick={tab === 'items' ? exportStock : tab === 'loots' ? exportLoots : exportHistory} disabled={tab === 'items' ? !filtered.length : tab === 'loots' ? !filteredLoots.length : !history.length}>↓ Exportar CSV</button>
        </div>
      </div>

      {tab === 'items' ? <div role="tabpanel" className="mc-inventory">
        <div className="mc-toolbar">
          <label className="mc-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar item, descrição ou marcador..." aria-label="Buscar drops"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">×</button>}</label>
          <label className="mc-field-select"><span>Categoria</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">Todas</option>{categoryList.map(category => <option value={category} key={category}>{category}</option>)}</select></label>
          <label className="mc-field-select"><span>Raridade</span><select value={rarityFilter} onChange={event => setRarityFilter(event.target.value)}><option value="all">Todas</option>{RARITIES.map(rarity => <option key={rarity.value} value={rarity.value}>{rarity.label}</option>)}</select></label>
          <label className="mc-field-select"><span>Situação</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos</option><option value="available">Disponíveis</option><option value="reserved">Reservados</option></select></label>
          <label className="mc-field-select"><span>Ordenar</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Mais recentes</option><option value="updated">Atualizados</option><option value="name">Nome A–Z</option><option value="quantity">Maior estoque</option><option value="quantity-low">Menor estoque</option><option value="favorites">Favoritos primeiro</option><option value="rarity">Maior raridade</option></select></label>
          <div className="mc-view-switch" role="group" aria-label="Modo de exibição"><button className={view === 'grid' ? 'selected' : ''} title="Grade" aria-pressed={view === 'grid'} type="button" onClick={() => setView('grid')}>▦</button><button className={view === 'list' ? 'selected' : ''} title="Lista" aria-pressed={view === 'list'} type="button" onClick={() => setView('list')}>☷</button></div>
        </div>
        <div className="mc-quick-filters" aria-label="Filtros rápidos">
          <button type="button" className={onlyFavorites ? 'selected' : ''} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(value => !value)}>★ Favoritos <small>{items.filter(item => favorites.includes(item.id)).length}</small></button>
          <button type="button" className={stockFilter === 'low' ? 'selected' : ''} aria-pressed={stockFilter === 'low'} onClick={() => setStockFilter(value => value === 'low' ? 'all' : 'low')}>◷ Estoque baixo <small>{lowStockCount}</small></button><label className="mc-stock-threshold">Avisar com até <input type="number" min="1" max="99" aria-label="Limite de estoque baixo" value={lowStockThreshold} onChange={event => changeLowStockThreshold(Number(event.target.value))} /> un.</label>
          <button type="button" className={stockFilter === 'infinite' ? 'selected' : ''} aria-pressed={stockFilter === 'infinite'} onClick={() => setStockFilter(value => value === 'infinite' ? 'all' : 'infinite')}>∞ Ilimitados <small>{items.filter(isInfinite).length}</small></button>
          <button type="button" className={statusFilter === 'available' ? 'selected' : ''} aria-pressed={statusFilter === 'available'} onClick={() => setStatusFilter(value => value === 'available' ? 'all' : 'available')}>✓ Prontos para drop</button>
        </div>
        <div className="mc-bulk-actions">
          <span>Preparação rápida de recompensas</span>
          <button type="button" className="mc-button mc-ghost" onClick={addFilteredToBundle} disabled={!availableFiltered.length || Boolean(busy)}>＋ Adicionar disponíveis à remessa ({availableFiltered.length})</button>
          {bundleCount > 0 && <button type="button" className="mc-button mc-primary" onClick={openBundle}>Revisar {bundleCount} selecionado(s)</button>}
        </div>
        <div className="mc-results"><strong>{filtered.length}</strong> de {items.length} drops exibidos{(search || categoryFilter !== 'all' || rarityFilter !== 'all' || statusFilter !== 'all' || stockFilter !== 'all' || onlyFavorites) && <button type="button" onClick={() => { setSearch(''); setCategoryFilter('all'); setRarityFilter('all'); setStatusFilter('all'); setStockFilter('all'); setOnlyFavorites(false) }}>Limpar filtros</button>}</div>
        {loading ? <div className="mc-empty">Carregando os tesouros da campanha...</div> : items.length === 0 ? <div className="mc-empty"><div className="mc-empty-icon">🗝️</div><h2>O baú espera seus primeiros tesouros</h2><p>Crie armas, consumíveis, tesouros ou recompensas de missão para distribuir quando quiser.</p><button type="button" className="mc-button mc-primary" onClick={() => startEditor()}>Criar primeiro drop</button></div> : filtered.length === 0 ? <div className="mc-empty"><h2>Nenhum item encontrado</h2><p>Tente outra busca ou remova os filtros.</p><button type="button" className="mc-button mc-ghost" onClick={() => { setSearch(''); setCategoryFilter('all'); setRarityFilter('all'); setStatusFilter('all'); setStockFilter('all'); setOnlyFavorites(false) }}>Limpar filtros</button></div> : <div className={`mc-item-collection mc-${view}`}>
          {filtered.map(item => <article className={`mc-item mc-rarity-${rarityTone(itemRarity(item))} ${item.status === 'reserved' ? 'mc-reserved' : ''}`} key={item.id}>
            <div className="mc-item-top"><div className="mc-item-icon" aria-hidden="true">{itemIcon(item)}</div><div className="mc-item-labels"><span className="mc-category">{isMoneyDrop(item) ? "💰 Dinheiro" : item.category}</span><span className={`mc-rarity mc-rarity-text-${rarityTone(itemRarity(item))}`}>{rarityLabel(itemRarity(item))}</span></div><div className="mc-item-menu"><button type="button" className={`mc-favorite ${favorites.includes(item.id) ? 'active' : ''}`} aria-pressed={favorites.includes(item.id)} title={favorites.includes(item.id) ? 'Desfavoritar drop' : 'Favoritar drop'} aria-label={favorites.includes(item.id) ? `Remover ${item.name} dos favoritos` : `Favoritar ${item.name}`} onClick={() => toggleFavorite(item.id)}>{favorites.includes(item.id) ? '★' : '☆'}</button><button type="button" title="Duplicar item" aria-label={`Duplicar ${item.name}`} disabled={Boolean(busy)} onClick={() => startEditor(item, true)}>⧉</button><button type="button" title="Editar item" aria-label={`Editar ${item.name}`} disabled={Boolean(busy)} onClick={() => startEditor(item)}>✎</button></div></div>
            <div className="mc-item-info"><h3 title={item.name}>{item.name}</h3><p>{item.description || 'Sem descrição adicional.'}</p>{item.metadata?.notifyOnDelivery === true && typeof item.metadata?.deliveryMessage === 'string' && Boolean(item.metadata.deliveryMessage.trim()) && <small className="mc-message-tag">✉ Mensagem ao receber</small>}</div>
            {itemCategories(item).length > 1 && <div className="mc-category-extras">{itemCategories(item).filter(category => category !== item.category).slice(0, 3).map(category => <span key={category}>{category}</span>)}{itemCategories(item).length > 4 && <span>+{itemCategories(item).length - 4}</span>}</div>}
            {(moneyRange(item) || scarcityRange(item)) && <div className="mc-random-badge">🎲 {rewardSummary(item, currencyOptions)}</div>}
            {itemTags(item).length > 0 && <div className="mc-tags">{itemTags(item).slice(0, 4).map(tag => <span key={tag}>#{tag}</span>)}{itemTags(item).length > 4 && <span>+{itemTags(item).length - 4}</span>}</div>}
            <div className="mc-item-meta"><span><strong>{isInfinite(item) ? '∞' : item.quantity}</strong> {isInfinite(item) ? 'ilimitado' : 'un.'} <button type="button" className="mc-restock" title={`Gerenciar estoque de ${item.name}`} aria-label={`Gerenciar estoque de ${item.name}`} disabled={Boolean(busy)} onClick={() => openStockEditor(item)}>±</button></span>{!isMoneyDrop(item) && <span>{scarcityRange(item) ? `${([7,5,3,1][scarcityRange(item)!.max - 1])}–${([7,5,3,1][scarcityRange(item)!.min - 1])} cargas/un.` : item.metadata?.equipmentType === 'armor' ? `Peso ${item.weight.toLocaleString('pt-BR')} kg` : `${item.weight.toLocaleString('pt-BR')} kg/un.`}</span>}{item.unit_price > 0 && <span>{moneyRange(item) ? `💰 ${currencyValue(moneyRange(item)!.min, item.currency_id, currencyOptions)}–${currencyValue(moneyRange(item)!.max, item.currency_id, currencyOptions)}/un.` : `${isMoneyDrop(item) ? '💰 ' : ''}${currencyValue(item.unit_price, item.currency_id, currencyOptions)}${isMoneyDrop(item) ? '/un.' : ''}`}</span>}</div>
            <div className="mc-item-bottom"><span className={`mc-status ${item.status === 'reserved' ? 'reserved' : 'available'}`}><i/>{item.status === 'reserved' ? 'Reservado' : isInfinite(item) ? '∞ Ilimitado' : item.quantity <= lowStockThreshold ? 'Estoque baixo' : 'Pronto para drop'}</span><div className="mc-item-actions"><button type="button" className="mc-button mc-icon-action" title={item.status === 'reserved' ? 'Liberar para entrega' : 'Reservar item'} onClick={() => void toggleReserved(item)} disabled={Boolean(busy)}>{item.status === 'reserved' ? '◇ Liberar' : '♧ Reservar'}</button><button type="button" className={`mc-button mc-bundle-add ${bundle[item.id] ? 'selected' : ''}`} disabled={Boolean(busy) || item.status === 'reserved'} aria-pressed={Boolean(bundle[item.id])} onClick={() => toggleBundleItem(item)}>{bundle[item.id] ? '✓ Na remessa' : '＋ Remessa'}</button><button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || item.status === 'reserved' || charactersInCampaign.length === 0} onClick={() => openDelivery(item)}>↗ Entregar</button></div></div>
            <button type="button" className="mc-delete-link" disabled={Boolean(busy)} onClick={() => { setDeleteItem(item); setError('') }}>Excluir item</button>
          </article>)}
        </div>}
      </div> : tab === 'loots' ? <div className="mc-loot-page" role="tabpanel">
        <div className="mc-loot-intro">
          <div><span className="mc-eyebrow">MESA DE SORTEIOS</span><h2>Loots da campanha</h2><p>Crie conjuntos de drops, defina a chance relativa de cada opção e sorteie 1, 3 ou 5 recompensas. O sorteio respeita o estoque sem consumir itens até a entrega.</p></div>
          <button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || Boolean(lootError)} onClick={() => openLootEditor()}>＋ Criar loot</button>
        </div>
        {lootError && <div className="mc-feedback mc-error" role="alert"><span>⚠</span><p>{lootError}</p></div>}
        <div className="mc-loot-toolbar"><label className="mc-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar loots" placeholder="Buscar loot ou drop..." value={lootSearch} onChange={event => setLootSearch(event.target.value)}/></label><small>{filteredLoots.length} de {loots.length} loots</small></div>
        {lootResult && <section className="mc-loot-result" aria-live="polite">
          <span className="mc-eyebrow">🎲 RESULTADO DO SORTEIO · {lootResult.lootName} · {lootBatchResults.length} {lootBatchResults.length === 1 ? 'drop' : 'drops'}</span>
          <div className="mc-loot-draws">{lootBatchResults.map((result,index) =>
            <div className="mc-loot-result-body" key={`${result.item.id}-${index}`}>
              <span className="mc-loot-result-index">{index + 1}</span>
              <span className="mc-loot-result-icon" aria-hidden="true">{itemIcon(result.item)}</span>
              <div><h3>{result.item.name}</h3><p>{rarityLabel(itemRarity(result.item))} · {result.probability.toLocaleString('pt-BR', {maximumFractionDigits: 1})}% de chance na {index + 1}ª rolagem</p><small>{result.excludedCount ? `${result.excludedCount} opção(ões) fora desta rolagem. ` : ''}Estoque no início: {stockLabel(result.item)}{rewardSummary(result.item, currencyOptions) ? ` · ${rewardSummary(result.item, currencyOptions)}` : ''}</small></div>
            </div>)}</div>
          <p className="mc-loot-result-disclaimer">O loot sorteia o tipo de drop. Valores de dinheiro e níveis de escassez configurados como aleatórios são sorteados na entrega, para cada personagem. O estoque só é descontado após a confirmação.</p>
          <div className="mc-loot-result-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => { const loot = loots.find(candidate => candidate.id === lootResult.lootId); if (loot) void drawLoot(loot, lootRequestedCount) }}>↻ Repetir sorteio</button><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={addDrawnDropsToBundle}>＋ Adicionar {lootBatchResults.length === 1 ? 'à remessa' : 'todos à remessa'}</button>{lootBatchResults.length === 1 && <button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || charactersInCampaign.length === 0} onClick={() => openDelivery(lootResult.item)}>↗ Entregar drop</button>}{bundleCount > 0 && <button type="button" className="mc-button mc-ghost" onClick={openBundle}>Revisar remessa</button>}<button type="button" className="mc-loot-dismiss" aria-label="Dispensar resultado" onClick={() => { setLootResult(null); setLootBatchResults([]) }}>×</button></div>
        </section>}
        {loading && !lootError ? <div className="mc-empty">Carregando loots...</div> : !lootError && filteredLoots.length === 0 ? <div className="mc-empty"><div className="mc-empty-icon">🎲</div><h2>{loots.length ? 'Nenhum loot corresponde à busca' : 'Seu primeiro loot está a um clique'}</h2><p>{loots.length ? 'Tente procurar outro nome.' : 'Reúna os drops do Baú em uma tabela de sorteio com chances ajustáveis.'}</p><button type="button" className="mc-button mc-primary" onClick={() => openLootEditor()}>＋ Criar loot</button></div> : !lootError && <div className="mc-loot-grid">{filteredLoots.map(loot => {
          const odds = lootOdds(loot)
          return <article className="mc-loot-card" key={loot.id}>
            <div className="mc-loot-card-head"><div className="mc-loot-card-icon" aria-hidden="true">{loot.icon || '🎲'}</div><div><h3>{loot.name}</h3><p>{loot.description || 'Tabela de recompensas personalizável.'}</p></div></div>
            <div className="mc-loot-pills"><span>{loot.entries.length} opções</span><span>{odds.eligible.length} disponíveis</span>{odds.eligible.length < loot.entries.length && <span className="mc-loot-warning">{loot.entries.length - odds.eligible.length} indisponíveis</span>}</div>
            <div className="mc-loot-odds">{loot.entries.map(line => {
              const item = items.find(candidate => candidate.id === line.itemId)
              const eligible = lootItemIsAvailable(item)
              const chance = eligible ? formatChance(line.weight, odds.totalWeight) : 'Fora do sorteio'
              return <div className={`mc-loot-option ${eligible ? '' : 'unavailable'}`} key={line.itemId}><span aria-hidden="true">{item ? itemIcon(item) : '❔'}</span><div className="mc-loot-option-info"><strong title={item?.name || 'Item removido'}>{item?.name || 'Item removido'}</strong>{item && rewardSummary(item, currencyOptions) && <small>{rewardSummary(item, currencyOptions)}</small>}{isInfinite(item) && <span className="mc-unlimited-tag" title="Estoque infinito">∞ Ilimitado</span>}{eligible && <div className="mc-loot-chance-track" aria-hidden="true"><span style={{width: `${Math.min(100, odds.totalWeight ? line.weight * 100 / odds.totalWeight : 0)}%`}}/></div>}</div><small>{chance}</small></div>
            })}</div>
            <div className="mc-loot-card-actions"><button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || !odds.eligible.length} onClick={() => void drawLoot(loot)}>{busy === 'loot-roll' ? 'Sorteando...' : '🎲 Sortear 1'}</button><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy) || !odds.eligible.length} title="Sortear até 3 drops sem exceder o estoque" onClick={() => void drawLoot(loot, 3)}>×3</button><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy) || !odds.eligible.length} title="Sortear até 5 drops sem exceder o estoque" onClick={() => void drawLoot(loot, 5)}>×5</button><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => openLootEditor(loot)}>Editar</button><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => openLootEditor(loot, true)} title="Criar uma cópia independente deste loot">Duplicar</button><button type="button" className="mc-loot-trash" disabled={Boolean(busy)} onClick={() => { setLootDelete(loot); setError('') }} title={`Excluir loot ${loot.name}`} aria-label={`Excluir loot ${loot.name}`}>♲</button></div>
          </article>
        })}</div>}
        {lootDrawHistory.length > 0 && <div className="mc-loot-log"><strong>Últimos sorteios desta sessão ({lootDrawHistory.length}/15)</strong><button type="button" className="mc-button mc-ghost" onClick={() => exportCsv('haxbag-sorteios-da-sessao.csv', [['Data/hora', 'Loot', 'Drop', 'Chance no sorteio (%)'], ...lootDrawHistory.map(draw => [new Date(draw.drawnAt).toLocaleString('pt-BR'), draw.lootName, draw.item.name, draw.probability.toFixed(2)])])}>↓ Exportar sorteios CSV</button><div>{lootDrawHistory.map((draw,index) => <span key={`${draw.drawnAt}-${index}`}><b>{draw.item.name}</b> · {draw.lootName}</span>)}</div><small>Este registro é temporário e não representa uma entrega. Só entregar ou confirmar uma remessa altera o estoque.</small></div>}
      </div> : <div className="mc-history" role="tabpanel">
        <div className="mc-history-title"><div><h2>Registro de entregas</h2><p>Histórico das 300 entregas mais recentes da campanha, registrado pelo banco de dados.</p></div><span>{history.length} registros</span></div>
        <div className="mc-history-filters">
          <label className="mc-search mc-history-search"><span aria-hidden="true">⌕</span><input aria-label="Pesquisar histórico" type="search" placeholder="Buscar item ou personagem..." value={historySearch} onChange={event => setHistorySearch(event.target.value)}/>{historySearch && <button type="button" onClick={() => setHistorySearch('')} aria-label="Limpar pesquisa">×</button>}</label>
          <label className="mc-field-select"><span>Personagem</span><select value={historyRecipient} onChange={event => setHistoryRecipient(event.target.value)}><option value="all">Todos</option>{historyRecipients.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label className="mc-field-select"><span>Período</span><select value={historyPeriod} onChange={event => setHistoryPeriod(event.target.value as 'all' | '7' | '30')}><option value="all">Todas as datas</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label>
          {(historySearch || historyRecipient !== 'all' || historyPeriod !== 'all') && <button type="button" className="mc-button mc-ghost" onClick={() => { setHistorySearch(''); setHistoryRecipient('all'); setHistoryPeriod('all') }}>Limpar</button>}
        </div>
        <div className="mc-history-count">{visibleHistory.length} de {history.length} registros exibidos</div>
        <div className="mc-history-insights" aria-label="Resumo do histórico filtrado">
          <div><span>Entregas registradas</span><strong>{visibleHistory.length}</strong></div>
          <div><span>Unidades distribuídas</span><strong>{visibleHistoryUnits.toLocaleString('pt-BR')}</strong></div>
          <div><span>Personagens atendidos</span><strong>{visibleHistoryCharacters}</strong></div>
        </div>
        {loading ? <div className="mc-empty">Carregando histórico...</div> : visibleHistory.length === 0 ? <div className="mc-empty"><div className="mc-empty-icon">📜</div><h2>{history.length ? 'Nenhum registro encontrado' : 'Nenhuma entrega registrada'}</h2><p>{history.length ? 'Tente outro nome de personagem ou item.' : 'As recompensas distribuídas pelo novo Baú do Mestre aparecerão aqui.'}</p></div> : <div className="mc-history-list">{visibleHistory.map(record => <div className="mc-history-row" key={record.id}><span className="mc-history-mark">↗</span><div className="mc-history-text"><strong>{record.item_name}</strong><small>Entregue para <b>{record.character_name}</b></small></div><span className="mc-history-quantity">×{record.quantity}</span><time dateTime={record.created_at}>{formatDate(record.created_at)}</time></div>)}</div>}
      </div>}
    </div>

    {lootEditor && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeLootEditor() }}><section className="mc-modal mc-loot-modal" role="dialog" aria-modal="true" aria-labelledby="mc-loot-editor-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (lootDiscardConfirm) setLootDiscardConfirm(false); else closeLootEditor() } }}>
      <div className="mc-modal-head"><div><span className="mc-eyebrow">🎲 GERADOR DE RECOMPENSAS</span><h2 id="mc-loot-editor-title">{lootEditor.id ? 'Editar loot' : 'Criar loot'}</h2><p className="mc-help-text">Selecione os drops que podem sair e ajuste a chance relativa de cada um.</p></div><button type="button" className="mc-close" aria-label="Fechar" disabled={Boolean(busy)} onClick={closeLootEditor}>×</button></div>
      <form className="mc-loot-form" onSubmit={event => void saveLoot(event)}>
        <div className="mc-loot-form-fields"><label>Nome do loot <input required autoFocus maxLength={80} value={lootDraft.name} onChange={event => setLootField('name', event.target.value)} placeholder="Ex.: Recompensa do chefe"/></label><label>Ícone <input maxLength={12} value={lootDraft.icon} onChange={event => setLootField('icon', event.target.value)}/></label><label className="mc-span-2">Descrição <textarea rows={2} maxLength={1000} value={lootDraft.description} onChange={event => setLootField('description', event.target.value)} placeholder="Ex.: Tesouros encontrados no fim da missão"/></label></div>
        <div className="mc-loot-entries-head"><div><strong>Opções do loot</strong><p>A chance é um valor relativo, não uma porcentagem fixa. Quanto maior, maior a probabilidade em relação às outras opções disponíveis.</p></div><span>{lootDraft.entries.length}/30</span></div>
        {lootDraft.entries.length > 0 && <div className="mc-loot-weight-presets" role="group" aria-label="Predefinições de chances"><span>Distribuir chances:</span><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => applyLootWeights('equal')}>⚖ Chances iguais</button><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => applyLootWeights('rarity')}>✦ Por raridade</button><small>Por raridade: comum 100, incomum 50, raro 25, épico 12, mítico 5, relíquia 2.</small></div>}
        <div className="mc-loot-add"><select aria-label="Selecionar drop para adicionar ao loot" value={lootSelectedItem} onChange={event => setLootSelectedItem(event.target.value)}><option value="">Escolha um drop do Baú...</option>{items.filter(item => !lootDraft.entries.some(line => line.itemId === item.id)).sort((a,b) => a.name.localeCompare(b.name,'pt-BR')).map(item => <option key={item.id} value={item.id}>{item.name}{!lootItemIsAvailable(item) ? ' · indisponível' : ` · ${item.quantity} em estoque`}</option>)}</select><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy) || !lootSelectedItem || lootDraft.entries.length >= 30} onClick={addLootOption}>＋ Adicionar</button></div>
        <div className="mc-loot-editor-list">{lootDraft.entries.length ? lootDraft.entries.map(line => {
          const item = items.find(candidate => candidate.id === line.itemId)
          const odds = lootOdds(lootDraft)
          const available = lootItemIsAvailable(item)
          return <div className={`mc-loot-edit-line ${available ? '' : 'unavailable'}`} key={line.itemId}><span aria-hidden="true">{item ? itemIcon(item) : '❔'}</span><div><strong>{item?.name || 'Drop excluído'}</strong><small>{!item ? 'Removido do Baú' : item.status === 'reserved' ? 'Reservado: fora do sorteio' : item.quantity <= 0 ? 'Sem estoque' : `${item.quantity} no estoque · chance atual ${formatChance(line.weight, odds.totalWeight)}`}</small>{available && <div className="mc-loot-chance-track" role="meter" aria-label={`Chance de ${item?.name ?? 'drop'}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={odds.totalWeight ? Math.round(line.weight * 100 / odds.totalWeight) : 0}><span style={{width: `${Math.min(100, odds.totalWeight ? line.weight * 100 / odds.totalWeight : 0)}%`}}/></div>}</div><label>Chance <input aria-label={`Chance do drop ${item?.name || 'removido'}`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" disabled={Boolean(busy)} value={lootChanceInputs[line.itemId] ?? String(line.weight)} onChange={event => changeLootChance(line.itemId, event.target.value)} onBlur={() => finalizeLootChance(line.itemId)}/></label><button type="button" className="mc-loot-remove" aria-label={`Remover ${item?.name || 'drop removido'} do loot`} onClick={() => { setLootField('entries', lootDraft.entries.filter(entry => entry.itemId !== line.itemId)); setLootChanceInputs(current => { const next = { ...current }; delete next[line.itemId]; return next }) }}>×</button></div>
        }) : <div className="mc-loot-empty-entries">Nenhum drop selecionado. Adicione ao menos uma opção do Baú.</div>}</div>
        <div className="mc-loot-editor-hint">🎲 Chance relativa de 1 a 1.000. Você pode apagar o campo para digitar; se deixá-lo vazio ou inválido, o valor salvo será 1. A probabilidade considera apenas drops disponíveis. O sorteio não desconta estoque.</div>
        {lootDiscardConfirm && <div className="mc-discard-confirm" role="alert"><div><strong>Descartar alterações?</strong><p>As mudanças feitas neste loot não serão salvas.</p></div><button type="button" className="mc-button mc-ghost" onClick={() => setLootDiscardConfirm(false)}>Continuar editando</button><button type="button" className="mc-button mc-danger" onClick={() => { setLootEditor(null); setLootDirty(false); setLootDiscardConfirm(false) }}>Descartar</button></div>}
        {error && <p role="alert" className="mc-inline-error">{error}</p>}
        <div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={closeLootEditor}>Cancelar</button><button type="submit" className="mc-button mc-primary" disabled={Boolean(busy) || !lootDraft.name.trim() || !lootDraft.entries.length}>{busy === 'loot-save' ? 'Salvando...' : lootEditor.id ? 'Salvar loot' : 'Criar loot'}</button></div>
      </form>
    </section></div>}

    {lootDelete && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setLootDelete(null) }}><section className="mc-modal mc-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="mc-loot-delete-title"><div className="mc-modal-head"><div><span className="mc-eyebrow">CONFIRMAR EXCLUSÃO</span><h2 id="mc-loot-delete-title">Excluir loot?</h2></div><button type="button" className="mc-close" aria-label="Fechar" disabled={Boolean(busy)} onClick={() => setLootDelete(null)}>×</button></div><p>Excluir <strong>{lootDelete.name}</strong> e suas opções de sorteio? Os drops do Baú e os inventários não serão alterados.</p>{error && <p role="alert" className="mc-inline-error">{error}</p>}<div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" onClick={() => setLootDelete(null)} disabled={Boolean(busy)}>Cancelar</button><button type="button" className="mc-button mc-danger" onClick={() => void removeLoot()} disabled={Boolean(busy)}>{busy === 'loot-delete' ? 'Excluindo...' : 'Excluir loot'}</button></div></section></div>}

    {editor && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor() }}><section className="mc-modal mc-editor-modal" role="dialog" aria-modal="true" aria-labelledby="mc-editor-heading" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (discardConfirm) setDiscardConfirm(false); else closeEditor() } }}>
      <div className="mc-modal-head"><div><span className="mc-eyebrow">ARSENAL · ITEM</span><h2 id="mc-editor-heading">{editor.mode === 'edit' ? 'Editar drop' : editor.mode === 'duplicate' ? 'Duplicar drop' : 'Novo drop'}</h2></div><button type="button" className="mc-close" disabled={Boolean(busy)} onClick={closeEditor} aria-label="Fechar">×</button></div>
      <form className="mc-editor-form" onSubmit={event => void save(event)}>
        {editor.mode === 'new' && !importedMetadata && <section className="mc-starter-panel" aria-label="Modelos rápidos de drop">
          <div className="mc-starter-heading"><div><strong>Começar por um modelo</strong><span>Preenche categorias e regras iniciais. Tudo continua editável.</span></div><small>{editorDirty ? 'Trocar de modelo substitui os campos atuais' : 'Opcional'}</small></div>
          <div className="mc-starter-grid">{DROP_STARTERS.map(starter => <button type="button" key={starter.id} onClick={() => editorDirty ? setStarterPending(starter) : applyDropStarter(starter)}><span className="mc-starter-icon">{starter.icon}</span><strong>{starter.label}</strong>{starter.description && <small>{starter.description}</small>}</button>)}</div>
          {starterPending && <div className="mc-starter-warning" role="alert"><span>Aplicar <strong>{starterPending.label}</strong> vai substituir os campos atuais.</span><button type="button" className="mc-button mc-ghost" onClick={() => setStarterPending(null)}>Voltar</button><button type="button" className="mc-button mc-primary" onClick={() => applyDropStarter(starterPending)}>Aplicar modelo</button></div>}
        </section>}
        <div className="mc-money-kind" role="group" aria-label="Tipo de drop">
          <button type="button" className={draft.dropType === 'item' ? 'selected' : ''} onClick={() => setField('dropType', 'item')}>📦 Item de inventário</button>
          <button type="button" className={draft.dropType === 'money' ? 'selected' : ''} onClick={() => { setField('dropType', 'money'); setField('icon', '💰') }}>💰 Dinheiro para carteira</button>
        </div>
        {draft.dropType === 'money' && <p className="mc-money-help">Na entrega, o valor por unidade × quantidade será creditado diretamente na carteira de cada personagem, sem criar um item no inventário. Selecione a moeda e o valor abaixo.</p>}
        <div className="mc-editor-preview">
          <span className="mc-editor-preview-icon" aria-hidden="true">{draft.icon}</span>
          <div className="mc-editor-preview-main"><strong>{draft.name.trim() || 'Novo item'}</strong><span>{draft.dropType === 'money' ? '💰 Crédito na carteira' : draft.categories.join(' · ')} · {rarityLabel(draft.rarity)}</span><small>{editorDirty ? '● Alterações não salvas' : draft.dropType === 'money' ? 'Prévia do crédito em moeda' : 'Prévia do item no inventário'}</small></div>
          <span className="mc-editor-preview-qty">{draft.infiniteStock ? '∞ Ilimitado' : `×${draft.quantity || '1'}`}</span>
        </div>
        <div className="mc-editor-rule-preview">{draft.dropType === 'item' && draft.categories.includes('Equipamento') && draft.equipmentType === 'armor' && <span>🛡️ Armadura {draft.armorClass === 'media' ? 'média' : draft.armorClass === 'pesada' ? 'pesada' : 'leve'} · {draft.armorClass === 'pesada' ? 'Todos os tipos de dano' : draft.armorCoverage === 'especial_bruto' ? 'Especial e bruto' : 'Cortante e perfurante'} · Peso {draftEffectiveWeight(draft).toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg</span>}{draft.dropType === 'item' && draft.categories.includes('Equipamento') && draft.equipmentType === 'cybernetic' && <span>⚙ Cibernética · {draft.cyberneticCategory} · {draft.cyberneticLoad || '0'} carga biológica</span>}{draft.dropType === 'item' && draft.categories.includes('Equipamento') && draft.equipmentType === 'protection' && <span>🛡 Proteção {draft.protectionTier} · {draft.protectionMode}</span>}{draft.dropType === 'item' && draft.categories.includes('Armas') && <span>⚔ Arma {({improvised:'Improvisada',advanced:'Avançada',special:'Especial',black_red:'Preta/Vermelha',mutable:'Mutável'} as Record<string,string>)[draft.weaponClass]} · {({improvised:'1d4',advanced:'1d6',special:'1d8',black_red:'1d10',mutable:'1d12'} as Record<string, string>)[draft.weaponClass]}</span>}{draft.dropType === 'item' && isConsumableDraft(draft) && <span>⌛ {draft.scarcityMode === 'random' ? `Escassez aleatória: nível ${draft.scarcityMinLevel}–${draft.scarcityMaxLevel}` : `${scarcityRules[draft.scarcityLevel].die} · ${draftEffectiveWeight(draft)} carga(s)${draft.scarcityExhausted ? ' · esgotado' : ''}`}</span>}
          {draft.dropType === 'money' && draft.moneyMode === 'range' && <span>💰 {currencyValue(asNumber(draft.moneyMin), draft.currencyId || null, currencyOptions)} a {currencyValue(asNumber(draft.moneyMax), draft.currencyId || null, currencyOptions)} por unidade · sorteado na entrega</span>}</div>
        <div className="mc-editor-section-title"><span>01</span><div><strong>Identificação</strong><small>Os mesmos dados básicos utilizados no inventário da ficha</small></div></div>
        <div className="mc-editor-grid">
          <label className="mc-span-2">Nome do item <input required autoFocus maxLength={120} value={draft.name} placeholder="Ex.: Espada do Eclipse" onChange={event => setField('name', event.target.value)}/></label>
          <label>Emoji / ícone <input type="text" maxLength={12} value={draft.icon} placeholder="📦" onChange={event => setField('icon', event.target.value)} aria-label="Emoji do item"/></label>
          <label>Raridade <select value={draft.rarity} onChange={event => setField('rarity', event.target.value)}>{RARITIES.map(rarity => <option value={rarity.value} key={rarity.value}>{rarity.label}</option>)}</select></label>
          <div className="mc-icon-picker mc-span-2" role="group" aria-label="Ícones sugeridos">{ICONS.map(icon => <button type="button" key={icon} aria-pressed={draft.icon === icon} title={`Usar ${icon}`} className={draft.icon === icon ? 'selected' : ''} onClick={() => setField('icon', icon)}>{icon}</button>)}</div>
          {draft.dropType === 'item' && <section className="mc-classification-panel mc-span-2" aria-label="Classificações do item">
            <div className="mc-classification-head"><div><strong>Classificações do inventário</strong><p>Escolha todas que se aplicam. O inventário reconhece múltiplas classificações no mesmo item.</p></div><span>{draft.categories.length} selecionada(s)</span></div>
            <div className="mc-classification-grid">{[...new Set([...CATEGORIES, ...draft.categories])].map(category => <label key={category} className={draft.categories.includes(category) ? 'selected' : ''}><input type="checkbox" checked={draft.categories.includes(category)} onChange={() => toggleCategory(category)}/><span aria-hidden="true">{draft.categories.includes(category) ? '✓' : '+'}</span>{category}</label>)}</div>
            <label className="mc-primary-category">Categoria principal <select value={draft.category} onChange={event => setField('category', event.target.value)}>{draft.categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
          </section>}
          <label className="mc-infinite-toggle mc-span-2"><input type="checkbox" checked={draft.infiniteStock} onChange={event => setField('infiniteStock', event.target.checked)}/><span><strong>∞ Estoque infinito</strong><small>Este drop poderá ser entregue e sorteado quantas vezes quiser, sem consumir o estoque do Baú.</small></span></label>
          <label>Quantidade no baú <input type="number" min="1" max="999999" step="1" required disabled={draft.infiniteStock} value={draft.quantity} onChange={event => setField('quantity', event.target.value)}/>{draft.infiniteStock && <small>Quantidade de reserva: será usada somente se voltar ao estoque finito.</small>}</label>
          {draft.dropType === 'item' && <label>{isArmorDraft(draft) ? 'Peso (kg)' : 'Peso por unidade (kg)'} <input type="number" min="0" max="100000" step="any" disabled={isConsumableDraft(draft)} value={isConsumableDraft(draft) ? String(draftEffectiveWeight(draft)) : draft.weight} onChange={event => setField('weight', event.target.value)}/></label>}
          {draft.dropType === 'money' && <div className="mc-random-config mc-span-2"><strong>Valor da recompensa</strong><div className="mc-random-modes" role="group" aria-label="Modo de recompensa em dinheiro"><button type="button" aria-pressed={draft.moneyMode === 'fixed'} className={draft.moneyMode === 'fixed' ? 'active' : ''} onClick={() => setField('moneyMode', 'fixed')}>Valor fixo</button><button type="button" aria-pressed={draft.moneyMode === 'range'} className={draft.moneyMode === 'range' ? 'active' : ''} onClick={() => setField('moneyMode', 'range')}>Valor aleatório (mín.–máx.)</button></div>
          {draft.moneyMode === 'range' && <div className="mc-random-fields"><label>Mínimo de moedas<input type="number" min="1" max="1000000000" step="1" required value={draft.moneyMin} onChange={event => setField('moneyMin', event.target.value)}/></label><label>Máximo de moedas<input type="number" min="1" max="1000000000" step="1" required value={draft.moneyMax} onChange={event => setField('moneyMax', event.target.value)}/></label></div>}
          <small>{draft.moneyMode === 'range' ? 'Ex.: entre 100 e 1.000 moedas por unidade. O valor é sorteado no banco na entrega, independentemente para cada personagem.' : 'Cada personagem recebe o valor fixo multiplicado pelas unidades entregues.'}</small></div>}
          {(draft.dropType === 'item' || draft.moneyMode === 'fixed') && <label>{draft.dropType === 'money' ? 'Dinheiro por unidade' : 'Valor por unidade'} <input type="number" min={draft.dropType === 'money' ? '1' : '0'} step={draft.dropType === 'money' ? '1' : 'any'} required={draft.dropType === 'money'} disabled={draft.dropType === 'item' && isConsumableDraft(draft) && draft.scarcityExhausted} value={draft.dropType === 'item' && isConsumableDraft(draft) && draft.scarcityExhausted ? '0' : draft.unitPrice} onChange={event => setField('unitPrice', event.target.value)}/></label>}
          {draft.dropType === 'money' && <p className="mc-money-help mc-span-2">O dinheiro é creditado diretamente na carteira e não ocupa peso. Cada entrega de várias unidades usa um valor sorteado por personagem, multiplicado pela quantidade.</p>}
          <label>Moeda <select required={draft.dropType === 'money'} value={draft.currencyId} onChange={event => setField('currencyId', event.target.value)}><option value="">{draft.dropType === 'money' ? 'Selecione a moeda' : 'Sem moeda'}</option>{currencyOptions.map(currency => <option value={currency.id} key={currency.id}>{currency.symbol} · {currency.name}</option>)}</select></label>
          <label>Situação <select value={draft.status} onChange={event => setField('status', event.target.value as ItemDraft['status'])}><option value="available">Disponível para entrega</option><option value="reserved">Reservado</option></select></label>
          {draft.dropType === 'item' && !isConsumableDraft(draft) && suggestedItemWeight(draft) !== null && <div className="mc-weight-helper mc-span-2"><div><strong>Peso sugerido: {suggestedItemWeight(draft)} kg/un.</strong><small>Calculado pelas regras do inventário; você ainda pode ajustar manualmente.</small></div><button type="button" className="mc-button mc-ghost" onClick={() => setField('weight', String(suggestedItemWeight(draft)))}>Aplicar peso padrão</button></div>}
          <div className="mc-editor-totals mc-span-2" aria-label="Resumo calculado do item">
            {draft.dropType === 'item' && <div><span>Peso total</span><strong>{draft.infiniteStock ? '∞ (sem total finito)' : isConsumableDraft(draft) && draft.scarcityMode === 'random' ? 'Variável (sorteado na entrega)' : `${(draftEffectiveWeight(draft) * (Number(draft.quantity) || 0)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`}</strong></div>}
            <div><span>{draft.dropType === 'money' ? 'Crédito total possível' : 'Valor total'}</span><strong>{draft.infiniteStock ? '∞ (sem total finito)' : draft.dropType === 'money' && draft.moneyMode === 'range' ? `${currencyValue(asNumber(draft.moneyMin) * (Number(draft.quantity) || 0), draft.currencyId || null, currencyOptions)} – ${currencyValue(asNumber(draft.moneyMax) * (Number(draft.quantity) || 0), draft.currencyId || null, currencyOptions)}` : currencyValue(draftEffectivePrice(draft) * (Number(draft.quantity) || 0), draft.currencyId || null, currencyOptions)}</strong></div>
            <div><span>Destino</span><strong>{draft.status === 'reserved' ? 'Reservado no baú' : 'Disponível para entrega'}</strong></div>
          </div>
          <label className="mc-span-2">Descrição <textarea rows={3} maxLength={2000} placeholder="Detalhes, propriedades, história..." value={draft.description} onChange={event => setField('description', event.target.value)}/></label>
          <label className="mc-span-2">Marcadores <input maxLength={250} placeholder="Ex.: chefe, missão, alquimia (separe por vírgulas)" value={draft.tags} onChange={event => setField('tags', event.target.value)}/></label>
          <label className="mc-span-2">Notas privadas do mestre <textarea rows={2} maxLength={1000} placeholder="Não serão enviadas para os inventários dos jogadores" value={draft.notes} onChange={event => setField('notes', event.target.value)}/><small>As notas são retiradas do item durante a entrega.</small></label>
        </div>
        {draft.dropType === 'item' && (draft.categories.includes('Equipamento') || draft.categories.includes('Armas') || isConsumableDraft(draft)) && <div className="mc-extra-options">
          <div className="mc-editor-section-title"><span>02</span><div><strong>Equipamento e regras</strong><small>Compatível com os campos de armas, armaduras, proteções e consumíveis das fichas</small></div></div>
          <p>Configure as regras das classificações selecionadas. Os tipos de equipamento aparecem somente em “Equipamento”.</p>
          <div className="mc-editor-grid">
            {draft.categories.includes('Equipamento') && <label>Tipo de equipamento <select value={draft.equipmentType} onChange={event => setField('equipmentType', event.target.value as ItemDraft['equipmentType'])}><option value="none">Item comum</option><option value="armor">Armadura</option><option value="protection">Proteção</option><option value="cybernetic">Cibernética (CyberFlower)</option></select></label>}
            {draft.categories.includes('Equipamento') && draft.equipmentType === 'armor' && <><label>Classe de armadura <select value={draft.armorClass} onChange={event => setField('armorClass', event.target.value as ItemDraft['armorClass'])}><option value="leve">Leve</option><option value="media">Média</option><option value="pesada">Pesada</option></select></label>{draft.armorClass !== 'pesada' && <label>Tipo de dano protegido <select value={draft.armorCoverage} onChange={event => setField('armorCoverage', event.target.value as ItemDraft['armorCoverage'])}><option value="cortante_perfurante">Cortante / perfurante</option><option value="especial_bruto">Especial / bruto</option></select></label>}</>}
            {draft.categories.includes('Equipamento') && draft.equipmentType === 'protection' && <><label>Nível de proteção <select value={draft.protectionTier} onChange={event => setField('protectionTier', event.target.value as ItemDraft['protectionTier'])}><option value="basica">Básica</option><option value="moderada">Moderada</option><option value="avancada">Avançada</option></select></label><label>Tipo de resistência <select value={draft.protectionMode} onChange={event => setField('protectionMode', event.target.value as ItemDraft['protectionMode'])}><option value="resistencia">Resistência (especial e bruto)</option><option value="sanidade">Sanidade (pontos mentais)</option></select></label></>}
            {draft.categories.includes('Equipamento') && draft.equipmentType === 'cybernetic' && <>
              <label>Categoria cibernética <select value={draft.cyberneticCategory} onChange={event => setField('cyberneticCategory', event.target.value)}>{['Neurológico', 'Sensorial', 'Órgãos', 'Membros', 'Estrutural', 'Armamento', 'Suporte', 'Outro'].map(category => <option value={category} key={category}>{category}</option>)}</select></label>
              <label>Localização no corpo <input value={draft.cyberneticLocation} maxLength={150} placeholder="Ex.: Crânio, braço esquerdo" onChange={event => setField('cyberneticLocation', event.target.value)}/></label>
              <label>Carga biológica <input type="number" min="0" step="any" value={draft.cyberneticLoad} onChange={event => setField('cyberneticLoad', event.target.value)}/></label>
              <label className="mc-span-2">Efeitos da cibernética <textarea rows={3} value={draft.cyberneticEffects} maxLength={2000} onChange={event => setField('cyberneticEffects', event.target.value)}/></label>
              <small className="mc-span-2">A cibernética será entregue armazenada, sem marcar como instalada no personagem.</small>
            </>}
            {draft.categories.includes('Armas') && <label>Classe de arma <select value={draft.weaponClass} onChange={event => setField('weaponClass', event.target.value as ItemDraft['weaponClass'])}><option value="improvised">Improvisada · 1d4</option><option value="advanced">Avançada · 1d6</option><option value="special">Especial · 1d8</option><option value="black_red">Preta/Vermelha · 1d10</option><option value="mutable">Mutável · 1d12</option></select></label>}
            {isConsumableDraft(draft) && <div className="mc-random-config mc-span-2"><strong>Escassez do consumível</strong><div className="mc-random-modes" role="group" aria-label="Modo de escassez"><button type="button" aria-pressed={draft.scarcityMode === 'fixed'} className={draft.scarcityMode === 'fixed' ? 'active' : ''} onClick={() => setField('scarcityMode', 'fixed')}>Nível fixo</button><button type="button" aria-pressed={draft.scarcityMode === 'random'} className={draft.scarcityMode === 'random' ? 'active' : ''} onClick={() => { setDraft(current => ({...current, scarcityMode: 'random', scarcityExhausted: false})); setEditorDirty(true) }}>Nível aleatório</button></div>
              {draft.scarcityMode === 'fixed' ? <div className="mc-random-fields"><label>Escassez <select value={draft.scarcityLevel} disabled={draft.scarcityExhausted} onChange={event => setField('scarcityLevel', event.target.value as ItemDraft['scarcityLevel'])}><option value="1">Nível 1 · d12 · 7 cargas</option><option value="2">Nível 2 · d8 · 5 cargas</option><option value="3">Nível 3 · d6 · 3 cargas</option><option value="4">Nível 4 · d4 · 1 carga</option></select></label><label className="mc-checkline mc-scarcity-check"><input type="checkbox" checked={draft.scarcityExhausted} onChange={event => setField('scarcityExhausted', event.target.checked)}/>Esgotado</label></div> : <div className="mc-random-fields"><label>Nível mínimo<select value={draft.scarcityMinLevel} onChange={event => setField('scarcityMinLevel', event.target.value)}>{[1,2,3,4].map(level => <option key={level} value={level}>Nível {level}</option>)}</select></label><label>Nível máximo<select value={draft.scarcityMaxLevel} onChange={event => setField('scarcityMaxLevel', event.target.value)}>{[1,2,3,4].map(level => <option key={level} value={level}>Nível {level}</option>)}</select></label></div>}
              <small>{draft.scarcityMode === 'random' ? 'O nível é sorteado na entrega para cada personagem. O consumível recebido terá o dado e as cargas correspondentes ao nível sorteado.' : 'Consumíveis esgotados têm peso e valor zero, seguindo as regras de escassez.'}</small></div>}
          </div>
        </div>}
        <div className="mc-editor-section-title"><span>03</span><div><strong>Permissões e entrega</strong><small>Configurações do baú que acompanham ou controlam a distribuição</small></div></div>
        {draft.dropType === 'item' && <label className="mc-checkline"><input type="checkbox" checked={draft.saleBlocked} onChange={event => setField('saleBlocked', event.target.checked)}/><span>Bloquear venda ao receber no inventário</span></label>}
        <div className={`mc-message-config ${draft.notifyOnDelivery ? 'enabled' : ''}`}>
          <label className="mc-message-toggle"><input type="checkbox" checked={draft.notifyOnDelivery} onChange={event => setField('notifyOnDelivery', event.target.checked)}/><span><strong>✉ Mostrar mensagem ao jogador na entrega</strong><small>Funciona com qualquer drop, incluindo dinheiro, sorteios de Loot e remessas.</small></span></label>
          {draft.notifyOnDelivery && <>
            <label className="mc-message-field">Mensagem personalizada
              <textarea rows={5} maxLength={2000} value={draft.deliveryMessage} onChange={event => setField('deliveryMessage', event.target.value)} placeholder="Ex.: Ao tocar neste artefato, você ouve uma voz antiga sussurrando seu nome..." required/>
            </label>
            <div className="mc-message-preview"><span>PRÉVIA PARA O JOGADOR</span><p>{draft.deliveryMessage.trim() || 'Escreva sua mensagem acima para visualizar a prévia.'}</p><small>{draft.deliveryMessage.length}/2.000 caracteres · A mensagem será exibida após a entrega ser confirmada.</small></div>
          </>}
        </div>
        {error && <p role="alert" className="mc-inline-error">{error}</p>}
        {discardConfirm && <div className="mc-discard-confirm" role="alert"><div><strong>Descartar alterações?</strong><p>O que foi editado ainda não foi salvo no Baú.</p></div><button type="button" className="mc-button mc-ghost" onClick={() => setDiscardConfirm(false)}>Continuar editando</button><button type="button" className="mc-button mc-danger" onClick={discardEditor}>Descartar</button></div>}
        <div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" onClick={closeEditor} disabled={Boolean(busy)}>Cancelar</button><button type="submit" className="mc-button mc-primary" disabled={Boolean(busy)}>{busy === 'save' ? 'Salvando...' : editor.mode === 'edit' ? 'Salvar alterações' : 'Guardar no baú'}</button></div>
      </form>
    </section></div>}

    {deliveryItem && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setDeliveryItem(null) }}><section className="mc-modal mc-delivery-modal" role="dialog" aria-modal="true" aria-labelledby="mc-delivery-heading" onKeyDown={event => { if (event.key === 'Escape' && !busy) setDeliveryItem(null) }}>
      <div className="mc-modal-head"><div><span className="mc-eyebrow">DISTRIBUIR RECOMPENSA</span><h2 id="mc-delivery-heading">Entregar drop</h2></div><button type="button" className="mc-close" disabled={Boolean(busy)} onClick={() => setDeliveryItem(null)} aria-label="Fechar">×</button></div>
      <div className="mc-delivery-summary"><div className="mc-item-icon">{itemIcon(deliveryItem)}</div><div><strong>{deliveryItem.name}</strong>{isMoneyDrop(deliveryItem) && <small>💰 Crédito na carteira: {moneyRange(deliveryItem) ? `${currencyValue(moneyRange(deliveryItem)!.min * Math.max(1, asNumber(deliveryQuantity)), deliveryItem.currency_id, currencyOptions)} a ${currencyValue(moneyRange(deliveryItem)!.max * Math.max(1, asNumber(deliveryQuantity)), deliveryItem.currency_id, currencyOptions)} por personagem (sorteado na entrega)` : `${currencyValue(deliveryItem.unit_price * Math.max(1, asNumber(deliveryQuantity)), deliveryItem.currency_id, currencyOptions)} por personagem`}</small>}{scarcityRange(deliveryItem) && <small>🎲 Escassez: nível {scarcityRange(deliveryItem)!.min} a {scarcityRange(deliveryItem)!.max}, sorteado na entrega para cada personagem</small>}<span>{isInfinite(deliveryItem) ? '∞ Estoque infinito — não será consumido' : `${deliveryItem.quantity} unidades no baú`}</span></div></div>
      {deliveryItem.metadata?.notifyOnDelivery === true && typeof deliveryItem.metadata.deliveryMessage === 'string' && Boolean(deliveryItem.metadata.deliveryMessage.trim()) && <div className="mc-delivery-message-note">✉ O jogador receberá a mensagem personalizada deste drop após a entrega.</div>}
      <label className="mc-quantity-label">Unidades <strong>por personagem</strong><input type="number" min="1" max={isInfinite(deliveryItem) ? 999999 : deliveryItem.quantity} step="1" value={deliveryQuantity} onChange={event => setDeliveryQuantity(event.target.value)}/></label>
      <div className="mc-recipients-head"><strong>Destinatários</strong><button type="button" className="mc-link" onClick={() => setRecipients(current => visibleRecipients.length > 0 && visibleRecipients.every(character => current.includes(character.id)) ? current.filter(id => !visibleRecipients.some(character => character.id === id)) : [...new Set([...current, ...visibleRecipients.map(character => character.id)])])}>{visibleRecipients.length > 0 && visibleRecipients.every(character => recipients.includes(character.id)) ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button></div>
      <label className="mc-search mc-recipient-search"><span aria-hidden="true">⌕</span><input type="search" value={recipientSearch} onChange={event => setRecipientSearch(event.target.value)} placeholder="Buscar personagem..." aria-label="Buscar destinatários"/></label>
      <div className="mc-recipients" role="group" aria-label="Escolher destinatários">{visibleRecipients.map(character => <label className={`mc-recipient ${recipients.includes(character.id) ? 'selected' : ''}`} key={character.id}><input type="checkbox" checked={recipients.includes(character.id)} onChange={event => setRecipients(current => event.target.checked ? [...new Set([...current, character.id])].slice(0, 50) : current.filter(id => id !== character.id))}/><span aria-hidden="true">{character.emoji || '♙'}</span><strong>{character.name}</strong></label>)}{visibleRecipients.length === 0 && <p>{charactersInCampaign.length === 0 ? 'Nenhum personagem cadastrado na campanha.' : 'Nenhum personagem corresponde à pesquisa.'}</p>}</div>
      <div className="mc-distribution-total"><span>Total a distribuir</span><strong>{Math.max(0, asNumber(deliveryQuantity)) * recipients.length} / {isInfinite(deliveryItem) ? '∞' : deliveryItem.quantity} un.</strong></div>
      <div className="mc-distribution-preview" aria-label="Prévia da distribuição">
        <div><span>Estoque restante</span><strong className={!hasStock(deliveryItem, asNumber(deliveryQuantity) * recipients.length) ? 'mc-negative' : ''}>{isInfinite(deliveryItem) ? '∞ (inalterado)' : `${deliveryItem.quantity - asNumber(deliveryQuantity) * recipients.length} un.`}</strong></div>
        <div><span>Peso por personagem</span><strong>{(deliveryItem.weight * Math.max(0, asNumber(deliveryQuantity))).toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg</strong></div>
        <div><span>Peso total da entrega</span><strong>{(deliveryItem.weight * Math.max(0, asNumber(deliveryQuantity)) * recipients.length).toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg</strong></div>
      </div>
      <p className="mc-delivery-warning">A entrega é registrada no histórico. Drops de dinheiro são creditados na carteira; os demais aparecem nos inventários dos personagens. Esta ação não pode ser desfeita automaticamente.</p>
      {error && <p role="alert" className="mc-inline-error">{error}</p>}
      <div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => setDeliveryItem(null)}>Cancelar</button><button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || recipients.length === 0 || recipients.length > 50 || !Number.isInteger(asNumber(deliveryQuantity)) || asNumber(deliveryQuantity) < 1 || !hasStock(deliveryItem, asNumber(deliveryQuantity) * recipients.length) || asNumber(deliveryQuantity) > 999999} onClick={() => void deliver()}>{busy === 'delivery' ? 'Distribuindo...' : `Confirmar entrega para ${recipients.length}`}</button></div>
    </section></div>}

    {stockEditor && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setStockEditor(null) }}><section className="mc-modal mc-stock-modal" role="dialog" aria-modal="true" aria-labelledby="mc-stock-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) setStockEditor(null) }}>
      <div className="mc-modal-head"><div><span className="mc-eyebrow">CONTROLE DE ESTOQUE</span><h2 id="mc-stock-title">Ajustar quantidade</h2></div><button type="button" className="mc-close" aria-label="Fechar" disabled={Boolean(busy)} onClick={() => setStockEditor(null)}>×</button></div>
      <div className="mc-delivery-summary"><div className="mc-item-icon">{itemIcon(stockEditor)}</div><div><strong>{stockEditor.name}</strong><span>Estoque atual: {stockLabel(stockEditor)}</span></div></div>
      <div className="mc-infinite-stock-control"><div><strong>∞ Estoque infinito</strong><small>{isInfinite(stockEditor) ? 'Ativo: entregas e sorteios não diminuem este drop.' : 'Ao ativar, o drop não será consumido nas entregas.'}</small></div><button type="button" className={`mc-button ${isInfinite(stockEditor) ? 'mc-primary' : 'mc-ghost'}`} disabled={Boolean(busy)} onClick={() => void toggleInfiniteStock()}>{busy === 'stock-mode' ? 'Alterando...' : isInfinite(stockEditor) ? 'Voltar ao estoque limitado' : 'Ativar estoque infinito'}</button></div>
      {!isInfinite(stockEditor) && <><div className="mc-stock-options" role="group" aria-label="Operação de estoque"><button type="button" className={stockDirection === 'add' ? 'active' : ''} onClick={() => setStockDirection('add')} aria-pressed={stockDirection === 'add'}>＋ Repor</button><button type="button" className={stockDirection === 'remove' ? 'active' : ''} onClick={() => setStockDirection('remove')} aria-pressed={stockDirection === 'remove'}>− Retirar</button></div>
      <label className="mc-quantity-label">Quantidade a {stockDirection === 'add' ? 'adicionar' : 'retirar'}<input type="number" min="1" max="999999" step="1" value={stockAmount} onChange={event => setStockAmount(event.target.value)}/></label>
      <div className="mc-stock-preview"><span>Estoque após ajuste</span><strong>{Number.isInteger(Number(stockAmount)) && Number(stockAmount) > 0 ? stockEditor.quantity + Number(stockAmount) * (stockDirection === 'add' ? 1 : -1) : '—'} un.</strong></div>
      <p className="mc-help-text">Para excluir um item completamente, utilize a ação “Excluir item” no cartão.</p>
      {error && <p role="alert" className="mc-inline-error">{error}</p>}
      <div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => setStockEditor(null)}>Cancelar</button><button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || !Number.isInteger(Number(stockAmount)) || Number(stockAmount) < 1 || stockEditor.quantity + Number(stockAmount) * (stockDirection === 'add' ? 1 : -1) < 1 || stockEditor.quantity + Number(stockAmount) * (stockDirection === 'add' ? 1 : -1) > 999999} onClick={() => void adjustStock()}>{busy === 'stock' ? 'Atualizando...' : 'Confirmar ajuste'}</button></div></>}
    </section></div>}

    {bundleOpen && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setBundleOpen(false) }}><section className="mc-modal mc-bundle-modal" role="dialog" aria-modal="true" aria-labelledby="mc-bundle-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) setBundleOpen(false) }}>
      <div className="mc-modal-head"><div><span className="mc-eyebrow">PREPARAÇÃO DE RECOMPENSAS</span><h2 id="mc-bundle-title">Montar remessa</h2><p className="mc-help-text">Configure as quantidades e os destinatários. Salve modelos para preparar recompensas recorrentes com mais rapidez.</p></div><button type="button" className="mc-close" aria-label="Fechar" disabled={Boolean(busy)} onClick={() => setBundleOpen(false)}>×</button></div>
      <section className="mc-preset-section" aria-label="Modelos reutilizáveis de remessa">
        <div className="mc-preset-title"><div><strong>Modelos de remessa</strong><small>Salvos neste navegador, separados por campanha · {bundlePresets.length}/12 modelos</small></div></div>
        {bundleEntries.length > 0 && <div className="mc-preset-save"><input type="text" maxLength={60} aria-label="Nome do modelo de remessa" placeholder="Nome do modelo (ex.: Tesouro do chefe)" value={bundlePresetName} onChange={event => setBundlePresetName(event.target.value)}/><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy) || bundlePresets.length >= 12} onClick={saveBundlePreset}>＋ Salvar remessa como modelo</button></div>}
        {bundlePresets.length > 0 ? <div className="mc-preset-list">{bundlePresets.map(preset => <div className="mc-preset-row" key={preset.id}><div><strong>{preset.name}</strong><small>{preset.lines.length} tipos de item · {preset.lines.reduce((total,line) => total + line.quantity,0)} un. por personagem</small></div><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => loadBundlePreset(preset)}>Carregar</button>{pendingPresetDelete === preset.id ? <div className="mc-preset-confirm"><button type="button" onClick={() => setPendingPresetDelete(null)}>Cancelar</button><button type="button" className="danger" onClick={() => removeBundlePreset(preset.id)}>Confirmar exclusão</button></div> : <button type="button" className="mc-preset-remove" disabled={Boolean(busy)} aria-label={`Excluir modelo ${preset.name}`} title="Excluir modelo salvo" onClick={() => setPendingPresetDelete(preset.id)}>×</button>}</div>)}</div> : <p className="mc-preset-empty">Ainda não há modelos salvos. Separe alguns drops, depois salve a remessa para reutilizá-la em outros encontros.</p>}
      </section>
      {notice && <p role="status" className="mc-preset-notice">✓ {notice}</p>}
      {bundleEntries.length === 0 ? <div className="mc-empty"><h2>Nenhum drop separado</h2><p>Adicione itens pelos cartões do baú ou carregue um modelo salvo acima.</p><button type="button" className="mc-button mc-primary" onClick={() => setBundleOpen(false)}>Voltar aos itens</button></div> : <>
        <div className="mc-bundle-lines">{bundleEntries.map(({id,item,quantity}, index) => <div className={`mc-bundle-line ${!item || item.status !== 'available' || !Number.isInteger(quantity) || quantity < 1 || quantity * bundleRecipients.length > item.quantity ? 'invalid' : ''}`} key={item?.id ?? `missing-${index}`}>
          <span className="mc-bundle-icon">{item ? itemIcon(item) : '📦'}</span>
          <div className="mc-bundle-name"><strong>{item?.name ?? 'Item removido do baú'}</strong><small>{item ? `${stockLabel(item)} em estoque · ${item.status === 'reserved' ? 'reservado' : 'disponível'} · serão entregues ${quantity * bundleRecipients.length || 0} un.${isInfinite(item) ? ' (sem desconto)' : ''}${rewardSummary(item, currencyOptions) ? ` · ${rewardSummary(item, currencyOptions)}` : ''}` : 'Indisponível'}</small></div>
          <label>Por personagem<input aria-label={`Quantidade por personagem para ${item?.name ?? 'item removido'}`} type="number" min="1" max={isInfinite(item) ? 999999 : (item?.quantity ?? 1)} value={quantity} onChange={event => item && setBundle(current => ({...current,[item.id]:Number(event.target.value)}))}/></label>
          <button type="button" className="mc-close mc-remove-line" title="Retirar da remessa" aria-label={`Retirar ${item?.name ?? 'item'} da remessa`} onClick={() => setBundle(current => { const next = {...current}; delete next[id]; return next })}>×</button>
        </div>)}</div>
        <div className="mc-recipients-head"><strong>Destinatários ({bundleRecipients.length}/50)</strong><button type="button" className="mc-link" onClick={() => setBundleRecipients(current => bundleRecipientsVisible.length > 0 && bundleRecipientsVisible.every(c => current.includes(c.id)) ? current.filter(id => !bundleRecipientsVisible.some(c => c.id === id)) : [...new Set([...current,...bundleRecipientsVisible.map(c => c.id)])].slice(0, 50))}>{bundleRecipientsVisible.length > 0 && bundleRecipientsVisible.every(c => bundleRecipients.includes(c.id)) ? 'Desmarcar visíveis' : 'Selecionar visíveis'}</button></div>
        <label className="mc-search mc-recipient-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar destinatários da remessa" value={bundleRecipientSearch} onChange={event => setBundleRecipientSearch(event.target.value)} placeholder="Buscar personagens..."/></label>
        <div className="mc-recipients" role="group" aria-label="Personagens que receberão a remessa">{bundleRecipientsVisible.map(character => <label key={character.id} className={`mc-recipient ${bundleRecipients.includes(character.id) ? 'selected' : ''}`}><input type="checkbox" checked={bundleRecipients.includes(character.id)} onChange={event => setBundleRecipients(current => event.target.checked ? [...new Set([...current,character.id])].slice(0, 50) : current.filter(id => id !== character.id))}/><span aria-hidden="true">{character.emoji || '♙'}</span><strong>{character.name}</strong></label>)}{!bundleRecipientsVisible.length && <p className="mc-help-text">Nenhum personagem encontrado.</p>}</div>
        <div className="mc-bundle-summary"><span><strong>{bundleCount}</strong> tipos de item</span><span><strong>{bundleTotal}</strong> un. por personagem</span><span><strong>{bundleTotal * bundleRecipients.length}</strong> un. no total</span><span><strong>{bundleWeight.toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg</strong> por personagem</span><span><strong>{(bundleWeight * bundleRecipients.length).toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg</strong> peso total</span></div>
        {bundleInvalid && <p role="alert" className="mc-inline-error">Há um drop indisponível, reservado, com quantidade inválida ou estoque insuficiente para os destinatários. Os itens destacados devem ser revistos.</p>}
        <p className="mc-delivery-warning">A remessa inteira é processada em uma única transação: ou todos os personagens recebem todos os drops, ou nenhum é entregue. Modelos são locais e não reservam estoque.</p>
        {error && <p role="alert" className="mc-inline-error">{error}</p>}
        <div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => setBundleOpen(false)}>Continuar preparando</button><button type="button" className="mc-button mc-primary" disabled={Boolean(busy) || !bundleCount || bundleCount > 30 || bundleRecipients.length === 0 || bundleRecipients.length > 50 || bundleInvalid} onClick={() => void deliverBundle()}>{busy === 'bundle' ? 'Distribuindo...' : `Entregar remessa para ${bundleRecipients.length}`}</button></div>
      </>}
    </section></div>}

    {deleteItem && <div className="mc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setDeleteItem(null) }}><section className="mc-modal mc-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="mc-delete-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) setDeleteItem(null) }}><div className="mc-modal-head"><div><span className="mc-eyebrow">AÇÃO IRREVERSÍVEL</span><h2 id="mc-delete-title">Excluir do baú?</h2></div></div><p>Remover <strong>{isInfinite(deleteItem) ? '∞' : `${deleteItem.quantity} ×`} {deleteItem.name}</strong>? Isso não removerá itens que já foram entregues aos personagens.</p>{error && <p role="alert" className="mc-inline-error">{error}</p>}<div className="mc-modal-actions"><button type="button" className="mc-button mc-ghost" disabled={Boolean(busy)} onClick={() => setDeleteItem(null)}>Cancelar</button><button type="button" className="mc-button mc-danger" disabled={Boolean(busy)} onClick={() => void confirmDelete()}>{busy === 'delete' ? 'Excluindo...' : 'Excluir definitivamente'}</button></div></section></div>}
  </div>
}
