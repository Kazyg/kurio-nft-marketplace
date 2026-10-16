# Verificação da Fase 2 — 15/10/2026

## Integração

Os contratos foram definidos antes da execução paralela. O agente de domínio trabalhou em mocks, conversão financeira e testes REST; o agente de interface trabalhou no catálogo, detalhe, componentes, estilos e assets; um agente de testes preparou a cobertura do catálogo. O coordenador integrou Router, Axios, Query, autenticação, dependências, testes de sessão e documentação. As mudanças foram feitas em conjuntos de arquivos distintos no mesmo workspace e integradas antes da validação final.

## Arquivos desta fase

Criados:

- `src/shared/contracts/marketplace.ts` e `money.ts`.
- `src/mocks/fixtures.ts`, `repository.ts` e `marketplace-handlers.ts`.
- `src/shared/api/identity.ts`, `marketplace.ts` e `marketplace-hooks.ts`.
- `src/app/route-pages.tsx`, `search-params.ts` e `session-lifecycle.tsx`.
- `src/features/catalog/catalog-page.tsx` e `src/features/nft-details/nft-details-page.tsx`.
- `src/shared/layout/marketplace-layout.tsx`.
- `src/shared/ui/dialog.tsx`, `favorite-button.tsx`, `login-dialog.tsx`, `network-feedback.tsx` e `nft-card.tsx`.
- Assets originais em `public/assets/nfts/` e `public/assets/figma/`.
- `tests/helpers.ts`, `catalog.spec.ts`, `domain.spec.ts` e `session.spec.ts`.
- `docs/rest-contracts.md`, `domain.md`, `ui.md` e este relatório.

Modificados: `src/app/App.tsx`, `src/app/router.tsx`, `src/shared/api/client.ts`, `src/mocks/handlers.ts`, `src/main.tsx`, `src/index.css`, `index.html`, `package.json`, `bun.lock`, `playwright.config.ts`, `tsconfig.node.json`, `tests/network.spec.ts`, `README.md` e `docs/architecture.md`.

## Checks e testes

| Verificação                   | Resultado      |
| ----------------------------- | -------------- |
| TypeScript strict             | passou         |
| ESLint                        | passou         |
| Prettier                      | passou         |
| Build Vite                    | passou         |
| Playwright em desenvolvimento | 21/21 passaram |
| Playwright em build + preview | 21/21 passaram |

O build de preview usa a otimização de produção com `VITE_ENABLE_MSW=true`. A infraestrutura original foi preservada: diagnóstico Axios/MSW, evento Socket.IO e heartbeat após 30 segundos continuam aprovados. O teste do fallback foi atualizado somente para refletir que a rota inicial agora é o catálogo.

A cobertura inclui consultas pelo Service Worker, filtros combinados e refresh, ordenação/paginação/voltar/avançar, detalhe direto e inexistente, limite de quantidade, favorito otimista com rollback 503, loading/erro/vazio, screenshots e ausência de overflow em 390/768/1440px. Testes de sessão comprovam a retomada do favorito, preservação do detalhe, merge do carrinho e expiração.

Os testes de domínio verificam separação de dados entre usuários, cadastro e senha, perfil/avatar/carteiras, valores exatos, indisponibilidade, cotações vencidas/desatualizadas, pedidos pendentes/recusados, snapshot do recibo, payload idempotente conflitante, persistência após refresh e criação concorrente em abas diferentes. O cenário pós-criação atrasa a resposta em 12s, ultrapassando o timeout Axios de 10s; um teste aborta a resposta e recupera o pedido imediatamente pela mesma chave sem duplicá-lo.

Após a suíte completa, a revisão visual motivou dois ajustes apenas de CSS: breakpoint compacto até 1023px para evitar sobreposição em 768px e remoção de uma regra global que sobrepunha a cor do Button Tailwind. Os três testes de responsividade foram reexecutados nos dois modos após esses ajustes.

As capturas finais percorrem as imagens visíveis, aguardam `naturalWidth > 0` e as fontes locais, e retornam ao topo antes do screenshot. Isso evita registrar espaços vazios de imagens lazy que ainda não entraram na viewport. Essa verificação adicional também passou nos três tamanhos em dev e preview.

## Problemas encontrados e resolvidos

- Serialização JSON padrão do Router colocava aspas nos preços decimais. A URL agora usa URLSearchParams textual, com coerção somente dos inteiros na validação Zod.
- O teste de latência configurava um cenário antes de o MSW terminar de iniciar após navegação completa. A preparação agora aguarda o diagnóstico HTTP.
- Foram corrigidos caracteres de substituição em fixtures, conteúdo editorial, quebra do hero, posição da busca e barra de compra mobile.
- A revisão transacional adicionou rollback de erros de validação e Web Locks para evitar gravações concorrentes entre abas.
- As mudanças de identidade cancelam consultas privadas e descartam caches por usuário; o ciclo de sessão é centralizado, sem um timer por card.

## Assets e revisão visual

Os quatro frames foram consultados diretamente via Figma MCP. A consulta duplicada do agente de interface ao detalhe mobile atingiu o limite Starter, e o contexto completo já obtido pelo coordenador foi utilizado. Nenhum frame necessário ficou sem contexto de propriedades.

Foram revisados os screenshots desktop, mobile e tablet. Os assets originais foram baixados localmente; nenhuma URL temporária do Figma está em `src` ou `public`. Os PNGs preservados somam aproximadamente 16MB, e otimização de entrega permanece uma pendência de desempenho. Os scores Lighthouse da Fase 1 não representam estas novas telas; Lighthouse não foi reexecutado nesta fase.

## Limites e revisão manual

- O domínio é uma demonstração local em IndexedDB, sem backend remoto. Web Locks requer navegador compatível e contexto seguro (localhost é válido).
- Pedidos pendentes reservam estoque e não transitam automaticamente: eventos futuros não foram antecipados.
- Checkout, pagamentos e blockchain reais não foram implementados. Comprar adiciona ao carrinho e informa o limite da etapa.
- Cadastro, perfil e carteiras possuem contratos e handlers, mas suas telas não fazem parte desta fase. Login usa diálogo para preservar a ação pendente.
- Contagens, redes e NFTs adicionais vêm de fixtures para viabilizar filtros e paginação; não são uma reprodução dos números ilustrativos do Figma.
- Os controles de faixa de preço usam campos decimais acessíveis. A ordenação mobile fica no diálogo de filtros. O layout intermediário de tablet é uma adaptação, pois os frames fornecidos são desktop e mobile.
- Recomenda-se revisão manual dos quatro frames, navegação por teclado/leitor de tela, Safari/Firefox e tamanhos intermediários. A validação automatizada foi feita no Chromium.

Os relatórios e screenshots são gerados em `playwright-report/` e `test-results/`, ignorados pelo Git. Consulte README e os contratos para reproduzir cenários e verificações.
