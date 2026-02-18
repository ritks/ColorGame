import React, { useState, useEffect } from "react";

// Use the same API base URL configuration as api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export default function AggregateStats({ user, onBack }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats/aggregate`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="stats-container">
        <h2>Loading Your Statistics...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-container">
        <h2>Error Loading Statistics</h2>
        <p>{error}</p>
        <button onClick={onBack} className="back-button">Back</button>
      </div>
    );
  }

  const { overall, best, byLevel, recent } = stats;

  return (
    <div className="aggregate-stats-container">
      <div className="stats-header">
        <h2>Your Gaming Journey</h2>
        <p>Welcome back, {user.username}! Here's your complete gaming history:</p>
        <button onClick={onBack} className="back-button">Back to Menu</button>
      </div>

      {/* Overall Statistics */}
      <div className="stats-section">
        <h3>Overall Performance</h3>
        <div className="stats-grid large-grid">
          <div className="stat-card">
            <div className="stat-number">{overall.total_games}</div>
            <div className="stat-label">Games Played</div>
          </div>
          <div className="stat-card success">
            <div className="stat-number">{overall.games_won}</div>
            <div className="stat-label">Games Won</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{overall.games_won > 0 ? Math.round((overall.games_won / overall.total_games) * 100) : 0}%</div>
            <div className="stat-label">Win Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{Math.round(overall.avg_levels_per_game * 10) / 10}</div>
            <div className="stat-label">Avg Levels/Game</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{formatTime(overall.total_time_played)}</div>
            <div className="stat-label">Total Time Played</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{overall.total_strikes}</div>
            <div className="stat-label">Total Strikes</div>
          </div>
        </div>
      </div>

      {/* Best Performances */}
      {best.fastest_completion && (
        <div className="stats-section">
          <h3>Personal Bests</h3>
          <div className="stats-grid">
            <div className="stat-card highlight">
              <div className="stat-number">{formatTime(best.fastest_completion)}</div>
              <div className="stat-label">Fastest Completion</div>
            </div>
            <div className="stat-card highlight">
              <div className="stat-number">{best.fewest_strikes_completion}</div>
              <div className="stat-label">Fewest Strikes</div>
            </div>
            <div className="stat-card highlight">
              <div className="stat-number">{overall.hardest_challenge_faced ? Math.round(overall.hardest_challenge_faced * 10) / 10 : 'N/A'}%</div>
              <div className="stat-label">Hardest Challenge Faced</div>
            </div>
          </div>
        </div>
      )}

      {/* Level Performance */}
      {byLevel.length > 0 && (
        <div className="stats-section">
          <h3>Level-by-Level Performance</h3>
          <div className="level-performance-table">
            <div className="table-header">
              <span>Level</span>
              <span>Played</span>
              <span>Success Rate</span>
              <span>Avg Time</span>
              <span>Avg Strikes</span>
            </div>
            {byLevel.map((level) => (
              <div key={level.level_number} className="table-row">
                <span>Level {level.level_number}</span>
                <span>{level.times_played}</span>
                <span className={level.success_rate >= 80 ? 'success-rate high' : level.success_rate >= 50 ? 'success-rate medium' : 'success-rate low'}>
                  {Math.round(level.success_rate)}%
                </span>
                <span>{formatTime(Math.round(level.avg_time))}</span>
                <span>{Math.round(level.avg_strikes * 10) / 10}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Games */}
      {recent.length > 0 && (
        <div className="stats-section">
          <h3>Recent Games</h3>
          <div className="recent-games">
            {recent.map((game, index) => (
              <div key={index} className={`recent-game ${game.game_completed ? 'completed' : 'failed'}`}>
                <div className="game-info">
                  <span className="game-date">{formatDate(game.started_at)}</span>
                  <span className={`game-result ${game.game_completed ? 'won' : 'lost'}`}>
                    {game.game_completed ? 'Won' : 'Lost'}
                  </span>
                </div>
                <div className="game-details">
                  <span>Level {game.levels_completed}/10</span>
                  <span>{formatTime(game.total_time_seconds)}</span>
                  <span>{game.total_strikes} strikes</span>
                  {game.smallest_difference && (
                    <span>Hardest: {Math.round(game.smallest_difference * 10) / 10}%</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-footer">
        <button onClick={onBack} className="play-again-button">
          Ready for Another Game?
        </button>
      </div>
    </div>
  );
}