# Fase 5B — performance, acessibilidade e regressão visual

## Preparação e preservação

Execução em 16/10/2026. Foram lidos README, `docs/architecture.md` (não existe ARCHITECTURE.md na raiz), relatórios das Fases 2, 3, 4 e auditoria 5A. A Fase 5A estava efetivamente documentada e possuía 208 testes e capturas em 390/768/1440px. O Git contém apenas o commit inicial; os arquivos da aplicação e das fases anteriores já estavam sem rastreamento no início desta tarefa. Nenhum desses arquivos foi descartado, resetado ou consolidado em commit automaticamente.

Foram separados os arquivos de performance/assets, acessibilidade/componentes e regressão visual entre três agentes. O coordenador integrou as mudanças, configurou Lighthouse e executou validações gerais. Não houve consultas ao Figma, alteração de contratos REST, persistência, cálculos financeiros, estoque, máquina de estados, idempotência, sessão ou protocolo Socket.IO. MSW e Socket.IO permanecem funcionando durante as medições.

## Assets e carregamento

As oito artes PNG originais somam **16.102.885 bytes**. As oito versões WebP de 1254px somam **1.297.800 bytes**, redução de **91,94%**. Foram geradas 40 variantes locais (160/320/640/960/1254px), totalizando 2.686.160 bytes. Os originais foram preservados: o pacote em disco aumenta, enquanto os recursos transferidos pela interface diminuem. URLs desconhecidas e dados persistidos continuam compatíveis.

O helper responsivo aplica srcset, sizes e dimensões em cards, hero, detalhes, miniaturas, carrinho e recibo. Artes fora da área inicial usam lazy loading; as imagens principais têm prioridade alta. A fonte Roboto Mono permanece local com seus três pesos, antecipando WOFF2 400 e 700. Rotas e formulário do diálogo de login passam a carregar sob demanda. [Inventário, arquivos e reprodução da conversão](phase-5b-performance.md).

As medições revelaram dois gargalos adicionais. O rodapé aparecia antes da rota e saltava quando o conteúdo chegava: `Suspense` agora reserva altura apenas durante o carregamento. O catálogo, necessário na entrada principal, permanece no módulo crítico; Detalhes usa `route.lazy` nativo com reserva de altura, e as demais páginas continuam separadas. `main.tsx` inicia o MSW antes de avaliar ReactDOM, enquanto modulepreload antecipa somente a busca/compilação da montagem. A aplicação continua sendo importada e executada depois de ativar o MSW.

Filtros desktop deixam de montar uma árvore oculta no mobile; slider e diálogos carregam quando necessários. O módulo de tempo real é montado automaticamente em um Suspense isolado, sem timer ou condição especial de auditoria. Cards usam memoização padrão, e botões sem classes customizadas evitam inicializar o merger de classes. Em produção, somente os logs de depuração MSW são silenciados; requisições não tratadas continuam reportando erro. Um experimento de preload antecipado do próprio MSW piorou o probe mobile e foi revertido.

A latência simulada também era aguardada dentro do Web Lock, serializando GETs independentes. Ela agora é lida do cenário persistido e aguardada antes de entrar na transação, sem reduzir os 120ms padrão nem mudar as operações atômicas. Falhas programadas, validações, snapshots e mutações continuam protegidos pelo mesmo lock; `responseDelays` conserva seu comportamento. Um teste dispara três GETs com 2000ms de latência e exige conclusão entre 2000 e 4000ms, em vez dos 6000ms da execução serial anterior.

## Acessibilidade

Corrigidos nomes acessíveis divergentes, atributos ARIA inválidos, associação de erros, painéis das abas, foco visível, skip link, restauração de foco dos diálogos, contraste de texto em botões primários, alvos dos indicadores e dimensões de imagens. O botão Favoritar mantém nome constante e expõe seu estado por `aria-pressed`. As expectativas existentes de estado e persistência foram preservadas ao atualizar seus seletores.

Foram adicionados testes axe WCAG e testes de teclado, modal, feedback, movimento reduzido, reflow e alvos da galeria. A auditoria automática não comprova todos os critérios WCAG; validação com leitores de tela e outros navegadores permanece uma recomendação manual. [Problemas, correções e limites](phase-5b-accessibility.md).

## Regressão visual

Home, Detalhes, Carrinho e Checkout em 390/768/1440 × 900px, com viewport e página completa: **24 baselines PNG** em `tests/visual-baselines/win32/`. Dados vêm de reset e endpoints REST existentes; fontes e imagens são aguardadas, o relógio tem data fixa, animações são estabilizadas e nenhuma área é mascarada.

