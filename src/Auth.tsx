import { useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import { isHaxbagMobileNative } from './mobile/runtime'
import './Auth.css'

type AuthMode = 'login' | 'signup' | 'recover'
type Feedback = { kind: 'success' | 'error'; text: string } | null

const passwordRules = [
  { label: '8 caracteres', check: (value: string) => value.length >= 8 },
  { label: 'Letra e número', check: (value: string) => /[a-zA-ZÀ-ÿ]/.test(value) && /\d/.test(value) },
  { label: 'Caractere especial', check: (value: string) => /[^\p{L}\p{N}\s]/u.test(value) },
]

function readableAuthError(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos. Confira seus dados e tente novamente.'
  if (/email not confirmed/i.test(text)) return 'Confirme seu e-mail antes de entrar na sua conta.'
  if (/user already registered|already been registered/i.test(text)) return 'Já existe uma conta com este e-mail. Tente entrar ou recuperar sua senha.'
  if (/password should be at least/i.test(text)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (/rate limit|too many requests/i.test(text)) return 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.'
  if (/duplicate|unique/i.test(text)) return 'Esse nome de usuário já está em uso. Escolha outro.'
  if (/análise da administração|validar este cadastro|security review/i.test(text)) return 'Por segurança, este cadastro precisa de análise da administração.'
  return text
}

type FieldIconName = 'mail' | 'lock' | 'user' | 'handle'

function FieldIcon({ name }: { name: FieldIconName }) {
  const shared = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  return (
    <svg {...shared}>
      {name === 'mail' && <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4.5 7 7.5 6 7.5-6" /></>}
      {name === 'lock' && <><rect x="5" y="10" width="14" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>}
      {name === 'user' && <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>}
      {name === 'handle' && <><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5" /></>}
    </svg>
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {visible ? <><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="m3 3 18 18" /><path d="M10.6 6.1A11 11 0 0 1 12 6c6.1 0 9.5 6 9.5 6a15.8 15.8 0 0 1-3.1 3.6M7.2 7.2A15.3 15.3 0 0 0 2.5 12s3.4 6 9.5 6c1.4 0 2.7-.3 3.8-.8" /><path d="M10 10a3 3 0 0 0 4 4" /></>}
    </svg>
  )
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [capsLock, setCapsLock] = useState(false)

  const inviteParams = new URLSearchParams(window.location.search)
  const personalInvite = inviteParams.get('ref')
  const campaignInvite = inviteParams.get('invite')
  const hasReferral = Boolean(personalInvite || campaignInvite)
  const isSignUp = mode === 'signup'
  const score = passwordRules.filter(rule => rule.check(password)).length
  const passwordMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  function switchMode(next: AuthMode) {
    if (loading || mode === next) return
    setMode(next)
    setFeedback(null)
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmation(false)
    setCapsLock(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setFeedback(null)

    if (isSignUp && password !== confirmPassword) {
      setFeedback({ kind: 'error', text: 'As senhas não coincidem. Confira a confirmação.' })
      return
    }
    if (password.length < 8) {
      setFeedback({ kind: 'error', text: 'A senha precisa ter pelo menos 8 caracteres.' })
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const cleanName = name.trim().replace(/\s+/g, ' ')
        if (cleanName.length < 2 || cleanName.length > 60) {
          setFeedback({ kind: 'error', text: 'Escolha um nome entre 2 e 60 caracteres.' })
          return
        }
        const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
        if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
          setFeedback({ kind: 'error', text: 'O nome de usuário deve ter de 3 a 24 caracteres: letras, números ou _.' })
          return
        }
        const { data: available, error: checkError } = await supabase.rpc('is_username_available', { candidate: cleanUsername })
        if (checkError) throw checkError
        if (!available) {
          setFeedback({ kind: 'error', text: 'Esse nome de usuário já está em uso. Escolha outro.' })
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: cleanName,
              username: cleanUsername,
              hax_referral_token: personalInvite || undefined,
              hax_campaign_invite_token: campaignInvite || undefined,
            },
          },
        })
        if (error) throw error
        setFeedback({
          kind: 'success',
          text: data.session
            ? 'Conta criada! Sua aventura no HäxBag já pode começar.'
            : 'Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.',
        })
        if (!data.session) {
          setPassword('')
          setConfirmPassword('')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
    } catch (error) {
      setFeedback({ kind: 'error', text: readableAuthError(error) })
    } finally {
      setLoading(false)
    }
  }

  async function handleRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setFeedback({ kind: 'error', text: 'Informe seu e-mail para receber o link de recuperação.' })
      return
    }
    setLoading(true)
    setFeedback(null)
    try {
      // Links de recuperação continuam no site HTTPS; nunca usar o localhost do WebView.
      const recoverySite = String(import.meta.env.VITE_HAXBAG_PUBLIC_URL || '').trim()
      const mobileRecoveryUrl = isHaxbagMobileNative() && recoverySite.startsWith('https://') ? recoverySite : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail,
        mobileRecoveryUrl ? { redirectTo: mobileRecoveryUrl } : undefined)
      if (error) throw error
      setFeedback({ kind: 'success', text: 'Se esse e-mail estiver cadastrado, você receberá um link de recuperação. Confira também a pasta de spam.' })
    } catch (error) {
      setFeedback({ kind: 'error', text: readableAuthError(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page" data-mode={mode}>
      <div className="auth-ambient auth-ambient-one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-two" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-three" aria-hidden="true" />
      <div className="auth-shell">
        <section className="auth-showcase" aria-label="Conheça o HäxBag">
          <div className="auth-showcase-top">
            <div className="auth-brand"><span className="auth-brand-mark"><img src="/haxbag-symbol.png" alt="" /></span><span>HäxBag<span className="auth-brand-dot">.</span></span></div>
            <span className="auth-portal-label"><i aria-hidden="true" /> O UNIVERSO COMEÇA AQUI <span aria-hidden="true">✦</span></span>
          </div>

          <div className="auth-showcase-main">
            <div className="auth-art" aria-hidden="true">
              <div className="auth-art-halo auth-art-halo-outer" />
              <div className="auth-art-halo auth-art-halo-inner" />
              <div className="auth-art-halo auth-art-halo-etch" />
              <div className="auth-art-spark auth-art-spark-a" />
              <div className="auth-art-spark auth-art-spark-b" />
              <div className="auth-art-spark auth-art-spark-c" />
              <div className="auth-art-rune auth-art-rune-north">✧</div>
              <div className="auth-art-rune auth-art-rune-east">✦</div>
              <div className="auth-art-rune auth-art-rune-south">✧</div>
              <div className="auth-art-rune auth-art-rune-west">✦</div>
              <div className="auth-art-symbol"><img src="/haxbag-symbol.png" alt="" /></div>
            </div>
            <div className="auth-showcase-copy">
              <div className="auth-chapter-pill"><span className="auth-chapter-pill-icon" aria-hidden="true">✦</span> CRÔNICAS SEM LIMITES <span className="auth-chapter-divider" aria-hidden="true" /> DESDE O PRIMEIRO CAPÍTULO</div>
              <span className="auth-overline"><span className="auth-overline-stroke" /> O PORTAL DA SUA AVENTURA</span>
              <h1>Seu mundo.<br /><em>Suas histórias.</em></h1>
              <p>Personagens que ganham vida, campanhas que viram lendas e uma comunidade para chamar de sua.</p>
            </div>
          </div>

          <div className="auth-showcase-bottom">
            <div className="auth-showcase-features" aria-label="Recursos do HäxBag">
              <div><span aria-hidden="true">◇</span><strong>Campanhas</strong><small>Jogue em grupo</small></div>
              <div><span aria-hidden="true">✦</span><strong>Personagens</strong><small>Conte sua história</small></div>
              <div><span aria-hidden="true">⌘</span><strong>Comunidade</strong><small>Compartilhe aventuras</small></div>
            </div>
            <div className="auth-showcase-footer"><span>IMAGINE <b>·</b> CRIE <b>·</b> EXPLORE</span><span>✧ <small>O PRÓXIMO CAPÍTULO É SEU</small></span></div>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-mobile-brand"><img src="/haxbag-symbol.png" alt="" /><span>HäxBag<span>.</span></span></div>
          <div className="auth-panel-head">
            <div className="auth-panel-eyebrow"><span className="auth-section-label"><span className="auth-section-spark" aria-hidden="true">✦</span> ÁREA DO AVENTUREIRO</span><span className="auth-panel-seal" aria-hidden="true">✧ ACESSO AO PORTAL</span></div>
            {mode !== 'recover' ? (
              <div className="auth-tabs" role="group" aria-label="Escolha como acessar">
                <button type="button" className={mode === 'login' ? 'is-active' : ''} aria-pressed={mode === 'login'} disabled={loading} onClick={() => switchMode('login')}>Entrar</button>
                <button type="button" className={mode === 'signup' ? 'is-active' : ''} aria-pressed={mode === 'signup'} disabled={loading} onClick={() => switchMode('signup')}>Criar conta</button>
              </div>
            ) : <button type="button" className="auth-back-button" disabled={loading} onClick={() => switchMode('login')}>← Voltar ao login</button>}
            <div className="auth-heading" key={mode}>
              <span className="auth-heading-chapter">{mode === 'recover' ? 'RESTAURAR ACESSO' : isSignUp ? 'COMECE SUA HISTÓRIA' : 'SEU ACESSO AO HÄXBAG'}</span>
              <h2 id="auth-title">{mode === 'recover' ? 'Recupere seu acesso.' : isSignUp ? 'Comece sua jornada.' : 'O portal está aberto.'}</h2>
              <p>{mode === 'recover' ? 'Informe seu e-mail para receber as instruções de recuperação.' : isSignUp ? 'Crie sua identidade e abra as portas para novas aventuras.' : 'Entre com sua conta ou crie uma para começar sua história no HäxBag.'}</p>
            </div>
          </div>

          {hasReferral && isSignUp && <div className="auth-referral-note" role="status"><span aria-hidden="true">✧</span><div><strong>Você tem um convite!</strong><span>{campaignInvite ? 'Seu convite para uma campanha será mantido durante o cadastro.' : 'Alguém convidou você para fazer parte do HäxBag.'}</span></div></div>}

          {mode === 'recover' ? (
            <form className="auth-form auth-form-animated" onSubmit={handleRecovery} aria-busy={loading}>
              <div className="auth-field">
                <label htmlFor="auth-email">E-mail da sua conta</label>
                <div className="auth-input-wrap"><span className="auth-field-icon"><FieldIcon name="mail" /></span><input id="auth-email" type="email" name="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" autoComplete="email" required autoFocus /></div>
              </div>
              <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? 'Enviando…' : 'Enviar link de recuperação'}</span><span className="auth-button-arrow" aria-hidden="true">{loading ? <span className="auth-button-spinner" /> : '↗'}</span></button>
            </form>
          ) : (
            <form className="auth-form auth-form-animated" onSubmit={handleSubmit} aria-busy={loading}>
              {isSignUp && <div className="auth-fields-pair">
                <div className="auth-field"><label htmlFor="auth-name">Nome de exibição</label><div className="auth-input-wrap"><span className="auth-field-icon"><FieldIcon name="user" /></span><input id="auth-name" type="text" name="name" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" minLength={2} maxLength={60} autoComplete="nickname" required /></div></div>
                <div className="auth-field"><label htmlFor="auth-username">Nome de usuário</label><div className="auth-input-wrap auth-input-username"><span className="auth-field-icon"><FieldIcon name="handle" /></span><input id="auth-username" type="text" name="username" value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="aventureiro" minLength={3} maxLength={24} autoComplete="username" aria-describedby="auth-username-help" required /></div><small id="auth-username-help" className="auth-field-help">3 a 24 caracteres · letras, números e _</small></div>
              </div>}
              <div className="auth-field">
                <label htmlFor="auth-email">E-mail</label>
                <div className="auth-input-wrap"><span className="auth-field-icon"><FieldIcon name="mail" /></span><input id="auth-email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" autoComplete="email" required /></div>
              </div>
              <div className="auth-field">
                <div className="auth-field-label-row"><label htmlFor="auth-password">Senha</label>{!isSignUp && <button className="auth-forgot" type="button" disabled={loading} onClick={() => switchMode('recover')}>Esqueci minha senha</button>}</div>
                <div className="auth-input-wrap auth-input-password"><span className="auth-field-icon"><FieldIcon name="lock" /></span><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => setCapsLock(event.getModifierState('CapsLock'))} onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} placeholder={isSignUp ? 'Crie uma senha segura' : 'Digite sua senha'} minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} required /><button type="button" className="auth-reveal" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}><EyeIcon visible={showPassword} /></button></div>
                {capsLock && <small className="auth-caps-warning" role="status"><span aria-hidden="true">⇧</span> Caps Lock está ativado.</small>}
                {isSignUp && <div className="auth-password-advice" aria-live="polite"><div className="auth-password-meter" aria-hidden="true">{[1, 2, 3].map(tier => <span key={tier} className={password.length > 0 && score >= tier ? `is-filled is-tier-${score}` : ''} />)}</div><div className="auth-password-rules">{passwordRules.map(rule => <span key={rule.label} className={password.length > 0 && rule.check(password) ? 'is-met' : ''}>{password.length > 0 && rule.check(password) ? '✓' : '○'} {rule.label}</span>)}</div></div>}
              </div>
              {isSignUp && <div className="auth-field"><label htmlFor="auth-confirm">Confirme a senha</label><div className={`auth-input-wrap auth-input-password${passwordMismatch ? ' is-invalid' : ''}${passwordMatch ? ' is-valid' : ''}`}><span className="auth-field-icon"><FieldIcon name="lock" /></span><input id="auth-confirm" type={showConfirmation ? 'text' : 'password'} name="confirmPassword" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onKeyDown={event => setCapsLock(event.getModifierState('CapsLock'))} onKeyUp={event => setCapsLock(event.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} placeholder="Repita sua senha" minLength={8} autoComplete="new-password" aria-invalid={passwordMismatch} aria-describedby="auth-confirm-help" required /><button type="button" className="auth-reveal" onClick={() => setShowConfirmation(!showConfirmation)} aria-label={showConfirmation ? 'Ocultar confirmação' : 'Mostrar confirmação'} title={showConfirmation ? 'Ocultar confirmação' : 'Mostrar confirmação'}><EyeIcon visible={showConfirmation} /></button></div><small id="auth-confirm-help" className={`auth-field-help${passwordMismatch ? ' is-error' : ''}${passwordMatch ? ' is-success' : ''}`}>{passwordMismatch ? 'As senhas precisam ser iguais.' : passwordMatch ? '✓ Senhas iguais.' : 'Digite a mesma senha novamente.'}</small></div>}
              <button className="auth-submit" type="submit" disabled={loading || (isSignUp && passwordMismatch)}><span>{loading ? 'Aguarde…' : isSignUp ? 'Criar minha conta' : 'Entrar no HäxBag'}</span><span className="auth-button-arrow" aria-hidden="true">{loading ? <span className="auth-button-spinner" /> : '↗'}</span></button>
            </form>
          )}

          {feedback && <div className={`auth-message auth-message-${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}><span aria-hidden="true">{feedback.kind === 'success' ? '✓' : '!'}</span><p>{feedback.text}</p></div>}
          <div className="auth-panel-bottom">
            <div className="auth-bottom-rule" aria-hidden="true"><span>✧</span></div>
            {mode === 'recover' ? <p>Já recuperou o acesso? <button type="button" onClick={() => switchMode('login')} disabled={loading}>Voltar para entrar</button></p> : <p>{isSignUp ? 'Já faz parte dessa história?' : 'Sua aventura começa por aqui.'} <button type="button" onClick={() => switchMode(isSignUp ? 'login' : 'signup')} disabled={loading}>{isSignUp ? 'Entrar na conta' : 'Criar uma conta gratuita'}</button></p>}
            <div className="auth-panel-footer"><span aria-hidden="true">✧</span> Um espaço para suas histórias, personagens e aventuras.</div>
          </div>
        </section>
      </div>
    </main>
  )
}
