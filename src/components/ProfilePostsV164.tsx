import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import './ProfileSocialV164.css'
import SocialPostComments, { useSocialCommentCounts } from './SocialPostComments'

type ProfilePost = {post_id:string;author_id:string;display_name:string;username:string;content:string;visibility:'public'|'followers'|'friends';created_at:string;like_count:number;liked:boolean;image_paths:string[]}
type Props = {authorId:string;active:boolean;isSelf?:boolean;avatarUrl?:string}
const BUCKET = 'hax-social-posts'
export default function ProfilePostsV164({authorId,active,isSelf=false,avatarUrl}:Props){
 const [postFilter,setPostFilter]=useState<'all'|'photos'>('all')
 const [posts,setPosts]=useState<ProfilePost[]>([])
 const {counts:commentCounts,updateCount:updateCommentCount}=useSocialCommentCounts(posts.map(post=>post.post_id),active)
 const [images,setImages]=useState<Record<string,string>>({})
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(false)
 const [more,setMore]=useState(false)
 const [error,setError]=useState('')
 const [viewer,setViewer]=useState<{urls:string[];index:number}|null>(null)
 const [refresh,setRefresh]=useState(0)
 useEffect(()=>{
  if(!active || !authorId)return
  let cancelled=false
  setLoading(true);setError('');setPosts([]);setImages({});setMore(false)
  void supabase.rpc('hax_social_profile_posts_v164',{p_author:authorId,p_limit:12}).then(({data,error:failure})=>{
   if(cancelled)return
   if(failure)setError('Não foi possível carregar as publicações. Confira se a migração V164 foi aplicada.')
   else {const rows=(data||[]) as ProfilePost[];setPosts(rows);setMore(rows.length===12)}
   setLoading(false)
  })
  return()=>{cancelled=true}
 },[active,authorId,refresh])
 useEffect(()=>{
  if(!active || !posts.length)return
  let cancelled=false
  const paths=[...new Set(posts.flatMap(p=>p.image_paths||[]))].filter(path=>!images[path])
  if(!paths.length)return
  void (async()=>{
   const urls:Record<string,string>={}
   for(let i=0;i<paths.length;i+=10){
    const results=await Promise.all(paths.slice(i,i+10).map(async path=>{
      const {data}=await supabase.storage.from(BUCKET).createSignedUrl(path,600)
      return {path,url:data?.signedUrl||''}
    }))
    results.forEach(({path,url})=>{if(url)urls[path]=url})
   }
   if(!cancelled)setImages(prev=>({...prev,...urls}))
  })()
  return()=>{cancelled=true}
 },[active,posts,images])
 useEffect(()=>{
  if(!viewer)return
  const listener=(event:KeyboardEvent)=>{
   if(event.key==='Escape')setViewer(null)
   if(event.key==='ArrowRight')setViewer(v=>v?{...v,index:(v.index+1)%v.urls.length}:null)
   if(event.key==='ArrowLeft')setViewer(v=>v?{...v,index:(v.index-1+v.urls.length)%v.urls.length}:null)
  }
  window.addEventListener('keydown',listener)
  return()=>window.removeEventListener('keydown',listener)
 },[viewer])
 async function loadMore(){
  if(busy||!more||!posts.length)return
  setBusy(true);setError('')
  const {data,error:failure}=await supabase.rpc('hax_social_profile_posts_v164',{p_author:authorId,p_before:posts[posts.length-1].created_at,p_limit:12})
  if(failure)setError(failure.message)
  else {const rows=(data||[]) as ProfilePost[];setPosts(prev=>[...prev,...rows.filter(row=>!prev.some(p=>p.post_id===row.post_id))]);setMore(rows.length===12)}
  setBusy(false)
 }
 async function toggleLike(post:ProfilePost){
  if(busy)return
  setBusy(true)
  const {data:likedResult,error:failure}=await supabase.rpc('hax_social_like_post',{p_post:post.post_id})
  if(failure)setError(failure.message)
  else setPosts(prev=>prev.map(item=>{
    if(item.post_id!==post.post_id)return item
    const nowLiked=typeof likedResult==='boolean'?likedResult:!item.liked
    return {...item,liked:nowLiked,like_count:Math.max(0,Number(item.like_count)+(nowLiked===item.liked?0:nowLiked?1:-1))}
  }))
  setBusy(false)
 }
 return <div className="hb-v164-posts">
  <div className="hb-v164-posts-intro"><div><span className="hb-public-overline">LINHA DO TEMPO</span><h3>Publicações</h3><p>Momentos, fotos e histórias compartilhados na comunidade.</p></div><button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>↻ Atualizar</button></div>
  <div className="hb-v165-feed-filter" role="group" aria-label="Filtrar publicações"><button type="button" className={postFilter==='all'?'is-active':''} aria-pressed={postFilter==='all'} onClick={()=>setPostFilter('all')}>▦ Todas</button><button type="button" className={postFilter==='photos'?'is-active':''} aria-pressed={postFilter==='photos'} onClick={()=>setPostFilter('photos')}>▧ Com fotos</button></div>
  {error&&<p role="alert" className="hb-v164-post-error">{error}</p>}
  {loading&&<p className="hb-public-muted" role="status">Carregando publicações…</p>}
  {!loading&&!posts.length&&!error&&<div className="hb-v164-post-empty"><span>✧</span><strong>Nenhuma publicação por aqui ainda.</strong><p>{isSelf?'Compartilhe sua primeira história pelo feed da comunidade.':'As publicações disponíveis desta pessoa aparecerão aqui.'}</p></div>}
  {posts.length>0 && postFilter==='photos' && !posts.some(post=>(post.image_paths||[]).length>0)&&!loading&&<p className="hb-v164-post-empty">Nenhuma foto nas publicações carregadas. Experimente carregar mais publicações.</p>}
  {posts.filter(post=>postFilter==='all'||(post.image_paths||[]).length>0).map(post=>{const urls=(post.image_paths||[]).map(path=>images[path]).filter(Boolean);return <article className="hb-v164-post" key={post.post_id}>
   <div className="hb-v164-post-meta"><div className="hb-v164-mini-avatar">{avatarUrl ? <img src={avatarUrl} alt="" loading="lazy"/> : (post.display_name||'A').slice(0,1).toUpperCase()}</div><div><strong>{post.display_name}</strong><span>@{post.username} · {new Date(post.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div><small>{post.visibility==='public'?'🌐 Público':post.visibility==='friends'?'♧ Amigos':'◉ Seguidores'}</small></div>
   {post.content&&<p className="hb-v164-post-body">{post.content}</p>}
   {!!urls.length&&<div className={`hb-v164-photo-grid count-${urls.length}`}>{urls.map((url,i)=><button key={`${post.post_id}-${i}`} type="button" onClick={()=>setViewer({urls,index:i})} aria-label={`Ampliar foto ${i+1} de ${urls.length}`}><img src={url} loading="lazy" alt={`Foto ${i+1} da publicação de ${post.display_name}`}/></button>)}</div>}
   <div className="hb-v164-post-actions"><button type="button" disabled={busy} onClick={()=>void toggleLike(post)} aria-pressed={post.liked} className={post.liked?'liked':''}>{post.liked?'♥':'♡'} {Number(post.like_count)||0} curtida{Number(post.like_count)===1?'':'s'}</button><span>{post.image_paths?.length||0} foto{post.image_paths?.length===1?'':'s'}</span></div>
   <SocialPostComments postId={post.post_id} count={commentCounts[post.post_id]} onCountChange={updateCommentCount}/>
  </article>})}
  {more&&<button type="button" className="hb-v164-load-more" disabled={busy} onClick={()=>void loadMore()}>{busy?'Carregando…':'Ver mais publicações'}</button>}
  {viewer&&<div className="hb-v164-lightbox" role="dialog" aria-modal="true" aria-label="Visualizar foto" onMouseDown={e=>{if(e.target===e.currentTarget)setViewer(null)}}><button type="button" className="hb-v164-close" onClick={()=>setViewer(null)} aria-label="Fechar">✕</button>{viewer.urls.length>1&&<button type="button" onClick={()=>setViewer(v=>v?{...v,index:(v.index-1+v.urls.length)%v.urls.length}:null)} aria-label="Foto anterior">‹</button>}<img src={viewer.urls[viewer.index]} alt={`Foto ampliada ${viewer.index+1}`}/>{viewer.urls.length>1&&<button type="button" onClick={()=>setViewer(v=>v?{...v,index:(v.index+1)%v.urls.length}:null)} aria-label="Próxima foto">›</button>}<span>{viewer.index+1} / {viewer.urls.length}</span></div>}
 </div>
}
