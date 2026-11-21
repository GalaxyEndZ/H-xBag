# HäxBag — V225 · Equipar kits pelo inventário

- Cartões de **kits equipáveis** agora têm botão **Equipar kit** / **Equipado · Desequipar**, seguindo o mesmo visual dos equipamentos.
- Em layouts que mostram atalhos de equipamento no topo dos cartões, os kits também possuem um atalho 🧰/✓.
- A ação funciona no inventário da ficha e na visualização geral, além dos detalhes do item.
- Kits oficiais equipáveis (Simples/Padrão/Raro) e kits antigos cadastrados apenas na categoria **Kits** estão incluídos. Kits consumíveis não recebem o botão.
- O estado é persistido em `inventory_items.metadata.equipped`; a ficha já utiliza esse campo para aplicar bônus e determinar disponibilidade para descanso.
- A seleção de bônus de perícias não é modificada; kits sem tipo oficial podem ser equipados, mas não ganham automaticamente bônus de perícias não cadastrados.
- Sem SQL adicional.
