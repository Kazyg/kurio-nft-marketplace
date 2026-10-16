# Fase 5A.1 — Ajustes da Home

## Escopo e preparação

Foram relidos README, `docs/architecture.md` (o arquivo de arquitetura existente, sem um ARCHITECTURE.md na raiz) e a verificação da Fase 4 antes das alterações. Foram inspecionados layout, estilos, catálogo/filtros, Router, hooks/cache, contratos, handlers e socket. O Figma MCP não foi consultado: os tokens, assets e contextos locais em `reports/figma` foram suficientes para os pontos solicitados. Não houve auditoria das outras telas, Lighthouse ou deploy.

## Problemas, causas e soluções

1. **Indicador Socket.IO permanente:** o componente de integração renderizava seu status no fluxo visual de todas as rotas. A conexão continua montada na raiz. Telemetria e seletores dos testes permanecem sem ocupar layout; status saudável não é anunciado publicamente. `/diagnostics` exibe o diagnóstico, e uma perda/erro real apresenta aviso discreto com anúncio acessível e reconexão. O aviso desaparece quando a subscription é confirmada novamente. Transporte, listeners, eventos, sessão e heartbeat foram preservados.
2. **Busca desktop expandida:** o campo do catálogo era posicionado de forma absoluta sobre o header, com regras extras para reservar espaço do menu. A busca agora pertence ao header, recolhida por padrão e com campo expansível ancorado à lupa. Enter/Espaço/click expandem e focam; Escape fecha e devolve foco. O termo pertence à URL, portanto fechar não o apaga. A ref de foco é estável para não roubar foco em refetch. Mobile mantém a composição de busca/filtros acima do hero. A renderização acompanha o breakpoint de 1024px sem duplicar inputs acessíveis.
3. **Menu sem ativo consistente:** apenas Início usava Link do Router; Mercado era uma âncora comum. Ambos agora usam TanStack Router e indicação explícita com cor, sublinhado e aria-current. Início representa a Home sem seleção; Mercado representa `#catalog`, busca/filtros/paginação e rotas de NFT/carrinho/checkout/pedidos/favoritos. Áreas editoriais não implementadas continuam como texto, sem falso estado ativo.
4. **Badge deslocado:** uma regra ampla `.cart-icon span` posicionava qualquer span do botão; a âncora também dependia do tamanho do botão inteiro. Agora `.cart-glyph` é o container relativo do ícone, e somente `.cart-count` fica absoluto. O badge admite mais de um dígito, mantém overflow visível, contagem real e área clicável de pelo menos 44px no desktop e mobile.
5. **Rodapé inconsistente:** links recém-adicionados herdavam tipografia global, enquanto somente spans tinham regra de lista. A regra local das colunas agora padroniza links e spans em 12px/20px e peso 400, preservando títulos em destaque.
6. **Rodapé sem interação:** redes sociais agora são links HTTPS para plataformas gerais, com nomes acessíveis, nova aba e noopener/noreferrer. Newsletter permite digitar e-mail, valida com Zod, limpa após entrada válida e informa explicitamente que não houve envio nem inscrição. Coleções usam IDs reais, navegam para o catálogo e reiniciam a página. Favoritos/carteiras/pedidos reutilizam rotas existentes; áreas indisponíveis continuam texto sem ação fictícia.
7. **Linhas de cards próximas:** apenas `.catalog-results > .nft-grid` recebe row-gap de 72px no desktop. Larguras, três colunas, proporções e demais grids foram preservados. O espaçamento/desencontro mobile permanece próprio.

## Causa raiz da piscada

A chave da query inclui todos os filtros e a página. Antes, mudar essa chave colocava a consulta em `isPending` sem placeholder, e `CatalogPage` substituía toda a grade por skeletons. Além disso, `Filters` tinha key baseada em mínimo/máximo, causando remount do formulário ao aplicar preço. Não foi encontrado remount do layout/rota por URL nem um Suspense global causando a troca; `resetScroll: false` já estava correto e foi mantido.

`useCatalog` agora conserva o último resultado enquanto a nova chave carrega, somente dentro da mesma coleção (evita apresentar relacionados de outra coleção). Skeleton completo continua para o carregamento inicial sem dados. Uma mensagem discreta e aria-busy indicam atualização, sem apagar header/sidebar/hero/grade/rodapé. A paginação fica desabilitada enquanto seus metadados ainda são placeholder. Queries continuam recebendo AbortSignal; cada chave possui seu resultado e structural sharing preserva versões novas. Falhas e resultados vazios continuam explícitos. Nenhum retry ou invalidação foi desabilitado para esconder o problema.

O formulário de filtros perdeu a key de URL e sincroniza os valores sem remontar. Testes guardam referências reais dos nós e verificam que continuam conectados durante paginação/filtro. Busca rápida também verifica que uma resposta antiga cancelada ou concluída não substitui o resultado atual. O mesmo hook atende relacionados; consultas de detalhe por outro NFT continuam com carregamento inicial apropriado, e a cotação financeira mantém seus próprios guards existentes.

## Slider e origem do teto

O contrato de `NftList` recebeu `priceRange: {minEth, maxEth, version}`. O handler calcula o máximo sobre `state.nfts` completo **antes da paginação e independentemente dos filtros**, usando o mesmo `priceEth` que a API filtra/ordena. Não deriva o teto da página visível nem fixa um preço na UI. O mínimo permitido é zero. A versão é a soma das versões dos NFTs, e a reconciliação impede que metadados REST mais antigos substituam o teto recente.

