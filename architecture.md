# Arquitetura do Kurio

## Visão geral

Aplicação cliente React/TypeScript com TanStack Router para navegação, TanStack Query para estado remoto e Axios como fronteira REST centralizada. MSW intercepta HTTP e o transporte WebSocket de um cliente Socket.IO real. O domínio simulado é persistido em IndexedDB; componentes e hooks não fabricam respostas ou efeitos financeiros.

Não há backend, OAuth, assinatura de carteira, envio de e-mail ou movimentação blockchain. Os dados pertencem ao navegador e à origem, inclusive no endereço público. O fluxo de compra demonstra validação, concorrência e recuperação; não representa uma integração financeira real.

## Organização e responsabilidades

| Diretório              | Responsabilidade                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/app`              | Providers, composição, Router, guards e ciclo centralizado de sessão                                          |
| `src/features`         | Páginas e comportamento de catálogo, detalhes, autenticação, carrinho, conta, checkout, pedidos e diagnóstico |
| `src/shared/contracts` | Fronteira tipada REST, eventos e conversão ETH/wei                                                            |
| `src/shared/api`       | Axios, identidade, query keys, consultas, mutations e limpeza de cache                                        |
| `src/shared/realtime`  | Subscription Socket.IO, validação e reconciliação monotônica                                                  |
| `src/shared/layout`    | Header, busca, navegação mobile e rodapé                                                                      |
| `src/shared/ui`        | Componentes visuais reutilizáveis e wrappers Radix/shadcn                                                     |
| `src/mocks`            | Fixtures, repositório transacional, regras e handlers HTTP/Socket.IO                                          |
| `public/assets`        | PNGs originais, WebPs responsivos e SVGs locais                                                               |
| `tests` / `scripts`    | Testes de navegador, baselines e automações Bun                                                               |

Features compartilham contratos e UI, sem importar detalhes internos de outras funcionalidades. Rascunhos de formulário e seleções locais pertencem à interface; recursos de negócio pertencem ao cache REST. Mudanças em Router, contratos, configuração e lockfile devem ser coordenadas para evitar alterações concorrentes.

## Bootstrap, navegação e carregamento

`src/main.tsx` carrega fontes/estilos e aguarda `enableMocking()`. Somente então importa `app/mount.tsx` e monta React. A ordem é obrigatória: Engine.IO captura o construtor global WebSocket ao avaliar o módulo. HTTP usa o Service Worker; WebSocket é interceptado no contexto da página.

O plugin Vite antecipa a busca/compilação da montagem e suas dependências estáticas por `modulepreload`, sem avaliá-las antes do MSW. O catálogo permanece no módulo crítico para iniciar suas consultas sem suspensão adicional. Detalhes usa `route.lazy` nativo do TanStack Router; outras páginas usam React.lazy. Fallbacks reservam altura para impedir que o rodapé apareça e salte antes do conteúdo. Não se força `pendingMs: 0` globalmente: a configuração dos guards deve permitir concluir a consulta de sessão sem desmontar prematuramente seus observadores.

As rotas de conta compartilham um layout persistente com sidebar e Suspense localizado no conteúdo. Seus módulos usam route.lazy nativo, permitindo carregar a tela sem substituir todo o shell. Navegação interna e pré-carregamento preservam sessão e code splitting.

Slider e diálogos de filtro, zoom e login carregam quando necessários. Filtros desktop não montam uma árvore oculta no mobile. Tempo real monta automaticamente num Suspense isolado, sem timer ou condição especial para auditorias.

Rotas públicas: `/`, `/nfts/$nftId`, `/login`, `/register`, `/cart` e `/diagnostics`. Perfil, carteiras, favoritos, checkout e pedidos exigem sessão. O fallback informa página inexistente. `redirect` aceita somente destinos locais seguros. Links internos usam o Router para preservar o documento/cache.

Busca, filtros e paginação são serializados por URLSearchParams textual; somente inteiros são convertidos na validação. ETH não passa por coerção de ponto flutuante. O catálogo mantém resultados anteriores durante refetch apenas na mesma coleção; loading inicial, erro e vazio permanecem distintos. Paginação fica bloqueada enquanto seus metadados são placeholder.

## Contratos REST

Fonte de verdade: `src/shared/contracts/marketplace.ts`. Cliente tipado: `src/shared/api/marketplace.ts`; cache/hooks em `marketplace-hooks.ts` e `order-hooks.ts`. Base padrão `/api`. Respostas de sucesso são objetos diretos, sem envelope. Recursos mutáveis usam `version` e `updatedAt`; IDs/datas são strings. Paginação começa em 1.

| Método e caminho             | Entrada                                       | Resposta                            |
| ---------------------------- | --------------------------------------------- | ----------------------------------- |
| `GET /diagnostics`           | —                                             | Diagnóstico HTTP validado com Zod   |
| `GET /nfts`                  | `CatalogSearch` na query string               | `NftList`                           |
| `GET /nfts/:id`              | —                                             | `Nft`                               |
| `GET /catalog/content`       | —                                             | `CatalogContent`                    |
| `POST /auth/register`        | `RegisterInput`                               | `Session`                           |
| `POST /auth/login`           | `LoginInput`                                  | `Session`                           |
| `POST /auth/social`          | Provedor `google` ou `facebook`               | `Session`                           |
| `GET /auth/session`          | Identificadores atuais                        | `Session`, user null para visitante |
| `POST /auth/logout`          | Sessão                                        | 204                                 |
| `GET /favorites`             | Sessão                                        | `Favorites`                         |
| `PUT /favorites/:nftId`      | Sessão                                        | `Favorites`                         |
| `DELETE /favorites/:nftId`   | Sessão                                        | `Favorites`                         |
| `GET /cart`                  | Sessão ou `X-Guest-Id`                        | `Cart`                              |
| `POST /cart/items`           | `CartItemInput`, acumula quantidade           | `Cart`                              |
| `PATCH /cart/items/:itemId`  | `{quantity}`, inteiro >=1                     | `Cart`                              |
| `DELETE /cart/items/:itemId` | —                                             | `Cart`                              |
| `POST /quotes`               | `QuoteInput`                                  | `Quote`                             |
| `POST /orders`               | `CreateOrderInput`, `Idempotency-Key`, sessão | `Order`                             |
| `GET /orders`                | Sessão, `idempotencyKey?`                     | `Order[]` do proprietário           |
| `GET /orders/:id`            | Sessão proprietária                           | `Order`                             |
| `GET /profile`               | Sessão                                        | `User`                              |
| `PATCH /profile`             | `ProfileInput` com versão                     | `User`                              |
| `PUT /profile/password`      | `PasswordInput`                               | 204                                 |
| `GET /wallets`               | Sessão                                        | `Wallet[]`                          |
| `POST /wallets`              | `WalletInput`                                 | `Wallet`                            |
| `PATCH /wallets/:id`         | Campos de carteira e versão                   | `Wallet`                            |

Autorização usa `Authorization: Bearer <accessToken>`; visitante usa `X-Guest-Id`, também enviado ao autenticar para merge. Erros usam `ApiErrorBody`: `error.code`, `message`, `fields?`, `requestId` e `retryable`. Códigos incluem validação, não autenticado, proibido, inexistente, conflito de versão/cotação, indisponibilidade e falha transitória. Axios possui timeout de 10s.

### Modelos e catálogo

- `Nft`: identidade, obra/galeria, coleção, categoria, rede, criador, nota, atributos, versões e edições. Cada `NftEdition` possui preço e estoque independentes.
- `NftList`: itens/paginação, facets globais e `priceRange` global versionado. O teto usa todos os NFTs antes dos filtros; sua versão soma as versões do catálogo.
- `User`: perfil versionado, `username`, e-mail, avatar, bio e ENS opcional. Username normalizado é único, 3–30 caracteres `[a-z0-9_]`; e-mail é único. ENS é apenas formato `.eth`, sem resolução blockchain. A bio interna é preservada mesmo sem edição visual.
- `Wallet`: endereço, rede canônica `ethereum|polygon|solana`, provedor `metamask|walletconnect|coinbase`, principal e versão. Metadados opcionais incluem `displayName`, `profileName`, `secondaryAddress`, `referralCode`, `email` e `ens`.
- `Cart`: proprietário, versão e linhas identificadas por ID, NFT, edição e quantidade.
- `Quote`: carrinho/versão, rede opcional, validade e snapshot financeiro.
- `Order`: proprietário, status, snapshot financeiro/carteira/rede/colecionador, referência de transação, tentativas, prazo de resolução e recibo.

Fixtures oferecem 36 NFTs, nove categorias e três redes. Oito artes/nomeações de referência vêm do Figma; outros registros reutilizam assets para exercitar filtros e paginação. Galeria e avatares podem reutilizar a arte do próprio NFT. Comentários são fixtures de apresentação, sem backend de avaliações.

Filtros combinam texto, categoria, coleção, rede, preço inclusivo e aba com AND. Ordenações: `recent`, `price-asc`, `price-desc`, `popular`; abas `all`, `new`, `trending`. Novos foram criados desde 2026-10-01; tendências possuem ao menos 100 avaliações. Página padrão contém nove itens, máximo 24. Faixas malformadas/invertidas são rejeitadas pela API.

`Nft.technical` opcional informa descrição da rede, royalties em basis points, endereço/mint, padrão e verificação demonstrativa. Royalties 0 são válidos; ausência não implica 5%. EVM utiliza ERC-1155; Solana usa Metaplex Token Metadata. Referências são distintas por NFT e fictícias. `demo-verified` não representa validação blockchain; royalties informativos não alteram taxas da compra.

## Autenticação e isolamento

Sessões/token/expiração pertencem ao repositório. Credenciais fictícias são derivadas por PBKDF2-SHA256, 100.000 iterações e salt aleatório; texto puro não é persistido. Isso não constitui segurança de um backend real, pois todo o domínio está no cliente.

Cliente guarda token/identificação de visitante e metadados necessários à recuperação; dados de negócio vêm do REST. `session-lifecycle.tsx` centraliza expiração e sincronização entre abas. Logout/troca/expiração limpam caches privados. Query keys privadas incluem proprietário. Mutations de token antigo não atualizam o cache novo; um 401 antigo não encerra outra sessão. Na revalidação de expiração, a consulta aguardada pelo guard não deve ser cancelada prematuramente.

Login/cadastro e social compartilham o mesmo ciclo. Google/Facebook são identidades locais estáveis, sem OAuth ou chamada aos provedores; colisões de e-mail/username não apropriam outra conta. Identidades sociais e contas novas começam sem carteiras. Recuperação de senha não envia mensagem real.

Intenção temporária de favorito contém NFT/destino/prazo, é consumida uma vez após login ou descartada ao cancelar. Não replica sessão/carrinho. O diálogo desktop mantém o contexto; mobile utiliza página própria e retorno SPA.

## Persistência e concorrência

IndexedDB `kurio-mock-domain-v2` guarda um registro estruturado com usuários, credenciais derivadas, sessões, carrinhos, favoritos, carteiras, cotações, pedidos, idempotência e outbox. Cada operação lê um draft atualizado, valida e grava somente após sucesso. Erros de validação fazem rollback; consumo de falhas configuradas e erro após criação possuem commit explícito.

Fila local e Web Locks serializam read/modify/write entre abas. Latência simulada é aguardada antes da transação; respostas atrasadas são entregues após liberar o lock. Operações atômicas não são substituídas por locks de UI.

Migrações compatíveis completam campos ausentes de perfil, metadados técnicos conhecidos e carteiras da conta Ana sem resetar compras/estoque/carrinhos. Não se infere metadado técnico para NFT desconhecido ou de rede divergente. Para pedido sem snapshot histórico de carteira, só é possível usar registro disponível ou indicar ausência; finanças antigas não são recalculadas.

Visitante possui carrinho próprio. Login/cadastro mescla com o carrinho do usuário, limita quantidade ao estoque e consome o carrinho visitante, impedindo merge repetido. Cupom pretendido fica em sessionStorage por carrinho; validade/valores pertencem à cotação REST.

Ana possui carteiras nas três redes para avaliação; Bruno permite conferir isolamento e ausência de carteira compatível. Cada navegador/origem tem estado independente. Contexto seguro, IndexedDB e Web Locks compatíveis são necessários.

## Precisão financeira e cotações

ETH cruza REST como string decimal com até 18 casas. `money.ts` converte para BigInt em wei; não há cálculo monetário em ponto flutuante. Desconto e taxa usam basis points e arredondam para baixo ao wei inteiro. Taxa é 250 basis points sobre subtotal descontado. `KURIO10` oferece 10% com mínimo 0,1 ETH; `EXPIRED` exercita expiração.

Quotes capturam versões do carrinho, NFT/edição, quantidades, estoque, preço, cupom e prazo (padrão cinco minutos). A API revalida esses dados ao criar o pedido; UI não recalcula informalmente subtotal/desconto/taxa/total. Preços de linhas do carrinho vêm de `Quote.snapshot.lines`.

Uma carteira só compra uma rede. `QuoteInput.network` seleciona linhas daquela rede, registrando o escopo; rede inválida/seleção vazia retorna 422. Em carrinho multirrede, usuário escolhe a rede explicitamente. Itens de outras redes permanecem no carrinho. Sem escopo, API mantém cotação integral, mas rejeita pedido multirrede com carteira única. Cache da cotação inclui rede. Versão do carrinho inteiro exige nova revisão após mudanças.

Antes de enviar, checkout busca cotação atualizada. Alteração financeira, de quantidade, estoque ou versão impede envio até revisão e nova confirmação explícita. A própria página de pagamento apresenta revisão, itens e totais; não há segunda lista/resumo de revisão. Mudanças da cotação são aceitas por ação contextual na mesma página antes de confirmar novamente. Seleção de carteira usa rede dos NFTs; principal só é priorizada se compatível. Identidade/versão/rede/provedor da carteira compõem a conexão, invalidada ao trocar os dados.

Slider usa 10.000 passos inteiros com conversão BigInt; Number serve somente ao índice limitado exigido pelo Radix. Campos textuais preservam precisão de um wei. Alterações no teto não mudam silenciosamente os filtros aplicados pelo usuário.

## Tentativas, idempotência e pedidos

A tentativa de compra persiste por usuário chave, payload e ID do pedido. Envio, refresh, timeout e recuperação reutilizam os mesmos dados enquanto o resultado estiver desconhecido ou pendente. `GET /orders?idempotencyKey=...` recupera sem criar. Abrir `/checkout` ou reconectar não deve disparar compra.

A entrada explícita pelo carrinho registra em sessionStorage um marcador por usuário, consumido uma vez pelo checkout. O hook verifica o pedido por REST e descarta a tentativa anterior somente se o resultado for terminal; falha de recuperação ou pendência preserva chave/payload.

Uma compra independente exige ação explícita e nova chave após estado terminal; tentativa confirmada/recusada não deve aprisionar o checkout seguinte. Não se apagam tentativas desconhecidas/pendentes para permitir novo envio. O repositório persiste associação usuário/chave/payload normalizado/pedido sob Web Locks: mesma chave/payload recupera pedido original mesmo se cotação vencer ou carrinho mudar; payload diferente retorna 409. Duplicação de cliques não cria efeitos adicionais.

Estados: `pending`, `confirmed`, `declined` (recusado). Transições permitidas são somente `pending → confirmed` e `pending → declined`; estados terminais não regridem. `resolveAt` e `resolution` persistem o prazo/resultado. Transações seguintes resolvem prazos vencidos, inclusive após fechar e reabrir o navegador; timer apenas provoca consultas.

Pendência não baixa estoque. Confirmação verifica todas as linhas atomicamente, impede estoque negativo e subtrai somente quantidades compradas dos IDs originais do carrinho, uma única vez. Adições posteriores e linhas removidas/recriadas são preservadas. Recusa não remove itens. Se estoque esgotar antes da resolução pendente, o pedido pode ser recusado.

`FinancialSnapshot` guarda linhas, subtotal, desconto, taxa, total, cupom e moeda. Pedido também copia carteira, rede, colecionador e referência; `Receipt` reutiliza o snapshot original. Mudanças futuras no catálogo/carteira não alteram recibos. Colecionador possui nome, e-mail e observação opcional até 1000 caracteres, incluída no payload idempotente. Modal de sucesso depende exclusivamente de pedido efetivamente confirmado.

## Socket.IO e reconciliação

MSW está fixado em 2.15.0 e `@mswjs/socket.io-binding` em 0.2.0, cujo peer é `^2.10.2`. Cliente Socket.IO 4.8.4 usa exclusivamente `transports: ['websocket']`. Não há servidor local, polling HTTP, upgrade de polling, namespaces customizados, rooms ou acknowledgements implementados. Binding não oferece paridade integral com servidor Socket.IO; MSW 3 não foi validado em execução.

MSW 2.15 normaliza `/socket.io/` ao comparar URL; handler aponta à raiz `ws(s)://origem/`, enquanto conexão real usa `/socket.io/?EIO=4&transport=websocket`. Binding fornece abertura Engine.IO/Socket.IO e codificação dos eventos; handler complementa ping Engine.IO `2` a cada 20s e limpa o intervalo ao fechar. Cliente real responde pong. Diagnóstico correlaciona `diagnostic:request`/`diagnostic:result` por UUID validado com Zod; sua reconexão automática é desabilitada. A conexão de marketplace possui recuperação própria.

