# HäxBag — Histórico de notas e correções

Este arquivo reúne, integralmente, notas antigas de versões do HäxBag. Nenhuma regra, correção ou observação foi resumida. Os nomes originais permanecem como títulos para facilitar a pesquisa.

## Índice dos arquivos originais

- `CORRECAO_AUTORES_DENUNCIAS.md`
- `MELHORIAS_NAVEGACAO_V216.md`
- `MELHORIAS_PERICIAS_ARQUETIPO_V217.md`
- `CORRECAO_F5_FICHAS_V218.md`
- `MELHORIAS_KITS_EQUIPAVEIS_V219.md`
- `CORRECOES_CONDICOES_E_GRUPO_V220.md`
- `LIMITE_PERICIAS_V221.md`
- `AJUSTE_ESPACAMENTO_PERFIL_V222.md`
- `CORRECAO_NATUREZA_CONDICOES_V223.md`
- `KITS_EQUIPAR_INVENTARIO_V225.md`
- `CORRECAO_CABECALHO_PERFIL_V228.md`
- `CORRECAO_LINHA_BANNER_PERFIL_V229.md`
- `MELHORIAS_PERFIS_V230.md`
- `MELHORIAS_SOCIAL_V231.md`
- `REDESIGN_SOCIAL_V232.md`
- `REDESIGN_PERFIS_V233.md`
- `PAINEL_ADMINISTRATIVO_V234.md`
- `PAINEL_ADMINISTRATIVO_V236.md`
- `PAINEL_ADMINISTRATIVO_PERFIS_V238.md`
- `CORRECAO_ACESSO_PAINEL_V239.md`
- `AJUSTE_COR_SEGUIR_PERFIL_V243.txt`
- `NOTIFICACOES_SEGUIDORES_V244.md`
- `CORRECAO_SOCIAL_TABS_V247.md`
- `CORRECAO_PROTECAO_KITS_V253.md`
- `CORRECAO_PARTICIPANTES_COMUNIDADES_V257.md`
- `NOTIFICACOES_CLICAVEIS_V259.md`
- `RECUPERACAO_TELA_PRETA_V263.md`
- `SOCIAL_NAVEGACAO_V265.md`
- `CORRECAO_REACOES_V266.md`
- `FLUXOS_ARVORE_V267.md`
- `AJUSTE_FLUXOS_V268.md`
- `MELHORIA_ARVORE_FLUXOS_V269.md`
- `CORRECAO_FLUXOS_V270.md`
- `MELHORIAS_COMBATE_CRITICOS_INICIATIVA_V272.md`
- `MELHORIAS_DANO_V273.md`
- `COMBATE_DANO_CLASSE_PR_V275.md`
- `BOTAO_DANO_V276.md`
- `MELHORIAS_ACOES_COMBATE_V277.md`
- `MELHORIAS_ACOES_COMBATE_V278.md`
- `CORRECAO_COMENTARIOS_COMUNIDADES_V280.md`
- `CORRECAO_TEXTO_FLUXOS_V281.md`
- `REGRAS_FORMAS_CRITICOS_V282.md`
- `ATUALIZACAO_CRITICOS_MESTRE_V283.md`
- `REDESIGN_COMUNICACAO_V285.md`
- `CORRECAO_CRIACAO_SERVIDORES_V286.md`
- `REDESIGN_COMUNICACAO_V287.md`
- `CORRECAO_COMUNICACAO_V289.md`
- `CORRECAO_AUTH_DESKTOP_V292.md`

---



---

## Arquivo original: `CORRECAO_AUTORES_DENUNCIAS.md`

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


---

## Arquivo original: `MELHORIAS_NAVEGACAO_V216.md`

# HäxBag V216 — Navegação sem botões duplicados

## O que mudou

- Removida a segunda barra de troca de espaços (Social / RPG / Minigames) do cabeçalho superior.
- Mantida a navegação original na barra lateral, com as mesmas ações, indicadores de seleção e acessibilidade.
- Mantido o botão **Menu** no cabeçalho para abrir a barra lateral em telas menores, além dos atalhos do rodapé móvel.
- Removidos os estilos CSS que eram exclusivos da barra superior duplicada.
- O restante do cabeçalho (localização atual, busca, notificações e sair) permanece inalterado.

## Instalação

Extraia o ZIP de correção na raiz do projeto e substitua os dois arquivos:

- `src/App.tsx`
- `src/components/SocialRpgSpacesV159.css`

Não há alterações no banco de dados; **não é necessário SQL**.

## Validação

Execute `npm run build` no ambiente de desenvolvimento antes de publicar.


---

## Arquivo original: `MELHORIAS_PERICIAS_ARQUETIPO_V217.md`

# HäxBag V217 — Perícias de Arquétipo (Kisatsutai)

## Catálogo oficial atualizado

Os cinco grupos continuam com sete perícias cada (35 no total):

- **Defensores:** Atletismo, Escudo, Imobilizar, Atrair, Deter, Fortitude, Derrubar.
- **Linha de Frente:** Acrobacia, Reflexos, Liderança, Corrida, Arremesso, **Tática**, Técnica.
- **Flanco:** Crime, Furto, Infiltração, Armadilhas, Armas Brancas, Trapaça, Camuflagem.
- **Especialistas:** Reprimir, Investigação, Percepção, Pontaria, Linguagem de Código, Montagem, Preparo.
- **Suporte:** Primeiros Socorros, Medicina, Psicologia, Terapia, Farmácia, Demonologia, Sorte.

**Mudança em relação à V216:** a perícia *Saltar* saiu do grupo Linha de Frente, substituída por *Tática* com a descrição oficial: “Mede a visão de campo de batalha (tanto de inimigos quanto de aliados).” O texto de *Trapaça* permanece como enviado, inclusive a observação de que necessita revisão; não foi criada uma regra mecânica nova.

## Compatibilidade com fichas anteriores

- Dados de personagens que escolheram `Linha de Frente:Saltar` **não são apagados nem alterados automaticamente**.
- Na distribuição de perícias e nos pontos de Intelecto, seleções removidas do catálogo aparecem identificadas como antigas e podem ser substituídas pelo mestre/jogador com permissão de edição.
- Os pontos antigos não são transferidos automaticamente para Tática ou outra perícia: a escolha deve ser deliberada.
- Enquanto não forem substituídos, os registros antigos deixam de ser opções ativas de testes, kits novos e condições do catálogo, mas permanecem gravados na ficha.
- O resumo de perícias treinadas avisa quando há treinamento de catálogo antigo nos dados.
- Os grupos de perícias gerais/extras não foram modificados.

## Instalação

Para quem está usando V216, extraia o ZIP de correção na **raiz do projeto** substituindo:

- `src/systems/kisatsutai/extendedData.ts`
- `src/App.tsx`

O SQL do Supabase não precisa ser alterado: o catálogo é definido no frontend. As fichas existentes permanecem no banco como estavam.

## Validação

`tsc -b --force --pretty false` executado com sucesso. O build Vite não foi concluído no ambiente Linux porque o `node_modules` de origem Windows não tem o binding `@rolldown/binding-linux-x64-gnu`. Depois de instalar as dependências na máquina local, execute `npm run build` antes de publicar.


---

## Arquivo original: `CORRECAO_F5_FICHAS_V218.md`

# HäxBag V218 — Manter a ficha aberta após F5

## Correção

Ao atualizar a página, o aplicativo limpava a campanha e o personagem selecionados antes de concluir a recuperação da sessão de usuário. Assim que os personagens carregavam novamente, o sistema abria a primeira ficha da lista.

Agora as rotinas de carregamento de campanhas, temporadas e personagens aguardam o fim da autenticação antes de validar ou zerar as seleções existentes. A URL da ficha continua guardando a campanha, a temporada e o personagem, permitindo recarregamento e links diretos.

## Instalação

Extraia este patch na raiz do projeto V217, substituindo `src/App.tsx`. A versão completa V218 pode ser usada como alternativa.

## Testes sugeridos

1. Abra a segunda ou terceira ficha de uma campanha e confira que a URL contém `hb_page=sheets`, `hb_character=...` e `hb_sheet=1`.
2. Pressione F5 e confirme que a mesma ficha e temporada continuam abertas.
3. Teste uma campanha diferente, a navegação Voltar/Avançar e o botão Voltar à lista.
4. No computador de desenvolvimento, execute `npm run build` antes de publicar.

Não há alterações de SQL, de dados das fichas ou de permissões.


---

## Arquivo original: `MELHORIAS_KITS_EQUIPAVEIS_V219.md`

# HäxBag V219 — Kits equipáveis e descanso

Atualiza os equipamentos de descanso e os bônus de perícia por posição, sem alterar os dados já salvos no Supabase.

| Tipo | Exemplo | Descanso relacionado | Bônus oficiais | Peso |
| --- | --- | --- | --- | --- |
| Equipável simples | Saco de dormir | Precário | Duas perícias gerais/extras: +10 / +10 | 1 kg |
| Equipável padrão | Futon | Mediano | Duas perícias de arquétipo: +15 / +10 | 2 kg (mantido da regra anterior) |
| Equipável raro | Barraca de acampamento | Completo | Três de arquétipo OU duas de arquétipo e uma geral: +15 / +15 / +10 | 4,5 kg (mantido da regra anterior) |

## O que muda

- Editor de kit no Inventário, nas Lojas e no Baú do Mestre: exibe bônus individuais, sem permitir definir valores arbitrários para kits novos.
- Quando o nome ainda não foi informado, sugere automaticamente o item correspondente ao subtipo escolhido.
- Os kits novos passam a guardar `metadata.kitSkillBonuses` (array na ordem das perícias) e `metadata.kitRestType`. Não exige novas colunas nem SQL.
- As fichas e a mesa de combate leem os novos bônus individualmente, apenas com o kit equipado.
- A seção Descanso e Recuperação identifica equipamentos de descanso equipados que correspondem ao descanso selecionado, sem exigir/consumir automaticamente o equipamento nem alterar as fórmulas de recuperação.
- Equipamentos antigos que tenham apenas `metadata.kitSkillBonus` continuam funcionando com o bônus uniforme anterior até serem editados e salvos novamente.
- A antiga opção de proteção moderada do kit padrão e a antiga opção de perícia principal do kit raro continuam disponíveis apenas para editar itens antigos. Não são opções oferecidas na criação de kits novos.
- O efeito exclusivo do kit raro é opcional, porque a regra atualizada não o exige.

## Instalação

Aplique a correção na raiz da sua instalação V218 (sobrescrevendo somente os arquivos relacionados). Não substitua suas pastas `.git`, `node_modules` nem `.env`.

Execute `npm run build` em seu computador antes de publicar. Validação TypeScript executada com sucesso neste ambiente; build Vite não executado devido à dependência nativa ausente no conjunto original de `node_modules` (proveniente de Windows).


---

## Arquivo original: `CORRECOES_CONDICOES_E_GRUPO_V220.md`

# HäxBag V220 — Correção de interface e intensidade das condições

## Correção de erro de execução ao abrir fichas
- A leitura de `group` nas informações de graduação passa a tolerar graduações indisponíveis durante o carregamento inicial, evitando a exceção `Cannot read properties of undefined (reading 'group')`.
- O painel de descanso e os testes de recuperação lidam com grupos temporariamente indisponíveis sem interromper a renderização.
- O editor de kits e a validação das perícias toleram um agrupamento desconhecido, exibindo opções vazias/erro de validação em vez de travar a página.

