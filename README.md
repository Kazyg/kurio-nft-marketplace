# Kurio NFT Marketplace

Marketplace NFT responsivo construído com React e TypeScript. Catálogo, autenticação, favoritos, carrinho, carteiras, checkout e pedidos funcionam sobre APIs REST simuladas persistentes e eventos Socket.IO.

**[Abrir aplicação](https://kurio-nft-marketplace-two.vercel.app)** · [Repositório](https://github.com/Kazyg/kurio-nft-marketplace) · [Arquitetura](architecture.md) · [Design Figma](https://www.figma.com/design/Hfp4aJDaHzzuDlneSaFbwD/?node-id=0-1)

## Funcionalidades

- Catálogo com busca, filtros combinados, ordenação, paginação e estado na URL.
- Detalhes com galeria, edições, estoque, avaliações e compartilhamento.
- Login, cadastro, favoritos, perfil e carteiras por rede.
- Carrinho de visitante com merge após login, quantidades e cupons.
- Checkout com cotação atualizada, validação de rede/carteira e recuperação idempotente.
- Pedidos, recibos imutáveis e atualização por eventos Socket.IO com reconciliação REST.
- Diagnóstico HTTP e Socket.IO em `/diagnostics`.

## Tecnologias

React, TypeScript strict, Vite, Bun, TanStack Router e Query, Axios, MSW, Socket.IO Client e `@mswjs/socket.io-binding`, Tailwind CSS, shadcn/ui com Radix, React Hook Form, Zod e Lucide. Testes com Playwright, axe e Lighthouse. O `bun.lock` registra as versões resolvidas.

## Instalação e execução

Requisitos: Bun 1.4.2 e Node.js 24. Chromium é necessário somente para testes e auditorias.

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun run dev
```

Para executar a versão otimizada com mocks:

```sh
bun run build:demo
bun run preview --host 127.0.0.1 --port 4173
```

`bun run build` desabilita mocks por padrão e requer serviços compatíveis. Para publicar a aplicação simulada, utilize `build:demo`.

## Variáveis de ambiente

Use `.env.example` como referência para um `.env.local`. `.env.development` habilita os mocks no desenvolvimento; `.env.demo` os habilita no build de demonstração.

| Variável            | Padrão                            | Finalidade                                        |
| ------------------- | --------------------------------- | ------------------------------------------------- |
| `VITE_ENABLE_MSW`   | `true` nos modos development/demo | Inicia HTTP e WebSocket simulados                 |
| `VITE_API_BASE_URL` | `/api`                            | Base do cliente Axios                             |
| `VITE_SOCKET_URL`   | vazio                             | Origem atual; informe servidor compatível sem MSW |

Variáveis `VITE_*` são públicas e incorporadas ao build. Não coloque segredos nelas. Reinicie o servidor ou reconstrua o build após alterá-las. Service Worker requer HTTPS ou localhost.

## Credenciais fictícias

| Conta              | Senha inicial | Uso                                                       |
| ------------------ | ------------- | --------------------------------------------------------- |
| `ana@kurio.demo`   | `Kurio123!`   | Compra com carteiras Ethereum, Polygon e Solana           |
| `bruno@kurio.demo` | `Kurio123!`   | Isolamento entre contas e cadastro de carteira compatível |

Também é possível cadastrar uma conta. Dados e alterações ficam no navegador/origem; contas novas não possuem carteiras. Senhas são persistidas apenas como hashes derivados. Não utilize credenciais pessoais reais.

## Cenários simulados

Com a aplicação aberta e carregada, execute no console do navegador:

```js
const scenario = (value) =>
  fetch('/api/__mock/scenario', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }).then((response) => response.json())

