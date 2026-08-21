import { useGame } from "../../context/GameContext";
import "./TriviaChallengeAdminDashboard.css";

/**
 * TriviaChallengeAdminDashboard – Live admin view during a trivia game.
 *
 * Shows:
 *   • Stat pills (completed, still playing, avg score)
 *   • Active config summary (rounds, timer, categories)
 *   • Live leaderboard sorted by score
 */
const TriviaChallengeAdminDashboard = () => {
  const { players, gameState } = useGame();

  const triviaConfig = gameState?.triviaConfig || {};
  const totalRounds = triviaConfig.rounds || 3;
  const timerEnabled = triviaConfig.timerEnabled !== undefined ? triviaConfig.timerEnabled : true;
  const timerSeconds = triviaConfig.timerSeconds || 15;
  const questionsPerRound = triviaConfig.questionsPerRound || 5;

  // Accessor: prefer namespaced sub-doc
  const tc = (player) => player.triviaChallenge || {};

  const selectedCategory = triviaConfig.selectedCategory || "All";

  // Sort: completed first (by score desc, then totalTimeTaken asc), then playing (by score desc, then totalTimeTaken asc)
  const sorted = [...players].sort((a, b) => {
    const aDone = tc(a).completed;
    const bDone = tc(b).completed;
    if (aDone && !bDone) return -1;
    if (!aDone && bDone) return 1;
    const aScore = tc(a).score || a.score || 0;
    const bScore = tc(b).score || b.score || 0;
    if (aScore !== bScore) return bScore - aScore;
    const aTime = tc(a).totalTimeTaken ?? 9999;
    const bTime = tc(b).totalTimeTaken ?? 9999;
    return aTime - bTime;
  });

  const completedCount = players.filter((p) => tc(p).completed).length;
  const avgScore =
    players.length > 0
      ? Math.round(
          players.reduce((sum, p) => sum + (tc(p).score || p.score || 0), 0) /
            players.length
        )
      : 0;

  // Categories from config
  const categoryNames = triviaConfig.questions
    ? Object.keys(triviaConfig.questions)
    : [];

  return (
    <div className="tc-admin-dashboard">
      {/* Header */}
      <div className="tc-dashboard-header">
        <div className="tc-dashboard-title">
          <span className="tc-dashboard-icon">🧠</span>
          <div>
            <h3>Trivia Challenge — Live Dashboard</h3>
            <p>
              Watching {players.length} player
              {players.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="tc-dashboard-pills">
          <div className="tc-pill completed-pill">
            <span className="tc-pill-val">{completedCount}</span>
            <span className="tc-pill-label">Completed</span>
          </div>
          <div className="tc-pill playing-pill">
            <span className="tc-pill-val">
              {players.length - completedCount}
            </span>
            <span className="tc-pill-label">Playing</span>
          </div>
          <div className="tc-pill avg-pill">
            <span className="tc-pill-val">{avgScore}</span>
            <span className="tc-pill-label">Avg Score</span>
          </div>
        </div>
      </div>

      {/* Config summary */}
      <div className="tc-config-panel">
        <div className="tc-config-item">
          <span className="tc-config-label">Rounds:</span>
          <span className="tc-config-val">{totalRounds}</span>
        </div>
        <div className="tc-config-item">
          <span className="tc-config-label">Q/Round:</span>
          <span className="tc-config-val">{questionsPerRound}</span>
        </div>
        <div className="tc-config-item">
          <span className="tc-config-label">Timer:</span>
          <span className="tc-config-val">
            {timerEnabled ? `${timerSeconds}s` : "Off"}
          </span>
        </div>
        <div className="tc-config-item">
          <span className="tc-config-label">Assigned Category:</span>
          <span className="tc-config-val">
            {Array.isArray(triviaConfig.roundCategories) && triviaConfig.roundCategories.length > 0
              ? triviaConfig.roundCategories.map((rc, idx) => `R${idx + 1}: ${rc}`).join(" | ")
              : selectedCategory}
          </span>
        </div>
        {categoryNames.length > 0 && (
          <div className="tc-config-item">
            <span className="tc-config-label">Enabled Categories:</span>
            <span className="tc-config-val">{categoryNames.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="tc-leaderboard">
        {sorted.length === 0 ? (
          <div className="tc-empty">No players have joined yet</div>
        ) : (
          <>
            <div className="tc-lb-header">
              <span>#</span>
              <span>Player</span>
              <span>Round</span>
              <span>Answered</span>
              <span>Status</span>
              <span>Score</span>
            </div>
            {sorted.map((player, i) => {
              const t = tc(player);
              const isCompleted = t.completed;
              return (
                <div
                  key={player._id}
                  className={`tc-lb-row ${
                    isCompleted ? "tc-row-completed" : "tc-row-playing"
                  }`}
                >
                  <span className="tc-lb-rank">
                    {i === 0 && (t.score || player.score)
                      ? "🥇"
                      : i === 1 && (t.score || player.score)
                      ? "🥈"
                      : i === 2 && (t.score || player.score)
                      ? "🥉"
                      : `#${i + 1}`}
                  </span>
                  <span className="tc-lb-name">{player.name}</span>
                  <span className="tc-lb-round">
                    {t.currentRound || 0}/{totalRounds}
                  </span>
                  <span className="tc-lb-answered">
                    {t.questionsAnswered || 0}
                  </span>
                  <span className="tc-lb-status">
                    {isCompleted ? "✅ Done" : "🔄 Playing"}
                  </span>
                  <span className="tc-lb-score">
                    {t.score || player.score || 0}
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

export default TriviaChallengeAdminDashboard;
