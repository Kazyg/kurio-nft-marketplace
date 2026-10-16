# Kurio NFT Marketplace

Desafio frontend React + TypeScript. O catálogo responsivo está em `/` e o detalhe em `/nfts/:nftId`. Autenticação, carrinho e conta do colecionador usam o domínio REST simulado persistente. A Fase 4 acrescenta checkout, pedidos/recibos e sincronização real Socket.IO sobre MSW. O diagnóstico da infraestrutura permanece em `/diagnostics`. Carteiras e pagamentos são uma demonstração local, sem blockchain real.

Stack: React, TypeScript strict, Vite, Bun, TanStack Router/Query, Axios, MSW, socket.io-client com @mswjs/socket.io-binding, Tailwind CSS, shadcn/ui/Radix, React Hook Form, Zod, Lucide, Playwright, axe e Lighthouse.

## Entrega pública

Aplicação: **[kurio-nft-marketplace-two.vercel.app](https://kurio-nft-marketplace-two.vercel.app)**. Repositório público: **[Kazyg/kurio-nft-marketplace](https://github.com/Kazyg/kurio-nft-marketplace)**. Versão de entrega: `v1.0.0-demo`. [Relatório final e validação pública](docs/final-delivery.md). [Arquitetura](ARCHITECTURE.md).

`vercel.json` configura instalação Bun com lockfile, `bun run build:demo`, saída `dist`, arquivos estáticos antes do fallback SPA e Service Worker revalidado. Nenhum backend privado é necessário. API usa `/api` e Socket.IO usa a origem publicada; não configure URLs localhost no painel. Mantenha `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL=/api` e `VITE_SOCKET_URL` vazio. `.env.demo` já define a ativação; variáveis do painel prevalecem sobre o arquivo.

Deploy pela CLI oficial: `bunx vercel login`, seguido de `bunx vercel --prod`, na raiz do projeto, ou importe o repositório no painel Vercel preservando essas configurações. Dados são locais à origem e ao navegador; cada avaliador tem sua própria simulação. Não há pagamento, assinatura de carteira ou conexão blockchain real.

## Executar

Requisitos: Bun 1.4.2 e Node.js 24 (usado pelas CLIs de Playwright e Lighthouse).

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun run dev
```

`.env.development` habilita os mocks no dev. Consulte `.env.example` para sobrescrever configurações em `.env.local`. As variáveis `VITE_*` são públicas e incorporadas durante o build; nunca coloque segredos nelas.

## Builds e preview

```sh
# Build normal: mocks desabilitados por padrão; requer backend real.
bun run build

# Build otimizado de demonstração, com MSW habilitado por .env.demo.
bun run build:demo
bun run preview --host 127.0.0.1 --port 4173
```

`build:demo` executa o mesmo build de produção Vite, usando o modo `demo` para carregar a variável de ativação. Para validar literalmente `bun run build` com mocks, defina `VITE_ENABLE_MSW=true` antes do build. No PowerShell:

```powershell
$env:VITE_ENABLE_MSW = 'true'
bun run build
Remove-Item Env:VITE_ENABLE_MSW
bun run preview --host 127.0.0.1 --port 4173
```

Sem mocks, configure `VITE_API_BASE_URL` e `VITE_SOCKET_URL` para serviços compatíveis com os contratos documentados. O Service Worker precisa de HTTPS ou localhost; configure o host de publicação para fallback SPA em `index.html`. Alterar variáveis exige reiniciar dev ou reconstruir o build. O worker gerado está em `public/mockServiceWorker.js`; após atualizar MSW, regenere com `bunx msw init public --save`.

## Verificar

```sh
bun run typecheck
bun run lint
bun run format:check
bun run build
bun run test:e2e:dev
bun run test:e2e:preview
```

Playwright inicia e encerra seu próprio servidor na porta 4173, sem reutilizar servidores existentes. O comando de preview executa literalmente `bun run build` + `bun run preview`, passando `VITE_ENABLE_MSW=true` ao processo de build. As duas suítes verificam:

- Axios recebendo `/api/diagnostics` do Service Worker, com `fromServiceWorker()` e header `X-Kurio-Mock`.
- Cliente `socket.io-client` conectado e recebendo `diagnostic:result` após emitir `diagnostic:request`, com UUID de correlação validado por Zod.
- Conexão permanecendo ativa além de 30 segundos, com heartbeat Engine.IO.
- Fallback de rota e retorno ao início.
- Catálogo via Axios/MSW, busca e filtros combinados, ordenação, paginação e histórico da URL.
- Detalhe direto, NFT inexistente, limite de estoque e favoritos otimistas com rollback.
- Skeletons, falha transitória e responsividade em 390, 768 e 1440px.
- Login com retomada do favorito, merge do carrinho visitante, refresh e expiração de sessão.
- Isolamento entre usuários, cotações exatas, conflitos, pedidos pendentes/recusados, timeout após criação e idempotência persistente inclusive entre abas.
- Login/cadastro com RHF/Zod, validações, foco de modal e teclado, prevenção de envios duplicados e retorno seguro à rota original.
- Carrinho completo, cupons, cotação atualizada/obsoleta, merge após login e navegação protegida para a próxima etapa.
- Edição de perfil/avatar/senha, cadastro/edição de carteiras, logout, troca de usuários e limpeza dos caches privados.

Relatório em `playwright-report/index.html`, screenshot e traces de falhas em `test-results/` (ignorados pelo Git).

Para Lighthouse, construa a demonstração e inicie o preview na porta 4175. Em outro terminal, execute a auditoria:

```sh
bun run build:demo
bun run preview --host 127.0.0.1 --port 4175 --strictPort
# Em outro terminal:
bun run lighthouse
```

Executa 12 auditorias: Home e Detalhes, desktop e mobile, três medições por combinação. Gera HTML, JSON e medianas em `reports/phase-5b/lighthouse/`, usando o Chromium instalado pelo Playwright. `LIGHTHOUSE_ORIGIN` permite outra origem e `CHROME_PATH` outro Chromium. O comando falha se alguma mediana ficar abaixo das metas configuradas. MSW e Socket.IO são verificados antes das medições e permanecem ativos.

## Estrutura e design

- `src/app`: composição dos providers e TanStack Router.
- `src/features/diagnostics`: contratos, query keys, consulta Axios, hook Socket.IO e página.
- `src/features/catalog` e `src/features/nft-details`: Home e detalhe responsivos.
- `src/features/auth`, `cart`, `profile` e `wallets`: interfaces da Fase 3, com estilos e formulários próprios.
- `src/shared/contracts`: contratos REST e conversão ETH/wei por BigInt.
- `src/shared/layout` e `src/shared/ui`: layout do marketplace e componentes visuais.
- `src/shared`: configuração validada, Axios, QueryClient e UI shadcn adaptada.
- `src/mocks`: handlers HTTP/WebSocket e inicialização do MSW.
- `src/index.css` e `components.json`: Tailwind 4, tokens e configuração shadcn/ui.
- `tests/`, `scripts/`, `docs/`: testes, automação e decisões.

[Organização e colaboração por features](docs/architecture.md). [Tokens extraídos diretamente do Figma MCP](docs/design-tokens.md). [Resultados da verificação](docs/verification.md). Fonte Roboto Mono servida localmente; nenhum asset temporário do Figma é usado. React Hook Form, Zod e Lucide são utilizados nos formulários, validações e controles existentes. Use `bun run format` para aplicar a formatação.

## Domínio e cenários da Fase 2

[Contratos REST](docs/rest-contracts.md), [regras e persistência](docs/domain.md), [interface e adaptações](docs/ui.md) e [verificação da Fase 2](docs/phase-2-verification.md).

Os mocks contêm 36 NFTs, nove categorias, três redes e dois usuários isolados: `ana@kurio.demo` e `bruno@kurio.demo`, senha de demonstração `Kurio123!`. As credenciais são derivadas com PBKDF2; senhas não são persistidas em texto puro. IndexedDB mantém dados de negócio e Web Locks coordena alterações entre abas. O cliente guarda somente token e identificação do visitante em localStorage.

`POST /api/__mock/reset` restaura o estado. `PATCH /api/__mock/scenario` configura latência, falhas por endpoint/método/contagem, validade de sessão/cotação e resultado de pedido (`pending`, `confirmed`, `declined`, `timeout-after-create`). O último persiste o pedido antes de atrasar a resposta por 12s, excedendo o timeout de 10s do Axios; repetir a mesma chave idempotente recupera o pedido. Consulte os contratos para os payloads.

Para selecionar cenários, abra a aplicação e execute no console do navegador:

```js
const scenario = (value) =>
  fetch('/api/__mock/scenario', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }).then((response) => response.json())

