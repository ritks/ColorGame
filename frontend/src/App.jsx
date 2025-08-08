import React, { useState } from "react";
import Game from "./Game";

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className="app-container">
      <h1>Color Tile Game</h1>
      {!started && (
        <button className="start-button" onClick={() => setStarted(true)}>
          Start Game
        </button>
      )}
      {started && <Game onQuit={() => setStarted(false)} />}
    </div>
  );
}
