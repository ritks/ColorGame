import React from "react";

export default function TileRow({
  rowIndex,
  tilesPerRow,
  baseColor,
  oddColor,
  oddTileIndex,
  solved,
  onTileClick,
  disappearedTiles = [] // Tiles that should disappear due to wrong guesses
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
          backgroundColor: isDisappeared ? "transparent" : color
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