## Condições por natureza
| Natureza | Nível 1 (normal) | Nível 2 (grave) | Nível 3 (critica) | Nome do campo |
|---|---|---|---|---|
| Ruim | Normal | Grave | Crítica | Gravidade |
| Boa | Leve | Potente | Excepcional | Potência |
| Neutra | Leve | Moderada | Intensa | Intensidade |

- O mestre visualiza e edita com nomes adequados à natureza; filtros e bibliotecas usam os mesmos nomes.
- O radar de condições críticas continua contando apenas condições *ruins* classificadas com o nível interno `critica`.
- Os IDs persistidos `normal`, `grave` e `critica` NÃO mudam; não há SQL/migração e nenhum efeito é alterado automaticamente.

## Instalação
Extraia o ZIP de correção na raiz do projeto V219, substituindo os arquivos de mesmo nome. Faça backup antes de alterar o projeto. Depois, execute `npm run build` na sua máquina e publique os arquivos gerados normalmente. Uma atualização de página com Ctrl+F5 ajuda a carregar o novo JavaScript.

## Validação
- `tsc -b --force` com TypeScript global 5.8.3: sem erros.
- CSS analisado sintaticamente e ZIPs verificados.
- Build Vite não realizado neste ambiente por falta do pacote binário nativo Linux `@rolldown/binding-linux-x64-gnu` nas dependências do Windows.


---

## Arquivo original: `LIMITE_PERICIAS_V221.md`

# HäxBag V221 — Limite +25 nas perícias do Kisatsutai

## Atualização
- Perícias gerais/extras e perícias de arquétipo agora aceitam treinamento de até +25.
- Desenvolvimento por Intelecto: cada ponto ainda vale +5; os seletores impedem exceder o limite.
- O valor exato do treinamento passa a ser salvo em `skills.extraTrainingBonuses` (junto a `skills.extraTrainings` legado). Fichas antigas continuam compatíveis e **não são alteradas automaticamente**.
- O bônus **efetivo total** de cada perícia (treinamento, modificadores de condições, kits e preparo aplicáveis) tem teto +25. Penalidades continuam valendo.
- Exibição de treinamento, testes de perícia, ações complexas e painel de condições usam o valor correto.
- As seis perícias principais não são afetadas.

## Instalar
Extraia o ZIP de correção na raiz do projeto V220, substituindo os arquivos em `src/`.
Não execute SQL. Nenhuma migração é necessária: os novos valores numéricos são salvos no JSON das fichas quando editados.

## Validação
`tsc -b --force` passou sem erros. Testes do helper de limites, inclusive de compatibilidade com valores antigos, passaram.
O Vite não concluiu o build neste ambiente: falta o binário nativo `@rolldown/binding-linux-x64-gnu` nas dependências fornecidas para Windows. Execute `npm run build` no Windows antes de publicar.


---

## Arquivo original: `AJUSTE_ESPACAMENTO_PERFIL_V222.md`

# HäxBag V222 — Espaçamento das ações no perfil público

## Arquivo alterado
- `src/components/ProfileSocialV164.css`

## Ajustes
- Aumenta a distância horizontal entre **Seguindo**, **Enviar mensagem** e **Publicações e fotos** para 16 px no desktop, com 12 px entre linhas.
- Aplica uma área de respiro acima e abaixo dos botões, mantendo os três alinhados ao início do conteúdo.
- Unifica a altura mínima de 44 px e melhora a centralização dos textos.
- Em telas até 620 px, organiza os três botões em duas colunas com **Publicações e fotos** ocupando a segunda linha inteira. Se houver apenas um ou dois botões, o layout continua proporcional.
- Em telas de até 380 px, apresenta um botão por linha para não cortar o texto.
- Mantém as ações, permissões e regras de seguimento/mensagens inalteradas.

## Instalação
Extraia o ZIP de correção na raiz do HäxBag V221, substituindo o CSS correspondente, e recarregue a página com Ctrl+F5.

Não requer SQL. Alteração apenas visual.


---

## Arquivo original: `CORRECAO_NATUREZA_CONDICOES_V223.md`

# HäxBag V223 — Natureza das condições corrigida

## Problema
Nas fichas, condições Boas ou Neutras eram exibidas como **Prejudiciais**.
O painel do mestre buscava `hax_list_condition_polarities` (natureza armazenada separadamente), mas os componentes de fichas e inimigos consultavam apenas `hax_list_condition_definitions`. Quando `polarity` vinha ausente, o código a transformava em Ruim.

## Correções
- Ficha do personagem: busca e combina as naturezas reais com as condições ativas.
- Ficha do inimigo: usa a mesma classificação correta.
- Biblioteca pública: consulta natureza separadamente e mantém o filtro compatível.
- Painel do mestre: centraliza a mesclagem e não interpreta ausência de dados como Ruim.
- Tratamento explícito para natureza ausente: exibe **Não informada** em vez de **Prejudicial**.
- Evita que uma condição sem natureza carregada seja editada e salva acidentalmente como Ruim.
- Não altera níveis, dados, efeitos, permissões ou registros no banco.

## Instalação
- **Projeto completo**: substitua a pasta pelo conteúdo do ZIP completo (preserve seu `.env` local).
- **Correção incremental**: extraia o ZIP de correção na raiz do projeto existente, mantendo as pastas `src/` e substituindo os dois arquivos.
- Depois, execute `npm run build` no ambiente do projeto e publique normalmente. Para recarregar a interface, use Ctrl+F5.
- Não é necessária migração SQL para a correção em projetos que já têm a RPC `hax_list_condition_polarities` funcionando.

## Validação
- Sintaxe TSX: aprovada no compilador TypeScript.
- Tipos das funções de mesclagem: aprovados com `tsc --strict`.
- Testes de lógica: cenários Boa, Neutra, Ruim, definição não retornada e natureza ausente aprovados.
- Build Vite do projeto inteiro não foi executado neste ambiente (dependências não instaladas).


---

## Arquivo original: `KITS_EQUIPAR_INVENTARIO_V225.md`

# HäxBag — V225 · Equipar kits pelo inventário

- Cartões de **kits equipáveis** agora têm botão **Equipar kit** / **Equipado · Desequipar**, seguindo o mesmo visual dos equipamentos.
- Em layouts que mostram atalhos de equipamento no topo dos cartões, os kits também possuem um atalho 🧰/✓.
- A ação funciona no inventário da ficha e na visualização geral, além dos detalhes do item.
- Kits oficiais equipáveis (Simples/Padrão/Raro) e kits antigos cadastrados apenas na categoria **Kits** estão incluídos. Kits consumíveis não recebem o botão.
- O estado é persistido em `inventory_items.metadata.equipped`; a ficha já utiliza esse campo para aplicar bônus e determinar disponibilidade para descanso.
- A seleção de bônus de perícias não é modificada; kits sem tipo oficial podem ser equipados, mas não ganham automaticamente bônus de perícias não cadastrados.
- Sem SQL adicional.


---

## Arquivo original: `CORRECAO_CABECALHO_PERFIL_V228.md`

# HäxBag V228 — Ajuste do cabeçalho do perfil público

## Corrigido

- Remove a linha decorativa/artefato horizontal que era desenhada sobre a imagem personalizada da capa. A capa temática, sem imagem enviada, mantém sua decoração.
- Corrige o avatar no cabeçalho do perfil público, que quase não se sobrepunha à capa por causa da centralização com margem negativa; agora o avatar sobrepõe a capa no deslocamento originalmente previsto.
- Mantém o nome, o @usuário, status e os controles sociais no mesmo fluxo e preserva o layout responsivo existente.

## Arquivo alterado

`src/components/PublicProfileV151.css`

## Instalação

Extraia o ZIP de correção na raiz do projeto e substitua o arquivo indicado. Atualize a página usando Ctrl+F5.

Nenhum SQL necessário. Somente CSS. 


---

## Arquivo original: `CORRECAO_LINHA_BANNER_PERFIL_V229.md`

HÄXBAG — V229 | CORREÇÃO DO TRAÇO NA CAPA DO PERFIL PÚBLICO

O que causava o problema:
- Na V228 o pseudo-elemento ::before foi removido de capas personalizadas,
  porém a regra .hb-public-content .hb-public-cover ainda tinha border-bottom.
- Essa borda criava uma linha avermelhada de 1 px no encontro da capa com os
  detalhes do perfil, conforme o segundo print.

O que foi corrigido:
- Para capas personalizadas, border-bottom: 0, mantendo a imagem e seu degradê.
- Para capas temáticas, mantém a borda original.
- A linha ornamental interna permanece desativada em capas personalizadas.
- Nenhuma alteração em dados, Supabase, componentes TSX ou em elementos da ficha.

Instalação do ZIP de correção:
1. Extraia na raiz do projeto HäxBag (a pasta onde fica package.json).
2. Substitua src/components/PublicProfileV151.css quando solicitado.
3. Atualize a página com Ctrl+F5. Se necessário, reinicie npm run dev.

Observação:
- A faixa marrom abaixo da imagem é a área de identidade do perfil.
  Esta correção remove o traço vermelho na separação, sem apagar o cabeçalho.
- O CSS foi conferido estaticamente; o aspecto deve ser verificado no navegador.


---

## Arquivo original: `MELHORIAS_PERFIS_V230.md`

# HäxBag V230 — Perfis mais completos

## O que mudou
- Perfil público: capa sem linhas e elementos artificiais sobre imagens pessoais; texto de apresentação resumido no cabeçalho, controles sociais mais organizados e indicadores que abrem diretamente os respectivos conteúdos.
- Perfil público: novo quadro de apresentação antes das publicações, vitrine de insígnias e crônicas, resumo de conquistas e melhor adaptação a telas estreitas.
- Perfil público: botão para copiar o @usuário com mensagem de confirmação; navegação por abas com setas esquerda/direita, Home e End.
- Privacidade: a seção da Carta de Identidade agora só aparece quando `identity_card_visible` e `privacy.show_identity_card` permitem; a prévia pública respeita esta configuração.
- Ateliê (Identidade & Legado): prévia pública mais fácil de acessar, indicadores da preparação da vitrine e atalhos para foto, capa, personagens em destaque e crônicas.
- Nenhuma alteração no esquema do banco e nenhuma modificação em dados salvos.

## Como instalar
- No ZIP de correção: extraia na pasta **raiz do projeto** para que os caminhos `src/components/...` sejam preservados, substituindo os arquivos correspondentes.
- No ZIP completo: a pasta `haxbag` contém o código da V230.
- Execute `npm install` (se necessário) e `npm run build`, depois recarregue o site com Ctrl+F5.

## Arquivos alterados
- `src/components/PublicAdventurerProfile.tsx`
- `src/components/PublicProfileV230.css` (novo)
- `src/components/ProfileLegacy.tsx`
- `src/components/ProfileLegacyV230.css` (novo)

## Validação
- TSX: parse/transpilação com TypeScript, sem erros de sintaxe.
- CSS: analisado com tinycss2, sem erros.
- Build completo não pôde ser executado neste ambiente: tentativa de instalar dependências bloqueada pela ausência de pacotes em cache e falha de npm. Execute `npm run build` na sua instalação.


