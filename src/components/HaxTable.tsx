import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import './HaxTable.css'

// Mesa independente: coordenadas livres (em pixels), cenas e objetos em tabelas próprias.
// Segurança e autorização são verificadas novamente no Supabase (ver migração SQL).
type Hero = { id: string; name: string; emoji?: string | null; user_id: string; current_player_id?: string | null }
type Foe = { id: string; name: string; emoji?: string | null }
type Season = { id: string; name: string; season_number: number }
type Point = { x: number; y: number }
type Stroke = { id: string; points: Point[]; radius: number; mode: 'reveal' | 'hide' }
type Scene = {
  id: string; campaign_id: string; season_id: string; name: string; is_active: boolean; is_visible: boolean;
  width: number; height: number; grid_size: number; show_grid: boolean; snap_to_grid: boolean;
  background_url: string; fog_enabled: boolean; fog_strokes: Stroke[]; round: number;
  active_object_id: string | null; updated_at: string
}
type SceneObject = {
  id: string; scene_id: string; campaign_id: string; kind: 'character' | 'enemy' | 'image' | 'drawing' | 'text' | 'marker';
  ref_id: string | null; name: string; emoji: string; image_url: string; x: number; y: number;
  width: number; height: number; rotation: number; layer: number; locked: boolean;
  visible_to_players: boolean; style: Record<string, any>; updated_at: string
}
type Tool = 'select' | 'pan' | 'ruler' | 'draw' | 'reveal' | 'hide' | 'erase'
type Drag = { kind: 'token' | 'pan' | 'draw' | 'fog' | 'ruler'; id?: string; start: Point; origin: Point; points: Point[]; tool: Tool; pointerId: number }
const limit = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))
const pt = (x: number, y: number): Point => ({ x, y })
const pointPath = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
const safeUrl = (value: string) => /^https:\/\//i.test(value) || value.startsWith('storage:') ? value : ''
const tokenIcons = ['🧑', '🧙', '🧝', '🧛', '🧟', '🧌', '👹', '🐺', '🐉', '🦊', '🗡️', '⚔️', '🛡️', '🔥', '❄️', '✨', '💀', '👑', '🌿', '🎯', '📍', '🔮', '🦇', '🤖']
const toolButtons: Array<{ id: Tool; icon: string; title: string }> = [
  { id: 'select', icon: '↖', title: 'Selecionar e mover (V)' }, { id: 'pan', icon: '✥', title: 'Mover câmera (H)' },
  { id: 'ruler', icon: '⌁', title: 'Medir distância (R)' }, { id: 'draw', icon: '✎', title: 'Desenhar (D)' },
  { id: 'reveal', icon: '☀', title: 'Revelar névoa (F)' }, { id: 'hide', icon: '◕', title: 'Cobrir com névoa (G)' },
  { id: 'erase', icon: '⌫', title: 'Apagar objeto (E)' },
]

