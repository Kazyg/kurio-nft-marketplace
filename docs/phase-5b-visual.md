# Regressão visual — Fase 5B

## Condições reproduzíveis

`playwright.visual.config.ts` executa Home, detalhes de Emerald Ape, carrinho com duas edições standard e checkout autenticado de Ana em 390, 768 e 1440 × 900 px. São 12 testes e 24 referências: viewport e página completa. A composição fixa do carrinho mobile continua presente na captura do viewport.

Cada teste começa com um contexto de navegador isolado e reset REST real do MSW, limpa o armazenamento local e configura latência zero. Carrinho e sessão são preparados pelos endpoints existentes; não há substituição de componentes, handlers de rede particulares nem sucesso de compra fabricado. O relógio mantém Date em 16/10/2026 12:00 UTC, preservando timers e a integração Socket.IO. O checkout é capturado antes da conexão da carteira e antes de qualquer compra.

As capturas aguardam Roboto Mono e `document.fonts.ready`, decodificam as imagens realmente renderizadas, falham se uma imagem não carregar e verificam ausência de overflow horizontal. Para capturar a página completa, o teste solicita antecipadamente os assets lazy já presentes no DOM. Isso não altera os assets, as dimensões ou a política de carregamento da aplicação distribuída.

O navegador usa Chromium instalado pelo Playwright, escala CSS 1, locale pt-BR, timezone UTC, esquema escuro e preferência por movimento reduzido. Animações finitas são concluídas e infinitas canceladas pelo mecanismo oficial `animations: disabled` durante a captura. O cursor de texto é ocultado. A comparação permite zero pixels diferentes acima do limiar perceptual padrão do Playwright, 0,2; nenhuma região da interface é mascarada.

## Execução e revisão de diferenças

```sh
bunx playwright test --config playwright.visual.config.ts --retries=0
```

Por padrão, o comando gera o build de demonstração e inicia seu próprio preview na porta 4180, sem reutilizar servidor. `E2E_TARGET=dev` permite verificar o mesmo conjunto no servidor Vite. Não execute builds concorrentes enquanto o preview utiliza `dist`.

Baselines ficam em `tests/visual-baselines/<sistema operacional>/<projeto>/`, fora dos diretórios ignorados. Arquivos PNG precisam ser adicionados ao controle de versão junto dos testes. Sistemas operacionais podem rasterizar fontes de modo diferente: use o mesmo sistema e a mesma versão de Chromium para comparar uma referência existente. Uma primeira execução em outro sistema deve falhar por ausência de referência até que uma referência específica seja revisada.

Para atualizar referências após revisão visual de uma mudança intencional:

```sh
bunx playwright test --config playwright.visual.config.ts --update-snapshots --retries=0
```

Uma divergência produz imagens expected, actual e diff, trace e relatório HTML em `reports/phase-5b/visual/`. Consulte `html/index.html` e `results.json`. Esses artefatos de execução permanecem ignorados; as referências PNG são versionáveis. Não atualize referências automaticamente para fazer uma falha desaparecer: confira a diferença, a mudança de implementação e o viewport correspondente antes de aprová-las.

## Resultado desta rodada

Ambiente: Windows win32 x64, versão de kernel 10.0.26200, Bun 1.4.2, Node 24.14.0, Playwright 1.64.1 e Chromium Headless Shell 156.0.8078.4, revisão 1248. Foram criadas 24 referências PNG, totalizando 10.032.358 bytes, em `tests/visual-baselines/win32/`. A geração passou nos 12 testes em 35,6s, sem retries. Duas comparações posteriores, sem atualizar referências, passaram 12/12 em 27,3s e 25,0s, também sem retries. A última comparação foi executada após congelar o build, sem outra escrita concorrente em `dist`.

A inspeção visual real conferiu Home desktop, detalhes e carrinho mobile e checkout desktop, ao lado das capturas finais da Fase 5A. As artes, proporções principais, controles e resumo financeiro permaneceram coerentes. Observou-se uma diferença vertical de aproximadamente 2px no header do checkout, sem impedir controles nem criar overflow. As referências cobrem os demais viewports automaticamente.

Na primeira comparação, o limiar experimental 0,1 encontrou um único pixel de diferença na rasterização da arte do hero Home 390; não houve mudança de layout. A evidência foi preservada em `reports/phase-5b/visual/initial-raster-noise/`. Adotou-se o limiar perceptual padrão 0,2, mantendo zero pixels diferentes acima dele: não foi criada tolerância de percentual ou área e nenhuma referência foi atualizada para esconder essa diferença.

O detector foi exercitado com um teste negativo temporário, isolado em `reports/phase-5b/probe/`: o mesmo cenário Home 390 recebeu uma borda magenta de 8px somente no DOM do navegador. A comparação com a referência original falhou como esperado, com 16.001 pixels diferentes e exit code 1. Os arquivos expected, actual e diff, mais trace e HTML, estão em `reports/phase-5b/visual/probe/`. A aplicação e as referências permaneceram intactas; a suíte normal voltou a passar após esse exercício. O teste negativo não integra os comandos normais nem a suíte funcional.

### Revisão após a seleção final de imagens responsivas

A otimização final de `sizes` nos cards ajustou a resolução escolhida pelo navegador à largura realmente renderizada, preservando a arte local e as dimensões do layout. A primeira comparação com as referências existentes passou em 10/12 testes e identificou apenas Home 768 (64 pixels no viewport) e detalhes 768 (259 pixels na página completa). A inspeção dos pares expected/actual/diff confirmou diferenças nas artes dos cards e da seção Mais da coleção, com maior nitidez em imagens que ocupam aproximadamente 344px; não houve alteração de texto, enquadramento ou geometria. As evidências estão preservadas em `reports/phase-5b/visual/srcset-review/`.

Depois dessa revisão, `--update-snapshots=changed` foi limitado aos testes Home e detalhes do projeto chromium-768. Foram atualizados somente `home-viewport.png`, `home-full.png` e `details-full.png`; as outras 21 referências permaneceram intactas. O limiar de comparação e o limite de pixels não foram alterados. As 24 referências finais totalizam 10.198.744 bytes. Uma comparação completa, sem atualização e sem retries, passou **12/12 em 37,6s** sobre o build de demonstração integrado naquele momento.

Após congelar a última divisão de módulos (rota nativa de detalhes, tempo real, slider e diálogos), a execução final `bun run test:visual` passou **12/12 em 24,5s**. O comando gerou novamente `build:demo` e comparou as 24 referências existentes sem atualizá-las. Home desktop aguarda o slider visível antes da captura; fontes, imagens, ausência de overflow e demais asserts continuam ativos. Resultados finais em `reports/phase-5b/visual/results.json` e `html/index.html`.
