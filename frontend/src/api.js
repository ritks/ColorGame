import axios from "axios";

console.log('API_BASE_URL is:', import.meta.env.VITE_API_URL || "/api");

// Use environment variable for API URL, fallback to local development
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Add request interceptor for debugging
api.interceptors.request.use(request => {
  console.log('Starting Request:', request);
  return request;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  response => {
    console.log('Response:', response);
    return response;
  },
  error => {
    console.error('API Error:', error);
    if (error.response) {
      console.error('Error data:', error.response.data);
      console.error('Error status:', error.response.status);
    }
    return Promise.reject(error);
  }
);

export async function startGame() {
  const response = await api.post("/game/start");
  return response.data;
}

export async function levelComplete(level, timeSec, strikesUsed, colorDifference, smallestRowDifference, difficultyExample) {
  console.log('Calling levelComplete with:', {
    level, 
    timeSec, 
    strikesUsed, 
    colorDifference, 
    smallestRowDifference, 
    difficultyExample
  });
  
  const payload = {
    level,
    timeSec,
    strikesUsed,
    colorDifference,
    smallestRowDifference,
    difficultyExample
  };
  
  console.log('Sending payload:', payload);
  
  const response = await api.post("/game/level-complete", payload);
  return response.data;
}

export async function gameOver(levelsBeaten, totalTimeSec, accuracy, currentLevelTime, currentLevelStrikes, colorDifference, smallestRowDifference, difficultyExample) {
  console.log('Calling gameOver with:', {
    levelsBeaten,
    totalTimeSec,
    accuracy,
    currentLevelTime,
    currentLevelStrikes,
    colorDifference,
    smallestRowDifference,
    difficultyExample
  });
  
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