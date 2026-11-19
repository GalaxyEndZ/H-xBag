import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import './SocialReferralPanel.css'

type ReferralStats = { token?: string; count?: number }

/** A mesma origem de dados do Embaixador no perfil: links pessoais e de campanha somam juntos. */
export default function SocialReferralPanel({active}:{active:boolean}) {
  const [token,setToken] = useState('')
  const [count,setCount] = useState(0)
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    const {data,error:failure} = await supabase.rpc('hax_referral_my_stats')
    setLoading(false)
    if (failure) {setError('Não foi possível carregar seus convites. Verifique a migração V167.');return}
    const result = (data || {}) as ReferralStats
    setCount(Math.max(0,Number(result.count)||0))
    setToken(String(result.token||''))
    setError('')
  },[])
  useEffect(()=>{if(active)void refresh()},[active,refresh])
  const toUrl = (value:string) => `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(value)}`
  const url = token ? toUrl(token) : ''
  async function ensureLink() {
    if(token)return toUrl(token)
    setBusy(true)
    setError('')
    const {data,error:failure} = await supabase.rpc('hax_referral_my_link')
    setBusy(false)
    if(failure || !data){setError('Não foi possível gerar seu link pessoal. Confira a migração V167.');return ''}
    const nextToken=String(data)
    setToken(nextToken)
    return toUrl(nextToken)
  }
  async function copyLink() {
    setMessage('')
    const link = await ensureLink()
    if(!link)return
    try {await navigator.clipboard.writeText(link);setMessage('Link de convite social copiado!')}
    catch {setMessage(`Selecione e copie o link: ${link}`)}
  }
  async function shareLink() {
    setMessage('')
    const link = await ensureLink()
    if(!link)return
    window.open(`https://wa.me/?text=${encodeURIComponent(`Venha conhecer o HäxBag e criar suas aventuras comigo! ${link}`)}`,'_blank','noopener,noreferrer')
  }
  return <section className="hb-referral-social" aria-label="Seu convite social">
    <header className="hb-referral-social-head"><div className="hb-referral-social-icon" aria-hidden="true">✧</div><div><span className="hb-referral-social-eyebrow">CONVITE SOCIAL · EMBAIXADOR</span><h3>Chame seus amigos para o HäxBag</h3><p>Compartilhe seu link exclusivo. Cada pessoa nova que se cadastrar e confirmar a conta aumenta o nível da sua insígnia.</p></div></header>
    <div className="hb-referral-social-steps" aria-label="Como funcionam as indicações"><span>⌁ Envie o link</span><b>→</b><span>♧ Nova conta</span><b>→</b><span>✓ Cadastro confirmado</span><b>→</b><span>✧ +1 nível</span></div>
    <div className="hb-referral-social-card">
      <button type="button" className="hb-referral-social-whatsapp" disabled={busy} onClick={()=>void shareLink()}>◉ Compartilhar no WhatsApp</button>
      <label htmlFor="hb-referral-social-url">Seu link de convite social</label>
      <div className="hb-referral-social-copy"><input id="hb-referral-social-url" type="text" readOnly value={url||'Clique em Gerar link para começar'} onFocus={event=>event.currentTarget.select()} /><button disabled={busy} type="button" onClick={()=>void (url?copyLink():ensureLink())}>{busy?'Aguarde…':url?'Copiar':'Gerar link'}</button></div>
      <div className="hb-referral-social-count"><div><strong>{loading?'…':count}</strong><span>{count===1?'pessoa indicada':'pessoas indicadas'}</span></div><div><strong>{count>0?`Nível ${count}`:'Nível 0'}</strong><span>Insígnia Embaixador</span></div></div>
      <div className="hb-referral-social-progress" role="progressbar" aria-label="Indicações no grupo atual de cinco" aria-valuemin={0} aria-valuemax={5} aria-valuenow={count%5}><span style={{width:`${(count%5)*20}%`}}/></div>
      <small>{count>0?`Chamou ${count} ${count===1?'pessoa':'pessoas'} para o HäxBag.`:'Sua primeira indicação confirmada desbloqueia a insígnia Embaixador.'}</small>
      {error&&<p className="hb-referral-social-error" role="alert">{error}</p>}
      {message&&<p className="hb-referral-social-message" role="status">{message}</p>}
    </div>
    <div className="hb-referral-social-note"><strong>⚑ Convites de campanha também contam</strong><p>Se alguém criar uma nova conta pelo link de campanha que você gerou, a indicação será creditada à mesma insígnia. Cada novo usuário conta apenas uma vez. Entrar com uma conta já existente não gera nível.</p></div>
    <button type="button" className="hb-referral-social-refresh" disabled={loading} onClick={()=>void refresh()}>↻ Atualizar progresso</button>
  </section>
}
