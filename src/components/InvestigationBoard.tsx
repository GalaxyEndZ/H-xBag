import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '../supabase'
import './InvestigationBoard.css'

type Category = 'clue' | 'person' | 'place' | 'event' | 'theory'
type Visibility = 'public' | 'master'
type CardStatus = 'open' | 'verified' | 'solved'
type InvestigationCard = {
  id: string; campaign_id: string; season_id: string | null; title: string; description: string
  category: Category; visibility: Visibility; status: CardStatus; x: number; y: number
  created_at: string; updated_at: string
}
type InvestigationLink = { id: string; campaign_id: string; from_card_id: string; to_card_id: string; label: string }
type Draft = Pick<InvestigationCard,'title'|'description'|'category'|'visibility'|'status'|'season_id'>
const newDraft = (seasonId: string): Draft => ({ title: '', description: '', category: 'clue', visibility: 'public', status: 'open', season_id: seasonId || null })
const catInfo: Record<Category,{emoji:string; label:string}> = {
  clue:{emoji:'🔎',label:'Pista'}, person:{emoji:'🧑',label:'Pessoa'}, place:{emoji:'📍',label:'Local'},
  event:{emoji:'🕰️',label:'Evento'}, theory:{emoji:'💡',label:'Teoria'},
}
const statusLabel: Record<CardStatus,string> = {open:'Em análise', verified:'Confirmado',solved:'Resolvido'}
const CANVAS_W = 1120
const CANVAS_H = 800
const clamp = (n:number,lower:number,upper:number) => Math.max(lower,Math.min(upper,n))

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
  const [includeSecrets,setIncludeSecrets] = useState(true)
  const [editorId,setEditorId] = useState<string|null>(null)
  const [draft,setDraft] = useState<Draft>(newDraft(seasonId))
  const [editing,setEditing] = useState(false)
  const [linkFrom,setLinkFrom] = useState('')
  const [linkTo,setLinkTo] = useState('')
  const [linkLabel,setLinkLabel] = useState('')
  const [connecting,setConnecting] = useState(false)
  const dragRef = useRef<{id:string;clientX:number;clientY:number;x:number;y:number;nextX:number;nextY:number}|null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const [c,l] = await Promise.all([
      supabase.from('hax_investigation_cards').select('id,campaign_id,season_id,title,description,category,visibility,status,x,y,created_at,updated_at').eq('campaign_id',campaignId).order('created_at'),
      supabase.from('hax_investigation_links').select('id,campaign_id,from_card_id,to_card_id,label').eq('campaign_id',campaignId),
    ])
    if (c.error || l.error) setError(`Não foi possível carregar a Mesa de Investigação: ${c.error?.message || l.error?.message}. Execute o SQL da V117.`)
    else {setCards((c.data||[]) as InvestigationCard[]);setLinks((l.data||[]) as InvestigationLink[]);setError('')}
    setLoading(false)
  },[campaignId])
  useEffect(()=>{
    setLoading(true);setCards([]);setLinks([]);setSeasonFilter('all');setEditing(false);setConnecting(false)
    void refresh()
    const channel = supabase.channel(`hax-investigation-${campaignId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'hax_investigation_cards',filter:`campaign_id=eq.${campaignId}`},()=>{if(!dragRef.current)void refresh()})
      .on('postgres_changes',{event:'*',schema:'public',table:'hax_investigation_links',filter:`campaign_id=eq.${campaignId}`},()=>void refresh())
      .subscribe()
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible' && !dragRef.current && !editing)void refresh()},30000)
    return ()=>{window.clearInterval(timer);void supabase.removeChannel(channel)}
  },[campaignId,refresh])
  const visibleCards=useMemo(()=>cards.filter(c=>(seasonFilter==='all'||c.season_id===seasonFilter||(!c.season_id&&seasonFilter==='global'))
    && (categoryFilter==='all'||c.category===categoryFilter) && (includeSecrets||c.visibility==='public')
    && `${c.title} ${c.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[cards,seasonFilter,categoryFilter,includeSecrets,search])
  const shown = new Map(visibleCards.map(c=>[c.id,c]))
  const visibleLinks=links.filter(l=>shown.has(l.from_card_id)&&shown.has(l.to_card_id))
  const publicCount=cards.filter(c=>c.visibility==='public').length

  function addCard(){setEditorId(null);setDraft(newDraft(seasonId));setEditing(true);setMessage('')}
  function editCard(card:InvestigationCard){setEditorId(card.id);setDraft({title:card.title,description:card.description,category:card.category,status:card.status,visibility:card.visibility,season_id:card.season_id});setEditing(true)}
  async function saveCard(event:FormEvent){
    event.preventDefault()
    if(!isMaster||busy||!draft.title.trim())return
    setBusy(true);setError('')
    const payload={title:draft.title.trim(),description:draft.description.trim(),category:draft.category,visibility:draft.visibility,status:draft.status,season_id:draft.season_id||null,updated_at:new Date().toISOString()}
    const index=cards.length;const x=7+(index%4)*23;const y=8+(Math.floor(index/4)%4)*22
    const r=editorId ? await supabase.from('hax_investigation_cards').update(payload).eq('id',editorId).eq('campaign_id',campaignId)
      : await supabase.from('hax_investigation_cards').insert({...payload,campaign_id:campaignId,created_by:userId,x,y})
    setBusy(false)
    if(r.error)setError('Falha ao salvar pista: '+r.error.message)
    else {setEditing(false);setMessage(editorId?'Pista atualizada.':'Pista adicionada.');await refresh()}
  }
  async function deleteCard(card:InvestigationCard){
    if(!isMaster||busy||!window.confirm(`Excluir “${card.title}” e suas conexões?`))return
    setBusy(true);const r=await supabase.from('hax_investigation_cards').delete().eq('id',card.id).eq('campaign_id',campaignId)
    setBusy(false);if(r.error)setError(r.error.message);else {setMessage('Pista excluída.');await refresh()}
  }
  function startConnect(cardId?:string){setLinkFrom(cardId||'');setLinkTo('');setLinkLabel('');setConnecting(true)}
  async function addLink(event:FormEvent){
    event.preventDefault()
    if(!isMaster||busy||!linkFrom||!linkTo||linkFrom===linkTo)return
    if(links.some(link=>(link.from_card_id===linkFrom&&link.to_card_id===linkTo)||(link.from_card_id===linkTo&&link.to_card_id===linkFrom))){setError('Essas pistas já estão conectadas.');return}
    setBusy(true);setError('')
    const r=await supabase.from('hax_investigation_links').insert({campaign_id:campaignId,from_card_id:linkFrom,to_card_id:linkTo,label:linkLabel.trim(),created_by:userId})
    setBusy(false);if(r.error)setError('Não foi possível ligar as pistas: '+r.error.message);else {setConnecting(false);setMessage('Conexão criada.');await refresh()}
  }
  async function removeLink(link:InvestigationLink){
    if(!isMaster||busy||!window.confirm('Remover esta conexão?'))return
    setBusy(true);const r=await supabase.from('hax_investigation_links').delete().eq('id',link.id).eq('campaign_id',campaignId)
    setBusy(false);if(r.error)setError(r.error.message);else{setMessage('Conexão removida.');await refresh()}
  }
  function startDrag(e:ReactPointerEvent<HTMLButtonElement>,card:InvestigationCard){
    if(!isMaster||busy)return
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current={id:card.id,clientX:e.clientX,clientY:e.clientY,x:card.x,y:card.y,nextX:card.x,nextY:card.y}
  }
  function moveDrag(e:ReactPointerEvent<HTMLButtonElement>){
    const drag=dragRef.current;if(!drag)return
    const x=clamp(drag.x+(e.clientX-drag.clientX)/CANVAS_W*100,0,79)
    const y=clamp(drag.y+(e.clientY-drag.clientY)/CANVAS_H*100,0,75)
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
  return <section className="hb-investigation" aria-label="Mesa de Investigação">
    <header className="hb-investigation-hero"><div><span className="hb-investigation-kicker">ARQUIVO DE PISTAS · CAMPANHA</span><h1>🧵 Mesa de Investigação</h1><p>Reúna pistas, pessoas, locais, eventos e teorias. Conecte as descobertas como num quadro de detetive.</p></div>
      {isMaster&&<div className="hb-investigation-actions"><button type="button" onClick={addCard}>＋ Nova pista</button><button type="button" onClick={()=>startConnect()} disabled={cards.length<2}>↗ Ligar pistas</button></div>}
    </header>
    <div className="hb-investigation-stats"><div><strong>{cards.length}</strong><small>Pistas disponíveis</small></div><div><strong>{publicCount}</strong><small>Compartilhadas</small></div><div><strong>{visibleLinks.length}</strong><small>Conexões visíveis</small></div></div>
    <div className="hb-investigation-toolbar"><label>Pesquisar<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome, pista, teoria..."/></label>
      <label>Tipo<select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value as Category|'all')}><option value="all">Todas as categorias</option>{Object.entries(catInfo).map(([value,meta])=><option key={value} value={value}>{meta.emoji} {meta.label}</option>)}</select></label>
      <label>Temporada<select value={seasonFilter} onChange={event=>setSeasonFilter(event.target.value)}><option value="all">Todas</option><option value="global">Sem temporada</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
      {isMaster&&<label className="hb-investigation-checkbox"><input type="checkbox" checked={includeSecrets} onChange={event=>setIncludeSecrets(event.target.checked)}/> Mostrar pistas secretas</label>}
      <button type="button" onClick={()=>void refresh()} disabled={loading}>↻ Atualizar</button></div>
    {error&&<div className="hb-investigation-feedback error" role="alert">{error}</div>}{message&&<div className="hb-investigation-feedback" role="status">{message}</div>}
    {loading&&<p className="hb-investigation-empty">Carregando quadro...</p>}
    {!loading&&cards.length===0&&<div className="hb-investigation-empty"><strong>O mistério ainda não começou.</strong><p>{isMaster?'Adicione a primeira pista para montar sua investigação.':'O mestre ainda não compartilhou pistas nesta campanha.'}</p></div>}
    <div className="hb-investigation-scroll" aria-label="Quadro de pistas. Deslize para explorar horizontalmente no celular." tabIndex={0}>
      <div className="hb-investigation-canvas" ref={canvasRef}>
        <div className="hb-investigation-grain" aria-hidden="true"/>
        <svg className="hb-investigation-threads" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><filter id="hb-thread-glow"><feGaussianBlur stdDeviation="2"/></filter></defs>
          {visibleLinks.map(link=>{const from=shown.get(link.from_card_id)!,to=shown.get(link.to_card_id)!;return <g key={link.id}><line x1={from.x*CANVAS_W/100+114} y1={from.y*CANVAS_H/100+75} x2={to.x*CANVAS_W/100+114} y2={to.y*CANVAS_H/100+75} stroke="rgba(246,125,98,.30)" strokeWidth="7" filter="url(#hb-thread-glow)"/><line x1={from.x*CANVAS_W/100+114} y1={from.y*CANVAS_H/100+75} x2={to.x*CANVAS_W/100+114} y2={to.y*CANVAS_H/100+75} stroke="#d77769" strokeWidth="2.5" strokeLinecap="round"/></g>})}
        </svg>
        {visibleCards.map(card=><article key={card.id} className={`hb-investigation-note category-${card.category} status-${card.status}`} style={{left:`${card.x}%`,top:`${card.y}%`}}>
          <button type="button" className="hb-investigation-pin" disabled={!isMaster||busy} title={isMaster?'Arraste para mover a pista':'Pista'} onPointerDown={event=>startDrag(event,card)} onPointerMove={moveDrag} onPointerUp={event=>void stopDrag(event)} onPointerCancel={event=>void stopDrag(event)} aria-label={`Mover ${card.title}`}>📌</button>
          <div className="hb-investigation-note-head"><span>{catInfo[card.category]?.emoji||'🔎'} {catInfo[card.category]?.label||'Pista'}</span><span>{card.visibility==='master'?'🔒 Mestre':'◎ Visível'}</span></div>
          <h3>{card.title}</h3><p>{card.description||'Sem descrição.'}</p>
          <div className="hb-investigation-note-footer"><small>{statusLabel[card.status]||'Em análise'}</small>{isMaster&&<div><button type="button" onClick={()=>editCard(card)} aria-label={`Editar ${card.title}`}>✎</button><button type="button" onClick={()=>startConnect(card.id)} aria-label={`Conectar ${card.title}`}>↗</button><button type="button" onClick={()=>void deleteCard(card)} aria-label={`Excluir ${card.title}`}>×</button></div>}</div>
        </article>)}
      </div>
    </div>
    {!loading&&<p className="hb-investigation-tip">{isMaster?'Arraste os alfinetes para organizar as pistas. Conecte os cartões usando ↗. Pistas marcadas como “Somente mestre” não são enviadas aos jogadores.':'O quadro mostra apenas pistas que o mestre compartilhou com a campanha.'} No celular, deslize o quadro para explorar.</p>}
    {visibleLinks.length>0&&<details className="hb-investigation-links"><summary>Conexões do caso ({visibleLinks.length})</summary><ul>{visibleLinks.map(link=><li key={link.id}><span>{shown.get(link.from_card_id)?.title} <strong>⟷</strong> {shown.get(link.to_card_id)?.title}{link.label&&<em> · {link.label}</em>}</span>{isMaster&&<button type="button" onClick={()=>void removeLink(link)} disabled={busy}>Remover</button>}</li>)}</ul></details>}
    {editing&&isMaster&&<div className="hb-investigation-overlay" role="presentation"><form className="hb-investigation-modal" onSubmit={event=>void saveCard(event)} role="dialog" aria-modal="true" aria-labelledby="hb-investigation-editor-title">
      <header><div><small>ARQUIVO DE INVESTIGAÇÃO</small><h2 id="hb-investigation-editor-title">{editorId?'Editar pista':'Nova pista'}</h2></div><button type="button" disabled={busy} onClick={()=>setEditing(false)} aria-label="Fechar">✕</button></header>
      <label>Título<input required maxLength={110} autoFocus value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))} placeholder="Ex.: O bilhete manchado"/></label>
      <label>Descrição / anotações<textarea rows={5} maxLength={3000} value={draft.description} onChange={event=>setDraft(current=>({...current,description:event.target.value}))} placeholder="O que foi encontrado? Por que é importante?"/></label>
      <div className="hb-investigation-form-grid"><label>Tipo<select value={draft.category} onChange={event=>setDraft(current=>({...current,category:event.target.value as Category}))}>{Object.entries(catInfo).map(([id,meta])=><option key={id} value={id}>{meta.emoji} {meta.label}</option>)}</select></label>
      <label>Situação<select value={draft.status} onChange={event=>setDraft(current=>({...current,status:event.target.value as CardStatus}))}><option value="open">Em análise</option><option value="verified">Confirmado</option><option value="solved">Resolvido</option></select></label>
      <label>Quem pode ver?<select value={draft.visibility} onChange={event=>setDraft(current=>({...current,visibility:event.target.value as Visibility}))}><option value="public">Todos os participantes</option><option value="master">Somente mestre</option></select></label>
      <label>Temporada<select value={draft.season_id||''} onChange={event=>setDraft(current=>({...current,season_id:event.target.value||null}))}><option value="">Sem temporada</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label></div>
      <footer><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancelar</button><button type="submit" disabled={busy||!draft.title.trim()}>{busy?'Salvando...':'Salvar pista'}</button></footer>
    </form></div>}
    {connecting&&isMaster&&<div className="hb-investigation-overlay" role="presentation"><form className="hb-investigation-modal" onSubmit={event=>void addLink(event)} role="dialog" aria-modal="true" aria-labelledby="hb-investigation-link-title">
      <header><div><small>LINHA DE INVESTIGAÇÃO</small><h2 id="hb-investigation-link-title">Conectar pistas</h2></div><button type="button" onClick={()=>setConnecting(false)} disabled={busy} aria-label="Fechar">✕</button></header>
      <p>Crie uma ligação entre dois cartões. O mestre vê todas as conexões; jogadores só veem ligações entre pistas compartilhadas.</p>
      <label>Primeira pista<select required value={linkFrom} onChange={event=>setLinkFrom(event.target.value)}><option value="">Selecione...</option>{cards.map(card=><option key={card.id} value={card.id}>{card.title}{card.visibility==='master'?' 🔒':''}</option>)}</select></label>
      <label>Segunda pista<select required value={linkTo} onChange={event=>setLinkTo(event.target.value)}><option value="">Selecione...</option>{cards.filter(card=>card.id!==linkFrom).map(card=><option key={card.id} value={card.id}>{card.title}{card.visibility==='master'?' 🔒':''}</option>)}</select></label>
      <label>Descrição da conexão (opcional)<input maxLength={160} value={linkLabel} onChange={event=>setLinkLabel(event.target.value)} placeholder="Ex.: visto pela última vez em..."/></label>
      <footer><button type="button" disabled={busy} onClick={()=>setConnecting(false)}>Cancelar</button><button type="submit" disabled={busy||!linkFrom||!linkTo||linkFrom===linkTo}>Criar conexão</button></footer>
    </form></div>}
  </section>
}