O Radix Slider já instalado fornece duas alças ordenadas e teclado. O controle visual usa 10.000 passos inteiros: `wei × passo / 10.000`, com BigInt em toda conversão de ETH; Number é usado apenas para índices limitados a 0–10.000 exigidos pelo controle. A resolução visual é uma fração do teto; campos textuais mantêm até 18 casas decimais para escolhas exatas, inclusive um wei. Não há cálculo monetário em ponto flutuante.

Movimentar alças atualiza somente o rascunho/campos. Aplicar valida a faixa, limita ao teto, rejeita inversão, reinicia a página e altera URL/consulta REST. Refresh/histórico restauram valores. Ao chegar um novo teto por REST após `nft.updated`, o rascunho no teto anterior acompanha o teto novo; escolhas menores válidas permanecem. Reduções normalizam os limites sem negatividade/inversão. Aplicar confirma o rascunho normalizado na URL; o evento não altera silenciosamente os filtros aplicados pelo usuário. Limpar filtros também limpa rascunho e erro, sem remount. Mobile usa o mesmo controle no diálogo e restaura foco no botão ao fechar.

## Responsividade e zoom

O container máximo existente de 1440px, gutters de 120px no desktop largo e 48px no desktop intermediário foram preservados. Não foi aplicado scale à aplicação nem expansão ilimitada. Em uma largura efetiva de 5760px, o container continua com 1440px e centralizado: a aparência pequena a 25% é consequência esperada de reduzir a interface e aumentar o viewport CSS, não um defeito a compensar.

Foram preparados testes de reflow em 390, 414, 768, 1024, 1280 e 1440px, mais 720 e 360px (espaço CSS equivalente a 200%/400% de zoom sobre uma janela de 1440px). Essa equivalência testa o layout disponível, sem afirmar que automação de zoom nativo do navegador foi realizada. O rodapé antes era inteiramente escondido abaixo de 1024px; agora possui grid adaptável e links/formulário disponíveis em telas estreitas e reflow. Header compacto, busca mobile e navegação fixa permanecem. Nenhuma largura mínima extra foi introduzida.

## Arquivos

Criados: `src/shared/layout/header-search.tsx`, `newsletter.tsx`; `src/shared/lib/use-desktop.ts`; `src/features/catalog/price-filter.tsx`; `tests/home-adjustments.spec.ts`; este relatório.

Modificados: `src/shared/layout/marketplace-layout.tsx`, `src/features/catalog/catalog-page.tsx`, `src/shared/api/marketplace-hooks.ts`, `src/shared/contracts/marketplace.ts`, `src/shared/realtime/marketplace-realtime.tsx` e `reconcile.ts`, `src/mocks/marketplace-handlers.ts`, `src/index.css`, `tests/catalog.spec.ts`, README e contratos REST. Não foram adicionadas dependências nem alterados tokens/assets ou regras de compra/autenticação/pedidos.

## Verificação

| Verificação                | Resultado                       |
| -------------------------- | ------------------------------- |
| `bun run typecheck`        | Passou                          |
| `bun run lint`             | Passou                          |
| `bun run format:check`     | Passou                          |
| `bun run build`            | Passou                          |
| `bun run build:demo`       | Passou                          |
| `bun run test:e2e:dev`     | **99/99 passaram**, sem retries |
| `bun run test:e2e:preview` | **99/99 passaram**, sem retries |

Foram preservados os 79 cenários anteriores e adicionados 20. Somente o teste existente de busca recebeu a ação de abrir a nova busca recolhida antes de preencher/conferir seu valor; suas assertions REST, URL, refresh e resultados não foram removidas ou enfraquecidas. A telemetria de socket mantém os mesmos seletores e assertions. As suítes completas rodaram sequencialmente, com quatro workers Chromium e arquivos congelados, encerrando normalmente com código 0.

O preview valida o build otimizado de produção com `VITE_ENABLE_MSW=true`. Diagnóstico HTTP via Axios/Service Worker, Socket.IO com eventos reais e heartbeat após 30 segundos continuam aprovados. Também passaram os fluxos de autenticação, compra completa ao recibo, pedidos pendentes/recusados, timeout/refresh/idempotência e isolamento de usuários.

Os testes novos cobrem busca recolhível/teclado/termo, menu ativo, badge 0/1/9/12 no desktop/mobile, identidade dos nós durante filtro/paginação, resposta antiga após busca rápida, slider desktop/mobile/validação/um wei/URL/refresh, teto global após evento real, redução/expansão de limites, categorias do rodapé/histórico, newsletter e links sociais acessíveis, reconexão sem debug permanente, oito larguras e container extremo. Screenshots `home-390.png` e `home-1440.png` estão nos diretórios dos casos em `test-results/`; relatório em `playwright-report/index.html` (ambos ignorados pelo Git).

A primeira execução parcial terminou 31/32: o teste novo supunha um resultado para “Emerald”, mas a API retorna cinco NFTs das fixtures. A expectativa foi substituída pela resposta real da API e verificação de cada nome. A execução seguinte passou nos 19 testes novos então disponíveis. Foi acrescentado o caso mobile para slider/foco antes da regressão final. As capturas de Home desktop/mobile foram inspecionadas; não foi feita auditoria completa de fidelidade às 15 telas.

## Limitações

Zoom nativo do browser e leitores de tela requerem conferência manual adicional; a cobertura automatizada usa Chromium e reflow equivalente. A resolução por teclado/arraste do slider é de 1/10.000 do teto; precisão de um wei permanece disponível nos campos. A newsletter é exclusivamente demonstrativa. Páginas editoriais ainda indisponíveis não foram criadas. Limitações já documentadas de IndexedDB/Web Locks e binding WebSocket permanecem. Lighthouse, auditoria completa e deploy não fazem parte desta entrega.