await scenario({ orderOutcome: 'declined' })
```

Use `confirmed` para compra aprovada, `pending-confirmed` ou `pending-declined` com `orderResolutionMs: 5000` para resolução posterior, ou `timeout-after-create` para testar recuperação da compra persistida. Depois do timeout, recarregue ou utilize a recuperação exibida: não gere uma tentativa diferente para a mesma compra. `timeout-before-create` e `connection-error` simulam falhas antes da criação, sem recibo de sucesso.

Falha REST transitória e latência:

```js
await scenario({
  latencyMs: 800,
  failures: [{ path: '/nfts', method: 'GET', status: 503, remaining: 2 }],
})
```

Dois erros permitem observar o estado de falha apesar do retry único das queries. Navegue novamente ao catálogo ou use Tentar novamente. Para alterar o catálogo e emitir `nft.updated` pelo transporte simulado:

```js
await fetch('/api/__mock/nfts/emerald-ape', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ priceEth: '1.234' }),
})
await fetch('/api/__mock/realtime', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'disconnect' }),
})
```

A aplicação reconecta e reconcilia por REST. `action: 'replay'` com `reverse: true` permite verificar eventos repetidos/antigos. Para restaurar os dados, cenários e credenciais iniciais deste navegador:

```js
await fetch('/api/__mock/reset', { method: 'POST' })
localStorage.clear()
sessionStorage.clear()
location.reload()
```

O reset apaga somente a simulação desta origem. Ana (`ana@kurio.demo`, `Kurio123!`) possui carteiras Ethereum, Polygon e Solana para avaliação do fluxo completo. Bruno (`bruno@kurio.demo`, mesma senha) permite conferir isolamento entre usuários.

Os PNGs originais do Figma estão em `public/assets/nfts`, e os SVGs em `public/assets/figma`. Os originais foram preservados; a interface entrega variantes WebP responsivas locais em `public/assets/nfts/responsive`. Dados extras das fixtures garantem variedade de filtros e não representam obras adicionais fornecidas pelo Figma.

## Interfaces da Fase 3

- `/login` e `/register`: modal no desktop e página própria no mobile; `redirect` aceita somente destinos locais seguros.
- `/cart`: visitante ou usuário, quantidades/remoção/cupom e resumo vindo exclusivamente de `POST /quotes`.
- `/profile` e `/wallets`: rotas privadas, formulários com validação e persistência.
- `/favorites`: lista privada baseada nas APIs existentes.
- `/checkout`: checkout privado, conexão de carteira simulada, revisão/cotação atualizada e tentativa idempotente recuperável.
- `/orders` e `/orders/:orderId`: acompanhamento de pedidos e recibos persistidos.

Ao favoritar no mobile, a intenção temporária da ação é retomada após a página de login; nenhuma cópia de sessão/carrinho é criada. O cupom pretendido é armazenado por carrinho; os valores, validade e versões vêm da cotação REST. Se a cotação estiver vencida ou desatualizada, o avanço fica bloqueado até renová-la.

Google/Facebook oferecem autenticação social de demonstração por REST/MSW, sem OAuth ou conexão real com os provedores. Recuperação de senha permanece indisponível, com feedback na interface. Carteiras são registros da demonstração e não conectam à blockchain. O perfil aceita nome de usuário, edição de e-mail e ENS opcional, com migração compatível dos dados existentes.

[Revisão de contratos](docs/phase-3-contract-review.md) e [verificação da Fase 3](docs/phase-3-verification.md). Naquela fase, a consulta visual ficou bloqueada por cota/permissão. A conta e os frames foram acessados posteriormente nas revisões de autenticação, conta/checkout e Fase 5A, cujos relatórios abaixo documentam as referências e capturas efetivamente utilizadas.

## Socket.IO + MSW: limites e decisões

MSW está fixado em **2.15.0**, compatível com o peer `^2.10.2` do binding **0.2.0**. MSW 3 gerou aviso de peer durante a instalação e não foi adotado; não foi comprovada incompatibilidade de execução nessa versão.

O cliente usa exclusivamente `transports: ['websocket']`. HTTP long-polling, upgrade de polling, namespaces personalizados, rooms e acknowledgements não foram implementados. A Fase 4 usa subscription autenticada por evento explícito e entrega eventos do domínio por conexão, sem depender de rooms. O [binding oficial](https://github.com/mswjs/socket.io-binding) não oferece paridade completa com o servidor Socket.IO.

O MSW 2.15 remove `/socket.io/` ao comparar URLs: o handler precisa apontar à raiz `ws(s)://origem/`, embora a conexão real use `/socket.io/?EIO=4&transport=websocket`. Usar o caminho no handler produziu timeout na primeira execução e foi corrigido.

