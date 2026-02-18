import React, { useState } from "react";

export default function GameStats({ stats, onPlayAgain }) {
  const [shareMessage, setShareMessage] = useState('');

  if (!stats) return null;

  const { levelStats, smallestDifference, smallestDifferenceExample, totalTime } = stats;
  const completedLevels = levelStats.filter(level => !level.failed);
  const totalStrikes = levelStats.reduce((sum, level) => sum + level.strikes, 0);
  const averageTimePerLevel = completedLevels.length > 0
    ? completedLevels.reduce((sum, level) => sum + level.timeSeconds, 0) / completedLevels.length
    : 0;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getDifficultyDescription = (difference, usesSaturationDiff) => {
    const type = usesSaturationDiff ? "saturation" : "lightness";
    if (difference <= 2) return `Extremely Hard (${difference}% ${type})`;
    if (difference <= 5) return `Very Hard (${difference}% ${type})`;
    if (difference <= 10) return `Hard (${difference}% ${type})`;
    if (difference <= 15) return `Medium (${difference}% ${type})`;
    return `Easy (${difference}% ${type})`;
  };

  const generateShareText = () => {
    const gameWon = completedLevels.length === 10;
    const levelsCompleted = completedLevels.length;

    let shareText = `Color Tile Game ${gameWon ? 'Complete!' : `${levelsCompleted}/10`}\n`;
    shareText += `${formatTime(totalTime)} | ${totalStrikes} strikes\n`;

    if (smallestDifference && smallestDifference !== Infinity) {
      shareText += `Hardest: ${Math.round(smallestDifference * 10) / 10}% difference\n`;
    }

    shareText += '\n';

    levelStats.forEach((level, index) => {
      const levelEmoji = getLevelEmoji(level);
      shareText += levelEmoji;

      if ((index + 1) % 5 === 0) {
        shareText += '\n';
      }
    });

    if (levelStats.length % 5 !== 0) {
      shareText += '\n';
    }

    shareText += '\nPlay at: [Your Game URL]';

    return shareText;
  };

  const getLevelEmoji = (level) => {
    if (level.failed) {
      return 'X';
    }
    if (level.strikes === 0) {
      return '*';
    } else if (level.strikes === 1) {
      return 'o';
    } else if (level.strikes === 2) {
      return '-';
    } else {
      return '.';
    }
  };

  const getLevelIndicator = (level) => {
    if (level.failed) {
      return <span className="level-indicator level-fail" />;
    }
    if (level.strikes === 0) {
      return <span className="level-indicator level-perfect" />;
    } else if (level.strikes === 1) {
      return <span className="level-indicator level-good" />;
    } else if (level.strikes === 2) {
      return <span className="level-indicator level-ok" />;
    } else {
      return <span className="level-indicator level-close" />;
    }
  };

  const copyShareText = async () => {
    const text = generateShareText();

    try {
      await navigator.clipboard.writeText(text);
      setShareMessage('Copied to clipboard');
      setTimeout(() => setShareMessage(''), 3000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();

      try {
        document.execCommand('copy');
        setShareMessage('Copied to clipboard');
      } catch (fallbackErr) {
        setShareMessage('Copy failed. Please select and copy manually.');
        alert(text);
      }

      document.body.removeChild(textArea);
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  const copyColoredShare = async () => {
    let coloredText = generateShareText();

    if (smallestDifferenceExample) {
      coloredText += `\nHardest colors: ${smallestDifferenceExample.baseColor} vs ${smallestDifferenceExample.oddColor}`;
    }

    try {
      await navigator.clipboard.writeText(coloredText);
      setShareMessage('Colored version copied');
      setTimeout(() => setShareMessage(''), 3000);
    } catch (err) {
      setShareMessage('Copy failed - try the regular version');
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  const shareAsImage = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 400;
    canvas.height = 300;

    ctx.fillStyle = '#111116';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';

    const gameWon = completedLevels.length === 10;
    ctx.fillText(`Color Tile Game ${gameWon ? 'Complete!' : `${completedLevels.length}/10`}`, 200, 40);

    ctx.font = '16px Arial';
    ctx.fillText(`${formatTime(totalTime)} | ${totalStrikes} strikes`, 200, 70);

    if (smallestDifference && smallestDifference !== Infinity) {
      ctx.fillText(`Hardest: ${Math.round(smallestDifference * 10) / 10}% difference`, 200, 100);
    }

    // Draw color challenge if available
    if (smallestDifferenceExample) {
      ctx.fillStyle = '#a0a0b0';
      ctx.font = '14px Arial';
      ctx.fillText('Hardest Challenge:', 200, 150);

      const baseColor = smallestDifferenceExample.baseColor;
      const oddColor = smallestDifferenceExample.oddColor;

      ctx.fillStyle = baseColor;
      ctx.fillRect(150, 165, 30, 30);

      ctx.fillStyle = '#454560';
      ctx.font = '12px Arial';
      ctx.fillText('vs', 200, 185);

      ctx.fillStyle = oddColor;
      ctx.fillRect(220, 165, 30, 30);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${Math.round(smallestDifference * 10) / 10}% diff`, 200, 220);
    }

    canvas.toBlob(async (blob) => {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'color-game-result.png', { type: 'image/png' })] })) {
        try {
          await navigator.share({
            title: 'My Color Tile Game Result',
            files: [new File([blob], 'color-game-result.png', { type: 'image/png' })]
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            copyColoredShare();
          }
        }
      } else {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setShareMessage('Image copied to clipboard');
          setTimeout(() => setShareMessage(''), 3000);
        } catch (err) {
          copyColoredShare();
        }
      }
    }, 'image/png');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Color Tile Game Result',
          text: generateShareText(),
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyShareText();
        }
      }
    } else {
      copyShareText();
    }
  };

  return (
    <div className="stats-container">
      <h2>Game Statistics</h2>

      {/* Share Section */}
      <div className="stats-section">
        <h3>Share Your Result</h3>
        <div className="share-text-content">
          Color Tile Game {completedLevels.length === 10 ? 'Complete!' : `${completedLevels.length}/10`}<br/>
          {formatTime(totalTime)} | {totalStrikes} strikes<br/>
          {smallestDifference && smallestDifference !== Infinity && (
            <>Hardest: {Math.round(smallestDifference * 10) / 10}% difference</>
          )}
        </div>

        <div className="share-buttons">
          <button onClick={shareNative} className="share-button primary">
            Share Result
          </button>
          <button onClick={copyColoredShare} className="share-button secondary">
            Copy with Colors
          </button>
          <button onClick={copyShareText} className="share-button tertiary">
            Copy Text Only
          </button>
          <button onClick={shareAsImage} className="share-button image">
            Share as Image
          </button>
        </div>

        {shareMessage && (
          <div className="share-message">{shareMessage}</div>
        )}
      </div>

      {/* Overall Stats */}
      <div className="stats-section">
        <h3>Overall Performance</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Levels Completed:</span>
            <span className="stat-value">{completedLevels.length}/10</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Time:</span>
            <span className="stat-value">{formatTime(totalTime)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Strikes:</span>
            <span className="stat-value">{totalStrikes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Average Time/Level:</span>
            <span className="stat-value">{formatTime(Math.round(averageTimePerLevel))}</span>
          </div>
        </div>
      </div>

      {/* Hardest Challenge */}
      {smallestDifferenceExample && (
        <div className="stats-section">
          <h3>Hardest Challenge Faced</h3>
          <p>The smallest color difference you encountered was <strong>{smallestDifference}%</strong></p>
          <p>{getDifficultyDescription(smallestDifference, smallestDifferenceExample.usesSaturationDiff)}</p>
          <div className="difficulty-example">
            <div className="example-tiles">
              <div
                className="example-tile"
                style={{ backgroundColor: smallestDifferenceExample.baseColor }}
              />
              <span className="vs-text">vs</span>
              <div
                className="example-tile odd-tile"
                style={{ backgroundColor: smallestDifferenceExample.oddColor }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Per-Level Breakdown */}
      <div className="stats-section">
        <h3>Level Breakdown</h3>
        <div className="level-stats-table">
          <div className="table-header">
            <span>Level</span>
            <span>Result</span>
            <span>Time</span>
            <span>Strikes</span>
            <span>Difficulty</span>
          </div>
          {levelStats.map((level, index) => (
            <div key={index} className={`table-row ${level.failed ? 'failed-level' : ''}`}>
              <span>{level.level}</span>
              <span className="result-cell">{getLevelIndicator(level)}</span>
              <span>{formatTime(level.timeSeconds)}</span>
              <span>{level.strikes}</span>
              <span>{Math.round(level.averageColorDifference)}%</span>
            </div>
          ))}
        </div>
      </div>

      <button className="play-again-button" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
}
