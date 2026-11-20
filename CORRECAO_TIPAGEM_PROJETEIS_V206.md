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
