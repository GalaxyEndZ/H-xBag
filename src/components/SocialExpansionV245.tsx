import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './SocialExpansionV245.css'

type Page = 'showcase'|'tablefinder'|'trends'|'insights'|'security'|'characternews'
type Post = {id:string;author_id:string;content:string;created_at:string;group_id:string|null}
type Character = {id:string;name:string;emoji:string|null}
type Showcase = {user_id:string;post_ids:string[];character_ids:string[];gallery_urls:string[];public:boolean}
type Listing = {id:string;master_id:string;title:string;system_name:string;description:string;schedule_text:string;platform:string;slots:number;status:string;created_at:string}
type Application = {listing_id:string;user_id:string;message:string;status:string;created_at:string}
type CharacterNews = {id:string;owner_id:string;character_id:string;title:string;description:string;public:boolean;created_at:string}
type Props = {page:Page;userId:string;onViewProfile?:(id:string)=>void;onNavigate?:(page:'feed'|'discover')=>void}
const describeError=(error:unknown):string=>error instanceof Error?error.message:typeof error==='object'&&error!==null&&'message' in error?String(error.message):String(error)
const checked=<T,>(r:{data:T;error:{message:string}|null}):T=>{if(r.error)throw new Error(r.error.message);return r.data}
const format=(date:string)=>new Date(date).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'})
const compact=(s:string,n=160)=>s.length>n?s.slice(0,n).trimEnd()+'…':s
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

export function SocialV245PublicShowcase({userId,allowCharacters=true,allowBadges=true}:{userId:string;allowCharacters?:boolean;allowBadges?:boolean}) {
 const [showcase,setShowcase]=useState<Showcase|null>(null)
 const [posts,setPosts]=useState<Post[]>([])
 const [characters,setCharacters]=useState<Character[]>([])
 useEffect(()=>{let live=true;void (async()=>{
   const r=await supabase.from('hax_v245_showcase').select('*').eq('user_id',userId).eq('public',true).maybeSingle()
   if(!live||r.error||!r.data)return
   const item=r.data as Showcase;setShowcase(item)
   const [ps,cs]=await Promise.all([
     item.post_ids?.length?supabase.from('hax_v231_posts').select('id,author_id,content,created_at,group_id').in('id',item.post_ids).eq('author_id',userId).is('group_id',null):Promise.resolve({data:[],error:null}),
     item.character_ids?.length&&allowCharacters?supabase.from('characters').select('id,name,emoji').in('id',item.character_ids).eq('user_id',userId):Promise.resolve({data:[],error:null}),
   ])
   if(live){setPosts((ps.data||[]) as Post[]);setCharacters((cs.data||[]) as Character[])}
 })();return()=>{live=false}},[userId,allowCharacters])
 if(!showcase)return null
 const orderPosts=showcase.post_ids.map(id=>posts.find(p=>p.id===id)).filter((p):p is Post=>!!p)
 const orderChars=showcase.character_ids.map(id=>characters.find(c=>c.id===id)).filter((c):c is Character=>!!c)
 if(!orderPosts.length&&!orderChars.length&&!showcase.gallery_urls?.length)return null
 return <section className="hb-v245-showcase hb-v245-panel"><div className="hb-v245-section-heading"><small>✦ VITRINE DO AVENTUREIRO</small><h3>Em destaque</h3><p>Uma seleção feita pelo próprio jogador.</p></div>
   {orderPosts.length>0&&<div className="hb-v245-showcase-grid">{orderPosts.map(p=><article key={p.id}><small>▧ PUBLICAÇÃO EM DESTAQUE</small><p>{compact(p.content,350)}</p><time>{format(p.created_at)}</time></article>)}</div>}
   {allowCharacters&&orderChars.length>0&&<div className="hb-v245-featured-characters">{orderChars.map(c=><div key={c.id}><span>{c.emoji||'⚔'}</span><strong>{c.name}</strong></div>)}</div>}
   {(showcase.gallery_urls||[]).length>0&&<div className="hb-v245-gallery">{showcase.gallery_urls.map((url,i)=><a href={url} target="_blank" rel="noopener noreferrer nofollow" key={`${i}-${url}`}><img loading="lazy" alt={`Imagem ${i+1} da galeria`} src={url}/></a>)}</div>}
   {allowBadges&&<small className="hb-v245-footnote">Insígnias oficiais continuam na seção de conquistas do perfil.</small>}
 </section>
}

