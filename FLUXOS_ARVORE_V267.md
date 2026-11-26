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
