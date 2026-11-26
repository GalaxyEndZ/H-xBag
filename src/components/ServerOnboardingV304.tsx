import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './V304Features.css'

type Config={server_id:string;enabled:boolean;welcome:string;rules:string;questions:string[];default_role_id:string|null}
const EMPTY=(server_id:string):Config=>({server_id,enabled:false,welcome:'Bem-vindo ao servidor!',rules:'',questions:[],default_role_id:null})
export default function ServerOnboardingV304({serverId,userId,isOwner,configure,onGateChange}:{serverId:string;userId:string;isOwner:boolean;configure:boolean;onGateChange?:(blocked:boolean)=>void}){
 const [config,setConfig]=useState<Config>(EMPTY(serverId)),[accepted,setAccepted]=useState(false),[loading,setLoading]=useState(true)
 const [answers,setAnswers]=useState<string[]>([]),[agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [roles,setRoles]=useState<{id:string;name:string}[]>([])
 const refresh=useCallback(async()=>{
  const [cfg,ok,role]=await Promise.all([supabase.from('hax_v304_onboarding').select('*').eq('server_id',serverId).maybeSingle(),supabase.from('hax_v304_onboarding_acceptances').select('server_id').eq('server_id',serverId).eq('user_id',userId).maybeSingle(),supabase.from('hax_v303_server_roles').select('id,name').eq('server_id',serverId)])
  if(cfg.error)throw cfg.error
  const next=(cfg.data||EMPTY(serverId)) as Config;setConfig(next);setAnswers((next.questions||[]).map(()=>''))
  if(ok.error)throw ok.error;setAccepted(Boolean(ok.data));setRoles(role.error?[]:role.data||[])
  onGateChange?.(next.enabled&&!ok.data&&!isOwner)
 },[serverId,userId,isOwner,onGateChange])
 useEffect(()=>{setLoading(true);setError('');setAccepted(false);void refresh().catch(e=>{setError('Configuração de entrada indisponível. Verifique a migração V304: '+(e instanceof Error?e.message:String(e)));onGateChange?.(false)}).finally(()=>setLoading(false))},[refresh,onGateChange])
 const save=(e:FormEvent)=>{e.preventDefault();if(!isOwner||busy)return;setBusy(true);setError('');void supabase.from('hax_v304_onboarding').upsert({...config,questions:config.questions.filter(Boolean).slice(0,5)}, {onConflict:'server_id'}).then(async({error:e})=>{if(e)throw e;await refresh();setNotice('Entrada personalizada salva.')}).catch(e=>setError(String(e.message||e))).finally(()=>setBusy(false))}
 const accept=(e:FormEvent)=>{e.preventDefault();if(busy||!agree)return;setBusy(true);setError('');void supabase.rpc('hax_v304_finish_onboarding',{p_server:serverId,p_answers:answers.map(a=>a.trim())}).then(async({error:e})=>{if(e)throw e;setAccepted(true);onGateChange?.(false);setNotice('Entrada concluída! Bem-vindo.')}).catch(e=>setError(String(e.message||e))).finally(()=>setBusy(false))}
 if(loading)return configure?<p className="hb-v304-muted">Carregando entrada…</p>:null
 if(configure){if(!isOwner)return null;return <section className="hb-v304-wrap hb-v304-compact"><h3>Entrada personalizada</h3><p>Configure regras e perguntas para novos membros.</p>{error&&<p className="hb-v304-error">{error}</p>}{notice&&<p className="hb-v304-success">{notice}</p>}<form className="hb-v304-form" onSubmit={save}>
  <label><input type="checkbox" checked={config.enabled} onChange={e=>setConfig(v=>({...v,enabled:e.target.checked}))}/> Exigir apresentação ao entrar</label>
  <label>Boas-vindas<input maxLength={220} value={config.welcome} onChange={e=>setConfig(v=>({...v,welcome:e.target.value}))}/></label>
  <label>Regras<textarea rows={6} maxLength={6000} value={config.rules} onChange={e=>setConfig(v=>({...v,rules:e.target.value}))}/></label>
  <label>Perguntas (uma por linha, até cinco)<textarea rows={4} value={config.questions.join('\n')} onChange={e=>setConfig(v=>({...v,questions:e.target.value.split('\n').slice(0,5).map(x=>x.slice(0,180))}))}/></label>
  <label>Cargo inicial<select value={config.default_role_id||''} onChange={e=>setConfig(v=>({...v,default_role_id:e.target.value||null}))}><option value="">Sem cargo automático</option>{roles.map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
  <button disabled={busy}>{busy?'Salvando…':'Salvar configuração'}</button></form></section>}
 if(!config.enabled||accepted||isOwner)return null
 return <div className="hb-v304-onboarding-screen hb-v304-wrap" role="dialog" aria-modal="true" aria-label="Entrada no servidor"><form className="hb-v304-form" onSubmit={accept}><h2>{config.welcome||'Bem-vindo ao servidor!'}</h2><p>Antes de participar da conversa, leia e aceite as regras.</p><div className="hb-v304-readable">{config.rules||'Respeite os demais participantes.'}</div>{config.questions.map((q,i)=><label key={i}>{q}<input maxLength={500} required value={answers[i]||''} onChange={e=>setAnswers(prev=>prev.map((v,j)=>j===i?e.target.value:v))}/></label>)}<label><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/> Li e aceito as regras deste servidor.</label>{error&&<p className="hb-v304-error">{error}</p>}{notice&&<p className="hb-v304-success">{notice}</p>}<button disabled={busy||!agree||config.questions.some((_,i)=>!answers[i]?.trim())}>{busy?'Registrando…':'Concluir entrada'}</button></form></div>
}