export function SocialV245AppealForm({userId}:{userId:string}) {
 const [message,setMessage]=useState('');const [rows,setRows]=useState<{id:string;status:string;resolution:string;created_at:string}[]>([])
 const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState('')
 const load=useCallback(async()=>{const r=await supabase.from('hax_v245_appeals').select('id,status,resolution,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(10);if(r.error)setFeedback(r.error.message);else setRows(r.data||[])},[userId])
 useEffect(()=>{void load()},[load])
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setFeedback('');try{
  checked(await supabase.from('hax_v245_appeals').insert({user_id:userId,message:message.trim()}));setMessage('');await load();setFeedback('Solicitação recebida. A administração poderá analisar sua contestação.')
 }catch(err){setFeedback(describeError(err))}finally{setBusy(false)}}
 return <section className="hb-v245-panel hb-v245-appeals"><h3>Solicitar revisão do banimento</h3><p>Explique o motivo da contestação. Uma nova solicitação só pode ser enviada depois da decisão sobre a anterior.</p>
 <form onSubmit={e=>void submit(e)}><label>Sua contestação<textarea minLength={20} maxLength={2000} required value={message} rows={4} onChange={e=>setMessage(e.target.value)} placeholder="Conte o que aconteceu e por que deseja uma revisão…"/></label><button type="submit" disabled={busy||message.trim().length<20||rows.some(r=>r.status==='pending')}>{busy?'Enviando…':'Enviar contestação'}</button></form>
 {feedback&&<p role="status">{feedback}</p>}{rows.map(r=><div key={r.id} className="hb-v245-appeal-row"><strong>{r.status==='pending'?'Aguardando análise':r.status==='accepted'?'Aprovada':'Recusada'}</strong><small>{format(r.created_at)}</small>{r.resolution&&<p>{r.resolution}</p>}</div>)}
 </section>
}

export function SocialV245AdminAppeals({onViewProfile}:{onViewProfile?:(id:string)=>void}) {
 const [allowed,setAllowed]=useState(false);const [rows,setRows]=useState<{id:string;user_id:string;message:string;status:string;resolution:string;created_at:string}[]>([])
 const [names,setNames]=useState<Record<string,string>>({});const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{
  try{const a=checked(await supabase.rpc('hax_v231_admin'));if(a!==true){setAllowed(false);return}setAllowed(true)
   const rs=checked(await supabase.from('hax_v245_appeals').select('id,user_id,message,status,resolution,created_at').order('created_at',{ascending:false}).limit(150));const list=(rs||[]) as typeof rows;setRows(list)
   const ids=[...new Set(list.map(x=>x.user_id))];if(ids.length){const people=checked(await supabase.from('profiles').select('id,username').in('id',ids));setNames(Object.fromEntries((people||[]).map(p=>[p.id,p.username||''])))}
  }catch(e){setError(describeError(e))}},[])
 useEffect(()=>{void load()},[load])
 async function review(id:string,status:'accepted'|'rejected'){
  const resolution=window.prompt('Justificativa da decisão (mínimo 8 caracteres):');if(!resolution||resolution.trim().length<8)return
  if(!window.confirm('Confirmar a decisão? Ela será registrada no histórico.'))return
  setBusy(true);setError('');try{checked(await supabase.from('hax_v245_appeals').update({status,resolution:resolution.trim()}).eq('id',id).eq('status','pending'));await load()}
  catch(e){setError(describeError(e))}finally{setBusy(false)}
 }
 if(!allowed)return null
 return <section className="hb-v245-panel hb-v245-admin-appeals"><header className="hb-v245-section-heading"><small>CONTROLE ADMINISTRATIVO</small><h3>Contestações de banimento</h3><p>Aprovar uma contestação não remove o banimento automaticamente. Revogue-o na aba Usuários após conferir a decisão.</p></header>
  {error&&<p role="alert">{error}</p>}
  {rows.map(r=><article key={r.id}><div className="hb-v245-inline"><strong><button type="button" onClick={()=>onViewProfile?.(r.user_id)}>@{names[r.user_id]||'conta identificada'}</button></strong><small>{format(r.created_at)}</small><span>{r.status==='pending'?'Pendente':r.status==='accepted'?'Aprovada':'Recusada'}</span></div><p>{r.message}</p>{r.resolution&&<p><strong>Decisão:</strong> {r.resolution}</p>}{r.status==='pending'&&<div className="hb-v245-inline"><button type="button" disabled={busy} onClick={()=>void review(r.id,'accepted')}>Aprovar revisão</button><button type="button" disabled={busy} onClick={()=>void review(r.id,'rejected')}>Recusar</button></div>}</article>)}
  {rows.length===0&&<p>Nenhuma contestação registrada.</p>}
 </section>
}

function SecurityTab(){
 const [user,setUser]=useState<{email?:string;last_sign_in_at?:string} |null>(null)
 const [factors,setFactors]=useState<{id:string;friendly_name?:string}[]>([])
 const [enrollment,setEnrollment]=useState<{id:string;qr_code:string;secret:string}|null>(null)
 const [verificationCode,setVerificationCode]=useState('');const [pendingCode,setPendingCode]=useState('')
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('')
 const refresh=useCallback(async()=>{try{const [a,b]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.listFactors()]);if(a.error)throw a.error;if(b.error)throw b.error;setUser(a.data.user);setFactors(b.data.totp.filter(x=>x.status==='verified'))}catch(e){setNotice(describeError(e))}},[])
 useEffect(()=>{void refresh()},[refresh])
 async function enroll(){setBusy(true);setNotice('');try{const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'HäxBag'});if(error)throw error;setEnrollment({id:data.id,qr_code:data.totp.qr_code,secret:data.totp.secret})}catch(e){setNotice(describeError(e))}finally{setBusy(false)}}
 async function confirm(e:FormEvent){e.preventDefault();if(!enrollment)return;setBusy(true);setNotice('');try{const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:enrollment.id,code:verificationCode.trim()});if(error)throw error;setEnrollment(null);setVerificationCode('');setNotice('Autenticador verificado. Seu segundo fator está ativo.');await refresh()}catch(e){setNotice(describeError(e))}finally{setBusy(false)}}
 async function challenge(e:FormEvent){e.preventDefault();setBusy(true);try{const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factors[0].id,code:pendingCode.trim()});if(error)throw error;setNotice('Autenticação adicional confirmada.');setPendingCode('')}catch(e){setNotice(describeError(e))}finally{setBusy(false)}}
 return <section className="hb-v245-stack">
  <article className="hb-v245-panel"><small>SESSÃO ATUAL</small><h3>Segurança da conta</h3><p><strong>Conta:</strong> {user?.email||'Carregando…'}</p><p><strong>Última entrada registrada:</strong> {user?.last_sign_in_at?format(user.last_sign_in_at):'Não disponível'}</p><p>Você pode encerrar a sessão atual ou sair de todos os dispositivos conectados.</p><div className="hb-v245-inline"><button type="button" onClick={()=>void supabase.auth.signOut()}>Sair</button><button type="button" onClick={()=>{if(window.confirm('Encerrar todas as sessões da sua conta?'))void supabase.auth.signOut({scope:'global'})}}>Sair de todos os dispositivos</button></div></article>
  <article className="hb-v245-panel"><small>VERIFICAÇÃO EM DUAS ETAPAS</small><h3>Aplicativo autenticador</h3><p>Adicione um segundo fator para aumentar a proteção da sua conta.</p>
  {factors.length>0?<><p>✓ {factors.length} autenticador(es) verificado(s).</p><form onSubmit={e=>void challenge(e)}><label>Confirmar código atual<input value={pendingCode} inputMode="numeric" maxLength={8} onChange={e=>setPendingCode(e.target.value)} placeholder="Código de 6 dígitos"/></label><button disabled={busy||pendingCode.length<6}>Verificar código</button></form></>:!enrollment?<button type="button" disabled={busy} onClick={()=>void enroll()}>Ativar segundo fator</button>:<form onSubmit={e=>void confirm(e)}><p>Escaneie com seu aplicativo autenticador ou copie a chave abaixo. Não compartilhe a chave.</p><img className="hb-v245-mfa-qr" src={enrollment.qr_code} alt="Código QR para configurar autenticador"/><code>{enrollment.secret}</code><label>Código gerado no aplicativo<input inputMode="numeric" maxLength={8} value={verificationCode} onChange={e=>setVerificationCode(e.target.value)}/></label><button type="submit" disabled={busy||verificationCode.trim().length<6}>Confirmar segundo fator</button></form>}
  <p className="hb-v245-footnote">A ativação exige completar a verificação. Recomendamos exigir o segundo fator também no próximo login.</p></article>
  {notice&&<p role="status" className="hb-v245-panel">{notice}</p>}
 </section>
}

