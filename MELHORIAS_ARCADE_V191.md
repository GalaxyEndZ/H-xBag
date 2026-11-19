# HäxBag V191 — Minigames aprimorados

Base: V190. Não é necessária migração SQL adicional.

## Breakout: modo infinito
- Os blocos são recriados ao terminar cada onda, sem encerrar a partida nem zerar a pontuação.
- Formações passam a variar; algumas peças ficam mais resistentes em ondas avançadas.
- A velocidade aumenta gradualmente e a raquete encolhe até um limite jogável.
- Indicadores de onda, blocos restantes, pontuação e vidas; pausa curta antes do próximo saque.
- A partida termina ao perder todas as vidas, ou quando o jogador escolhe **Encerrar e registrar**, salvando a pontuação no ranking.

## Arena Infinita
- Disparos totalmente manuais: clique/segure, Espaço ou J; botão ATIRAR no celular.
- Mira por mouse/toque, ou direcionamento automático **apenas da mira**, nunca disparo automático, quando não houver ponteiro.
- Ondas mais rápidas, mais inimigos e três tipos de ameaça: perseguidor, corredor e bruto resistente.
- Indicadores de ondas, mira, dano e invulnerabilidade temporária; opção de encerrar e registrar a pontuação.

## Melhorias gerais
- Pausa/retomada por botão, P ou Esc para os oito novos jogos (não altera o Pong).
- Pausa ao ocultar a aba do navegador; preserva estado e temporizadores durante a pausa.
- Controles táteis por deslize no Snake e no 2048, além dos botões de direção.
- Campo Minado: minas colocadas após a primeira abertura segura, cronômetro começa nela.
- Memória Arcana: cronômetro inicia ao virar a primeira carta e pausa o fechamento de pares durante a pausa.
- Botões, instruções, painel de informações e layout responsivo aprimorados.
- Rankings globais e os três desafios por dia mantidos; as moedinhas continuam sendo creditadas uma só vez após completar os três.

Instalação: substituir os arquivos da V190 pelos da V191, preservar o `.env`, `npm install` e `npm run build`.
