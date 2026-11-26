import { publicHaxbagLink, DESKTOP_PUBLIC_URL_HELP } from '../desktopPublicLinks'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../supabase'
import PublicAdventurerProfile, { type AdventurerRef } from './PublicAdventurerProfile'
import { profileFrameNames, profileThemePalette, type ProfileAppearance } from '../profileTheme'
import './ProfileLegacy.styles.css'
import './ProfileRedesignV233.css'

type PrivacyKey = 'show_bio'|'show_characters'|'show_campaigns'|'show_badges'|'show_journal'|'show_status'|'show_identity_card'
type Privacy = Record<PrivacyKey,boolean>
type Hero = {id:string;name:string;emoji:string;archetype:string;campaign:string}
type Chronicle = {id:string;date:string;title:string;detail:string;kind:string}
type Award = {id:string;title:string;description:string;symbol:string;created_at:string;given_by:string|null}
type AdminBadge = {code:string;title:string;description:string;symbol:string}
type Showcase = {
  user_id:string;avatar_image:string;cover_image:string;status:string;status_custom:string;avatar_position:number;cover_position:number;
  frame:string;accent:string;layout:string;privacy:Privacy;
  featured_ids:string[];featured_badges:string[];journal:Chronicle[];
}
type Person = AdventurerRef
const defaultPrivacy:Privacy = {show_bio:true,show_characters:true,show_campaigns:false,show_badges:true,show_journal:true,show_status:true,show_identity_card:true}
const defaultProfile = (id:string):Showcase => ({user_id:id,avatar_image:'',cover_image:'',status:'available',status_custom:'',avatar_position:50,cover_position:50,frame:'classic',accent:'#d9bd8b',layout:'classic',privacy:defaultPrivacy,featured_ids:[],featured_badges:[],journal:[]})
const officialBadgeCatalog = [
  {id:'fundador',title:'Fundador',description:'Participe da fundação do HäxBag',symbol:'✦',origin:'Concedida exclusivamente pelo administrador'},
  {id:'primordial',title:'Primordial',description:'Participe da beta do HäxBag',symbol:'◈',origin:'Concedida automaticamente durante a beta'},
  {id:'embaixador',title:'Embaixador',description:'Convide pessoas para o HäxBag',symbol:'✧',origin:'Recebida ao indicar a primeira pessoa'},
  {id:'cacador_de_bugs',title:'Caçador de Bugs',description:'Ajudou a identificar e relatar bugs do HäxBag',symbol:'⌁',origin:'Concedida pelo administrador do HäxBag'},
] as const
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

