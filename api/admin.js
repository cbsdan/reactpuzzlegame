const clientPromise = require('./lib/mongodb.js');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const client = await clientPromise;
  const db = client.db('puzzlegame');
  const gameStates = db.collection('gamestate');
  const players = db.collection('players');

  try {
    const { action } = req.body;

    if (!action || !['start', 'pause', 'restart', 'stop'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    let newStatus;
    let additionalUpdates = {};

    switch (action) {
      case 'start':
        newStatus = 'playing';
        additionalUpdates.startedAt = new Date();
        additionalUpdates.pausedAt = null;
        break;
      case 'pause':
        newStatus = 'paused';
        additionalUpdates.pausedAt = new Date();
        break;
      case 'restart':
        newStatus = 'playing';
        additionalUpdates.startedAt = new Date();
        additionalUpdates.pausedAt = null;
        // Reset player scores
        await players.updateMany({}, { $set: { score: 0 } });
        break;
      case 'stop':
        newStatus = 'idle';
        additionalUpdates.startedAt = null;
        additionalUpdates.pausedAt = null;
        break;
    }

    // Update game state and increment version
    const result = await gameStates.findOneAndUpdate(
      { type: 'current' },
      { 
        $set: { 
          status: newStatus, 
          updatedAt: new Date(),
          ...additionalUpdates
        },
        $inc: { version: 1 }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(200).json({ 
      success: true, 
      action,
      gameState: result.value,
      message: `Game ${action}ed successfully`
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
