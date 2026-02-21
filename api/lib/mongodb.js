const { MongoClient } = require('mongodb');
const dns = require('dns');

// Fix DNS resolution issues on Windows
try {
  dns.setDefaultResultOrder('ipv4first');
  // Set DNS servers to use Google's public DNS
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('Could not configure DNS:', e.message);
}

// Check if MongoDB URI is configured
if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('username:password')) {
  console.warn('⚠️  MongoDB URI not configured properly.');
  console.warn('📝 Please get your actual connection string from MongoDB Atlas');
  module.exports = null;
} else {
  const uri = process.env.MONGODB_URI;
  
  // Enhanced connection options to handle DNS and timeout issues
  const options = {
    serverSelectionTimeoutMS: 30000, // Increased timeout
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4, // Force IPv4
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10,
  };

  let client;
  let clientPromise;

  try {
    if (process.env.NODE_ENV === 'development') {
      // In development mode, use a global variable to preserve the client across module reloads
      if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect()
          .then(connectedClient => {
            console.log('✅ MongoDB connected successfully');
            return connectedClient;
          })
          .catch(err => {
            console.error('❌ MongoDB connection failed:', err.message);
            console.error('   Possible fixes:');
            console.error('   1. Check Network Access IP whitelist in MongoDB Atlas');
            console.error('   2. Verify password is correct (no special characters or URL-encode them)');
            console.error('   3. Ensure cluster is active and not paused');
            console.error('   4. Try using standard connection string instead of SRV');
            return null;
          });
      }
      clientPromise = global._mongoClientPromise;
    } else {
      // In production mode, it's best to not use a global variable
      client = new MongoClient(uri, options);
      clientPromise = client.connect()
        .then(connectedClient => {
          console.log('✅ MongoDB connected successfully');
          return connectedClient;
        })
        .catch(err => {
          console.error('❌ MongoDB connection failed:', err.message);
          return null;
        });
    }

    module.exports = clientPromise;
  } catch (error) {
    console.error('MongoDB setup error:', error.message);
    module.exports = null;
  }
}
