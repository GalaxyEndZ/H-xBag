# HäxBag V202 — Arena Infinita, Asteroids e telas ampliadas

## Sistema de evolução durante a partida

- Asteroids e Arena Infinita agora recebem experiência ao destruir asteroides e derrotar inimigos, respectivamente.
- Cada subida de nível interrompe a simulação e oferece três melhorias aleatórias diferentes.
- É possível escolher clicando, tocando ou pressionando as teclas 1, 2 e 3.
- Cada melhoria possui níveis próprios. Melhorias como vida, dano, velocidade e experiência continuam disponíveis em partidas longas, sem impor um nível máximo global.
- Barra de XP, nível atual e quantidade de melhorias exibidas na interface.
- Todos os upgrades valem apenas para a partida em andamento; não alteram perfis, campanhas ou a economia do RPG.

### Asteroids

1. Gatilho veloz — menos espera entre disparos.
2. Salva estelar — mais projéteis por disparo.
3. Propulsor iônico — maior aceleração.
4. Casco reforçado — mais vida máxima e recuperação.
5. Projéteis de plasma — mais velocidade e alcance.
6. Laser perfurante — tiros atravessam asteroides.
7. Escudo temporal — mais invulnerabilidade após dano.
8. Computador tático — mais experiência por asteroide.

### Arena Infinita

1. Disparo relâmpago — menor intervalo entre ataques manuais.
2. Rajada múltipla — mais projéteis por ataque.
3. Munição rúnica — aumenta o dano por projétil.
4. Perfuração — projéteis atravessam múltiplos inimigos.
5. Passos velozes — movimentação mais rápida.
6. Vigor ancestral — mais vida máxima e recuperação.
7. Alcance ampliado — tiros mais rápidos e de maior duração.
8. Regeneração — cura gradual periódica.

**Os disparos na Arena continuam manuais**: o jogador decide quando atirar.

## Tela de jogo maior

- Ranking individual aparece abaixo da área principal, liberando espaço horizontal.
- Canvas dos jogos pode ocupar até 1180 px sem distorcer a proporção 720×420.
- Asteroids e Arena renderizam o canvas em resolução interna adaptativa, mantendo a lógica nas coordenadas originais.
- Pong e tabuleiros de Snake, 2048, Campo Minado e Memória Arcana também ganham mais espaço.
- Botão "Ampliar tela" usa o modo de tela cheia do navegador quando disponível.
- Regras de responsividade preservadas para celulares.

## Compatibilidade e testes

- Base: HäxBag V201.
- Arquivos TS/TSX revisados com validação sintática: 54.
- Checagem semântica isolada dos componentes de upgrades e canvas: passou.
- Catálogo de upgrades: sorteio de 3 opções distintas e continuidade após 300 escolhas simuladas por jogo.
- CSS: parse e balanceamento verificados.
- Não modifica a estrutura de pontuação no banco, o ranking global nem os três desafios diários com pagamento conjunto de 1–10 moedas.
- **Nenhuma migração SQL nova.**
- O build completo (`npm ci && npm run build`) ainda depende das bibliotecas do projeto instaladas; não foi possível rodá-lo neste ambiente sem dependências.

## Instalação da correção pontual

Extraia `HaxBag_Correcao_Arcade_Upgrades_V202.zip` na pasta raiz do projeto, substituindo os cinco arquivos correspondentes e criando os novos arquivos de upgrade. Preserve `.env` e `.git`.
