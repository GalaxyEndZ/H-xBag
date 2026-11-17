import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './CampaignMissions.css'

type CharacterOption = { id: string; name: string; emoji?: string | null }
type MissionObjective = { id: string; title: string; done: boolean }
type MissionDrop = { id: string; quantity: number; name?: string }
type MissionConditionReward = { id: string; name: string; duration: string }
type MissionMilestone = { threshold: number; items: MissionDrop[]; conditions: MissionConditionReward[] }
type ConditionOption = { id: string; name: string; emoji: string }
type RewardPreview = { threshold: number; labels: string[] }
type Mission = {
  id: string; campaign_id: string; season_id: string | null; title: string; description: string
  status: 'active' | 'completed' | 'failed'; visibility: 'public' | 'assigned' | 'master'
  objectives: MissionObjective[]; reward_items: MissionDrop[]; recipient_character_ids: string[]
  reward_milestones: MissionMilestone[]; awarded_milestones: number[]; reward_preview: RewardPreview[]
  hide_objectives: boolean; hide_rewards: boolean
  completed_at: string | null; rewards_delivered_at: string | null; created_at: string; updated_at: string
}
type ChestDrop = { id: string; name: string; quantity: number; is_infinite: boolean; status: string; metadata: Record<string, unknown> | null }
type Draft = { title: string; description: string; visibility: Mission['visibility']; season_id: string; objectives: MissionObjective[]; rewards: MissionDrop[]; milestones: MissionMilestone[]; recipientIds: string[]; hideObjectives: boolean; hideRewards: boolean }
const emptyDraft = (seasonId: string): Draft => ({ title: '', description: '', visibility: 'public', season_id: seasonId, objectives: [], rewards: [], milestones: [], recipientIds: [], hideObjectives: false, hideRewards: false })
const makeObjective = (title: string): MissionObjective => ({ id: crypto.randomUUID(), title, done: false })

