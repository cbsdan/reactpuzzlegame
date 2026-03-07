import { TOTAL_STAGES } from "./constants.js";

/**
 * GameHUD — heads-up display, visual hints, collected pill bar, and proximity prompts.
 *
 * Props
 *  timeLeft          number   – seconds remaining
 *  fmt               fn       – formats seconds as "M:SS"
 *  stageCluesFound   number[] – clue indices collected in current stage
 *  stg               object   – current stage data
 *  currentStage      number
 *  isDashing         bool
 *  dashReady         bool
 *  isJumping         bool
 *  jumpReady         bool
 *  hasKey            bool
 *  isSlowed          bool
 *  anyModal          bool     – true if any overlay is visible
 *  nearClue          number|null
 *  nearTrash         number|null
 *  stageTrashTriggered number[]
 *  nearCart          bool
 *  showStageQuestion bool
 *  cartAnswerBlocked bool
 *  isPaused          bool
 *  setShowStageQuestion fn
 */
const GameHUD = ({
  timeLeft,
  fmt,
  stageCluesFound,
  stg,
  currentStage,
  isDashing,
  dashReady,
  isJumping,
  jumpReady,
  hasKey,
  isSlowed,
  anyModal,
  nearClue,
  nearTrash,
  stageTrashTriggered,
  nearCart,
  showStageQuestion,
  cartAnswerBlocked,
  isPaused,
  setShowStageQuestion,
}) => (
  <>
    {/* ── HUD ──────────────────────────────────── */}
    <div className="sm-hud">
      <div className="sm-hud-left">
        <div
          className={`sm-hud-pill sm-timer${timeLeft <= 60 ? " warn" : ""}${timeLeft <= 30 ? " critical" : ""}`}
        >
          ⏱ {fmt(timeLeft)}
        </div>
        <div className="sm-hud-pill sm-clue-count">
          🔑 {stageCluesFound.length}/{stg.clues.length}
        </div>
        <div
          className="sm-hud-pill sm-stage-pill"
          style={{ borderColor: stg.theme.label, color: stg.theme.label }}
        >
          🏰 Stage {Math.min(currentStage + 1, TOTAL_STAGES)}/{TOTAL_STAGES}:{" "}
          {currentStage >= TOTAL_STAGES ? "Complete!" : stg.name}
        </div>
        <div
          className={`sm-hud-pill sm-dash-pill${isDashing ? " dashing" : ""}${!dashReady ? " cooldown" : ""}`}
        >
          💨 {isDashing ? "DASH!" : dashReady ? "Ready" : "Cooldown"}
        </div>
        <div
          className={`sm-hud-pill sm-jump-pill${isJumping ? " jumping" : ""}${!jumpReady ? " cooldown" : ""}`}
        >
          🦘 {isJumping ? "JUMP!" : jumpReady ? "Ready" : "Cooldown"}
        </div>
        {hasKey && <div className="sm-hud-pill sm-key-pill">🗝️ KEY</div>}
        {isSlowed && (
          <div className="sm-hud-pill sm-slowed-pill">🐌 SLOWED</div>
        )}
      </div>
      <div className="sm-hud-right">
        <div className="sm-hud-pill sm-controls-hint">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> Move &nbsp;· <kbd>E</kbd> Interact &nbsp;·{" "}
          <kbd>Space</kbd> Jump &nbsp;· <kbd>Shift</kbd> Dash
        </div>
      </div>
    </div>

    {/* ── Collected clue pills ─────────────────── */}
    {stageCluesFound.length > 0 && !anyModal && (
      <div className="sm-collected-pills">
        {stageCluesFound.map((idx) => {
          const clue = stg.clues[idx];
          if (!clue) return null;
          return (
            <span
              key={idx}
              className="sm-collected-pill"
              title={clue.clue}
              style={{ borderColor: stg.theme.label, color: stg.theme.label }}
            >
              ✅ {clue.name}
            </span>
          );
        })}
      </div>
    )}

    {/* ── Proximity prompt — clue object ────────── */}
    {nearClue !== null &&
      nearTrash === null &&
      !anyModal &&
      !isPaused &&
      stg.clues[nearClue] && (
        <div
          className={`sm-prompt${stageCluesFound.includes(nearClue) ? " collected" : ""}`}
        >
          {stageCluesFound.includes(nearClue) ? (
            `✅ ${stg.clues[nearClue].name} — already inspected`
          ) : (
            <span>
              Press <kbd>E</kbd> to inspect{" "}
              <strong>{stg.clues[nearClue].name}</strong>
            </span>
          )}
        </div>
      )}

    {/* ── Proximity prompt — trash object ────────── */}
    {nearTrash !== null && nearClue === null && !anyModal && !isPaused && (
      <div
        className={`sm-prompt${stageTrashTriggered.includes(nearTrash) ? " collected" : ""}`}
      >
        {stageTrashTriggered.includes(nearTrash) ? (
          "💀 Already triggered — it was trash!"
        ) : (
          <span>
            Press <kbd>E</kbd> to inspect <strong>Mysterious Object</strong>
          </span>
        )}
      </div>
    )}

    {/* ── Cart prompt — no clues yet ──────────────── */}
    {nearCart && stageCluesFound.length < 1 && !anyModal && !isPaused && (
      <div className="sm-prompt collected">
        🔒 Find at least one clue before answering!
      </div>
    )}

    {/* ── Cart prompt — ready to answer ─────────── */}
    {nearCart &&
      stageCluesFound.length >= 1 &&
      !showStageQuestion &&
      !anyModal &&
      !cartAnswerBlocked &&
      !isPaused && (
        <div className="sm-answer-ready">
          <button onClick={() => setShowStageQuestion(true)}>
            🧩 Answer Stage {currentStage + 1} Question
          </button>
          <div className="sm-answer-hint">
            or press <kbd>E</kbd>
          </div>
        </div>
      )}
  </>
);

export default GameHUD;
