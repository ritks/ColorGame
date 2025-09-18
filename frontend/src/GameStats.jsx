import React from "react";

export default function GameStats({ stats, onPlayAgain }) {
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

  return (
    <div className="stats-container">
      <h2>🎉 Game Statistics</h2>
      
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
            <span>Time</span>
            <span>Strikes</span>
            <span>Avg Difficulty</span>
            <span>Status</span>
          </div>
          {levelStats.map((level, index) => (
            <div key={index} className={`table-row ${level.failed ? 'failed-level' : ''}`}>
              <span>{level.level}</span>
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