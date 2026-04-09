# Architecture Refactor Plan

## Objetivo

Este documento organiza a refatoracao arquitetural do F.E.R.R.O em fases pequenas e executaveis.

A ideia nao e reescrever tudo de uma vez. O foco e:

1. reduzir a sensacao de bagunca
2. melhorar previsibilidade e manutencao
3. preservar o comportamento atual
4. criar uma base mais segura para evolucao

## Diagnostico resumido

Hoje o projeto tem uma base Electron correta, mas apresenta alguns sinais de crescimento sem consolidacao estrutural:

- duplicacao de estado e sincronizacao no renderer
- excesso de `useEffect` para carregar e sincronizar dados remotos
- arquivos muito grandes concentrando UI, estado e regras
- `ipc` centralizado demais
- mutacao de runtime/config global no `main` e no `core`
- tipagem incompleta na borda entre `preload` e `renderer`

## Principios para conduzir a refatoracao

- manter mudancas pequenas e reversiveis
- evitar refatoracao cosmetica sem ganho estrutural
- priorizar reducao de acoplamento e duplicacao
- preservar comportamento antes de melhorar design interno
- sempre que possivel, cobrir o trecho refatorado com testes

## Ordem recomendada

1. Fase 1: centralizacao de estado no renderer
2. Fase 2: extracao de logica de paginas grandes
3. Fase 3: modularizacao do IPC
4. Fase 4: endurecimento da tipagem da borda
5. Fase 5: remocao de mutacao global de runtime
6. Fase 6: consolidacao final e limpeza

---

## Fase 1: Centralizar Estado no Renderer

### Objetivo

Eliminar o padrao repetido de:

- carregar via IPC
- assinar evento
- fazer refetch inteiro

Criar fontes unicas de verdade no renderer para config, engine, startup e logs.

### Problemas que esta fase ataca

- `useEffect` repetido em varias telas
- telas com sincronizacao manual
- atualizacao otimista espalhada
- refetch duplicado apos eventos

### Entregas esperadas

- `src/renderer/stores/useConfigStore.ts`
- `src/renderer/stores/useEngineStore.ts`
- `src/renderer/stores/useStartupStateStore.ts`
- `src/renderer/stores/useLogsStore.ts`

Se o time preferir, esses modulos podem ser hooks simples antes de virar store global completa.

### Tarefas

1. Criar um ponto central para config
- carregar `window.ferroAPI.getConfig()`
- reagir a `onConfigChanged`
- expor `config`, `loading`, `refresh`, `setConfig`

2. Criar um ponto central para engine
- carregar `getEngineStatus()`
- reagir a `onEngineEvent`
- expor `engine`, `start`, `stop`, `refresh`

3. Criar um ponto central para startup state
- carregar `getStartupState()`
- reagir a mudancas de config quando necessario
- expor `startupState`, `refresh`

4. Criar um ponto central para logs
- reagir a `onLogEntry`
- manter buffer maximo
- expor `logs`, `clear`

5. Migrar telas para consumir esses hooks/stores
- `App.tsx`
- `Dashboard.tsx`
- `Settings.tsx`
- `Messages.tsx`
- `TTSProviderPanel.tsx`
- `LogPanel.tsx`

### Critério de pronto

- paginas nao fazem mais assinatura IPC duplicada para os mesmos dados
- o fluxo de config nao depende de refetch manual em cada tela
- `Dashboard`, `Settings` e `Messages` leem estado centralizado
- o numero de `useEffect` relacionados a sincronizacao cai de forma visivel

### Risco

Baixo.

### Valor esperado

Muito alto.

---

## Fase 2: Extrair Logica de Paginas Grandes

### Objetivo

Reduzir arquivos monoliticos no renderer e separar:

- apresentacao
- calculos
- normalizacao
- configuracoes estaticas

### Problemas que esta fase ataca

- arquivos enormes e dificeis de navegar
- mistura de logica de dominio com JSX
- baixa testabilidade

### Alvos principais

- `src/renderer/pages/MatchAnalysis.tsx`
- `src/renderer/pages/Messages.tsx`
- `src/renderer/components/settings/TTSProviderPanel.tsx`

