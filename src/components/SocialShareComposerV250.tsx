import { useEffect, useRef, useState, type FormEvent } from 'react'
import './SocialShareComposerV250.css'

export type ShareIdentityV250 = { name: string; username?: string; avatar?: string }
export type SharePreviewV250 = ShareIdentityV250 & { content: string }

type Props = {
  mode: 'repost' | 'quote'
  author: ShareIdentityV250
  original: SharePreviewV250
  onClose: () => void
  onSubmit: (message: string) => Promise<void>
}

function IdentityAvatar({ identity }: { identity: ShareIdentityV250 }) {
  const [failed, setFailed] = useState(false)
  return <span className="hb-v250-avatar" aria-hidden="true">
    {identity.avatar && !failed ? <img src={identity.avatar} alt="" onError={() => setFailed(true)} /> : (identity.name.trim().slice(0,1).toLocaleUpperCase('pt-BR') || '✦')}
  </span>
}

export default function SocialShareComposerV250({ mode, author, original, onClose, onSubmit }: Props) {
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onClose() }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [onClose, pending])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || (mode === 'quote' && !message.trim())) return
    setError('')
    setPending(true)
    try { await onSubmit(message.trim()); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível publicar. Tente novamente.') }
    finally { setPending(false) }
  }

  return <div className="hb-v250-share-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!pending)onClose()}}>
    <form role="dialog" aria-modal="true" aria-label={mode==='repost'?'Republicar publicação':'Citar publicação'} className="hb-v250-share-dialog" onSubmit={event=>void submit(event)}>
      <header className="hb-v250-share-title"><div><small>HÄXBAG SOCIAL</small><h3>{mode==='repost'?'Republicar publicação':'Citar publicação'}</h3><p>{mode==='repost'?'Adicione sua mensagem ou compartilhe sem comentário.':'Escreva sua opinião sobre a publicação original.'}</p></div><button type="button" className="hb-v250-close" onClick={onClose} disabled={pending} aria-label="Fechar">×</button></header>
      <div className="hb-v250-share-author"><IdentityAvatar identity={author}/><div><strong>{author.name}</strong>{author.username&&<small>@{author.username.replace(/^@/,'')}</small>}</div></div>
      <label className="hb-v250-share-text-label" htmlFor="hb-v250-share-message">Sua mensagem {mode==='repost'?'(opcional)':'(obrigatória)'}</label>
      <textarea ref={inputRef} id="hb-v250-share-message" rows={4} maxLength={3000} value={message} onChange={event=>setMessage(event.target.value)} placeholder={mode==='repost'?'Diga algo sobre esta publicação…':'O que você gostaria de dizer sobre esta publicação?'} required={mode==='quote'} />
      <div className="hb-v250-share-counter">{message.length}/3000</div>
      <section className="hb-v250-share-original" aria-label="Prévia da publicação original">
        <div className="hb-v250-share-original-author"><IdentityAvatar identity={original}/><div><strong>{original.name}</strong>{original.username&&<small>@{original.username.replace(/^@/,'')}</small>}</div></div>
        <p>{original.content.length>500?`${original.content.slice(0,500).trimEnd()}…`:original.content}</p>
      </section>
      {error&&<p className="hb-v250-share-error" role="alert">{error}</p>}
      <footer><span>O autor original será creditado.</span><div><button type="button" className="hb-v250-cancel" onClick={onClose} disabled={pending}>Cancelar</button><button type="submit" className="hb-v250-submit" disabled={pending||(mode==='quote'&&!message.trim())}>{pending?'Publicando…':mode==='repost'?'Republicar':'Publicar citação'}</button></div></footer>
    </form>
  </div>
}
