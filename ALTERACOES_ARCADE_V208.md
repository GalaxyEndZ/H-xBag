# HäxBag V208 — Memória Arcana, Queda Rúnica e desafios equilibrados

## Funcionalidades

- **Memória Arcana:** tabuleiro de runas redesenhado com virada de cartas, placar, combos, acertos e progresso; mantém rodadas sucessivas e pontuação acumulada.
- **Queda Rúnica:** novo jogo de blocos que caem em tabuleiro de 10×20; sete formatos de peças, reserva, prévia, peça-fantasma, rotação, queda rápida, controle por teclado e botões de toque, limpeza de linhas, níveis, pontuação acumulada e encerramento manual. O jogo não tem última fase: termina apenas por bloqueio no topo ou ao encerrar a partida.
- **Snake:** a velocidade é constante dentro do nível e só aumenta quando o nível é concluído após cinco frutas. Frutas individuais não aceleram o jogo.
- **Desafios:** dez jogos × seis dificuldades (Fácil, Médio, Difícil, Raro, Lendário, Pesadelo) = 60 missões predefinidas. Exatamente três jogos diferentes são sorteados para todos a cada dia na data de Brasília; as metas foram alinhadas à pontuação real de cada minigame.
- **Moedinhas:** recompensa única pelo trio, entre 1 e 20 moedas, calculada a partir das dificuldades. Sem pagamento em 1/3 ou 2/3. O SQL mantém a trava do pagamento diário para evitar créditos duplicados.
- **Ranking:** Queda Rúnica usa tabela global de recordes do Arcade; SQL amplia as regras de início e a lista do Top 25 ao novo jogo.

## Instalação

1. Extraia o ZIP de correção sobre seu projeto V207, preservando `.git` e `.env`; **ou** use o projeto completo V208 como base de uma nova pasta.
2. No SQL Editor do Supabase, execute `HaxBag_Queda_Runica_Desafios_V208.sql` **depois** das migrações do Arcade V188, V190 e V192.
3. Execute `npm ci` e `npm run build` na sua máquina.

## Compatibilidade

- As partidas, pontuações, fichas, campanhas, Social e configurações já existentes são preservadas.
- O catálogo TypeScript é usado para identificação, apresentação e referência. O sorteio e a concessão de moedas são feitos pelas funções SQL do servidor.
- O SQL não modifica a economia de moedas do RPG nem redefine os recordes existentes.
- Missões que foram geradas pelo catálogo anterior não são regravadas retroativamente. Ao instalar, o conjunto do dia será calculado conforme a nova lista; o novo sorteio será aplicado imediatamente e renovado à meia-noite de Brasília.

## Verificações realizadas

- 56 arquivos TypeScript/TSX transpilaram sem erros sintáticos.
- 59 folhas CSS conferidas quanto ao equilíbrio estrutural.
- 60 entradas do catálogo TypeScript coincidem integralmente com as 60 entradas SQL.
- Simulação do sorteio por 730 dias confirmou três jogos distintos e recompensas sempre entre 1 e 20.
- Testes unitários básicos da queda da peça e encerramento manual de Queda Rúnica passaram.

**Limitação:** a compilação Vite/TypeScript completa, o SQL executado no Supabase e os testes interativos no navegador não puderam ser realizados neste ambiente. Execute `npm run build` e teste em ambiente de desenvolvimento antes de publicar. Jogos no navegador não tornam o ranking completamente à prova de manipulação.