Mudanças do domínio gravam outbox transacional com últimos 512 eventos. `nft.updated` inclui `eventId`, `sequence`, `nftId`, `version`, `updatedAt` e recurso; `order.updated` acrescenta pedido e proprietário. O handler lê a outbox e emite através do binding; nenhum mock chama setters React/cache.

Subscription explícita contém token/subscriptionId verificados no repositório. Pedidos só chegam ao proprietário. Cliente valida sessão/subscription, identidade e versão. Eventos iguais/antigos são descartados; structural sharing impede regressão de versões/estados terminais por REST atrasado. NFT revalida catálogo, detalhe, carrinho/cotação; pedido revalida pedidos e recursos afetados.

Logout/troca removem listeners e fecham conexão anterior. Reconexão identifica sessão via REST antes de assinar e revalida recursos ativos; polling REST de pedidos pendentes recupera eventos perdidos. Outbox limitada não substitui REST. Indicadores saudáveis ficam no diagnóstico; interrupção real apresenta aviso acessível temporário.

## Falhas determinísticas

Controles existem somente com MSW habilitado, na base `/api`:

| Endpoint                 | Comportamento                                                         |
| ------------------------ | --------------------------------------------------------------------- |
| `POST /__mock/reset`     | Restaura domínio e cenários sem atrasos/falhas configurados           |
| `GET /__mock/scenario`   | Consulta configuração                                                 |
| `PATCH /__mock/scenario` | Atualiza `MockScenario`                                               |
| `PATCH /__mock/nfts/:id` | `{editionId?, priceEth?, available?}`, incrementa versão/emite evento |
| `POST /__mock/realtime`  | Ação `disconnect` ou `replay`; `eventId?` e `reverse?`                |

