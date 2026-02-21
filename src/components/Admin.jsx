import { useGame } from '../context/GameContext';
import './Admin.css';

const Admin = () => {
  const { gameState, players, adminAction } = useGame();

  const handleAction = async (action) => {
    await adminAction(action);
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

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🎮 Game Admin Panel</h1>
        <div className="status-info">
          {gameState && getStatusBadge(gameState.status)}
        </div>
      </div>

      <div className="admin-controls">
        <h2>Game Controls</h2>
        <div className="control-buttons">
          <button 
            className="control-btn start-btn"
            onClick={() => handleAction('start')}
            disabled={gameState?.status === 'playing'}
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
            className="control-btn restart-btn"
            onClick={() => handleAction('restart')}
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
            {gameState.pausedAt && (
              <div className="info-item">
                <span className="info-label">Paused:</span>
                <span className="info-value">{formatDate(gameState.pausedAt)}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">Last Updated:</span>
              <span className="info-value">{formatDate(gameState.updatedAt)}</span>
            </div>
          </div>
        )}
      </div>

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
                  <th>Score</th>
                  <th>Joined At</th>
                  <th>Status</th>
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
                    <td>{new Date(player.joinedAt).toLocaleString()}</td>
                    <td>
                      <span className="active-badge">
                        {player.isActive ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
                : 0
              }
            </div>
            <div className="stat-label">Avg Score</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
