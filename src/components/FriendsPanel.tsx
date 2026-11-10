import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import './FriendsPanel.css'

type Person = { id: string; display_name: string; status?: string; request_id?: string }
type Invitation = { id: string; campaign_name: string; sender_name: string; created_at: string }
type Props = { campaignId: string | null; campaignName: string; canInvite: boolean }

export default function FriendsPanel({ campaignId, campaignName, canInvite }: Props) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'invites'>('friends')
  const [refreshing, setRefreshing] = useState(false)
  const [results, setResults] = useState<Person[]>([])
  const [friends, setFriends] = useState<Person[]>([])
  const [requests, setRequests] = useState<Person[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
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
      if (search.trim().length < 2) { setResults([]); return }
      const { data, error: searchError } = await supabase.rpc('hb_search_people', { p_query: search.trim() })
      if (!cancelled) { if (searchError) setError(searchError.message); else setResults((data ?? []) as Person[]) }
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search])
  async function act(key: string, operation: string, args: Record<string, unknown>, success: string) {
    setBusy(key); setError(''); setMessage('')
    try { await rpc(operation, args); setMessage(success); await refresh(); if (search.trim().length >= 2) {
      const { data } = await supabase.rpc('hb_search_people', { p_query: search.trim() })
      setResults((data ?? []) as Person[])
    } } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy('') }
  }
  const refreshNow = async () => { setRefreshing(true); try { await refresh() } finally { setRefreshing(false) } }
  return <section className="hb-friends-panel hb-friends-panel-v2" aria-label="Amigos e convites">
    <div className="hb-friends-heading"><div><span className="hb-kicker">SUA COMPANHIA</span><h2>Amigos e convites</h2><p>Encontre aventureiros, aceite amizades e convide amigos para sua campanha.</p></div><button type="button" className="hb-friends-refresh" disabled={refreshing} onClick={() => void refreshNow()}>{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button></div>
    <div className="hb-friends-stats" aria-label="Resumo social"><span><strong>{friends.length}</strong> amigos</span><span><strong>{requests.length}</strong> solicitações</span><span><strong>{invites.length}</strong> convites</span></div>
    <div className="hb-friends-tabs" role="tablist" aria-label="Seções sociais">
      <button type="button" role="tab" aria-selected={activeTab === 'friends'} className={activeTab === 'friends' ? 'active' : ''} onClick={() => setActiveTab('friends')}>Amigos <span>{friends.length}</span></button>
      <button type="button" role="tab" aria-selected={activeTab === 'requests'} className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}>Solicitações <span>{requests.length}</span></button>
      <button type="button" role="tab" aria-selected={activeTab === 'invites'} className={activeTab === 'invites' ? 'active' : ''} onClick={() => setActiveTab('invites')}>Convites <span>{invites.length}</span></button>
    </div>
    {error && <p className="hb-friends-error" role="alert">{error}</p>}
    {message && <p className="hb-friends-message" role="status">{message}</p>}
    {activeTab === 'friends' && <div className="hb-friends-layout"><div className="hb-friends-box"><h3>Encontrar aventureiros</h3><label className="hb-friends-label" htmlFor="hb-find-player">Pesquisar pelo nome</label><input id="hb-find-player" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite pelo menos 2 letras" maxLength={60} />
      {results.map(person => <div className="hb-friends-person" key={person.id}><span className="hb-friends-avatar">{person.display_name.charAt(0).toUpperCase()}</span><strong>{person.display_name}</strong><button type="button" disabled={!!busy || person.status === 'friends' || person.status === 'pending'} onClick={() => void act(person.id, 'hb_send_friend_request', { p_target: person.id }, 'Pedido de amizade enviado.')}>{person.status === 'friends' ? 'Amigos' : person.status === 'pending' ? 'Solicitado' : 'Adicionar'}</button></div>)}
      {search.trim().length >= 2 && !results.length && <p className="hb-friends-empty">Nenhum jogador encontrado.</p>}
      {search.trim().length < 2 && <p className="hb-friends-empty">Procure jogadores pelo nome de exibição para ampliar sua companhia.</p>}
    </div><div className="hb-friends-box"><h3>Minha companhia</h3>{!friends.length && <p className="hb-friends-empty">Você ainda não adicionou amigos. Encontre aventureiros na busca ao lado.</p>}
      {friends.map(person => <div className="hb-friends-person" key={person.id}><span className="hb-friends-avatar">{person.display_name.charAt(0).toUpperCase()}</span><strong>{person.display_name}</strong>{canInvite && campaignId && <button type="button" disabled={!!busy} onClick={() => void act(person.id, 'hb_invite_friend_to_campaign', { p_friend: person.id, p_campaign: campaignId }, `Convite para ${campaignName} enviado.`)}>Convidar</button>}<button type="button" className="hb-friends-secondary" disabled={!!busy} onClick={() => void act(person.id, 'hb_remove_friend', { p_friend: person.id }, 'Amigo removido.')}>Remover</button></div>)}
      {!canInvite && <p className="hb-friends-hint">Para convidar amigos a uma campanha, selecione uma campanha em que você seja mestre.</p>}
    </div></div>}
    {activeTab === 'requests' && <div className="hb-friends-box hb-friends-tab-content"><h3>Solicitações de amizade</h3>{!requests.length && <p className="hb-friends-empty">Nenhuma solicitação pendente no momento.</p>}
      {requests.map(person => <div className="hb-friends-person" key={person.request_id}><span className="hb-friends-avatar">{person.display_name.charAt(0).toUpperCase()}</span><strong>{person.display_name}</strong><button type="button" disabled={!!busy} onClick={() => void act(person.request_id!, 'hb_answer_friend_request', { p_request_id: person.request_id, p_accept: true }, 'Amizade aceita.')}>Aceitar</button><button type="button" className="hb-friends-secondary" disabled={!!busy} onClick={() => void act(person.request_id!, 'hb_answer_friend_request', { p_request_id: person.request_id, p_accept: false }, 'Solicitação recusada.')}>Recusar</button></div>)}
    </div>}
    {activeTab === 'invites' && <div className="hb-friends-box hb-friends-tab-content"><h3>Convites de campanha</h3>{!invites.length && <p className="hb-friends-empty">Você não tem convites de campanha pendentes.</p>}
      {invites.map(invite => <div className="hb-friends-invite" key={invite.id}><div><strong>{invite.campaign_name}</strong><small>Enviado por {invite.sender_name}</small></div><button type="button" disabled={!!busy} onClick={() => void act(invite.id, 'hb_answer_direct_invite', { p_invite: invite.id, p_accept: true }, 'Convite aceito! Atualize a página para visualizar a campanha.')}>Entrar na campanha</button><button type="button" className="hb-friends-secondary" disabled={!!busy} onClick={() => void act(invite.id, 'hb_answer_direct_invite', { p_invite: invite.id, p_accept: false }, 'Convite recusado.')}>Recusar</button></div>)}
    </div>}
  </section>
}
