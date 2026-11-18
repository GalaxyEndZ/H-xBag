import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import PublicAdventurerProfile, { type AdventurerRef } from './PublicAdventurerProfile'
import './FriendsPanel.css'
import './SocialV156.css'
import './SocialV160.css'
import './SocialV161.css'

type Person = {
  person_id: string
  display_name: string
  username: string
  following: boolean
  follows_me: boolean
  is_friend: boolean
}
type Post = {
  post_id: string
  author_id: string
  display_name: string
  username: string
  content: string
  visibility: 'public'|'followers'|'friends'
  created_at: string
  like_count: number
  liked: boolean
}
type Conversation = {
  partner_id: string
  display_name: string
  username: string
  last_message: string|null
  last_at: string|null
  unread_count: number
  can_message: boolean
}
type ChatMessage = { message_id: string; sender_id: string; body: string; created_at: string; read_at: string|null }
type Invitation = { id: string; campaign_name: string; sender_name: string; created_at: string }
type Props = {
  campaignId: string | null
  campaignName: string
  canInvite: boolean
  active?: boolean
  selectedTab?: SocialTab
  onSelectTab?: (tab: SocialTab) => void
  onViewOwnProfile?: () => void
  onEditOwnProfile?: () => void
  profileIdentity?: {
    name: string
    username?: string
    avatar?: string
    cover?: string
    avatarPosition?: number
    coverPosition?: number
  }
}
export type SocialTab = 'feed'|'friends'|'following'|'followers'|'discover'|'messages'|'blocked'|'invites'
type Tab = SocialTab
type Summary = { followers: number; following: number; friends: number; blocked: number; unread: number }
const EMPTY_SUMMARY: Summary = { followers: 0, following: 0, friends: 0, blocked: 0, unread: 0 }
const EMPTY_PEOPLE: Person[] = []
const visibilityLabels: Record<Post['visibility'],string> = { public:'🌐 Público',followers:'◉ Seguidores',friends:'♧ Amigos' }
const formatDate = (date:string) => new Date(date).toLocaleString('pt-BR', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' })
const nameOf = (person:{display_name:string;username?:string}) => person.display_name || person.username || 'Aventureiro'
const foldText = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
const dayOf = (date:string) => new Date(date).toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})
const pageInfo:Record<SocialTab,{kicker:string;title:string;description:string;icon:string}> = {
  feed:{kicker:'LINHA DO TEMPO',title:'Sua comunidade, suas histórias',description:'Compartilhe momentos, acompanhe quem você segue e encontre novas aventuras.',icon:'✦'},
  friends:{kicker:'CONEXÕES RECÍPROCAS',title:'Seus amigos',description:'As amizades acontecem quando vocês se seguem mutuamente.',icon:'♧'},
  following:{kicker:'SUA REDE',title:'Quem você acompanha',description:'Acompanhe as novidades dos aventureiros que você escolheu seguir.',icon:'↗'},
  followers:{kicker:'SUA REDE',title:'Quem acompanha você',description:'Conheça as pessoas que decidiram seguir suas jornadas.',icon:'↙'},
  discover:{kicker:'EXPLORAR',title:'Encontre aventureiros',description:'Busque jogadores por nome ou identificador para ampliar seu círculo.',icon:'⌕'},
  messages:{kicker:'CONVERSAS',title:'Mensagens privadas',description:'Um espaço reservado para conversar com seus amigos mútuos.',icon:'✉'},
  blocked:{kicker:'PRIVACIDADE',title:'Contas bloqueadas',description:'Gerencie os perfis com os quais você não deseja interagir.',icon:'⊘'},
  invites:{kicker:'CAMPANHAS',title:'Seus convites',description:'Convites para participar de aventuras, separados das suas conexões sociais.',icon:'⚑'},
}

