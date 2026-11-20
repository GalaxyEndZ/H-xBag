# HäxBag — Histórico consolidado de atualizações

Este arquivo agrupa integralmente as notas Markdown de atualizações que estavam na raiz do projeto original. Os nomes originais aparecem como títulos.


---

## HISTORICO_NAVEGADOR_V187.md

# HäxBag V187 — Histórico do navegador

O site agora usa `window.history.pushState`, `replaceState` e o evento `popstate`.
Não foi necessário instalar React Router, alterar o banco de dados ou recarregar a página.

## O que passa a funcionar

- Voltar e Avançar entre as páginas do RPG (Visão geral, Fichas, Campanhas, etc.).
- Voltar e Avançar entre seções do próprio Perfil.
- Navegar entre as abas do Social (Feed, Amigos, Seguindo, Seguidores, Descobrir, Mensagens, Bloqueados e Convite Social).
- Retornar à lista de fichas ou à ficha aberta anteriormente, e à lista de inimigos.
- Os links da barra de endereço restauram as seções correspondentes ao abrir ou atualizar a página, após o login.
- Campanha, temporada e ficha selecionadas podem ser preservadas na URL; permissões continuam sendo conferidas pelo sistema.

## Como testar

1. Execute `npm install` e `npm run build` (ou `npm run dev`).
2. Entre no site e abra **Social → Feed → Mensagens**.
3. Aperte **Voltar** no navegador: a aba Feed deverá reaparecer. Aperte **Avançar**: Mensagens reaparece.
4. Entre em **RPG → Fichas**, abra uma ficha e use Voltar/Avançar para alternar a lista e a ficha.
5. Atualize a página numa seção interna e confirme se a navegação foi restaurada.
6. Confira que URLs de convite com `?invite=...` continuam intactas.

## Alterações

- `src/App.tsx`: estados iniciados pela URL, registro e restauração do histórico de navegação.
- `src/siteNavigation.ts`: leitura/gravação/validação das rotas e detecção de mudanças relevantes.

## Notas

- Sem SQL novo.
- Parâmetros de URL pertencentes a convites, confirmação de conta e âncoras existentes são preservados.
- Caixas de diálogo temporárias, como confirmação de excluir, não geram etapas de histórico.
- A restauração de dados de campanhas/personagens depende do acesso do usuário e do carregamento da conta; histórico não concede permissões extras.
- Alterações não salvas em formulários não são gravadas pelo histórico do navegador.

---

## INSTALACAO_V188_MINIGAMES.md

# HäxBag V188 — Minigames / Pong

## Instalação

1. Substitua os arquivos do projeto pelos desta versão, mantendo seu `.env` e suas configurações locais.
2. Execute **`HaxBag_Pong_Ranking_V188.sql`** no SQL Editor do Supabase, após as migrações das versões anteriores.
3. Execute `npm install` e `npm run build` (ou `npm run dev` para testes locais).
4. Abra **Minigames** ao lado de **Social** e **RPG** e clique em **Começar partida**.

## Como jogar

- Controle a raquete azul com **W / S**, **setas ↑ / ↓**, **mouse** ou **toque**.
- **Espaço** pausa e retoma a partida; a partida pausa ao ocultar a aba.
- Cada devolução da bola vale **1 ponto**; cada gol marcado contra o computador vale **5 pontos**.
- Você tem **3 vidas**; quando acabar, a partida termina e a melhor pontuação fica no ranking global.
- Cada jogador aparece apenas uma vez na classificação, com seu melhor resultado.
- O ranking mostra os 25 maiores recordes; sua própria posição é exibida mesmo quando está fora do top 25.

## Banco e segurança

O SQL adiciona `hax_pong_runs`, `hax_pong_scores` e quatro funções RPC:
`hax_pong_start`, `hax_pong_finish`, `hax_pong_leaderboard` e `hax_pong_my_score`.

