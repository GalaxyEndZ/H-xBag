# HäxBag V306.3 — NPCs Civis e Trabalho nas Fichas

## Instalação

1. Aplicar os arquivos modificados sobre V306.2 (a atualização preserva o workflow Android).
2. Executar `HAXBAG_V306_3_NPCS_CIVIS.sql` no SQL Editor do Supabase **depois** de `HAXBAG_V304_RECURSOS.sql`.
3. Rodar `npm ci` e `npm run build`. Para Android, executar o workflow manual do projeto.
4. Abrir **Fichas** como mestre de uma campanha **Kisatsutai** e clicar em **Gerador de NPCs**.

## Funcionalidades

- Geração rápida individual ou em lote (até 10), nomes civis, ocupações com sugestões de perícias, Tier e Level.
- Organização de NPCs por ambiente livre, como *Vila de Kaneyama*. Cadastro, filtros, busca, edição e exclusão.
- Até cinco perícias **da lista real do Kisatsutai** por profissão. O mestre pode trocar todas.
- Campo de **Trabalho/Profissão** nas fichas normais, junto de até cinco perícias profissionais no Kisatsutai.
- O acervo é privado dos mestres por **RLS**. Não altera `characters`, `character_sheets`, `enemies` nem regras de combate.
- O campo `identity.job` e a lista `identity.jobSkills` das fichas normais são salvos no `sheet_data` existente, sem migração adicional nessa tabela.

**Decisão de regras:** as perícias de trabalho são registradas como especializações narrativas; **não adicionam bônus automáticos** a testes ou progressão. O valor do eventual bônus exige definição do sistema com o mestre. Tier e Level não geram atributos de combate fictícios.

## Versão

`0.306.3`. Sem alteração nos workflows de distribuição Windows/Android.
