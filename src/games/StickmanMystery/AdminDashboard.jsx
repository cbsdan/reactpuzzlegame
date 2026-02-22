import { useState, useEffect, useRef } from "react";
import { useGame } from "../../context/GameContext";
import PlayerSpectatorView from "./PlayerSpectatorView";
import { DEFAULT_STAGES, GAME_DURATION } from "./StickmanMysteryGame";
import "./AdminDashboard.css";

const StickmanMysteryAdminDashboard = () => {
  const { players, gameState, adminAction } = useGame();
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [watchedPlayerId, setWatchedPlayerId] = useState(null);
  const [refOpen, setRefOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);
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
    if (a.progress?.solved && !b.progress?.solved) return -1;
    if (!a.progress?.solved && b.progress?.solved) return 1;
    if (a.progress?.solved && b.progress?.solved) return (b.score || 0) - (a.score || 0);
    // Compare by stage progress
    const stageA = a.progress?.stage || 0;
    const stageB = b.progress?.stage || 0;
    if (stageA !== stageB) return stageB - stageA;
    return 0;
  });

  const solvedCount = players.filter((p) => p.progress?.solved).length;

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
                  Stage {watchedPlayer.progress?.stage ?? "?"}/{watchedPlayer.progress?.totalStages ?? "?"}
                </span>
                {watchedPlayer.progress?.hasKey && (
                  <span className="sma-spectator-badge">🔑 Has Key</span>
                )}
                {watchedPlayer.progress?.solved && (
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
              {DEFAULT_STAGES.map((stageDef, si) => {
                const themeColor = stageDef.theme?.label ?? "#00ffd0";
                const isOpen = expandedStage === si;
                /* Which players are currently on this stage */
                const here = players.filter((p) => (p.progress?.stage ?? 1) === si + 1);
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
      )}

      {/* Info panel */}
      <div className="sma-info">
        <h4>📌 Game Rules</h4>
        <div className="sma-info-grid">
          <div className="sma-info-item">
            <span className="sma-info-label">⏱ Timer</span>
            <span className="sma-info-val">45 min countdown</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">🔑 Objects</span>
            <span className="sma-info-val">5 interactive objects</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">⏳ Penalty</span>
            <span className="sma-info-val">−7s slow-mo (trash clues)</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">❌ Wrong answer</span>
            <span className="sma-info-val">−10 score pts</span>
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
              <span>Status</span>
              <span>Score</span>
              <span>View</span>
            </div>
            {sorted.map((player, i) => (
              <div
                key={player._id}
                className={`sma-lb-row ${player.progress?.solved ? "sma-row-solved" : "sma-row-playing"}`}
              >
                <span className="sma-lb-rank">
                  {i === 0 && player.progress?.solved
                    ? "🥇"
                    : i === 1 && player.progress?.solved
                      ? "🥈"
                      : i === 2 && player.progress?.solved
                        ? "🥉"
                        : `#${i + 1}`}
                </span>
                <span className="sma-lb-name">
                  {player.name}
                  {player.progress?.hasKey && <span className="sma-key-badge">🔑</span>}
                </span>
                <span className="sma-lb-stage">
                  {player.progress
                    ? `${player.progress.stage || '?'}/${player.progress.totalStages || '?'}`
                    : '—'}
                </span>
                <span className="sma-lb-clues">
                  {player.progress?.cluesFound ?? '—'}
                </span>
                <span className="sma-lb-status">
                  {player.progress?.solved
                    ? "✅ Solved"
                    : player.progress?.hasKey
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
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default StickmanMysteryAdminDashboard;
