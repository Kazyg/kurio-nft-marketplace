# Verificação da Fase 3 — 15/10/2026

## Escopo implementado

Autenticação com React Hook Form e Zod, login/cadastro em modal no desktop e páginas no mobile, senha visível/oculta, erros de campo/API, conflito de cadastro, bloqueio de envios repetidos, logout e recuperação de sessão. Google/Facebook estão desabilitados e a recuperação de senha é declarada indisponível, sem sucesso simulado.

Rotas privadas: perfil, carteiras, favoritos e entradas de checkout/pedidos. O guard consulta a mesma sessão TanStack Query usada pela aplicação. Expiração, logout e troca de conta descartam dados privados e cancelam consultas com AbortSignal. Respostas de mutations são ignoradas para atualização de cache quando pertencem a um token anterior; um 401 antigo não encerra uma sessão mais recente. Não existiam subscriptions autenticadas nas fases anteriores, e nenhuma foi criada: o Socket.IO de diagnóstico continua independente da conta.

O destino de retorno aceita somente caminho local seguro. No mobile, favoritar leva à página de login e retoma a ação no detalhe/catálogo após autenticar. A intenção temporária contém somente NFT/destino/prazo e é consumida uma vez ou descartada ao cancelar; não é outra fonte de sessão ou carrinho.

Carrinho visitante/autenticado com edição de quantidades, limite de estoque, remoção, loading/shimmer, erro/retry, persistência e merge sem duplicação. Cupons válidos/inválidos/expirados são validados pelo domínio. Subtotal, desconto, taxa e total vêm exclusivamente de POST /quotes. A cotação informa quando está em atualização ou obsoleta, inclusive por versão, proprietário ou vencimento. O avanço é bloqueado até renovar. O cupom pretendido é guardado por carrinho em sessionStorage; nenhum valor financeiro é persistido pela interface. A política de foco segue o cache global: renovação é por alteração/ação explícita, sem criar nova cotação só por alternar a janela.

Perfil permite editar nome de exibição, username, e-mail, ENS, bio, avatar e senha, com validação e conflito de versão sem perda do rascunho. Carteiras podem ser cadastradas/editadas e definidas como principal; os formatos EVM e Solana e os conflitos são verificados pela interface e API. Não há conexão real com blockchain.

Checkout e pedidos são somente entradas privadas preparadas para etapas posteriores. Nenhum pagamento, confirmação, recibo visual ou novo evento de tempo real foi implementado.

## Contratos e persistência

Foi feita a revisão inicial descrita em `phase-3-contract-review.md`. Os handlers existentes de autenticação, carrinho, cotação, senha e carteiras foram reutilizados. A única extensão de domínio necessária foi User/ProfileInput: username e ENS no recurso, e edição de username/e-mail/ENS por PATCH /profile. Unicidade e formatos são validados no mesmo handler transacional. A migração dos registros IndexedDB existentes preenche os novos campos sem resetar dados ou modificar IDs. Senhas continuam somente como hashes PBKDF2, nunca em texto puro persistido.

## Arquivos criados

- `src/features/auth/auth-page.tsx` e `auth.css`.
- `src/features/cart/cart-page.tsx` e `cart.css`.
- `src/features/profile/profile-page.tsx` e `profile.css`.
- `src/features/wallets/wallets-page.tsx` e `wallets.css`.
- `src/app/private-route.ts`, `phase-three-pages.tsx` e `phase-three.css`.
- `src/shared/api/private-cache.ts`, `src/shared/lib/redirect.ts` e `auth-intent.ts`.
- `tests/auth-phase3.spec.ts`, `cart-phase3.spec.ts`, `account-phase3.spec.ts` e `privacy-phase3.spec.ts`.
- `docs/phase-3-contract-review.md` e este relatório.

Modificados: App, Router, SessionLifecycle, cliente Axios, marketplaceApi/hooks, User/ProfileInput, repositório/migração e handler de perfil, login-dialog de compatibilidade, FavoriteButton, MarketplaceLayout, README e contratos REST. As dependências, tokens, assets e testes funcionais das fases anteriores foram preservados; nenhuma biblioteca adicional foi necessária.

## Testes e validação

Os scripts mantêm os 21 testes anteriores e adicionam 28 testes, totalizando 49 casos. Cobertura nova: autenticação válida/inválida, cadastro/conflito, refresh, retorno/expiração, logout/troca de conta/cache, carrinho/merge/estoque/cupons, cotação vencida, perfil/avatar/senha, carteiras, falhas HTTP, submissões repetidas, teclado/foco e responsividade em 390/768/1440px.

| Comando                         | Resultado                                                              |
| ------------------------------- | ---------------------------------------------------------------------- |
| `bun install --frozen-lockfile` | Passou, sem alterar dependências                                       |
| `bun run typecheck`             | Passou                                                                 |
| `bun run lint`                  | Passou                                                                 |
| `bun run format:check`          | Passou                                                                 |
| `bun run build`                 | Passou                                                                 |
| `bun run test:e2e:dev`          | 49/49 passaram, sem retries (3,4 min incluindo encerramento assistido) |
| `bun run test:e2e:preview`      | 49/49 passaram, sem retries (1,7 min incluindo encerramento assistido) |

