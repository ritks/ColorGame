import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { createSession, getSession, updateSession, deleteSession } from "./sessionStore.js";
import { generateLevel } from "./gameLogic.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());

// CORS for local dev
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

// Start game
app.post("/api/game/start", (req, res) => {
  const sessionId = uuidv4();
  const levelData = generateLevel(1);

  createSession(sessionId, {
    level: 1,
    strikesUsed: 0,
    startTime: Date.now(),
    levelStartTime: Date.now(),
    levelStats: [], // Track stats for each completed level
    smallestDifference: Infinity,
    smallestDifferenceExample: null
  });

  res.cookie("sessionId", sessionId, {
    httpOnly: true,
    secure: false, // set to true in production
    sameSite: "lax"
  });

  res.json({
    sessionId,
    level: 1,
    totalLevels: 10,
    maxStrikes: 3,
    strikesUsed: 0,
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
    averageColorDifference: colorDifference
  };

  const newLevelStats = [...(session.levelStats || []), levelStat];
  
  // Track smallest difference across the game
  let newSmallestDiff = session.smallestDifference;
  let newSmallestExample = session.smallestDifferenceExample;
  
  if (smallestRowDifference < newSmallestDiff) {
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
      maxStrikes: 3,
      strikesUsed: 0,
      ...levelData
    });
  }
});

// Game over
app.post("/api/game/game-over", (req, res) => {
  const { currentLevelTime, currentLevelStrikes, colorDifference, smallestRowDifference, difficultyExample } = req.body;
  const sessionId = req.cookies.sessionId;
  const session = getSession(sessionId);
  
  if (session) {
    // Save stats for the level they failed on
    const levelStat = {
      level: session.level,
      timeSeconds: currentLevelTime,
      strikes: currentLevelStrikes,
      averageColorDifference: colorDifference,
      failed: true
    };

    const newLevelStats = [...(session.levelStats || []), levelStat];
    
    // Check if this was the smallest difference
    let newSmallestDiff = session.smallestDifference;
    let newSmallestExample = session.smallestDifferenceExample;
    
    if (smallestRowDifference < newSmallestDiff) {
      newSmallestDiff = smallestRowDifference;
      newSmallestExample = difficultyExample;
    }
    
    const finalStats = {
      levelStats: newLevelStats,
      smallestDifference: newSmallestDiff,
      smallestDifferenceExample: newSmallestExample,
      totalTime: Math.floor((Date.now() - session.startTime) / 1000)
    };
    
    deleteSession(sessionId);
    res.json({ 
      message: "Game results saved",
      gameStats: finalStats
    });
  } else {
    res.json({ message: "Game results saved" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Backend running on http://localhost:${process.env.PORT}`);
});