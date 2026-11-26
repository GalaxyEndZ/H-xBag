import { publicHaxbagLink, DESKTOP_PUBLIC_URL_HELP } from '../desktopPublicLinks'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './CommunicationHubV284.css'
import './CommunicationHubV285.css'
import './CommunicationHubV287.css'
import './CommunicationHubV288.css'
import './CommunicationHubV289.css'
import VoiceCallV288 from './VoiceCallV288'

const TABLE = {
  servers: 'hax_v284_servers', members: 'hax_v284_members', channels: 'hax_v284_channels',
  messages: 'hax_v284_messages', reactions: 'hax_v284_reactions', invites: 'hax_v284_invites', reads: 'hax_v284_reads',
} as const
const BUCKET = 'hax-v284-communication'
const REACTIONS = ['❤️','😂','🔥','✨','👍','🎲','⚔️','👏'] as const
const MIME = ['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain']
const roleLabels: Record<string,string> = {owner:'Dono',admin:'Administrador',mod:'Moderador',member:'Membro'}
const formatTime = (date:string) => new Date(date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
const formatDate = (date:string) => new Date(date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})
const calendarDay = (date:string) => {
  const d=new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const friendlyDay = (date:string) => {
  const day = calendarDay(date)
  const today = calendarDay(new Date().toISOString())
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1)
  if (day === today) return 'Hoje'
  if (day === calendarDay(yesterday.toISOString())) return 'Ontem'
  return new Date(date).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})
}
const isImageAttachment = (name:string|null) => Boolean(name && /\.(png|jpe?g|gif|webp)$/i.test(name))
const normalizeSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim()
const friendlyError = (error:unknown) => error instanceof Error ? error.message : typeof error==='object' && error && 'message' in error ? String(error.message) : String(error)
const cleanSlug = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)

type Server = {id:string;owner_id:string;name:string;description:string;icon:string;created_at:string}
type Channel = {id:string;server_id:string;name:string;topic:string;staff_only:boolean;sort_order:number;kind?:'text'|'voice'}
type Member = {server_id:string;user_id:string;role:'owner'|'admin'|'mod'|'member';joined_at:string}
type Message = {id:string;channel_id:string;author_id:string;content:string;reply_to:string|null;attachment_path:string|null;attachment_name:string|null;is_deleted:boolean;pinned:boolean;created_at:string;edited_at:string|null}
type Reaction = {message_id:string;user_id:string;emoji:string}
type Invite = {code:string;server_id:string;expires_at:string;max_uses:number|null;uses:number;revoked:boolean}
type Profile = {id:string;username?:string|null;display_name?:string|null;avatar_url?:string|null}
type Modal = null|'create-server'|'join'|'create-channel'|'edit-channel'|'invite'|'edit-server'

type Props = {userId:string;displayName:string;username:string;onOpenDirectMessages:()=>void}

