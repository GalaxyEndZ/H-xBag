# HäxBag V234 — Painel Administrativo

Atualização baseada na V233. Preserva o Social V231 e o redesign V232–V233.

## Instalação

1. Faça um backup da pasta do projeto e do banco antes de rodar scripts SQL.
2. Se usar o ZIP de atualização, extraia na **raiz** do projeto, preservando caminhos `src/` e substituindo arquivos quando solicitado.
3. Confirme que `HAXBAG_SOCIAL_V231.sql` já foi executado no Supabase.
4. Execute **`HAXBAG_ADMIN_V234.sql`** uma única vez no **SQL Editor do Supabase**, em uma conta com privilégios de proprietário do banco.
5. O dono do site precisa estar na tabela `public.hax_v231_admins`. Se não estiver, no SQL Editor, **substitua** o UUID abaixo pelo ID da sua conta em *Authentication → Users*:

   ```sql
   insert into public.hax_v231_admins(user_id)
   values ('SEU-UUID-AQUI')
   on conflict do nothing;
   ```

6. Rode `npm install` caso as dependências ainda não existam; depois `npm run build` e publique a nova versão. Faça login novamente ou atualize a página.
7. Em **Social → Administração do site → Painel Administrativo**, encontre Denúncias, Usuários, Equipe e Histórico. A busca global `Ctrl+K` também inclui o painel para contas autorizadas.

## Regras de acesso

- **Administrador**: permissão concedida na tabela `hax_v231_admins` pelo SQL Editor. Pode nomear/remover moderadores, advertir, suspender por 1 a 365 dias, avaliar denúncias, remover posts/comentários/comunidades V231.
- **Moderador**: pode ser designado pelo administrador na aba Equipe, mas **não enxerga nem acessa o Painel Administrativo**, assim como qualquer jogador. Nesta versão a função de moderador é apenas uma designação persistida, sem ações administrativas disponibilizadas. Um futuro painel de moderação limitado poderá ser criado separadamente, com permissões próprias no banco.
- **Jogador e mestre de campanha**: não têm acesso ao painel, nem ao histórico. Tentar abrir a URL manualmente não concede permissão no banco. Também não há opção de autoelevação por `profiles` ou `campaign_members`.
- **Histórico**: armazena ação, autor, alvo, data, justificativa e contexto limitado. A interface não permite apagá-lo ou editá-lo.

## Alcance das suspensões

A suspensão bloqueia operações **INSERT, UPDATE e DELETE** nas tabelas de conteúdo e interação do novo módulo Social V231 por políticas restritivas de SQL. A restrição não remove a possibilidade de consultar conteúdos permitidos ou enviar denúncias. Ela **não** desativa a conta Supabase Auth nem bloqueia o restante do HäxBag. O **feed clássico, chat clássico e seus RPCs antigos** não receberam restrições SQL porque suas definições não estão incluídas nesta distribuição. Usuários com acesso técnico ainda podem chamar as funções antigas diretamente; **não considere as suspensões globais** enquanto o Social clássico não tiver suas RPCs protegidas. Esta versão não pretende revogar acesso ao chat clássico.

O painel recebe denúncias de publicações clássicas e permite analisá-las, mas **não permite excluir postagens antigas automaticamente**. Para moderação global consistente, precisamos das definições SQL dos RPCs `hax_social_*` e das tabelas do Social clássico para integrá-las à política de sanções com segurança. Não tente utilizar a chave `service_role` no navegador.

## Exclusividade do painel

- O menu lateral e o atalho `Ctrl+K` só oferecem **Painel Administrativo** depois de validar `hax_v231_admin()` para o usuário autenticado.
- O componente confirma novamente `hax_v234_role() = 'admin'` antes de ler denúncias, usuários ou auditoria. Tentativas de URL manual mostram acesso restrito.
- Cada consulta e ação administrativa SQL verifica novamente o papel do usuário; o navegador **nunca** recebe credenciais privilegiadas.
- Mestres de campanhas, jogadores e moderadores designados **não** veem o painel.

## O que esta versão faz

- Fila de denúncias com filtros por status e inspeção do alvo reportado.
- Busca de usuários por nome, `@usuário` ou UUID completo; não expõe email, telefone ou credenciais.
- Advertências com notificação, suspensões temporárias e revogação antecipada da suspensão.
- Gestão de moderadores apenas por administradores.
- Decisões auditadas e confirmação antes de ações irreversíveis.
- Painel separado de Privacidade, com navegação e visual coerentes com Social V232.

## Validação

Verificações locais de sintaxe TSX/CSS e integridade do ZIP. Build completo e testes de migração num banco Supabase real **não** foram executados neste ambiente; faça-os em um ambiente de teste antes de publicar em produção.
