import React, { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import Game from "./Game";
import AuthForm from "./AuthForm";
import AggregateStats from "./AggregateStats";
import TileCarousel from "./TileCarousel";
import EndlessMode from "./EndlessMode";
import MixGame from "./MixGame";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('menu');
  const [prevGameStats, setPrevGameStats] = useState(null);

  useEffect(() => { checkAuthStatus(); }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      // not authenticated
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (userData) => { setUser(userData); setCurrentView('menu'); };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
      setUser(null);
      setCurrentView('menu');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const backToMenu = () => { setPrevGameStats(null); setCurrentView('menu'); };
  const startEndless = (stats = null) => { setPrevGameStats(stats); setCurrentView('endless'); };

  let content;

  if (loading) {
    content = (
      <div className="app-container">
        <h1>Color Games</h1>
        <p>Loading...</p>
      </div>
    );
  } else if (currentView === 'auth') {
    content = <AuthForm onAuthSuccess={handleAuthSuccess} onPlayAsGuest={() => setCurrentView('menu')} />;
  } else if (currentView === 'game') {
    content = <Game onQuit={backToMenu} onPlayEndless={startEndless} />;
  } else if (currentView === 'endless') {
    content = <EndlessMode onQuit={backToMenu} prevGameStats={prevGameStats} />;
  } else if (currentView === 'mix') {
    content = <MixGame onQuit={backToMenu} />;
  } else if (currentView === 'stats' && user) {
    content = <AggregateStats user={user} onBack={backToMenu} />;
  } else {
    content = (
      <div className="app-container">
        <div className="header">
          <h1>Color Games</h1>
          {user ? (
            <div className="user-info">
              <span>Welcome, {user.username}!</span>
              <button onClick={handleLogout} className="logout-button">Logout</button>
            </div>
          ) : (
            <div className="auth-prompt">
              <button className="auth-link-btn" onClick={() => setCurrentView('auth')}>Sign In / Register</button>
            </div>
          )}
        </div>

        {/* Game cards */}
        <div className="hub-cards">
          {/* Color Tile */}
          <div className="hub-card">
            <TileCarousel />
            <div className="hub-card-body">
              <h2 className="hub-card-title">Color Tile</h2>
              <p className="hub-card-desc">
                Find the odd-colored tile in each row. 10 levels, 3 strikes.
              </p>
              <div className="hub-card-buttons">
                <button className="menu-button primary" onClick={() => setCurrentView('game')}>
                  Play
                </button>
                <button className="menu-button tertiary" onClick={() => startEndless()}>
                  Endless
                </button>
              </div>
            </div>
          </div>

          {/* Color Mix */}
          <div className="hub-card">
            <div className="hub-mix-preview">
              <div className="hub-mix-swatch" style={{ background: "hsl(10, 80%, 50%)" }} />
              <span className="hub-mix-plus">+</span>
              <div className="hub-mix-swatch" style={{ background: "hsl(220, 75%, 45%)" }} />
              <span className="hub-mix-arrow">→</span>
              <div className="hub-mix-swatch" style={{ background: "hsl(320, 30%, 38%)" }} />
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">Color Mix</h2>
              <p className="hub-card-desc">
                Memorize two colors, then dial in their 50/50 mix from memory. 6 rounds.
              </p>
              <div className="hub-card-buttons">
                <button className="menu-button primary" onClick={() => setCurrentView('mix')}>
                  Play
                </button>
              </div>
            </div>
          </div>
        </div>

        {user && (
          <button className="menu-button secondary" style={{ display: 'block', margin: '0 auto', maxWidth: 320 }} onClick={() => setCurrentView('stats')}>
            View Statistics
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <Analytics />
      {content}
    </>
  );
}
