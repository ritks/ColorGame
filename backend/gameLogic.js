function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70;
  const lightness = 50;
  return { hue, saturation, lightness };
}

function generateLevel(level) {
  // Moderate row increase - starts at 4, increases steadily
  const rows = 4 + Math.floor((level - 1) * 0.8); // 4, 4, 5, 6, 7, 8, 9, 10, 11, 12
  
  // More tiles per row at higher levels
  const tilesPerRow = Math.min(10 + Math.floor(level / 3), 15); // 10→11→12→13→14→15 max
  
  // Much more aggressive color difference reduction
  const colorDifference = Math.max(1, Math.floor(25 - (level * 2.5))); // 22.5→20→17.5→15→12.5→10→7.5→5→2.5→1
  
  const colorData = [];
  const rowDifferences = [];

  for (let i = 0; i < rows; i++) {
    const base = getRandomColor();
    const oddTileIndex = Math.floor(Math.random() * tilesPerRow);
    
    // Vary the difficulty within a level - some rows harder than others
    const rowDifficultyMultiplier = Math.random() * 0.5 + 0.75; // 0.75 to 1.25
    const adjustedColorDiff = Math.max(1, Math.floor(colorDifference * rowDifficultyMultiplier));
    
    // Sometimes make the difference in saturation instead of lightness (harder to spot)
    const usesSaturationDiff = level > 3 && Math.random() < 0.3; // 30% chance after level 3
    
    let oddColor;
    let actualDifference;
    if (usesSaturationDiff) {
      const direction = Math.random() < 0.5 ? -1 : 1;
      const targetSaturation = base.saturation + (adjustedColorDiff * direction);
      const clampedSaturation = Math.max(10, Math.min(90, targetSaturation));
      actualDifference = Math.abs(clampedSaturation - base.saturation);
      oddColor = `hsl(${base.hue}, ${clampedSaturation}%, ${base.lightness}%)`;
    } else {
      const direction = Math.random() < 0.5 ? -1 : 1;
      const targetLightness = base.lightness + (adjustedColorDiff * direction);
      const clampedLightness = Math.max(10, Math.min(90, targetLightness));
      actualDifference = Math.abs(clampedLightness - base.lightness);
      oddColor = `hsl(${base.hue}, ${base.saturation}%, ${clampedLightness}%)`;
    }

    rowDifferences.push(actualDifference);

    colorData.push({
      baseColor: `hsl(${base.hue}, ${base.saturation}%, ${base.lightness}%)`,
      oddColor: oddColor,
      oddTileIndex,
      colorDifference: actualDifference,
      usesSaturationDiff
    });
  }

  const smallestRowDifference = Math.min(...rowDifferences);
  const smallestDiffRowIndex = rowDifferences.indexOf(smallestRowDifference);
  
  return { 
    rows, 
    tilesPerRow, 
    colorData,
    averageColorDifference: rowDifferences.reduce((sum, diff) => sum + diff, 0) / rowDifferences.length,
    smallestRowDifference,
    difficultyExample: {
      baseColor: colorData[smallestDiffRowIndex].baseColor,
      oddColor: colorData[smallestDiffRowIndex].oddColor,
      difference: smallestRowDifference,
      usesSaturationDiff: colorData[smallestDiffRowIndex].usesSaturationDiff
    }
  };
}

export { generateLevel };