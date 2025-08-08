import React, { useEffect, useState, useRef } from "react";
import { startGame, levelComplete, gameOver } from "./api";
import TileRow from "./TileRow";

const MAX_STRIKES = 3;

export default function Game({ onQuit }) {
  const [sessionId, setSessionId] = useState(null);
  const [level, setLevel] = useState(1);
  const [rows, setRows] = useState(0);
  const [tilesPerRow, setTilesPerRow] = useState(0);
  const [colorData, setColorData] = useState([]);
  const [strikesUsed, setStrikesUsed] = useState(0);
  const [solvedRows, setSolvedRows] = useState([]);
  const [timerStart, setTimerStart] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef(null);
  const [gameOverState, setGameOverState] = useState(false);
  const [gameWon, setGameWon] = useState(false);

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
      setTimerStart(Date.now());
      setGameOverState(false);
      setGameWon(false);
      setElapsedSec(0);
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
      // wrong guess
      const newStrikes = strikesUsed + 1;
      setStrikesUsed(newStrikes);
      if (newStrikes >= MAX_STRIKES) {
        handleGameOver();
      }
    }
  }

  async function handleLevelComplete() {
    clearInterval(timerRef.current);
    // Send level complete to backend
    const data = await levelComplete(level, elapsedSec, strikesUsed);
    if (data.level > 10) {
      // Game won
      setGameWon(true);
    } else {
      setLevel(data.level);
      setRows(data.rows);
      setTilesPerRow(data.tilesPerRow);
      setColorData(data.colorData);
      setStrikesUsed(data.strikesUsed);
      setSolvedRows(new Array(data.rows).fill(false));
      setTimerStart(Date.now());
      setElapsedSec(0);
    }
  }

  async function handleGameOver() {
    clearInterval(timerRef.current);
    setGameOverState(true);
    // Send game over to backend
    await gameOver(level - 1, elapsedSec, calculateAccuracy());
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
    setSessionId(null);
    setLevel(1);
    setRows(0);
    setTilesPerRow(0);
    setColorData([]);
    setTimerStart(null);
    onQuit();
  }

  return (
    <div className="game-container">
      <div className="game-info">
        <div>Level: {level} / 10</div>
        <div>Strikes: {strikesUsed} / {MAX_STRIKES}</div>
        <div>Time: {elapsedSec}s</div>
      </div>
      {gameOverState && (
        <div className="result-message">
          <h2>Game Over!</h2>
          <button onClick={resetGame}>Play Again</button>
        </div>
      )}
      {gameWon && (
        <div className="result-message">
          <h2>Congratulations! You won!</h2>
          <button onClick={resetGame}>Play Again</button>
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
              onTileClick={onTileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
