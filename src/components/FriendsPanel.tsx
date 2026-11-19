import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import PublicAdventurerProfile, { type AdventurerRef } from './PublicAdventurerProfile'
import './FriendsPanel.css'
import './SocialV156.css'
import './SocialV160.css'
import './SocialV161.css'
import './SocialV162.css'
import './SocialV163.css'
import './SocialV180.css'
import './SocialV189.css'
import SocialReferralPanel from './SocialReferralPanel'
import SocialPostComments, { useSocialCommentCounts } from './SocialPostComments'

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
export type SocialTab = 'feed'|'friends'|'following'|'followers'|'discover'|'messages'|'blocked'|'referral'
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
  referral:{kicker:'CONVITE SOCIAL',title:'Convide pessoas para o HäxBag',description:'Seu link pessoal de convite e o progresso da insígnia Embaixador.',icon:'✧'},
}

export default function FriendsPanel({ campaignId, campaignName, canInvite, active = true, selectedTab, onSelectTab, onViewOwnProfile, onEditOwnProfile, profileIdentity }: Props) {
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
  const [summary,setSummary] = useState<Summary>(EMPTY_SUMMARY)
  const [people,setPeople] = useState<Record<string,Person[]>>({})
  const [search,setSearch] = useState('')
  const [searchResults,setSearchResults] = useState<Person[]>([])
  const [searchBusy,setSearchBusy] = useState(false)
  const [filter,setFilter] = useState('')
  const [peopleOrder,setPeopleOrder] = useState<'az'|'za'>('az')
  const [chatSearch,setChatSearch] = useState('')
  const [messageSearch,setMessageSearch] = useState('')
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
  const [expandedPosts,setExpandedPosts] = useState<Set<string>>(() => new Set())
  const [uploadProgress,setUploadProgress] = useState('')
  const [draggingPhotos,setDraggingPhotos] = useState(false)
  const photoLimit = 4
  const photoMaxBytes = 8*1024*1024
  const bucketName = 'hax-social-posts'
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
      const rows = await rpc<Post[]>('hax_social_photo_feed_v162',{p_scope:scope,p_before:before,p_limit:20})
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
    setMessageSearch('')
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
      const newId=await rpc<string>('hax_social_send_message',{p_partner:selectedChat.partner_id,p_body:messageDraft.trim()||'📷 Foto'})
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
      await loadMessages(selectedChat.partner_id)
      await loadConversations()
    }catch(failure){setError(failure instanceof Error?failure.message:String(failure))}
    finally{setBusy('')}
  }
  const currentPeople=people[tab]||EMPTY_PEOPLE
  const filteredPeople=useMemo(()=>{
    const term=foldText(filter.trim())
    return currentPeople
      .filter(p=>!term||foldText(`${p.display_name} ${p.username}`).includes(term))
      .sort((a,b)=>peopleOrder==='az' ? nameOf(a).localeCompare(nameOf(b),'pt-BR') : nameOf(b).localeCompare(nameOf(a),'pt-BR'))
  },[currentPeople,filter,peopleOrder])
  const visiblePosts=useMemo(()=>{
    const term=foldText(feedSearch.trim())
    return posts.filter(post=>{
      if(onlyPhotos && !(post.image_paths?.length))return false
      return !term||foldText(`${post.content} ${post.display_name} ${post.username}`).includes(term)
    }).sort((a,b)=>{
    const dateDifference=new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
    if (feedOrder==='popular') {
      // Ordenação local: somente publicações já carregadas, sem alterar a paginação da API.
      const engagement=(post:Post)=>Math.max(0,Number(post.like_count)||0)+Math.max(0,commentCounts[post.post_id]||0)
      return engagement(b)-engagement(a)||dateDifference
    }
    return feedOrder==='recent'?dateDifference:-dateDifference
    })
  },[posts,feedSearch,onlyPhotos,feedOrder,commentCounts])
  const filteredConversations=useMemo(()=>{
    const term=foldText(chatSearch.trim())
    return conversations.filter(person=>{
      if (unreadOnly && Number(person.unread_count)===0) return false
      return !term||foldText(`${person.display_name} ${person.username} ${person.last_message||''}`).includes(term)
    })
  },[conversations,chatSearch,unreadOnly])
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
    {id:'discover',label:'⌕ Descobrir'},
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

  return <section className={`hb-friends-panel hb-social-hub hb-social-v158 hb-social-v160 hb-social-v161 hb-social-v162 hb-social-v163 hb-social-v180 hb-social-v189 hb-social-page-${tab}`} aria-label="Comunidade do HäxBag">
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
        <span className="hb-v158-nav-label">COMUNIDADE</span>
        <nav className="hb-social-tabs" aria-label="Áreas da comunidade">{tabs.filter(item=>item.id!=='blocked'&&item.id!=='referral').map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
        <span className="hb-v158-nav-label hb-v180-sidebar-secondary-label">CONVITES E PRIVACIDADE</span>
        <nav className="hb-social-tabs hb-v180-secondary-nav" aria-label="Convites e privacidade">{tabs.filter(item=>item.id==='blocked'||item.id==='referral').map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-current={tab===item.id?'page':undefined} onClick={()=>{setTab(item.id);setNotice('');setError('')}}>{item.label}{item.count!==undefined&&item.count>0&&<small>{item.count}</small>}</button>)}</nav>
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
    <div className="hb-v180-quickbar" role="group" aria-label="Atalhos do Social">
      <button type="button" className="hb-v180-quickbar-primary" onClick={focusComposer}><span aria-hidden="true">✎</span> Nova publicação</button>
      <button type="button" onClick={()=>setTab('messages')}><span aria-hidden="true">✉</span> Mensagens {summary.unread>0&&<em>{summary.unread}</em>}</button>
      <button type="button" onClick={()=>setTab('discover')}><span aria-hidden="true">⌕</span> Descobrir pessoas</button>
      <button type="button" onClick={()=>setTab('referral')}><span aria-hidden="true">✧</span> Convidar amigos</button>
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
        <div className="hb-social-feed-header"><div><span className="hb-social-overline">LINHA DO TEMPO</span><h3>Publicações recentes</h3></div><div className="hb-social-segments" role="group" aria-label="Filtrar publicações">{([['all','Para você'],['following','Seguindo'],['mine','Minhas']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={feedScope===key} className={feedScope===key?'selected':''} onClick={()=>setFeedScope(key)}>{label}</button>)}</div></div>
        <div className="hb-v163-feed-tools"><label className="hb-v163-feed-search"><span>⌕</span><input type="search" placeholder="Buscar nas publicações carregadas…" aria-label="Buscar no feed" value={feedSearch} onChange={e=>setFeedSearch(e.target.value)} /></label><label className="hb-v163-photo-filter"><input type="checkbox" checked={onlyPhotos} onChange={e=>setOnlyPhotos(e.target.checked)} />▧ Com fotos</label><label className="hb-v163-post-order">Ordem <select value={feedOrder} onChange={e=>setFeedOrder(e.target.value as 'recent'|'oldest'|'popular')}><option value="recent">Mais recentes</option><option value="popular">Mais interações</option><option value="oldest">Mais antigas</option></select></label></div>
        {feedOrder==='popular'&&<p className="hb-v189-sort-hint">✦ Mais interações considera curtidas e comentários das publicações já carregadas.</p>}
        {(feedSearch||onlyPhotos)&&<div className="hb-v163-results">{visiblePosts.length} {visiblePosts.length===1?'publicação encontrada':'publicações encontradas'} nesta página{(feedSearch||onlyPhotos)&&<button type="button" onClick={()=>{setFeedSearch('');setOnlyPhotos(false)}}>Limpar filtros</button>}</div>}
        {feedLoaded&&visiblePosts.map(post=><article key={post.post_id} className="hb-social-post"><div className="hb-social-post-top"><button type="button" onClick={()=>post.author_id===userId?onViewOwnProfile?.():setProfile({id:post.author_id,display_name:post.display_name,username:post.username})}>{avatarFor(post.author_id,nameOf(post))}<span><strong>{post.display_name}</strong><small>@{post.username||'aventureiro'}</small></span></button><small className="hb-v160-post-date"><time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString('pt-BR')}>{formatDate(post.created_at)}</time><span className="hb-v160-visibility">{visibilityLabels[post.visibility]}</span></small></div>{post.content&&<div className="hb-v189-post-text">
          <p id={`hb-v189-post-text-${post.post_id}`}>{post.content.length>420&&!expandedPosts.has(post.post_id)?`${post.content.slice(0,420).trimEnd()}…`:post.content}</p>
          {post.content.length>420&&<button type="button" className="hb-v189-read-more" aria-expanded={expandedPosts.has(post.post_id)} aria-controls={`hb-v189-post-text-${post.post_id}`} onClick={()=>setExpandedPosts(current=>{const next=new Set(current);if(next.has(post.post_id))next.delete(post.post_id);else next.add(post.post_id);return next})}>{expandedPosts.has(post.post_id)?'Mostrar menos ↑':'Ler publicação completa ↓'}</button>}
        </div>}{post.image_paths?.length>0&&<div className={`hb-v162-post-gallery gallery-${Math.min(post.image_paths.length,4)}`}>{post.image_paths.map((path,index)=>photoUrls[path]?<button key={path} type="button" onClick={()=>setImageViewer({urls:post.image_paths.map(p=>photoUrls[p]).filter(Boolean),index:post.image_paths.slice(0,index).filter(p=>Boolean(photoUrls[p])).length,author:nameOf(post)})} aria-label={`Ampliar foto ${index+1} da publicação`}><img src={photoUrls[path]} alt={`Foto ${index+1} da publicação de ${nameOf(post)}`} loading="lazy" /></button>:<div key={path} className="hb-v162-media-placeholder" aria-label="Carregando foto">▧</div>)}</div>}<footer><button type="button" className={post.liked?'liked':''} onClick={()=>void like(post)} aria-pressed={post.liked} disabled={!!likePending[post.post_id]}>{post.liked?'♥':'♡'} {Number(post.like_count)} curtida{Number(post.like_count)===1?'':'s'}</button><SocialPostComments postId={post.post_id} count={commentCounts[post.post_id]} onCountChange={updateCommentCount} onOpenProfile={person=>person.id===userId ? onViewOwnProfile?.() : setProfile({id:person.id,display_name:person.display_name,username:person.username})}/>{post.author_id===userId&&<button className="hb-social-delete" type="button" onClick={()=>void deletePost(post)}>Excluir</button>}</footer></article>)}
        {feedLoaded&&!posts.length&&!feedBusy&&<div className="hb-social-empty hb-v160-empty"><span className="hb-v160-empty-icon">✦</span><strong>Nenhuma publicação por enquanto.</strong><p>{feedScope==='following'?'Acompanhe novos jogadores para ver suas publicações aqui.':feedScope==='mine'?'Compartilhe seu primeiro registro no mural.':'Sua comunidade está pronta para novas histórias.'}</p>{feedScope==='following'&&<button type="button" onClick={()=>setTab('discover')}>Encontrar pessoas</button>}</div>}
        {feedLoaded&&posts.length>0&&visiblePosts.length===0&&!feedBusy&&<div className="hb-social-empty hb-v160-empty"><strong>Nenhuma publicação encontrada.</strong><p>Tente outros termos ou remova o filtro de fotos.</p><button type="button" onClick={()=>{setFeedSearch('');setOnlyPhotos(false)}}>Limpar filtros</button></div>}
        {feedBusy&&<div className="hb-v160-skeletons" aria-label="Carregando publicações" aria-busy="true"><div/><div/></div>}
        {hasMore&&!feedBusy&&<button className="hb-social-load-more" type="button" onClick={()=>void loadFeed(posts.at(-1)?.created_at||null,true,feedScope)}>Mostrar mais publicações</button>}
      </section><aside className="hb-social-feed-aside"><span className="hb-social-overline">SEU CÍRCULO</span><h3>Histórias se conectam.</h3><p>Explore a comunidade e acompanhe as aventuras de quem você segue. O chat privado abre quando o seguimento é mútuo.</p><div className="hb-v158-aside-stats"><span><strong>{summary.followers}</strong> seguidores</span><span><strong>{summary.friends}</strong> amigos</span></div><button type="button" onClick={()=>setTab('discover')}>⌕ Encontrar aventureiros</button><button type="button" onClick={()=>setTab('messages')}>✉ Ir às mensagens {summary.unread>0?`(${summary.unread})`:''}</button><div className="hb-social-privacy-note">◈ Você escolhe se cada publicação será pública, para seguidores ou apenas para amigos. Bloqueios valem nos dois sentidos.</div></aside></div>}

    {(['friends','following','followers','blocked'] as Tab[]).includes(tab)&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">SEU CÍRCULO</span><h3>{{friends:'Amigos mútuos',following:'Quem você segue',followers:'Quem segue você',blocked:'Contas bloqueadas'}[tab as 'friends'|'following'|'followers'|'blocked']}</h3><p>{tab==='friends'?'Vocês se seguem mutuamente e podem conversar em particular.':tab==='following'?'Pessoas cujas novidades você quer acompanhar.':tab==='followers'?'Pessoas que escolheram acompanhar seu perfil.':'Você pode desbloquear essas contas quando quiser.'}</p></div><span className="hb-v160-result-count">{filteredPeople.length} {filteredPeople.length===1?'perfil':'perfis'}</span></div>
      <div className="hb-v160-people-tools"><label>Buscar nesta lista<input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Nome ou @usuário" /></label><label>Ordenar<select value={peopleOrder} onChange={e=>setPeopleOrder(e.target.value as 'az'|'za')}><option value="az">Nome: A → Z</option><option value="za">Nome: Z → A</option></select></label></div><div className="hb-social-people hb-v160-people-grid">{filteredPeople.map(person=>peopleCard(person,tab))}</div>{!filteredPeople.length&&!loading&&<div className="hb-social-empty hb-v160-empty"><strong>Nenhum resultado.</strong><p>{filter?'Tente outro termo de busca.':tab==='blocked'?'Você não bloqueou ninguém.':'Explore outros perfis para ampliar sua rede.'}</p>{tab!=='blocked'&&<button type="button" onClick={()=>setTab('discover')}>Descobrir jogadores</button>}</div>}</section>}

    {tab==='discover'&&<section className="hb-social-list-pane"><div className="hb-social-pane-top"><div><span className="hb-social-overline">NOVAS CONEXÕES</span><h3>Descobrir aventureiros</h3><p>Busque por nome ou @usuário. Não são exibidas pessoas com quem você tenha bloqueio.</p></div></div><label className="hb-social-search-label hb-v160-discover-search"><span>Pesquisar jogadores</span><span className="hb-v160-search-input"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome ou @usuário — ao menos 2 caracteres" autoComplete="off" /></span></label>
      <div className="hb-v160-discover-note">✦ Encontrou alguém interessante? Siga essa pessoa. Se ela seguir você de volta, vocês se tornam amigos e podem conversar por mensagens.</div>{searchBusy&&<p className="hb-social-loading">Procurando aventureiros…</p>}<div className="hb-social-people hb-v160-people-grid">{searchResults.map(person=>peopleCard(person,'discover'))}</div>{search.trim().length<2&&<div className="hb-social-empty hb-v160-empty"><strong>Conheça outros mundos.</strong><p>Digite o nome ou identificador de quem você quer encontrar.</p></div>}{search.trim().length>=2&&!searchBusy&&!searchResults.length&&<div className="hb-social-empty"><strong>Nenhum perfil encontrado.</strong><p>Confira a grafia ou tente outro nome.</p></div>}</section>}

    {tab==='messages'&&<section className={`hb-social-chat-shell hb-v160-chat ${selectedChat?'has-active-chat':''}`}><div className="hb-social-chat-sidebar"><div className="hb-social-pane-top"><div><span className="hb-social-overline">CONVERSAS PRIVADAS</span><h3>Conversas</h3><p>Somente amigos mútuos podem enviar novas mensagens.</p></div></div>
      <label className="hb-v160-chat-search"><span>Encontrar contato</span><input type="search" value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Nome ou mensagem…" /></label>
      <label className="hb-v160-unread-toggle"><input type="checkbox" checked={unreadOnly} onChange={e=>setUnreadOnly(e.target.checked)}/> Somente não lidas {summary.unread>0?`(${summary.unread})`:''}</label>
      <div className="hb-v160-contact-list">{filteredConversations.map(person=><button type="button" key={person.partner_id} className={`hb-social-chat-contact ${selectedChat?.partner_id===person.partner_id?'selected':''}`} onClick={()=>openChat(person)}>{avatarFor(person.partner_id,nameOf(person))}<span><strong>{person.display_name}</strong><small>{person.last_message||'Comece uma conversa'}</small></span>{Number(person.unread_count)>0&&<em aria-label={`${person.unread_count} mensagens não lidas`}>{person.unread_count}</em>}</button>)}{!filteredConversations.length&&!!conversations.length&&<p className="hb-v160-no-conversations">Nenhuma conversa corresponde aos filtros.</p>}</div>{!conversations.length&&<div className="hb-social-empty"><strong>Sem conversas.</strong><p>Siga um aventureiro que também segue você para iniciar um chat.</p><button type="button" onClick={()=>setTab('friends')}>Ver amigos</button></div>}</div><div className="hb-social-chat-main">{selectedChat?<><header><div className="hb-v160-chat-header-identity"><button type="button" className="hb-v160-chat-back" aria-label="Voltar para conversas" onClick={()=>{messagesRequestRef.current+=1;setSelectedChat(null);setChatMessages([]);setMessageDraft('');setMessageSearch('');setCopiedMessageId(null);setMessagePhoto(previous=>{if(previous)URL.revokeObjectURL(previous.preview);return null})}}>‹</button>{avatarFor(selectedChat.partner_id,nameOf(selectedChat))}<span><strong>{selectedChat.display_name}</strong><small>@{selectedChat.username||'aventureiro'}</small></span></div><button type="button" onClick={()=>setProfile({id:selectedChat.partner_id,display_name:selectedChat.display_name,username:selectedChat.username})}>Ver perfil ↗</button></header>
      <div className="hb-v189-message-search"><label htmlFor="hb-v189-search-messages"><span aria-hidden="true">⌕</span> Buscar nesta conversa</label><div><input id="hb-v189-search-messages" type="search" value={messageSearch} onChange={event=>setMessageSearch(event.target.value)} placeholder="Pesquisar nas últimas mensagens carregadas" />{messageSearch&&<button type="button" onClick={()=>setMessageSearch('')}>Limpar</button>}</div>{messageSearch&&<small>{visibleChatMessages.length} de {chatMessages.length} mensagens carregadas</small>}</div>
      <div className="hb-social-chat-messages" ref={chatScrollRef} aria-label={`Mensagens com ${selectedChat.display_name}`} aria-live="polite">{visibleChatMessages.map((message,index)=><div className="hb-v160-message-row" key={message.message_id}>
          {(index===0 || dayOf(visibleChatMessages[index-1].created_at)!==dayOf(message.created_at))&&<div className="hb-v160-chat-day" role="separator">{dayOf(message.created_at)}</div>}
          <div className={`hb-v161-chat-message ${message.sender_id===userId?'own':''}`}>{avatarFor(message.sender_id,message.sender_id===userId?(profileIdentity?.name||'Você'):nameOf(selectedChat))}<div className={`hb-social-bubble ${message.sender_id===userId?'own':''}`}>
            {message.deleted_at?<p><em>Mensagem apagada</em></p>:<>
              {message.image_path&&chatImageUrls[message.message_id]&&<a href={chatImageUrls[message.message_id]} target="_blank" rel="noopener noreferrer"><img className="hb-v172-chat-image" src={chatImageUrls[message.message_id]} alt="Foto enviada na conversa" loading="lazy" /></a>}
              {message.body!=='📷 Foto'&&<p>{message.body}</p>}
              {message.body!=='📷 Foto'&&Boolean(message.body.trim())&&<button className="hb-v189-copy-message" type="button" onClick={()=>void copyChatMessage(message)} aria-label="Copiar texto desta mensagem">{copiedMessageId===message.message_id?'✓ Copiado':'⧉ Copiar'}</button>}
              {message.sender_id===userId&&<button className="hb-v172-delete-message" type="button" disabled={!!busy} onClick={()=>void deleteChatMessage(message)} title="Apagar mensagem para todos">Apagar</button>}
            </>}
            <small>{new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{message.sender_id===userId && message.read_at?' · Lida':''}</small></div></div></div>)}{!chatMessages.length&&<div className="hb-social-empty"><strong>A conversa começa aqui.</strong><p>Envie uma mensagem particular para este aventureiro.</p></div>}
          {messageSearch.trim()&&chatMessages.length>0&&!visibleChatMessages.length&&<div className="hb-social-empty hb-v189-message-empty"><strong>Nenhuma mensagem encontrada.</strong><p>A busca considera as últimas {chatMessages.length} mensagens carregadas desta conversa.</p><button type="button" onClick={()=>setMessageSearch('')}>Mostrar todas</button></div>}</div>{selectedChat.can_message?<form onSubmit={e=>void sendMessage(e)} className="hb-social-chat-compose">
            <input ref={chatFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{display:'none'}} onChange={event=>{chooseChatPhoto(event.target.files?.[0]);event.target.value=''}} />
            {messagePhoto&&<div className="hb-v172-chat-preview"><img src={messagePhoto.preview} alt="Prévia da foto"/><span>{messagePhoto.file.name}</span><button type="button" onClick={()=>{URL.revokeObjectURL(messagePhoto.preview);setMessagePhoto(null)}}>Remover</button></div>}
            <button type="button" className="hb-v172-photo-button" title="Enviar foto" onClick={()=>chatFileInputRef.current?.click()} disabled={!!busy}>📷 Foto</button><textarea rows={2} maxLength={2500} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Escreva sua mensagem…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void sendMessage()}}}/><button type="submit" disabled={(!messageDraft.trim()&&!messagePhoto)||!!busy}>Enviar ↗</button></form>:<div className="hb-social-chat-disabled">Para enviar novas mensagens, vocês precisam se seguir mutuamente.</div>}</>:<div className="hb-social-chat-welcome"><span>✉</span><strong>Suas conversas, em particular.</strong><p>Selecione uma conversa para começar. As mensagens privadas são acessíveis somente aos participantes.</p><button type="button" onClick={()=>setTab('friends')}>Ver meus amigos</button></div>}</div></section>}

    {tab==='referral'&&<SocialReferralPanel active={active&&tab==='referral'}/>}

      </div>
    </div>
    {imageViewer&&<div className="hb-v162-lightbox hb-v163-lightbox" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setImageViewer(null)}}><div role="dialog" aria-modal="true" aria-label="Visualizar foto da publicação"><button type="button" className="hb-v162-close-lightbox" onClick={()=>setImageViewer(null)} aria-label="Fechar imagem ampliada">×</button><img src={imageViewer.urls[imageViewer.index]} alt={`Foto ${imageViewer.index+1} de ${imageViewer.urls.length}, publicação de ${imageViewer.author}`} /><div className="hb-v163-viewer-controls">{imageViewer.urls.length>1&&<button type="button" onClick={()=>setImageViewer(view=>view?{...view,index:(view.index-1+view.urls.length)%view.urls.length}:null)} aria-label="Foto anterior">←</button>}<span>{imageViewer.author} · {imageViewer.index+1} / {imageViewer.urls.length}</span>{imageViewer.urls.length>1&&<button type="button" onClick={()=>setImageViewer(view=>view?{...view,index:(view.index+1)%view.urls.length}:null)} aria-label="Próxima foto">→</button>}</div></div></div>}
    {profile&&<PublicAdventurerProfile person={profile} onClose={()=>setProfile(null)} onFriendUpdate={()=>{void refresh();void loadFeed(null,false,feedScope)}} onMessage={person=>{
      setProfile(null)
      const current=conversations.find(c=>c.partner_id===person.id)||{partner_id:person.id,display_name:person.display_name,username:person.username||'',last_message:null,last_at:null,unread_count:0,can_message:true}
      openChat(current)
    }} campaigns={canInvite&&campaignId?[{id:campaignId,name:campaignName}]:[]}/>}
  </section>
}
