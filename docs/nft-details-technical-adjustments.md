# Detalhe do NFT: ações e informações técnicas

## Alterações

- Favoritar foi movido para a direita de Comprar no mesmo grupo, mantendo o componente e suas mutations/autenticação. Comprar continua laranja; Favoritar usa borda/coração em estilo secundário. Quantidade permanece independente à esquerda no desktop e acima das ações na composição mobile da barra inferior. O favorito duplicado do topo mobile foi removido.
- Rede foi retirada somente da área de compra. A aba Detalhes do NFT exibe a rede selecionada e sua descrição demonstrativa.
- O campo visual Criador foi substituído por Contrato, com o percentual de royalties do NFT. O criador continua nos dados internos. Ausência de percentual recebe “não informado”, sem fallback de 5%.
- Direitos autorais mostra a referência completa, padrão e indicação de verificação demonstrativa quando presente. Os endereços podem quebrar linha sem gerar overflow. Há indicação explícita de que não houve verificação ou repasse real em blockchain.

## Origem e compatibilidade dos dados

Os dados novos pertencem às fixtures MSW em `src/mocks/fixtures.ts` e chegam pelos endpoints REST de NFT existentes, não são definidos em componentes ou cliente Axios. O campo opcional `Nft.technical` mantém compatibilidade com dados sem esses metadados.

Cada um dos 36 NFTs recebe referência própria: endereço hexadecimal EVM para Ethereum/Polygon, referência de mint base58 para Solana. A escolha de ERC-1155 nas redes EVM representa as múltiplas edições do catálogo; Solana usa Metaplex Token Metadata, sem atribuição de ERC-721. Royalties explícitos variam entre 5%, 2,5%, 7,5% e 0%. São apenas informação demonstrativa, sem alteração das regras financeiras da compra.

O preenchimento compatível na leitura do repositório completa somente metadados ausentes de NFTs conhecidos com rede correspondente. Também substitui somente os textos legados exatos que afirmavam verificação Ethereum e descreviam Emerald Ape para todos os itens. Dados técnicos já existentes e textos personalizados não são sobrescritos. Não há reset do IndexedDB, alteração de preço, estoque, versão, carrinho, sessão ou pedido.

Não foi necessária nova consulta Figma: foram usadas as referências locais e as instruções pontuais desta solicitação. Nenhum asset, dependência ou outra tela foi alterado.

## Arquivos

- `src/features/nft-details/nft-details-page.tsx`: posição das ações e renderização dos dados técnicos.
- `src/index.css`: alinhamento e estilo secundário do favorito, quebra de endereço.
- `src/shared/contracts/marketplace.ts`: metadados opcionais.
- `src/mocks/fixtures.ts`: metadados específicos e textos coerentes.
- `src/mocks/repository.ts`: preenchimento dos dados legados, preservando o domínio.
- `tests/nft-details-technical.spec.ts`: dez cenários novos de geometria, compra/favorito, dados e migração.
- `tests/visual-ux-adjustments.spec.ts`: asserts atualizados para as duas ações e o novo conteúdo técnico; ausência de carrinho secundário continua exigida.
- `docs/rest-contracts.md`, README e este relatório.

## Validação

Typecheck e lint aprovados; rodada relevante no preview: **42/42 testes**, incluindo os dez novos e os fluxos anteriores de detalhe, favoritos, sessão, autenticação mobile e ampliação de imagens. Capturas em 390, 768, 1024 e 1440px geradas em `test-results/nft-details-technical-*/detail-actions-*.png`; desktop e mobile inspecionados.

| Comando                    | Resultado final                   |
| -------------------------- | --------------------------------- |
| `bun run format`           | Aprovado                          |
| `bun run typecheck`        | Aprovado                          |
| `bun run lint`             | Aprovado                          |
| `bun run format:check`     | Aprovado                          |
| `bun run build`            | Aprovado                          |
| `bun run build:demo`       | Aprovado                          |
| `bun run test:e2e:dev`     | **138/138**, 5,0 min, sem retries |
| `bun run test:e2e:preview` | **138/138**, 2,8 min, sem retries |

Os 128 cenários anteriores foram mantidos e dez acrescentados. A primeira execução completa do preview terminou em 137/138: o navegador retornou `ERR_NO_BUFFER_SPACE` ao navegar para `/diagnostics` na preparação do teste de zoom 1024×500, antes da abertura do detalhe. A repetição integral passou, incluindo esse caso, sem alteração de código, asserts ou configuração entre as execuções e sem retries automáticos. A causa específica dessa ocorrência isolada de recurso/rede do navegador não foi determinada. Não foram removidos asserts para tolerar falhas.

## Limites

Os metadados são demonstração local, não representam contratos ou royalties reais. Valores ausentes são informados como indisponíveis. Sem auditoria de outras telas, novos assets, dependências, Lighthouse ou deploy. Testes de navegador usam Chromium.