export default function CampaignMissions({ campaignId, seasonId, seasons, characters, isMaster, userId, onDelivered }: {
  campaignId: string; seasonId: string; seasons: { id: string; name: string }[]
  characters: CharacterOption[]; isMaster: boolean; userId: string; onDelivered?: () => void
}) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [drops, setDrops] = useState<ChestDrop[]>([])
  const [conditions, setConditions] = useState<ConditionOption[]>([])
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
    const [missionResult, chestResult, conditionResult] = await Promise.all([
      supabase.rpc('hax_list_campaign_missions', { p_campaign_id: campaignId }),
      isMaster ? supabase.from('master_chest_items')
        .select('id,name,quantity,is_infinite,status,metadata').eq('campaign_id', campaignId).order('name')
        : Promise.resolve({ data: [] as ChestDrop[], error: null }),
      isMaster ? supabase.rpc('hax_list_condition_definitions', { p_campaign_id: campaignId })
        : Promise.resolve({ data: [] as ConditionOption[], error: null }),
    ])
    if (missionResult.error) setError(`Não foi possível carregar missões: ${missionResult.error.message}. Execute haxbag_missoes_recompensas_sigilo_v115.sql no Supabase.`)
    else {
      setMissions(((missionResult.data ?? []) as Mission[]).map(item => ({
        ...item,
        objectives: Array.isArray(item.objectives) ? item.objectives : [],
        reward_items: Array.isArray(item.reward_items) ? item.reward_items : [],
        reward_milestones: Array.isArray(item.reward_milestones) ? item.reward_milestones : [],
        awarded_milestones: Array.isArray(item.awarded_milestones) ? item.awarded_milestones : [],
        reward_preview: Array.isArray(item.reward_preview) ? item.reward_preview : [],
        recipient_character_ids: Array.isArray(item.recipient_character_ids) ? item.recipient_character_ids : [],
        hide_objectives: Boolean(item.hide_objectives),
        hide_rewards: Boolean(item.hide_rewards),
      })))
      setError('')
    }
    if (chestResult.error) setError(`Baú do Mestre indisponível: ${chestResult.error.message}`)
    else setDrops((chestResult.data ?? []) as ChestDrop[])
    if (!conditionResult.error) setConditions((conditionResult.data ?? []) as ConditionOption[])
    setLoading(false)
  }, [campaignId, isMaster])
  useEffect(() => {
    void refresh()
    const channel = supabase.channel(`hax-missions-${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_missions', filter: `campaign_id=eq.${campaignId}` }, () => { void refresh() })
      .subscribe()
    // A consulta pública é filtrada por uma RPC. RLS impede eventos diretos para jogadores.
    const polling = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 45000)
    return () => { window.clearInterval(polling); void supabase.removeChannel(channel) }
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
    return `${match?.name || reward.name || (isMaster ? 'Drop removido' : 'Recompensa')} ×${reward.quantity}`
  }
  const canFinish = (mission: Mission) => mission.status === 'active' && mission.objectives.length > 0 && mission.objectives.every(obj => obj.done)

  function startCreate() { setEditorId(null); setDraft(emptyDraft(seasonId)); setObjectiveText(''); setShowEditor(true); setError(''); setNotice('') }
  function startEdit(mission: Mission) {
    if (mission.status === 'completed') return
    setEditorId(mission.id)
    setDraft({ title: mission.title, description: mission.description, visibility: mission.visibility, season_id: mission.season_id || '',
      objectives: mission.objectives.map(objective => ({ ...objective })), rewards: mission.reward_items.map(item => ({ ...item })), milestones: mission.reward_milestones.map(milestone => ({...milestone,items:milestone.items.map(item=>({...item})),conditions:milestone.conditions.map(item=>({...item}))})), recipientIds: [...mission.recipient_character_ids], hideObjectives:mission.hide_objectives, hideRewards:mission.hide_rewards })
    setObjectiveText(''); setShowEditor(true); setError(''); setNotice('')
  }
  async function saveMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isMaster || saving) return
    if (!draft.title.trim()) { setError('Informe o título da missão.'); return }
    if (!draft.objectives.length || draft.objectives.some(obj => !obj.title.trim())) { setError('Inclua pelo menos um objetivo válido.'); return }
    const rewardCount = draft.rewards.length + draft.milestones.reduce((count, milestone) => count+milestone.items.length+milestone.conditions.length, 0)
    if (rewardCount && !draft.recipientIds.length) { setError('Escolha os destinatários dos drops.'); return }
    if (draft.milestones.length > 12 || draft.milestones.some(milestone => !Number.isInteger(milestone.threshold) || milestone.threshold < 1 || milestone.threshold > 100 || milestone.items.length+milestone.conditions.length > 30 || milestone.items.length+milestone.conditions.length < 1)) { setError('Configure até 12 faixas, entre 1% e 100%, com 30 recompensas por faixa.'); return }
    if (new Set(draft.milestones.map(milestone=>milestone.threshold)).size!==draft.milestones.length) { setError('Não repita porcentagens nas faixas de recompensa.'); return }
    if (draft.milestones.some(milestone=>milestone.conditions.some(condition=>!condition.id || condition.duration.length>120))) { setError('Revise as condições das faixas.'); return }
    const previous = missions.find(mission=>mission.id===editorId)
    if (previous?.awarded_milestones.some(threshold=>JSON.stringify(previous.reward_milestones.find(band=>band.threshold===threshold))!==JSON.stringify(draft.milestones.find(band=>band.threshold===threshold)))) { setError('Faixas já entregues não podem ser modificadas.'); return }
    if (draft.rewards.length > 30 || draft.recipientIds.length > 50) { setError('Máximo de 30 drops finais e 50 destinatários.'); return }
    setSaving(true);setError('');setNotice('')
    const payload = { campaign_id: campaignId, season_id: draft.season_id || null,
      title: draft.title.trim(), description: draft.description.trim(), visibility: draft.visibility,
      objectives: draft.objectives, reward_items: draft.rewards, recipient_character_ids: draft.recipientIds,
      hide_objectives:draft.hideObjectives, hide_rewards:draft.hideRewards,
      reward_milestones: [...draft.milestones].sort((a,b)=>a.threshold-b.threshold) }
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
    const desired = !mission.objectives.find(objective=>objective.id===id)?.done
    const { error: updateError, data: result } = await supabase.rpc('hax_mission_update_objective', {
      p_mission_id: mission.id, p_objective_id: id, p_done: desired,
    })
    if (updateError) { setError(`Falha ao atualizar objetivo ou entregar recompensas: ${updateError.message}. Nenhum drop foi entregue nesta tentativa.`); setSaving(false); await refresh(); return }
    const paid = (result as {awarded_milestones?: number[]}|null)?.awarded_milestones || []
    if (paid.some(threshold=>!mission.awarded_milestones.includes(threshold))) onDelivered?.()
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
    const rewardCount = mission.reward_items.length + mission.reward_milestones.reduce((sum,band)=>sum+band.items.length+band.conditions.length,0)
    const question = rewardCount
      ? `Concluir “${mission.title}”? Serão entregues os drops finais ainda pendentes; as faixas já entregues não se repetem. Esta ação não pode ser desfeita.`
      : `Concluir “${mission.title}”? Esta ação não pode ser desfeita.`
    if (!window.confirm(question)) return
    setSaving(true); setError('');setNotice('')
    const result = await supabase.rpc('hax_mission_complete', { p_mission_id: mission.id })
    setSaving(false)
    if (result.error) setError(`Missão não concluída; nenhum drop desta tentativa foi entregue: ${result.error.message}`)
    else { setNotice(`Missão concluída! ${rewardCount ? 'Recompensas processadas sem repetir faixas pagas.' : 'Sem recompensa material configurada.'}`); await refresh();onDelivered?.() }
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
          {isMaster && <><span>{mission.visibility === 'master' ? '🔒 Mestre' : mission.visibility === 'assigned' ? '◈ Destinatários' : '◎ Pública'}</span>{mission.hide_objectives && <span>Objetivos ocultos</span>}{mission.hide_rewards && <span>Recompensas ocultas</span>}</>}
        </div><h3>{mission.title}</h3></div>{isMaster && mission.status !== 'completed' && <button type="button" className="hb-missions-soft" disabled={saving} onClick={()=>startEdit(mission)}>Editar</button>}</div>
        {mission.description && <p className="hb-mission-description">{mission.description}</p>}
        {!isMaster && mission.hide_objectives ? <p className="hb-mission-hidden"><span aria-hidden="true">🔒</span> Objetivos e progresso ocultos pelo mestre.</p> : <>
          <div className="hb-mission-progress"><div><strong>Objetivos</strong><span>{mission.objectives.filter(obj=>obj.done).length} / {mission.objectives.length}</span></div>
            <div className="hb-mission-progress-track"><div style={{ width:`${mission.objectives.length ? (mission.objectives.filter(obj=>obj.done).length / mission.objectives.length)*100 : 0}%` }} /></div></div>
          <ul className="hb-mission-objectives">{mission.objectives.map(obj=><li key={obj.id}>
            <label className={obj.done ? 'is-done' : ''}><input type="checkbox" checked={obj.done} disabled={!isMaster || saving || mission.status !== 'active'} onChange={()=>void toggleObjective(mission,obj.id)}/><span>{obj.title}</span></label>
          </li>)}</ul>
        </>}
        {isMaster && mission.reward_milestones.length>0 && <div className="hb-mission-rewards"><strong>🎁 Recompensas por progresso</strong>
          {mission.reward_milestones.map(band=><div key={band.threshold} className="hb-missions-card-band"><strong>{band.threshold}% {mission.awarded_milestones.includes(band.threshold)?'· ✓ Entregue':'· Pendente'}</strong><div>{band.items.map((item,i)=><span key={`item-${i}`}>{rewardLabel(item)}</span>)}{band.conditions.map((item,i)=><span key={`condition-${i}`}>✦ {item.name} · {item.duration}</span>)}</div></div>)}
        </div>}
        {isMaster && mission.reward_items.length>0 && <div className="hb-mission-rewards"><strong>🎁 Drops finais</strong><div>{mission.reward_items.map((reward,index)=><span key={`${reward.id}-${index}`}>{rewardLabel(reward)}</span>)}</div><small>{mission.recipient_character_ids.length} destinatário(s)</small></div>}
        {!isMaster && (mission.hide_rewards ? <p className="hb-mission-hidden"><span aria-hidden="true">🔒</span> Recompensas mantidas em segredo pelo mestre.</p> : mission.reward_preview.length>0 ? <div className="hb-mission-rewards"><strong>🎁 Recompensas conhecidas</strong>{mission.reward_preview.map((group,index)=><div key={index} className="hb-missions-card-band"><strong>{group.threshold}%</strong><div>{group.labels.map((label,j)=><span key={j}>{label}</span>)}</div></div>)}</div> : null)}
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
          <fieldset className="hb-missions-secrecy"><legend>O que os jogadores podem ver?</legend>
            <p className="hb-missions-help">A missão continua visível para os jogadores permitidos pela opção acima. Os campos escondidos não são enviados pelo servidor.</p>
            <label><input type="checkbox" checked={draft.hideObjectives} onChange={event=>setDraft(current=>({...current,hideObjectives:event.target.checked}))}/> Ocultar objetivos e progresso dos jogadores</label>
            <label><input type="checkbox" checked={draft.hideRewards} onChange={event=>setDraft(current=>({...current,hideRewards:event.target.checked}))}/> Ocultar drops e condições de recompensa dos jogadores</label>
          </fieldset>
          <fieldset><legend>Objetivos da missão</legend>
            {draft.objectives.map(obj=><div className="hb-missions-objective-edit" key={obj.id}><input aria-label="Objetivo" maxLength={240} value={obj.title} onChange={event=>setDraft(current=>({...current,objectives:current.objectives.map(row=>row.id===obj.id?{...row,title:event.target.value}:row)}))}/><button type="button" className="hb-missions-danger" onClick={()=>setDraft(current=>({...current,objectives:current.objectives.filter(row=>row.id!==obj.id)}))}>Remover</button></div>)}
            <div className="hb-missions-add-objective"><input value={objectiveText} maxLength={240} placeholder="Novo objetivo" onChange={event=>setObjectiveText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(objectiveText.trim()){setDraft(current=>({...current,objectives:[...current.objectives,makeObjective(objectiveText.trim())]}));setObjectiveText('')}}}}/><button type="button" onClick={()=>{if(objectiveText.trim()){setDraft(current=>({...current,objectives:[...current.objectives,makeObjective(objectiveText.trim())]}));setObjectiveText('')}}}>＋ Adicionar</button></div>
          </fieldset>
          <fieldset className="hb-missions-milestones"><legend>Recompensas por porcentagem concluída</legend>
            <p className="hb-missions-help">Cada faixa é entregue uma única vez quando o mestre marca objetivos e atinge a porcentagem configurada. Os personagens recebem itens do Baú e/ou condições da biblioteca.</p>
            {draft.milestones.map((band,index)=>{const paid=Boolean(editorId && missions.find(m=>m.id===editorId)?.awarded_milestones.includes(band.threshold));return <div className="hb-missions-milestone" key={index}>
              <div className="hb-missions-band-head"><label>Ao atingir <input type="number" min="1" max="100" step="1" value={band.threshold} disabled={paid} onChange={event=>setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,threshold:Number(event.target.value)||1}:entry)}))}/> %</label>
                <button type="button" className="hb-missions-danger" disabled={paid} onClick={()=>setDraft(current=>({...current,milestones:current.milestones.filter((_,i)=>i!==index)}))}>Excluir faixa</button>
              </div>
              {paid && <small className="hb-missions-paid">✓ Faixa já entregue; não altere as recompensas pagas.</small>}
              <strong>Itens do Baú</strong>
              {band.items.map((reward,j)=><div className="hb-missions-reward-row" key={`${reward.id}-${j}`}><span>{rewardLabel(reward)}</span><input aria-label="Quantidade" type="number" min="1" max="999999" value={reward.quantity} disabled={paid} onChange={event=>setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,items:entry.items.map((item,k)=>k===j?{...item,quantity:Math.max(1,Math.min(999999,Number(event.target.value)||1))}:item)}:entry)}))}/><button type="button" className="hb-missions-danger" disabled={paid} onClick={()=>setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,items:entry.items.filter((_,k)=>k!==j)}:entry)}))}>Retirar</button></div>)}
              <select aria-label={`Adicionar item na faixa de ${band.threshold}%`} value="" disabled={paid || band.items.length+band.conditions.length>=30} onChange={event=>{const id=event.target.value;const found=drops.find(item=>item.id===id);if(found)setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,items:[...entry.items,{id,quantity:1,name:found.name}]}:entry)}))}}><option value="">＋ Item do Baú...</option>{knownDrops.filter(item=>!band.items.some(row=>row.id===item.id)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <strong>Condições como recompensa</strong>
              {band.conditions.map((condition,j)=><div className="hb-missions-reward-row" key={`${condition.id}-${j}`}><span>✦ {condition.name}</span><input aria-label="Duração da condição" maxLength={120} placeholder="Ex.: 3 rodadas" value={condition.duration} disabled={paid} onChange={event=>setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,conditions:entry.conditions.map((row,k)=>k===j?{...row,duration:event.target.value}:row)}:entry)}))}/><button type="button" className="hb-missions-danger" disabled={paid} onClick={()=>setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,conditions:entry.conditions.filter((_,k)=>k!==j)}:entry)}))}>Retirar</button></div>)}
              <select aria-label={`Adicionar condição na faixa de ${band.threshold}%`} value="" disabled={paid || band.items.length+band.conditions.length>=30} onChange={event=>{const id=event.target.value;const found=conditions.find(row=>row.id===id);if(found)setDraft(current=>({...current,milestones:current.milestones.map((entry,i)=>i===index?{...entry,conditions:[...entry.conditions,{id,name:found.name,duration:'Indeterminada'}]}:entry)}))}}><option value="">＋ Condição da biblioteca...</option>{conditions.filter(condition=>!band.conditions.some(row=>row.id===condition.id)).map(condition=><option key={condition.id} value={condition.id}>{condition.emoji} {condition.name}</option>)}</select>
            </div>})}
            <button type="button" className="hb-missions-soft" disabled={draft.milestones.length>=12} onClick={()=>setDraft(current=>{const next=[25,50,75,100,10,20,30,40,60,80,90].find(value=>!current.milestones.some(row=>row.threshold===value))||1;return {...current,milestones:[...current.milestones,{threshold:next,items:[],conditions:[]}]}})}>＋ Criar faixa de progresso</button>
            {!conditions.length&&<small className="hb-missions-help">Crie condições na biblioteca do Mestre para utilizá-las como drops.</small>}
          </fieldset>
          <fieldset><legend>Drops finais (compatibilidade com missões anteriores)</legend><p className="hb-missions-help">Estes drops são entregues somente ao concluir a missão. Use as faixas acima para recompensas liberadas em porcentagens intermediárias.</p>
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
