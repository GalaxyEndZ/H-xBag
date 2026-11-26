import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

export type PresenceStatusV302 = 'available'|'busy'|'invisible'
export type PresenceSettingsV302 = { status:PresenceStatusV302; showActivity:boolean }
export type OnlinePresenceMapV302 = Record<string,{status:'available'|'busy';activity:string|null}>
type PresenceRow = {user_id:string;status:'available'|'busy';activity:string|null;updated_at:string}

const STALE_MS = 95_000
const DEFAULT_SETTINGS:PresenceSettingsV302 = {status:'invisible',showActivity:false}
function readSettings(userId:string|null):PresenceSettingsV302 {
  if(!userId)return DEFAULT_SETTINGS
  try {
    const saved=JSON.parse(localStorage.getItem(`haxbag:v302:presence:${userId}`) || 'null') as Partial<PresenceSettingsV302>|null
    return {status:saved?.status==='available'||saved?.status==='busy'?saved.status:'invisible',showActivity:saved?.showActivity===true}
  }catch{return DEFAULT_SETTINGS}
}

/** V302: presença opt-in em Postgres, nunca identificada por metadados não autenticados de um canal. */
export function usePresenceV302(userId:string|null,activity:string) {
  const [settings,setSettings]=useState<PresenceSettingsV302>(()=>readSettings(userId))
  const [online,setOnline]=useState<OnlinePresenceMapV302>({})
  const [connected,setConnected]=useState(false)
  const settingsRef=useRef(settings)
  const activityRef=useRef(activity)
  settingsRef.current=settings;activityRef.current=activity
  const [revision,setRevision]=useState(0)
  const updateSettings=useCallback((next:Partial<PresenceSettingsV302>)=>{
    setSettings(prev=>({...prev,...next}))
  },[])

  useEffect(()=>{
    setSettings(readSettings(userId))
    setOnline(previous=>Object.keys(previous).length?{}:previous);setConnected(false)
  },[userId])
  useEffect(()=>{
    if(!userId)return
    try {localStorage.setItem(`haxbag:v302:presence:${userId}`,JSON.stringify(settings))}catch{/* armazenamento restrito */}
  },[userId,settings])

  useEffect(()=>{
    if(!userId)return
    let alive=true
    let busy=false
    const refresh=async()=>{
      if(!alive||busy)return
      busy=true
      try {
        // Buscar somente pessoas de servidores em comum (não é diretório global).
        const {data:own,error:ownError}=await supabase.from('hax_v284_members').select('server_id').eq('user_id',userId).limit(100)
        if(ownError)throw ownError
        const serverIds=[...new Set((own||[]).map(m=>m.server_id).filter(Boolean))]
        if(!serverIds.length){if(alive)setOnline(previous=>Object.keys(previous).length?{}:previous);return}
        const {data:members,error:membersError}=await supabase.from('hax_v284_members').select('user_id').in('server_id',serverIds).limit(1000)
        if(membersError)throw membersError
        const ids=[...new Set((members||[]).map(m=>m.user_id).filter(Boolean))]
        if(!ids.length){if(alive)setOnline(previous=>Object.keys(previous).length?{}:previous);return}
        const cutoff=new Date(Date.now()-STALE_MS).toISOString()
        const {data:rows,error}=await supabase.from('hax_v302_presence').select('user_id,status,activity,updated_at').in('user_id',ids).gte('updated_at',cutoff).limit(1000)
        if(error)throw error
        if(!alive)return
        const next:OnlinePresenceMapV302={}
        for(const row of (rows||[]) as PresenceRow[]){
          if(row.status==='available'||row.status==='busy')next[row.user_id]={status:row.status,activity:row.activity||null}
        }
        setOnline(previous=>{
          const keys=Object.keys(next)
          if(keys.length===Object.keys(previous).length && keys.every(id=>previous[id]?.status===next[id]?.status && previous[id]?.activity===next[id]?.activity))return previous
          return next
        })
      }catch{
        if(alive){setConnected(false);setOnline(previous=>Object.keys(previous).length?{}:previous)}
      }finally{busy=false}
    }
    // Listen for verified database changes; Realtime enforces row SELECT RLS.
    const channel=supabase.channel(`hax-v302-presence-observer:${userId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'hax_v302_presence'},()=>{void refresh()})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'hax_v302_presence'},()=>{void refresh()})
      .subscribe(status=>{if(alive)setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void refresh()})
    void refresh()
    const interval=window.setInterval(()=>{void refresh()},45_000)
    const onFocus=()=>{if(!document.hidden)void refresh()}
    document.addEventListener('visibilitychange',onFocus)
    return ()=>{alive=false;window.clearInterval(interval);document.removeEventListener('visibilitychange',onFocus);void supabase.removeChannel(channel)}
  },[userId,revision])

  useEffect(()=>{
    if(!userId)return
    let cancelled=false
    const write=async()=>{
      const current=settingsRef.current
      if(current.status==='invisible'){
        const {error}=await supabase.from('hax_v302_presence').delete().eq('user_id',userId)
        if(error&& !cancelled)setConnected(false)
        return
      }
      const {error}=await supabase.from('hax_v302_presence').upsert({user_id:userId,status:current.status,activity:current.showActivity?activityRef.current:null,updated_at:new Date().toISOString()},{onConflict:'user_id'})
      if(error&&!cancelled)setConnected(false)
    }
    void write()
    const id=window.setInterval(()=>{void write()},30_000)
    const onVisibility=()=>{if(!document.hidden)void write()}
    document.addEventListener('visibilitychange',onVisibility)
    return ()=>{cancelled=true;window.clearInterval(id);document.removeEventListener('visibilitychange',onVisibility)}
  },[userId,settings.status,settings.showActivity,activity])

  return {settings,online,connected,updateSettings,refresh:()=>setRevision(v=>v+1)}
}
