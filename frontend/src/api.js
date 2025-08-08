import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true
});

export async function startGame() {
  const response = await api.post("/game/start");
  return response.data;
}

export async function levelComplete(level, timeSec, strikesUsed) {
  const response = await api.post("/game/level-complete", {
    level,
    timeSec,
    strikesUsed
  });
  return response.data;
}

export async function gameOver(levelsBeaten, totalTimeSec, accuracy) {
  const response = await api.post("/game/game-over", {
    levelsBeaten,
    totalTimeSec: totalTimeSec,
    accuracy
  });
  return response.data;
}