export default function FriendsPanel({ campaignId, campaignName, canInvite, active = true, selectedTab, onSelectTab, onViewOwnProfile, onEditOwnProfile, profileIdentity }: Props) {
  const [internalTab,setInternalTab] = useState<Tab>('feed')
  const tab = selectedTab ?? internalTab
  const setTab = (next:Tab) => {setInternalTab(next);onSelectTab?.(next)}
  const [userId,setUserId] = useState('')
  const [summary,setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [people,setPeople] = useState<Record<string,Person[]>>({})
  const [search,setSearch] = useState('')
  const [searchResults,setSearchResults] = useState<Person[]>([])
  const [searchBusy,setSearchBusy] = useState(false)
  const [filter,setFilter] = useState('')
  const [peopleOrder,setPeopleOrder] = useState<'az'|'za'>('az')
  const [chatSearch,setChatSearch] = useState('')
  const [unreadOnly,setUnreadOnly] = useState(false)
  const [posts,setPosts] = useState<Post[]>([])
  const [avatars,setAvatars] = useState<Record<string,string>>({})
  const avatarsCacheRef = useRef(new Map<string,string>())
  const avatarsLoadingRef = useRef(new Set<string>())
  const [postText,setPostText] = useState('')
  const [visibility,setVisibility] = useState<Post['visibility']>('public')
  const [feedScope,setFeedScope] = useState<'all'|'following'|'mine'>('all')
  const [hasMore,setHasMore] = useState(false)
  const [feedBusy,setFeedBusy] = useState(false)
  const [feedLoaded,setFeedLoaded] = useState(false)
  const [likePending,setLikePending] = useState<Record<string,boolean>>({})
  const [conversations,setConversations] = useState<Conversation[]>([])
  const [selectedChat,setSelectedChat] = useState<Conversation|null>(null)
  const [chatMessages,setChatMessages] = useState<ChatMessage[]>([])
  const [messageDraft,setMessageDraft] = useState('')
  const [invites,setInvites] = useState<Invitation[]>([])
  const [profile,setProfile] = useState<AdventurerRef|null>(null)
  const [busy,setBusy] = useState('')
  const [loading,setLoading] = useState(true)
  const [notice,setNotice] = useState('')
  const [error,setError] = useState('')
  const feedRequestRef = useRef(0)
  const messagesRequestRef = useRef(0)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatLastIdRef = useRef('')
  const likeInFlightRef = useRef(new Set<string>())

  const rpc = useCallback(async <T,>(name:string,args:Record<string,unknown> = {}):Promise<T> => {
    const {data,error:failure} = await supabase.rpc(name,args)
    if (failure) throw new Error(failure.message)
    return data as T
  },[])
  const loadCounts = useCallback(async () => {
    const result = await rpc<Partial<Summary>>('hax_social_summary')
    setSummary({...EMPTY_SUMMARY,...result})
  },[rpc])
  const loadPeople = useCallback(async (kind:'friends'|'following'|'followers'|'blocked') => {
    const rows = await rpc<Person[]>('hax_social_people',{p_kind:kind})
    setPeople(previous => ({...previous,[kind]:rows||[]}))
  },[rpc])
  const loadConversations = useCallback(async () => {
    const rows = await rpc<Conversation[]>('hax_social_chat_list')
    setConversations(rows||[])
    // Mantém a conversa recém-iniciada mesmo antes da primeira mensagem.
    setSelectedChat(selected=>selected ? (rows||[]).find(row=>row.partner_id===selected.partner_id) || selected : null)
  },[rpc])
  const loadFeed = useCallback(async (before:string|null=null,add=false,scope:typeof feedScope='all') => {
    const requestId = ++feedRequestRef.current
    setFeedBusy(true)
    if (!add) setFeedLoaded(false)
    try {
      const rows = await rpc<Post[]>('hax_social_feed',{p_scope:scope,p_before:before,p_limit:20})
      if (requestId !== feedRequestRef.current) return
      setPosts(previous => {
        if (!add) return rows || []
        const known = new Set(previous.map(item => item.post_id))
        return [...previous, ...(rows || []).filter(item => !known.has(item.post_id))]
      })
      setHasMore((rows||[]).length===20)
    } catch (failure) {
      if (requestId === feedRequestRef.current) setError(failure instanceof Error?failure.message:String(failure))
    }
    finally {if (requestId === feedRequestRef.current) {setFeedBusy(false);setFeedLoaded(true)}}
  },[rpc])
  const loadInvites = useCallback(async () => {
    const {data,error:failure}=await supabase.rpc('hb_list_direct_invites')
    if(failure) throw new Error(failure.message)
    setInvites((data||[]) as Invitation[])
  },[])
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Os outros relacionamentos são carregados apenas ao abrir a aba correspondente.
      const listKind = tab === 'friends' || tab === 'following' || tab === 'followers' || tab === 'blocked' ? tab : null
      await Promise.all([
        loadCounts(),
        loadInvites(),
        ...(listKind ? [loadPeople(listKind)] : []),
        ...(tab === 'messages' ? [loadConversations()] : []),
      ])
      setError('')
    } catch (failure) {setError(`Não foi possível carregar a comunidade. Execute o SQL V156. ${failure instanceof Error?failure.message:String(failure)}`)}
    finally {setLoading(false)}
  },[tab,loadCounts,loadPeople,loadConversations,loadInvites])
  useEffect(()=>{
    if (!active) return
    let cancelled = false
    void supabase.auth.getUser().then(({data})=>{
      if (!cancelled) setUserId(data.user?.id||'')
    })
    return () => { cancelled = true }
  },[active])
  useEffect(()=>{if(active)void refresh()},[active,refresh])
  useEffect(()=>{if(active && tab==='feed')void loadFeed(null,false,feedScope)},[active,tab,feedScope,loadFeed])
  useEffect(()=>{
    if(!active || tab!=='discover'){setSearchBusy(false);return}
    if(search.trim().length<2){setSearchResults([]);setSearchBusy(false);return}
    setSearchResults([])
    let canceled=false
    const timer=window.setTimeout(async()=>{
      setSearchBusy(true)
      try {
        const rows=await rpc<Person[]>('hax_social_search',{p_query:search.trim()})
        if(!canceled)setSearchResults(rows||[])
      } catch(failure){if(!canceled)setError(failure instanceof Error?failure.message:String(failure))}
      finally{if(!canceled)setSearchBusy(false)}
    },300)
    return()=>{canceled=true;window.clearTimeout(timer)}
  },[search,rpc,active,tab])
  const openChat=useCallback((person:Conversation)=>{
    // Evita mostrar uma resposta tardia ou o rascunho de outra conversa.
    messagesRequestRef.current+=1
    chatLastIdRef.current=''
    setSelectedChat(person)
    setChatMessages([])
    setMessageDraft('')
    setTab('messages')
  },[onSelectTab])
  const loadMessages=useCallback(async(partnerId:string)=>{
    const requestId = ++messagesRequestRef.current
    const rows=await rpc<ChatMessage[]>('hax_social_chat_messages',{p_partner:partnerId,p_limit:80})
    if (requestId !== messagesRequestRef.current) return
    setChatMessages([...(rows||[])].reverse())
    // Sem mensagens novas, evita uma escrita desnecessária a cada atualização.
    if ((rows||[]).some(message=>message.sender_id!==userId && !message.read_at)) {
      await rpc('hax_social_mark_read',{p_partner:partnerId})
      await loadCounts()
    }
  },[rpc,loadCounts,userId])
  useEffect(()=>{
    if(!active||tab!=='messages')return
    if(selectedChat)void loadMessages(selectedChat.partner_id).catch(failure=>setError(failure instanceof Error?failure.message:String(failure)))
    const timer=window.setInterval(()=>{
      // Não consulta o Supabase em segundo plano quando o navegador está oculto.
      if (document.visibilityState === 'hidden') return
      void loadConversations().catch(()=>{})
      if(selectedChat)void loadMessages(selectedChat.partner_id).catch(()=>{})
    },10000)
    return()=>window.clearInterval(timer)
  },[active,tab,selectedChat?.partner_id,loadConversations,loadMessages])

  useEffect(()=>{
    if (!active || tab!=='messages' || !selectedChat || !chatMessages.length) return
    const lastId=chatMessages[chatMessages.length-1]?.message_id||''
    if (lastId===chatLastIdRef.current) return
    const scroll=chatScrollRef.current
    const nearBottom=scroll ? scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<150 : true
    const initial=chatLastIdRef.current===''
    chatLastIdRef.current=lastId
    if (scroll && (initial || nearBottom)) scroll.scrollTop=scroll.scrollHeight
  },[active,tab,selectedChat?.partner_id,chatMessages])
  async function action(key:string,operation:string,args:Record<string,unknown>,success:string,updateFeed=false){
    setBusy(key);setNotice('');setError('')
    try{
      await rpc(operation,args)
      setNotice(success)
      await refresh()
      if(search.trim().length>=2){const rows=await rpc<Person[]>('hax_social_search',{p_query:search.trim()});setSearchResults(rows||[])}
      if(updateFeed)await loadFeed(null,false,feedScope)
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  const follow=(person:Person)=>void action(person.person_id,'hax_social_follow',{p_target:person.person_id,p_follow:!person.following},person.following?'Você deixou de seguir.':person.follows_me?'Vocês agora são amigos!':'Você começou a seguir.')
  const block=(person:Person,blocked:boolean)=>{
    if(blocked||window.confirm(`Bloquear ${nameOf(person)}? Vocês deixarão de se seguir e não poderão trocar mensagens ou visualizar publicações.`)){
      void action(person.person_id,'hax_social_block',{p_target:person.person_id,p_block:!blocked},blocked?'Conta desbloqueada.':'Conta bloqueada.',true)
      if(profile?.id===person.person_id)setProfile(null)
      if(selectedChat?.partner_id===person.person_id)setSelectedChat(null)
    }
  }
  const viewPerson=(person:Person)=>setProfile({id:person.person_id,display_name:person.display_name,username:person.username,status:person.is_friend?'friends':person.following?'following':person.follows_me?'follower':''})
  async function publish(event:FormEvent){
    event.preventDefault();if(!postText.trim()||busy)return
    setBusy('publish');setError('');setNotice('')
    try{
      await rpc('hax_social_create_post',{p_content:postText.trim(),p_visibility:visibility})
      setPostText('');setNotice('Sua publicação já está no mural!');setTab('feed')
      if (feedScope==='all') await loadFeed(null,false,'all')
      else setFeedScope('all')
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  async function like(post:Post){
    if(likeInFlightRef.current.has(post.post_id))return
    likeInFlightRef.current.add(post.post_id)
    setLikePending(current=>({...current,[post.post_id]:true}))
    try{
      const liked=await rpc<boolean>('hax_social_like_post',{p_post:post.post_id})
      setPosts(items=>items.map(item=>item.post_id!==post.post_id?item:{...item,liked,like_count:Math.max(0,Number(item.like_count)+(liked?1:-1))}))
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{
      likeInFlightRef.current.delete(post.post_id)
      setLikePending(current=>({...current,[post.post_id]:false}))
    }
  }
  async function deletePost(post:Post){
    if(!window.confirm('Excluir esta publicação?'))return
    await action(post.post_id,'hax_social_delete_post',{p_post:post.post_id},'Publicação excluída.',true)
  }
  async function sendMessage(event?:{preventDefault:()=>void}){
    event?.preventDefault()
    if(!selectedChat||!messageDraft.trim()||busy)return
    setBusy('send-message');setError('')
    try{
      await rpc('hax_social_send_message',{p_partner:selectedChat.partner_id,p_body:messageDraft.trim()})
      setMessageDraft('')
      await loadMessages(selectedChat.partner_id)
      await loadConversations()
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  const currentPeople=people[tab]||EMPTY_PEOPLE
  const filteredPeople=useMemo(()=>currentPeople
    .filter(p=>foldText(`${p.display_name} ${p.username}`).includes(foldText(filter.trim())))
    .sort((a,b)=>peopleOrder==='az' ? nameOf(a).localeCompare(nameOf(b),'pt-BR') : nameOf(b).localeCompare(nameOf(a),'pt-BR')),
  [currentPeople,filter,peopleOrder])
  const filteredConversations=useMemo(()=>conversations.filter(person=>{
    if (unreadOnly && Number(person.unread_count)===0) return false
    return foldText(`${person.display_name} ${person.username} ${person.last_message||''}`).includes(foldText(chatSearch.trim()))
  }),[conversations,chatSearch,unreadOnly])
  // Usa a mesma foto do perfil público, sem expor buckets privados nem alterar as RPCs existentes.
  // O cache impede novas consultas a cada atualização automática do chat.
  const visibleAvatarIds=useMemo(()=>{
    const ids = tab==='feed' ? posts.map(item=>item.author_id)
      : tab==='messages' ? [...conversations.map(item=>item.partner_id),...(selectedChat?[selectedChat.partner_id]:[])]
      : tab==='discover' ? searchResults.map(item=>item.person_id)
      : (people[tab]||EMPTY_PEOPLE).map(item=>item.person_id)
    return [...new Set(ids.filter(id=>id && id!==userId))]
  },[tab,posts,conversations,selectedChat,searchResults,people,userId])
  useEffect(()=>{
    if(!active)return
    const ids=visibleAvatarIds.filter(id=>!avatarsCacheRef.current.has(id)&&!avatarsLoadingRef.current.has(id))
    if(!ids.length)return
    const load=async()=>{
      // Pequenos lotes evitam sobrecarregar a API num mural com muitas pessoas.
      for(let index=0;index<ids.length;index+=5){
        const batch=ids.slice(index,index+5)
        await Promise.all(batch.map(async id=>{
          avatarsLoadingRef.current.add(id)
          try{
            const {data,error:failure}=await supabase.rpc('hax_social_public_profile',{p_user_id:id})
            const photo=!failure&&data&&typeof data==='object'&&!Array.isArray(data)&&typeof data.avatar_image==='string'?data.avatar_image:''
            avatarsCacheRef.current.set(id,photo)
            if(photo)setAvatars(old=>({...old,[id]:photo}))
          }catch{avatarsCacheRef.current.set(id,'')}
          finally{avatarsLoadingRef.current.delete(id)}
        }))
      }
    }
    void load()
  },[active,visibleAvatarIds])
  const avatarFor=(id:string,name:string)=>{
    const src=id===userId ? profileIdentity?.avatar : avatars[id]
    return <span className="hb-social-avatar hb-v161-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}{src&&<img src={src} alt="" loading="lazy" onError={event=>{event.currentTarget.style.display='none'}}/>}</span>
  }
  const info=pageInfo[tab]
  const tabs: {id:Tab;label:string;count?:number}[]=[
    {id:'feed',label:'✦ Feed'},
    {id:'friends',label:'♧ Amigos',count:summary.friends},
    {id:'following',label:'↗ Seguindo',count:summary.following},
    {id:'followers',label:'↙ Seguidores',count:summary.followers},
    {id:'discover',label:'⌕ Descobrir'},
    {id:'messages',label:'✉ Mensagens',count:summary.unread},
    {id:'blocked',label:'⊘ Bloqueados',count:summary.blocked},
    {id:'invites',label:'⚑ Convites',count:invites.length},
  ]
  const peopleCard=(person:Person,kind:Tab)=>{
    const blocked=kind==='blocked'
    return <article className="hb-social-person" key={person.person_id}>
      <button className="hb-social-person-name" type="button" onClick={()=>blocked?undefined:viewPerson(person)} disabled={blocked}>
        {avatarFor(person.person_id,nameOf(person))}
        <span><strong>{nameOf(person)}</strong><small>@{person.username||'aventureiro'} · {blocked?'Bloqueado':person.is_friend?'Amigos':person.follows_me?'Segue você':person.following?'Você segue':'Aventureiro'}</small></span>
      </button>
      <div className="hb-social-person-actions">
        {!blocked&&<button type="button" onClick={()=>viewPerson(person)}>Ver perfil</button>}
        {!blocked&&<button type="button" className={person.following?'hb-social-muted-action':'hb-social-primary-action'} disabled={!!busy} onClick={()=>follow(person)}>{person.following?'✓ Seguindo':person.follows_me?'↗ Seguir de volta':'+ Seguir'}</button>}
        {!blocked&&person.is_friend&&<button type="button" disabled={!!busy} onClick={()=>{const contact=conversations.find(c=>c.partner_id===person.person_id)||{partner_id:person.person_id,display_name:person.display_name,username:person.username,last_message:null,last_at:null,unread_count:0,can_message:true};openChat(contact)}}>✉ Mensagem</button>}
        {blocked?<button type="button" className="hb-social-muted-action" disabled={!!busy} onClick={()=>block(person,true)}>Desbloquear</button>:<details className="hb-v160-person-more"><summary aria-label={`Mais opções para ${nameOf(person)}`} title="Mais opções">⋯</summary><div><button type="button" className="hb-social-danger-action" disabled={!!busy} onClick={()=>block(person,false)}>⊘ Bloquear usuário</button></div></details>}
      </div>
    </article>
  }

  return <section className={`hb-friends-panel hb-social-hub hb-social-v158 hb-social-v160 hb-social-v161 hb-social-page-${tab}`} aria-label="Comunidade do HäxBag">
    <div className="hb-v158-social-columns">
      <aside className="hb-v158-social-sidebar" aria-label="Sua identidade e navegação da comunidade">
        <div className="hb-v158-mini-profile">
          <div className="hb-v158-mini-cover">
            {profileIdentity?.cover && <img src={profileIdentity.cover} alt="" style={{objectPosition:`center ${profileIdentity.coverPosition ?? 50}%`}} />}
            <span aria-hidden="true">✧ HÄXBAG</span>
          </div>
          <div className="hb-v158-mini-profile-body">
            <span className="hb-v158-mini-avatar" aria-hidden="true">
              {profileIdentity?.avatar ? <img src={profileIdentity.avatar} alt="" style={{objectPosition:`center ${profileIdentity.avatarPosition ?? 50}%`}} /> : (profileIdentity?.name?.slice(0,1).toUpperCase() || '✦')}
            </span>
            <strong>{profileIdentity?.name || 'Meu perfil'}</strong>
            <small>{profileIdentity?.username ? `@${profileIdentity.username}` : 'Seu espaço no HäxBag'}</small>
            <button type="button" onClick={onViewOwnProfile}>Ver meu perfil ↗</button>
          </div>
        </div>
        <span className="hb-v158-nav-label">EXPLORAR A REDE</span>
        <nav className="hb-social-tabs" aria-label="Áreas da comunidade">{tabs.map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
        <div className="hb-v158-sidebar-actions">
          <button type="button" onClick={onEditOwnProfile}>✎ Personalizar meu perfil</button>
          <small>Uma amizade começa quando vocês se seguem mutuamente.</small>
        </div>
      </aside>
      <div className="hb-v158-social-content">
    <header className="hb-social-hero hb-v160-hero">
      <div className="hb-v160-hero-copy"><span className="hb-social-overline">HÄXBAG / SOCIAL / {info.kicker}</span><h2><span className="hb-v160-hero-icon" aria-hidden="true">{info.icon}</span>{info.title}</h2><p>{info.description}</p></div>
      <div className="hb-v160-hero-actions">
        {tab!=='feed'&&<button type="button" className="hb-v160-hero-main" onClick={()=>setTab('feed')}>✦ Ver feed</button>}
        {tab==='feed'&&<button type="button" className="hb-v160-hero-main" onClick={()=>setTab('discover')}>⌕ Encontrar pessoas</button>}
        <button type="button" className="hb-v160-refresh" aria-label="Atualizar esta página" title="Atualizar esta página" onClick={()=>{void refresh();if(tab==='feed')void loadFeed(null,false,feedScope);if(tab==='messages'&&selectedChat)void loadMessages(selectedChat.partner_id)}} disabled={loading}>{loading?'…':'↻'}<span>Atualizar</span></button>
      </div>
    </header>
    <div className="hb-social-stats hb-v160-stats" aria-label="Resumo das conexões">
      {([{id:'following',icon:'↗',count:summary.following,label:'Seguindo'}, {id:'followers',icon:'↙',count:summary.followers,label:'Seguidores'}, {id:'friends',icon:'♧',count:summary.friends,label:'Amigos'}, {id:'messages',icon:'✉',count:summary.unread,label:'Não lidas'}] as const).map(stat=><button key={stat.id} type="button" className={tab===stat.id?'is-current':''} onClick={()=>setTab(stat.id)} aria-label={`${stat.count} ${stat.label}. Abrir ${stat.id==='messages'?'mensagens':stat.label.toLowerCase()}`}><span className="hb-v160-stat-icon" aria-hidden="true">{stat.icon}</span><span><strong>{stat.count}</strong><small>{stat.label}</small></span><span className="hb-v160-stat-arrow" aria-hidden="true">↗</span></button>)}
    </div>
    
    {error&&<div className="hb-social-alert hb-v160-alert" role="alert"><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Dispensar aviso de erro">✕</button></div>}
    {notice&&<div className="hb-social-notice hb-v160-alert" role="status"><span>{notice}</span><button type="button" onClick={()=>setNotice('')} aria-label="Dispensar confirmação">✕</button></div>}

    {tab==='feed'&&<div className="hb-social-feed-layout">
      <section className="hb-social-feed-main">
        <form className="hb-social-composer hb-v160-composer" onSubmit={e=>void publish(e)}>
          <div className="hb-v160-composer-author">{avatarFor(userId,profileIdentity?.name||'A')}<div><strong>{profileIdentity?.name||'Você'}</strong><small>Uma nova história para compartilhar</small></div></div>
          <label htmlFor="hb-v160-post-draft" className="hb-v160-editor-label">O que está acontecendo na sua jornada?</label>
          <textarea id="hb-v160-post-draft" rows={3} maxLength={1200} placeholder="Conte uma conquista, compartilhe uma aventura ou convide alguém para conversar…" value={postText} onChange={e=>setPostText(e.target.value)}/>
          <div className="hb-v160-writing-prompts" aria-label="Ideias para publicar"><span>Ideias:</span>{['✧ Minha aventura de hoje: ','⚔ Procuro uma mesa de RPG! ','✦ Uma conquista para compartilhar: '].map((template,index)=><button key={index} type="button" onClick={()=>setPostText(value=>value || template)}>{['Minha aventura','Procurar mesa','Conquista'][index]}</button>)}</div>
          <div className="hb-social-composer-bottom"><label>Visibilidade<select value={visibility} onChange={e=>setVisibility(e.target.value as Post['visibility'])} aria-label="Quem pode ver esta publicação"><option value="public">🌐 Todas as contas</option><option value="followers">↗ Seguidores</option><option value="friends">♧ Apenas amigos</option></select></label><div className="hb-v160-composer-submit"><span className={postText.length>1080?'near-limit':''}>{postText.length} / 1200</span><button className="hb-social-primary-action" type="submit" disabled={!postText.trim()||!!busy}>{busy==='publish'?'Publicando…':'Publicar ✦'}</button></div></div>
        </form>
        <div className="hb-social-feed-header"><div><span className="hb-social-overline">LINHA DO TEMPO</span><h3>Publicações recentes</h3></div><div className="hb-social-segments" role="group" aria-label="Filtrar publicações">{([['all','Para você'],['following','Seguindo'],['mine','Minhas']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={feedScope===key} className={feedScope===key?'selected':''} onClick={()=>setFeedScope(key)}>{label}</button>)}</div></div>
        {feedLoaded&&posts.map(post=><article key={post.post_id} className="hb-social-post"><div className="hb-social-post-top"><button type="button" onClick={()=>post.author_id===userId?onViewOwnProfile?.():setProfile({id:post.author_id,display_name:post.display_name,username:post.username})}>{avatarFor(post.author_id,nameOf(post))}<span><strong>{post.display_name}</strong><small>@{post.username||'aventureiro'}</small></span></button><small className="hb-v160-post-date"><time dateTime={post.created_at}>{formatDate(post.created_at)}</time><span className="hb-v160-visibility">{visibilityLabels[post.visibility]}</span></small></div><p>{post.content}</p><footer><button type="button" className={post.liked?'liked':''} onClick={()=>void like(post)} aria-pressed={post.liked} disabled={!!likePending[post.post_id]}>{post.liked?'♥':'♡'} {Number(post.like_count)} curtida{Number(post.like_count)===1?'':'s'}</button>{post.author_id===userId&&<button className="hb-social-delete" type="button" onClick={()=>void deletePost(post)}>Excluir</button>}</footer></article>)}
        {feedLoaded&&!posts.length&&!feedBusy&&<div className="hb-social-empty hb-v160-empty"><span className="hb-v160-empty-icon">✦</span><strong>Nenhuma publicação por enquanto.</strong><p>{feedScope==='following'?'Acompanhe novos jogadores para ver suas publicações aqui.':feedScope==='mine'?'Compartilhe seu primeiro registro no mural.':'Sua comunidade está pronta para novas histórias.'}</p>{feedScope==='following'&&<button type="button" onClick={()=>setTab('discover')}>Encontrar pessoas</button>}</div>}
        {feedBusy&&<div className="hb-v160-skeletons" aria-label="Carregando publicações" aria-busy="true"><div/><div/></div>}
        {hasMore&&!feedBusy&&<button className="hb-social-load-more" type="button" onClick={()=>void loadFeed(posts.at(-1)?.created_at||null,true,feedScope)}>Mostrar mais publicações</button>}
      </section><aside className="hb-social-feed-aside"><span className="hb-social-overline">SEU CÍRCULO</span><h3>Histórias se conectam.</h3><p>Explore a comunidade e acompanhe as aventuras de quem você segue. O chat privado abre quando o seguimento é mútuo.</p><div className="hb-v158-aside-stats"><span><strong>{summary.followers}</strong> seguidores</span><span><strong>{summary.friends}</strong> amigos</span></div><button type="button" onClick={()=>setTab('discover')}>⌕ Encontrar aventureiros</button><button type="button" onClick={()=>setTab('messages')}>✉ Ir às mensagens {summary.unread>0?`(${summary.unread})`:''}</button><div className="hb-social-privacy-note">◈ Você escolhe se cada publicação será pública, para seguidores ou apenas para amigos. Bloqueios valem nos dois sentidos.</div></aside></div>}

    {(['friends','following','followers','blocked'] as Tab[]).includes(tab)&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">SEU CÍRCULO</span><h3>{{friends:'Amigos mútuos',following:'Quem você segue',followers:'Quem segue você',blocked:'Contas bloqueadas'}[tab as 'friends'|'following'|'followers'|'blocked']}</h3><p>{tab==='friends'?'Vocês se seguem mutuamente e podem conversar em particular.':tab==='following'?'Pessoas cujas novidades você quer acompanhar.':tab==='followers'?'Pessoas que escolheram acompanhar seu perfil.':'Você pode desbloquear essas contas quando quiser.'}</p></div><span className="hb-v160-result-count">{filteredPeople.length} {filteredPeople.length===1?'perfil':'perfis'}</span></div>
      <div className="hb-v160-people-tools"><label>Buscar nesta lista<input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Nome ou @usuário" /></label><label>Ordenar<select value={peopleOrder} onChange={e=>setPeopleOrder(e.target.value as 'az'|'za')}><option value="az">Nome: A → Z</option><option value="za">Nome: Z → A</option></select></label></div><div className="hb-social-people hb-v160-people-grid">{filteredPeople.map(person=>peopleCard(person,tab))}</div>{!filteredPeople.length&&!loading&&<div className="hb-social-empty hb-v160-empty"><strong>Nenhum resultado.</strong><p>{filter?'Tente outro termo de busca.':tab==='blocked'?'Você não bloqueou ninguém.':'Explore outros perfis para ampliar sua rede.'}</p>{tab!=='blocked'&&<button type="button" onClick={()=>setTab('discover')}>Descobrir jogadores</button>}</div>}</section>}

    {tab==='discover'&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">NOVAS CONEXÕES</span><h3>Descobrir aventureiros</h3><p>Busque por nome ou @usuário. Não são exibidas pessoas com quem você tenha bloqueio.</p></div></div><label className="hb-social-search-label hb-v160-discover-search"><span>Pesquisar jogadores</span><span className="hb-v160-search-input"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome ou @usuário — ao menos 2 caracteres" autoComplete="off" /></span></label>
      <div className="hb-v160-discover-note">✦ Encontrou alguém interessante? Siga essa pessoa. Se ela seguir você de volta, vocês se tornam amigos e podem conversar por mensagens.</div>{searchBusy&&<p className="hb-social-loading">Procurando aventureiros…</p>}<div className="hb-social-people hb-v160-people-grid">{searchResults.map(person=>peopleCard(person,'discover'))}</div>{search.trim().length<2&&<div className="hb-social-empty hb-v160-empty"><strong>Conheça outros mundos.</strong><p>Digite o nome ou identificador de quem você quer encontrar.</p></div>}{search.trim().length>=2&&!searchBusy&&!searchResults.length&&<div className="hb-social-empty"><strong>Nenhum perfil encontrado.</strong><p>Confira a grafia ou tente outro nome.</p></div>}</section>}

    {tab==='messages'&&<section className={`hb-social-chat-shell hb-v160-chat ${selectedChat?'has-active-chat':''}`}><div className="hb-social-chat-sidebar"><div className="hb-social-pane-top"><div><span className="hb-social-overline">CONVERSAS PRIVADAS</span><h3>Conversas</h3><p>Somente amigos mútuos podem enviar novas mensagens.</p></div></div>
      <label className="hb-v160-chat-search"><span>Buscar conversa</span><input type="search" value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Nome ou mensagem…" /></label>
      <label className="hb-v160-unread-toggle"><input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/> Somente não lidas {summary.unread>0?`(${summary.unread})`:''}</label>
      <div className="hb-v160-contact-list">{filteredConversations.map(person=><button type="button" key={person.partner_id} className={`hb-social-chat-contact ${selectedChat?.partner_id===person.partner_id?'selected':''}`} onClick={()=>openChat(person)}>{avatarFor(person.partner_id,nameOf(person))}<span><strong>{person.display_name}</strong><small>{person.last_message||'Comece uma conversa'}</small></span>{Number(person.unread_count)>0&&<em aria-label={`${person.unread_count} mensagens não lidas`}>{person.unread_count}</em>}</button>)}{!filteredConversations.length&&!!conversations.length&&<p className="hb-v160-no-conversations">Nenhuma conversa corresponde aos filtros.</p>}</div>{!conversations.length&&<div className="hb-social-empty"><strong>Sem conversas.</strong><p>Siga um aventureiro que também segue você para iniciar um chat.</p><button type="button" onClick={()=>setTab('friends')}>Ver amigos</button></div>}</div><div className="hb-social-chat-main">{selectedChat?<><header><div className="hb-v160-chat-header-identity"><button type="button" className="hb-v160-chat-back" aria-label="Voltar para conversas" onClick={()=>{messagesRequestRef.current+=1;setSelectedChat(null);setChatMessages([]);setMessageDraft('')}}>‹</button>{avatarFor(selectedChat.partner_id,nameOf(selectedChat))}<span><strong>{selectedChat.display_name}</strong><small>@{selectedChat.username||'aventureiro'}</small></span></div><button type="button" onClick={()=>setProfile({id:selectedChat.partner_id,display_name:selectedChat.display_name,username:selectedChat.username})}>Ver perfil ↗</button></header><div className="hb-social-chat-messages" ref={chatScrollRef} aria-label={`Mensagens com ${selectedChat.display_name}`} aria-live="polite">{chatMessages.map((message,index)=><div className="hb-v160-message-row" key={message.message_id}>
          {(index===0 || dayOf(chatMessages[index-1].created_at)!==dayOf(message.created_at))&&<div className="hb-v160-chat-day" role="separator">{dayOf(message.created_at)}</div>}
          <div className={`hb-v161-chat-message ${message.sender_id===userId?'own':''}`}>{avatarFor(message.sender_id,message.sender_id===userId?(profileIdentity?.name||'Você'):nameOf(selectedChat))}<div className={`hb-social-bubble ${message.sender_id===userId?'own':''}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{message.sender_id===userId && message.read_at?' · Lida':''}</small></div></div></div>)}{!chatMessages.length&&<div className="hb-social-empty"><strong>A conversa começa aqui.</strong><p>Envie uma mensagem particular para este aventureiro.</p></div>}</div>{selectedChat.can_message?<form onSubmit={e=>void sendMessage(e)} className="hb-social-chat-compose"><textarea rows={2} maxLength={2500} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Escreva sua mensagem…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void sendMessage()}}}/><button type="submit" disabled={!messageDraft.trim()||!!busy}>Enviar ↗</button></form>:<div className="hb-social-chat-disabled">Para enviar novas mensagens, vocês precisam se seguir mutuamente.</div>}</>:<div className="hb-social-chat-welcome"><span>✉</span><strong>Suas conversas, em particular.</strong><p>Selecione uma conversa para começar. As mensagens privadas são acessíveis somente aos participantes.</p><button type="button" onClick={()=>setTab('friends')}>Ver meus amigos</button></div>}</div></section>}

    {tab==='invites'&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">CONVITES</span><h3>Convites de campanhas</h3><p>Convites de campanha permanecem separados dos seguidores e das amizades.</p></div></div>{invites.map(invite=><div className="hb-social-invite" key={invite.id}><span className="hb-v160-invite-icon" aria-hidden="true">⚑</span><div><strong>{invite.campaign_name}</strong><small>Convite de {invite.sender_name} · <time dateTime={invite.created_at}>{new Date(invite.created_at).toLocaleDateString('pt-BR')}</time></small></div><button type="button" disabled={!!busy} onClick={()=>void action(invite.id,'hb_answer_direct_invite',{p_invite:invite.id,p_accept:true},'Convite aceito!')}>Aceitar</button><button type="button" disabled={!!busy} onClick={()=>void action(invite.id,'hb_answer_direct_invite',{p_invite:invite.id,p_accept:false},'Convite recusado.')}>Recusar</button></div>)}{!invites.length&&<div className="hb-social-empty"><strong>Nenhum convite pendente.</strong><p>Novas campanhas aparecerão aqui quando você for convidado.</p></div>}{canInvite&&campaignId&&<p className="hb-social-hint">Convites para {campaignName} podem ser enviados pelo perfil público de um jogador, conforme as permissões de campanha existentes.</p>}</section>}

      </div>
    </div>
    {profile&&<PublicAdventurerProfile person={profile} onClose={()=>setProfile(null)} onFriendUpdate={()=>{void refresh();void loadFeed(null,false,feedScope)}} onMessage={person=>{
      setProfile(null)
      const current=conversations.find(c=>c.partner_id===person.id)||{partner_id:person.id,display_name:person.display_name,username:person.username||'',last_message:null,last_at:null,unread_count:0,can_message:true}
      openChat(current)
    }} campaigns={canInvite&&campaignId?[{id:campaignId,name:campaignName}]:[]}/>}
  </section>
}
