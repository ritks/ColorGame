import React, { useMemo } from "react";

const COLORS = [
  "#00fff0", "#ff2975", "#ffd000", "#00ff77", "#7b68ee",
  "#ff8800", "#00c8ff", "#ff4444", "#a0ff00", "#ff66cc",
  "#00fff0", "#ffd000", "#ff2975", "#00ff77", "#7b68ee",
];

function generateRow(seed) {
  const colors = [];
  // 20 tiles per logical row; we'll render 2x for seamless wrap
  for (let i = 0; i < 20; i++) {
    colors.push(COLORS[(seed * 7 + i * 3) % COLORS.length]);
  }
  return colors;
}

const ROWS = [
  { speed: 18, direction: 1 },
  { speed: 24, direction: -1 },
  { speed: 14, direction: 1 },
  { speed: 20, direction: -1 },
  { speed: 16, direction: 1 },
];

export default function TileCarousel() {
  const rows = useMemo(() =>
    ROWS.map((cfg, idx) => ({
      ...cfg,
      colors: generateRow(idx),
    })),
  []);

  return (
    <div className="carousel-wrapper">
      {rows.map((row, rowIdx) => {
        // Duplicate tiles for seamless loop
        const tiles = [...row.colors, ...row.colors];
        return (
          <div key={rowIdx} className="carousel-track-clip">
            <div
              className="carousel-track"
              style={{
                animationDuration: `${row.speed}s`,
                animationDirection: row.direction === -1 ? "reverse" : "normal",
              }}
            >
              {tiles.map((color, i) => (
                <div
                  key={i}
                  className="carousel-tile"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
