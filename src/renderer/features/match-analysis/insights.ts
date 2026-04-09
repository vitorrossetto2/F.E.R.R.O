import { getTeamLabel, asTeamCode, formatClock, formatDecimal, formatGold, formatPercent, safeNumber } from "./formatters";
import type { ImpactFactor, MatchData, TeamCode } from "./types";

export function getObjectiveCount(
  objectives: MatchData["objectives"],
  objective: keyof MatchData["objectives"],
  team: TeamCode
): number {
  return safeNumber(objectives?.[objective]?.[team] ?? 0);
}

export function getObjectiveControlScore(data: MatchData, team: TeamCode): number {
  return (
    getObjectiveCount(data.objectives, "dragons", team) * 2 +
    getObjectiveCount(data.objectives, "barons", team) * 3 +
    getObjectiveCount(data.objectives, "towers", team) +
    getObjectiveCount(data.objectives, "inhibitors", team) * 2
  );
}

export function buildTips(data: MatchData): string[] {
  const activeTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam = activeTeam === "ORDER" ? "CHAOS" : "ORDER";
  const myTeam = data.teams?.[activeTeam];
  const activePlayer = data.activePlayerStats;
  const durationMinutes = Math.max((data.sessionInfo.duration || 0) / 60, 1);
  const killParticipation = myTeam && activePlayer && myTeam.kills > 0
    ? ((activePlayer.kills + activePlayer.assists) / myTeam.kills) * 100
    : 0;
  const csPerMinute = activePlayer ? activePlayer.creepScore / durationMinutes : 0;
  const goldSeries = data.charts?.gold ?? [];
  const peakGold = goldSeries.length > 0 ? Math.max(...goldSeries.map((point) => point.value)) : 0;
  const myObjectiveScore = getObjectiveControlScore(data, activeTeam);
  const enemyObjectiveScore = getObjectiveControlScore(data, enemyTeam);
  const deaths = activePlayer?.deaths ?? 0;
  const tips: string[] = [];

  if (killParticipation >= 60) {
    tips.push(`Seu ponto mais forte foi participar das jogadas do time: ${formatPercent(killParticipation)} de participaÃ§Ã£o em abates.`);
  } else if (csPerMinute >= 6.5) {
    tips.push(`Seu ponto mais forte foi manter recurso alto: ${formatDecimal(csPerMinute)} de farm por minuto.`);
  } else if (deaths <= 3 && data.sessionInfo.duration > 0) {
    tips.push(`Seu ponto mais forte foi se expor pouco: sÃ³ ${deaths} morte${deaths === 1 ? "" : "s"} em ${formatClock(data.sessionInfo.duration)}.`);
  } else if (peakGold > 0 && peakGold < 900 && (data.itemTimeline?.length ?? 0) >= 2) {
    tips.push("Seu ponto mais forte foi transformar ouro em compra sem segurar tanto recurso parado.");
  } else if (myObjectiveScore > enemyObjectiveScore) {
    tips.push(`Seu ponto mais forte foi jogar para objetivo: ${getTeamLabel(activeTeam)} controlou mais o mapa.`);
  } else {
    tips.push("Seu ponto mais forte foi seguir relevante mesmo em uma partida mais bagunÃ§ada.");
  }

  if (peakGold >= 1200) {
    tips.push(`VocÃª chegou a segurar ${formatGold(peakGold)} de ouro. Quando passar de 1.000, procure resetar antes da prÃ³xima luta.`);
  }

  if (csPerMinute > 0 && csPerMinute < 5 && data.sessionInfo.duration >= 8 * 60) {
    tips.push(`Seu farm ficou em ${formatDecimal(csPerMinute)}/min. Use as janelas sem luta para limpar rota ou selva prÃ³xima antes de rotacionar.`);
  }

  if (killParticipation > 0 && killParticipation < 45 && safeNumber(myTeam?.kills) >= 8) {
    tips.push(`Sua participaÃ§Ã£o em abates ficou em ${formatPercent(killParticipation)}. Antecipe mais as rotaÃ§Ãµes para dragÃ£o, Arauto e jogadas do seu time.`);
  }

  if (deaths >= 5) {
    tips.push(`Foram ${deaths} mortes. Antes de avanÃ§ar, confirme visÃ£o e posiÃ§Ã£o do caÃ§ador inimigo para nÃ£o entregar pressÃ£o de graÃ§a.`);
  }

  if (enemyObjectiveScore > myObjectiveScore) {
    tips.push(`${getTeamLabel(enemyTeam)} controlou mais objetivos. Vale preparar base e visÃ£o cerca de 40 segundos antes de cada objetivo grande.`);
  }

  const bloodiestMinute = data.overview?.bloodiestMinute;
  if (bloodiestMinute && bloodiestMinute.kills >= 3) {
    tips.push(`A partida acelerou forte por volta de ${bloodiestMinute.label}. Guarde recurso e feitiÃ§os para esse primeiro pico de luta.`);
  }

  return tips.slice(0, 3);
}

