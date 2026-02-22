import { useGame } from '../../context/GameContext';
import './AdminDashboard.css';

const NumberMysteryAdminDashboard = () => {
  const { players, gameState } = useGame();

  const targetNumber = gameState?.targetNumber;

  // Accessor: prefer namespaced sub-doc, fall back to flat root fields for old data
  const nm = (player) => player.numberMystery ?? player;

  // Sort: solved first (by score desc), then unsolved (by guessCount asc)
  const sorted = [...players].sort((a, b) => {
    const aSolved = a.numberMystery?.solved ?? a.solved;
    const bSolved = b.numberMystery?.solved ?? b.solved;
    if (aSolved && !bSolved) return -1;
    if (!aSolved && bSolved) return 1;
    if (aSolved && bSolved) return (nm(b).score || 0) - (nm(a).score || 0);
    return (nm(a).guessCount || 0) - (nm(b).guessCount || 0);
  });

  const solvedCount = players.filter((p) => p.numberMystery?.solved ?? p.solved).length;
  const clues = gameState?.clues || [];

  const formatTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString();
  };

  return (
    <div className="nm-admin-dashboard">
      <div className="nm-dashboard-header">
        <div className="nm-dashboard-title">
          <span className="nm-dashboard-icon">🔍</span>
          <div>
            <h3>Number Mystery — Live Dashboard</h3>
            <p>Watching {players.length} player{players.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="nm-dashboard-pills">
          {targetNumber && (
            <div className="nm-answer-pill">
              <span className="nm-pill-label">🔑 Answer</span>
              <span className="nm-pill-val nm-answer-val">
                {targetNumber}
              </span>
            </div>
          )}
          <div className="nm-pill solved-pill">
            <span className="nm-pill-val">{solvedCount}</span>
            <span className="nm-pill-label">Solved</span>
          </div>
          <div className="nm-pill playing-pill">
            <span className="nm-pill-val">{players.length - solvedCount}</span>
            <span className="nm-pill-label">Still Playing</span>
          </div>
        </div>
      </div>

      {/* Active clues */}
      {clues.length > 0 && (
        <div className="nm-clues-panel">
          <h4>📌 Active Clues</h4>
          <div className="nm-clues-list">
            {clues.map((clue, i) => (
              <div key={i} className="nm-clue-item">
                <span className="nm-clue-num">Clue {i + 1}</span>
                <span className="nm-clue-text">{clue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="nm-leaderboard">
        {sorted.length === 0 ? (
          <div className="nm-empty">No players have joined yet</div>
        ) : (
          <>
            <div className="nm-lb-header">
              <span>#</span>
              <span>Player</span>
              <span>Guesses</span>
              <span>Status</span>
              <span>Solved At</span>
              <span>Score</span>
            </div>
            {sorted.map((player, i) => (
              <div
                key={player._id}
                className={`nm-lb-row ${nm(player).solved ? 'nm-row-solved' : 'nm-row-playing'}`}
              >
                <span className="nm-lb-rank">
                  {i === 0 && nm(player).solved ? '🥇' : i === 1 && nm(player).solved ? '🥈' : i === 2 && nm(player).solved ? '🥉' : `#${i + 1}`}
                </span>
                <span className="nm-lb-name">{player.name}</span>
                <span className="nm-lb-guesses">
                  {nm(player).guessCount != null ? nm(player).guessCount : '—'}
                </span>
                <span className="nm-lb-status">
                  {nm(player).solved ? '✅ Solved' : '🔄 Playing'}
                </span>
                <span className="nm-lb-time">{formatTime(nm(player).solvedAt)}</span>
                <span className="nm-lb-score">{nm(player).score || 0}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default NumberMysteryAdminDashboard;
