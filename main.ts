// ============================================================================
// 17 NOVEMBER 2026 — THE WORLD IN ONE PICTURE
// make.fun competition "news-image-20261117": sum up one day's world news
// in a single image.
//
// The image is a newspaper front page, "THE WORLD IN ONE PICTURE", dated
// 17 NOVEMBER 2026, drawn entirely by this program (procedural renderer,
// Node standard library only, no dependencies, no network).
//
// THE DAY'S NEWS (Tuesday 17 November 2026, as reported that day):
//   1. EUROPE     — Ukraine struck the Kerch Bridge (linking Russia to
//                   Crimea) for a second consecutive day; President Zelenskyy
//                   hailed an "unprecedented operation"; Russia struck
//                   bridges in Kyiv in reply.
//   2. MIDDLE EAST— Iran fired drones at a US military radar system at
//                   Sheikh Isa base in Bahrain, its third attack on US
//                   targets there in days; Bahrain intercepted it, no
//                   casualties or damage reported.
//   3. ASIA       — China confirmed the first three-way meeting of Xi
//                   Jinping, Donald Trump and Vladimir Putin, in Shenzhen
//                   on Thursday 19 November, on the sidelines of the APEC
//                   leaders' meeting.
//   4. EUROPE     — Estonia announced it will close all border crossings
//                   with Russia from 1 December, blaming Moscow for a foiled
//                   arson/sabotage plot against a drone plant.
//   5. MIDDLE EAST— Houthis launched drones at Saudi Arabia's East-West oil
//                   pipeline and advanced toward Aden; Yemeni government
//                   forces retreated from the Red Sea coast to defend Aden.
//   6. ASIA       — Japan scrambled fighter jets and protested after two
//                   suspected Russian aircraft violated its airspace.
// Ticker items: French actor Gerard Depardieu dropped his appeal and
// admitted a sexual-assault charge in a Paris court; Microsoft explained
// last week's global outage as a latent defect plus increased load;
// delegates of 128 states met at the UN in Geneva to discuss a treaty
// banning lethal autonomous weapons.
//
// HOW IT IS DRAWN: everything is computed into an RGB pixel buffer at
// 2048x2048 (2x supersampling) and box-downsampled to 1024x1024 for clean
// edges. All text uses a hand-coded 5x7 bitmap font ( capitals, digits and
// basic punctuation ). A fixed-seed PRNG (mulberry32) adds light newsprint
// grain, so two runs produce byte-identical output. The PNG is encoded by
// hand: CRC32 implementation below + node:zlib deflate, only IHDR/IDAT/IEND.
// ============================================================================

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Canvas and palette
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const W = 1024; // final image width/height
const SS = 2; // supersampling factor
const BW = W * SS; // buffer width/height (2048)

const PAPER: RGB = [246, 241, 229]; // newsprint off-white #f6f1e5
const INK: RGB = [22, 21, 19]; // dark ink #161513
const RED: RGB = [166, 30, 34]; // accent red #a61e22
const BLUE: RGB = [29, 58, 95]; // deep blue #1d3a5f
const SKY: RGB = [226, 231, 235]; // pictogram background tint
const GRAYTXT: RGB = [62, 58, 50]; // caption ink
const SMOKE: RGB = [139, 132, 121];
const ORANGE: RGB = [219, 110, 38];
const YELLOW: RGB = [238, 186, 62];
const LIGHTBLUE: RGB = [168, 190, 214];
const GROUND: RGB = [205, 199, 183];
const WHITE: RGB = [250, 248, 242];

const buf = new Uint8Array(BW * BW * 3);

