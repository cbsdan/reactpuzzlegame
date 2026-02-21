import { useState } from 'react';
import { useGame } from '../context/GameContext';
import './Player.css';

const Player = () => {
  const { gameState, players, addPlayer } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState(null);
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
      setCurrentPlayer(result.player);
      setPlayerName('');
    } else {
      setError(result.error || 'Failed to join game');
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
      <div className="player-header">
        <h1>🧩 Puzzle Game</h1>
        <div 
          className="game-status" 
          style={{ backgroundColor: getGameStatusColor() }}
        >
          {getGameStatusText()}
        </div>
      </div>

      {!currentPlayer ? (
        <div className="join-section">
          <h2>Join the Game</h2>
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
            <p>Your score: <strong>{currentPlayer.score || 0}</strong></p>
          </div>

          <div className="game-placeholder">
            <div className="placeholder-content">
              <h3>🎯 Game Area</h3>
              <p>Game implementation will go here</p>
              <div className="puzzle-preview">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <div key={num} className="puzzle-tile">
                    {num}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="players-list">
            <h3>Active Players ({players.length})</h3>
            <div className="players-grid">
              {players.map((player) => (
                <div key={player._id} className="player-card">
                  <span className="player-icon">👤</span>
                  <span className="player-name">{player.name}</span>
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