export default function CommunicationHubV284({userId,displayName,username,onOpenDirectMessages}:Props) {
  const [servers,setServers]=useState<Server[]>([])
  const [serverId,setServerId]=useState<string>('')
  const [channels,setChannels]=useState<Channel[]>([])
  const [channelId,setChannelId]=useState<string>('')
  const [members,setMembers]=useState<Member[]>([])
  const [profiles,setProfiles]=useState<Record<string,Profile>>({})
  const [messages,setMessages]=useState<Message[]>([])
  const [reactions,setReactions]=useState<Reaction[]>([])
  const [reads,setReads]=useState<Record<string,string>>({})
  const [lastActivity,setLastActivity]=useState<Record<string,string>>({})
  const [invites,setInvites]=useState<Invite[]>([])
  const [modal,setModal]=useState<Modal>(null)
  const [name,setName]=useState('')
  const [description,setDescription]=useState('')
  const [icon,setIcon]=useState('✦')
  const [privateChannel,setPrivateChannel]=useState(false)
  const [channelKind,setChannelKind]=useState<'text'|'voice'>('text')
  const [activeVoice,setActiveVoice]=useState<{id:string;serverId:string;name:string;serverName:string}|null>(null)
  const [joinCode,setJoinCode]=useState('')
  const [draft,setDraft]=useState('')
  const [file,setFile]=useState<File|null>(null)
  const [replyTo,setReplyTo]=useState<Message|null>(null)
  const [editingId,setEditingId]=useState<string|null>(null)
  const [editDraft,setEditDraft]=useState('')
  const [search,setSearch]=useState('')
  const [channelSearch,setChannelSearch]=useState('')
  const [unreadOnly,setUnreadOnly]=useState(false)
  const [memberSearch,setMemberSearch]=useState('')
  const [nearBottom,setNearBottom]=useState(true)
  const [showPinned,setShowPinned]=useState(false)
  const [showMembers,setShowMembers]=useState(false)
  const [mobileSidebar,setMobileSidebar]=useState(false)
  const [loading,setLoading]=useState(true)
  const [loadedMessagesChannelId,setLoadedMessagesChannelId]=useState('')
  const [busy,setBusy]=useState(false)
  const [sending,setSending]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [signedUrls,setSignedUrls]=useState<Record<string,string>>({})
  const scrollRef=useRef<HTMLDivElement>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const chatSearchRef=useRef<HTMLInputElement>(null)
  const channelSearchRef=useRef<HTMLInputElement>(null)
  const composerRef=useRef<HTMLTextAreaElement>(null)
  const messageCountRef=useRef<number>(0)
  const activeServerRef=useRef(serverId)
  activeServerRef.current=serverId
  const activeChannelRef=useRef(channelId)
  activeChannelRef.current=channelId
  const lastChannelRef=useRef<string>('')
  const server = useMemo(()=>servers.find(s=>s.id===serverId),[servers,serverId])
  const channel = useMemo(()=>channels.find(c=>c.id===channelId),[channels,channelId])
  const myMember = useMemo(()=>members.find(m=>m.user_id===userId),[members,userId])
  const isStaff = Boolean(myMember && ['owner','admin','mod'].includes(myMember.role))
  const isOwner = myMember?.role==='owner'
  const canManageRoles = Boolean(myMember && ['owner','admin'].includes(myMember.role))
  const accountLabel = (uid:string) => profiles[uid]?.display_name?.trim() || (uid===userId?displayName:'Aventureiro')
  const accountHandle = (uid:string) => profiles[uid]?.username?.trim() || (uid===userId?username:'usuario')
  const visibleMessages = useMemo(()=> {
    const q=search.trim().toLocaleLowerCase('pt-BR')
    return messages.filter(msg => (showPinned?msg.pinned:!msg.is_deleted) && (!q || msg.content.toLocaleLowerCase('pt-BR').includes(q) || accountLabel(msg.author_id).toLocaleLowerCase('pt-BR').includes(q) || accountHandle(msg.author_id).toLocaleLowerCase('pt-BR').includes(q)))
  },[messages,search,showPinned,profiles,displayName,username,userId])
  const unreadIds = useMemo(()=>new Set(channels.filter(c=>Boolean(lastActivity[c.id] && (!reads[c.id] || new Date(lastActivity[c.id]).getTime()>new Date(reads[c.id]).getTime()))).map(c=>c.id)),[channels,lastActivity,reads])
  const unreadCount = unreadIds.size
  const visibleChannel = (channel:Channel) => (!unreadOnly || channel.id === channelId || unreadIds.has(channel.id)) && (!normalizeSearch(channelSearch) || normalizeSearch(channel.name).includes(normalizeSearch(channelSearch)) || normalizeSearch(channel.topic).includes(normalizeSearch(channelSearch)))
  const matchesMember = (member:Member) => !normalizeSearch(memberSearch) || normalizeSearch(accountLabel(member.user_id)).includes(normalizeSearch(memberSearch)) || normalizeSearch(accountHandle(member.user_id)).includes(normalizeSearch(memberSearch))
  const showError = (e:unknown) => {setNotice('');setError(friendlyError(e))}
  const dismissMessages = () => {setError('');setNotice('')}

  useEffect(()=>{
    const onShortcut = (event:KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') {
        event.preventDefault()
        if(event.shiftKey){
          setMobileSidebar(true)
          window.requestAnimationFrame(()=>{channelSearchRef.current?.focus();channelSearchRef.current?.select()})
        } else {
          chatSearchRef.current?.focus();chatSearchRef.current?.select()
        }
      }
      if(event.key==='Escape'){
        setMobileSidebar(false)
        setShowMembers(false)
        setModal(null)
      }
    }
    window.addEventListener('keydown',onShortcut)
    return ()=>window.removeEventListener('keydown',onShortcut)
  },[])

  useEffect(()=>{setChannelSearch('');setUnreadOnly(false);setMemberSearch('')},[serverId])

  const refreshServers = useCallback(async(preferId?:string)=>{
    const {data,error:failure}=await supabase.from(TABLE.servers).select('*').order('created_at',{ascending:true})
    if(failure) throw failure
    const list=(data||[]) as Server[]
    setServers(list)
    setServerId(current => {
      if(preferId && list.some(s=>s.id===preferId))return preferId
      if(current && list.some(s=>s.id===current))return current
      return list[0]?.id||''
    })
  },[])

  useEffect(()=>{
    let alive=true
    void refreshServers().catch(e=>{if(alive)showError(e)}).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[refreshServers,userId])

  const refreshServerData=useCallback(async(sid:string)=>{
    const [chResult,memResult,inviteResult,readsResult]=await Promise.all([
      supabase.from(TABLE.channels).select('*').eq('server_id',sid).order('sort_order',{ascending:true}).order('name'),
      supabase.from(TABLE.members).select('*').eq('server_id',sid).order('joined_at'),
      supabase.from(TABLE.invites).select('code,server_id,expires_at,max_uses,uses,revoked').eq('server_id',sid).order('expires_at',{ascending:false}).limit(12),
      supabase.from(TABLE.reads).select('channel_id,read_at').eq('user_id',userId),
    ])
    if(chResult.error)throw chResult.error
    if(memResult.error)throw memResult.error
    if(activeServerRef.current!==sid)return
    const incoming=(chResult.data||[]) as Channel[]
    setChannels(incoming)
    setChannelId(current=>incoming.some(c=>c.id===current)?current:(incoming[0]?.id||''))
    const memberList=(memResult.data||[]) as Member[]
    setMembers(memberList)
    // Convites são visíveis apenas para os cargos de equipe (RLS).
    setInvites(inviteResult.error?[]:(inviteResult.data||[]) as Invite[])
    setReads(Object.fromEntries((readsResult.data||[]).map(r=>[r.channel_id,r.read_at])))
    if(incoming.length){
      const {data:recent}=await supabase.from(TABLE.messages).select('channel_id,created_at').in('channel_id',incoming.map(c=>c.id)).order('created_at',{ascending:false}).limit(500)
      const activity:Record<string,string>={}
      for(const row of recent||[]) if(!activity[row.channel_id])activity[row.channel_id]=row.created_at
      setLastActivity(activity)
    }else setLastActivity({})
    if(memberList.length){
      const ids=memberList.map(m=>m.user_id)
      let {data, error:profileError}=await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id',ids)
      if(profileError){ const backup=await supabase.from('profiles').select('id,username,display_name').in('id',ids);data=backup.data as typeof data;profileError=backup.error }
      if(activeServerRef.current!==sid)return
      if(!profileError && data)setProfiles(Object.fromEntries((data as Profile[]).map(p=>[p.id,p])))
    }
  },[userId])

  useEffect(()=>{
    if(!serverId){setChannels([]);setChannelId('');setMembers([]);setMessages([]);return}
    let current=true
    void refreshServerData(serverId).catch(e=>{if(current)showError(e)})
    const timer=window.setInterval(()=>{if(current)void refreshServerData(serverId).catch(e=>{if(current)showError(e)})},35000)
    return ()=>{current=false;window.clearInterval(timer)}
  },[serverId,refreshServerData])

  useEffect(()=>{
    if(!serverId || !channels.length)return
    const allowed=new Set(channels.map(c=>c.id))
    const realtime=supabase.channel(`hax-v284-server-activity-${serverId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:TABLE.messages},payload=>{
        const incoming=payload.new as {channel_id?:string;created_at?:string}
        if(!incoming.channel_id || !allowed.has(incoming.channel_id))return
        setLastActivity(prev=>({...prev,[incoming.channel_id!]:incoming.created_at||new Date().toISOString()}))
      }).subscribe()
    return()=>{void supabase.removeChannel(realtime)}
  },[serverId,channels.map(c=>c.id).join(',')])

  const refreshMessages=useCallback(async(cid:string)=>{
    const {data,error:failure}=await supabase.from(TABLE.messages).select('*').eq('channel_id',cid).order('created_at',{ascending:false}).limit(100)
    if(failure)throw failure
    if (activeChannelRef.current !== cid) return
    const rows=((data||[]) as Message[]).reverse()
    setMessages(rows)
    setLoadedMessagesChannelId(cid)
    if(rows.length){
      const ids=rows.map(m=>m.id)
      const reactionResult=await supabase.from(TABLE.reactions).select('message_id,user_id,emoji').in('message_id',ids)
      if(!reactionResult.error && activeChannelRef.current === cid)setReactions((reactionResult.data||[]) as Reaction[])
    }else setReactions([])
  },[])
  // Mantém as reações visíveis quando outra pessoa reage sem enviar nova mensagem.
  useEffect(()=>{
    if(!channelId || channel?.kind==='voice' || !messages.length)return
    let alive=true
    const ids=messages.map(message=>message.id)
    const polling=window.setInterval(()=>{
      if(!alive || activeChannelRef.current!==channelId)return
      void supabase.from(TABLE.reactions).select('message_id,user_id,emoji').in('message_id',ids)
        .then(({data,error:failure})=>{
          if(alive && activeChannelRef.current===channelId && !failure && data)setReactions(data as Reaction[])
        })
    },10000)
    return()=>{alive=false;window.clearInterval(polling)}
  },[channelId,channel?.kind,messages.map(m=>m.id).join(',')])

  const markRead=useCallback(async(cid:string)=>{
    const stamp=new Date().toISOString()
    const {error:failure}=await supabase.from(TABLE.reads).upsert({channel_id:cid,user_id:userId,read_at:stamp},{onConflict:'channel_id,user_id'})
    if(!failure)setReads(prev=>({...prev,[cid]:stamp}))
  },[userId])

  useEffect(()=>{
    if(!channelId || channel?.kind==='voice'){setMessages([]);setReactions([]);setLoadedMessagesChannelId('');return}
    let alive=true
    setMessages([]);setReactions([]);setLoadedMessagesChannelId('')
    setSearch('');setShowPinned(false);setReplyTo(null);setEditingId(null);setFile(null);setNearBottom(true)
    void refreshMessages(channelId).catch(e=>{if(alive)showError(e)})
    void markRead(channelId)
    const subscription=supabase.channel(`hax-v284-messages-${channelId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:TABLE.messages,filter:`channel_id=eq.${channelId}`},()=>{
        if(alive){void refreshMessages(channelId);void markRead(channelId)}
      }).subscribe()
    const polling=window.setInterval(()=>{if(alive)void refreshMessages(channelId)},12000)
    return()=>{alive=false;window.clearInterval(polling);void supabase.removeChannel(subscription)}
  },[channelId,channel?.kind,refreshMessages,markRead])

  useEffect(()=>{
    let alive=true
    const paths=Array.from(new Set(messages.map(m=>m.attachment_path).filter((p):p is string=>Boolean(p && !signedUrls[p]))))
    if(paths.length){void Promise.all(paths.map(async path=>{
      const {data}=await supabase.storage.from(BUCKET).createSignedUrl(path,3600)
      return {path,url:data?.signedUrl||''}
    })).then(items=>{if(alive)setSignedUrls(prev=>({...prev,...Object.fromEntries(items.filter(i=>i.url).map(i=>[i.path,i.url]))}))})}
    return()=>{alive=false}
  },[messages,signedUrls])

  useEffect(()=>{
    const element=scrollRef.current
    if(!element)return
    const swapped=lastChannelRef.current!==channelId
    if(swapped){lastChannelRef.current=channelId;messageCountRef.current=messages.length;element.scrollTop=element.scrollHeight;return}
    if(messages.length>messageCountRef.current){
      const nearBottom=element.scrollHeight-element.scrollTop-element.clientHeight<340
      if(nearBottom)element.scrollTop=element.scrollHeight
    }
    messageCountRef.current=messages.length
  },[messages,channelId])

  useEffect(()=>{
    const code=new URLSearchParams(window.location.search).get('hb_join')
    if(code && /^[a-f0-9]{18}$/i.test(code)){
      setJoinCode(code);setModal('join')
      const url=new URL(window.location.href);url.searchParams.delete('hb_join')
      window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash)
    }
  },[])

  async function perform(action:()=>Promise<void>){
    setBusy(true);dismissMessages()
    try{await action()}catch(e){showError(e)}finally{setBusy(false)}
  }
  function openModal(next:Modal){dismissMessages();setName('');setDescription('');setIcon('✦');setPrivateChannel(false);setChannelKind('text');setModal(next)}

  async function createServer(event:FormEvent){event.preventDefault();await perform(async()=>{
    // Evita INSERT ... RETURNING: antes de o trigger cadastrar o proprietário
    // como membro, a política SELECT baseada em participação pode bloquear
    // a leitura do registro recém-criado na mesma instrução SQL.
    const newServerId=crypto.randomUUID()
    const {error:failure}=await supabase.from(TABLE.servers).insert({
      id:newServerId,owner_id:userId,name:name.trim(),description:description.trim(),icon:icon.trim()||'✦',
    })
    if(failure)throw failure
    await refreshServers(newServerId);setModal(null);setNotice('Servidor criado! Os canais #geral e #avisos já estão disponíveis.')
  })}
  async function join(event:FormEvent){event.preventDefault();await perform(async()=>{
    const code=joinCode.trim().replace(/^.*(?:hb_join=|\/convite\/)/,'').split(/[&#?]/)[0].toLowerCase()
    const {data,error:failure}=await supabase.rpc('hax_v284_join_invite',{p_code:code})
    if(failure)throw failure
    await refreshServers(String(data));setModal(null);setJoinCode('');setNotice('Você entrou no servidor!')
  })}
  async function createChannel(event:FormEvent){event.preventDefault();if(!serverId)return
    await perform(async()=>{
      const slug=cleanSlug(name.trim())
      if(slug.length<2)throw new Error('O nome do canal precisa ter pelo menos 2 caracteres.')
      // Gerar o UUID no cliente e evitar INSERT ... RETURNING.
      // A leitura do canal recém-inserido é protegida por RLS; a migração V289
      // usa permissões por servidor, sem consultar a própria linha sendo criada.
      const createdId=crypto.randomUUID()
      const {error:failure}=await supabase.from(TABLE.channels).insert({id:createdId,server_id:serverId,name:slug,topic:description.trim(),staff_only:privateChannel,kind:channelKind,sort_order:channels.length})
      if(failure)throw failure
      setChannelSearch('');setUnreadOnly(false)
      await refreshServerData(serverId)
      setChannelId(createdId);setModal(null);setNotice(`Canal ${channelKind==='voice'?'de voz':'de texto'} #${slug} criado.`)
    })
  }
  async function editChannel(event:FormEvent){event.preventDefault();if(!channel||!isStaff)return
    await perform(async()=>{
      const slug=cleanSlug(name.trim())
      if(slug.length<2)throw new Error('O nome do canal precisa ter pelo menos 2 caracteres.')
      const {error:failure}=await supabase.from(TABLE.channels).update({name:slug,topic:description.trim(),staff_only:privateChannel}).eq('id',channel.id).eq('server_id',serverId)
      if(failure)throw failure
      await refreshServerData(serverId);setModal(null);setNotice(`Canal #${slug} atualizado.`)
    })
  }
  function openChannelSettings(){
    if(!channel||!isStaff)return
    dismissMessages();setName(channel.name);setDescription(channel.topic);setPrivateChannel(channel.staff_only);setModal('edit-channel')
  }
  async function editServer(event:FormEvent){event.preventDefault();if(!serverId)return
    await perform(async()=>{
      const {error:failure}=await supabase.from(TABLE.servers).update({name:name.trim(),description:description.trim(),icon:icon.trim()||'✦'}).eq('id',serverId)
      if(failure)throw failure
      await refreshServers(serverId);setModal(null);setNotice('Servidor atualizado.')
    })
  }
  async function makeInvite(){if(!serverId)return;await perform(async()=>{
    const {data,error:failure}=await supabase.from(TABLE.invites).insert({server_id:serverId,created_by:userId}).select('code,server_id,expires_at,max_uses,uses,revoked').single()
    if(failure)throw failure
    setInvites(prev=>[data as Invite,...prev]);setNotice('Convite de 7 dias criado.')
  })}
  async function revokeInvite(code:string){await perform(async()=>{
    const {error:failure}=await supabase.rpc('hax_v284_revoke_invite',{p_code:code})
    if(failure)throw failure
    setInvites(prev=>prev.map(i=>i.code===code?{...i,revoked:true}:i));setNotice('Convite revogado.')
  })}
  async function copyInvite(code:string){
    const url=publicHaxbagLink({hb_page:'communication',hb_join:code})
    if(!url){setNotice(`Código do convite: ${code}. ${DESKTOP_PUBLIC_URL_HELP}`);return}
    try{await navigator.clipboard.writeText(url);setNotice('Link de convite copiado.')}catch{setNotice(`Código do convite: ${code}`)}
  }
  async function updateRole(target:Member,role:string){if(!serverId||target.user_id===userId)return;await perform(async()=>{
    const {error:failure}=await supabase.rpc('hax_v284_set_role',{p_server:serverId,p_user:target.user_id,p_role:role})
    if(failure)throw failure
    await refreshServerData(serverId);setNotice('Cargo atualizado.')
  })}
  async function kickMember(target:Member){
    if(!serverId || !window.confirm(`Remover ${accountLabel(target.user_id)} deste servidor?`))return
    await perform(async()=>{
      const {error:failure}=await supabase.rpc('hax_v284_kick_member',{p_server:serverId,p_user:target.user_id})
      if(failure)throw failure
      await refreshServerData(serverId);setNotice('Membro removido do servidor.')
    })
  }
  async function leaveServer(){if(!serverId || !window.confirm('Deseja sair deste servidor?'))return;await perform(async()=>{
    const {error:failure}=await supabase.from(TABLE.members).delete().eq('server_id',serverId).eq('user_id',userId)
    if(failure)throw failure
    await refreshServers();setNotice('Você saiu do servidor.')
  })}
  async function deleteServer(){if(!serverId || !isOwner||!window.confirm(`Excluir definitivamente o servidor “${server?.name}” e suas mensagens?`))return;await perform(async()=>{
    const {error:failure}=await supabase.from(TABLE.servers).delete().eq('id',serverId)
    if(failure)throw failure
    await refreshServers();setNotice('Servidor excluído.')
  })}
  async function removeChannel(){if(!channel||!isStaff||!window.confirm(`Excluir #${channel.name} e todas as suas mensagens?`))return;await perform(async()=>{
    const {error:failure}=await supabase.from(TABLE.channels).delete().eq('id',channel.id)
    if(failure)throw failure
    await refreshServerData(serverId);setModal(null);setNotice('Canal excluído.')
  })}
  function selectFile(event:ChangeEvent<HTMLInputElement>){
    const selected=event.target.files?.[0]||null
    if(selected && (selected.size>8*1024*1024 || !MIME.includes(selected.type))){setFile(null);showError('Use uma imagem, PDF ou TXT de até 8 MB.');return}
    setFile(selected)
  }
  async function sendMessage(event?:FormEvent){
    event?.preventDefault();if(!channelId||(!draft.trim()&&!file)||sending)return
    setSending(true);dismissMessages()
    let path:string|null=null
    try{
      if(file){
        const ext=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').slice(0,8).toLowerCase()
        path=`${serverId}/${channelId}/${userId}/${crypto.randomUUID()}.${ext}`
        const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false})
        if(uploadError)throw uploadError
      }
      const {error:failure}=await supabase.from(TABLE.messages).insert({channel_id:channelId,author_id:userId,content:draft.trim(),reply_to:replyTo?.id||null,attachment_path:path,attachment_name:file?.name.slice(0,200)||null})
      if(failure)throw failure
      setDraft('');setReplyTo(null);setFile(null)
      if(fileRef.current)fileRef.current.value=''
      await refreshMessages(channelId);await markRead(channelId)
    }catch(e){
      if(path)void supabase.storage.from(BUCKET).remove([path])
      showError(e)
    }finally{setSending(false)}
  }
  async function editMessage(message:Message){
    if(!editDraft.trim())return
    await perform(async()=>{
      const {error:failure}=await supabase.from(TABLE.messages).update({content:editDraft.trim()}).eq('id',message.id)
      if(failure)throw failure
      setEditingId(null);await refreshMessages(channelId)
    })
  }
  async function deleteMessage(message:Message){if(!window.confirm('Apagar esta mensagem?'))return;await perform(async()=>{
    const {error:failure}=await supabase.from(TABLE.messages).update({is_deleted:true}).eq('id',message.id)
    if(failure)throw failure
    await refreshMessages(channelId)
  })}
  async function pinMessage(message:Message){await perform(async()=>{
    const {error:failure}=await supabase.from(TABLE.messages).update({pinned:!message.pinned}).eq('id',message.id)
    if(failure)throw failure
    await refreshMessages(channelId)
  })}
  async function react(message:Message,emoji:string){
    const mine=reactions.some(r=>r.message_id===message.id&&r.user_id===userId&&r.emoji===emoji)
    const query=supabase.from(TABLE.reactions)
    const {error:failure}=mine ? await query.delete().eq('message_id',message.id).eq('user_id',userId).eq('emoji',emoji)
      :await query.insert({message_id:message.id,user_id:userId,emoji})
    if(failure)showError(failure)
    else {const {data}=await supabase.from(TABLE.reactions).select('message_id,user_id,emoji').in('message_id',messages.map(m=>m.id));if(data)setReactions(data as Reaction[])}
  }
  const handleComposerKey=(event:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void sendMessage()}
  }
  const textChannels=channels.filter(c=>c.kind!=='voice'&&!c.staff_only)
  const staffChannels=channels.filter(c=>c.kind!=='voice'&&c.staff_only)
  const voiceChannels=channels.filter(c=>c.kind==='voice'&&!c.staff_only)
  const staffVoiceChannels=channels.filter(c=>c.kind==='voice'&&c.staff_only)
  const selectedReply = (message:Message) => messages.find(m=>m.id===message.reply_to)
  const focusComposer = () => { window.requestAnimationFrame(()=>composerRef.current?.focus()) }
  const scrollToRecent = () => scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})

  return <section className="hb-communication hb-communication-v287" id="hb-communication" aria-labelledby="hb-communication-title">
    <header className="hb-comm-hero hb-comm-hero-v285">
      <div className="hb-comm-hero-copy"><span className="hb-comm-eyebrow"><span className="hb-comm-live-dot" aria-hidden="true"/> HÄXBAG / SEU ESPAÇO SOCIAL</span><h1 id="hb-communication-title">Comunicação<span className="hb-comm-title-star">✦</span></h1><p>Suas pessoas, seus servidores, suas histórias — tudo em um só lugar.</p></div>
      <div className="hb-comm-hero-right">
        <div className="hb-comm-overview" aria-label="Resumo da comunicação"><div><strong>{servers.length}</strong><small>{servers.length===1?'servidor':'servidores'}</small></div><span/><div><strong>{members.length}</strong><small>{server?'membros no grupo':'membros'}</small></div><span/><div><strong>{channels.filter(c=>c.kind==='voice').length}</strong><small>salas de voz</small></div></div>
        <div className="hb-comm-hero-actions"><button type="button" className="hb-comm-subtle" onClick={onOpenDirectMessages}>✉ <span>Mensagens privadas</span></button><button type="button" className="hb-comm-primary" onClick={()=>openModal('create-server')}>＋ Criar servidor</button></div>
      </div>
    </header>
    {error&&<div className="hb-comm-banner hb-comm-banner--error" role="alert"><span>{/(?:does not exist|schema cache|PGRST205|42P01)/i.test(error)?'A tabela da Comunicação não foi encontrada. Confira a migração SQL V284 no Supabase. ':/row.level security policy.*hax_v284_servers|hax_v284_servers.*row.level security policy/i.test(error)?'A política de criação de servidores foi bloqueada. Execute o reparo RLS V286 no Supabase. ':/row.level security policy.*hax_v284_channels|hax_v284_channels.*row.level security policy/i.test(error)?'O Supabase bloqueou um canal. Execute HAXBAG_REPARO_CANAIS_RLS_V289.sql e tente novamente. ':/row.level security policy|permission denied/i.test(error)?'A política de segurança do banco recusou esta operação. ':''}{error}</span><button type="button" aria-label="Dispensar aviso" onClick={()=>setError('')}>×</button></div>}
    {notice&&<div className="hb-comm-banner" role="status"><span>{notice}</span><button type="button" aria-label="Dispensar aviso" onClick={()=>setNotice('')}>×</button></div>}
    <nav className="hb-comm-context-v287" aria-label="Atalhos da Comunicação">
      <div className="hb-comm-context-location-v287">
        <span className="hb-comm-context-symbol-v287" aria-hidden="true">{server?.icon || '✦'}</span>
        <span className="hb-comm-context-copy-v287"><small className="hb-comm-context-eyebrow-v287">{server ? 'VOCÊ ESTÁ EM' : 'SEU ESPAÇO'}</small><small className="hb-comm-context-mobile-label-v287">{server?.name || 'Comunicação'}</small><strong><span className="hb-comm-context-server-v287">{server?.name || 'Comunicação'}</span><span className="hb-comm-context-separator-v287" aria-hidden="true"> / </span><em>{channel ? `${channel.kind==='voice'?'◉':'#'}${channel.name}` : 'Servidores e canais'}</em></strong></span>
      </div>
      <div className="hb-comm-context-actions-v287">
        <button type="button" onClick={() => {setMobileSidebar(true);window.requestAnimationFrame(()=>channelSearchRef.current?.focus())}} title="Encontrar um canal"><span aria-hidden="true">⌕</span> Canais</button>
        {channel && channel.kind!=='voice' && <button type="button" onClick={focusComposer} title="Escrever uma mensagem"><span aria-hidden="true">✎</span> Escrever</button>}
        {server && isStaff && <button type="button" onClick={() => openModal('invite')} title="Convidar participantes"><span aria-hidden="true">✧</span> Convidar</button>}
      </div>
    </nav>
    <div className={`hb-comm-shell hb-comm-shell-v285 hb-comm-shell-v287${mobileSidebar?' hb-comm-shell--show-nav':''}${showMembers?' hb-comm-shell--show-members':''}`}>
      <aside className="hb-comm-servers" aria-label="Seus servidores">
        <span className="hb-comm-rail-label">SERVIDORES</span>
        {servers.map(s=><button key={s.id} className={`hb-comm-server-icon${serverId===s.id?' active':''}`} type="button" aria-label={`Servidor ${s.name}`} title={s.name} aria-pressed={serverId===s.id} onClick={()=>{setServerId(s.id);setMobileSidebar(true)}}><span>{s.icon||s.name[0]}</span>{serverId===s.id&&<i aria-hidden="true" className="hb-comm-rail-active"/>}</button>)}
        <div className="hb-comm-rail-divider" aria-hidden="true"/><button className="hb-comm-server-add" type="button" title="Criar servidor" aria-label="Criar servidor" onClick={()=>openModal('create-server')}>＋</button>
        <button className="hb-comm-server-join" type="button" title="Entrar por convite" aria-label="Entrar por convite" onClick={()=>openModal('join')}>↗</button>
        <span className="hb-comm-rail-spacer"/>
        <button className="hb-comm-server-dm" type="button" title="Mensagens privadas" onClick={onOpenDirectMessages}>✉</button>
      </aside>
      <aside id="hb-comm-channel-sidebar" className="hb-comm-channels" aria-label="Canais do servidor">
        <div className="hb-comm-server-heading"><div><small>ESPAÇO ATUAL</small><h2>{server?.name||'Comunicação'}</h2></div>{server&&<span className="hb-comm-server-heading-icon" aria-hidden="true">{server.icon||'✦'}</span>}</div>
        {server?<>
          <div className="hb-comm-server-description">{server.description||'Converse e organize suas aventuras com seu grupo.'}</div>
          <div className="hb-comm-channel-tools-v285">
            <label className="hb-comm-channel-search-v285"><span aria-hidden="true">⌕</span><input ref={channelSearchRef} type="search" value={channelSearch} onChange={event=>setChannelSearch(event.target.value)} placeholder="Buscar canais" aria-label="Filtrar canais" title="Atalho Ctrl+Shift+K"/>{channelSearch&&<button type="button" onClick={()=>setChannelSearch('')} aria-label="Limpar filtro de canais">×</button>}</label>
            <button type="button" className={`hb-comm-channel-unread-v285${unreadOnly?' active':''}`} aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(value=>!value)}><span aria-hidden="true">◉</span> Não lidos <strong>{unreadCount}</strong></button>
          </div>
          <div className="hb-comm-channel-heading"><span>CANAIS DE TEXTO <span className="hb-comm-channel-count-v289">{textChannels.length+(isStaff?staffChannels.length:0)}</span></span>{isStaff&&<button type="button" onClick={()=>openModal('create-channel')} aria-label="Criar canal">＋</button>}</div>
          {textChannels.filter(visibleChannel).map(c=><button key={c.id} type="button" className={`hb-comm-channel${channelId===c.id?' active':''}`} onClick={()=>{setChannelId(c.id);setMobileSidebar(false)}}><span>#</span><span>{c.name}</span>{unreadIds.has(c.id)&&c.id!==channelId&&<i className="hb-comm-unread-dot" aria-label="Não lido"/>}</button>)}
          {isStaff&&staffChannels.length>0&&<><div className="hb-comm-channel-heading"><span>EQUIPE · PRIVADO</span><span>⌁</span></div>{staffChannels.filter(visibleChannel).map(c=><button key={c.id} type="button" className={`hb-comm-channel${channelId===c.id?' active':''}`} onClick={()=>{setChannelId(c.id);setMobileSidebar(false)}}><span>♙</span><span>{c.name}</span>{unreadIds.has(c.id)&&c.id!==channelId&&<i className="hb-comm-unread-dot" aria-label="Não lido"/>}</button>)}</>}
          <div className="hb-comm-channel-heading hb-comm-voice-group-title-v288"><span>◉ SALAS DE VOZ <span className="hb-comm-channel-count-v289">{voiceChannels.length+(isStaff?staffVoiceChannels.length:0)}</span></span>{isStaff&&<button type="button" onClick={()=>{openModal('create-channel');setChannelKind('voice')}} aria-label="Criar canal de voz">＋</button>}</div>
          {voiceChannels.filter(visibleChannel).map(c=><button key={c.id} type="button" className={`hb-comm-channel hb-comm-voice-channel-v288${channelId===c.id?' active':''}${activeVoice?.id===c.id?' in-call':''}`} aria-label={`Canal de voz ${c.name}`} onClick={()=>{setChannelId(c.id);setMobileSidebar(false)}}><span className="hb-comm-voice-channel-icon-v288">♫</span><span>{c.name}</span>{activeVoice?.id===c.id&&<i className="hb-comm-voice-live-v288" title="Você está nesta chamada"/>}</button>)}
          {isStaff&&staffVoiceChannels.length>0&&<><div className="hb-comm-channel-heading"><span>◉ VOZ · EQUIPE</span></div>{staffVoiceChannels.filter(visibleChannel).map(c=><button key={c.id} type="button" className={`hb-comm-channel hb-comm-voice-channel-v288${channelId===c.id?' active':''}${activeVoice?.id===c.id?' in-call':''}`} onClick={()=>{setChannelId(c.id);setMobileSidebar(false)}}><span className="hb-comm-voice-channel-icon-v288">♬</span><span>{c.name}</span></button>)}</>}
          {!textChannels.some(visibleChannel)&&!(isStaff&&staffChannels.some(visibleChannel))&&!voiceChannels.some(visibleChannel)&&!(isStaff&&staffVoiceChannels.some(visibleChannel))&&<div className="hb-comm-channels-empty-v285">{unreadOnly?'Não há canais não lidos.':'Nenhum canal corresponde à busca.'}</div>}
          <div className="hb-comm-sidebar-actions-v285">
          {isStaff&&<button className="hb-comm-sidebar-action" type="button" onClick={()=>openModal('invite')}>✧ Convidar pessoas</button>}
          {isOwner&&<button className="hb-comm-sidebar-action" type="button" onClick={()=>{setName(server.name);setDescription(server.description);setIcon(server.icon);setModal('edit-server')}}>⚙ Configurar servidor</button>}
          {!isOwner&&<button className="hb-comm-sidebar-action hb-comm-text-danger" type="button" onClick={()=>void leaveServer()}>↩ Sair do servidor</button>}
          </div>
        </>:<div className="hb-comm-sidebar-empty">Selecione um servidor ou crie o primeiro.</div>}
        <div className="hb-comm-self"><span className="hb-comm-avatar">{displayName.slice(0,1).toUpperCase()}</span><span><strong>{displayName}</strong><small>@{username||'aventureiro'}</small></span><span className="hb-comm-self-status" title="Conectado"/></div>
      </aside>
      {mobileSidebar&&<button type="button" className="hb-comm-mobile-shade-v285" aria-label="Fechar lista de canais" onClick={()=>setMobileSidebar(false)}/>}
      <main className="hb-comm-main">
        {server&&channel?<>
          {channel.kind==='voice'?<div className="hb-comm-voice-stage-v288">
            <header className="hb-comm-voice-stage-head-v288"><button type="button" className="hb-comm-nav-mobile" aria-label="Abrir canais" onClick={()=>setMobileSidebar(true)}>☰</button><span aria-hidden="true">♫</span><div><strong>{channel.name}</strong><small>Canal de voz · {server.name}{channel.staff_only?' · somente equipe':''}</small></div>{isStaff&&<button type="button" className="hb-comm-voice-stage-settings-v288" onClick={openChannelSettings}>⚙ Configurar</button>}</header>
            <div className="hb-comm-voice-stage-landing-v288"><div className="hb-comm-voice-stage-art-v288" aria-hidden="true"><span>♫</span><i/><i/></div><span className="hb-comm-voice-stage-eyebrow-v288">SALA DE ÁUDIO</span><h2>{channel.name}</h2><p>{channel.topic || 'Entre para conversar com seus amigos por áudio. O microfone só será ativado quando você entrar na chamada.'}</p><div className="hb-comm-voice-stage-features-v288"><span>◉ Chamada ao vivo</span><span>🎙 Controles de microfone</span><span>♫ Áudio entre participantes</span></div>
            {activeVoice?.id===channel.id?<div className="hb-comm-voice-stage-connected-v288">Você está nesta chamada. Use o painel de áudio para controlar o microfone ou sair.</div>:<button type="button" className="hb-comm-primary hb-comm-voice-join-v288" onClick={()=>setActiveVoice({id:channel.id,serverId:server.id,name:channel.name,serverName:server.name})}>🎙 Entrar na chamada</button>}
            <small className="hb-comm-voice-stage-hint-v288">Requer HTTPS, permissão do microfone e SQL V288. Em redes restritivas poderá ser necessário um servidor TURN.</small></div>
          </div>:<>
          <div className="hb-comm-chat-head hb-comm-chat-head-v285">
            <button type="button" className="hb-comm-nav-mobile" aria-label={mobileSidebar?'Fechar lista de canais':'Abrir lista de canais'} aria-controls="hb-comm-channel-sidebar" aria-expanded={mobileSidebar} onClick={()=>setMobileSidebar(value=>!value)}>☰</button>
            <span className="hb-comm-hash" aria-hidden="true">{channel.staff_only?'♙':'#'}</span>
            <div className="hb-comm-chat-title"><div className="hb-comm-chat-name-v285"><strong>{channel.name}</strong>{channel.staff_only&&<span>Equipe</span>}</div><small>{channel.topic||'Converse, compartilhe e planeje com seu grupo.'}</small></div>
            <div className="hb-comm-chat-controls"><button type="button" className={showPinned?'selected':''} aria-pressed={showPinned} title="Mostrar mensagens fixadas" aria-label="Mostrar mensagens fixadas" onClick={()=>setShowPinned(v=>!v)}>⌁ <span>Fixadas</span></button><button type="button" className={showMembers?'selected':''} aria-pressed={showMembers} title="Abrir lista de membros" aria-label={showMembers?'Fechar lista de membros':'Abrir lista de membros'} onClick={()=>setShowMembers(v=>!v)}>♧ <span>{members.length} membros</span></button>{isStaff&&<button type="button" title="Configurar canal" aria-label="Configurar canal" onClick={openChannelSettings}>⚙</button>}</div>
          </div>
          <div className="hb-comm-chat-tools-v285"><div className="hb-comm-chat-crumb-v285"><span>{server?.name}</span><span aria-hidden="true">/</span><strong>#{channel.name}</strong><span className="hb-comm-chat-total-v287">{search ? `${visibleMessages.length} resultado(s)` : `${messages.length} mensagens recentes`}</span></div><label className="hb-comm-searchbar"><span aria-hidden="true">⌕</span><input ref={chatSearchRef} aria-label="Buscar mensagens carregadas" title="Atalho Ctrl+K" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nas mensagens…"/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="Limpar pesquisa">×</button>}<kbd>Ctrl K</kbd></label></div>
          <div ref={scrollRef} onScroll={event=>{const element=event.currentTarget;setNearBottom(element.scrollHeight-element.scrollTop-element.clientHeight<190)}} className="hb-comm-message-scroll" role="log" aria-label={`Mensagens do canal ${channel.name}`} aria-live="off">
            <div className={`hb-comm-channel-welcome${messages.length?' hb-comm-channel-welcome--has-messages-v289':''}`}><div className="hb-comm-welcome-icon">{channel.staff_only?'♙':'#'}</div><span className="hb-comm-welcome-eyebrow-v287">{channel.staff_only?'CANAL PRIVADO':'CANAL DE TEXTO'}</span><h2>Bem-vindo a #{channel.name}</h2><p>{channel.topic||'Este é o começo da conversa. Compartilhe ideias, organize sessões e mantenha seu grupo conectado.'}</p>{!messages.length&&!search&&!showPinned&&<button type="button" className="hb-comm-welcome-cta-v287" onClick={focusComposer}>✎ Escrever primeira mensagem</button>}</div>
            {loadedMessagesChannelId!==channelId&&<div className="hb-comm-loading-messages-v289" role="status"><span className="hb-comm-loading-dot-v289"/> Carregando mensagens deste canal…</div>}
            {loadedMessagesChannelId===channelId&&visibleMessages.length===0&&<div className="hb-comm-message-empty">{showPinned?'Nenhuma mensagem fixada neste canal.':search?'Nenhuma mensagem encontrada entre as mais recentes.':'Ainda não há mensagens. Inicie a conversa!'}</div>}
            {(loadedMessagesChannelId===channelId?visibleMessages:[]).map((msg,index)=>{
              const mine=msg.author_id===userId,staffCanModerate=isStaff
              const grouped=reactions.filter(r=>r.message_id===msg.id).reduce<Record<string,{count:number,mine:boolean}>>((acc,r)=>{const item=acc[r.emoji]||{count:0,mine:false};item.count++;if(r.user_id===userId)item.mine=true;acc[r.emoji]=item;return acc},{})
              const reply=msg.reply_to?selectedReply(msg):null
              const previous=visibleMessages[index-1]
              const newDay=!previous || calendarDay(previous.created_at)!==calendarDay(msg.created_at)
              const compact=Boolean(!newDay && previous && previous.author_id===msg.author_id && !msg.pinned && !previous.pinned && (new Date(msg.created_at).getTime()-new Date(previous.created_at).getTime()) < 5*60*1000)
              return <Fragment key={msg.id}>{newDay&&<div className="hb-comm-date-divider-v285"><span>{friendlyDay(msg.created_at)}</span></div>}<article className={`hb-comm-message${compact?' hb-comm-message--compact-v285':''}${mine?' hb-comm-message--own':''}${msg.pinned?' hb-comm-message--pinned':''}`}>
                <div className="hb-comm-message-avatar" aria-hidden="true">{profiles[msg.author_id]?.avatar_url?<img src={profiles[msg.author_id].avatar_url||''} alt="" loading="lazy" referrerPolicy="no-referrer"/>:accountLabel(msg.author_id).slice(0,1).toUpperCase()}</div>
                <div className="hb-comm-message-body"><div className="hb-comm-message-meta">{!compact&&<><strong>{accountLabel(msg.author_id)}</strong><small>@{accountHandle(msg.author_id)}</small></>}<time dateTime={msg.created_at} title={new Date(msg.created_at).toLocaleString('pt-BR')}>{formatTime(msg.created_at)}</time>{msg.edited_at&&<small>editado</small>}{msg.pinned&&<span className="hb-comm-pinned-tag">⌁ Fixada</span>}</div>
                  {reply&&<button className="hb-comm-reply-preview" type="button" onClick={()=>document.getElementById(`hb-message-${reply.id}`)?.scrollIntoView({block:'center',behavior:'smooth'})}>↳ {accountLabel(reply.author_id)}: {reply.content.slice(0,90)||'Anexo'}</button>}
                  <div id={`hb-message-${msg.id}`} className="hb-comm-message-content">{msg.is_deleted?<em>Mensagem excluída</em>:editingId===msg.id?<div className="hb-comm-inline-edit"><textarea autoFocus maxLength={4000} value={editDraft} onChange={e=>setEditDraft(e.target.value)}/><div><button type="button" onClick={()=>{setEditingId(null);setEditDraft('')}}>Cancelar</button><button type="button" disabled={!editDraft.trim()||busy} onClick={()=>void editMessage(msg)}>Salvar</button></div></div>:msg.content}</div>
                  {!msg.is_deleted&&msg.attachment_path&&<div className="hb-comm-attachment">{signedUrls[msg.attachment_path]?<>{isImageAttachment(msg.attachment_name)&&<a className="hb-comm-attachment-image-v285" href={signedUrls[msg.attachment_path]} target="_blank" rel="noopener noreferrer" aria-label={`Abrir imagem ${msg.attachment_name||'anexada'}`}><img src={signedUrls[msg.attachment_path]} loading="lazy" alt={msg.attachment_name||'Imagem anexada'} referrerPolicy="no-referrer"/></a>}<a className="hb-comm-attachment-file-v285" href={signedUrls[msg.attachment_path]} target="_blank" rel="noopener noreferrer" download={msg.attachment_name||undefined}>▧ <span>{msg.attachment_name||'Anexo'}</span><span aria-hidden="true">↗</span></a></>:<span>▧ Preparando anexo…</span>}</div>}
                  {!msg.is_deleted&&<><div className="hb-comm-reactions">{Object.entries(grouped).map(([emoji,r])=><button type="button" key={emoji} className={r.mine?'active':''} aria-pressed={r.mine} onClick={()=>void react(msg,emoji)}>{emoji} <strong>{r.count}</strong></button>)}<details><summary title="Adicionar reação" aria-label="Adicionar reação">＋</summary><div className="hb-comm-emoji-menu">{REACTIONS.map(emoji=><button key={emoji} type="button" onClick={e=>{void react(msg,emoji);(e.currentTarget.closest('details') as HTMLDetailsElement)?.removeAttribute('open')}}>{emoji}</button>)}</div></details></div>
                  <div className="hb-comm-message-actions"><button type="button" onClick={()=>{setReplyTo(msg);setShowPinned(false);focusComposer()}}>↳ Responder</button><button type="button" onClick={()=>{void navigator.clipboard.writeText(msg.content).then(()=>setNotice('Mensagem copiada.')).catch(()=>showError('Não foi possível copiar a mensagem.'))}}>⧉ Copiar</button>{mine&&<button type="button" onClick={()=>{setEditingId(msg.id);setEditDraft(msg.content)}}>✎ Editar</button>}{staffCanModerate&&<button type="button" onClick={()=>void pinMessage(msg)}>{msg.pinned?'Desafixar':'⌁ Fixar'}</button>}{(mine||staffCanModerate)&&<button type="button" className="hb-comm-text-danger" onClick={()=>void deleteMessage(msg)}>Excluir</button>}</div></>}
                </div>
              </article></Fragment>
            })}
          </div>
          {!nearBottom&&messages.length>0&&!showPinned&&!search&&<button type="button" className="hb-comm-jump-latest-v285" onClick={scrollToRecent}>↓ Mensagens recentes</button>}
          {showPinned&&<div className="hb-comm-mode-banner">⌁ Visualizando mensagens fixadas. <button type="button" onClick={()=>setShowPinned(false)}>Voltar às mensagens</button></div>}
          <div className="hb-comm-composer-wrap">
            {replyTo&&<div className="hb-comm-compose-reply">↳ Respondendo a <strong>{accountLabel(replyTo.author_id)}</strong><small>{replyTo.content.slice(0,110)}</small><button type="button" onClick={()=>setReplyTo(null)}>×</button></div>}
            {file&&<div className="hb-comm-compose-file">▧ {file.name} · {(file.size/1024/1024).toFixed(1)} MB <button type="button" onClick={()=>{setFile(null);if(fileRef.current)fileRef.current.value=''}}>×</button></div>}
            <form className="hb-comm-composer" onSubmit={e=>void sendMessage(e)}><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain" onChange={selectFile} hidden aria-label="Escolher anexo"/><button type="button" className="hb-comm-composer-attach" aria-label="Anexar imagem ou documento" title="Anexar até 8 MB" onClick={()=>fileRef.current?.click()}>＋</button><textarea ref={composerRef} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={handleComposerKey} maxLength={4000} rows={2} placeholder={`Mensagem para #${channel.name}`} aria-label="Escrever mensagem"/><button type="submit" className="hb-comm-send" disabled={sending||(!draft.trim()&&!file)} aria-label="Enviar mensagem">{sending?'…':'➤'}</button></form>
            <div className="hb-comm-composer-foot-v285"><small>Enter envia <span>·</span> Shift+Enter quebra linha <span>·</span> Anexos até 8 MB</small><strong aria-label={`${draft.length} de 4000 caracteres`}>{draft.length}<span>/4000</span></strong></div>
          </div>
          </>}
        </>:<div className="hb-comm-start"><div className="hb-comm-start-symbol">✦</div><span>COMUNICAÇÃO HÄXBAG</span><h2>{loading?'Carregando seus servidores…':server?'Este servidor ainda não tem canais disponíveis.':'Um universo de conversas começa aqui.'}</h2><p>Crie seu espaço para reunir o grupo de RPG ou entre usando o convite de outro aventureiro.</p><div><button type="button" className="hb-comm-primary" onClick={()=>openModal('create-server')}>＋ Criar servidor</button><button type="button" className="hb-comm-subtle" onClick={()=>openModal('join')}>↗ Entrar com convite</button></div></div>}
        {activeVoice&&<VoiceCallV288 key={activeVoice.id} room={activeVoice} userId={userId} label={displayName} compact={channel?.id!==activeVoice.id} onLeave={()=>setActiveVoice(null)}/>}
      </main>
      {server&&showMembers&&<><button type="button" className="hb-comm-members-shade-v285" aria-label="Fechar lista de membros" onClick={()=>setShowMembers(false)}/><aside className="hb-comm-members" aria-label="Membros do servidor"><div className="hb-comm-members-title"><strong>MEMBROS</strong><span>{members.length}</span><button type="button" onClick={()=>setShowMembers(false)} aria-label="Fechar lista de membros">×</button></div><label className="hb-comm-member-search-v285"><span aria-hidden="true">⌕</span><input type="search" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Encontrar membro..." aria-label="Filtrar membros"/></label>{(['owner','admin','mod','member'] as const).map(role=>{const group=members.filter(m=>m.role===role&&matchesMember(m));return group.length?<div key={role} className="hb-comm-member-group"><div>{roleLabels[role].toUpperCase()} · {group.length}</div>{group.map(member=><div key={member.user_id} className="hb-comm-member"><div className="hb-comm-member-avatar">{profiles[member.user_id]?.avatar_url?<img src={profiles[member.user_id].avatar_url||''} alt="" loading="lazy" referrerPolicy="no-referrer"/>:accountLabel(member.user_id)[0]?.toUpperCase()}</div><div><strong>{accountLabel(member.user_id)}</strong><small>@{accountHandle(member.user_id)}</small></div>{canManageRoles&&member.role!=='owner'&&member.user_id!==userId&&(isOwner||member.role!=='admin')&&<select aria-label={`Cargo de ${accountLabel(member.user_id)}`} value={member.role} disabled={busy} onChange={event=>void updateRole(member,event.target.value)}><option value="member">Membro</option><option value="mod">Moderador</option>{isOwner&&<option value="admin">Admin</option>}</select>}{isStaff&&member.role!=='owner'&&member.user_id!==userId&&(isOwner||(myMember?.role==='admin'&&member.role!=='admin')||(myMember?.role==='mod'&&member.role==='member'))&&<button className="hb-comm-member-kick" type="button" title={`Remover ${accountLabel(member.user_id)}`} aria-label={`Remover ${accountLabel(member.user_id)}`} disabled={busy} onClick={()=>void kickMember(member)}>×</button>}</div>)}</div>:null})}{!members.some(matchesMember)&&<div className="hb-comm-members-empty-v285">Nenhum membro encontrado.</div>}</aside></>}
    </div>
    <footer className="hb-comm-footer"><span>✦ Conversas protegidas por permissões de servidor · <kbd>Ctrl K</kbd> buscar mensagens · <kbd>Ctrl Shift K</kbd> buscar canais.</span><button type="button" onClick={onOpenDirectMessages}>Abrir mensagens privadas →</button></footer>
    {modal&&<div className="hb-comm-modal-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setModal(null)}}><div className="hb-comm-modal" role="dialog" aria-modal="true" aria-labelledby="hb-comm-modal-title"><header><div><small>HÄXBAG · COMUNICAÇÃO</small><h2 id="hb-comm-modal-title">{{'create-server':'Criar servidor',join:'Entrar em servidor','create-channel':'Novo canal','edit-channel':'Configurar canal',invite:'Convites do servidor','edit-server':'Configurar servidor'}[modal]}</h2></div><button type="button" aria-label="Fechar janela" onClick={()=>setModal(null)}>×</button></header>
      {modal==='create-server'&&<form onSubmit={e=>void createServer(e)}><label>Nome do servidor<input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Companheiros de campanha"/></label><label>Descrição<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Sobre o que vocês vão conversar?"/></label><label>Ícone (emoji ou símbolo)<input maxLength={12} value={icon} onChange={e=>setIcon(e.target.value)} placeholder="✦"/></label><button className="hb-comm-primary" disabled={busy||name.trim().length<2}>Criar servidor</button></form>}
      {modal==='join'&&<form onSubmit={e=>void join(e)}><p>Recebeu um convite? Insira o código ou cole o link de convite do servidor.</p><label>Código de convite<input autoFocus required value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Ex.: a1b2c3d4e5f6…"/></label><button className="hb-comm-primary" disabled={busy||!joinCode.trim()}>Entrar no servidor</button></form>}
      {modal==='create-channel'&&<form onSubmit={e=>void createChannel(e)}><fieldset className="hb-comm-channel-type-v288"><legend>Tipo de canal</legend><label><input type="radio" name="channel-type" checked={channelKind==='text'} onChange={()=>setChannelKind('text')}/><span><strong># Texto</strong><small>Mensagens, anexos e reações</small></span></label><label><input type="radio" name="channel-type" checked={channelKind==='voice'} onChange={()=>setChannelKind('voice')}/><span><strong>♫ Voz</strong><small>Chamadas de áudio ao vivo</small></span></label></fieldset><label>Nome do canal<input autoFocus required value={name} maxLength={50} onChange={e=>setName(e.target.value)} placeholder="Ex.: planejamento"/><small>O nome será formatado como #nome-do-canal.</small></label><label>Descrição do canal<textarea value={description} maxLength={350} onChange={e=>setDescription(e.target.value)} placeholder="O assunto deste canal"/></label><label className="hb-comm-check"><input type="checkbox" checked={privateChannel} onChange={e=>setPrivateChannel(e.target.checked)}/><span>Canal privado para donos, administradores e moderadores</span></label><button className="hb-comm-primary" disabled={busy||cleanSlug(name).length<2}>Criar canal</button></form>}
      {modal==='edit-channel'&&channel&&<form onSubmit={e=>void editChannel(e)}><p>Tipo de canal: <strong>{channel.kind==='voice'?'♫ Voz':'# Texto'}</strong>. Não é possível alterar o tipo de canais existentes nesta versão.</p><label>Nome do canal<input autoFocus required value={name} maxLength={50} onChange={e=>setName(e.target.value)} placeholder="Ex.: planejamento"/><small>O nome será formatado como #nome-do-canal.</small></label><label>Descrição do canal<textarea value={description} maxLength={350} onChange={e=>setDescription(e.target.value)} placeholder="O assunto deste canal"/></label><label className="hb-comm-check"><input type="checkbox" checked={privateChannel} onChange={e=>setPrivateChannel(e.target.checked)}/><span>Visível somente para donos, administradores e moderadores</span></label><button className="hb-comm-primary" disabled={busy||cleanSlug(name).length<2}>Salvar alterações</button><button type="button" className="hb-comm-modal-danger" disabled={busy} onClick={()=>void removeChannel()}>Excluir canal e mensagens</button></form>}
      {modal==='edit-server'&&<form onSubmit={e=>void editServer(e)}><label>Nome<input required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>Descrição<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Ícone<input maxLength={12} value={icon} onChange={e=>setIcon(e.target.value)}/></label><button className="hb-comm-primary" disabled={busy||name.trim().length<2}>Salvar alterações</button><button type="button" className="hb-comm-modal-danger" onClick={()=>void deleteServer()}>Excluir servidor permanentemente</button></form>}
      {modal==='invite'&&<div className="hb-comm-invite-modal"><p>Compartilhe um link para convidar pessoas. Cada convite expira em 7 dias e pode ser revogado pela equipe.</p><button type="button" className="hb-comm-primary" disabled={busy} onClick={()=>void makeInvite()}>＋ Gerar convite</button><div className="hb-comm-invites">{invites.filter(i=>!i.revoked && new Date(i.expires_at)>new Date()).map(i=><div key={i.code}><code>{i.code}</code><small>Válido até {formatDate(i.expires_at)} · {i.uses} uso(s)</small><button type="button" onClick={()=>void copyInvite(i.code)}>Copiar link</button><button type="button" onClick={()=>void revokeInvite(i.code)} className="hb-comm-text-danger">Revogar</button></div>)}</div></div>}
    </div></div>}
  </section>
}