---

## Arquivo original: `MELHORIAS_SOCIAL_V231.md`

# HäxBag V231 — Social expandido

Base: V230. Esta atualização preserva os componentes de fichas, campanhas, temas, postagens clássicas, amizades e mensagens existentes.

## Instalação

1. Faça uma cópia de segurança dos seus arquivos e do banco Supabase.
2. Aplique o ZIP de correção **sobre a raiz do projeto**, mantendo os caminhos `src/...`.
3. Abra o Supabase > SQL Editor e execute **HAXBAG_SOCIAL_V231.sql** usando uma conta autorizada. Leia primeiro o SQL e mantenha um backup. **A execução é obrigatória para habilitar o módulo novo.**
4. Instale as dependências do projeto se necessário (`npm ci`), execute `npm run build` e publique a versão atualizada do site.
5. Faça login e teste as abas **Feed, Explorar, Comunidades, Salvos, Eventos, Notificações, Atividade e Segurança**.

### Administrador oficial da moderação

A fila de denúncias é visível apenas para as contas autorizadas na tabela de administração nova. No **SQL Editor**, após verificar o UUID da sua conta em Authentication > Users, execute:

```sql
insert into public.hax_v231_admins(user_id)
values ('UUID-DA-CONTA-ADMINISTRADORA')
on conflict do nothing;
```

Não coloque IDs privilegiados ou credenciais no código frontend. Essa permissão é administrativa do site e **não** é concedida automaticamente aos mestres de campanhas ou moderadores de grupos.

## Recursos integrados

1. **Feed:** o feed clássico permanece ativo, com Comunidade, Seguindo, Amigos e Minhas publicações, além de pesquisa, ordenação local e fotos já existentes. Uma seção de publicações especiais acrescenta filtros de posts recentes, populares, de grupos ou próprios.
2. **Publicações:** posts especiais aceitam texto de até 3.000 caracteres, rascunho local por sessão, edição, exclusão, fixação, hashtags e cartões seguros de prévia de URL. O editor clássico continua com suas **até quatro fotos** e visibilidade público/seguidores/amigos. Novas enquetes de até quatro opções duram sete dias.
3. **Publicação como personagem:** o autor escolhe um personagem da própria conta; o banco valida a posse do personagem e guarda o nome oficial, com indicação explícita da conta responsável. Publicações especiais suportam o feed público ou grupos de que o autor é membro.
4. **Notificações:** novas notificações persistentes de curtidas, comentários, inscrições e pedidos de participação em grupos; agrupamento visual por data, controle de lidos e preferência para desligar avisos. As notificações antigas do HäxBag permanecem intactas.
5. **Explorar:** busca existente de pessoas, descoberta de grupos, hashtags populares dos posts especiais. Campanhas privadas não são exibidas publicamente.
6. **Comentários:** posts especiais com respostas aninhadas de um nível e exclusão pelos autores, enquanto o antigo componente de comentários é preservado. `@usuário` permanece texto normal (não dispara notificação específica de menção nesta versão).
7. **Comunidades:** grupos públicos ou privados, regras, tópicos, aprovação de entrada para os privados, administração de membros/moderadores e remoção de posts por moderadores autorizados.
8. **Coleções:** Salvos, criação de novas coleções pelo campo de transferência, organização e exclusão. Inclui posts clássicos e especiais. Para posts antigos, é salvo um pequeno resumo pessoal do texto; ele pode permanecer mesmo quando o original for removido. Os salvos são privados no banco.
9. **Atividade:** painel da jornada recente e histórico opcional no perfil público via função SQL que não divulga conteúdo privado de grupos.
10. **Mensagens:** continua com fotos, pesquisa, leitura e exclusão existentes, agora com resposta citada. Reações individuais com contadores por mensagem ainda não possuem tabela específica.
11. **Eventos:** anúncios de sessões abertas com local, horário, vagas, inscrição/cancelamento e eventos vinculados a grupos.
12. **Segurança/moderação:** denúncias em posts especiais, posts clássicos e grupos; fila administrativa, revisão, exclusão de conteúdos especiais e filtro de silenciamento de autores no feed especial. Bloqueio de contas da rede inteira continua no recurso já existente. Limite básico de denúncias por dia.

## Observações / limitações reais

- O feed clássico e o feed especial convivem na mesma página, mas usam **tabelas distintas**, pois a V230 utiliza RPCs antigos cujo esquema de banco não acompanha o ZIP. O código evita alterar essas RPCs ou remover dados antigos. A ordenação “populares” considera somente registros carregados.
- O editor de posts especiais é para **texto, enquetes e personagem**; para posts com múltiplas fotos, use o editor clássico. O editor de posts antigos não recebe edição inline.
- Links recebem prévias seguras de domínio/caminho, não miniaturas Open Graph coletadas por servidor.
- Menções com notificações automáticas, compartilhamento público de campanhas, reações estruturadas a mensagens e anexos em posts de grupos privados exigem integração futura com o esquema legado/Storage e não foram implementados nesta atualização. Não foram introduzidas permissões que possam expor campanhas e chats privados.
- A moderação de publicações antigas é de **triagem de denúncias**; a remoção do conteúdo legado ainda depende das ferramentas existentes. A remoção por denúncia funciona nos posts e grupos novos.
- É necessário testar a migração e o build em um ambiente com Supabase e as dependências do projeto. Não foi feita uma execução SQL em banco real ou um teste end-to-end de browser.


---

## Arquivo original: `REDESIGN_SOCIAL_V232.md`

# HäxBag V232 — Redesign da área Social

**Base:** HäxBag V231 / Social Expandido. Atualização de interface sem mudanças no esquema de dados.

## Alterações

- Navegação local reorganizada em **Descobrir**, **Conexões** e **Sua conta**, com acesso direto a **Privacidade** e ao painel de moderação.
- Identidade visual **HäxBag Social** no menu local, respeitando os temas de temporada existentes.
- Cabeçalho, atalhos e métricas redesenhados para leitura rápida.
- Feed clássico e publicações especiais da V231 com espaçamento, tipografia, estados, cartões e ações padronizados.
- Composer, enquetes, coleções salvas, descoberta de jogadores, comunidades, eventos, notificações e mensagens com acabamento visual unificado.
- Barra de atalhos agora oferece acesso direto a **Explorar, Comunidades, Eventos, Salvos e Mensagens** — útil no desktop quando o menu local é substituído pela navegação global do HäxBag.
- Layout adaptável e foco acessível; respeito a `prefers-reduced-motion`.
- Nada foi alterado nos fluxos de autenticação, permissões, armazenamento ou dados pessoais.

## Instalação rápida (ZIP de atualização)

1. Faça backup dos seus arquivos modificados.
2. Extraia o ZIP na raiz do projeto `haxbag`, preservando a estrutura de pastas.
3. Substitua `src/components/FriendsPanel.tsx` e adicione `src/components/SocialRedesignV232.css`.
4. Execute `npm install` (caso necessário) e `npm run build` no seu ambiente.
5. Verifique as telas Social em desktop e celular e recarregue o navegador com `Ctrl + F5`.

**SQL:** não é necessário SQL novo para a V232. Se a V231 ainda não foi instalada, aplique a migração `HAXBAG_SOCIAL_V231.sql` existente no pacote completo.

**Prévia:** `PREVIA_VISUAL_SOCIAL_V232.html` contém uma demonstração visual estática com dados fictícios. Não executa as funcionalidades do site e não requer acesso ao Supabase.

## Validação realizada

- TSX de `FriendsPanel.tsx` analisado com TypeScript (sem erros de sintaxe).
- CSS analisado com parser CSS (sem erros estruturais).
- Layout demonstrativo renderizado em Chromium nas larguras 1440px, 760px e 390px, sem rolagem horizontal no documento.
- Verificada a visibilidade do cartão de perfil no menu lateral na prévia e o funcionamento dos breakpoints.

**Não verificado:** build integral do projeto e os fluxos end-to-end conectados ao Supabase. O ambiente não tem `node_modules`, e `npm ci --offline` não encontrou os pacotes no cache.


---

## Arquivo original: `REDESIGN_PERFIS_V233.md`

# HäxBag V233 — Redesign dos perfis

Base: HäxBag V232 (Social redesenhado). Atualização exclusivamente de interface.

## O que mudou

### Perfil público de outros jogadores
- Composição do perfil alinhada à linguagem de cartões, superfícies e tipografia do Social V232.
- Cabeçalho com capa livre de ornamentos quando há imagem personalizada, avatar sobreposto de forma consistente, nome, status e indicação da relação com o jogador.
- Ações sociais (seguir, enviar mensagem, visitar posts, ver apresentação, copiar @) agrupadas e acessíveis.
- Estatísticas de personagens, campanhas, insígnias e crônicas em uma grade responsiva com atalhos existentes.
- Abas com estilo de seleção mais claro e rolagem horizontal no celular.
- Introdução ao mural, seções e cartões públicos com hierarquia visual uniforme.

### Ateliê: identidade e legado
- Cabeçalho e ações de salvar/visualizar mais compactos e consistentes com o Social.
- Área da capa e avatar harmonizada com a apresentação pública, preservando o deslocamento de imagem salvo pelo jogador.
- Nenhum texto ou ornamento sobre a capa personalizada do Ateliê.
- Estatísticas em cartões, vitrine lateral mais organizada, progresso de personalização e navegação refinados.
- Nota contextual explica que a prévia editável pode estar diferente do perfil público já salvo.
- Responsividade ajustada para telas menores e foco de teclado visível.

## Arquivos alterados
- `src/components/PublicAdventurerProfile.tsx`
- `src/components/ProfileLegacy.tsx`
- `src/components/ProfileRedesignV233.css` (novo)

## Instalação
1. Faça backup dos arquivos modificados localmente.
2. No ZIP de atualização, extraia os arquivos na pasta raiz `haxbag` preservando a estrutura `src/components/`.
3. Execute `npm run build` em seu ambiente e recarregue a página com Ctrl+F5.

Nenhum SQL adicional é necessário e não são realizadas migrações ou atualizações dos dados salvos.
Se a V231 Social ainda não foi instalada, a migração de banco `HAXBAG_SOCIAL_V231.sql` continua necessária para as funcionalidades da V231.

## Validação
- Parsing/transpilação TSX dos dois componentes com TypeScript 5.8.3, sem erro sintático.
- Parsing estrutural do CSS com tinycss2, sem erro.
- Prévia estática carregada em Chromium nas larguras 1440, 760 e 390 px, sem rolagem horizontal da página; capa personalizada com elementos decorativos ocultos e avatar sobreposto conforme esperado.
- Conteúdo da prévia estático e fictício, sem conexões com o Supabase. Pode ser aberto em navegador pelo arquivo `PREVIA_REDESIGN_PERFIS_V233.html`.
- Build integral e testes end-to-end com Supabase não realizados neste ambiente. Devem ser executados após instalar as dependências do projeto.


---

## Arquivo original: `PAINEL_ADMINISTRATIVO_V234.md`

# HäxBag V234 — Painel Administrativo

Atualização baseada na V233. Preserva o Social V231 e o redesign V232–V233.

## Instalação

