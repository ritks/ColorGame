import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pkg from 'pg';
const { Pool } = pkg;
import { v4 as uuidv4 } from "uuid";
import { createSession, getSession, updateSession, deleteSession } from "./sessionStore.js";
import { generateLevel } from "./gameLogic.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());

console.log('Server starting with authentication routes...');

// CORS - Update this with your production frontend URL
const allowedOrigins = [
  "http://localhost:5173", // Local development
  process.env.FRONTEND_URL // Production frontend URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Database setup
let db;
async function initDatabase() {
  console.log('Initializing PostgreSQL database...');
  
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/colortile';
  
  db = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  // Create tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username VARCHAR(255) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      started_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      levels_completed INTEGER NOT NULL DEFAULT 0,
      total_time_seconds INTEGER,
      total_strikes INTEGER DEFAULT 0,
      game_completed BOOLEAN DEFAULT FALSE,
      smallest_difference REAL,
      smallest_difference_example TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS level_results (
      id SERIAL PRIMARY KEY,
      game_session_id INTEGER NOT NULL,
      level_number INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      strikes INTEGER NOT NULL DEFAULT 0,
      average_color_difference REAL,
      completed BOOLEAN DEFAULT TRUE,
      failed BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (game_session_id) REFERENCES game_sessions (id)
    );
  `);
  console.log('Database initialized successfully');
}

// Auth middleware
function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Optional auth middleware (allows both authenticated and guest users)
function optionalAuth(req, res, next) {
  const token = req.cookies.auth_token;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
}

console.log('Registering auth routes...');

// Auth routes
app.post("/api/auth/register", async (req, res) => {
  console.log('Register endpoint hit:', req.body);
  const { email, password, username } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, username]
    );
    
    const token = jwt.sign(
      { userId: result.rows[0].id, email, username }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({ success: true, user: { id: result.rows[0].id, email, username } });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // PostgreSQL unique constraint error
      res.status(400).json({ error: 'Email or username already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post("/api/auth/login", async (req, res) => {
  console.log('Login endpoint hit:', req.body);
  const { email, password } = req.body;
  
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.json({ success: true, user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Start game (now supports both authenticated and guest users)
app.post("/api/game/start", optionalAuth, async (req, res) => {
  const sessionId = uuidv4();
  const levelData = generateLevel(1);

  const sessionData = {
    level: 1,
    strikesUsed: 0,
    startTime: Date.now(),
    levelStartTime: Date.now(),
    levelStats: [],
    smallestDifference: Infinity,
    smallestDifferenceExample: null,
    userId: req.user?.userId || null,
    gameSessionId: null
  };

  createSession(sessionId, sessionData);

  res.cookie("sessionId", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });

  res.json({
    sessionId,
    level: 1,
    totalLevels: 10,
    maxStrikes: 3,
    strikesUsed: 0,
    isAuthenticated: !!req.user,
    ...levelData
  });
});

// Level complete
app.post("/api/game/level-complete", (req, res) => {
  console.log('Level complete request received:', {
    body: req.body,
    sessionId: req.cookies.sessionId
  });
  
  const { timeSec, strikesUsed, colorDifference, smallestRowDifference, difficultyExample } = req.body;
  const sessionId = req.cookies.sessionId;
  const session = getSession(sessionId);

  if (!session) {
    console.log('No session found for sessionId:', sessionId);
    return res.status(400).json({ error: "No active session" });
  }

  // Save completed level stats
  const levelStat = {
    level: session.level,
    timeSeconds: timeSec,
    strikes: strikesUsed,
    averageColorDifference: colorDifference || 0
  };

  const newLevelStats = [...(session.levelStats || []), levelStat];
  
  // Track smallest difference across the game
  let newSmallestDiff = session.smallestDifference;
  let newSmallestExample = session.smallestDifferenceExample;
  
  if (smallestRowDifference && smallestRowDifference < newSmallestDiff) {
    newSmallestDiff = smallestRowDifference;
    newSmallestExample = difficultyExample;
  }

  const newLevel = session.level + 1;
  
  if (newLevel > 10) {
    // Game completed - return final stats
    updateSession(sessionId, { 
      levelStats: newLevelStats,
      smallestDifference: newSmallestDiff,
      smallestDifferenceExample: newSmallestExample
    });
    
    const finalSession = getSession(sessionId);
    res.json({
      gameCompleted: true,
      levelStats: finalSession.levelStats,
      smallestDifference: finalSession.smallestDifference,
      smallestDifferenceExample: finalSession.smallestDifferenceExample,
      totalTime: Math.floor((Date.now() - finalSession.startTime) / 1000)
    });
  } else {
    // Continue to next level
    updateSession(sessionId, { 
      level: newLevel, 
      strikesUsed: 0, 
      levelStartTime: Date.now(),
      levelStats: newLevelStats,
      smallestDifference: newSmallestDiff,
      smallestDifferenceExample: newSmallestExample
    });

    const levelData = generateLevel(newLevel);
    res.json({
      level: newLevel,
      totalLevels: 10,
      maxStrikes: 3,
      strikesUsed: 0,
      ...levelData
    });
  }
});

// Game over
app.post("/api/game/game-over", async (req, res) => {
  const { currentLevelTime, currentLevelStrikes, colorDifference, smallestRowDifference, difficultyExample } = req.body;
  const sessionId = req.cookies.sessionId;
  const session = getSession(sessionId);
  
  if (session) {
    const levelStat = {
      level: session.level,
      timeSeconds: currentLevelTime,
      strikes: currentLevelStrikes,
      averageColorDifference: colorDifference,
      failed: true
    };

    const newLevelStats = [...(session.levelStats || []), levelStat];
    
    let newSmallestDiff = session.smallestDifference;
    let newSmallestExample = session.smallestDifferenceExample;
    
    if (smallestRowDifference && smallestRowDifference < newSmallestDiff) {
      newSmallestDiff = smallestRowDifference;
      newSmallestExample = difficultyExample;
    }
    
    const finalStats = {
      levelStats: newLevelStats,
      smallestDifference: newSmallestDiff,
      smallestDifferenceExample: newSmallestExample,
      totalTime: Math.floor((Date.now() - session.startTime) / 1000)
    };
    
    // Save to database if user is authenticated
    if (session.userId) {
      try {
        const gameSessionResult = await db.query(`
          INSERT INTO game_sessions (
            user_id, started_at, completed_at, levels_completed, 
            total_time_seconds, total_strikes, game_completed, 
            smallest_difference, smallest_difference_example
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, [
          session.userId,
          new Date(session.startTime).toISOString(),
          new Date().toISOString(),
          session.level - 1,
          finalStats.totalTime,
          finalStats.levelStats.reduce((sum, level) => sum + level.strikes, 0),
          false,
          newSmallestDiff === Infinity ? null : newSmallestDiff,
          newSmallestExample ? JSON.stringify(newSmallestExample) : null
        ]);

        // Save individual level results
        for (const levelStat of finalStats.levelStats) {
          await db.query(`
            INSERT INTO level_results (
              game_session_id, level_number, time_seconds, strikes, 
              average_color_difference, completed, failed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            gameSessionResult.rows[0].id,
            levelStat.level,
            levelStat.timeSeconds,
            levelStat.strikes,
            levelStat.averageColorDifference,
            !levelStat.failed,
            !!levelStat.failed
          ]);
        }
      } catch (error) {
        console.error('Error saving game session:', error);
      }
    }
    
    deleteSession(sessionId);
    res.json({ 
      message: "Game results saved",
      gameStats: finalStats
    });
  } else {
    res.json({ message: "Game results saved" });
  }
});

// Get aggregate user statistics
app.get("/api/stats/aggregate", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Overall statistics
    const overallResult = await db.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN game_completed = true THEN 1 END) as games_won,
        CAST(AVG(levels_completed) AS REAL) as avg_levels_per_game,
        MIN(smallest_difference) as hardest_challenge_faced,
        SUM(total_time_seconds) as total_time_played,
        SUM(total_strikes) as total_strikes
      FROM game_sessions 
      WHERE user_id = $1
    `, [userId]);
    
    // Best performances
    const bestResult = await db.query(`
      SELECT 
        MIN(total_time_seconds) as fastest_completion,
        MIN(total_strikes) as fewest_strikes_completion
      FROM game_sessions 
      WHERE user_id = $1 AND game_completed = true
    `, [userId]);
    
    // Level-by-level performance
    const levelResult = await db.query(`
      SELECT 
        level_number,
        COUNT(*) as times_played,
        CAST(AVG(time_seconds) AS REAL) as avg_time,
        CAST(AVG(strikes) AS REAL) as avg_strikes,
        COUNT(CASE WHEN completed = true THEN 1 END) as times_completed,
        CAST((COUNT(CASE WHEN completed = true THEN 1 END) * 100.0 / COUNT(*)) AS REAL) as success_rate
      FROM level_results lr
      JOIN game_sessions gs ON lr.game_session_id = gs.id
      WHERE gs.user_id = $1
      GROUP BY level_number
      ORDER BY level_number
    `, [userId]);
    
    // Recent games
    const recentResult = await db.query(`
      SELECT 
        started_at,
        levels_completed,
        total_time_seconds,
        total_strikes,
        game_completed,
        smallest_difference
      FROM game_sessions 
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 10
    `, [userId]);
    
    res.json({
      overall: overallResult.rows[0],
      best: bestResult.rows[0],
      byLevel: levelResult.rows,
      recent: recentResult.rows
    });
  } catch (error) {
    console.error('Error fetching aggregate stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize database and start server
initDatabase().then(() => {
  console.log('Database connected successfully');
}).catch((err) => {
  console.warn('Database connection failed - running without persistent storage:', err.message);
  console.warn('Auth and stats features will be unavailable. Game will still work for guests.');
  db = null;
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});