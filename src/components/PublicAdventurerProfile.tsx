import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import './PublicAdventurerProfile.css'
import './PublicProfileV151.css'
import ProfilePostsV164 from './ProfilePostsV164'

export type AdventurerRef = {
  id: string
  display_name: string
  username?: string
  status?: string
}
type CampaignChoice = { id: string; name: string }
type Hero = { id: string; name: string; emoji?: string; archetype?: string; campaign?: string }
type Badge = { id: string; title: string; description?: string; symbol?: string }
type Chronicle = { id: string; date?: string; title: string; detail?: string; kind?: string }
type Privacy = { show_bio?: boolean; show_characters?: boolean; show_campaigns?: boolean; show_badges?: boolean; show_journal?: boolean; show_status?: boolean; show_identity_card?: boolean }
type PublicProfile = {
  id: string
  display_name: string
  username: string
  bio?: string
  avatar_image?: string
  cover_image?: string
  status?: string
  avatar_position?: number
  cover_position?: number
  identity_card_visible?: boolean
  identity_card_image?: string
  identity_card_cover_theme?: string
  identity_card_position?: number
  identity_card_portrait?: 'photo' | 'symbol'
  identity_card_symbol?: string
  frame?: string
  accent?: string
  layout?: string
  featured?: Hero[]
  badges?: Badge[]
  journal?: Chronicle[]
  campaign_count?: number
  character_count?: number
  privacy?: Privacy
}
type Tab = 'presentation' | 'posts' | 'identity' | 'characters' | 'badges' | 'chronicles'

type Props = {
  person: AdventurerRef
  onClose: () => void
  campaigns?: CampaignChoice[]
  onFriendUpdate?: () => void
  onMessage?: (person: AdventurerRef) => void
  isSelf?: boolean
}

type SocialRelationship = { following:boolean; follows_me:boolean; friends:boolean; blocked_by_me:boolean; blocked_me:boolean }
const noRelationship:SocialRelationship = { following:false,follows_me:false,friends:false,blocked_by_me:false,blocked_me:false }

const safeAccent = (value: string | undefined) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#d9bd8b'