O binding fornece os frames de abertura Engine.IO e conexão Socket.IO, além da codificação dos eventos. Ele não agenda ping periódico; o handler envia o frame Engine.IO `2` a cada 20s, com limpeza ao fechar. O cliente real responde com pong. O hook informa desconexões e falhas em vez de preservar um falso estado de sucesso. Reconexão automática está desabilitada nesta prova de diagnóstico.

MSW inicia antes do import dinâmico da aplicação porque Engine.IO captura o construtor global WebSocket ao carregar. HTTP usa o Service Worker; WebSocket usa o interceptor do MSW na página. Nenhum mock chama hooks, callbacks ou setters da aplicação diretamente.

## Checkout, pedidos e tempo real — Fase 4

O checkout reutiliza perfil, carteiras, carrinho, cupons e cotações. Antes de enviar, solicita cotação nova; qualquer mudança em valores, quantidades ou versões exige nova revisão. A API decide a validade e calcula valores ETH exatos. A confirmação e o recibo dependem do resultado persistido, incluindo snapshot financeiro, carteira e rede.

A chave/payload da tentativa ficam persistidos por usuário. Refresh ou timeout recupera a mesma compra por REST, sem gerar chave nova automaticamente. Pedidos pendentes resolvem pelo prazo persistido e são recuperados mesmo se o evento Socket.IO se perder. Confirmação aplica estoque/carrinho uma única vez e preserva adições posteriores; recusa preserva os itens.

