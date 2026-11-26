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