1. Faça um backup da pasta do projeto e do banco antes de rodar scripts SQL.
2. Se usar o ZIP de atualização, extraia na **raiz** do projeto, preservando caminhos `src/` e substituindo arquivos quando solicitado.
3. Confirme que `HAXBAG_SOCIAL_V231.sql` já foi executado no Supabase.
4. Execute **`HAXBAG_ADMIN_V234.sql`** uma única vez no **SQL Editor do Supabase**, em uma conta com privilégios de proprietário do banco.
5. O dono do site precisa estar na tabela `public.hax_v231_admins`. Se não estiver, no SQL Editor, **substitua** o UUID abaixo pelo ID da sua conta em *Authentication → Users*:

   ```sql
   insert into public.hax_v231_admins(user_id)
   values ('SEU-UUID-AQUI')
   on conflict do nothing;
   ```

6. Rode `npm install` caso as dependências ainda não existam; depois `npm run build` e publique a nova versão. Faça login novamente ou atualize a página.
7. Em **Social → Administração do site → Painel Administrativo**, encontre Denúncias, Usuários, Equipe e Histórico. A busca global `Ctrl+K` também inclui o painel para contas autorizadas.

## Regras de acesso

- **Administrador**: permissão concedida na tabela `hax_v231_admins` pelo SQL Editor. Pode nomear/remover moderadores, advertir, suspender por 1 a 365 dias, avaliar denúncias, remover posts/comentários/comunidades V231.
- **Moderador**: pode ser designado pelo administrador na aba Equipe, mas **não enxerga nem acessa o Painel Administrativo**, assim como qualquer jogador. Nesta versão a função de moderador é apenas uma designação persistida, sem ações administrativas disponibilizadas. Um futuro painel de moderação limitado poderá ser criado separadamente, com permissões próprias no banco.
- **Jogador e mestre de campanha**: não têm acesso ao painel, nem ao histórico. Tentar abrir a URL manualmente não concede permissão no banco. Também não há opção de autoelevação por `profiles` ou `campaign_members`.
- **Histórico**: armazena ação, autor, alvo, data, justificativa e contexto limitado. A interface não permite apagá-lo ou editá-lo.

## Alcance das suspensões

A suspensão bloqueia operações **INSERT, UPDATE e DELETE** nas tabelas de conteúdo e interação do novo módulo Social V231 por políticas restritivas de SQL. A restrição não remove a possibilidade de consultar conteúdos permitidos ou enviar denúncias. Ela **não** desativa a conta Supabase Auth nem bloqueia o restante do HäxBag. O **feed clássico, chat clássico e seus RPCs antigos** não receberam restrições SQL porque suas definições não estão incluídas nesta distribuição. Usuários com acesso técnico ainda podem chamar as funções antigas diretamente; **não considere as suspensões globais** enquanto o Social clássico não tiver suas RPCs protegidas. Esta versão não pretende revogar acesso ao chat clássico.

O painel recebe denúncias de publicações clássicas e permite analisá-las, mas **não permite excluir postagens antigas automaticamente**. Para moderação global consistente, precisamos das definições SQL dos RPCs `hax_social_*` e das tabelas do Social clássico para integrá-las à política de sanções com segurança. Não tente utilizar a chave `service_role` no navegador.

## Exclusividade do painel

- O menu lateral e o atalho `Ctrl+K` só oferecem **Painel Administrativo** depois de validar `hax_v231_admin()` para o usuário autenticado.
- O componente confirma novamente `hax_v234_role() = 'admin'` antes de ler denúncias, usuários ou auditoria. Tentativas de URL manual mostram acesso restrito.
- Cada consulta e ação administrativa SQL verifica novamente o papel do usuário; o navegador **nunca** recebe credenciais privilegiadas.
- Mestres de campanhas, jogadores e moderadores designados **não** veem o painel.

## O que esta versão faz

- Fila de denúncias com filtros por status e inspeção do alvo reportado.
- Busca de usuários por nome, `@usuário` ou UUID completo; não expõe email, telefone ou credenciais.
- Advertências com notificação, suspensões temporárias e revogação antecipada da suspensão.
- Gestão de moderadores apenas por administradores.
- Decisões auditadas e confirmação antes de ações irreversíveis.
- Painel separado de Privacidade, com navegação e visual coerentes com Social V232.

## Validação

Verificações locais de sintaxe TSX/CSS e integridade do ZIP. Build completo e testes de migração num banco Supabase real **não** foram executados neste ambiente; faça-os em um ambiente de teste antes de publicar em produção.


---

## Arquivo original: `PAINEL_ADMINISTRATIVO_V236.md`

# HäxBag V236 — Painel Administrativo aprimorado

Base: HäxBag V235.

## Melhorias
- Nova visão geral: denúncias mais antigas, últimas decisões e limites de atuação.
- Resumo clicável com indicadores de pendências, analisadas, dispensadas e eventos auditados.
- Fila de denúncias com pesquisa, situação, tipo de conteúdo e ordenação.
- Inspeção detalhada, prévia e confirmação explícita de remoções permanentes.
- Gestão de usuários e moderadores com filtro dos resultados de pesquisa.
- Histórico pesquisável por ação, ID ou justificativa, com exportação CSV dos registros carregados.
- Layout responsivo consistente com as cores de temporada e o Social V232.
- Tratamento de erros, estados vazios e proteção contra respostas antigas de prévias.

## Segurança e limites
O Painel Administrativo permanece exclusivo de administradores globais (identificados no banco por hax_v231_admins); não basta ser mestre ou moderador. A checagem de role ocorre tanto na interface quanto nas RPCs / RLS existentes da V234. Nenhuma permissão nova foi criada.

As contagens representam até 200 denúncias e até 150 ações carregadas, não os totais globais. O filtro de usuários atua sobre os resultados de uma busca (máx. 50), não lista automaticamente todos os membros.

As suspensões restringem o Social V231, **não** revogam sessões de autenticação nem cobrem completamente o feed/chat clássicos. O painel informa isso em destaque.

## Instalação
1. Faça backup do projeto.
2. Copie os arquivos modificados na pasta `src/components` mantendo os nomes.
3. Execute `npm run build`.

Não há SQL novo nesta versão. Requer que as migrações `HAXBAG_SOCIAL_V231.sql` e `HAXBAG_ADMIN_V234.sql` já estejam aplicadas.


---

## Arquivo original: `PAINEL_ADMINISTRATIVO_PERFIS_V238.md`

# HäxBag — Perfis acessíveis pelo painel administrativo

Esta atualização torna os nomes públicos (`@usuário`) clicáveis na administração, abrindo o visualizador de perfil que já existe no HäxBag.

## Onde funciona

- Visão geral: responsável e alvo das decisões recentes.
- Histórico de moderação: responsável e alvo, inclusive após pesquisa e filtros.
- Denúncias: pessoa denunciada (ou autora do conteúdo) e denunciante.
- Usuários e equipe: clique no `@usuário` nos resultados e no detalhamento.
- Prévia de denúncia: acesso ao perfil do autor, separado do botão de gerenciamento.

Registros sem conta identificável permanecem como texto, sem links falsos. Para ações contra publicações ou comunidades, o link do alvo usa o autor/responsável que foi identificado, não o identificador do conteúdo.

## Instalação

1. Faça backup dos arquivos atuais.
2. Copie `src/components/SiteAdministrationV234.tsx` e `src/components/SiteAdministrationV234.css` para o projeto, substituindo os existentes.
3. Execute `npm run build` e publique a atualização.

A atualização pressupõe que a identificação de autores e responsáveis já esteja instalada. Não há alteração de banco de dados nesta etapa.

A central continua restrita aos administradores globais; os links abrem o mesmo perfil público já usado no Social, respeitando o que o próprio perfil deixa visível.


---

## Arquivo original: `CORRECAO_ACESSO_PAINEL_V239.md`

# HäxBag — Correção do carregamento do painel administrativo

## O que foi corrigido

- A falha de carregamento da identificação dos usuários não revoga mais artificialmente o acesso ao painel de uma conta que já foi confirmada como administradora global.
- Denúncias, histórico e identificação de pessoas carregam independentemente; um problema em apenas uma fonte não bloqueia todas as outras.
- Erros vindos em objetos são exibidos em texto legível, sem `[object Object]`.
- Uma consulta alternativa recupera nomes públicos de responsáveis, denunciantes e alvos que sejam contas identificáveis. A identidade de autores de conteúdos depende da função administrativa de identificação.
- A interface deixa claro quando os resultados não puderam ser consultados, evitando apresentar falsos totais zero.
- O painel e suas consultas continuam protegidos por autorização de administrador global. Não são concedidas permissões novas.

## Como instalar somente a correção

Extraia o arquivo de atualização na **raiz do projeto HäxBag**. Substitua:

- `src/components/SiteAdministrationV234.tsx`
- `src/components/SiteAdministrationV234.css`

Execute `npm run build` no computador onde as dependências do projeto estiverem instaladas. Não há nova migração obrigatória para evitar que o painel feche ao falhar a busca de identidades.

## Se os @usuários ainda estiverem indisponíveis

Confira se a migração `HAXBAG_ADMIN_IDENTIDADES_V237.sql`, já fornecida anteriormente e incluída neste pacote, foi executada no editor SQL do banco. Ela restaura a função de identificação e preserva a autorização exclusiva a administradores globais.

**Observação:** a causa exata da falha remota não pode ser confirmada apenas pelo texto `[object Object]`; a atualização faz o painel lidar corretamente com erros e manter os recursos que puderem ser carregados.


---

## Arquivo original: `AJUSTE_COR_SEGUIR_PERFIL_V243.txt`

HäxBag V243 — Cor personalizada no botão Seguir / Seguindo

Correção visual baseada na V242.

O que foi feito:
- O botão Seguir / Seguindo do perfil público usa a cor de destaque do próprio perfil, não a cor da temporada do visitante.
- O botão de seguir do rodapé utiliza a mesma cor.
- O texto do botão ganha cor preta ou branca conforme o contraste da cor selecionada.
- A lógica de amizade, seguir, deixar de seguir, dados e permissões foi preservada.

Para instalar apenas a correção:
1. Extraia o ZIP de correção na pasta raiz do projeto HäxBag, mantendo o diretório src/components.
2. Substitua os 3 arquivos.
3. Rode npm run build e publique.
4. Se o navegador mantiver o CSS antigo, pressione Ctrl+F5.

Não há SQL novo. O teste de sintaxe TSX/CSS passou. O build completo não foi executado neste ambiente porque as dependências do projeto não estão instaladas.


---

## Arquivo original: `NOTIFICACOES_SEGUIDORES_V244.md`

# Novos seguidores — atualização de notificações

## O que muda
- Sempre que alguém começar a seguir um perfil, um aviso é criado no servidor.
- O aviso apresenta o @ do novo seguidor e um botão para abrir seu perfil.
- Os avisos aparecem em **Social → Notificações** e entram no contador do sino do site.
- Configurações de notificações, usuários silenciados e bloqueios são respeitados.
- Deixar de seguir não gera aviso; deixar de seguir e seguir novamente várias vezes não causa spam (janela de 24 horas).

## Instalação
1. Faça backup do projeto e do banco.
2. Aplique o SQL `HAXBAG_NOTIFICACOES_SEGUIDORES_V244.sql` como proprietário do banco **após** a criação das tabelas do Social.
3. Substitua `src/App.tsx`, `src/components/SocialV231Suite.tsx` e `src/components/SocialV231Suite.css`.
4. Execute `npm run build` e publique.