Cenário aceita latência padrão 120ms; falhas `{path,method?,status,remaining}` com status 401/403/409/422/503; TTL de sessão/cotação, `expiredCoupons` e resultado do pedido. Paths são relativos exatos, ou prefixo com `*` final. Consumo de falha é persistido.

Resultados: `confirmed`, `declined`, `pending` sem resolução automática, `pending-confirmed`, `pending-declined`, `timeout-before-create`, `timeout-after-create`, `connection-error`. `orderResolutionMs` determina prazo de pendência.

`timeout-after-create` persiste pedido confirmado/efeitos/recibo/idempotência, libera o lock e atrasa falha 503 por 12s; Axios expira em 10s. Recuperar a mesma chave retorna o pedido sem aguardar a resposta original. Timeout anterior à criação e erro de conexão não representam sucesso. Resultado desconhecido exige recuperação antes de uma nova compra.

`responseDelays: [{path,method?,delayMs,remaining}]` captura o snapshot na transação e atrasa entrega fora do lock, permitindo testar REST antigo após evento novo. `replay` com `reverse:true` exercita deduplicação/ordem. Reset é destrutivo apenas para a simulação da origem; exemplos estão no README.

## Cache e falhas de interface

TanStack Query: staleTime 60s, gcTime 5min, sem refetch automático ao focar janela; uma tentativa adicional para erro de rede/5xx, nenhuma para 4xx. Mutations não têm retry automático. Recuperação de compra é explícita e idempotente, independente dessa política.