function setPx(bx: number, by: number, c: RGB): void {
  if (bx < 0 || by < 0 || bx >= BW || by >= BW) return;
  const i = (by * BW + bx) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function fillAll(c: RGB): void {
  for (let i = 0; i < buf.length; i += 3) {
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
  }
}

// All drawing helpers take coordinates in final-image (1024) space and
// scale them into the supersampled buffer.

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.round(x * SS);
  const y0 = Math.round(y * SS);
  const x1 = Math.round((x + w) * SS);
  const y1 = Math.round((y + h) * SS);
  for (let by = y0; by < y1; by++) {
    for (let bx = x0; bx < x1; bx++) setPx(bx, by, c);
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  const bcx = cx * SS;
  const bcy = cy * SS;
  const br = r * SS;
  const x0 = Math.floor(bcx - br);
  const x1 = Math.ceil(bcx + br);
  const y0 = Math.floor(bcy - br);
  const y1 = Math.ceil(bcy + br);
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      const dx = bx - bcx;
      const dy = by - bcy;
      if (dx * dx + dy * dy <= br * br) setPx(bx, by, c);
    }
  }
}

// Filled polygon (even-odd scanline), points in 1024 space.
function poly(pts: number[][], c: RGB): void {
  const p = pts.map((pt) => [pt[0] * SS, pt[1] * SS]);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pt of p) {
    if (pt[1] < minY) minY = pt[1];
    if (pt[1] > maxY) maxY = pt[1];
  }
  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(BW - 1, Math.ceil(maxY));
  for (let by = yStart; by <= yEnd; by++) {
    const y = by + 0.5;
    const nodes: number[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        nodes.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    nodes.sort((m, n) => m - n);
    for (let i = 0; i + 1 < nodes.length; i += 2) {
      const x0 = Math.round(nodes[i]);
      const x1 = Math.round(nodes[i + 1]);
      for (let bx = x0; bx <= x1; bx++) setPx(bx, by, c);
    }
  }
}

// Thick line: stamp filled circles along the segment.
function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  c: RGB,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(dist * SS));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    circle(x1 + dx * t, y1 + dy * t, w / 2, c);
  }
}

// Arc: stamp circles along part of a circumference. Angles in degrees,
// 0 = east, positive angles go clockwise (y axis points down).
function arc(
  cx: number,
  cy: number,
  r: number,
  w: number,
  c: RGB,
  startDeg: number,
  endDeg: number,
): void {
  const steps = Math.max(4, Math.ceil(Math.abs(endDeg - startDeg) * 2));
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    circle(cx + r * Math.cos(rad), cy + r * Math.sin(rad), w / 2, c);
  }
}

