import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './SocialPostComments.css'

type Comment = {
  comment_id: string
  author_id: string
  display_name: string
  username: string
  content: string
  created_at: string
  can_delete: boolean
}

type CountRow = { post_id: string; comment_count: number }

/** A mesma contagem é usada no Feed, no meu perfil e nos perfis públicos. */
export function useSocialCommentCounts(postIds: string[], enabled = true) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const idsKey = postIds.join('|')
  useEffect(() => {
    if (!enabled || !idsKey) return
    let cancelled = false
    const ids = idsKey.split('|')
    void (async () => {
      const next: Record<string, number> = {}
      for (let i = 0; i < ids.length; i += 80) {
        const { data, error } = await supabase.rpc('hax_social_comment_counts', { p_posts: ids.slice(i, i + 80) })
        if (error) { console.warn('Contagens de comentários indisponíveis:', error.message); return }
        for (const row of (data || []) as CountRow[]) next[row.post_id] = Number(row.comment_count) || 0
      }
      if (!cancelled) setCounts(next)
    })()
    return () => { cancelled = true }
  }, [enabled, idsKey])
  const updateCount = (postId: string, delta: number) => {
    setCounts(current => ({ ...current, [postId]: Math.max(0, (current[postId] || 0) + delta) }))
  }
  return { counts, updateCount }
}

export default function SocialPostComments({ postId, count, onCountChange }: {
  postId: string
  count?: number
  onCountChange?: (postId: string, delta: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setOpen(false); setComments([]); setDraft(''); setHasMore(false); setError('')
  }, [postId])

  async function load(before: string | null = null) {
    setLoading(true)
    setError('')
    const { data, error: failure } = await supabase.rpc('hax_social_list_comments', {
      p_post: postId, p_before: before, p_limit: 15,
    })
    if (failure) {
      setError(`Não foi possível carregar os comentários: ${failure.message}`)
    } else {
      const rows = (data || []) as Comment[]
      setComments(current => before ? [...current, ...rows.filter(row => !current.some(item => item.comment_id === row.comment_id))] : rows)
      setHasMore(rows.length === 15)
    }
    setLoading(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || busy || loading) return
    setBusy(true); setError('')
    const { error: failure } = await supabase.rpc('hax_social_add_comment', { p_post: postId, p_content: draft.trim() })
    if (failure) {
      setError(failure.message)
    } else {
      setDraft('')
      onCountChange?.(postId, 1)
      await load()
    }
    setBusy(false)
  }

  async function remove(comment: Comment) {
    if (busy || !window.confirm('Apagar este comentário?')) return
    setBusy(true); setError('')
    const { data, error: failure } = await supabase.rpc('hax_social_delete_comment', { p_comment: comment.comment_id })
    if (failure || !data) {
      setError(failure?.message || 'Comentário indisponível.')
    } else {
      setComments(current => current.filter(item => item.comment_id !== comment.comment_id))
      onCountChange?.(postId, -1)
    }
    setBusy(false)
  }

  return <div className="hb-v181-comments">
    <button type="button" className={`hb-v181-comments-toggle ${open ? 'is-open' : ''}`}
      aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next && !comments.length) void load() }}>
      <span aria-hidden="true">▤</span> Comentar{typeof count === 'number' ? ` · ${count}` : ''}
    </button>
    {open && <section className="hb-v181-comments-panel" aria-label="Comentários da publicação">
      <header><strong>Comentários</strong><small>Converse sobre esta publicação</small></header>
      {loading && !comments.length && <p className="hb-v181-comments-hint" role="status">Carregando comentários…</p>}
      {!loading && !comments.length && !error && <p className="hb-v181-comments-hint">Ainda não há comentários. Comece a conversa!</p>}
      <div className="hb-v181-comments-list">
        {comments.map(comment => <article className="hb-v181-comment" key={comment.comment_id}>
          <span className="hb-v181-comment-avatar" aria-hidden="true">{(comment.display_name || 'A').slice(0,1).toUpperCase()}</span>
          <div className="hb-v181-comment-content">
            <div className="hb-v181-comment-meta"><strong>{comment.display_name || 'Aventureiro'}</strong>{comment.username && <small>@{comment.username}</small>}<time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</time></div>
            <p>{comment.content}</p>
            {comment.can_delete && <button type="button" className="hb-v181-comment-delete" disabled={busy} onClick={() => void remove(comment)}>Apagar</button>}
          </div>
        </article>)}
      </div>
      {hasMore && <button type="button" className="hb-v181-comments-more" disabled={loading || busy} onClick={() => void load(comments[comments.length-1]?.created_at || null)}>{loading ? 'Carregando…' : 'Ver comentários anteriores'}</button>}
      {error && <p className="hb-v181-comments-error" role="alert">{error}</p>}
      <form onSubmit={event => void submit(event)} className="hb-v181-comments-form">
        <label htmlFor={`hb-comment-${postId}`}>Escreva um comentário</label>
        <textarea id={`hb-comment-${postId}`} rows={2} maxLength={800} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Compartilhe sua opinião…" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
        <div><small>{draft.length}/800 · Ctrl + Enter para enviar</small><button type="submit" disabled={!draft.trim() || busy || loading}>{busy ? 'Enviando…' : 'Publicar comentário'}</button></div>
      </form>
    </section>}
  </div>
}
