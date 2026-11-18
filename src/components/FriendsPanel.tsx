import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import PublicAdventurerProfile, { type AdventurerRef } from './PublicAdventurerProfile'
import './FriendsPanel.css'
import './SocialV156.css'

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
type Props = { campaignId: string | null; campaignName: string; canInvite: boolean; active?: boolean }
type Tab = 'feed'|'friends'|'following'|'followers'|'discover'|'messages'|'blocked'|'invites'
type Summary = { followers: number; following: number; friends: number; blocked: number; unread: number }
const EMPTY_SUMMARY: Summary = { followers: 0, following: 0, friends: 0, blocked: 0, unread: 0 }
const EMPTY_PEOPLE: Person[] = []
const visibilityLabels: Record<Post['visibility'],string> = { public:'🌐 Público',followers:'◉ Seguidores',friends:'♧ Amigos' }
const formatDate = (date:string) => new Date(date).toLocaleString('pt-BR', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' })
const nameOf = (person:{display_name:string;username?:string}) => person.display_name || person.username || 'Aventureiro'

export default function FriendsPanel({ campaignId, campaignName, canInvite, active = true }: Props) {
  const [tab,setTab] = useState<Tab>('feed')
  const [userId,setUserId] = useState('')
  const [summary,setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [people,setPeople] = useState<Record<string,Person[]>>({})
  const [search,setSearch] = useState('')
  const [searchResults,setSearchResults] = useState<Person[]>([])
  const [searchBusy,setSearchBusy] = useState(false)
  const [filter,setFilter] = useState('')
  const [posts,setPosts] = useState<Post[]>([])
  const [postText,setPostText] = useState('')
  const [visibility,setVisibility] = useState<Post['visibility']>('public')
  const [feedScope,setFeedScope] = useState<'all'|'following'|'mine'>('all')
  const [hasMore,setHasMore] = useState(false)
  const [feedBusy,setFeedBusy] = useState(false)
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
    setSelectedChat(selected=>selected ? (rows||[]).find(row=>row.partner_id===selected.partner_id)||null : null)
  },[rpc])
  const loadFeed = useCallback(async (before:string|null=null,add=false,scope:typeof feedScope='all') => {
    const requestId = ++feedRequestRef.current
    setFeedBusy(true)
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
    finally {if (requestId === feedRequestRef.current) setFeedBusy(false)}
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
  useEffect(()=>{if(active)void loadFeed(null,false,feedScope)},[active,feedScope,loadFeed])
  useEffect(()=>{
    if(!active){setSearchBusy(false);return}
    if(search.trim().length<2){setSearchResults([]);setSearchBusy(false);return}
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
  },[search,rpc,active])
  const openChat=useCallback((person:Conversation)=>{
    setSelectedChat(person)
    setChatMessages([])
    setTab('messages')
  },[])
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
      setPostText('');setNotice('Publicação feita!');setTab('feed');setFeedScope('all')
      await loadFeed(null,false,'all')
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  async function like(post:Post){
    try{
      const liked=await rpc<boolean>('hax_social_like_post',{p_post:post.post_id})
      setPosts(items=>items.map(item=>item.post_id!==post.post_id?item:{...item,liked,like_count:Math.max(0,Number(item.like_count)+(liked?1:-1))}))
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
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
  const filteredPeople=useMemo(()=>currentPeople.filter(p=>`${p.display_name} ${p.username}`.toLocaleLowerCase('pt-BR').includes(filter.trim().toLocaleLowerCase('pt-BR'))),[currentPeople,filter])
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
        <span className="hb-social-avatar" aria-hidden="true">{nameOf(person).charAt(0).toUpperCase()}</span>
        <span><strong>{nameOf(person)}</strong><small>@{person.username||'aventureiro'} · {blocked?'Bloqueado':person.is_friend?'Amigos':person.follows_me?'Segue você':person.following?'Você segue':'Aventureiro'}</small></span>
      </button>
      <div className="hb-social-person-actions">
        {!blocked&&<button type="button" onClick={()=>viewPerson(person)}>Ver perfil</button>}
        {!blocked&&<button type="button" className={person.following?'hb-social-muted-action':'hb-social-primary-action'} disabled={!!busy} onClick={()=>follow(person)}>{person.following?'✓ Seguindo':person.follows_me?'↗ Seguir de volta':'+ Seguir'}</button>}
        {!blocked&&person.is_friend&&<button type="button" disabled={!!busy} onClick={()=>{const contact=conversations.find(c=>c.partner_id===person.person_id)||{partner_id:person.person_id,display_name:person.display_name,username:person.username,last_message:null,last_at:null,unread_count:0,can_message:true};openChat(contact)}}>✉ Mensagem</button>}
        {blocked?<button type="button" className="hb-social-muted-action" disabled={!!busy} onClick={()=>block(person,true)}>Desbloquear</button>:<button type="button" className="hb-social-danger-action" disabled={!!busy} onClick={()=>block(person,false)}>Bloquear</button>}
      </div>
    </article>
  }

  return <section className="hb-friends-panel hb-social-hub" aria-label="Comunidade do HäxBag">
    <header className="hb-social-hero"><div><span className="hb-social-overline">HÄXBAG / COMUNIDADE</span><h2>Conexões & histórias</h2><p>Siga outros aventureiros. Quando o seguimento é recíproco, vocês se tornam amigos e podem conversar em particular.</p></div><button type="button" onClick={()=>{void refresh();void loadFeed(null,false,feedScope)}} disabled={loading}>{loading?'Atualizando…':'↻ Atualizar'}</button></header>
    <div className="hb-social-stats"><div><strong>{summary.following}</strong><span>Seguindo</span></div><div><strong>{summary.followers}</strong><span>Seguidores</span></div><div><strong>{summary.friends}</strong><span>Amigos mútuos</span></div><div><strong>{summary.unread}</strong><span>Mensagens não lidas</span></div></div>
    <nav className="hb-social-tabs" aria-label="Áreas da comunidade">{tabs.map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
    {error&&<p className="hb-social-alert" role="alert">{error}</p>}
    {notice&&<p className="hb-social-notice" role="status">{notice}</p>}

    {tab==='feed'&&<div className="hb-social-feed-layout">
      <section className="hb-social-feed-main">
        <form className="hb-social-composer" onSubmit={e=>void publish(e)}><div className="hb-social-section-title"><span className="hb-social-mark">✦</span><div><strong>Compartilhar uma história</strong><small>Publique acontecimentos, ideias ou novidades para a comunidade.</small></div></div><textarea rows={4} maxLength={1200} placeholder="O que está acontecendo na sua jornada?" value={postText} onChange={e=>setPostText(e.target.value)}/><div className="hb-social-composer-bottom"><label>Quem pode ver?<select value={visibility} onChange={e=>setVisibility(e.target.value as Post['visibility'])}><option value="public">Público (contas do HäxBag)</option><option value="followers">Meus seguidores</option><option value="friends">Somente amigos mútuos</option></select></label><small>{postText.length}/1200</small><button className="hb-social-primary-action" type="submit" disabled={!postText.trim()||!!busy}> {busy==='publish'?'Publicando…':'Publicar ↗'}</button></div></form>
        <div className="hb-social-feed-header"><div><span className="hb-social-overline">MURAL DA COMUNIDADE</span><h3>Publicações recentes</h3></div><div className="hb-social-segments">{([['all','Para você'],['following','Seguindo'],['mine','Minhas']] as const).map(([key,label])=><button type="button" key={key} className={feedScope===key?'selected':''} onClick={()=>setFeedScope(key)}>{label}</button>)}</div></div>
        {posts.map(post=><article key={post.post_id} className="hb-social-post"><div className="hb-social-post-top"><button type="button" onClick={()=>post.author_id===userId?setTab('friends'):setProfile({id:post.author_id,display_name:post.display_name,username:post.username})}><span className="hb-social-avatar" aria-hidden="true">{nameOf(post).slice(0,1).toUpperCase()}</span><span><strong>{post.display_name}</strong><small>@{post.username||'aventureiro'}</small></span></button><small>{formatDate(post.created_at)} · {visibilityLabels[post.visibility]}</small></div><p>{post.content}</p><footer><button type="button" className={post.liked?'liked':''} onClick={()=>void like(post)} aria-pressed={post.liked}>{post.liked?'♥':'♡'} {Number(post.like_count)} curtida{Number(post.like_count)===1?'':'s'}</button>{post.author_id===userId&&<button className="hb-social-delete" type="button" onClick={()=>void deletePost(post)}>Excluir</button>}</footer></article>)}
        {!posts.length&&!feedBusy&&<div className="hb-social-empty"><strong>Ainda não há publicações neste mural.</strong><p>Compartilhe o primeiro capítulo ou acompanhe outros aventureiros.</p></div>}
        {feedBusy&&<p className="hb-social-loading">Carregando publicações…</p>}
        {hasMore&&!feedBusy&&<button className="hb-social-load-more" type="button" onClick={()=>void loadFeed(posts.at(-1)?.created_at||null,true,feedScope)}>Mostrar mais publicações</button>}
      </section><aside className="hb-social-feed-aside"><span className="hb-social-overline">SEU CÍRCULO</span><h3>Amizade é seguir de volta.</h3><p>Siga pessoas de quem gosta. Quando alguém também seguir você, a amizade é criada automaticamente e o chat privado fica disponível.</p><button type="button" onClick={()=>setTab('discover')}>⌕ Encontrar jogadores</button><div className="hb-social-privacy-note">◈ Você escolhe se cada publicação será pública, para seguidores ou apenas para amigos. Bloqueios valem nos dois sentidos.</div></aside></div>}

    {(['friends','following','followers','blocked'] as Tab[]).includes(tab)&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">SUA REDE</span><h3>{{friends:'Amigos mútuos',following:'Quem você segue',followers:'Quem segue você',blocked:'Contas bloqueadas'}[tab as 'friends'|'following'|'followers'|'blocked']}</h3><p>{tab==='friends'?'Vocês se seguem mutuamente e podem conversar em particular.':tab==='following'?'Pessoas cujas novidades você quer acompanhar.':tab==='followers'?'Pessoas que escolheram acompanhar seu perfil.':'Pessoas bloqueadas não podem seguir, enviar mensagens ou aparecer no seu feed.'}</p></div><label>Filtrar pessoas<input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Nome ou @usuário" /></label></div><div className="hb-social-people">{filteredPeople.map(person=>peopleCard(person,tab))}</div>{!filteredPeople.length&&<div className="hb-social-empty"><strong>Nenhum resultado.</strong><p>{filter?'Tente outro termo de busca.':tab==='blocked'?'Você não bloqueou ninguém.':'Explore outros perfis para ampliar sua rede.'}</p>{tab!=='blocked'&&<button type="button" onClick={()=>setTab('discover')}>Descobrir jogadores</button>}</div>}</section>}

    {tab==='discover'&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">NOVAS CONEXÕES</span><h3>Descobrir aventureiros</h3><p>Busque por nome ou @usuário. Não são exibidas pessoas com quem você tenha bloqueio.</p></div></div><label className="hb-social-search-label">Pesquisar<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Digite pelo menos 2 caracteres…" autoComplete="off" /></label>{searchBusy&&<p className="hb-social-loading">Procurando aventureiros…</p>}<div className="hb-social-people">{searchResults.map(person=>peopleCard(person,'discover'))}</div>{search.length<2&&<div className="hb-social-empty"><strong>Conheça outros mundos.</strong><p>Digite o nome ou identificador de quem você quer encontrar.</p></div>}{search.trim().length>=2&&!searchBusy&&!searchResults.length&&<div className="hb-social-empty"><strong>Nenhum perfil encontrado.</strong><p>Confira a grafia ou tente outro nome.</p></div>}</section>}

    {tab==='messages'&&<section className="hb-social-chat-shell"><div className="hb-social-chat-sidebar"><div className="hb-social-pane-top"><div><span className="hb-social-overline">CONVERSAS PRIVADAS</span><h3>Mensagens</h3><p>Somente amigos mútuos podem enviar novas mensagens.</p></div></div>{conversations.map(person=><button type="button" key={person.partner_id} className={`hb-social-chat-contact ${selectedChat?.partner_id===person.partner_id?'selected':''}`} onClick={()=>openChat(person)}><span className="hb-social-avatar">{nameOf(person).charAt(0).toUpperCase()}</span><span><strong>{person.display_name}</strong><small>{person.last_message||'Comece uma conversa'}</small></span>{Number(person.unread_count)>0&&<em>{person.unread_count}</em>}</button>)}{!conversations.length&&<div className="hb-social-empty"><strong>Sem conversas.</strong><p>Siga um aventureiro que também segue você para iniciar um chat.</p><button type="button" onClick={()=>setTab('friends')}>Ver amigos</button></div>}</div><div className="hb-social-chat-main">{selectedChat?<><header><div><strong>{selectedChat.display_name}</strong><small>@{selectedChat.username||'aventureiro'}</small></div><button type="button" onClick={()=>setProfile({id:selectedChat.partner_id,display_name:selectedChat.display_name,username:selectedChat.username})}>Ver perfil ↗</button></header><div className="hb-social-chat-messages" aria-live="polite">{chatMessages.map(message=><div className={`hb-social-bubble ${message.sender_id===userId?'own':''}`} key={message.message_id}><p>{message.body}</p><small>{formatDate(message.created_at)}</small></div>)}{!chatMessages.length&&<div className="hb-social-empty"><strong>A conversa começa aqui.</strong><p>Envie uma mensagem particular para este aventureiro.</p></div>}</div>{selectedChat.can_message?<form onSubmit={e=>void sendMessage(e)} className="hb-social-chat-compose"><textarea rows={2} maxLength={2500} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Escreva sua mensagem…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void sendMessage()}}}/><button type="submit" disabled={!messageDraft.trim()||!!busy}>Enviar ↗</button></form>:<div className="hb-social-chat-disabled">Para enviar novas mensagens, vocês precisam se seguir mutuamente.</div>}</>:<div className="hb-social-chat-welcome"><span>✉</span><strong>Suas conversas, em particular.</strong><p>Escolha um contato ao lado. Apenas os participantes podem ler as mensagens.</p></div>}</div></section>}

    {tab==='invites'&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">CONVITES</span><h3>Convites de campanhas</h3><p>Convites de campanha permanecem separados dos seguidores e das amizades.</p></div></div>{invites.map(invite=><div className="hb-social-invite" key={invite.id}><div><strong>{invite.campaign_name}</strong><small>Convite de {invite.sender_name}</small></div><button type="button" disabled={!!busy} onClick={()=>void action(invite.id,'hb_answer_direct_invite',{p_invite:invite.id,p_accept:true},'Convite aceito!')}>Aceitar</button><button type="button" disabled={!!busy} onClick={()=>void action(invite.id,'hb_answer_direct_invite',{p_invite:invite.id,p_accept:false},'Convite recusado.')}>Recusar</button></div>)}{!invites.length&&<div className="hb-social-empty"><strong>Nenhum convite pendente.</strong><p>Novas campanhas aparecerão aqui quando você for convidado.</p></div>}{canInvite&&campaignId&&<p className="hb-social-hint">Convites para {campaignName} podem ser enviados pelo perfil público de um jogador, conforme as permissões de campanha existentes.</p>}</section>}

    {profile&&<PublicAdventurerProfile person={profile} onClose={()=>setProfile(null)} onFriendUpdate={()=>{void refresh();void loadFeed(null,false,feedScope)}} onMessage={person=>{
      setProfile(null)
      const current=conversations.find(c=>c.partner_id===person.id)||{partner_id:person.id,display_name:person.display_name,username:person.username||'',last_message:null,last_at:null,unread_count:0,can_message:true}
      openChat(current)
    }} campaigns={canInvite&&campaignId?[{id:campaignId,name:campaignName}]:[]}/>}
  </section>
}
