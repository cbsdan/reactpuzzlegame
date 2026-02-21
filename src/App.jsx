import { useGame } from './context/GameContext'
import { GameProvider } from './context/GameContext'
import Player from './components/Player'
import Admin from './components/Admin'
import Home from './components/Home'
import './App.css'

function AppContent() {
  const { currentRoom, userRole } = useGame()

  // Show home screen if not in a room
  if (!currentRoom) {
    return <Home />
  }

  // Show Admin or Player based on user role
  return userRole === 'admin' ? <Admin /> : <Player />
}

function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  )
}

function AppInner() {
  const { userRole, currentRoom } = useGame()
  return (
    <div className={`app${currentRoom && userRole === 'admin' ? ' app-admin' : ''}`}>
      <AppContent />
    </div>
  )
}

export default App
