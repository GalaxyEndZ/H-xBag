# HäxBag V263 — Correção da tela vazia na inicialização

## Causa identificada no ZIP enviado

O arquivo `dist/assets/index-DAp2w_Ly.js` continha uma exceção **incondicional**:
`As variáveis de ambiente do Supabase não foram configuradas.`
A aplicação parava **antes do React montar a interface**. A compilação foi feita sem as variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY. O ZIP também não continha `.env`, e o `dist/index.html` não carregava `hb-startup-recovery.js`.

## O que muda

- `vite.config.ts` agora bloqueia `vite build` sem ambas as variáveis. Não gera mais um `dist` quebrado silenciosamente.
- `index.html` ativa o diagnóstico de inicialização, que funciona mesmo quando o JavaScript da aplicação falha.
- `.env.example` documenta os nomes sem incluir credenciais.
- O ZIP completo **não inclui o dist antigo defeituoso**. Gere um novo build no ambiente configurado.

## Como corrigir no computador

1. Copie `.env.example` para `.env.local` na raiz do projeto.
2. No Supabase, copie **Project URL** para `VITE_SUPABASE_URL` e a **publishable key** (ou chave `anon` pública legada) para `VITE_SUPABASE_PUBLISHABLE_KEY`. NUNCA coloque a chave `service_role` ou `secret` no frontend.
3. Execute `npm run build` de novo. Se as variáveis estiverem faltando, o build agora exibe erro claro e interrompe a publicação.
4. Publique o novo conteúdo de `dist`, não o `dist` incluído no ZIP antigo.

## Hospedagem

Se o serviço (Vercel, Netlify, Cloudflare Pages ou outro) executa o build, cadastre ambas as variáveis **nas configurações do projeto, para o ambiente de produção**; salve e crie novo deployment. O arquivo `.env.local` do computador não é automaticamente enviado à hospedagem.

## Diagnóstico

Se mesmo com um build novo a tela ainda falhar, abra o Console (F12) e envie a primeira mensagem de erro. Agora o script de recuperação carregado no `index.html` também poderá mostrar uma mensagem na própria tela.

Nenhuma migração SQL é necessária. A camada Social e suas permissões não foram alteradas.
