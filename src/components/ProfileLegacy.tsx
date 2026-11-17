import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../supabase'
import './ProfileLegacy.css'

type PrivacyKey = 'show_bio'|'show_characters'|'show_campaigns'|'show_badges'|'show_journal'|'show_status'
type Privacy = Record<PrivacyKey,boolean>
type Hero = {id:string;name:string;emoji:string;archetype:string;campaign:string}
type Chronicle = {id:string;date:string;title:string;detail:string;kind:string}
type Award = {id:string;title:string;description:string;symbol:string;created_at:string;given_by:string|null}
type Showcase = {
  user_id:string;avatar_image:string;cover_image:string;status:string;status_custom:string;avatar_position:number;cover_position:number;
  frame:string;accent:string;layout:string;privacy:Privacy;
  featured_ids:string[];featured_badges:string[];journal:Chronicle[];
}
type PublicProfile = {id:string;display_name:string;username:string;bio:string;avatar_image:string;cover_image:string;status:string;avatar_position:number;cover_position:number;frame:string;accent:string;layout:string;featured:Hero[];badges:Award[];journal:Chronicle[];campaign_count:number;character_count:number;privacy:Privacy}
type Person = {id:string;display_name:string;username:string}
const defaultPrivacy:Privacy = {show_bio:true,show_characters:true,show_campaigns:false,show_badges:true,show_journal:true,show_status:true}
const defaultProfile = (id:string):Showcase => ({user_id:id,avatar_image:'',cover_image:'',status:'available',status_custom:'',avatar_position:50,cover_position:50,frame:'classic',accent:'#d9bd8b',layout:'classic',privacy:defaultPrivacy,featured_ids:[],featured_badges:[],journal:[]})
const statusOptions=[['available','Disponível para jogar'],['preparing','Preparando campanha'],['looking','Procurando grupo'],['busy','Em aventura'],['offline','Indisponível'],['custom','Personalizado']]
const clampImage=(file:File,kind:'avatar'|'cover'):Promise<string>=>new Promise((resolve,reject)=>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){reject(new Error('Use PNG, JPG ou WebP.'));return}
  if(file.size>6_000_000){reject(new Error('A imagem deve ter até 6 MB.'));return}
  const img=new Image();const url=URL.createObjectURL(file)
  img.onload=()=>{try{
    const maxW=kind==='avatar'?480:1400;const maxH=kind==='avatar'?480:560
    const scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight)
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale))
    c.getContext('2d')?.drawImage(img,0,0,c.width,c.height)
    URL.revokeObjectURL(url);const data=c.toDataURL('image/webp',0.76)
    if(data.length>1_300_000){reject(new Error('Imagem muito grande após compressão.'));return}
    resolve(data)
  }catch(err){URL.revokeObjectURL(url);reject(err)}}
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Não foi possível ler a imagem.'))};img.src=url
})
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
const dateNow=()=>new Date().toISOString().slice(0,10)

