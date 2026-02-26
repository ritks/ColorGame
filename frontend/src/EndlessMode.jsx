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
const TILE_RADIUS = BOUNCE_TILE_SIZE / 2; // 18 — tiles are circles

// Physics constants
const GRAVITY           = 120;  // px/s² — low enough that tiles can bounce up through the pile
const WALL_RESTITUTION  = 0.72; // energy kept on side-wall / ceiling bounce
const FLOOR_RESTITUTION = 0.80; // energy kept on floor bounce
const MIN_FLOOR_SPEED   = 290;  // px/s — minimum upward speed after a floor hit
const BALL_RESTITUTION  = 0.88; // energy kept in normal ball-ball impulse
const MAX_SPEED         = 680;  // px/s hard cap to prevent runaway
// Random kick magnitudes injected on each surface/ball interaction
const FLOOR_RAND_KICK   = 220;  // ±horizontal px/s added on every floor bounce
const WALL_RAND_KICK    = 130;  // ±perpendicular px/s added on every wall/ceiling bounce
const BALL_RAND_KICK    = 150;  // ±perpendicular px/s added on every ball-ball collision

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
    setTilePositions(tiles.map(t => ({ ...t })));

    const timer = setTimeout(() => {
      // Give each tile a random launch direction and speed
      const ts = tilesPhysRef.current;
      for (let i = 0; i < ts.length; i++) {
        const speed = 230 + Math.random() * 220;
        const angle = Math.random() * 2 * Math.PI;
        ts[i].vx = Math.cos(angle) * speed;
        ts[i].vy = Math.sin(angle) * speed;
      }
      setLaunched(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []); // component is keyed by round — remounts fresh each round

  // Physics loop: gravity + wall damping + ball-ball collisions
  useEffect(() => {
    if (!launched) return;

    const loop = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const tiles = tilesPhysRef.current;
      const solved = solvedRowsRef.current;
      const gone = disappearedRef.current;

      // ── Phase 1: gravity, integrate position, wall collisions ──────────
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (solved[t.rowIndex] || gone[t.rowIndex]?.includes(t.tileIndex)) continue;

        t.vy += GRAVITY * dt;
        t.x  += t.vx * dt;
        t.y  += t.vy * dt;

        // Left / right walls — reflect + random vertical scatter
        if (t.x < 0) {
          t.x = 0;
          t.vx = Math.abs(t.vx) * WALL_RESTITUTION;
          t.vy += (Math.random() - 0.5) * WALL_RAND_KICK;
        } else if (t.x + BOUNCE_TILE_SIZE > W) {
          t.x = W - BOUNCE_TILE_SIZE;
          t.vx = -Math.abs(t.vx) * WALL_RESTITUTION;
          t.vy += (Math.random() - 0.5) * WALL_RAND_KICK;
        }

        // Ceiling — reflect + random horizontal scatter
        if (t.y < 0) {
          t.y = 0;
          t.vy = Math.abs(t.vy) * WALL_RESTITUTION;
          t.vx += (Math.random() - 0.5) * WALL_RAND_KICK;
        }

        // Floor — guaranteed upward bounce + large random horizontal kick to break clusters
        if (t.y + BOUNCE_TILE_SIZE > H) {
          t.y = H - BOUNCE_TILE_SIZE;
          t.vy = -Math.max(Math.abs(t.vy) * FLOOR_RESTITUTION, MIN_FLOOR_SPEED);
          t.vx += (Math.random() - 0.5) * FLOOR_RAND_KICK;
        }

        // Hard speed cap
        const spd = Math.sqrt(t.vx * t.vx + t.vy * t.vy);
        if (spd > MAX_SPEED) {
          t.vx = (t.vx / spd) * MAX_SPEED;
          t.vy = (t.vy / spd) * MAX_SPEED;
        }
      }

      // ── Phase 2: ball-ball collision response ──────────────────────────
      const DIAM = BOUNCE_TILE_SIZE; // = 2 * TILE_RADIUS
      for (let i = 0; i < tiles.length - 1; i++) {
        const a = tiles[i];
        if (solved[a.rowIndex] || gone[a.rowIndex]?.includes(a.tileIndex)) continue;

        for (let j = i + 1; j < tiles.length; j++) {
          const b = tiles[j];
          if (solved[b.rowIndex] || gone[b.rowIndex]?.includes(b.tileIndex)) continue;

          const dx = (b.x + TILE_RADIUS) - (a.x + TILE_RADIUS);
          const dy = (b.y + TILE_RADIUS) - (a.y + TILE_RADIUS);
          const distSq = dx * dx + dy * dy;

          if (distSq >= DIAM * DIAM || distSq < 0.0001) continue;

          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart so circles no longer overlap
          const push = (DIAM - dist) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;

          // Relative velocity along collision normal
          const relV = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (relV <= 0) continue; // already separating

          // Equal-mass impulse with restitution along the collision normal
          const impulse = relV * (1 + BALL_RESTITUTION) * 0.5;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;

          // Random perpendicular kick — breaks up the ordered layer that forms
          // under gravity by adding chaos on every collision.
          // Momentum is conserved: a gets +kick, b gets -kick along the perp axis.
          const px = -ny, py = nx; // unit perpendicular to collision normal
          const kick = (Math.random() - 0.5) * BALL_RAND_KICK;
          a.vx += kick * px;  a.vy += kick * py;
          b.vx -= kick * px;  b.vy -= kick * py;

          // Re-cap speeds after collision
          const spdA = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
          if (spdA > MAX_SPEED) { a.vx = (a.vx / spdA) * MAX_SPEED; a.vy = (a.vy / spdA) * MAX_SPEED; }
          const spdB = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (spdB > MAX_SPEED) { b.vx = (b.vx / spdB) * MAX_SPEED; b.vy = (b.vy / spdB) * MAX_SPEED; }
        }
      }

      // Snapshot mutable state into new objects so React reconciles correctly
      setTilePositions(tiles.map(t => ({ ...t })));
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
