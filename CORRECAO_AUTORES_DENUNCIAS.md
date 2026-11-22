# HäxBag — identificação do alvo das denúncias

## Correção

- Identifica o `@usuário` responsável por uma publicação do **feed clássico**, que antes aparecia como “Autor não identificado”.
- Mantém a identificação de autores de publicações, comentários e comunidades, além de denúncias de contas.
- Repara denúncias antigas quando o conteúdo original ainda está disponível, usando a autoria real armazenada no banco.
- Para novas denúncias, preserva a identificação do autor já no momento do registro, inclusive quando o conteúdo for removido depois.
- A prévia da denúncia também retorna o autor e seu `@usuário`, que ficam disponíveis como link para o perfil público no painel.
- O acesso aos dados de moderação continua restrito a administradores globais, validado no servidor.

## Instalação

1. Faça backup do banco e do projeto.
2. Extraia o ZIP de correção na pasta principal do HäxBag, mantendo a estrutura `src/components/`.
3. **Execute `HAXBAG_CORRECAO_AUTORES_DENUNCIAS.sql` no editor SQL do banco**, após as estruturas sociais e administrativas. Este SQL é necessário para resolver os autores de denúncias já existentes.
4. Execute `npm run build` e publique a atualização.
5. Reabra o Painel Administrativo e atualize os dados. Clique na denúncia para confirmar o `@` e abrir o perfil.

## Conferência opcional

Depois de executar a migração, uma consulta de diagnóstico no editor SQL pode mostrar quantos registros foram identificados:

```sql
SELECT target_type AS tipo,
       COUNT(*) AS denuncias,
       COUNT(*) FILTER (WHERE target_author_id IS NOT NULL) AS autores_identificados
FROM public.hax_v231_reports
GROUP BY target_type
ORDER BY target_type;
```

**Limitação real:** se uma publicação antiga foi excluída antes de a autoria ser registrada e não há outro registro confiável do autor, não é possível descobrir essa pessoa com segurança apenas a partir do UUID da publicação. O painel não cria associações por suposição.

A sintaxe TSX foi verificada por transpilação. O SQL foi revisado estaticamente; a execução em banco real e o build completo precisam ser confirmados no projeto.
