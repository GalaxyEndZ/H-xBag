import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

type DirectInvite = {
  id: string
  campaign_name: string
  sender_name: string
  created_at: string
}

/** Convites para campanhas pertencem à área Campanhas, não à rede social. */
export default function CampaignDirectInvites() {
  const [invites, setInvites] = useState<DirectInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase.rpc('hb_list_direct_invites')
    setLoading(false)
    if (fetchError) {
      setError(`Não foi possível carregar os convites: ${fetchError.message}`)
      return
    }
    setError('')
    setInvites((data ?? []) as DirectInvite[])
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const answer = async (invite: DirectInvite, accept: boolean) => {
    setBusy(invite.id)
    setError('')
    setNotice('')
    const { error: answerError } = await supabase.rpc('hb_answer_direct_invite', {
      p_invite: invite.id,
      p_accept: accept,
    })
    setBusy(null)
    if (answerError) {
      setError(`Não foi possível responder ao convite: ${answerError.message}`)
      return
    }
    setInvites(previous => previous.filter(item => item.id !== invite.id))
    if (accept) {
      // Recarregar a lista de campanhas e as permissões concedidas pelo convite.
      window.location.reload()
    } else {
      setNotice('Convite recusado.')
    }
  }

  return (
    <section className="hb-panel hb-campaign-direct-invites" aria-label="Convites recebidos para campanhas">
      <div className="hb-panel-heading">
        <div><span className="hb-kicker">✉ CONVITES RECEBIDOS</span>
          <h3>Convites de campanhas</h3>
          <p>Convites para participar de novas campanhas ficam aqui, separados do Social.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading || !!busy}>↻ Atualizar</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p>Carregando convites…</p> : invites.length ? (
        <div className="hb-campaign-invite-list">
          {invites.map(invite => <article key={invite.id} className="hb-campaign-invite-item">
            <div><strong>{invite.campaign_name}</strong>
              <small>Enviado por {invite.sender_name} · {new Date(invite.created_at).toLocaleDateString('pt-BR')}</small>
            </div>
            <div className="hb-campaign-invite-actions">
              <button type="button" className="primary-button" disabled={!!busy} onClick={() => void answer(invite, true)}>Aceitar</button>
              <button type="button" className="secondary-button" disabled={!!busy} onClick={() => void answer(invite, false)}>Recusar</button>
            </div>
          </article>)}
        </div>
      ) : <p className="hb-minimal-empty">Nenhum convite de campanha pendente.</p>}
    </section>
  )
}
