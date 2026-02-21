import { useState } from 'react'
import { GameProvider } from './context/GameContext'
import Player from './components/Player'
import Admin from './components/Admin'
import './App.css'

function App() {
  const [isAdmin, setIsAdmin] = useState(false)

  return (
    <GameProvider>
      <div className="app">
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${!isAdmin ? 'active' : ''}`}
            onClick={() => setIsAdmin(false)}
          >
            👤 Player View
          </button>
          <button 
            className={`toggle-btn ${isAdmin ? 'active' : ''}`}
            onClick={() => setIsAdmin(true)}
          >
            👨‍💼 Admin View
          </button>
        </div>
        
        {isAdmin ? <Admin /> : <Player />}
      </div>
    </GameProvider>
  )
}

export default App
