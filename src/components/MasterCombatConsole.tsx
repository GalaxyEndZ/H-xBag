import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import './MasterCombatConsole.css'

type Participant = { id: string; kind: 'character' | 'enemy'; name: string; emoji: string | null; initiative: number | null; sheetData: Record<string, any>; maxResources: {pv:number;ps:number;pr:number} }
type CombatEvent = { id: string; target_name: string; target_kind: string; resource: string; delta: number; previous_value: number; new_value: number; note: string; created_at: string }

export default function MasterCombatConsole({campaignId, seasonId, participants, activeTurnKey, onAdjusted, onDiceTower, onConditions}: {
  campaignId: string; seasonId: string; participants: Participant[]; activeTurnKey: string
  onAdjusted: () => void; onDiceTower: () => void; onConditions: () => void
}) {
  const [selected, setSelected] = useState('')
  const [resource, setResource] = useState<'pv' | 'ps' | 'pr'>('pv')
  const [amount, setAmount] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<CombatEvent[]>([])
  const [rollResult, setRollResult] = useState('')
  const [diceSides, setDiceSides] = useState<6 | 20 | 12>(20)
  useEffect(() => { setSelected(''); setResource('pv');setError('');setMessage('') }, [campaignId,seasonId])
  useEffect(() => {
    if (activeTurnKey && participants.some(p=>`${p.kind}:${p.id}`===activeTurnKey)) setSelected(activeTurnKey)
    else setSelected(current => participants.some(p=>`${p.kind}:${p.id}`===current) ? current : '')
  }, [activeTurnKey, participants])
  const selectedParticipant = participants.find(p => `${p.kind}:${p.id}`===selected)
  const rawResource = selectedParticipant?.sheetData?.status?.current?.[resource]
  const resourceKnown = rawResource!==undefined && rawResource!==null && Number.isFinite(Number(rawResource))
  const currentValue = resourceKnown ? Number(rawResource) : null
  const maximumValue = selectedParticipant?.maxResources[resource]
  const parsedAmount = Number(amount)
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 100000
  const canApply = Boolean(selectedParticipant && resourceKnown && amountValid && !busy && seasonId)
  const refresh = useCallback(async () => {
    if (!campaignId || !seasonId) { setHistory([]);return }
    const {data,error:loadError}=await supabase.from('hax_combat_events')
      .select('id,target_name,target_kind,resource,delta,previous_value,new_value,note,created_at')
      .eq('campaign_id',campaignId).eq('season_id',seasonId).order('created_at',{ascending:false}).limit(35)
    if (!loadError) setHistory((data??[]) as CombatEvent[])
  },[campaignId,seasonId])
  useEffect(()=>{
    void refresh()
    if(!campaignId||!seasonId) return
    const channel=supabase.channel(`hax-combat-${campaignId}-${seasonId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'hax_combat_events',filter:`campaign_id=eq.${campaignId}`},()=>{void refresh()})
      .subscribe()
    return ()=>{void supabase.removeChannel(channel)}
  },[campaignId,seasonId,refresh])
  const active = useMemo(()=>participants.filter(p=>p.initiative!==null),[participants])
  async function apply(direction: -1 | 1) {
    if(!selectedParticipant||!canApply) return
    const delta=direction*parsedAmount
    setBusy(true);setError('');setMessage('')
    const {data,error:adjustError}=await supabase.rpc('hax_combat_adjust_resource',{
      p_campaign_id:campaignId,p_season_id:seasonId,p_target_kind:selectedParticipant.kind,
      p_target_id:selectedParticipant.id,p_resource:resource,p_delta:delta,p_note:note.trim(),p_max_value:maximumValue ?? null,
    })
    setBusy(false)
    if(adjustError) setError(`Não foi possível atualizar ${resource.toUpperCase()}: ${adjustError.message}. Verifique a migração V110 e a ficha.`)
    else { setMessage(`${selectedParticipant.name} · ${resource.toUpperCase()} ${delta>0?'+':''}${delta} → ${data}`);setNote('');onAdjusted();await refresh() }
  }
  function roll() {
    const die = Math.floor(Math.random()*diceSides)+1
    setRollResult(`d${diceSides}: ${die}`)
  }
  return <section className="hb-combat-console" id="hb-ms-combat" aria-labelledby="hb-ms-combat-title">
    <header className="hb-combat-console-head"><div><span className="hb-kicker">⚔ FERRAMENTAS DE ENCONTRO</span><h3 id="hb-ms-combat-title">Ações rápidas de combate</h3><p>Aplique ajustes líquidos de PV, PS ou PR e consulte as últimas alterações feitas pelo mestre.</p></div><span className="hb-combat-ready-count">{active.length} com iniciativa</span></header>
    <div className="hb-combat-columns">
      <div className="hb-combat-panel">
        <label>Participante
          <select value={selected} onChange={event=>setSelected(event.target.value)} disabled={!participants.length||busy}>
            <option value="">Selecione um personagem ou inimigo</option>
            {participants.map(p=><option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>{p.emoji|| (p.kind==='enemy'?'⚔':'♙')} {p.name} · {p.kind==='enemy'?'Inimigo':'Personagem'}</option>)}
          </select>
        </label>
        <div className="hb-combat-row"><label>Recurso
          <select value={resource} onChange={event=>setResource(event.target.value as typeof resource)}><option value="pv">PV · Vida</option><option value="ps">PS · Sanidade</option><option value="pr">PR · Recurso</option></select>
        </label><label>Quantidade<input type="number" min="1" max="100000" step="1" value={amount} onChange={event=>setAmount(event.target.value)}/></label></div>
        <div className="hb-combat-resource-state">{selectedParticipant ? <><span>{selectedParticipant.name}</span><strong>{resourceKnown?`${currentValue} ${resource.toUpperCase()}${resource!=='pv' && maximumValue!==undefined ? ` / ${maximumValue}` : ''}`:'Recurso não inicializado'}</strong></> : 'Escolha alguém da ordem de combate'}</div>
        <label>Observação (opcional)<input maxLength={280} value={note} onChange={event=>setNote(event.target.value)} placeholder="Ex.: dano após armadura e proteção"/></label>
        <div className="hb-combat-actions"><button type="button" className="hb-combat-damage" onClick={()=>void apply(-1)} disabled={!canApply}>− Aplicar dano</button><button type="button" className="hb-combat-heal" onClick={()=>void apply(1)} disabled={!canApply}>＋ Recuperar</button></div>
        <small className="hb-combat-disclaimer">Informe o valor <strong>já reduzido por defesas, armadura e condições</strong>. O painel não calcula absorção automaticamente. Recuperações de PS e PR respeitam os máximos da ficha; PV segue as regras existentes de ultrapassar o máximo.</small>
        {error && <p role="alert" className="hb-combat-error">{error}</p>}{message && <p role="status" className="hb-combat-notice">{message}</p>}
      </div>
      <div className="hb-combat-panel hb-combat-tools">
        <div className="hb-combat-tool-heading"><strong>🎲 Rolagem de apoio</strong><small>O resultado é local e não altera fichas.</small></div>
        <div className="hb-combat-dice"><select aria-label="Tipo de dado" value={diceSides} onChange={event=>setDiceSides(Number(event.target.value) as typeof diceSides)}><option value={20}>d20</option><option value={12}>d12</option><option value={6}>d6</option></select><button type="button" onClick={roll}>Rolar dado</button>{rollResult && <strong aria-live="polite">{rollResult}</strong>}</div>
        <div className="hb-combat-shortcuts"><button type="button" onClick={onDiceTower}>🎲 Torre de Dados</button><button type="button" onClick={onConditions}>◈ Condições</button></div>
        <div className="hb-combat-tool-heading"><strong>◷ Registro de ajustes</strong><small>Sincronizado para os mestres da campanha.</small></div>
        <div className="hb-combat-history" aria-label="Histórico recente do combate">{history.length ? history.map(event=><div key={event.id} className="hb-combat-history-row"><span><strong>{event.target_name}</strong> · {event.resource.toUpperCase()} {event.delta>0?'+':''}{event.delta}<small>{event.previous_value} → {event.new_value}{event.note ? ` · ${event.note}` : ''}</small></span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div>) : <p>Nenhum ajuste registrado nesta temporada.</p>}</div>
      </div>
    </div>
  </section>
}
