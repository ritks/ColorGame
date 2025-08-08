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
    startTime: Date.now()
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
  const { timeSec, strikesUsed } = req.body;
  const sessionId = req.cookies.sessionId;
  const session = getSession(sessionId);

  if (!session) return res.status(400).json({ error: "No active session" });

  const newLevel = session.level + 1;
  updateSession(sessionId, { level: newLevel, strikesUsed: 0 });

  const levelData = generateLevel(newLevel);
  res.json({
    level: newLevel,
    maxStrikes: 3,
    strikesUsed: 0,
    ...levelData
  });
});

// Game over
app.post("/api/game/game-over", (req, res) => {
  const sessionId = req.cookies.sessionId;
  deleteSession(sessionId);
  res.json({ message: "Game results saved" });
});

app.listen(process.env.PORT, () => {
  console.log(`Backend running on http://localhost:${process.env.PORT}`);
});