A comparação aceita zero pixels diferentes acima do limiar perceptual padrão Playwright 0,2. Uma comparação inicial com limiar 0,1 detectou um único pixel de rasterização da arte WebP, preservado nos artefatos. Um teste negativo separado injeta um contorno magenta apenas no navegador: deve falhar e produzir expected/actual/diff, sem alterar a aplicação ou suas baselines. [Configuração, comandos, evidências e condições do sistema](phase-5b-visual.md).

## Arquivos modificados

- Assets/carregamento: `public/assets/nfts/responsive/*.webp`, `scripts/optimize-images.py`, `src/shared/lib/nft-image.ts`, `src/shared/ui/nft-card.tsx`, `button.tsx`, `src/features/catalog/catalog-page.tsx`, `index.html`, `vite.config.ts`, `src/main.tsx`, `src/app/mount.tsx`, `lazy-pages.tsx`, `route-pages.tsx`, `router.tsx`, `nft-route.tsx`, `nft-route.lazy.ts`, `route-error.tsx`, `route-pending.tsx` e `phase-three-pages.tsx`; conteúdo de login em `src/shared/ui/login-dialog.tsx` e novo `login-dialog-content.tsx`.
- Acessibilidade: `src/index.css`; componentes compartilhados `dialog.tsx`, `favorite-button.tsx`, `network-feedback.tsx`, `star-rating.tsx`; layout `marketplace-layout.tsx` e `header-search.tsx`; páginas de autenticação, perfil, carteiras, detalhes/compartilhamento, carrinho, checkout e pedidos; estilos `cart.css` e `checkout.css`.
- Transporte simulado: `src/mocks/repository.ts` e `marketplace-handlers.ts` retiram a espera de transporte do lock; `enable.ts` silencia somente logs de depuração em produção.
- Validações: novos `tests/accessibility-phase5b.spec.ts`, `tests/loading-phase5b.spec.ts`, `scripts/visual-regression.spec.ts`, `playwright.visual.config.ts`, baselines e `scripts/lighthouse-config.ts`; atualização de `scripts/lighthouse.ts`, `playwright.config.ts`, `tsconfig.node.json`, `package.json` e `bun.lock`. Acrescentada somente a dependência de desenvolvimento `@axe-core/playwright`4.14.0.
- Seletores/asserts existentes: `auth-visual-social.spec.ts`, `catalog.spec.ts`, `home-adjustments.spec.ts`, `nft-details-technical.spec.ts`, `privacy-phase3.spec.ts`, `purchase-journey-phase4.spec.ts`, `session.spec.ts`, `visual-ux-adjustments.spec.ts`, `account-phase3.spec.ts`, `cart-visual-checkout.spec.ts`, `checkout-network-fixes.spec.ts` e `mobile-login-return.spec.ts`. Nome constante do toggle é verificado com estado aria-pressed; a expectativa PNG virou WebP com cinco candidatos srcset e imagem decodificada. Capturas aguardam explicitamente as imagens lazy e o modal antes de Escape. Não foram removidos cenários anteriores.
- Documentação: README, `docs/architecture.md`, este relatório e os três relatórios complementares da Fase5B.

## Problemas intermediários e correções

A implementação inicial de `lazyRouteComponent` provocou um aviso real de suspensão condicional com React19.3.1. Foi substituída por React.lazy, mantendo StrictMode e adicionando um teste de erros de execução. Um override inicial de pending global também expôs CancelledError no guard privado ao desconectar observadores antes da consulta de sessão terminar. Os overrides foram removidos, restaurando o comportamento anterior do Router; a reserva de espaço permaneceu apenas no conteúdo. Guard, sessão e suas regras não foram alterados. Perfil e Carteiras mobile passaram novamente no teste focado.

Os primeiros testes de erro de catálogo expuseram um problema do próprio cenário: uma consulta anterior consumia uma falha programada. O teste agora troca para diagnóstico antes de programar as falhas, mantendo os asserts. As execuções intermediárias com falhas ou interrompidas não são contabilizadas como aprovação final. As medições insuficientes anteriores à correção de carregamento estão preservadas em `reports/phase-5b/lighthouse-first-iteration/` e nos relatórios probe, sem substituir as medianas finais.

A primeira execução final de preview com quatro workers passou 241/242 em 3,6min e apresentou uma falha no beforeEach: o trace mostra `ERR_NO_BUFFER_SPACE` ao buscar o JavaScript inicial, antes de a aplicação ou a validação de cadastro executar. A repetição integral com dois workers passou 241/242 em 6,2min, com o mesmo erro ao navegar para diagnóstico em outro teste, antes de qualquer autenticação social. O caso interrompido da primeira rodada passou na segunda. Não houve alteração de implementação, tempo limite, assertions ou retries entre essas rodadas.

