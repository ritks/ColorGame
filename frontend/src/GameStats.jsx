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
    
    // Header
    let shareText = `🎨 Color Tile Game ${gameWon ? 'Complete!' : `${levelsCompleted}/10`}\n`;
    shareText += `⏱️ ${formatTime(totalTime)} | ⚡ ${totalStrikes} strikes\n`;
    
    if (smallestDifference && smallestDifference !== Infinity) {
      shareText += `🎯 Hardest: ${Math.round(smallestDifference * 10) / 10}% difference\n`;
    }
    
    shareText += '\n';

    // Level-by-level representation
    levelStats.forEach((level, index) => {
      const levelEmoji = getLevelEmoji(level);
      shareText += levelEmoji;
      
      // Add newline every 5 levels for better readability
      if ((index + 1) % 5 === 0) {
        shareText += '\n';
      }
    });

    // Add final newline if needed
    if (levelStats.length % 5 !== 0) {
      shareText += '\n';
    }

    shareText += '\nPlay at: [Your Game URL]'; // Replace with actual URL
    
    return shareText;
  };

  const generateColoredShareElement = () => {
    return (
      <div className="colored-share-preview">
        <div className="share-text-content">
          🎨 Color Tile Game {completedLevels.length === 10 ? 'Complete!' : `${completedLevels.length}/10`}<br/>
          ⏱️ {formatTime(totalTime)} | ⚡ {totalStrikes} strikes<br/>
          {smallestDifference && smallestDifference !== Infinity && (
            <>🎯 Hardest: {Math.round(smallestDifference * 10) / 10}% difference<br/></>
          )}
          <br/>
          <div className="emoji-grid">
            {levelStats.map((level, index) => (
              <span key={index} className="level-emoji" title={`Level ${level.level}: ${level.failed ? 'Failed' : `${level.strikes} strikes`}`}>
                {getLevelEmoji(level)}
              </span>
            ))}
          </div>
          
          {/* Show the hardest color challenge with actual colors */}
          {smallestDifferenceExample && (
            <div className="color-challenge-display">
              <div className="challenge-label">💪 Hardest Challenge:</div>
              <div className="color-comparison">
                <div 
                  className="challenge-color normal"
                  style={{ backgroundColor: smallestDifferenceExample.baseColor }}
                  title="Normal tile color"
                />
                <span className="vs-small">vs</span>
                <div 
                  className="challenge-color different"
                  style={{ backgroundColor: smallestDifferenceExample.oddColor }}
                  title="Different tile color"
                />
                <span className="difference-text">
                  {Math.round(smallestDifference * 10) / 10}% diff
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getLevelEmoji = (level) => {
    if (level.failed) {
      return '❌'; // Failed level
    }
    
    // Success levels with performance indicators
    if (level.strikes === 0) {
      return '🟢'; // Perfect (no strikes)
    } else if (level.strikes === 1) {
      return '🟡'; // Good (1 strike)
    } else if (level.strikes === 2) {
      return '🟠'; // Okay (2 strikes)
    } else {
      return '🔴'; // Close call (3 strikes, barely made it)
    }
  };

  const copyShareText = async () => {
    const text = generateShareText();
    
    try {
      await navigator.clipboard.writeText(text);
      setShareMessage('Copied to clipboard! 📋');
      setTimeout(() => setShareMessage(''), 3000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        setShareMessage('Copied to clipboard! 📋');
      } catch (fallbackErr) {
        setShareMessage('Copy failed. Please select and copy manually.');
        // Show the text in an alert as last resort
        alert(text);
      }
      
      document.body.removeChild(textArea);
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  const copyColoredShare = async () => {
    // For colored share, we'll create a more detailed text version
    let coloredText = generateShareText();
    
    // Add color information if available
    if (smallestDifferenceExample) {
      coloredText += `\n🎨 Hardest colors: ${smallestDifferenceExample.baseColor} vs ${smallestDifferenceExample.oddColor}`;
    }
    
    try {
      await navigator.clipboard.writeText(coloredText);
      setShareMessage('Colored version copied! 🎨');
      setTimeout(() => setShareMessage(''), 3000);
    } catch (err) {
      setShareMessage('Copy failed - try the regular version');
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  const shareAsImage = async () => {
    // Create a canvas with the colored preview
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 400;
    canvas.height = 300;
    
    // Fill background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    
    const gameWon = completedLevels.length === 10;
    ctx.fillText(`🎨 Color Tile Game ${gameWon ? 'Complete!' : `${completedLevels.length}/10`}`, 200, 40);
    
    ctx.font = '16px Arial';
    ctx.fillText(`⏱️ ${formatTime(totalTime)} | ⚡ ${totalStrikes} strikes`, 200, 70);
    
    if (smallestDifference && smallestDifference !== Infinity) {
      ctx.fillText(`🎯 Hardest: ${Math.round(smallestDifference * 10) / 10}% difference`, 200, 100);
    }
    
    // Draw emoji grid
    let x = 50;
    let y = 140;
    levelStats.forEach((level, index) => {
      const emoji = getLevelEmoji(level);
      ctx.font = '24px Arial';
      ctx.fillText(emoji, x, y);
      
      x += 35;
      if ((index + 1) % 10 === 0) {
        x = 50;
        y += 40;
      }
    });
    
    // Draw color challenge if available
    if (smallestDifferenceExample) {
      ctx.fillStyle = '#cccccc';
      ctx.font = '14px Arial';
      ctx.fillText('💪 Hardest Challenge:', 200, 220);
      
      // Draw color squares
      const baseColor = smallestDifferenceExample.baseColor;
      const oddColor = smallestDifferenceExample.oddColor;
      
      ctx.fillStyle = baseColor;
      ctx.fillRect(150, 230, 30, 30);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText('vs', 200, 250);
      
      ctx.fillStyle = oddColor;
      ctx.fillRect(220, 230, 30, 30);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${Math.round(smallestDifference * 10) / 10}% diff`, 200, 280);
    }
    
    // Convert to blob and share/copy
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
        // Fallback: try to copy the image to clipboard
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setShareMessage('Image copied to clipboard! 🖼️');
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
          // User didn't abort, try clipboard instead
          copyShareText();
        }
      }
    } else {
      copyShareText();
    }
  };

  return (
    <div className="stats-container">
      <h2>🎉 Game Statistics</h2>
      
      {/* Share Section */}
      <div className="share-section">
        <h3>Share Your Result</h3>
        <div className="share-preview">
          {/* Enhanced preview with actual colors */}
          {generateColoredShareElement()}
        </div>
        
        <div className="share-buttons">
          <button onClick={shareNative} className="share-button primary">
            📱 Share Result
          </button>
          <button onClick={copyColoredShare} className="share-button secondary">
            🎨 Copy with Colors
          </button>
          <button onClick={copyShareText} className="share-button tertiary">
            📋 Copy Text Only
          </button>
          <button onClick={shareAsImage} className="share-button image">
            🖼️ Share as Image
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
            <p className="example-caption">
              Regular tile vs. "odd" tile - can you spot the difference?
            </p>
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
            <span>Avg Difficulty</span>
            <span>Status</span>
          </div>
          {levelStats.map((level, index) => (
            <div key={index} className={`table-row ${level.failed ? 'failed-level' : ''}`}>
              <span>{level.level}</span>
              <span className="emoji-cell">{getLevelEmoji(level)}</span>
              <span>{formatTime(level.timeSeconds)}</span>
              <span>{level.strikes}</span>
              <span>{Math.round(level.averageColorDifference)}%</span>
              <span>{level.failed ? '❌ Failed' : '✅ Completed'}</span>
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