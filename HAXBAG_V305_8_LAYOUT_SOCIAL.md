# HäxBag V305.8 — Correção estrutural da lateral Social

- O painel contextual do Social agora começa na linha do launcher, eliminando a faixa vazia superior.
- A rail do Social inicia imediatamente abaixo do logo e ocupa melhor o espaço disponível.
- Cabeçalho, grupos recolhíveis, ícones, títulos e setas ganharam uma grade de alinhamento consistente.
- Mudanças restritas ao Electron desktop (largura mínima de 801 px); layout web e telas pequenas preservados.
- Sem migração SQL.

Valide no Electron real em diferentes temas, com os grupos abertos e fechados, e confirme o build antes da publicação.

## Enciclopédia

- Nova interface em duas áreas: explorador com pesquisa e categorias à esquerda, leitura/edição à direita.
- Cards de artigos com metadados e indicador de visibilidade para mestres.
- Editor com campos organizados, limite de caracteres e confirmação de salvamento.
- Corrigido o fluxo de criação/edição: página nova sempre usa `p_id: null`, e a seleção passa a ser baseada no UUID retornado pela função SQL.
- Histórico de revisões preservado, com mensagens de carregamento e atualização manual.
- Sem alteração no esquema SQL; respeita o RLS existente.
