import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import './Home.css';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Parses a room ID from a raw string, which can be:
 * - A full URL: https://site.com/?room=67c823... or http://localhost:5173/?room=67c823...
 * - A query string snippet: ?room=67c823... or &room=67c823...
 * - A 24-character hex MongoDB ObjectId
 * - A 6-character room passkey
 */
function parseRoomFromInput(input) {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]room=([a-f0-9]+)/i);
  if (match) return match[1];
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const roomParam = url.searchParams.get('room');
    if (roomParam) return roomParam;
  } catch {}
  return trimmed;
}

const Home = () => {
  const { createRoom, joinRoom, joinRoomById, linkRoomId, loading } = useGame();

  // 'create' | 'join' | 'join-by-link' | null
  const [mode, setMode] = useState(linkRoomId ? 'join-by-link' : null);
  const [passkey, setPasskey] = useState('');
  const [roomInput, setRoomInput] = useState(() => linkRoomId || '');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');

  const [linkRoomStatus, setLinkRoomStatus] = useState(null); // 'valid' | 'invalid' | null
  const [linkRoomInfo, setLinkRoomInfo] = useState(null);
  const [showEditRoomId, setShowEditRoomId] = useState(false);

  // Sync if linkRoomId is detected
  useEffect(() => {
    if (linkRoomId) {
      setRoomInput(linkRoomId);
      setMode('join-by-link');
    }
  }, [linkRoomId]);

  // Validate room link whenever roomInput changes (non-blocking)
  useEffect(() => {
    const targetId = parseRoomFromInput(roomInput || linkRoomId || '');
    if (!targetId || targetId.length !== 24) {
      setLinkRoomStatus(null);
      setLinkRoomInfo(null);
      return;
    }
    let isCurrent = true;
    fetch(`${API_URL}/api/rooms/${targetId}/info`)
      .then((r) => r.json())
      .then((data) => {
        if (!isCurrent) return;
        if (data.success && data.room) {
          setLinkRoomInfo(data.room);
          setLinkRoomStatus('valid');
        } else {
          setLinkRoomStatus('invalid');
        }
      })
      .catch(() => {
        if (isCurrent) setLinkRoomStatus(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [roomInput, linkRoomId]);

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

    const result = await joinRoom(passkey.trim(), playerName.trim());
    if (!result.success) {
      setError(result.error || 'Failed to join room');
    }
  };

  const handleJoinByLink = async (e) => {
    e.preventDefault();
    setError('');

    const rawTarget = (roomInput || linkRoomId || '').trim();
    const parsedId = parseRoomFromInput(rawTarget);

    if (!parsedId) {
      setError('Please enter or paste the room share link or room code.');
      return;
    }

    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    // If the input was a 6-character room passkey rather than a MongoDB ID
    if (parsedId.length === 6 && !parsedId.includes('/')) {
      const result = await joinRoom(parsedId, playerName.trim());
      if (!result.success) {
        setError(result.error || 'Failed to join room');
      }
      return;
    }

    // Link-based join (by room ID)
    const result = await joinRoomById(parsedId, playerName.trim());
    if (!result.success) {
      setError(result.error || 'Failed to join room');
    }
  };

  const activeRoomId = parseRoomFromInput(roomInput || linkRoomId || '');

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <h1><img className="h1-logo" src="/favicon.png" alt="" width="70" height="70" /> Game Lobby</h1>
          <p>Create a room to host or join an existing game</p>
        </div>

        {mode === null ? (
          <div className="mode-selection">
            <button
              className="mode-btn create-btn"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              <span className="mode-icon">🎮</span>
              <span className="mode-text">
                {loading ? 'Creating...' : 'Create Room'}
              </span>
              <span className="mode-desc">Start a new game as Admin</span>
            </button>

            <button
              className="mode-btn join-btn"
              onClick={() => setMode('join')}
              disabled={loading}
            >
              <span className="mode-icon">🔑</span>
              <span className="mode-text">Join with Passkey</span>
              <span className="mode-desc">Enter a 6-character room code</span>
            </button>

            <button
              className="mode-btn link-btn"
              onClick={() => setMode('join-by-link')}
              disabled={loading}
            >
              <span className="mode-icon">🔗</span>
              <span className="mode-text">Join with Link</span>
              <span className="mode-desc">Join directly using a share link or room ID</span>
            </button>
          </div>

        ) : mode === 'join' ? (
          <div className="mode-container">
            <div className="mode-card">
              <h2>🔑 Join a Room</h2>
              <p className="info-text">Enter the passkey shared by your admin</p>
              <form onSubmit={handleJoinRoom}>
                <div className="form-group">
                  <label htmlFor="passkey">Room Passkey</label>
                  <input
                    id="passkey"
                    type="text"
                    placeholder="Enter room passkey (e.g. A1B2C3)"
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    className="form-input"
                    maxLength={20}
                    disabled={loading}
                    autoFocus
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

        ) : mode === 'join-by-link' ? (
          <div className="mode-container">
            <div className="mode-card link-join-card">
              <h2>🔗 Join via Link</h2>
              <p className="info-text">
                {activeRoomId
                  ? 'No passkey needed — just enter your name to jump right in!'
                  : 'Paste the room share link or room ID, then enter your name.'}
              </p>

              {linkRoomInfo && (
                <div className="link-room-badge">
                  <span className="link-room-status-dot" />
                  <span>
                    Room Status: <strong>{linkRoomInfo.status === 'playing' ? '🟢 Active Game' : '🔵 Waiting in Lobby'}</strong>
                  </span>
                </div>
              )}

              {linkRoomStatus === 'invalid' && (
                <div className="link-invalid-notice">
                  <span className="link-invalid-icon">⚠️</span>
                  <p>Room ID not found or expired. Check the link or ask the host for a new one.</p>
                </div>
              )}

              <form onSubmit={handleJoinByLink}>
                {/* Room Link Input: Shown if not pre-filled, or if user clicks to change it */}
                {(!activeRoomId || showEditRoomId) ? (
                  <div className="form-group">
                    <label htmlFor="room-link">Room Link or Code</label>
                    <input
                      id="room-link"
                      type="text"
                      placeholder="Paste link (e.g. http://.../?room=...) or room ID"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      className="form-input"
                      disabled={loading}
                      autoFocus={!playerName}
                    />
                  </div>
                ) : (
                  <div className="link-room-preview">
                    <span className="link-preview-label">Room:</span>
                    <span className="link-preview-val">{activeRoomId.slice(-8)}…</span>
                    <button
                      type="button"
                      className="link-change-btn"
                      onClick={() => setShowEditRoomId(true)}
                    >
                      Change
                    </button>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="link-name">Your Name</label>
                  <input
                    id="link-name"
                    type="text"
                    placeholder="Enter your name to join"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="form-input"
                    maxLength={30}
                    disabled={loading}
                    autoFocus={!!activeRoomId}
                  />
                </div>

                <button
                  type="submit"
                  className="confirm-btn"
                  disabled={loading}
                >
                  {loading ? 'Joining...' : '🚀 Join Game'}
                </button>
              </form>

              {error && <div className="error-message">{error}</div>}

              <button
                className="back-btn"
                onClick={() => { setMode(null); setError(''); setPlayerName(''); }}
                disabled={loading}
              >
                ← Back
              </button>
            </div>
          </div>

        ) : null}
      </div>
    </div>
  );
};

export default Home;
