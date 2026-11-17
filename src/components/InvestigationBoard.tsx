import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '../supabase'
import './InvestigationBoard.css'

type Category = 'clue' | 'person' | 'place' | 'event' | 'theory'
type Visibility = 'public' | 'master'
type CardStatus = 'open' | 'verified' | 'solved'
type Priority = 'low' | 'normal' | 'high' | 'critical'
type Relation = 'evidence' | 'suspect' | 'timeline' | 'contradiction' | 'other'
type BoardView = 'board' | 'timeline'
type ImageDisplayMode = 'photo' | 'document'
type Attachment = { id: string; url: string; caption: string }
const MAX_ATTACHMENTS = 6
const MAX_IMAGE_FILE_BYTES = 12_000_000
const MAX_IMAGE_DATA_CHARS = 1_850_000
const priorityInfo: Record<Priority,{label:string; color:string}> = {
  low:{label:'Baixa',color:'#8ab7ad'},normal:{label:'Normal',color:'#a1a9bb'},
  high:{label:'Alta',color:'#edbf68'},critical:{label:'Crítica',color:'#eb756f'},
}
const relationInfo: Record<Relation,{label:string;color:string;dash?:string}> = {
  evidence:{label:'Evidência',color:'#de947b'},
  suspect:{label:'Suspeita',color:'#e8b96f',dash:'7 5'},
  timeline:{label:'Cronologia',color:'#85b8cb'},
  contradiction:{label:'Contradição',color:'#d77eaa',dash:'4 7'},
  other:{label:'Relação',color:'#aab9a6'},
}
const safeImageUrl = (value:string) => /^https:\/\//i.test(value.trim()) || /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value.trim())
const dateLabel = (value:string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Data indefinida'

async function imageFileToDataUrl(file:File, asDocument=false): Promise<string> {
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('Formatos permitidos: JPG, PNG, WebP e GIF.')
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error('A imagem deve ter até 12 MB antes da compactação.')
  const raw = await new Promise<string>((resolve,reject)=>{
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Imagem inválida.'))
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'))
    reader.readAsDataURL(file)
  })
  if (file.type === 'image/png' && raw.length <= MAX_IMAGE_DATA_CHARS) return raw
  if (file.type === 'image/gif') {
    if (raw.length > MAX_IMAGE_DATA_CHARS) throw new Error('GIF muito grande. Envie um GIF menor ou uma imagem estática.')
    return raw
  }
  const img = await new Promise<HTMLImageElement>((resolve,reject)=>{
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Não foi possível decodificar a imagem.'))
    el.src = raw
  })
  let scale = Math.min(1, (asDocument ? 2400 : 1500) / Math.max(img.naturalWidth,img.naturalHeight))
  for (let attempt=0;attempt<5;attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1,Math.round(img.naturalWidth*scale))
    canvas.height = Math.max(1,Math.round(img.naturalHeight*scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem.')
    ctx.drawImage(img,0,0,canvas.width,canvas.height)
    const encoded = canvas.toDataURL('image/webp',0.82 - attempt*0.09)
    if (encoded.length <= MAX_IMAGE_DATA_CHARS) return encoded
    scale *= 0.78
  }
  throw new Error('A imagem ficou grande demais mesmo após compactação.')
}
type InvestigationCard = {
  id: string
  campaign_id: string
  season_id: string | null
  title: string
  description: string
  category: Category
  visibility: Visibility
  status: CardStatus
  x: number
  y: number
  image_url: string | null
  image_caption: string
  image_display_mode: ImageDisplayMode
  image_attachments: Attachment[]
  priority: Priority
  pinned: boolean
  group_name: string
  event_date: string | null
  created_at: string
  updated_at: string
}
type InvestigationLink = { id: string; campaign_id: string; from_card_id: string; to_card_id: string; label: string; relation_type: Relation }
type Draft = Pick<InvestigationCard,'title'|'description'|'category'|'visibility'|'status'|'season_id'|'image_url'|'image_caption'|'image_display_mode'|'image_attachments'|'priority'|'pinned'|'group_name'|'event_date'>
const newDraft = (seasonId: string): Draft => ({ title: '', description: '', category: 'clue', visibility: 'public', status: 'open', season_id: seasonId || null, image_url: '', image_caption: '', image_display_mode: 'photo', image_attachments: [], priority:'normal', pinned:false, group_name:'', event_date:null })
const catInfo: Record<Category,{emoji:string; label:string; accent:string}> = {
  clue:{emoji:'🔎',label:'Pista',accent:'#c98a65'},
  person:{emoji:'🧑',label:'Pessoa',accent:'#98a7c3'},
  place:{emoji:'📍',label:'Local',accent:'#799f85'},
  event:{emoji:'🕰️',label:'Evento',accent:'#b28eac'},
  theory:{emoji:'💡',label:'Teoria',accent:'#d2a44e'},
}
const statusLabel: Record<CardStatus,string> = {open:'Em análise', verified:'Confirmado', solved:'Resolvido'}
const CANVAS_W = 3600
const CANVAS_H = 2400
const clamp = (n:number, lower:number, upper:number) => Math.max(lower, Math.min(upper, n))
const cardIsDocument = (card:InvestigationCard) => card.image_display_mode === 'document' && Boolean(card.image_url || card.image_attachments?.length)
export default function InvestigationBoard({ campaignId, seasonId, seasons, isMaster, userId }:{
  campaignId:string; seasonId:string; seasons:{id:string;name:string}[]; isMaster:boolean; userId:string
}) {
  const [cards,setCards] = useState<InvestigationCard[]>([])
  const [links,setLinks] = useState<InvestigationLink[]>([])
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [search,setSearch] = useState('')
  const [seasonFilter,setSeasonFilter] = useState('all')
  const [categoryFilter,setCategoryFilter] = useState<Category|'all'>('all')
  const [statusFilter,setStatusFilter] = useState<CardStatus|'all'>('all')
  const [visibilityFilter,setVisibilityFilter] = useState<Visibility|'all'>('all')
  const [priorityFilter,setPriorityFilter] = useState<Priority|'all'>('all')
  const [groupFilter,setGroupFilter] = useState('all')
  const [pinnedOnly,setPinnedOnly] = useState(false)
  const [view,setView] = useState<BoardView>('board')
  const [zoom,setZoom] = useState(0.65)
  const [showInspector,setShowInspector] = useState(true)
  const [isPanning,setIsPanning] = useState(false)
  const [arrangeMode,setArrangeMode] = useState<'category'|'group'>('group')
  const [includeSecrets,setIncludeSecrets] = useState(true)
  const [editorId,setEditorId] = useState<string|null>(null)
  const [draft,setDraft] = useState<Draft>(newDraft(seasonId))
  const [editing,setEditing] = useState(false)
  const [linkFrom,setLinkFrom] = useState('')
  const [linkTo,setLinkTo] = useState('')
  const [linkLabel,setLinkLabel] = useState('')
  const [relationType,setRelationType] = useState<Relation>('evidence')
  const [connecting,setConnecting] = useState(false)
  const [selectedId,setSelectedId] = useState<string | null>(null)
  const [assetSizes,setAssetSizes] = useState<Record<string,{width:number;height:number}>>({})
  const [previewImage,setPreviewImage] = useState<{src:string; title:string; caption:string} | null>(null)
  const editingRef = useRef(false)
  const dragRef = useRef<{id:string;clientX:number;clientY:number;x:number;y:number;nextX:number;nextY:number}|null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{pointerId:number;clientX:number;clientY:number;scrollLeft:number;scrollTop:number}|null>(null)

  // Listener não-passivo: a rodinha ajusta o zoom sem rolar a página ao mesmo tempo.
  useEffect(() => {
    const viewport = scrollRef.current
    if (!viewport || view !== 'board') return
    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      const current = scrollRef.current
      if (!current) return
      const rect = current.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top
      const boardX = (current.scrollLeft + offsetX) / zoom
      const boardY = (current.scrollTop + offsetY) / zoom
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * current.clientHeight : event.deltaY
      const next = clamp(Math.round((zoom + (delta < 0 ? .08 : -.08)) * 100) / 100, .3, 1.5)
      if (next === zoom) return
      setZoom(next)
      window.requestAnimationFrame(() => {
        const scroller = scrollRef.current
        if (!scroller) return
        scroller.scrollLeft = boardX * next - offsetX
        scroller.scrollTop = boardY * next - offsetY
      })
    }
    viewport.addEventListener('wheel', handleWheel, { passive:false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [view,zoom])

  function cardCenter(card:InvestigationCard) {
    const imageSize = cardIsDocument(card) ? assetSizes[card.id] : null
    return {
      x: Number(card.x)/100*CANVAS_W + (imageSize ? imageSize.width/2 : cardIsDocument(card) ? 220 : 124),
      y: Number(card.y)/100*CANVAS_H + (imageSize ? imageSize.height/2 : cardIsDocument(card) ? 240 : 106),
    }
  }

  const refresh = useCallback(async () => {
    const [c,l] = await Promise.all([
      supabase.from('hax_investigation_cards').select('id,campaign_id,season_id,title,description,category,visibility,status,x,y,image_url,image_caption,image_display_mode,image_attachments,priority,pinned,group_name,event_date,created_at,updated_at').eq('campaign_id',campaignId).order('created_at'),
      supabase.from('hax_investigation_links').select('id,campaign_id,from_card_id,to_card_id,label,relation_type').eq('campaign_id',campaignId),
    ])
    if (c.error || l.error) {
      setError(`Não foi possível carregar a Mesa de Investigação: ${c.error?.message || l.error?.message}. Execute o SQL da V117/V119/V120.`)
    } else {
      setCards((c.data || []) as InvestigationCard[])
      setLinks((l.data || []) as InvestigationLink[])
      setError('')
    }
    setLoading(false)
  },[campaignId])

  useEffect(() => {
    setLoading(true)
    setCards([])
    setLinks([])
    setSeasonFilter('all')
    setStatusFilter('all')
    setVisibilityFilter('all')
    setEditing(false)
    setConnecting(false)
    setSelectedId(null)
    void refresh()
    const channel = supabase.channel(`hax-investigation-${campaignId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'hax_investigation_cards',filter:`campaign_id=eq.${campaignId}`},()=>{if(!dragRef.current)void refresh()})
      .on('postgres_changes',{event:'*',schema:'public',table:'hax_investigation_links',filter:`campaign_id=eq.${campaignId}`},()=>void refresh())
      .subscribe()
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible' && !dragRef.current && !editingRef.current)void refresh()},30000)
    return ()=>{window.clearInterval(timer);void supabase.removeChannel(channel)}
  },[campaignId,refresh])

  useEffect(()=>{editingRef.current=editing},[editing])

  useEffect(() => {
    if (!editing) setDraft(newDraft(seasonId))
  }, [seasonId, editing])

  const visibleCards = useMemo(() => cards.filter(card =>
    (seasonFilter === 'all' || card.season_id === seasonFilter || (!card.season_id && seasonFilter === 'global'))
    && (categoryFilter === 'all' || card.category === categoryFilter)
    && (statusFilter === 'all' || card.status === statusFilter)
    && (visibilityFilter === 'all' || card.visibility === visibilityFilter)
    && (priorityFilter === 'all' || card.priority === priorityFilter)
    && (groupFilter === 'all' || (groupFilter === '__none' ? !card.group_name : card.group_name === groupFilter))
    && (!pinnedOnly || card.pinned)
    && (card.visibility === 'public' || (isMaster && includeSecrets))
    && `${card.title} ${card.description} ${card.image_caption || ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  ), [cards, seasonFilter, categoryFilter, statusFilter, visibilityFilter, priorityFilter, groupFilter, pinnedOnly, includeSecrets, search, isMaster])

  useEffect(() => {
    if (!visibleCards.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !visibleCards.some(card => card.id === selectedId)) setSelectedId(visibleCards[0].id)
  }, [visibleCards, selectedId])

  const shown = useMemo(() => new Map(visibleCards.map(card => [card.id, card])), [visibleCards])
  const visibleLinks = useMemo(() => links.filter(link => shown.has(link.from_card_id) && shown.has(link.to_card_id)), [links, shown])
  const publicCount = cards.filter(card => card.visibility === 'public').length
  const imageCount = cards.reduce((sum,card)=>sum+(card.image_url ? 1 : 0)+(card.image_attachments?.length || 0),0)
  const groupNames = useMemo(()=>Array.from(new Set(cards.map(card=>card.group_name).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR')), [cards])
  const timelineCards = useMemo(()=>[...visibleCards].sort((a,b)=>{
    if(!a.event_date) return b.event_date ? 1 : a.title.localeCompare(b.title,'pt-BR')
    if(!b.event_date) return -1
    return a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title,'pt-BR')
  }),[visibleCards])
  const boardAreas = useMemo(()=>{
    const names=Array.from(new Set(visibleCards.map(card=>card.group_name).filter(Boolean)))
    return names.map((name,index)=>{
      const list=visibleCards.filter(card=>card.group_name===name)
      const minX=Math.min(...list.map(card=>Number(card.x)))
      const maxX=Math.max(...list.map(card=>Number(card.x)))
      const minY=Math.min(...list.map(card=>Number(card.y)))
      const maxY=Math.max(...list.map(card=>Number(card.y)))
      return {name,index, left:clamp(minX-1.4,0,84),top:clamp(minY-3.2,0,82),width:clamp(maxX-minX+16,17,95),height:clamp(maxY-minY+21,20,98)}
    })
  },[visibleCards])
  const selectedCard = useMemo(() => visibleCards.find(card => card.id === selectedId) ?? null, [visibleCards, selectedId])

  function addCard(){setEditorId(null);setDraft(newDraft(seasonId));setEditing(true);setMessage('')}
  function editCard(card:InvestigationCard){setEditorId(card.id);setDraft({title:card.title,description:card.description,category:card.category,status:card.status,visibility:card.visibility,season_id:card.season_id,image_url:card.image_url || '',image_caption:card.image_caption || '',image_display_mode:card.image_display_mode || 'photo',image_attachments:card.image_attachments || [],priority:card.priority || 'normal',pinned:card.pinned || false,group_name:card.group_name || '',event_date:card.event_date || null});setEditing(true)}

  async function saveCard(event:FormEvent){
    event.preventDefault()
    if(!isMaster||busy||!draft.title.trim())return
    if (draft.image_url && !safeImageUrl(draft.image_url)) {setError('A imagem principal precisa usar HTTPS ou ser uma imagem carregada.');return}
    if (draft.image_attachments.some(image=>!safeImageUrl(image.url))) {setError('Há um anexo com endereço de imagem inválido.');return}
    setBusy(true)
    setError('')
    const payload={
      title:draft.title.trim(),
      description:draft.description.trim(),
      category:draft.category,
      visibility:draft.visibility,
      status:draft.status,
      season_id:draft.season_id||null,
      image_url:(draft.image_url || '').trim() || null,
      image_caption:draft.image_caption.trim(),
      image_display_mode:draft.image_display_mode,
      image_attachments:draft.image_attachments,
      priority:draft.priority,
      pinned:draft.pinned,
      group_name:draft.group_name.trim(),
      event_date:draft.event_date || null,
      updated_at:new Date().toISOString(),
    }
    const index=cards.length
    const x=7+(index%4)*23
    const y=8+(Math.floor(index/4)%4)*22
    const r=editorId
      ? await supabase.from('hax_investigation_cards').update(payload).eq('id',editorId).eq('campaign_id',campaignId)
      : await supabase.from('hax_investigation_cards').insert({...payload,campaign_id:campaignId,created_by:userId,x,y})
    setBusy(false)
    if(r.error) setError('Falha ao salvar pista: '+r.error.message)
    else {
      setEditing(false)
      setMessage(editorId?'Pista atualizada.':'Pista adicionada.')
      await refresh()
    }
  }

  async function deleteCard(card:InvestigationCard){
    if(!isMaster||busy||!window.confirm(`Excluir “${card.title}” e suas conexões?`)) return
    setBusy(true)
    const r=await supabase.from('hax_investigation_cards').delete().eq('id',card.id).eq('campaign_id',campaignId)
    setBusy(false)
    if(r.error) setError(r.error.message)
    else {setMessage('Pista excluída.'); await refresh()}
  }

  function startConnect(cardId?:string){setLinkFrom(cardId||'');setLinkTo('');setLinkLabel('');setRelationType('evidence');setConnecting(true)}
  async function addLink(event:FormEvent){
    event.preventDefault()
    if(!isMaster||busy||!linkFrom||!linkTo||linkFrom===linkTo) return
    if(links.some(link=>(link.from_card_id===linkFrom&&link.to_card_id===linkTo)||(link.from_card_id===linkTo&&link.to_card_id===linkFrom))){setError('Essas pistas já estão conectadas.');return}
    setBusy(true);setError('')
    const r=await supabase.from('hax_investigation_links').insert({campaign_id:campaignId,from_card_id:linkFrom,to_card_id:linkTo,label:linkLabel.trim(),relation_type:relationType,created_by:userId})
    setBusy(false)
    if(r.error) setError('Não foi possível ligar as pistas: '+r.error.message)
    else {setConnecting(false);setMessage('Conexão criada.');await refresh()}
  }
  async function removeLink(link:InvestigationLink){
    if(!isMaster||busy||!window.confirm('Remover esta conexão?')) return
    setBusy(true)
    const r=await supabase.from('hax_investigation_links').delete().eq('id',link.id).eq('campaign_id',campaignId)
    setBusy(false)
    if(r.error) setError(r.error.message)
    else {setMessage('Conexão removida.'); await refresh()}
  }

  // Move a área de visualização (não altera a posição salva de nenhum cartão).
  // Só inicia no fundo: os alfinetes continuam arrastando as pistas individualmente.
  function startPan(e:ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.pointerType === 'touch' && !e.isPrimary) || panRef.current) return
    const target = e.target
    if (!(target instanceof Element) || target.closest('.hb-investigation-note, button, a, input, textarea, select, [role="button"]')) return
    const viewport = e.currentTarget
    panRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
    viewport.setPointerCapture(e.pointerId)
    setIsPanning(true)
    e.preventDefault()
  }
  function movePan(e:ReactPointerEvent<HTMLDivElement>) {
    const pan=panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    const viewport=e.currentTarget
    viewport.scrollLeft=pan.scrollLeft-(e.clientX-pan.clientX)
    viewport.scrollTop=pan.scrollTop-(e.clientY-pan.clientY)
    e.preventDefault()
  }
  function stopPan(e:ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== e.pointerId) return
    panRef.current=null
    setIsPanning(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Conserva o centro visível durante as mudanças de zoom.
  function setBoardZoom(requested:number) {
    const next=clamp(Math.round(requested*100)/100,0.3,1.5)
    if (next===zoom) return
    const viewport=scrollRef.current
    if (!viewport) {setZoom(next);return}
    const cx=(viewport.scrollLeft+viewport.clientWidth/2)/zoom
    const cy=(viewport.scrollTop+viewport.clientHeight/2)/zoom
    setZoom(next)
    window.requestAnimationFrame(()=>{
      const current=scrollRef.current
      if (!current) return
      current.scrollLeft=cx*next-current.clientWidth/2
      current.scrollTop=cy*next-current.clientHeight/2
    })
  }

  // Centraliza um cartão sem mover sua posição real no quadro.
  function focusSelectedCard() {
    const viewport=scrollRef.current
    if (!viewport || !selectedCard) return
    const center=cardCenter(selectedCard)
    const centerX=center.x*zoom
    const centerY=center.y*zoom
    viewport.scrollTo({left:centerX-viewport.clientWidth/2,top:centerY-viewport.clientHeight/2,behavior:'smooth'})
  }

  // Calcula enquadramento somente com as pistas que o usuário pode ver.
  function frameVisibleCards() {
    const viewport=scrollRef.current
    if (!viewport || !visibleCards.length) return
    const points=visibleCards.map(cardCenter)
    const minX=Math.min(...points.map(point=>point.x))
    const maxX=Math.max(...points.map(point=>point.x))
    const minY=Math.min(...points.map(point=>point.y))
    const maxY=Math.max(...points.map(point=>point.y))
    const width=Math.max(450,maxX-minX+520)
    const height=Math.max(520,maxY-minY+610)
    const next=clamp(Math.round(Math.min(viewport.clientWidth/width,viewport.clientHeight/height,1.15)*100)/100,.3,1.5)
    setZoom(next)
    window.requestAnimationFrame(()=>{
      const current=scrollRef.current
      if (!current) return
      current.scrollLeft=((minX+maxX)/2)*next-current.clientWidth/2
      current.scrollTop=((minY+maxY)/2)*next-current.clientHeight/2
    })
  }

  function startDrag(e:ReactPointerEvent<HTMLButtonElement>, card:InvestigationCard){
    if(!isMaster||busy||card.pinned) return
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current={id:card.id,clientX:e.clientX,clientY:e.clientY,x:card.x,y:card.y,nextX:card.x,nextY:card.y}
    setSelectedId(card.id)
  }
  function moveDrag(e:ReactPointerEvent<HTMLButtonElement>){
    const drag=dragRef.current;if(!drag)return
    const card = cards.find(entry=>entry.id===drag.id)
    const imageSize=card && cardIsDocument(card) ? assetSizes[card.id] : null
    const maxX=imageSize ? Math.max(0, (CANVAS_W-imageSize.width)/CANVAS_W*100) : 85
    const maxY=imageSize ? Math.max(0, (CANVAS_H-imageSize.height)/CANVAS_H*100) : 80
    const x=clamp(drag.x+(e.clientX-drag.clientX)/(CANVAS_W*zoom)*100,0,maxX)
    const y=clamp(drag.y+(e.clientY-drag.clientY)/(CANVAS_H*zoom)*100,0,maxY)
    drag.nextX=x;drag.nextY=y
    setCards(previous=>previous.map(card=>card.id===drag.id?{...card,x,y}:card))
  }
  async function stopDrag(e:ReactPointerEvent<HTMLButtonElement>){
    const drag=dragRef.current;if(!drag)return
    dragRef.current=null
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
    if(Math.abs(drag.x-drag.nextX)+Math.abs(drag.y-drag.nextY)<.2)return
    const r=await supabase.from('hax_investigation_cards').update({x:drag.nextX,y:drag.nextY,updated_at:new Date().toISOString()}).eq('id',drag.id).eq('campaign_id',campaignId)
    if(r.error){setError('Não foi possível salvar a posição: '+r.error.message);await refresh()}
  }

  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const url = await imageFileToDataUrl(files[0], draft.image_display_mode === 'document')
      setDraft(current=>({...current,image_url:url}))
      setMessage('Capa carregada. Salve a pista para confirmar.')
      setError('')
    } catch (failure) {setError(failure instanceof Error ? failure.message : 'Falha ao carregar imagem.')}
    finally {setBusy(false)}
  }

  async function handleAttachments(event:ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (draft.image_attachments.length + files.length > MAX_ATTACHMENTS) {
      setError(`No máximo ${MAX_ATTACHMENTS} anexos adicionais por pista.`)
      return
    }
    setBusy(true)
    try {
      const uploaded:Attachment[]=[]
      for(const file of files) {
        const url = await imageFileToDataUrl(file, draft.image_display_mode === 'document')
        uploaded.push({id:crypto.randomUUID(),url,caption:file.name.slice(0,140)})
      }
      setDraft(current=>({...current,image_attachments:[...current.image_attachments,...uploaded].slice(0,MAX_ATTACHMENTS)}))
      setMessage(`${uploaded.length} imagem(ns) adicionada(s). Salve a pista para confirmar.`)
      setError('')
    } catch(failure) {setError(failure instanceof Error ? failure.message : 'Falha ao carregar anexos.')}
    finally {setBusy(false)}
  }

  function addAttachmentUrl() {
    if(draft.image_attachments.length >= MAX_ATTACHMENTS) {setError('Limite de anexos atingido.');return}
    setDraft(current=>({...current,image_attachments:[...current.image_attachments,{id:crypto.randomUUID(),url:'',caption:''}]}))
  }

  async function setPin(card:InvestigationCard) {
    if(!isMaster||busy) return
    setBusy(true)
    const r=await supabase.from('hax_investigation_cards').update({pinned:!card.pinned,updated_at:new Date().toISOString()}).eq('id',card.id).eq('campaign_id',campaignId)
    setBusy(false)
    if(r.error)setError('Não foi possível alterar a fixação: '+r.error.message)
    else {setMessage(card.pinned?'Pista liberada para movimentação.':'Pista fixada na posição atual.');await refresh()}
  }

  async function autoArrangeCards() {
    if (!isMaster || busy || visibleCards.filter(card=>!card.pinned).length < 2) return
    if (!window.confirm('Organizar automaticamente as pistas visíveis? Cartões fixados ficarão onde estão.')) return
    setBusy(true)
    setError('')
    const movable = visibleCards.filter(card=>!card.pinned)
    const arrangeGroups = arrangeMode === 'category' ?
      ['clue','person','place','event','theory'].map(key=>({key,list:movable.filter(card=>card.category===key)})) :
      Array.from(new Set(movable.map(card=>card.group_name || 'Sem área'))).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(key=>({key,list:movable.filter(card=>(card.group_name||'Sem área')===key)}))
    const updates: {id:string;x:number;y:number}[] = []
    let row = 0
    for (const group of arrangeGroups) {
      if (!group.list.length) continue
      group.list.forEach((card,index)=>{
        const col=index%5
        const localRow=Math.floor(index/5)
        updates.push({id:card.id,x:clamp(4+col*18.3,0,85),y:clamp(7+(row+localRow)*15.9,0,80)})
      })
      row += Math.ceil(group.list.length/5)+1
    }
    const operations = await Promise.all(updates.map(update=>
      supabase.from('hax_investigation_cards').update({x:update.x,y:update.y,updated_at:new Date().toISOString()}).eq('id',update.id).eq('campaign_id',campaignId)
    ))
    setBusy(false)
    const failure=operations.find(operation=>operation.error)
    if(failure?.error)setError('Falha ao organizar o quadro: '+failure.error.message)
    else setMessage(`Pistas organizadas por ${arrangeMode==='group'?'área':'categoria'}.`)
    await refresh()
  }

  function clearFilters() {
    setSearch('')
    setSeasonFilter('all')
    setCategoryFilter('all')
    setStatusFilter('all')
    setVisibilityFilter('all')
    setPriorityFilter('all')
    setGroupFilter('all')
    setPinnedOnly(false)
    if (isMaster) setIncludeSecrets(true)
  }

  return <section className="hb-investigation" aria-label="Mesa de Investigação">
    <header className="hb-investigation-hero">
      <div>
        <span className="hb-investigation-kicker">ARQUIVO DE PISTAS · CAMPANHA</span>
        <h1>🧵 Mesa de Investigação</h1>
        <p>Um espaço maior para conectar evidências, organizar teorias, reunir imagens e reconstruir acontecimentos.</p>
      </div>
      {isMaster && <div className="hb-investigation-actions">
        <button type="button" onClick={addCard}>＋ Nova pista</button>
        <button type="button" onClick={() => startConnect()} disabled={cards.length < 2}>↗ Ligar pistas</button>
        <label className="hb-investigation-arrange-label">Organizar por
          <select value={arrangeMode} onChange={event=>setArrangeMode(event.target.value as 'category'|'group')}>
            <option value="group">Área do quadro</option><option value="category">Categoria</option>
          </select>
        </label>
        <button type="button" onClick={() => void autoArrangeCards()} disabled={visibleCards.filter(card=>!card.pinned).length<2||busy}>⇆ Organizar</button>
      </div>}
    </header>

    <div className="hb-investigation-stats">
      <div><strong>{cards.length}</strong><small>Pistas disponíveis</small></div>
      <div><strong>{publicCount}</strong><small>Compartilhadas</small></div>
      <div><strong>{visibleLinks.length}</strong><small>Conexões visíveis</small></div>
      <div><strong>{imageCount}</strong><small>Imagens vinculadas</small></div>
    </div>

    <div className="hb-investigation-toolbar">
      <label>Pesquisar<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome, descrição, legenda..."/></label>
      <label>Tipo<select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value as Category|'all')}><option value="all">Todas as categorias</option>{Object.entries(catInfo).map(([value,meta])=><option key={value} value={value}>{meta.emoji} {meta.label}</option>)}</select></label>
      <label>Status<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as CardStatus|'all')}><option value="all">Todos</option><option value="open">Em análise</option><option value="verified">Confirmado</option><option value="solved">Resolvido</option></select></label>
      <label>Prioridade<select value={priorityFilter} onChange={event=>setPriorityFilter(event.target.value as Priority|'all')}><option value="all">Todas as prioridades</option>{Object.entries(priorityInfo).map(([id,meta])=><option key={id} value={id}>{meta.label}</option>)}</select></label>
      <label>Área<select value={groupFilter} onChange={event=>setGroupFilter(event.target.value)}><option value="all">Todas as áreas</option><option value="__none">Sem área</option>{groupNames.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
      <label>Temporada<select value={seasonFilter} onChange={event=>setSeasonFilter(event.target.value)}><option value="all">Todas</option><option value="global">Sem temporada</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
      {isMaster && <label>Visibilidade<select value={visibilityFilter} onChange={event=>setVisibilityFilter(event.target.value as Visibility|'all')}><option value="all">Todas</option><option value="public">Somente públicas</option><option value="master">Somente mestre</option></select></label>}
      <label className="hb-investigation-checkbox"><input type="checkbox" checked={pinnedOnly} onChange={event=>setPinnedOnly(event.target.checked)}/> Apenas fixadas</label>
      {isMaster && <label className="hb-investigation-checkbox"><input type="checkbox" checked={includeSecrets} onChange={event=>setIncludeSecrets(event.target.checked)}/> Incluir pistas secretas</label>}
      <button type="button" onClick={clearFilters}>Limpar filtros</button>
      <button type="button" onClick={()=>void refresh()} disabled={loading}>↻ Atualizar</button>
    </div>

    {error && <div className="hb-investigation-feedback error" role="alert">{error}</div>}
    {message && <div className="hb-investigation-feedback" role="status">{message}</div>}
    {loading && <p className="hb-investigation-empty">Carregando quadro...</p>}
    {!loading && cards.length===0 && <div className="hb-investigation-empty"><strong>O mistério ainda não começou.</strong><p>{isMaster?'Adicione a primeira pista para montar sua investigação.':'O mestre ainda não compartilhou pistas nesta campanha.'}</p></div>}

    <div className="hb-investigation-display-tools">
      <div className="hb-investigation-view-tabs" role="group" aria-label="Modo de visualização">
        <button type="button" className={view==='board'?'active':''} onClick={()=>setView('board')}>▦ Quadro</button>
        <button type="button" className={view==='timeline'?'active':''} onClick={()=>setView('timeline')}>◷ Linha do tempo</button>
      </div>
      {view==='board' && <div className="hb-investigation-zoom">
        <span>Quadro 3.600 × 2.400 · Arraste o fundo para navegar · Use a rodinha do mouse para dar zoom</span>
        <button type="button" disabled={zoom<=0.3} onClick={()=>setBoardZoom(zoom-0.15)} aria-label="Diminuir zoom">−</button>
        <strong>{Math.round(zoom*100)}%</strong>
        <button type="button" disabled={zoom>=1.5} onClick={()=>setBoardZoom(zoom+0.15)} aria-label="Aumentar zoom">＋</button>
        <button type="button" onClick={()=>setBoardZoom(.65)}>Zoom padrão</button>
        <button type="button" disabled={!visibleCards.length} onClick={frameVisibleCards} title="Ajustar zoom e posição para mostrar as pistas visíveis">Enquadrar pistas</button>
        <button type="button" disabled={!selectedCard} onClick={focusSelectedCard} title="Centralizar a pista selecionada">Focar pista</button>
        <button type="button" aria-pressed={!showInspector} onClick={()=>setShowInspector(current=>!current)}>{showInspector?'Ampliar visualização':'Mostrar detalhes'}</button>
      </div>}
    </div>

    <div className={`hb-investigation-board-layout ${!showInspector && view==='board' ? 'hb-investigation-board-wide' : ''}`}>
      {view==='board' ? <div ref={scrollRef} className={`hb-investigation-scroll ${isPanning?'is-panning':''}`}
        aria-label="Quadro de investigação: arraste o fundo com mouse ou dedo para navegar. Use a rodinha do mouse para ajustar o zoom. Selecione alfinetes para mover pistas."
        onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onLostPointerCapture={()=>{panRef.current=null;setIsPanning(false)}} tabIndex={0}>
        <div className="hb-investigation-stage" style={{width:CANVAS_W*zoom,height:CANVAS_H*zoom}}>
          <div className="hb-investigation-canvas" style={{width:CANVAS_W,height:CANVAS_H,transform:`scale(${zoom})`}}>
            <div className="hb-investigation-grain" aria-hidden="true"/>
            {boardAreas.map(area=><div key={area.name} className={`hb-investigation-zone zone-${area.index%5}`} style={{left:`${area.left}%`,top:`${area.top}%`,width:`${area.width}%`,height:`${area.height}%`}}><span>◇ {area.name}</span></div>)}
            <svg className="hb-investigation-threads" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><filter id="hb-thread-glow"><feGaussianBlur stdDeviation="2"/></filter></defs>
              {visibleLinks.map(link=>{
                const from=shown.get(link.from_card_id)
                const to=shown.get(link.to_card_id)
                if (!from || !to) return null
                const color = relationInfo[link.relation_type || 'evidence']?.color || '#de947b'
                const dash = relationInfo[link.relation_type || 'evidence']?.dash
                const fromCenter=cardCenter(from)
                const toCenter=cardCenter(to)
                const x1=fromCenter.x
                const y1=fromCenter.y
                const x2=toCenter.x
                const y2=toCenter.y
                const midX=(x1+x2)/2, midY=(y1+y2)/2
                const curvature=Math.max(22,Math.min(85,Math.abs(x2-x1)*.15))
                const path=`M ${x1} ${y1} C ${midX} ${y1-curvature}, ${midX} ${y2-curvature}, ${x2} ${y2}`
                const label=link.label || relationInfo[link.relation_type||'evidence']?.label || 'Relação'
                return <g key={link.id}>
                  <path d={path} fill="none" stroke={color} strokeWidth="8" opacity=".3" filter="url(#hb-thread-glow)"/>
                  <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash}/>
                  <circle cx={x1} cy={y1} r="5" fill={color}/><circle cx={x2} cy={y2} r="5" fill={color}/>
                  <rect x={midX-(Math.min(label.length,25)*3.6+14)} y={midY-18-curvature*.3} width={Math.min(label.length,25)*7.2+28} height="24" rx="12" fill="#241e1b" opacity=".87"/>
                  <text x={midX} y={midY-2-curvature*.3} fill="#f3e0d7" fontSize="12" textAnchor="middle" fontWeight="600">{label.length>25?`${label.slice(0,24)}…`:label}</text>
                </g>
              })}
            </svg>
            {visibleCards.map(card=>{
              const meta=catInfo[card.category]||catInfo.clue
              const cover=card.image_url||(card.image_attachments||[])[0]?.url
              const coverCaption=card.image_url?card.image_caption:(card.image_attachments||[])[0]?.caption
              if (cardIsDocument(card) && cover) {
                return <div key={card.id}
                  className={`hb-investigation-free-image ${selectedId===card.id?'is-selected':''} ${card.pinned?'is-pinned':''}`}
                  style={{left:`${card.x}%`,top:`${card.y}%`}}>
                  <button type="button"
                    className="hb-investigation-free-image-button"
                    aria-label={`Imagem solta: ${card.title}. ${isMaster&&!card.pinned?'Arraste para mover.':'Selecione para ver os detalhes.'}`}
                    title={isMaster&&!card.pinned?`Arraste para mover: ${card.title}`:`Selecionar: ${card.title}`}
                    onClick={()=>setSelectedId(card.id)}
                    onDoubleClick={()=>setPreviewImage({src:cover,title:card.title,caption:coverCaption||''})}
                    onPointerDown={event=>startDrag(event,card)}
                    onPointerMove={moveDrag}
                    onPointerUp={event=>void stopDrag(event)}
                    onPointerCancel={event=>void stopDrag(event)}>
                    <img src={cover} alt={coverCaption||card.title} draggable={false} loading="lazy"
                      onLoad={event=>{
                        const width=event.currentTarget.offsetWidth
                        const height=event.currentTarget.offsetHeight
                        setAssetSizes(previous=>{
                          const saved=previous[card.id]
                          if(saved?.width===width && saved?.height===height)return previous
                          return {...previous,[card.id]:{width,height}}
                        })
                      }}/>
                  </button>
                </div>
              }
              return <article key={card.id} className={`hb-investigation-note category-${card.category} status-${card.status} priority-${card.priority||'normal'} ${selectedId===card.id?'is-selected':''} ${card.pinned?'is-pinned':''}`} style={{left:`${card.x}%`,top:`${card.y}%`,['--hb-note-accent' as string]:meta.accent}} onClick={()=>setSelectedId(card.id)}>
                <button type="button" className="hb-investigation-pin" disabled={!isMaster||busy||card.pinned} title={card.pinned?'Desafixe para mover':isMaster?'Arraste para mover a pista':'Pista'} onPointerDown={event=>startDrag(event,card)} onPointerMove={moveDrag} onPointerUp={event=>void stopDrag(event)} onPointerCancel={event=>void stopDrag(event)} aria-label={`Mover ${card.title}`}>{card.pinned?'📍':'📌'}</button>
                <div className="hb-investigation-note-head"><span>{meta.emoji} {meta.label}</span><span>{card.visibility==='master'?'🔒 Mestre':'◎ Visível'}</span></div>
                <div className="hb-investigation-note-labels"><span className={`hb-investigation-priority priority-${card.priority||'normal'}`}>{priorityInfo[card.priority||'normal']?.label}</span>{card.pinned&&<span>📍 Fixada</span>}{card.image_attachments?.length>0&&<span>▧ {card.image_attachments.length+(card.image_url?1:0)}</span>}</div>
                {cover && <button type="button" className="hb-investigation-thumb" onClick={event=>{event.stopPropagation();setPreviewImage({src:cover,title:card.title,caption:coverCaption||''})}} aria-label={`Abrir imagem de ${card.title}`}><img src={cover} alt={coverCaption||`Imagem da pista ${card.title}`} loading="lazy"/></button>}
                <h3>{card.title}</h3><p>{card.description||'Sem descrição.'}</p>
                {card.group_name && <small className="hb-investigation-note-group">◇ {card.group_name}</small>}
                <div className="hb-investigation-note-footer"><small>{statusLabel[card.status]||'Em análise'}</small>{isMaster&&<div><button type="button" onClick={event=>{event.stopPropagation();void setPin(card)}} aria-label={`${card.pinned?'Desafixar':'Fixar'} ${card.title}`}>{card.pinned?'🔒':'◉'}</button><button type="button" onClick={event=>{event.stopPropagation();editCard(card)}} aria-label={`Editar ${card.title}`}>✎</button><button type="button" onClick={event=>{event.stopPropagation();startConnect(card.id)}} aria-label={`Conectar ${card.title}`}>↗</button><button type="button" onClick={event=>{event.stopPropagation();void deleteCard(card)}} aria-label={`Excluir ${card.title}`}>×</button></div>}</div>
              </article>
            })}
          </div>
        </div>
      </div> : <div className="hb-investigation-timeline" aria-label="Linha do tempo da investigação">
        {timelineCards.length===0 && <p className="hb-investigation-empty">Nenhuma pista corresponde aos filtros.</p>}
        {timelineCards.map(card=>{
          const cover=card.image_url||(card.image_attachments||[])[0]?.url
          return <button type="button" key={card.id} className={`hb-investigation-timeline-entry ${card.image_display_mode==='document'?'is-document':''} ${selectedId===card.id?'selected':''}`} onClick={()=>setSelectedId(card.id)}>
            <span className="hb-investigation-timeline-marker"/>
            <div className="hb-investigation-timeline-content">
              <small>{dateLabel(card.event_date)} · {catInfo[card.category]?.label}</small>
              <strong>{card.title}</strong>
              <span>{card.description||'Sem descrição.'}</span>
              <span className="hb-investigation-timeline-tags">{priorityInfo[card.priority||'normal']?.label} prioridade {card.group_name?` · ${card.group_name}`:''}{card.pinned?' · Fixada':''}</span>
            </div>
            {cover&&<img src={cover} alt={card.image_caption||card.title} loading="lazy"/>}
          </button>
        })}
      </div>}

      {(showInspector || view==='timeline') && <aside className="hb-investigation-inspector" aria-label="Detalhes da pista selecionada">
        {!selectedCard&&<div className="hb-investigation-inspector-empty"><strong>Nenhuma pista selecionada.</strong><p>Toque ou clique em um cartão para ver os detalhes completos.</p></div>}
        {selectedCard&&<>
          <div className="hb-investigation-inspector-head"><span className={`hb-investigation-badge category-${selectedCard.category}`}>{catInfo[selectedCard.category]?.emoji} {catInfo[selectedCard.category]?.label}</span><span className={`hb-investigation-badge status-${selectedCard.status}`}>{statusLabel[selectedCard.status]}</span><span className={`hb-investigation-priority priority-${selectedCard.priority||'normal'}`}>{priorityInfo[selectedCard.priority||'normal']?.label}</span></div>
          <h2>{selectedCard.title}</h2>
          <p className="hb-investigation-inspector-text">{selectedCard.description||'Sem descrição.'}</p>
          {(selectedCard.image_url || selectedCard.image_attachments?.length>0) ? <div className={`hb-investigation-inspector-gallery ${selectedCard.image_display_mode==='document'?'is-document':''}`}>
            {selectedCard.image_url&&<button type="button" onClick={()=>setPreviewImage({src:selectedCard.image_url||'',title:selectedCard.title,caption:selectedCard.image_caption||''})}><img src={selectedCard.image_url} alt={selectedCard.image_caption||`Capa de ${selectedCard.title}`} loading="lazy"/><small>{selectedCard.image_caption||'Imagem principal'}</small></button>}
            {(selectedCard.image_attachments||[]).map((item,index)=><button type="button" key={item.id||index} onClick={()=>setPreviewImage({src:item.url,title:selectedCard.title,caption:item.caption})}><img src={item.url} alt={item.caption||`Anexo ${index+1}`} loading="lazy"/><small>{item.caption||`Anexo ${index+1}`}</small></button>)}
          </div> : <div className="hb-investigation-inspector-empty small"><strong>Sem imagem</strong><p>Adicione uma capa ou anexos para documentar melhor a pista.</p></div>}
          <dl className="hb-investigation-meta">
            <div><dt>Área</dt><dd>{selectedCard.group_name||'Sem área definida'}</dd></div>
            <div><dt>Data da pista</dt><dd>{dateLabel(selectedCard.event_date)}</dd></div>
            <div><dt>Fixação</dt><dd>{selectedCard.pinned?'Fixada no quadro':'Posição livre'}</dd></div>
            <div><dt>Visibilidade</dt><dd>{selectedCard.visibility==='master'?'Somente mestre':'Todos os participantes'}</dd></div>
            <div><dt>Temporada</dt><dd>{seasons.find(season=>season.id===selectedCard.season_id)?.name||'Sem temporada'}</dd></div>
                      </dl>
          {isMaster&&<div className="hb-investigation-inspector-actions"><button type="button" onClick={()=>editCard(selectedCard)}>Editar pista</button><button type="button" onClick={()=>void setPin(selectedCard)}>{selectedCard.pinned?'Desafixar':'Fixar posição'}</button><button type="button" onClick={()=>startConnect(selectedCard.id)}>Conectar</button><button type="button" onClick={()=>void deleteCard(selectedCard)}>Excluir</button></div>}
        </>}
      </aside>}
    </div>

    {!loading&&<p className="hb-investigation-tip">{isMaster?'Arraste os alfinetes para organizar as pistas; fixadas não se movem na organização automática. As áreas são desenhadas a partir dos cartões que compartilham o mesmo nome. Informações secretas permanecem restritas ao mestre.':'O quadro exibe apenas as pistas compartilhadas pelo mestre.'} Arraste o fundo para navegar com mouse ou toque; arraste os alfinetes para mover cartões. Use ‘Enquadrar pistas’ para encontrar as informações rapidamente.</p>}

    {visibleLinks.length>0&&<details className="hb-investigation-links"><summary>Conexões do caso ({visibleLinks.length})</summary><ul>{visibleLinks.map(link=><li key={link.id}><span>{shown.get(link.from_card_id)?.title} <strong>⟷</strong> {shown.get(link.to_card_id)?.title}<em> · {relationInfo[link.relation_type||'evidence']?.label}{link.label?` · ${link.label}`:''}</em></span>{isMaster&&<button type="button" onClick={()=>void removeLink(link)} disabled={busy}>Remover</button>}</li>)}</ul></details>}

    {editing&&isMaster&&<div className="hb-investigation-overlay" role="presentation"><form className="hb-investigation-modal" onSubmit={event=>void saveCard(event)} role="dialog" aria-modal="true" aria-labelledby="hb-investigation-editor-title">
      <header><div><small>ARQUIVO DE INVESTIGAÇÃO</small><h2 id="hb-investigation-editor-title">{editorId?'Editar pista':'Nova pista'}</h2></div><button type="button" disabled={busy} onClick={()=>setEditing(false)} aria-label="Fechar">✕</button></header>
      <label>Título<input required maxLength={110} autoFocus value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))} placeholder="Ex.: O bilhete manchado"/></label>
      <label>Descrição / anotações<textarea rows={5} maxLength={3000} value={draft.description} onChange={event=>setDraft(current=>({...current,description:event.target.value}))} placeholder="O que foi encontrado? Por que é importante?"/></label>
      <div className="hb-investigation-form-grid">
        <label>Tipo<select value={draft.category} onChange={event=>setDraft(current=>({...current,category:event.target.value as Category}))}>{Object.entries(catInfo).map(([id,meta])=><option key={id} value={id}>{meta.emoji} {meta.label}</option>)}</select></label>
        <label>Situação<select value={draft.status} onChange={event=>setDraft(current=>({...current,status:event.target.value as CardStatus}))}><option value="open">Em análise</option><option value="verified">Confirmado</option><option value="solved">Resolvido</option></select></label>
        <label>Prioridade<select value={draft.priority} onChange={event=>setDraft(current=>({...current,priority:event.target.value as Priority}))}>{Object.entries(priorityInfo).map(([id,meta])=><option key={id} value={id}>{meta.label}</option>)}</select></label>
        <label>Quem pode ver?<select value={draft.visibility} onChange={event=>setDraft(current=>({...current,visibility:event.target.value as Visibility}))}><option value="public">Todos os participantes</option><option value="master">Somente mestre</option></select></label>
        <label>Temporada<select value={draft.season_id||''} onChange={event=>setDraft(current=>({...current,season_id:event.target.value||null}))}><option value="">Sem temporada</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
        <label>Data do acontecimento<input type="date" value={draft.event_date||''} onChange={event=>setDraft(current=>({...current,event_date:event.target.value||null}))}/></label>
        <label>Área / Grupo<input maxLength={60} value={draft.group_name} onChange={event=>setDraft(current=>({...current,group_name:event.target.value}))} list="hb-investigation-group-list" placeholder="Ex.: Castelo, Mistério do Porto..."/><datalist id="hb-investigation-group-list">{groupNames.map(name=><option key={name} value={name}/>)}</datalist></label>
        <label className="hb-investigation-checkbox"><input type="checkbox" checked={draft.pinned} onChange={event=>setDraft(current=>({...current,pinned:event.target.checked}))}/> Fixar no quadro</label>
      </div>
      <div className="hb-investigation-section-title"><strong>Imagem principal</strong><small>Foto de capa do cartão</small></div>
      <div className="hb-investigation-media-grid"><label>URL da imagem<input value={draft.image_url||''} onChange={event=>setDraft(current=>({...current,image_url:event.target.value}))} placeholder="https://... ou use o upload"/></label><label>Legenda<input maxLength={140} value={draft.image_caption} onChange={event=>setDraft(current=>({...current,image_caption:event.target.value}))} placeholder="Ex.: Fotografia da cena"/></label></div>
      <label className="hb-investigation-display-mode-label">Como mostrar a imagem no quadro?
        <select value={draft.image_display_mode} onChange={event=>setDraft(current=>({...current,image_display_mode:event.target.value as ImageDisplayMode}))}>
          <option value="photo">Fotografia · cartão compacto</option>
          <option value="document">Imagem solta · PNG direto no quadro, sem cartão</option>
        </select>
        <small>Documento amplia o cartão e preserva a proporção da imagem, ideal para cartas, mapas, páginas, bilhetes e fotografias completas.</small>
      </label>
      <div className="hb-investigation-upload-box"><label className="hb-investigation-file-picker">Carregar capa<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={event=>void handleImageFile(event)}/></label><small>Fotos grandes são compactadas antes de salvar. No modo Imagem solta, a imagem aparece diretamente no quadro, sem bordas, título ou fundo de cartão.</small>{draft.image_url&&<div className={`hb-investigation-upload-preview ${draft.image_display_mode==='document'?'is-document':''}`}><img src={draft.image_url} alt={draft.image_caption||'Prévia da capa'}/><button type="button" onClick={()=>setDraft(current=>({...current,image_url:'',image_caption:''}))}>Remover capa</button></div>}</div>
      <div className="hb-investigation-section-title"><strong>Galeria de anexos ({draft.image_attachments.length}/{MAX_ATTACHMENTS})</strong><small>Imagens adicionais vinculadas à pista</small></div>
      <div className="hb-investigation-attachment-actions"><label className="hb-investigation-file-picker">Adicionar imagens<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy||draft.image_attachments.length>=MAX_ATTACHMENTS} onChange={event=>void handleAttachments(event)}/></label><button type="button" disabled={busy||draft.image_attachments.length>=MAX_ATTACHMENTS} onClick={addAttachmentUrl}>＋ Adicionar URL</button></div>
      <div className="hb-investigation-attachment-list">{draft.image_attachments.map((item,index)=><div className="hb-investigation-attachment-item" key={item.id||index}>{item.url&&safeImageUrl(item.url)?<img src={item.url} alt={item.caption||`Anexo ${index+1}`}/>:<div className="hb-investigation-attachment-placeholder">Imagem {index+1}</div>}<div><label>Endereço da imagem<input value={item.url} onChange={event=>setDraft(current=>({...current,image_attachments:current.image_attachments.map(attachment=>attachment.id===item.id?{...attachment,url:event.target.value}:attachment)}))} placeholder="https://..."/></label><label>Legenda<input maxLength={140} value={item.caption} onChange={event=>setDraft(current=>({...current,image_attachments:current.image_attachments.map(attachment=>attachment.id===item.id?{...attachment,caption:event.target.value}:attachment)}))}/></label></div><button type="button" aria-label={`Remover anexo ${index+1}`} onClick={()=>setDraft(current=>({...current,image_attachments:current.image_attachments.filter(attachment=>attachment.id!==item.id)}))}>Remover</button></div>)}</div>
      <footer><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancelar</button><button type="submit" disabled={busy||!draft.title.trim()}>{busy?'Salvando...':'Salvar pista'}</button></footer>
    </form></div>}

    {connecting&&isMaster&&<div className="hb-investigation-overlay" role="presentation"><form className="hb-investigation-modal" onSubmit={event=>void addLink(event)} role="dialog" aria-modal="true" aria-labelledby="hb-investigation-link-title">
      <header><div><small>LINHA DE INVESTIGAÇÃO</small><h2 id="hb-investigation-link-title">Conectar pistas</h2></div><button type="button" disabled={busy} onClick={()=>setConnecting(false)} aria-label="Fechar">✕</button></header>
      <p>Relacione evidências, suspeitas, cronologias e contradições. Os jogadores veem somente conexões entre pistas públicas.</p>
      <label>Primeira pista<select required value={linkFrom} onChange={event=>setLinkFrom(event.target.value)}><option value="">Selecione...</option>{cards.map(card=><option key={card.id} value={card.id}>{card.title}{card.visibility==='master'?' 🔒':''}</option>)}</select></label>
      <label>Segunda pista<select required value={linkTo} onChange={event=>setLinkTo(event.target.value)}><option value="">Selecione...</option>{cards.filter(card=>card.id!==linkFrom).map(card=><option key={card.id} value={card.id}>{card.title}{card.visibility==='master'?' 🔒':''}</option>)}</select></label>
      <label>Tipo de conexão<select value={relationType} onChange={event=>setRelationType(event.target.value as Relation)}>{Object.entries(relationInfo).map(([id,meta])=><option key={id} value={id}>{meta.label}</option>)}</select></label>
      <label>Descrição da conexão (opcional)<input maxLength={160} value={linkLabel} onChange={event=>setLinkLabel(event.target.value)} placeholder="Ex.: visto pela última vez em..."/></label>
      <footer><button type="button" disabled={busy} onClick={()=>setConnecting(false)}>Cancelar</button><button type="submit" disabled={busy||!linkFrom||!linkTo||linkFrom===linkTo}>Criar conexão</button></footer>
    </form></div>}

    {previewImage&&<div className="hb-investigation-overlay" role="presentation" onClick={()=>setPreviewImage(null)}><div className="hb-investigation-lightbox" role="dialog" aria-modal="true" aria-label={`Imagem ampliada: ${previewImage.title}`} onClick={event=>event.stopPropagation()}><header><div><small>IMAGEM DA PISTA</small><h2>{previewImage.title}</h2></div><button type="button" onClick={()=>setPreviewImage(null)} aria-label="Fechar">✕</button></header><img src={previewImage.src} alt={previewImage.caption||previewImage.title}/>{previewImage.caption&&<p>{previewImage.caption}</p>}</div></div>}
  </section>
}
