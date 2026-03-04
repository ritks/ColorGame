// ── sRGB ↔ linear ────────────────────────────────────────────────────────────
function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function delinearize(c) {
  c = Math.max(0, c);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ── OKLab conversions ─────────────────────────────────────────────────────────
export function rgbToOklab(r, g, b) {
  const R = linearize(r / 255), G = linearize(g / 255), B = linearize(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

export function oklabToRgb(L, a, b) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return {
    r: Math.round(Math.min(255, Math.max(0, delinearize(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255))),
    g: Math.round(Math.min(255, Math.max(0, delinearize(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255))),
    b: Math.round(Math.min(255, Math.max(0, delinearize(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s) * 255))),
  };
}

// ── HSL ↔ RGB ─────────────────────────────────────────────────────────────────
export function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslString(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function rgbString(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

// ── OKLab 50/50 mix ───────────────────────────────────────────────────────────
export function mixColorsOklab(hslA, hslB) {
  const a = hslToRgb(hslA.h, hslA.s, hslA.l);
  const b = hslToRgb(hslB.h, hslB.s, hslB.l);
  const labA = rgbToOklab(a.r, a.g, a.b);
  const labB = rgbToOklab(b.r, b.g, b.b);
  return oklabToRgb(
    (labA.L + labB.L) / 2,
    (labA.a + labB.a) / 2,
    (labA.b + labB.b) / 2,
  );
}

// ── Scoring: OKLab distance → 0–10 ───────────────────────────────────────────
// Max meaningful OKLab distance ≈ 0.25; scale so 0 dist = 10, 0.25 dist = 0.
export function scoreGuess(guessHsl, targetRgb) {
  const g = hslToRgb(guessHsl.h, guessHsl.s, guessHsl.l);
  const gLab = rgbToOklab(g.r, g.g, g.b);
  const tLab = rgbToOklab(targetRgb.r, targetRgb.g, targetRgb.b);
  const dist = Math.sqrt(
    Math.pow(gLab.L - tLab.L, 2) +
    Math.pow(gLab.a - tLab.a, 2) +
    Math.pow(gLab.b - tLab.b, 2),
  );
  return Math.max(0, Math.round(10 * (1 - dist / 0.25)));
}

// ── Round generation ──────────────────────────────────────────────────────────
function hueDiff(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

export function generateRounds(n) {
  const rounds = [];
  for (let i = 0; i < n; i++) {
    const hA = Math.floor(Math.random() * 360);
    const sA = 55 + Math.floor(Math.random() * 35);
    const lA = 35 + Math.floor(Math.random() * 25);

    // Ensure B is at least 80° away in hue for interesting mixes
    let hB, attempts = 0;
    do {
      hB = Math.floor(Math.random() * 360);
      attempts++;
    } while (hueDiff(hA, hB) < 80 && attempts < 50);

    const sB = 55 + Math.floor(Math.random() * 35);
    const lB = 35 + Math.floor(Math.random() * 25);

    const colorA = { h: hA, s: sA, l: lA };
    const colorB = { h: hB, s: sB, l: lB };

    rounds.push({ colorA, colorB, targetRgb: mixColorsOklab(colorA, colorB) });
  }
  return rounds;
}
