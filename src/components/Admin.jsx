import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { GAMES, getGame } from '../games/index';
import './Admin.css';

const Admin = () => {
  const { gameState, players, adminAction, removePlayer, currentRoom, exitGame } = useGame();
  const [selectedGame, setSelectedGame] = useState('number-mystery');
  const [dashboardFullscreen, setDashboardFullscreen] = useState(false);
  const prevStatusRef = useRef(gameState?.status);

  // Auto-fullscreen dashboard when a new game starts; collapse when idle
  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = gameState?.status;
    if (prev === 'idle' && next === 'playing') {
      setDashboardFullscreen(true);
    } else if (next === 'idle') {
      setDashboardFullscreen(false);
    }
    prevStatusRef.current = next;
  }, [gameState?.status]);

  const handleAction = async (action) => {
    if (action === 'start' && !selectedGame) {
      alert('Please select a game first.');
      return;
    }
    await adminAction(action, action === 'start' ? selectedGame : undefined);
  };

  const handleRemovePlayer = async (playerId) => {
    const confirmed = window.confirm('Are you sure you want to remove this player?');
    if (confirmed) {
      await removePlayer(playerId);
    }
  };

  const handleExitRoom = async () => {
    const confirmed = window.confirm('Are you sure? This will close the room for all players.');
    if (confirmed) {
      await exitGame();
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      idle: { text: 'Idle', color: '#2196f3' },
      playing: { text: 'Playing', color: '#4caf50' },
      paused: { text: 'Paused', color: '#ff9800' }
    };
    
    const badge = badges[status] || badges.idle;
    
    return (
      <span 
        className="status-badge" 
        style={{ backgroundColor: badge.color }}
      >
        {badge.text}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString();
  };

  // Sum a player's scores across all saved sessions
  const getTotalScore = (playerId) => {
    const sessions = gameState?.sessions || [];
    const history = sessions.reduce((sum, s) => {
      const entry = s.scores?.find(sc => sc.playerId === playerId);
      return sum + (entry?.score || 0);
    }, 0);
    return history;
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="header-content">
          <h1>🎮 Game Admin</h1>
          <div className="header-bottom">
            <div className="passkey-display">
              <span className="passkey-label">Room Code:</span>
              <span className="passkey-value">{currentRoom?.passkey}</span>
            </div>
            {gameState && getStatusBadge(gameState.status)}
          </div>
        </div>
        <div className="status-info">
          <button 
            className="exit-btn admin-exit"
            onClick={handleExitRoom}
            title="Exit & Close Room for All Players"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Controls + Statistics — side by side on desktop */}
      <div className="controls-stats-row">
      <div className="admin-controls">
        <h2>Game Controls</h2>

        {/* Game selector – only shown while idle */}
        {gameState?.status === 'idle' && (
          <div className="game-selector">
            <h3>Choose a Game</h3>
            <div className="game-cards">
              {GAMES.map(game => (
                <div
                  key={game.id}
                  className={`game-card ${selectedGame === game.id ? 'selected' : ''}`}
                  onClick={() => setSelectedGame(game.id)}
                >
                  <div className="game-card-icon">{game.icon}</div>
                  <div className="game-card-info">
                    <div className="game-card-name">{game.name}</div>
                    <div className="game-card-desc">{game.description}</div>
                  </div>
                  {selectedGame === game.id && <div className="game-card-check">✓</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState?.status !== 'idle' && gameState?.gameType && (
          <div className="active-game-label">
            {getGame(gameState.gameType)?.icon} Active Game:{' '}
            <strong>{getGame(gameState.gameType)?.name || gameState.gameType}</strong>
          </div>
        )}

        <div className="control-buttons">
          <button 
            className="control-btn start-btn"
            onClick={() => handleAction('start')}
            disabled={gameState?.status !== 'idle'}
          >
            ▶️ Start
          </button>
          <button 
            className="control-btn pause-btn"
            onClick={() => handleAction('pause')}
            disabled={gameState?.status !== 'playing'}
          >
            ⏸️ Pause
          </button>
          <button 
            className="control-btn resume-btn"
            onClick={() => handleAction('resume')}
            disabled={gameState?.status !== 'paused'}
          >
            ▶️ Resume
          </button>
          <button 
            className="control-btn restart-btn"
            onClick={() => handleAction('restart')}
            disabled={gameState?.status === 'idle'}
          >
            🔄 Restart
          </button>
          <button 
            className="control-btn stop-btn"
            onClick={() => handleAction('stop')}
            disabled={gameState?.status === 'idle'}
          >
            ⏹️ Stop
          </button>
        </div>

        {gameState && (
          <div className="game-info">
            <div className="info-item">
              <span className="info-label">Started:</span>
              <span className="info-value">{formatDate(gameState.startedAt)}</span>
            </div>
            {gameState.sessionNumber && (
              <div className="info-item">
                <span className="info-label">Session:</span>
                <span className="info-value">#{gameState.sessionNumber}</span>
              </div>
            )}
            {gameState.pausedAt && (
              <div className="info-item">
                <span className="info-label">Paused:</span>
                <span className="info-value">{formatDate(gameState.pausedAt)}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">Updated:</span>
              <span className="info-value">{formatDate(gameState.updatedAt)}</span>
            </div>
          </div>
        )}
      </div>

        {/* Statistics */}
        <div className="stats-section">
          <h2>Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{players.length}</div>
              <div className="stat-label">Total Players</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {players.filter(p => p.isActive).length}
              </div>
              <div className="stat-label">Active Players</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {Math.max(...players.map(p => p.score || 0), 0)}
              </div>
              <div className="stat-label">Highest Score</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {players.length > 0
                  ? Math.round(players.reduce((sum, p) => sum + (p.score || 0), 0) / players.length)
                  : 0}
              </div>
              <div className="stat-label">Avg Score</div>
            </div>
          </div>
        </div>
      </div>{/* end controls-stats-row */}

      {/* Live game dashboard */}
      {gameState?.status !== 'idle' && gameState?.gameType && (() => {
        const game = getGame(gameState.gameType);
        if (!game?.AdminDashboard) return null;
        const Dashboard = game.AdminDashboard;
        return (
          <div className={`game-dashboard-section${dashboardFullscreen ? ' game-dashboard-fullscreen' : ''}`}>
            <div className="dashboard-header">
              <h2>🎮 Live Dashboard</h2>
              <button
                className="dashboard-toggle-btn"
                onClick={() => setDashboardFullscreen(f => !f)}
              >
                {dashboardFullscreen ? '⊡ Minimize' : '⛶ Fullscreen'}
              </button>
            </div>
            <Dashboard />

            {/* Floating controls — only visible in fullscreen */}
            {dashboardFullscreen && (
              <div className="dashboard-floating-controls">
                <button
                  className="float-btn start-btn"
                  onClick={() => handleAction('start')}
                  disabled={gameState?.status !== 'idle'}
                  title="Start"
                >
                  ▶ Start
                </button>
                <button
                  className="float-btn pause-btn"
                  onClick={() => handleAction('pause')}
                  disabled={gameState?.status !== 'playing'}
                  title="Pause"
                >
                  ⏸ Pause
                </button>
                <button
                  className="float-btn resume-btn"
                  onClick={() => handleAction('resume')}
                  disabled={gameState?.status !== 'paused'}
                  title="Resume"
                >
                  ▶ Resume
                </button>
                <button
                  className="float-btn restart-btn"
                  onClick={() => handleAction('restart')}
                  disabled={gameState?.status === 'idle'}
                  title="Restart"
                >
                  🔄 Restart
                </button>
                <button
                  className="float-btn stop-btn"
                  onClick={() => handleAction('stop')}
                  disabled={gameState?.status === 'idle'}
                  title="Stop"
                >
                  ⏹ Stop
                </button>
                <div className="float-divider" />
                <button
                  className="float-btn float-minimize-btn"
                  onClick={() => setDashboardFullscreen(false)}
                  title="Minimize dashboard"
                >
                  ⊡ Exit
                </button>
              </div>
            )}
          </div>
        );
      })()}

      <div className="players-section">
        <h2>Players ({players.length})</h2>
        <div className="players-table-container">
          {players.length === 0 ? (
            <div className="no-players">
              <p>No players have joined yet</p>
            </div>
          ) : (
            <table className="players-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>This Session</th>
                  <th>Total (All Sessions)</th>
                  <th>Joined At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={player._id}>
                    <td>{index + 1}</td>
                    <td className="player-name-cell">
                      <span className="player-icon">👤</span>
                      {player.name}
                    </td>
                    <td className="score-cell">{player.score || 0}</td>
                    <td className="score-cell total-score-cell">
                      {getTotalScore(player._id) + (player.score || 0)}
                    </td>
                    <td>{new Date(player.joinedAt).toLocaleString()}</td>
                    <td>
                      <span className="active-badge">
                        {player.isActive ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="remove-btn"
                        onClick={() => handleRemovePlayer(player._id)}
                        title="Remove Player"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Session History */}
      {gameState?.sessions?.length > 0 && (
        <div className="sessions-section">
          <h2>Session History ({gameState.sessions.length})</h2>
          <div className="sessions-list">
            {[...gameState.sessions].reverse().map((session) => (
              <div key={session.sessionNumber} className="session-card">
                <div className="session-card-header">
                  <span className="session-num">Session #{session.sessionNumber}</span>
                  <span className="session-date">
                    {session.endedAt ? new Date(session.endedAt).toLocaleString() : ''}
                  </span>
                  {session.winner?.score > 0 && (
                    <span className="session-winner">
                      🏆 {session.winner.name} — {session.winner.score} pts
                    </span>
                  )}
                </div>
                <div className="session-scores">
                  {[...(session.scores || [])]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((s, i) => (
                      <div key={s.playerId} className={`session-score-row ${i === 0 && s.score > 0 ? 'session-top' : ''}`}>
                        <span className="session-rank">{i === 0 && s.score > 0 ? '🦹' : `${i + 1}.`}</span>
                        <span className="session-player-name">{s.name}</span>
                        <span className="session-player-score">{s.score || 0} pts</span>
                        {s.solved && <span className="session-solved-badge">✅ {s.guessCount} guess{s.guessCount !== 1 ? 'es' : ''}</span>}
                        {!s.solved && <span className="session-unsolved-badge">❌ Not solved</span>}
                      </div>
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
