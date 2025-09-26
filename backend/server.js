import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pkg from "pg";
const { Pool } = pkg;
import { v4 as uuidv4 } from "uuid";
import { createSession, getSession, updateSession, deleteSession } from "./sessionStore.js";
import { generateLevel } from "./gameLogic.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());

console.log('Server starting with authentication routes...');

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || true
    : "http://localhost:5173",
  credentials: true
};

app.use(cors(corsOptions));

// Database setup
let db;
async function initDatabase() {
  console.log('Initializing database...');
  
  if (process.env.DATABASE_URL) {
    // Production with PostgreSQL
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  } else {
    // Local development fallback to SQLite
    const sqlite3 = await import('sqlite3');
    const { open } = await import('sqlite');
    
    db = await open({
      filename: './game_database.db',
      driver: sqlite3.default.Database
    });
    
    // For SQLite, we need to use exec
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        username TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );

      CREATE TABLE IF NOT EXISTS game_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        levels_completed INTEGER NOT NULL DEFAULT 0,
        total_time_seconds INTEGER,
        total_strikes INTEGER DEFAULT 0,
        game_completed BOOLEAN DEFAULT FALSE,
        smallest_difference REAL,
        smallest_difference_example TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE TABLE IF NOT EXISTS level_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    
    console.log('SQLite database initialized successfully');
    return;
  }
  
  // PostgreSQL table creation
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE,
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
    console.log('PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Database query helper functions
async function dbQuery(text, params = []) {
  if (process.env.DATABASE_URL) {
    // PostgreSQL
    const result = await db.query(text, params);
    return result;
  } else {
    // SQLite
    if (text.includes('INSERT') || text.includes('UPDATE') || text.includes('DELETE')) {
      return await db.run(text, params);
    } else if (text.includes('SELECT') && text.includes('LIMIT 1')) {
      return { rows: [await db.get(text, params)] };
    } else {
      return { rows: await db.all(text, params) };
    }
  }
}

async function dbGet(text, params = []) {
  const result = await dbQuery(text, params);
  return result.rows[0];
}

async function dbAll(text, params = []) {
  const result = await dbQuery(text, params);
  return result.rows;
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
    const result = await dbQuery(
      'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id',
      [email, hashedPassword, username]
    );
    
    const userId = result.rows[0].id;
    
    const token = jwt.sign(
      { userId, email, username }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({ success: true, user: { id: userId, email, username } });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
    const user = await dbGet('SELECT * FROM users WHERE email = $1', [email]);
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await dbQuery('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, username: user.username }, 
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
    sameSite: "lax"
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
  const { timeSec, strikesUsed, colorDifference, smallestRowDifference, difficultyExample } = req.body;
  const sessionId = req.cookies.sessionId;
  const session = getSession(sessionId);

  if (!session) return res.status(400).json({ error: "No active session" });

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
        const gameSessionResult = await dbQuery(`
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

        const gameSessionId = gameSessionResult.rows[0].id;

        // Save individual level results
        for (const levelStat of finalStats.levelStats) {
          await dbQuery(`
            INSERT INTO level_results (
              game_session_id, level_number, time_seconds, strikes, 
              average_color_difference, completed, failed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            gameSessionId,
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
    const overallStats = await dbGet(`
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
    const bestStats = await dbGet(`
      SELECT 
        MIN(total_time_seconds) as fastest_completion,
        MIN(total_strikes) as fewest_strikes_completion
      FROM game_sessions 
      WHERE user_id = $1 AND game_completed = true
    `, [userId]);
    
    // Level-by-level performance
    const levelStats = await dbAll(`
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
    const recentGames = await dbAll(`
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
      overall: overallStats,
      best: bestStats,
      byLevel: levelStats,
      recent: recentGames
    });
  } catch (error) {
    console.error('Error fetching aggregate stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 4000;
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
  });
}).catch(console.error);