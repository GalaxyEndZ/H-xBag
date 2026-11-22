import {useCallback,useEffect,useMemo,useState} from 'react'
import { supabase } from '../supabase'

type Reaction = {message_id:string;user_id:string;emoji:string}
type Pin = {message_id:string;user_id:string}
const emojiOptions=['❤️','😂','👍','✨','😮','😢'] as const
export function useSocialV245Chat(userId:string,messages:{message_id:string}[],active:boolean,onReload:()=>Promise<unknown>){
 const ids=useMemo(()=>messages.map(m=>m.message_id),[messages])
 const idsKey=ids.join(',')
 const [reactions,setReactions]=useState<Reaction[]>([])
 const [pins,setPins]=useState<Pin[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const refresh=useCallback(async()=>{
  const valid=idsKey.split(',').filter(Boolean)
  if(!valid.length){setReactions([]);setPins([]);return}
  const [a,b]=await Promise.all([
   supabase.from('hax_v245_message_reactions').select('message_id,user_id,emoji').in('message_id',valid),
   supabase.from('hax_v245_message_pins').select('message_id,user_id').eq('user_id',userId).in('message_id',valid),
  ])
  if(a.error)throw a.error;if(b.error)throw b.error
  setReactions((a.data||[]) as Reaction[]);setPins((b.data||[]) as Pin[])
 },[idsKey,userId])
 useEffect(()=>{if(!active)return;let live=true;void refresh().catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))});return()=>{live=false}},[active,refresh])
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await action();await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const react=(messageId:string,emoji:string)=>run(async()=>{
  const current=reactions.find(r=>r.message_id===messageId&&r.user_id===userId)
  if(current?.emoji===emoji){const r=await supabase.from('hax_v245_message_reactions').delete().eq('message_id',messageId).eq('user_id',userId);if(r.error)throw r.error}
  else{const r=await supabase.from('hax_v245_message_reactions').upsert({message_id:messageId,user_id:userId,emoji},{onConflict:'message_id,user_id'});if(r.error)throw r.error}
 })
 const pin=(messageId:string)=>run(async()=>{
  if(pins.some(p=>p.message_id===messageId)){const r=await supabase.from('hax_v245_message_pins').delete().eq('message_id',messageId).eq('user_id',userId);if(r.error)throw r.error}
  else{const r=await supabase.from('hax_v245_message_pins').insert({message_id:messageId,user_id:userId});if(r.error)throw r.error}
 })
 const edit=(messageId:string,oldBody:string)=>run(async()=>{
  const body=window.prompt('Editar mensagem (até 15 minutos após enviar):',oldBody)
  if(body===null||!body.trim()||body.trim()===oldBody)return
  const r=await supabase.rpc('hax_v245_edit_message',{p_message:messageId,p_body:body.trim().slice(0,2500)})
  if(r.error)throw r.error
  await onReload()
 })
 return {emojiOptions,reactions,pins,busy,error,react,pin,edit}
}
