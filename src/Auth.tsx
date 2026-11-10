
import { useState } from 'react'
import { supabase } from './supabase'
import './Auth.css'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      if (isSignUp) {
        const cleanName = name.trim().replace(/\s+/g, ' ')
        if (cleanName.length < 2 || cleanName.length > 60) {
          setMessage('Escolha um nome entre 2 e 60 caracteres.')
          return
        }
        const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
        if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
          setMessage('O nome de usuário deve ter de 3 a 24 caracteres: letras, números ou _.')
          return
        }
        const { data: available, error: checkError } = await supabase.rpc('is_username_available', { candidate: cleanUsername })
        if (checkError) throw checkError
        if (!available) { setMessage('Esse nome de usuário já está em uso.'); return }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: cleanName, username: cleanUsername },
          },
        })

        if (error) {
          if (/nome.*uso|display.name|duplicate|unique/i.test(error.message)) throw new Error('Esse nome de usuário já está em uso. Escolha outro.')
          throw error
        }

        if (data.session) {
          setMessage('Conta criada! Você já pode acessar a HäxBag.')
        } else {
          setMessage(
            'Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.'
          )
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a operação.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setMessage('Informe seu e-mail para receber o link de recuperação.')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) throw error
      setMessage('Se o e-mail estiver cadastrado, você receberá um link de recuperação.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-showcase" aria-label="Conheça o HäxBag">
          <div className="auth-showcase-brand"><img src="/haxbag-symbol.png" alt="" /><span>HäxBag<span className="auth-brand-dot">.</span></span></div>
          <div className="auth-showcase-content">
            <span className="auth-eyebrow"><span className="auth-eyebrow-line" /> SEU UNIVERSO DE RPG</span>
            <h1>Suas histórias<br />merecem um <em>lugar.</em></h1>
            <p>Personagens, campanhas e inventários reunidos em um espaço feito para quem vive cada aventura.</p>
            <div className="auth-showcase-features">
              <div><span className="auth-feature-icon">✦</span>Campanhas compartilhadas</div>
              <div><span className="auth-feature-icon">◇</span>Fichas e personagens</div>
              <div><span className="auth-feature-icon">⌘</span>Inventários organizados</div>
            </div>
          </div>
          <div className="auth-showcase-footer"><span>ORGANIZE. EXPLORE. CRIE.</span><span aria-hidden="true">✧</span></div>
        </section>
        <section className="auth-panel">
          <div className="auth-panel-top"><img src="/haxbag-symbol.png" alt="" /><span>HäxBag.</span></div>
          <div className="auth-heading">
            <div className="auth-heading-kicker"><span className="auth-eyebrow">{isSignUp ? 'COMEÇE SUA AVENTURA' : 'BEM-VINDO AO HÄXBAG'}</span><span aria-hidden="true">✧</span></div>
            <h2>{isSignUp ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2>
            <p>{isSignUp ? 'Um novo capítulo da sua aventura começa aqui.' : 'Entre na sua conta para continuar de onde sua aventura parou.'}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && <label>Nome de exibição<input type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Como quer ser chamado?" minLength={2} maxLength={60} autoComplete="nickname" required /></label>}
            {isSignUp && <label>Nome de usuário<input type="text" value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="ex.: aventureiro_01" minLength={3} maxLength={24} autoComplete="username" required /><small>Único na plataforma · 3–24 caracteres · letras, números e _</small></label>}
            <label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" autoComplete="email" required /></label>
            <label>Senha<div className="auth-password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={isSignUp ? 'Mínimo de 8 caracteres' : 'Digite sua senha'} minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></label>
            {!isSignUp && <div className="auth-forgot"><button type="button" disabled={loading} onClick={handleResetPassword}>Esqueceu sua senha?</button></div>}
            <button className="auth-submit" type="submit" disabled={loading}><span>{loading ? 'Aguarde...' : isSignUp ? 'Criar minha conta' : 'Entrar na minha conta'}</span><span aria-hidden="true">→</span></button>
          </form>
          {message && <p className="auth-message" role="status">{message}</p>}
          <div className="auth-switch">{isSignUp ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'} <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}>{isSignUp ? 'Entrar' : 'Criar conta'}</button></div>
          <p className="auth-panel-footer">HäxBag · Seu inventário, sua aventura.</p>
        </section>
      </div>
    </main>
  )
}
