import {
  TOTAL_STAGES,
  STAGE_MAX_SCORES,
  STAGE_WRONG_TIME_PENALTY,
  STAGE_TRASH_TIME_PENALTY,
  TRASH_SLOW_DURATION,
} from "./constants.js";

/**
 * GameModals — all overlay modals for the Stickman Mystery Game.
 *
 * Props are grouped into: state, setters, refs, handlers, derived data.
 */
const GameModals = ({
  // ── visibility state ──
  showStoryline,
  showKeyObtained,
  showClue,
  showTrash,
  showStageQuestion,
  showStageSummary,
  gameComplete,
  showFinalSummary,
  showDashboard,
  gameOver,
  isPaused,
  // ── game data ──
  stg,
  STAGES,
  currentStage,
  stageCluesFound,
  stageTrashTriggered,
  stageAnswer,
  stageWrongAttempts,
  error,
  finalScore,
  stageScores,
  timeLeft,
  hasKey,
  cartAnswerBlocked,
  fmt,
  // ── player data ──
  players,
  currentPlayer,
  gameState,
  // ── simple setters ──
  setShowStoryline,
  setShowKeyObtained,
  setShowClue,
  setShowTrash,
  setShowStageQuestion,
  setShowStageSummary,
  setShowFinalSummary,
  setShowDashboard,
  setStageAnswer,
  setStageWrongAttempts,
  setError,
  setStageCluesFound,
  setStageTrashTriggered,
  setHasKey,
  setCurrentStage,
  setCartAnswerBlocked,
  setShowStoryline: _unused, // already captured above
  // ── refs ──
  keysRef,
  interactCoolRef,
  stickmanRef,
  stickmanAngleRef,
  currentStageRef,
  stageStartTimeRef,
  hasKeyRef,
  stageCluesFoundRef,
  stageTrashTriggeredRef,
  stageSpawnPositionsRef,
  stageCartSpawnPositionsRef,
  cartMeshRef,
  // ── handlers ──
  handleStageAnswer,
}) => {
  const stageIdx = Math.min(currentStage, TOTAL_STAGES - 1);

  /* helper to close most modals and clear keys */
  const clearKeys = () => {
    if (keysRef) keysRef.current = {};
  };

  return (
    <>
      {/* ── Storyline intro modal ────────────────── */}
      {showStoryline &&
        !gameOver &&
        !gameComplete &&
        !isPaused &&
        gameState?.status === "playing" && (
          <div className="sm-overlay">
            <div
              className="sm-modal sm-storyline-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm-modal-icon">📜</div>
              <h3>
                Stage {currentStage + 1}: {stg.name}
              </h3>
              <p className="sm-storyline-text">{stg.storyline}</p>
              <p className="sm-objective-text">
                <strong>📌 Objective:</strong> {stg.objective}
              </p>
              <div className="sm-storyline-info">
                <span>🔑 Clues to find: {stg.clues.length}</span>
                <span>💀 Traps hidden: {stg.trash.length}</span>
                {currentStage > 0 && <span>⚠️ Difficulty increased!</span>}
              </div>
              <button
                className="sm-btn sm-btn-primary"
                onClick={() => {
                  setShowStoryline(false);
                  clearKeys();
                }}
              >
                ⚔️ Begin Exploration
              </button>
            </div>
          </div>
        )}

      {/* ── Key obtained modal ───────────────────── */}
      {showKeyObtained && hasKey && !showStageSummary && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-key-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-big-icon">🗝️</div>
            <h2>Key Obtained!</h2>
            <p className="sm-key-text">
              You solved the riddle of <strong>{stg.name}</strong>! A mysterious
              key materializes in your hand. Use it to unlock the door to the
              next stage.
            </p>
            <button
              className="sm-btn sm-btn-primary"
              onClick={() => setShowKeyObtained(false)}
            >
              🚪 Open the Door →
            </button>
          </div>
        </div>
      )}

      {/* ── Clue modal ────────────────────────────── */}
      {showClue !== null && (
        <div
          className="sm-overlay"
          onClick={() => {
            setShowClue(null);
            clearKeys();
          }}
        >
          <div
            className="sm-modal sm-clue-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">🔍</div>
            <h3>{stg.clues[showClue]?.name ?? "Clue"}</h3>
            <p className="sm-clue-text">{stg.clues[showClue]?.clue ?? ""}</p>
            <button
              className="sm-btn"
              onClick={() => {
                setShowClue(null);
                clearKeys();
              }}
            >
              Got it ({stageCluesFound.length}/{stg.clues.length} clues)
            </button>
          </div>
        </div>
      )}

      {/* ── Trash modal ───────────────────────────── */}
      {showTrash !== null && (
        <div
          className="sm-overlay"
          onClick={() => {
            setShowTrash(null);
            clearKeys();
          }}
        >
          <div
            className="sm-modal sm-trap-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">💀</div>
            <h3>It&rsquo;s Trash!</h3>
            <p className="sm-clue-text" style={{ borderLeftColor: "#e74c3c" }}>
              {stg.trash[showTrash]?.msg || "This was trash!"}
            </p>
            <div className="sm-trap-effects">
              <span className="sm-trap-effect-badge sm-trap-time-penalty">
                ⏱ −{STAGE_TRASH_TIME_PENALTY[currentStage] ?? 5}s time penalty
              </span>
              <span className="sm-trap-effect-badge">
                🐌 Slowed {TRASH_SLOW_DURATION}s
              </span>
              <span className="sm-trap-effect-badge">📳 Camera shake</span>
            </div>
            <button
              className="sm-btn"
              onClick={() => {
                setShowTrash(null);
                clearKeys();
              }}
            >
              Ouch! Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Stage question modal ──────────────────── */}
      {showStageQuestion && !gameComplete && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-question-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">🧩</div>
            <h3>
              Stage {currentStage + 1}: {stg.name}
            </h3>
            <p className="sm-question-text">{stg.question}</p>

            <div className="sm-review">
              <h4>
                Your Collected Clues ({stageCluesFound.length}/
                {stg.clues.length})
              </h4>
              {stageCluesFound.map((idx, i) => {
                const clue = stg.clues[idx];
                if (!clue) return null;
                return (
                  <div key={idx} className="sm-review-row">
                    <span className="sm-review-num">#{i + 1}</span>
                    <span className="sm-review-name">{clue.name}:</span>
                    <span className="sm-review-clue">{clue.clue}</span>
                  </div>
                );
              })}
            </div>

            <div className="sm-wrong-penalty-warning">
              ⚠️ Wrong answer penalty:{" "}
              <strong>−{STAGE_WRONG_TIME_PENALTY[currentStage] ?? 15}s</strong>{" "}
              from your timer
            </div>

            <form className="sm-answer-form" onSubmit={handleStageAnswer}>
              <input
                type="text"
                value={stageAnswer}
                onChange={(e) => setStageAnswer(e.target.value)}
                placeholder="Type your answer…"
                autoFocus
                maxLength={50}
              />
              <button type="submit" className="sm-btn sm-btn-primary">
                Submit
              </button>
            </form>

            {stageWrongAttempts > 0 && (
              <div className="sm-attempts">
                Wrong attempts: {stageWrongAttempts} (−
                {stageWrongAttempts *
                  (STAGE_WRONG_TIME_PENALTY[currentStage] ?? 15)}
                s total)
              </div>
            )}
            {error && <div className="sm-error">{error}</div>}

            <button
              className="sm-btn sm-btn-secondary"
              onClick={() => {
                setShowStageQuestion(false);
                setError("");
                setCartAnswerBlocked(true);
                if (interactCoolRef) interactCoolRef.current = true;
                clearKeys();
                setTimeout(() => {
                  setCartAnswerBlocked(false);
                  if (interactCoolRef) interactCoolRef.current = false;
                }, 600);
              }}
            >
              Back to Exploring
            </button>
          </div>
        </div>
      )}

      {/* ── Stage completion summary ─────────────── */}
      {showStageSummary !== null && !gameComplete && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-stage-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: STAGES[showStageSummary.stage].theme.label }}
          >
            <div className="sm-big-icon">🏆</div>
            <h2>Stage {showStageSummary.stage + 1} Complete!</h2>
            <h3
              style={{
                color: STAGES[showStageSummary.stage].theme.label,
                margin: "4px 0 16px",
              }}
            >
              {showStageSummary.name}
            </h3>
            <div
              className="sm-score-box"
              style={{
                borderColor: STAGES[showStageSummary.stage].theme.label,
              }}
            >
              <span className="sm-score-label">Stage Score</span>
              <span
                className="sm-score-value"
                style={{ color: STAGES[showStageSummary.stage].theme.label }}
              >
                {showStageSummary.score}
              </span>
            </div>
            <div className="sm-stage-stats">
              <div>⏱ Time spent: {Math.floor(showStageSummary.timeSpent)}s</div>
              <div>💀 Trash triggered: {showStageSummary.trashTriggered}</div>
              <div>❌ Wrong answers: {showStageSummary.wrongAttempts}</div>
              <div>
                📊 Max possible:{" "}
                {STAGE_MAX_SCORES[showStageSummary.stage] || 1000}
              </div>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              onClick={() => {
                setShowStageSummary(null);
                setShowKeyObtained(false);
                const next = showStageSummary.stage + 1;
                setCurrentStage(next);
                if (currentStageRef) currentStageRef.current = next;
                if (stageStartTimeRef) stageStartTimeRef.current = timeLeft;
                setStageCluesFound([]);
                if (stageCluesFoundRef) stageCluesFoundRef.current = [];
                setStageTrashTriggered([]);
                if (stageTrashTriggeredRef) stageTrashTriggeredRef.current = [];
                setStageWrongAttempts(0);
                setStageAnswer("");
                setError("");
                setHasKey(false);
                if (hasKeyRef) hasKeyRef.current = false;
                setShowStoryline(true);
                if (stickmanRef?.current) {
                  const nextSpawn = stageSpawnPositionsRef?.current?.[next] ?? [
                    0, 0,
                  ];
                  stickmanRef.current.group.position.set(
                    nextSpawn[0],
                    0,
                    nextSpawn[1],
                  );
                  if (stickmanAngleRef) stickmanAngleRef.current = 0;
                }
                if (cartMeshRef?.current) {
                  const nextCart = stageCartSpawnPositionsRef?.current?.[
                    next
                  ] ?? [0, 0, -10];
                  cartMeshRef.current.group.position.set(
                    nextCart[0],
                    0,
                    nextCart[1],
                  );
                }
              }}
            >
              {showStageSummary.stage < TOTAL_STAGES - 1
                ? `🗝️ Use Key → Enter Stage ${showStageSummary.stage + 2}: ${STAGES[showStageSummary.stage + 1].name}`
                : "🏆 View Final Results"}
            </button>
          </div>
        </div>
      )}

      {/* ── Game Complete — final stage complete ─────────── */}
      {gameComplete &&
        showStageSummary !== null &&
        !showFinalSummary &&
        !showDashboard && (
          <div className="sm-overlay sm-overlay-solved">
            <div
              className="sm-modal sm-stage-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                borderColor: STAGES[showStageSummary.stage].theme.label,
              }}
            >
              <div className="sm-big-icon">🏆</div>
              <h2>Final Stage Complete!</h2>
              <h3
                style={{
                  color: STAGES[showStageSummary.stage].theme.label,
                  margin: "4px 0 16px",
                }}
              >
                {showStageSummary.name}
              </h3>
              <div
                className="sm-score-box"
                style={{
                  borderColor: STAGES[showStageSummary.stage].theme.label,
                }}
              >
                <span className="sm-score-label">Stage Score</span>
                <span
                  className="sm-score-value"
                  style={{ color: STAGES[showStageSummary.stage].theme.label }}
                >
                  {showStageSummary.score}
                </span>
              </div>
              <div className="sm-stage-stats">
                <div>
                  ⏱ Time spent: {Math.floor(showStageSummary.timeSpent)}s
                </div>
                <div>💀 Trash triggered: {showStageSummary.trashTriggered}</div>
                <div>❌ Wrong answers: {showStageSummary.wrongAttempts}</div>
              </div>
              <button
                className="sm-btn sm-btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setShowStageSummary(null);
                  setShowFinalSummary(true);
                }}
              >
                📊 View Full Game Summary
              </button>
            </div>
          </div>
        )}

      {/* ── Game Complete — solved banner ─────────── */}
      {gameComplete &&
        showStageSummary === null &&
        !showFinalSummary &&
        !showDashboard && (
          <div className="sm-overlay sm-overlay-solved">
            <div className="sm-modal sm-solved-modal">
              <div className="sm-big-icon">🎉</div>
              <h2>All Stages Complete!</h2>
              <div className="sm-score-box">
                <span className="sm-score-label">Final Score</span>
                <span className="sm-score-value">{finalScore}</span>
              </div>
              <div className="sm-solve-stats">
                <span>⏱ Time remaining: {fmt(timeLeft)}</span>
                <span>
                  🏰 Stages cleared: {stageScores.length}/{TOTAL_STAGES}
                </span>
              </div>
              <button
                className="sm-btn sm-btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => setShowFinalSummary(true)}
              >
                📊 View Stage Summary
              </button>
            </div>
          </div>
        )}

      {/* ── Final summary with stage breakdown ─────── */}
      {showFinalSummary && !showDashboard && (
        <div className="sm-overlay sm-overlay-solved">
          <div className="sm-modal sm-summary-modal">
            <div className="sm-big-icon">📊</div>
            <h2>Game Summary</h2>
            <div className="sm-stage-breakdown">
              {stageScores.map((s, i) => (
                <div
                  key={i}
                  className="sm-stage-row"
                  style={{ borderLeftColor: STAGES[s.stage].theme.label }}
                >
                  <div className="sm-stage-row-header">
                    <span style={{ color: STAGES[s.stage].theme.label }}>
                      Stage {s.stage + 1}: {s.name}
                    </span>
                    <span
                      className="sm-stage-row-score"
                      style={{ color: STAGES[s.stage].theme.label }}
                    >
                      {s.score}
                    </span>
                  </div>
                  <div className="sm-stage-row-details">
                    ⏱ {Math.floor(s.timeSpent)}s · 💀 {s.trashTriggered} trash ·
                    ❌ {s.wrongAttempts} wrong
                  </div>
                </div>
              ))}
            </div>
            <div className="sm-score-box" style={{ marginTop: 16 }}>
              <span className="sm-score-label">Total Score</span>
              <span className="sm-score-value">
                {stageScores.reduce((sum, s) => sum + s.score, 0)}
              </span>
            </div>
            <div
              className="sm-score-box"
              style={{ marginTop: 8, borderColor: "rgba(241,196,15,0.3)" }}
            >
              <span className="sm-score-label">Server Score</span>
              <span className="sm-score-value" style={{ color: "#f1c40f" }}>
                {finalScore}
              </span>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setShowDashboard(true)}
            >
              🏅 View Dashboard &amp; Rankings
            </button>
            <button
              className="sm-btn sm-btn-secondary"
              onClick={() => setShowFinalSummary(false)}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ── Dashboard / Leaderboard ────────────────── */}
      {showDashboard && (
        <div className="sm-overlay sm-overlay-solved">
          <div className="sm-modal sm-dashboard-modal">
            <div className="sm-big-icon">🏅</div>
            <h2>Leaderboard</h2>
            {(() => {
              const sorted = [...(players || [])]
                .filter((p) => p.score > 0)
                .sort((a, b) => b.score - a.score);
              const myRank =
                sorted.findIndex((p) => p._id === currentPlayer?._id) + 1;
              const top3 = sorted.slice(0, 3);
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <>
                  <div className="sm-leaderboard">
                    {top3.length === 0 && (
                      <p style={{ color: "#888" }}>No scores yet</p>
                    )}
                    {top3.map((p, i) => (
                      <div
                        key={p._id}
                        className={`sm-lb-row${p._id === currentPlayer?._id ? " sm-lb-me" : ""}`}
                      >
                        <span className="sm-lb-medal">{medals[i]}</span>
                        <span className="sm-lb-name">{p.name}</span>
                        <span className="sm-lb-score">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  {myRank > 0 && (
                    <div className="sm-my-rank">
                      Your Rank: <strong>#{myRank}</strong> out of{" "}
                      {sorted.length} player{sorted.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {myRank === 0 && (
                    <div className="sm-my-rank" style={{ color: "#888" }}>
                      You haven&rsquo;t scored yet
                    </div>
                  )}
                </>
              );
            })()}
            <button
              className="sm-btn sm-btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => setShowDashboard(false)}
            >
              ← Back to Summary
            </button>
          </div>
        </div>
      )}

      {/* ── Time's up ─────────────────────────────── */}
      {gameOver && !gameComplete && !showDashboard && (
        <div className="sm-overlay sm-overlay-over">
          <div className="sm-modal sm-over-modal">
            <div className="sm-big-icon">⏰</div>
            <h2>Time&rsquo;s Up!</h2>
            <p>
              You ran out of time at{" "}
              <strong>Stage {Math.min(currentStage + 1, TOTAL_STAGES)}</strong>.
            </p>
            {stageScores.length > 0 && (
              <div className="sm-stage-breakdown" style={{ marginTop: 12 }}>
                {stageScores.map((s, i) => (
                  <div
                    key={i}
                    className="sm-stage-row"
                    style={{ borderLeftColor: STAGES[s.stage].theme.label }}
                  >
                    <div className="sm-stage-row-header">
                      <span style={{ color: STAGES[s.stage].theme.label }}>
                        Stage {s.stage + 1}: {s.name}
                      </span>
                      <span
                        className="sm-stage-row-score"
                        style={{ color: STAGES[s.stage].theme.label }}
                      >
                        {s.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="sm-solve-stats">
              <span>
                🔑 Clues: {stageCluesFound.length}/{stg.clues.length} (current
                stage)
              </span>
              <span>
                📊 Total: {stageScores.reduce((sum, s) => sum + s.score, 0)}
              </span>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => setShowDashboard(true)}
            >
              🏅 View Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Paused ────────────────────────────────── */}
      {isPaused && (
        <div className="sm-overlay">
          <div className="sm-modal sm-pause-modal">
            <div className="sm-modal-icon">⏸️</div>
            <h3>Game Paused</h3>
            <p>Waiting for the host to resume…</p>
            {stageCluesFound.length > 0 && (
              <p className="sm-pause-progress">
                {stageCluesFound.length} clue
                {stageCluesFound.length !== 1 ? "s" : ""} found so far (Stage{" "}
                {currentStage + 1})
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GameModals;
