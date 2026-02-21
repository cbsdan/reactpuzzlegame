const clientPromise = require('./lib/mongodb.js');

// Store for tracking latest version
let lastKnownVersion = 0;

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (!clientPromise) {
    return res.status(503).json({ 
      success: false, 
      error: 'Database not configured. Please set MONGODB_URI in .env file.' 
    });
  }

  const client = await clientPromise;
  
  if (!client) {
    return res.status(503).json({ 
      success: false, 
      error: 'Database connection failed. Please check your MONGODB_URI.' 
    });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { lastVersion } = req.query;
  const clientVersion = parseInt(lastVersion) || 0;

  try {
    const client = await clientPromise;
    const db = client.db('puzzlegame');
    
    // Get current game state
    const gameState = await db.collection('gamestate').findOne({ type: 'current' });
    const currentVersion = gameState?.version || 0;

    // Check if there are updates
    if (currentVersion > clientVersion) {
      // Get updated data
      const players = await db.collection('players').find({}).sort({ joinedAt: -1 }).toArray();
      
      return res.status(200).json({
        success: true,
        hasUpdate: true,
        version: currentVersion,
        gameState,
        players,
        timestamp: new Date().toISOString()
      });
    }

    // No updates - use long polling with timeout
    const startTime = Date.now();
    const timeout = 25000; // 25 seconds (Vercel has 30s limit for hobby plan)
    
    const checkForUpdates = async () => {
      while (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
        
        const latestGameState = await db.collection('gamestate').findOne({ type: 'current' });
        const latestVersion = latestGameState?.version || 0;
        
        if (latestVersion > clientVersion) {
          const players = await db.collection('players').find({}).sort({ joinedAt: -1 }).toArray();
          
          return res.status(200).json({
            success: true,
            hasUpdate: true,
            version: latestVersion,
            gameState: latestGameState,
            players,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Timeout - no updates
      return res.status(200).json({
        success: true,
        hasUpdate: false,
        version: clientVersion,
        timestamp: new Date().toISOString()
      });
    };

    return await checkForUpdates();
  } catch (error) {
    console.error('Events API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports.config = {
  maxDuration: 30, // Maximum execution time in seconds
};