export default function PublicAdventurerProfile({ person, onClose, campaigns = [], onFriendUpdate, onMessage, isSelf = false }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [relationship, setRelationship] = useState<SocialRelationship>(noRelationship)
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [tab, setTab] = useState<Tab>('presentation')
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setProfile(null)
    setError('')
    setNotice('')
    setTab('presentation')
    setSelectedCampaign('')
    setRelationship(noRelationship)
    void (async () => {
      const [profileResponse, relationshipResponse] = await Promise.all([
        supabase.rpc('hax_social_public_profile', { p_user_id: person.id }),
        isSelf ? Promise.resolve({data:noRelationship,error:null}) : supabase.rpc('hax_social_relationship',{p_person:person.id}),
      ])
      if (cancelled) return
      if (relationshipResponse.data) setRelationship(relationshipResponse.data as SocialRelationship)
      if (profileResponse.error) setError(`Não foi possível abrir o perfil: ${profileResponse.error.message}`)
      else if (!profileResponse.data || typeof profileResponse.data !== 'object' || Array.isArray(profileResponse.data))
        setError('Este perfil não está disponível por causa de um bloqueio ou de suas configurações.')
      else setProfile(profileResponse.data as PublicProfile)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [person.id, isSelf])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    function handleKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])'))
        .filter(element => element.getClientRects().length > 0)
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    window.addEventListener('keydown', handleKeys)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeys)
      previousFocus?.focus()
    }
  }, [])

  async function toggleFollow() {
    if (actionBusy || isSelf || relationship.blocked_by_me || relationship.blocked_me) return
    setActionBusy(true); setError(''); setNotice('')
    const { data, error: failure } = await supabase.rpc('hax_social_follow', {p_target:person.id,p_follow:!relationship.following})
    setActionBusy(false)
    if (failure) setError(failure.message)
    else {setRelationship((data||noRelationship) as SocialRelationship);setNotice(relationship.following?'Você deixou de seguir este perfil.':'Agora você segue este aventureiro.');onFriendUpdate?.()}
  }
  async function toggleBlock() {
    if (actionBusy || isSelf) return
    if (!relationship.blocked_by_me && !window.confirm(`Bloquear ${person.display_name}? Isso interrompe o seguimento mútuo, as mensagens e a exibição de publicações.`)) return
    setActionBusy(true); setError(''); setNotice('')
    const { data, error: failure } = await supabase.rpc('hax_social_block', {p_target:person.id,p_block:!relationship.blocked_by_me})
    setActionBusy(false)
    if(failure) setError(failure.message)
    else {
      const state=(data||noRelationship) as SocialRelationship
      setRelationship(state)
      if(state.blocked_by_me) {setProfile(null);setNotice('Conta bloqueada.')} else {
        setNotice('Conta desbloqueada.')
        const response=await supabase.rpc('hax_social_public_profile',{p_user_id:person.id})
        if(response.data)setProfile(response.data as PublicProfile)
      }
      onFriendUpdate?.()
    }
  }
  async function inviteToCampaign() {
    if (!selectedCampaign || actionBusy || !campaigns.some(campaign => campaign.id === selectedCampaign)) return
    setActionBusy(true)
    setError('')
    const { error: failure } = await supabase.rpc('hb_invite_friend_to_campaign', { p_friend: person.id, p_campaign: selectedCampaign })
    setActionBusy(false)
    if (failure) setError(failure.message)
    else setNotice('Convite enviado para a campanha.')
  }

  const view = profile
  const privacy = view?.privacy || {}
  const heroes = view?.featured || []
  const badges = view?.badges || []
  const chronicles = [...(view?.journal || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const allow = (key: keyof Privacy) => privacy[key] !== false
  const tabs: { id: Tab; label: string; symbol: string; count?: number }[] = [
    { id: 'presentation', label: 'Sobre', symbol: '✦' },
    { id: 'posts', label: 'Publicações', symbol: '▦' },
    ...(view?.identity_card_visible ? [{ id: 'identity' as Tab, label: 'Carta de Identidade', symbol: '♙' }] : []),
    ...(allow('show_characters') ? [{ id: 'characters' as Tab, label: 'Personagens', symbol: '⚔', count: heroes.length }] : []),
    ...(allow('show_badges') ? [{ id: 'badges' as Tab, label: 'Insígnias', symbol: '✧', count: badges.length }] : []),
    ...(allow('show_journal') ? [{ id: 'chronicles' as Tab, label: 'Crônicas', symbol: '▤', count: chronicles.length }] : []),
  ]

  return createPortal(
    <div className="hb-public-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="hb-public-dialog" role="dialog" aria-modal="true" aria-labelledby="hb-public-profile-name">
        <div className="hb-public-toolbar">
          <div className="hb-public-toolbar-caption"><span aria-hidden="true">✦</span><span>HÄXBAG</span><span className="hb-public-toolbar-divider" aria-hidden="true"/><span>PERFIL SOCIAL</span></div>
          <button ref={closeRef} className="hb-public-close" type="button" onClick={onClose} aria-label="Fechar perfil">✕</button>
        </div>
        {loading && <div className="hb-public-progress" role="status"><span className="hb-public-progress-icon" aria-hidden="true">✧</span><strong>Abrindo livro do aventureiro</strong><p>Buscando apenas as informações públicas do perfil…</p></div>}
        {!loading && !view && <div className="hb-public-progress" role="alert"><span className="hb-public-progress-icon" aria-hidden="true">◇</span><strong>Perfil indisponível</strong><p>{error || 'Não foi possível encontrar este aventureiro.'}</p>{relationship.blocked_by_me&&<button type="button" disabled={actionBusy} onClick={()=>void toggleBlock()}>Desbloquear esta pessoa</button>}<button type="button" onClick={onClose}>Voltar à comunidade</button></div>}
        {view && <div className="hb-public-content" style={{ '--hb-public-accent': safeAccent(view.accent) } as CSSProperties}>
          <div className={`hb-public-cover ${view.cover_image ? 'has-personal-cover' : 'has-theme-cover'}`} style={view.cover_image ? { backgroundImage: `linear-gradient(180deg,rgba(8,12,17,.12) 0%,rgba(8,12,17,.04) 36%,rgba(8,12,17,.66) 100%),url(${view.cover_image})`, backgroundPosition: `center, center ${view.cover_position ?? 50}%` } : undefined}>
            <div className="hb-public-cover-top"><span>PERFIL DA COMUNIDADE</span><span>HÄXBAG · AVENTUREIROS</span></div>
          </div>
          <header className="hb-public-identity">
            <div className={`hb-public-avatar frame-${view.frame || 'classic'}`}>
              {view.avatar_image ? <img src={view.avatar_image} alt={`Avatar de ${view.display_name}`} style={{ objectPosition: `center ${view.avatar_position ?? 50}%` }} /> : <span>{(view.display_name || person.display_name || 'A').slice(0,1).toUpperCase()}</span>}
            </div>
            <div className="hb-public-identity-copy">
              <span className="hb-public-eyebrow">✦ CONHEÇA QUEM ESTÁ POR AQUI</span>
              <h2 id="hb-public-profile-name">{view.display_name || person.display_name}</h2>
              <span className="hb-public-handle">@{view.username || person.username || 'aventureiro'}</span>
              {view.status && allow('show_status') && <span className="hb-public-status"><i aria-hidden="true"/>{view.status}</span>}
            </div>
            <div className="hb-public-relationship">{isSelf ? '✦ Prévia do seu perfil público' : relationship.friends ? '✧ Vocês são amigos' : relationship.following ? '↗ Você segue este aventureiro' : relationship.follows_me ? '↙ Esta pessoa segue você' : '◇ Aventureiro da comunidade'}</div>
          </header>
          <div className="hb-v164-profile-social-actions">
            {!isSelf && !relationship.blocked_by_me && !relationship.blocked_me && <button type="button" className="hb-v164-follow-action" onClick={()=>void toggleFollow()} disabled={actionBusy}>{relationship.following?'✓ Seguindo':relationship.follows_me?'+ Seguir de volta':'+ Seguir'}</button>}
            {!isSelf && relationship.friends && onMessage && <button type="button" onClick={()=>onMessage(person)}>✉ Enviar mensagem</button>}
            <button type="button" onClick={()=>setTab('posts')}>▦ Ver publicações</button>
          </div>
          <div className="hb-public-stats">
            {typeof view.character_count === 'number' && view.character_count >= 0 && allow('show_characters') && <div><span aria-hidden="true">⚔</span><strong>{view.character_count}</strong><small>Personagens</small></div>}
            {typeof view.campaign_count === 'number' && view.campaign_count >= 0 && allow('show_campaigns') && <div><span aria-hidden="true">⚑</span><strong>{view.campaign_count}</strong><small>Campanhas</small></div>}
            {allow('show_badges') && <div><span aria-hidden="true">✧</span><strong>{badges.length}</strong><small>Insígnias em destaque</small></div>}
            {allow('show_journal') && <div><span aria-hidden="true">▤</span><strong>{chronicles.length}</strong><small>Crônicas públicas</small></div>}
          </div>
          <nav className="hb-public-tabs" aria-label="Seções do perfil público">
            {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}><span aria-hidden="true">{item.symbol}</span>{item.label}{item.count !== undefined && <small>{item.count}</small>}</button>)}
          </nav>
          <main className="hb-public-main">
            <div hidden={tab!=='posts'}><ProfilePostsV164 authorId={person.id} active={tab==='posts'} isSelf={isSelf}/></div>
            {tab === 'presentation' && <div className="hb-public-overview">
              <section className="hb-public-panel hb-public-about"><span className="hb-public-overline">CONHEÇA ESTA PESSOA</span><h3>Sobre</h3>{view.bio && allow('show_bio') ? <p className="hb-public-biography">{view.bio}</p> : <p className="hb-public-muted">{!allow('show_bio') ? 'Esta apresentação é privada.' : 'O aventureiro ainda não escreveu sua apresentação.'}</p>}</section>
              <section className="hb-public-panel hb-public-glimpse"><span className="hb-public-overline">UNIVERSO RPG</span><h3>Personagens e conquistas</h3>
                {view.identity_card_visible && <button type="button" className="hb-public-glimpse-row" onClick={() => setTab('identity')}><span>♙</span><strong>Carta de Identidade personalizada</strong><span>Ver ↗</span></button>}
                {allow('show_characters') && heroes.length > 0 && <button type="button" className="hb-public-glimpse-row" onClick={() => setTab('characters')}><span>⚔</span><strong>{heroes.length} personagem{heroes.length === 1 ? '' : 's'} em destaque</strong><span>Ver ↗</span></button>}
                {allow('show_badges') && badges.length > 0 && <button type="button" className="hb-public-glimpse-row" onClick={() => setTab('badges')}><span>✧</span><strong>{badges.length} insígnia{badges.length === 1 ? '' : 's'}</strong><span>Ver ↗</span></button>}
                {allow('show_journal') && chronicles.length > 0 && <button type="button" className="hb-public-glimpse-row" onClick={() => setTab('chronicles')}><span>▤</span><strong>{chronicles.length} crônica{chronicles.length === 1 ? '' : 's'}</strong><span>Ver ↗</span></button>}
                {!(view.identity_card_visible || allow('show_characters') && heroes.length || allow('show_badges') && badges.length || allow('show_journal') && chronicles.length) && <p className="hb-public-muted">Os destaques desta jornada ainda não foram compartilhados.</p>}
              </section>
            </div>}
            {tab === 'identity' && view.identity_card_visible && <section className="hb-public-panel hb-public-identity-card-section">
              <span className="hb-public-overline">UMA CARTA ÚNICA</span><h3>Carta de Identidade</h3>
              <div className={`hb-public-identity-card hb-public-identity-card-v135 ${view.identity_card_image?'has-image':''}`} data-cover={view.identity_card_cover_theme || 'eclipse'}>
                {view.identity_card_image && <><img className="hb-public-identity-card-background" src={view.identity_card_image} alt="" style={{objectPosition:`center ${view.identity_card_position ?? 50}%`}}/><span className="hb-public-identity-card-shade" aria-hidden="true"/></>}
                <div className="hb-public-identity-card-top"><span>✦ HÄXBAG / CARTA DE IDENTIDADE</span><span>REGISTRO PESSOAL</span></div>
                <div className="hb-public-identity-card-emblem" aria-hidden="true"><span>✧</span><small>O REGISTRO DO AVENTUREIRO</small><span>✧</span></div>
                <div className="hb-public-identity-card-person">
                  <div className="hb-public-identity-card-portrait" aria-label="Retrato do aventureiro">
                    {view.identity_card_portrait !== 'symbol' && view.avatar_image
                      ? <img src={view.avatar_image} alt={`Retrato de ${view.display_name}`} style={{objectPosition:`center ${view.avatar_position ?? 50}%`}}/>
                      : <span aria-hidden="true">{view.identity_card_symbol || (view.display_name || 'A').charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="hb-public-identity-card-person-copy">
                    <small>IDENTIDADE DO PORTADOR</small>
                    <strong>{view.display_name}</strong>
                    <span className="hb-public-identity-card-handle">@{view.username}</span>
                    {view.status && allow('show_status') && <span className="hb-public-identity-card-status">✧ {view.status}</span>}
                  </div>
                </div>
                <div className="hb-public-identity-card-description">
                  <span className="hb-public-identity-card-description-label">✎ SOBRE O AVENTUREIRO</span>
                  {allow('show_bio') && view.bio?.trim()
                    ? <p>{view.bio.trim()}</p>
                    : <p className="hb-public-identity-card-description-placeholder">{allow('show_bio')?'Este aventureiro ainda não escreveu uma descrição.':'A descrição deste aventureiro é privada.'}</p>}
                </div>
                <div className="hb-public-identity-card-bottom"><span>✦ IDENTIDADE · HÄXBAG</span><span>REGISTRO PESSOAL / I</span></div>
              </div>
              <p className="hb-public-muted">Esta carta usa a capa do perfil como fundo, exceto quando o aventureiro escolhe uma imagem exclusiva no Ateliê.</p>
            </section>}
            {tab === 'characters' && allow('show_characters') && <section className="hb-public-panel"><span className="hb-public-overline">PROTAGONISTAS DA JORNADA</span><h3>Personagens em destaque</h3><p className="hb-public-muted">Escolhidos pelo próprio aventureiro para esta vitrine.</p><div className="hb-public-gallery">{heroes.map(hero => <article key={hero.id} className="hb-public-hero"><span className="hb-public-hero-art" aria-hidden="true">{hero.emoji || '⚔️'}</span><div><strong>{hero.name}</strong><small>{hero.archetype || 'Aventureiro'}</small>{hero.campaign && <small>{hero.campaign}</small>}</div></article>)}{!heroes.length && <p className="hb-public-muted">Nenhum protagonista foi colocado em destaque.</p>}</div></section>}
            {tab === 'badges' && allow('show_badges') && <section className="hb-public-panel"><span className="hb-public-overline">RECONHECIMENTOS</span><h3>Insígnias do aventureiro</h3><div className="hb-public-gallery">{badges.map(badge => <article key={badge.id} className={`hb-public-badge hb-public-badge-${badge.id}`} ><span aria-hidden="true">{badge.symbol || '🏅'}</span><div><strong>{badge.title}</strong><p>{badge.description || 'Reconhecimento especial.'}</p></div></article>)}{!badges.length && <p className="hb-public-muted">Este aventureiro ainda não recebeu insígnias oficiais.</p>}</div></section>}
            {tab === 'chronicles' && allow('show_journal') && <section className="hb-public-panel"><span className="hb-public-overline">O LIVRO DAS MEMÓRIAS</span><h3>Crônicas compartilhadas</h3><ol className="hb-public-timeline">{chronicles.map(item => <li key={item.id}><small>{item.date ? new Date(`${item.date.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : 'MARCO DA JORNADA'}</small><strong>{item.title}</strong><p>{item.detail || 'Registro da jornada.'}</p></li>)}{!chronicles.length && <li className="hb-public-muted">Nenhuma crônica foi compartilhada.</li>}</ol></section>}
          </main>
          {(error || notice) && <div className={`hb-public-feedback ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
          <footer className="hb-public-footer">
            <div className="hb-public-footer-note"><span aria-hidden="true">♧</span><div><strong>Uma comunidade de histórias</strong><small>O perfil mostra apenas as informações que o jogador tornou públicas.</small></div></div>
            <div className="hb-public-footer-actions">
              {!isSelf && !relationship.blocked_by_me && !relationship.blocked_me && <button type="button" onClick={() => void toggleFollow()} disabled={actionBusy}>{relationship.following ? '✓ Seguindo · Deixar de seguir' : relationship.follows_me ? '↗ Seguir de volta' : '+ Seguir'}</button>}
              {!isSelf && relationship.friends && onMessage && <button type="button" onClick={()=>onMessage(person)}>✉ Mensagem privada</button>}
              {!isSelf && <button type="button" className="hb-public-block-control" onClick={()=>void toggleBlock()} disabled={actionBusy}>{relationship.blocked_by_me ? 'Desbloquear' : '⊘ Bloquear'}</button>}
              {!isSelf && campaigns.length > 0 && relationship.friends && <div className="hb-public-invite"><select aria-label="Campanha para convidar" value={selectedCampaign} onChange={event => setSelectedCampaign(event.target.value)}><option value="">Selecionar campanha</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><button type="button" disabled={!selectedCampaign || actionBusy} onClick={() => void inviteToCampaign()}>Convidar</button></div>}
              <button type="button" className="hb-public-dismiss" onClick={onClose}>Voltar</button>
            </div>
          </footer>
        </div>}
      </section>
    </div>,
    document.body,
  )
}
