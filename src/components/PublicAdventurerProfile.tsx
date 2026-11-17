import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import './PublicAdventurerProfile.css'

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
type Tab = 'presentation' | 'identity' | 'characters' | 'badges' | 'chronicles'

type Props = {
  person: AdventurerRef
  onClose: () => void
  campaigns?: CampaignChoice[]
  onFriendUpdate?: () => void
  isSelf?: boolean
}

const safeAccent = (value: string | undefined) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#d9bd8b'

export default function PublicAdventurerProfile({ person, onClose, campaigns = [], onFriendUpdate, isSelf = false }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [relationship, setRelationship] = useState(person.status || '')
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
    setRelationship(person.status || '')
    void (async () => {
      const { data, error: failure } = await supabase.rpc('hax_profile_public_view', { p_user_id: person.id })
      if (cancelled) return
      if (failure) setError(`Não foi possível abrir o perfil: ${failure.message}`)
      else if (!data || typeof data !== 'object' || Array.isArray(data)) setError('Este perfil não está disponível no momento.')
      else setProfile(data as PublicProfile)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [person.id, person.status])

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

  async function sendFriendRequest() {
    if (relationship === 'friends' || relationship === 'pending' || relationship === 'incoming' || actionBusy) return
    setActionBusy(true)
    setError('')
    const { error: failure } = await supabase.rpc('hb_send_friend_request', { p_target: person.id })
    setActionBusy(false)
    if (failure) setError(failure.message)
    else {
      setRelationship('pending')
      setNotice('Solicitação de amizade enviada.')
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
    { id: 'presentation', label: 'Visão geral', symbol: '✦' },
    ...(view?.identity_card_visible ? [{ id: 'identity' as Tab, label: 'Carta de Identidade', symbol: '♙' }] : []),
    ...(allow('show_characters') ? [{ id: 'characters' as Tab, label: 'Personagens', symbol: '⚔', count: heroes.length }] : []),
    ...(allow('show_badges') ? [{ id: 'badges' as Tab, label: 'Insígnias', symbol: '✧', count: badges.length }] : []),
    ...(allow('show_journal') ? [{ id: 'chronicles' as Tab, label: 'Crônicas', symbol: '▤', count: chronicles.length }] : []),
  ]

  return createPortal(
    <div className="hb-public-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="hb-public-dialog" role="dialog" aria-modal="true" aria-labelledby="hb-public-profile-name">
        <div className="hb-public-toolbar">
          <div className="hb-public-toolbar-caption"><span aria-hidden="true">✦</span><span>HÄXBAG</span><span className="hb-public-toolbar-divider" aria-hidden="true"/><span>PERFIL DO AVENTUREIRO</span></div>
          <button ref={closeRef} className="hb-public-close" type="button" onClick={onClose} aria-label="Fechar perfil">✕</button>
        </div>
        {loading && <div className="hb-public-progress" role="status"><span className="hb-public-progress-icon" aria-hidden="true">✧</span><strong>Abrindo livro do aventureiro</strong><p>Buscando apenas as informações públicas do perfil…</p></div>}
        {!loading && !view && <div className="hb-public-progress" role="alert"><span className="hb-public-progress-icon" aria-hidden="true">◇</span><strong>Perfil indisponível</strong><p>{error || 'Não foi possível encontrar este aventureiro.'}</p><button type="button" onClick={onClose}>Voltar à comunidade</button></div>}
        {view && <div className="hb-public-content" style={{ '--hb-public-accent': safeAccent(view.accent) } as CSSProperties}>
          <div className="hb-public-cover" style={view.cover_image ? { backgroundImage: `linear-gradient(180deg,transparent 30%,rgba(10,12,15,.72)),url(${view.cover_image})`, backgroundPosition: `center, center ${view.cover_position ?? 50}%` } : undefined}>
            <div className="hb-public-cover-top"><span>ARQUIVO DO AVENTUREIRO</span><span>✧ HÄXBAG ✧</span></div>
            <span className="hb-public-cover-crest" aria-hidden="true">❖</span>
          </div>
          <header className="hb-public-identity">
            <div className={`hb-public-avatar frame-${view.frame || 'classic'}`}>
              {view.avatar_image ? <img src={view.avatar_image} alt={`Avatar de ${view.display_name}`} style={{ objectPosition: `center ${view.avatar_position ?? 50}%` }} /> : <span>{(view.display_name || person.display_name || 'A').slice(0,1).toUpperCase()}</span>}
            </div>
            <div className="hb-public-identity-copy">
              <span className="hb-public-eyebrow">✧ UM NOVO CAMINHO SE CRUZA COM O SEU</span>
              <h2 id="hb-public-profile-name">{view.display_name || person.display_name}</h2>
              <span className="hb-public-handle">@{view.username || person.username || 'aventureiro'}</span>
              {view.status && allow('show_status') && <span className="hb-public-status"><i aria-hidden="true"/>{view.status}</span>}
            </div>
            <div className="hb-public-relationship">{isSelf ? '✦ Prévia do seu perfil público' : relationship === 'friends' ? '✧ Vocês são amigos' : relationship === 'incoming' ? '✉ Pedido de amizade recebido' : relationship === 'pending' ? '⌛ Solicitação de amizade enviada' : '◇ Aventureiro da comunidade'}</div>
          </header>
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
            {tab === 'presentation' && <div className="hb-public-overview">
              <section className="hb-public-panel hb-public-about"><span className="hb-public-overline">A HISTÓRIA POR TRÁS DO NOME</span><h3>Sobre o aventureiro</h3>{view.bio && allow('show_bio') ? <p className="hb-public-biography">{view.bio}</p> : <p className="hb-public-muted">{!allow('show_bio') ? 'Esta apresentação é privada.' : 'O aventureiro ainda não escreveu sua apresentação.'}</p>}</section>
              <section className="hb-public-panel hb-public-glimpse"><span className="hb-public-overline">DESTAQUES DA JORNADA</span><h3>Fragmentos do legado</h3>
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
            {tab === 'badges' && allow('show_badges') && <section className="hb-public-panel"><span className="hb-public-overline">RECONHECIMENTOS</span><h3>Insígnias do aventureiro</h3><div className="hb-public-gallery">{badges.map(badge => <article key={badge.id} className="hb-public-badge"><span aria-hidden="true">{badge.symbol || '🏅'}</span><div><strong>{badge.title}</strong><p>{badge.description || 'Reconhecimento especial.'}</p></div></article>)}{!badges.length && <p className="hb-public-muted">Este aventureiro ainda não destacou insígnias.</p>}</div></section>}
            {tab === 'chronicles' && allow('show_journal') && <section className="hb-public-panel"><span className="hb-public-overline">O LIVRO DAS MEMÓRIAS</span><h3>Crônicas compartilhadas</h3><ol className="hb-public-timeline">{chronicles.map(item => <li key={item.id}><small>{item.date ? new Date(`${item.date.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : 'MARCO DA JORNADA'}</small><strong>{item.title}</strong><p>{item.detail || 'Registro da jornada.'}</p></li>)}{!chronicles.length && <li className="hb-public-muted">Nenhuma crônica foi compartilhada.</li>}</ol></section>}
          </main>
          {(error || notice) && <div className={`hb-public-feedback ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
          <footer className="hb-public-footer">
            <div className="hb-public-footer-note"><span aria-hidden="true">♧</span><div><strong>Uma comunidade de histórias</strong><small>O perfil mostra apenas as informações que o jogador tornou públicas.</small></div></div>
            <div className="hb-public-footer-actions">
              {!isSelf && <button type="button" onClick={() => void sendFriendRequest()} disabled={actionBusy || relationship === 'friends' || relationship === 'pending' || relationship === 'incoming'}>{relationship === 'friends' ? '✓ Amigos' : relationship === 'incoming' ? '✉ Responda em Solicitações' : relationship === 'pending' ? '⌛ Solicitação enviada' : '+ Adicionar amigo'}</button>}
              {!isSelf && campaigns.length > 0 && relationship === 'friends' && <div className="hb-public-invite"><select aria-label="Campanha para convidar" value={selectedCampaign} onChange={event => setSelectedCampaign(event.target.value)}><option value="">Selecionar campanha</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><button type="button" disabled={!selectedCampaign || actionBusy} onClick={() => void inviteToCampaign()}>Convidar</button></div>}
              <button type="button" className="hb-public-dismiss" onClick={onClose}>Voltar</button>
            </div>
          </footer>
        </div>}
      </section>
    </div>,
    document.body,
  )
}
