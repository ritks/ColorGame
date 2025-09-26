import axios from "axios";

// Use environment variable for API URL, fallback to local development
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export async function startGame() {
  const response = await api.post("/game/start");
  return response.data;
}

export async function levelComplete(level, timeSec, strikesUsed, colorDifference, smallestRowDifference, difficultyExample) {
  const response = await api.post("/game/level-complete", {
    level,
    timeSec,
    strikesUsed,
    colorDifference,
    smallestRowDifference,
    difficultyExample
  });
  return response.data;
}

export async function gameOver(levelsBeaten, totalTimeSec, accuracy, currentLevelTime, currentLevelStrikes, colorDifference, smallestRowDifference, difficultyExample) {
  const response = await api.post("/game/game-over", {
    levelsBeaten,
    totalTimeSec,
    accuracy,
    currentLevelTime,
    currentLevelStrikes,
    colorDifference,
    smallestRowDifference,
    difficultyExample
  });
  return response.data;
}