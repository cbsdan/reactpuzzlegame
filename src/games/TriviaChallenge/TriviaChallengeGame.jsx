import { useState, useEffect, useRef, useCallback } from "react";
import { useGame } from "../../context/GameContext";
import DEFAULT_TRIVIA_QUESTIONS from "./triviaQuestions";
import "./TriviaChallengeGame.css";

const LETTERS = ["A", "B", "C", "D"];

/**
 * TriviaChallengeGame – Player-facing trivia component.
 *
 * Game flow:
 *   1. Category selection  →  2. Answer questions  →  (repeat for N rounds)  →  3. Leaderboard
 *
 * All scoring is calculated locally and submitted to the server per-question
 * via `submitTriviaAnswer` so the live leaderboard stays up-to-date for all players.
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

  // Build category list from questions data
  const allCategories = Object.keys(questionsData);

  // ── Local game state ─────────────────────────────────────────
  const [phase, setPhase] = useState("category"); // 'category' | 'question' | 'complete'
  const [currentRound, setCurrentRound] = useState(1);
  const [categoriesPlayed, setCategoriesPlayed] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(0);

  // Question-level state
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPoints, setPopupPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const timerRef = useRef(null);
  const answeredRef = useRef(false);

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

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timerEnabled && timeLeft === 0 && phase === "question" && !answeredRef.current) {
      handleTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timerEnabled, phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // ── Get current question ─────────────────────────────────────
  const getCategoryQuestions = (catName) => {
    const cat = questionsData[catName];
    if (!cat) return [];
    const qs = cat.questions || cat;
    return Array.isArray(qs) ? qs.slice(0, questionsPerRound) : [];
  };

  const currentQuestions = currentCategory ? getCategoryQuestions(currentCategory) : [];
  const currentQ = currentQuestions[questionIndex] || null;

  // ── Handlers ─────────────────────────────────────────────────
  const pickCategory = (catName) => {
    setCurrentCategory(catName);
    setCategoriesPlayed((prev) => [...prev, catName]);
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    answeredRef.current = false;
    setPhase("question");
    startTimer();
  };

  const calculateScore = (difficulty, remaining) => {
    const baseScore = difficulty * 100;
    if (timerEnabled && remaining > 0) {
      const bonus = Math.floor((remaining / timerSeconds) * difficulty * 50);
      return baseScore + bonus;
    }
    return baseScore;
  };

  const handleAnswer = async (choiceIndex) => {
    if (answeredRef.current || selectedAnswer !== null) return;
    answeredRef.current = true;
    stopTimer();

    const correct = choiceIndex === currentQ.answer;
    const earned = correct ? calculateScore(currentQ.difficulty, timeLeft) : 0;

    setSelectedAnswer(choiceIndex);
    setIsCorrect(correct);
    setPopupPoints(earned);
    setShowPopup(true);

    const newTotal = totalScore + earned;
    const newQAnswered = totalQuestionsAnswered + 1;
    setTotalScore(newTotal);
    setTotalQuestionsAnswered(newQAnswered);

    // Submit to server
    try {
      await submitTriviaAnswer({
        questionIndex,
        selectedAnswer: choiceIndex,
        timeRemaining: timeLeft,
        round: currentRound,
        category: currentCategory,
        isCorrect: correct,
        pointsEarned: earned,
        totalScore: newTotal,
        totalQuestionsAnswered: newQAnswered,
        currentRound,
      });
    } catch (e) {
      console.error("Failed to submit trivia answer:", e);
    }

    // Advance after delay
    setTimeout(() => {
      setShowPopup(false);
      advanceQuestion(newTotal, newQAnswered);
    }, 1200);
  };

  const handleTimeout = () => {
    handleAnswer(-1); // -1 = no answer selected → wrong
  };

  const advanceQuestion = (latestScore, latestQAnswered) => {
    const nextIdx = questionIndex + 1;

    if (nextIdx < currentQuestions.length) {
      // Next question in same category
      setQuestionIndex(nextIdx);
      setSelectedAnswer(null);
      setIsCorrect(null);
      answeredRef.current = false;
      startTimer();
    } else {
      // Round complete
      const nextRound = currentRound + 1;
      if (nextRound <= totalRounds && categoriesPlayed.length < allCategories.length) {
        setCurrentRound(nextRound);
        setCurrentCategory(null);
        setQuestionIndex(0);
        setSelectedAnswer(null);
        setIsCorrect(null);
        answeredRef.current = false;
        setPhase("category");
      } else {
        // Game complete
        setPhase("complete");
      }
    }
  };

  // ── Leaderboard data ─────────────────────────────────────────
  const leaderboard = [...players]
    .map((p) => ({
      ...p,
      triviaScore: p.triviaChallenge?.score ?? p.score ?? 0,
      triviaAnswered: p.triviaChallenge?.questionsAnswered ?? 0,
      triviaRound: p.triviaChallenge?.currentRound ?? 0,
    }))
    .sort((a, b) => b.triviaScore - a.triviaScore);

  // ── Progress calculation ─────────────────────────────────────
  const totalPossibleQuestions = totalRounds * questionsPerRound;
  const progressPct = Math.min(100, (totalQuestionsAnswered / totalPossibleQuestions) * 100);

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

      {/* ── Phase: Category Selection ────────── */}
      {phase === "category" && (
        <div className="trivia-category-phase">
          <div className="trivia-category-title">Choose a Category</div>
          <div className="trivia-category-sub">
            Round {currentRound} — pick a topic to answer questions from
          </div>
          <div className="trivia-category-grid">
            {allCategories.map((catName) => {
              const played = categoriesPlayed.includes(catName);
              const catData = questionsData[catName];
              const icon = catData?.icon || "❓";
              const qCount = (catData?.questions || catData || []).length;

              return (
                <div
                  key={catName}
                  className={`trivia-category-card ${played ? "disabled" : ""}`}
                  onClick={() => !played && pickCategory(catName)}
                >
                  <span className="trivia-cat-icon">{icon}</span>
                  <span className="trivia-cat-name">{catName}</span>
                  <span className="trivia-cat-count">
                    {Math.min(qCount, questionsPerRound)} question{Math.min(qCount, questionsPerRound) !== 1 ? "s" : ""}
                  </span>
                  {played && <span className="trivia-cat-played-badge">✓ Played</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Phase: Question ────────────────── */}
      {phase === "question" && currentQ && (
        <div className="trivia-question-phase">
          {/* Header: category + difficulty + question # */}
          <div className="trivia-q-header">
            <span className="trivia-q-category-badge">
              {questionsData[currentCategory]?.icon || "❓"} {currentCategory}
            </span>
            <div className="trivia-q-difficulty">
              {[1, 2, 3, 4, 5].map((d) => (
                <span
                  key={d}
                  className={`trivia-diff-dot ${d <= currentQ.difficulty ? "active" : ""}`}
                />
              ))}
            </div>
            <span className="trivia-q-number">
              Q{questionIndex + 1}/{currentQuestions.length}
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
            </div>
          </div>

          {/* Leaderboard */}
          <div className="trivia-leaderboard">
            <div className="trivia-lb-title">
              📊 Leaderboard
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
                    ? `${p.triviaAnswered} answered`
                    : "Playing..."}
                </span>
                <span className="trivia-lb-score">{p.triviaScore}</span>
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