- O ranking exige login e conta identificada pelo `auth.uid()`.
- Tabelas com RLS habilitada, sem escrita direta do cliente; inserções e atualizações são feitas por RPC com verificação de dono da partida.
- Cada partida é enviada **uma única vez**; existe limite plausível de pontuação em função do tempo registrado pelo servidor.
- O Pong ainda abre se a migração estiver ausente, mas a pontuação não poderá ser registrada.
- **Limite de integridade:** o jogo roda no navegador, então a pontuação ainda pode ser falsificada por um cliente malicioso que respeite limites plausíveis. Para um ranking competitivo à prova de manipulação é necessário simular/verificar partidas no servidor.

## Navegação

A área usa `hb_page=minigames` na URL. Voltar e Avançar do navegador funcionam como na V187. A opção está no menu lateral, na barra superior e no atalho de navegação para celular.

## Testes realizados nesta entrega

- Validação sintática TypeScript/TSX.
- Testes da serialização da URL e reconhecimento de `hb_page=minigames`.
- Verificação da presença das funções e proteções na migração SQL.
- Validação de integridade do arquivo ZIP.

A compilação com `npm run build` e a execução real da migração no Supabase **não** foram validadas neste ambiente: o cache npm não contém as dependências do projeto.

---

## MELHORIAS_SOCIAL_V189.md

# HäxBag V189 — Social mais fluido

Esta versão parte da V188 e mantém Minigames/Pong, ranking global, histórico de navegação, RPG e as migrações anteriores.

## Mudanças

- Redesenho responsivo do Social: navegação, atalhos, editor de posts, cartões, pessoas e mensagens com maior consistência visual e respeito aos temas existentes.
- Feed com a opção **Mais interações**: ordena localmente as publicações já carregadas pela soma de curtidas e comentários, com desempate pela data. Essa seleção não consulta ou ordena o feed inteiro no servidor.
- Publicações com mais de 420 caracteres exibem um trecho inicial e os controles **Ler publicação completa** / **Mostrar menos**, sem alterar seu texto original.
- Mensagens privadas: pesquisa do texto dentro das **últimas mensagens carregadas** da conversa atual; contador de resultados e botão Limpar. A busca não examina mensagens mais antigas que ainda não foram carregadas.
- Mensagens privadas: botão **Copiar** disponível para mensagens de texto não apagadas; informa **Copiado** quando a cópia funciona.
- Ajustes de espaçamento, estados hover/foco, cartões e layout mobile.

## Instalação

1. Substituir os arquivos do projeto pelos desta versão, preservando o `.env`.
2. Instalar as dependências quando necessário: `npm install`.
3. Validar a compilação: `npm run build`.

Não é necessário SQL novo para a V189. As migrações das versões anteriores continuam sendo necessárias conforme os recursos ativados.

## Validação realizada

- 46 arquivos TypeScript/TSX passaram na análise de sintaxe com TypeScript.
- Os arquivos CSS passaram na análise sintática do PostCSS.
- A instalação das dependências no ambiente de edição não foi possível em modo offline (cache do npm incompleto); por isso, a compilação completa do projeto não foi confirmada.

---

## INSTALACAO_V190_ARCADE.md

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

---

## MELHORIAS_ARCADE_V191.md

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

---

## MELHORIAS_ARCADE_INFINITO_V192.md

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

---

## MELHORIAS_ARENA_MAPA_V193.md

# HäxBag V193 — Arena Infinita com mundo explorável

## Mudanças
- Arena sem bordas: o herói e inimigos possuem coordenadas mundiais sem limite fixo.
- Câmera acompanha o personagem suavemente; a área de 720×420 é somente a janela de visualização.
- Terreno gerado por células determinísticas, com pequenas pedras, vegetação, trilhas e marcas rúnicas. Voltar a uma região mostra o mesmo chão. Cenário é decorativo (sem colisões).
- Inimigos surgem fora da visão, a uma distância do jogador; perseguem no mapa grande e são descartados apenas quando ficam muito longe, para controlar memória.
- Projéteis e colisões operam em coordenadas do mundo; a mira do mouse usa a posição da câmera.
- Radar no canto superior direito mostra inimigos próximos.
- Mostradores de posição e distância percorrida.
- Disparos manuais (clique, Espaço/J, ATIRAR no celular), vidas, ondas, pausas, ranking e desafios diários mantidos.