Listagem inclui todos os parâmetros validados na chave; consultas recebem AbortSignal. Favoritos cancelam consulta, guardam snapshot otimista, revertem erro e revalidam. Queries privadas são separadas por proprietário e descartadas ao trocar identidade. Versões monotônicas protegem dados contra respostas fora de ordem; quote tem guards próprios de proprietário, carrinho, rede e validade.

Loading, erro, vazio, indisponibilidade e cotação obsoleta são estados distintos. Perfil/carteira usam conflitos de versão sem perder rascunho. Perfil, apelido de carteira e senha são chamadas separadas: sucesso parcial é comunicado, sem alegar atomicidade inexistente.

## Design, assets e acessibilidade

Referência: [Figma Kurio](https://www.figma.com/design/Hfp4aJDaHzzuDlneSaFbwD/?node-id=0-1). Frames: Home desktop `2:2`/mobile `14:5226`; detalhes `10:244`/`15:5536`; carrinho `11:1278`/`16:360`; pagamento `11:2862`/`16:748`; login `9:115`/`16:1022`; cadastro `9:1022`/`16:1228`; perfil `9:1238`; carteiras `9:1670`; confirmação `11:4385`, modal `70376:239`. Contextos/capturas locais ficam em `reports/figma` quando disponíveis. Perfil/carteiras/atividade/interesse mobile são adaptações responsivas de componentes existentes.

| Token                                 | Valor                                |
| ------------------------------------- | ------------------------------------ |
| Ink / background / primary foreground | `#140D0A`                            |
| Foreground / text primary             | `#F5F1EB` / `#F7F3EC`                |
| Surface card / surface dark           | `#241612` / `#38220F`                |
| Primary / secondary / accent          | `#D28A4C` / `#B39463` / `#E89B55`    |
| Text secondary                        | `#CFB28C`                            |
| Border / border soft                  | `#3F2319` / `#55321F`                |
| Background elevated                   | `#FBFBFB`                            |
| Fonte                                 | Roboto Mono local, pesos 400/500/700 |
| Display / body                        | 43px/70px, 700 / 14px/24px, 400      |

Tokens ativos e ajustes acessíveis estão em `src/index.css`; layout intermediário compacto até 1023px evita comprimir sidebar/header. Home mantém cards em duas colunas e hero mobile próprio. Conta reutiliza sidebar e painéis; carrinho mobile reserva espaço para resumo fixo com altura adaptável e rolagem em viewport baixo.

Oito PNGs 1254px preservados somam 16.102.885 bytes. Quarenta variantes WebP locais 160/320/640/960/1254px somam 2.686.160 bytes; conjunto 1254px soma 1.297.800 bytes, 91,94% menor. `nft-image.ts` adapta somente artes conhecidas, preservando URLs de contratos/IndexedDB e URLs desconhecidas. Hero, imagem principal e primeiro card LCP têm prioridade; demais imagens usam lazy loading, dimensões explícitas e `sizes`. Não existem URLs temporárias Figma no runtime.

Para regenerar: instalar Pillow 12.2.0 e executar `python scripts/optimize-images.py` (WebP qualidade 90, método 6, Lanczos). Pillow não é dependência de execução/build. WOFF2 400/700 têm preload; fontes não vêm de CDN.

Acessibilidade: labels estáveis, erros associados, foco visível, skip link para main focável, abas com IDs/painéis e setas/Home/End, `aria-pressed` para favoritos, live feedback e alvos de pelo menos 24px. Radix gerencia trap/Escape/scroll lock; wrapper restaura foco com callbacks específicos prioritários. Zoom mantém imagem dentro do viewport; recibos longos permitem rolagem. Movimento reduzido desativa shimmer/transições/smooth scroll. Contraste usa texto Ink nos CTAs laranja e erros claros.

## Testes e evidências

Playwright executa Chromium real, dados preparados por REST/MSW e sem setters internos ou callbacks substituindo Socket.IO. HTTP verifica Service Worker/header; eventos verificam cliente real e heartbeat além de 30s. Cobertura inclui domínio, isolamento, merge, concorrência entre abas, dinheiro exato, estoque, cotação, autenticação, timeout, pedidos, replay/reconexão, cache e UI responsiva.

Comandos estão no README. Runner dev usa HMR desativado somente em E2E; preview faz build de produção com `VITE_ENABLE_MSW=true`. Retries são zero. Relatórios funcionais e traces ficam em `playwright-report/`/`test-results/`; artefatos de auditorias em `reports/`, ignorados pelo Git. Arquivos de teste que contêm identificadores numéricos no nome continuam válidos e não precisam ser renomeados para executar a suíte.

Axe usa etiquetas WCAG 2 A/AA, 2.1 A/AA e 2.2 AA, sem exclusões de regras/elementos. Cenários incluem telas, erros, loading, teclado, foco, favorito selecionado e hit testing mobile. Reflow 720×450 CSS px equivale ao espaço de janela 1440×900 com zoom 200%; isso não comprova zoom nativo ou uso real de leitor de tela.

`playwright.visual.config.ts` compara Home/Detalhes/Carrinho/Checkout em 390/768/1440×900px: 12 testes, 24 PNGs em `tests/visual-baselines/win32/`. Preparo usa reset REST, Ana, latência zero, relógio 2026-10-16T12:00:00Z, fontes/imagens decodificadas, animações estabilizadas e nenhum mascaramento. Diferenças aceitas: zero pixels acima do limiar perceptual padrão 0,2. Atualização exige revisão explícita de expected/actual/diff; sistema/Chromium diferentes podem exigir referências próprias. `bun run test:visual --update-snapshots` não deve ser usado para esconder regressão. Relatórios visuais ficam no caminho configurado pelo runner em `reports/`.

### Performance medida

Lighthouse 13.5.0, Playwright 1.64.1, Chromium 156.0.8078.4 revisão 1248, Bun 1.4.2, Node 24.14.0, Windows x64 10.0.26200, i3-12100F, oito processadores lógicos, 16GB RAM. Build demo em preview 4175, visitante/seed padrão, mocks/socket ativos e latência 120ms. CLI Node cria novo perfil Chromium por medição, cache frio e limpeza padrão. Não se desativam recursos para pontuar.

Doze medições: três por Home/Detalhes × desktop/mobile; tabela contém medianas. Configuração versionada em `scripts/lighthouse-config.ts` e `lighthouse.ts`; relatórios HTML/JSON/summary ficam no diretório de saída do script em `reports/`. Throttling simulate oficial: desktop 1350×940 DPR1, RTT40ms, 10240Kbps, CPU1; mobile 412×823 DPR1,75, RTT150ms, 1638,4Kbps, CPU4.

| Página/perfil    | Performance | Acessibilidade | Boas práticas | SEO |    LCP |     CLS |      TBT |
| ---------------- | ----------: | -------------: | ------------: | --: | -----: | ------: | -------: |
| Home desktop     |          99 |            100 |           100 | 100 |  991ms | 0,00908 |      0ms |
| Detalhes desktop |          99 |            100 |           100 | 100 |  947ms |       0 |      0ms |
| Home mobile      |          80 |            100 |           100 | 100 | 4324ms |       0 | 104,19ms |
| Detalhes mobile  |          79 |            100 |           100 | 100 | 4234ms | 0,04860 |  112,5ms |

Metas: Performance>=90, Acessibilidade>=95, Boas práticas>=95 e SEO>=90. Performance mobile não foi atingida; comando retorna falha dessa meta. Gargalo observado é caminho inicial de JavaScript MSW/React/Query sob throttling; imagem LCP já utiliza WebP dimensionado. Divisão de módulos, prioridade/fontes/imagens e latência fora do lock reduzem custo, mas LCP mobile segue próximo de 4,3s. Medições não devem ser apresentadas como resultado de alterações posteriores sem nova auditoria.

## Publicação e limites operacionais

Aplicação: [kurio-nft-marketplace-two.vercel.app](https://kurio-nft-marketplace-two.vercel.app). Repositório: [Kazyg/kurio-nft-marketplace](https://github.com/Kazyg/kurio-nft-marketplace). `vercel.json` usa `bun install --frozen-lockfile`, `build:demo`, saída `dist`, filesystem antes do fallback SPA e `Cache-Control: no-cache` no worker. `/assets`, `/api` e worker não recebem HTML de fallback. HTML/worker devem ser revalidados; cache imutável deve ser restrito a arquivos com hash.

API `/api`, Socket.IO na origem atual e `VITE_ENABLE_MSW=true` são necessários no deploy simulado. Variáveis Vite não podem conter segredos. `.vercel/`, envs privados, relatórios e caches ficam ignorados; assets, lockfile e baselines são versionados. Deploy CLI é manual e não existe webhook automático por push configurado.

Limitações: domínio local sem sincronização entre dispositivos, sem provedor financeiro/blockchain/OAuth real; binding WebSocket parcial; necessidade de contexto seguro/IndexedDB/Web Locks; Chromium é o motor automatizado. Safari/Firefox, leitores NVDA/VoiceOver e teclado virtual físico não foram auditados. Auditoria automática não certifica conformidade WCAG integral.

Execuções paralelas no Windows apresentaram `ERR_NO_BUFFER_SPACE` antes do carregamento da aplicação. A causa de sistema não foi determinada; executar serialmente reduz concorrência, sem alegar correção do sistema ou introduzir retries. Não sobrescreva `dist` enquanto testes/preview estão ativos. Preserve traces de falhas em vez de somar resultados parciais como aprovação integral.
