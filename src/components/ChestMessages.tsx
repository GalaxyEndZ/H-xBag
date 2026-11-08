import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import './ChestMessages.css'

type ChestMessage = {
  id: string
  campaign_id: string
  recipient_user_id: string
  character_id: string
  character_name: string
  item_name: string
  item_icon: string
  quantity: number
  message: string
  created_at: string
  read_at: string | null
}

/** Mensagens persistentes, enviadas pelo banco após entregas confirmadas. */
export default function ChestMessages({ userId, campaignId }: { userId: string; campaignId: string }) {
  const [messages, setMessages] = useState<ChestMessage[]>([])
  const [opened, setOpened] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [markingId, setMarkingId] = useState<string | null>(null)
  const shownInSession = useRef<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    let requestId = 0
    shownInSession.current = new Set()
    setMessages([])
    setOpened(false)
    setSelectedId(null)
    setError('')
    if (!userId || !campaignId) return
    setLoading(true)

    const refresh = async () => {
      const currentRequest = ++requestId
      const { data, error: fetchError } = await supabase.from('master_chest_player_messages')
        .select('id,campaign_id,recipient_user_id,character_id,character_name,item_name,item_icon,quantity,message,created_at,read_at')
        .eq('recipient_user_id', userId)
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!active || currentRequest !== requestId) return
      setLoading(false)
      if (fetchError) {
        setError('Mensagens de recompensas indisponíveis. Confira a migração master_chest_messages_v85.sql.')
        return
      }
      setError('')
      const rows = (data ?? []) as ChestMessage[]
      setMessages(rows)
      const unseen = rows.filter(row => !row.read_at && !shownInSession.current.has(row.id))
      if (unseen.length) {
        // Uma abertura por lote de mensagens, sem reaparecer a cada atualização.
        unseen.forEach(row => shownInSession.current.add(row.id))
        setSelectedId(current => current ?? unseen[0].id)
        setOpened(true)
      }
    }
    const onFocus = () => { void refresh() }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 20000)
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, campaignId])

  const unreadCount = useMemo(() => messages.filter(row => !row.read_at).length, [messages])
  const selected = messages.find(row => row.id === selectedId) ?? messages[0] ?? null
  const markRead = async (id: string) => {
    if (markingId) return
    setMarkingId(id)
    setError('')
    const { error: markError } = await supabase.rpc('mark_master_chest_message_read', { p_message_id: id })
    if (markError) setError(`Não foi possível marcar como lida: ${markError.message}`)
    else {
      const next = messages.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row)
      setMessages(next)
      const nextUnread = next.find(row => !row.read_at)
      if (nextUnread) {
        shownInSession.current.add(nextUnread.id)
        setSelectedId(nextUnread.id)
      } else {
        setSelectedId(null)
        setOpened(false)
      }
    }
    setMarkingId(null)
  }

  if (!userId || !campaignId) return null
  return <div className="hbn-root">
    <button type="button" className="hbn-trigger" onClick={() => { setOpened(true); setSelectedId(current => current ?? messages.find(row => !row.read_at)?.id ?? messages[0]?.id ?? null) }} aria-label={`Mensagens de recompensas${unreadCount ? `, ${unreadCount} não lidas` : ''}`} title="Mensagens de recompensas">
      <span aria-hidden="true">✉</span><span className="hbn-trigger-label">Recompensas</span>{unreadCount > 0 && <span className="hbn-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {opened && <div className="hbn-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpened(false) }}>
      <section className="hbn-dialog" role="dialog" aria-modal="true" aria-labelledby="hbn-title" onKeyDown={event => { if (event.key === 'Escape') setOpened(false) }}>
        <div className="hbn-head"><div><span className="hbn-eyebrow">✦ CORREIO DA CAMPANHA</span><h2 id="hbn-title">Mensagens de recompensas</h2><p>Recados do mestre recebidos junto com seus drops.</p></div><button type="button" className="hbn-close" aria-label="Fechar mensagens" onClick={() => setOpened(false)}>×</button></div>
        {error && <p className="hbn-error" role="alert">{error}</p>}
        {loading && !messages.length ? <p className="hbn-empty">Carregando mensagens...</p> : messages.length === 0 ? <div className="hbn-empty"><span aria-hidden="true">✉</span><p>Você ainda não recebeu mensagens de recompensas nesta campanha.</p></div> : <div className="hbn-content">
          <div className="hbn-list" aria-label="Histórico de mensagens">{messages.map(row => <button type="button" key={row.id} className={`hbn-list-item ${selected?.id === row.id ? 'selected' : ''} ${row.read_at ? '' : 'unread'}`} onClick={() => { shownInSession.current.add(row.id); setSelectedId(row.id) }} aria-pressed={selected?.id === row.id}>
            <span className="hbn-item-icon" aria-hidden="true">{row.item_icon || '🎁'}</span><span><strong>{row.item_name}</strong><small>{row.character_name} · {new Date(row.created_at).toLocaleDateString('pt-BR')}</small></span>{!row.read_at && <span className="hbn-unread-dot" aria-label="Não lida"/>}
          </button>)}</div>
          {selected && <article className="hbn-message"><span className="hbn-eyebrow">RECOMPENSA RECEBIDA</span><div className="hbn-message-title"><span aria-hidden="true">{selected.item_icon || '🎁'}</span><div><h3>{selected.item_name}</h3><small>Para {selected.character_name} · {selected.quantity} {selected.quantity === 1 ? 'unidade' : 'unidades'}</small></div></div><p className="hbn-message-body">{selected.message}</p><time dateTime={selected.created_at}>Recebida em {new Date(selected.created_at).toLocaleString('pt-BR')}</time><div className="hbn-actions">{!selected.read_at ? <button type="button" className="hbn-primary" disabled={Boolean(markingId)} onClick={() => void markRead(selected.id)}>{markingId === selected.id ? 'Salvando...' : '✓ Marcar como lida'}</button> : <span className="hbn-read">✓ Mensagem lida</span>}<button type="button" className="hbn-secondary" onClick={() => setOpened(false)}>Fechar</button></div></article>}
        </div>}
        <p className="hbn-footer">As mensagens ficam salvas para você reler. Apenas o jogador destinatário pode consultá-las.</p>
      </section>
    </div>}
  </div>
}
