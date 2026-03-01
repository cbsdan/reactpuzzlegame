import { useState, useEffect, useRef } from "react";
import { useGame } from "../../context/GameContext";
import PlayerSpectatorView from "./PlayerSpectatorView";
import { DEFAULT_STAGES, GAME_DURATION } from "./StickmanMysteryGame";
import "./AdminDashboard.css";

const STICKMAN_STORAGE_KEY = "stickman_custom_config";
const THEME_FOR_STAGE = [
  { color: 0x00e5ff, emissive: 0x006b80, beacon: 0x00e5ff, label: "#00e5ff" },
  { color: 0xbb86fc, emissive: 0x5d4380, beacon: 0xbb86fc, label: "#bb86fc" },
  { color: 0xff7043, emissive: 0x802020, beacon: 0xff7043, label: "#ff7043" },
  { color: 0x448aff, emissive: 0x1a3680, beacon: 0x448aff, label: "#448aff" },
  { color: 0x69f0ae, emissive: 0x1a5c35, beacon: 0x69f0ae, label: "#69f0ae" },
  { color: 0xffab00, emissive: 0x805500, beacon: 0xffab00, label: "#ffab00" },
  { color: 0x00e676, emissive: 0x00733b, beacon: 0x00e676, label: "#00e676" },
];

