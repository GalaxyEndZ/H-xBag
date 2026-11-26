import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import './V303Features.css'
type Achievement={code:string;title:string;description:string;icon:string;category:string;required_count:number;progress:number;earned:boolean;awarded_at:string|null}
export default function AchievementsV303({userId}:{userId:string}){
 const [entries,setEntries]=useState<Achievement[]>([])
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{
  const {data,error:failure}=await supabase.rpc('hax_v303_sync_achievements')
  if(failure)throw failure
  setEntries((data||[]) as Achievement[])
 },[])
 useEffect(()=>{let active=true;setLoading(true);void load().catch(cause=>{if(active)setError(`Conquistas indisponíveis. Execute a migração V303 no Supabase. ${cause instanceof Error?cause.message:String(cause)}`)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[load,userId])
 const earned=entries.filter(item=>item.earned).length
 const refresh=()=>{setBusy(true);setError('');void load().catch(e=>setError(String(e))).finally(()=>setBusy(false))}
 return <section className="hb-v303-achievements"><header><div><small>SEU PROGRESSO NO HÄXBAG</small><h3>Conquistas globais</h3><p>Marcos desbloqueados pelas suas atividades. Não são as insígnias oficiais concedidas pelo site.</p></div><div><strong>{earned}/{entries.length}</strong><button type="button" disabled={busy} onClick={refresh}>↻ Atualizar</button></div></header>
  {error&&<p role="alert" className="hb-v303-error">{error}</p>}{loading?<p>Verificando conquistas…</p>:<div className="hb-v303-achievement-grid">{entries.map(item=><article key={item.code} className={item.earned?'is-earned':'is-locked'}><span className="hb-v303-achievement-icon" aria-hidden="true">{item.icon}</span><div><small>{item.category} · {item.earned?'Conquistada':'Em progresso'}</small><strong>{item.title}</strong><p>{item.description}</p><div className="hb-v303-achievement-progress" role="progressbar" aria-label={`Progresso de ${item.title}`} aria-valuemin={0} aria-valuemax={item.required_count} aria-valuenow={Math.min(item.progress,item.required_count)}><span style={{width:`${Math.min(100,Math.round(100*item.progress/item.required_count))}%`}}/></div><small>{item.earned?'✓ Conquistada em '+new Date(item.awarded_at||'').toLocaleDateString('pt-BR'):`${item.progress}/${item.required_count}`}</small></div></article>)}</div>}
 </section>
}
