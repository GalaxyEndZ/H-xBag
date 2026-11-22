import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '../supabase'
import './SocialV231Suite.css'
import './SocialExpansionV245.css'
import './SocialV248Unified.css'

export type SocialV231Page = 'feed'|'discover'|'communities'|'saved'|'events'|'notifications'|'activity'|'moderation'
type Group = {id:string;owner_id:string;name:string;description:string;rules:string;topic:string;is_public:boolean;created_at:string}
type Member = {group_id:string;user_id:string;role:'owner'|'moderator'|'member';status:'active'|'pending';joined_at:string}
type Post = {id:string;author_id:string;group_id:string|null;character_id:string|null;character_name:string|null;character_emoji:string|null;display_name:string;content:string;pinned:boolean;created_at:string;updated_at:string;quoted_post_id?:string|null;share_mode?:'quote'|'repost'|null}
type Comment = {id:string;post_id:string;parent_id:string|null;author_id:string;body:string;created_at:string}
type Poll = {post_id:string;question:string;options:string[];ends_at:string}
type Vote = {post_id:string;user_id:string;option_index:number}
type Like = {post_id:string;user_id:string}
type Saved = {user_id:string;post_id:string;collection:string;note:string;is_legacy:boolean;created_at:string}
type CommunityEvent = {id:string;owner_id:string;group_id:string|null;title:string;description:string;starts_at:string;location_text:string;capacity:number|null;created_at:string}
type RSVP = {event_id:string;user_id:string}
type Notice = {id:string;kind:string;title:string;actor_id:string|null;target_id:string|null;read_at:string|null;created_at:string}
type Prefs = {user_id:string;activity_public:boolean;notifications_enabled:boolean;muted_user_ids:string[]}
type Character = {id:string;name:string;emoji:string|null}
type Activity = {kind:string;id:string;title:string;created_at:string}
type LegacyTimelinePost = {post_id:string;author_id:string;created_at:string;like_count:number;engagement?:number;image_paths?:string[]}
type TimelineScope = 'all'|'following'|'friends'|'mine'
type TimelineOrder = 'recent'|'oldest'|'popular'
type Props = {page:SocialV231Page;userId:string;profileName?:string;onNavigate?:(tab:'feed'|'discover'|'messages'|'communities')=>void;onViewProfile?:(userId:string)=>void;
  legacyPosts?:LegacyTimelinePost[];renderLegacyPost?:(id:string)=>ReactNode;
  feedScope?:TimelineScope;feedSearch?:string;onlyPhotos?:boolean;feedOrder?:TimelineOrder;
  followingUserIds?:string[];friendsUserIds?:string[];legacyLoading?:boolean;onRefreshLegacy?:()=>void;onSearchFeed?:(term:string)=>void}

const date = (value:string) => new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
const dateLong = (value:string) => new Date(value).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'})
const short = (value:string,max=180) => value.length>max ? `${value.slice(0,max).trimEnd()}…` : value
const fold = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
const errorMessage = (reason:unknown) => reason instanceof Error ? reason.message : String(reason)
const fail = (response:{error:{message:string}|null}) => {if(response.error)throw new Error(response.error.message)}
const defaultPrefs = (uid:string):Prefs => ({user_id:uid,activity_public:false,notifications_enabled:true,muted_user_ids:[]})
const emptyPoll=['','']

function CommentThread({postId,comments,userId,send,remove,busy}:{postId:string;comments:Comment[];userId:string;send:(id:string,body:string,parent:string|null)=>Promise<void>;remove:(id:string)=>Promise<void>;busy:boolean}) {
  const [text,setText]=useState('')
  const [replyTo,setReplyTo]=useState<string|null>(null)
  const [show,setShow]=useState(false)
  const relevant=comments.filter(c=>c.post_id===postId)
  const submit=async(e:FormEvent)=>{e.preventDefault();if(!text.trim())return;await send(postId,text.trim(),replyTo);setText('');setReplyTo(null);setShow(true)}
  const CommentRow=({item,depth}:{item:Comment;depth:number})=><div className={`hb-v231-comment ${depth?'is-reply':''}`}>
    <div><strong>{item.author_id===userId?'Você':`Aventureiro · ${item.author_id.slice(0,7)}`}</strong><time>{date(item.created_at)}</time></div>
    <p>{item.body}</p>
    <div className="hb-v231-inline-actions"><button type="button" onClick={()=>{setReplyTo(item.id);setShow(true)}}>↪ Responder</button>{item.author_id===userId&&<button type="button" disabled={busy} onClick={()=>void remove(item.id)}>Excluir</button>}</div>
    {depth===0&&relevant.filter(child=>child.parent_id===item.id).map(child=><CommentRow key={child.id} item={child} depth={1}/>)}
  </div>
  return <section className="hb-v231-comments">
    <button type="button" className="hb-v231-text-button" onClick={()=>setShow(value=>!value)} aria-expanded={show}>💬 {relevant.length} {relevant.length===1?'comentário':'comentários'} {show?'↑':'↓'}</button>
    {show&&<div className="hb-v231-comment-body">
      {relevant.filter(comment=>!comment.parent_id).map(item=><CommentRow key={item.id} item={item} depth={0}/>)}
      <form onSubmit={e=>void submit(e)}><label>{replyTo?'Sua resposta':'Adicionar comentário'}<textarea rows={2} maxLength={1600} value={text} onChange={e=>setText(e.target.value)} placeholder="Compartilhe uma ideia ou mencione @alguém…"/></label><div className="hb-v231-inline-actions">{replyTo&&<button type="button" onClick={()=>setReplyTo(null)}>Cancelar resposta</button>}<button type="submit" disabled={!text.trim()||busy}>Comentar</button></div></form>
    </div>}
  </section>
}

