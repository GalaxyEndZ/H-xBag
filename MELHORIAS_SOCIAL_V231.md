# HäxBag V231 — Social expandido

Base: V230. Esta atualização preserva os componentes de fichas, campanhas, temas, postagens clássicas, amizades e mensagens existentes.

## Instalação

1. Faça uma cópia de segurança dos seus arquivos e do banco Supabase.
2. Aplique o ZIP de correção **sobre a raiz do projeto**, mantendo os caminhos `src/...`.
3. Abra o Supabase > SQL Editor e execute **HAXBAG_SOCIAL_V231.sql** usando uma conta autorizada. Leia primeiro o SQL e mantenha um backup. **A execução é obrigatória para habilitar o módulo novo.**
4. Instale as dependências do projeto se necessário (`npm ci`), execute `npm run build` e publique a versão atualizada do site.
5. Faça login e teste as abas **Feed, Explorar, Comunidades, Salvos, Eventos, Notificações, Atividade e Segurança**.

### Administrador oficial da moderação

A fila de denúncias é visível apenas para as contas autorizadas na tabela de administração nova. No **SQL Editor**, após verificar o UUID da sua conta em Authentication > Users, execute:

```sql
insert into public.hax_v231_admins(user_id)
values ('UUID-DA-CONTA-ADMINISTRADORA')
on conflict do nothing;
```

Não coloque IDs privilegiados ou credenciais no código frontend. Essa permissão é administrativa do site e **não** é concedida automaticamente aos mestres de campanhas ou moderadores de grupos.

## Recursos integrados

1. **Feed:** o feed clássico permanece ativo, com Comunidade, Seguindo, Amigos e Minhas publicações, além de pesquisa, ordenação local e fotos já existentes. Uma seção de publicações especiais acrescenta filtros de posts recentes, populares, de grupos ou próprios.
2. **Publicações:** posts especiais aceitam texto de até 3.000 caracteres, rascunho local por sessão, edição, exclusão, fixação, hashtags e cartões seguros de prévia de URL. O editor clássico continua com suas **até quatro fotos** e visibilidade público/seguidores/amigos. Novas enquetes de até quatro opções duram sete dias.
3. **Publicação como personagem:** o autor escolhe um personagem da própria conta; o banco valida a posse do personagem e guarda o nome oficial, com indicação explícita da conta responsável. Publicações especiais suportam o feed público ou grupos de que o autor é membro.
4. **Notificações:** novas notificações persistentes de curtidas, comentários, inscrições e pedidos de participação em grupos; agrupamento visual por data, controle de lidos e preferência para desligar avisos. As notificações antigas do HäxBag permanecem intactas.
5. **Explorar:** busca existente de pessoas, descoberta de grupos, hashtags populares dos posts especiais. Campanhas privadas não são exibidas publicamente.
6. **Comentários:** posts especiais com respostas aninhadas de um nível e exclusão pelos autores, enquanto o antigo componente de comentários é preservado. `@usuário` permanece texto normal (não dispara notificação específica de menção nesta versão).
7. **Comunidades:** grupos públicos ou privados, regras, tópicos, aprovação de entrada para os privados, administração de membros/moderadores e remoção de posts por moderadores autorizados.
8. **Coleções:** Salvos, criação de novas coleções pelo campo de transferência, organização e exclusão. Inclui posts clássicos e especiais. Para posts antigos, é salvo um pequeno resumo pessoal do texto; ele pode permanecer mesmo quando o original for removido. Os salvos são privados no banco.
9. **Atividade:** painel da jornada recente e histórico opcional no perfil público via função SQL que não divulga conteúdo privado de grupos.
10. **Mensagens:** continua com fotos, pesquisa, leitura e exclusão existentes, agora com resposta citada. Reações individuais com contadores por mensagem ainda não possuem tabela específica.
11. **Eventos:** anúncios de sessões abertas com local, horário, vagas, inscrição/cancelamento e eventos vinculados a grupos.
12. **Segurança/moderação:** denúncias em posts especiais, posts clássicos e grupos; fila administrativa, revisão, exclusão de conteúdos especiais e filtro de silenciamento de autores no feed especial. Bloqueio de contas da rede inteira continua no recurso já existente. Limite básico de denúncias por dia.

## Observações / limitações reais

- O feed clássico e o feed especial convivem na mesma página, mas usam **tabelas distintas**, pois a V230 utiliza RPCs antigos cujo esquema de banco não acompanha o ZIP. O código evita alterar essas RPCs ou remover dados antigos. A ordenação “populares” considera somente registros carregados.
- O editor de posts especiais é para **texto, enquetes e personagem**; para posts com múltiplas fotos, use o editor clássico. O editor de posts antigos não recebe edição inline.
- Links recebem prévias seguras de domínio/caminho, não miniaturas Open Graph coletadas por servidor.
- Menções com notificações automáticas, compartilhamento público de campanhas, reações estruturadas a mensagens e anexos em posts de grupos privados exigem integração futura com o esquema legado/Storage e não foram implementados nesta atualização. Não foram introduzidas permissões que possam expor campanhas e chats privados.
- A moderação de publicações antigas é de **triagem de denúncias**; a remoção do conteúdo legado ainda depende das ferramentas existentes. A remoção por denúncia funciona nos posts e grupos novos.
- É necessário testar a migração e o build em um ambiente com Supabase e as dependências do projeto. Não foi feita uma execução SQL em banco real ou um teste end-to-end de browser.
