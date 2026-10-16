# Arquitetura do Kurio

A descrição da organização, bootstrap MSW, carregamento das rotas, contratos REST, cache e reconciliação Socket.IO está em [docs/architecture.md](docs/architecture.md). Este arquivo é o ponto de entrada da documentação arquitetural.

## Domínio e persistência

O frontend consome os contratos de `src/shared/contracts/marketplace.ts` pelo cliente Axios centralizado. Fixtures, validações e efeitos financeiros ficam em `src/mocks`, fora de componentes e hooks. [Contratos e endpoints](docs/rest-contracts.md).

IndexedDB mantém usuários, sessões, carrinhos, favoritos, carteiras, cotações, pedidos, idempotência e outbox. Web Locks serializa transações entre abas. A latência de transporte é aguardada antes da transação, preservando operações atômicas. O armazenamento pertence ao navegador e à origem; outro dispositivo ou domínio não compartilha os dados.

Sessões usam Bearer token, expiração persistida e credenciais fictícias derivadas com PBKDF2. Visitantes usam identificação própria e seu carrinho é mesclado uma vez ao autenticar. Queries privadas são separadas por proprietário; logout, troca de identidade e expiração descartam caches privados. Isso demonstra isolamento na simulação e não substitui autenticação de um backend real.

Valores REST são strings decimais; cálculos internos usam BigInt em wei e taxas em basis points, com arredondamento para wei inteiro. Cotações guardam versões, estoque e validade; a API simulada revalida tudo antes de criar o pedido. Nenhum resumo financeiro é recalculado informalmente pela interface.

Pedidos persistem estados `pending`, `confirmed` ou `declined`, prazo de resolução e snapshot financeiro. Confirmação e recibo dependem do estado persistido, não apenas do clique. Chaves idempotentes por usuário recuperam a mesma tentativa após timeout ou refresh; payload incompatível retorna conflito. Efeitos de estoque e carrinho são aplicados atomicamente uma vez.

## Tempo real e cache

`nft.updated` e `order.updated` saem da outbox e passam pelo transporte real socket.io-client/Engine.IO interceptado pelo MSW. Assinaturas são autenticadas, versões antigas/duplicadas são descartadas e a reconexão revalida recursos por REST. Nenhum mock chama setters React. O bootstrap inicia MSW antes de avaliar Engine.IO; o módulo de tempo real é montado automaticamente após isso.

TanStack Query utiliza stale time de60s, descarte após5min e no máximo um retry adicional para falhas de rede/5xx;4xx e mutations não são repetidos automaticamente. O pedido utiliza sua própria recuperação idempotente. [Detalhes da implementação](docs/architecture.md).

## Publicação e limites

`vercel.json` usa `bun run build:demo`, saída `dist`, arquivos estáticos antes do fallback SPA e revalidação do Service Worker. `.env.demo` habilita a variável pública existente `VITE_ENABLE_MSW=true`; API e Socket.IO usam a própria origem. Não há backend privado, gateway de pagamento, OAuth ou blockchain real. Carteiras, pagamentos, contratos e verificações são metadados demonstrativos.

A persistência depende de contexto seguro, IndexedDB e Web Locks. O binding Socket.IO suporta o transporte WebSocket utilizado pelo projeto; não oferece paridade integral com servidor Socket.IO. Cache e dados antigos podem ser restaurados pelo reset MSW documentado no README. Não há sincronização de dados entre dispositivos.

Lighthouse anterior: Performance99 desktop,80 Home mobile e79 Detalhes mobile; demais categorias100. O carregamento inicial de JavaScript continua abaixo da meta mobile. [Medições e limitações](docs/phase-5b-verification.md). [Estado da entrega pública](docs/final-delivery.md).