## Instalação
Substitua os arquivos da V192 pelos da V193 e mantenha seu .env. Não há SQL novo.

## Arquivos alterados
- src/components/ArcadeCanvasGames.tsx
- src/components/MinigamesHub.css

---

## OTIMIZACOES_DESEMPENHO_V194.md

# HäxBag V194 — Otimização de desempenho

Base: projeto enviado pelo usuário em 19/11/2026 (`haxbag(20261119-210459).zip`).

## O que foi modificado

- `src/components/ArcadeCanvasGames.tsx`: mapa procedural da Arena pré-renderizado por tile em um cache LRU limitado a 180 células (aproximadamente 4,7 MB de pixels). Tiles existentes reutilizados mesmo com a câmera em movimento. Cálculos de distância quadrática nas colisões e busca de alvo, reduzindo chamadas caras a `Math.hypot`. Fundo em grade dos jogos de ação armazenado em canvas para evitar dezenas de traços a cada frame. Loops de RAF são desligados durante pausa, preservando o frame atual. Snake: criação de alimento com `Set` e busca visual do corpo com `Map`, evitando varreduras aninhadas durante a montagem de 400 células.
- `src/components/PongGame.tsx`: quadra, grade e rótulos estáticos gerados uma vez para cada escala do dispositivo (até três entradas de cache). A cada frame são desenhadas apenas a imagem do fundo, as raquetes e a bola. Formatador de números compartilhado.
- `src/components/MinigamesHub.tsx`: importações dinâmicas para Pong, jogos de Canvas e jogos de tabuleiro. Cada família é carregada apenas quando utilizada, usando `Suspense` no espaço do jogo. Formatadores de data e números compartilhados.
- `src/components/ArcadePuzzleGames.tsx`: cronômetro atualiza no máximo uma vez por segundo (antes eram 4 disparos por segundo), preservando o tempo acumulado e descontando as pausas.
- `src/components/FriendsPanel.tsx`: normalização dos termos de busca feita uma vez por filtragem (em vez de uma vez por item) nas buscas de pessoas, feed e mensagens.
- `src/components/SocialPostComments.tsx`: estrutura de respostas/threads memoizada; só é reagrupada quando a lista de comentários muda, e não a cada edição do texto.

## Preservado

- Nove minigames e suas regras, mapa ilimitado da Arena, tiros manuais e partidas infinitas até perda/encerramento.
- Ranking global, horários de Brasília, catálogo de desafios e prêmio de 1 a 10 moedinhas apenas após completar o conjunto de 3.
- Perfis, feed, chats, fotos, campanhas, fichas e regras do RPG.
- Não existem alterações no esquema ou nas funções do Supabase nesta versão. **Nenhum SQL novo.**

## Verificações

- Sintaxe TypeScript/TSX: 50 arquivos analisados, 0 erros de sintaxe.
- Teste isolado da Arena: renderização repetida da mesma região não cria novos tiles; em 300 posições, cache <= 180; terreno determinístico inclusive em coordenadas negativas.
- Teste isolado do Pong: 100 quadros reutilizam um único fundo; outra escala cria outro buffer.
- Importações locais dos cinco módulos inspecionados resolvidas.
- Estrutura e integridade do ZIP testadas após a criação.
- Não foi possível executar `npm ci`/`npm run build` completos: o pacote `vite` não estava no cache npm e não havia rede disponível. Verifique no ambiente com as dependências instaladas.

## Instalação / teste manual recomendado

1. Faça backup do projeto e mantenha seu `.env` atual (o ZIP não contém credenciais).
2. Atualize os arquivos do projeto usando esta versão.
3. Na pasta do projeto: `npm ci` e `npm run build`.
4. Teste pausar/retomar a Arena e o Pong, deslocar-se longas distâncias na Arena e voltar a regiões visitadas, alternar jogos e verificar o carregamento dos rankings e dos desafios.

