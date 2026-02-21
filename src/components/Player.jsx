import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { getGame } from '../games/index';
import './Player.css';

const Player = () => {
  const { gameState, players, addPlayer, currentPlayer, currentRoom, exitGame, removedNotification, clearRemovedNotification } = useGame();

  // Game is 'active' (mounted) while playing or paused — unmounts only on stop/idle
  const activeGame = (gameState?.status === 'playing' || gameState?.status === 'paused')
    ? getGame(gameState?.gameType)
    : null;

  // Lock body scroll when fullscreen game is active
  const isGameActive = !!activeGame;
  useEffect(() => {
    if (isGameActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isGameActive]);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const handleJoinGame = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    const result = await addPlayer(playerName);
    
    if (result.success) {
      setPlayerName('');
    } else {
      setError(result.error || 'Failed to join game');
    }
  };

  const handleExitGame = async () => {
    const result = await exitGame();
    if (!result.success) {
      setError(result.error || 'Failed to exit game');
    }
  };

  const getGameStatusText = () => {
    if (!gameState) return 'Loading...';
    
    switch (gameState.status) {
      case 'playing':
        return '🎮 Game is Running!';
      case 'paused':
        return '⏸️ Game Paused';
      case 'idle':
        return '⏳ Waiting to Start';
      default:
        return 'Unknown Status';
    }
  };

  const getGameStatusColor = () => {
    if (!gameState) return '#888';
    
    switch (gameState.status) {
      case 'playing':
        return '#4caf50';
      case 'paused':
        return '#ff9800';
      case 'idle':
        return '#2196f3';
      default:
        return '#888';
    }
  };

  return (
    <div className="player-container">
      {removedNotification && (
        <div className="kicked-overlay">
          <div className="kicked-modal">
            <button className="kicked-close" onClick={clearRemovedNotification} title="Close">✕</button>
            <div className="kicked-icon">🚫</div>
            <h2>You've Been Kicked</h2>
            <p>The host has removed you from the game.</p>
            <div className="kicked-redirect">Returning to home...</div>
          </div>
        </div>
      )}
      <div className="player-header">
        <div className="header-left">
          <span className="header-logo">🧩</span>
          <span className="header-title">Puzzle Game</span>
        </div>
        <div className="header-center">
          {currentRoom && (
            <span className="header-room-code">Room: <strong>{currentRoom.passkey}</strong></span>
          )}
          <div
            className="game-status"
            style={{ '--status-color': getGameStatusColor() }}
          >
            {getGameStatusText()}
          </div>
        </div>
        <div className="header-right">
          {currentPlayer && (
            <button className="exit-btn" onClick={handleExitGame} title="Exit Game">
              ✕
            </button>
          )}
        </div>
      </div>

      {!currentPlayer ? (
        <div className="join-section">
          <h2>Enter Your Name</h2>
          <p className="join-info">Room Code: <strong>{currentRoom?.passkey}</strong></p>
          <form onSubmit={handleJoinGame}>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="player-input"
              maxLength={30}
            />
            <button type="submit" className="join-button">
              Join Game
            </button>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
      ) : (
        <div className="game-section">
          <div className="welcome-message">
            <h2>Welcome, {currentPlayer.name}! 👋</h2>
            <p>Session score: <strong>{currentPlayer.score || 0}</strong>
            {gameState?.sessions?.length > 0 && (() => {
              const historyTotal = (gameState.sessions).reduce((sum, s) => {
                const entry = s.scores?.find(sc => sc.playerId === currentPlayer._id);
                return sum + (entry?.score || 0);
              }, 0);
              return historyTotal > 0
                ? <span className="welcome-total"> &nbsp;·&nbsp; Total: <strong>{historyTotal + (currentPlayer.score || 0)}</strong></span>
                : null;
            })()}
            </p>
          </div>

          {/* Active game area — fullscreen overlay, stays mounted while playing or paused */}
          {activeGame && (() => {
            const GameComponent = activeGame.PlayerComponent;
            return (
              <div className="game-fullscreen-overlay">
                <div className="game-fullscreen-topbar">
                  <span className="game-fullscreen-title">
                    {activeGame.icon} {activeGame.name}
                    {gameState?.status === 'paused' && (
                      <span className="game-topbar-paused"> ⏸️ Paused</span>
                    )}
                  </span>
                  <button className="game-fullscreen-exit" onClick={handleExitGame} title="Exit Game">
                    ✕ Exit
                  </button>
                </div>
                <div className="game-fullscreen-content">
                  <GameComponent />
                </div>
              </div>
            );
          })()}

          {gameState?.status !== 'playing' && gameState?.status !== 'paused' && (
            <div className="game-placeholder">
              <div className="placeholder-content">
                <h3>⏳ Waiting for Host</h3>
                <p>The host will start the game soon. Get ready!</p>
                <div className="waiting-animation">
                  <span>•</span><span>•</span><span>•</span>
                </div>
              </div>
            </div>
          )}

          <div className="players-list">
            <h3>Players in Room ({players.length})</h3>
            <div className="players-grid">
              {players.map((player) => (
                <div key={player._id} className={`player-card ${player._id === currentPlayer._id ? 'me' : ''}`}>
                  <span className="player-icon">{player._id === currentPlayer._id ? '🙋' : '👤'}</span>
                  <span className="player-name">{player.name}{player._id === currentPlayer._id ? ' (You)' : ''}</span>
                  <span className="player-score">{player.score || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;