Os relatórios e traces estão preservados em `reports/phase-5b/e2e-preview-initial/`, `e2e-preview-initial-trace/`, `e2e-preview-two-workers/` e `e2e-preview-two-workers-trace/`. A consulta somente leitura ao sistema mostrou aproximadamente 4,3GB de RAM livre, 467 conexões TIME_WAIT e intervalo de 16384 portas dinâmicas, sem evidência de esgotamento dessas duas capacidades. A causa de sistema do erro não foi identificada, e reduzir a concorrência para dois workers não bastou. A execução integral serial com um worker passou 242/242 em 12,1min, sem alterar os testes. Isso fornece uma execução completa aprovada neste ambiente; não demonstra que a causa do erro de rede em paralelo foi corrigida.

Uma execução anterior em desenvolvimento passou 236/242 e expôs esperas inadequadas dos testes após lazy loading: capturas aguardavam decode de imagens lazy fora do viewport, e o retorno do login enviava Escape antes de o conteúdo do modal terminar de carregar. A preparação das capturas solicita as imagens já presentes no DOM antes de decodificá-las; o teste de retorno aguarda o diálogo visível antes de Escape. Os asserts de imagem, layout, foco e retorno foram mantidos. Os seis casos focados passaram e uma nova execução integral passou 242/242 antes da última rodada de divisão de módulos. Artefatos em `reports/phase-5b/e2e-dev-initial/`, `e2e-dev-initial-results/` e `e2e-dev-before-final-splitting/`; a aprovação final usa a execução posterior com a fonte congelada.

## Ambiente Lighthouse

Windows x64 10.0.26200, Intel Core i3-12100F, oito processadores lógicos, 16GB RAM. Bun 1.4.2, Node 24.14.0, Playwright 1.64.1, Lighthouse 13.5.0 e Chromium 156.0.8078.4, revisão 1248. O Lighthouse CLI é executado pelo Node instalado; o orquestrador Bun informa internamente compatibilidade Node v26.3.0, registrada separadamente da versão real do CLI em summary.json.

Build otimizado `build:demo`, preview local na porta 4175. `bun run lighthouse` valida previamente HTTP/MSW e Socket.IO e então executa três navegações para cada combinação Home/Detalhes × desktop/mobile. Cada medição inicia um novo perfil Chromium, com limpeza padrão do Lighthouse e sem cache prévio. O seed padrão, latência REST padrão de 120ms, assets, fontes e funcionalidades são os mesmos da aplicação. O visitante não está autenticado. Não há filtros de requisições nem recursos desligados.

Configuração versionável: `scripts/lighthouse-config.ts` e `scripts/lighthouse.ts`. Throttling `simulate`, com presets oficiais desktop e mobile, registrados integralmente em cada relatório. Mobile: viewport 412×823, DPR1,75, RTT150ms, throughput1638,4Kbps e multiplicador CPU4. Desktop: viewport 1350×940, DPR1, RTT40ms, throughput10240Kbps e CPU1. Os relatórios HTML e JSON ficam em `reports/phase-5b/lighthouse/`, com medianas e configurações em `summary.json`.

A medição inicial isolada da Home mobile foi **80/96/100/100** (Performance/Acessibilidade/Boas práticas/SEO), LCP aproximadamente4,1s. Ela é diagnóstico inicial, não uma mediana de três execuções.

## Resultados finais

### Lighthouse

As 12 auditorias finais foram concluídas, sem warnings ou runtimeError. Cada célula é a mediana das três execuções da combinação, incluindo as métricas individuais; não são os números do melhor relatório.

| Página / perfil  | Performance | Acessibilidade | Boas práticas | SEO |    LCP |     CLS |      TBT |
| ---------------- | ----------: | -------------: | ------------: | --: | -----: | ------: | -------: |
| Home desktop     |          99 |            100 |           100 | 100 |  991ms | 0,00908 |      0ms |
| Home mobile      |      **80** |            100 |           100 | 100 | 4324ms |       0 | 104,19ms |
| Detalhes desktop |          99 |            100 |           100 | 100 |  947ms |       0 |      0ms |
| Detalhes mobile  |      **79** |            100 |           100 | 100 | 4234ms | 0,04860 |  112,5ms |

Performance nas três execuções: Home desktop 99/99/98; Home mobile 77/80/80; Detalhes desktop 99/99/98; Detalhes mobile 79/79/79. As outras três categorias ficaram em 100 em todas as execuções. O comando encerrou corretamente com **exit code 1**, pois Performance mobile não atingiu 90. As metas desktop e as demais categorias mobile foram atingidas; **a meta global da Fase 5B continua pendente**.

