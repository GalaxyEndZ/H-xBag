# HäxBag — feed unificado (V248)

A linha do tempo do Social agora intercala cronologicamente as publicações comuns com as publicações de personagens, enquetes, citações e discussões. A seção separada "Jornadas, personagens e discussões" foi incorporada ao feed principal.

## Alterações

- Um único mural, com cartões tradicionais e especiais ordenados por data ou interações.
- Filtros de Comunidade, Seguindo, Amigos, Minhas; pesquisa global e "Com fotos" aplicados à linha do tempo.
- O editor normal permanece; recursos de personagem, enquete ou grupo ficam no editor expandível, acima do mural.
- Hashtags de Explorar pesquisam o mesmo feed, e não apenas a parte especial.
- Curtidas, comentários, enquetes, salvar, denunciar e privacidade continuam usando suas rotinas originais.
- Se os recursos adicionais não estiverem disponíveis, publicações comuns continuam visíveis.

## Instalação

Extraia `HaxBag_Correcao_Feed_Unificado_V248.zip` na raiz do projeto, preservando as pastas, e substitua os arquivos existentes.
Depois execute `npm run build` e atualize o navegador com Ctrl + F5.

## Limites e verificação

A união das linhas do tempo é feita na interface com os registros **já carregados**; os dois sistemas mantêm a paginação e a persistência existentes. `Mostrar mais publicações` continua solicitando páginas adicionais do feed tradicional. O filtro `Com fotos` inclui os registros que possuem arquivos de imagem no feed tradicional.

As análises de sintaxe TSX e CSS foram realizadas; o build completo, as consultas reais e os filtros de acesso devem ser verificados no ambiente instalado.

Nenhuma migração SQL nova é necessária.