export default function HaxTable(props: {
  campaignId: string; campaignName: string; seasonId: string; seasons: Season[];
  onSeasonChange: (id: string) => void; isMaster: boolean; userId: string; playerName: string;
  characters: Hero[]; enemies: Foe[]
}) {
  const { campaignId, campaignName, seasonId, seasons, onSeasonChange, isMaster, userId, characters, enemies } = props
  const [scenes, setScenes] = useState<Scene[]>([])
  const [sceneId, setSceneId] = useState('')
  const [objects, setObjects] = useState<SceneObject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [live, setLive] = useState(false)
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState('')
  const [zoom, setZoom] = useState(0.8)
  const [offset, setOffset] = useState<Point>(pt(30, 30))
  const [fullscreen, setFullscreen] = useState(false)
  const [showLayers, setShowLayers] = useState(true)
  const [rosterSearch, setRosterSearch] = useState('')
  const [brush, setBrush] = useState(56)
  const [drawColor, setDrawColor] = useState('#ffd28a')
  const [draft, setDraft] = useState<Point[]>([])
  const [measure, setMeasure] = useState<{ start: Point; end: Point } | null>(null)
  const [assetName, setAssetName] = useState('')
  const [assetUploading, setAssetUploading] = useState(false)
  const [tokenEmojiDraft, setTokenEmojiDraft] = useState('')
  const [tokenUrlDraft, setTokenUrlDraft] = useState('')
  const [showAssets, setShowAssets] = useState(false)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [sideWidth, setSideWidth] = useState(250)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const cameraRef = useRef({ zoom, offset })
  const objectsRef = useRef(objects)
  const loadSceneRef = useRef<() => Promise<void>>(async () => {})
  const loadScenesRef = useRef<() => Promise<void>>(async () => {})
  const lastPointerRef = useRef<Point | null>(null)
  const scene = scenes.find(item => item.id === sceneId) ?? null
  const selected = objects.find(item => item.id === selectedId) ?? null
  useEffect(() => {
    setTokenEmojiDraft(selected?.emoji ?? '')
    setTokenUrlDraft(selected?.image_url ?? '')
  }, [selected?.id])
  cameraRef.current = { zoom, offset }
  objectsRef.current = objects

  const canMove = useCallback((item: SceneObject) => {
    if (isMaster) return !item.locked
    const hero = characters.find(entry => entry.id === item.ref_id)
    return item.kind === 'character' && !item.locked && !!hero && (hero.current_player_id || hero.user_id) === userId
  }, [isMaster, characters, userId])

  // Imagens da Storage permanecem com endereços estáveis no banco. Só o link assinado é efêmero.
  useEffect(() => {
    const paths = [scene?.background_url, ...objects.map(item => item.image_url)].filter((a): a is string => !!a && a.startsWith('storage:'))
    const missing = [...new Set(paths)].filter(path => !(path in imageUrls))
    if (!missing.length) return
    let cancelled = false
    void Promise.all(missing.map(async path => {
      const { data } = await supabase.storage.from('hb-vtt-assets').createSignedUrl(path.slice(8), 43200)
      return { path, url: data?.signedUrl ?? '' }
    })).then(entries => {
      if (!cancelled) setImageUrls(old => ({ ...old, ...Object.fromEntries(entries.map(entry => [entry.path, entry.url])) }))
    })
    return () => { cancelled = true }
  }, [scene?.background_url, objects, imageUrls])
  const resolveImage = (value: string) => value.startsWith('storage:') ? imageUrls[value] ?? '' : safeUrl(value)

  const loadScenes = useCallback(async () => {
    if (!campaignId || !seasonId) { setScenes([]); return }
    const { data, error: queryError } = await supabase.from('hb_vtt_scenes').select('*')
      .eq('campaign_id', campaignId).eq('season_id', seasonId).order('created_at', { ascending: true })
    if (queryError) { setError('Não foi possível carregar as cenas. Execute o novo SQL da Mesa: ' + queryError.message); return }
    const rows = (data ?? []) as Scene[]
    setScenes(rows)
    setSceneId(old => !isMaster && rows.some(row => row.is_active)
      ? rows.find(row => row.is_active)!.id
      : rows.some(row => row.id === old) ? old : (rows.find(row => row.is_active)?.id ?? rows[0]?.id ?? ''))
  }, [campaignId, seasonId, isMaster])
  loadScenesRef.current = loadScenes

  const loadObjects = useCallback(async () => {
    if (!sceneId) { setObjects([]); return }
    const { data, error: objError } = await supabase.from('hb_vtt_objects')
      .select('*').eq('scene_id', sceneId).order('layer', { ascending: true })
    if (objError) { setError(objError.message); return }
    setObjects(prev => {
      const draggedId = dragRef.current?.kind === 'token' ? dragRef.current.id : null
      const dragged = prev.find(item => item.id === draggedId)
      return (data ?? []).map(row => row.id === draggedId && dragged ? dragged : row) as SceneObject[]
    })
  }, [sceneId])
  loadSceneRef.current = loadObjects

  useEffect(() => {
    setScenes([]); setSceneId(''); setObjects([]); setError(''); setSelectedId('')
    void loadScenes()
  }, [loadScenes])
  useEffect(() => { void loadObjects() }, [loadObjects])

  useEffect(() => {
    if (!campaignId || !seasonId) return
    const channel = supabase.channel(`hb-vtt-session-${campaignId}-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hb_vtt_scenes', filter: `campaign_id=eq.${campaignId}` }, () => { void loadScenesRef.current() })
      .subscribe(status => setLive(status === 'SUBSCRIBED'))
    return () => { void supabase.removeChannel(channel); setLive(false) }
  }, [campaignId, seasonId])
  useEffect(() => {
    if (!sceneId) return
    const channel = supabase.channel(`hb-vtt-scene-${sceneId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hb_vtt_objects', filter: `scene_id=eq.${sceneId}` }, () => { void loadSceneRef.current() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [sceneId])
  // Sincronização de recuperação: mantém cenas atualizadas mesmo após queda de Realtime
  // e revoga cenas/peças que deixaram de ser visíveis ao jogador.
  useEffect(() => {
    if (!campaignId || !seasonId) return
    const timer = window.setInterval(() => { void loadScenesRef.current(); void loadSceneRef.current() }, 15000)
    return () => window.clearInterval(timer)
  }, [campaignId, seasonId])
  useEffect(() => {
    if (!sceneId || !isMaster) return
    // Revalidar permissão e dados depois de trocar cenas; não deixar tokens de outras cenas selecionados.
    setSelectedId(''); setDraft([]); setMeasure(null)
  }, [sceneId, isMaster])

  async function createScene() {
    if (!isMaster || !seasonId || loading) return
    const title = window.prompt('Nome da nova cena:', `Cena ${scenes.length + 1}`)?.trim()
    if (!title) return
    setLoading(true); setError('')
    const { data, error: err } = await supabase.from('hb_vtt_scenes').insert({
      campaign_id: campaignId, season_id: seasonId, name: title.slice(0, 80), is_visible: scenes.length === 0,
      is_active: scenes.length === 0,
    }).select('*').single()
    setLoading(false)
    if (err) { setError(err.message); return }
    await loadScenes(); setSceneId((data as Scene).id)
  }
  async function patchScene(patch: Partial<Scene>) {
    if (!isMaster || !scene) return
    const { error: err } = await supabase.from('hb_vtt_scenes').update(patch).eq('id', scene.id)
    if (err) { setError(err.message); return }
    setScenes(old => old.map(row => row.id === scene.id ? { ...row, ...patch } : row))
  }
  async function activateScene() {
    if (!isMaster || !scene) return
    const { error: err } = await supabase.rpc('hb_vtt_activate_scene', { p_scene_id: scene.id })
    if (err) setError(err.message)
    else { setInfo('Cena ativada para a campanha.'); void loadScenes() }
  }
  async function deleteScene() {
    if (!scene || !isMaster || !window.confirm(`Excluir a cena “${scene.name}” e todos os seus objetos?`)) return
    const { error: err } = await supabase.from('hb_vtt_scenes').delete().eq('id', scene.id)
    if (err) setError(err.message)
    else { setSceneId(''); void loadScenes() }
  }
  async function addObject(value: Partial<SceneObject>) {
    if (!isMaster || !scene) return
    const row = { campaign_id: campaignId, scene_id: scene.id, kind: 'marker', name: 'Nova peça',
      emoji: '✦', x: 300, y: 240, width: 64, height: 64, layer: 20, ...value }
    const { data, error: err } = await supabase.from('hb_vtt_objects').insert(row).select('*').single()
    if (err) setError(err.message)
    else { setObjects(old => [...old, data as SceneObject]); setSelectedId(data.id) }
  }
  async function patchObject(id: string, patch: Partial<SceneObject>) {
    if (!isMaster || !scene) return
    const { error: err } = await supabase.from('hb_vtt_objects').update(patch).eq('id', id).eq('scene_id', scene.id)
    if (err) { setError(err.message); await loadObjects(); return }
    setObjects(old => old.map(item => item.id === id ? { ...item, ...patch } : item))
  }
  async function deleteObject(id: string) {
    if (!isMaster) return
    const { error: err } = await supabase.from('hb_vtt_objects').delete().eq('id', id)
    if (err) setError(err.message)
    else { setObjects(old => old.filter(item => item.id !== id)); setSelectedId('') }
  }
  async function moveObject(item: SceneObject, x: number, y: number) {
    if (!scene || !canMove(item)) return
    const newX = Math.round(limit(x, 0, scene.width - item.width))
    const newY = Math.round(limit(y, 0, scene.height - item.height))
    setObjects(old => old.map(row => row.id === item.id ? { ...row, x: newX, y: newY } : row))
    const { error: err } = await supabase.rpc('hb_vtt_move_object', {
      p_object_id: item.id, p_x: newX, p_y: newY,
    })
    if (err) { setError('Movimento negado: ' + err.message); void loadObjects() }
  }

  async function updateTokenAppearance(item: SceneObject, patch: { emoji?: string; image_url?: string }) {
    if (!isMaster && !(item.kind === 'character' && canMove(item))) return
    const emoji = patch.emoji === undefined ? item.emoji : patch.emoji.trim()
    const imageUrl = patch.image_url === undefined ? item.image_url : patch.image_url.trim()
    if (!imageUrl || /^https:\/\//i.test(imageUrl) || (imageUrl.startsWith(`storage:${campaignId}/`) && (isMaster || (item.kind === 'character' && canMove(item)))) || imageUrl === item.image_url) {
      setError('')
      if (isMaster) {
        await patchObject(item.id, patch)
      } else {
        const { error: err } = await supabase.rpc('hb_vtt_set_token_icon', {
          p_object_id: item.id, p_emoji: emoji, p_image_url: imageUrl,
        })
        if (err) { setError('Não foi possível alterar a peça: ' + err.message); return }
        setObjects(old => old.map(obj => obj.id === item.id ? { ...obj, emoji, image_url: imageUrl } : obj))
      }
      if (patch.emoji !== undefined) setTokenEmojiDraft(emoji)
      if (patch.image_url !== undefined) setTokenUrlDraft(imageUrl)
    } else {
      setError('A imagem da peça deve usar uma URL HTTPS. Você também pode remover a imagem.')
    }
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>, target: 'background' | 'object' | 'token') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !scene || assetUploading || (!isMaster && !(target === 'token' && selected?.kind === 'character' && canMove(selected))) || (target === 'token' && !selected)) return
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      setError('Use PNG, JPG ou WebP de até 15 MB.'); return
    }
    setAssetUploading(true); setError('')
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${campaignId}/${userId}/${crypto.randomUUID()}.${ext}`
    const { error: err } = await supabase.storage.from('hb-vtt-assets').upload(path, file, { upsert: false, contentType: file.type })
    if (err) setError('Falha ao enviar imagem: ' + err.message)
    else {
      const url = `storage:${path}`
      if (target === 'background') await patchScene({ background_url: url })
      else if (target === 'token' && selected) { await updateTokenAppearance(selected, { image_url: url }) }
      else await addObject({ kind: 'image', name: file.name.slice(0, 80), emoji: '', image_url: url,
        x: 120, y: 120, width: 420, height: 300, layer: 0 })
    }
    setAssetUploading(false)
  }
  function fitScene() {
    if (!scene || !viewportRef.current) return
    const r = viewportRef.current.getBoundingClientRect()
    const newZoom = limit(Math.min((r.width - 90) / scene.width, (r.height - 90) / scene.height), .15, 2)
    setZoom(newZoom)
    setOffset(pt((r.width - scene.width * newZoom) / 2, (r.height - scene.height * newZoom) / 2))
  }
  useEffect(() => {
    // Ajusta automaticamente apenas quando uma cena diferente é aberta.
    if (!sceneId || !scene) return
    const handle = requestAnimationFrame(fitScene)
    return () => cancelAnimationFrame(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId])
  const worldFromPointer = (event: PointerEvent<HTMLElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return pt(0, 0)
    const camera = cameraRef.current
    return pt((event.clientX - rect.left - camera.offset.x) / camera.zoom,
      (event.clientY - rect.top - camera.offset.y) / camera.zoom)
  }
  const snapPoint = (p: Point, shiftKey = false) => scene && (scene.snap_to_grid || shiftKey)
    ? pt(Math.round(p.x / scene.grid_size) * scene.grid_size, Math.round(p.y / scene.grid_size) * scene.grid_size) : p

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!scene || event.button !== 0) return
    const target = (event.target as HTMLElement).closest('[data-vtt-object]') as HTMLElement | null
    const id = target?.dataset.vttObject
    const item = objectsRef.current.find(row => row.id === id)
    const point = worldFromPointer(event)
    if (tool === 'pan' || event.altKey) {
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { kind: 'pan', start: pt(event.clientX, event.clientY),
        origin: cameraRef.current.offset, points: [], tool, pointerId: event.pointerId }
      return
    }
    if (tool === 'select' && item) {
      setSelectedId(item.id)
      if (!canMove(item)) return
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { kind: 'token', id: item.id, start: point,
        origin: pt(item.x, item.y), points: [point], tool, pointerId: event.pointerId }
      return
    }
    if (tool === 'erase' && isMaster && item) { void deleteObject(item.id); return }
    if (tool === 'select' && !item) { setSelectedId(''); return }
    if (tool === 'ruler' || isMaster && ['draw', 'reveal', 'hide'].includes(tool)) {
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { kind: tool === 'ruler' ? 'ruler' : tool === 'draw' ? 'draw' : 'fog',
        start: point, origin: point, points: [point], tool, pointerId: event.pointerId }
      if (tool === 'ruler') setMeasure({ start: point, end: point })
      else setDraft([point])
    }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    const world = worldFromPointer(event)
    lastPointerRef.current = world
    if (!current || current.pointerId !== event.pointerId || !scene) return
    if (current.kind === 'pan') {
      setOffset(pt(current.origin.x + event.clientX - current.start.x, current.origin.y + event.clientY - current.start.y))
    } else if (current.kind === 'token' && current.id) {
      const item = objectsRef.current.find(row => row.id === current.id)
      if (!item) return
      const dest = snapPoint(pt(current.origin.x + world.x - current.start.x,
        current.origin.y + world.y - current.start.y), event.shiftKey)
      setObjects(old => old.map(row => row.id === item.id ? { ...row,
        x: limit(dest.x, 0, scene.width - row.width), y: limit(dest.y, 0, scene.height - row.height) } : row))
    } else if (current.kind === 'ruler') setMeasure({ start: current.start, end: world })
    else {
      const next = [...current.points, world]
      current.points = next
      setDraft(next)
    }
  }
  async function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current
    if (!current || current.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!scene) return
    if (current.kind === 'token' && current.id) {
      const item = objectsRef.current.find(row => row.id === current.id)
      if (item && (item.x !== current.origin.x || item.y !== current.origin.y)) await moveObject(item, item.x, item.y)
    } else if (current.kind === 'draw' && isMaster) {
      const points = current.points
      if (points.length > 1) await addObject({ kind: 'drawing', name: 'Desenho', layer: 10,
        x: 0, y: 0, width: 1, height: 1, style: { points, color: drawColor, size: brush / 10 } })
    } else if (current.kind === 'fog' && isMaster) {
      const entry: Stroke = { id: crypto.randomUUID(), points: current.points, radius: brush,
        mode: current.tool === 'reveal' ? 'reveal' : 'hide' }
      await patchScene({ fog_enabled: true, fog_strokes: [...scene.fog_strokes, entry].slice(-300) })
    }
    setDraft([])
  }
  // O listener nativo usa passive:false; React pode registrar wheel como passivo.
  useEffect(() => {
    const node = viewportRef.current
    if (!node || !sceneId) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const r = node.getBoundingClientRect()
      const oldZoom = cameraRef.current.zoom
      const next = limit(oldZoom * (event.deltaY > 0 ? .91 : 1.1), .15, 3.5)
      const x = event.clientX - r.left, y = event.clientY - r.top
      setOffset(old => pt(x - (x - old.x) * next / oldZoom, y - (y - old.y) * next / oldZoom))
      setZoom(next)
    }
    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [sceneId])
  function focusObject(item: SceneObject) {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const z = cameraRef.current.zoom
    setOffset(pt(rect.width / 2 - (item.x + item.width / 2) * z,
      rect.height / 2 - (item.y + item.height / 2) * z))
  }
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.ctrlKey || event.metaKey) return
      if (event.key === 'Escape') { setSelectedId(''); setTool('select') }
      const keyMap: Record<string, Tool> = { v: 'select', h: 'pan', r: 'ruler', d: 'draw', f: 'reveal', g: 'hide', e: 'erase' }
      if (keyMap[event.key.toLowerCase()] && (isMaster || ['select','pan','ruler'].includes(keyMap[event.key.toLowerCase()]))) setTool(keyMap[event.key.toLowerCase()])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isMaster])

  const initiative = useMemo(() => [...objects].filter(item => ['character', 'enemy', 'marker'].includes(item.kind))
    .sort((a, b) => (Number(b.style?.initiative) || 0) - (Number(a.style?.initiative) || 0) || a.name.localeCompare(b.name, 'pt-BR')), [objects])
  async function nextTurn(step: number) {
    if (!scene || !isMaster || !initiative.length) return
    const index = initiative.findIndex(item => item.id === scene.active_object_id)
    const nextIndex = index === -1 ? 0 : (index + step + initiative.length) % initiative.length
    const wrap = index !== -1 && step === 1 && nextIndex === 0
    const rewind = index !== -1 && step === -1 && nextIndex === initiative.length - 1
    await patchScene({ active_object_id: initiative[nextIndex].id,
      round: Math.max(1, scene.round + (wrap ? 1 : rewind ? -1 : 0)) })
  }
  function titleOfObject(item: SceneObject) {
    return item.name || (item.kind === 'image' ? 'Imagem' : item.kind === 'drawing' ? 'Desenho' : 'Peça')
  }
  const objectGroups = [{ title: 'Peças', entries: objects.filter(item => ['character','enemy','marker'].includes(item.kind)) },
    { title: 'Imagens e mapas', entries: objects.filter(item => item.kind === 'image') },
    { title: 'Desenhos e texto', entries: objects.filter(item => ['drawing','text'].includes(item.kind)) }]
  const rosterCharacters = characters.filter(item => !objects.some(token => token.kind === 'character' && token.ref_id === item.id) && item.name.toLowerCase().includes(rosterSearch.toLowerCase()))
  const rosterEnemies = enemies.filter(item => !objects.some(token => token.kind === 'enemy' && token.ref_id === item.id) && item.name.toLowerCase().includes(rosterSearch.toLowerCase()))

  return <div className={`hvtt ${fullscreen ? 'hvtt-fullscreen' : ''}`} style={{ '--hvtt-sidebar-width': `${sideWidth}px` } as CSSProperties}>
    <header className="hvtt-topbar">
      <div className="hvtt-brand"><span className="hvtt-brand-mark">✦</span><span><strong>HäxBag</strong><small>MESA VIRTUAL</small></span></div>
      <div className="hvtt-breadcrumb"><span>{campaignName}</span><span className="hvtt-chevron">›</span>
        <select value={seasonId} onChange={event => onSeasonChange(event.target.value)} aria-label="Temporada">
          {seasons.map(item => <option value={item.id} key={item.id}>T{item.season_number} · {item.name}</option>)}
        </select><span className="hvtt-chevron">›</span>
        <select aria-label="Cena" value={sceneId} onChange={event => setSceneId(event.target.value)}>
          {!scenes.length && <option value="">Nenhuma cena</option>}
          {scenes.map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active ? ' · ativa' : ''}</option>)}
        </select>
      </div>
      <div className="hvtt-top-actions">
        <span className={`hvtt-live ${live ? 'is-live' : ''}`} title="Conexão do canal Realtime"><i/>{live ? 'Ao vivo' : 'Reconectando'}</span>
        {isMaster && <button className="hvtt-primary" onClick={() => void createScene()}>＋ Nova cena</button>}
        <button className="hvtt-icon-button" title={fullscreen ? 'Sair da tela cheia' : 'Abrir mesa em tela cheia'} onClick={() => setFullscreen(old => !old)}>{fullscreen ? '⤓' : '⤢'}</button>
      </div>
    </header>
    {error && <div className="hvtt-alert" role="alert"><span>⚠ {error}</span><button onClick={() => setError('')}>✕</button></div>}
    {info && <div className="hvtt-info"><span>{info}</span><button onClick={() => setInfo('')}>✕</button></div>}
    <div className="hvtt-workspace">
      {showLayers && <aside className="hvtt-left">
        <div className="hvtt-side-head"><strong>Cenas e camadas</strong><button className="hvtt-plain" onClick={() => setShowLayers(false)} title="Recolher painel">«</button></div>
        <div className="hvtt-scene-list">{scenes.map(item => <button key={item.id} onClick={() => setSceneId(item.id)} className={`hvtt-scene-card ${item.id === sceneId ? 'active' : ''}`}>
          <span className="hvtt-scene-thumb">{item.background_url ? '🗺' : '✧'}</span><span className="hvtt-scene-title"><strong>{item.name}</strong><small>{item.is_active ? '● Cena ativa' : item.is_visible ? 'Visível' : 'Oculta'}</small></span>
        </button>)}</div>
        {scene && <>
          <div className="hvtt-panel-title"><span>CAMADAS</span><span>{objects.length}</span></div>
          <div className="hvtt-layers"><button className="hvtt-layer-system" onClick={() => isMaster && void patchScene({ show_grid: !scene.show_grid })}><span>▦</span> Grade <small>{scene.show_grid ? 'Visível' : 'Oculta'}</small></button>
            <button className="hvtt-layer-system" onClick={() => isMaster && void patchScene({ fog_enabled: !scene.fog_enabled })}><span>◕</span> Névoa de guerra <small>{scene.fog_enabled ? 'Ativa' : 'Desativada'}</small></button>
            {objectGroups.map(group => <div className="hvtt-layer-group" key={group.title}>
              <p>{group.title} <span>{group.entries.length}</span></p>
              {[...group.entries].reverse().map(item => <div key={item.id} className={`hvtt-layer-row ${selectedId === item.id ? 'selected' : ''}`}>
                <button className="hvtt-layer-name" title={titleOfObject(item)} onClick={() => {setSelectedId(item.id);focusObject(item)}}><span>{item.kind === 'drawing' ? '✎' : item.kind === 'image' ? '▧' : item.emoji || '✦'}</span>{titleOfObject(item)}</button>
                {isMaster && <><button title="Ocultar ou mostrar aos jogadores" className="hvtt-tiny" onClick={() => void patchObject(item.id, { visible_to_players: !item.visible_to_players })}>{item.visible_to_players ? '◉' : '◌'}</button>
                  <button title="Bloquear ou desbloquear" className="hvtt-tiny" onClick={() => void patchObject(item.id, { locked: !item.locked })}>{item.locked ? '🔒' : '♧'}</button></>}
              </div>)}</div>)}
          </div>
        </>}
        <footer className="hvtt-left-footer">{isMaster && scene && <>
          <button className="hvtt-add-button" onClick={() => setShowAssets(old => !old)}>＋ Adicionar ao mapa</button>
          <button className="hvtt-plain" onClick={() => void activateScene()} disabled={scene.is_active && scene.is_visible}>⏵ Exibir esta cena</button>
        </>}</footer>
      </aside>}
      <main className="hvtt-center">
        {scene ? <>
          <div className="hvtt-canvas-toolbar">
            {!showLayers && <button className="hvtt-icon-button" onClick={() => setShowLayers(true)} title="Mostrar camadas">☰</button>}
            {toolButtons.filter(item => isMaster || ['select','pan','ruler'].includes(item.id)).map(item => <button
              key={item.id} type="button" className={`hvtt-tool ${tool === item.id ? 'active' : ''}`} title={item.title}
              aria-label={item.title} onClick={() => setTool(item.id)}>{item.icon}</button>)}
            {['draw','reveal','hide'].includes(tool) && isMaster && <><label className="hvtt-brush">Tamanho <input type="range" min="12" max="180" value={brush} onChange={event => setBrush(Number(event.target.value))}/></label>
              {tool === 'draw' && <input type="color" value={drawColor} aria-label="Cor do desenho" onChange={event => setDrawColor(event.target.value)}/>}</>}
            <span className="hvtt-tool-sep"/>
            <button className="hvtt-tool" onClick={fitScene} title="Enquadrar cena">⛶</button>
            <button className="hvtt-tool" onClick={() => { setZoom(1); setOffset(pt(20,20)) }} title="Zoom 100%">1:1</button>
            <span className="hvtt-zoom-label">{Math.round(zoom * 100)}%</span>
          </div>
          <div className={`hvtt-viewport tool-${tool}`} ref={viewportRef} onPointerDown={pointerDown} onPointerMove={pointerMove}
            onPointerUp={event => void pointerUp(event)} onPointerCancel={() => {dragRef.current = null;setDraft([])}}
            onContextMenu={event => event.preventDefault()}>
            <div className="hvtt-world" style={{ width: scene.width, height: scene.height,
              transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
              <div className="hvtt-map-background" style={{ backgroundImage: resolveImage(scene.background_url) ? `url(${JSON.stringify(resolveImage(scene.background_url))})` : undefined }}/>
              {scene.show_grid && <div className="hvtt-grid" style={{ backgroundSize: `${scene.grid_size}px ${scene.grid_size}px` }}/>} 
              <svg className="hvtt-drawing-layer" width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`}>
                {objects.filter(item => item.kind === 'drawing').map(item => <path data-vtt-object={item.id} key={item.id} d={pointPath(item.style?.points || [])}
                  fill="none" stroke={item.style?.color || '#ffd28a'} strokeWidth={item.style?.size || 6} strokeLinejoin="round" strokeLinecap="round" opacity={.92} />)}
                {draft.length > 1 && tool === 'draw' && <path d={pointPath(draft)} fill="none" stroke={drawColor} strokeWidth={brush / 10} strokeLinecap="round" strokeLinejoin="round"/>}
              </svg>
              {objects.filter(item => item.kind !== 'drawing').map(item => {
                const isFigure = ['character','enemy','marker'].includes(item.kind)
                return <div key={item.id} data-vtt-object={item.id} title={item.name}
                  className={`hvtt-object ${isFigure ? 'figure' : ''} ${isFigure && resolveImage(item.image_url) ? 'has-portrait' : ''} ${selectedId === item.id ? 'selected' : ''} ${scene.active_object_id === item.id ? 'current-turn' : ''} ${canMove(item) ? 'movable' : ''} ${item.kind}`}
                  style={{ left: item.x, top: item.y, width: item.width, height: item.height,
                    zIndex: item.layer + 20, transform: `rotate(${item.rotation}deg)` }}>
                  {item.kind === 'image' ? <img src={resolveImage(item.image_url)} alt="" draggable={false} /> : item.kind === 'text' ? <span className="hvtt-text-object">{item.name}</span> :
                    <><span className="hvtt-token-face">{resolveImage(item.image_url) ? <img src={resolveImage(item.image_url)} alt="" draggable={false}/> : item.emoji || '✦'}</span>
                      <span className="hvtt-token-name">{item.name}</span></>}
                  {isFigure && <span className="hvtt-token-type">{item.kind === 'enemy' ? '◆' : item.kind === 'character' ? '●' : '◈'}</span>}
                </div>
              })}
              {scene.fog_enabled && <svg className="hvtt-fog" width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`}>
                <defs><mask id={`hvtt-fog-${scene.id}`} maskUnits="userSpaceOnUse"><rect width={scene.width} height={scene.height} fill="white"/>
                  {scene.fog_strokes.map(stroke => <path key={stroke.id} d={pointPath(stroke.points)} stroke={stroke.mode === 'reveal' ? 'black' : 'white'}
                    fill="none" strokeWidth={stroke.radius * 2} strokeLinecap="round" strokeLinejoin="round" />)}</mask></defs>
                <rect width={scene.width} height={scene.height} fill="#05090e" opacity={isMaster ? .57 : .97} mask={`url(#hvtt-fog-${scene.id})`}/></svg>}
              {draft.length > 0 && ['reveal','hide'].includes(tool) && <svg className="hvtt-preview" width={scene.width} height={scene.height}>
                <path d={pointPath(draft)} fill="none" strokeWidth={brush*2} strokeLinecap="round" strokeLinejoin="round" opacity=".4"
                  stroke={tool === 'reveal' ? '#78e6b5' : '#ee7d9a'}/></svg>}
              {measure && <svg className="hvtt-measure" width={scene.width} height={scene.height}><path d={`M${measure.start.x},${measure.start.y} L${measure.end.x},${measure.end.y}`}
                stroke="#80e7ff" strokeDasharray="9 6" strokeWidth="3" fill="none"/>
                <text x={(measure.start.x+measure.end.x)/2} y={(measure.start.y+measure.end.y)/2 - 12} textAnchor="middle" fill="white" fontSize="18" stroke="#06111c" strokeWidth="5" paintOrder="stroke">{(Math.hypot(measure.end.x-measure.start.x,measure.end.y-measure.start.y)/scene.grid_size).toFixed(1)} casas</text></svg>}
            </div>
            <div className="hvtt-hint">{tool === 'select' ? 'Arraste peças · Shift ativa encaixe na grade' : tool === 'pan' ? 'Arraste para percorrer o mapa' : tool === 'ruler' ? 'Arraste para medir distâncias' : tool === 'draw' ? 'Desenhe livremente sobre a cena' : ['reveal','hide'].includes(tool) ? 'Pinte a névoa arrastando' : 'Clique para apagar objetos'}</div>
            {!scene.is_active && <div className="hvtt-scene-notice">Cena de preparação · não está ativa para os jogadores</div>}
          </div>
          <div className="hvtt-canvas-foot">
            <span>{scene.width} × {scene.height} px · {scene.grid_size}px/casa</span>
            <span>{isMaster ? 'Mestre · pode editar o cenário' : 'Jogador · controle apenas dos seus personagens'}</span>
            <div><button onClick={() => setZoom(z => limit(z / 1.2, .15, 3.5))}>−</button><input type="range" min="15" max="200" value={Math.round(zoom * 100)} onChange={event => setZoom(Number(event.target.value) / 100)} aria-label="Zoom"/><button onClick={() => setZoom(z => limit(z * 1.2, .15, 3.5))}>＋</button></div>
          </div>
        </> : <div className="hvtt-empty"><span>✧</span><h2>{loading ? 'Carregando mesa…' : 'A mesa está pronta para receber sua primeira cena'}</h2><p>{isMaster ? 'Crie uma cena, envie um mapa e adicione os personagens.' : 'O mestre ainda não compartilhou uma cena nesta temporada.'}</p>{isMaster && <button className="hvtt-primary" onClick={() => void createScene()}>＋ Criar primeira cena</button>}</div>}
      </main>
      <aside className="hvtt-right">
        <div className="hvtt-side-head"><strong>⚔ Iniciativa</strong></div>
          <section className="hvtt-turn-panel"><small>RODADA</small><strong>{scene?.round ?? '—'}</strong><span>{initiative.find(item => item.id === scene?.active_object_id)?.name || 'Aguardando combate'}</span>
            {isMaster && <div><button onClick={() => void nextTurn(-1)}>←</button><button onClick={() => void nextTurn(1)}>Próximo →</button></div>}</section>
          <div className="hvtt-panel-title"><span>ORDEM DE COMBATE</span><span>{initiative.length}</span></div>
          <div className="hvtt-initiative-list">{initiative.map((item,index) => <button key={item.id} className={`hvtt-initiative-entry ${scene?.active_object_id === item.id ? 'active' : ''}`} onClick={() => {setSelectedId(item.id);focusObject(item)}}>
            <span className="hvtt-init-rank">{String(index+1).padStart(2,'0')}</span><span className="hvtt-init-avatar">{item.emoji}</span><span className="hvtt-init-name"><strong>{item.name}</strong><small>{item.kind === 'enemy' ? 'Inimigo' : item.kind === 'character' ? 'Personagem' : 'Marcador'}</small></span>
            <span className="hvtt-init-value">{item.style?.initiative ?? '—'}</span>
          </button>)}{!initiative.length && <p className="hvtt-muted">Adicione peças para montar a iniciativa.</p>}</div>
      </aside>
    </div>
    {isMaster && scene && showAssets && <div className="hvtt-modal-backdrop" role="presentation" onPointerDown={event => { if(event.target===event.currentTarget)setShowAssets(false)}}><div className="hvtt-modal" role="dialog" aria-modal="true" aria-label="Adicionar ao mapa">
      <div className="hvtt-modal-head"><h3>Adicionar à cena</h3><button onClick={() => setShowAssets(false)}>✕</button></div>
      <div className="hvtt-modal-section"><h4>Participantes</h4><input placeholder="Buscar personagem ou inimigo" value={rosterSearch} onChange={event => setRosterSearch(event.target.value)}/>
        <div className="hvtt-add-roster">{rosterCharacters.map(item => <button key={item.id} onClick={() => {void addObject({kind:'character',ref_id:item.id,name:item.name,emoji:item.emoji||'🧑',x:200,y:200,width:64,height:64,style:{initiative:0}});setShowAssets(false)}}><span>{item.emoji||'🧑'}</span>{item.name} <small>Personagem</small></button>)}
          {rosterEnemies.map(item => <button key={item.id} onClick={() => {void addObject({kind:'enemy',ref_id:item.id,name:item.name,emoji:item.emoji||'👹',x:300,y:230,width:64,height:64,style:{initiative:0}});setShowAssets(false)}}><span>{item.emoji||'👹'}</span>{item.name} <small>Inimigo</small></button>)}
          {!rosterCharacters.length && !rosterEnemies.length && <p>Todos os participantes já estão na cena, ou não houve resultados.</p>}</div></div>
      <div className="hvtt-modal-section"><h4>Imagem e cenário</h4><div className="hvtt-modal-actions"><label className="hvtt-upload">{assetUploading?'Enviando…':'↑ Imagem de fundo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void uploadAsset(event,'background')}/></label>
        <label className="hvtt-upload">＋ Objeto de imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void uploadAsset(event,'object')}/></label></div>
        <div className="hvtt-url-row"><input placeholder="URL HTTPS do mapa" value={assetName} onChange={event => setAssetName(event.target.value)}/><button onClick={() => {if(/^https:\/\//i.test(assetName)){void patchScene({background_url:assetName});setShowAssets(false);setAssetName('')}else setError('Informe uma URL HTTPS válida.')}}>Aplicar</button></div></div>
      <div className="hvtt-modal-actions"><button onClick={() => {void addObject({kind:'marker',name:'Marcador',emoji:'📍',x:320,y:240,width:64,height:64,style:{initiative:0}});setShowAssets(false)}}>＋ Marcador</button>
        <button onClick={() => {const label=window.prompt('Texto a adicionar:')?.trim();if(label){void addObject({kind:'text',name:label.slice(0,150),emoji:'',x:300,y:300,width:180,height:50,layer:15});setShowAssets(false)}}}>T Texto</button></div>
      <div className="hvtt-modal-section"><h4>Configuração da cena</h4><div className="hvtt-settings-grid">
        <label>Nome da cena<input defaultValue={scene.name} key={scene.id} onBlur={event => {if(event.target.value.trim()&&event.target.value!==scene.name)void patchScene({name:event.target.value.trim()})}}/></label>
        <label>Grade (px)<input type="number" min="24" max="160" value={scene.grid_size} onChange={event => void patchScene({grid_size:limit(Number(event.target.value),24,160)})}/></label>
        <label>Largura (px)<input type="number" min="500" max="5000" defaultValue={scene.width} onBlur={event => void patchScene({width:limit(Number(event.target.value),500,5000)})}/></label>
        <label>Altura (px)<input type="number" min="400" max="5000" defaultValue={scene.height} onBlur={event => void patchScene({height:limit(Number(event.target.value),400,5000)})}/></label>
        <label className="hvtt-check"><input type="checkbox" checked={scene.snap_to_grid} onChange={event => void patchScene({snap_to_grid:event.target.checked})}/> Encaixar na grade</label>
        <label className="hvtt-check"><input type="checkbox" checked={scene.is_visible} onChange={event => void patchScene({is_visible:event.target.checked})}/> Visível aos jogadores</label></div>
        <div className="hvtt-modal-actions"><button onClick={() => void patchScene({fog_strokes:[]})}>Limpar névoa desenhada</button><button className="hvtt-danger" onClick={() => {setShowAssets(false);void deleteScene()}}>Excluir cena</button></div></div>
    </div></div>}
    {selected && scene && (isMaster || (selected.kind === 'character' && canMove(selected))) && <div className="hvtt-inspector"><header><strong>{selected.emoji} {titleOfObject(selected)}</strong><button title="Fechar propriedades" onClick={() => setSelectedId('')}>✕</button></header>
      <div className="hvtt-inspector-body">
        {['character', 'enemy', 'marker'].includes(selected.kind) && <section className="hvtt-appearance">
          <div className="hvtt-appearance-heading"><span className="hvtt-token-preview" aria-hidden="true">{resolveImage(selected.image_url) ? <img src={resolveImage(selected.image_url)} alt=""/> : selected.emoji || '✦'}</span>
            <div><strong>Aparência da peça</strong><small>O ícone da mesa é independente do emoji da ficha.</small></div></div>
          <label>Escolher emoji</label>
          <div className="hvtt-emoji-picker">{tokenIcons.map(icon => <button type="button" key={icon} className={selected.emoji === icon && !selected.image_url ? 'active' : ''} aria-label={`Usar ${icon} como ícone`} title={icon} onClick={() => void updateTokenAppearance(selected, { emoji: icon, image_url: '' })}>{icon}</button>)}</div>
          <div className="hvtt-appearance-input"><input aria-label="Emoji personalizado" placeholder="Outro emoji" value={tokenEmojiDraft} maxLength={32} onChange={event => setTokenEmojiDraft(event.target.value)}/><button type="button" onClick={() => void updateTokenAppearance(selected, { emoji: tokenEmojiDraft || '✦', image_url: '' })}>Usar</button></div>
          <label>Retrato por imagem HTTPS</label>
          <div className="hvtt-appearance-input"><input aria-label="URL do retrato da peça" placeholder="https://exemplo.com/personagem.png" value={tokenUrlDraft} maxLength={3000} onChange={event => setTokenUrlDraft(event.target.value)}/><button type="button" onClick={() => void updateTokenAppearance(selected, { image_url: tokenUrlDraft })}>Aplicar</button></div>
          <div className="hvtt-appearance-actions"><label className="hvtt-upload">{assetUploading ? 'Enviando…' : '↑ Enviar retrato'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={assetUploading} onChange={event => void uploadAsset(event,'token')}/></label>
            {selected.image_url && <button type="button" onClick={() => void updateTokenAppearance(selected, { image_url: '' })}>Remover imagem</button>}
          </div>
          {!isMaster && <p>Você pode enviar imagens e personalizar os ícones dos personagens que controla.</p>}
        </section>}
        {isMaster && <><label>Nome<input value={selected.name} onChange={event => setObjects(old => old.map(obj => obj.id===selected.id ? {...obj,name:event.target.value}:obj))}
        onBlur={event => void patchObject(selected.id,{name:event.target.value})}/></label>
        <div className="hvtt-inspector-grid"><label>X<input type="number" value={Math.round(selected.x)} onChange={event => void patchObject(selected.id,{x:Number(event.target.value)})}/></label>
          <label>Y<input type="number" value={Math.round(selected.y)} onChange={event => void patchObject(selected.id,{y:Number(event.target.value)})}/></label>
          <label>Largura<input type="number" min="8" value={selected.width} onChange={event => void patchObject(selected.id,{width:Math.max(8,Number(event.target.value))})}/></label>
          <label>Altura<input type="number" min="8" value={selected.height} onChange={event => void patchObject(selected.id,{height:Math.max(8,Number(event.target.value))})}/></label>
          <label>Giro °<input type="number" value={selected.rotation} onChange={event => void patchObject(selected.id,{rotation:Number(event.target.value)})}/></label>
          <label>Camada<input type="number" value={selected.layer} onChange={event => void patchObject(selected.id,{layer:Number(event.target.value)})}/></label></div>
        {['character','enemy','marker'].includes(selected.kind) && <label>Iniciativa<input type="number" value={selected.style?.initiative ?? 0} onChange={event => void patchObject(selected.id,{style:{...selected.style,initiative:Number(event.target.value)}})}/></label>}
        <label className="hvtt-check"><input type="checkbox" checked={selected.visible_to_players} onChange={event => void patchObject(selected.id,{visible_to_players:event.target.checked})}/> Visível aos jogadores</label>
        <label className="hvtt-check"><input type="checkbox" checked={selected.locked} onChange={event => void patchObject(selected.id,{locked:event.target.checked})}/> Travar movimentação</label>
        <div className="hvtt-modal-actions"><button className="hvtt-danger" onClick={() => void deleteObject(selected.id)}>Excluir objeto</button></div>
        </>}
      </div></div>}
    <div className="hvtt-corner"><button className="hvtt-plain" onClick={() => setSideWidth(old => old === 250 ? 300 : 250)} title="Alternar largura das camadas">⤢</button></div>
  </div>
}