export function deriveResult(data: MatchData): "vitoria" | "derrota" | "indefinido" {
  const activeTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam: TeamCode = activeTeam === "ORDER" ? "CHAOS" : "ORDER";
  const myInhibs = getObjectiveCount(data.objectives, "inhibitors", activeTeam);
  const enemyInhibs = getObjectiveCount(data.objectives, "inhibitors", enemyTeam);
  const myScore = getObjectiveControlScore(data, activeTeam);
  const enemyScore = getObjectiveControlScore(data, enemyTeam);
  const myKills = safeNumber(data.teams?.[activeTeam]?.kills);
  const enemyKills = safeNumber(data.teams?.[enemyTeam]?.kills);
  if (myInhibs > enemyInhibs) return "vitoria";
  if (enemyInhibs > myInhibs) return "derrota";
  const combined = (myScore - enemyScore) * 2 + (myKills - enemyKills);
  if (combined >= 5) return "vitoria";
  if (combined <= -5) return "derrota";
  return "indefinido";
}

export function getHeroResultBadge(
  data: MatchData,
  result: "vitoria" | "derrota" | "indefinido"
): { label: string; background: string; color: string } {
  if (data.sessionInfo.gameMode === "PRACTICETOOL") {
    return {
      label: "Treino",
      background: "rgba(91, 139, 245, 0.12)",
      color: "var(--glow-blue)",
    };
  }

  if (result === "vitoria") {
    return {
      label: "VitÃ³ria",
      background: "rgba(52, 211, 153, 0.12)",
      color: "var(--accent-green)",
    };
  }

  if (result === "derrota") {
    return {
      label: "Derrota",
      background: "rgba(244, 112, 104, 0.12)",
      color: "var(--accent-red)",
    };
  }

  return {
    label: "Sem resultado oficial",
    background: "rgba(255,255,255,0.06)",
    color: "var(--text-secondary)",
  };
}

