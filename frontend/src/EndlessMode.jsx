import React, { useState, useRef, useEffect } from "react";
import GameStats from "./GameStats";

const MAX_STRIKES = 3;

// Each row gets a different scroll speed and direction
const ROW_CONFIGS = [
  { speed: 12, direction: 1 },
  { speed: 16, direction: -1 },
  { speed: 10, direction: 1 },
  { speed: 14, direction: -1 },
  { speed: 18, direction: 1 },
  { speed: 11, direction: -1 },
  { speed: 15, direction: 1 },
];

function getRandomColor() {
  return {
    hue: Math.floor(Math.random() * 360),
    saturation: 70,
    lightness: 50,
  };
}

// Mirrors backend generateLevel at difficulty 8–9
function generateEndlessLevel() {
  const effectiveLevel = 8 + Math.round(Math.random()); // 8 or 9
  const rows = 3 + Math.floor((effectiveLevel - 1) * 0.6);       // 7
  const tilesPerRow = Math.min(9 + Math.floor(effectiveLevel / 4), 12); // 11
  const colorDifference = Math.max(12, Math.floor(30 - effectiveLevel * 1.8)); // 15 or 13

  const colorData = [];
  let totalDiff = 0;
  let minDiff = Infinity;
  let minDiffExample = null;

  for (let i = 0; i < rows; i++) {
    const base = getRandomColor();
    const oddTileIndex = Math.floor(Math.random() * tilesPerRow);
    const rowMult = Math.random() * 0.3 + 0.85;
    const adjustedDiff = Math.max(1, Math.floor(colorDifference * rowMult));
    const usesSaturationDiff = Math.random() < 0.25;

    let oddColor;
    if (usesSaturationDiff) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const clampedSat = Math.max(10, Math.min(90, base.saturation + adjustedDiff * dir));
      oddColor = `hsl(${base.hue}, ${clampedSat}%, ${base.lightness}%)`;
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const clampedLit = Math.max(10, Math.min(90, base.lightness + adjustedDiff * dir));
      oddColor = `hsl(${base.hue}, ${base.saturation}%, ${clampedLit}%)`;
    }

    const baseColorStr = `hsl(${base.hue}, ${base.saturation}%, ${base.lightness}%)`;
    colorData.push({ baseColor: baseColorStr, oddColor, oddTileIndex });

    totalDiff += adjustedDiff;
    if (adjustedDiff < minDiff) {
      minDiff = adjustedDiff;
      minDiffExample = { baseColor: baseColorStr, oddColor, usesSaturationDiff };
    }
  }

  const levelType = Math.random() < 0.5 ? 'scrolling' : 'bouncing';

  return {
    rows,
    tilesPerRow,
    colorData,
    averageDifference: totalDiff / rows,
    levelMinDiff: minDiff,
    levelMinDiffExample: minDiffExample,
    levelType,
  };
}

function freshState() {
  const level = generateEndlessLevel();
  return {
    round: 1,
    strikes: 0,
    gameOver: false,
    gameOverStats: null,
    ...level,
    solvedRows: new Array(level.rows).fill(false),
    disappearedTiles: new Array(level.rows).fill(null).map(() => []),
    roundStartTime: Date.now(),
    completedRoundStats: [],
    smallestDiffSoFar: Infinity,
    smallestDiffExampleSoFar: null,
  };
}

// A tile row that scrolls horizontally and wraps around continuously.
// Tiles are duplicated so the loop is seamless (animate 0 → -50%).
function ScrollingTileRow({
  rowIndex, tilesPerRow, baseColor, oddColor, oddTileIndex,
  solved, disappearedTiles, onTileClick, speed, direction,
}) {
  const tileElements = [];

  // Render two identical sets so the wrap is seamless
  for (let copy = 0; copy < 2; copy++) {
    for (let i = 0; i < tilesPerRow; i++) {
      const color = i === oddTileIndex ? oddColor : baseColor;
      const isDisappeared = disappearedTiles.includes(i);

      tileElements.push(
        <div
          key={`${copy}-${i}`}
          className={`tile ${solved ? "solved" : ""} ${isDisappeared ? "disappeared" : ""}`}
          style={{
            backgroundColor: isDisappeared ? "transparent" : color,
            pointerEvents: isDisappeared || solved ? "none" : undefined,
          }}
          onClick={isDisappeared || solved ? undefined : () => onTileClick(rowIndex, i)}
          role={isDisappeared || solved ? undefined : "button"}
          tabIndex={isDisappeared || solved ? -1 : 0}
          aria-label={i === oddTileIndex ? "Odd colored tile" : "Normal tile"}
          onKeyDown={isDisappeared || solved ? undefined : (e) => {
            if (e.key === "Enter" || e.key === " ") onTileClick(rowIndex, i);
          }}
        />
      );
    }
  }

  return (
    <div className="endless-row-clip">
      <div
        className="endless-row-track"
        style={{
          animationDuration: `${speed}s`,
          animationDirection: direction === -1 ? "reverse" : "normal",
          animationPlayState: solved ? "paused" : "running",
        }}
      >
        {tileElements}
      </div>
    </div>
  );
}

