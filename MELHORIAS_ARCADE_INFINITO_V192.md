# HäxBag V192 — Todos os minigames em modo infinito

Esta versão continua a V191 e conserva o Social, o RPG, os rankings globais e os desafios diários (três tarefas por dia, prêmio único entre 1 e 10 moedas somente após concluir o trio).

## Comportamento por jogo

- **Pong:** não há limite de gols/pontos ou tempo. Continua até perder as três vidas ou clicar em **Encerrar e registrar**.
- **Snake:** continua enquanto não ocorrer colisão. O caso excepcional de preencher todas as 400 casas reinicia a arena com a pontuação preservada, em vez de finalizar a partida. Há encerramento manual.
- **Breakout:** já possui ondas sucessivas com novas formações de blocos; mantém pontos, vidas e encerramento manual.
- **2048:** criar a peça 2048 não encerra a partida; é possível formar 4096, 8192 etc. Encerra apenas se não existirem mais jogadas válidas ou se o jogador decidir terminar.
- **Asteroids:** gera asteroides continuamente até acabarem as vidas; inclui **Encerrar e registrar**.
- **Campo Minado:** ao limpar todas as casas seguras, credita os pontos da rodada e, após breve transição, gera um campo novo; o número de minas aumenta gradualmente até 18. A pontuação continua acumulando. Encontrar uma mina encerra; há botão de encerramento manual.
- **Voo Infinito:** gera obstáculos continuamente; inclui encerramento manual para registrar a pontuação sem precisar morrer.
- **Arena Infinita:** inimigos e ondas continuam surgindo; disparos permanecem manuais, conforme a V191.
- **Memória Arcana:** ao achar os oito pares, soma os pontos e embaralha um novo conjunto de runas. O jogador pode continuar por quantas rodadas desejar, ou encerrar e registrar.

**Modo infinito** significa que nenhum jogo termina automaticamente apenas por concluir uma fase ou atingir uma meta. Derrota ou escolha do usuário continuam encerrando a partida. A pontuação é guardada no fim da partida, não a cada nova rodada.

## Banco de dados

Execute `HaxBag_Arcade_Infinito_V192.sql` no SQL Editor do Supabase **após as migrações V188 e V190**.

- Remove o limite de duração de uma hora nos registros de partidas dos nove jogos.
- Amplia o limite técnico da pontuação (integer) para 2.000.000.000, mantendo verificações de plausibilidade por duração, autenticação e trava contra envio duplicado.
- Não modifica os prêmios dos desafios, as carteiras de moedinhas, a escolha do conjunto diário ou os rankings existentes.
- As partidas continuam calculadas no cliente; os limites no SQL reduzem abusos, mas não equivalem a validação autoritativa do jogo.

## Instalação

1. Substitua o projeto V191 pelos arquivos V192; preserve o seu `.env`.
2. Execute a migração SQL V192 no Supabase.
3. No projeto, execute `npm install` (se necessário) e `npm run build`.

## Verificação

A sintaxe de 50 arquivos TS/TSX foi validada, assim como a estrutura da migração e do ZIP. O build completo e os testes no navegador/Supabase precisam ser executados no ambiente com as dependências do projeto.
