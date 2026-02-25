import React, { useState } from "react";

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

    colorData.push({
      baseColor: `hsl(${base.hue}, ${base.saturation}%, ${base.lightness}%)`,
      oddColor,
      oddTileIndex,
    });
  }

  return { rows, tilesPerRow, colorData };
}

function freshState() {
  const level = generateEndlessLevel();
  return {
    round: 1,
    strikes: 0,
    gameOver: false,
    ...level,
    solvedRows: new Array(level.rows).fill(false),
    disappearedTiles: new Array(level.rows).fill(null).map(() => []),
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

export default function EndlessMode({ onQuit }) {
  const [state, setState] = useState(freshState);

  function onTileClick(rowIndex, tileIndex) {
    if (state.gameOver) return;
    if (state.solvedRows[rowIndex]) return;

    if (tileIndex === state.colorData[rowIndex].oddTileIndex) {
      const newSolved = state.solvedRows.map((s, i) => i === rowIndex ? true : s);

      if (newSolved.every(Boolean)) {
        // Round cleared — next round, strikes reset
        const next = generateEndlessLevel();
        setState(prev => ({
          ...prev,
          round: prev.round + 1,
          strikes: 0,
          ...next,
          solvedRows: new Array(next.rows).fill(false),
          disappearedTiles: new Array(next.rows).fill(null).map(() => []),
        }));
      } else {
        setState(prev => ({ ...prev, solvedRows: newSolved }));
      }
    } else {
      const newDisappeared = state.disappearedTiles.map((row, i) =>
        i === rowIndex && !row.includes(tileIndex) ? [...row, tileIndex] : row
      );
      const newStrikes = state.strikes + 1;
      setState(prev => ({
        ...prev,
        disappearedTiles: newDisappeared,
        strikes: newStrikes,
        gameOver: newStrikes >= MAX_STRIKES,
      }));
    }
  }

  const roundsCompleted = state.round - 1;

  if (state.gameOver) {
    return (
      <div className="endless-over">
        <h2>Endless Mode Over</h2>
        <p className="endless-score">{roundsCompleted}</p>
        <p className="endless-score-label">
          {roundsCompleted === 1 ? "round" : "rounds"} completed
        </p>
        <div className="endless-over-buttons">
          <button className="menu-button primary" onClick={() => setState(freshState())}>
            Play Again
          </button>
          <button className="menu-button secondary" onClick={onQuit}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="endless-container">
      <div className="endless-header">
        <span className="endless-round">Round {state.round}</span>
        <span className="endless-strikes">Strikes: {state.strikes} / {MAX_STRIKES}</span>
      </div>
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
    </div>
  );
}