function PostCard({post,uid,groups,likes,comments,polls,votes,bookmarked,busy,onLike,onVote,onSave,onComment,onRemoveComment,onEdit,onDelete,onPin,onReport,onMute,canModerate,onViewProfile,originalPost,onShare}:{post:Post;uid:string;groups:Group[];likes:Like[];comments:Comment[];polls:Poll[];votes:Vote[];bookmarked:boolean;busy:boolean;onLike:(post:Post)=>Promise<void>;onVote:(postId:string,index:number)=>Promise<void>;onSave:(post:Post)=>Promise<void>;onComment:(postId:string,body:string,parent:string|null)=>Promise<void>;onRemoveComment:(id:string)=>Promise<void>;onEdit:(post:Post,content:string)=>Promise<void>;onDelete:(post:Post)=>Promise<void>;onPin:(post:Post)=>Promise<void>;onReport:(type:string,id:string)=>void;onMute:(userId:string)=>Promise<void>;canModerate:boolean;onViewProfile?:(userId:string)=>void;originalPost?:Post;onShare:(post:Post,mode:'quote'|'repost')=>Promise<void>}) {
  const [editing,setEditing]=useState(false)
  const [edited,setEdited]=useState(post.content)
  const [expanded,setExpanded]=useState(false)
  const poll=polls.find(value=>value.post_id===post.id)
  const options=poll?.options||[]
  const tally=options.map((_,index)=>votes.filter(v=>v.post_id===post.id&&v.option_index===index).length)
  const total=tally.reduce((a,b)=>a+b,0)
  const voted=votes.find(v=>v.post_id===post.id&&v.user_id===uid)?.option_index
  const isMine=post.author_id===uid
  const firstUrl=(post.content.match(/https?:\/\/[^\s<>]+/i)||[])[0]
  const linkPreview=(()=>{if(!firstUrl)return null;try{const url=new URL(firstUrl);if(!['https:','http:'].includes(url.protocol))return null;return {href:url.href,domain:url.hostname,path:(url.pathname+url.search).slice(0,110)}}catch{return null}})()
  const likeCount=likes.filter(l=>l.post_id===post.id).length
  const liked=likes.some(l=>l.post_id===post.id&&l.user_id===uid)
  return <article className={`hb-v231-post ${post.pinned?'is-pinned':''}`}>
    <header><div className="hb-v231-avatar">{post.character_emoji||post.display_name?.slice(0,1)?.toUpperCase()||'✦'}</div><div className="hb-v231-byline"><button type="button" onClick={()=>onViewProfile?.(post.author_id)}><strong>{post.character_name||post.display_name||'Aventureiro'}</strong></button><small>{post.character_name&&<span>Personagem de {post.display_name} · </span>}{date(post.created_at)} {post.group_id&&`· ${groups.find(g=>g.id===post.group_id)?.name||'Grupo'}`}</small></div>{post.pinned&&<span className="hb-v231-pill">📌 Fixado</span>}</header>
    {editing?<form className="hb-v231-edit-post" onSubmit={async e=>{e.preventDefault();if(!edited.trim())return;await onEdit(post,edited.trim());setEditing(false)}}><textarea rows={4} value={edited} maxLength={3000} onChange={e=>setEdited(e.target.value)}/><div className="hb-v231-inline-actions"><button type="button" onClick={()=>{setEditing(false);setEdited(post.content)}}>Cancelar</button><button disabled={busy||!edited.trim()} type="submit">Salvar edição</button></div></form>:<p className="hb-v231-post-text">{expanded?post.content:short(post.content,700)}{post.content.length>700&&<button type="button" className="hb-v231-text-button" onClick={()=>setExpanded(!expanded)}>{expanded?'Mostrar menos':'Ler mais'}</button>}</p>}
    {post.quoted_post_id&&<div className="hb-v245-quoted-card"><small>{post.share_mode==='repost'?'↗ PUBLICAÇÃO REPUBLICADA':'❝ PUBLICAÇÃO CITADA'}</small>{originalPost?<><p>{short(originalPost.content,420)}</p><button type="button" onClick={()=>onViewProfile?.(originalPost.author_id)}>Visitar autor original ↗</button></>:<p>O conteúdo original não está mais disponível.</p>}</div>}
    {linkPreview&&<a className="hb-v231-link-preview" href={linkPreview.href} target="_blank" rel="noopener noreferrer nofollow"><strong>↗ {linkPreview.domain}</strong><small>{linkPreview.path||'Abrir link'}</small></a>}
    {poll&&<section className="hb-v231-poll"><strong>📊 {poll.question}</strong>{options.map((answer,index)=><button type="button" key={index} disabled={busy||new Date(poll.ends_at).getTime()<=Date.now()} className={voted===index?'is-selected':''} onClick={()=>void onVote(post.id,index)}><span>{answer}</span><span>{total?Math.round(100*tally[index]/total):0}%</span><span className="hb-v231-poll-bar" style={{width:`${total?100*tally[index]/total:0}%`}}/></button>)}<small>{total} {total===1?'voto':'votos'} · {new Date(poll.ends_at)>new Date()?'Encerra '+dateLong(poll.ends_at):'Enquete encerrada'}</small></section>}
    <div className="hb-v231-post-actions"><button type="button" disabled={busy} aria-pressed={liked} onClick={()=>void onLike(post)}>{liked?'♥':'♡'} {likeCount}</button><button type="button" aria-pressed={bookmarked} disabled={busy} onClick={()=>void onSave(post)}>{bookmarked?'▣ Salvo':'▤ Salvar'}</button>{!post.group_id&&<><button type="button" disabled={busy} onClick={()=>void onShare(post,'repost')}>↗ Republicar</button><button type="button" disabled={busy} onClick={()=>void onShare(post,'quote')}>❝ Citar</button></>}{isMine&&<><button type="button" onClick={()=>{setEdited(post.content);setEditing(true)}}>Editar</button><button type="button" disabled={busy} onClick={()=>void onPin(post)}>{post.pinned?'Desafixar':'Fixar'}</button></>}{(isMine||canModerate)&&<button type="button" disabled={busy} onClick={()=>void onDelete(post)}>Excluir</button>}{!isMine&&<><button type="button" disabled={busy} onClick={()=>void onMute(post.author_id)}>Silenciar autor</button><button type="button" onClick={()=>onReport('post',post.id)}>⚑ Denunciar</button></>}</div>
    <CommentThread postId={post.id} comments={comments} userId={uid} send={onComment} remove={onRemoveComment} busy={busy}/>
  </article>
}

export function SocialV231PublicActivity({authorId}:{authorId:string}) {
  const [rows,setRows]=useState<Activity[]>([])
  useEffect(()=>{let active=true;void supabase.rpc('hax_v231_public_activity',{p_author:authorId}).then(({data,error})=>{if(active&&!error)setRows((data||[]) as Activity[])});return()=>{active=false}},[authorId])
  if(!rows.length)return null
  return <section className="hb-v231-public-activity"><h3>✦ Atividade na comunidade</h3><ol>{rows.slice(0,8).map(item=><li key={`${item.kind}-${item.id}`}><small>{date(item.created_at)}</small><span>{item.kind==='post'?'✎': '◉'} {short(item.title,120)}</span></li>)}</ol></section>
}