## Validação manual
- Com duas contas de teste não bloqueadas, uma segue a outra: aparece um único aviso na conta seguida.
- O @ e o link abrem o perfil da conta que seguiu.
- Marcar lida reduz o contador do sino.
- Desativar notificações, silenciar ou bloquear impede novas notificações.
- Repetir seguir/deixar de seguir em menos de 24h não duplica o aviso.

Não gera notificações retroativas para seguidores anteriores à instalação. O sino atualiza ao entrar, ao ser aberto e a cada 60 segundos; a Central de Notificações atualiza ao ser aberta.


---

## Arquivo original: `CORRECAO_SOCIAL_TABS_V247.md`

# HäxBag V247 — Correção do erro TS2322

## Causa
O aplicativo mantinha uma lista antiga de abas (`HaxSocialTab` em `src/siteNavigation.ts`) enquanto o componente Social tinha mais seis abas (`SocialTab`). O `setSocialNavigationTab` não aceitava as abas novas, gerando TS2322 em `App.tsx` ao ser passado para `onSelectTab`.

## Correção
- `src/siteNavigation.ts`: inclui `showcase`, `tablefinder`, `trends`, `insights`, `security` e `characternews` em `HAX_SOCIAL_TABS`.
- `src/components/FriendsPanel.tsx`: `SocialTab` passa a reutilizar o tipo `HaxSocialTab` centralizado, eliminando listas duplicadas.

## Instalação
Extraia o ZIP de correção sobre a raiz do projeto (a pasta que contém `package.json`), mantendo os diretórios `src/`, e substitua os dois arquivos. Depois execute `npm run build`.

Nenhum SQL é necessário. Não modifica acesso administrativo nem dados.

## Validação
Validação estrita do arquivo de navegação, análise de sintaxe TSX/TS e consistência entre as 21 abas e o catálogo visual: passaram. O build integral depende das dependências do projeto e precisa ser executado no ambiente de destino.


---

## Arquivo original: `CORRECAO_PROTECAO_KITS_V253.md`

# HäxBag V253 — Proteção dos kits equipáveis

A funcionalidade única **Conceder proteção** usa o mesmo sistema dos equipamentos de proteção:

- **Nível**: Básica (¼), Moderada (½) e Avançada (valor integral).
- **Tipo**: Resistência (proteção física contra dano especial e bruto) ou Sanidade (usa o atributo Mental).
- Os benefícios de proteção são calculados apenas enquanto o kit estiver **equipado**, tanto na ficha quanto na mesa de combate.
- As configurações aparecem no editor de kits do inventário, lojas e Baú do Mestre.
- Kits antigos com a alternativa **Proteção** do tipo Padrão continuam com proteção Moderada de Resistência.
- Funcionalidades únicas de proteção criadas antes da V253 sem classificação específica passam a ser interpretadas como Básica de Resistência. Recomenda-se revisá-las no editor.
- Ao excluir do inventário um kit com proteção **equipado**, vale a mesma penalidade de perda de proteção aplicada ao equipamento convencional. Desequipá-lo faz a proteção deixar de contar no combate, como ocorre com os equipamentos normais.

## Instalação

Copie os arquivos de `src/` do pacote para a raiz do projeto, substituindo os anteriores, e rode `npm run build`.
Sem SQL: os novos campos ficam nos metadados existentes do item.


---

## Arquivo original: `CORRECAO_PARTICIPANTES_COMUNIDADES_V257.md`

# HäxBag V257 — Perfis clicáveis na gestão das comunidades

## Alterações

- A seção **Gerenciar participantes** passa a mostrar o **@usuário** em vez do prefixo do UUID.
- O @ abre o perfil público existente do participante ao clicar.
- O mesmo comportamento foi aplicado a **Solicitações de entrada**.
- O nome de exibição e o cargo (Membro/Moderador) permanecem identificáveis.
- Os botões de aprovar, recusar, nomear moderador e remover continuam independentes do clique no nome.
- As identidades de participantes da comunidade selecionada são carregadas usando `hax_social_public_profile`, o mesmo RPC público já usado no feed. Não são feitas consultas a perfis de outras comunidades.
- Quando um perfil não tem @ acessível, o seletor apresenta o nome exibido ou um fallback legível, sem mostrar o UUID.

## Instalação

Extraia a correção na raiz do projeto e substitua:

- `src/components/SocialV231Suite.tsx`
- `src/components/SocialV231Suite.css`

Rode `npm run build` e publique a aplicação.

**SQL:** não há migração nova. Requer a função `hax_social_public_profile`, já utilizada pelo feed e pelos perfis existentes.

## Validação

Os componentes passaram na checagem de tipos TypeScript (tsconfig.app.json) e a configuração do Vite (tsconfig.node.json) usando o compilador TypeScript 5.8 local. Verificações estáticas conferiram a inclusão dos participantes, o clique para abrir perfil e a remoção do UUID abreviado. O teste com banco real e o build final do Vite não foram realizados.


---

## Arquivo original: `NOTIFICACOES_CLICAVEIS_V259.md`

# HäxBag V259 — Notificações que abrem publicações

## O que mudou
- Notificações de curtidas e comentários agora exibem **Ver publicação**, abrindo o post correspondente no feed unificado.
- A publicação aparece em destaque e o feed rola até ela, mesmo que seja anterior às 80 publicações recentes.
- O carregamento adicional é feito pela consulta normal, respeitando a política de leitura do banco.
- Publicações removidas ou indisponíveis exibem um aviso e permitem voltar às notificações.
- Ao abrir, a notificação é marcada como lida.
- Seguir perfis continua usando o acesso ao perfil de quem seguiu.

## Instalação
1. Faça backup da pasta do projeto.
2. Descompacte a atualização na **raiz do projeto**, mantendo a estrutura `src/components/`.
3. Instale as dependências, se ainda não estiverem disponíveis (`npm install`), e execute `npm run build`.
4. Publique e teste clicando em notificações antigas e recentes.

Não há alteração SQL.

## Validação
- `tsc -b --pretty false` passou sem erros neste ambiente.
- `vite build` não foi concluído aqui porque as dependências recebidas incluem binários nativos de outra plataforma.
- O clique e a consulta em banco real devem ser confirmados no ambiente de implantação.


---

## Arquivo original: `RECUPERACAO_TELA_PRETA_V263.md`

# HäxBag V263 — Correção da tela vazia na inicialização

## Causa identificada no ZIP enviado

O arquivo `dist/assets/index-DAp2w_Ly.js` continha uma exceção **incondicional**:
`As variáveis de ambiente do Supabase não foram configuradas.`
A aplicação parava **antes do React montar a interface**. A compilação foi feita sem as variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY. O ZIP também não continha `.env`, e o `dist/index.html` não carregava `hb-startup-recovery.js`.

## O que muda

- `vite.config.ts` agora bloqueia `vite build` sem ambas as variáveis. Não gera mais um `dist` quebrado silenciosamente.
- `index.html` ativa o diagnóstico de inicialização, que funciona mesmo quando o JavaScript da aplicação falha.
- `.env.example` documenta os nomes sem incluir credenciais.
- O ZIP completo **não inclui o dist antigo defeituoso**. Gere um novo build no ambiente configurado.

## Como corrigir no computador

1. Copie `.env.example` para `.env.local` na raiz do projeto.
2. No Supabase, copie **Project URL** para `VITE_SUPABASE_URL` e a **publishable key** (ou chave `anon` pública legada) para `VITE_SUPABASE_PUBLISHABLE_KEY`. NUNCA coloque a chave `service_role` ou `secret` no frontend.
3. Execute `npm run build` de novo. Se as variáveis estiverem faltando, o build agora exibe erro claro e interrompe a publicação.
4. Publique o novo conteúdo de `dist`, não o `dist` incluído no ZIP antigo.

## Hospedagem

Se o serviço (Vercel, Netlify, Cloudflare Pages ou outro) executa o build, cadastre ambas as variáveis **nas configurações do projeto, para o ambiente de produção**; salve e crie novo deployment. O arquivo `.env.local` do computador não é automaticamente enviado à hospedagem.

## Diagnóstico

Se mesmo com um build novo a tela ainda falhar, abra o Console (F12) e envie a primeira mensagem de erro. Agora o script de recuperação carregado no `index.html` também poderá mostrar uma mensagem na própria tela.

Nenhuma migração SQL é necessária. A camada Social e suas permissões não foram alteradas.


---

## Arquivo original: `SOCIAL_NAVEGACAO_V265.md`

# HäxBag V265 · Social mais ágil

## O que mudou

- **Navegação rápida** dentro da aba Social, acessível por **Ctrl+K** (ou ⌘K no macOS) e pelo botão **Ir para…**. Pesquisa por nome da página e descrição, com setas e Enter; permite fechar com Escape ou clique fora.
- Os destinos são derivados dos menus React disponíveis para a conta; o painel administrativo **não** aparece para contas sem autorização verificada.
- Novos estilos do navegador de páginas, com cores da temporada, layout mobile e foco acessível.
- Link de salto por teclado para o título da página; foco adequado após seleção e respeito à preferência de movimento reduzido.
- Na busca de usuários, o estado de carregamento começa com o debounce, evitando exibir a mensagem “Nenhum perfil encontrado” antes do retorno.
- Perfil lateral mais compacto no mobile, mantendo todos os menus e ações.

## Arquivos alterados

- `src/components/FriendsPanel.tsx` (integração, navegação, acessibilidade e busca)
- `src/components/SocialNavigatorV265.tsx` (novo componente)
- `src/components/SocialNavigatorV265.css` (estilos da nova interface)

## Como atualizar

1. Faça cópia de segurança do seu projeto.
2. Extraia o arquivo **HaxBag_Atualizacao_Social_V265.zip** na raiz do seu projeto, preservando o caminho `src/components`. Confirme a substituição de `FriendsPanel.tsx`.
3. Execute `npm install` se ainda não tiver as dependências e, em seguida, `npm run build` na sua máquina.
4. Publique o novo `dist` e faça atualização forçada do navegador (`Ctrl + F5`).

O arquivo **HaxBag_Social_V265_Completo.zip** já contém o código-fonte integral e a nova navegação; não inclui `node_modules`, `dist` ou configurações secretas `.env.local`.

## Compatibilidade e testes

- Verificação `tsc -b` concluída sem erros de TypeScript.
- Os módulos nativos do Vite existentes no projeto original são pacotes para Windows; por isso, a geração do bundle Vite não foi reproduzida neste ambiente Linux. O build final deve ser executado na máquina de destino.
- Nenhum ajuste SQL ou nova tabela foi adicionado.
- A prévia HTML é ilustrativa: mostra o novo modal em funcionamento com dados de exemplo, sem acessar Supabase.
- Recomenda-se testar no navegador o fluxo completo de publicação, mensagens e permissões administrativas após instalar, além das larguras 360px, 768px e desktop.


---

## Arquivo original: `CORRECAO_REACOES_V266.md`

# HäxBag V266 — Correção do menu de reações das mensagens privadas

