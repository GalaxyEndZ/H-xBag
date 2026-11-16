import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './CampaignMissions.css'

type CharacterOption = { id: string; name: string; emoji?: string | null }
type MissionObjective = { id: string; title: string; done: boolean }
type MissionDrop = { id: string; quantity: number }
type Mission = {
  id: string; campaign_id: string; season_id: string | null; title: string; description: string
  status: 'active' | 'completed' | 'failed'; visibility: 'public' | 'assigned' | 'master'
  objectives: MissionObjective[]; reward_items: MissionDrop[]; recipient_character_ids: string[]
  completed_at: string | null; rewards_delivered_at: string | null; created_at: string; updated_at: string
}
type ChestDrop = { id: string; name: string; quantity: number; is_infinite: boolean; status: string; metadata: Record<string, unknown> | null }
type Draft = { title: string; description: string; visibility: Mission['visibility']; season_id: string; objectives: MissionObjective[]; rewards: MissionDrop[]; recipientIds: string[] }
const emptyDraft = (seasonId: string): Draft => ({ title: '', description: '', visibility: 'public', season_id: seasonId, objectives: [], rewards: [], recipientIds: [] })
const makeObjective = (title: string): MissionObjective => ({ id: crypto.randomUUID(), title, done: false })

export default function CampaignMissions({ campaignId, seasonId, seasons, characters, isMaster, userId, onDelivered }: {
  campaignId: string; seasonId: string; seasons: { id: string; name: string }[]
  characters: CharacterOption[]; isMaster: boolean; userId: string; onDelivered?: () => void
}) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [drops, setDrops] = useState<ChestDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(seasonId))
  const [objectiveText, setObjectiveText] = useState('')
  const [filter, setFilter] = useState<'all' | Mission['status']>('all')
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const [missionResult, chestResult] = await Promise.all([
      supabase.from('campaign_missions').select('id,campaign_id,season_id,title,description,status,visibility,objectives,reward_items,recipient_character_ids,completed_at,rewards_delivered_at,created_at,updated_at')
        .eq('campaign_id', campaignId).order('created_at', { ascending: false }),
      isMaster ? supabase.from('master_chest_items')
        .select('id,name,quantity,is_infinite,status,metadata').eq('campaign_id', campaignId).order('name')
        : Promise.resolve({ data: [] as ChestDrop[], error: null }),
    ])
    if (missionResult.error) setError(`Não foi possível carregar missões: ${missionResult.error.message}. Execute supabase/haxbag_missoes_combate_v110.sql no Supabase.`)
    else {
      setMissions(((missionResult.data ?? []) as Mission[]).map(item => ({
        ...item,
        objectives: Array.isArray(item.objectives) ? item.objectives : [],
        reward_items: Array.isArray(item.reward_items) ? item.reward_items : [],
        recipient_character_ids: Array.isArray(item.recipient_character_ids) ? item.recipient_character_ids : [],
      })))
      setError('')
    }
    if (chestResult.error) setError(`Baú de Mestre indisponível: ${chestResult.error.message}`)
    else setDrops((chestResult.data ?? []) as ChestDrop[])
    setLoading(false)
  }, [campaignId, isMaster])
  useEffect(() => {
    void refresh()
    const channel = supabase.channel(`hax-missions-${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_missions', filter: `campaign_id=eq.${campaignId}` }, () => { void refresh() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [campaignId, refresh])
  useEffect(() => { setShowEditor(false); setDraft(emptyDraft(seasonId)); setSelectedSeason('all'); setFilter('all') }, [campaignId])

  const visible = useMemo(() => missions.filter(mission =>
    (filter === 'all' || mission.status === filter)
    && (selectedSeason === 'all' || mission.season_id === selectedSeason)
    && `${mission.title} ${mission.description}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  ), [missions, filter, selectedSeason, query])
  const completed = missions.filter(item => item.status === 'completed').length
  const active = missions.filter(item => item.status === 'active').length
  const knownDrops = drops.filter(drop => drop.status === 'available' && (drop.is_infinite || drop.quantity > 0))
  const rewardLabel = (reward: MissionDrop) => {
    const match = drops.find(item => item.id === reward.id)
    return `${match?.name || (isMaster ? 'Drop removido' : 'Recompensa')} ×${reward.quantity}`
  }
  const canFinish = (mission: Mission) => mission.status === 'active' && mission.objectives.length > 0 && mission.objectives.every(obj => obj.done)

  function startCreate() { setEditorId(null); setDraft(emptyDraft(seasonId)); setObjectiveText(''); setShowEditor(true); setError(''); setNotice('') }
  function startEdit(mission: Mission) {
    if (mission.status === 'completed') return
    setEditorId(mission.id)
    setDraft({ title: mission.title, description: mission.description, visibility: mission.visibility, season_id: mission.season_id || '',
      objectives: mission.objectives.map(objective => ({ ...objective })), rewards: mission.reward_items.map(item => ({ ...item })), recipientIds: [...mission.recipient_character_ids] })
    setObjectiveText(''); setShowEditor(true); setError(''); setNotice('')
  }
  async function saveMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isMaster || saving) return
    if (!draft.title.trim()) { setError('Informe o título da missão.'); return }
    if (!draft.objectives.length || draft.objectives.some(obj => !obj.title.trim())) { setError('Inclua pelo menos um objetivo válido.'); return }
    if (draft.rewards.length && !draft.recipientIds.length) { setError('Escolha os destinatários dos drops.'); return }
    if (draft.rewards.length > 30 || draft.recipientIds.length > 50) { setError('Máximo de 30 tipos de drop e 50 destinatários.'); return }
    setSaving(true);setError('');setNotice('')
    const payload = { campaign_id: campaignId, season_id: draft.season_id || null,
      title: draft.title.trim(), description: draft.description.trim(), visibility: draft.visibility,
      objectives: draft.objectives, reward_items: draft.rewards, recipient_character_ids: draft.recipientIds }
    const result = editorId
      ? await supabase.from('campaign_missions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id',editorId).eq('campaign_id',campaignId)
      : await supabase.from('campaign_missions').insert({ ...payload, created_by:userId })
    setSaving(false)
    if (result.error) { setError(`Não foi possível salvar a missão: ${result.error.message}`); return }
    setShowEditor(false); setNotice(editorId ? 'Missão atualizada.' : 'Missão criada.'); await refresh()
  }
  async function toggleObjective(mission: Mission, id: string) {
    if (!isMaster || saving || mission.status !== 'active') return
    setSaving(true); setError('')
    const objectives = mission.objectives.map(objective => objective.id === id ? { ...objective, done: !objective.done } : objective)
    const { error: updateError, data: updated } = await supabase.from('campaign_missions').update({ objectives,updated_at:new Date().toISOString() })
      .eq('id', mission.id).eq('campaign_id',campaignId).eq('updated_at', mission.updated_at).select('id').maybeSingle()
    if (updateError || !updated) { setError(updateError ? `Falha ao atualizar objetivo: ${updateError.message}` : 'A missão foi alterada em outra sessão. Atualize antes de tentar novamente.'); setSaving(false); await refresh(); return }
    setSaving(false); await refresh()
  }
  async function setStatus(mission: Mission, status: 'active' | 'failed') {
    if (!isMaster || saving || mission.status === 'completed') return
    setSaving(true); setError('')
    const result = await supabase.rpc('hax_mission_set_status', { p_mission_id: mission.id, p_status: status })
    setSaving(false)
    if (result.error) setError(`Não foi possível alterar o estado: ${result.error.message}`)
    else { setNotice(status === 'failed' ? 'Missão marcada como falhada.' : 'Missão reativada.'); await refresh() }
  }
  async function finishMission(mission: Mission) {
    if (!isMaster || saving || !canFinish(mission)) return
    const rewardCount = mission.reward_items.length
    const question = rewardCount
      ? `Concluir “${mission.title}” e entregar ${rewardCount} tipo(s) de drop para ${mission.recipient_character_ids.length} personagem(ns)? Esta ação não pode ser desfeita.`
      : `Concluir “${mission.title}”? Esta ação não pode ser desfeita.`
    if (!window.confirm(question)) return
    setSaving(true); setError('');setNotice('')
    const result = await supabase.rpc('hax_mission_complete', { p_mission_id: mission.id })
    setSaving(false)
    if (result.error) setError(`Missão não concluída; nenhum drop desta tentativa foi entregue: ${result.error.message}`)
    else { setNotice(`Missão concluída! ${rewardCount ? 'Drops distribuídos pelo Baú do Mestre.' : 'Sem recompensa material configurada.'}`); await refresh();onDelivered?.() }
  }
  async function removeMission(mission: Mission) {
    if (!isMaster || saving || mission.status === 'completed' || !window.confirm(`Excluir a missão “${mission.title}”?`)) return
    setSaving(true);setError('')
    const result = await supabase.from('campaign_missions').delete().eq('id',mission.id).eq('campaign_id',campaignId)
    setSaving(false)
    if (result.error) setError(`Erro ao excluir: ${result.error.message}`)
    else {setNotice('Missão excluída.');await refresh()}
  }

  return <section className="hb-missions" aria-labelledby="hb-missions-title">
    <header className="hb-missions-hero">
      <div><span className="hb-missions-kicker">⚑ AVENTURAS · OBJETIVOS · RECOMPENSAS</span><h2 id="hb-missions-title">Missões<span>.</span></h2>
        <p>Organize objetivos da campanha e acompanhe o progresso. Ao concluir, o Baú entrega automaticamente os drops selecionados.</p></div>
      {isMaster && <button type="button" className="hb-missions-primary" onClick={startCreate}>＋ Nova missão</button>}
    </header>
    <div className="hb-missions-stats"><div><small>ATIVAS</small><strong>{active}</strong></div><div><small>CONCLUÍDAS</small><strong>{completed}</strong></div><div><small>TOTAL</small><strong>{missions.length}</strong></div></div>
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={error ? 'hb-missions-alert is-error' : 'hb-missions-alert'}>{error || notice}</div>}
    <div className="hb-missions-controls">
      <label>Buscar missão<input type="search" placeholder="Nome ou descrição..." value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <label>Status<select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">Todos</option><option value="active">Ativas</option><option value="completed">Concluídas</option><option value="failed">Falhadas</option></select></label>
      <label>Temporada<select value={selectedSeason} onChange={event=>setSelectedSeason(event.target.value)}><option value="all">Todas</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
      <button type="button" className="hb-missions-soft" onClick={()=>void refresh()} disabled={loading}>↻ Atualizar</button>
    </div>
    {loading && <p className="hb-missions-empty">Carregando missões...</p>}
    {!loading && !visible.length && <p className="hb-missions-empty">Nenhuma missão encontrada. {isMaster ? 'Crie a primeira missão para sua campanha.' : 'O mestre ainda não publicou missões para você.'}</p>}
    <div className="hb-missions-list">
      {!loading && visible.map(mission => <article className="hb-mission-card" key={mission.id}>
        <div className="hb-mission-card-header"><div><div className="hb-mission-flags">
          <span className={`hb-mission-status ${mission.status}`}>{mission.status === 'active' ? '● Ativa' : mission.status === 'completed' ? '✓ Concluída' : '✕ Falhada'}</span>
          <span>{seasons.find(season=>season.id===mission.season_id)?.name || 'Todas as temporadas'}</span>
          {isMaster && <span>{mission.visibility === 'master' ? '🔒 Mestre' : mission.visibility === 'assigned' ? '◈ Destinatários' : '◎ Pública'}</span>}
        </div><h3>{mission.title}</h3></div>{isMaster && mission.status !== 'completed' && <button type="button" className="hb-missions-soft" disabled={saving} onClick={()=>startEdit(mission)}>Editar</button>}</div>
        {mission.description && <p className="hb-mission-description">{mission.description}</p>}
        <div className="hb-mission-progress"><div><strong>Objetivos</strong><span>{mission.objectives.filter(obj=>obj.done).length} / {mission.objectives.length}</span></div>
          <div className="hb-mission-progress-track"><div style={{ width:`${mission.objectives.length ? (mission.objectives.filter(obj=>obj.done).length / mission.objectives.length)*100 : 0}%` }} /></div></div>
        <ul className="hb-mission-objectives">{mission.objectives.map(obj=><li key={obj.id}>
          <label className={obj.done ? 'is-done' : ''}><input type="checkbox" checked={obj.done} disabled={!isMaster || saving || mission.status !== 'active'} onChange={()=>void toggleObjective(mission,obj.id)}/><span>{obj.title}</span></label>
        </li>)}</ul>
        {isMaster && mission.reward_items.length > 0 && <div className="hb-mission-rewards"><strong>🎁 Drops ao concluir</strong><div>{mission.reward_items.map((reward,index)=><span key={`${reward.id}-${index}`}>{rewardLabel(reward)}</span>)}</div><small>{mission.recipient_character_ids.length} destinatário(s) · cada um recebe a remessa</small></div>}
        {!isMaster && mission.status === 'completed' && <p className="hb-mission-complete-note">✓ Missão concluída pelo mestre.</p>}
        {isMaster && <footer className="hb-mission-actions">
          {mission.status === 'active' && <button type="button" className="hb-missions-primary" disabled={!canFinish(mission)||saving} onClick={()=>void finishMission(mission)}>✓ Concluir e entregar drops</button>}
          {mission.status === 'failed' && <button type="button" className="hb-missions-soft" disabled={saving} onClick={()=>void setStatus(mission,'active')}>Reativar</button>}
          {mission.status === 'active' && <button type="button" className="hb-missions-soft" disabled={saving} onClick={()=>void setStatus(mission,'failed')}>Marcar falhada</button>}
          {mission.status !== 'completed' && <button type="button" className="hb-missions-danger" disabled={saving} onClick={()=>void removeMission(mission)}>Excluir</button>}
          {mission.status === 'completed' && <span className="hb-mission-complete-note">✓ Concluída {mission.completed_at ? new Date(mission.completed_at).toLocaleString('pt-BR') : ''}{mission.rewards_delivered_at ? ' · Drops entregues' : ''}</span>}
        </footer>}
      </article>)}
    </div>
    {showEditor && isMaster && <div className="hb-missions-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget && !saving)setShowEditor(false)}}>
      <section className="hb-missions-modal" role="dialog" aria-modal="true" aria-labelledby="hb-mission-editor-title">
        <div className="hb-missions-modal-head"><div><span className="hb-missions-kicker">EDITOR DO MESTRE</span><h2 id="hb-mission-editor-title">{editorId ? 'Editar missão' : 'Criar missão'}</h2></div><button type="button" onClick={()=>setShowEditor(false)} disabled={saving} aria-label="Fechar editor">✕</button></div>
        <form onSubmit={event=>void saveMission(event)} className="hb-missions-form">
          <label>Título<input autoFocus maxLength={120} required value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))} placeholder="Ex.: Recuperar o selo perdido"/></label>
          <label>Descrição<textarea rows={3} maxLength={4000} value={draft.description} onChange={event=>setDraft(current=>({...current,description:event.target.value}))} placeholder="Contexto, pistas, locais..."/></label>
          <div className="hb-missions-form-grid"><label>Temporada<select value={draft.season_id} onChange={event=>setDraft(current=>({...current,season_id:event.target.value}))}><option value="">Todas as temporadas</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
          <label>Visibilidade<select value={draft.visibility} onChange={event=>setDraft(current=>({...current,visibility:event.target.value as Mission['visibility']}))}><option value="public">Todos os jogadores</option><option value="assigned">Somente destinatários</option><option value="master">Somente mestre</option></select></label></div>
          <fieldset><legend>Objetivos da missão</legend>
            {draft.objectives.map(obj=><div className="hb-missions-objective-edit" key={obj.id}><input aria-label="Objetivo" maxLength={240} value={obj.title} onChange={event=>setDraft(current=>({...current,objectives:current.objectives.map(row=>row.id===obj.id?{...row,title:event.target.value}:row)}))}/><button type="button" className="hb-missions-danger" onClick={()=>setDraft(current=>({...current,objectives:current.objectives.filter(row=>row.id!==obj.id)}))}>Remover</button></div>)}
            <div className="hb-missions-add-objective"><input value={objectiveText} maxLength={240} placeholder="Novo objetivo" onChange={event=>setObjectiveText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(objectiveText.trim()){setDraft(current=>({...current,objectives:[...current.objectives,makeObjective(objectiveText.trim())]}));setObjectiveText('')}}}}/><button type="button" onClick={()=>{if(objectiveText.trim()){setDraft(current=>({...current,objectives:[...current.objectives,makeObjective(objectiveText.trim())]}));setObjectiveText('')}}}>＋ Adicionar</button></div>
          </fieldset>
          <fieldset><legend>Recompensas do Baú do Mestre</legend><p className="hb-missions-help">Cada destinatário receberá os drops escolhidos ao concluir todos os objetivos. Estoque, moedas e escassez seguem o Baú do Mestre.</p>
            {draft.rewards.map(reward=><div className="hb-missions-reward-row" key={reward.id}><span>{rewardLabel(reward)}</span><input type="number" min="1" max="999999" aria-label="Quantidade" value={reward.quantity} onChange={event=>setDraft(current=>({...current,rewards:current.rewards.map(item=>item.id===reward.id?{...item,quantity:Math.max(1,Math.min(999999,Number(event.target.value)||1))}:item)}))}/><button type="button" className="hb-missions-danger" onClick={()=>setDraft(current=>({...current,rewards:current.rewards.filter(item=>item.id!==reward.id)}))}>Retirar</button></div>)}
            <select aria-label="Adicionar drop do baú" value="" disabled={draft.rewards.length>=30} onChange={event=>{const id=event.target.value;if(id)setDraft(current=>({...current,rewards:[...current.rewards,{id,quantity:1}]}))}}><option value="">＋ Adicionar drop existente...</option>{knownDrops.filter(drop=>!draft.rewards.some(line=>line.id===drop.id)).map(drop=><option key={drop.id} value={drop.id}>{drop.name} · {drop.is_infinite?'∞':`${drop.quantity} em estoque`}</option>)}</select>
            {knownDrops.length===0 && <p className="hb-missions-help">Crie drops primeiro no Baú do Mestre.</p>}
          </fieldset>
          <fieldset><legend>Destinatários dos drops</legend><p className="hb-missions-help">Escolha quais personagens receberão a remessa. A lista permanece salva para esta missão.</p>
            <div className="hb-missions-recipient-list">{characters.map(character=><label key={character.id}><input type="checkbox" checked={draft.recipientIds.includes(character.id)} onChange={event=>setDraft(current=>({...current,recipientIds:event.target.checked?[...current.recipientIds,character.id]:current.recipientIds.filter(id=>id!==character.id)}))}/><span>{character.emoji||'♙'} {character.name}</span></label>)}</div>
          </fieldset>
          <div className="hb-missions-modal-actions"><button type="button" onClick={()=>setShowEditor(false)} disabled={saving}>Cancelar</button><button type="submit" className="hb-missions-primary" disabled={saving}>{saving?'Salvando...':'Salvar missão'}</button></div>
        </form>
      </section></div>}
  </section>
}