export default function ProfileLegacy({userId,displayName,username,characters,campaigns,onImagesLoaded,onAppearanceChange,appearanceRequest=0}: {
  userId:string;displayName:string;username:string;
  characters:Hero[];campaigns:{id:string;name:string;master:boolean}[];activeCampaignId:string|null;onImagesLoaded?:(avatar:string,cover:string,avatarPosition:number,coverPosition:number)=>void;onAppearanceChange?:(appearance:ProfileAppearance)=>void;appearanceRequest?:number
}) {
  const imagesCallback=useRef(onImagesLoaded)
  imagesCallback.current=onImagesLoaded
  const appearanceCallback=useRef(onAppearanceChange)
  appearanceCallback.current=onAppearanceChange
  const lastAppearanceRequest=useRef(0)
  const [profile,setProfile]=useState<Showcase>(()=>defaultProfile(userId))
  const [savedProfile,setSavedProfile]=useState<Showcase>(()=>defaultProfile(userId))
  const [activeTab,setActiveTab]=useState<'overview'|'appearance'|'heroes'|'badges'|'chronicles'|'community'|'privacy'>('overview')
  const [badgeFilter,setBadgeFilter]=useState<'all'|'earned'|'locked'>('all')
  const [awards,setAwards]=useState<Award[]>([])
  const [referralToken,setReferralToken]=useState('')
  const [referralCount,setReferralCount]=useState(0)
  const [referralBusy,setReferralBusy]=useState(false)
  const [inviteDialogOpen,setInviteDialogOpen]=useState(false)
  const [completedMissions,setCompletedMissions]=useState<Chronicle[]>([])
  const [completedSeasons,setCompletedSeasons]=useState<Chronicle[]>([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [search,setSearch]=useState('')
  const [people,setPeople]=useState<Person[]>([])
  const [visitorPerson,setVisitorPerson]=useState<Person|null>(null)
  const [newChronicle,setNewChronicle]=useState({title:'',detail:'',date:dateNow()})
  const [isSiteAdmin,setIsSiteAdmin]=useState(false)
  const [betaActive,setBetaActive]=useState(true)
  const [adminSearch,setAdminSearch]=useState('')
  const [adminMatches,setAdminMatches]=useState<Person[]>([])
  const [adminSearchBusy,setAdminSearchBusy]=useState(false)
  const [adminGrantBusy,setAdminGrantBusy]=useState<string|null>(null)
  const [adminNotice,setAdminNotice]=useState('')
  const [adminBadgeCatalog,setAdminBadgeCatalog]=useState<AdminBadge[]>([])
  const [adminBadgeCode,setAdminBadgeCode]=useState('fundador')
  const [adminBadgeLoading,setAdminBadgeLoading]=useState(false)
  const [adminBadgeError,setAdminBadgeError]=useState('')
  const refresh=useCallback(async()=>{
    const [r,a,settings]=await Promise.all([
      supabase.from('hax_profile_showcase').select('*').eq('user_id',userId).maybeSingle(),
      supabase.rpc('hax_badge_my_awards'),
      supabase.rpc('hax_badge_site_status'),
    ])
    if(r.error||a.error||settings.error){setError(`Não foi possível carregar a vitrine e as insígnias oficiais. Confira as migrações V127, V133 e V137. ${r.error?.message||a.error?.message||settings.error?.message}`)}
    else {
      const data=r.data as Partial<Showcase>|null
      const normalized={...defaultProfile(userId),...data,privacy:{...defaultPrivacy,...data?.privacy},featured_ids:Array.isArray(data?.featured_ids)?data.featured_ids:[],featured_badges:Array.isArray(data?.featured_badges)?data.featured_badges:[],journal:Array.isArray(data?.journal)?data.journal:[]}
      setProfile(normalized)
      setSavedProfile(normalized)
      imagesCallback.current?.(data?.avatar_image||'',data?.cover_image||'',data?.avatar_position??50,data?.cover_position??50)
      setAwards((a.data||[]) as Award[])
      const status=settings.data as {is_admin?:boolean;beta_active?:boolean}|null
      setIsSiteAdmin(status?.is_admin===true)
      setBetaActive(status?.beta_active===true)
      setError('')
    }
    setLoading(false)
  },[userId])
  useEffect(()=>{void refresh()},[refresh])
  // A prévia da paleta é compartilhada com App apenas nesta sessão de edição.
  // O banco só é alterado pelo botão Salvar perfil existente.
  useEffect(()=>{
    if(!loading)appearanceCallback.current?.({accent:profile.accent,frame:profile.frame as ProfileAppearance['frame'],layout:profile.layout as ProfileAppearance['layout']})
  },[loading,profile.accent,profile.frame,profile.layout])
  useEffect(()=>{
    if(appearanceRequest>0 && appearanceRequest!==lastAppearanceRequest.current){
      lastAppearanceRequest.current=appearanceRequest
      setActiveTab('appearance')
      window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>document.getElementById('hpl-tab-appearance')?.scrollIntoView({block:'nearest',behavior:'smooth'})))
    }
  },[appearanceRequest])
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
      const {data,error:failure}=await supabase.rpc('hax_social_search',{p_query:search.trim()})
      if(!cancelled){
        if(failure)setError(failure.message)
        else setPeople(((data||[]) as {person_id:string;display_name:string;username:string}[])
          .map(p=>({id:p.person_id,display_name:p.display_name,username:p.username})).filter(p=>p.id!==userId).slice(0,10))
      }
    },350)
    return()=>{cancelled=true;window.clearTimeout(handle)}
  },[search,userId])
  useEffect(()=>{
    let cancelled=false
    void supabase.rpc('hax_referral_my_stats').then(({data,error})=>{
      if(cancelled||error)return
      const info=data as {token?:string;count?:number}|null
      setReferralToken(info?.token||'')
      setReferralCount(Number(info?.count||0))
    })
    return()=>{cancelled=true}
  },[userId])
  const personalReferralUrl=referralToken ? publicHaxbagLink({ ref: referralToken }) : ''
  async function ensureReferralLink(){
    if(referralToken){if(!personalReferralUrl)setError(DESKTOP_PUBLIC_URL_HELP);return personalReferralUrl}
    setReferralBusy(true)
    const {data,error:failure}=await supabase.rpc('hax_referral_my_link')
    setReferralBusy(false)
    if(failure){setError(failure.message);return ''}
    const token=String(data||'')
    if(!token){setError('Não foi possível criar o link de convite.');return ''}
    setReferralToken(token)
    const link = publicHaxbagLink({ ref: token });if(!link)setError(DESKTOP_PUBLIC_URL_HELP);return link
  }
  async function copyReferralLink(){
    const url=await ensureReferralLink()
    if(!url)return
    try{await navigator.clipboard.writeText(url);setNotice('Link pessoal copiado!')}catch{setNotice('Copie o endereço: '+url)}
  }
  async function shareReferralLink(){
    const url=await ensureReferralLink()
    if(!url)return
    const message=`Venha conhecer o HäxBag e criar suas aventuras comigo! ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer')
  }
  // O banco é a única fonte de verdade para insígnias.
  const allBadges=awards
  const hasChanges=JSON.stringify(profile)!==JSON.stringify(savedProfile)
  const featuredAwards=allBadges
  const publiclyVisible=Object.values(profile.privacy).filter(Boolean).length
  const showcaseSteps = [
    {id:'avatar', label:'Escolher um retrato', done:!!profile.avatar_image, target:'appearance' as const},
    {id:'cover', label:'Personalizar a capa', done:!!profile.cover_image, target:'appearance' as const},
    {id:'heroes', label:'Destacar um personagem', done:profile.featured_ids.some(id=>characters.some(character=>character.id===id)), target:'heroes' as const},
    {id:'chronicles', label:'Registrar uma crônica', done:profile.journal.length>0, target:'chronicles' as const},
  ]
  const showcaseCompleted=showcaseSteps.filter(step=>step.done).length
  const showcasePercent=Math.round(showcaseCompleted/showcaseSteps.length*100)
  const featured=profile.featured_ids.map(id=>characters.find(character=>character.id===id)).filter((value):value is Hero=>!!value).slice(0,3)
  const timeline=useMemo(()=>{
    const entries:Chronicle[]=[...profile.journal,...completedMissions,...completedSeasons]
    campaigns.forEach(c=>entries.push({id:`campaign-${c.id}`,date:'',title:`${c.master?'Mestre em':'Participa de'} ${c.name}`,detail:'Marco de campanha',kind:'campaign'}))
    awards.forEach(b=>entries.push({id:`award-${b.id}`,date:b.created_at,title:`Insígnia recebida: ${b.title}`,detail:b.description,kind:'badge'}))
    return entries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60)
  },[profile.journal,campaigns,awards,completedMissions,completedSeasons])
  const statusText=(p:Showcase)=>p.status==='custom'?p.status_custom:statusOptions.find(o=>o[0]===p.status)?.[1]||'Disponível'
  async function save(next:Showcase=profile){
    setSaving(true);setError('');setNotice('')
    // Atualizar apenas os campos da vitrine. A Carta de Identidade é editada
    // independentemente no Ateliê e não pode ser sobrescrita por um rascunho
    // antigo desta tela ao salvar outros detalhes do perfil.
    const payload={
      user_id:next.user_id,avatar_image:next.avatar_image,cover_image:next.cover_image,
      status:next.status,status_custom:next.status_custom,
      avatar_position:next.avatar_position,cover_position:next.cover_position,
      frame:next.frame,accent:next.accent,layout:next.layout,privacy:next.privacy,
      featured_ids:next.featured_ids.slice(0,3),featured_badges:next.featured_badges.slice(0,4),
      journal:next.journal.slice(0,60),
    }
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
  function openPerson(person:Person){setVisitorPerson(person)}

  // O catálogo concedível é fornecido pelo banco e só pode ser consultado pelo admin.
  // Insígnias futuras entrarão aqui sem exigir alterações nessa interface.
  useEffect(()=>{
    if(!isSiteAdmin){setAdminBadgeCatalog([]);setAdminBadgeError('');return}
    let cancelled=false
    setAdminBadgeLoading(true)
    void supabase.rpc('hax_badge_admin_catalog').then(({data,error:failure})=>{
      if(cancelled)return
      setAdminBadgeLoading(false)
      if(failure){
        setAdminBadgeError(`Não foi possível carregar o catálogo de concessão. Aplique o SQL da V139. ${failure.message}`)
        setAdminBadgeCatalog([])
        return
      }
      const badges=((data||[]) as AdminBadge[]).filter(badge=>badge.code&&badge.title)
      setAdminBadgeCatalog(badges)
      setAdminBadgeError('')
      setAdminBadgeCode(current=>badges.some(badge=>badge.code===current)?current:(badges[0]?.code||''))
    })
    return()=>{cancelled=true}
  },[isSiteAdmin])
  const selectedAdminBadge=adminBadgeCatalog.find(badge=>badge.code===adminBadgeCode)
  const alreadyOwnsSelectedBadge=allBadges.some(badge=>badge.id===adminBadgeCode)
  // A pesquisa é exclusiva da administração; saber quem é mestre não dá direito a conceder insígnias.
  useEffect(()=>{
    if(!isSiteAdmin||adminSearch.trim().length<2){setAdminMatches([]);setAdminSearchBusy(false);return}
    let cancelled=false
    setAdminSearchBusy(true)
    const handle=window.setTimeout(async()=>{
      const {data,error:failure}=await supabase.rpc('hb_search_people',{p_query:adminSearch.trim()})
      if(!cancelled){
        setAdminMatches(failure?[]:((data||[]) as Person[]).slice(0,12))
        setAdminSearchBusy(false)
      }
    },350)
    return()=>{cancelled=true;window.clearTimeout(handle)}
  },[isSiteAdmin,adminSearch])
  async function grantOfficialBadge(person:Person){
    const selected=selectedAdminBadge
    if(!isSiteAdmin||adminGrantBusy||!selected)return
    setAdminGrantBusy(person.id);setAdminNotice('')
    const {data,error:failure}=await supabase.rpc('hax_badge_grant',{
      p_target:person.id,p_badge_code:selected.code,
    })
    setAdminGrantBusy(null)
    if(failure){setAdminNotice(`Não foi possível conceder ${selected.title}: ${failure.message}`);return}
    setAdminNotice(data===true?`Insígnia ${selected.title} concedida a ${person.display_name}.`:`${person.display_name} já possui a insígnia ${selected.title}.`)
    if(person.id===userId){
      const {data:myBadges,error:reloadError}=await supabase.rpc('hax_badge_my_awards')
      if(!reloadError)setAwards((myBadges||[]) as Award[])
    }
  }
  if(loading)return <section className="hpl-loading" role="status"><span className="hpl-loading-mark">✦</span><strong>Preparando sua história</strong><small>Carregando identidade do aventureiro…</small></section>
  return <section className="hpl-root hpl-v128 hpl-v233" id="hb-profile-legacy-plus" style={{'--hpl-accent':profileThemePalette({accent:profile.accent,frame:profile.frame as ProfileAppearance['frame'],layout:profile.layout as ProfileAppearance['layout']}).primary} as React.CSSProperties} aria-labelledby="hpl-title">
    <header className="hpl-intro">
      <div className="hpl-intro-copy">
        <span className="hpl-overline"><span aria-hidden="true">✦</span> O ATELIÊ DO AVENTUREIRO</span>
        <h2 id="hpl-title">Identidade <em>&amp; legado</em></h2>
        <p>Escolha a aparência de todo o seu Perfil, personalize sua vitrine e preserve os momentos que tornaram sua jornada única.</p>
      </div>
      <div className="hpl-intro-actions">
        <span className={`hpl-save-state ${hasChanges?'pending':'saved'}`} role="status">{hasChanges?'● Alterações não salvas':'✓ Personalização atualizada'}</span>
        {hasChanges&&<button type="button" className="hpl-reset" disabled={saving} onClick={()=>{setProfile(savedProfile);setNotice('Alterações não salvas descartadas.')}}>Desfazer mudanças</button>}
        <button type="button" className="hpl-v230-public-preview" title="Exibe a versão pública já salva" onClick={()=>setVisitorPerson({id:userId,display_name:displayName,username})}>◈ Ver meu perfil público</button>
        <button type="button" className="hpl-primary" disabled={saving||!hasChanges} onClick={()=>void save()}>{saving?'Salvando…':'✦ Salvar perfil'}</button>
      </div>
    </header>

    {error&&<p className="hpl-feedback error" role="alert">{error}</p>}
    {notice&&<p className="hpl-feedback" role="status">{notice}</p>}

    <div className={`hpl-spotlight layout-${profile.layout}`}>
      <div className="hpl-spotlight-card">
        <div className={`hpl-cover ${profile.cover_image ? 'has-personal-cover' : 'has-theme-cover'}`} style={profile.cover_image?{backgroundImage:`linear-gradient(180deg, transparent 40%, rgba(10,12,14,.66)),url(${profile.cover_image})`,backgroundPosition:`center, center ${profile.cover_position}%`,backgroundSize:'cover'}:{}}>
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
          <div className="hpl-v230-spotlight-actions"><button className="hpl-spotlight-edit" type="button" onClick={()=>setActiveTab('appearance')} aria-label="Personalizar aparência do perfil">✎ <span>Personalizar</span></button><button className="hpl-v230-spotlight-preview" type="button" title="Exibe a versão pública já salva" onClick={()=>setVisitorPerson({id:userId,display_name:displayName,username})}>◈ <span>Ver como visitante</span></button></div>
        </div>
        <div className="hpl-v233-spotlight-caption"><span aria-hidden="true">✧</span><span>Seu espaço, sua história. Esta é uma prévia das alterações locais; visite o perfil público para ver o conteúdo salvo.</span></div>
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
        <div className="hpl-mini-badges">{featuredAwards.length?featuredAwards.map(award=><span key={award.id} title={award.title} aria-label={award.title}>{award.symbol}</span>):<p>As insígnias oficiais aparecerão aqui quando forem concedidas.</p>}</div>
        <div className="hpl-aside-foot"><span>PRIVACIDADE DA VITRINE</span><strong>{publiclyVisible} de 7 áreas visíveis</strong><button type="button" onClick={()=>setActiveTab('privacy')}>Gerenciar privacidade</button></div>
        <div className="hpl-v230-progress-card">
          <div className="hpl-v230-progress-title"><strong>Prepare sua vitrine</strong><span>{showcasePercent}%</span></div>
          <div className="hpl-v230-progress-track" role="progressbar" aria-label="Preparação da vitrine" aria-valuemin={0} aria-valuemax={100} aria-valuenow={showcasePercent}><span style={{width:`${showcasePercent}%`}}/></div>
          <p>Personalize a forma como sua história aparece para outros jogadores.</p>
          <div className="hpl-v230-progress-steps">{showcaseSteps.map(step=><button type="button" key={step.id} onClick={()=>setActiveTab(step.target)}><span aria-hidden="true" className={step.done?'is-complete':''}>{step.done?'✓':'○'}</span><span>{step.label}</span><span aria-hidden="true">↗</span></button>)}</div>
          <small>A prévia pública exibe as informações já salvas na sua conta.</small>
        </div>
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
          <div><span>Informações públicas</span><strong>{publiclyVisible} de 7 áreas</strong></div>
        </div>
        <div className="hpl-overview-actions"><button type="button" className="hpl-v230-overview-preview" onClick={()=>setVisitorPerson({id:userId,display_name:displayName,username})}>◈ Prévia pública</button><button type="button" className="hpl-primary" onClick={()=>setInviteDialogOpen(true)}>✧ Convidar amigos · Embaixador</button><button type="button" className="hpl-primary" onClick={()=>setActiveTab('appearance')}>Ajustar minha identidade <span aria-hidden="true">↗</span></button><button type="button" onClick={()=>setActiveTab('privacy')}>Definir o que mostrar</button></div>
      </article>
      <article className="hpl-panel hpl-v136-theme-overview">
        <div className="hpl-panel-heading"><span className="hpl-overline">PALETA PESSOAL · SÓ NO PERFIL</span><h3>Seu mundo, suas cores</h3><p>Esta paleta acompanha todas as seções do seu Perfil, mas não altera os temas das campanhas.</p></div>
        <div className="hpl-v136-profile-swatches" aria-label="Prévia da paleta pessoal">
          <span style={{background:profile.accent}}/><span style={{background:profile.accent,opacity:.75}}/><span style={{background:profile.accent,opacity:.5}}/><span style={{background:profile.accent,opacity:.25}}/>
        </div>
        <div className="hpl-summary-list"><div><span>Tom escolhido</span><strong>{profile.accent.toUpperCase()}</strong></div><div><span>Acabamento</span><strong>{profileFrameNames[profile.frame as ProfileAppearance['frame']]||'Clássica'}</strong></div></div>
        <button type="button" className="hpl-v136-open-appearance" onClick={()=>setActiveTab('appearance')}>✧ Personalizar meu tema <span aria-hidden="true">↗</span></button>
      </article>
      <article className="hpl-panel hpl-overview-chronicles"><div className="hpl-panel-heading"><span className="hpl-overline">CAPÍTULO II · MEMÓRIAS</span><h3>Últimas crônicas</h3><p>Momentos importantes, registros e conquistas.</p></div>
        {timeline.length?<ol className="hpl-timeline hpl-timeline-short">{timeline.slice(0,4).map(item=><li key={item.id}><span>{item.date?item.date.slice(0,10):'REGISTRO'}</span><strong>{item.title}</strong><p>{item.detail}</p></li>)}</ol>:<div className="hpl-empty"><span aria-hidden="true">▤</span><strong>Uma nova história começa aqui.</strong><p>Suas crônicas e conquistas aparecerão neste espaço.</p></div>}
        <button type="button" className="hpl-text-action" onClick={()=>setActiveTab('chronicles')}>Ver todas as crônicas ↗</button>
      </article>
      <article className="hpl-panel hpl-overview-community"><div className="hpl-panel-heading"><span className="hpl-overline">CAPÍTULO III · COMPANHIA</span><h3>Histórias que se encontram</h3><p>Conheça outros aventureiros e fortaleça sua companhia.</p></div><div className="hpl-community-visual" aria-hidden="true"><span>✦</span><span>♧</span><span>✧</span></div><button type="button" className="hpl-text-action" onClick={()=>setActiveTab('community')}>Encontrar jogadores ↗</button></article>
    </div>}

    {activeTab==='appearance'&&<div className="hpl-v136-appearance-workspace">
      <div className="hpl-v136-theme-banner">
        <div className="hpl-v136-theme-copy"><span className="hpl-overline">PERSONALIZAÇÃO AO VIVO</span><h3>A aparência do seu Perfil</h3><p>Experimente uma cor: a barra lateral, os controles e todos os painéis do Perfil acompanham sua escolha imediatamente. Ao abrir outra página, o HäxBag retorna ao tema original da campanha.</p>
          <div className="hpl-v136-theme-status"><span className="hpl-v136-theme-indicator" style={{background:profile.accent}} aria-hidden="true"/> <strong>{profile.accent.toUpperCase()}</strong><span>· {profileFrameNames[profile.frame as ProfileAppearance['frame']]}</span>{hasChanges&&<em>Prévia não salva</em>}</div>
        </div>
        <div className="hpl-v136-theme-demo" aria-label="Exemplo de aparência" style={{'--hpl-demo-accent':profile.accent} as React.CSSProperties}>
          <div className="hpl-v136-demo-sidebar"><span>✧</span><i/><i/><i/></div><div className="hpl-v136-demo-main"><span>PERFIL DO AVENTUREIRO</span><strong>Seu espaço pessoal</strong><div><i/><i/></div><b>Visual ativo</b></div>
        </div>
      </div>
      <div className="hpl-section-layout">
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
      </div>
      <div className="hpl-v136-theme-footnote"><span aria-hidden="true">⌘</span><p>A cor é pessoal e não modifica as temporadas. Clique em <strong>Salvar perfil</strong> para manter sua escolha na próxima visita.</p><button type="button" onClick={()=>setProfile(p=>({...p,accent:'#d9bd8b',frame:'classic',layout:'classic'}))}>Restaurar visual clássico</button></div>
    </div>}

    {activeTab==='heroes'&&<section className="hpl-panel"><div className="hpl-panel-heading hpl-heading-row"><div><span className="hpl-overline">OS ROSTOS DA SUA HISTÓRIA</span><h3>Protagonistas em destaque</h3><p>Escolha até três personagens para aparecerem na sua vitrine pública, conforme sua privacidade.</p></div><span className="hpl-count">{featured.length} / 3 selecionados</span></div>
      {characters.length?<div className="hpl-heroes">{characters.map(hero=>{const checked=profile.featured_ids.includes(hero.id);return <label key={hero.id} className={`hpl-hero ${checked?'selected':''}`}><input type="checkbox" checked={checked} disabled={!checked&&profile.featured_ids.length>=3} onChange={e=>setProfile(p=>({...p,featured_ids:e.target.checked?[...p.featured_ids,hero.id].slice(0,3):p.featured_ids.filter(id=>id!==hero.id)}))}/><span className="hpl-hero-avatar">{hero.emoji||'⚔️'}</span><div><strong>{hero.name}</strong><small>{hero.archetype||'Aventureiro'}</small><span>{hero.campaign}</span></div><span className="hpl-select-marker" aria-hidden="true">{checked?'✓':'+'}</span></label>})}</div>:<div className="hpl-empty"><span aria-hidden="true">⚔</span><strong>Os protagonistas ainda estão por vir.</strong><p>Quando seus personagens estiverem disponíveis, você poderá escolhê-los aqui.</p></div>}
    </section>}

    {activeTab==='badges'&&<div className="hpl-badge-section">
      <section className="hpl-panel">
        <div className="hpl-panel-heading hpl-heading-row"><div><span className="hpl-overline">HONRAS OFICIAIS DO HÄXBAG</span><h3>Insígnias e reconhecimento</h3><p>Somente insígnias registradas pelo site são exibidas no seu perfil. O catálogo inclui reconhecimentos permanentes e progressivos.</p></div><span className="hpl-count">{allBadges.length} recebidas</span></div>
        <div className="hpl-v137-badge-banner"><span>✦</span><div><strong>Reconhecimento verdadeiro</strong><p>Insígnias não são escolhidas nem criadas pelos jogadores ou mestres. A Primordial é automática durante a beta; a Fundador é exclusiva da administração.</p></div><span className={`hpl-v137-beta-status ${betaActive?'is-open':''}`}>{betaActive?'◉ Beta ativa':'◈ Beta encerrada'}</span></div>
        <div className="hb-v245-badge-filters" role="group" aria-label="Filtrar insígnias"><button type="button" aria-pressed={badgeFilter==='all'} onClick={()=>setBadgeFilter('all')}>Todas</button><button type="button" aria-pressed={badgeFilter==='earned'} onClick={()=>setBadgeFilter('earned')}>Conquistadas</button><button type="button" aria-pressed={badgeFilter==='locked'} onClick={()=>setBadgeFilter('locked')}>A conquistar</button></div>
        <div className="hpl-badges hpl-v137-badge-grid">{officialBadgeCatalog.filter(badge=>badgeFilter==='all'||(badgeFilter==='earned'?allBadges.some(a=>a.id===badge.id):!allBadges.some(a=>a.id===badge.id))).map(badge=>{
          const owned=allBadges.find(item=>item.id===badge.id)
          return <article key={badge.id} className={`hpl-badge hpl-v137-official-badge badge-${badge.id} ${owned?'selected is-earned':'is-locked'}`}>
            <span className="hpl-badge-art" aria-hidden="true">{badge.symbol}</span>
            <div><strong>{badge.title}{badge.id==='embaixador'&&owned?` · Nível ${referralCount}`:''}</strong><small>{owned?.description||badge.description}</small><span>{owned?`✓ Recebida${owned.created_at?' em '+new Date(owned.created_at).toLocaleDateString('pt-BR'):''}`:badge.origin}</span></div>
            <span className="hpl-v137-badge-seal" aria-label={owned?'Insígnia concedida':'Ainda não recebida'}>{owned?'✓':'◇'}</span>
          </article>
        })}</div>
        <div className="hpl-referral-card hpl-referral-v167"><div className="hpl-referral-symbol" aria-hidden="true">✧</div><div><span className="hpl-overline">SEU PROGRAMA DE INDICAÇÕES</span><h3>Embaixador {referralCount>0?`· Nível ${referralCount}`:''}</h3><p>{referralCount>0?`Chamou ${referralCount} ${referralCount===1?'pessoa':'pessoas'} para o HäxBag`:'Convide alguém novo para conquistar sua insígnia Embaixador.'}</p><small>Convites pessoais e de campanha válidos contam para o mesmo nível. Cadastros repetidos da mesma conexão não aumentam o contador.</small></div><div className="hpl-referral-actions"><button type="button" className="hpl-primary" onClick={()=>setInviteDialogOpen(true)}>✧ Chamar amigos</button></div></div>
        <p className="hpl-v137-badge-help">As insígnias recebidas aparecem automaticamente na vitrine e no perfil público, caso a opção “Insígnias” esteja visível nas suas configurações de privacidade.</p>
      </section>
      {isSiteAdmin&&<section className="hpl-panel hpl-v137-admin-panel">
        <div className="hpl-panel-heading"><span className="hpl-overline">ADMINISTRAÇÃO DO SITE · ACESSO RESTRITO</span><h3>Conceder insígnias oficiais</h3><p>Escolha uma insígnia do catálogo oficial e conceda-a a qualquer conta, inclusive a sua. A Primordial continua automática durante a beta, mas você também pode atribuí-la manualmente.</p></div>
        <div className="hpl-v139-badge-selector">
          <label htmlFor="hpl-v139-badge-choice"><strong>Insígnia a conceder</strong><small>Somente as insígnias oficiais do HäxBag estão disponíveis.</small></label>
          <select id="hpl-v139-badge-choice" value={adminBadgeCode} disabled={adminBadgeLoading||!!adminGrantBusy||!adminBadgeCatalog.length} onChange={event=>{setAdminBadgeCode(event.target.value);setAdminNotice('')}}>
            {adminBadgeCatalog.length===0&&<option value="">{adminBadgeLoading?'Carregando catálogo…':'Catálogo indisponível'}</option>}
            {adminBadgeCatalog.map(badge=><option key={badge.code} value={badge.code}>{badge.symbol} {badge.title}</option>)}
          </select>
          {selectedAdminBadge&&<div className="hpl-v139-selected-badge"><span aria-hidden="true">{selectedAdminBadge.symbol}</span><div><strong>{selectedAdminBadge.title}</strong><small>{selectedAdminBadge.description}</small></div></div>}
          {adminBadgeError&&<p className="hpl-feedback error" role="alert">{adminBadgeError}</p>}
        </div>
        <div className="hpl-v138-self-award" aria-label="Conceder insígnia à sua própria conta">
          <span className="hpl-v138-self-award-icon" aria-hidden="true">{selectedAdminBadge?.symbol||'✦'}</span>
          <div className="hpl-v138-self-award-info"><span className="hpl-overline">SUA CONTA · ADMINISTRADOR DO SITE</span><strong>{displayName}</strong><small>@{username||'aventureiro'} · {selectedAdminBadge?.title||'Selecione uma insígnia'}</small></div>
          <button type="button" className="hpl-primary" disabled={!!adminGrantBusy||!selectedAdminBadge||alreadyOwnsSelectedBadge} onClick={()=>void grantOfficialBadge({id:userId,display_name:displayName,username})}>
            {adminGrantBusy===userId?'Concedendo…':alreadyOwnsSelectedBadge?`✓ Você já possui ${selectedAdminBadge?.title||'esta insígnia'}`:`✦ Conceder ${selectedAdminBadge?.title||'insígnia'} a mim`}
          </button>
        </div>
        <label className="hpl-search">Encontrar conta<div className="hpl-search-field"><span aria-hidden="true">⌕</span><input type="search" value={adminSearch} onChange={event=>{setAdminSearch(event.target.value);setAdminNotice('')}} placeholder="Nome de usuário ou nome de exibição…"/></div></label>
        {adminNotice&&<p className="hpl-v137-admin-notice" role="status">{adminNotice}</p>}
        {adminSearchBusy&&<p className="hpl-v137-admin-hint" role="status">Procurando contas…</p>}
        <div className="hpl-v137-admin-people">{adminMatches.map(person=><div key={person.id} className="hpl-v137-admin-person"><button type="button" className="hpl-person-visit" onClick={()=>openPerson(person)}><span className="hpl-person-avatar" aria-hidden="true">{person.display_name.slice(0,1).toUpperCase()}</span><span><strong>{person.display_name}</strong><small>@{person.username||'aventureiro'}</small></span></button><button className="hpl-primary" type="button" disabled={!!adminGrantBusy||!selectedAdminBadge||(person.id===userId&&alreadyOwnsSelectedBadge)} onClick={()=>void grantOfficialBadge(person)}>{adminGrantBusy===person.id?'Concedendo…':`✦ Conceder ${selectedAdminBadge?.title||'insígnia'}`}</button></div>)}</div>
        {!adminMatches.length&&adminSearch.trim().length<2&&<p className="hpl-v137-admin-hint">Digite pelo menos dois caracteres para encontrar uma conta. Você pode conceder qualquer insígnia do catálogo a qualquer jogador.</p>}
        {!adminSearchBusy&&!adminMatches.length&&adminSearch.trim().length>=2&&<p className="hpl-v137-admin-hint">Nenhuma conta encontrada.</p>}
      </section>}
    </div>}

    {activeTab==='chronicles'&&<div className="hpl-section-layout hpl-chronicles-layout"><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">O LIVRO DA JORNADA</span><h3>Escrever uma crônica</h3><p>Guarde descobertas, vitórias e histórias que merecem ser lembradas.</p></div>
      <div className="hpl-chronicle-form"><label>Data do acontecimento<input type="date" value={newChronicle.date} onChange={e=>setNewChronicle(p=>({...p,date:e.target.value}))}/></label><label>Título<input value={newChronicle.title} maxLength={100} placeholder="Ex.: A noite da última batalha" onChange={e=>setNewChronicle(p=>({...p,title:e.target.value}))}/></label><label>O que aconteceu?<textarea rows={5} value={newChronicle.detail} maxLength={500} placeholder="Conte como esse capítulo aconteceu…" onChange={e=>setNewChronicle(p=>({...p,detail:e.target.value}))}/><small>{newChronicle.detail.length}/500 caracteres</small></label><button type="button" className="hpl-primary" onClick={addJournal} disabled={!newChronicle.title.trim()||profile.journal.length>=60}>＋ Adicionar ao meu livro</button><p className="hpl-hint">As crônicas adicionadas são salvas ao clicar em “Salvar perfil”. Limite de 60 anotações próprias.</p></div>
      </section><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">CRONOLOGIA</span><h3>Memórias registradas</h3><p>Seus registros e marcos automáticos, em ordem de data.</p></div><ol className="hpl-timeline">{timeline.map(item=><li key={item.id}><span>{item.date?item.date.slice(0,10):'MARCO DA JORNADA'}</span><strong>{item.title}</strong><p>{item.detail}</p>{item.kind==='note'&&<button type="button" onClick={()=>setProfile(p=>({...p,journal:p.journal.filter(j=>j.id!==item.id)}))}>Excluir anotação</button>}</li>)}{timeline.length===0&&<li><strong>O primeiro capítulo ainda não foi escrito.</strong><p>Adicione uma crônica para começar.</p></li>}</ol></section></div>}

    {activeTab==='community'&&<div className="hpl-community-layout"><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">COMPANHEIROS DE JORNADA</span><h3>Encontrar aventureiros</h3><p>Visite perfis públicos, siga aventureiros e transforme o seguimento mútuo em amizade.</p></div><label className="hpl-search">Buscar aventureiro<div className="hpl-search-field"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite pelo menos 2 caracteres…"/>{search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}>✕</button>}</div></label><div className="hpl-people">{people.map(p=><div key={p.id} className="hpl-person"><button type="button" className="hpl-person-visit" onClick={()=>openPerson(p)} aria-label={`Visitar perfil de ${p.display_name}`}><span className="hpl-person-avatar" aria-hidden="true">{p.display_name.charAt(0).toUpperCase()}</span><span><strong>{p.display_name}</strong><small>@{p.username}</small></span></button><button type="button" onClick={()=>openPerson(p)}>Ver perfil</button><button type="button" onClick={()=>openPerson(p)} aria-label={`Seguir ${p.display_name} no perfil público`}>↗ Seguir no perfil</button></div>)}{search.trim().length>=2&&people.length===0&&<div className="hpl-empty"><span aria-hidden="true">♧</span><strong>Nenhum aventureiro encontrado</strong><p>Tente buscar outro nome.</p></div>}{search.trim().length<2&&<div className="hpl-empty"><span aria-hidden="true">⌕</span><strong>Uma comunidade de histórias</strong><p>Pesquise um nome para visitar outro perfil.</p></div>}</div></section>
      <section className="hpl-panel hpl-visitor-container hpl-visitor-invite-v132">
        <span className="hpl-overline">UM ENCONTRO DE HISTÓRIAS</span>
        <div className="hpl-visitor-invite-art" aria-hidden="true">❖</div>
        <h3>Conheça a história de outro aventureiro</h3>
        <p>Clique em <strong>Ver perfil</strong> ao lado de qualquer jogador. Você verá sua capa, seus protagonistas, suas conquistas e as crônicas que ele escolheu compartilhar.</p>
        <div className="hpl-visitor-invite-steps"><span>✧ Perfil público protegido</span><span>♧ Pedidos de amizade</span><span>⚑ Convites de campanha</span></div>
        <small>A busca e a lista de amigos abrem a mesma visualização, sem expor informações privadas.</small>
      </section>

    </div>}

    {activeTab==='privacy'&&<div className="hpl-section-layout"><section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">AS PORTAS DA SUA HISTÓRIA</span><h3>Presença e status</h3><p>Deixe seus companheiros saberem se você está disponível para aventuras.</p></div><div className="hpl-fields"><label>Status<select value={profile.status} onChange={e=>setProfile(p=>({...p,status:e.target.value}))}>{statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{profile.status==='custom'&&<label>Mensagem de status<input maxLength={60} value={profile.status_custom} onChange={e=>setProfile(p=>({...p,status_custom:e.target.value}))} placeholder="Escreva sua mensagem…"/></label>}</div><div className="hpl-feature-highlight"><span className="hpl-feature-sigil">◉</span><div><small>PRÉVIA DO SEU STATUS</small><strong>{statusText(profile)||'Seu status personalizado'}</strong><span>O status só aparece para visitantes se você permitir.</span></div></div></section>
      <section className="hpl-panel"><div className="hpl-panel-heading"><span className="hpl-overline">CONTROLE DE VISIBILIDADE</span><h3>Quem pode ver o quê?</h3><p>Suas informações privadas e seus dados de conta não são exibidos na vitrine pública.</p></div><div className="hpl-privacy">{([['show_bio','Biografia','A sua apresentação pessoal'],['show_characters','Personagens','Protagonistas escolhidos'],['show_campaigns','Campanhas','Contagem de campanhas'],['show_badges','Insígnias','Conquistas em destaque'],['show_journal','Crônicas','Registros da sua jornada'],['show_status','Status','A sua disponibilidade'],['show_identity_card','Carta de Identidade','Exibir sua carta personalizada no perfil público']] as [PrivacyKey,string,string][]).map(([key,label,subtitle])=><label key={key} className="hpl-privacy-row"><span className="hpl-privacy-copy"><strong>{label}</strong><small>{subtitle}</small></span><input type="checkbox" checked={profile.privacy[key]} onChange={e=>setProfile(p=>({...p,privacy:{...p.privacy,[key]:e.target.checked}}))}/><span className="hpl-switch" aria-hidden="true"/></label>)}</div><div className="hpl-privacy-footer"><span aria-hidden="true">⌘</span><p>As permissões são aplicadas no Supabase; ocultar uma seção não é apenas um efeito visual.</p></div><div className="hpl-v132-privacy-preview"><div><strong>Conferir minha vitrine pública</strong><small>Veja como as pessoas enxergam seu perfil. Salve as alterações de privacidade antes de abrir a prévia.</small></div><button type="button" onClick={()=>setVisitorPerson({id:userId,display_name:displayName,username})}>◈ Ver como visitante</button></div></section></div>}
    </div>
    {hasChanges&&<div className="hpl-bottom-save"><span><strong>Alterações não salvas</strong><small>Salve para aplicar a personalização na sua conta.</small></span><div><button type="button" onClick={()=>setProfile(savedProfile)} disabled={saving}>Descartar</button><button type="button" className="hpl-primary" disabled={saving} onClick={()=>void save()}>{saving?'Salvando…':'Salvar alterações'}</button></div></div>}
    {inviteDialogOpen&&<div className="hpl-invite-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setInviteDialogOpen(false)}}>
      <section className="hpl-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="hpl-invite-title">
        <button className="hpl-invite-close" type="button" aria-label="Fechar" onClick={()=>setInviteDialogOpen(false)}>✕</button>
        <div className="hpl-invite-emblem" aria-hidden="true">✧</div>
        <span className="hpl-overline">PROGRAMA EMBAIXADOR</span>
        <h2 id="hpl-invite-title">Chame seus amigos</h2>
        <p className="hpl-invite-subtitle">Compartilhe o HäxBag. Cada pessoa nova que criar uma conta por um dos seus convites e confirmar o cadastro aumenta seu nível em 1.</p>
        <div className="hpl-invite-steps"><span>⌁ Envie um link</span><b>→</b><span>♧ Nova conta</span><b>→</b><span>✓ Confirmação</span><b>→</b><span>✧ +1 nível</span></div>
        <div className="hpl-invite-inner">
          <button type="button" className="hpl-invite-whatsapp" disabled={referralBusy} onClick={()=>void shareReferralLink()}>◉ Compartilhar no WhatsApp</button>
          <div className="hpl-invite-copyrow"><input readOnly aria-label="Seu link pessoal de convite" value={personalReferralUrl||'Gere seu link pessoal para começar'} onFocus={event=>event.target.select()}/><button type="button" disabled={referralBusy} onClick={()=>void copyReferralLink()}>{referralBusy?'Aguarde…':'Copiar'}</button></div>
          <div className="hpl-invite-progress-header"><span>Você já trouxe <strong>{referralCount} {referralCount===1?'pessoa':'pessoas'}</strong></span><strong>{referralCount>0?`Nível ${referralCount}`:'Ainda não conquistada'}</strong></div>
          <div className="hpl-invite-progress" role="progressbar" aria-label="Progresso de indicações no grupo atual de cinco" aria-valuemin={0} aria-valuemax={5} aria-valuenow={referralCount%5}><div style={{width:`${(referralCount%5)*20}%`}}/></div>
          <p className="hpl-invite-next">{5-(referralCount%5)} {5-(referralCount%5)===1?'indicação':'indicações'} até completar mais um grupo de 5 níveis.</p>
          <div className="hpl-invite-campaign"><strong>⚑ Convites de campanha também valem</strong><p>Se uma pessoa nova criar a conta usando o link de uma campanha que você gerou, ela conta para a mesma insígnia. Você não precisa enviar o link pessoal junto.</p></div>
        </div>
        <small className="hpl-invite-footer">Uma conta nova vale apenas uma vez. Cliques, entradas de usuários antigos e indicações não confirmadas não geram nível.</small>
      </section>
    </div>}
    {visitorPerson && <PublicAdventurerProfile person={visitorPerson} isSelf={visitorPerson.id===userId} onClose={()=>setVisitorPerson(null)} campaigns={visitorPerson.id===userId?[]:campaigns.filter(c=>c.master).map(c=>({id:c.id,name:c.name}))}/>}
  </section>
}