**Observação:** otimizações foram concentradas nos pontos com trabalho repetido por frame e nas áreas Social/Arcade. Não foi realizada reestruturação completa do arquivo `App.tsx` nem aferição de FPS em um navegador real.

---

## AJUSTES_PLACAR_V199.md

# HäxBag V199 — Placar de fim de partida

## Correção

- Separa o rótulo "RESULTADO DA PARTIDA" da pontuação, evitando textos grudados (ex.: "PARTIDA650").
- Apresenta a pontuação com maior destaque visual, mantendo a unidade "pontos" separada.
- Ajusta a disposição do botão "Jogar novamente" em telas estreitas.
- Preserva o ranking global, o envio da pontuação, os jogos e os desafios diários.
- Não requer nenhuma migração SQL.

## Arquivos alterados

- `src/components/MinigamesHub.tsx`
- `src/components/MinigamesHub.css`

## Instalação

Para a correção pontual, extraia o ZIP de correção na raiz do projeto, preservando a estrutura de pastas. Para instalar o projeto completo, extraia a V199 em uma pasta separada e mantenha seu `.env` original.

Depois execute `npm run build` no seu ambiente.

---

## REORGANIZACAO_SISTEMA_GENERICO_V200.md

# HäxBag V200 — Sistema genérico de RPG

## O que foi reorganizado

- O **Genérico** agora é um sistema explícito no catálogo de campanhas, separado de Kisatsutai, Ciclos e CyberFlower.
- **Outro sistema (personalizado)** permanece disponível para manter nomes de sistemas informados pelo mestre, usando as regras neutras do Genérico quando não houver implementação específica.
- As regras neutras residem em `src/systems/generico/system.ts`, com recursos e módulos configurados e sem classes/graduações automáticas.
- O registro `src/systems/core/registry.ts` agora oferece um resolvedor estrito (`getSystemByName`) e um resolvedor com fallback seguro (`getEffectiveSystemByName`). Assim, nomes personalizados não são sobrescritos nem passam a ser confundidos com sistemas próprios.
- A definição de recursos visuais por sistema (PR/PM/PE) está nos módulos próprios, em vez de espalhada pelo componente principal.
- O editor genérico da ficha foi separado em `GenericProgressionEditor.tsx` e CSS próprio: **Modelo e estágio**, **Experiência e objetivo**, **Bônus da progressão**, **Regras e anotações**.
- A criação/edição de campanha mostra um resumo das características do sistema genérico ou personalizado.
- Sistemas com hierarquia específica (Kisatsutai) mantêm seu editor existente. Ciclos e CyberFlower compartilham o editor de progressão sem hierarquia, com os campos salvos anteriores preservados.
- Em fichas de sistemas personalizados, o seletor mostra o nome atual mesmo quando ele não pertence ao catálogo oficial.

## Compatibilidade

- Nenhuma tabela, coluna ou política Supabase foi alterada. **Sem SQL novo**.
- Os campos JSON existentes foram mantidos (`progression.system`, `progression.model`, `progression.currentStage`, `progression.experience`, `progression.nextRequirement`, `progression.statusBonuses` e `progression.rules`).
- Moedas, inventários, campanhas, perfis e minigames permanecem inalterados.
- A opção "Genérico" só cria uma campanha com o nome do sistema; não converte as campanhas existentes automaticamente.

## Validação

- `typescript.transpileModule`: 53 arquivos TS/TSX sem diagnóstico de sintaxe.
- `tsc` do registro e dos módulos de sistemas: compilou; testes de resolução Genérico/personalizado/sistemas próprios e rótulos de recursos passaram.
- CSS analisado pelo `postcss` sem erros de parsing.
- Build de produção completo ainda precisa ser executado com dependências instaladas: `npm ci && npm run build`.

---

## MELHORIAS_CHAT_V201.md

