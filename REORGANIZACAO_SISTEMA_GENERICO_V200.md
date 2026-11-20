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