`nft.updated` e `order.updated` saem da outbox do domínio pelo transporte MSW/Socket.IO existente. O cliente filtra identidade/versão e reconcilia recursos ativos via REST após reconectar. Logout/troca de usuário libera a subscription anterior.

Novos cenários em `PATCH /api/__mock/scenario`: `pending-confirmed`, `pending-declined` com `orderResolutionMs`, `timeout-before-create` e `connection-error`; os cenários anteriores continuam disponíveis. `expiredCoupons` invalida cupons. `PATCH /api/__mock/nfts/:id` altera preço/estoque, gerando eventos. `POST /api/__mock/realtime` permite `disconnect` e `replay` com `reverse: true` opcional. Esses controles existem somente nos mocks.

[Verificação da Fase 4](docs/phase-4-verification.md) contém contratos, protocolo, testes e limitações. Não houve nova consulta Figma nesta fase; a auditoria visual detalhada foi adiada conforme solicitado. A futura publicação deve usar `build:demo` para manter os mocks habilitados.

Validação final: typecheck, lint, formatação e ambos os builds aprovados; **79/79 testes em desenvolvimento e 79/79 no preview**, sem retries, mantendo os 49 anteriores. `responseDelays` permite testar respostas REST atrasadas após eventos novos sem bloquear as transações do domínio.

## Ajustes da Home — Fase 5A.1

