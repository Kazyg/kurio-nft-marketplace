# Contratos REST — Fase 2

## Correções de conta e checkout por rede

`QuoteInput` e `Quote` aceitam `network?: Network`. Quando informado, `POST /quotes` inclui somente linhas cujos NFTs atuais pertencem à rede solicitada. Rede inválida ou seleção vazia retorna 422. Sem o campo, o comportamento anterior de cotar o carrinho inteiro permanece. O pedido utiliza o escopo persistido da cotação, confere a carteira e revalida o snapshot; não aceita um carrinho multirrede integral com uma única carteira. A confirmação preserva linhas das outras redes. O cache de cotação inclui a rede.

`Wallet`/`WalletInput` receberam metadados opcionais `displayName`, `profileName`, `secondaryAddress`, `referralCode`, `email`, `ens` pelos mesmos POST/PATCH existentes. Strings são normalizadas e limitadas; e-mail/ENS são validados quando preenchidos. Os registros antigos não precisam desses campos. Rede, endereço, unicidade e versão continuam obrigatórios conforme o contrato anterior.

`Collector.note?: string` é a observação do pedido (até 1000 caracteres), persistida no snapshot e incluída na comparação de payload idempotente. Nome/e-mail mantêm validação. Nenhuma alteração em valores financeiros ou status dos pedidos. Diagnóstico e evidências em `account-checkout-fixes.md`.

## Autenticação social demonstrativa

`POST /auth/social` recebe `{provider: 'google' | 'facebook'}` e retorna `Session`, como login/cadastro tradicionais. Outros provedores retornam 422. Endpoint disponível nos handlers MSW, sem OAuth, redirect ou chamada externa a Google/Facebook.

As identidades de `fixtures.socialIdentities` têm IDs persistentes distintos (`demo-social-google` e `demo-social-facebook`). Na primeira autenticação, o handler cria o perfil no repositório, com hash de segredo aleatório não exposto e lista de carteiras vazia. Repetições buscam o mesmo ID, preservando alterações de perfil; colisões iniciais de e-mail/username recebem sufixo sem apropriar uma conta existente. A função transacional de sessão existente mescla o carrinho visitante, emite novo token e aplica o prazo de sessão configurado. Logout, expiração, isolamento e controles de falha continuam os mesmos. Os valores financeiros e o protocolo Socket.IO não mudam.

## Metadados técnicos demonstrativos do NFT

`Nft.technical?` acrescenta `{networkDescription?, royaltyBasisPoints?, contractAddress, tokenStandard, verification}`. `royaltyBasisPoints` é informativo (500 = 5%; 0 é válido), não altera cotações, taxas ou pedidos. Ausência do valor deve ser exibida como não informado. Os mocks usam ERC-1155 nas redes EVM Ethereum/Polygon e Metaplex Token Metadata em Solana, com referências distintas por NFT. Endereços e royalties são fictícios; `verification: 'demo-verified' | 'unverified'` descreve apenas metadados da demonstração, sem consulta ou comprovação em blockchain. `creator` e `network` permanecem no contrato.

Dados IndexedDB antigos de NFTs conhecidos recebem os metadados ausentes e a correção dos textos legados que afirmavam verificação Ethereum indiscriminadamente. Campos técnicos existentes, edições, estoque, preços, versões, carrinhos e pedidos são preservados; NFTs desconhecidos ou com rede diferente da fixture não recebem inferência técnica.

## Extensões compatíveis da Fase 4

`GET /orders?idempotencyKey=<key>` retorna `Order[]` filtrado pela chave e pelo usuário autenticado, sem criar pedido. `CreateOrderInput` aceita `collector?: {name,email}` e `network?: Network`; o domínio valida os dados e a compatibilidade de rede. `Order` inclui `wallet` (snapshot), `network`, `collector`, `transactionReference`, `resolveAt` e `resolution`. O status `declined` significa pedido recusado. Somente pedidos pendentes podem transitar para confirmado/recusado.

`PATCH /__mock/nfts/:id` aceita `{editionId?, priceEth?, available?}` e gera nova versão/evento. `MockScenario` acrescenta `orderResolutionMs`, `expiredCoupons: string[]` e outcomes `pending-confirmed`, `pending-declined`, `timeout-before-create`, `connection-error`. `POST /__mock/realtime` aceita `{action:'disconnect'|'replay', eventId?, reverse?}`; não altera dados de negócio. Esses endpoints existem somente na demonstração MSW.

`MockScenario.responseDelays` aceita `[{path, method?, delayMs, remaining}]`, com caminho exato relativo à API. O snapshot da resposta é capturado na transação; o atraso ocorre após liberar o lock. Isso permite reproduzir respostas REST antigas entregues após eventos mais novos, sem bloquear o domínio.

Pedidos pendentes agora aguardam a resolução persistida e não aplicam efeitos antecipados. Confirmação é atômica, impede estoque negativo e remove apenas quantidades compradas dos IDs originais do carrinho. Recusas preservam os itens. O snapshot financeiro/carteira do pedido não é recalculado ao renderizar recibos.

