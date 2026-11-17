import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import PublicAdventurerProfile, { type AdventurerRef } from './PublicAdventurerProfile'
import './FriendsPanel.css'

type Person = { id: string; display_name: string; username?: string; status?: string; request_id?: string }
type Invitation = { id: string; campaign_name: string; sender_name: string; created_at: string }
type Props = { campaignId: string | null; campaignName: string; canInvite: boolean }
type Section = 'friends' | 'discover' | 'requests' | 'invites'

export default function FriendsPanel({ campaignId, campaignName, canInvite }: Props) {
  const [search, setSearch] = useState('')
  const [friendFilter, setFriendFilter] = useState('')
  const [activeTab, setActiveTab] = useState<Section>('friends')
  const [refreshing, setRefreshing] = useState(false)
  const [results, setResults] = useState<Person[]>([])
  const [searching, setSearching] = useState(false)
  const [friends, setFriends] = useState<Person[]>([])
  const [requests, setRequests] = useState<Person[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [viewing, setViewing] = useState<AdventurerRef | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    const { data, error: rpcError } = await supabase.rpc(name, args)
    if (rpcError) throw new Error(rpcError.message)
    return data
  }
  const refresh = useCallback(async () => {
    try {
      const [friendRows, requestRows, inviteRows] = await Promise.all([
        supabase.rpc('hb_list_friends'),
        supabase.rpc('hb_list_friend_requests'),
        supabase.rpc('hb_list_direct_invites'),
      ])
      for (const result of [friendRows, requestRows, inviteRows]) if (result.error) throw result.error
      setFriends((friendRows.data ?? []) as Person[])
      setRequests((requestRows.data ?? []) as Person[])
      setInvites((inviteRows.data ?? []) as Invitation[])
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (search.trim().length < 2) { setResults([]); setSearching(false); return }
      setSearching(true)
      const { data, error: searchError } = await supabase.rpc('hb_search_people', { p_query: search.trim() })
      if (!cancelled) {
        setSearching(false)
        if (searchError) setError(searchError.message)
        else { setError(''); setResults((data ?? []) as Person[]) }
      }
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search])

  async function act(key: string, operation: string, args: Record<string, unknown>, success: string) {
    setBusy(key); setError(''); setMessage('')
    try {
      await rpc(operation, args)
      setMessage(success)
      await refresh()
      if (search.trim().length >= 2) {
        const { data } = await supabase.rpc('hb_search_people', { p_query: search.trim() })
        setResults((data ?? []) as Person[])
      }
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy('') }
  }

  function viewPerson(person: Person, origin: 'friends' | 'requests' | 'discover' = 'discover') {
    setViewing({
      id: person.id,
      display_name: person.display_name,
      username: person.username,
      status: origin === 'friends' || friends.some(friend => friend.id === person.id) ? 'friends' : origin === 'requests' ? 'incoming' : person.status || '',
    })
  }

  const visibleFriends = useMemo(() => friends
    .filter(person => `${person.display_name} ${person.username || ''}`.toLocaleLowerCase('pt-BR').includes(friendFilter.trim().toLocaleLowerCase('pt-BR')))
    .sort((a,b) => a.display_name.localeCompare(b.display_name,'pt-BR')),
  [friends, friendFilter])

  const refreshNow = async () => { setRefreshing(true); try { await refresh() } finally { setRefreshing(false) } }
  async function syncAfterVisitorAction() {
    await refresh()
    if (search.trim().length >= 2) {
      const { data } = await supabase.rpc('hb_search_people', { p_query: search.trim() })
      if (data) setResults(data as Person[])
    }
  }
  const actionsLocked = Boolean(busy)

  function renderPerson(person: Person, mode: 'friends' | 'requests' | 'discover') {
    const friend = mode === 'friends' || friends.some(entry => entry.id === person.id) || person.status === 'friends'
    const pending = person.status === 'pending' || mode === 'requests'
    return <article className="hb-friends-person hb-friends-person-v132" key={person.request_id || person.id}>
      <button type="button" className="hb-friends-person-main" onClick={() => viewPerson(person, mode)} title={`Abrir perfil público de ${person.display_name}`} aria-label={`Visitar perfil de ${person.display_name}`}>
        <span className="hb-friends-avatar" aria-hidden="true">{(person.display_name || '?').charAt(0).toUpperCase()}</span>
        <span className="hb-friends-person-details"><strong>{person.display_name}</strong>{person.username && <small>@{person.username}</small>}<em>Ver perfil público <span aria-hidden="true">↗</span></em></span>
      </button>
      <div className="hb-friends-person-actions">
        <button type="button" className="hb-friends-view-profile" onClick={() => viewPerson(person, mode)}>Ver perfil</button>
        {mode === 'friends' && canInvite && campaignId && <button type="button" disabled={actionsLocked} onClick={() => void act(person.id, 'hb_invite_friend_to_campaign', { p_friend: person.id, p_campaign: campaignId }, `Convite para ${campaignName} enviado.`)}>Convidar</button>}
        {mode === 'friends' && <button type="button" className="hb-friends-secondary" disabled={actionsLocked} onClick={() => { if (window.confirm(`Remover ${person.display_name} da lista de amigos?`)) void act(person.id, 'hb_remove_friend', { p_friend: person.id }, 'Amigo removido.') }}>Remover</button>}
        {mode === 'requests' && <><button type="button" disabled={actionsLocked} onClick={() => void act(person.request_id || person.id, 'hb_answer_friend_request', { p_request_id: person.request_id, p_accept: true }, 'Amizade aceita.')}>Aceitar</button><button type="button" className="hb-friends-secondary" disabled={actionsLocked} onClick={() => void act(person.request_id || person.id, 'hb_answer_friend_request', { p_request_id: person.request_id, p_accept: false }, 'Solicitação recusada.')}>Recusar</button></>}
        {mode === 'discover' && <button type="button" disabled={actionsLocked || friend || pending} onClick={() => void act(person.id, 'hb_send_friend_request', { p_target: person.id }, 'Pedido de amizade enviado.')}>{friend ? '✓ Amigos' : pending ? '⌛ Solicitado' : '+ Adicionar'}</button>}
      </div>
    </article>
  }

  return <section className="hb-friends-panel hb-friends-panel-v2 hb-friends-panel-v132" aria-label="Amigos e convites">
    <div className="hb-friends-heading"><div><span className="hb-kicker">CONEXÕES DA JORNADA</span><h2>Companhia de aventureiros</h2><p>Visite o perfil dos seus amigos, descubra jogadores e acompanhe convites para novas histórias.</p></div><button type="button" className="hb-friends-refresh" disabled={refreshing} onClick={() => void refreshNow()}>{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button></div>
    <div className="hb-friends-stats" aria-label="Resumo social"><span><strong>{friends.length}</strong> amigos</span><span><strong>{requests.length}</strong> solicitações</span><span><strong>{invites.length}</strong> convites</span></div>
    <div className="hb-friends-tabs" role="group" aria-label="Seções sociais">
      <button type="button" aria-pressed={activeTab === 'friends'} className={activeTab === 'friends' ? 'active' : ''} onClick={() => setActiveTab('friends')}>♧ Meus amigos <span>{friends.length}</span></button>
      <button type="button" aria-pressed={activeTab === 'discover'} className={activeTab === 'discover' ? 'active' : ''} onClick={() => setActiveTab('discover')}>⌕ Descobrir</button>
      <button type="button" aria-pressed={activeTab === 'requests'} className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}>✉ Solicitações <span>{requests.length}</span></button>
      <button type="button" aria-pressed={activeTab === 'invites'} className={activeTab === 'invites' ? 'active' : ''} onClick={() => setActiveTab('invites')}>⚑ Convites <span>{invites.length}</span></button>
    </div>
    {error && <p className="hb-friends-error" role="alert">{error}</p>}
    {message && <p className="hb-friends-message" role="status">{message}</p>}

    {activeTab === 'friends' && <div className="hb-friends-box hb-friends-v132-content">
      <div className="hb-friends-v132-section-top"><div><span className="hb-friends-v132-overline">PESSOAS QUE COMPARTILHAM SUA JORNADA</span><h3>Minha companhia</h3><p>Toque no avatar ou no nome para abrir o perfil completo do jogador.</p></div><span className="hb-friends-v132-total">{friends.length} {friends.length === 1 ? 'amigo' : 'amigos'}</span></div>
      {friends.length > 4 && <label className="hb-friends-v132-filter">Filtrar amigos<input type="search" placeholder="Encontre alguém da sua companhia…" value={friendFilter} onChange={event => setFriendFilter(event.target.value)} /></label>}
      <div className="hb-friends-v132-list">{visibleFriends.map(person => renderPerson(person, 'friends'))}</div>
      {!friends.length && <div className="hb-friends-v132-empty"><span aria-hidden="true">♧</span><strong>Sua companhia ainda vai crescer</strong><p>Encontre outros aventureiros e inicie uma nova amizade.</p><button type="button" onClick={() => setActiveTab('discover')}>⌕ Encontrar jogadores</button></div>}
      {!!friends.length && !visibleFriends.length && <p className="hb-friends-empty">Nenhum amigo corresponde ao filtro.</p>}
      {!canInvite && !!friends.length && <p className="hb-friends-hint">Para convidar seus amigos, selecione uma campanha em que você seja mestre.</p>}
    </div>}

    {activeTab === 'discover' && <div className="hb-friends-box hb-friends-v132-content"><div className="hb-friends-v132-section-top"><div><span className="hb-friends-v132-overline">NOVOS CAMINHOS</span><h3>Encontrar aventureiros</h3><p>Pesquise um jogador para visitar sua vitrine e enviar um pedido de amizade.</p></div></div>
      <label className="hb-friends-label" htmlFor="hb-find-player">Nome ou @usuário</label><div className="hb-social-search"><span aria-hidden="true">⌕</span><input id="hb-find-player" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite pelo menos 2 caracteres…" maxLength={60} autoComplete="off" />{search && <button type="button" aria-label="Limpar busca" onClick={() => { setSearch(''); setResults([]) }}>×</button>}</div>
      <div className="hb-friends-v132-list">{results.map(person => renderPerson(person, 'discover'))}</div>
      {searching && search.trim().length >= 2 && <p className="hb-friends-empty" role="status">Procurando aventureiros…</p>}
      {!searching && search.trim().length >= 2 && !results.length && <p className="hb-friends-empty">Nenhum aventureiro encontrado. Experimente outro nome.</p>}
      {search.trim().length < 2 && <div className="hb-friends-v132-empty"><span aria-hidden="true">⌕</span><strong>Conheça outros aventureiros</strong><p>Pesquise pelo nome de usuário para descobrir perfis públicos e iniciar novas histórias.</p></div>}
    </div>}

    {activeTab === 'requests' && <div className="hb-friends-box hb-friends-v132-content"><div className="hb-friends-v132-section-top"><div><span className="hb-friends-v132-overline">CONVITES PARA COMPANHIA</span><h3>Pedidos de amizade</h3><p>Conheça quem enviou o pedido antes de aceitar.</p></div></div><div className="hb-friends-v132-list">{requests.map(person => renderPerson(person, 'requests'))}</div>{!requests.length && <div className="hb-friends-v132-empty"><span aria-hidden="true">✉</span><strong>Sem solicitações pendentes</strong><p>Novos pedidos de amizade aparecerão aqui.</p></div>}</div>}

    {activeTab === 'invites' && <div className="hb-friends-box hb-friends-v132-content"><div className="hb-friends-v132-section-top"><div><span className="hb-friends-v132-overline">UMA NOVA HISTÓRIA CHAMA</span><h3>Convites de campanha</h3><p>Decida de quais jornadas quer fazer parte.</p></div></div>{!invites.length && <div className="hb-friends-v132-empty"><span aria-hidden="true">⚑</span><strong>Sem convites pendentes</strong><p>Quando um mestre convidar você para uma campanha, ela aparecerá aqui.</p></div>}{invites.map(invite => <div className="hb-friends-invite" key={invite.id}><div><strong>{invite.campaign_name}</strong><small>Enviado por {invite.sender_name}</small></div><button type="button" disabled={actionsLocked} onClick={() => void act(invite.id, 'hb_answer_direct_invite', { p_invite: invite.id, p_accept: true }, 'Convite aceito! Atualize a página para visualizar a campanha.')}>Entrar na campanha</button><button type="button" className="hb-friends-secondary" disabled={actionsLocked} onClick={() => void act(invite.id, 'hb_answer_direct_invite', { p_invite: invite.id, p_accept: false }, 'Convite recusado.')}>Recusar</button></div>)}</div>}

    {viewing && <PublicAdventurerProfile person={viewing} onClose={() => setViewing(null)} onFriendUpdate={() => void syncAfterVisitorAction()} campaigns={canInvite && campaignId ? [{ id: campaignId, name: campaignName }] : []} />}
  </section>
}