export default function ProfileLegacy({userId,displayName,username,characters,campaigns,activeCampaignId,onImagesLoaded}: {
  userId:string;displayName:string;username:string;
  characters:Hero[];campaigns:{id:string;name:string;master:boolean}[];activeCampaignId:string|null;onImagesLoaded?:(avatar:string,cover:string,avatarPosition:number,coverPosition:number)=>void
}) {
  const imagesCallback=useRef(onImagesLoaded)
  imagesCallback.current=onImagesLoaded
  const [profile,setProfile]=useState<Showcase>(()=>defaultProfile(userId))
  const [awards,setAwards]=useState<Award[]>([])
  const [completedMissions,setCompletedMissions]=useState<Chronicle[]>([])
  const [completedSeasons,setCompletedSeasons]=useState<Chronicle[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [search,setSearch]=useState('')
  const [people,setPeople]=useState<Person[]>([])
  const [visitor,setVisitor]=useState<PublicProfile|null>(null)
  const [visitorLoading,setVisitorLoading]=useState(false)
  const [newChronicle,setNewChronicle]=useState({title:'',detail:'',date:dateNow()})
  const [grantUser,setGrantUser]=useState('')
  const [grantTitle,setGrantTitle]=useState('')
  const [grantDetail,setGrantDetail]=useState('')
  const [grantSymbol,setGrantSymbol]=useState('🏅')
  const [inviteCampaign,setInviteCampaign]=useState('')
  const refresh=useCallback(async()=>{
    const [r,a]=await Promise.all([
      supabase.from('hax_profile_showcase').select('*').eq('user_id',userId).maybeSingle(),
      supabase.from('hax_profile_awards').select('id,title,description,symbol,created_at,given_by').eq('recipient_id',userId).order('created_at',{ascending:false}),
    ])
    if(r.error||a.error){setError(`Não foi possível carregar a vitrine. Execute o SQL da V127. ${r.error?.message||a.error?.message}`)}
    else {
      const data=r.data as Partial<Showcase>|null
      setProfile({...defaultProfile(userId),...data,privacy:{...defaultPrivacy,...data?.privacy},featured_ids:Array.isArray(data?.featured_ids)?data.featured_ids:[],featured_badges:Array.isArray(data?.featured_badges)?data.featured_badges:[],journal:Array.isArray(data?.journal)?data.journal:[]})
      imagesCallback.current?.(data?.avatar_image||'',data?.cover_image||'',data?.avatar_position??50,data?.cover_position??50)
      setAwards((a.data||[]) as Award[]);setError('')
    }
    setLoading(false)
  },[userId])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{
    if(!campaigns.length)return
    let canceled=false
    const ids=campaigns.map(c=>c.id)
    const heroIds=new Set(characters.map(c=>c.id))
    void Promise.all([
      supabase.from('campaign_missions').select('id,title,recipient_character_ids,completed_at').eq('status','completed').in('campaign_id',ids).limit(500),
      supabase.from('campaign_seasons').select('id,name,campaign_id').eq('status','completed').in('campaign_id',ids).limit(200),
    ]).then(([m,season])=>{
      if(canceled)return
      if(!m.error)setCompletedMissions((m.data||[]).filter(row=>Array.isArray(row.recipient_character_ids)&&row.recipient_character_ids.some((id:string)=>heroIds.has(id))).map(row=>({id:`mission-${row.id}`,date:row.completed_at||'',title:`Missão concluída: ${row.title}`,detail:'Missão registrada na campanha',kind:'mission'})))
      if(!season.error)setCompletedSeasons((season.data||[]).filter(row=>campaigns.some(c=>c.id===row.campaign_id && c.master)).map(row=>({id:`season-${row.id}`,date:'',title:`Temporada narrada: ${row.name}`,detail:'Temporada concluída como mestre',kind:'season'})))
    })
    return()=>{canceled=true}
  },[campaigns.map(c=>c.id).join('|'),campaigns.map(c=>String(c.master)).join('|'),characters.map(c=>c.id).join('|')])
  useEffect(()=>{
    if(search.trim().length<2){setPeople([]);return}
    let cancelled=false
    const handle=window.setTimeout(async()=>{
      const {data}=await supabase.rpc('hb_search_people',{p_query:search.trim()})
      if(!cancelled) setPeople(((data||[]) as Person[]).filter(p=>p.id!==userId).slice(0,10))
    },350)
    return()=>{cancelled=true;window.clearTimeout(handle)}
  },[search,userId])
  const earned=useMemo<Award[]>(()=>{
    const result:Award[]=[]
    function add(condition:boolean,id:string,title:string,description:string,symbol:string){if(condition)result.push({id,title,description,symbol,created_at:'',given_by:null})}
    add(characters.length>0,'first_character','Primeiro personagem','Criou seu primeiro herói.','⚔️')
    add(characters.length>=3,'character_trio','Elenco de aventureiros','Possui três ou mais personagens.','🧙')
    add(campaigns.length>0,'first_campaign','Primeira campanha','Entrou no mundo das campanhas.','⚑')
    add(campaigns.length>=4,'many_campaigns','Viajante de mundos','Participa de quatro ou mais campanhas.','🗺️')
    add(campaigns.some(c=>c.master),'narrator','Mestre de campanha','Narra pelo menos uma campanha.','♜')
    add(completedMissions.length>0,'first_mission','Missão cumprida','Concluiu pelo menos uma missão.','📜')
    add(completedSeasons.length>0,'completed_season','Cronista de mundos','Encerrou uma temporada como mestre.','🏰')
    return result
  },[characters,campaigns,completedMissions.length,completedSeasons.length])
  const allBadges=[...earned,...awards]
  const featured=profile.featured_ids.map(id=>characters.find(character=>character.id===id)).filter((value):value is Hero=>!!value).slice(0,3)
  const timeline=useMemo(()=>{
    const entries:Chronicle[]=[...profile.journal,...completedMissions,...completedSeasons]
    campaigns.forEach(c=>entries.push({id:`campaign-${c.id}`,date:'',title:`${c.master?'Mestre em':'Participa de'} ${c.name}`,detail:'Marco de campanha',kind:'campaign'}))
    earned.forEach(b=>entries.push({id:`badge-${b.id}`,date:'',title:`Conquista: ${b.title}`,detail:b.description,kind:'badge'}))
    awards.forEach(b=>entries.push({id:`award-${b.id}`,date:b.created_at,title:`Insígnia recebida: ${b.title}`,detail:b.description,kind:'badge'}))
    return entries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60)
  },[profile.journal,campaigns,earned,awards,completedMissions,completedSeasons])
  const statusText=(p:Showcase)=>p.status==='custom'?p.status_custom:statusOptions.find(o=>o[0]===p.status)?.[1]||'Disponível'
  async function save(next:Showcase=profile){
    setSaving(true);setError('');setNotice('')
    const payload={...next,featured_ids:next.featured_ids.slice(0,3),featured_badges:next.featured_badges.slice(0,4),journal:next.journal.slice(0,60)}
    const {error:failure}=await supabase.from('hax_profile_showcase').upsert(payload,{onConflict:'user_id'})
    setSaving(false)
    if(failure)setError(failure.message)
    else {setProfile(payload);imagesCallback.current?.(payload.avatar_image,payload.cover_image,payload.avatar_position,payload.cover_position);setNotice('Vitrine salva.');}
  }
  async function imageChanged(event:ChangeEvent<HTMLInputElement>,field:'avatar_image'|'cover_image'){
    const file=event.target.files?.[0];event.target.value='';if(!file)return
    try{const content=await clampImage(file,field==='avatar_image'?'avatar':'cover');setProfile(prev=>({...prev,[field]:content}));setError('')}
    catch(e){setError(e instanceof Error?e.message:String(e))}
  }
  function addJournal(){
    if(!newChronicle.title.trim())return
    setProfile(p=>({...p,journal:[{id:uid(),date:newChronicle.date,title:newChronicle.title.trim().slice(0,100),detail:newChronicle.detail.trim().slice(0,500),kind:'note'},...p.journal].slice(0,60)}))
    setNewChronicle({title:'',detail:'',date:dateNow()})
  }
  async function openPerson(person:Person){
    setVisitorLoading(true);setVisitor(null);setError('')
    const {data,error:failure}=await supabase.rpc('hax_profile_public_view',{p_user_id:person.id})
    setVisitorLoading(false)
    if(failure)setError(failure.message)
    else setVisitor(data as PublicProfile)
  }
  async function requestFriend(id:string){const {error:failure}=await supabase.rpc('hb_send_friend_request',{p_target:id});if(failure)setError(failure.message);else setNotice('Solicitação de amizade enviada.')}
  async function invitePerson(id:string){
    const campaign=inviteCampaign||activeCampaignId
    if(!campaign||!campaigns.some(c=>c.id===campaign&&c.master))return
    const {error:failure}=await supabase.rpc('hb_invite_friend_to_campaign',{p_friend:id,p_campaign:campaign})
    if(failure)setError(failure.message);else setNotice('Convite enviado para a campanha.')
  }
  async function grantAward(){
    if(!grantUser||!grantTitle.trim())return
    const {error:failure}=await supabase.rpc('hax_profile_grant_award',{p_target:grantUser,p_title:grantTitle.trim().slice(0,80),p_description:grantDetail.trim().slice(0,240),p_symbol:grantSymbol.slice(0,10)})
    if(failure)setError(failure.message)
    else{setNotice('Insígnia concedida.');setGrantTitle('');setGrantDetail('')}
  }
  if(loading)return <section className="hpl-panel">Carregando identidade de aventureiro…</section>
  return <section className="hpl-root" id="hb-profile-legacy-plus">
    <header className="hpl-heading"><div><span>✦ SUA HISTÓRIA CONTINUA</span><h2>Identidade e legado</h2><p>Crie uma vitrine, escolha o que compartilhar e descubra outras histórias.</p></div><button type="button" onClick={()=>void save()} disabled={saving}>{saving?'Salvando…':'Salvar personalização'}</button></header>
    {error&&<p className="hpl-feedback error" role="alert">{error}</p>}{notice&&<p className="hpl-feedback" role="status">{notice}</p>}
    <div className="hpl-grid">
      <div className="hpl-panel"><h3>✧ Aparência personalizada</h3><div className="hpl-appearance" style={{'--hpl-accent':profile.accent} as React.CSSProperties}>
        <div className="hpl-cover" style={profile.cover_image?{backgroundImage:`url(${profile.cover_image})`,backgroundPosition:`center ${profile.cover_position}%`,backgroundSize:'cover'}:{}}/>
        <div className={`hpl-avatar frame-${profile.frame}`}>{profile.avatar_image?<img src={profile.avatar_image} alt="Seu avatar personalizado" style={{objectPosition:`center ${profile.avatar_position}%`}}/>:<span>{displayName.charAt(0).toUpperCase()}</span>}</div><div className="hpl-preview-name"><strong>{displayName}</strong><small>@{username||'aventureiro'}</small><span>{statusText(profile)}</span></div>
      </div><div className="hpl-fields"><label>Avatar PNG/JPG/WebP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void imageChanged(e,'avatar_image')}/></label><label>Capa PNG/JPG/WebP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void imageChanged(e,'cover_image')}/></label></div><div className="hpl-fields"><label>Ajustar posição do avatar<input type="range" min={0} max={100} value={profile.avatar_position} onChange={e=>setProfile(p=>({...p,avatar_position:Number(e.target.value)}))}/></label><label>Ajustar posição da capa<input type="range" min={0} max={100} value={profile.cover_position} onChange={e=>setProfile(p=>({...p,cover_position:Number(e.target.value)}))}/></label></div><div className="hpl-inline"><button type="button" onClick={()=>setProfile(p=>({...p,avatar_image:''}))}>Remover avatar</button><button type="button" onClick={()=>setProfile(p=>({...p,cover_image:''}))}>Remover capa</button></div>
      <div className="hpl-fields"><label>Moldura<select value={profile.frame} onChange={e=>setProfile(p=>({...p,frame:e.target.value}))}><option value="classic">Clássica</option><option value="gold">Dourada</option><option value="arcane">Arcana</option><option value="shadow">Sombria</option></select></label><label>Cor de destaque<input type="color" value={profile.accent} onChange={e=>setProfile(p=>({...p,accent:e.target.value}))}/></label><label>Disposição<select value={profile.layout} onChange={e=>setProfile(p=>({...p,layout:e.target.value}))}><option value="classic">Clássica</option><option value="compact">Compacta</option><option value="gallery">Galeria</option></select></label></div></div>
      <div className="hpl-panel"><h3>☼ Presença</h3><div className="hpl-fields"><label>Status<select value={profile.status} onChange={e=>setProfile(p=>({...p,status:e.target.value}))}>{statusOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>{profile.status==='custom'&&<label>Mensagem personalizada<input maxLength={60} value={profile.status_custom} onChange={e=>setProfile(p=>({...p,status_custom:e.target.value}))}/></label>}</div><h3>🔒 Privacidade</h3><div className="hpl-privacy">{([['show_bio','Biografia'],['show_characters','Personagens'],['show_campaigns','Quantidade de campanhas'],['show_badges','Conquistas e insígnias'],['show_journal','Crônicas'],['show_status','Status']] as [PrivacyKey,string][]).map(([key,label])=><label key={key}><input type="checkbox" checked={profile.privacy[key]} onChange={e=>setProfile(p=>({...p,privacy:{...p.privacy,[key]:e.target.checked}}))}/>{label}</label>)}</div><p className="hpl-hint">A vitrine pública só apresenta os campos permitidos. Seus dados de conta continuam privados.</p></div>
      <div className="hpl-panel hpl-span"><h3>⚔️ Protagonistas em destaque <small>{featured.length}/3</small></h3><div className="hpl-heroes">{characters.map(hero=><label key={hero.id} className="hpl-hero"><input type="checkbox" checked={profile.featured_ids.includes(hero.id)} disabled={!profile.featured_ids.includes(hero.id)&&profile.featured_ids.length>=3} onChange={e=>setProfile(p=>({...p,featured_ids:e.target.checked?[...p.featured_ids,hero.id].slice(0,3):p.featured_ids.filter(id=>id!==hero.id)}))}/><span>{hero.emoji||'⚔️'}</span><strong>{hero.name}</strong><small>{hero.archetype||'Aventureiro'} · {hero.campaign}</small></label>)}{characters.length===0&&<p>Nenhum personagem disponível para destacar.</p>}</div></div>
      <div className="hpl-panel hpl-span"><h3>🏅 Conquistas e insígnias</h3><div className="hpl-badges">{allBadges.map(award=><label key={award.id} className="hpl-badge"><input type="checkbox" checked={profile.featured_badges.includes(award.id)} disabled={!profile.featured_badges.includes(award.id)&&profile.featured_badges.length>=4} onChange={e=>setProfile(p=>({...p,featured_badges:e.target.checked?[...p.featured_badges,award.id].slice(0,4):p.featured_badges.filter(id=>id!==award.id)}))}/><span>{award.symbol}</span><strong>{award.title}</strong><small>{award.description}</small></label>)}{allBadges.length===0&&<p>Suas conquistas aparecerão conforme você avança nas campanhas.</p>}</div><p className="hpl-hint">Selecione até quatro insígnias para a vitrine. As conquistas automáticas refletem seu progresso atual.</p></div>
      <div className="hpl-panel hpl-span"><h3>📜 Crônicas do aventureiro</h3><div className="hpl-chronicle-form"><input type="date" value={newChronicle.date} onChange={e=>setNewChronicle(p=>({...p,date:e.target.value}))}/><input value={newChronicle.title} maxLength={100} placeholder="Título do acontecimento" onChange={e=>setNewChronicle(p=>({...p,title:e.target.value}))}/><input value={newChronicle.detail} maxLength={500} placeholder="Conte o que aconteceu…" onChange={e=>setNewChronicle(p=>({...p,detail:e.target.value}))}/><button type="button" onClick={addJournal} disabled={!newChronicle.title.trim()}>Adicionar</button></div><ol className="hpl-timeline">{timeline.map(item=><li key={item.id}><span>{item.date||'Registro'}</span><strong>{item.title}</strong><p>{item.detail}</p>{item.kind==='note'&&<button type="button" onClick={()=>setProfile(p=>({...p,journal:p.journal.filter(j=>j.id!==item.id)}))}>Excluir</button>}</li>)}{timeline.length===0&&<li>Suas histórias aparecerão aqui.</li>}</ol><p className="hpl-hint">As anotações são salvas ao clicar em “Salvar personalização”. Marcos de personagens, campanhas e conquistas são exibidos a partir dos seus registros existentes.</p></div>
      <div className="hpl-panel hpl-span"><h3>♧ Encontrar e visitar aventureiros</h3><label className="hpl-search">Pesquisar @usuário<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busque por nome de usuário…"/></label><div className="hpl-people">{people.map(p=><div key={p.id}><strong>{p.display_name}</strong><small>@{p.username}</small><button type="button" onClick={()=>void openPerson(p)}>Visitar perfil</button><button type="button" onClick={()=>void requestFriend(p.id)}>Adicionar amigo</button></div>)}{search.trim().length>=2&&people.length===0&&<p>Nenhum aventureiro encontrado.</p>}</div>{visitorLoading&&<p>Carregando perfil…</p>}{visitor&&<div className={`hpl-visitor layout-${visitor.layout}`} style={{'--hpl-accent':visitor.accent} as React.CSSProperties}><div className="hpl-visitor-cover" style={visitor.cover_image?{backgroundImage:`url(${visitor.cover_image})`,backgroundPosition:`center ${visitor.cover_position??50}%`}:{}}/><div className={`hpl-avatar frame-${visitor.frame}`}>{visitor.avatar_image?<img src={visitor.avatar_image} alt="Avatar público" style={{objectPosition:`center ${visitor.avatar_position??50}%`}}/>:<span>{visitor.display_name?.charAt(0)||'✦'}</span>}</div><h3>{visitor.display_name}</h3><small>@{visitor.username}</small>{visitor.status&&<p>{visitor.status}</p>}{visitor.bio&&<p>{visitor.bio}</p>}<div className="hpl-stats">{visitor.character_count>=0&&<span>⚔️ {visitor.character_count} personagens</span>}{visitor.campaign_count>=0&&<span>⚑ {visitor.campaign_count} campanhas</span>}</div><div className="hpl-heroes">{(visitor.featured||[]).map(hero=><div key={hero.id} className="hpl-hero"><span>{hero.emoji||'⚔️'}</span><strong>{hero.name}</strong><small>{hero.archetype||'Aventureiro'}</small></div>)}</div><div className="hpl-badges">{(visitor.badges||[]).map(b=><div key={b.id} className="hpl-badge"><span>{b.symbol}</span><strong>{b.title}</strong></div>)}</div><ol className="hpl-timeline">{(visitor.journal||[]).map(item=><li key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ol><div className="hpl-inline"><button type="button" onClick={()=>void requestFriend(visitor.id)}>Adicionar amigo</button>{campaigns.some(c=>c.master)&&<><select aria-label="Campanha para convidar" value={inviteCampaign} onChange={e=>setInviteCampaign(e.target.value)}><option value="">Escolha uma campanha</option>{campaigns.filter(c=>c.master).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" disabled={!inviteCampaign} onClick={()=>void invitePerson(visitor.id)}>Convidar</button></>}<button type="button" onClick={()=>setVisitor(null)}>Fechar perfil</button></div></div>}</div>
      {campaigns.some(c=>c.master)&&<div className="hpl-panel hpl-span"><h3>♜ Conceder insígnia especial</h3><p>Apenas mestres podem conceder uma insígnia a participantes de suas campanhas.</p><div className="hpl-chronicle-form"><select value={grantUser} onChange={e=>setGrantUser(e.target.value)}><option value="">Selecione um jogador pesquisado</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select><input maxLength={10} value={grantSymbol} onChange={e=>setGrantSymbol(e.target.value)} aria-label="Símbolo"/><input value={grantTitle} maxLength={80} placeholder="Nome da insígnia" onChange={e=>setGrantTitle(e.target.value)}/><input value={grantDetail} maxLength={240} placeholder="Descrição" onChange={e=>setGrantDetail(e.target.value)}/><button type="button" disabled={!grantUser||!grantTitle.trim()} onClick={()=>void grantAward()}>Conceder</button></div></div>}
    </div>
  </section>
}