### Estrutura sugerida

```text
src/renderer/features/
  messages/
    constants.ts
    presets.ts
    selectors.ts
    hooks.ts
    components/
  match-analysis/
    normalize.ts
    formatters.ts
    insights.ts
    components/
```

### Tarefas

1. Extrair constantes e presets de mensagens
- categorias
- grupos
- presets
- exemplos de modo

2. Extrair calculos de mensagens
- contagem de ativos
- deteccao de preset ativo
- estimativas de custo

3. Extrair utilitarios de match analysis
- `normalizeMatchData`
- formatadores
- calculo de tips
- calculo de fatores de impacto

4. Quebrar componentes visuais grandes em subcomponentes pequenos

### Critério de pronto

- `MatchAnalysis.tsx` fica substancialmente menor
- `Messages.tsx` passa a orquestrar em vez de concentrar tudo
- logica pura fica em arquivos sem JSX
- novas regras conseguem ser testadas sem renderizar pagina inteira

### Risco

Baixo a medio.

### Valor esperado

Alto.

---

## Fase 3: Modularizar IPC por Dominio

### Objetivo

Quebrar o arquivo unico de handlers em modulos menores e coesos.

### Problemas que esta fase ataca

- `src/main/ipc/handlers.ts` esta centralizado demais
- mistura de varios dominios
- piora a manutencao e a localizacao de responsabilidades

### Estrutura sugerida

```text
src/main/ipc/
  register-handlers.ts
  config-handlers.ts
  engine-handlers.ts
  voice-handlers.ts
  match-handlers.ts
  app-handlers.ts
```

### Tarefas

1. Separar handlers de configuracao
2. Separar handlers do engine
3. Separar handlers de voz e Piper
4. Separar handlers de match analysis
5. Separar handlers de sistema/app
6. Manter um registrador central leve

### Critério de pronto

- cada dominio registra seus proprios handlers
- o arquivo agregador so coordena registro
- fica facil localizar onde uma chamada IPC e tratada

### Risco

Baixo.

### Valor esperado

Medio a alto.

---

## Fase 4: Endurecer Tipagem da Borda

### Objetivo

Garantir que a comunicacao `renderer -> preload -> main` seja completamente tipada e previsivel.

### Problemas que esta fase ataca

- casts excessivos
- uso de `any`
- retorno de IPC pouco explicito

### Tarefas

1. Revisar API exposta no preload
- tipar argumentos e retornos de todos os metodos

2. Eliminar `as any` no renderer
- especialmente chamadas como `testLLMCoaching`

3. Definir tipos de payload dos eventos
- `CONFIG_CHANGED`
- `ENGINE_EVENT`
- `LOGS_ENTRY`
- `PIPER_PROGRESS`

4. Se necessario, criar tipos compartilhados adicionais em `src/shared/types.ts`

### Critério de pronto

- `window.ferroAPI` pode ser consumida sem casts repetidos
- nao ha `any` no renderer para chamadas IPC
- eventos possuem payload tipado e documentado

### Risco

Baixo.

### Valor esperado

Alto.

---

## Fase 5: Remover Mutacao Global de Runtime

### Objetivo

Eliminar a dependencia de configuracao global mutavel no `core` e no `main`.

### Problemas que esta fase ataca

- `core.settings` sendo reescrito em varios lugares
- risco de efeito colateral
- dificuldade de testar de forma isolada
- acoplamento forte entre config persistida e runtime

### Situação atual

Hoje existem pontos onde a configuracao e aplicada mutando estado global de runtime:

- `src/main/services/engine.ts`
- `src/main/ipc/handlers.ts`

### Direcao desejada

Trocar o modelo atual por um destes:

1. runtime por instancia
- `createRuntime(config)`
- `runtime.updateConfig(config)`

2. servicos puros com dependencia explicita
- `runTtsTest(config, input)`
- `runLlmTest(config, provider)`

3. adaptadores que traduzem `FerroConfig` para `CoreSettings`

### Tarefas

