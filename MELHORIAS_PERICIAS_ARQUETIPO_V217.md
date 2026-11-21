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