export default function SocialV231Suite({page,userId,profileName,onNavigate,onViewProfile,
  legacyPosts=[],renderLegacyPost,feedScope='all',feedSearch='',onlyPhotos=false,feedOrder='recent',
  followingUserIds=[],friendsUserIds=[],legacyLoading=false,onRefreshLegacy,onSearchFeed}:Props){
  const [ready,setReady]=useState(false)
  const [schemaMissing,setSchemaMissing]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [groups,setGroups]=useState<Group[]>([])
  const [members,setMembers]=useState<Member[]>([])
  const [posts,setPosts]=useState<Post[]>([])
  const [quotedPosts,setQuotedPosts]=useState<Record<string,Post>>({})
  const [likes,setLikes]=useState<Like[]>([])
  const [comments,setComments]=useState<Comment[]>([])
  const [polls,setPolls]=useState<Poll[]>([])
  const [votes,setVotes]=useState<Vote[]>([])
  const [saved,setSaved]=useState<Saved[]>([])
  const [events,setEvents]=useState<CommunityEvent[]>([])
  const [rsvps,setRsvps]=useState<RSVP[]>([])
  const [notifications,setNotifications]=useState<Notice[]>([])
  const [prefs,setPrefs]=useState<Prefs>(defaultPrefs(userId))
  const [characters,setCharacters]=useState<Character[]>([])
  const [activity,setActivity]=useState<Activity[]>([])
  const [composeOpen,setComposeOpen]=useState(false)
  const [postText,setPostText]=useState('')
  const [draftReady,setDraftReady]=useState('')
  const [postCharacter,setPostCharacter]=useState('')
  const [postGroup,setPostGroup]=useState('')
  const [pollQuestion,setPollQuestion]=useState('')
  const [pollOptions,setPollOptions]=useState([...emptyPoll])
  const [pollActive,setPollActive]=useState(false)
  const [groupName,setGroupName]=useState('')
  const [groupDescription,setGroupDescription]=useState('')
  const [groupRules,setGroupRules]=useState('')
  const [groupTopic,setGroupTopic]=useState('RPG')
  const [groupPublic,setGroupPublic]=useState(true)
  const [selectedGroup,setSelectedGroup]=useState('')
  const [eventTitle,setEventTitle]=useState('')
  const [eventDescription,setEventDescription]=useState('')
  const [eventDate,setEventDate]=useState('')
  const [eventCapacity,setEventCapacity]=useState('')
  const [eventPlace,setEventPlace]=useState('Online')
  const [eventGroup,setEventGroup]=useState('')
  const [term,setTerm]=useState('')
  const [feedMode]=useState<'all'|'groups'|'mine'|'popular'>('all')
  const [collection,setCollection]=useState('Favoritos')
  const [reportTarget,setReportTarget]=useState<{type:string;id:string}|null>(null)
  const [reportReason,setReportReason]=useState('Conteúdo inadequado')
  const [reportDetail,setReportDetail]=useState('')
  const [noticeFilter,setNoticeFilter]=useState('all')
  const [v245Privacy,setV245Privacy]=useState({user_id:userId,allow_quotes:true,allow_messages:true,allow_mentions:true,alerts_follow:true,alerts_like:true,alerts_comment:true,alerts_other:true})

  const run=useCallback(async(action:()=>Promise<void>)=>{
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try{await action()}catch(e){setError(errorMessage(e))}finally{setBusy(false)}
  },[busy])
  const load=useCallback(async()=>{
    if(!userId)return
    try{
      const [gr,mb,ps,sv,ev,rs,nf,pf,ch,ac]=await Promise.all([
        supabase.from('hax_v231_groups').select('*').order('created_at',{ascending:false}).limit(120),
        supabase.from('hax_v231_group_members').select('*').limit(600),
        supabase.from('hax_v231_posts').select('*').order('created_at',{ascending:false}).limit(80),
        supabase.from('hax_v231_saved').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(180),
        supabase.from('hax_v231_events').select('*').gte('starts_at',new Date(Date.now()-86400000).toISOString()).order('starts_at',{ascending:true}).limit(80),
        supabase.from('hax_v231_rsvps').select('event_id,user_id').limit(2000),
        supabase.from('hax_v231_notifications').select('*').eq('recipient_id',userId).order('created_at',{ascending:false}).limit(80),
        supabase.from('hax_v231_preferences').select('*').eq('user_id',userId).maybeSingle(),
        supabase.from('characters').select('id,name,emoji').eq('user_id',userId).limit(100),
        supabase.rpc('hax_v231_public_activity',{p_author:userId}),
      ])
      for(const response of [gr,mb,ps,sv,ev,rs,nf,pf])fail(response)
      setSchemaMissing(false)
      setGroups((gr.data||[]) as Group[])
      setMembers((mb.data||[]) as Member[])
      setPosts((ps.data||[]) as Post[])
      setSaved((sv.data||[]) as Saved[])
      setEvents((ev.data||[]) as CommunityEvent[])
      setRsvps((rs.data||[]) as RSVP[])
      setNotifications((nf.data||[]) as Notice[])
      setPrefs((pf.data as Prefs|null)||defaultPrefs(userId))
      setCharacters((ch.data||[]) as Character[])
      setActivity((ac.data||[]) as Activity[])
      const ids=((ps.data||[]) as Post[]).map(post=>post.id)
      if(ids.length){
        const [l,c,p,v]=await Promise.all([
          supabase.from('hax_v231_likes').select('post_id,user_id').in('post_id',ids).limit(3000),
          supabase.from('hax_v231_comments').select('*').in('post_id',ids).order('created_at',{ascending:true}).limit(2000),
          supabase.from('hax_v231_polls').select('*').in('post_id',ids),
          supabase.from('hax_v231_votes').select('post_id,user_id,option_index').in('post_id',ids).limit(3000),
        ])
        for(const response of [l,c,p,v])fail(response)
        setLikes((l.data||[]) as Like[])
        setComments((c.data||[]) as Comment[])
        setPolls((p.data||[]) as Poll[])
        setVotes((v.data||[]) as Vote[])
      }else{setLikes([]);setComments([]);setPolls([]);setVotes([])}
      setError('')
    }catch(e){const message=errorMessage(e);if(/relation|schema cache|does not exist|Could not find/i.test(message))setSchemaMissing(true);setError(message)}
    finally{setReady(true)}
  },[userId])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    const missing=[...new Set(posts.map(p=>p.quoted_post_id).filter((id):id is string=>!!id))]
      .filter(id=>!posts.some(p=>p.id===id))
    if(!missing.length)return
    let live=true
    void (async()=>{
      const {data,error}=await supabase.from('hax_v231_posts').select('*').in('id',missing)
      if(live&&!error&&data)setQuotedPosts(existing=>({...existing,...Object.fromEntries((data as Post[]).map(p=>[p.id,p]))}))
    })()
    return()=>{live=false}
  },[posts])
  useEffect(()=>{if(!userId)return
    try{const raw=window.sessionStorage.getItem(`hax-v231-draft:${userId}`);if(raw){const saved=JSON.parse(raw) as {text?:unknown;group?:unknown;character?:unknown};if(typeof saved.text==='string')setPostText(saved.text.slice(0,3000));if(typeof saved.group==='string')setPostGroup(saved.group);if(typeof saved.character==='string')setPostCharacter(saved.character)}}catch{/* Sessão privada pode bloquear armazenamento. */}
    setDraftReady(userId)
  },[userId])
  useEffect(()=>{if(!userId||draftReady!==userId)return;try{if(postText.trim())window.sessionStorage.setItem(`hax-v231-draft:${userId}`,JSON.stringify({text:postText,group:postGroup,character:postCharacter}));else window.sessionStorage.removeItem(`hax-v231-draft:${userId}`)}catch{/* Rascunho continua em memória. */}},[draftReady,userId,postText,postGroup,postCharacter])
  useEffect(()=>{if(!userId)return;const timer=window.setInterval(()=>{if(page==='notifications')void load()},60000);return()=>window.clearInterval(timer)},[page,load,userId])
  useEffect(()=>{if(!userId||!['moderation','notifications'].includes(page))return;let live=true;void (async()=>{const {data,error}=await supabase.from('hax_v245_privacy').select('*').eq('user_id',userId).maybeSingle();if(live&&!error&&data)setV245Privacy({user_id:userId,allow_quotes:data.allow_quotes,allow_messages:data.allow_messages,allow_mentions:data.allow_mentions,alerts_follow:data.alerts_follow,alerts_like:data.alerts_like,alerts_comment:data.alerts_comment,alerts_other:data.alerts_other})})();return()=>{live=false}},[userId,page])
  useEffect(()=>{if(!userId||page!=='notifications')return;const channel=supabase.channel(`hax-v245-notices-${userId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'hax_v231_notifications',filter:`recipient_id=eq.${userId}`},()=>{void load();window.dispatchEvent(new Event('haxbag:social-notifications-updated'))}).subscribe();return()=>{void supabase.removeChannel(channel)}},[userId,page,load])
  const myGroups=groups.filter(g=>members.some(m=>m.group_id===g.id&&m.user_id===userId&&m.status==='active'))
  const groupById=(id:string)=>groups.find(g=>g.id===id)
  const memberStatus=(id:string)=>members.find(m=>m.group_id===id&&m.user_id===userId)
  const muted=new Set(prefs.muted_user_ids||[])
  const visiblePosts=useMemo(()=>posts.filter(post=>{
    if(muted.has(post.author_id))return false
    if(selectedGroup&&page==='communities'&&post.group_id!==selectedGroup)return false
    if(page==='feed'&&(feedMode==='groups'&&!post.group_id||feedMode==='mine'&&post.author_id!==userId))return false
    if(term&&!fold(`${post.content} ${post.display_name} ${post.character_name||''} ${groupById(post.group_id||'')?.name||''}`).includes(fold(term)))return false
    return true
  }).sort((a,b)=>{
    if(page==='feed'&&feedMode==='popular')return likes.filter(l=>l.post_id===b.id).length+comments.filter(c=>c.post_id===b.id).length-likes.filter(l=>l.post_id===a.id).length-comments.filter(c=>c.post_id===a.id).length
    return Number(b.pinned&&b.author_id===userId)-Number(a.pinned&&a.author_id===userId)||new Date(b.created_at).getTime()-new Date(a.created_at).getTime()
  }),[posts,term,page,feedMode,userId,selectedGroup,groups,likes,comments,prefs.muted_user_ids])
  const suggestions=useMemo(()=>{
    const counts=new Map<string,number>()
    for(const post of posts.filter(p=>!muted.has(p.author_id)))for(const tag of post.content.match(/#[\p{L}\p{N}_]{2,32}/gu)||[])counts.set(tag.toLocaleLowerCase('pt-BR'),(counts.get(tag.toLocaleLowerCase('pt-BR'))||0)+1)
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)
  },[posts,prefs.muted_user_ids])
  const perform=async(action:()=>Promise<void>,success='Alterações salvas.')=>run(async()=>{await action();await load();setNotice(success)})
  const createPost=async(event:FormEvent)=>{event.preventDefault();if(!postText.trim())return
    await perform(async()=>{
      if(pollActive&&(!pollQuestion.trim()||pollOptions.some(o=>o.trim().length<2)))throw new Error('Informe a pergunta e pelo menos duas opções de enquete.')
      const row={author_id:userId,group_id:postGroup||null,character_id:postCharacter||null,display_name:profileName||'Aventureiro',content:postText.trim()}
      const response=await supabase.from('hax_v231_posts').insert(row).select('id').single();fail(response)
      const id=(response.data as {id:string}).id
      if(pollActive){const poll=await supabase.from('hax_v231_polls').insert({post_id:id,question:pollQuestion.trim(),options:pollOptions.map(o=>o.trim()),ends_at:new Date(Date.now()+7*86400000).toISOString()});if(poll.error){await supabase.from('hax_v231_posts').delete().eq('id',id);fail(poll)}}
      setPostText('');setPostCharacter('');setPollActive(false);setPollQuestion('');setPollOptions([...emptyPoll]);setComposeOpen(false)
    },'Sua publicação foi criada.')
  }
  const like=async(post:Post)=>perform(async()=>{
    if(likes.some(l=>l.post_id===post.id&&l.user_id===userId))fail(await supabase.from('hax_v231_likes').delete().eq('post_id',post.id).eq('user_id',userId))
    else fail(await supabase.from('hax_v231_likes').insert({post_id:post.id,user_id:userId}))
  },'Interação atualizada.')
  const vote=async(id:string,index:number)=>perform(async()=>{fail(await supabase.from('hax_v231_votes').upsert({post_id:id,user_id:userId,option_index:index},{onConflict:'post_id,user_id'}))},'Seu voto foi registrado.')
  const sharePost=async(post:Post,mode:'quote'|'repost')=>{
    if(post.group_id){setError('Conteúdos de grupos não podem ser republicados.');return}
    const content=mode==='quote'?window.prompt('Comente a publicação original (até 3000 caracteres):',''):''
    if(content===null)return
    const safeText=mode==='repost'?'Republicou uma publicação.':content.trim()
    if(!safeText){setError('Escreva um comentário antes de citar.');return}
    await perform(async()=>{fail(await supabase.from('hax_v231_posts').insert({author_id:userId,group_id:null,display_name:profileName||'Aventureiro',content:safeText.slice(0,3000),quoted_post_id:post.id,share_mode:mode}))},mode==='repost'?'Publicação republicada.':'Publicação citada.')
  }
  const savePost=async(post:Post)=>perform(async()=>{
    if(saved.some(s=>s.post_id===post.id))fail(await supabase.from('hax_v231_saved').delete().eq('user_id',userId).eq('post_id',post.id))
    else fail(await supabase.from('hax_v231_saved').insert({user_id:userId,post_id:post.id,collection:'Favoritos',is_legacy:false}))
  },'Coleção atualizada.')
  const comment=async(id:string,body:string,parent:string|null)=>perform(async()=>{fail(await supabase.from('hax_v231_comments').insert({post_id:id,body,parent_id:parent,author_id:userId}))},'Comentário publicado.')
  const removeComment=async(id:string)=>perform(async()=>{if(!window.confirm('Excluir seu comentário?'))return;fail(await supabase.from('hax_v231_comments').delete().eq('id',id))},'Comentário excluído.')
  const editPost=async(post:Post,content:string)=>perform(async()=>{fail(await supabase.from('hax_v231_posts').update({content}).eq('id',post.id).eq('author_id',userId))},'Publicação editada.')
  const removePost=async(post:Post)=>perform(async()=>{if(!window.confirm('Excluir esta publicação?'))return;fail(await supabase.from('hax_v231_posts').delete().eq('id',post.id))},'Publicação excluída.')
  const pinPost=async(post:Post)=>perform(async()=>{fail(await supabase.from('hax_v231_posts').update({pinned:!post.pinned}).eq('id',post.id).eq('author_id',userId))},'Destaque atualizado.')
  const mutePostAuthor=async(id:string)=>updatePrefs({muted_user_ids:[...new Set([...(prefs.muted_user_ids||[]),id])]})
  const report=async(event:FormEvent)=>{event.preventDefault();if(!reportTarget)return
    await perform(async()=>{fail(await supabase.from('hax_v231_reports').insert({reporter_id:userId,target_type:reportTarget.type,target_id:reportTarget.id,reason:reportReason,details:reportDetail.trim()}));setReportTarget(null);setReportDetail('')},'Denúncia recebida para análise.')
  }
  const communityForm=async(event:FormEvent)=>{event.preventDefault();await perform(async()=>{fail(await supabase.from('hax_v231_groups').insert({owner_id:userId,name:groupName.trim(),description:groupDescription.trim(),rules:groupRules.trim(),topic:groupTopic.trim(),is_public:groupPublic}));setGroupName('');setGroupDescription('');setGroupRules('')},'Comunidade criada.')}
  const joinGroup=async(group:Group)=>perform(async()=>{
    const member=memberStatus(group.id)
    if(member){if(member.role==='owner')throw new Error('O criador não pode sair do grupo.');fail(await supabase.from('hax_v231_group_members').delete().eq('group_id',group.id).eq('user_id',userId))}
    else fail(await supabase.from('hax_v231_group_members').insert({group_id:group.id,user_id:userId,status:group.is_public?'active':'pending',role:'member'}))
  },'Participação atualizada.')
  const changeMember=async(member:Member,action:'promote'|'demote'|'remove')=>perform(async()=>{
    if(action==='remove'){if(!window.confirm('Remover esta pessoa da comunidade?'))return;fail(await supabase.from('hax_v231_group_members').delete().eq('group_id',member.group_id).eq('user_id',member.user_id))}
    else fail(await supabase.from('hax_v231_group_members').update({role:action==='promote'?'moderator':'member'}).eq('group_id',member.group_id).eq('user_id',member.user_id))
  },'Membros atualizados.')
  const approve=async(member:Member,accept:boolean)=>perform(async()=>{
    if(accept)fail(await supabase.from('hax_v231_group_members').update({status:'active'}).eq('group_id',member.group_id).eq('user_id',member.user_id))
    else fail(await supabase.from('hax_v231_group_members').delete().eq('group_id',member.group_id).eq('user_id',member.user_id))
  },'Solicitação analisada.')
  const createEvent=async(event:FormEvent)=>{event.preventDefault();await perform(async()=>{
    if(!eventDate||new Date(eventDate)<=new Date())throw new Error('Escolha uma data futura.')
    fail(await supabase.from('hax_v231_events').insert({owner_id:userId,group_id:eventGroup||null,title:eventTitle.trim(),description:eventDescription.trim(),location_text:eventPlace.trim()||'Online',starts_at:new Date(eventDate).toISOString(),capacity:eventCapacity?Number(eventCapacity):null}))
    setEventTitle('');setEventDescription('');setEventDate('');setEventGroup('')
  },'Evento publicado.')}
  const rsvp=async(event:CommunityEvent)=>perform(async()=>{
    if(rsvps.some(r=>r.event_id===event.id&&r.user_id===userId))fail(await supabase.from('hax_v231_rsvps').delete().eq('event_id',event.id).eq('user_id',userId))
    else fail(await supabase.from('hax_v231_rsvps').insert({event_id:event.id,user_id:userId}))
  },'Inscrição atualizada.')
  const updateV245Privacy=async(changes:Partial<typeof v245Privacy>)=>perform(async()=>{const updated={...v245Privacy,...changes,user_id:userId};fail(await supabase.from('hax_v245_privacy').upsert(updated,{onConflict:'user_id'}));setV245Privacy(updated)},'Preferências atualizadas.')
  const updatePrefs=async(changes:Partial<Prefs>)=>perform(async()=>{fail(await supabase.from('hax_v231_preferences').upsert({...prefs,...changes,user_id:userId,updated_at:new Date().toISOString()},{onConflict:'user_id'}))},'Preferências salvas.')
  const markRead=async(id?:string)=>perform(async()=>{
    let query=supabase.from('hax_v231_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',userId)
    query=id?query.eq('id',id):query.is('read_at',null)
    fail(await query)
    window.dispatchEvent(new Event('haxbag:social-notifications-updated'))
  },'Notificações atualizadas.')
  const renameCollection=async(item:Saved,name:string)=>perform(async()=>{
    const newName=name.trim();if(!newName||newName.length>48)throw new Error('Nome de coleção inválido.');fail(await supabase.from('hax_v231_saved').update({collection:newName}).eq('user_id',userId).eq('post_id',item.post_id))
  },'Publicação movida para a coleção.')
  const removeSaved=async(item:Saved)=>perform(async()=>{fail(await supabase.from('hax_v231_saved').delete().eq('post_id',item.post_id).eq('user_id',userId))},'Item removido dos salvos.')

  if(!userId)return <div className="hb-v231-empty">Faça login para acessar os novos recursos da comunidade.</div>
  if(!ready)return <div className="hb-v231-loading">Carregando sua comunidade…</div>
  if(schemaMissing&&page==='feed')return <section className="hb-v231-unified-section"><div className="hb-v231-feedback is-error">Não foi possível carregar as publicações especiais. As publicações comuns continuam disponíveis. <button type="button" onClick={()=>void load()}>Tentar novamente</button></div><div className="hb-v248-unified-feed">{legacyPosts.map(post=><div className="hb-v248-feed-entry is-classic" key={`legacy:${post.post_id}`}>{renderLegacyPost?.(post.post_id)}</div>)}</div></section>
  if(schemaMissing)return <div className="hb-v231-install"><strong>✦ Recursos adicionais indisponíveis</strong><p>Algumas ferramentas da comunidade ainda precisam ser habilitadas.</p><button type="button" onClick={()=>void load()}>Tentar novamente</button></div>
  const filteredNotifications=notifications.filter(n=>noticeFilter==='all'||(noticeFilter==='other'?!['follow','like','comment'].includes(n.kind):n.kind===noticeFilter))
  const selected=groupById(selectedGroup)
  const renderPosts=(list:Post[])=>list.length?<div className="hb-v231-post-list">{list.map(post=><PostCard key={post.id} post={post} uid={userId} groups={groups} likes={likes} comments={comments} polls={polls} votes={votes} bookmarked={saved.some(s=>s.post_id===post.id)} busy={busy} onLike={like} onVote={vote} onSave={savePost} onComment={comment} onRemoveComment={removeComment} onEdit={editPost} onDelete={removePost} onPin={pinPost} onReport={(type,id)=>setReportTarget({type,id})} onMute={mutePostAuthor} canModerate={!!(post.group_id&&groups.find(g=>g.id===post.group_id)?.owner_id===userId)||!!(post.group_id&&members.some(m=>m.group_id===post.group_id&&m.user_id===userId&&m.role==='moderator'&&m.status==='active'))} onViewProfile={onViewProfile} originalPost={posts.find(p=>p.id===post.quoted_post_id)||(post.quoted_post_id?quotedPosts[post.quoted_post_id]:undefined)} onShare={sharePost}/>)}</div>:<div className="hb-v231-empty">Nenhuma publicação encontrada para esta seleção.</div>
  // Uma só linha do tempo: preserva as operações originais de cada tipo de publicação.
  // O backend continua responsável por controlar a visibilidade de posts e grupos privados.
  const timeline=(()=>{
    type TimelineEntry = {key:string;kind:'legacy'|'special';createdAt:number;engagement:number;legacyId?:string;post?:Post}
    const following=new Set(followingUserIds)
    const friends=new Set(friendsUserIds)
    const term=fold(feedSearch.trim())
    const canShowAuthor=(authorId:string)=>feedScope==='all'||(feedScope==='mine'&&authorId===userId)||
      (feedScope==='following'&&following.has(authorId))||(feedScope==='friends'&&friends.has(authorId))
    const special:TimelineEntry[]=visiblePosts.filter(post=>{
      if(!canShowAuthor(post.author_id)||onlyPhotos)return false
      if(term&&!fold(`${post.content} ${post.display_name} ${post.character_name||''} ${groupById(post.group_id||'')?.name||''}`).includes(term))return false
      return true
    }).map(post=>({key:`special:${post.id}`,kind:'special',createdAt:new Date(post.created_at).getTime()||0,
      engagement:likes.filter(item=>item.post_id===post.id).length+comments.filter(item=>item.post_id===post.id).length,post}))
    const legacy:TimelineEntry[]=renderLegacyPost?legacyPosts.map(post=>({
      key:`legacy:${post.post_id}`,kind:'legacy',legacyId:post.post_id,
      createdAt:new Date(post.created_at).getTime()||0,engagement:Math.max(0,Number(post.engagement??post.like_count)||0)
    })):[]
    return [...special,...legacy].sort((a,b)=>feedOrder==='popular'?
      b.engagement-a.engagement||b.createdAt-a.createdAt:
      feedOrder==='oldest'?a.createdAt-b.createdAt:b.createdAt-a.createdAt)
  })()
  const composer=<section className="hb-v231-composer-panel"><button type="button" className="hb-v231-composer-toggle" onClick={()=>setComposeOpen(open=>!open)} aria-expanded={composeOpen}><span>✎ Publicar como personagem, criar enquete ou publicar em um grupo</span><span>{composeOpen?'−':'+'}</span></button>{composeOpen&&<form onSubmit={e=>void createPost(e)} className="hb-v231-form"><label>Conte sua história<textarea value={postText} maxLength={3000} rows={4} onChange={e=>setPostText(e.target.value)} placeholder="Compartilhe sua campanha, use #hashtags ou mencione @jogadores…" required/></label><div className="hb-v231-form-grid"><label>Identidade da publicação<select value={postCharacter} onChange={e=>setPostCharacter(e.target.value)}><option value="">Minha conta · {profileName||'Aventureiro'}</option>{characters.map(ch=><option key={ch.id} value={ch.id}>{ch.emoji||'⚔'} {ch.name} (personagem)</option>)}</select></label><label>Destino<select value={postGroup} onChange={e=>setPostGroup(e.target.value)}><option value="">Feed público</option>{myGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div><label className="hb-v231-check"><input type="checkbox" checked={pollActive} onChange={e=>setPollActive(e.target.checked)}/> Adicionar enquete (7 dias)</label>{pollActive&&<div className="hb-v231-poll-options"><input maxLength={240} value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="Pergunta da enquete" required/>{pollOptions.map((opt,index)=><div key={index}><input maxLength={120} value={opt} onChange={e=>setPollOptions(current=>current.map((v,i)=>i===index?e.target.value:v))} placeholder={`Alternativa ${index+1}`} required/>{pollOptions.length>2&&<button type="button" onClick={()=>setPollOptions(options=>options.filter((_,i)=>i!==index))} aria-label="Remover alternativa">×</button>}</div>)}{pollOptions.length<4&&<button type="button" onClick={()=>setPollOptions(current=>[...current,''])}>＋ Alternativa</button>}</div>}<div className="hb-v231-form-footer"><small>{postText.length}/3000 · O autor da conta continuará identificável mesmo quando publicar como personagem.</small><button type="submit" disabled={busy||!postText.trim()}>{busy?'Publicando…':'Publicar ✦'}</button></div></form>}</section>

  return <div className={`hb-social-v231 hb-social-v231-${page}`}>
    {error&&<div className="hb-v231-feedback is-error" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Fechar">×</button></div>}
    {notice&&<div className="hb-v231-feedback" role="status">{notice}<button type="button" onClick={()=>setNotice('')} aria-label="Fechar">×</button></div>}
    {page==='feed'&&<section className="hb-v231-unified-section">
      {composer}
      <div className="hb-v231-feed-refresh"><span>✦ Um único feed para publicações, personagens, enquetes e discussões</span><button type="button" onClick={()=>{void load();onRefreshLegacy?.()}}>↻ Atualizar feed</button></div>
      <div className="hb-v248-unified-feed" aria-label="Linha do tempo da comunidade">
        {timeline.map(entry=><div key={entry.key} className={`hb-v248-feed-entry ${entry.kind==='special'?'is-special':'is-classic'}`}>
          {entry.kind==='special'&&entry.post?renderPosts([entry.post]):entry.legacyId?renderLegacyPost?.(entry.legacyId):null}
        </div>)}
      </div>
      {ready&&!legacyLoading&&timeline.length===0&&<div className="hb-v231-empty">Nenhuma publicação encontrada para os filtros selecionados. Experimente alterar a busca ou o público.</div>}
      {(!ready||legacyLoading)&&timeline.length===0&&<div className="hb-v231-empty" aria-busy="true">Carregando publicações…</div>}
    </section>}
    {page==='discover'&&<section className="hb-v231-section"><div className="hb-v231-heading"><div><small>⌕ DESCOBRIR A COMUNIDADE</small><h3>Assuntos e grupos em destaque</h3><p>Explore hashtags e discussões públicas sem expor informações de campanhas privadas.</p></div></div><div className="hb-v231-topics">{suggestions.length?suggestions.map(([tag,n])=><button type="button" key={tag} onClick={()=>{onSearchFeed?.(tag);setTerm('');onNavigate?.('feed')}}>{tag} <small>{n}</small></button>):<span>As hashtags aparecerão aqui conforme a comunidade publicar.</span>}</div><h4>Grupos para conhecer</h4><div className="hb-v231-group-grid">{groups.filter(g=>g.is_public).slice(0,6).map(g=><article key={g.id}><small>{g.topic}</small><h4>{g.name}</h4><p>{short(g.description,145)}</p><button type="button" onClick={()=>{setSelectedGroup(g.id);onNavigate?.('communities')}}>Conhecer grupo ↗</button></article>)}</div></section>}
    {page==='communities'&&<section className="hb-v231-section"><div className="hb-v231-heading"><div><small>♧ COMUNIDADES E GRUPOS</small><h3>Espaços para novas histórias</h3><p>Crie grupos públicos ou grupos privados com aprovação de entrada.</p></div><button type="button" onClick={()=>void load()}>↻ Atualizar</button></div><details className="hb-v231-details"><summary>＋ Criar comunidade</summary><form className="hb-v231-form" onSubmit={e=>void communityForm(e)}><label>Nome<input value={groupName} onChange={e=>setGroupName(e.target.value)} minLength={3} maxLength={65} required/></label><label>Descrição<textarea value={groupDescription} onChange={e=>setGroupDescription(e.target.value)} rows={3} maxLength={1400}/></label><label>Regras do grupo<textarea value={groupRules} onChange={e=>setGroupRules(e.target.value)} rows={3} maxLength={1400} placeholder="Respeite os participantes, evite spoilers, informe avisos de conteúdo…"/></label><div className="hb-v231-form-grid"><label>Assunto<input value={groupTopic} onChange={e=>setGroupTopic(e.target.value)} maxLength={40}/></label><label>Privacidade<select value={groupPublic?'public':'private'} onChange={e=>setGroupPublic(e.target.value==='public')}><option value="public">Público</option><option value="private">Privado · requer aprovação</option></select></label></div><button type="submit" disabled={busy}>Criar comunidade</button></form></details><div className="hb-v231-group-grid">{groups.map(g=>{const membership=memberStatus(g.id);return <article key={g.id} className={selectedGroup===g.id?'is-active':''}><div className="hb-v231-group-top"><span>✦ {g.topic}</span><small>{g.is_public?'Público':'Privado'}</small></div><h4>{g.name}</h4><p>{short(g.description,180)||'Um espaço para novas aventuras.'}</p><div className="hb-v231-inline-actions"><button type="button" onClick={()=>{setSelectedGroup(g.id);setPostGroup(g.id)}}>Ver discussões</button><button disabled={busy} type="button" onClick={()=>void joinGroup(g)}>{membership?.role==='owner'?'Criador':membership?.status==='pending'?'Cancelar pedido':membership?.status==='active'?'Sair do grupo':g.is_public?'Participar':'Solicitar entrada'}</button></div></article>})}</div>{selected&&<div className="hb-v231-group-conversation"><div className="hb-v231-heading"><div><small>DISCUSSÕES DO GRUPO</small><h3>{selected.name}</h3><p>{selected.description}</p>{selected.rules&&<p><strong>Regras:</strong> {selected.rules}</p>}</div><button type="button" onClick={()=>setSelectedGroup('')}>Fechar ×</button></div>{memberStatus(selected.id)?.status==='active'&&composer}{(selected.is_public||memberStatus(selected.id)?.status==='active')?renderPosts(visiblePosts.filter(p=>p.group_id===selected.id)):<div className="hb-v231-empty">Aguarde a aprovação para ler as discussões deste grupo.</div>}{selected.owner_id===userId&&<div className="hb-v231-requests"><h4>Solicitações de entrada</h4>{members.filter(m=>m.group_id===selected.id&&m.status==='pending').map(m=><div className="hb-v231-member-request" key={m.user_id}><span>Aventureiro {m.user_id.slice(0,8)}</span><button disabled={busy} onClick={()=>void approve(m,true)}>Aceitar</button><button disabled={busy} onClick={()=>void approve(m,false)}>Recusar</button></div>)}{!members.some(m=>m.group_id===selected.id&&m.status==='pending')&&<p>Nenhuma solicitação pendente.</p>}<h4>Gerenciar participantes</h4>{members.filter(m=>m.group_id===selected.id&&m.status==='active'&&m.role!=='owner').map(m=><div className="hb-v231-member-request" key={m.user_id}><span>{m.user_id.slice(0,8)} · {m.role==='moderator'?'Moderador':'Membro'}</span><button disabled={busy} onClick={()=>void changeMember(m,m.role==='moderator'?'demote':'promote')}>{m.role==='moderator'?'Remover moderação':'Tornar moderador'}</button><button disabled={busy} onClick={()=>void changeMember(m,'remove')}>Remover</button></div>)}</div>}</div>}</section>}
    {page==='saved'&&<section className="hb-v231-section"><div className="hb-v231-heading"><div><small>▤ BIBLIOTECA PARTICULAR</small><h3>Publicações salvas</h3><p>Organize seus favoritos em coleções. Somente você pode ver o que salvou.</p></div></div><div className="hb-v231-tools"><label>Coleção<select value={collection} onChange={e=>setCollection(e.target.value)}>{['Todas','Favoritos',...new Set(saved.map(item=>item.collection))].filter((name,index,array)=>array.indexOf(name)===index).map(name=><option key={name} value={name}>{name}</option>)}</select></label><span>{saved.length} salvos</span></div><div className="hb-v231-saved-list">{saved.filter(s=>collection==='Todas'||s.collection===collection).map(item=>{const post=posts.find(p=>p.id===item.post_id);return <article key={item.post_id}><small>{item.collection} · {date(item.created_at)} · {item.is_legacy?'Feed clássico':'Comunidade+'}</small><p>{post?.content||item.note||'Publicação salva — abra o feed para ver o conteúdo original.'}</p><div className="hb-v231-inline-actions"><button type="button" disabled={busy} onClick={()=>{const name=window.prompt('Mover para a coleção:',item.collection);if(name)void renameCollection(item,name)}}>Mover para coleção</button><button type="button" disabled={busy} onClick={()=>void removeSaved(item)}>Remover</button></div></article>})}</div>{!saved.length&&<div className="hb-v231-empty">Você ainda não salvou publicações. Use ▤ Salvar nos cartões do feed.</div>}{saved.length>0&&!saved.some(item=>collection==='Todas'||item.collection===collection)&&<div className="hb-v231-empty">Esta coleção está vazia. Escolha outra coleção no filtro acima.</div>}</section>}
    {page==='events'&&<section className="hb-v231-section"><div className="hb-v231-heading"><div><small>◷ AGENDA COMUNITÁRIA</small><h3>Eventos e sessões abertas</h3><p>Agende sessões, anuncie encontros e acompanhe inscrições.</p></div></div><details className="hb-v231-details"><summary>＋ Criar evento</summary><form className="hb-v231-form" onSubmit={e=>void createEvent(e)}><label>Título<input required minLength={3} maxLength={120} value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="Sessão aberta: A ruína esquecida"/></label><label>Descrição<textarea value={eventDescription} maxLength={1800} rows={3} onChange={e=>setEventDescription(e.target.value)}/></label><div className="hb-v231-form-grid"><label>Data e horário<input type="datetime-local" required value={eventDate} onChange={e=>setEventDate(e.target.value)}/></label><label>Vagas (opcional)<input type="number" min={1} max={500} value={eventCapacity} onChange={e=>setEventCapacity(e.target.value)}/></label><label>Local ou plataforma<input value={eventPlace} maxLength={160} onChange={e=>setEventPlace(e.target.value)}/></label><label>Comunidade<select value={eventGroup} onChange={e=>setEventGroup(e.target.value)}><option value="">Evento público</option>{myGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div><button disabled={busy} type="submit">Publicar evento</button></form></details><div className="hb-v231-events">{events.map(event=>{const count=rsvps.filter(r=>r.event_id===event.id).length;const joined=rsvps.some(r=>r.event_id===event.id&&r.user_id===userId);return <article key={event.id}><div className="hb-v231-event-calendar"><strong>{new Date(event.starts_at).getDate()}</strong><small>{new Date(event.starts_at).toLocaleString('pt-BR',{month:'short'})}</small></div><div><small>{event.group_id?groupById(event.group_id)?.name:'Evento público'} · {dateLong(event.starts_at)}</small><h4>{event.title}</h4><p>{event.description||'Encontro da comunidade.'}</p><small>⌖ {event.location_text} · {count} participantes {event.capacity&&`/ ${event.capacity} vagas`}</small></div><div className="hb-v231-event-action"><button type="button" disabled={busy||(!joined&&event.capacity!==null&&count>=event.capacity)} onClick={()=>void rsvp(event)}>{joined?'✓ Inscrito · cancelar':'Participar'}</button>{event.owner_id===userId&&<button type="button" disabled={busy} onClick={()=>void perform(async()=>{if(!window.confirm('Excluir este evento?'))return;fail(await supabase.from('hax_v231_events').delete().eq('id',event.id))},'Evento removido.')}>Excluir</button>}</div></article>})}{!events.length&&<div className="hb-v231-empty">Não há eventos programados no momento.</div>}</div></section>}
    {page==='activity'&&<section className="hb-v231-section"><div className="hb-v231-heading"><div><small>✦ SUA JORNADA</small><h3>Atividade na comunidade</h3><p>Seus registros recentes de publicações e interações. Você decide se visitantes podem ver esse resumo.</p></div></div><ol className="hb-v245-activity-list">{activity.map(a=><li key={`${a.kind}-${a.id}`}><small>{date(a.created_at)}</small><strong>{a.kind==='post'?'✎ Publicação':'✦ Atividade'}</strong><span>{short(a.title,220)}</span></li>)}</ol>{!activity.length&&<div className="hb-v231-empty">Suas atividades aparecerão aqui conforme você participar da comunidade.</div>}</section>}
    {page==='notifications'&&<section className="hb-v231-section">
      <div className="hb-v231-heading">
        <div><small>✉ CENTRAL DE AVISOS</small><h3>Atividades importantes</h3><p>Novos seguidores, comentários, curtidas, inscrições e convites da comunidade.</p></div>
        <button type="button" disabled={busy||!notifications.some(n=>!n.read_at)} onClick={()=>void markRead()}>Marcar todas como lidas</button>
      </div>
      <div className="hb-v245-notifications-filter"><label>Mostrar <select value={noticeFilter} onChange={e=>setNoticeFilter(e.target.value)}><option value="all">Todas</option><option value="follow">Seguidores</option><option value="like">Curtidas</option><option value="comment">Comentários</option><option value="other">Outras</option></select></label><strong>{notifications.filter(n=>!n.read_at).length} não lidas</strong></div>
      <div className="hb-v231-notices">
        {filteredNotifications.map((item,index)=><div className="hb-v231-notice-wrap" key={item.id}>
          {(index===0||new Date(filteredNotifications[index-1].created_at).toLocaleDateString('pt-BR')!==new Date(item.created_at).toLocaleDateString('pt-BR'))&&<h4>{new Date(item.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</h4>}
          <article className={!item.read_at?'unread':''}>
            <span aria-hidden="true">{item.kind==='follow'?'↗':item.kind==='like'?'♡':item.kind==='comment'?'💬':item.kind==='membership'?'♧':'◷'}</span>
            <div><strong>{item.title}</strong><small>{date(item.created_at)}</small>
              {item.kind==='follow'&&item.actor_id&&onViewProfile&&<button type="button" className="hb-v244-follow-profile" onClick={()=>{if(!item.read_at)void markRead(item.id);onViewProfile(item.actor_id!)}}>Ver perfil de quem seguiu ↗</button>}
            </div>
            {!item.read_at&&<button type="button" disabled={busy} onClick={()=>void markRead(item.id)}>Marcar lida</button>}
          </article>
        </div>)}
        {!notifications.length&&<div className="hb-v231-empty">Nenhuma notificação por enquanto.</div>}
      </div>
    </section>}
    {page==='moderation'&&<section className="hb-v231-section"><div className="hb-v231-heading"><div><small>⊘ SEGURANÇA E PRIVACIDADE</small><h3>Preferências sociais</h3><p>Configure a visibilidade das suas atividades e os alertas da comunidade.</p></div></div><div className="hb-v231-preferences"><label className="hb-v231-check"><input type="checkbox" disabled={busy} checked={prefs.notifications_enabled} onChange={e=>void updatePrefs({notifications_enabled:e.target.checked})}/> Receber notificações sobre interações</label><label className="hb-v231-check"><input type="checkbox" disabled={busy} checked={prefs.activity_public} onChange={e=>void updatePrefs({activity_public:e.target.checked})}/> Permitir que visitantes vejam minha atividade pública</label><div className="hb-v245-preferences-grid">{(['allow_quotes','allow_messages','allow_mentions','alerts_follow','alerts_like','alerts_comment','alerts_other'] as const).map(key=><label className="hb-v231-check" key={key}><input type="checkbox" checked={v245Privacy[key]} disabled={busy} onChange={e=>void updateV245Privacy({[key]:e.target.checked})}/>{({allow_quotes:'Permitir que citem ou republiquem meus posts públicos',allow_messages:'Receber novas mensagens privadas de amigos',allow_mentions:'Permitir menções futuras a este perfil',alerts_follow:'Notificar novos seguidores',alerts_like:'Notificar curtidas',alerts_comment:'Notificar comentários',alerts_other:'Notificar outras interações'})[key]}</label>)}</div><p>Para bloquear uma conta, utilize o menu do perfil. Para silenciar autores, use o menu das publicações. As denúncias enviadas por aqui são analisadas exclusivamente pelos administradores.</p></div></section>}
    {reportTarget&&<div className="hb-v231-report-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setReportTarget(null)}}><form role="dialog" aria-modal="true" aria-label="Denunciar conteúdo" className="hb-v231-report-dialog hb-v231-form" onSubmit={e=>void report(e)}><h3>⚑ Enviar denúncia</h3><p>A denúncia será analisada pela administração do HäxBag.</p><label>Motivo<select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option>Conteúdo inadequado</option><option>Assédio ou ameaças</option><option>Spam</option><option>Imitação de identidade</option><option>Violação de privacidade</option><option>Outro motivo</option></select></label><label>Informações adicionais (opcional)<textarea value={reportDetail} maxLength={1200} rows={3} onChange={e=>setReportDetail(e.target.value)}/></label><div className="hb-v231-inline-actions"><button type="button" onClick={()=>setReportTarget(null)}>Cancelar</button><button disabled={busy} type="submit">Enviar denúncia</button></div></form></div>}
  </div>
}
