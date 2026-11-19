import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  image_path: string | null
  like_count: number
  liked: boolean
  parent_comment_id?: string | null
}
type CountRow = { post_id: string; comment_count: number }
type Attachment = { file: File; preview: string }
const BUCKET = 'hax-social-comments'
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MIME_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const avatarCache = new Map<string, string>()

/** Uma única fonte de contagens para o Feed, o perfil próprio e os perfis de visitantes. */
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

/** Comentários compactos com fotos e curtidas; reutilizado no Feed e nos perfis. */
export default function SocialPostComments({ postId, count, onCountChange, onOpenProfile }: {
  postId: string
  count?: number
  onCountChange?: (postId: string, delta: number) => void
  onOpenProfile?: (person: { id: string; display_name: string; username?: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<{ parentId: string; name: string; username: string } | null>(null)
  const [photo, setPhoto] = useState<Attachment | null>(null)
  const photoRef = useRef<Attachment | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [busy, setBusy] = useState(false)
  const [liking, setLiking] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [avatars, setAvatars] = useState<Record<string, string>>({})
  const [viewer, setViewer] = useState<string | null>(null)
  const pathsCheckedRef = useRef(new Set<string>())
  const avatarsCheckedRef = useRef(new Set<string>())

  const removeAttachment = () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview)
    photoRef.current = null
    setPhoto(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }
  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview)
  }, [])
  useEffect(() => {
    setOpen(false); setComments([]); setDraft(''); setReplyTo(null); setHasMore(false); setError('')
    setImageUrls({}); setAvatars({}); setViewer(null)
    pathsCheckedRef.current.clear(); avatarsCheckedRef.current.clear()
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview)
    photoRef.current = null; setPhoto(null)
  }, [postId])

  useEffect(() => {
    if (!open || !comments.length) return
    let cancelled = false
    const paths = [...new Set(comments.map(c => c.image_path).filter((p): p is string => Boolean(p)))]
      .filter(path => !pathsCheckedRef.current.has(path))
    paths.forEach(path => pathsCheckedRef.current.add(path))
    if (paths.length) void Promise.all(paths.map(async path => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
      return [path, data?.signedUrl || ''] as const
    })).then(results => {
      if (!cancelled) setImageUrls(current => ({ ...current, ...Object.fromEntries(results) }))
    })
    const ids = [...new Set(comments.map(c => c.author_id))]
      .filter(id => !avatarsCheckedRef.current.has(id))
    ids.forEach(id => avatarsCheckedRef.current.add(id))
    if (ids.length) void Promise.all(ids.map(async id => {
      if (avatarCache.has(id)) return [id, avatarCache.get(id) || ''] as const
      const { data, error: failure } = await supabase.rpc('hax_social_public_profile', { p_user_id: id })
      const url = !failure && data && typeof data === 'object' && !Array.isArray(data) && typeof data.avatar_image === 'string' ? data.avatar_image : ''
      avatarCache.set(id, url)
      return [id, url] as const
    })).then(results => {
      if (!cancelled) setAvatars(current => ({ ...current, ...Object.fromEntries(results) }))
    })
    return () => {
      cancelled = true
      // Uma nova página de comentários pode chegar antes de a mídia responder;
      // permitir nova tentativa evita miniaturas permanentemente vazias.
      paths.forEach(path => pathsCheckedRef.current.delete(path))
      ids.forEach(id => avatarsCheckedRef.current.delete(id))
    }
  }, [open, comments])

  useEffect(() => {
    if (!viewer) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setViewer(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewer])

  async function load(before: string | null = null) {
    setLoading(true); setError('')
    const { data, error: failure } = await supabase.rpc('hax_social_list_comments', {
      p_post: postId, p_before: before, p_limit: 15,
    })
    if (failure) setError(`Não foi possível carregar os comentários: ${failure.message}`)
    else {
      const rows = (data || []) as Comment[]
      setComments(current => before ? [...current, ...rows.filter(row => !current.some(item => item.comment_id === row.comment_id))] : rows)
      setHasMore(rows.length === 15)
    }
    setLoading(false)
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return
    if (!MIME_TYPES[file.type]) { setError('Use uma imagem JPG, PNG, WebP ou GIF.'); return }
    if (file.size > MAX_PHOTO_BYTES) { setError('A imagem deve ter até 8 MB.'); return }
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.preview)
    const next = { file, preview: URL.createObjectURL(file) }
    photoRef.current = next
    setPhoto(next)
    setError('')
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((!draft.trim() && !photoRef.current) || busy || loading) return
    setBusy(true); setError('')
    let uploaded: string | null = null
    try {
      const attachment = photoRef.current
      if (attachment) {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError || !auth.user) throw new Error('Entre na sua conta para enviar imagens.')
        const filePath = `${auth.user.id}/${crypto.randomUUID()}.${MIME_TYPES[attachment.file.type]}`
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, attachment.file, {
          contentType: attachment.file.type, upsert: false,
        })
        if (uploadError) throw new Error(`Erro ao enviar a foto: ${uploadError.message}`)
        uploaded = filePath
      }
      const { error: failure } = await supabase.rpc('hax_social_add_media_reply_v184', {
        p_post: postId, p_content: draft.trim(), p_image_path: uploaded, p_parent: replyTo?.parentId ?? null,
      })
      if (failure) throw new Error(failure.message)
      uploaded = null // pertence ao comentário salvo
      removeAttachment()
      setDraft('')
      setReplyTo(null)
      onCountChange?.(postId, 1)
      await load()
    } catch (failure) {
      if (uploaded) void supabase.storage.from(BUCKET).remove([uploaded])
      setError(failure instanceof Error ? failure.message : 'Não foi possível publicar o comentário.')
    } finally { setBusy(false) }
  }

  async function toggleLike(comment: Comment) {
    if (liking[comment.comment_id]) return
    setLiking(current => ({ ...current, [comment.comment_id]: true }))
    setError('')
    const { data, error: failure } = await supabase.rpc('hax_social_toggle_comment_like', { p_comment: comment.comment_id })
    if (failure) setError(`Não foi possível curtir: ${failure.message}`)
    else setComments(current => current.map(item => {
      if (item.comment_id !== comment.comment_id) return item
      const nextLiked = typeof data === 'boolean' ? data : !item.liked
      return { ...item, liked: nextLiked, like_count: Math.max(0, Number(item.like_count || 0) + (nextLiked === item.liked ? 0 : nextLiked ? 1 : -1)) }
    }))
    setLiking(current => ({ ...current, [comment.comment_id]: false }))
  }

  async function remove(comment: Comment) {
    if (busy || !window.confirm('Apagar este comentário?')) return
    setBusy(true); setError('')
    const { data, error: failure } = await supabase.rpc('hax_social_delete_comment', { p_comment: comment.comment_id })
    if (failure || !data) setError(failure?.message || 'Comentário indisponível.')
    else {
      setComments(current => current.filter(item => item.comment_id !== comment.comment_id))
      onCountChange?.(postId, -1)
      // Só o remetente tem permissão para limpar sua foto no Storage.
      if (comment.image_path) void supabase.storage.from(BUCKET).remove([comment.image_path])
    }
    setBusy(false)
  }

  function reply(comment: Comment) {
    // Respostas a respostas continuam no mesmo fio, mencionando quem respondeu.
    const parentId = comment.parent_comment_id || comment.comment_id
    setReplyTo({ parentId, name: comment.display_name || 'Aventureiro', username: comment.username || '' })
    const mention = comment.username ? `@${comment.username} ` : ''
    setDraft(current => current.startsWith(mention) ? current : `${mention}${current}`)
    window.requestAnimationFrame(() => {
      textRef.current?.focus()
      textRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    })
  }

  function openProfile(comment: Comment) {
    onOpenProfile?.({ id: comment.author_id, display_name: comment.display_name, username: comment.username })
  }

  // Preserva textos e @menções como texto React, sem inserir HTML no DOM.
  function commentText(content: string) {
    return content.split(/(@[\w.-]+)/g).map((piece, index) =>
      /^@[\w.-]+$/.test(piece) ? <span key={index} className="hb-v184-mention">{piece}</span> : piece,
    )
  }

  const loadedIds = new Set(comments.map(comment => comment.comment_id))
  const repliesByParent = new Map<string, Comment[]>()
  for (const comment of comments) {
    if (!comment.parent_comment_id || !loadedIds.has(comment.parent_comment_id)) continue
    const siblings = repliesByParent.get(comment.parent_comment_id) || []
    siblings.push(comment)
    repliesByParent.set(comment.parent_comment_id, siblings)
  }
  for (const siblings of repliesByParent.values()) {
    siblings.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.comment_id.localeCompare(b.comment_id))
  }
  const rootComments = comments.filter(comment => !comment.parent_comment_id || !loadedIds.has(comment.parent_comment_id))

  function renderComment(comment: Comment, isReply = false) {
    return <article className={`hb-v181-comment hb-v182-comment hb-v184-comment ${isReply ? 'hb-v184-is-reply' : ''}`} key={comment.comment_id}>
      {onOpenProfile ? <button type="button" className="hb-v183-comment-profile-trigger hb-v181-comment-avatar" onClick={() => openProfile(comment)} aria-label={`Abrir o perfil de ${comment.display_name || 'Aventureiro'}`}><span aria-hidden="true">{(comment.display_name || 'A').slice(0, 1).toUpperCase()}</span>{avatars[comment.author_id] && <img src={avatars[comment.author_id]} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }}/>}</button> : <span className="hb-v181-comment-avatar" aria-hidden="true">{(comment.display_name || 'A').slice(0, 1).toUpperCase()}{avatars[comment.author_id] && <img src={avatars[comment.author_id]} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }}/>}</span>}
      <div className="hb-v182-comment-main">
        <div className="hb-v181-comment-content">
          <div className="hb-v181-comment-meta">{onOpenProfile ? <button type="button" className="hb-v183-comment-author" onClick={() => openProfile(comment)}><strong>{comment.display_name || 'Aventureiro'}</strong>{comment.username && <small>@{comment.username}</small>}</button> : <><strong>{comment.display_name || 'Aventureiro'}</strong>{comment.username && <small className="hb-v184-mention">@{comment.username}</small>}</>}<time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>
          {comment.parent_comment_id && !loadedIds.has(comment.parent_comment_id) && <small className="hb-v184-reply-context">↳ Resposta a um comentário anterior</small>}
          {comment.content && <p>{commentText(comment.content)}</p>}
          {comment.image_path && (imageUrls[comment.image_path]
            ? <button type="button" className="hb-v182-comment-image" onClick={() => setViewer(imageUrls[comment.image_path!])} aria-label="Ampliar imagem do comentário"><img src={imageUrls[comment.image_path]} loading="lazy" alt={`Imagem compartilhada por ${comment.display_name}`} /></button>
            : <div className="hb-v182-image-loading" role="status">▧ Imagem indisponível ou carregando…</div>)}
        </div>
        <div className="hb-v182-comment-actions">
          <button type="button" className={comment.liked ? 'is-liked' : ''} aria-label={`${comment.liked ? 'Descurtir' : 'Curtir'} comentário de ${comment.display_name || 'Aventureiro'}`} aria-pressed={comment.liked} disabled={Boolean(liking[comment.comment_id])} onClick={() => void toggleLike(comment)}>{comment.liked ? '♥' : '♡'} {Number(comment.like_count) > 0 ? comment.like_count : 'Curtir'}</button>
          <button type="button" onClick={() => reply(comment)}>↳ Responder</button>
          {comment.can_delete && <button type="button" className="hb-v181-comment-delete" disabled={busy} onClick={() => void remove(comment)}>Apagar</button>}
        </div>
      </div>
    </article>
  }

  return <div className="hb-v181-comments hb-v182-comments hb-v184-comments">
    <button type="button" className={`hb-v181-comments-toggle ${open ? 'is-open' : ''}`}
      aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next && !comments.length) void load() }}>
      <span aria-hidden="true">▤</span> Comentar{typeof count === 'number' ? ` · ${count}` : ''}
    </button>
    {open && <section className="hb-v181-comments-panel hb-v182-comments-panel" aria-label="Comentários da publicação">
      <header><strong>Comentários <span className="hb-v182-comment-count">{typeof count === 'number' ? count : ''}</span></strong><small>Participe da conversa</small></header>
      {loading && !comments.length && <p className="hb-v181-comments-hint" role="status">Carregando comentários…</p>}
      {!loading && !comments.length && !error && <p className="hb-v181-comments-hint">Ainda não há comentários. Seja o primeiro!</p>}
      <div className="hb-v181-comments-list hb-v184-comments-list">
        {rootComments.map(comment => <div className="hb-v184-thread" key={comment.comment_id}>
          {renderComment(comment)}
          {!!repliesByParent.get(comment.comment_id)?.length && <div className="hb-v184-thread-replies" aria-label={`Respostas ao comentário de ${comment.display_name || 'Aventureiro'}`}>
            {repliesByParent.get(comment.comment_id)!.map(child => renderComment(child, true))}
          </div>}
        </div>)}
      </div>
      {hasMore && <button type="button" className="hb-v181-comments-more" disabled={loading || busy} onClick={() => void load(comments[comments.length - 1]?.created_at || null)}>{loading ? 'Carregando…' : 'Ver comentários anteriores'}</button>}
      {error && <p className="hb-v181-comments-error" role="alert">{error}</p>}
      <form onSubmit={event => void submit(event)} className="hb-v181-comments-form hb-v182-comments-form">
        <label htmlFor={`hb-comment-${postId}`}>{replyTo ? 'Escreva sua resposta' : 'Escreva um comentário'}</label>
        {replyTo && <div className="hb-v184-reply-banner" role="status"><span>↳ Respondendo a <strong>{replyTo.username ? `@${replyTo.username}` : replyTo.name}</strong></span><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancelar resposta">✕ Cancelar</button></div>}
        <div className="hb-v182-compose-box">
          <textarea ref={textRef} id={`hb-comment-${postId}`} rows={1} maxLength={800} value={draft} onChange={event => setDraft(event.target.value)} placeholder={replyTo ? "Sua resposta…" : "Escreva algo ou compartilhe uma foto…"} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
          {photo && <div className="hb-v182-photo-preview"><img src={photo.preview} alt="Prévia da imagem do comentário" /><button type="button" onClick={removeAttachment} aria-label="Remover foto">×</button><small>{photo.file.name}</small></div>}
          <input type="file" ref={photoInputRef} accept="image/jpeg,image/png,image/webp,image/gif" className="hb-v182-file-input" onChange={event => pickPhoto(event.target.files?.[0])} aria-label="Selecionar imagem para comentário" />
          <div className="hb-v182-compose-toolbar"><button type="button" className="hb-v182-attach-button" disabled={busy || loading} onClick={() => photoInputRef.current?.click()}>▧ <span>{photo ? 'Trocar foto' : 'Foto'}</span></button><small>{draft.length}/800</small><button type="submit" className="hb-v182-send-button" disabled={(!draft.trim() && !photo) || busy || loading}>{busy ? 'Enviando…' : replyTo ? 'Responder ↗' : 'Comentar ↗'}</button></div>
        </div>
      </form>
    </section>}
    {viewer && <div className="hb-v182-lightbox" role="dialog" aria-modal="true" aria-label="Imagem ampliada do comentário" onMouseDown={event => { if (event.target === event.currentTarget) setViewer(null) }}><button type="button" onClick={() => setViewer(null)} aria-label="Fechar imagem">×</button><img src={viewer} alt="Imagem ampliada do comentário" /></div>}
  </div>
}