`bun run build:demo` também passou após a suíte final. O preview usa build de produção com `VITE_ENABLE_MSW=true`, equivalente à ativação de `.env.demo`. HTTP Axios foi confirmado como resposta do Service Worker, com header `x-kurio-mock: msw`; Socket.IO recebeu o payload pelo transporte MSW e permaneceu conectado além do intervalo de heartbeat. Os testes anteriores permaneceram aprovados nos dois ambientes. O relatório HTML fica em `playwright-report/index.html` e as capturas em `test-results/` (artefatos ignorados pelo Git).

Foram revisadas capturas reais de cadastro mobile, login desktop, carrinho mobile/desktop, perfil mobile e carteiras desktop. Os testes também capturam essas interfaces nas três larguras. A barra mobile fixa sobrepõe a posição inferior do viewport em capturas de página inteira; os controles continuam acessíveis por rolagem.

Versões instaladas relevantes: Bun 1.4.2, React 19.3.1, TypeScript 6.0.3, Vite 8.3.4, TanStack Router 1.170.44, Query 5.104.3, Axios 1.20.0, MSW 2.15.0, Socket.IO Client 4.8.4, React Hook Form 7.90.0, Zod 4.6.7 e Playwright 1.64.1. Nenhuma dependência foi adicionada nesta fase.

As preparações usam somente endpoints REST MSW e reset determinístico. Não são usados setters ou acesso ao estado interno para produzir resultados. O vencimento da cotação usa relógio de navegador controlado, sem esperar por um intervalo curto de tempo real. Retries automáticos locais do Playwright continuam desabilitados.

## Problemas encontrados

- Erros de validação dentro de labels alteravam nomes acessíveis e impediam encontrar novamente os campos. Os campos agora possuem rótulos estáveis e aria-describedby para os erros.
- O guard contra duplo envio precisava estar no callback do evento para respeitar a regra de refs do lint React.
- O teste de Escape assumia URL sem parâmetros; agora verifica o caminho/origem e o fechamento, preservando os filtros normais do catálogo.
- O logout precisava limpar dados antes da consulta posterior de sessão: mesmo se essa consulta falhar, dados privados não permanecem visíveis.
- Em execuções intermediárias de desenvolvimento houve respostas abortadas no diagnóstico e navegação durante preparação de testes. Uma repetição isolada do caso de catálogo passou três vezes. As execuções finais foram feitas sem edições de arquivos durante a atividade do Vite; essas ocorrências não foram escondidas por retries ou alterações no MSW.
- O teste de merge fazia uma consulta de fixture imediatamente após reload, antes do bootstrap MSW. Agora aguarda o carrinho renderizado antes de verificar a persistência pela API; não foi acrescentado retry de requisição.
- No Windows desta sessão, o encerramento automático dos servidores pelo runner ficou pendente depois de todos os casos passarem. Foi necessário encerrar somente os processos Vite identificados nessas execuções para liberar o resumo. O runner de preview terminou com código 0; o aviso de saída 255 refere-se ao servidor encerrado, não a caso de teste. Ao liberar o dev, duas invocações de preview se sobrepuseram por erro de orquestração: uma falhou ao abrir a porta 4173, enquanto a execução independente completou os 49 testes. Essa ocorrência não é tratada como execução aprovada e não houve testes concorrentes contra o mesmo servidor.

## Acesso ao Figma e revisão visual

Os oito frames do arquivo original retornaram limite de chamadas Starter. As alternativas de leitura de propriedades e screenshot também foram bloqueadas. Após o usuário fornecer a cópia `Hfp4aJDaHzzuDlneSaFbwD`, foi executado primeiro whoami: Guilherme, `[conta Figma anterior; e-mail omitido na entrega pública]`, equipe `[ID da equipe omitido na entrega pública]`, plano Starter, assento View. A única consulta de teste à nova cópia retornou **“Looks like you don't have edit access to this file.”** (debug UUID `ddce9b9b-d875-469c-98bd-d07b677a56d4`). Não foi possível confirmar a nova conta, as permissões ou a validade dos oito node IDs; não foram feitas consultas repetidas ao arquivo bloqueado.

As interfaces usam a identidade visual e os componentes já validados, com adaptação funcional responsiva. Os tokens e assets existentes não foram substituídos sem evidência. A revisão de screenshots verifica legibilidade, campos, controles e ausência de overflow; não comprova fidelidade aos novos frames inacessíveis. Essa conferência é uma pendência real, dependente de acesso MCP com permissão e cota.

## Limitações e próximas etapas

- Restaurar o acesso Figma e confrontar os oito frames, extraindo dimensões, espaçamentos e assets ainda não acessíveis.
- Validar manualmente leitor de tela e Safari/Firefox; os testes automatizados usam Chromium.
- O domínio permanece local em IndexedDB e requer contexto seguro e Web Locks compatível.
- Login social, recuperação de senha, checkout completo, pedidos visuais e eventos autenticados de tempo real ficam para escopos posteriores.
- A otimização dos PNGs originais e as limitações Socket.IO/MSW documentadas nas fases anteriores permanecem.
- Lighthouse não foi reexecutado nesta fase; seus resultados anteriores não medem estas interfaces.
