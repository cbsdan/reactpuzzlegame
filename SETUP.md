# React Puzzle Game - Vercel Deployment

A real-time multiplayer puzzle game built with React, MongoDB, and deployed on Vercel using Hybrid SSE + Polling for live updates.

## Features

✅ **Player Management**
- Players can join by entering their name
- Real-time player list updates
- Score tracking

✅ **Admin Controls**
- Start, pause, restart, and stop game
- View all players in real-time
- Game statistics dashboard

✅ **Real-time Updates**
- Hybrid SSE + Polling for Vercel compatibility
- No WebSocket required
- Live synchronization across all clients

✅ **Vercel-Only Deployment**
- Serverless API routes
- MongoDB for data persistence
- No separate backend needed

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure MongoDB

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. Get your connection string
4. Copy `.env.example` to `.env` and update with your MongoDB URI:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/puzzlegame?retryWrites=true&w=majority
VITE_API_URL=http://localhost:5173
```

### 3. Run Development Server
-Go to the project location and run the following commands:
frontend:
```bash
npm run dev
```
backend:
```bash
.\.venv\Scripts\activate

python api/index.py
```

The app will be available at `http://localhost:5173`

### 4. Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Add environment variables in Vercel dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `VITE_API_URL`: Your production URL (e.g., https://your-app.vercel.app)



## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── lib/
│   │   └── mongodb.js      # MongoDB connection utility
│   ├── players.js          # Player management endpoints
│   ├── game-state.js       # Game state management
│   ├── events.js           # Long polling for real-time updates
│   └── admin.js            # Admin control endpoints
├── src/
│   ├── components/
│   │   ├── Player.jsx      # Player view component
│   │   ├── Player.css
│   │   ├── Admin.jsx       # Admin dashboard component
│   │   └── Admin.css
│   ├── context/
│   │   └── GameContext.jsx # Global state management
│   ├── App.jsx             # Main app with view toggle
│   └── main.jsx
├── .env                    # Environment variables (not in git)
├── .env.example            # Environment variables template
└── vercel.json             # Vercel configuration
```

## API Endpoints

### Player Management
- `GET /api/players` - Get all players
- `POST /api/players` - Add new player
- `DELETE /api/players` - Clear all players (for testing)

### Game State
- `GET /api/game-state` - Get current game state
- `PUT /api/game-state` - Update game state

### Admin Controls
- `POST /api/admin` - Admin actions (start, pause, restart, stop)

### Real-time Updates
- `GET /api/events?lastVersion=X` - Long polling endpoint for live updates

## How It Works

### Hybrid SSE + Polling

Since Vercel has limitations on long-running connections, this app uses a hybrid approach:

1. **Long Polling**: Clients request updates with their current version
2. **Version Tracking**: Game state has a version number that increments on changes
3. **Smart Timeout**: Server waits up to 25 seconds for changes before responding
4. **Continuous Connection**: Clients immediately reconnect after receiving a response

This provides near real-time updates without WebSockets, making it perfect for Vercel deployment.

## Game Implementation

The game logic is currently a placeholder. You can implement your puzzle game in the `Player.jsx` component's game section.

The infrastructure handles:
- Player registration and tracking
- Real-time state synchronization
- Admin controls for game flow
- Score management

## Technologies Used

- **Frontend**: React + Vite
- **Backend**: Vercel Serverless Functions
- **Database**: MongoDB Atlas
- **Real-time**: Long Polling
- **Deployment**: Vercel

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `VITE_API_URL` | API base URL (auto-set in production) | Yes |

## License

MIT
