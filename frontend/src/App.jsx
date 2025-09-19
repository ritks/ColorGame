import React, { useState, useEffect } from "react";
import Game from "./Game";
import AuthForm from "./AuthForm";
import AggregateStats from "./AggregateStats";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'auth', 'game', 'stats'

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      // User not authenticated, that's fine
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setCurrentView('menu');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      setCurrentView('menu');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const startGame = () => {
    setCurrentView('game');
  };

  const showAuth = () => {
    setCurrentView('auth');
  };

  const showStats = () => {
    setCurrentView('stats');
  };

  const backToMenu = () => {
    setCurrentView('menu');
  };

  const playAsGuest = () => {
    setCurrentView('game');
  };

  if (loading) {
    return (
      <div className="app-container">
        <h1>Color Tile Game</h1>
        <p>Loading...</p>
      </div>
    );
  }

  // Authentication view
  if (currentView === 'auth') {
    return <AuthForm onAuthSuccess={handleAuthSuccess} onPlayAsGuest={playAsGuest} />;
  }

  // Game view
  if (currentView === 'game') {
    return <Game onQuit={backToMenu} />;
  }

  // Statistics view
  if (currentView === 'stats' && user) {
    return <AggregateStats user={user} onBack={backToMenu} />;
  }

  // Main menu
  return (
    <div className="app-container">
      <div className="header">
        <h1>🎨 Color Tile Game</h1>
        {user ? (
          <div className="user-info">
            <span>Welcome back, {user.username}!</span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-prompt">
            <span>Sign in to track your progress!</span>
          </div>
        )}
      </div>

      <div className="menu-container">
        <div className="menu-buttons">
          <button className="menu-button primary" onClick={startGame}>
            🎮 Start New Game
          </button>
          
          {user ? (
            <button className="menu-button secondary" onClick={showStats}>
              📊 View Statistics
            </button>
          ) : (
            <button className="menu-button secondary" onClick={showAuth}>
              👤 Sign In / Register
            </button>
          )}
          
          {!user && (
            <button className="menu-button tertiary" onClick={playAsGuest}>
              🎯 Play as Guest
            </button>
          )}
        </div>

        <div className="game-description">
          <h3>How to Play</h3>
          <p>
            Find the tile that's slightly different in color from the others in each row. 
            You have 3 strikes per game and 10 levels to complete. 
            Each level gets progressively harder with more subtle color differences!
          </p>
          
          {user && (
            <div className="user-benefits">
              <h4>✨ Signed In Benefits:</h4>
              <ul>
                <li>🏆 Track your progress across all games</li>
                <li>📈 View detailed performance statistics</li>
                <li>🎯 See your personal bests and hardest challenges</li>
                <li>📊 Analyze your performance by level</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}