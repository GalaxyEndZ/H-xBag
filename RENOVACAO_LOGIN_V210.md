# HäxBag V210 — nova entrada no universo

## Arquivos modificados
- `src/Auth.tsx`
- `src/Auth.css`

## Interface
- Página de entrada com identidade visual, emblema original, portal decorativo vetorial/CSS e destaque para campanhas, personagens e comunidade.
- Área de autenticação com troca direta entre Entrar e Criar conta.
- Recuperação de senha em uma vista dedicada, sem deixar o formulário de login visível por trás.
- Formulários responsivos, estados de carregamento e mensagens acessíveis.
- Cadastro com confirmação de senha e ajuda visual de robustez (indicativa, sem alterar a regra de no mínimo 8 caracteres do cadastro).

## Compatibilidade
- Mesmo backend de autenticação existente (Supabase).
- Consulta `is_username_available` preservada.
- Tokens `ref` e `invite` preservados durante o cadastro.
- Nenhuma alteração de tabelas, RLS, contas, perfis ou regras do site.

## Instalação
Extraia a correção na raiz do projeto, preservando `.git` e `.env`. Depois rode `npm run build` e teste login, cadastro, recuperação e convites no navegador.

Não há novo SQL.
