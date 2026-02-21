import { useState } from "react";
import { useGame } from "../../context/GameContext";
import "./AdminDashboard.css";

const StickmanMysteryAdminDashboard = () => {
  const { players, gameState } = useGame();
  const [answerRevealed, setAnswerRevealed] = useState(false);

  const mysteryAnswer = gameState?.mysteryAnswer;

  const sorted = [...players].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    if (a.solved && b.solved) return (b.score || 0) - (a.score || 0);
    return 0;
  });

  const solvedCount = players.filter((p) => p.solved).length;

  const formatTime = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString();
  };

  return (
    <div className="sma-dashboard">
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
          {mysteryAnswer && (
            <div
              className="sma-answer-pill"
              onClick={() => setAnswerRevealed((v) => !v)}
              title="Click to reveal / hide the answer"
            >
              <span className="sma-pill-label">🔑 Answer</span>
              <span className="sma-pill-val sma-answer-val">
                {answerRevealed ? mysteryAnswer : "••••••"}
              </span>
            </div>
          )}
          <div className="sma-pill solved-pill">
            <span className="sma-pill-val">{solvedCount}</span>
            <span className="sma-pill-label">Solved</span>
          </div>
          <div className="sma-pill playing-pill">
            <span className="sma-pill-val">{players.length - solvedCount}</span>
            <span className="sma-pill-label">Exploring</span>
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="sma-info">
        <h4>📌 Game Rules</h4>
        <div className="sma-info-grid">
          <div className="sma-info-item">
            <span className="sma-info-label">⏱ Timer</span>
            <span className="sma-info-val">5 min countdown</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">🔑 Objects</span>
            <span className="sma-info-val">5 interactive objects</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">⏳ Penalty</span>
            <span className="sma-info-val">−30 s per clue</span>
          </div>
          <div className="sma-info-item">
            <span className="sma-info-label">❌ Wrong answer</span>
            <span className="sma-info-val">−100 score</span>
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
              <span>Attempts</span>
              <span>Status</span>
              <span>Solved At</span>
              <span>Score</span>
            </div>
            {sorted.map((player, i) => (
              <div
                key={player._id}
                className={`sma-lb-row ${player.solved ? "sma-row-solved" : "sma-row-playing"}`}
              >
                <span className="sma-lb-rank">
                  {i === 0 && player.solved
                    ? "🥇"
                    : i === 1 && player.solved
                      ? "🥈"
                      : i === 2 && player.solved
                        ? "🥉"
                        : `#${i + 1}`}
                </span>
                <span className="sma-lb-name">{player.name}</span>
                <span className="sma-lb-guesses">
                  {player.guessCount != null ? player.guessCount : "—"}
                </span>
                <span className="sma-lb-status">
                  {player.solved ? "✅ Solved" : "🏃 Exploring"}
                </span>
                <span className="sma-lb-time">
                  {formatTime(player.solvedAt)}
                </span>
                <span className="sma-lb-score">{player.score || 0}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default StickmanMysteryAdminDashboard;
