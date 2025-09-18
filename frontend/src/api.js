import axios from "axios";

const api = axios.create({
  baseURL: "/api",
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