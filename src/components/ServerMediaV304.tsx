import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './V304Features.css'
export type ServerMediaV304Item = {id:string;server_id:string;code:string;kind:'emoji'|'sticker';storage_path:string;created_by:string}
export const mediaUrlV304=(path:string)=>supabase.storage.from('hax-v304-server-media').getPublicUrl(path).data.publicUrl
export function renderMediaTokensV304(content:string,items:ServerMediaV304Item[]){
 const tokens=content.split(/(:[a-z][a-z0-9_]{1,29}:)/g)
 return tokens.map((piece,i)=>{
  const match=/^:([a-z][a-z0-9_]{1,29}):$/.exec(piece)
  const media=match?items.find(m=>m.code===match[1]):undefined
  return media?<img key={i} src={mediaUrlV304(media.storage_path)} alt={`:${media.code}:`} title={media.code} loading="lazy" referrerPolicy="no-referrer" className={media.kind==='sticker'?'hb-v304-sticker':'hb-v304-emoji'}/>:piece
 })
}
export default function ServerMediaV304({serverId,userId,canManage,onInsert,onItems}:{serverId:string;userId:string;canManage:boolean;onInsert:(text:string)=>void;onItems:(items:ServerMediaV304Item[])=>void}){
 const [items,setItems]=useState<ServerMediaV304Item[]>([]),[file,setFile]=useState<File|null>(null),[code,setCode]=useState(''),[kind,setKind]=useState<'emoji'|'sticker'>('emoji'),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const reload=useCallback(async()=>{const {data,error:e}=await supabase.from('hax_v304_server_media').select('id,server_id,code,kind,storage_path,created_by').eq('server_id',serverId).order('created_at');if(e)throw e;const next=(data||[]) as ServerMediaV304Item[];setItems(next);onItems(next)},[serverId,onItems])
 useEffect(()=>{setItems([]);onItems([]);void reload().catch(()=>{});},[reload,onItems])
 const save=(e:FormEvent)=>{e.preventDefault();if(!file||!canManage||busy)return;const slug=code.toLowerCase().trim();if(!/^[a-z][a-z0-9_]{1,29}$/.test(slug)){setError('Use letras minúsculas, números e _ (2–30 caracteres).');return}
  const allowed=['image/png','image/webp','image/gif'];if(!allowed.includes(file.type)||file.size>(kind==='emoji'?256*1024:1024*1024)){setError('Use PNG, WebP ou GIF. Limite: 256 KB para emoji e 1 MB para figurinha.');return}
  setBusy(true);setError('');void (async()=>{const ext=file.type==='image/png'?'png':file.type==='image/gif'?'gif':'webp';const path=`${serverId}/${crypto.randomUUID()}.${ext}`;const {error:up}=await supabase.storage.from('hax-v304-server-media').upload(path,file,{upsert:false,contentType:file.type});if(up)throw up
   const {error:db}=await supabase.from('hax_v304_server_media').insert({server_id:serverId,created_by:userId,code:slug,kind,storage_path:path})
   if(db){await supabase.storage.from('hax-v304-server-media').remove([path]);throw db}
   setCode('');setFile(null);await reload()
  })().catch(e=>setError(e instanceof Error?e.message:String(e))).finally(()=>setBusy(false))}
 return <section className="hb-v304-wrap hb-v304-compact"><strong>Emojis e figurinhas do servidor</strong>{error&&<p role="alert" className="hb-v304-error">{error}</p>}
  <div className="hb-v304-media-grid">{items.map(m=><button key={m.id} type="button" onClick={()=>onInsert(`:${m.code}:`)} title={`Inserir :${m.code}:`}><img src={mediaUrlV304(m.storage_path)} alt="" loading="lazy"/><small>{m.code}</small></button>)}{!items.length&&<small>Este servidor ainda não possui mídias personalizadas.</small>}</div>
  {canManage&&<form onSubmit={save} className="hb-v304-form"><label>Nome do código<input value={code} onChange={e=>setCode(e.target.value)} maxLength={30} placeholder="dragao" required/></label><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as 'emoji'|'sticker')}><option value="emoji">Emoji</option><option value="sticker">Figurinha</option></select></label><label>Imagem<input required type="file" accept="image/png,image/webp,image/gif" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button disabled={busy||!file||!code.trim()}>{busy?'Enviando…':'Adicionar ao servidor'}</button></form>}
 </section>
}
