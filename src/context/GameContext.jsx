import { createContext, useContext, useState, useEffect, useRef } from 'react';

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
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState(0);
  const pollingRef = useRef(null);
  
  const API_URL = import.meta.env.VITE_API_URL || '';

  // Long polling for real-time updates
  const pollForUpdates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/events?lastVersion=${currentVersion}`);
      const data = await response.json();
      
      if (data.success && data.hasUpdate) {
        setGameState(data.gameState);
        setPlayers(data.players);
        setCurrentVersion(data.version);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
    
    // Continue polling
    pollingRef.current = setTimeout(pollForUpdates, 1000);
  };

  // Initial data fetch
  const fetchInitialData = async () => {
    try {
      const [gameStateRes, playersRes] = await Promise.all([
        fetch(`${API_URL}/api/game-state`),
        fetch(`${API_URL}/api/players`)
      ]);
      
      const gameStateData = await gameStateRes.json();
      const playersData = await playersRes.json();
      
      if (gameStateData.success) {
        setGameState(gameStateData.gameState);
        setCurrentVersion(gameStateData.gameState.version || 0);
      }
      
      if (playersData.success) {
        setPlayers(playersData.players);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      setLoading(false);
    }
  };

  // Add player
  const addPlayer = async (name) => {
    try {
      const response = await fetch(`${API_URL}/api/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Force refresh
        const playersRes = await fetch(`${API_URL}/api/players`);
        const playersData = await playersRes.json();
        if (playersData.success) {
          setPlayers(playersData.players);
        }
        return { success: true, player: data.player };
      }
      
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Failed to add player:', error);
      return { success: false, error: error.message };
    }
  };

  // Admin actions
  const adminAction = async (action) => {
    try {
      const response = await fetch(`${API_URL}/api/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGameState(data.gameState);
        setCurrentVersion(data.gameState.version || 0);
        return { success: true };
      }
      
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Admin action failed:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchInitialData();
    
    // Start polling after initial fetch
    const startPollingTimer = setTimeout(() => {
      pollForUpdates();
    }, 2000);
    
    return () => {
      clearTimeout(startPollingTimer);
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  // Restart polling when version changes
  useEffect(() => {
    if (!loading && currentVersion > 0) {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      pollingRef.current = setTimeout(pollForUpdates, 1000);
    }
  }, [currentVersion]);

  const value = {
    gameState,
    players,
    loading,
    addPlayer,
    adminAction
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
