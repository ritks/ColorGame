function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70;
  const lightness = 50;
  return { hue, saturation, lightness };
}

function generateLevel(level) {
  // Gradual row increase - starts at 3, tops out at 8
  const rows = 3 + Math.floor((level - 1) * 0.6); // 3, 3, 4, 4, 5, 6, 6, 7, 7, 8

  // Modest tiles per row increase
  const tilesPerRow = Math.min(9 + Math.floor(level / 4), 12); // 9→9→9→10→10→10→10→11→11→11→11 max

  // Gradual color difference reduction - minimum 10 so level 10 stays visible
  const colorDifference = Math.max(10, Math.floor(28 - (level * 1.8))); // 26→24→22→20→19→17→15→13→11→10
  
  const colorData = [];
  const rowDifferences = [];

  for (let i = 0; i < rows; i++) {
    const base = getRandomColor();
    const oddTileIndex = Math.floor(Math.random() * tilesPerRow);
    
    // Vary the difficulty within a level - some rows harder than others
    const rowDifficultyMultiplier = Math.random() * 0.3 + 0.85; // 0.85 to 1.15
    const adjustedColorDiff = Math.max(1, Math.floor(colorDifference * rowDifficultyMultiplier));

    // Sometimes make the difference in saturation instead of lightness (harder to spot)
    const usesSaturationDiff = level > 5 && Math.random() < 0.25; // 25% chance after level 5
    
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