Busca desktop recolhível com teclado, menu ativo, badge do carrinho ancorado, filtros/paginação com dados anteriores durante refetch e slider Radix de duas alças. O teto global vem de `NftList.priceRange`, calculado pela API sobre todos os NFTs e revalidado após eventos. Rodapé com categorias reais, links sociais e newsletter explicitamente demonstrativa; disponível também em reflow estreito. O diagnóstico de tempo real fica em `/diagnostics`, com aviso público apenas em interrupções.

[Relatório dos ajustes](docs/phase-5-home-adjustments.md). Sem nova consulta Figma, Lighthouse ou deploy nesta tarefa.

Validação desta entrega: typecheck, lint, formatação, build e build demo aprovados; **99/99 testes em desenvolvimento e 99/99 no preview de produção**, mantendo os 79 cenários anteriores.

## Rodada visual e UX

Detalhe com cinco miniaturas, ampliação sem scroll interno, compartilhamento, direitos autorais, comentários ilustrativos e ação principal “Comprar”. Busca expandida integrada ao header e Home mais compacta. O retorno mobile do login usa navegação SPA e o carregamento do hero reserva espaço para evitar quebra transitória de layout.

[Relatório da rodada](docs/visual-ux-adjustments.md). A mensagem da newsletter foi atualizada conforme solicitado, mantendo seu funcionamento demonstrativo local. Não houve alteração no domínio financeiro ou nas integrações de rede.

Validação desta rodada: typecheck, lint, format:check, build e build:demo aprovados; **118/118 testes em desenvolvimento e 118/118 no preview**, mantendo os 99 anteriores e adicionando 19 cenários. O relatório registra a falha HTTP isolada da primeira execução e a repetição integral aprovada.

## Carrinho e acesso ao pagamento

Carrinho alinhado aos frames desktop/mobile da cópia atual do Figma, com tabela e resumo REST, SVG original de lixeira e relacionados do catálogo. O CTA “Conectar e finalizar” leva a `/checkout`, passando pelo login quando necessário; cotação vencida ou inválida mantém o bloqueio com instruções para prosseguir. [Auditoria, investigação e validação](docs/cart-visual-checkout-verification.md).

Validação: typecheck, lint, format:check, build e build:demo aprovados; **128/128 testes em desenvolvimento e 128/128 no preview**, sem retries, preservando os 118 anteriores.

## Detalhes do NFT: ações e metadados

Comprar e Favoritar ficam lado a lado, com quantidade independente e estilo responsivo. A rede aparece somente na aba técnica; royalties e referências de contrato/mint vêm de metadados REST demonstrativos específicos por NFT. [Alterações e validação](docs/nft-details-technical-adjustments.md).

Format, typecheck, lint, format:check e ambos os builds aprovados. **138/138 testes em desenvolvimento e 138/138 no preview**, mantendo os 128 anteriores. A ocorrência isolada `ERR_NO_BUFFER_SPACE` da primeira execução do preview e a repetição integral aprovada estão registradas no relatório.

## Autenticação visual e social

Login e cadastro foram alinhados aos quatro frames atuais do Figma; as identidades sociais persistentes reutilizam sessão, merge do carrinho e retomada de checkout/favorito. [Relatório de autenticação](docs/auth-visual-social-verification.md).

Validação: typecheck, lint, format:check, build e build:demo aprovados; **161/161 em desenvolvimento com `--workers=2` e 161/161 no preview com quatro workers**, preservando os 138 anteriores. O relatório registra a correção da corrida de expiração e a falha isolada de inicialização do Vite observada com quatro workers no dev.

## Perfil, carteiras e checkout por rede

Perfil/Carteiras seguem os frames atuais do Figma com sidebar compartilhada, formulários responsivos e persistência REST. O checkout seleciona carteiras compatíveis e permite comprar explicitamente uma rede por vez, preservando os demais itens. A API continua validando rede, cotação, estoque e idempotência. [Diagnóstico, alterações, capturas e validação](docs/account-checkout-fixes.md).

Validação final: typecheck, lint, format:check, build e build:demo aprovados; **186/186 no preview com quatro workers e 186/186 em desenvolvimento com dois**, sem retries. Preservados os 161 testes anteriores e adicionados 25. Compras Ethereum/Polygon e o percurso completo até o recibo foram confirmados nos dois ambientes.