const BOUNCE_TILE_SIZE = 36;
const BOUNCE_TILE_GAP = 6;

// Full-screen bouncing mode: every tile is an independent physics object.
// Tiles start in their row layout, then scatter after 1 second.
// Clicking the odd tile in a row clears all tiles in that row.
function BouncingLevelGame({
  round, strikes, maxStrikes,
  rows, tilesPerRow, colorData, solvedRows, disappearedTiles, onTileClick,
}) {
  const tilesPhysRef = useRef([]);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const solvedRowsRef = useRef(solvedRows);
  const disappearedRef = useRef(disappearedTiles);
  const [tilePositions, setTilePositions] = useState(null);
  const [launched, setLaunched] = useState(false);

  useEffect(() => { solvedRowsRef.current = solvedRows; }, [solvedRows]);
  useEffect(() => { disappearedRef.current = disappearedTiles; }, [disappearedTiles]);

  // Initialize all tiles in their row grid layout, then launch after 1s
  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const HEADER_H = 56;
    const rowW = tilesPerRow * BOUNCE_TILE_SIZE + (tilesPerRow - 1) * BOUNCE_TILE_GAP;
    const rowSpacing = BOUNCE_TILE_SIZE + 10;
    const totalH = rows * rowSpacing - 10;
    const startX = (W - rowW) / 2;
    const startY = HEADER_H + Math.max(16, (H - HEADER_H - totalH) / 2);

    const tiles = [];
    for (let ri = 0; ri < rows; ri++) {
      for (let ti = 0; ti < tilesPerRow; ti++) {
        const isOdd = ti === colorData[ri].oddTileIndex;
        tiles.push({
          id: `${ri}-${ti}`,
          rowIndex: ri,
          tileIndex: ti,
          isOdd,
          color: isOdd ? colorData[ri].oddColor : colorData[ri].baseColor,
          x: startX + ti * (BOUNCE_TILE_SIZE + BOUNCE_TILE_GAP),
          y: startY + ri * rowSpacing,
          vx: 0,
          vy: 0,
        });
      }
    }

    tilesPhysRef.current = tiles;
    setTilePositions([...tiles]);

    const timer = setTimeout(() => {
      const base = 110 + Math.random() * 90;
      tilesPhysRef.current = tilesPhysRef.current.map(t => ({
        ...t,
        vx: (Math.random() * 2 - 1) * base * (0.6 + Math.random() * 0.8),
        vy: (Math.random() < 0.5 ? 1 : -1) * base * (0.5 + Math.random() * 0.9),
      }));
      setLaunched(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []); // component is keyed by round — remounts fresh each round

  // Physics loop: each tile bounces independently off the screen edges
  useEffect(() => {
    if (!launched) return;

    const loop = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const W = window.innerWidth;
      const H = window.innerHeight;

      tilesPhysRef.current = tilesPhysRef.current.map(tile => {
        // Don't move tiles that are solved or wrong-clicked
        if (solvedRowsRef.current[tile.rowIndex]) return tile;
        if (disappearedRef.current[tile.rowIndex]?.includes(tile.tileIndex)) return tile;

        let { x, y, vx, vy } = tile;
        x += vx * dt;
        y += vy * dt;

        if (x < 0) { x = 0; vx = Math.abs(vx); }
        if (x + BOUNCE_TILE_SIZE > W) { x = W - BOUNCE_TILE_SIZE; vx = -Math.abs(vx); }
        if (y < 0) { y = 0; vy = Math.abs(vy); }
        if (y + BOUNCE_TILE_SIZE > H) { y = H - BOUNCE_TILE_SIZE; vy = -Math.abs(vy); }

        return { ...tile, x, y, vx, vy };
      });

      setTilePositions([...tilesPhysRef.current]);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [launched]);

  return (
    <div className="bouncing-fullscreen">
      <div className="endless-header bouncing-header-overlay">
        <span className="endless-round">Round {round}</span>
        <span className="endless-strikes">Strikes: {strikes} / {maxStrikes}</span>
      </div>

      {!launched && (
        <div className="bouncing-countdown">Get ready...</div>
      )}

      {tilePositions && tilePositions.map(tile => {
        const { rowIndex, tileIndex, color, x, y, isOdd } = tile;
        const isSolved = solvedRows[rowIndex];
        const isDisappeared = disappearedTiles[rowIndex]?.includes(tileIndex);
        const inactive = isSolved || isDisappeared;

        return (
          <div
            key={tile.id}
            className={`tile${isSolved ? ' solved' : isDisappeared ? ' disappeared' : ''}`}
            style={{
              position: 'fixed',
              left: Math.round(x),
              top: Math.round(y),
              width: BOUNCE_TILE_SIZE,
              height: BOUNCE_TILE_SIZE,
              backgroundColor: inactive ? 'transparent' : color,
              cursor: inactive ? 'default' : 'pointer',
              pointerEvents: inactive ? 'none' : 'auto',
            }}
            onClick={inactive ? undefined : () => onTileClick(rowIndex, tileIndex)}
            role={inactive ? undefined : "button"}
            tabIndex={inactive ? -1 : 0}
            aria-label={isOdd ? "Odd colored tile" : "Normal tile"}
            onKeyDown={inactive ? undefined : (e) => {
              if (e.key === 'Enter' || e.key === ' ') onTileClick(rowIndex, tileIndex);
            }}
          />
        );
      })}
    </div>
  );
}

export default function EndlessMode({ onQuit }) {
  const [state, setState] = useState(freshState);

  function onTileClick(rowIndex, tileIndex) {
    if (state.gameOver) return;
    if (state.solvedRows[rowIndex]) return;

    if (tileIndex === state.colorData[rowIndex].oddTileIndex) {
      const newSolved = state.solvedRows.map((s, i) => i === rowIndex ? true : s);

      if (newSolved.every(Boolean)) {
        // Save stats for the completed round
        const roundTime = Math.round((Date.now() - state.roundStartTime) / 1000);
        const stat = {
          level: state.round,
          failed: false,
          strikes: state.strikes,
          timeSeconds: roundTime,
          averageColorDifference: state.averageDifference,
        };
        const newSmallest = Math.min(state.smallestDiffSoFar, state.levelMinDiff);
        const newSmallestExample = newSmallest < state.smallestDiffSoFar
          ? state.levelMinDiffExample
          : state.smallestDiffExampleSoFar;

        // Round cleared — next round, strikes reset
        const next = generateEndlessLevel();
        setState(prev => ({
          ...prev,
          round: prev.round + 1,
          strikes: 0,
          ...next,
          solvedRows: new Array(next.rows).fill(false),
          disappearedTiles: new Array(next.rows).fill(null).map(() => []),
          roundStartTime: Date.now(),
          completedRoundStats: [...prev.completedRoundStats, stat],
          smallestDiffSoFar: newSmallest,
          smallestDiffExampleSoFar: newSmallestExample,
        }));
      } else {
        setState(prev => ({ ...prev, solvedRows: newSolved }));
      }
    } else {
      const newDisappeared = state.disappearedTiles.map((row, i) =>
        i === rowIndex && !row.includes(tileIndex) ? [...row, tileIndex] : row
      );
      const newStrikes = state.strikes + 1;

      if (newStrikes >= MAX_STRIKES) {
        // Build the full stats object for the stats screen
        const roundTime = Math.round((Date.now() - state.roundStartTime) / 1000);
        const failedStat = {
          level: state.round,
          failed: true,
          strikes: newStrikes,
          timeSeconds: roundTime,
          averageColorDifference: state.averageDifference,
        };
        const allLevelStats = [...state.completedRoundStats, failedStat];
        const finalSmallestDiff = Math.min(state.smallestDiffSoFar, state.levelMinDiff);
        const finalSmallestDiffExample = finalSmallestDiff < state.smallestDiffSoFar
          ? state.levelMinDiffExample
          : state.smallestDiffExampleSoFar;
        const totalTime = allLevelStats.reduce((sum, s) => sum + s.timeSeconds, 0);
        const gameOverStats = {
          levelStats: allLevelStats,
          smallestDifference: finalSmallestDiff === Infinity ? null : finalSmallestDiff,
          smallestDifferenceExample: finalSmallestDiff === Infinity ? null : finalSmallestDiffExample,
          totalTime,
        };
        setState(prev => ({
          ...prev,
          disappearedTiles: newDisappeared,
          strikes: newStrikes,
          gameOver: true,
          gameOverStats,
        }));
      } else {
        setState(prev => ({
          ...prev,
          disappearedTiles: newDisappeared,
          strikes: newStrikes,
        }));
      }
    }
  }

  if (state.gameOver && state.gameOverStats) {
    return (
      <GameStats
        stats={state.gameOverStats}
        isEndless={true}
        onPlayAgain={() => setState(freshState())}
        onQuit={onQuit}
      />
    );
  }

  return (
    <div className="endless-container">
      <div className="endless-header">
        <span className="endless-round">Round {state.round}</span>
        <span className="endless-strikes">Strikes: {state.strikes} / {MAX_STRIKES}</span>
      </div>

      {state.levelType === 'bouncing' ? (
        <BouncingLevelGame
          key={state.round}
          round={state.round}
          strikes={state.strikes}
          maxStrikes={MAX_STRIKES}
          rows={state.rows}
          tilesPerRow={state.tilesPerRow}
          colorData={state.colorData}
          solvedRows={state.solvedRows}
          disappearedTiles={state.disappearedTiles}
          onTileClick={onTileClick}
        />
      ) : (
        <div className="endless-tile-grid">
          {state.colorData.map((row, i) => {
            const cfg = ROW_CONFIGS[i % ROW_CONFIGS.length];
            return (
              <ScrollingTileRow
                key={`${state.round}-${i}`}
                rowIndex={i}
                tilesPerRow={state.tilesPerRow}
                baseColor={row.baseColor}
                oddColor={row.oddColor}
                oddTileIndex={row.oddTileIndex}
                solved={state.solvedRows[i]}
                disappearedTiles={state.disappearedTiles[i] || []}
                onTileClick={onTileClick}
                speed={cfg.speed}
                direction={cfg.direction}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