function loadActiveStages(stickmanConfig) {
  if (stickmanConfig?.stages?.length > 0) return stickmanConfig.stages;
  try {
    const saved = localStorage.getItem(STICKMAN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.stages?.length > 0) {
        return parsed.stages.map((s, i) => ({
          ...s,
          theme: s.theme || THEME_FOR_STAGE[i] || THEME_FOR_STAGE[0],
        }));
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_STAGES;
}

const StickmanMysteryAdminDashboard = () => {
  const { players, gameState, adminAction } = useGame();
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [watchedPlayerId, setWatchedPlayerId] = useState(null);
  const [refOpen, setRefOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);

  const activeStages = loadActiveStages(gameState?.stickmanConfig);

  // Accessor: prefer namespaced sub-doc, fall back to flat root progress for old data
  const getProgress = (p) => p.stickmanMystery?.progress ?? p.progress ?? null;
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [overtime, setOvertime] = useState(0);
  const autoStopRef = useRef(null);
  const adminActionRef = useRef(adminAction);
  useEffect(() => { adminActionRef.current = adminAction; }, [adminAction]);

  /* Live timer — ticks every 500ms while game is playing */
  useEffect(() => {
    if (gameState?.status !== "playing" || !gameState?.startedAt) {
      setTimeLeft(GAME_DURATION);
      setOvertime(0);
      if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
      return;
    }
    const tick = () => {
      const elapsed = Math.max(
        0,
        Date.now() - new Date(gameState.startedAt).getTime() - (gameState.totalPausedMs || 0),
      );
      const left = GAME_DURATION - Math.floor(elapsed / 1000);
      if (left > 0) {
        setTimeLeft(left);
        setOvertime(0);
      } else {
        setTimeLeft(0);
        const ot = Math.min(7, Math.floor(-left));
        setOvertime(ot);
        if (!autoStopRef.current) {
          autoStopRef.current = setTimeout(() => {
            adminActionRef.current("stop");
            autoStopRef.current = null;
          }, 7000);
        }
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => {
      clearInterval(id);
      if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    };
  }, [gameState?.status, gameState?.startedAt, gameState?.totalPausedMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...players].sort((a, b) => {
    const aProg = getProgress(a);
    const bProg = getProgress(b);
    if (aProg?.solved && !bProg?.solved) return -1;
    if (!aProg?.solved && bProg?.solved) return 1;
    if (aProg?.solved && bProg?.solved) return (b.score || 0) - (a.score || 0);
    const stageA = aProg?.stage || 0;
    const stageB = bProg?.stage || 0;
    if (stageA !== stageB) return stageB - stageA;
    return 0;
  });

  const solvedCount = players.filter((p) => getProgress(p)?.solved).length;

  /* ── Spectator helpers ── */
  const watchedPlayer = watchedPlayerId
    ? players.find((p) => p._id === watchedPlayerId) ?? null
    : null;

  const switchToPlayer = (dir) => {
    if (sorted.length === 0) return;
    const idx = sorted.findIndex((p) => p._id === watchedPlayerId);
    const next = (idx + dir + sorted.length) % sorted.length;
    setWatchedPlayerId(sorted[next]._id);
  };

  return (
    <div className="sma-dashboard">
      {/* ── Spectator Modal ───────────────────────────────── */}
      {watchedPlayer && (
        <div className="sma-spectator-overlay">
          <div className="sma-spectator-modal">
            {/* Modal header */}
            <div className="sma-spectator-header">
              <div className="sma-spectator-player-info">
                <span className="sma-spectator-watching-label">👁 Watching</span>
                <strong className="sma-spectator-name">{watchedPlayer.name}</strong>
                <span className="sma-spectator-stage">
                  Stage {getProgress(watchedPlayer)?.stage ?? "?"}/{getProgress(watchedPlayer)?.totalStages ?? "?"}
                </span>
                {getProgress(watchedPlayer)?.hasKey && (
                  <span className="sma-spectator-badge">🔑 Has Key</span>
                )}
                {getProgress(watchedPlayer)?.solved && (
                  <span className="sma-spectator-badge sma-badge-solved">✅ Solved</span>
                )}
                <span className="sma-spectator-score">
                  Score: <b>{watchedPlayer.score ?? 0}</b>
                </span>
              </div>
              <div className="sma-spectator-controls">
                <button
                  className="sma-spectator-btn sma-btn-switch"
                  onClick={() => switchToPlayer(-1)}
                  title="Previous player"
                >
                  ◀ Prev
                </button>
                <span className="sma-spectator-counter">
                  {sorted.findIndex((p) => p._id === watchedPlayerId) + 1} / {sorted.length}
                </span>
                <button
                  className="sma-spectator-btn sma-btn-switch"
                  onClick={() => switchToPlayer(1)}
                  title="Next player"
                >
                  Next ▶
                </button>
                <button
                  className="sma-spectator-btn sma-btn-exit"
                  onClick={() => setWatchedPlayerId(null)}
                  title="Back to dashboard"
                >
                  ✕ Exit
                </button>
              </div>
            </div>

            {/* Three.js first-person view */}
            <div className="sma-spectator-canvas">
              <PlayerSpectatorView
                watchedPlayer={watchedPlayer}
                allPlayers={players}
                stages={activeStages}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sma-header">
        <div className="sma-title">
          <span className="sma-icon">🏃</span>
          <div>
            <h3>Stickman Mystery — Live Dashboard</h3>
            <p>
              Watching {players.length} player{players.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="sma-pills">
          {/* Live timer */}
          {gameState?.status === "playing" && (
            overtime > 0 ? (
              <div className="sma-timer sma-timer--overtime">
                ⏱ OVERTIME +{overtime}s / 7s
              </div>
            ) : (
              <div className={`sma-timer ${
                timeLeft <= 60 ? "sma-timer--danger" :
                timeLeft <= 300 ? "sma-timer--warn" : ""
              }`}>
                ⏱ {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
              </div>
            )
          )}
          <div className="sma-pill solved-pill">
            <span className="sma-pill-val">{solvedCount}</span>
            <span className="sma-pill-label">Solved</span>
          </div>
          <div className="sma-pill playing-pill">
            <span className="sma-pill-val">{players.length - solvedCount}</span>
            <span className="sma-pill-label">Exploring</span>
          </div>
          <button className="sma-ref-trigger" onClick={() => { setRefOpen(true); setExpandedStage(null); }}>
            📚 Stage Ref
          </button>
        </div>
      </div>

      {/* ── Stage Reference Modal ────────────────────────── */}
      {refOpen && (
        <div className="sma-ref-overlay" onClick={() => setRefOpen(false)}>
          <div className="sma-ref-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sma-ref-modal-header">
              <span>📚 Stage Reference — Questions, Answers &amp; Clues</span>
              <button className="sma-ref-close" onClick={() => setRefOpen(false)}>✕ Close</button>
            </div>
            <div className="sma-ref-modal-body">
              <div className="sma-ref-stages">
                {activeStages.map((stageDef, si) => {
                  const themeColor = stageDef.theme?.label ?? "#00ffd0";
                  const isOpen = expandedStage === si;
                  /* Which players are currently on this stage */
                  const here = players.filter((p) => (getProgress(p)?.stage ?? 1) === si + 1);
                  return (
                    <div key={si} className="sma-ref-stage">
                      <button
                        className={`sma-ref-stage-header ${isOpen ? "sma-ref-open" : ""}`}
                        style={{ "--stage-color": themeColor }}
                        onClick={() => setExpandedStage(isOpen ? null : si)}
                      >
                        <span className="sma-ref-stage-num">Stage {si + 1}</span>
                        <span className="sma-ref-stage-name">{stageDef.name}</span>
                        <span className="sma-ref-stage-meta">
                          {stageDef.clueCount} clues · {stageDef.trashCount} trash
                          {here.length > 0 && ` · 👥 ${here.map((p) => p.name).join(", ")}`}
                        </span>
                        <span className="sma-ref-chevron">{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen && (
                        <div className="sma-ref-body">
                          <div className="sma-ref-question">❓ {stageDef.question}</div>
                          <div style={{ margin: "0.3rem 0" }}>
                            <span className="sma-ref-answer">✅ Answer: <strong>{stageDef.answer}</strong></span>
                          </div>
                          <div className="sma-ref-hint">💡 <b>Hint:</b> {stageDef.hint}</div>
                          <div className="sma-ref-clues">
                            {stageDef.clues.map((clue, ci) => (
                              <div key={ci} className="sma-ref-clue">
                                <span className="sma-ref-clue-name">📦 {clue.name}</span>
                                <span className="sma-ref-clue-text">{clue.clue}</span>
                              </div>
                            ))}
                            {(stageDef.trash ?? []).map((t, ti) => (
                              <div key={`t${ti}`} className="sma-ref-clue" style={{ opacity: 0.5 }}>
                                <span className="sma-ref-clue-name">🗑 {t.name}</span>
                                <span className="sma-ref-clue-text" style={{ color: "#64748b" }}>Trash — {t.msg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info panel */}
      <div className="sma-info">
        <h4>📌 Game Rules</h4>
        <div className="sma-info-grid">
          <div className="sma-info-item">
            <span className="sma-info-label">⏱ Timer</span>
            <span className="sma-info-val">45 min — individual per player</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">🔑 Objects</span>
            <span className="sma-info-val">7 riddle-based stages</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">⏳ Trash penalty</span>
            <span className="sma-info-val">−5s / −8s / −12s / −15s / −20s / −25s / −30s (by stage)</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">❌ Wrong answer</span>
            <span className="sma-info-val">−15s / −20s / −25s / −30s / −35s / −40s / −45s (by stage)</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="sma-leaderboard">
        {sorted.length === 0 ? (
          <div className="sma-empty">No players have joined yet</div>
        ) : (
          <>
            <div className="sma-lb-header">
              <span>#</span>
              <span>Player</span>
              <span>Stage</span>
              <span>Clues</span>
              <span>Time Left</span>
              <span>Status</span>
              <span>Score</span>
              <span>View</span>
            </div>
            {sorted.map((player, i) => {
              const prog = getProgress(player);
              return (
              <div
                key={player._id}
                className={`sma-lb-row ${prog?.solved ? "sma-row-solved" : "sma-row-playing"}`}
              >
                <span className="sma-lb-rank">
                  {i === 0 && prog?.solved
                    ? "🥇"
                    : i === 1 && prog?.solved
                      ? "🥈"
                      : i === 2 && prog?.solved
                        ? "🥉"
                        : `#${i + 1}`}
                </span>
                <span className="sma-lb-name">
                  {player.name}
                  {prog?.hasKey && <span className="sma-key-badge">🔑</span>}
                </span>
                <span className="sma-lb-stage">
                  {prog
                    ? `${prog.stage || '?'}/${prog.totalStages || '?'}`
                    : '—'}
                </span>
                <span className="sma-lb-clues">
                  {prog?.cluesFound ?? '—'}
                </span>
                <span className={`sma-lb-timeleft${prog?.timeLeft != null && prog.timeLeft <= 60 ? ' sma-timeleft--danger' : prog?.timeLeft != null && prog.timeLeft <= 300 ? ' sma-timeleft--warn' : ''}`}>
                  {prog?.solved
                    ? '—'
                    : prog?.timeLeft != null
                      ? `${String(Math.floor(prog.timeLeft / 60)).padStart(2, '0')}:${String(prog.timeLeft % 60).padStart(2, '0')}`
                      : '—'}
                </span>
                <span className="sma-lb-status">
                  {prog?.solved
                    ? "✅ Solved"
                    : prog?.hasKey
                      ? "🔑 Has Key"
                      : "🏃 Exploring"}
                </span>
                <span className="sma-lb-score">{player.score || 0}</span>
                <span className="sma-lb-watch">
                  <button
                    className={`sma-watch-btn ${watchedPlayerId === player._id ? "sma-watch-btn--active" : ""}`}
                    onClick={() => setWatchedPlayerId(player._id)}
                    title={`Watch ${player.name}`}
                  >
                    👁
                  </button>
                </span>
              </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default StickmanMysteryAdminDashboard;