## O que foi corrigido
- Seletor de emojis deslocado, sobreposto ou cortado dentro da área de mensagens.
- Menu agora flutua fora da área rolável, mas permanece ancorado ao botão "Reagir".
- Posicionamento ajustado aos limites da janela e atualizado ao rolar/redimensionar.
- Fechamento ao clicar fora, pressionar Esc ou selecionar uma reação.
- Estilização das ações da mensagem e quebra de linha em espaços estreitos.
- Tema de cores atual preservado no seletor, inclusive fora do contêiner do Social.
- Botões com rótulos acessíveis e navegação por teclado.

## Atualizar uma instalação V265
Extraia o ZIP da correção na pasta raiz `haxbag/` mantendo as subpastas.
Arquivos atualizados/criados:
- `src/components/FriendsPanel.tsx`
- `src/components/ChatReactionPickerV266.tsx`
- `src/components/ChatReactionPickerV266.css`

Depois execute `npm run dev` ou `npm run build` no Windows.
Não é necessário SQL nem alteração de Supabase.

## Validação
`tsc -p tsconfig.app.json --noEmit --pretty false` executado sem erros.
O empacotamento de produção do Vite deve ser confirmado no ambiente Windows do projeto.


---

## Arquivo original: `FLUXOS_ARVORE_V267.md`

# HäxBag V267 — Árvore de Fluxos de Atributo

Base: projeto V266 com a correção de reações.

## Instalação da atualização

1. Faça backup da pasta do projeto e do Supabase antes de atualizar.
2. Extraia o ZIP **de atualização** na raiz que contém a pasta `src/` (em geral, `haxbag/`).
3. Substitua os arquivos existentes.
4. Execute `npm run dev` no Windows. Se preferir validar a versão de produção, execute `npm run build`.

## Melhorias

- Na seção **4. Fluxos** da ficha Kisatsutai, aparece a árvore de habilidades, organizada por nível e atributo.
- Progressão cumulativa: Raposa → Tigre → Dragão → Corvo, com um Fluxo por categoria.
- Conexões de escolhas ativas, nos disponíveis e bloqueados, detalhes e ação de aprender/trocar/remover.
- Validação por graduação e maiores atributos; empates na linha de corte são permitidos.
- Escolhas antigas permanecem salvas caso a graduação seja reduzida, ficando inativas até novo desbloqueio.
- O Fluxo **Esforço Otimizado (FOR/Raposa)** concede **uma única vantagem** na rolagem de Manobra de Luta (+1d20).
- Alguns bônus objetivos já são aplicados em rolagens, ações e reações no App.tsx; efeitos dependentes da narração do mestre ficam registrados na ficha para aplicação manual.
- Anotações de Fluxos legadas (`flows.details`) são preservadas.

## Dados

As seleções são gravadas no JSON da ficha em `sheet_data.flows.selections`.
Não exige migração SQL. A prévia HTML é uma demonstração local, sem conexão com a conta.

## Validação

- `tsc -b` usando TypeScript 5.8 global: OK.
- Vite build não executado aqui por falta de dependências nativas Linux (o ZIP original traz dependências do Windows).


---

## Arquivo original: `AJUSTE_FLUXOS_V268.md`

# HäxBag V268 — Correção do layout dos Fluxos

## O que mudou

- A árvore dos Fluxos do Kisatsutai agora ocupa **toda a largura** do painel, sem dividir espaço com um campo de anotações.
- O campo “Anotações adicionais e Fluxos legados (não apagar)” não é mais exibido para personagens Kisatsutai. **O conteúdo antigo não é excluído:** `sheet_data.flows.details` permanece salvo, mas não aparece na interface.
- A árvore é fluida em telas largas, sem largura mínima fixa de 1000 px.
- Em áreas estreitas, os 20 nós são organizados em cartões por graduação, sem rolagem horizontal.
- O inspetor de habilidades aparece abaixo da árvore, salvo quando há espaço suficiente para ficar ao lado.
- Regras, efeitos e seleções de Fluxos da V267 foram mantidos.

## Instalação

1. Faça backup do projeto.
2. Extraia **HaxBag_Correcao_Arvore_Fluxos_V268.zip** dentro da pasta `haxbag/` (onde está `package.json`). Substitua os arquivos.
3. Reinicie `npm run dev`. Se desejar, execute `npm run build` para validar em Windows.

Não é necessário SQL; dados existentes não são apagados.

## Validação

TypeScript `tsc -b`: sem erros. A compilação do Vite não foi concluída neste ambiente Linux por ausência das dependências nativas do Rolldown para Linux.


---

## Arquivo original: `MELHORIA_ARVORE_FLUXOS_V269.md`

# HäxBag V269 — Árvore de Fluxos aprimorada

Atualização visual da seção **4. Fluxos** do Kisatsutai, baseada na V268.

## O que foi alterado
- Progressão visual **Raposa → Tigre → Dragão → Corvo**, da esquerda para a direita.
- Cinco opções de atributo em cada graduação; 20 Fluxos permanecem acessíveis.
- Cartões maiores, nomes legíveis, estados disponíveis/aprendidos/bloqueados distintos.
- Conexões curvas destacam as escolhas realmente registradas; um traçado pontilhado antecipa uma possível escolha ao selecioná-la.
- Etapas navegáveis por botões e painel de detalhes horizontal, evitando o espaço desperdiçado na ficha.
- Em tablets e celulares, os Fluxos se reorganizam em cartões por graduação, sem rolagem horizontal.
- O campo antigo de anotações continua oculto; os dados legados permanecem intocados.

## Instalação
1. Copie os arquivos do ZIP **de atualização** para a pasta raiz do projeto `haxbag`, substituindo os arquivos com o mesmo caminho em `src/components/`.
2. Reinicie `npm run dev`.
3. Não é necessária migração SQL.

## Compatibilidade e preservação
- Utiliza a API `KisatsutaiFlows` e os dados `flows.selections` já existentes na V268.
- Não modifica o catálogo dos Fluxos, os valores de atributos ou as regras de graduação.
- As anotações legadas continuam armazenadas em `flows.details` sem serem exibidas.
- A prévia HTML é uma demonstração local e não grava escolhas em fichas reais.

## Verificação
TypeScript validado com `tsc -b` (TypeScript 5.8 do ambiente). Prévia visual e interação verificadas em Chromium. O bundle final do Vite não foi executado neste ambiente.


---

## Arquivo original: `CORRECAO_FLUXOS_V270.md`

# HäxBag V270 — Correção de cartões de Fluxos ao clicar

Problema: o App.css define `button:active:not(:disabled) { transform: translateY(1px); }`.
A regra sobrescrevia temporariamente o `translate(-50%, -50%)` dos 20 nós
posicionados de forma absoluta na árvore e fazia o cartão saltar para a direita,
com sobreposição dos cartões vizinhos.

Correção: o arquivo `src/components/KisatsutaiFlows.css` mantém o posicionamento
original dos nós tanto em repouso quanto durante o clique. Em layout compacto,
os nós permanecem em fluxo normal sem transformação. A animação do transform
foi retirada só desses cartões; borda e brilho continuam a indicar a seleção.

Instalação: extraia o ZIP de atualização na raiz do projeto haxbag e substitua
`src/components/KisatsutaiFlows.css`. Não altera SQL, dados nem regras dos Fluxos.


---

## Arquivo original: `MELHORIAS_COMBATE_CRITICOS_INICIATIVA_V272.md`

# HäxBag V272 — Combate, críticos e iniciativa

## Instalação
Extraia o ZIP de atualização na pasta principal `haxbag` mantendo a estrutura dos diretórios, substituindo os arquivos. Reinicie o Vite com `npm run dev` e, para checagem no Windows, rode `npm run build`.

## Mudanças
- Aba 3. Combate reorganizada em seções de Arsenal/Dano, Críticos/Defesa, Mobilidade e Iniciativa.
- Crítico: a margem base em `combat.critical` permanece intacta; margem efetiva reflete condições e reduções cumulativas dos Fluxos Tigre, Dragão e Corvo de AGI.
- 1 natural falha; 20 natural garante o acerto. Margem crítica inferior a 20 só acrescenta dano quando um ataque acerta a DT informada.
- As rolagens de Ataque permitem informar DT do alvo e classificação da forma (sem Respiração, Raposa, Tigre ou Dragão). O acréscimo de dados usa o dado da arma equipada.
- Fluxo Corvo FOR dobra os dados extras de crítico; Fluxo Tigre FOR indica condições possíveis a cargo do mestre. Bloqueio com Fortaleza Intocável reduz dano e sinaliza contra-ataque no crítico; Esquiva permanece sem crítico.
- Iniciativa: teste `(1 + AGI)d20 + Destreza de armadura` com dados adicionais de kits e campo de bônus situacional para habilidades como Iniciativa Aprimorada.
- A cada ponto ímpar de AGI ganha Ação Extra; a cada ponto par, Movimento (com 1 movimento inicial). Cada turno admite até 3 ações. Os turnos excedentes aparecem no Escudo do Mestre com metade da iniciativa principal, sem criar cópias salvas na ficha.
- Sempre Pronto (Raposa/AGI) é considerado antes do desempate por Agilidade.
- Resumo de Combate passa a exibir a quantidade total de ações e os turnos previstos por rodada.

## Limitações
- Efeitos sujeitos à narrativa/mestre, especialmente condições, vantagem na próxima rolagem e ataque de oportunidade, não são aplicados automaticamente.
- Efeitos temporários de condições podem alterar o número de ações durante a cena. Revise o quadro de turnos no Escudo do Mestre quando isso ocorrer.
- Bônus de Iniciativa Aprimorada é inserido manualmente no campo situacional, pois não está garantida uma fonte estruturada para a aquisição dessa habilidade.
- Apenas `combat.initiative` (valor principal) é gravado. Turnos extras são derivados em tempo de exibição.
- Validação feita com `tsc --noEmit`; build completo de Vite não disponível neste ambiente devido a dependência nativa ausente.

Não há migração SQL.


---

## Arquivo original: `MELHORIAS_DANO_V273.md`

# HäxBag V273 — botão Dano

Na visualização das fichas de personagens e inimigos, o menu NAVEGAR inclui agora **Dano** imediatamente após **Reações**.

Ao selecionar Dano, a página leva ao painel para aplicar dano físico ou de sanidade, utilizando o cálculo de defesa da ficha. Apenas pessoas com permissão de edição podem confirmar a aplicação.

Instalação:
1. Extraia o ZIP na raiz do projeto `haxbag`, mantendo as pastas.
2. Substitua os arquivos `src/App.tsx` e `src/CombatDamageV273.css`.
3. Reinicie `npm run dev`.

Não é necessário SQL.

Validação: `tsc -p tsconfig.app.json --noEmit` concluído sem erros. O build Vite final não foi executado neste ambiente.


---

## Arquivo original: `COMBATE_DANO_CLASSE_PR_V275.md`

# HäxBag V275 — classificação compartilhada, Dano e PR

A classificação da Forma de Respiração é definida na seção **Dano** e exibida automaticamente no painel **Ações > Crítico** (sem seletor duplicado). Dano puro usa o bônus crítico correspondente a ausência de forma. Formas Raposa, Tigre ou Dragão usam seus bônus de crítico previstos. A fórmula específica de crítico Corvo permanece indefinida; não é inventado um dado automático.