## Auditoria visual — Fase 5A

Navegação por seção, avaliações com estrelas, ações mobile, carrinho fixo, formulários da conta e pagamento/recibo foram ajustados preservando contratos e regras financeiras. O [relatório de auditoria](docs/phase-5-visual-audit.md) reúne diagnóstico por gravidade, fontes Figma, arquivos alterados, comparações antes/depois e validações.

Capturas reproduzíveis: `bunx playwright test --config playwright.audit.config.ts --retries=0`, com 11 telas em 390/768/1440px e estados adicionais de loading, erro e vazio. Artefatos locais em `reports/phase-5/after/`.

A conta `ana@kurio.demo`, senha inicial `Kurio123!`, está preparada para compras nas redes Ethereum, Polygon e Solana. Uma migração única completa carteiras antigas preservando os demais dados. Os avisos de demonstração foram retirados da interface; a natureza local das integrações permanece documentada aqui.

Validação da rodada: **208/208 em desenvolvimento e 208/208 no preview**, sem retries, preservando os 186 testes anteriores. Typecheck, lint, formatação, build e build:demo aprovados. HMR permanece habilitado no desenvolvimento comum e é desativado somente no runner E2E.

## Performance, acessibilidade e regressão visual — Fase 5B

Artes locais com 40 variantes WebP responsivas, dimensões explícitas e carregamento por prioridade; as versões de 1254px transferem 91,94% menos bytes que os PNGs originais preservados. Rotas, controles e diálogos carregam sob demanda, mantendo o bootstrap MSW antes da avaliação do Socket.IO. Foram corrigidos contraste, foco, nomes acessíveis, abas, erros de formulário e alvos de toque.

`bun run test:visual` compara Home, Detalhes, Carrinho e Checkout em 390/768/1440px: 12 testes e 24 referências locais, sem máscaras ou retries. As baselines Windows/Chromium estão em `tests/visual-baselines`; revise diferenças antes de atualizar qualquer referência. Os testes funcionais incluem 32 novos cenários axe/teclado/reflow e dois de carregamento/transporte, preservando os 208 anteriores.

As 12 auditorias Lighthouse finais registraram medianas Performance/Acessibilidade/Boas práticas/SEO de **99/100/100/100** nas duas páginas desktop, **80/100/100/100** na Home mobile e **79/100/100/100** em Detalhes mobile. **Performance mobile ≥90 permanece pendente**; o comando sinaliza falha dessa meta. MSW, Socket.IO e latência padrão foram mantidos nas medições. [Relatório completo, métricas, validações e limitações](docs/phase-5b-verification.md).

Validação final: typecheck, lint, format:check, build e build:demo aprovados; **242/242 em desenvolvimento**, **242/242 no preview** e **12/12 visuais**, todos sem retries. O preview final usou um worker após duas falhas de rede `ERR_NO_BUFFER_SPACE` em execuções paralelas, cujos traces foram preservados. As baselines foram consolidadas no repositório durante a Fase 5C.

## Entrega — Fase 5C

Deploy Vercel com build demo e mocks ativos. Nesta fase, typecheck, lint, format:check e build:demo aprovados; **13/13 testes essenciais no preview**, executados uma única vez com um worker e zero retries. Na origem pública, **7/7 casos existentes** validaram acesso direto, mobile, Axios/MSW, compra/recibo, persistência e eventos/reconexão Socket.IO. Não foram criados testes, atualizados snapshots ou repetido Lighthouse. Limitações e evidências estão em [docs/final-delivery.md](docs/final-delivery.md).

## Versões das dependências

Bun 1.4.2, Node 24.14.0, React 19.3.1, TypeScript 6.0.3, Vite 8.3.4, TanStack Router 1.170.44, Query 5.104.3, Axios 1.20.0, MSW 2.15.0, binding 0.2.0, Socket.IO Client 4.8.4, Tailwind 4.3.3, Playwright 1.64.1, Lighthouse 13.5.0. O `bun.lock` registra as versões resolvidas.
