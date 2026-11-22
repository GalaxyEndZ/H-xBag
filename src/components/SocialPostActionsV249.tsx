import type { ReactNode } from 'react'
import './SocialPostActionsV249.css'

type Props = {
  liked: boolean; likeCount: number; onLike: () => void
  comments: ReactNode
  saved: boolean; onSave: () => void
  canShare: boolean; onRepost: () => void; onQuote: () => void
  canCopy: boolean; onCopy: () => void; copied?: boolean
  canEdit: boolean; onEdit: () => void
  canPin: boolean; pinned: boolean; onPin: () => void
  canDelete: boolean; onDelete: () => void
  canReport: boolean; onReport: () => void
  canMute: boolean; onMute: () => void
  busy?: boolean
}

// Uma barra de ações para as duas origens de publicações do feed.
// As permissões são verificadas novamente nas operações do banco de dados.
export default function SocialPostActionsV249({
  liked,likeCount,onLike,comments,saved,onSave,canShare,onRepost,onQuote,
  canCopy,onCopy,copied,canEdit,onEdit,canPin,pinned,onPin,
  canDelete,onDelete,canReport,onReport,canMute,onMute,busy=false,
}:Props) {
  return <div className="hb-v231-post-actions hb-v249-post-actions" aria-label="Ações da publicação">
    <button type="button" disabled={busy} aria-pressed={liked} className={liked?'liked':''} onClick={onLike}>
      {liked?'♥':'♡'} {likeCount} {likeCount===1?'curtida':'curtidas'}
    </button>
    {comments}
    <button type="button" disabled={busy} aria-pressed={saved} onClick={onSave}>{saved?'▣ Salvo':'▤ Salvar'}</button>
    {canShare&&<>
      <button type="button" disabled={busy} onClick={onRepost}>↗ Republicar</button>
      <button type="button" disabled={busy} onClick={onQuote}>❝ Citar</button>
    </>}
    {canCopy&&<button type="button" disabled={busy} onClick={onCopy}>{copied?'✓ Copiado':'⧉ Copiar texto'}</button>}
    {canEdit&&<button type="button" disabled={busy} onClick={onEdit}>Editar</button>}
    {canPin&&<button type="button" disabled={busy} aria-pressed={pinned} onClick={onPin}>{pinned?'Desafixar':'Fixar'}</button>}
    {canDelete&&<button type="button" disabled={busy} className="hb-v249-danger" onClick={onDelete}>Excluir</button>}
    {canMute&&<button type="button" disabled={busy} onClick={onMute}>Silenciar autor</button>}
    {canReport&&<button type="button" disabled={busy} onClick={onReport}>⚑ Denunciar</button>}
  </div>
}
