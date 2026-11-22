# HäxBag — Pacote Social V245

Esta atualização amplia o projeto existente (V244) sem excluir dados de usuários, publicações, inventários ou campanhas.

## Recursos integrados

1. **Notificações** — filtros por tipo, configuração de recebimento, consulta periódica e atualização em tempo real quando a publicação do banco permitir.
2. **Vitrine de perfil** — destaque de até 3 publicações, 3 personagens e 6 imagens HTTPS; o conteúdo publicado respeita a visibilidade definida pelo dono.
3. **Republicações e citações** — compartilha posts públicos da comunidade e referencia o autor original; o banco rejeita a republicação de posts privados de grupos e as não autorizadas pelo autor.
4. **Diário dos personagens** — registros publicados pelo dono do personagem, opcionalmente visíveis no perfil público.
5. **Insígnias oficiais** — filtros e apresentação refinada das insígnias existentes. A concessão permanece exclusiva do site e dos administradores globais; não há concessão pelos mestres.
6. **Moderação** — contestações de banimento apresentadas pela conta bloqueada e analisadas exclusivamente por administradores, com motivo e registro no histórico. A aceitação de uma contestação NÃO remove automaticamente o banimento.
7. **Chat** — reações, mensagens fixadas por usuário e edição de mensagens textuais próprias em até 15 minutos; recursos de anexos e respostas existentes foram preservados.
8. **Privacidade** — preferências para menções, republicações, novas mensagens e categorias de notificações. As restrições de novas mensagens e republicações também são aplicadas no banco.
9. **Estatísticas** — resumo de publicações, curtidas, comentários e movimentação de seguidores, respeitando os limites de dados carregados e contando novos seguimentos a partir da instalação.
10. **Procurar Mesa** — anúncios de campanhas, filtros, vagas, candidaturas, aprovação e recusa com notificações.
11. **Tendências** — hashtags populares nas publicações carregadas, com filtro temporal.
12. **Segurança** — ativação e verificação de autenticação TOTP de duas etapas, dados básicos da última entrada e encerramento das sessões.

## Ordem de instalação

1. Faça um backup do banco e dos arquivos do HäxBag.
2. Tenha as migrações das versões V231, V234, V241, V244 e anteriores necessárias instaladas.
3. Execute **`HAXBAG_EXPANSAO_SOCIAL_V245.sql`** no editor SQL do projeto com privilégios administrativos. Execute o script inteiro (ele usa uma transação).
4. Extraia o ZIP de atualização na **raiz do projeto** (no diretório onde há `package.json`), preservando a estrutura de `src/`.
5. Execute `npm ci` (se as dependências estiverem ausentes), `npm run build`, faça o deploy e recarregue a página.
6. Teste com contas de jogador, mestre, administrador global e uma conta de teste banida.

## Roteiro de testes essencial

- Seguir alguém e verificar notificação, marcação como lida e filtros.
- Postar na comunidade, republicar e citar; tentar republicar post de comunidade privada e confirmar a rejeição.
- Configurar vitrine e confirmar o que aparece ao visitar o perfil por outra conta.
- Publicar marcos de personagem públicos e privados e conferir as permissões.
- Bloquear novas mensagens e confirmar a rejeição com um remetente diferente.
- Candidatar-se a uma mesa, aceitar uma candidatura e conferir a contagem de vagas.
- Ativar TOTP em uma conta de teste; sair/entrar e verificar o pedido de código.
- Enviar contestação com uma conta banida; verificar decisão e histórico pela conta administradora; conferir que mestres e moderadores não acessam a central administrativa global.
- Verificar o histórico de ações administrativas e a integridade dos dados antigos.

## Limites conhecidos

- **Build completo e aplicação do SQL no banco real não foram executados neste ambiente.** Uma verificação sintática independente dos componentes TypeScript/TSX foi concluída, mas testes reais de banco, compilação completa e navegação continuam necessários.
- A notificação em tempo real depende da publicação `supabase_realtime`/replicação habilitada; a interface mantém uma consulta periódica como alternativa.
- Gráficos de estatísticas e tendências analisam apenas os registros carregados (limites explícitos na interface), não a população inteira do site. Não há rastreamento individual de visitantes ou de dispositivos.
- A autenticação TOTP nesta atualização usa o provedor de autenticação existente. O painel global não ganhou exigência própria de AAL2 para cada operação administrativa; configure MFA obrigatória para administradores no provedor e valide no servidor antes de considerar isso uma garantia.
- As preferências para menções são preparatórias para a integração com mecanismos de marcação; não removem referências já publicadas.
- O sistema de denúncias/banimentos existente continua com as limitações de cobertura documentadas em suas migrações anteriores.
- O campo de galeria aceita URLs HTTPS externas. Não há upload de imagens nem varredura automática desses URLs nesta atualização.
- A categoria de insígnias é uma organização dos registros oficiais existentes; não adiciona insígnias não autorizadas.

## Arquivos alterados

- `src/App.tsx`
- `src/components/FriendsPanel.tsx`
- `src/components/SocialV231Suite.tsx`
- `src/components/PublicAdventurerProfile.tsx`
- `src/components/ProfileLegacy.tsx`
- `src/components/SiteAdministrationV234.tsx`
- `src/components/SocialExpansionV245.tsx` (novo)
- `src/components/SocialExpansionV245.css` (novo)
- `src/components/useSocialV245Chat.ts` (novo)
- `src/components/SocialV245MfaGate.tsx` (novo)
- `HAXBAG_EXPANSAO_SOCIAL_V245.sql` (novo)
