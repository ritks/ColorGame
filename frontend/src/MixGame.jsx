import React, { useState, useEffect, useRef } from "react";
import { generateRounds, hslString, rgbString, scoreGuess } from "./colorUtils";

const TOTAL_ROUNDS = 6;
const MEMORIZE_SECS = 4;
const GUESS_SECS = 20;

function SliderRow({ label, value, min, max, onChange, gradient }) {
  return (
    <div className="mix-slider-row">
      <span className="mix-slider-label">{label}</span>
      <div className="mix-slider-track-wrap" style={{ background: gradient }}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="mix-slider"
        />
      </div>
      <span className="mix-slider-value">{value}</span>
    </div>
  );
}

export default function MixGame({ onQuit }) {
  const [rounds] = useState(() => generateRounds(TOTAL_ROUNDS));
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState("memorize");
  const [timeLeft, setTimeLeft] = useState(MEMORIZE_SECS);
  const [guess, setGuess] = useState({ h: 180, s: 50, l: 50 });
  const [roundResults, setRoundResults] = useState([]);

  const guessRef = useRef(guess);
  useEffect(() => { guessRef.current = guess; }, [guess]);

  const roundIndexRef = useRef(roundIndex);
  useEffect(() => { roundIndexRef.current = roundIndex; }, [roundIndex]);

  const roundResultsRef = useRef(roundResults);
  useEffect(() => { roundResultsRef.current = roundResults; }, [roundResults]);

  // Timer
  useEffect(() => {
    if (phase === "result" || phase === "done") return;
    const secs = phase === "memorize" ? MEMORIZE_SECS : GUESS_SECS;
    setTimeLeft(secs);

    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id);
          if (phase === "memorize") {
            setPhase("guess");
          } else {
            // Auto-submit on timeout
            const g = guessRef.current;
            const ri = roundIndexRef.current;
            const target = rounds[ri].targetRgb;
            const score = scoreGuess(g, target);
            const newResults = [...roundResultsRef.current, { score, guess: { ...g } }];
            roundResultsRef.current = newResults;
            setRoundResults(newResults);
            setPhase("result");
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [phase, roundIndex]);

  function submitGuess() {
    const score = scoreGuess(guess, rounds[roundIndex].targetRgb);
    const newResults = [...roundResults, { score, guess: { ...guess } }];
    setRoundResults(newResults);
    setPhase("result");
  }

  function nextRound() {
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      setPhase("done");
    } else {
      setRoundIndex(i => i + 1);
      setGuess({ h: 180, s: 50, l: 50 });
      setPhase("memorize");
    }
  }

  const round = rounds[roundIndex];
  const colorA = hslString(round.colorA.h, round.colorA.s, round.colorA.l);
  const colorB = hslString(round.colorB.h, round.colorB.s, round.colorB.l);
  const currentColor = hslString(guess.h, guess.s, guess.l);

  // Slider gradients
  const hueGrad = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";
  const satGrad = `linear-gradient(to right, hsl(${guess.h},0%,${guess.l}%), hsl(${guess.h},100%,${guess.l}%))`;
  const litGrad = `linear-gradient(to right, hsl(${guess.h},${guess.s}%,0%), hsl(${guess.h},${guess.s}%,50%), hsl(${guess.h},${guess.s}%,100%))`;

  // ── Memorize ──────────────────────────────────────────────────────────────
  if (phase === "memorize") {
    return (
      <div className="mix-screen mix-memorize">
        <div className="mix-top-bar">
          <span className="mix-round-label">Round {roundIndex + 1} / {TOTAL_ROUNDS}</span>
          <span className="mix-timer">{timeLeft}s</span>
          <button className="mix-quit" onClick={onQuit}>✕</button>
        </div>
        <p className="mix-instruction">Memorize these colors</p>
        <div className="mix-pair">
          <div className="mix-source-swatch" style={{ background: colorA }} />
          <span className="mix-plus">+</span>
          <div className="mix-source-swatch" style={{ background: colorB }} />
        </div>
        <div className="mix-memorize-bar" style={{ width: `${(timeLeft / MEMORIZE_SECS) * 100}%` }} />
      </div>
    );
  }

  // ── Guess ─────────────────────────────────────────────────────────────────
  if (phase === "guess") {
    const pct = timeLeft / GUESS_SECS;
    return (
      <div className="mix-screen mix-guess">
        <div className="mix-top-bar">
          <span className="mix-round-label">Round {roundIndex + 1} / {TOTAL_ROUNDS}</span>
          <span className="mix-timer" style={{ color: pct < 0.25 ? "#ff4444" : undefined }}>{timeLeft}s</span>
          <button className="mix-quit" onClick={onQuit}>✕</button>
        </div>
        <p className="mix-instruction">What's the 50/50 mix?</p>
        <div className="mix-preview" style={{ background: currentColor }} />
        <div className="mix-sliders">
          <SliderRow label="H" value={guess.h} min={0} max={360} onChange={v => setGuess(g => ({ ...g, h: v }))} gradient={hueGrad} />
          <SliderRow label="S" value={guess.s} min={0} max={100} onChange={v => setGuess(g => ({ ...g, s: v }))} gradient={satGrad} />
          <SliderRow label="L" value={guess.l} min={0} max={100} onChange={v => setGuess(g => ({ ...g, l: v }))} gradient={litGrad} />
        </div>
        <button className="mix-submit-btn" onClick={submitGuess}>Submit</button>
        <div className="mix-timer-bar-track">
          <div className="mix-timer-bar" style={{ width: `${pct * 100}%`, background: pct < 0.25 ? "#ff4444" : "#00fff0" }} />
        </div>
      </div>
    );
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (phase === "result") {
    const last = roundResults[roundResults.length - 1];
    const targetColor = rgbString(round.targetRgb.r, round.targetRgb.g, round.targetRgb.b);
    const guessColor = hslString(last.guess.h, last.guess.s, last.guess.l);
    const totalSoFar = roundResults.reduce((s, r) => s + r.score, 0);
    const isLast = roundIndex + 1 >= TOTAL_ROUNDS;

    return (
      <div className="mix-screen mix-result">
        <div className="mix-top-bar">
          <span className="mix-round-label">Round {roundIndex + 1} / {TOTAL_ROUNDS}</span>
          <span className="mix-running-total">{totalSoFar} pts</span>
          <button className="mix-quit" onClick={onQuit}>✕</button>
        </div>
        <div className="mix-result-score">{last.score} / 10</div>
        <div className="mix-result-swatches">
          <div className="mix-result-swatch-col">
            <div className="mix-source-swatch small" style={{ background: colorA }} />
            <span>A</span>
          </div>
          <div className="mix-result-swatch-col">
            <div className="mix-source-swatch small" style={{ background: colorB }} />
            <span>B</span>
          </div>
          <div className="mix-result-swatch-col highlight">
            <div className="mix-source-swatch" style={{ background: targetColor }} />
            <span>Target</span>
          </div>
          <div className="mix-result-swatch-col">
            <div className="mix-source-swatch" style={{ background: guessColor }} />
            <span>You</span>
          </div>
        </div>
        <button className="mix-next-btn" onClick={nextRound}>
          {isLast ? "See Results" : "Next Round →"}
        </button>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const total = roundResults.reduce((s, r) => s + r.score, 0);
  const max = TOTAL_ROUNDS * 10;
  const pct = Math.round((total / max) * 100);

  return (
    <div className="mix-screen mix-done">
      <h2 className="mix-done-title">Color Mix</h2>
      <div className="mix-done-score">{total}<span className="mix-done-max"> / {max}</span></div>
      <div className="mix-done-pct">{pct}%</div>
      <div className="mix-done-rounds">
        {roundResults.map((r, i) => (
          <div key={i} className="mix-done-row">
            <span className="mix-done-round-num">R{i + 1}</span>
            <div className="mix-done-bar-wrap">
              <div className="mix-done-bar" style={{ width: `${r.score * 10}%` }} />
            </div>
            <span className="mix-done-round-score">{r.score}/10</span>
          </div>
        ))}
      </div>
      <div className="mix-done-buttons">
        <button className="menu-button primary" onClick={() => {
          setRoundResults([]);
          setRoundIndex(0);
          setGuess({ h: 180, s: 50, l: 50 });
          setPhase("memorize");
        }}>
          Play Again
        </button>
        <button className="menu-button secondary" onClick={onQuit}>
          Back to Menu
        </button>
      </div>
    </div>
  );
}