// Rectangle outline made of four bars.
function border(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font: A-Z, 0-9 and . , : ; ! ? - ' " / ( ) | %
// Each glyph is 7 rows of 5 pixels; character advance is 6 units.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", ".#.#.", "..#..", "..#..", "..#..", ".#.#.", "#...#"],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "..##.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#..##", "#..##"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  bold: boolean,
): void {
  const up = text.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const glyph = FONT[up[i]] || FONT[" "];
    const gx = x + i * 6 * scale;
    const extra = bold ? scale * 0.45 : 0;
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits[col] === "#") {
          rect(gx + col * scale, y + row * scale, scale + extra, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(
  text: string,
  cx: number,
  y: number,
  scale: number,
  c: RGB,
  bold: boolean,
): void {
  drawText(text, cx - textWidth(text, scale) / 2, y, scale, c, bold);
}

// Greedy word wrap so a caption never exceeds maxChars per line.
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (cur === "") {
      cur = word;
    } else if (cur.length + 1 + word.length <= maxChars) {
      cur = cur + " " + word;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// Pictograms. Each is drawn inside a 300x128 box whose top-left is (px, py).
// Flat, bold, simple shapes only — no text inside a pictogram.
// ---------------------------------------------------------------------------

// 1. A long bridge over water, blast and smoke at mid-span.
function picBridge(px: number, py: number): void {
  rect(px, py, 300, 128, SKY);
  // water
  rect(px, py + 96, 300, 32, BLUE);
  for (let i = 0; i < 7; i++) {
    const wy = py + 106 + (i % 2) * 9;
    line(px + 14 + i * 40, wy, px + 32 + i * 40, wy, 2.5, LIGHTBLUE);
  }
  // suspension cables
  line(px + 10, py + 82, px + 92, py + 27, 2.5, INK);
  line(px + 92, py + 27, px + 148, py + 55, 2.5, INK);
  line(px + 148, py + 55, px + 201, py + 27, 2.5, INK);
  line(px + 201, py + 27, px + 290, py + 82, 2.5, INK);
  // hangers
  for (const hx of [40, 66, 118, 148, 176, 232, 262]) {
    const top = hx < 92 ? 82 - ((hx - 10) * 55) / 82 : hx < 148 ? 27 + ((hx - 92) * 28) / 56 : hx < 201 ? 55 - ((hx - 148) * 28) / 53 : 27 + ((hx - 201) * 55) / 89;
    line(px + hx, py + top, px + hx, py + 82, 1.8, INK);
  }
  // deck and towers
  rect(px + 8, py + 82, 284, 7, INK);
  rect(px + 88, py + 24, 9, 65, INK);
  rect(px + 197, py + 24, 9, 65, INK);
  // broken gap at mid-span
  rect(px + 136, py + 81, 30, 10, SKY);
  rect(px + 140, py + 91, 8, 10, INK); // falling debris
  rect(px + 156, py + 94, 6, 8, INK);
  // blast: starburst + core
  const bx = px + 151;
  const by = py + 82;
  for (let k = 0; k < 8; k++) {
    const rad = (k * Math.PI) / 4 + 0.3;
    line(bx, by, bx + 21 * Math.cos(rad), by + 21 * Math.sin(rad), 3.5, RED);
  }
  circle(bx, by, 8, ORANGE);
  circle(bx, by, 4, YELLOW);
  // smoke rising
  circle(px + 176, py + 56, 10, SMOKE);
  circle(px + 192, py + 42, 13, SMOKE);
  circle(px + 212, py + 30, 16, SMOKE);
  circle(px + 196, py + 46, 8, [168, 161, 149]);
}

// A small quadcopter drone silhouette, top view.
function drone(cx: number, cy: number): void {
  line(cx - 12, cy - 8, cx + 12, cy + 8, 3, INK);
  line(cx - 12, cy + 8, cx + 12, cy - 8, 3, INK);
  circle(cx - 14, cy - 9, 4, INK);
  circle(cx + 14, cy - 9, 4, INK);
  circle(cx - 14, cy + 9, 4, INK);
  circle(cx + 14, cy + 9, 4, INK);
  rect(cx - 6, cy - 3, 12, 6, INK);
  circle(cx, cy, 2.2, RED);
}

// 2. A radar dish with drone silhouettes above it.
function picRadar(px: number, py: number): void {
  rect(px, py, 300, 128, SKY);
  rect(px, py + 116, 300, 12, GROUND);
  // dish: crescent carved from a disc
  circle(px + 92, py + 70, 42, INK);
  circle(px + 107, py + 61, 38, SKY);
  // feed arm and receiver
  line(px + 88, py + 74, px + 118, py + 48, 3.5, INK);
  circle(px + 120, py + 46, 5, RED);
  // signal arcs leaving the receiver
  arc(px + 120, py + 46, 17, 2.5, BLUE, -95, 25);
  arc(px + 120, py + 46, 26, 2.5, BLUE, -95, 25);
  arc(px + 120, py + 46, 35, 2.5, BLUE, -95, 25);
  // mount and base
  poly(
    [
      [px + 92, py + 100],
      [px + 74, py + 118],
      [px + 110, py + 118],
    ],
    INK,
  );
  rect(px + 62, py + 116, 60, 6, INK);
  // drones above
  drone(px + 208, py + 30);
  drone(px + 252, py + 16);
  drone(px + 264, py + 46);
}

// 3. Three flag-coloured vertical banners side by side.
function picBanners(px: number, py: number): void {
  rect(px, py, 300, 128, SKY);
  rect(px + 8, py + 8, 284, 5, INK);
  circle(px + 8, py + 10, 4, INK);
  circle(px + 292, py + 10, 4, INK);
  // China: red banner, gold star disc
  rect(px + 16, py + 13, 76, 100, [178, 34, 40]);
  circle(px + 54, py + 44, 12, YELLOW);
  circle(px + 54, py + 78, 5, YELLOW);
  circle(px + 38, py + 66, 3.5, YELLOW);
  circle(px + 70, py + 66, 3.5, YELLOW);
  // USA: deep blue banner, white stars and stripes hint
  rect(px + 112, py + 13, 76, 100, BLUE);
  for (let r = 0; r < 3; r++) {
    for (let s = 0; s < 3; s++) {
      circle(px + 128 + s * 22, py + 30 + r * 16, 3, WHITE);
    }
  }
  rect(px + 112, py + 84, 76, 8, WHITE);
  rect(px + 112, py + 100, 76, 8, [178, 34, 40]);
  // Russia: white / blue / red horizontal thirds
  rect(px + 208, py + 13, 76, 34, WHITE);
  rect(px + 208, py + 47, 76, 33, BLUE);
  rect(px + 208, py + 80, 76, 33, [178, 34, 40]);
  border(px + 208, py + 13, 76, 100, 2, INK);
}

// 4. A striped border barrier across a road.
function picBorder(px: number, py: number): void {
  rect(px, py, 300, 128, SKY);
  rect(px, py + 84, 300, 44, GROUND);
  // road trapezoid
  poly(
    [
      [px + 92, py + 128],
      [px + 208, py + 128],
      [px + 170, py + 84],
      [px + 130, py + 84],
    ],
    [148, 143, 133],
  );
  line(px + 150, py + 92, px + 150, py + 99, 3, WHITE);
  line(px + 150, py + 106, px + 150, py + 115, 4, WHITE);
  // barrier post with no-entry sign
  rect(px + 53, py + 38, 9, 80, INK);
  circle(px + 57, py + 30, 12, RED);
  rect(px + 50, py + 28, 15, 4.5, WHITE);
  // striped arm
  rect(px + 57, py + 54, 208, 11, WHITE);
  for (let i = 0; i < 6; i++) {
    rect(px + 62 + i * 35, py + 54, 18, 11, RED);
  }
  rect(px + 57, py + 52, 208, 2, INK);
  rect(px + 57, py + 65, 208, 2, INK);
  circle(px + 57, py + 59, 5, INK);
  // far support post
  rect(px + 256, py + 65, 8, 34, INK);
  rect(px + 248, py + 97, 24, 5, INK);
}

// 5. An oil pipeline with a flame and an onward arrow.
function picPipeline(px: number, py: number): void {
  rect(px, py, 300, 128, SKY);
  rect(px, py + 108, 300, 20, GROUND);
  // flame above the middle joint
  poly(
    [
      [px + 136, py + 56],
      [px + 143, py + 32],
      [px + 153, py + 12],
      [px + 163, py + 32],
      [px + 170, py + 56],
    ],
    ORANGE,
  );
  poly(
    [
      [px + 144, py + 56],
      [px + 149, py + 38],
      [px + 153, py + 28],
      [px + 158, py + 38],
      [px + 162, py + 56],
    ],
    YELLOW,
  );
  circle(px + 178, py + 18, 8, SMOKE);
  circle(px + 192, py + 12, 6, SMOKE);
  // pipe body
  rect(px + 10, py + 56, 280, 24, [199, 204, 209]);
  rect(px + 10, py + 56, 280, 3, INK);
  rect(px + 10, py + 77, 280, 3, INK);
  rect(px + 10, py + 56, 4, 24, INK);
  rect(px + 286, py + 56, 4, 24, INK);
  // joint bands
  for (const jx of [80, 150, 220]) rect(px + jx, py + 54, 7, 28, INK);
  // supports
  for (const sx of [44, 184, 254]) rect(px + sx, py + 80, 8, 28, INK);
  // onward arrow
  rect(px + 62, py + 92, 126, 10, BLUE);
  poly(
    [
      [px + 188, py + 85],
      [px + 188, py + 109],
      [px + 218, py + 97],
    ],
    BLUE,
  );
}

// 6. A fighter-jet silhouette with motion lines.
function picJet(px: number, py: number): void {
  rect(px, py, 300, 128, SKY);
  // red sun disc (Japan)
  circle(px + 264, py + 24, 13, RED);
  // clouds
  for (const cl of [
    [52, 24],
    [216, 104],
  ]) {
    circle(px + cl[0], py + cl[1], 10, WHITE);
    circle(px + cl[0] + 14, py + cl[1] + 2, 8, WHITE);
    circle(px + cl[0] - 13, py + cl[1] + 2, 7, WHITE);
  }
  // motion lines behind the tail
  line(px + 16, py + 50, px + 50, py + 50, 3, BLUE);
  line(px + 8, py + 64, px + 46, py + 64, 3, BLUE);
  line(px + 18, py + 78, px + 52, py + 78, 3, BLUE);
  // fuselage
  poly(
    [
      [px + 58, py + 74],
      [px + 118, py + 60],
      [px + 238, py + 52],
      [px + 268, py + 60],
      [px + 238, py + 68],
      [px + 118, py + 78],
    ],
    INK,
  );
  // tail fin, tailplane and main wing
  poly(
    [
      [px + 80, py + 62],
      [px + 63, py + 33],
      [px + 94, py + 35],
      [px + 103, py + 60],
    ],
    INK,
  );
  poly(
    [
      [px + 82, py + 72],
      [px + 57, py + 89],
      [px + 86, py + 91],
      [px + 101, py + 74],
    ],
    INK,
  );
  poly(
    [
      [px + 150, py + 68],
      [px + 107, py + 103],
      [px + 142, py + 105],
      [px + 189, py + 70],
    ],
    INK,
  );
  // cockpit cut-out
  circle(px + 214, py + 57, 5, SKY);
}

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------

interface Story {
  region: string;
  kicker: RGB;
  headline: string[];
  caption: string;
  pic: (px: number, py: number) => void;
}

const STORIES: Story[] = [
  {
    region: "EUROPE",
    kicker: BLUE,
    headline: ["UKRAINE HITS", "KERCH BRIDGE", "AGAIN"],
    caption: "Second strike in two days; Russia hits Kyiv bridges.",
    pic: picBridge,
  },
  {
    region: "MIDDLE EAST",
    kicker: RED,
    headline: ["IRAN DRONES HIT", "US RADAR", "IN BAHRAIN"],
    caption: "Third attack on US targets there in days.",
    pic: picRadar,
  },
  {
    region: "ASIA",
    kicker: INK,
    headline: ["XI, TRUMP AND", "PUTIN TO MEET"],
    caption: "First three-way summit, Thursday in Shenzhen.",
    pic: picBanners,
  },
  {
    region: "EUROPE",
    kicker: BLUE,
    headline: ["ESTONIA TO SHUT", "RUSSIA BORDER"],
    caption: "All crossings close 1 Dec after a foiled plot.",
    pic: picBorder,
  },
  {
    region: "MIDDLE EAST",
    kicker: RED,
    headline: ["HOUTHIS HIT", "SAUDI PIPELINE"],
    caption: "Drones strike East-West line; rebels near Aden.",
    pic: picPipeline,
  },
  {
    region: "ASIA",
    kicker: INK,
    headline: ["JAPAN SCRAMBLES", "FIGHTER JETS"],
    caption: "Russian planes violate Japanese airspace.",
    pic: picJet,
  },
];

function drawPanel(x0: number, y0: number, story: Story): void {
  const pw = 316;
  const ph = 339;
  border(x0, y0, pw, ph, 2, INK);
  // kicker bar
  rect(x0, y0, pw, 28, story.kicker);
  drawTextCentered(story.region, x0 + pw / 2, y0 + 7, 2, WHITE, true);
  // pictogram
  story.pic(x0 + 8, y0 + 36);
  border(x0 + 8, y0 + 36, 300, 128, 1.5, INK);
  // headline, block centred between the pictogram and the divider
  const lines = story.headline;
  const startY = y0 + 178 + (3 - lines.length) * 15;
  for (let i = 0; i < lines.length; i++) {
    drawTextCentered(lines[i], x0 + pw / 2, startY + i * 31, 3, INK, true);
  }
  // divider and caption
  rect(x0 + 12, y0 + 272, pw - 24, 1.5, [198, 188, 164]);
  const capLines = wrapText(story.caption.toUpperCase(), 25);
  for (let i = 0; i < capLines.length; i++) {
    drawTextCentered(capLines[i], x0 + pw / 2, y0 + 282 + i * 18, 2, GRAYTXT, false);
  }
}

function drawPage(): void {
  fillAll(PAPER);

  // ---- Masthead -----------------------------------------------------------
  rect(25, 14, 974, 4, INK);
  rect(25, 23, 974, 1.5, INK);
  drawTextCentered("THE WORLD IN ONE PICTURE", 512, 34, 3, RED, true);
  drawTextCentered("17 NOVEMBER 2026", 512, 62, 8, INK, true);
  drawTextCentered("TUESDAY - WORLD NEWS - ONE DAY, ONE IMAGE", 512, 128, 3, BLUE, true);
  rect(25, 158, 974, 1.5, INK);
  rect(25, 163, 974, 4, INK);

  // ---- Story grid: 2 rows x 3 columns --------------------------------------
  const xs = [25, 354, 683];
  const ys = [180, 531];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      drawPanel(xs[c], ys[r], STORIES[r * 3 + c]);
    }
  }

  // ---- Ticker strip ---------------------------------------------------------
  rect(25, 882, 974, 85, INK);
  const ticker = [
    "DEPARDIEU ADMITS SEX-ASSAULT CHARGE IN PARIS",
    "MICROSOFT EXPLAINS GLOBAL OUTAGE: LATENT DEFECT",
    "128 NATIONS MEET ON KILLER-ROBOT BAN",
  ];
  for (let i = 0; i < ticker.length; i++) {
    if (i > 0) {
      // small red separator square above each following item
      rect(506, 882 + i * 27 - 6, 12, 3, RED);
    }
    drawTextCentered(ticker[i], 512, 882 + 8 + i * 27, 2, WHITE, false);
  }

  // ---- Footer ----------------------------------------------------------------
  drawTextCentered(
    "SUMMARISED FROM THE DAY'S REPORTING - 17 NOVEMBER 2026",
    512,
    982,
    2,
    GRAYTXT,
    false,
  );
}

// ---------------------------------------------------------------------------
// Newsprint grain: deterministic, fixed-seed (mulberry32). Sparse speckles
// only, so the PNG stays small and the output is byte-identical every run.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addGrain(): void {
  const rand = mulberry32(20261117);
  const dark: RGB = [226, 219, 201];
  const light: RGB = [252, 249, 240];
  for (let i = 0; i < 1300; i++) {
    const x = rand() * (W - 3);
    const y = rand() * (W - 3);
    rect(x, y, 1.2, 1.2, rand() < 0.55 ? dark : light);
  }
}