await scenario({ orderOutcome: 'declined' })
```

Resultados disponíveis: `confirmed`, `declined`, `pending`, `pending-confirmed`, `pending-declined`, `timeout-before-create`, `timeout-after-create` e `connection-error`. Para resolução posterior:

```js
await scenario({ orderOutcome: 'pending-confirmed', orderResolutionMs: 5000 })
```

`timeout-after-create` persiste o pedido antes de atrasar a resposta além do timeout Axios. Recarregue ou use a recuperação da tentativa, mantendo sua chave para evitar duplicação.

Para observar loading e erro transitório apesar do retry único:

```js
await scenario({
  latencyMs: 800,
  failures: [{ path: '/nfts', method: 'GET', status: 503, remaining: 2 }],
})
```

Para alterar um NFT e receber `nft.updated`, ou interromper a conexão e observar reconciliação:

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

Para restaurar dados, cenários e credenciais iniciais desta origem:

```js
await fetch('/api/__mock/reset', { method: 'POST' })
localStorage.clear()
sessionStorage.clear()
location.reload()
```

O reset apaga compras e alterações locais. Contratos, outros controles de falha e regras de recuperação estão em [architecture.md](architecture.md).

## Scripts e testes

| Comando                                   | Finalidade                                           |
| ----------------------------------------- | ---------------------------------------------------- |
| `bun run dev`                             | Servidor Vite com HMR                                |
| `bun run typecheck`                       | TypeScript strict                                    |
| `bun run lint`                            | ESLint                                               |
| `bun run format` / `bun run format:check` | Formatar / conferir Prettier                         |
| `bun run build` / `bun run build:demo`    | Produção sem / com mocks                             |
| `bun run preview`                         | Servir `dist` localmente                             |
| `bun run test:e2e:dev`                    | Playwright em desenvolvimento                        |
| `bun run test:e2e:preview`                | Playwright em build e preview de produção            |
| `bun run test:visual`                     | Comparar 24 capturas em 390/768/1440px               |
| `bun run lighthouse`                      | Medir Home/Detalhes, desktop/mobile, três vezes cada |

Para executar apenas testes relacionados a uma alteração:

```sh
bun run test:e2e:preview tests/network.spec.ts --workers=1 --retries=0
```

O runner cria seu servidor na porta 4173, sem reutilizar instâncias existentes. Use execução serial no Windows se houver `ERR_NO_BUFFER_SPACE`. Relatórios e traces ficam em `playwright-report/` e `test-results/`. Não execute builds concorrentes enquanto um preview usa `dist`.

Regressão visual possui servidor próprio na porta 4180. Baselines Windows/Chromium estão versionadas em `tests/visual-baselines`; revise diferenças antes de qualquer atualização.

Lighthouse requer preview demo na porta 4175, iniciado em outro terminal. `LIGHTHOUSE_ORIGIN` e `CHROME_PATH` permitem configurar origem e Chromium. O comando preserva MSW/Socket.IO e sinaliza falha quando uma mediana não atinge as metas. Resultados detalhados e condições de reprodução estão em [architecture.md](architecture.md).

## Estrutura

```text
src/app/              Providers, rotas e ciclo de sessão
src/features/         Páginas, componentes e hooks por funcionalidade
src/shared/api/       Axios, consultas e mutations
src/shared/contracts/ Contratos REST, eventos e precisão monetária
src/shared/realtime/  Subscription e reconciliação de eventos
src/shared/layout/    Header, navegação e rodapé
src/shared/ui/        Componentes reutilizáveis
src/mocks/            Fixtures, domínio persistente e handlers MSW
public/assets/        Artes, variantes responsivas e SVGs locais
scripts/              Automação e auditorias reproduzíveis
tests/                Integrações de navegador e baselines visuais
```

## Publicação

`vercel.json` configura Bun com lockfile, `build:demo`, saída `dist`, arquivos estáticos antes do fallback SPA e revalidação do Service Worker. API e Socket.IO utilizam a origem pública. Preserve `VITE_ENABLE_MSW=true`, `VITE_API_BASE_URL=/api` e `VITE_SOCKET_URL` vazio no painel.

Deploy manual: autentique a própria conta com `bunx vercel login` e execute `bunx vercel --prod` após revisar as alterações. Não há deploy automático por push configurado. Credenciais CLI e `.vercel/` não são versionadas.

## Limitações conhecidas

- REST, autenticação social, carteiras, pagamentos, contratos e transações são simulados; não há backend, OAuth, envio de e-mail ou blockchain real.
- IndexedDB e Web Locks dependem de navegador compatível e contexto seguro. Dados não sincronizam entre dispositivos/origens.
- Socket.IO usa somente WebSocket; o binding MSW não implementa toda a capacidade de um servidor Socket.IO.
- Performance Lighthouse mobile medida: 80 Home e 79 Detalhes, abaixo da meta 90; desktop 99 e demais categorias 100. O carregamento inicial de JavaScript permanece uma limitação.
- Testes automatizados usam Chromium. Safari, Firefox, teclado virtual físico e leitores de tela reais exigem revisão manual.

Consulte [architecture.md](architecture.md) para decisões, contratos, protocolos, testes e limites técnicos.