# HäxBag V201 — Conversas privadas redesenhadas

## Alterações

- Reorganização da lista de contatos: contador de conversas, busca, filtro de não lidas, visual selecionado e data da última mensagem.
- Cabeçalho da conversa mais compacto e consistente com os temas do HäxBag.
- Pesquisa dentro da conversa recolhível, aberta apenas ao clicar em **Buscar** (busca entre as mensagens carregadas).
- Mensagens consecutivas do mesmo remetente em até 5 minutos são agrupadas visualmente; a foto permanece no início do grupo.
- Balões ajustados ao texto, horários e ações **Copiar**/**Apagar** alinhados horizontalmente.
- Fotos em balões compactos, ampliáveis pela URL assinada já existente.
- Editor reorganizado com anexos, campo de mensagem, botão Enviar e instruções de teclado.
- Ajustes de interface e navegação para celulares e tablets; respeita os temas da temporada.

## Arquivos alterados

- `src/components/FriendsPanel.tsx`
- `src/components/SocialChatV201.css` (novo)

## Compatibilidade

Mantidas as RPCs existentes, as mensagens já salvas, permissões, bloqueios, fotos, exclusões, marcação de leitura, pesquisa e atualizações periódicas. **Nenhuma migração SQL é necessária.**

## Validação

- Sintaxe de 53 arquivos TS/TSX validada com TypeScript.
- Novo CSS validado com parser CSS.
- `npm run build` não pode ser concluído neste ambiente devido à falta das dependências de tipos do Node e do Vite.

Ao instalar a correção, preserve a pasta `.git` e os arquivos `.env` e execute `npm ci` e `npm run build` no seu computador.

---

## MELHORIAS_ARCADE_V202.md

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

---

## MELHORIAS_ARENA_V203.md

# HäxBag V203 — Arena Infinita evoluída

## Arena Infinita (upgrades exclusivos)
- Mapa explorável e infinito com câmera móvel e terreno procedural mantidos.
- Ataques continuam **manuais**; mouse/toque para mirar, clique, Espaço, J ou ATIRAR para disparar.
- Inimigos de elite surgem a cada cinco ondas e possuem barra de vida.
- Inimigos deixam cristais de XP para recolher; corações ocasionais recuperam vida.
- Esquiva com **Shift** ou botão ESQUIVA, com recarga visível.
- Melhorias adicionais: ímã de essência, esquiva arcana e golpe certeiro.
- Partidas infinitas com ranking e desafios preservados.

## Curva de nível equilibrada
- Antes: `floor(4 + nivel * 2.5)` XP para subir.
- Agora: `floor(20 + (nivel - 1)*7 + 3*(nivel - 1)^1.45)` XP para subir, a partir do nível 1.
- Custos por nível: nível 1→2: 20 XP; 2→3: 30 XP; 5→6: 70 XP; 10→11: 155 XP.
- Inimigos comuns / corredores: 1 XP; resistentes: 2 XP; elites: 8 XP.
- O excedente de XP é preservado ao subir de nível; não há limite de nível.
- XP só é ganho ao **coletar os cristais**; derrotar inimigos não concede XP automaticamente.

## Asteroids
- Jogo clássico preservado sem experiência, níveis ou cartas de upgrades.
- Controles, pontuação, tela ampliada e ranking mantidos.

## Implantação
- Não precisa executar SQL.
- Aplique o pacote de correção à raiz do projeto, sem substituir `.git` ou `.env`.
- Recomendado validar com `npm ci` e `npm run build` no ambiente local.

---

## MELHORIAS_ASTEROIDS_VOO_V204.md

# HäxBag V204 — Asteroids e Voo Infinito

Base: HäxBag V203. Esta versão altera a jogabilidade e a apresentação de dois minigames, sem modificar o banco de dados, os rankings ou o catálogo de desafios.

## Asteroids — arcade clássico aprimorado

- Asteroides com três tamanhos e silhuetas irregulares. Rochas grandes se fragmentam em duas médias; médias se fragmentam em duas pequenas.
- Cada acerto que destrói um fragmento vale 20 pontos, preservando a pontuação básica de Asteroids e as metas do catálogo existente.
- Colisão toroidal: nave, tiros e asteroides atravessam as bordas e interagem corretamente ao redor do mapa.
- Novos asteroides aparecem com distância de segurança da nave; dificuldade cresce gradualmente por tempo e pontos, sem fase final.
- Movimento da nave com inércia mais previsível, aceleração, rotação, freio manual, impulso visual e invulnerabilidade temporária após sofrer dano.
- Fundo de estrelas, rachaduras nos asteroides, partículas de impacto e vibração visual curta.
- Controles: A/D ou ←/→ para girar; W/↑ para acelerar; S/↓ para frear; Espaço para atirar. Botões para tela de toque.
- **Sem experiência, níveis ou seleção de upgrades.** Essas mecânicas permanecem exclusivas da Arena Infinita.

## Voo Infinito — jogabilidade e cenário

- Fundo redesenhado com gradiente, estrelas, nuvens e montanhas em paralaxe; pássaro com animação das asas e rastro do impulso.
- Aberturas dos obstáculos variam gradualmente de forma a evitar saltos bruscos impossíveis.
- A velocidade aumenta progressivamente, com limite de segurança para preservar a jogabilidade em partidas longas.
- Colisão mais precisa entre o pássaro circular e os tubos, em vez de depender apenas de caixas retangulares.
- HUD com obstáculos superados e distância estimada percorrida, sem aumentar a pontuação indevidamente.
- Cada obstáculo superado continua valendo **5 pontos**. Partida termina em colisão ou por decisão do jogador.
- Espaço, W, ↑, clique ou toque ativam o voo; pressionar continuamente a tecla não causa disparos de batidas automáticas.
- Canvas com resolução adaptativa, incluindo tela cheia.

## Compatibilidade

- A pontuação continua sendo reportada pelos mesmos callbacks ao ranking global.
- Desafios diários e seus valores não foram alterados.
- Sem novos campos de banco ou migração SQL.
- O ZIP de correção contém somente os arquivos alterados e preserva `.git` e `.env`.

## Validação

- 54 arquivos TS/TSX analisados com transpileModule, sem erros sintáticos.
- 56 arquivos CSS analisados quanto ao balanceamento de blocos.
- A compilação `npm run build` e os testes visuais de física precisam ser executados em ambiente com dependências instaladas.

---

## CORRECAO_ASTEROIDS_FRAGMENTACAO_V205.md

# HäxBag V205 — Fragmentação do Asteroids corrigida

Corrige a V204, preservando a Arena Infinita, os outros minigames, os rankings e os três desafios diários.

## O que mudou

- A quebra agora gera fragmentos visivelmente separados **no primeiro quadro**.
- Asteroide grande (tier 3) -> 2 médios (tier 2); cada médio -> 2 pequenos (tier 1); pequenos são destruídos.
- Os dois fragmentos ganham impulsos em direções opostas e brilho breve.
- Um curto período de proteção após a quebra evita colisões injustas com a nave quando os fragmentos surgem.
- Tiros agora são testados ao longo do movimento entre quadros, inclusive ao cruzar as bordas do cenário.
- O painel exibe o contador de fragmentações da partida.
- Pontuação por acerto permanece em 20 pontos, sem XP ou upgrades no Asteroids.

## Arquivos alterados

- `src/components/ArcadeCanvasGames.tsx`
- `src/components/ArcadeAsteroidFragmentation.ts` (novo)

## Instalação

Para manter sua pasta `.git` e quaisquer outras alterações, use **HaxBag_Correcao_Asteroids_Fragmentacao_V205.zip** e extraia na raiz do projeto (a pasta que contém `src`), permitindo substituir os arquivos.

O pacote completo é uma alternativa caso você prefira a versão inteira. Preserve seu `.env`.

Não é necessário executar SQL novo.

## Verificação

Testes unitários de lógica executados: grande -> dois médios -> quatro pequenos; ausência de nova divisão dos pequenos; separação visível; detecção de tiros rápidos e de passagem pelas bordas; casos sem colisão.

56 arquivos TypeScript/TSX passaram na verificação sintática. O build completo e a experiência visual no navegador ainda precisam ser testados no ambiente com as dependências instaladas.

---

## CORRECAO_TIPAGEM_PROJETEIS_V206.md

# HäxBag V206 — correção de tipagem dos projéteis

## Problema
Na V205, o tipo `Shot` era compartilhado por Asteroids e Arena Infinita, mas a Arena cria projéteis com `damage`, `pierce`, `hitIds` e `critical`. O TypeScript retornava TS2353 e TS2339 porque tais atributos não existiam no tipo básico.

## Correção
- Mantido `Shot` como tipo simples, utilizado por Asteroids (sem upgrades).
- Criado `ArenaShot = Shot & { damage: number; pierce: number; hitIds: number[]; critical: boolean }`.
- O estado de projéteis de Arena agora usa `ArenaShot[]`.
- A lógica da Arena passa a usar esses campos com tipagem obrigatória, sem optional chaining desnecessário.
- Fragmentação dos asteroides, Voo Infinito, rankings, desafios diários e upgrades exclusivos da Arena não foram modificados.

## Como instalar a correção pontual
Extraia o conteúdo do arquivo `HaxBag_Correcao_Tipagem_Tiros_V206.zip` na raiz do projeto HäxBag, substituindo apenas `src/components/ArcadeCanvasGames.tsx`. Faça backup se tiver alterações locais próprias nesse arquivo. Depois execute `npm run build`.

## Verificações
- TypeScript 5.8.3: checagem de tipos do componente e suas dependências imediatas com definições mínimas de React, sem erros.
- Análise sintática dos arquivos `.ts` e `.tsx` do projeto.
- Não foi possível executar `npm run build` completo neste ambiente por indisponibilidade das dependências Vite/React locais.
- Nenhuma migração SQL é necessária.

---

## MELHORIAS_TABULEIROS_V207.md

# HäxBag V207 — Snake, 2048 e Campo Minado

Atualização visual, baseada na V206. Nenhuma migração SQL necessária.

## Snake
- Painel compacto com pontuação, rodada, tamanho e velocidade.
- Tabuleiro escuro em tons de floresta, segmentos da serpente com gradiente e cabeça orientada à direção do movimento.
- Frutas realçadas com brilho suave e indicação da pontuação por fruta.
- Controles direcionais em cruz, com suporte contínuo a setas, WASD e deslize.

## 2048
- Blocos com paleta de cores própria para cada número, incluindo os valores superiores a 2048.
- Animação curta ao aparecer/alterar uma peça e legibilidade aprimorada em celulares.
- Placar separado para pontos, maior peça e movimentos.
- Orientações e controles em cruz.

## Campo Minado
- Novo tabuleiro com casas tridimensionais e cores distintas para as pistas numéricas.
- Indicador de progresso de casas seguras e contagem de minas restantes.
- Modos **Revelar** e **Bandeira** visíveis, sem alterar a funcionalidade de clique direito.
- Estado de vitória, mensagens de orientação e passagem de rodada destacados.

## Compatibilidade
- Mesmos cálculos de pontuação e mesma lógica de jogos infinitos da V206.
- Rankings globais, desafios diários e carteira de moedas intactos.
- Sem mudanças no banco, Arena, Asteroids, RPG, Social ou autenticação.

## Arquivos alterados
- `src/components/ArcadeCanvasGames.tsx`
- `src/components/ArcadePuzzleGames.tsx`
- `src/components/MinigamesHub.tsx`
- `src/components/ArcadeBoardVisualsV207.css` (novo)

## Verificação
- Transpilação/parsing de todos os 55 arquivos TypeScript/TSX: sem erros de sintaxe.
- Parsing de todos os 57 arquivos CSS: sem erros.
- O build completo precisa ser executado com as dependências instaladas: `npm ci && npm run build`.

---

## ALTERACOES_ARCADE_V208.md

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

---

## RENOVACAO_LOGIN_V210.md

# HäxBag V210 — nova entrada no universo

## Arquivos modificados
- `src/Auth.tsx`
- `src/Auth.css`

## Interface
- Página de entrada com identidade visual, emblema original, portal decorativo vetorial/CSS e destaque para campanhas, personagens e comunidade.
- Área de autenticação com troca direta entre Entrar e Criar conta.
- Recuperação de senha em uma vista dedicada, sem deixar o formulário de login visível por trás.
- Formulários responsivos, estados de carregamento e mensagens acessíveis.
- Cadastro com confirmação de senha e ajuda visual de robustez (indicativa, sem alterar a regra de no mínimo 8 caracteres do cadastro).

## Compatibilidade
- Mesmo backend de autenticação existente (Supabase).
- Consulta `is_username_available` preservada.
- Tokens `ref` e `invite` preservados durante o cadastro.
- Nenhuma alteração de tabelas, RLS, contas, perfis ou regras do site.

## Instalação
Extraia a correção na raiz do projeto, preservando `.git` e `.env`. Depois rode `npm run build` e teste login, cadastro, recuperação e convites no navegador.

Não há novo SQL.

---

## MELHORIAS_LOGIN_V211.md

# HäxBag V211 — Portal de Entrada refinado

Base: **V210**. Esta atualização altera somente a interface de autenticação.

## Melhorias

- Portal visual com halos, marcas arcanas, partículas delicadas e emblema oficial, sem imagens externas adicionais.
- Área de apresentação revisada, com melhor contraste, recursos em destaque e acabamento ornamental.
- Formulários de Entrar/Criar conta/Recuperar com hierarquia visual, transições suaves e ícones vetoriais locais nos campos.
- Aviso de Caps Lock durante a digitação da senha, confirmação visual de senha e feedback de carregamento no botão.
- Ajustes em tamanhos de campo, estados de foco, espaçamentos, contrastes e telas pequenas.
- Animações reduzidas automaticamente quando o navegador solicita movimento reduzido.

## Instalação (correção)

1. Extraia a **correção V211** diretamente na pasta raiz do projeto HäxBag, mantendo a estrutura `src/`.
2. Substitua `src/Auth.tsx` e `src/Auth.css`.
3. Não sobrescreva as pastas `.git`, `node_modules` nem o arquivo `.env`.
4. Com as dependências instaladas, execute `npm run build` e teste login, cadastro, convite e recuperação de senha no navegador.

**Sem SQL novo.** O cadastro, o login e a recuperação continuam utilizando as mesmas chamadas Supabase da V210.

## Validação realizada

- 56 arquivos TS/TSX analisados sintaticamente (sem erros de sintaxe).
- 59 arquivos CSS com chaves balanceadas; `Auth.css` passou na análise do parser CSS.
- ZIPs verificados quanto à integridade.

**Limitação:** o build completo não foi executado neste ambiente; faltam dependências do projeto no cache local. Execute `npm run build` no seu computador antes de publicar.

---

## AJUSTE_BOAS_VINDAS_V212.md

# HäxBag V212 — mensagem de entrada inclusiva

A V211 usava "Que bom ter você de volta." na aba Entrar, mesmo para pessoas que nunca haviam acessado o site.

Na V212, a tela de login usa a saudação neutra "O portal está aberto." e explica que é possível entrar com uma conta existente **ou criar uma nova**. O rótulo também passou a ser "SEU ACESSO AO HÄXBAG".

As telas de Criar conta e Recuperar acesso continuam com mensagens próprias. Nenhuma rotina de autenticação ou estilo visual foi alterado.

## Aplicação da correção

Copie `src/Auth.tsx` para a mesma pasta do seu projeto, preservando `.git` e `.env`. Não é necessário SQL. Execute `npm run build` no seu ambiente.