// ---------------------------------------------------------------------------
// Downsample 2048x2048 -> 1024x1024 (2x2 box average)
// ---------------------------------------------------------------------------

function downsample(): Uint8Array {
  const out = new Uint8Array(W * W * 3);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const oi = (y * W + x) * 3;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const bi = ((y * SS + dy) * BW + (x * SS + dx)) * 3;
          r += buf[bi];
          g += buf[bi + 1];
          b += buf[bi + 2];
        }
      }
      out[oi] = Math.round(r / 4);
      out[oi + 1] = Math.round(g / 4);
      out[oi + 2] = Math.round(b / 4);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PNG encoding: own CRC32 + node:zlib deflate. Chunks: IHDR, IDAT, IEND only.
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const typeAndData = out.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(typeAndData));
  return out;
}

function encodePNG(pixels: Uint8Array): Uint8Array {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, W);
  hv.setUint32(4, W);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // raw scanlines, filter byte 0 per row
  const raw = new Uint8Array(W * (1 + W * 3));
  for (let y = 0; y < W; y++) {
    const rowStart = y * (1 + W * 3);
    raw[rowStart] = 0;
    raw.set(pixels.subarray(y * W * 3, (y + 1) * W * 3), rowStart + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const parts = [
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(idat)),
    chunk("IEND", new Uint8Array(0)),
  ];
  let total = 0;
  for (const p of parts) total += p.length;
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  drawPage();
  addGrain();
  const pixels = downsample();
  const png = encodePNG(pixels);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log("wrote " + outPath + " (" + png.length + " bytes)");
}

main();
