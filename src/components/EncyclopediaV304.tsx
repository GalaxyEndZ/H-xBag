import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './V304Features.css'

type Page = { id:string;campaign_id:string;title:string;category:string;body:string;visibility:'campaign'|'master';author_id:string;updated_at:string;revision:number }
type History = { id:string;page_id:string;revision:number;body:string;title:string;edited_at:string }
const reason=(e:unknown)=>e instanceof Error?e.message:String(e)
/** Enciclopédia por campanha: sem HTML arbitrário, leitura sujeita a RLS e histórico imutável. */
export default function EncyclopediaV304({campaignId,canManage}:{campaignId:string;userId:string;canManage:boolean}){
 const [pages,setPages]=useState<Page[]>([]),[selected,setSelected]=useState(''),[query,setQuery]=useState('')
 const [editing,setEditing]=useState(false),[title,setTitle]=useState(''),[category,setCategory]=useState('Mundo'),[body,setBody]=useState(''),[visibility,setVisibility]=useState<'campaign'|'master'>('campaign')
 const [history,setHistory]=useState<History[]>([]),[showHistory,setShowHistory]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const current=pages.find(p=>p.id===selected)
 const load=useCallback(async()=>{
  const {data,error:e}=await supabase.from('hax_v304_encyclopedia').select('*').eq('campaign_id',campaignId).order('updated_at',{ascending:false}).limit(250)
  if(e)throw e
  const next=(data||[]) as Page[];setPages(next);setSelected(prev=>next.some(p=>p.id===prev)?prev:next[0]?.id||'')
 },[campaignId])
 useEffect(()=>{setPages([]);setSelected('');setEditing(false);setError('');void load().catch(e=>setError(`Enciclopédia indisponível: ${reason(e)}. Execute a migração V304.`))},[load])
 useEffect(()=>{setHistory([]);if(!showHistory||!current)return;void supabase.from('hax_v304_encyclopedia_history').select('id,page_id,revision,body,title,edited_at').eq('page_id',current.id).order('revision',{ascending:false}).limit(30).then(({data,error:e})=>{if(e)setError(reason(e));else setHistory((data||[]) as History[])})},[showHistory,current?.id])
 const edit=(p?:Page)=>{setEditing(true);setShowHistory(false);setTitle(p?.title||'');setCategory(p?.category||'Mundo');setBody(p?.body||'');setVisibility(p?.visibility||'campaign')}
 const save=(e:FormEvent)=>{e.preventDefault();if(busy||title.trim().length<3)return;setBusy(true);setError('');setNotice('');void (async()=>{
  if(current&&editing&&title!==''&&selected){
   const {error:e}=await supabase.rpc('hax_v304_save_encyclopedia',{p_id:current.id,p_campaign:campaignId,p_title:title.trim(),p_category:category.trim(),p_body:body.trim(),p_visibility:visibility,p_expected_revision:current.revision})
   if(e)throw e
  }else{
   const {error:e}=await supabase.rpc('hax_v304_save_encyclopedia',{p_id:null,p_campaign:campaignId,p_title:title.trim(),p_category:category.trim(),p_body:body.trim(),p_visibility:visibility,p_expected_revision:0})
   if(e)throw e
  }
  await load();setEditing(false);setNotice('Página salva com histórico de revisões.')
 })().catch(e=>setError(reason(e))).finally(()=>setBusy(false))}
 const filtered=pages.filter(p=>(p.title+' '+p.category).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
 return <section className="hb-v304-wrap hb-v304-encyclopedia"><header className="hb-v304-hero"><div><small>RPG · CONHECIMENTO</small><h2>Enciclopédia</h2><p>Um arquivo vivo de histórias, lugares, personagens e descobertas da sua campanha.</p></div><button disabled={!canManage} onClick={()=>{setSelected('');edit()}}>＋ Nova página</button></header>
  {error&&<p role="alert" className="hb-v304-error">{error}</p>}{notice&&<p role="status" className="hb-v304-success">{notice}</p>}
  <div className="hb-v304-two-column"><aside className="hb-v304-list"><label>Pesquisar páginas<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou categoria"/></label>{filtered.map(p=><button key={p.id} className={selected===p.id&&!editing?'active':''} onClick={()=>{setSelected(p.id);setEditing(false);setShowHistory(false)}}><strong>📖 {p.title}</strong><small>{p.category}{p.visibility==='master'?' · Apenas mestres':''}</small></button>)}{!filtered.length&&<p className="hb-v304-muted">Nenhuma página encontrada.</p>}</aside>
  <div className="hb-v304-panel">{editing?<form className="hb-v304-form" onSubmit={save}><h3>{current?'Editar página':'Nova página'}</h3><label>Título<input required minLength={3} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Categoria<input maxLength={60} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Locais, História, Personagens…"/></label><label>Visibilidade<select value={visibility} onChange={e=>setVisibility(e.target.value as 'campaign'|'master')}><option value="campaign">Toda a campanha</option><option value="master">Apenas mestres</option></select></label><label>Conteúdo<textarea rows={16} maxLength={20000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Registre o conhecimento da campanha…"/></label><div className="hb-v304-actions"><button type="button" onClick={()=>setEditing(false)}>Cancelar</button><button type="submit" disabled={busy||title.trim().length<3}>{busy?'Salvando…':'Salvar página'}</button></div></form>:current?<article><div className="hb-v304-article-head"><div><small>{current.category} · Revisão {current.revision}</small><h3>{current.title}</h3><small>Atualizada em {new Date(current.updated_at).toLocaleString('pt-BR')}</small></div><div className="hb-v304-actions"><button onClick={()=>setShowHistory(v=>!v)}>Revisões</button>{canManage&&<button onClick={()=>edit(current)}>Editar</button>}</div></div><div className="hb-v304-readable">{current.body||'Esta página ainda não tem conteúdo.'}</div>{showHistory&&<div className="hb-v304-history"><strong>Histórico de edições</strong>{history.map(h=><details key={h.id}><summary>Revisão {h.revision} · {new Date(h.edited_at).toLocaleString('pt-BR')}</summary><pre>{h.body}</pre></details>)}{!history.length&&<p>Sem revisões anteriores.</p>}</div>}</article>:<div className="hb-v304-empty"><h3>Seu conhecimento começa aqui</h3><p>Escolha uma página à esquerda ou crie um novo registro para sua campanha.</p></div>}</div></div>
 </section>
}
