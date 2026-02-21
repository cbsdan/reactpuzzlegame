import { useState } from 'react';
import { useGame } from '../context/GameContext';
import './Home.css';

const Home = () => {
  const { createRoom, joinRoom, loading } = useGame();
  const [mode, setMode] = useState(null); // 'create', 'join', or null
  const [passkey, setPasskey] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    setError('');
    const result = await createRoom();
    
    if (!result.success) {
      setError(result.error || 'Failed to create room');
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!passkey.trim()) {
      setError('Please enter the room passkey');
      return;
    }
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    const result = await joinRoom(passkey, playerName);
    
    if (!result.success) {
      setError(result.error || 'Failed to join room');
    }
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <h1>🧩 Puzzle Game</h1>
          <p>Create a room to host or join an existing game</p>
        </div>

        {mode === null ? (
          <div className="mode-selection">
            <button 
              className="mode-btn create-btn"
              onClick={() => setMode('create')}
              disabled={loading}
            >
              <span className="mode-icon">🎮</span>
              <span className="mode-text">Create Room</span>
              <span className="mode-desc">Start a new game as Admin</span>
            </button>

            <button 
              className="mode-btn join-btn"
              onClick={() => setMode('join')}
              disabled={loading}
            >
              <span className="mode-icon">👥</span>
              <span className="mode-text">Join Room</span>
              <span className="mode-desc">Join an existing game</span>
            </button>
          </div>
        ) : mode === 'create' ? (
          <div className="mode-container">
            <div className="mode-card">
              <h2>Create a New Room</h2>
              <p className="info-text">You will become the admin of this room</p>
              
              <button 
                className="confirm-btn"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
              
              {error && <div className="error-message">{error}</div>}
              
              <button 
                className="back-btn"
                onClick={() => { setMode(null); setError(''); }}
                disabled={loading}
              >
                ← Back
              </button>
            </div>
          </div>
        ) : (
          <div className="mode-container">
            <div className="mode-card">
              <h2>Join a Room</h2>
              <form onSubmit={handleJoinRoom}>
                <div className="form-group">
                  <label htmlFor="passkey">Room Passkey</label>
                  <input
                    id="passkey"
                    type="text"
                    placeholder="Enter room passkey"
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    className="form-input"
                    maxLength={20}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="name">Your Name</label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="form-input"
                    maxLength={30}
                    disabled={loading}
                  />
                </div>

                <button 
                  type="submit"
                  className="confirm-btn"
                  disabled={loading}
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </button>
              </form>
              
              {error && <div className="error-message">{error}</div>}
              
              <button 
                className="back-btn"
                onClick={() => { setMode(null); setError(''); setPasskey(''); setPlayerName(''); }}
                disabled={loading}
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
