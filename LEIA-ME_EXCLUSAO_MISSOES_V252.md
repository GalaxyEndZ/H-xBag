# HäxBag V252 — Exclusão de missões

- O mestre pode excluir uma missão **ativa (em progresso)**, **concluída** ou **falhada**.
- O botão Excluir está disponível em todos os cartões de missão para o mestre.
- Uma confirmação mostra o nome, estado e alerta para recompensas já entregues.
- A remoção usa `hax_mission_delete(p_mission_id)` com confirmação de permissão na função SQL.
- É necessária a migração `HAXBAG_EXCLUSAO_MISSOES_V252.sql`, executada **depois das migrações de missões anteriores**.
- **Não há estorno** de itens, moedas, condições ou outros efeitos já concedidos a personagens. A exclusão apaga a missão e seu histórico de progresso; não recuperável sem backup.
- Jogadores sem a função de mestre não têm acesso à exclusão e a função SQL nega tentativas externas.

## Instalação

1. Faça backup da aplicação e do banco antes da migração e da exclusão de missões importantes.
2. Execute `HAXBAG_EXCLUSAO_MISSOES_V252.sql` no editor SQL do seu projeto.
3. Copie `src/components/CampaignMissions.tsx` da atualização por cima do arquivo anterior.
4. Execute `npm run build` e publique.

## Verificações sugeridas

- Mestre: apagar uma missão com objetivos em progresso, outra concluída com drops entregues e outra falhada.
- Jogador: confirmar que o botão Excluir não aparece e que a RPC recusa a exclusão.
- Confirmar que cancelar a exclusão preserva o registro, e que recompensas pagas anteriormente permanecem no inventário.

O código foi verificado estaticamente; o SQL deve ser testado no banco real antes de produção.