export default function SocialExpansionV245({page,userId,onViewProfile,onNavigate}:Props){
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false)
 const [showcase,setShowcase]=useState<Showcase>({user_id:userId,post_ids:[],character_ids:[],gallery_urls:[],public:true})
 const [posts,setPosts]=useState<Post[]>([]);const [characters,setCharacters]=useState<Character[]>([])
 const [listings,setListings]=useState<Listing[]>([]);const [applications,setApplications]=useState<Application[]>([])
 const [news,setNews]=useState<CharacterNews[]>([]);const [summary,setSummary]=useState<{followers?:number;following?:number}|null>(null)
 const [likes,setLikes]=useState<{post_id:string;user_id:string;created_at?:string}[]>([])
 const [comments,setComments]=useState<{post_id:string;created_at:string}[]>([])
 const [followerEvents,setFollowerEvents]=useState<{delta:number;created_at:string}[]>([])
 const [term,setTerm]=useState('');const [platform,setPlatform]=useState('Todas');const [trendDays,setTrendDays]=useState(7)
 const [newGallery,setNewGallery]=useState('')
 const [newListing,setNewListing]=useState({title:'',system_name:'',schedule_text:'',platform:'Online',slots:4,description:''})
 const [newNews,setNewNews]=useState({character_id:'',title:'',description:'',public:false})
 const load=useCallback(async()=>{
  setError('');try{
   if(page==='security')return
   if(page==='showcase'||page==='characternews'||page==='insights'||page==='trends'){
    const [ps,cs]=await Promise.all([
      supabase.from('hax_v231_posts').select('id,author_id,content,created_at,group_id').order('created_at',{ascending:false}).limit(250),
      supabase.from('characters').select('id,name,emoji').eq('user_id',userId).limit(100),
    ]);setPosts(checked(ps) as Post[]);setCharacters(checked(cs) as Character[])
    if(page==='showcase'){
     const sh=checked(await supabase.from('hax_v245_showcase').select('*').eq('user_id',userId).maybeSingle());setShowcase((sh as Showcase|null)||{user_id:userId,post_ids:[],character_ids:[],gallery_urls:[],public:true})
    }
    if(page==='characternews')setNews(checked(await supabase.from('hax_v245_character_news').select('*').eq('owner_id',userId).order('created_at',{ascending:false}).limit(100)) as CharacterNews[])
    if(page==='insights'){
     const own=(ps.data||[]).filter(p=>p.author_id===userId).map(p=>p.id)
     const [sum,ls,cs2]=await Promise.all([
       supabase.rpc('hax_social_summary'),
       own.length?supabase.from('hax_v231_likes').select('post_id,user_id').in('post_id',own).limit(3000):Promise.resolve({data:[],error:null}),
       own.length?supabase.from('hax_v231_comments').select('post_id,created_at').in('post_id',own).limit(3000):Promise.resolve({data:[],error:null}),
     ]);if(!sum.error)setSummary(sum.data as {followers?:number;following?:number});if(!ls.error)setLikes(ls.data||[]);if(!cs2.error)setComments(cs2.data||[])
     const followerHistory=await supabase.from('hax_v245_follower_events').select('delta,created_at').eq('user_id',userId).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).limit(1000);if(!followerHistory.error)setFollowerEvents(followerHistory.data||[])
    }
   }
   if(page==='tablefinder'){const [ls,as]=await Promise.all([supabase.from('hax_v245_table_listings').select('*').order('created_at',{ascending:false}).limit(150),supabase.from('hax_v245_table_applications').select('*').limit(1000)]);setListings(checked(ls) as Listing[]);setApplications(checked(as) as Application[])}
  }catch(e){setError(describeError(e))}
 },[page,userId])
 useEffect(()=>{void load()},[load])
 async function perform(fn:()=>Promise<void>,message:string){setBusy(true);setError('');setNotice('');try{await fn();await load();setNotice(message)}catch(e){setError(describeError(e))}finally{setBusy(false)}}
 const myPosts=posts.filter(p=>p.author_id===userId&&!p.group_id)
 const filteredListings=listings.filter(l=>(platform==='Todas'||platform===l.platform)&&(!term||normalized(`${l.title} ${l.system_name} ${l.description} ${l.schedule_text}`).includes(normalized(term))))
 const trends=useMemo(()=>{const counts=new Map<string,number>();for(const post of posts){if(post.group_id||Date.now()-new Date(post.created_at).getTime()>trendDays*86400000)continue;for(const tag of post.content.match(/#[\p{L}\p{N}_]{2,32}/gu)||[]){const name=tag.toLowerCase();counts.set(name,(counts.get(name)||0)+1)}}return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20)},[posts,trendDays])
 const postStats=posts.filter(p=>p.author_id===userId)
 const monthPosts=Array.from({length:6},(_,index)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-5+index);return {label:d.toLocaleString('pt-BR',{month:'short'}),count:postStats.filter(p=>{const pdate=new Date(p.created_at);return pdate.getFullYear()===d.getFullYear()&&pdate.getMonth()===d.getMonth()}).length}})
 const maxPosts=Math.max(1,...monthPosts.map(m=>m.count))
 return <div className="hb-v245-stack" aria-label="Recursos da comunidade">
 {error&&<p className="hb-v245-feedback" role="alert">{error}</p>}{notice&&<p className="hb-v245-feedback" role="status">{notice}</p>}
 {page==='showcase'&&<section className="hb-v245-panel"><div className="hb-v245-section-heading"><small>✦ SUA IDENTIDADE</small><h3>Vitrine do perfil</h3><p>Escolha até três publicações, três personagens e seis imagens. Seus destaques só aparecem publicamente quando você habilita a vitrine.</p></div>
 <label className="hb-v245-checkbox"><input type="checkbox" checked={showcase.public} onChange={e=>setShowcase(v=>({...v,public:e.target.checked}))}/> Exibir a vitrine para visitantes</label>
 <h4>Publicações em destaque ({showcase.post_ids.length}/3)</h4><div className="hb-v245-options">{myPosts.map(p=><label key={p.id} className="hb-v245-checkbox"><input type="checkbox" checked={showcase.post_ids.includes(p.id)} disabled={!showcase.post_ids.includes(p.id)&&showcase.post_ids.length>=3} onChange={e=>setShowcase(s=>({...s,post_ids:e.target.checked?[...s.post_ids,p.id]:s.post_ids.filter(id=>id!==p.id)}))}/>{compact(p.content,110)}</label>)}</div>
 <h4>Personagens em destaque ({showcase.character_ids.length}/3)</h4><div className="hb-v245-options">{characters.map(c=><label key={c.id} className="hb-v245-checkbox"><input type="checkbox" checked={showcase.character_ids.includes(c.id)} disabled={!showcase.character_ids.includes(c.id)&&showcase.character_ids.length>=3} onChange={e=>setShowcase(s=>({...s,character_ids:e.target.checked?[...s.character_ids,c.id]:s.character_ids.filter(id=>id!==c.id)}))}/>{c.emoji||'⚔'} {c.name}</label>)}</div>
 <h4>Galeria de imagens ({showcase.gallery_urls.length}/6)</h4><div className="hb-v245-inline"><input value={newGallery} onChange={e=>setNewGallery(e.target.value)} placeholder="https://endereco-da-sua-imagem.jpg" type="url" aria-label="Endereço HTTPS da imagem"/><button type="button" disabled={showcase.gallery_urls.length>=6||!/^https:\/\//i.test(newGallery)} onClick={()=>{setShowcase(v=>({...v,gallery_urls:[...v.gallery_urls,newGallery.trim()]}));setNewGallery('')}}>Adicionar imagem</button></div><div className="hb-v245-gallery">{showcase.gallery_urls.map((url,i)=><div key={`${i}-${url}`}><img src={url} alt={`Imagem ${i+1}`}/><button type="button" onClick={()=>setShowcase(v=>({...v,gallery_urls:v.gallery_urls.filter((_,idx)=>idx!==i)}))}>Remover</button></div>)}</div>
 <button type="button" disabled={busy} onClick={()=>void perform(async()=>{checked(await supabase.from('hax_v245_showcase').upsert(showcase,{onConflict:'user_id'}))},'Vitrine atualizada.')}>Salvar vitrine</button>
 <p className="hb-v245-footnote">As insígnias continuam oficiais e são exibidas na aba Conquistas do perfil. Você não pode conceder insígnias a si mesmo.</p></section>}
 {page==='tablefinder'&&<><section className="hb-v245-panel hb-v245-table-head"><div className="hb-v245-section-heading"><small>⚔ PROCURAR MESA</small><h3>Encontre sua próxima aventura</h3><p>Mestres podem anunciar vagas e candidatos podem enviar solicitações diretamente pelo HäxBag.</p></div><div className="hb-v245-inline"><input type="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Sistema, título, horário…" aria-label="Pesquisar mesas"/><select value={platform} onChange={e=>setPlatform(e.target.value)} aria-label="Modalidade"><option>Todas</option><option>Online</option><option>Presencial</option><option>Híbrido</option></select></div></section>
 <details className="hb-v245-panel"><summary>＋ Anunciar uma nova mesa</summary><form className="hb-v245-form" onSubmit={e=>{e.preventDefault();void perform(async()=>{checked(await supabase.from('hax_v245_table_listings').insert({...newListing,master_id:userId}));setNewListing({title:'',system_name:'',schedule_text:'',platform:'Online',slots:4,description:''})},'Mesa publicada.')}}><label>Título<input required minLength={5} maxLength={100} value={newListing.title} onChange={e=>setNewListing(v=>({...v,title:e.target.value}))}/></label><label>Sistema<input required minLength={2} maxLength={80} value={newListing.system_name} onChange={e=>setNewListing(v=>({...v,system_name:e.target.value}))}/></label><label>Horários<input maxLength={160} value={newListing.schedule_text} onChange={e=>setNewListing(v=>({...v,schedule_text:e.target.value}))}/></label><label>Modalidade<select value={newListing.platform} onChange={e=>setNewListing(v=>({...v,platform:e.target.value}))}><option>Online</option><option>Presencial</option><option>Híbrido</option></select></label><label>Vagas<input type="number" min={1} max={20} value={newListing.slots} onChange={e=>setNewListing(v=>({...v,slots:Number(e.target.value)}))}/></label><label>Descrição<textarea maxLength={1400} value={newListing.description} onChange={e=>setNewListing(v=>({...v,description:e.target.value}))}/></label><button disabled={busy} type="submit">Publicar anúncio</button></form></details>
 <div className="hb-v245-listing-grid">{filteredListings.map(l=>{const apps=applications.filter(a=>a.listing_id===l.id);const accepted=apps.filter(a=>a.status==='accepted').length;const mine=apps.find(a=>a.user_id===userId);return <article className="hb-v245-panel" key={l.id}><div className="hb-v245-inline"><small>{l.system_name}</small><span className="hb-v245-pill">{l.status==='open'?'Vagas abertas':'Encerrada'}</span></div><h3>{l.title}</h3><p>{compact(l.description,550)}</p><small>◷ {l.schedule_text||'A combinar'} · {l.platform}</small><p><strong>{accepted}/{l.slots}</strong> vagas preenchidas</p>{l.master_id===userId?<><div className="hb-v245-inline"><button disabled={busy} onClick={()=>void perform(async()=>{checked(await supabase.from('hax_v245_table_listings').update({status:l.status==='open'?'closed':'open'}).eq('id',l.id))},'Anúncio atualizado.')}>{l.status==='open'?'Encerrar inscrições':'Reabrir inscrições'}</button><button disabled={busy} onClick={()=>{if(window.confirm('Excluir este anúncio e suas candidaturas?'))void perform(async()=>{checked(await supabase.from('hax_v245_table_listings').delete().eq('id',l.id))},'Anúncio excluído.')}}>Excluir</button></div>{apps.map(a=><div key={a.user_id} className="hb-v245-application"><button type="button" onClick={()=>onViewProfile?.(a.user_id)}>Ver candidato ↗</button><p>{a.message||'Sem apresentação'}</p><small>{a.status==='pending'?'Aguardando':a.status==='accepted'?'Aceito':'Recusado'}</small>{a.status==='pending'&&<div className="hb-v245-inline"><button disabled={busy||accepted>=l.slots} onClick={()=>void perform(async()=>{checked(await supabase.from('hax_v245_table_applications').update({status:'accepted'}).eq('listing_id',l.id).eq('user_id',a.user_id))},'Candidato aceito.')}>Aceitar</button><button disabled={busy} onClick={()=>void perform(async()=>{checked(await supabase.from('hax_v245_table_applications').update({status:'declined'}).eq('listing_id',l.id).eq('user_id',a.user_id))},'Candidatura recusada.')}>Recusar</button></div>}</div>)}</>:mine?<div className="hb-v245-inline"><span>Inscrição: {mine.status==='pending'?'pendente':mine.status==='accepted'?'aprovada':'recusada'}</span><button disabled={busy} onClick={()=>void perform(async()=>{checked(await supabase.from('hax_v245_table_applications').delete().eq('listing_id',l.id).eq('user_id',userId))},'Candidatura cancelada.')}>Retirar candidatura</button></div>:<button disabled={busy||l.status!=='open'||accepted>=l.slots} onClick={()=>{const message=window.prompt('Apresente-se brevemente ao mestre (opcional):') ;if(message!==null)void perform(async()=>{checked(await supabase.from('hax_v245_table_applications').insert({listing_id:l.id,user_id:userId,message:message.trim().slice(0,600)}))},'Candidatura enviada.')}}>Candidatar-se</button>}</article>})}</div>{!filteredListings.length&&<p className="hb-v245-panel">Nenhuma mesa encontrada com esses filtros.</p>}</>}
 {page==='trends'&&<section className="hb-v245-panel"><div className="hb-v245-section-heading"><small>✦ ASSUNTOS EM ALTA</small><h3>Tendências da comunidade</h3><p>Hashtags presentes em publicações públicas, sem incluir discussões privadas de grupos.</p></div><div className="hb-v245-inline"><label>Período <select value={trendDays} onChange={e=>setTrendDays(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label><button type="button" onClick={()=>void load()}>Atualizar</button></div><ol className="hb-v245-trends">{trends.map(([tag,count])=><li key={tag}><button type="button" onClick={()=>onNavigate?.('feed')}>{tag}</button><span>{count} {count===1?'publicação':'publicações'}</span></li>)}</ol>{!trends.length&&<p>Nenhuma tendência encontrada neste período.</p>}</section>}
 {page==='insights'&&<section className="hb-v245-panel"><div className="hb-v245-section-heading"><small>◈ SUA ATIVIDADE</small><h3>Estatísticas pessoais</h3><p>Indicadores das publicações comunitárias carregadas. Não rastreamos visitas individuais ao seu perfil.</p></div><div className="hb-v245-metrics"><div><strong>{postStats.length}</strong><span>Publicações analisadas</span></div><div><strong>{likes.length}</strong><span>Curtidas recebidas</span></div><div><strong>{comments.length}</strong><span>Comentários recebidos</span></div><div><strong>{summary?.followers??'—'}</strong><span>Seguidores atuais</span></div></div><div className="hb-v245-panel hb-v245-follower-trend"><h4>Movimentação de seguidores (últimos 30 dias)</h4><div className="hb-v245-metrics"><div><strong>+{followerEvents.filter(e=>e.delta>0).length}</strong><span>Novos seguidores</span></div><div><strong>{followerEvents.filter(e=>e.delta<0).length}</strong><span>Deixaram de seguir</span></div><div><strong>{followerEvents.reduce((v,e)=>v+e.delta,0)>0?'+':''}{followerEvents.reduce((v,e)=>v+e.delta,0)}</strong><span>Saldo de seguidores</span></div></div><p className="hb-v245-footnote">O histórico começa na instalação desta atualização; seguimentos anteriores não aparecem no gráfico.</p></div><h4>Publicações nos últimos seis meses</h4><div className="hb-v245-bars">{monthPosts.map(m=><div key={m.label}><div className="hb-v245-bar" style={{height:`${Math.max(4,100*m.count/maxPosts)}%`}} title={`${m.count} publicações`}/><strong>{m.count}</strong><small>{m.label}</small></div>)}</div><p className="hb-v245-footnote">Os totais consideram os registros consultados nesta sessão (até 250 publicações recentes). Dados do feed clássico e visitas anônimas não estão incluídos.</p></section>}
 {page==='characternews'&&<><section className="hb-v245-panel"><div className="hb-v245-section-heading"><small>⚔ DIÁRIO DOS PERSONAGENS</small><h3>Marcos da sua aventura</h3><p>Compartilhe acontecimentos e conquistas. Um marco só será visível a outros jogadores se você marcá-lo como público.</p></div><form className="hb-v245-form" onSubmit={e=>{e.preventDefault();void perform(async()=>{checked(await supabase.from('hax_v245_character_news').insert({...newNews,owner_id:userId}));setNewNews({character_id:'',title:'',description:'',public:false})},'Marco registrado.')}}><label>Personagem<select required value={newNews.character_id} onChange={e=>setNewNews(v=>({...v,character_id:e.target.value}))}><option value="">Selecione um personagem</option>{characters.map(c=><option key={c.id} value={c.id}>{c.emoji||'⚔'} {c.name}</option>)}</select></label><label>Título<input required minLength={4} maxLength={120} value={newNews.title} onChange={e=>setNewNews(v=>({...v,title:e.target.value}))}/></label><label>Descrição<textarea rows={3} maxLength={1500} value={newNews.description} onChange={e=>setNewNews(v=>({...v,description:e.target.value}))}/></label><label className="hb-v245-checkbox"><input type="checkbox" checked={newNews.public} onChange={e=>setNewNews(v=>({...v,public:e.target.checked}))}/> Tornar público (não compartilhe segredos da campanha)</label><button disabled={busy}>Registrar marco</button></form></section><section className="hb-v245-panel"><h3>Histórico dos personagens</h3>{news.map(n=><article key={n.id} className="hb-v245-timeline-item"><div><strong>{characters.find(c=>c.id===n.character_id)?.name||'Personagem'} · {n.title}</strong><small>{format(n.created_at)} · {n.public?'Público':'Privado'}</small></div><p>{n.description}</p><button type="button" disabled={busy} onClick={()=>{if(window.confirm('Excluir este marco?'))void perform(async()=>{checked(await supabase.from('hax_v245_character_news').delete().eq('id',n.id))},'Marco excluído.')}}>Excluir</button></article>)}{!news.length&&<p>Nenhum marco registrado.</p>}</section></>}
 {page==='security'&&<SecurityTab/>}
 </div>
}

export function SocialV245PublicCharacterNews({userId}:{userId:string}){
 const [items,setItems]=useState<CharacterNews[]>([])
 useEffect(()=>{let live=true;void supabase.from('hax_v245_character_news').select('*').eq('owner_id',userId).eq('public',true).order('created_at',{ascending:false}).limit(12).then(({data,error})=>{if(live&&!error)setItems((data||[]) as CharacterNews[])});return()=>{live=false}},[userId])
 if(!items.length)return null
 return <section className="hb-v245-panel"><div className="hb-v245-section-heading"><small>⚔ HISTÓRIAS DE PERSONAGENS</small><h3>Marcos compartilhados</h3><p>Acontecimentos que este jogador decidiu tornar públicos.</p></div>{items.map(item=><article className="hb-v245-timeline-item" key={item.id}><strong>{item.title}</strong><p>{item.description}</p><small>{format(item.created_at)}</small></article>)}</section>
}
