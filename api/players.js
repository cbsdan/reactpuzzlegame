const clientPromise = require('./lib/mongodb.js');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
      error: 'Database connection failed. Please check your MONGODB_URI.',
      players: []
    });
  }

  const db = client.db('puzzlegame');
  const players = db.collection('players');

  try {
    if (req.method === 'GET') {
      // Get all players
      const allPlayers = await players.find({}).sort({ joinedAt: -1 }).toArray();
      return res.status(200).json({ success: true, players: allPlayers });
    }

    if (req.method === 'POST') {
      // Add new player
      const { name } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }

      const newPlayer = {
        name: name.trim(),
        joinedAt: new Date(),
        score: 0,
        isActive: true
      };

      const result = await players.insertOne(newPlayer);
      return res.status(201).json({ 
        success: true, 
        player: { ...newPlayer, _id: result.insertedId } 
      });
    }

    if (req.method === 'DELETE') {
      // Clear all players (for testing)
      await players.deleteMany({});
      return res.status(200).json({ success: true, message: 'All players removed' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Players API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
