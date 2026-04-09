# AGENTS.md

## Visao geral

F.E.R.R.O e um aplicativo desktop feito com Electron + React para atuar como coach por voz em tempo real durante partidas de League of Legends.

Fluxo principal do produto:

1. O engine consulta a Live Client Data API do LoL.
2. O modulo de analise transforma snapshots do jogo em gatilhos e contexto.
3. O modulo de coach decide se deve falar, o que deve falar e se usa heuristica ou LLM.
4. O modulo de voz envia a fala para Piper, ElevenLabs ou voz do sistema.
5. A interface Electron mostra status, configuracoes, logs e analise da ultima partida.

## Como uma app Electron funciona neste projeto

Uma aplicacao Electron normalmente tem 3 partes:

1. `main`
Responsavel por criar a janela, acessar APIs nativas do desktop, registrar IPC e controlar o ciclo de vida do app.

2. `preload`
Camada de seguranca entre `main` e `renderer`. Expõe uma API controlada no `window` para a UI chamar recursos nativos sem acesso direto ao Node.

3. `renderer`
Camada visual. Aqui e um app React que roda dentro da janela Electron como se fosse um app web.

Neste repositorio, as tres partes existem e estao ativas:

- `src/main/index.ts`: cria a `BrowserWindow`, carrega a UI, registra IPC e inicia o engine.
- `src/preload/index.ts`: expõe `window.ferroAPI` via `contextBridge`.
- `src/renderer/*`: interface React com abas de dashboard, mensagens, configuracoes e analise de partida.

## Componentes principais do repositorio

### 1. Processo principal Electron

Arquivos principais:

- `src/main/index.ts`
- `src/main/ipc/handlers.ts`
- `src/main/services/*`

Responsabilidades:

- criar a janela principal
- definir seguranca da webview (`contextIsolation: true`, `nodeIntegration: false`)
- salvar tamanho/posicao da janela
- registrar handlers IPC
- iniciar e parar o engine de coaching
- integrar com dialogos, arquivos locais, onboarding do Piper e services do sistema

### 2. Preload

Arquivo principal:

- `src/preload/index.ts`

Responsabilidades:

- expor uma API segura para a UI
- encapsular `ipcRenderer.invoke` e subscriptions com `ipcRenderer.on`
- evitar que o React tenha acesso direto ao ambiente Node/Electron

API exposta:

- configuracao
- engine
- logs
- analise de partida
- listagem de vozes
- testes de TTS e LLM
- instalacao do Piper
- informacoes de startup e versao

### 3. Renderer

Arquivos principais:

- `src/renderer/main.tsx`
- `src/renderer/App.tsx`
- `src/renderer/pages/*`
- `src/renderer/components/*`

Responsabilidades:

- renderizar a interface em React
- buscar `startupState` no preload
- iniciar o engine quando o onboarding estiver completo
- mostrar paginas de dashboard, configuracoes, mensagens e analise

### 4. Core de dominio

Arquivos principais:

- `src/core/analyzer.ts`
- `src/core/coach.ts`
- `src/core/game.ts`
- `src/core/voice.ts`
- `src/core/llm.ts`
- `src/core/logger.ts`
- `src/core/match-analyzer.ts`
- `src/core/state.ts`

Responsabilidades:

- ler o estado da partida
- detectar eventos relevantes
- aplicar cooldowns e rate limits
- decidir a fala do coach
- falar via TTS
- gerar texto via LLM quando configurado
- registrar logs e montar analise pos-jogo

### 5. Contratos compartilhados

Arquivos principais:

- `src/shared/channels.ts`
- `src/shared/types.ts`

Responsabilidades:

- definir nomes dos canais IPC
- tipar estado do engine, configuracao, startup, logs e entidades compartilhadas

## Fluxo tecnico resumido

1. O Electron sobe em `src/main/index.ts`.
2. A janela carrega o React do dev server ou `out/renderer/index.html`.
3. O `preload` injeta `window.ferroAPI`.
4. O React usa `window.ferroAPI` para buscar config, estado inicial e status do engine.
5. O `main` encaminha essas chamadas para handlers IPC.
6. Os handlers usam services locais e o `engine`.
7. O `engine` carrega modulos de `src/core`, consulta a partida, decide mensagens e envia eventos de volta para a UI.

## O que esta sendo usado de Electron aqui

O projeto usa de forma clara estes recursos do Electron:

- `app`: ciclo de vida do aplicativo
- `BrowserWindow`: janela principal
- `Menu.setApplicationMenu(null)`: remove menu padrao
- `shell.openExternal`: abre links externos no navegador
- `ipcMain` e `ipcRenderer`: comunicacao entre processos
- `contextBridge`: exposicao segura da API do preload
- `dialog`: selecao de diretorios

Nao parece haver uso relevante de:

- multiplas janelas
- tray
- atalhos globais
- auto updater
- processos filhos do Electron separados da arquitetura principal

## Build e tooling

Arquivos principais:

- `package.json`
- `electron.vite.config.ts`

Resumo:

- bundling de `main`, `preload` e `renderer` via `electron-vite`
- React no renderer
- Tailwind CSS 4 na UI
- TypeScript no projeto todo
- empacotamento Windows portable via `electron-builder`

Comandos mais usados:

- `npm run dev`
- `npm run build`
- `npm run build:win`
- `npm test`
- `npm run typecheck`

## Estrutura de pastas

```text
src/
  core/       logica de negocio do coach e integracoes de jogo/voz/llm
  main/       processo principal Electron, IPC e services
  preload/    ponte segura para o renderer
  renderer/   aplicacao React
    stores/   estado centralizado do renderer via Zustand
  shared/     tipos e canais compartilhados
data/         dados auxiliares versionados
resources/    icones e imagens do app
tests/        testes de unidade e integracao leve
```

## Observacoes praticas para agentes e contribuidores

- O engine principal mora em `src/main/services/engine.ts`.
- A configuracao persistente mora em `electron-store`, inicializada por `src/main/services/config-service.ts`.
- O renderer nao acessa Node diretamente; use `window.ferroAPI`.
- Novas chamadas entre UI e backend devem passar por:
  `src/shared/channels.ts` -> `src/preload/index.ts` -> `src/main/ipc/handlers.ts`
- O projeto tem foco em Windows e integra onboarding do Piper.
- O renderer agora usa stores centralizadas em `src/renderer/stores/` para evitar `useEffect` duplicado em varias telas.
- `src/renderer/stores/bootstrap.ts` faz a hidratacao inicial e registra os listeners IPC uma unica vez.
- `App`, `Dashboard`, `Settings`, `Messages`, `MatchAnalysis`, `LogPanel` e `TTSProviderPanel` ja consomem estado centralizado em vez de assinar IPC de forma repetida.
- O fluxo de configuracao ficou mais uniforme: as stores fazem refresh automatico apos updates e eventos do backend.
- A pasta `tests/` cobre boa parte do comportamento esperado; rode testes ao mexer em core, config, IPC ou renderer.

## Ponto de entrada para leitura

Se voce estiver chegando agora, a ordem mais util de leitura costuma ser:

1. `readme.md`
2. `src/main/index.ts`
3. `src/preload/index.ts`
4. `src/renderer/App.tsx`
5. `src/renderer/stores/bootstrap.ts`
6. `src/renderer/stores/config-store.ts`
7. `src/main/services/engine.ts`
8. `src/core/coach.ts`
9. `src/core/analyzer.ts`
