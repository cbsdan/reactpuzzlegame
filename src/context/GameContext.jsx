import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider = ({ children }) => {
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [currentPlayersCount, setCurrentPlayersCount] = useState(-1);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'player'
  const [initialized, setInitialized] = useState(false);
  const [removedNotification, setRemovedNotification] = useState(false);
  const pollingRef = useRef(null);
  
  const API_URL = import.meta.env.VITE_API_URL || '';

  // Refs so the beforeunload handler always sees the latest player/room values
  const currentPlayerRef = useRef(null);
  const currentRoomRef = useRef(null);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

  // Auto-disconnect when the browser tab / window is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      const player = currentPlayerRef.current;
      const room = currentRoomRef.current;
      if (player && room) {
        // keepalive ensures the request is sent even as the page tears down
        fetch(`${API_URL}/api/rooms/${room._id}/players/${player._id}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => {});
        // Clear persisted session so they won't auto-rejoin on next open
        localStorage.removeItem('gameRoom');
        localStorage.removeItem('gamePlayer');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentVersion');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // empty deps — reads fresh values via refs

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedRoom = localStorage.getItem('gameRoom');
    const savedPlayer = localStorage.getItem('gamePlayer');
    const savedRole = localStorage.getItem('userRole');
    const savedVersion = localStorage.getItem('currentVersion');

    if (savedRoom && savedRole) {
      try {
        const room = JSON.parse(savedRoom);
        setCurrentRoom(room);
        setUserRole(savedRole);
        if (savedVersion) {
          setCurrentVersion(parseInt(savedVersion));
        }
        if (savedPlayer && savedRole === 'player') {
          setCurrentPlayer(JSON.parse(savedPlayer));
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem('gameRoom');
        localStorage.removeItem('gamePlayer');
        localStorage.removeItem('userRole');
        localStorage.removeItem('currentVersion');
      }
    }
    setInitialized(true);
  }, []);

  // Save session to localStorage
  const saveSession = useCallback((room, role, player = null, version = 0) => {
    if (room && role) {
      localStorage.setItem('gameRoom', JSON.stringify(room));
      localStorage.setItem('userRole', role);
      localStorage.setItem('currentVersion', version.toString());
      if (player) {
        localStorage.setItem('gamePlayer', JSON.stringify(player));
      }
    }
  }, []);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    localStorage.removeItem('gameRoom');
    localStorage.removeItem('gamePlayer');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentVersion');
  }, []);

  // Long polling for real-time updates
  const pollForUpdates = useCallback(async () => {
    if (!currentRoom) return;
    
    try {
      const response = await fetch(`${API_URL}/api/events?lastVersion=${currentVersion}&lastPlayersCount=${currentPlayersCount}&roomId=${currentRoom._id}&isAdmin=${userRole === 'admin'}`);
      const data = await response.json();
      
      if (data.success && data.hasUpdate) {
        if (data.gameState) {
          setGameState(data.gameState);
          setCurrentVersion(data.gameState.version || 0);
          saveSession(currentRoom, userRole, currentPlayer, data.gameState.version || 0);
        }
        if (data.players) {
          setPlayers(data.players);
          setCurrentPlayersCount(data.players.length);
          
          // Keep currentPlayer in sync so score/status always reflects live DB values
          if (userRole === 'player' && currentPlayer) {
            const updatedSelf = data.players.find(p => p._id === currentPlayer._id);
            if (updatedSelf) {
              setCurrentPlayer(updatedSelf);
              localStorage.setItem('gamePlayer', JSON.stringify(updatedSelf));
            }
          }

          // Check if current player was removed
          if (userRole === 'player' && currentPlayer) {
            const stillExists = data.players.some(p => p._id === currentPlayer._id);
            if (!stillExists) {
              setRemovedNotification(true);
              // Auto-exit after showing notification
              setTimeout(() => {
                setCurrentRoom(null);
                setCurrentPlayer(null);
                setUserRole(null);
                setGameState(null);
                setPlayers([]);
                clearSession();
              }, 2000);
            }
          }
        }
      } else if (data.success) {
        // No update but update playersCount from response
        if (data.playersCount !== undefined) {
          setCurrentPlayersCount(data.playersCount);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
    
    // Continue polling
    pollingRef.current = setTimeout(() => pollForUpdates(), 500);
  }, [currentRoom, currentVersion, currentPlayersCount, userRole, currentPlayer, API_URL, saveSession, clearSession]);

  // Create a new room (user becomes admin)
  const createRoom = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success && data.room) {
        setCurrentRoom(data.room);
        setUserRole('admin');
        setGameState(data.room.gameState);
        setCurrentVersion(data.room.gameState?.version || 0);
        setPlayers([]);
        setCurrentPlayersCount(0);
        setCurrentPlayer(null);
        saveSession(data.room, 'admin', null, data.room.gameState?.version || 0);
        return { success: true, room: data.room };
      }
      
      return { success: false, error: data.error || 'Failed to create room' };
    } catch (error) {
      console.error('Failed to create room:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Join a room
  const joinRoom = async (passkey, playerName) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey, playerName })
      });
      
      const data = await response.json();
      
      if (data.success && data.player) {
        setCurrentRoom(data.room);
        setCurrentPlayer(data.player);
        setUserRole('player');
        setGameState(data.room.gameState);
        setCurrentVersion(data.room.gameState?.version || 0);
        setPlayers(data.room.players || []);
        setCurrentPlayersCount((data.room.players || []).length);
        setRemovedNotification(false);
        saveSession(data.room, 'player', data.player, data.room.gameState?.version || 0);
        return { success: true, player: data.player, room: data.room };
      }
      
      return { success: false, error: data.error || 'Failed to join room' };
    } catch (error) {
      console.error('Failed to join room:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Add player (for players in a room)
  const addPlayer = async (name) => {
    if (!currentRoom) {
      return { success: false, error: 'No room selected' };
    }
    
    try {
      const response = await fetch(`${API_URL}/api/rooms/${currentRoom._id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      const data = await response.json();
      
      if (data.success && data.player) {
        setCurrentPlayer(data.player);
        setPlayers(data.players || []);
        setCurrentPlayersCount((data.players || []).length);
        return { success: true, player: data.player };
      }
      
      return { success: false, error: data.error || 'Failed to add player' };
    } catch (error) {
      console.error('Failed to add player:', error);
      return { success: false, error: error.message };
    }
  };

  // Remove player (admin action)
  const removePlayer = async (playerId) => {
    if (!currentRoom || userRole !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    
    try {
      const response = await fetch(`${API_URL}/api/rooms/${currentRoom._id}/players/${playerId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPlayers(data.players || []);
        setCurrentPlayersCount((data.players || []).length);
        return { success: true };
      }
      
      return { success: false, error: data.error || 'Failed to remove player' };
    } catch (error) {
      console.error('Failed to remove player:', error);
      return { success: false, error: error.message };
    }
  };

  // Exit game (player leaves or admin closes)
  const exitGame = async () => {
    if (!currentRoom) {
      return { success: false, error: 'Not in a game' };
    }
    
    try {
      if (currentPlayer) {
        await fetch(`${API_URL}/api/rooms/${currentRoom._id}/players/${currentPlayer._id}`, {
          method: 'DELETE'
        });
      }
      
      setCurrentRoom(null);
      setCurrentPlayer(null);
      setUserRole(null);
      setGameState(null);
      setPlayers([]);
      clearSession();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to exit game:', error);
      return { success: false, error: error.message };
    }
  };

  // Admin actions
  const adminAction = async (action, gameType = null) => {
    if (!currentRoom || userRole !== 'admin') {
      return { success: false, error: 'Unauthorized' };
    }
    
    try {
      const body = { action };
      if (gameType) body.gameType = gameType;

      const response = await fetch(`${API_URL}/api/rooms/${currentRoom._id}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (data.success && data.gameState) {
        setGameState(data.gameState);
        setCurrentVersion(data.gameState.version || 0);
        return { success: true };
      }
      
      return { success: false, error: data.error || 'No game state returned' };
    } catch (error) {
      console.error('Admin action failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Submit guess for number mystery game
  const submitGuess = async (guess, guessCount = 1) => {
    if (!currentRoom || !currentPlayer) {
      return { success: false, error: 'Not in a room' };
    }
    try {
      const response = await fetch(`${API_URL}/api/rooms/${currentRoom._id}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentPlayer._id, guess, guessCount })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Guess failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Start polling when room is set
  useEffect(() => {
    if (currentRoom && initialized) {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      pollingRef.current = setTimeout(() => pollForUpdates(), 500);
    }
    
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [currentRoom, initialized, pollForUpdates]);

  const clearRemovedNotification = useCallback(() => {
    setRemovedNotification(false);
  }, []);

  const value = {
    gameState,
    players,
    loading,
    currentRoom,
    currentPlayer,
    userRole,
    removedNotification,
    clearRemovedNotification,
    createRoom,
    joinRoom,
    addPlayer,
    removePlayer,
    exitGame,
    adminAction,
    submitGuess
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
