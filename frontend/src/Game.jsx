import React, { useEffect, useState, useRef } from "react";
import { startGame, levelComplete, gameOver } from "./api";
import TileRow from "./TileRow";
import GameStats from "./GameStats";

const MAX_STRIKES = 3;

export default function Game({ onQuit }) {
  const [sessionId, setSessionId] = useState(null);
  const [level, setLevel] = useState(1);
  const [rows, setRows] = useState(0);
  const [tilesPerRow, setTilesPerRow] = useState(0);
  const [colorData, setColorData] = useState([]);
  const [strikesUsed, setStrikesUsed] = useState(0);
  const [solvedRows, setSolvedRows] = useState([]);
  const [disappearedTiles, setDisappearedTiles] = useState([]); // New state for wrong guesses
  const [timerStart, setTimerStart] = useState(null);
  const [levelStartTime, setLevelStartTime] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef(null);
  const [gameOverState, setGameOverState] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameStats, setGameStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  
  // Current level tracking
  const [currentLevelData, setCurrentLevelData] = useState(null);

  // Start timer
  useEffect(() => {
    if (timerStart === null) return;
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - timerStart) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerStart]);

  // Start game
  useEffect(() => {
    async function init() {
      const data = await startGame();
      setSessionId(data.sessionId);
      setLevel(data.level);
      setRows(data.rows);
      setTilesPerRow(data.tilesPerRow);
      setColorData(data.colorData);
      setStrikesUsed(data.strikesUsed);
      setSolvedRows(new Array(data.rows).fill(false));
      setDisappearedTiles(new Array(data.rows).fill().map(() => [])); // Initialize empty arrays for each row
      setTimerStart(Date.now());
      setLevelStartTime(Date.now());
      setGameOverState(false);
      setGameWon(false);
      setElapsedSec(0);
      setGameStats(null);
      setShowStats(false);
      
      // Store current level data for stats
      setCurrentLevelData({
        averageColorDifference: data.averageColorDifference,
        smallestRowDifference: data.smallestRowDifference,
        difficultyExample: data.difficultyExample
      });
    }
    init();
  }, []);

  // Handle tile click
  function onTileClick(rowIndex, tileIndex) {
    if (gameOverState || gameWon) return;
    if (solvedRows[rowIndex]) return; // already solved

    const correctIndex = colorData[rowIndex].oddTileIndex;
    if (tileIndex === correctIndex) {
      // mark row solved
      const newSolved = [...solvedRows];
      newSolved[rowIndex] = true;
      setSolvedRows(newSolved);

      // Check if all solved
      if (newSolved.every(Boolean)) {
        // Level complete
        handleLevelComplete();
      }
    } else {
      // wrong guess - add tile to disappeared tiles for this row
      const newDisappearedTiles = [...disappearedTiles];
      if (!newDisappearedTiles[rowIndex].includes(tileIndex)) {
        newDisappearedTiles[rowIndex] = [...newDisappearedTiles[rowIndex], tileIndex];
        setDisappearedTiles(newDisappearedTiles);
      }
      
      const newStrikes = strikesUsed + 1;
      setStrikesUsed(newStrikes);
      if (newStrikes >= MAX_STRIKES) {
        handleGameOver();
      }
    }
  }

  async function handleLevelComplete() {
    clearInterval(timerRef.current);
    const levelTime = Math.floor((Date.now() - levelStartTime) / 1000);
    
    // Send level complete to backend with stats
    const data = await levelComplete(
      level, 
      levelTime, 
      strikesUsed,
      currentLevelData?.averageColorDifference || 0,
      currentLevelData?.smallestRowDifference || 0,
      currentLevelData?.difficultyExample || null
    );
    
    if (data.gameCompleted) {
      // Game won - show stats
      setGameWon(true);
      setGameStats({
        levelStats: data.levelStats,
        smallestDifference: data.smallestDifference,
        smallestDifferenceExample: data.smallestDifferenceExample,
        totalTime: data.totalTime
      });
      setTimeout(() => setShowStats(true), 1500); // Show stats after celebration
    } else {
      // Continue to next level
      setLevel(data.level);
      setRows(data.rows);
      setTilesPerRow(data.tilesPerRow);
      setColorData(data.colorData);
      setStrikesUsed(data.strikesUsed);
      setSolvedRows(new Array(data.rows).fill(false));
      setDisappearedTiles(new Array(data.rows).fill().map(() => [])); // Reset disappeared tiles for new level
      setLevelStartTime(Date.now());
      setTimerStart(Date.now());
      setElapsedSec(0);
      
      // Update current level data
      setCurrentLevelData({
        averageColorDifference: data.averageColorDifference || 0,
        smallestRowDifference: data.smallestRowDifference || 0,
        difficultyExample: data.difficultyExample || null
      });
    }
  }

  async function handleGameOver() {
    clearInterval(timerRef.current);
    const levelTime = Math.floor((Date.now() - levelStartTime) / 1000);
    
    // Send game over to backend with current level stats
    const response = await gameOver(
      level - 1, 
      Math.floor((Date.now() - timerStart) / 1000), 
      calculateAccuracy(),
      levelTime,
      strikesUsed,
      currentLevelData?.averageColorDifference || 0,
      currentLevelData?.smallestRowDifference || 0,
      currentLevelData?.difficultyExample || null
    );
    
    setGameOverState(true);
    if (response.gameStats) {
      setGameStats(response.gameStats);
      setTimeout(() => setShowStats(true), 1500); // Show stats after game over message
    }
  }

  function calculateAccuracy() {
    const totalTiles = rows * tilesPerRow;
    const totalCorrect = solvedRows.filter(Boolean).length * tilesPerRow;
    return totalCorrect / totalTiles;
  }

  function resetGame() {
    setGameOverState(false);
    setGameWon(false);
    setElapsedSec(0);
    setStrikesUsed(0);
    setSolvedRows([]);
    setDisappearedTiles([]); // Reset disappeared tiles
    setSessionId(null);
    setLevel(1);
    setRows(0);
    setTilesPerRow(0);
    setColorData([]);
    setTimerStart(null);
    setLevelStartTime(null);
    setGameStats(null);
    setShowStats(false);
    setCurrentLevelData(null);
    onQuit();
  }

  if (showStats && gameStats) {
    return <GameStats stats={gameStats} onPlayAgain={resetGame} />;
  }

  return (
    <div className="game-container">
      <div className="game-info">
        <div>Level: {level} / 10</div>
        <div>Strikes: {strikesUsed} / {MAX_STRIKES}</div>
        <div>Time: {elapsedSec}s</div>
      </div>
      {gameOverState && !showStats && (
        <div className="result-message">
          <h2>Game Over!</h2>
          <p>Preparing your statistics...</p>
        </div>
      )}
      {gameWon && !showStats && (
        <div className="result-message">
          <h2>Congratulations! You won!</h2>
          <p>Loading your detailed statistics...</p>
        </div>
      )}
      {!gameOverState && !gameWon && (
        <div className="tile-grid">
          {colorData.map((row, i) => (
            <TileRow
              key={i}
              rowIndex={i}
              tilesPerRow={tilesPerRow}
              baseColor={row.baseColor}
              oddColor={row.oddColor}
              oddTileIndex={row.oddTileIndex}
              solved={solvedRows[i]}
              disappearedTiles={disappearedTiles[i] || []} // Pass disappeared tiles for this row
              onTileClick={onTileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}