Na seção **Dano**, escolha entre **Dano puro** (não gasta PR) e **Forma de Respiração**. Para a segunda, escolha a classificação e tipo, ajuste opcionalmente a fórmula e informe o custo de PR manualmente. O custo precisa ser inteiro positivo e caber no saldo. O botão desconta PR e persiste na ficha **antes** de rolar os dados. Se o salvamento falhar, a rolagem não ocorre. O custo é apagado ao trocar de classificação/tipo/modo, prevenindo reutilização acidental.

Os resultados mostram valores de dano causado (base, arma, kit, Fluxos, forma e crítico confirmado) e, quando há Respiração, o PR gasto e restante. Não há dano de sanidade causado nem alteração de PV/PS do alvo ou do personagem por meio dessa opção. Os controles já existentes de dano recebido ficam somente em Status.

No ataque, o painel de crítico mostra o bônus previsto, mas não realiza mais uma rolagem duplicada dos dados extras. O cálculo efetivo acontece na seção Dano, com a mesma classificação.

## Aplicação

Extraia a atualização na pasta principal `haxbag`, mantendo os caminhos internos e substituindo os arquivos. Não requer SQL novo. Verificado com `tsc -b` (TypeScript 5.8.3). A compilação completa do Vite não foi executada neste ambiente por dependências nativas de plataforma.


---

## Arquivo original: `BOTAO_DANO_V276.md`

# HäxBag V276 — Botão para abrir a seção Dano

## Alterações

- Botão **Dano** logo abaixo de **Reações**: abre/fecha a seção de rolagem sem navegar para outra página.
- Seção recolhida por padrão para reduzir o espaço ocupado pela ficha.
- O botão **Dano** da navegação rápida abre a mesma seção, ao invés de tentar rolar até conteúdo oculto.
- O atalho **Abrir seção Dano** do painel de críticos também expande a seção.
- A seleção Dano puro / Forma de Respiração, rolagem de dano causado, custo manual e consumo automático de PR permanecem inalterados.
- A seção não aplica dano recebido, não reduz PV/PS e não oferece ataques de sanidade aos jogadores.
- O estado da rolagem é mantido ao fechar e reabrir o painel, até trocar de personagem/inimigo.

## Instalação

Extraia este ZIP na pasta que contém a pasta `haxbag`, ou abra-o e copie o conteúdo da pasta `haxbag` para a raiz do seu projeto, substituindo os arquivos indicados. Não é necessário SQL.

## Validação

`tsc -b --pretty false`: passou. Build Vite: indisponível neste ambiente Linux com dependências nativas do Windows.


---

## Arquivo original: `MELHORIAS_ACOES_COMBATE_V277.md`

# HäxBag V277 — Redesign da seção Ações de Combate

## O que mudou

- Resumo rápido no topo com perfil do ataque, crítico, leitura tática e ritmo do turno.
- Separação visual entre **Ataques principais** e **Táticas e suporte**.
- Ataques principais agrupam: Ataque Bruto, Ataque Ágil, Ataque Especial, Tiro e Disparo.
- Táticas e suporte agrupam: Teste de Perícia, Ações Complexas, Descanso e botão para abrir/fechar Dano.
- Melhor aproveitamento do espaço em desktop e empilhamento limpo em telas menores.
- Mantidas as regras já existentes para críticos, Fluxos, Dano e PR.

## Arquivos alterados

- `src/App.tsx`
- `src/CombatActionsV277.css`


---

## Arquivo original: `MELHORIAS_ACOES_COMBATE_V278.md`

# HäxBag V278 — Central de Ações de Combate

Esta versão continua sobre a V277 e preserva as regras já implementadas em Fluxos, críticos, Reações, Iniciativa e Dano.

## Redesign

- Cabeçalho mais claro, com crítica, classe do ataque e DT do alvo em um só painel.
- Faixa compacta com modo de dano, ações disponíveis, reações e atalho para abrir Dano.
- Cartões de ataque com foco e indicação visual do último teste.
- Área de resultado diretamente após os botões de ataque, separada dos controles das Reações.
- Layout reorganizado para computadores, tablets e celulares; cores seguem o tema.

## Teste de ataque e DT conectados

1. Informe uma DT (opcional) e clique em Ataque Bruto, Ágil, Especial, Tiro ou Disparo.
2. O resultado mostra o dado selecionado, total e situação do acerto.
3. Alterar a DT **não gera outra rolagem**: a conferência utiliza o mesmo d20 registrado no teste anterior.
4. 1 natural continua sendo falha crítica; 20 natural confirma o acerto.
5. Margens críticas intermediárias só confirmam crítico se o ataque acertar a DT.
6. Acertos confirmados oferecem atalho para a seção **Dano**; ela continua sendo o local de rolagem de dano puro ou de Forma de Respiração, com gasto de PR apenas nessa etapa.

A visualização de teste não reduz PV/PS do alvo nem consome PR automaticamente. O gasto de PR continua sendo validado e salvo pelo componente de Dano antes de sua rolagem.

## Arquivos alterados

- `src/App.tsx` — lógica do teste, resultado conectado e layout
- `src/CombatActionsV278.css` — estilos do redesign adicional
- `src/CombatActionsV277.css` — incluído na atualização para compatibilidade

## Validação

- Checagem TypeScript: `tsc -b` — sem erros.
- Prévia HTML: testados cliques, reavaliação de DT e larguras de 1280, 900 e 390 px; sem rolagem horizontal.
- Build Vite completo: indisponível neste ambiente Linux pela ausência de `@rolldown/binding-linux-x64-gnu`; testar `npm run build` no Windows.


---

## Arquivo original: `CORRECAO_COMENTARIOS_COMUNIDADES_V280.md`

# HäxBag V280 — Comunidades e Ações de Combate

A V280 inclui o acabamento visual das Ações de Combate da V279 e estas correções nos comentários do Social/Comunidades:

- Mostra o @username real também em comentários escritos com a própria conta.
- Em comentários feitos como personagem, mostra o personagem e indica qual conta real publicou.
- O @username leva ao perfil da conta responsável.
- O autor pode editar texto de comentários próprios, incluindo os feitos como personagens.
- Edição mantém autor, personagem e comentário-pai; exibe marca `Editado` com data/hora.
- Limite de 1600 caracteres; Cancelar e Salvar com tratamento de erros.
- A verificação de autoria acontece no backend por RLS e gatilho, não só na interface.

## Instalação

1. Extraia a atualização na raiz do projeto HäxBag.
2. Execute `HAXBAG_COMENTARIOS_COMUNIDADES_V280.sql` no Supabase SQL Editor (necessário para salvar edições).
3. Rode `npm run dev` no Windows e teste um comentário próprio feito como personagem.

A migração não apaga comentários e não muda permissões de leitura de comunidades privadas.


---

## Arquivo original: `CORRECAO_TEXTO_FLUXOS_V281.md`

# HäxBag V281 — correção de texto em Fluxos

Mensagem antiga: "Atinga essa graduação para desbloquear o Fluxo."
Mensagem corrigida: "Alcance a graduação necessária para desbloquear este Fluxo."

Instalação: extrair o ZIP de correção na raiz do projeto haxbag, substituindo o arquivo. Nenhuma alteração no banco de dados é necessária.


---

## Arquivo original: `REGRAS_FORMAS_CRITICOS_V282.md`

# HäxBag V282 — Formas de Respiração e crítico por atributo

## Integrado

- Raposa, Tigre e Dragão: fórmulas, três tipos de forma e custos fixos de PR. Custo aparece preenchido automaticamente, mas permanece editável para regras especiais da mesa.
- Forma Destrutiva Tigre/Dragão: opção de ataque direto (FOR) ou à distância/em área (AGI). A variante à distância usa a fórmula reduzida e não soma o dado de Dano Base.
- Formas Ofensivas: escolha entre FOR (bônus no dano) e AGI (bônus no teste do ataque).
- Formas Defensivas: descrições e valores de bônus à DT de Contra-Ataque (+3/+6/+12) apresentados para consulta. Ativação e gasto em reações especiais ainda exigem decisão/ação do mestre; não aplicá-los automaticamente ao botão normal de Contra-Ataque.
- Crítico usa **classificação + atributo da rolagem**: FOR, AGI, INT ou RES; tabelas de dados, condições e redução do PR de movimento.
- Condições críticas vêm com duração rolada (incluindo 1d2, 1d3, 1d4+2, 1d6+2), mas não são aplicadas automaticamente à ficha de ninguém. O mestre decide quais condições e quando aplicar.
- Crítico fica vinculado ao último teste ofensivo que **confirmou o acerto** na aba Ações. Alterar a configuração da Forma invalida a confirmação anterior. Não existe marcação manual independente de crítico na seção Dano.
- Os valores de custos de PR são efetivamente descontados após persistência bem-sucedida e antes da rolagem do dano; nenhum PV/PS é alterado no painel Dano.
- Carpa: catálogo informativo Controle/Suporte/Cura, sem rolagem de ataque mental como se fosse dano físico.
- Formas Corvo: valores legados de fórmula mantidos; custos e efeitos oficiais ainda não foram definidos nas regras enviadas, por isso o custo permanece manual.

## Limites atuais

- Mecânicas especiais dependentes de mesa (múltiplos ataques, reflexo de disparos, área, múltiplas reações, armadura temporária, retorno de dano) são descritas, mas não executam ações múltiplas automaticamente.
- A redução de PR de movimento dos críticos de RES é informada no resultado; não reduz o custo de uma Forma padrão, pois as regras especificam **movimento**.
- Condições de grau I/II não foram convertidas automaticamente para os níveis de Gravidade da biblioteca de Condições. O mestre deve decidir essa correspondência.
- Os críticos de classificação Corvo continuam sem uma tabela oficial definida.

## Divergências nas regras textuais

- Dragão Destrutiva: `3d6+3d4+10` tem dano máximo matemático **40**, e não 44.
- Dragão Ofensiva: `4d6+2d4+4` tem máximo **36**; com bônus +7 de FOR dá **43**, e não 41.

A implementação segue as **fórmulas escritas** e não altera os dados para atingir os máximos divergentes.

## Arquivos

- `src/combatCriticalRules.ts`: regras do crítico por atributo e classe.
- `src/breathingFormRulesV282.ts`: catálogo de formas, custos, bônus e restrições.
- `src/components/CombatDamageRollerV274.tsx`: rolagem com custo de PR automático e efeitos críticos vinculados.
- `src/combatAttackDamageV274.ts`: compatibilidade com a nova tabela de crítico.
- `src/CombatDamageV282.css`: estilo das novas opções.
- `src/App.tsx`: sincronização com ataques, DT, crítico e formulário de dano.

## Aplicação

Substituir os arquivos correspondentes no projeto. Não há mudança de schema nem SQL novo. Validar `npm run build` no Windows antes de publicar.


---

## Arquivo original: `ATUALIZACAO_CRITICOS_MESTRE_V283.md`

# HäxBag V283 — Críticos com aplicação de condições pelo mestre