export function buildImpactFactors(
  data: MatchData,
  result: "vitoria" | "derrota" | "indefinido"
): ImpactFactor[] {
  const activeTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam: TeamCode = activeTeam === "ORDER" ? "CHAOS" : "ORDER";
  const activePlayer = data.activePlayerStats;
  const myTeam = data.teams?.[activeTeam];
  const durationMinutes = Math.max((data.sessionInfo.duration || 0) / 60, 1);
  const deaths = activePlayer?.deaths ?? 0;
  const kp =
    myTeam && activePlayer && myTeam.kills > 0
      ? ((activePlayer.kills + activePlayer.assists) / myTeam.kills) * 100
      : 0;
  const cspm = activePlayer ? activePlayer.creepScore / durationMinutes : 0;
  const goldSeries = data.charts?.gold ?? [];
  const peakGold = goldSeries.length > 0 ? Math.max(...goldSeries.map((p) => p.value)) : 0;
  const myDragons = getObjectiveCount(data.objectives, "dragons", activeTeam);
  const enemyDragons = getObjectiveCount(data.objectives, "dragons", enemyTeam);
  const myTowers = getObjectiveCount(data.objectives, "towers", activeTeam);
  const enemyTowers = getObjectiveCount(data.objectives, "towers", enemyTeam);
  const factors: ImpactFactor[] = [];

  if (result !== "vitoria") {
    if (deaths >= 7) {
      factors.push({ label: `${deaths} mortes â€” pressÃ£o cedida demais`, level: "alto" });
    } else if (deaths >= 5) {
      factors.push({ label: `${deaths} mortes - visao e posicionamento custaram caro`, level: "medio" });
    } else if (deaths >= 3 && result === "derrota") {
      factors.push({ label: `${deaths} mortes â€” cada morte custou recursos`, level: "baixo" });
    }
    const dragonDelta = enemyDragons - myDragons;
    if (dragonDelta >= 2) {
      factors.push({ label: `${dragonDelta} dragÃµes a menos â€” perda de objetivos constante`, level: "alto" });
    } else if (dragonDelta === 1) {
      factors.push({ label: "Inimigo ficou a frente em dragoes", level: "medio" });
    }
    const towerDelta = enemyTowers - myTowers;
    if (towerDelta >= 3) {
      factors.push({ label: `${towerDelta} torres a menos â€” mapa totalmente cedido`, level: "alto" });
    } else if (towerDelta >= 2) {
      factors.push({ label: `${towerDelta} torres de desvantagem - rotacoes perdidas`, level: "medio" });
    } else if (towerDelta === 1 && result === "derrota") {
      factors.push({ label: "Inimigo derrubou mais torres", level: "baixo" });
    }
    if (kp > 0 && kp < 30) {
      factors.push({ label: `KP de ${Math.round(kp)}% â€” vocÃª jogou fora das jogadas do time`, level: "alto" });
    } else if (kp > 0 && kp < 45 && myTeam && myTeam.kills >= 5) {
      factors.push({ label: `KP de ${Math.round(kp)}% - participacao abaixo do esperado`, level: "medio" });
    }
    if (cspm > 0 && cspm < 3.5 && durationMinutes >= 8) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm â€” recurso desperdiÃ§ado na rota`, level: "alto" });
    } else if (cspm > 0 && cspm < 5 && durationMinutes >= 8) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm - abaixo do esperado`, level: "medio" });
    }
    if (peakGold >= 2000) {
      factors.push({ label: `Pico de ${formatGold(peakGold)} ouro acumulado â€” janela de compra perdida`, level: "alto" });
    } else if (peakGold >= 1200) {
      factors.push({ label: `${formatGold(peakGold)} de ouro represado - reset tardio`, level: "medio" });
    }
  } else {
    if (deaths <= 2) {
      factors.push({ label: `So ${deaths} morte${deaths === 1 ? "" : "s"} - sobrevivencia acima da media`, level: "alto" });
    }
    const dragonAdv = myDragons - enemyDragons;
    if (dragonAdv >= 2) {
      factors.push({ label: `${dragonAdv} dragÃµes de vantagem â€” controle de objetivos sÃ³lido`, level: "alto" });
    } else if (dragonAdv === 1) {
      factors.push({ label: "Vantagem de dragoes sobre o inimigo", level: "medio" });
    }
    const towerAdv = myTowers - enemyTowers;
    if (towerAdv >= 3) {
      factors.push({ label: `${towerAdv} torres a mais â€” mapa dominado`, level: "alto" });
    } else if (towerAdv >= 2) {
      factors.push({ label: `${towerAdv} torres de vantagem - pressao de mapa consistente`, level: "medio" });
    }
    if (kp >= 70) {
      factors.push({ label: `KP de ${Math.round(kp)}% â€” vocÃª estava nas jogadas decisivas`, level: "alto" });
    } else if (kp >= 55) {
      factors.push({ label: `KP de ${Math.round(kp)}% - boa presenca nas lutas`, level: "medio" });
    }
    if (cspm >= 7) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm â€” recurso constante durante toda a partida`, level: "alto" });
    } else if (cspm >= 5.5) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm - base de recurso solida`, level: "medio" });
    }
    if (peakGold > 0 && peakGold < 800) {
      factors.push({ label: "Ouro convertido rapido - sem recurso represado", level: "medio" });
    }
  }

  const order: Record<ImpactFactor["level"], number> = { alto: 0, medio: 1, baixo: 2 };
  factors.sort((a, b) => order[a.level] - order[b.level]);
  return factors.slice(0, 3);
}
