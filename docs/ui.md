# Interface do catálogo — Fase 2

Implementação baseada diretamente nos contextos de alta fidelidade do Figma MCP: Home desktop `2:2`, Home mobile `14:5226`, detalhe desktop `10:244` e detalhe mobile `15:5536`. As referências completas consultadas estão em `reports/figma`. A quarta chamada desta sessão atingiu o limite Starter; o contexto mobile já obtido pelo coordenador foi utilizado integralmente.

`src/shared/layout/marketplace-layout.tsx` concentra o cabeçalho, rodapé, navegação móvel, diálogo de login e resumo do carrinho. `src/features/catalog/catalog-page.tsx` recebe busca validada e atualiza a URL pelo roteador. `src/features/nft-details/nft-details-page.tsx` apresenta galeria, zoom, edições, estoque, quantidade, carrinho e relacionados. Componentes compartilhados usam o Button shadcn existente e Dialog baseado no Radix, com foco, Escape e retorno de foco gerenciados pela biblioteca.

Os oito arquivos em `public/assets/nfts` foram baixados dos assets originais do Figma. Obras que reutilizam a mesma arte no design permanecem iguais em arquivos locais distintos. Os SVGs em `public/assets/figma` incluem ícones originais e os assets editoriais. Nenhuma URL temporária é usada no código de execução. Roboto Mono e as cores globais existentes permanecem alinhados aos tokens do design.

Dados de NFTs, preços, conteúdo editorial, facets, sessão, favoritos e carrinho vêm exclusivamente dos hooks REST. Preços ETH são exibidos como strings, sem cálculo em ponto flutuante. A quantidade é limitada ao estoque da edição; trocar edição reinicia a quantidade. Favoritar sem sessão abre login e retoma a ação ao autenticar. Comprar adiciona ao carrinho e comunica explicitamente que checkout pertence à próxima etapa.

Adaptações funcionais: busca textual no cabeçalho desktop e acima do hero no mobile, ordenação na toolbar desktop e no modal de filtros mobile, controles de preço decimal em vez de um slider decorativo, estados de carregamento/erro/vazio e paginação real. Links de áreas futuras são texto sem navegação; newsletter está desabilitada, sem envio fictício. Avaliações mostram apenas a contagem/nota da API, sem comentários inventados. Login demonstra somente autenticação; cadastro e perfil ficam para a próxima etapa.

Os seletores `catalog-grid`, `catalog-card`, `catalog-skeleton`, `catalog-error` e `catalog-empty` e rótulos acessíveis estão disponíveis para Playwright. A validação integrada dev/preview e os registros visuais são executados pelo coordenador para evitar disputa de portas.

QA visual: screenshots de 1440 e 390 px foram inspecionados contra os contextos do Figma. Foram refinados a busca incorporada ao header desktop, a quebra do título, a primeira dobra mobile sem ordenação extra, o alinhamento da avaliação e a barra de compra fixa no detalhe mobile. A barra exibe o preço unitário da edição como string; a cotação financeira pertence ao backend de mocks e ao fluxo futuro de checkout. Relacionados consultam a coleção efetiva do NFT.

Entre 320 e 1023 px a navegação compacta, filtros em diálogo e grade de duas colunas preservam a legibilidade. O breakpoint de 1024 px evita que o cabeçalho desktop e a sidebar comprimam o catálogo em tablets de 768 px; o Figma fornece os extremos mobile e desktop, portanto esse intervalo é uma adaptação responsiva.
