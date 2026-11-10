import { useState, type FormEvent } from 'react'
import { supabase } from './supabase'
import './Auth.css'

type AuthMode = 'login' | 'signup' | 'recovery'

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const changeMode = (next: AuthMode) => {
    setMode(next)
    setMessage('')
    setShowPassword(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setMessage('')
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (mode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessageType('success')
        setMessage('Se o endereço estiver cadastrado, você receberá um e-mail com instruções para redefinir sua senha.')
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        setMessageType('success')
        setMessage(data.session
          ? 'Conta criada! Preparando sua aventura…'
          : 'Cadastro enviado! Verifique seu e-mail para confirmar a conta antes de entrar.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (error) throw error
      }
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="auth-layout">
        <aside className="auth-story" aria-label="Sobre o HäxBag">
          <div className="auth-story-top"><span className="auth-mark">H</span><span className="auth-wordmark">HäxBag<span className="auth-wordmark-dot">.</span></span></div>
          <div className="auth-story-body">
            <span className="auth-eyebrow"><span className="auth-eyebrow-line" /> SEU UNIVERSO DE RPG</span>
            <h1>Suas histórias<br />merecem um <em>lugar.</em></h1>
            <p>Personagens, campanhas e inventários reunidos em um espaço feito para quem vive cada aventura.</p>
            <div className="auth-story-features">
              <div><span className="auth-feature-icon">✦</span><span>Campanhas compartilhadas</span></div>
              <div><span className="auth-feature-icon">◇</span><span>Fichas e personagens</span></div>
              <div><span className="auth-feature-icon">⌘</span><span>Inventários organizados</span></div>
            </div>
          </div>
          <div className="auth-story-bottom"><span>ORGANIZE. EXPLORE. CRIE.</span><span>✧</span></div>
        </aside>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-mobile-brand"><span className="auth-mark">H</span><strong>HäxBag<span className="auth-wordmark-dot">.</span></strong></div>
          <div className="auth-card-top"><span className="auth-card-kicker">{mode === 'signup' ? 'COMECE SUA JORNADA' : mode === 'recovery' ? 'ACESSO À CONTA' : 'BEM-VINDO AO HÄXBAG'}</span><span className="auth-card-sparkle" aria-hidden="true">✧</span></div>
          <div className="auth-heading">
            <h2 id="auth-title">{mode === 'signup' ? 'Crie sua conta' : mode === 'recovery' ? 'Recuperar senha' : 'Bem-vindo de volta'}</h2>
            <p>{mode === 'signup' ? 'Um novo capítulo começa aqui. Crie seu acesso para continuar.' : mode === 'recovery' ? 'Informe seu e-mail para receber as instruções de recuperação.' : 'Entre na sua conta para continuar de onde sua aventura parou.'}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && <label htmlFor="auth-name">Nome de exibição<input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Como devemos chamar você?" minLength={2} maxLength={60} autoComplete="nickname" required /></label>}
            <label htmlFor="auth-email">E-mail<input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" autoComplete="email" required /></label>
            {mode !== 'recovery' && <label htmlFor="auth-password">Senha
              <span className="auth-password-wrap"><input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Mínimo de 8 caracteres' : 'Digite sua senha'} minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span>
            </label>}
            {mode === 'login' && <div className="auth-forgot"><button type="button" onClick={() => changeMode('recovery')}>Esqueceu sua senha?</button></div>}
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Aguarde…' : mode === 'signup' ? 'Criar minha conta' : mode === 'recovery' ? 'Enviar instruções' : 'Entrar na minha conta'} <span aria-hidden="true">→</span></button>
          </form>
          {message && <p className={`auth-message auth-message-${messageType}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}
          <div className="auth-switch">{mode === 'login' ? <>Ainda não tem uma conta? <button type="button" onClick={() => changeMode('signup')}>Criar conta</button></> : mode === 'signup' ? <>Já tem uma conta? <button type="button" onClick={() => changeMode('login')}>Fazer login</button></> : <button type="button" onClick={() => changeMode('login')}>← Voltar para o login</button>}</div>
          <div className="auth-card-footer">HäxBag <span>·</span> Seu inventário, sua aventura.</div>
        </section>
      </div>
    </main>
  )
}
