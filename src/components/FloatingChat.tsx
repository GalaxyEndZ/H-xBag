import {useEffect,useRef,useState,type FormEvent} from 'react'
import {supabase} from '../supabase'
import './FloatingChat.css'

type Conversation={partner_id:string;display_name:string;username:string;last_message:string|null;unread_count:number;can_message:boolean}
type Message={message_id:string;sender_id:string;body:string;created_at:string;image_path:string|null;deleted_at:string|null;read_at:string|null}
/** Chat lateral independente da página, com o mesmo controle de acesso do Social. */
export default function FloatingChat({onOpenFullChat}:{onOpenFullChat:()=>void}){
 const [open,setOpen]=useState(false)
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [selected,setSelected]=useState<Conversation|null>(null)
 const [messages,setMessages]=useState<Message[]>([])
 const [draft,setDraft]=useState('')
 const [userId,setUserId]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [images,setImages]=useState<Record<string,string>>({})
 const [photo,setPhoto]=useState<File|null>(null)
 const listEnd=useRef<HTMLDivElement>(null)
 const fileInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{let live=true;void supabase.auth.getUser().then(({data})=>{if(live)setUserId(data.user?.id||'')});return()=>{live=false}},[])
 const fetchConversations=async()=>{
  const {data,error:failure}=await supabase.rpc('hax_social_chat_list')
  if(failure)throw failure
  const rows=(data||[]) as Conversation[]
  setConversations(rows)
  setSelected(previous=>previous?rows.find(row=>row.partner_id===previous.partner_id)||previous:null)
 }
 const fetchMessages=async(partner:string)=>{
  const {data,error:failure}=await supabase.rpc('hax_social_chat_messages_v172',{p_partner:partner,p_limit:50})
  if(failure)throw failure
  const rows=([...(data||[])] as Message[]).reverse()
  setMessages(rows)
  const urls=await Promise.all(rows.filter(m=>m.image_path&&!m.deleted_at).map(async m=>{
   const result=await supabase.storage.from('hax-social-chat').createSignedUrl(m.image_path!,3600)
   return [m.message_id,result.error?'':result.data.signedUrl] as const
  }))
  setImages(previous=>({...previous,...Object.fromEntries(urls)}))
  if(rows.some(m=>m.sender_id!==userId&&!m.read_at))await supabase.rpc('hax_social_mark_read',{p_partner:partner})
 }
 useEffect(()=>{
  if(!open)return
  let live=true
  const refresh=async()=>{try{await fetchConversations();if(selected?.partner_id)await fetchMessages(selected.partner_id)}catch(e){if(live)setError(e instanceof Error?e.message:String(e))}}
  void refresh()
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},12000)
  return()=>{live=false;window.clearInterval(timer)}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open,selected?.partner_id,userId])
 useEffect(()=>{if(open&&selected)listEnd.current?.scrollIntoView({block:'end',behavior:'smooth'})},[open,selected,messages.length])
 const send=async(event:FormEvent)=>{
  event.preventDefault()
  if(!selected||busy||(!draft.trim()&&!photo))return
  setBusy(true);setError('')
  try{
   const {data:id,error:failure}=await supabase.rpc('hax_social_send_message',{p_partner:selected.partner_id,p_body:draft.trim()||'📷 Foto'})
   if(failure)throw failure
   if(photo){
    const ext=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':photo.type==='image/gif'?'gif':'jpg'
    const path=`${userId}/${String(id)}.${ext}`
    const {error:uploadError}=await supabase.storage.from('hax-social-chat').upload(path,photo,{contentType:photo.type,upsert:false})
    if(uploadError)throw new Error(`Falha ao enviar a imagem: ${uploadError.message}`)
    const {error:attachError}=await supabase.rpc('hax_social_attach_message_image',{p_message_id:id,p_path:path})
    if(attachError)throw attachError
   }
   setDraft('');setPhoto(null)
   await fetchMessages(selected.partner_id);await fetchConversations()
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const deleteMessage=async(message:Message)=>{
  if(message.sender_id!==userId||!window.confirm('Apagar esta mensagem para todos?'))return
  const {error:failure}=await supabase.rpc('hax_social_delete_message',{p_message_id:message.message_id})
  if(failure)setError(failure.message)
  else if(selected)await fetchMessages(selected.partner_id)
 }
 return <div className="hb-v172-float-chat">
  <button className="hb-v172-chat-launch" type="button" aria-expanded={open} title="Abrir chat" onClick={()=>setOpen(value=>!value)}>✉ <span>Chat</span></button>
  {open&&<section className="hb-v172-chat-popup" aria-label="Chat privado">
   <header><div><strong>{selected?selected.display_name:'Mensagens privadas'}</strong><small>{selected?'Conversa privada':'Seus amigos e conversas'}</small></div><div className="hb-v172-chat-window-actions"><button type="button" onClick={onOpenFullChat} title="Abrir chat completo">↗</button><button type="button" onClick={()=>{if(selected)setSelected(null);else setOpen(false)}} aria-label={selected?'Voltar às conversas':'Fechar'}>{selected?'‹':'×'}</button></div></header>
   {error&&<div role="alert" className="hb-v172-chat-error">{error}</div>}
   {!selected?<div className="hb-v172-chat-contacts">{conversations.map(chat=><button type="button" key={chat.partner_id} onClick={()=>{setSelected(chat);setError('')}}><span className="hb-v172-chat-avatar">{(chat.display_name||'A').charAt(0).toUpperCase()}</span><span><strong>{chat.display_name}</strong><small>{chat.last_message||'Inicie uma conversa'}</small></span>{chat.unread_count>0&&<em>{chat.unread_count}</em>}</button>)}{conversations.length===0&&<p>Você ainda não tem conversas. Faça amizades para começar.</p>}</div>:
    <><div className="hb-v172-chat-thread">{messages.map(message=><article key={message.message_id} className={message.sender_id===userId?'mine':''}><div>{message.deleted_at?<em>Mensagem apagada</em>:<>{message.image_path&&images[message.message_id]&&<a href={images[message.message_id]} target="_blank" rel="noopener noreferrer"><img src={images[message.message_id]} alt="Foto da conversa" loading="lazy"/></a>}{message.body!=='📷 Foto'&&<p>{message.body}</p>}</>}
       <small>{new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>{message.sender_id===userId&&!message.deleted_at&&<button type="button" onClick={()=>void deleteMessage(message)} aria-label="Apagar mensagem">⋯ Apagar</button>}</div></article>)}<div ref={listEnd}/></div>
      {selected.can_message?<form onSubmit={e=>void send(e)}><input ref={fileInput} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const file=e.target.files?.[0];if(file){if(file.size>8*1024*1024){setError('Máximo 8 MB por foto.')}else setPhoto(file)}e.target.value=''}}/>
       {photo&&<div className="hb-v172-pending-photo">📷 {photo.name}<button type="button" onClick={()=>setPhoto(null)}>×</button></div>}
       <div className="hb-v172-chat-inputs"><button type="button" title="Anexar foto" onClick={()=>fileInput.current?.click()}>📷</button><input aria-label="Mensagem" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Mensagem…" maxLength={2500}/><button type="submit" disabled={busy||(!draft.trim()&&!photo)} title="Enviar">➤</button></div></form>:<p className="hb-v172-chat-disabled">Só é possível escrever para amigos mútuos.</p>}</>}
  </section>}
 </div>
}
