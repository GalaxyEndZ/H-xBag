# HäxBag V190 — Arcade completo e desafios diários

## O que foi implementado

- Nove jogos disponíveis: Pong, Snake, Breakout, 2048, Asteroids, Campo Minado, Voo Infinito, Arena Infinita e Memória Arcana.
- Ranking global (Top 25) e melhor resultado individual para cada jogo. O Pong preserva o ranking original da V188.
- 27 desafios pré-definidos em `src/components/ArcadeChallengeCatalog.ts`, com três níveis por jogo (fácil, médio e difícil).
- Sorteio diário de **exatamente três desafios**, de três jogos diferentes, igual para todos os usuários. A seleção usa hash determinístico da data civil no fuso `America/Sao_Paulo` no **servidor**; não depende do relógio configurado no dispositivo do jogador.
- Progresso individual 0/3, 1/3, 2/3, 3/3, registrado no banco; **nenhuma moeda é concedida por desafios isolados**.
- Após 3/3, o servidor credita **uma única recompensa por dia**, de **1 a 10 moedinhas**, conforme a dificuldade total das três metas. O crédito é transacional e protegido contra duplicatas/conclusões simultâneas.
- Saldo exclusivo do Arcade, independente de inventários, lojas, personagens e moedas de campanhas.
- Atalhos da navegação para Jogos, Desafios e Rankings.

## Instalação

1. Faça backup do projeto e banco. Substitua os arquivos da versão anterior pelos desta versão, preservando seu `.env`.
2. Se ainda não executou, aplique primeiro `HaxBag_Pong_Ranking_V188.sql` no **SQL Editor** do Supabase.
3. Execute **`HaxBag_Arcade_Jogos_Desafios_V190.sql`** no SQL Editor do Supabase.
4. Execute `npm install`, `npm run build` e publique o site.
5. Abra Minigames para conferir os três desafios e os rankings.

Não reutilize diretamente os SQLs experimentais anteriores à V190; instale somente as migrações V188 e V190 desta entrega.

## Manutenção do catálogo

O catálogo de desafios predefinidos está em `src/components/ArcadeChallengeCatalog.ts` e **espelhado no bloco `VALUES`** da função `hax_arcade_daily_challenges()` do SQL V190. Ao adicionar/editar desafios futuramente, atualize os dois lugares com o mesmo `challenge_id`, `game_id`, título, pontuação alvo e dificuldade. Para evitar mudança retroativa em desafios já publicados, prefira novos IDs e versionamento de catálogo.

## Regra do pagamento

Pontuações só contam depois de uma partida finalizada com sucesso, no mesmo dia em que foi iniciada (horário de Brasília). Uma pessoa pode concluir cada desafio diário apenas uma vez. Apenas o terceiro desafio libera o prêmio total; reenvios ou novas partidas não liberam novamente. Dificuldade de cada desafio: 1, 3 ou 5. O prêmio diário vai de 1 a 10 moedas, calculado pela soma das dificuldades dos três desafios e arredondamento entre os extremos.

## Limitações e segurança

O servidor controla os resultados registrados, início/fim de partidas, limites plausíveis, duplicatas, saldo e pagamentos. Porém, **a lógica dos jogos roda no navegador**, então não existe uma verificação antitrapaça autoritativa de todas as jogadas. Para um ranking competitivo com prêmios negociáveis, seria necessário validar partidas no servidor. As moedinhas do Arcade não são transferíveis nem alteram as moedas de RPG.

A compilação TypeScript completa e as migrações SQL exigem validação na instalação com as dependências npm e o banco Supabase do usuário.
