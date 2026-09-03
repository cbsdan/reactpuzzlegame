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

  // ── Derive config from server gameState ───────────────────────────────────
  const triviaConfig = gameState?.triviaConfig || {};
  const questionsData = triviaConfig.questions || DEFAULT_TRIVIA_QUESTIONS;
  const totalRounds = triviaConfig.rounds || 3;
  const questionsPerRound = triviaConfig.questionsPerRound || 5;
  const timerEnabled = triviaConfig.timerEnabled !== undefined ? triviaConfig.timerEnabled : true;
  const timerSeconds = triviaConfig.timerSeconds || 15;
  const selectedCategory = triviaConfig.selectedCategory || "All";
  const roundCategories = triviaConfig.roundCategories || [];
  const allowPlayerCategoryChoice = triviaConfig.allowPlayerCategoryChoice || false;

  // Player's locally chosen category (overrides admin assignment when allowPlayerCategoryChoice is on)
  const [playerCategory, setPlayerCategory] = useState(null);

  // Build list of active questions for this session based on Admin per-round configuration (memoized)
  const gameQuestions = useMemo(() => {
    let allQuestionsList = [];
    const catKeys = Object.keys(questionsData);
    const usedIndicesByCat = {};

    for (let r = 0; r < totalRounds; r++) {
      // If player chose their own category, use it for every round
      const assignedCat = playerCategory ||
        roundCategories[r] || selectedCategory || "All";
      let roundPool = [];

      if (assignedCat !== "All" && questionsData[assignedCat]) {
        const catObj = questionsData[assignedCat];
        const qs = catObj.questions || catObj;
        if (Array.isArray(qs) && qs.length > 0) {
          roundPool = qs.map((q) => ({ ...q, category: assignedCat, icon: catObj.icon || "❓" }));
        }
      }

      if (roundPool.length === 0) {
        catKeys.forEach((catKey) => {
          const catObj = questionsData[catKey];
          const qs = catObj.questions || catObj;
          if (Array.isArray(qs)) {
            qs.forEach((q) => {
              roundPool.push({ ...q, category: catKey, icon: catObj.icon || "❓" });
            });
          }
        });
      }

      const poolKey = assignedCat !== "All" ? assignedCat : "All";
      const startIndex = usedIndicesByCat[poolKey] || 0;
      let selectedForRound = roundPool.slice(startIndex, startIndex + questionsPerRound);

      if (selectedForRound.length < questionsPerRound && roundPool.length > 0) {
        const needed = questionsPerRound - selectedForRound.length;
        selectedForRound = [...selectedForRound, ...roundPool.slice(0, needed)];
        usedIndicesByCat[poolKey] = needed;
      } else {
        usedIndicesByCat[poolKey] = startIndex + questionsPerRound;
      }

      allQuestionsList.push(...selectedForRound);
    }

    if (allQuestionsList.length === 0) {
      const defaultCat = DEFAULT_TRIVIA_QUESTIONS["Movies"];
      allQuestionsList = (defaultCat.questions || []).map((q) => ({ ...q, category: "Movies", icon: defaultCat.icon }));
    }

    return allQuestionsList.slice(0, totalRounds * questionsPerRound);
  }, [questionsData, selectedCategory, roundCategories, totalRounds, questionsPerRound, playerCategory]);

  const totalPossibleQuestions = Math.min(totalRounds * questionsPerRound, gameQuestions.length);

  // ── Local game state (initialized from player history for async play) ──
  const tcSaved = currentPlayer?.triviaChallenge || {};
  const initialAnswered = tcSaved.questionsAnswered || 0;
  const initialScore = tcSaved.score || 0;
  const initialCorrect = tcSaved.correctAnswers || 0;
  const initialTimeTaken = tcSaved.totalTimeTaken || 0;
  const initialRound = tcSaved.currentRound || 1;
  const isAlreadyCompleted = tcSaved.completed || (initialAnswered >= totalPossibleQuestions && totalPossibleQuestions > 0);

  const [phase, setPhase] = useState(
    isAlreadyCompleted
      ? "complete"
      : allowPlayerCategoryChoice && !playerCategory
      ? "category_pick"
      : "question"
  );
  const [totalScore, setTotalScore] = useState(initialScore);
  const [totalCorrectAnswers, setTotalCorrectAnswers] = useState(initialCorrect);
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(initialAnswered);
  const [totalTimeTaken, setTotalTimeTaken] = useState(initialTimeTaken);
  const [currentRound, setCurrentRound] = useState(initialRound);

  // Question & Score Breakdown state
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupPoints, setPopupPoints] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState({ total: 0, base: 0, speedBonus: 0 });
  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  // Round summary & history state
  const [roundStats, setRoundStats] = useState({
    completedRound: 1,
    roundQuestions: questionsPerRound,
    roundCorrect: 0,
    roundScore: 0,
  });
  const [roundHistory, setRoundHistory] = useState({});

  const timerRef = useRef(null);
  const answeredRef = useRef(false);

  const [currentQ, setCurrentQ] = useState(gameQuestions[initialAnswered] || null);

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

  // Sync currentQ when playerCategory changes (gameQuestions gets rebuilt)
  useEffect(() => {
    if (playerCategory) {
      setCurrentQ(gameQuestions[totalQuestionsAnswered] || null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCategory]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timerEnabled && timeLeft === 0 && phase === "question" && !answeredRef.current) {
      handleTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timerEnabled, phase]);

  // ── Score & Speed Calculation ────────────────────────────────
  const isAnswerCorrect = (choiceIdx, questionObj) => {
    if (!questionObj || choiceIdx === null || choiceIdx === undefined || choiceIdx < 0) return false;
    const ans = questionObj.answer;

    // 1. Exact numeric index match (0 === 0, 1 === 1, or string "0" === 0)
    if (typeof ans === "number" && ans === choiceIdx) return true;
    if (typeof ans === "string" && !isNaN(parseInt(ans, 10)) && parseInt(ans, 10) === choiceIdx) return true;

    // 2. Choice text matching ("Super Mario Bros." === choices[1])
    if (Array.isArray(questionObj.choices) && questionObj.choices[choiceIdx] !== undefined) {
      const choiceText = String(questionObj.choices[choiceIdx]).trim().toLowerCase();
      if (typeof ans === "string" && choiceText === ans.trim().toLowerCase()) return true;
    }

    // 3. Letter representation ("A" -> 0, "B" -> 1, "C" -> 2, "D" -> 3)
    if (typeof ans === "string") {
      const trimmed = ans.trim().toUpperCase();
      if (trimmed.length === 1 && trimmed >= "A" && trimmed <= "Z") {
        if (trimmed.charCodeAt(0) - 65 === choiceIdx) return true;
      }
    }

    return false;
  };

  const calculateScore = (difficulty, remaining) => {
    const diffMultiplier = difficulty || 1;
    const baseScore = diffMultiplier * 100;
    let speedBonus = 0;
    if (timerEnabled && remaining > 0 && timerSeconds > 0) {
      const speedFactor = remaining / timerSeconds;
      speedBonus = Math.floor(speedFactor * diffMultiplier * 100);
    }
    return {
      total: baseScore + speedBonus,
      base: baseScore,
      speedBonus,
    };
  };

  const handleAnswer = async (choiceIndex) => {
    if (answeredRef.current || selectedAnswer !== null || !currentQ) return;
    answeredRef.current = true;
    stopTimer();

    const timeSpent = Math.max(0, timerSeconds - timeLeft);
    const correct = isAnswerCorrect(choiceIndex, currentQ);
    const scoreDetails = correct ? calculateScore(currentQ.difficulty, timeLeft) : { total: 0, base: 0, speedBonus: 0 };
    const earned = scoreDetails.total;

    setSelectedAnswer(choiceIndex);
    setIsCorrect(correct);
    setScoreBreakdown(scoreDetails);
    setPopupPoints(earned);
    setShowPopup(true);

    const newTotalScore = totalScore + earned;
    const newTotalCorrect = totalCorrectAnswers + (correct ? 1 : 0);
    const newQAnswered = totalQuestionsAnswered + 1;
    const newTotalTime = Math.round((totalTimeTaken + timeSpent) * 100) / 100;
    const calculatedRound = Math.min(totalRounds, Math.floor(newQAnswered / questionsPerRound) + 1);

    setTotalScore(newTotalScore);
    setTotalCorrectAnswers(newTotalCorrect);
    setTotalQuestionsAnswered(newQAnswered);
    setTotalTimeTaken(newTotalTime);
    setCurrentRound(calculatedRound);

    const activeRoundNum = Math.min(totalRounds, Math.floor(totalQuestionsAnswered / questionsPerRound) + 1);
    const updatedRoundStats = {
      correct: (roundHistory[activeRoundNum]?.correct || 0) + (correct ? 1 : 0),
      score: (roundHistory[activeRoundNum]?.score || 0) + earned,
    };
    setRoundHistory((prev) => ({
      ...prev,
      [activeRoundNum]: updatedRoundStats,
    }));

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
        correctAnswers: newTotalCorrect,
        pointsEarned: earned,
        totalScore: newTotalScore,
        totalQuestionsAnswered: newQAnswered,
        currentRound: calculatedRound,
      });
    } catch (e) {
      console.error("Failed to submit trivia answer:", e);
    }

    const isRoundEnd = newQAnswered % questionsPerRound === 0;
    const isGameEnd = newQAnswered >= totalPossibleQuestions;

    // Give the player time to read the correct answer before moving on
    setTimeout(() => {
      setShowPopup(false);
      if (isGameEnd) {
        setPhase("complete");
      } else if (isRoundEnd) {
        const completedR = Math.floor(newQAnswered / questionsPerRound);
        setRoundStats({
          completedRound: completedR,
          roundQuestions: questionsPerRound,
          roundCorrect: updatedRoundStats.correct,
          roundScore: updatedRoundStats.score,
        });
        setPhase("round_complete");
      } else {
       setCurrentQ(gameQuestions[newQAnswered]); // ← load next question AFTER delay
        setSelectedAnswer(null);
        setIsCorrect(null);
        answeredRef.current = false;
        startTimer();
      }
    }, 1500);
  };

  const handleTimeout = () => {
    handleAnswer(-1); // -1 = timeout / no choice selected
  };

  const handleContinueNextRound = () => {
    if (allowPlayerCategoryChoice) {
      setPlayerCategory(null);
      setPhase("category_pick");
    } else {
      setSelectedAnswer(null);
      setIsCorrect(null);
      answeredRef.current = false;
      setPhase("question");
      startTimer();
    }
  };

  // Handler when player selects a category
  const handleCategoryPick = (catName) => {
    setPlayerCategory(catName);
    setSelectedAnswer(null);
    setIsCorrect(null);
    answeredRef.current = false;
    setPhase("question");
    startTimer();
  };

  // Derived: list of available categories for the player to pick from
  const availableCategories = Object.keys(questionsData).map((catName) => {
    const catObj = questionsData[catName];
    const qs = catObj.questions || catObj;
    return {
      name: catName,
      icon: catObj.icon || "❓",
      count: Array.isArray(qs) ? qs.length : 0,
    };
  }).filter((c) => c.count > 0);

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
        {playerCategory && (
          <div className="trivia-cat-pill">
            {questionsData[playerCategory]?.icon || "❓"} {playerCategory}
          </div>
        )}
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

      {/* ── Phase: Category Pick ────────────────── */}
      {phase === "category_pick" && (
        <div className="trivia-category-pick-phase">
          <div className="trivia-cat-pick-header">
            <div className="trivia-cat-pick-icon">🎯</div>
            <h2 className="trivia-cat-pick-title">Choose Your Category</h2>
            <p className="trivia-cat-pick-sub">
              Pick the topic you want to answer questions about!
            </p>
          </div>
          <div className="trivia-cat-pick-grid">
            {availableCategories.map((cat) => (
              <button
                key={cat.name}
                className="trivia-cat-pick-card"
                onClick={() => handleCategoryPick(cat.name)}
              >
                <span className="trivia-cat-pick-card-icon">{cat.icon}</span>
                <span className="trivia-cat-pick-card-name">{cat.name}</span>
                <span className="trivia-cat-pick-card-count">
                  {cat.count} question{cat.count !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                if (isAnswerCorrect(idx, currentQ)) {
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

      {/* ── Phase: Round Complete ─────────── */}
      {phase === "round_complete" && (
        <div className="trivia-round-complete-phase">
          <div className="trivia-round-card">
            <div style={{ fontSize: "3rem" }}>🎉</div>
            <h2 className="trivia-round-title">Round {roundStats.completedRound} Complete!</h2>
            {roundCategories[roundStats.completedRound - 1] && (
              <div className="trivia-round-cat-tag">
                Category: {roundCategories[roundStats.completedRound - 1]}
              </div>
            )}

            <div className="trivia-round-stats-grid">
              <div className="trivia-round-stat-card">
                <span className="trivia-round-stat-val">
                  {roundStats.roundCorrect} / {roundStats.roundQuestions}
                </span>
                <span className="trivia-round-stat-lbl">Round Accuracy</span>
              </div>
              <div className="trivia-round-stat-card">
                <span className="trivia-round-stat-val">+{roundStats.roundScore}</span>
                <span className="trivia-round-stat-lbl">Round Points</span>
              </div>
              <div className="trivia-round-stat-card">
                <span className="trivia-round-stat-val">{totalScore}</span>
                <span className="trivia-round-stat-lbl">Total Score</span>
              </div>
            </div>

            <button
              className="trivia-continue-btn"
              onClick={handleContinueNextRound}
            >
              ▶ Continue to Round {roundStats.completedRound + 1}
            </button>
          </div>

          {/* Leaderboard standings between rounds */}
          <div className="trivia-leaderboard" style={{ marginTop: "1.5rem" }}>
            <div className="trivia-lb-title">
              📊 Live Leaderboard Standings
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
              {isCorrect ? "Correct!" : selectedAnswer === -1 ? "Time's Up!" : "Wrong!"}
            </div>
            <div className={`trivia-popup-points ${popupPoints === 0 ? "zero" : ""}`}>
              +{popupPoints} pts
            </div>
            {!isCorrect && currentQ && (
              <div className="trivia-popup-correct-answer">
                <span className="trivia-popup-correct-label">✔ Correct Answer:</span>
                <span className="trivia-popup-correct-text">
                  {(() => {
                    const ans = currentQ.answer;
                    if (typeof ans === "number" && currentQ.choices?.[ans] !== undefined)
                      return currentQ.choices[ans];
                    if (typeof ans === "string" && !isNaN(parseInt(ans, 10)) && currentQ.choices?.[parseInt(ans, 10)] !== undefined)
                      return currentQ.choices[parseInt(ans, 10)];
                    if (typeof ans === "string" && ans.trim().length === 1) {
                      const letterIdx = ans.trim().toUpperCase().charCodeAt(0) - 65;
                      if (currentQ.choices?.[letterIdx] !== undefined) return currentQ.choices[letterIdx];
                    }
                    return String(ans);
                  })()}
                </span>
              </div>
            )}
            {isCorrect && timerEnabled && (
              <div className="trivia-popup-breakdown">
                <span className="trivia-base-pts">Base: +{scoreBreakdown.base}</span>
                {scoreBreakdown.speedBonus > 0 && (
                  <span className="trivia-speed-pts">⚡ Speed: +{scoreBreakdown.speedBonus}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TriviaChallengeGame;
