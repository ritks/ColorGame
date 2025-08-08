function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70;
  const lightness = 50;
  return { hue, saturation, lightness };
}

function generateLevel(level) {
  const rows = 4 + (level - 1); // increase rows per level
  const tilesPerRow = 10;
  const colorDifference = Math.max(3, 20 - level); // difference shrinks each level

  const colorData = [];

  for (let i = 0; i < rows; i++) {
    const base = getRandomColor();
    const oddTileIndex = Math.floor(Math.random() * tilesPerRow);
    const oddLightness = base.lightness + (Math.random() < 0.5 ? -colorDifference : colorDifference);

    colorData.push({
      baseColor: `hsl(${base.hue}, ${base.saturation}%, ${base.lightness}%)`,
      oddColor: `hsl(${base.hue}, ${base.saturation}%, ${oddLightness}%)`,
      oddTileIndex
    });
  }

  return { rows, tilesPerRow, colorData };
}

export { generateLevel };