- Após rolar um crítico com AGI ou INT, são mostradas as condições a escolher, com natureza, grau, quantidade e duração já rolada.
- **A aplicação de condições continua exclusiva do mestre.** A rolagem não cria vínculos nem altera condições automaticamente e não concede novos privilégios aos jogadores.
- O mestre vê o atalho **Abrir painel de Condições**, que leva à seção existente da ficha. Jogadores veem apenas os efeitos a apresentar ao mestre.
- Dano, cálculos de crítico e gasto de PR continuam automáticos conforme V282, sem alterar PV/PS do alvo ou gastar PR duas vezes.
- **Máximos corretos:** calculados a partir da fórmula selecionada, mais bônus de FOR da forma, quando aplicável. O valor mostrado refere-se somente à forma (não inclui dano base, arma, kits ou crítico).
- Dragão Destrutiva direta: `3d6+3d4+10` = **40** de máximo (em vez de 44).
- Dragão Ofensiva: `4d6+2d4+4` = **36**, ou **43** ao usar FOR (+7) (em vez de 41).
- Dragão Destrutiva à distância/área: `2d6+3d4+8` = **32**.

## Instalação

Extraia o ZIP de atualização sobre a V282, substituindo arquivos existentes. **Não é necessário executar SQL.** Execute `npm run build` no seu Windows para validar a aplicação completa.


---

## Arquivo original: `REDESIGN_COMUNICACAO_V285.md`

# HäxBag V285 — Redesign da Comunicação

A base é a V284. Esta atualização altera somente o componente da Comunicação e acrescenta seu novo CSS; **não altera** Social, RPG, Minigames, regras Kisatsutai ou permissões existentes.

## Interface

- Cabeçalho com resumo de servidores, membros e canais não lidos.
- Barra de servidores com identidade visual e destaques de seleção.
- Lista de canais com pesquisa local e filtro de não lidos.
- Painel da conversa redesenhado, com foco em legibilidade e elementos mais compactos.
- Separadores por dia (Hoje, Ontem e demais datas), agrupamento visual de mensagens consecutivas do mesmo autor, imagem de perfil quando disponível e prévia de imagens anexadas.
- Atalhos de resposta, copiar mensagem e botão de mensagens recentes.
- Busca nas 100 mensagens carregadas do canal com Ctrl+K / Cmd+K.
- Campo de mensagem mais claro e contador de caracteres.
- Lista de membros com busca e painel lateral acessível também em telas menores.
- Modais e áreas de configuração adaptados ao novo visual.

## Gestão de canais

- A equipe pode **editar** nome, descrição e visibilidade de cada canal, além de criar ou excluir.
- As alterações aproveitam o RLS de atualização de canais já presente no SQL V284. Não exige novas tabelas ou migração.

## Conservação

- Mantidos o Supabase V284, o envio em tempo real (com atualização periódica), reações, fixações, anexos privados, convites, gerenciamento de cargos e autorização de acesso.
- Corrigida uma corrida assíncrona: mensagens de um canal antigo não sobrescrevem o canal recém-selecionado.
- A busca continua restrita às últimas 100 mensagens carregadas; não é uma busca histórica global.
- Canais de voz e videochamadas **não** foram implementados.

## Instalação

Copie `src/components/CommunicationHubV284.tsx` e `src/components/CommunicationHubV285.css` para as pastas correspondentes. O CSS novo já é importado pelo componente.

**SQL:** nenhum SQL novo. O script `HAXBAG_COMUNICACAO_V284.sql` continua necessário caso ainda não tenha sido executado.

**Validação:** TypeScript isolado do componente validado; prévia renderizada em larguras de 1440, 700 e 390 px sem rolagem horizontal e com navegação/teste de busca/abertura do painel de membros. A compilação do projeto completo excedeu o tempo máximo desta execução e permanece pendente.


---

## Arquivo original: `CORRECAO_CRIACAO_SERVIDORES_V286.md`

# HäxBag V286 — Correção da criação de servidores

## Problema

Ao criar um servidor da aba Comunicação, o Supabase pode responder:
`new row violates row-level security policy for table "hax_v284_servers"`.

O `INSERT ... RETURNING id` da V285 precisa obedecer à política SELECT, mas a política original só permite ler o servidor após o usuário ser incluído em `hax_v284_members` pelo trigger `AFTER INSERT`.

## Correção

- `HAXBAG_REPARO_SERVIDORES_RLS_V286.sql`: permite que o proprietário autenticado leia seu próprio servidor, mantendo os outros servidores restritos aos membros; reexecutável e sem exclusão de dados.
- `src/components/CommunicationHubV284.tsx`: cria o UUID do servidor no cliente e faz o `INSERT` sem pedir retorno imediato; em seguida, carrega os servidores e seleciona o novo. Mantém o trigger e a criação padrão de `#geral` e `#avisos`.
- Mensagem de erro distingue falhas de permissão RLS de ausência de tabela/migração.

## Aplicação

1. No Supabase SQL Editor, execute **somente** `HAXBAG_REPARO_SERVIDORES_RLS_V286.sql` (se já executou a migração V284).
2. Extraia `HaxBag_Correcao_Servidores_Comunicacao_V286.zip` sobre a pasta principal do projeto `haxbag` e confirme a substituição dos arquivos.
3. Reinicie/recompile a aplicação (`npm run build`) e faça login novamente se a sessão estiver expirada.
4. Tente criar um servidor. Ele deve aparecer com os canais `#geral` e `#avisos`.

Se a tabela V284 realmente não existir, execute primeiro `HAXBAG_COMUNICACAO_V284.sql`. **Não** desative RLS e **não** execute de novo a migração V284 se ela já está instalada, pois as políticas originais não usam `IF NOT EXISTS`.

## Limites da validação

Código revisado e pacotes conferidos estaticamente. O reparo SQL não foi executado contra seu banco Supabase; faça um teste de criação na instalação real.


---

## Arquivo original: `REDESIGN_COMUNICACAO_V287.md`

# HäxBag V287 — Redesign da aba Comunicação

Base: projeto completo V286 (incluindo o reparo de RLS dos servidores).

## Melhorias

- Área de Comunicação ocupa a largura disponível da página, sem ficar presa a um contêiner estreito central.
- Novo cabeçalho e barra de contexto do servidor/canal, com atalhos funcionais para localizar canais, escrever e convidar (quando autorizado).
- Navegação de servidores mais ampla e confortável, canais mais legíveis e diferenciação visual entre canais públicos e privados.
- Conversa principal com título, descrição, contagem de mensagens carregadas e pesquisa local mais fáceis de identificar.
- Mensagens com melhor hierarquia tipográfica, espaçamento, indicadores de data, ações, reações e destaque para anexos.
- Área de boas-vindas com atalho para escrever a primeira mensagem quando o canal estiver vazio.
- Editor de mensagens ampliado, com campo de texto, botão de anexo e envio mais acessíveis.
- Membros, moderação e configurações com espaços e tamanhos aprimorados.
- Ajustes responsivos para desktop, tablet e celular; em telas pequenas, o servidor/canal ativo e o chat têm prioridade.

## Arquivos alterados

- `src/components/CommunicationHubV284.tsx`: interface, atalhos e acessibilidade.
- `src/components/CommunicationHubV287.css`: nova camada visual, importada depois da V285.

## Preservação e instalação

- **Sem SQL novo.** Mantenha as migrações V284 e reparo V286 do Supabase já aplicados.
- Não foram modificadas as regras de RLS, nem tabelas, sessões, mensagens ou convites existentes.
- Extraia o ZIP de atualização na raiz do projeto `haxbag`, substituindo os arquivos de mesmo caminho.
- Execute `npm run build` e teste a aba com seu Supabase real.

## Validação

- Sintaxe TSX via TypeScript transpileModule: aprovada.
- CSS analisado: sem erros de parsing.
- Prévia visual em 1920, 1280, 900 e 390 px: sem estouro horizontal; teste de navegação por canais em 390 px.
- Build integrado e operações no Supabase real: **não executados** neste ambiente.


---

## Arquivo original: `CORRECAO_COMUNICACAO_V289.md`

# HäxBag V289 — Comunicação refinada e RLS dos canais corrigido

**Base preservada:** V288 com os canais de voz, mensagens, convites, cargos e políticas anteriores. O arquivo `.env.local` não é distribuído.

## Correção do erro em hax_v284_channels

A leitura de `hax_v284_channels` usava `hax_v284_channel_readable(id)` que consultava a própria tabela. A política foi reescrita para se basear diretamente no vínculo ao servidor e no campo `staff_only`, mantendo canais privados reservados à equipe. A criação, edição e exclusão seguem disponíveis apenas para donos, admins e moderadores, com proprietário do servidor tratado como responsável mesmo se o vínculo automático de membro estiver atrasado. O frontend cria o UUID antes do envio e não usa `INSERT ... RETURNING`.

Execute **`HAXBAG_REPARO_CANAIS_RLS_V289.sql`** no Supabase SQL Editor *após* a migração V284, o reparo V286 e a migração de voz V288 (se usa voz). Não reexecute a V284. O reparo é idempotente e não apaga dados.

## Refinamentos da aba

- Hierarquia visual mais clara entre servidor, canal ativo, conversa, ações e chamadas de voz.
- Destaque do canal selecionado, números por categoria, mensagem do autor e foco por teclado.
- Cabeçalho de boas-vindas compacto quando já existe conversa, liberando área útil.
- Indicador de carregamento, sem mostrar mensagens do canal anterior ao alternar canais.
- Atualização periódica das reações de outros participantes.
- Atalhos `Ctrl/⌘+K` (buscar mensagens) e `Ctrl/⌘+Shift+K` (buscar canais); `Esc` fecha modais.
- A criação limpa filtros de canais para exibir imediatamente o novo canal.
- Ajustes de contraste, composição, avisos, chamadas e telas pequenas.

## Verificação

Testar com duas contas: proprietário e membro. Criar canais texto e voz como proprietário; confirmar que membro comum NÃO consegue criar canais, que canais privados NÃO aparecem para membros comuns, e que mensagens/reactions funcionam. Necessário testar no Supabase real.


---

## Arquivo original: `CORRECAO_AUTH_DESKTOP_V292.md`

# HäxBag V292 — Correção do login no aplicativo Electron

## Erro diagnosticado

O aplicativo Windows V291 pode incluir o `productName` `HäxBag` no cabeçalho HTTP `User-Agent`, com caracteres não ASCII. O erro de Auth reportado foi `invalid byte sequence for encoding "UTF8": 0xe4 0x78 0x42`, correspondendo a `äxB` em codificação de um byte. O login no navegador funciona e somente o aplicativo falha.

## Correção

- `desktop/main.cjs`: normaliza o User-Agent do Electron para ASCII imprimível antes da inicialização das janelas e requisições.
- Aplica o mesmo identificador à sessão de rede e ao `webContents` principal, antes de `loadURL`.
- Mantém intactos o título HäxBag, o ícone, as configurações visuais, o Supabase e os dados existentes.

## Como instalar

1. Extraia o ZIP de atualização na raiz de `haxbag`, substituindo `desktop/main.cjs`.
2. No Windows, execute `GERAR_HAXBAG_WINDOWS.bat` novamente para gerar o instalador ou portátil corrigido.
3. Feche a versão anterior e execute a nova. Tente entrar com a mesma conta.
4. Se ainda ocorrer erro, compare a mensagem de Auth do novo executável e compartilhe o novo log sem dados sensíveis.

Não precisa executar SQL, apagar usuários, limpar cookies ou remover políticas RLS.

Validação: sintaxe Node e testes de normalização do User-Agent. Integração real depende de teste no Windows/Supabase.
