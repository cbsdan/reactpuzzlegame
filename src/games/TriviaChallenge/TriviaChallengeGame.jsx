import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGame } from "../../context/GameContext";
import DEFAULT_TRIVIA_QUESTIONS from "./triviaQuestions";
import "./TriviaChallengeGame.css";

const LETTERS = ["A", "B", "C", "D"];

/**
 * TriviaChallengeGame – Player-facing trivia component.
 *
 * Requirements:
 *   1. Category is chosen by Admin only; player directly starts playing.
 *   2. Speed-based scoring across all players (faster answer = higher bonus).
 *   3. Asynchronous self-paced play (state stored in MongoDB via submitTriviaAnswer).
 */
const TriviaChallengeGame = () => {
  const { gameState, players, currentPlayer, submitTriviaAnswer } = useGame();

  // ── Derive config from server gameState ──────────────────────
  const triviaConfig = gameState?.triviaConfig || {};
  const questionsData = triviaConfig.questions || DEFAULT_TRIVIA_QUESTIONS;
  const totalRounds = triviaConfig.rounds || 3;
  const questionsPerRound = triviaConfig.questionsPerRound || 5;
  const timerEnabled = triviaConfig.timerEnabled !== undefined ? triviaConfig.timerEnabled : true;
  const timerSeconds = triviaConfig.timerSeconds || 15;
  const selectedCategory = triviaConfig.selectedCategory || "All";

  // Build list of active questions for this session based on Admin configuration (memoized)
  const gameQuestions = useMemo(() => {
    let list = [];
    const catKeys = Object.keys(questionsData);

    if (selectedCategory && selectedCategory !== "All" && questionsData[selectedCategory]) {
      const catObj = questionsData[selectedCategory];
      const qs = catObj.questions || catObj;
      if (Array.isArray(qs)) {
        list = qs.map((q) => ({ ...q, category: selectedCategory, icon: catObj.icon || "❓" }));
      }
    } else {
      // Mixed across enabled categories
      catKeys.forEach((catKey) => {
        const catObj = questionsData[catKey];
        const qs = catObj.questions || catObj;
        if (Array.isArray(qs)) {
          qs.forEach((q) => {
            list.push({ ...q, category: catKey, icon: catObj.icon || "❓" });
          });
        }
      });
    }

    const totalNeeded = totalRounds * questionsPerRound;
    if (list.length === 0) {
      // Fallback if empty
      const defaultCat = DEFAULT_TRIVIA_QUESTIONS["Movies"];
      list = (defaultCat.questions || []).map((q) => ({ ...q, category: "Movies", icon: defaultCat.icon }));
    }

    return list.slice(0, totalNeeded);
  }, [questionsData, selectedCategory, totalRounds, questionsPerRound]);

  const totalPossibleQuestions = Math.min(totalRounds * questionsPerRound, gameQuestions.length);

  // ── Local game state (initialized from player history for async play) ──
  const tcSaved = currentPlayer?.triviaChallenge || {};
  const initialAnswered = tcSaved.questionsAnswered || 0;
  const initialScore = tcSaved.score || 0;
  const initialTimeTaken = tcSaved.totalTimeTaken || 0;
  const initialRound = tcSaved.currentRound || 1;
  const isAlreadyCompleted = tcSaved.completed || (initialAnswered >= totalPossibleQuestions && totalPossibleQuestions > 0);

  const [phase, setPhase] = useState(isAlreadyCompleted ? "complete" : "question");
  const [totalScore, setTotalScore] = useState(initialScore);
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(initialAnswered);
  const [totalTimeTaken, setTotalTimeTaken] = useState(initialTimeTaken);
  const [currentRound, setCurrentRound] = useState(initialRound);

  // Question-level state
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPoints, setPopupPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  const timerRef = useRef(null);
  const answeredRef = useRef(false);

  const currentQ = gameQuestions[totalQuestionsAnswered] || null;

  // ── Timer logic ──────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (!timerEnabled) return;
    stopTimer();
    setTimeLeft(timerSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timerEnabled, timerSeconds, stopTimer]);

  // Start timer on initial mount or when moving to next question
  useEffect(() => {
    if (phase === "question" && currentQ && !answeredRef.current) {
      startTimer();
    }
    return () => stopTimer();
  }, [phase, totalQuestionsAnswered, startTimer, stopTimer]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timerEnabled && timeLeft === 0 && phase === "question" && !answeredRef.current) {
      handleTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timerEnabled, phase]);

  // ── Score & Speed Calculation ────────────────────────────────
  const calculateScore = (difficulty, remaining) => {
    const baseScore = (difficulty || 1) * 100;
    if (timerEnabled && remaining > 0) {
      // Speed bonus: up to 100 bonus pts * difficulty based on remaining time ratio
      const speedFactor = remaining / timerSeconds;
      const speedBonus = Math.floor(speedFactor * (difficulty || 1) * 100);
      return baseScore + speedBonus;
    }
    return baseScore;
  };

  const handleAnswer = async (choiceIndex) => {
    if (answeredRef.current || selectedAnswer !== null || !currentQ) return;
    answeredRef.current = true;
    stopTimer();

    const timeSpent = Math.max(0, timerSeconds - timeLeft);
    const correct = choiceIndex === currentQ.answer;
    const earned = correct ? calculateScore(currentQ.difficulty, timeLeft) : 0;

    setSelectedAnswer(choiceIndex);
    setIsCorrect(correct);
    setPopupPoints(earned);
    setShowPopup(true);

    const newTotalScore = totalScore + earned;
    const newQAnswered = totalQuestionsAnswered + 1;
    const newTotalTime = Math.round((totalTimeTaken + timeSpent) * 100) / 100;
    const calculatedRound = Math.min(totalRounds, Math.floor(newQAnswered / questionsPerRound) + 1);

    setTotalScore(newTotalScore);
    setTotalQuestionsAnswered(newQAnswered);
    setTotalTimeTaken(newTotalTime);
    setCurrentRound(calculatedRound);

    // Submit to server for real-time async leaderboard syncing
    try {
      await submitTriviaAnswer({
        questionIndex: totalQuestionsAnswered,
        selectedAnswer: choiceIndex,
        timeRemaining: timeLeft,
        timeTaken: timeSpent,
        totalTimeTaken: newTotalTime,
        round: calculatedRound,
        category: currentQ.category,
        isCorrect: correct,
        pointsEarned: earned,
        totalScore: newTotalScore,
        totalQuestionsAnswered: newQAnswered,
        currentRound: calculatedRound,
      });
    } catch (e) {
      console.error("Failed to submit trivia answer:", e);
    }

    // Advance to next question or complete phase after popup animation
    setTimeout(() => {
      setShowPopup(false);
      if (newQAnswered >= totalPossibleQuestions) {
        setPhase("complete");
      } else {
        setSelectedAnswer(null);
        setIsCorrect(null);
        answeredRef.current = false;
        startTimer();
      }
    }, 1200);
  };

  const handleTimeout = () => {
    handleAnswer(-1); // -1 = timeout / no choice selected
  };

  // ── Leaderboard data with Speed Tiebreaker ────────────────────
  const leaderboard = [...players]
    .map((p) => ({
      ...p,
      triviaScore: p.triviaChallenge?.score ?? p.score ?? 0,
      triviaAnswered: p.triviaChallenge?.questionsAnswered ?? 0,
      triviaRound: p.triviaChallenge?.currentRound ?? 0,
      totalTimeTaken: p.triviaChallenge?.totalTimeTaken ?? 9999,
      completed: p.triviaChallenge?.completed ?? false,
    }))
    .sort((a, b) => {
      if (b.triviaScore !== a.triviaScore) {
        return b.triviaScore - a.triviaScore;
      }
      // On equal score, lower time taken (faster player) ranks higher
      return a.totalTimeTaken - b.totalTimeTaken;
    });

  // ── Progress calculation ─────────────────────────────────────
  const progressPct = Math.min(100, (totalQuestionsAnswered / (totalPossibleQuestions || 1)) * 100);

  // ── Timer ring SVG values ────────────────────────────────────
  const timerRadius = 34;
  const timerCircumference = 2 * Math.PI * timerRadius;
  const timerOffset = timerCircumference * (1 - timeLeft / timerSeconds);
  const timerColor = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f59e0b" : "#6366f1";

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="trivia-game">
      {/* Top bar */}
      <div className="trivia-topbar">
        <div className="trivia-round-badge">
          🧠 Round {Math.min(currentRound, totalRounds)} / {totalRounds}
        </div>
        <div className="trivia-score-pill">
          ⭐ {totalScore} pts
        </div>
        <div className="trivia-players-pill">
          👥 {players.length} player{players.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Progress bar */}
      <div className="trivia-progress-wrap">
        <div className="trivia-progress-labels">
          <span>Progress</span>
          <span>{totalQuestionsAnswered} / {totalPossibleQuestions} questions</span>
        </div>
        <div className="trivia-progress-bar">
          <div className="trivia-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ── Phase: Question ────────────────── */}
      {phase === "question" && currentQ && (
        <div className="trivia-question-phase">
          {/* Header: category + difficulty + question # */}
          <div className="trivia-q-header">
            <span className="trivia-q-category-badge">
              {currentQ.icon || "❓"} {currentQ.category}
            </span>
            <div className="trivia-q-difficulty">
              {[1, 2, 3, 4, 5].map((d) => (
                <span
                  key={d}
                  className={`trivia-diff-dot ${d <= (currentQ.difficulty || 1) ? "active" : ""}`}
                />
              ))}
            </div>
            <span className="trivia-q-number">
              Q{totalQuestionsAnswered + 1}/{totalPossibleQuestions}
            </span>
          </div>

          {/* Timer */}
          {timerEnabled && (
            <div className="trivia-timer-wrap">
              <svg className="trivia-timer-svg" width="80" height="80" viewBox="0 0 80 80">
                <circle className="trivia-timer-bg" cx="40" cy="40" r={timerRadius} />
                <circle
                  className={`trivia-timer-ring ${timeLeft <= 5 ? "warning" : ""}`}
                  cx="40"
                  cy="40"
                  r={timerRadius}
                  stroke={timerColor}
                  strokeDasharray={timerCircumference}
                  strokeDashoffset={timerOffset}
                />
              </svg>
              <div className={`trivia-timer-text ${timeLeft <= 5 ? "warning" : ""}`}>
                {timeLeft}
              </div>
            </div>
          )}

          {/* Question card */}
          <div className="trivia-question-card">
            <div className="trivia-question-text">{currentQ.question}</div>
          </div>

          {/* Choices */}
          <div className="trivia-choices">
            {currentQ.choices.map((choice, idx) => {
              let cls = "";
              if (selectedAnswer !== null) {
                if (idx === currentQ.answer) {
                  cls = selectedAnswer === idx ? "correct" : "reveal-correct";
                } else if (idx === selectedAnswer) {
                  cls = "wrong";
                }
              }

              return (
                <button
                  key={idx}
                  className={`trivia-choice-btn ${cls}`}
                  onClick={() => handleAnswer(idx)}
                  disabled={selectedAnswer !== null}
                >
                  <span className="trivia-choice-letter">{LETTERS[idx]}</span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Phase: Game Complete ────────────── */}
      {phase === "complete" && (
        <div className="trivia-complete-phase">
          <div className="trivia-complete-header">
            <div className="trivia-complete-icon">🏆</div>
            <div className="trivia-complete-title">Trivia Complete!</div>
            <div className="trivia-final-score">
              Your final score: <strong>{totalScore}</strong> pts
              <div style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "4px" }}>
                ⏱ Total time: {totalTimeTaken}s
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="trivia-leaderboard">
            <div className="trivia-lb-title">
              📊 Live Leaderboard (Ranked by Score &amp; Speed)
            </div>
            {leaderboard.map((p, i) => (
              <div
                key={p._id}
                className={`trivia-lb-row ${p._id === currentPlayer?._id ? "is-me" : ""}`}
              >
                <span className="trivia-lb-rank">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="trivia-lb-name">
                  {p.name}
                  {p._id === currentPlayer?._id && (
                    <span className="trivia-lb-me-tag">YOU</span>
                  )}
                </span>
                <span className="trivia-lb-progress">
                  {p.triviaAnswered > 0
                    ? `${p.triviaAnswered} answered (${p.totalTimeTaken < 9000 ? `${p.totalTimeTaken}s` : ""})`
                    : "Playing..."}
                </span>
                <span className="trivia-lb-score">{p.triviaScore} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Score popup overlay ─────────────── */}
      {showPopup && (
        <div className="trivia-score-popup">
          <div className="trivia-score-popup-inner">
            <div className="trivia-popup-icon">
              {isCorrect ? "✅" : "❌"}
            </div>
            <div className={`trivia-popup-text ${isCorrect ? "correct-text" : "wrong-text"}`}>
              {isCorrect ? "Correct!" : "Wrong!"}
            </div>
            <div className={`trivia-popup-points ${popupPoints === 0 ? "zero" : ""}`}>
              +{popupPoints} pts
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TriviaChallengeGame;
