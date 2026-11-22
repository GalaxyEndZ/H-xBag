import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import type { HaxSocialTab } from '../siteNavigation'
import PublicAdventurerProfile, { type AdventurerRef } from './PublicAdventurerProfile'
import './FriendsPanel.css'
import './SocialV156.css'
import './SocialV160.css'
import './SocialV161.css'
import './SocialV162.css'
import './SocialV163.css'
import './SocialV180.css'
import './SocialV189.css'
import './SocialChatV201.css'
import './SocialV214.css'
import SocialReferralPanel from './SocialReferralPanel'
import SocialPostComments, { useSocialCommentCounts } from './SocialPostComments'
import SocialV231Suite, { type SocialV231Page } from './SocialV231Suite'
import SocialPostActionsV249 from './SocialPostActionsV249'
import SiteAdministrationV234 from './SiteAdministrationV234'
import SocialExpansionV245 from './SocialExpansionV245'
import { useSocialV245Chat } from './useSocialV245Chat'
import './SocialRedesignV232.css'

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
  image_paths: string[]
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
type ChatMessage = { message_id: string; sender_id: string; body: string; created_at: string; read_at: string|null; image_path?:string|null; deleted_at?:string|null }
type Props = {
  campaignId: string | null
  campaignName: string
  canInvite: boolean
  active?: boolean
  isSiteAdmin?: boolean
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
export type SocialTab = HaxSocialTab
type Tab = SocialTab
type Summary = { followers: number; following: number; friends: number; blocked: number; unread: number }
const EMPTY_SUMMARY: Summary = { followers: 0, following: 0, friends: 0, blocked: 0, unread: 0 }
const EMPTY_PEOPLE: Person[] = []
const visibilityLabels: Record<Post['visibility'],string> = { public:'🌐 Público',followers:'◉ Seguidores',friends:'♧ Amigos' }
const formatDate = (date:string) => new Date(date).toLocaleString('pt-BR', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' })
const nameOf = (person:{display_name:string;username?:string}) => person.display_name || person.username || 'Aventureiro'
const errorMessageV231 = (e:unknown) => e instanceof Error ? e.message : String(e)
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
  referral:{kicker:'CONVITE SOCIAL',title:'Convide pessoas para o HäxBag',description:'Seu link pessoal de convite e o progresso da insígnia Embaixador.',icon:'✧'},
  communities:{kicker:'GRUPOS',title:'Comunidades de aventureiros',description:'Compartilhe interesses, crie grupos e participe de discussões de RPG.',icon:'♧'},
  saved:{kicker:'BIBLIOTECA',title:'Suas coleções',description:'Guarde publicações e organize as suas inspirações pessoais.',icon:'▤'},
  events:{kicker:'AGENDA',title:'Eventos da comunidade',description:'Encontros, sessões abertas e atividades compartilhadas.',icon:'◷'},
  notifications:{kicker:'ATIVIDADES',title:'Suas notificações',description:'Acompanhe as interações e novidades importantes.',icon:'◉'},
  activity:{kicker:'JORNADA',title:'Sua atividade',description:'Relembre suas participações e escolha o que será público.',icon:'✦'},
  moderation:{kicker:'PRIVACIDADE',title:'Segurança e privacidade',description:'Preferências sociais e proteção da sua conta.',icon:'⊘'},
  showcase:{kicker:'IDENTIDADE',title:'Vitrine do perfil',description:'Organize suas publicações, personagens e imagens favoritas.',icon:'✦'},
  tablefinder:{kicker:'NOVA AVENTURA',title:'Procurar mesa',description:'Encontre campanhas procurando jogadores e anuncie suas vagas.',icon:'⚔'},
  trends:{kicker:'CONVERSAS DA COMUNIDADE',title:'Assuntos em alta',description:'Acompanhe os tópicos mais comentados.',icon:'#'},
  insights:{kicker:'MINHA JORNADA',title:'Estatísticas pessoais',description:'Interações e publicações da sua conta.',icon:'◈'},
  security:{kicker:'PROTEÇÃO',title:'Segurança da conta',description:'Sessões e segundo fator de autenticação.',icon:'◇'},
  characternews:{kicker:'DIÁRIO RPG',title:'Marcos dos personagens',description:'Compartilhe a evolução dos seus personagens.',icon:'⚔'},
  administration:{kicker:'ACESSO RESTRITO',title:'Painel Administrativo',description:'Denúncias, usuários, equipe e histórico de moderação do HäxBag.',icon:'♜'},
}

export default function FriendsPanel({ campaignId, campaignName, canInvite, active = true, isSiteAdmin = false, selectedTab, onSelectTab, onViewOwnProfile, onEditOwnProfile, profileIdentity }: Props) {
  const [internalTab,setInternalTab] = useState<Tab>('feed')
  const tab = selectedTab ?? internalTab
  const setTab = (next:Tab) => {
    setInternalTab(next)
    onSelectTab?.(next)
    // A área social é longa: em telas menores, mostrar a nova aba após a navegação.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      window.requestAnimationFrame(() => document.getElementById('hb-social-page-heading')?.scrollIntoView({behavior:'smooth',block:'start'}))
    }
  }
  const [userId,setUserId] = useState('')
  const [verifiedSiteAdmin,setVerifiedSiteAdmin] = useState(false)
  useEffect(()=>{
    let live=true
    setVerifiedSiteAdmin(false)
    if(!active || !userId || !isSiteAdmin)return () => {live=false}
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('hax_v234_role')
        if (live) setVerifiedSiteAdmin(!error && data === 'admin')
      } catch {
        if (live) setVerifiedSiteAdmin(false)
      }
    })()
    return()=>{live=false}
  },[active,userId,isSiteAdmin])
  const canSeeAdministration=isSiteAdmin && verifiedSiteAdmin
  const [summary,setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [people,setPeople] = useState<Record<string,Person[]>>({})
  const [search,setSearch] = useState('')
  const [searchResults,setSearchResults] = useState<Person[]>([])
  const [searchBusy,setSearchBusy] = useState(false)
  const [filter,setFilter] = useState('')
  const [peopleOrder,setPeopleOrder] = useState<'az'|'za'>('az')
  const [chatSearch,setChatSearch] = useState('')
  const [messageSearch,setMessageSearch] = useState('')
  const [showMessageSearch,setShowMessageSearch] = useState(false)
  const [copiedMessageId,setCopiedMessageId] = useState<string|null>(null)
  const [unreadOnly,setUnreadOnly] = useState(false)
  const [posts,setPosts] = useState<Post[]>([])
  const { counts:commentCounts, updateCount:updateCommentCount } = useSocialCommentCounts(posts.map(post=>post.post_id),active && tab==='feed')
  const [avatars,setAvatars] = useState<Record<string,string>>({})
  const avatarsCacheRef = useRef(new Map<string,string>())
  const avatarsLoadingRef = useRef(new Set<string>())
  const [postText,setPostText] = useState('')
  const [draftHydrated,setDraftHydrated] = useState('')
  const composerRef = useRef<HTMLFormElement>(null)
  const [postPhotos,setPostPhotos] = useState<{file:File;preview:string;id:string}[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const postPhotosRef = useRef<{file:File;preview:string;id:string}[]>([])
  const [photoUrls,setPhotoUrls] = useState<Record<string,string>>({})
  const photoUrlsCacheRef = useRef(new Map<string,{url:string;expires:number}>())
  const [imageViewer,setImageViewer] = useState<{urls:string[];index:number;author:string}|null>(null)
  const [feedSearch,setFeedSearch] = useState('')
  const [onlyPhotos,setOnlyPhotos] = useState(false)
  const [feedOrder,setFeedOrder] = useState<'recent'|'oldest'|'popular'>('recent')
  const [readingMode,setReadingMode] = useState(false)
  const [copiedPostId,setCopiedPostId] = useState<string|null>(null)
  const [expandedPosts,setExpandedPosts] = useState<Set<string>>(() => new Set())
  const [uploadProgress,setUploadProgress] = useState('')
  const [draggingPhotos,setDraggingPhotos] = useState(false)
  const photoLimit = 4
  const photoMaxBytes = 8*1024*1024
  const bucketName = 'hax-social-posts'
  const [visibility,setVisibility] = useState<Post['visibility']>('public')
  const [feedScope,setFeedScope] = useState<'all'|'following'|'friends'|'mine'>('all')
  const [hasMore,setHasMore] = useState(false)
  const [feedBusy,setFeedBusy] = useState(false)
  const [feedLoaded,setFeedLoaded] = useState(false)
  const [likePending,setLikePending] = useState<Record<string,boolean>>({})
  const [savedLegacyIds,setSavedLegacyIds] = useState<Set<string>>(() => new Set())
  const [pinnedLegacyIds,setPinnedLegacyIds] = useState<Set<string>>(() => new Set())
  const [mutedLegacyIds,setMutedLegacyIds] = useState<Set<string>>(() => new Set())
  const [shareNonce,setShareNonce] = useState(0)
  const [editingLegacyId,setEditingLegacyId] = useState<string|null>(null)
  const [editingLegacyContent,setEditingLegacyContent] = useState('')
  const [legacyReportPost,setLegacyReportPost] = useState<Post|null>(null)
  const [legacyReportReason,setLegacyReportReason] = useState('Conteúdo inadequado')
  const [legacyReportDetails,setLegacyReportDetails] = useState('')
  const [conversations,setConversations] = useState<Conversation[]>([])
  const [selectedChat,setSelectedChat] = useState<Conversation|null>(null)
  const [chatMessages,setChatMessages] = useState<ChatMessage[]>([])
  const v245Chat=useSocialV245Chat(userId,chatMessages,active&&tab==='messages'&&!!selectedChat,async()=>{if(selectedChat)await loadMessages(selectedChat.partner_id)})
  const [messageDraft,setMessageDraft] = useState('')
  const [replyMessage,setReplyMessage] = useState<ChatMessage|null>(null)
  const [messagePhoto,setMessagePhoto] = useState<{file:File;preview:string}|null>(null)
  const [chatImageUrls,setChatImageUrls] = useState<Record<string,string>>({})
  const chatFileInputRef=useRef<HTMLInputElement>(null)
  const messagePhotoRef=useRef<{file:File;preview:string}|null>(null)
  const chatImageBucket='hax-social-chat'
  const [profile,setProfile] = useState<AdventurerRef|null>(null)
  const [busy,setBusy] = useState('')
  const [loading,setLoading] = useState(true)
  const [notice,setNotice] = useState('')
  const [error,setError] = useState('')
  const feedRequestRef = useRef(0)
  const messagesRequestRef = useRef(0)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatSearchInputRef = useRef<HTMLInputElement>(null)
  const chatLastIdRef = useRef('')
  const likeInFlightRef = useRef(new Set<string>())
  const focusComposer = () => {
    if(tab!=='feed')setTab('feed')
    window.setTimeout(()=>{
      document.getElementById('hb-v160-post-draft')?.scrollIntoView({behavior:'smooth',block:'center'})
      document.getElementById('hb-v160-post-draft')?.focus({preventScroll:true})
    },60)
  }

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
      const rows = await rpc<Post[]>('hax_social_photo_feed_v162',{p_scope:scope==='friends'?'following':scope,p_before:before,p_limit:20})
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
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Os outros relacionamentos são carregados apenas ao abrir a aba correspondente.
      const listKind = tab === 'friends' || tab === 'following' || tab === 'followers' || tab === 'blocked' ? tab : null
      await Promise.all([
        loadCounts(),
        ...(listKind ? [loadPeople(listKind)] : []),
        ...(tab === 'messages' ? [loadConversations()] : []),
      ])
      setError('')
    } catch (failure) {setError(`Não foi possível carregar a comunidade. Execute o SQL V156. ${failure instanceof Error?failure.message:String(failure)}`)}
    finally {setLoading(false)}
  },[tab,loadCounts,loadPeople,loadConversations])
  useEffect(()=>{
    if (!active) return
    let cancelled = false
    void supabase.auth.getUser().then(({data})=>{
      if (!cancelled) setUserId(data.user?.id||'')
    })
    return () => { cancelled = true }
  },[active])
  useEffect(()=>{if(active)void refresh()},[active,refresh])
  // Rascunho pessoal apenas nesta sessão do navegador. Fotos nunca são armazenadas no navegador.
  useEffect(()=>{
    if(!active||!userId)return
    try{
      const saved=window.sessionStorage.getItem(`hax-social-draft:${userId}`)
      if(saved){
        const parsed=JSON.parse(saved) as {content?:unknown;visibility?:unknown}
        if(typeof parsed.content==='string')setPostText(parsed.content.slice(0,1200))
        if(parsed.visibility==='public'||parsed.visibility==='followers'||parsed.visibility==='friends')setVisibility(parsed.visibility)
      }
    }catch{/* Navegador pode bloquear armazenamento de sessão. */}
    setDraftHydrated(userId)
  },[active,userId])
  useEffect(()=>{
    if(!userId||draftHydrated!==userId)return
    try{
      const key=`hax-social-draft:${userId}`
      if(postText.trim())window.sessionStorage.setItem(key,JSON.stringify({content:postText,visibility}))
      else window.sessionStorage.removeItem(key)
    }catch{/* Rascunhos seguem funcionando em memória. */}
  },[userId,draftHydrated,postText,visibility])
  messagePhotoRef.current=messagePhoto
  useEffect(()=>()=>{if(messagePhotoRef.current)URL.revokeObjectURL(messagePhotoRef.current.preview)},[])

  useEffect(()=>{if(active && tab==='feed')void loadFeed(null,false,feedScope)},[active,tab,feedScope,loadFeed])
  useEffect(()=>{if(active && tab==='feed' && (feedScope==='friends'||feedScope==='following'))void loadPeople(feedScope)},[active,tab,feedScope,loadPeople])
  useEffect(()=>{
    if(!active||!userId||tab!=='feed')return
    let cancelled=false
    void supabase.from('hax_v231_saved').select('post_id').eq('user_id',userId).eq('is_legacy',true).limit(500)
      .then(({data,error:failure})=>{if(!cancelled&&!failure)setSavedLegacyIds(new Set((data||[]).map(row=>String(row.post_id))))})
    return()=>{cancelled=true}
  },[active,tab,userId,posts.length])
  useEffect(()=>{
    if(!active||tab!=='feed'||!userId)return
    let live=true
    void (async()=>{
      const {data,error:failure}=await supabase.from('hax_v231_preferences').select('muted_user_ids').eq('user_id',userId).maybeSingle()
      if(live&&!failure)setMutedLegacyIds(new Set(((data?.muted_user_ids||[]) as string[])))
    })()
    return()=>{live=false}
  },[active,tab,userId])
  useEffect(()=>{
    if(!active||tab!=='feed'||!posts.length)return
    let live=true
    void (async()=>{
      const {data,error:failure}=await supabase.from('hax_social_posts').select('id,pinned').in('id',posts.map(p=>p.post_id))
      if(live&&!failure)setPinnedLegacyIds(new Set((data||[]).filter(p=>p.pinned).map(p=>p.id)))
    })()
    return()=>{live=false}
  },[active,tab,posts])
  async function editLegacyPost(event:FormEvent,post:Post){
    event.preventDefault()
    const content=editingLegacyContent.trim()
    if(!content||content.length>1200){setError('Use entre 1 e 1200 caracteres.');return}
    setBusy(`edit:${post.post_id}`);setError('')
    try{
      await rpc('hax_v249_edit_legacy_post',{p_post:post.post_id,p_content:content})
      setPosts(previous=>previous.map(item=>item.post_id===post.post_id?{...item,content}:item))
      setEditingLegacyId(null);setNotice('Publicação editada.')
    }catch(failure){setError(errorMessageV231(failure))}finally{setBusy('')}
  }
  async function pinLegacyPost(post:Post){
    setBusy(`pin:${post.post_id}`);setError('')
    try{
      const pinned=await rpc<boolean>('hax_v249_pin_legacy_post',{p_post:post.post_id})
      setPinnedLegacyIds(previous=>{const next=new Set(previous);if(pinned)next.add(post.post_id);else next.delete(post.post_id);return next})
      setNotice(pinned?'Publicação fixada.':'Publicação desafixada.')
    }catch(failure){setError(errorMessageV231(failure))}finally{setBusy('')}
  }
  async function shareLegacyPost(post:Post,mode:'repost'|'quote'){
    if(post.visibility!=='public'){setError('Somente publicações públicas podem ser compartilhadas.');return}
    const content=mode==='quote'?window.prompt('Adicione seu comentário à publicação (até 3000 caracteres):',''):'Republicou uma publicação.'
    if(content===null)return
    if(!content.trim()){setError('Escreva um comentário antes de citar.');return}
    setBusy(`share:${post.post_id}`);setError('')
    try{
      const {error:failure}=await supabase.from('hax_v231_posts').insert({author_id:userId,group_id:null,display_name:profileIdentity?.name||'Aventureiro',content:content.trim().slice(0,3000),legacy_quoted_post_id:post.post_id,share_mode:mode})
      if(failure)throw new Error(failure.message)
      setShareNonce(value=>value+1)
      setNotice(mode==='quote'?'Publicação citada no feed.':'Publicação republicada no feed.')
    }catch(failure){setError(errorMessageV231(failure))}finally{setBusy('')}
  }
  async function muteLegacyAuthor(post:Post){
    const updated=[...new Set([...mutedLegacyIds,post.author_id])]
    setBusy(`mute:${post.post_id}`);setError('')
    try{
      const {error:failure}=await supabase.from('hax_v231_preferences').upsert({user_id:userId,muted_user_ids:updated},{onConflict:'user_id'})
      if(failure)throw new Error(failure.message)
      setMutedLegacyIds(new Set(updated));setShareNonce(value=>value+1);setNotice(`As publicações de ${nameOf(post)} foram silenciadas.`)
    }catch(failure){setError(errorMessageV231(failure))}finally{setBusy('')}
  }
  async function toggleLegacySave(post:Post){
    if(!userId)return
    setBusy(`save:${post.post_id}`);setError('')
    try{
      const saved=savedLegacyIds.has(post.post_id)
      const response=saved
        ?await supabase.from('hax_v231_saved').delete().eq('user_id',userId).eq('post_id',post.post_id)
        :await supabase.from('hax_v231_saved').insert({user_id:userId,post_id:post.post_id,is_legacy:true,collection:'Favoritos',note:`${nameOf(post)}: ${post.content.slice(0,155)}`})
      if(response.error)throw new Error(response.error.message)
      setSavedLegacyIds(previous=>{const next=new Set(previous);if(saved)next.delete(post.post_id);else next.add(post.post_id);return next})
      setNotice(saved?'Removida dos salvos.':'Publicação salva na coleção Favoritos.')
    }catch(failure){setError(`Não foi possível salvar. Execute o SQL V231. ${errorMessageV231(failure)}`)}
    finally{setBusy('')}
  }
  async function reportLegacy(event:FormEvent){
    event.preventDefault();if(!legacyReportPost||!userId)return
    setBusy('report-legacy');setError('')
    try{
      const {error:failure}=await supabase.from('hax_v231_reports').insert({reporter_id:userId,target_type:'legacy_post',target_id:legacyReportPost.post_id,reason:legacyReportReason,details:legacyReportDetails.trim()})
      if(failure)throw new Error(failure.message)
      setLegacyReportPost(null);setLegacyReportDetails('');setNotice('Denúncia enviada para análise administrativa.')
    }catch(failure){setError(errorMessageV231(failure))}finally{setBusy('')}
  }

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
  useEffect(() => {
    if (showMessageSearch) chatSearchInputRef.current?.focus()
  }, [showMessageSearch])

  const openChat=useCallback((person:Conversation)=>{
    // Evita mostrar uma resposta tardia ou o rascunho de outra conversa.
    messagesRequestRef.current+=1
    chatLastIdRef.current=''
    setSelectedChat(person)
    setChatMessages([])
    setMessageDraft('')
    setReplyMessage(null)
    setMessageSearch('')
    setShowMessageSearch(false)
    setCopiedMessageId(null)
    setMessagePhoto(previous=>{if(previous)URL.revokeObjectURL(previous.preview);return null})
    setTab('messages')
  },[onSelectTab])
  const loadMessages=useCallback(async(partnerId:string)=>{
    const requestId = ++messagesRequestRef.current
    const rows=await rpc<ChatMessage[]>('hax_social_chat_messages_v172',{p_partner:partnerId,p_limit:80})
    if (requestId !== messagesRequestRef.current) return
    const ordered=[...(rows||[])].reverse()
    setChatMessages(ordered)
    const images=ordered.filter(item=>item.image_path && !item.deleted_at)
    if(images.length){
      const urls=await Promise.all(images.map(async message=>{
        const {data,error:failure}=await supabase.storage.from(chatImageBucket).createSignedUrl(String(message.image_path),3600)
        return [message.message_id,failure?'':data?.signedUrl||''] as const
      }))
      if(requestId===messagesRequestRef.current)setChatImageUrls(previous=>({...previous,...Object.fromEntries(urls)}))
    }
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
  const pickPhotos=(files:FileList|File[]|null)=>{
    if(!files)return
    const selected=Array.from(files)
    const slots=photoLimit-postPhotosRef.current.length
    if(selected.length>slots){setError(`Você pode adicionar até ${photoLimit} fotos por publicação.`)}
    const newPhotos:{file:File;preview:string;id:string}[]=[]
    for(const file of selected.slice(0,Math.max(0,slots))){
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){
        setError('Use fotos JPG, PNG, WebP ou GIF.');continue
      }
      if(file.size>photoMaxBytes){setError(`A foto ${file.name} excede 8 MB.`);continue}
      newPhotos.push({file,preview:URL.createObjectURL(file),id:crypto.randomUUID()})
    }
    setPostPhotos(current=>[...current,...newPhotos])
    if(photoInputRef.current)photoInputRef.current.value=''
  }
  useEffect(()=>{
    if(!imageViewer)return
    const handler=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setImageViewer(null)
      if(event.key==='ArrowRight')setImageViewer(view=>view?{...view,index:(view.index+1)%view.urls.length}:null)
      if(event.key==='ArrowLeft')setImageViewer(view=>view?{...view,index:(view.index-1+view.urls.length)%view.urls.length}:null)
    }
    window.addEventListener('keydown',handler)
    return()=>window.removeEventListener('keydown',handler)
  },[imageViewer])
  const removePhoto=(id:string)=>setPostPhotos(current=>{
    const removed=current.find(item=>item.id===id)
    if(removed)URL.revokeObjectURL(removed.preview)
    return current.filter(item=>item.id!==id)
  })
  const movePhoto=(index:number,direction:-1|1)=>setPostPhotos(current=>{
    const next=[...current],target=index+direction
    if(target<0||target>=next.length)return current
    ;[next[index],next[target]]=[next[target],next[index]]
    return next
  })
  postPhotosRef.current=postPhotos
  useEffect(()=>()=>{postPhotosRef.current.forEach(photo=>URL.revokeObjectURL(photo.preview))},[])
  useEffect(()=>{
    if(!active || tab!=='feed')return
    let cancelled=false
    const paths=[...new Set(posts.flatMap(post=>post.image_paths||[]))]
      .filter(path=>!photoUrlsCacheRef.current.has(path)||photoUrlsCacheRef.current.get(path)!.expires<Date.now()+60000)
    if(!paths.length)return
    const load=async()=>{
      for(let offset=0;offset<paths.length;offset+=12){
        const batch=paths.slice(offset,offset+12)
        const results=await Promise.all(batch.map(async path=>{
          const {data,error:failure}=await supabase.storage.from(bucketName).createSignedUrl(path,600)
          return {path,url:failure?'':data?.signedUrl||''}
        }))
        if(cancelled)return
        const fresh:Record<string,string>={}
        for(const result of results){
          if(result.url){photoUrlsCacheRef.current.set(result.path,{url:result.url,expires:Date.now()+600000});fresh[result.path]=result.url}
        }
        if(Object.keys(fresh).length)setPhotoUrls(current=>({...current,...fresh}))
      }
    }
    void load()
    return()=>{cancelled=true}
  },[active,tab,posts])
  async function publish(event:FormEvent){
    event.preventDefault()
    if((!postText.trim()&&!postPhotos.length)||busy||!userId)return
    setBusy('publish');setError('');setNotice('')
    const uploaded:string[]=[]
    try{
      for(const [index,item] of postPhotos.entries()){
        setUploadProgress(`Enviando foto ${index+1} de ${postPhotos.length}…`)
        const ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif' } as Record<string,string>)[item.file.type]
        if(!ext||item.file.size>photoMaxBytes)throw new Error('Imagem inválida ou maior que 8 MB.')
        const path=`${userId}/${crypto.randomUUID()}.${ext}`
        const {error:failure}=await supabase.storage.from(bucketName).upload(path,item.file,{contentType:item.file.type,upsert:false,cacheControl:'3600'})
        if(failure)throw new Error(`Não foi possível enviar a foto: ${failure.message}. Verifique se executou o SQL V162.`)
        uploaded.push(path)
      }
      await rpc('hax_social_create_photo_post_v162',{p_content:postText.trim(),p_visibility:visibility,p_image_paths:uploaded})
      for(const item of postPhotos)URL.revokeObjectURL(item.preview)
      setPostPhotos([]);setPostText('');setNotice('Publicação compartilhada com sucesso!');setTab('feed')
      if(feedScope==='all')await loadFeed(null,false,'all')
      else setFeedScope('all')
    }catch(failure){
      if(uploaded.length)await supabase.storage.from(bucketName).remove(uploaded)
      setError(failure instanceof Error?failure.message:String(failure))
    }finally{setBusy('');setUploadProgress('')}
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
  async function copyPost(post:Post){
    if(!post.content.trim())return
    try{
      await navigator.clipboard.writeText(post.content)
      setCopiedPostId(post.post_id)
      setNotice('Texto da publicação copiado.')
    }catch{
      setError('Não foi possível copiar o texto desta publicação.')
    }
  }
  async function deletePost(post:Post){
    if(!window.confirm('Excluir esta publicação?'))return
    setBusy(post.post_id);setError('')
    try{
      await rpc('hax_social_delete_post',{p_post:post.post_id})
      // A exclusão no banco é a fonte de verdade. Uma falha ao remover arquivos
      // órfãos do Storage não deve restaurar visualmente a publicação excluída.
      setPosts(previous=>previous.filter(item=>item.post_id!==post.post_id))
      setNotice('Publicação excluída.')
      if(post.image_paths?.length){
        const {error:storageError}=await supabase.storage.from(bucketName).remove(post.image_paths)
        if(storageError)console.warn('Não foi possível limpar todas as fotos da publicação excluída.',storageError)
      }
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  function chooseChatPhoto(file:File|undefined){
    if(!file)return
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){setError('Escolha uma foto JPG, PNG, WEBP ou GIF.');return}
    if(file.size>8*1024*1024){setError('A foto pode ter até 8 MB.');return}
    setMessagePhoto(previous=>{if(previous)URL.revokeObjectURL(previous.preview);return {file,preview:URL.createObjectURL(file)}})
    setError('')
  }
  async function copyChatMessage(message:ChatMessage) {
    if (message.deleted_at || message.body === '📷 Foto' || !message.body.trim()) return
    try {
      await navigator.clipboard.writeText(message.body)
      setCopiedMessageId(message.message_id)
    } catch {
      setError('Não foi possível copiar a mensagem. Verifique a permissão do navegador.')
    }
  }
  async function deleteChatMessage(message:ChatMessage){
    if(message.sender_id!==userId||!selectedChat||!window.confirm('Apagar esta mensagem para todos?'))return
    setBusy('delete-message');setError('')
    try{
      await rpc('hax_social_delete_message',{p_message_id:message.message_id})
      await loadMessages(selectedChat.partner_id)
      await loadConversations()
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  async function sendMessage(event?:{preventDefault:()=>void}){
    event?.preventDefault()
    if(!selectedChat||(!messageDraft.trim()&&!messagePhoto)||busy)return
    setBusy('send-message');setError('')
    try{
      const quotation=replyMessage&&!replyMessage.deleted_at ? `↪ ${replyMessage.body.slice(0,115).replace(/\s+/g,' ')}\n\n` : ''
      const newId=await rpc<string>('hax_social_send_message',{p_partner:selectedChat.partner_id,p_body:(quotation+(messageDraft.trim()||'📷 Foto')).slice(0,2500)})
      if(messagePhoto){
        const ext=messagePhoto.file.type==='image/png'?'png':messagePhoto.file.type==='image/gif'?'gif':messagePhoto.file.type==='image/webp'?'webp':'jpg'
        const path=`${userId}/${newId}.${ext}`
        const {error:uploadError}=await supabase.storage.from(chatImageBucket).upload(path,messagePhoto.file,{contentType:messagePhoto.file.type,upsert:false})
        if(uploadError)throw new Error(`Foto não enviada: ${uploadError.message}. A mensagem de texto pode ter sido enviada.`)
        await rpc('hax_social_attach_message_image',{p_message_id:newId,p_path:path})
        URL.revokeObjectURL(messagePhoto.preview)
        setMessagePhoto(null)
      }
      setMessageDraft('')
      setReplyMessage(null)
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
  const visiblePosts=useMemo(()=>posts.filter(post=>{
    if(feedScope==='friends'&&!((people.friends||[]).some(friend=>friend.person_id===post.author_id)))return false
    if(onlyPhotos && !(post.image_paths?.length))return false
    const term=foldText(feedSearch.trim())
    return !term||foldText(`${post.content} ${post.display_name} ${post.username}`).includes(term)
  }).sort((a,b)=>{
    const dateDifference=new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
    if (feedOrder==='popular') {
      // Ordenação local: somente publicações já carregadas, sem alterar a paginação da API.
      const engagement=(post:Post)=>Math.max(0,Number(post.like_count)||0)+Math.max(0,commentCounts[post.post_id]||0)
      return engagement(b)-engagement(a)||dateDifference
    }
    return feedOrder==='recent'?dateDifference:-dateDifference
  }),[posts,feedSearch,onlyPhotos,feedOrder,commentCounts,feedScope,people])
  const filteredConversations=useMemo(()=>conversations.filter(person=>{
    if (unreadOnly && Number(person.unread_count)===0) return false
    return foldText(`${person.display_name} ${person.username} ${person.last_message||''}`).includes(foldText(chatSearch.trim()))
  }),[conversations,chatSearch,unreadOnly])
  const visibleChatMessages=useMemo(()=>{
    const term=foldText(messageSearch.trim())
    return !term?chatMessages:chatMessages.filter(message=>!message.deleted_at && foldText(message.body).includes(term))
  },[chatMessages,messageSearch])
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
    {id:'discover',label:'⌕ Explorar'},
    {id:'communities',label:'♧ Comunidades'},
    {id:'events',label:'◷ Eventos'},
    {id:'tablefinder',label:'⚔ Procurar mesa'},
    {id:'trends',label:'# Tendências'},
    {id:'saved',label:'▤ Salvos'},
    {id:'showcase',label:'✦ Minha vitrine'},
    {id:'characternews',label:'⚔ Personagens'},
    {id:'insights',label:'◈ Estatísticas'},
    {id:'security',label:'◇ Segurança'},
    {id:'moderation',label:'⚙ Privacidade'},
    ...(canSeeAdministration ? [{id:'administration' as Tab,label:'♜ Painel Administrativo'}] : []),
    {id:'activity',label:'✦ Atividade'},
    {id:'notifications',label:'◉ Notificações'},
    {id:'messages',label:'✉ Mensagens',count:summary.unread},
    {id:'blocked',label:'⊘ Bloqueados',count:summary.blocked},
    {id:'referral',label:'✧ Convite social'},
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

  const renderLegacyFeedPost = (post: Post) => <article key={post.post_id} className="hb-social-post hb-v214-post"><div className="hb-social-post-top"><button type="button" onClick={()=>post.author_id===userId?onViewOwnProfile?.():setProfile({id:post.author_id,display_name:post.display_name,username:post.username})}>{avatarFor(post.author_id,nameOf(post))}<span><strong>{post.display_name}</strong><small>@{post.username||'aventureiro'}</small></span></button><small className="hb-v160-post-date"><time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString('pt-BR')}>{formatDate(post.created_at)}</time><span className="hb-v160-visibility">{visibilityLabels[post.visibility]}</span></small></div>{post.content&&<div className="hb-v189-post-text">
          <p id={`hb-v189-post-text-${post.post_id}`}>{post.content.length>420&&!expandedPosts.has(post.post_id)?`${post.content.slice(0,420).trimEnd()}…`:post.content}</p>
          {post.content.length>420&&<button type="button" className="hb-v189-read-more" aria-expanded={expandedPosts.has(post.post_id)} aria-controls={`hb-v189-post-text-${post.post_id}`} onClick={()=>setExpandedPosts(current=>{const next=new Set(current);if(next.has(post.post_id))next.delete(post.post_id);else next.add(post.post_id);return next})}>{expandedPosts.has(post.post_id)?'Mostrar menos ↑':'Ler publicação completa ↓'}</button>}
        </div>}{post.image_paths?.length>0&&<div className={`hb-v162-post-gallery gallery-${Math.min(post.image_paths.length,4)}`}>{post.image_paths.map((path,index)=>photoUrls[path]?<button key={path} type="button" onClick={()=>setImageViewer({urls:post.image_paths.map(p=>photoUrls[p]).filter(Boolean),index:post.image_paths.slice(0,index).filter(p=>Boolean(photoUrls[p])).length,author:nameOf(post)})} aria-label={`Ampliar foto ${index+1} da publicação`}><img src={photoUrls[path]} alt={`Foto ${index+1} da publicação de ${nameOf(post)}`} loading="lazy" /></button>:<div key={path} className="hb-v162-media-placeholder" aria-label="Carregando foto">▧</div>)}</div>}<div className="hb-v249-legacy-options">
      {pinnedLegacyIds.has(post.post_id)&&<div className="hb-v249-pinned-note">📌 Publicação fixada</div>}
      {editingLegacyId===post.post_id&&<form className="hb-v249-legacy-editor" onSubmit={event=>void editLegacyPost(event,post)}>
        <label htmlFor={`hb-v249-edit-${post.post_id}`}>Editar publicação</label>
        <textarea id={`hb-v249-edit-${post.post_id}`} maxLength={1200} value={editingLegacyContent} onChange={event=>setEditingLegacyContent(event.target.value)}/>
        <div><button type="button" onClick={()=>setEditingLegacyId(null)}>Cancelar</button><button type="submit" disabled={!!busy||!editingLegacyContent.trim()}>Salvar edição</button></div>
      </form>}
    </div>
    <footer className="hb-v249-footer"><SocialPostActionsV249
      liked={post.liked} likeCount={Number(post.like_count)} onLike={()=>void like(post)}
      comments={<SocialPostComments postId={post.post_id} count={commentCounts[post.post_id]} onCountChange={updateCommentCount} onOpenProfile={person=>person.id===userId?onViewOwnProfile?.():setProfile({id:person.id,display_name:person.display_name,username:person.username})}/>}
      saved={savedLegacyIds.has(post.post_id)} onSave={()=>void toggleLegacySave(post)}
      canShare={post.visibility==='public'} onRepost={()=>void shareLegacyPost(post,'repost')} onQuote={()=>void shareLegacyPost(post,'quote')}
      canCopy={!!post.content.trim()} onCopy={()=>void copyPost(post)} copied={copiedPostId===post.post_id}
      canEdit={post.author_id===userId} onEdit={()=>{setEditingLegacyId(post.post_id);setEditingLegacyContent(post.content)}}
      canPin={post.author_id===userId} pinned={pinnedLegacyIds.has(post.post_id)} onPin={()=>void pinLegacyPost(post)}
      canDelete={post.author_id===userId} onDelete={()=>void deletePost(post)}
      canMute={post.author_id!==userId} onMute={()=>void muteLegacyAuthor(post)}
      canReport={post.author_id!==userId} onReport={()=>setLegacyReportPost(post)}
      busy={!!busy||!!likePending[post.post_id]}
    /></footer></article>
  return <section className={`hb-friends-panel hb-social-hub hb-social-v158 hb-social-v160 hb-social-v161 hb-social-v162 hb-social-v163 hb-social-v180 hb-social-v189 hb-social-v201 hb-social-v214 hb-social-v232 hb-social-page-${tab} ${readingMode&&tab==='feed'?'hb-v214-reading-mode':''}`} aria-label="Comunidade do HäxBag">
    <div className="hb-v158-social-columns">
      <aside className="hb-v158-social-sidebar" aria-label="Sua identidade e navegação da comunidade">
        <div className="hb-v232-brand" aria-label="HäxBag Social"><span className="hb-v232-brand-glyph" aria-hidden="true">✧</span><div><strong>HäxBag <em>Social</em></strong><small>Um mundo de histórias</small></div></div>
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
        <span className="hb-v158-nav-label">DESCOBRIR</span>
        <nav className="hb-social-tabs hb-v232-primary-nav" aria-label="Descoberta e comunidade">{tabs.filter(item=>(['feed','discover','communities','events','tablefinder','trends','saved'] as Tab[]).includes(item.id)).map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
        <span className="hb-v158-nav-label">CONEXÕES</span>
        <nav className="hb-social-tabs hb-v232-network-nav" aria-label="Seus contatos e conversas">{tabs.filter(item=>(['friends','following','followers','messages','notifications'] as Tab[]).includes(item.id)).map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
        <span className="hb-v158-nav-label hb-v180-sidebar-secondary-label">SUA CONTA</span>
        <nav className="hb-social-tabs hb-v180-secondary-nav" aria-label="Atividade e privacidade">{tabs.filter(item=>(['activity','showcase','characternews','insights','security','referral','blocked','moderation'] as Tab[]).includes(item.id)).map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
        {canSeeAdministration&&<><span className="hb-v158-nav-label">ADMINISTRAÇÃO DO SITE</span><nav className="hb-social-tabs hb-v180-secondary-nav" aria-label="Administração global"><button type="button" className={tab==='administration'?'selected':''} aria-current={tab==='administration'?'page':undefined} onClick={()=>setTab('administration')}>♜ Painel Administrativo</button></nav></>}
        <div className="hb-v158-sidebar-actions">
          <button type="button" onClick={onEditOwnProfile}>✎ Personalizar meu perfil</button>
          <small>Uma amizade começa quando vocês se seguem mutuamente.</small>
        </div>
      </aside>
      <div className="hb-v158-social-content">
    <header className="hb-social-hero hb-v160-hero" id="hb-social-page-heading">
      <div className="hb-v160-hero-copy"><span className="hb-social-overline">HÄXBAG / SOCIAL / {info.kicker}</span><h2><span className="hb-v160-hero-icon" aria-hidden="true">{info.icon}</span>{info.title}</h2><p>{info.description}</p></div>
      <div className="hb-v160-hero-actions">
        {tab!=='feed'&&<button type="button" className="hb-v160-hero-main" onClick={()=>setTab('feed')}>✦ Ver feed</button>}
        {tab==='feed'&&<button type="button" className="hb-v160-hero-main" onClick={()=>setTab('discover')}>⌕ Encontrar pessoas</button>}
        <button type="button" className="hb-v160-refresh" aria-label="Atualizar esta página" title="Atualizar esta página" onClick={()=>{void refresh();if(tab==='feed')void loadFeed(null,false,feedScope);if(tab==='messages'&&selectedChat)void loadMessages(selectedChat.partner_id)}} disabled={loading}>{loading?'…':'↻'}<span>Atualizar</span></button>
      </div>
    </header>
    <div className="hb-v180-quickbar hb-v214-quickbar" role="group" aria-label="Atalhos do Social">
      <button type="button" className="hb-v180-quickbar-primary" onClick={focusComposer}><span aria-hidden="true">✎</span> Nova publicação</button>
      <button type="button" className={tab==='discover'?'is-active':''} onClick={()=>setTab('discover')}><span aria-hidden="true">⌕</span> Explorar</button>
      <button type="button" className={tab==='communities'?'is-active':''} onClick={()=>setTab('communities')}><span aria-hidden="true">♧</span> Comunidades</button>
      <button type="button" className={tab==='events'?'is-active':''} onClick={()=>setTab('events')}><span aria-hidden="true">◷</span> Eventos</button><button type="button" className={tab==='tablefinder'?'is-active':''} onClick={()=>setTab('tablefinder')}><span aria-hidden="true">⚔</span> Procurar mesa</button>
      <button type="button" className={tab==='saved'?'is-active':''} onClick={()=>setTab('saved')}><span aria-hidden="true">▤</span> Salvos</button>
      <button type="button" className={tab==='messages'?'is-active':''} onClick={()=>setTab('messages')}><span aria-hidden="true">✉</span> Mensagens {summary.unread>0&&<em>{summary.unread}</em>}</button>
    </div>
    <div className="hb-social-stats hb-v160-stats" aria-label="Resumo das conexões">
      {([{id:'following',icon:'↗',count:summary.following,label:'Seguindo'}, {id:'followers',icon:'↙',count:summary.followers,label:'Seguidores'}, {id:'friends',icon:'♧',count:summary.friends,label:'Amigos'}, {id:'messages',icon:'✉',count:summary.unread,label:'Não lidas'}] as const).map(stat=><button key={stat.id} type="button" className={tab===stat.id?'is-current':''} onClick={()=>setTab(stat.id)} aria-label={`${stat.count} ${stat.label}. Abrir ${stat.id==='messages'?'mensagens':stat.label.toLowerCase()}`}><span className="hb-v160-stat-icon" aria-hidden="true">{stat.icon}</span><span><strong>{stat.count}</strong><small>{stat.label}</small></span><span className="hb-v160-stat-arrow" aria-hidden="true">↗</span></button>)}
    </div>
    
    {error&&<div className="hb-social-alert hb-v160-alert" role="alert"><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Dispensar aviso de erro">✕</button></div>}
    {notice&&<div className="hb-social-notice hb-v160-alert" role="status"><span>{notice}</span><button type="button" onClick={()=>setNotice('')} aria-label="Dispensar confirmação">✕</button></div>}

    {tab==='feed'&&<div className="hb-social-feed-layout">
      <section className="hb-social-feed-main">
        <form ref={composerRef} className={`hb-social-composer hb-v160-composer ${draggingPhotos?'hb-v162-dragging':''}`} onSubmit={e=>void publish(e)} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setDraggingPhotos(true)}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDraggingPhotos(false)}} onDrop={e=>{e.preventDefault();setDraggingPhotos(false);const droppedFiles:File[]=Array.from(e.dataTransfer.files);pickPhotos(droppedFiles.filter((file:File)=>file.type.startsWith('image/')))}}>
          <div className="hb-v160-composer-author">{avatarFor(userId,profileIdentity?.name||'A')}<div><strong>{profileIdentity?.name||'Você'}</strong><small>Compartilhe seus momentos com a comunidade</small></div></div>
          <label htmlFor="hb-v160-post-draft" className="hb-v160-editor-label">O que está acontecendo na sua jornada?</label>
          <textarea id="hb-v160-post-draft" rows={3} maxLength={1200} placeholder="Conte uma conquista, compartilhe uma aventura ou convide alguém para conversar…" value={postText} onChange={e=>setPostText(e.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();composerRef.current?.requestSubmit()}}}/>
          <input ref={photoInputRef} className="hb-v162-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={event=>pickPhotos(event.target.files)} aria-label="Selecionar fotos para a publicação" />
          {postPhotos.length>0&&<div className="hb-v162-preview-grid" aria-label="Fotos selecionadas">{postPhotos.map((item,index)=><div className="hb-v162-preview" key={item.id}><img src={item.preview} alt={`Prévia da foto ${index+1}`} /><button type="button" onClick={()=>removePhoto(item.id)} title="Remover foto" aria-label={`Remover foto ${index+1}`}>×</button><div className="hb-v163-photo-order"><button type="button" disabled={index===0} onClick={()=>movePhoto(index,-1)} aria-label={`Mover foto ${index+1} para a esquerda`}>←</button><span>{index+1}</span><button type="button" disabled={index===postPhotos.length-1} onClick={()=>movePhoto(index,1)} aria-label={`Mover foto ${index+1} para a direita`}>→</button></div></div>)}</div>}
          <div className="hb-v162-photo-tools"><button type="button" className="hb-v162-photo-pick" onClick={()=>photoInputRef.current?.click()} disabled={postPhotos.length>=photoLimit||!!busy}>▧ {postPhotos.length?'Adicionar mais fotos':'Adicionar fotos'} <small>{postPhotos.length}/{photoLimit}</small></button><span>JPG, PNG, WebP ou GIF · até 8 MB cada</span></div>
          <div className="hb-v180-draft-actions"><span>✧ Rascunho de texto guardado nesta sessão · Ctrl + Enter para publicar</span>{postText.trim()&&<button type="button" onClick={()=>setPostText('')}>Limpar texto</button>}</div>
          <div className="hb-v160-writing-prompts" aria-label="Ideias para publicar"><span>Ideias:</span>{['✧ Minha aventura de hoje: ','⚔ Procuro uma mesa de RPG! ','✦ Uma conquista para compartilhar: '].map((template,index)=><button key={index} type="button" onClick={()=>setPostText(value=>value || template)}>{['Minha aventura','Procurar mesa','Conquista'][index]}</button>)}</div>
          <div className="hb-social-composer-bottom"><label>Visibilidade<select value={visibility} onChange={e=>setVisibility(e.target.value as Post['visibility'])} aria-label="Quem pode ver esta publicação"><option value="public">🌐 Todas as contas</option><option value="followers">↗ Seguidores</option><option value="friends">♧ Apenas amigos</option></select></label><div className="hb-v160-composer-submit"><span className={postText.length>1080?'near-limit':''}>{postText.length} / 1200</span><button className="hb-social-primary-action" type="submit" disabled={(!postText.trim()&&!postPhotos.length)||!!busy}>{busy==='publish'?(uploadProgress||'Publicando…'):'Publicar ✦'}</button></div></div>
        </form>
        <div className="hb-social-feed-header hb-v214-feed-heading"><div><span className="hb-social-overline">LINHA DO TEMPO</span><h3>Publicações da comunidade</h3><small className="hb-v214-feed-caption">Histórias, personagens, enquetes e fotos em uma só linha do tempo.</small></div><div className="hb-social-segments" role="group" aria-label="Filtrar publicações">{([['all','Comunidade'],['following','Seguindo'],['friends','Amigos'],['mine','Minhas']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={feedScope===key} className={feedScope===key?'selected':''} onClick={()=>setFeedScope(key)}>{label}</button>)}</div></div>
        <div className="hb-v163-feed-tools hb-v214-feed-tools"><label className="hb-v163-feed-search"><span>⌕</span><input type="search" placeholder="Buscar nas publicações carregadas…" aria-label="Buscar no feed" value={feedSearch} onChange={e=>setFeedSearch(e.target.value)} /></label><label className="hb-v163-photo-filter"><input type="checkbox" checked={onlyPhotos} onChange={e=>setOnlyPhotos(e.target.checked)} />▧ Com fotos</label><label className="hb-v163-post-order">Ordem <select value={feedOrder} onChange={e=>setFeedOrder(e.target.value as 'recent'|'oldest'|'popular')}><option value="recent">Mais recentes</option><option value="popular">Mais interações</option><option value="oldest">Mais antigas</option></select></label><button type="button" className={`hb-v214-reading-toggle ${readingMode?'is-on':''}`} aria-pressed={readingMode} title={readingMode?'Voltar ao layout normal':'Ampliar a área de leitura'} onClick={()=>setReadingMode(value=>!value)}><span aria-hidden="true">{readingMode?'◧':'▤'}</span> {readingMode?'Visão normal':'Modo leitura'}</button></div>
        <SocialV231Suite page="feed" userId={userId} profileName={profileIdentity?.name}
          onNavigate={next=>setTab(next)}
          onViewProfile={id=>{if(id===userId)onViewOwnProfile?.();else setProfile({id,display_name:'Aventureiro'})}}
          legacyPosts={feedLoaded?visiblePosts.filter(post=>!mutedLegacyIds.has(post.author_id)).map(post=>({...post,pinned:pinnedLegacyIds.has(post.post_id),engagement:Math.max(0,Number(post.like_count)||0)+Math.max(0,commentCounts[post.post_id]||0)})):[]} renderLegacyPost={id=>{const post=visiblePosts.find(item=>item.post_id===id&&!mutedLegacyIds.has(item.author_id));return post?renderLegacyFeedPost(post):null}}
          feedScope={feedScope} feedSearch={feedSearch} onlyPhotos={onlyPhotos} feedOrder={feedOrder}
          followingUserIds={(people.following||[]).map(person=>person.person_id)}
          friendsUserIds={(people.friends||[]).map(person=>person.person_id)}
          refreshNonce={shareNonce} legacyLoading={!feedLoaded||feedBusy}
          onRefreshLegacy={()=>void loadFeed(null,false,feedScope)} onSearchFeed={setFeedSearch}
          onMuteAuthor={id=>setMutedLegacyIds(previous=>new Set([...previous,id]))} />
        {feedOrder==='popular'&&<p className="hb-v189-sort-hint">✦ Mais interações considera curtidas e comentários dos registros já carregados.</p>}

        {feedBusy&&<div className="hb-v160-skeletons" aria-label="Carregando publicações" aria-busy="true"><div/><div/></div>}
        {hasMore&&!feedBusy&&<button className="hb-social-load-more" type="button" onClick={()=>void loadFeed(posts.at(-1)?.created_at||null,true,feedScope)}>Mostrar mais publicações</button>}
      </section><aside className="hb-social-feed-aside"><span className="hb-social-overline">SEU CÍRCULO</span><h3>Histórias se conectam.</h3><p>Explore a comunidade e acompanhe as aventuras de quem você segue. O chat privado abre quando o seguimento é mútuo.</p><div className="hb-v158-aside-stats"><span><strong>{summary.followers}</strong> seguidores</span><span><strong>{summary.friends}</strong> amigos</span></div><span className="hb-v232-aside-label">CONTINUE EXPLORANDO</span><div className="hb-v232-aside-links"><button type="button" onClick={()=>setTab('discover')}><span aria-hidden="true">⌕</span> Encontrar aventureiros <span aria-hidden="true">↗</span></button><button type="button" onClick={()=>setTab('communities')}><span aria-hidden="true">♧</span> Comunidades <span aria-hidden="true">↗</span></button><button type="button" onClick={()=>setTab('events')}><span aria-hidden="true">◷</span> Eventos e sessões <span aria-hidden="true">↗</span></button><button type="button" onClick={()=>setTab('messages')}><span aria-hidden="true">✉</span> Mensagens {summary.unread>0?`(${summary.unread})`:''} <span aria-hidden="true">↗</span></button></div><div className="hb-social-privacy-note">◈ Você escolhe se cada publicação será pública, para seguidores ou apenas para amigos. Bloqueios valem nos dois sentidos.</div></aside></div>}

    {(['friends','following','followers','blocked'] as Tab[]).includes(tab)&&<section className="hb-social-list-pane hb-v214-people-page"><div className="hb-social-pane-top"><div><span className="hb-social-overline">SEU CÍRCULO</span><h3>{{friends:'Amigos mútuos',following:'Quem você segue',followers:'Quem segue você',blocked:'Contas bloqueadas'}[tab as 'friends'|'following'|'followers'|'blocked']}</h3><p>{tab==='friends'?'Vocês se seguem mutuamente e podem conversar em particular.':tab==='following'?'Pessoas cujas novidades você quer acompanhar.':tab==='followers'?'Pessoas que escolheram acompanhar seu perfil.':'Você pode desbloquear essas contas quando quiser.'}</p></div><span className="hb-v160-result-count">{filteredPeople.length} {filteredPeople.length===1?'perfil':'perfis'}</span></div>
      <div className="hb-v160-people-tools"><label>Buscar nesta lista<input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Nome ou @usuário" /></label><label>Ordenar<select value={peopleOrder} onChange={e=>setPeopleOrder(e.target.value as 'az'|'za')}><option value="az">Nome: A → Z</option><option value="za">Nome: Z → A</option></select></label></div><div className="hb-social-people hb-v160-people-grid">{filteredPeople.map(person=>peopleCard(person,tab))}</div>{!filteredPeople.length&&!loading&&<div className="hb-social-empty hb-v160-empty"><strong>Nenhum resultado.</strong><p>{filter?'Tente outro termo de busca.':tab==='blocked'?'Você não bloqueou ninguém.':'Explore outros perfis para ampliar sua rede.'}</p>{tab!=='blocked'&&<button type="button" onClick={()=>setTab('discover')}>Descobrir jogadores</button>}</div>}</section>}

    {tab==='discover'&&<section className="hb-social-list-pane hb-v214-discover"><div className="hb-social-pane-top"><div><span className="hb-social-overline">NOVAS CONEXÕES</span><h3>Descobrir aventureiros</h3><p>Busque por nome ou @usuário. Não são exibidas pessoas com quem você tenha bloqueio.</p></div></div><label className="hb-social-search-label hb-v160-discover-search"><span>Pesquisar jogadores</span><span className="hb-v160-search-input"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome ou @usuário — ao menos 2 caracteres" autoComplete="off" /></span></label>
      <div className="hb-v160-discover-note">✦ Encontrou alguém interessante? Siga essa pessoa. Se ela seguir você de volta, vocês se tornam amigos e podem conversar por mensagens.</div>{searchBusy&&<p className="hb-social-loading">Procurando aventureiros…</p>}<div className="hb-social-people hb-v160-people-grid">{searchResults.map(person=>peopleCard(person,'discover'))}</div><SocialV231Suite page="discover" userId={userId} profileName={profileIdentity?.name} onNavigate={next=>setTab(next)}/>{search.trim().length<2&&<div className="hb-social-empty hb-v160-empty"><strong>Conheça outros mundos.</strong><p>Digite o nome ou identificador de quem você quer encontrar.</p></div>}{search.trim().length>=2&&!searchBusy&&!searchResults.length&&<div className="hb-social-empty"><strong>Nenhum perfil encontrado.</strong><p>Confira a grafia ou tente outro nome.</p></div>}</section>}

    {tab==='administration'&&(canSeeAdministration
      ? <SiteAdministrationV234 userId={userId} onViewProfile={id=>{if(id===userId)onViewOwnProfile?.();else setProfile({id,display_name:'Aventureiro'})}} />
      : <section className="hb-social-empty" role="alert"><h3>Área restrita</h3><p>O Painel Administrativo é exclusivo dos administradores globais do HäxBag.</p><button type="button" onClick={()=>setTab('feed')}>Voltar ao Social</button></section>)}
    {(['communities','saved','events','notifications','activity','moderation'] as SocialV231Page[]).includes(tab as SocialV231Page)&&<SocialV231Suite page={tab as SocialV231Page} userId={userId} profileName={profileIdentity?.name} onNavigate={next=>setTab(next)} onViewProfile={id=>{if(id===userId)onViewOwnProfile?.();else setProfile({id,display_name:'Aventureiro'})}}/>}
    {(['showcase','tablefinder','trends','insights','security','characternews'] as Tab[]).includes(tab)&&<SocialExpansionV245 page={tab as 'showcase'|'tablefinder'|'trends'|'insights'|'security'|'characternews'} userId={userId} onViewProfile={id=>id===userId?onViewOwnProfile?.():setProfile({id,display_name:'Aventureiro'})} onNavigate={next=>setTab(next)}/>}

    {tab==='messages'&&<section className={`hb-social-chat-shell hb-v160-chat hb-v201-chat ${selectedChat?'has-active-chat':''}`} aria-label="Mensagens privadas">
      <aside className="hb-social-chat-sidebar" aria-label="Seus contatos">
        <div className="hb-v201-chat-side-heading">
          <div>
            <span className="hb-social-overline">SUA CAIXA DE ENTRADA</span>
            <h3>Mensagens <span className="hb-v201-chat-contact-count">{conversations.length}</span></h3>
            <p>Converse com amigos que seguem você de volta.</p>
          </div>
        </div>
        <label className="hb-v160-chat-search hb-v201-chat-contact-search">
          <span>Buscar conversas</span>
          <div className="hb-v201-chat-search-field"><span aria-hidden="true">⌕</span><input type="search" value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Nome, @usuário ou mensagem" autoComplete="off" /></div>
        </label>
        <label className="hb-v160-unread-toggle hb-v201-chat-unread-toggle">
          <input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/>
          <span>Somente não lidas</span>{summary.unread>0&&<strong>{summary.unread}</strong>}
        </label>
        <div className="hb-v160-contact-list hb-v201-chat-contact-list">
          {filteredConversations.map(person=><button type="button" key={person.partner_id} aria-current={selectedChat?.partner_id===person.partner_id?'true':undefined} className={`hb-social-chat-contact ${selectedChat?.partner_id===person.partner_id?'selected':''}`} onClick={()=>openChat(person)}>
            {avatarFor(person.partner_id,nameOf(person))}
            <span className="hb-v201-contact-info"><span className="hb-v201-contact-title"><strong>{person.display_name}</strong>{person.last_at&&<time dateTime={person.last_at} title={new Date(person.last_at).toLocaleString('pt-BR')}>{new Date(person.last_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</time>}</span><small>{person.last_message||'Comece uma conversa'}</small></span>
            {Number(person.unread_count)>0&&<em aria-label={`${person.unread_count} mensagens não lidas`}>{person.unread_count}</em>}
          </button>)}
          {!filteredConversations.length&&!!conversations.length&&<div className="hb-v201-contact-empty"><span aria-hidden="true">⌕</span><strong>Nenhuma conversa encontrada</strong><p>Experimente alterar a busca ou o filtro de não lidas.</p>{(chatSearch||unreadOnly)&&<button type="button" onClick={()=>{setChatSearch('');setUnreadOnly(false)}}>Limpar filtros</button>}</div>}
          {!conversations.length&&<div className="hb-v201-contact-empty"><span aria-hidden="true">✉</span><strong>Suas conversas aparecerão aqui</strong><p>Siga alguém que também segue você para conversar em particular.</p><button type="button" onClick={()=>setTab('friends')}>Ver amigos</button></div>}
        </div>
      </aside>
      <div className="hb-social-chat-main hb-v214-chat-main">
        {selectedChat?<>
          <header className="hb-v201-chat-header">
            <div className="hb-v160-chat-header-identity">
              <button type="button" className="hb-v160-chat-back" aria-label="Voltar para conversas" onClick={()=>{messagesRequestRef.current+=1;setSelectedChat(null);setChatMessages([]);setMessageDraft('');setMessageSearch('');setShowMessageSearch(false);setCopiedMessageId(null);setMessagePhoto(previous=>{if(previous)URL.revokeObjectURL(previous.preview);return null})}}>‹</button>
              {avatarFor(selectedChat.partner_id,nameOf(selectedChat))}
              <span><strong>{selectedChat.display_name}</strong><small>@{selectedChat.username||'aventureiro'} <span className="hb-v201-chat-private-label">· Conversa privada</span></small></span>
            </div>
            <div className="hb-v201-chat-header-actions">
              <button type="button" className={showMessageSearch?'is-active':''} aria-expanded={showMessageSearch} aria-controls="hb-v201-chat-search" onClick={()=>{if(showMessageSearch)setMessageSearch('');setShowMessageSearch(value=>!value)}}><span aria-hidden="true">⌕</span> <span>Buscar</span></button>
              <button type="button" onClick={()=>setProfile({id:selectedChat.partner_id,display_name:selectedChat.display_name,username:selectedChat.username})}>Ver perfil <span aria-hidden="true">↗</span></button>
            </div>
          </header>
          {showMessageSearch&&<div id="hb-v201-chat-search" className="hb-v189-message-search hb-v201-message-search">
            <label htmlFor="hb-v201-search-messages">Buscar nas últimas mensagens carregadas</label>
            <div><input ref={chatSearchInputRef} id="hb-v201-search-messages" type="search" value={messageSearch} onChange={event=>setMessageSearch(event.target.value)} placeholder="Digite uma palavra ou trecho da conversa…" />{messageSearch&&<button type="button" onClick={()=>setMessageSearch('')}>Limpar</button>}</div>
            {messageSearch&&<small>{visibleChatMessages.length} {visibleChatMessages.length===1?'resultado encontrado':'resultados encontrados'} em {chatMessages.length} mensagens carregadas.</small>}
          </div>}
          {v245Chat.error&&<div className="hb-v245-chat-hint" role="status">Não foi possível carregar um recurso do chat: {v245Chat.error}</div>}
          {v245Chat.pins.length>0&&<div className="hb-v245-pinned-bar"><strong>◇ Mensagens fixadas</strong>{chatMessages.filter(m=>v245Chat.pins.some(p=>p.message_id===m.message_id)).slice(-3).map(m=><button key={m.message_id} type="button" onClick={()=>{setMessageSearch(m.body.slice(0,30));setShowMessageSearch(true)}}>{m.body.slice(0,65)||'Imagem fixada'}</button>)}</div>}
          <div className="hb-social-chat-messages hb-v201-chat-messages" ref={chatScrollRef} aria-label={`Mensagens com ${selectedChat.display_name}`} aria-live="polite">
            {visibleChatMessages.map((message,index)=>{
              const previous=visibleChatMessages[index-1]
              const sameDay=previous&&dayOf(previous.created_at)===dayOf(message.created_at)
              const grouped=Boolean(previous&&sameDay&&previous.sender_id===message.sender_id&&new Date(message.created_at).getTime()-new Date(previous.created_at).getTime()<5*60*1000)
              const own=message.sender_id===userId
              return <div className={`hb-v160-message-row hb-v201-message-row ${grouped?'is-grouped':''}`} key={message.message_id}>
                {!sameDay&&<div className="hb-v160-chat-day" role="separator"><span>{dayOf(message.created_at)}</span></div>}
                <div className={`hb-v161-chat-message ${own?'own':''}`}>
                  {grouped?<span className="hb-v201-chat-avatar-spacer" aria-hidden="true"/>:avatarFor(message.sender_id,own?(profileIdentity?.name||'Você'):nameOf(selectedChat))}
                  <div className={`hb-social-bubble ${own?'own':''} ${message.image_path?'has-photo':''} ${message.deleted_at?'is-deleted':''}`}>
                    {message.deleted_at?<p className="hb-v201-deleted-text"><em>Mensagem apagada</em></p>:<>
                      {message.image_path&&(chatImageUrls[message.message_id]?<a className="hb-v201-chat-image-link" href={chatImageUrls[message.message_id]} target="_blank" rel="noopener noreferrer" title="Abrir foto em tamanho maior"><img className="hb-v172-chat-image" src={chatImageUrls[message.message_id]} alt={`Foto enviada por ${own?'você':selectedChat.display_name}`} loading="lazy" /></a>:<span className="hb-v201-image-loading">Carregando imagem…</span>)}
                      {message.body!=='📷 Foto'&&<p>{message.body}</p>}
                    </>}
                    {v245Chat.reactions.some(r=>r.message_id===message.message_id)&&<div className="hb-v245-chat-reactions">{v245Chat.emojiOptions.filter(emoji=>v245Chat.reactions.some(r=>r.message_id===message.message_id&&r.emoji===emoji)).map(emoji=><button type="button" key={emoji} disabled={v245Chat.busy} className={v245Chat.reactions.some(r=>r.message_id===message.message_id&&r.user_id===userId&&r.emoji===emoji)?'is-selected':''} onClick={()=>void v245Chat.react(message.message_id,emoji)}>{emoji} {v245Chat.reactions.filter(r=>r.message_id===message.message_id&&r.emoji===emoji).length}</button>)}</div>}
                    <div className="hb-v201-message-footer">
                      {!message.deleted_at&&<div className="hb-v201-message-tools"><details className="hb-v245-chat-react-menu"><summary aria-label="Reagir à mensagem">☺ Reagir</summary><div>{v245Chat.emojiOptions.map(emoji=><button key={emoji} type="button" disabled={v245Chat.busy} onClick={()=>void v245Chat.react(message.message_id,emoji)}>{emoji}</button>)}</div></details>
                        <button type="button" disabled={v245Chat.busy} onClick={()=>void v245Chat.pin(message.message_id)}>{v245Chat.pins.some(p=>p.message_id===message.message_id)?'◉ Desafixar':'◇ Fixar'}</button>
                        {own&&!message.image_path&&new Date(message.created_at).getTime()>Date.now()-900000&&<button type="button" disabled={v245Chat.busy} onClick={()=>void v245Chat.edit(message.message_id,message.body)}>Editar</button>}
<button type="button" onClick={()=>{setReplyMessage(message);setMessageDraft(value=>value)}}>↪ Responder</button>
                        {message.body!=='📷 Foto'&&Boolean(message.body.trim())&&<button className="hb-v189-copy-message" type="button" onClick={()=>void copyChatMessage(message)} aria-label="Copiar texto desta mensagem">{copiedMessageId===message.message_id?'✓ Copiado':'⧉ Copiar'}</button>}
                        {own&&<button className="hb-v172-delete-message" type="button" disabled={!!busy} onClick={()=>void deleteChatMessage(message)} title="Apagar mensagem para todos">Apagar</button>}
                      </div>}
                      <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString('pt-BR')}>{new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{own&&message.read_at?' · Lida':''}</time>
                    </div>
                  </div>
                </div>
              </div>
            })}
            {!chatMessages.length&&<div className="hb-social-empty hb-v201-chat-empty"><span aria-hidden="true">✉</span><strong>Uma conversa começa com uma mensagem.</strong><p>Envie uma mensagem ou uma imagem para {selectedChat.display_name}.</p></div>}
            {messageSearch.trim()&&chatMessages.length>0&&!visibleChatMessages.length&&<div className="hb-social-empty hb-v189-message-empty hb-v201-chat-empty"><strong>Nenhuma mensagem encontrada.</strong><p>A busca considera as últimas {chatMessages.length} mensagens carregadas desta conversa.</p><button type="button" onClick={()=>setMessageSearch('')}>Mostrar todas</button></div>}
          </div>
          {selectedChat.can_message?<form onSubmit={e=>void sendMessage(e)} className="hb-social-chat-compose hb-v201-chat-compose" aria-label="Escrever mensagem privada">
            <input ref={chatFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{display:'none'}} onChange={event=>{chooseChatPhoto(event.target.files?.[0]);event.target.value=''}} />
            {replyMessage&&<div className="hb-v231-reply-preview"><span>↪ Respondendo: {replyMessage.body.slice(0,120)}</span><button type="button" onClick={()=>setReplyMessage(null)}>Cancelar</button></div>}
            {messagePhoto&&<div className="hb-v172-chat-preview"><img src={messagePhoto.preview} alt="Prévia da foto"/><span>{messagePhoto.file.name}</span><button type="button" onClick={()=>{URL.revokeObjectURL(messagePhoto.preview);setMessagePhoto(null)}}>Remover imagem</button></div>}
            <div className="hb-v201-chat-composer-row">
              <button type="button" className="hb-v172-photo-button" title="Anexar uma foto" aria-label="Anexar uma foto" onClick={()=>chatFileInputRef.current?.click()} disabled={!!busy}><span aria-hidden="true">▧</span> <span>Foto</span></button>
              <label className="hb-v201-chat-textbox"><span className="hb-v201-sr-only">Sua mensagem</span><textarea rows={2} maxLength={2500} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Escreva uma mensagem…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void sendMessage()}}}/></label>
              <button type="submit" className="hb-v201-chat-send" disabled={(!messageDraft.trim()&&!messagePhoto)||!!busy}>{busy==='send-message'?'Enviando…':<>Enviar <span aria-hidden="true">↗</span></>}</button>
            </div>
            <div className="hb-v201-chat-compose-hint"><span>Enter para enviar · Shift + Enter para nova linha</span><span>{messageDraft.length}/2500</span></div>
          </form>:<div className="hb-social-chat-disabled">Para enviar novas mensagens, vocês precisam se seguir mutuamente.</div>}
        </>:<div className="hb-social-chat-welcome hb-v201-chat-welcome"><span aria-hidden="true">✉</span><strong>Suas conversas, em particular.</strong><p>Escolha uma conversa à esquerda para trocar mensagens e fotos com seus amigos.</p><button type="button" onClick={()=>setTab('friends')}>Ver meus amigos</button></div>}
      </div>
    </section>}

    {tab==='referral'&&<SocialReferralPanel active={active&&tab==='referral'}/>}

      </div>
    </div>
    {imageViewer&&<div className="hb-v162-lightbox hb-v163-lightbox" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setImageViewer(null)}}><div role="dialog" aria-modal="true" aria-label="Visualizar foto da publicação"><button type="button" className="hb-v162-close-lightbox" onClick={()=>setImageViewer(null)} aria-label="Fechar imagem ampliada">×</button><img src={imageViewer.urls[imageViewer.index]} alt={`Foto ${imageViewer.index+1} de ${imageViewer.urls.length}, publicação de ${imageViewer.author}`} /><div className="hb-v163-viewer-controls">{imageViewer.urls.length>1&&<button type="button" onClick={()=>setImageViewer(view=>view?{...view,index:(view.index-1+view.urls.length)%view.urls.length}:null)} aria-label="Foto anterior">←</button>}<span>{imageViewer.author} · {imageViewer.index+1} / {imageViewer.urls.length}</span>{imageViewer.urls.length>1&&<button type="button" onClick={()=>setImageViewer(view=>view?{...view,index:(view.index+1)%view.urls.length}:null)} aria-label="Próxima foto">→</button>}</div></div></div>}
    {legacyReportPost&&<div className="hb-v231-report-backdrop" role="presentation" onClick={event=>{if(event.target===event.currentTarget)setLegacyReportPost(null)}}><form role="dialog" aria-modal="true" aria-label="Denunciar publicação" className="hb-v231-report-dialog hb-v231-form" onSubmit={e=>void reportLegacy(e)}><h3>⚑ Denunciar publicação</h3><label>Motivo<select value={legacyReportReason} onChange={e=>setLegacyReportReason(e.target.value)}><option>Conteúdo inadequado</option><option>Assédio ou ameaças</option><option>Spam</option><option>Imitação de identidade</option><option>Violação de privacidade</option><option>Outro motivo</option></select></label><label>Detalhes<textarea rows={3} maxLength={1200} value={legacyReportDetails} onChange={e=>setLegacyReportDetails(e.target.value)}/></label><div className="hb-v231-inline-actions"><button type="button" onClick={()=>setLegacyReportPost(null)}>Cancelar</button><button type="submit" disabled={!!busy}>Enviar denúncia</button></div></form></div>}
    {profile&&<PublicAdventurerProfile person={profile} onClose={()=>setProfile(null)} onFriendUpdate={()=>{void refresh();void loadFeed(null,false,feedScope)}} onMessage={person=>{
      setProfile(null)
      const current=conversations.find(c=>c.partner_id===person.id)||{partner_id:person.id,display_name:person.display_name,username:person.username||'',last_message:null,last_at:null,unread_count:0,can_message:true}
      openChat(current)
    }} campaigns={canInvite&&campaignId?[{id:campaignId,name:campaignName}]:[]}/>}
  </section>
}
