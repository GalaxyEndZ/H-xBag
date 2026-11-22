# HäxBag — Proteção de recadastros e convites

## Comportamento

- Ao **banir uma conta**, a proteção registra uma impressão criptográfica do IP de cadastro (se já houver registro) e, quando disponível, também a da sessão recente. Novos cadastros pela mesma conexão identificada são recusados enquanto aquela conta continuar banida.
- A identificação se baseia no **IP informado pelo sistema de autenticação ao hook**, nunca em um IP enviado pelo formulário ou JavaScript do navegador.
- O contador **Embaixador** soma **convites pessoais e de campanha**, mas apenas quando uma nova conta confirma o e-mail e a indicação é elegível. Uma conexão rende **no máximo uma indicação por indicador**; a conexão do próprio indicador não rende crédito.
- Contas legítimas podem ser criadas pela mesma conexão, desde que ela não esteja relacionada a um banimento ativo. A proteção *não* impede um cadastro legítimo só porque outro usuário não banido compartilha o IP; ela apenas impede créditos duplicados por indicador.
- Convites já creditados continuam valendo. Convites criados antes da ativação e ainda pendentes mantêm o tratamento anterior; não é possível provar retroativamente que foram criados pelo mesmo IP.

## Instalação — as duas etapas são obrigatórias

1. Faça backup do banco e dos arquivos e mantenha as migrações existentes de Embaixador e Banimento já aplicadas.
2. Execute `HAXBAG_PROTECAO_CONVITES_REDE.sql` no **SQL Editor** como administrador do projeto. Ele cria tabelas privadas, funções de validação e atualiza os gatilhos de indicação.
3. No painel do serviço de autenticação, abra **Authentication → Hooks → Before User Created**. Selecione **Postgres Function**, schema `public`, função `hax_v242_before_user_created`. Salve e habilite. Sem essa etapa o bloqueio por rede **não entra em funcionamento**, e os novos convites **não serão creditados** por segurança.
4. Copie os arquivos `src/` atualizados para o projeto e execute `npm run build` antes de publicar.
5. Faça testes em ambiente de homologação antes de ativar em produção.

**ATENÇÃO:** se você já utiliza outro hook *Before User Created*, não o substitua sem combinar as validações. O serviço normalmente executa um hook desse tipo por projeto.

## Testes necessários

1. Cadastre A usando convite de um indicador, confirme o e-mail: o contador sobe 1, se o IP não é o do indicador.
2. Cadastre B no mesmo IP de A, com convite do mesmo indicador: o contador **não** sobe novamente.
3. Cadastre C em outro IP, convite do mesmo indicador: o contador sobe.
4. Convite para o próprio IP do indicador: não sobe.
5. Banir A, tentar criar D no IP registrado para A: cadastro bloqueado; revogar banimento: deixa de estar bloqueado por essa banimento.
6. Testar conta banida sem IP histórico: o sistema continuará bloqueando aquela conta, mas não pode identificar outra pessoa apenas por esse dado ausente.
7. Confirmar que usuários comuns não podem executar as funções privadas nem consultar os hashes.

## Verificação técnica (somente administrador do banco)

```sql
SELECT
  to_regprocedure('public.hax_v242_before_user_created(jsonb)') IS NOT NULL AS hook_criado,
  has_function_privilege('supabase_auth_admin', 'public.hax_v242_before_user_created(jsonb)', 'EXECUTE') AS hook_autorizado,
  NOT has_function_privilege('authenticated', 'public.hax_v242_before_user_created(jsonb)', 'EXECUTE') AS cliente_bloqueado;
```

Essa consulta **não** verifica se o hook foi habilitado na interface. Confirme a ativação nela.

## Privacidade, limitações e recuperação

- IPs são armazenados como hashes HMAC-SHA256 com chave secreta gerada no banco. Não aparecem nos perfis ou no painel social, mas **continuam sendo dados pessoais pseudonimizados**: informe o uso de proteção antifraude na política de privacidade.
- IP não identifica pessoa. Família, escola, empresa ou rede pública podem compartilhar o mesmo endereço; VPN e redes móveis podem trocar de IP. O bloqueio por IP é apenas **uma barreira contra evasão**, não uma garantia de impedir o retorno de um banido.
- Para resolver falso positivo de rede, avalie primeiro a denúncia, o histórico e o IP associado, e só então considere remover a associação correspondente via procedimento administrativo. Não libere redes indiscriminadamente.
- A chave HMAC não deve ser trocada sem planejar a reidentificação dos registros; os hashes existentes deixariam de ser comparáveis.
- Ao apagar uma conta, as associações de rede são excluídas. Entradas órfãs de tentativas de cadastro interrompidas podem ser limpas pelo administrador, por exemplo:

```sql
DELETE FROM public.hax_v242_signup_networks n
WHERE n.created_at < now() - interval '48 hours'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=n.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.hax_v242_ban_networks b WHERE b.user_id=n.user_id);
```

- O bloqueio depende do hook ativo e do IP presente no cadastro do usuário banido ou em seu histórico de sessão; não é retroativo para contas cujo IP não é recuperável.
- Também é recomendável usar confirmação de e-mail, limite de criação de contas, CAPTCHA e revisão manual de casos suspeitos.

Referência de configuração: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
