
import { useState } from 'react'
import { supabase } from './supabase'
import './Auth.css'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
          },
        })

        if (error) throw error

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

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-showcase" aria-label="Bem-vindo ao HäxBag">
          <div className="auth-showcase-brand">
            <img src="/haxbag-symbol.png" alt="" />
            <span>HäxBag</span>
          </div>
          <div className="auth-showcase-content">
            <span className="auth-eyebrow">SEU UNIVERSO DE RPG</span>
            <h1>Suas histórias.<br /><em>Um só lugar.</em></h1>
            <p>Organize personagens, acompanhe campanhas e mantenha cada detalhe da sua aventura ao seu alcance.</p>
            <div className="auth-showcase-features">
              <span>✦ Personagens</span><span>✦ Campanhas</span><span>✦ Inventários</span>
            </div>
          </div>
          <div className="auth-showcase-footer">UM ESPAÇO PARA CADA AVENTURA</div>
        </section>
        <section className="auth-panel">
          <div className="auth-panel-top">
            <img className="auth-panel-symbol" src="/haxbag-symbol.png" alt="Símbolo do HäxBag" />
            <span>HäxBag</span>
          </div>
          <div className="auth-heading">
            <span className="auth-eyebrow">{isSignUp ? 'COMECE SUA JORNADA' : 'BEM-VINDO DE VOLTA'}</span>
            <h2>{isSignUp ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
            <p>{isSignUp ? 'Seu próximo capítulo começa aqui.' : 'Seu universo está esperando por você.'}</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            {isSignUp && (
              <label>Nome de exibição
                <input type="text" value={name} onChange={(event) => setName(event.target.value)}
                  placeholder="Como quer ser chamado?" minLength={2} maxLength={60}
                  autoComplete="nickname" required />
              </label>
            )}
            <label>E-mail
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com" autoComplete="email" required />
            </label>
            <label>Senha
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres" minLength={8}
                autoComplete={isSignUp ? 'new-password' : 'current-password'} required />
            </label>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Aguarde...' : isSignUp ? 'Criar minha conta' : 'Entrar no HäxBag'}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>
          {message && <p className="auth-message" role="status">{message}</p>}
          <div className="auth-switch">
            {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}>
              {isSignUp ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
          <p className="auth-panel-footer">HÄXBAG · SEU ESPAÇO DE AVENTURAS</p>
        </section>
      </div>
    </main>
  )
}