O gargalo remanescente é o caminho inicial de JavaScript e bootstrap dos mocks/React/Query sob CPU4 e rede mobile simuladas. No relatório Home mobile 2, o bundle de mocks transfere aproximadamente 171,5kB e ocupa 592,7ms na auditoria bootup; a montagem transfere 81kB e ocupa 505,2ms; o cliente Query transfere 26,4kB. Essas durações são do trace coletado, enquanto LCP da tabela é calculado pela simulação Lighthouse. A imagem LCP correta é Emerald Ape 320px, renderizada com 166px CSS, e o download da arte ocupa cerca de 18,4ms no trace. Portanto, reduzir apenas o tamanho das artes não resolve o atraso até a renderização.

As artes agora são pequenas e o CLS ficou controlado, mas LCP mobile permanece próximo de 4,3s. Foram implementadas e medidas conversão responsiva, antecipação de fonte/montagem, divisão de rotas/controles, remoção de árvore oculta, memoização, correção da serialização da latência e reserva dos estados pendentes. O experimento de preload MSW foi revertido por piorar FCP. Não se reduziu latência, throttling, dados, imagens ou funcionalidades para melhorar a nota. Uma próxima investigação deve partir dos traces de carregamento mobile preservados; não há afirmação de que atingir 90 seja impossível.

### Validações gerais

`bun run typecheck`, `bun run lint` e `bun run format:check` passaram após a integração. A execução final `bun run test:e2e:dev --workers=4 --retries=0` passou **242/242 em 5,9min**: os 208 cenários anteriores, 32 novos de acessibilidade e dois de carregamento/transporte. O relatório completo está em `reports/phase-5b/e2e-dev/index.html`, com anexos axe. O runner mantém HMR desativado somente durante E2E.

`bun run test:e2e:preview --workers=1 --retries=0` passou **242/242 em 12,1min**, com build de produção e `VITE_ENABLE_MSW=true`. Relatório completo em `reports/phase-5b/e2e-preview/index.html`. Foram preservadas as duas execuções anteriores 241/242 e suas evidências de erro de rede do Chromium. Não se somam testes de rodadas diferentes para afirmar aprovação: a execução serial completa ficou verde sozinha.

`bun run build` passou na preparação do preview; `bun run build:demo` passou na preparação Lighthouse e novamente na suíte visual. A comparação final `bun run test:visual` passou **12/12 em 24,5s**, sem retries, máscaras ou atualização de snapshots: as 24 referências em 390/768/1440px continuam aprovadas após a última divisão dos módulos. Relatório em `reports/phase-5b/visual/html/index.html` e resultados em `reports/phase-5b/visual/results.json`.

| Validação                                        | Resultado final                                   |
| ------------------------------------------------ | ------------------------------------------------- |
| Typecheck                                        | Aprovado                                          |
| Lint                                             | Aprovado                                          |
| Format check                                     | Aprovado                                          |
| Build                                            | Aprovado                                          |
| Build demo                                       | Aprovado                                          |
| Playwright desenvolvimento, 4 workers, 0 retries | 242/242                                           |
| Playwright preview, 1 worker, 0 retries          | 242/242                                           |
| Regressão visual, 2 workers, 0 retries           | 12/12, 24 PNGs                                    |
| Lighthouse, 12 medições                          | Concluído; metas Performance mobile não atingidas |

Não houve exclusões, skips ou redução do conjunto anterior de cenários. A única dependência nova é de desenvolvimento; não foi necessário atualizar versões de React, MSW, Socket.IO ou TanStack para contornar problemas. A natureza simulada das integrações permanece documentada, sem inserir novos avisos na interface.

## Publicação e limites

Não foi realizado deploy. Para publicar a demonstração, usar `bun run build:demo`, HTTPS, fallback SPA para index.html e servir o worker local no escopo da aplicação. Preservar todos os assets e fontes locais, incluindo variantes responsivas. Aplicar compressão Brotli/gzip no host e cache imutável apenas para arquivos com hash; worker e HTML precisam ser revalidados. O domínio continua local em IndexedDB e depende de navegador com Web Locks; não há backend, gateway ou blockchain real.

Baselines dependem de Windows e da versão de Chromium documentados; outro sistema exige referências próprias revisadas. Não atualizar snapshots automaticamente para ocultar regressões. Os artefatos de execução são locais e ignorados pelo Git; configurações, testes, documentação e baselines estão fora dos diretórios ignorados e devem acompanhar o código no próximo commit autorizado.
