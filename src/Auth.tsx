
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
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">H</div>
          <h1>HäxBag</h1>
          <p>Seu inventário, sua aventura.</p>
        </div>

        <div className="auth-heading">
          <h2>{isSignUp ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2>
          <p>
            {isSignUp
              ? 'Prepare-se para sua próxima aventura.'
              : 'Entre para acessar suas campanhas.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <label>
              Nome de exibição
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Como quer ser chamado?"
                minLength={2}
                maxLength={60}
                autoComplete="nickname"
                required
              />
            </label>
          )}

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading
              ? 'Aguarde...'
              : isSignUp
                ? 'Criar conta'
                : 'Entrar'}
          </button>
        </form>

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}

        <div className="auth-switch">
          {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setMessage('')
            }}
          >
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </button>
        </div>
      </section>
    </main>
  )
}