Base `/api`. Tipos em `src/shared/contracts/marketplace.ts`. Respostas são objetos diretos (sem envelope de sucesso); erros usam `ApiErrorBody`. Valores ETH são strings decimais de até 18 casas. Recursos mutáveis têm `version` e `updatedAt`. IDs e datas são strings. Páginas começam em 1.

Fase 5A.1: `NftList.priceRange` contém `{minEth:'0', maxEth:string, version:number}` global, calculado sobre os preços atuais de todos os NFTs antes de filtros/paginação. `version` soma as versões dos NFTs para proteger metadados contra respostas antigas. Eventos `nft.updated` invalidam a listagem REST existente e atualizam esse teto; não existe preço máximo fixo no frontend.

Extensão compatível da Fase 3: User inclui `username: string` e `ens: string | null`. ProfileInput também aceita `username`, `email` e `ens`, junto da versão existente. Username usa 3–30 caracteres `[a-z0-9_]`, normaliza minúsculas e é único. E-mail é validado e único; alterá-lo atualiza a credencial usada no próximo login. ENS é opcional, aceita nome `.eth` e não é resolvido na blockchain. Registros IndexedDB anteriores recebem os campos padrão sem apagar carrinhos, favoritos ou pedidos.

| Método e endpoint          | Entrada                                    | Resposta                             |
| -------------------------- | ------------------------------------------ | ------------------------------------ |
| GET /nfts                  | CatalogSearch na query string              | NftList com facets globais           |
| GET /nfts/:id              | —                                          | Nft                                  |
| GET /catalog/content       | —                                          | CatalogContent                       |
| POST /auth/register        | RegisterInput                              | Session                              |
| POST /auth/login           | LoginInput                                 | Session                              |
| GET /auth/session          | —                                          | Session (user null quando visitante) |
| POST /auth/logout          | —                                          | 204                                  |
| GET /favorites             | sessão                                     | Favorites                            |
| PUT /favorites/:nftId      | sessão                                     | Favorites                            |
| DELETE /favorites/:nftId   | sessão                                     | Favorites                            |
| GET /cart                  | sessão ou X-Guest-Id                       | Cart                                 |
| POST /cart/items           | CartItemInput; acumula quantidades         | Cart                                 |
| PATCH /cart/items/:itemId  | {quantity} (inteiro >= 1)                  | Cart                                 |
| DELETE /cart/items/:itemId | —                                          | Cart                                 |
| POST /quotes               | QuoteInput                                 | Quote                                |
| POST /orders               | CreateOrderInput + Idempotency-Key; sessão | Order                                |
| GET /orders                | sessão                                     | Order[]                              |
| GET /orders/:id            | sessão proprietária                        | Order                                |
| GET /profile               | sessão                                     | User                                 |
| PATCH /profile             | ProfileInput com versão                    | User                                 |
| PUT /profile/password      | PasswordInput                              | 204                                  |
| GET /wallets               | sessão                                     | Wallet[]                             |
| POST /wallets              | WalletInput                                | Wallet                               |
| PATCH /wallets/:id         | Partial<WalletInput> + version             | Wallet                               |
| POST /__mock/reset         | —                                          | {ok:true}                            |
| GET /__mock/scenario       | —                                          | MockScenario                         |
| PATCH /__mock/scenario     | Partial<MockScenario>                      | MockScenario                         |

Autorização: `Authorization: Bearer <accessToken>`. `X-Guest-Id` identifica o carrinho de visitante e é enviado também no login/cadastro para mesclagem. O cliente armazena somente esses identificadores; dados de negócio e credenciais derivadas permanecem no repositório IndexedDB dos mocks. Reset e cenários existem somente quando MSW está habilitado e usam a base `/api`.

`minPrice` e `maxPrice` são inclusivos; filtros de texto, categoria, coleção (`collection`), rede, faixa e aba são combinados com AND. Ordenações: recent, price-asc, price-desc, popular. Abas: all, new, trending. Cada edição possui estoque e preço independentes. O padrão de listagem é 9 itens. A URL usa URLSearchParams sem conversão automática de decimais para números, preservando inclusive valores de um wei.

Idempotência é isolada por usuário e chave, persiste após refresh e compara o payload normalizado: mesma chave/payload retorna o pedido original, payload distinto retorna 409. Pedidos guardam snapshot financeiro imutável e recibos são derivados desse snapshot. Cenário timeout-after-create persiste o pedido, libera o lock e atrasa a resposta de falha em 12s. Cotações inválidas, vencidas ou desatualizadas não criam pedidos.

Assets de fixtures: `/assets/nfts/emerald-ape.png`, `sage-nomad.png`, `neon-vessel.png`, `cosmic-bloom.png`, `violet-nomad.png`, `ivory-baron.png`, `golden-beat.png`, `golden-signal.png`. O agente de interface baixa os assets originais do Figma nesses caminhos. IDs iniciais seguem os nomes em kebab-case; usuário Ana `ana@kurio.demo` e Bruno `bruno@kurio.demo`, senha de demonstração `Kurio123!` (somente hashes são persistidos).
