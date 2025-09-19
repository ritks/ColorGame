import React from "react";

export default function TileRow({
  rowIndex,
  tilesPerRow,
  baseColor,
  oddColor,
  oddTileIndex,
  solved,
  onTileClick,
  disappearedTiles = [] // New prop to track disappeared tiles
}) {
  const tiles = [];

  for (let i = 0; i < tilesPerRow; i++) {
    const color = i === oddTileIndex ? oddColor : baseColor;
    const isDisappeared = disappearedTiles.includes(i);
    
    tiles.push(
      <div
        key={i}
        className={`tile ${solved ? "solved" : ""} ${isDisappeared ? "disappeared" : ""}`}
        style={{ 
          backgroundColor: isDisappeared ? "#000000" : color, // Background color when disappeared
          transition: "background-color 0.3s ease-out, opacity 0.3s ease-out"
        }}
        onClick={() => onTileClick(rowIndex, i)}
        role="button"
        tabIndex={0}
        aria-label={i === oddTileIndex ? "Odd colored tile" : "Normal tile"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onTileClick(rowIndex, i);
          }
        }}
      />
    );
  }

  return <div className="tile-row">{tiles}</div>;
}