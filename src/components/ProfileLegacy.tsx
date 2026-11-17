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
  const [savedProfile,setSavedProfile]=useState<Showcase>(()=>defaultProfile(userId))
  const [activeTab,setActiveTab]=useState<'overview'|'appearance'|'heroes'|'badges'|'chronicles'|'community'|'privacy'>('overview')
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
      const normalized={...defaultProfile(userId),...data,privacy:{...defaultPrivacy,...data?.privacy},featured_ids:Array.isArray(data?.featured_ids)?data.featured_ids:[],featured_badges:Array.isArray(data?.featured_badges)?data.featured_badges:[],journal:Array.isArray(data?.journal)?data.journal:[]}
      setProfile(normalized)
      setSavedProfile(normalized)
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
  const hasChanges=JSON.stringify(profile)!==JSON.stringify(savedProfile)
  const featuredAwards=profile.featured_badges.map(id=>allBadges.find(badge=>badge.id===id)).filter((value):value is Award=>!!value)
  const publiclyVisible=Object.values(profile.privacy).filter(Boolean).length
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
    else {setProfile(payload);setSavedProfile(payload);imagesCallback.current?.(payload.avatar_image,payload.cover_image,payload.avatar_position,payload.cover_position);setNotice('Seu perfil foi atualizado.');}
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
  if(loading)return <section className="hpl-loading" role="status"><span className="hpl-loading-mark">✦</span><strong>Preparando sua história</strong><small>Carregando identidade do aventureiro…</small></section>
  return <section className="hpl-root hpl-v128" id="hb-profile-legacy-plus" style={{'--hpl-accent':profile.accent} as React.CSSProperties} aria-labelledby="hpl-title">
    <header className="hpl-intro">
      <div className="hpl-intro-copy">
        <span className="hpl-overline"><span aria-hidden="true">✦</span> O ATELIÊ DO AVENTUREIRO</span>
        <h2 id="hpl-title">Identidade <em>&amp; legado</em></h2>
        <p>Dê forma à sua história, escolha o que mostrar ao mundo e preserve os momentos que tornaram sua jornada única.</p>
      </div>
      <div className="hpl-intro-actions">
        <span className={`hpl-save-state ${hasChanges?'pending':'saved'}`} role="status">{hasChanges?'● Alterações não salvas':'✓ Personalização atualizada'}</span>
        {hasChanges&&<button type="button" className="hpl-reset" disabled={saving} onClick={()=>{setProfile(savedProfile);setNotice('Alterações não salvas descartadas.')}}>Desfazer mudanças</button>}
        <button type="button" className="hpl-primary" disabled={saving||!hasChanges} onClick={()=>void save()}>{saving?'Salvando…':'✦ Salvar perfil'}</button>
      </div>
    </header>

    {error&&<p className="hpl-feedback error" role="alert">{error}</p>}
    {notice&&<p className="hpl-feedback" role="status">{notice}</p>}

    <div className={`hpl-spotlight layout-${profile.layout}`}>
      <div className="hpl-spotlight-card">
        <div className="hpl-cover" style={profile.cover_image?{backgroundImage:`linear-gradient(180deg, transparent 40%, rgba(10,12,14,.66)),url(${profile.cover_image})`,backgroundPosition:`center, center ${profile.cover_position}%`,backgroundSize:'cover'}:{}}>
          <div className="hpl-cover-top"><span>✦ HÄXBAG</span><span>REGISTRO PESSOAL · I</span></div>
          <span className="hpl-cover-ornament" aria-hidden="true">✧</span>
          <span className="hpl-cover-bottom">O LIVRO DAS SUAS JORNADAS</span>
        </div>
        <div className="hpl-spotlight-identity">
          <div className={`hpl-avatar frame-${profile.frame}`} aria-label="Seu avatar de perfil">{profile.avatar_image?<img src={profile.avatar_image} alt="Avatar do aventureiro" style={{objectPosition:`center ${profile.avatar_position}%`}}/>:<span>{displayName.charAt(0).toUpperCase()}</span>}</div>
          <div className="hpl-spotlight-copy">
            <span className="hpl-spotlight-eyebrow">PERFIL DO AVENTUREIRO</span>
            <h3>{displayName}</h3>
            <span className="hpl-handle">@{username||'aventureiro'}</span>
            <span className={`hpl-status ${profile.status==='offline'?'is-offline':''}`}><i aria-hidden="true"/>{statusText(profile)||'Status personalizado'}</span>
          </div>
          <button className="hpl-spotlight-edit" type="button" onClick={()=>setActiveTab('appearance')} aria-label="Personalizar aparência do perfil">✎ <span>Personalizar</span></button>
        </div>
        <div className="hpl-spotlight-bottom">
          <div className="hpl-spotlight-stat"><strong>{characters.length}</strong><span>Personagens</span></div>
          <div className="hpl-spotlight-stat"><strong>{campaigns.length}</strong><span>Campanhas</span></div>
          <div className="hpl-spotlight-stat"><strong>{allBadges.length}</strong><span>Insígnias</span></div>
          <div className="hpl-spotlight-stat"><strong>{profile.journal.length}</strong><span>Crônicas</span></div>
        </div>
      </div>
      <aside className="hpl-spotlight-aside">
        <div className="hpl-aside-head"><span className="hpl-overline">✧ A SUA VITRINE</span><span className="hpl-aside-sigil" aria-hidden="true">✺</span></div>
        <h3>A sua marca no mundo</h3><p>Escolhas, histórias e conquistas que representam sua trajetória.</p>
        <div className="hpl-aside-sub"><strong>Protagonistas</strong><button type="button" onClick={()=>setActiveTab('heroes')}>Organizar ↗</button></div>
        <div className="hpl-mini-heroes">{featured.length?featured.map(hero=><div key={hero.id} title={`${hero.name} · ${hero.campaign}`}><span>{hero.emoji||'⚔️'}</span><strong>{hero.name}</strong></div>):<p>Escolha até três personagens para esta vitrine.</p>}</div>
        <div className="hpl-aside-sub"><strong>Insígnias favoritas</strong><button type="button" onClick={()=>setActiveTab('badges')}>Escolher ↗</button></div>
        <div className="hpl-mini-badges">{featuredAwards.length?featuredAwards.map(award=><span key={award.id} title={award.title} aria-label={award.title}>{award.symbol}</span>):<p>Destaque suas conquistas favoritas.</p>}</div>
        <div className="hpl-aside-foot"><span>PRIVACIDADE DA VITRINE</span><strong>{publiclyVisible} de 6 áreas visíveis</strong><button type="button" onClick={()=>setActiveTab('privacy')}>Gerenciar privacidade</button></div>
      </aside>
    </div>

    <nav className="hpl-tabs" aria-label="Áreas da identidade e legado" role="tablist">
      {([
        ['overview','◈','Visão geral'],
        ['appearance','✧','Aparência'],
        ['heroes','⚔','Protagonistas'],
        ['badges','✦','Insígnias'],
        ['chronicles','▤','Crônicas'],
        ['community','♧','Comunidade'],
        ['privacy','⌘','Privacidade'],
      ] as const).map(([id,symbol,label])=><button type="button" key={id} id={`hpl-tab-${id}`} role="tab" aria-selected={activeTab===id} aria-controls="hpl-tab-panel" className={activeTab===id?'active':''} onClick={()=>setActiveTab(id)}><span aria-hidden="true">{symbol}</span>{label}</button>)}
    </nav>

    <div className="hpl-tab-panel" id="hpl-tab-panel" role="tabpanel" aria-labelledby={`hpl-tab-${activeTab}`}>
    {activeTab==='overview'&&<div className="hpl-dashboard">
      <article className="hpl-panel hpl-welcome">
        <div className="hpl-panel-heading"><span className="hpl-overline">CAPÍTULO I · APRESENTAÇÃO</span><h3>A essência do aventureiro</h3><p>Um resumo das escolhas que contam a sua história.</p></div>
        <div className="hpl-feature-highlight"><span className="hpl-feature-sigil" aria-hidden="true">✦</span><div><small>STATUS ATUAL</small><strong>{statusText(profile)||'Adicione uma mensagem'}</strong><span>Seu sinal para outros aventureiros.</span></div></div>
        <div className="hpl-summary-list">
          <div><span>Identidade visual</span><strong>{profile.frame==='gold'?'Moldura dourada':profile.frame==='arcane'?'Moldura arcana':profile.frame==='shadow'?'Moldura sombria':'Moldura clássica'}</strong></div>
          <div><span>Disposição</span><strong>{profile.layout==='gallery'?'Galeria':profile.layout==='compact'?'Compacta':'Clássica'}</strong></div>
          <div><span>Informações públicas</span><strong>{publiclyVisible} de 6 áreas</strong></div>
        </div>
        <div className="hpl-overview-actions"><button type="button" className="hpl-primary" onClick={()=>setActiveTab('appearance')}>Ajustar minha identidade <span aria-hidden="true">↗</span></button><button type="button" onClick={()=>setActiveTab('privacy')}>Definir o que mostrar</button></div>
      </article>
      <article className="hpl-panel hpl-overview-chronicles"><div className="hpl-panel-heading"><span className="hpl-overline">CAPÍTULO II · MEMÓRIAS</span><h3>Últimas crônicas</h3><p>Momentos importantes, registros e conquistas.</p></div>
        {timeline.length?<ol className="hpl-timeline hpl-timeline-short">{timeline.slice(0,4).map(item=><li key={item.id}><span>{item.date?item.date.slice(0,10):'REGISTRO'}</span><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ol>:<div className="hpl-empty"><span aria-hidden="true">▤</span><strong>Uma nova história começa aqui.</strong><p>Suas crônicas e conquistas aparecerão neste espaço.</p></div>}
        <button type="button" className="hpl-text-action" onClick={()=>setActiveTab('chronicles')}>Ver todas as crônicas ↗</button>
      </article>
      <article className="hpl-panel hpl-overview-community"><div className="hpl-panel-heading"><span className="hpl-overline">CAPÍTULO III · COMPANHIA</span><h3>Histórias que se encontram</h3><p>Conheça outros aventureiros e fortaleça sua companhia.</p></div><div className="hpl-community-visual" aria-hidden="true"><span>✦</span><span>♧</span><span>✧</span></div><button type="button" className="hpl-text-action" onClick={()=>setActiveTab('community')}>Encontrar jogadores ↗</button></article>
    </div>}

    {activeTab==='appearance'&&<div className="hpl-section-layout">
      <div className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">01 · RETRATO</span><h3>Avatar &amp; capa</h3><p>Escolha imagens que representem sua identidade. A prévia acima muda em tempo real.</p></div>
        <div className="hpl-upload-grid"><label className="hpl-upload-card"><span className="hpl-upload-icon">◉</span><strong>Foto de perfil</strong><small>PNG, JPG ou WebP · até 6 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void imageChanged(e,'avatar_image')}/></label><label className="hpl-upload-card"><span className="hpl-upload-icon">▰</span><strong>Imagem de capa</strong><small>PNG, JPG ou WebP · até 6 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void imageChanged(e,'cover_image')}/></label></div>
        <div className="hpl-range-grid"><label>Enquadramento do avatar <span>{profile.avatar_position}%</span><input type="range" min={0} max={100} value={profile.avatar_position} onChange={e=>setProfile(p=>({...p,avatar_position:Number(e.target.value)}))}/></label><label>Posição da capa <span>{profile.cover_position}%</span><input type="range" min={0} max={100} value={profile.cover_position} onChange={e=>setProfile(p=>({...p,cover_position:Number(e.target.value)}))}/></label></div>
        <div className="hpl-inline"><button type="button" disabled={!profile.avatar_image} onClick={()=>setProfile(p=>({...p,avatar_image:''}))}>Remover avatar</button><button type="button" disabled={!profile.cover_image} onClick={()=>setProfile(p=>({...p,cover_image:''}))}>Remover capa</button></div>
      </div>
      <div className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">02 · ACABAMENTO</span><h3>A sua assinatura</h3><p>Personalize os detalhes sem alterar os estilos visuais das campanhas.</p></div>
        <div className="hpl-control-group"><strong>Moldura do avatar</strong><div className="hpl-choice-grid hpl-frame-grid">{([['classic','Clássica','◇'],['gold','Dourada','✦'],['arcane','Arcana','✧'],['shadow','Sombria','◈']] as const).map(([id,name,symbol])=><button key={id} type="button" className={`hpl-option ${profile.frame===id?'selected':''}`} aria-pressed={profile.frame===id} onClick={()=>setProfile(p=>({...p,frame:id}))}><span className={`hpl-option-art frame-${id}`}>{symbol}</span><strong>{name}</strong></button>)}</div></div>
        <div className="hpl-control-group"><strong>Cor de destaque</strong><div className="hpl-palette" role="group" aria-label="Cores de destaque">{['#d9bd8b','#97b59b','#b89bd3','#d89184','#82adcf','#e3b766'].map(color=><button key={color} type="button" aria-label={`Usar cor ${color}`} aria-pressed={profile.accent===color} className={profile.accent===color?'selected':''} style={{background:color}} onClick={()=>setProfile(p=>({...p,accent:color}))}/>)}<label className="hpl-custom-color">Cor livre<input aria-label="Escolher outra cor" type="color" value={profile.accent} onChange={e=>setProfile(p=>({...p,accent:e.target.value}))}/></label></div></div>
        <div className="hpl-control-group"><strong>Disposição da vitrine</strong><div className="hpl-choice-grid hpl-layout-grid">{([['classic','Clássica','▤'],['compact','Compacta','☷'],['gallery','Galeria','▦']] as const).map(([id,name,symbol])=><button key={id} type="button" className={`hpl-option ${profile.layout===id?'selected':''}`} aria-pressed={profile.layout===id} onClick={()=>setProfile(p=>({...p,layout:id}))}><span className="hpl-layout-icon">{symbol}</span><strong>{name}</strong></button>)}</div></div>
      </div>
    </div>}

    {activeTab==='heroes'&&<section className="hpl-panel"><div className="hpl-panel-heading hpl-heading-row"><div><span className="hpl-overline">OS ROSTOS DA SUA HISTÓRIA</span><h3>Protagonistas em destaque</h3><p>Escolha até três personagens para aparecerem na sua vitrine pública, conforme sua privacidade.</p></div><span className="hpl-count">{featured.length} / 3 selecionados</span></div>
      {characters.length?<div className="hpl-heroes">{characters.map(hero=>{const checked=profile.featured_ids.includes(hero.id);return <label key={hero.id} className={`hpl-hero ${checked?'selected':''}`}><input type="checkbox" checked={checked} disabled={!checked&&profile.featured_ids.length>=3} onChange={e=>setProfile(p=>({...p,featured_ids:e.target.checked?[...p.featured_ids,hero.id].slice(0,3):p.featured_ids.filter(id=>id!==hero.id)}))}/><span className="hpl-hero-avatar">{hero.emoji||'⚔️'}</span><div><strong>{hero.name}</strong><small>{hero.archetype||'Aventureiro'}</small><span>{hero.campaign}</span></div><span className="hpl-select-marker" aria-hidden="true">{checked?'✓':'+'}</span></label>})}</div>:<div className="hpl-empty"><span aria-hidden="true">⚔</span><strong>Os protagonistas ainda estão por vir.</strong><p>Quando seus personagens estiverem disponíveis, você poderá escolhê-los aqui.</p></div>}
    </section>}

    {activeTab==='badges'&&<section className="hpl-panel"><div className="hpl-panel-heading hpl-heading-row"><div><span className="hpl-overline">HONRAS &amp; DISTINÇÕES</span><h3>Insígnias e conquistas</h3><p>Conquistas automáticas e homenagens dos mestres. Escolha até quatro para destacar.</p></div><span className="hpl-count">{profile.featured_badges.length} / 4 em destaque</span></div>
      {allBadges.length?<div className="hpl-badges">{allBadges.map(award=>{const checked=profile.featured_badges.includes(award.id);return <label key={award.id} className={`hpl-badge ${checked?'selected':''}`}><input type="checkbox" checked={checked} disabled={!checked&&profile.featured_badges.length>=4} onChange={e=>setProfile(p=>({...p,featured_badges:e.target.checked?[...p.featured_badges,award.id].slice(0,4):p.featured_badges.filter(id=>id!==award.id)}))}/><span className="hpl-badge-art">{award.symbol}</span><div><strong>{award.title}</strong><small>{award.description}</small><span>{award.given_by?'Concedida pelo mestre':'Conquista de jornada'}</span></div><span className="hpl-select-marker" aria-hidden="true">{checked?'✓':'+'}</span></label>})}</div>:<div className="hpl-empty"><span aria-hidden="true">✦</span><strong>Seu legado ainda está sendo escrito.</strong><p>Suas conquistas aparecerão aqui conforme você avançar nas campanhas.</p></div>}
    </section>}

    {activeTab==='chronicles'&&<div className="hpl-section-layout hpl-chronicles-layout"><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">O LIVRO DA JORNADA</span><h3>Escrever uma crônica</h3><p>Guarde descobertas, vitórias e histórias que merecem ser lembradas.</p></div>
      <div className="hpl-chronicle-form"><label>Data do acontecimento<input type="date" value={newChronicle.date} onChange={e=>setNewChronicle(p=>({...p,date:e.target.value}))}/></label><label>Título<input value={newChronicle.title} maxLength={100} placeholder="Ex.: A noite da última batalha" onChange={e=>setNewChronicle(p=>({...p,title:e.target.value}))}/></label><label>O que aconteceu?<textarea rows={5} value={newChronicle.detail} maxLength={500} placeholder="Conte como esse capítulo aconteceu…" onChange={e=>setNewChronicle(p=>({...p,detail:e.target.value}))}/><small>{newChronicle.detail.length}/500 caracteres</small></label><button type="button" className="hpl-primary" onClick={addJournal} disabled={!newChronicle.title.trim()||profile.journal.length>=60}>＋ Adicionar ao meu livro</button><p className="hpl-hint">As crônicas adicionadas são salvas ao clicar em “Salvar perfil”. Limite de 60 anotações próprias.</p></div>
      </section><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">CRONOLOGIA</span><h3>Memórias registradas</h3><p>Seus registros e marcos automáticos, em ordem de data.</p></div><ol className="hpl-timeline">{timeline.map(item=><li key={item.id}><span>{item.date?item.date.slice(0,10):'MARCO DA JORNADA'}</span><strong>{item.title}</strong><p>{item.detail}</p>{item.kind==='note'&&<button type="button" onClick={()=>setProfile(p=>({...p,journal:p.journal.filter(j=>j.id!==item.id)}))}>Excluir anotação</button>}</li>)}{timeline.length===0&&<li><strong>O primeiro capítulo ainda não foi escrito.</strong><p>Adicione uma crônica para começar.</p></li>}</ol></section></div>}

    {activeTab==='community'&&<div className="hpl-community-layout"><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">COMPANHEIROS DE JORNADA</span><h3>Encontrar aventureiros</h3><p>Procure perfis públicos pelo nome de usuário, adicione amigos ou convide para campanhas.</p></div><label className="hpl-search">Buscar aventureiro<div className="hpl-search-field"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite pelo menos 2 caracteres…"/>{search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}>✕</button>}</div></label><div className="hpl-people">{people.map(p=><div key={p.id} className="hpl-person"><span className="hpl-person-avatar" aria-hidden="true">{p.display_name.charAt(0).toUpperCase()}</span><div><strong>{p.display_name}</strong><small>@{p.username}</small></div><button type="button" onClick={()=>void openPerson(p)}>Ver perfil</button><button type="button" onClick={()=>void requestFriend(p.id)} aria-label={`Enviar amizade a ${p.display_name}`}>＋ Amigo</button></div>)}{search.trim().length>=2&&people.length===0&&<div className="hpl-empty"><span aria-hidden="true">♧</span><strong>Nenhum aventureiro encontrado</strong><p>Tente buscar outro nome.</p></div>}{search.trim().length<2&&<div className="hpl-empty"><span aria-hidden="true">⌕</span><strong>Uma comunidade de histórias</strong><p>Pesquise um nome para visitar outro perfil.</p></div>}</div></section>
      <section className="hpl-panel hpl-visitor-container"><div className="hpl-panel-heading"><span className="hpl-overline">ENCONTRO DE CAMINHOS</span><h3>Perfil visitado</h3><p>Veja apenas as informações que o jogador escolheu compartilhar.</p></div>{visitorLoading&&<div className="hpl-empty">Carregando perfil…</div>}{visitor?<div className={`hpl-visitor layout-${visitor.layout}`} style={{'--hpl-visitor-accent':visitor.accent} as React.CSSProperties}><div className="hpl-visitor-cover" style={visitor.cover_image?{backgroundImage:`url(${visitor.cover_image})`,backgroundPosition:`center ${visitor.cover_position??50}%`}:{}}/><div className={`hpl-avatar frame-${visitor.frame}`}>{visitor.avatar_image?<img src={visitor.avatar_image} alt={`Avatar público de ${visitor.display_name}`} style={{objectPosition:`center ${visitor.avatar_position??50}%`}}/>:<span>{visitor.display_name?.charAt(0)||'✦'}</span>}</div><h3>{visitor.display_name}</h3><small>@{visitor.username}</small>{visitor.status&&<span className="hpl-status"><i aria-hidden="true"/>{visitor.status}</span>}{visitor.bio&&<p>{visitor.bio}</p>}<div className="hpl-stats">{visitor.character_count>=0&&<span>⚔ {visitor.character_count} personagens</span>}{visitor.campaign_count>=0&&<span>⚑ {visitor.campaign_count} campanhas</span>}</div>{(visitor.featured||[]).length>0&&<div className="hpl-heroes">{visitor.featured.map(hero=><div key={hero.id} className="hpl-hero"><span className="hpl-hero-avatar">{hero.emoji||'⚔️'}</span><div><strong>{hero.name}</strong><small>{hero.archetype||'Aventureiro'}</small></div></div>)}</div>}{(visitor.badges||[]).length>0&&<div className="hpl-badges">{visitor.badges.map(b=><div key={b.id} className="hpl-badge"><span className="hpl-badge-art">{b.symbol}</span><div><strong>{b.title}</strong><small>{b.description}</small></div></div>)}</div>}{(visitor.journal||[]).length>0&&<ol className="hpl-timeline">{visitor.journal.map(item=><li key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ol>}<div className="hpl-inline"><button type="button" className="hpl-primary" onClick={()=>void requestFriend(visitor.id)}>＋ Adicionar amigo</button>{campaigns.some(c=>c.master)&&<><select aria-label="Campanha para convidar" value={inviteCampaign} onChange={e=>setInviteCampaign(e.target.value)}><option value="">Escolher campanha</option>{campaigns.filter(c=>c.master).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" disabled={!inviteCampaign} onClick={()=>void invitePerson(visitor.id)}>Convidar</button></>}<button type="button" onClick={()=>setVisitor(null)}>Fechar perfil</button></div></div>:!visitorLoading&&<div className="hpl-empty"><span aria-hidden="true">◈</span><strong>Nenhum perfil selecionado</strong><p>Escolha um aventureiro na busca para consultar sua vitrine pública.</p></div>}</section>
      {campaigns.some(c=>c.master)&&<section className="hpl-panel hpl-community-award"><div className="hpl-panel-heading"><span className="hpl-overline">PRIVILÉGIO DO MESTRE</span><h3>Conceder insígnia especial</h3><p>Reconheça os feitos de um participante das suas campanhas.</p></div><div className="hpl-award-form"><label>Jogador<select value={grantUser} onChange={e=>setGrantUser(e.target.value)}><option value="">Selecione um jogador pesquisado</option>{people.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><label>Símbolo<input maxLength={10} value={grantSymbol} onChange={e=>setGrantSymbol(e.target.value)} aria-label="Símbolo da insígnia"/></label><label>Nome da insígnia<input value={grantTitle} maxLength={80} placeholder="Ex.: Guardião do Véu" onChange={e=>setGrantTitle(e.target.value)}/></label><label>Descrição<input value={grantDetail} maxLength={240} placeholder="Motivo da homenagem" onChange={e=>setGrantDetail(e.target.value)}/></label><button type="button" className="hpl-primary" disabled={!grantUser||!grantTitle.trim()} onClick={()=>void grantAward()}>✦ Conceder insígnia</button></div></section>}
    </div>}

    {activeTab==='privacy'&&<div className="hpl-section-layout"><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">AS PORTAS DA SUA HISTÓRIA</span><h3>Presença e status</h3><p>Deixe seus companheiros saberem se você está disponível para aventuras.</p></div><div className="hpl-fields"><label>Status<select value={profile.status} onChange={e=>setProfile(p=>({...p,status:e.target.value}))}>{statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{profile.status==='custom'&&<label>Mensagem de status<input maxLength={60} value={profile.status_custom} onChange={e=>setProfile(p=>({...p,status_custom:e.target.value}))} placeholder="Escreva sua mensagem…"/></label>}</div><div className="hpl-feature-highlight"><span className="hpl-feature-sigil">◉</span><div><small>PRÉVIA DO SEU STATUS</small><strong>{statusText(profile)||'Seu status personalizado'}</strong><span>O status só aparece para visitantes se você permitir.</span></div></div></section>
      <section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">CONTROLE DE VISIBILIDADE</span><h3>Quem pode ver o quê?</h3><p>Suas informações privadas e seus dados de conta não são exibidos na vitrine pública.</p></div><div className="hpl-privacy">{([['show_bio','Biografia','A sua apresentação pessoal'],['show_characters','Personagens','Protagonistas escolhidos'],['show_campaigns','Campanhas','Contagem de campanhas'],['show_badges','Insígnias','Conquistas em destaque'],['show_journal','Crônicas','Registros da sua jornada'],['show_status','Status','A sua disponibilidade']] as [PrivacyKey,string,string][]).map(([key,label,subtitle])=><label key={key} className="hpl-privacy-row"><span className="hpl-privacy-copy"><strong>{label}</strong><small>{subtitle}</small></span><input type="checkbox" checked={profile.privacy[key]} onChange={e=>setProfile(p=>({...p,privacy:{...p.privacy,[key]:e.target.checked}}))}/><span className="hpl-switch" aria-hidden="true"/></label>)}</div><div className="hpl-privacy-footer"><span aria-hidden="true">⌘</span><p>As permissões são aplicadas no Supabase; ocultar uma seção não é apenas um efeito visual.</p></div></section></div>}
    </div>
    {hasChanges&&<div className="hpl-bottom-save"><span><strong>Alterações não salvas</strong><small>Salve para aplicar a personalização na sua conta.</small></span><div><button type="button" onClick={()=>setProfile(savedProfile)} disabled={saving}>Descartar</button><button type="button" className="hpl-primary" disabled={saving} onClick={()=>void save()}>{saving?'Salvando…':'Salvar alterações'}</button></div></div>}
  </section>
}
