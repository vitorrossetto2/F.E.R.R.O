# F.E.R.R.O - Ferramenta Estratégica de Resposta em Rift Online

<img src="resources/icon.png" alt="F.E.R.R.O logo" width="96" />

Coach por voz em tempo real para League of Legends, com análise de partida, configuração de mensagens e múltiplos providers de LLM/TTS.

## Visão geral

O F.E.R.R.O roda como app desktop (Electron) e:

- Lê o estado da partida pela Live Client Data API do LoL (`https://127.0.0.1:2999/liveclientdata/allgamedata`)
- Analisa eventos, ouro, objetivos e contexto de jogo
- Decide se deve falar algo naquele momento
- Gera mensagem via LLM (ou heurística, se LLM estiver desativada)
- Converte para voz (Piper, ElevenLabs ou voz do sistema)
- Mostra status, logs e telemetria no dashboard

## Galeria

<table>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>Mensagens do coach</b></td>
  </tr>
  <tr>
    <td><img src="resources/screens/home.jpg" alt="Dashboard" width="400" /></td>
    <td><img src="resources/screens/messages.jpg" alt="Mensagens" width="400" /></td>
  </tr>
  <tr>
    <td align="center"><b>Análise da última partida</b></td>
    <td align="center"><b>Configurações</b></td>
  </tr>
  <tr>
    <td><img src="resources/screens/last-match.jpg" alt="Análise de partida" width="400" /></td>
    <td><img src="resources/screens/settings.jpg" alt="Configurações" width="400" /></td>
  </tr>
</table>

## Funcionalidades

- Coaching em tempo real com cooldown por categoria e por grupo de eventos
- Modo de tom do coach: `serio`, `meme`, `puto`
- Ajuste fino por categoria de mensagem (objetivos, mapa, risco, economia, etc.)
- Onboarding com instalação automática do Piper no primeiro uso
- Preview de voz e teste de TTS direto na interface
- Teste de LLM no app (conexão e exemplo de resposta de coaching)
- Análise da última sessão com métricas, timeline e insights
- Logs detalhados de runtime, snapshots e payload de LLM (opcional)

## Stack

- `Electron` + `electron-vite`
- `React` + `TypeScript` + `Tailwind CSS`
- `electron-store` para persistência de configuração
- `OpenAI SDK` (compatível com endpoints OpenAI-like, ZAI e Gemini OpenAI compat)
- `Piper`, `ElevenLabs` e `say` para TTS

## Requisitos

- Windows (build atual empacota para `portable win x64`)
- Node.js 20+ e npm
- Cliente do League of Legends em execução para coaching em tempo real
- Internet para usar LLM remota e/ou ElevenLabs

## Instalação (dev)

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run build:win
```

Artefatos gerados em `dist/`.

## Fluxo de uso

1. Abra o app
2. No primeiro uso, complete onboarding do Piper
3. Vá em **Configurações** e ajuste:
   - provider de LLM (`none`, `zai`, `openai`, `gemini`)
   - provider de voz (`piper`, `elevenlabs`, `system`)
4. (Opcional) Vá em **Mensagens** e aplique preset (`essencial`, `equilibrado`, `agressivo`)
5. Inicie uma partida no LoL
6. O engine entra em `waiting_for_game` e depois `coaching` automaticamente

## Estrutura do projeto

```text
src/
  core/        lógica de jogo, análise, decisão e voz
  main/        processo principal electron, IPC e serviços
  renderer/    interface (dashboard, análise, mensagens, settings)
  preload/     ponte segura entre renderer e main
  shared/      tipos e canais IPC compartilhados
resources/
  icon.*       icones do app
  screens/     capturas usadas no README
```

## Configurações e dados locais

Por padrão, o app usa `~/.ferroconfig` para:

- `config` (persistência do `electron-store`)
- binário do Piper e modelos de voz
- logs de runtime e sessão

## Troubleshooting rápido

- `status waiting_for_game` para sempre:
  - confirme que você está em partida (não apenas no client)
  - teste `https://127.0.0.1:2999/liveclientdata/allgamedata` localmente
- Piper sem voz:
  - valide `tts.providers.piper.executablePath` e `modelPath`
  - rode onboarding novamente em Configurações > Voz
- ElevenLabs não fala:
  - confira API key e `voiceId`
  - use botão de teste de voz na UI
- LLM sem resposta:
  - confira `endpoint`, `model` e API key do provider ativo
  - use teste de LLM em Configurações

## Scripts úteis

- `npm run dev` - desenvolvimento
- `npm run build` - build de produção
- `npm run build:win` - empacota portável Windows
- `npm test` - testes com Vitest
- `npm run typecheck` - validação TypeScript

## Créditos

Desenvolvido com apoio de [ForTech Digital](https://fortechdigital.com.br).

## Licença

MIT
