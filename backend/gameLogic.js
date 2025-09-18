function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70;
  const lightness = 50;
  return { hue, saturation, lightness };
}

function generateLevel(level) {
  // More aggressive row increase - starts at 4, increases faster
  const rows = 4 + Math.floor((level - 1) * 0.8); // 4, 5, 6, 7, 9, 10, 11, 12, 14, 15
  
  // More tiles per row at higher levels
  const tilesPerRow = Math.min(10 + Math.floor(level / 3), 15); // 10→11→12→13→14→15 max
  
  // Much more aggressive color difference reduction
  const colorDifference = Math.max(1, Math.floor(25 - (level * 2.5))); // 22.5→20→17.5→15→12.5→10→7.5→5→2.5→1
  
  const colorData = [];

  for (let i = 0; i < rows; i++) {
    const base = getRandomColor();
    const oddTileIndex = Math.floor(Math.random() * tilesPerRow);
    
    // Vary the difficulty within a level - some rows harder than others
    const rowDifficultyMultiplier = Math.random() * 0.5 + 0.75; // 0.75 to 1.25
    const adjustedColorDiff = Math.max(1, Math.floor(colorDifference * rowDifficultyMultiplier));
    
    // Sometimes make the difference in saturation instead of lightness (harder to spot)
    const usesSaturationDiff = level > 3 && Math.random() < 0.3; // 30% chance after level 3
    
    let oddColor;
    if (usesSaturationDiff) {
      const oddSaturation = Math.max(10, Math.min(90, base.saturation + (Math.random() < 0.5 ? -adjustedColorDiff : adjustedColorDiff)));
      oddColor = `hsl(${base.hue}, ${oddSaturation}%, ${base.lightness}%)`;
    } else {
      const oddLightness = Math.max(10, Math.min(90, base.lightness + (Math.random() < 0.5 ? -adjustedColorDiff : adjustedColorDiff)));
      oddColor = `hsl(${base.hue}, ${base.saturation}%, ${oddLightness}%)`;
    }

    colorData.push({
      baseColor: `hsl(${base.hue}, ${base.saturation}%, ${base.lightness}%)`,
      oddColor: oddColor,
      oddTileIndex
    });
  }

  return { rows, tilesPerRow, colorData };
}

export { generateLevel };