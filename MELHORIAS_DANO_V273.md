# HäxBag V273 — botão Dano

Na visualização das fichas de personagens e inimigos, o menu NAVEGAR inclui agora **Dano** imediatamente após **Reações**.

Ao selecionar Dano, a página leva ao painel para aplicar dano físico ou de sanidade, utilizando o cálculo de defesa da ficha. Apenas pessoas com permissão de edição podem confirmar a aplicação.

Instalação:
1. Extraia o ZIP na raiz do projeto `haxbag`, mantendo as pastas.
2. Substitua os arquivos `src/App.tsx` e `src/CombatDamageV273.css`.
3. Reinicie `npm run dev`.

Não é necessário SQL.

Validação: `tsc -p tsconfig.app.json --noEmit` concluído sem erros. O build Vite final não foi executado neste ambiente.
