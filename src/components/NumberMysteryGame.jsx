import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import './NumberMysteryGame.css';

const NumberMysteryGame = () => {
  const { submitGuess, currentPlayer, gameState } = useGame();

  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [error, setError] = useState('');
  const [solved, setSolved] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showClue, setShowClue] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const pauseStartRef = useRef(null);
  const prevStartedAtRef = useRef(gameState?.startedAt);
  const inputRef = useRef(null);

  const clues = gameState?.clues || [];
  const isPaused = gameState?.status === 'paused';

  // Focus the hidden input
  const focusInput = () => inputRef.current?.focus();

  // Detect restart: startedAt changed → reset all local state
  useEffect(() => {
    const newStartedAt = gameState?.startedAt;
    if (newStartedAt && newStartedAt !== prevStartedAtRef.current) {
      setInput('');
      setGuesses([]);
      setError('');
      setSolved(false);
      setFinalScore(0);
      setElapsed(0);
      setShowClue(null);
      startTimeRef.current = Date.now();
      pauseStartRef.current = null;
      prevStartedAtRef.current = newStartedAt;
    }
  }, [gameState?.startedAt]);

  // Pause / resume: keep elapsed time continuous across pauses
  useEffect(() => {
    if (isPaused) {
      // Record when we paused
      if (!pauseStartRef.current) pauseStartRef.current = Date.now();
    } else if (pauseStartRef.current) {
      // Shift the start anchor forward by the paused duration
      startTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
  }, [isPaused]);

  // Timer: only tick while actively playing
  useEffect(() => {
    clearInterval(timerRef.current);
    if (solved || isPaused || gameState?.status !== 'playing') return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [solved, isPaused, gameState?.status]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const liveScore = Math.max(0, 1000 - guesses.length * 50 - elapsed * 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(input)) {
      setError('Enter exactly 4 digits (0–9)');
      return;
    }
    if (guesses.some(g => g.guess === input)) {
      setError('You already tried that number!');
      return;
    }
    if (isPaused) {
      setError('Game is paused — wait for the host to resume.');
      return;
    }

    const result = await submitGuess(input, guesses.length + 1);

    if (!result.success) {
      setError(result.error || 'Failed to submit');
      return;
    }

    const newEntry = {
      guess: input,
      bulls: result.bulls,
      cows: result.cows,
      digitResults: result.digitResults || [],
      isCorrect: result.isCorrect,
    };

    setGuesses(prev => [newEntry, ...prev]);
    setInput('');

    if (result.isCorrect) {
      setSolved(true);
      setFinalScore(result.score);
    }
  };

  return (
    <div className="mystery-container">
      {/* Paused overlay */}
      {isPaused && (
        <div className="mystery-paused-overlay">
          <div className="mystery-paused-card">
            <div className="mystery-paused-icon">⏸️</div>
            <h3>Game Paused</h3>
            <p>Waiting for the host to resume…</p>
            {guesses.length > 0 && (
              <p className="mystery-paused-progress">
                {guesses.length} guess{guesses.length !== 1 ? 'es' : ''} so far
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="mystery-header">
        <div className="mystery-title">
          <span className="mystery-icon">🔍</span>
          <div>
            <h2>Number Mystery</h2>
            <p>Crack the 4-digit code</p>
          </div>
        </div>
        <div className="mystery-stats">
          <div className="stat-pill">
            <span className="stat-label">⏱ Time</span>
            <span className="stat-val">{formatTime(elapsed)}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">🎲 Guesses</span>
            <span className="stat-val">{guesses.length}</span>
          </div>
          <div className="stat-pill score-pill">
            <span className="stat-label">⭐ Score</span>
            <span className="stat-val">{liveScore}</span>
          </div>
        </div>
      </div>

      <div className="mystery-body">
        {/* Clues */}
        <div className="clues-section">
          <h3>🕵️ Mystery Clues</h3>
          <p className="clues-hint">Use these clues to narrow down the 4-digit code:</p>
          <div className="clues-grid">
            {clues.map((clue, i) => (
              <button
                key={i}
                className={`clue-card ${showClue === i ? 'clue-revealed' : ''}`}
                onClick={() => setShowClue(showClue === i ? null : i)}
              >
                <div className="clue-number">Clue {i + 1}</div>
                {showClue === i ? (
                  <div className="clue-text">{clue}</div>
                ) : (
                  <div className="clue-hidden">Click to reveal 👁️</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Guess input */}
        {!solved && (
          <div className="guess-section">
            <h3>🔢 Enter Your Guess</h3>
            <form onSubmit={handleSubmit} className="guess-form" onClick={focusInput}>
              <div className="digit-input-wrapper" onClick={focusInput}>
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`digit-box ${input[i] ? 'filled' : ''}`}
                  >
                    {input[i] || '?'}
                  </div>
                ))}
              </div>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={input}
                onChange={e => setInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="guess-input-hidden"
                placeholder="0000"
                autoFocus
              />
              <button type="submit" className="guess-btn" disabled={input.length !== 4}>
                Submit Guess
              </button>
            </form>
            {error && <div className="guess-error">{error}</div>}
          </div>
        )}

        {/* Solved modal */}
        {solved && (
          <div className="solved-banner">
            <div className="solved-icon">🎉</div>
            <h2>Code Cracked!</h2>
            <p>You solved it in <strong>{guesses.length} guess{guesses.length !== 1 ? 'es' : ''}</strong> and <strong>{formatTime(elapsed)}</strong></p>
            <div className="final-score">Final Score: {finalScore}</div>
          </div>
        )}

        {/* Guess history — Wordle-style */}
        {guesses.length > 0 && (
          <div className="history-section">
            <h3>📋 Guess History</h3>

            {/* Legend — only visible after the first guess */}
            <div className="history-legend">
              <span className="history-legend-label">How to read your results:</span>
              <div className="history-legend-items">
                <span className="legend-item"><span className="legend-tile bull-tile">_</span> Right digit, right spot</span>
                <span className="legend-item"><span className="legend-tile cow-tile">_</span> Right digit, wrong spot</span>
                <span className="legend-item"><span className="legend-tile miss-tile">_</span> Not in the code</span>
              </div>
            </div>

            <div className="history-list">
              {guesses.map((g, i) => (
                <div key={i} className={`history-entry ${g.isCorrect ? 'history-entry-correct' : ''}`}>
                  <span className="history-num">{guesses.length - i}</span>
                  <div className="history-tiles">
                    {g.guess.split('').map((digit, di) => (
                      <div
                        key={di}
                        className={`history-tile ${
                          g.digitResults[di] === 'bull' ? 'bull-tile' :
                          g.digitResults[di] === 'cow'  ? 'cow-tile'  : 'miss-tile'
                        }`}
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                  <div className="history-summary">
                    {g.isCorrect ? (
                      <span className="summary-correct">✅ Correct!</span>
                    ) : (
                      <span className="summary-hints">
                        {g.bulls > 0 && <span className="hint-bull">{g.bulls}✓</span>}
                        {g.cows > 0  && <span className="hint-cow">{g.cows}~</span>}
                        {g.bulls === 0 && g.cows === 0 && <span className="hint-miss">No match</span>}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NumberMysteryGame;
