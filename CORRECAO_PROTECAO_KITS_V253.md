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
