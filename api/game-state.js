const clientPromise = require('./lib/mongodb.js');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!clientPromise) {
    return res.status(503).json({ 
      success: false, 
      error: 'Database not configured. Please set MONGODB_URI in .env file.',
      gameState: null
    });
  }

  const client = await clientPromise;
  
  if (!client) {
    return res.status(503).json({ 
      success: false, 
      error: 'Database connection failed. Please check your MONGODB_URI.',
      gameState: null
    });
  }

  const db = client.db('puzzlegame');
  const gameStates = db.collection('gamestate');

  try {
    if (req.method === 'GET') {
      // Get current game state
      let gameState = await gameStates.findOne({ type: 'current' });
      
      if (!gameState) {
        // Initialize default game state
        gameState = {
          type: 'current',
          status: 'idle', // idle, playing, paused
          startedAt: null,
          pausedAt: null,
          updatedAt: new Date(),
          version: 0
        };
        await gameStates.insertOne(gameState);
      }
      
      return res.status(200).json({ success: true, gameState });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      // Update game state (admin only)
      const { status, adminAction } = req.body;

      if (!status || !['idle', 'playing', 'paused'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const updateData = {
        status,
        updatedAt: new Date(),
        $inc: { version: 1 }
      };

      if (status === 'playing') {
        updateData.startedAt = new Date();
        updateData.pausedAt = null;
      } else if (status === 'paused') {
        updateData.pausedAt = new Date();
      } else if (status === 'idle') {
        updateData.startedAt = null;
        updateData.pausedAt = null;
      }

      const result = await gameStates.findOneAndUpdate(
        { type: 'current' },
        { $set: updateData },
        { upsert: true, returnDocument: 'after' }
      );

      return res.status(200).json({ 
        success: true, 
        gameState: result.value,
        action: adminAction || status
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Game state API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