1. Criar funcao de mapeamento de config
- `mapFerroConfigToCoreSettings()`

2. Encapsular runtime do engine
- engine deixa de editar objeto global solto

3. Reescrever testes de TTS/LLM para receber config explicitamente

4. Reduzir acesso direto a `configMod.settings`

### Critério de pronto

- configuracao de runtime nao depende de mutacao global espalhada
- `engine` consegue ser inicializado com config clara
- TTS e LLM podem ser testados com dependencias explicitas

### Risco

Medio.

### Valor esperado

Muito alto.

---

## Fase 6: Consolidacao Final

### Objetivo

Fechar arestas, remover codigo legado de transicao e deixar a arquitetura coerente.

### Tarefas

1. Remover stubs e handlers mortos
2. Revisar nomes de arquivos e ownership por dominio
3. Atualizar documentacao do projeto
4. Revisar testes afetados
5. Padronizar convencoes de pasta e naming

### Critério de pronto

- arquitetura final esta coerente e documentada
- nao ha caminhos duplicados para o mesmo dado
- responsabilidades estao mais nitidas entre `renderer`, `preload`, `main` e `core`

### Risco

Baixo.

### Valor esperado

Medio.

---

## Checklist de execucao

### Fase 1

- [ ] Criar store/hook central de config
- [ ] Criar store/hook central de engine
- [ ] Criar store/hook central de startup state
- [ ] Criar store/hook central de logs
- [ ] Migrar `App.tsx`
- [ ] Migrar `Dashboard.tsx`
- [ ] Migrar `Settings.tsx`
- [ ] Migrar `Messages.tsx`
- [ ] Migrar `TTSProviderPanel.tsx`
- [ ] Migrar `LogPanel.tsx`

### Fase 2

- [ ] Extrair constantes/presets de `Messages`
- [ ] Extrair calculos de `Messages`
- [ ] Extrair normalizacao de `MatchAnalysis`
- [ ] Extrair formatadores e insights de `MatchAnalysis`
- [ ] Quebrar subcomponentes grandes

### Fase 3

- [ ] Separar handlers de config
- [ ] Separar handlers de engine
- [ ] Separar handlers de voz
- [ ] Separar handlers de match
- [ ] Separar handlers de app/system
- [ ] Criar registrador central leve

### Fase 4

- [ ] Tipar completamente API do preload
- [ ] Tipar payloads de eventos
- [ ] Remover `as any` do renderer
- [ ] Remover casts evitaveis de chamadas IPC

### Fase 5

- [ ] Criar `mapFerroConfigToCoreSettings`
- [ ] Encapsular runtime/config do engine
- [ ] Remover mutacao global em testes de TTS
- [ ] Remover mutacao global em testes de LLM
- [ ] Reduzir dependencia de `configMod.settings`

### Fase 6

- [ ] Remover stubs antigos
- [ ] Limpar codigo de transicao
- [ ] Atualizar `AGENTS.md` e docs relacionadas
- [ ] Revisar testes

---

## Sugestao de cadencia

Se quiser executar isso com seguranca, uma cadencia boa e:

1. concluir uma fase pequena
2. rodar testes
3. revisar diff
4. so entao iniciar a proxima

Evitar misturar Fase 1 com Fase 5 no mesmo PR. O ganho parece tentador, mas o risco sobe muito.

## Como decidir a proxima tarefa

Se a prioridade for reduzir bagunca visual e de manutencao:

- comecar pela Fase 1

Se a prioridade for melhorar legibilidade de arquivos:

- comecar pela Fase 2

Se a prioridade for robustez arquitetural de longo prazo:

- Fase 5 e a mais importante, mas deve vir depois das fases anteriores

## Resultado esperado ao final

Ao final das fases, o projeto deve ficar com estas caracteristicas:

- renderer com menos efeitos de sincronizacao espalhados
- estado centralizado por dominio
- paginas menores e mais legiveis
- IPC modular e facil de localizar
- borda `preload` totalmente tipada
- runtime sem mutacao global espalhada
- arquitetura mais segura para continuar crescendo
