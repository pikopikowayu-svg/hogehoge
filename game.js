const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");

const TILE_W = 72, TILE_H = 38;
const MAP_W = 10, MAP_H = 8;
const OFFSET_X = canvas.width / 2;
const OFFSET_Y = 110;

const heights = [
  [0,0,0,1,1,1,0,0,0,0],
  [0,0,1,1,2,1,1,0,0,0],
  [0,1,1,2,2,2,1,1,0,0],
  [0,1,2,2,3,2,2,1,1,0],
  [0,1,1,2,2,2,1,1,0,0],
  [0,0,1,1,2,1,1,0,0,0],
  [0,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0],
];

const units = [];
let turnOrder = [];
let turnIndex = 0;
let gameOver = false;

const uiState = {
  phase: "command", // command | selectMove | confirmMove | selectAttack | confirmAttack
  hoverTile: null,
  selectedTile: null,
  highlightedTiles: [],
  buttons: [],
};

const allyStats = [
  ["Roland", 120, 30, 14, 16, 1, 6], ["Freya", 95, 36, 10, 21, 1, 7],
  ["Bened", 130, 24, 18, 12, 2, 6], ["Mina", 100, 32, 12, 18, 2, 7],
  ["Erik", 110, 28, 13, 15, 1, 5],
];
const enemyStats = [
  ["BanditA", 90, 24, 8, 15, 8, 2], ["BanditB", 90, 24, 8, 14, 8, 3], ["BanditC", 85, 26, 7, 17, 9, 2],
  ["BanditD", 100, 22, 10, 13, 7, 2], ["ArcherA", 80, 28, 6, 19, 8, 1], ["ArcherB", 80, 28, 6, 18, 9, 1],
  ["KnightA", 120, 26, 14, 11, 7, 3], ["KnightB", 120, 26, 14, 10, 9, 3],
];

function addUnit(side, [name, hp, atk, def, spd, x, y]) {
  units.push({ side, name, hp, maxHp: hp, atk, def, spd, x, y, alive: true });
}
allyStats.forEach((u) => addUnit("ally", u));
enemyStats.forEach((u) => addUnit("enemy", u));

const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

function isoToScreen(x, y, z) {
  return { x: OFFSET_X + (x - y) * TILE_W / 2, y: OFFSET_Y + (x + y) * TILE_H / 2 - z * 18 };
}
function inMap(x, y) { return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H; }
function unitAt(x, y) { return units.find((u) => u.alive && u.x === x && u.y === y); }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function currentUnit() { return turnOrder[turnIndex]; }

function buildTurnOrder() {
  turnOrder = units.filter((u) => u.alive).sort((a, b) => b.spd - a.spd);
  turnIndex = 0;
  log("<span class='turn'>--- 新ラウンド ---</span>");
  if (currentUnit()?.side === "enemy") setTimeout(() => enemyAct(currentUnit()), 350);
}

function log(t) { logEl.innerHTML = `${t}<br>` + logEl.innerHTML; }

function checkWin() {
  const allies = units.some((u) => u.alive && u.side === "ally");
  const enemies = units.some((u) => u.alive && u.side === "enemy");
  if (!allies || !enemies) {
    gameOver = true;
    log(`<b>${allies ? "勝利" : "敗北"}</b>`);
  }
}

function nextTurn() {
  checkWin();
  if (gameOver) return;
  turnIndex++;
  while (turnIndex < turnOrder.length && !turnOrder[turnIndex]?.alive) turnIndex++;
  if (turnIndex >= turnOrder.length) return buildTurnOrder();
  const u = currentUnit();
  uiState.phase = "command";
  uiState.highlightedTiles = [];
  uiState.selectedTile = null;
  log(`${u.side === "ally" ? "<span class='ally'>" : "<span class='enemy'>"}${u.name}の行動</span>`);
  if (u.side === "enemy") setTimeout(() => enemyAct(u), 350);
}

function damage(attacker, defender) {
  const hdiff = heights[attacker.y][attacker.x] - heights[defender.y][defender.x];
  return Math.max(1, attacker.atk - defender.def + hdiff * 2);
}

function attack(attacker, defender) {
  const dmg = damage(attacker, defender);
  defender.hp = Math.max(0, defender.hp - dmg);
  log(`${attacker.name} → ${defender.name} ${dmg}ダメージ`);
  if (defender.hp <= 0) {
    defender.alive = false;
    log(`${defender.name} を撃破`);
  }
}

function tileKey(x, y) { return `${x},${y}`; }
function computeMoveTiles(unit) {
  const arr = [];
  for (const [dx, dy] of dirs) {
    const nx = unit.x + dx, ny = unit.y + dy;
    if (!inMap(nx, ny) || unitAt(nx, ny)) continue;
    if (Math.abs(heights[unit.y][unit.x] - heights[ny][nx]) > 1) continue;
    arr.push({ x: nx, y: ny });
  }
  return arr;
}
function computeAttackTiles(unit) {
  const arr = [];
  for (const [dx, dy] of dirs) {
    const nx = unit.x + dx, ny = unit.y + dy;
    if (inMap(nx, ny)) arr.push({ x: nx, y: ny });
  }
  return arr;
}

function enemyAct(enemy) {
  if (!enemy.alive || gameOver) return nextTurn();
  const targets = units.filter((u) => u.alive && u.side === "ally").sort((a, b) => a.hp - b.hp || dist(enemy, a) - dist(enemy, b));
  const target = targets[0];
  if (!target) return nextTurn();
  if (dist(enemy, target) === 1) {
    attack(enemy, target);
    return nextTurn();
  }
  let best = null;
  for (const t of computeMoveTiles(enemy)) {
    const nd = Math.abs(t.x - target.x) + Math.abs(t.y - target.y);
    if (!best || nd < best.d) best = { ...t, d: nd };
  }
  if (best) { enemy.x = best.x; enemy.y = best.y; }
  if (dist(enemy, target) === 1) attack(enemy, target);
  nextTurn();
}

function tileFromMouse(mx, my) {
  let picked = null, min = 26;
  for (let y=0; y<MAP_H; y++) for (let x=0; x<MAP_W; x++) {
    const p = isoToScreen(x, y, heights[y][x]);
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d < min) { min = d; picked = {x,y}; }
  }
  return picked;
}

function findClickedButton(mx, my) {
  return uiState.buttons.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
}

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (canvas.width / r.width);
  const my = (e.clientY - r.top) * (canvas.height / r.height);
  uiState.hoverTile = tileFromMouse(mx, my);
});

canvas.addEventListener("click", (e) => {
  if (gameOver) return;
  const u = currentUnit();
  if (!u || u.side !== "ally" || !u.alive) return;
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (canvas.width / r.width);
  const my = (e.clientY - r.top) * (canvas.height / r.height);

  const btn = findClickedButton(mx, my);
  if (btn) return btn.onClick();

  const tile = tileFromMouse(mx, my);
  if (!tile) return;
  const allowed = new Set(uiState.highlightedTiles.map((t) => tileKey(t.x, t.y)));

  if (uiState.phase === "selectMove" && allowed.has(tileKey(tile.x, tile.y))) {
    uiState.selectedTile = tile;
    uiState.phase = "confirmMove";
  } else if (uiState.phase === "selectAttack" && allowed.has(tileKey(tile.x, tile.y))) {
    const t = unitAt(tile.x, tile.y);
    if (t && t.side === "enemy") {
      uiState.selectedTile = tile;
      uiState.phase = "confirmAttack";
    }
  }
});

function drawTile(x, y, h, fill = null) {
  const p = isoToScreen(x, y, h);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE_H / 2);
  ctx.lineTo(p.x + TILE_W / 2, p.y);
  ctx.lineTo(p.x, p.y + TILE_H / 2);
  ctx.lineTo(p.x - TILE_W / 2, p.y);
  ctx.closePath();
  const c = 50 + h * 35;
  ctx.fillStyle = fill || `rgb(${c},${120 + c / 4},${70 + c / 5})`;
  ctx.fill();
  ctx.strokeStyle = "#243053";
  ctx.stroke();
}

function drawHighlightTile(t, color) {
  drawTile(t.x, t.y, heights[t.y][t.x], color);
}

function drawUnit(u, active = false) {
  if (!u.alive) return;
  const p = isoToScreen(u.x, u.y, heights[u.y][u.x]);
  if (active) {
    ctx.beginPath();
    ctx.arc(p.x, p.y - 24, 21, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff7a8";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#fff4a0";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y - 24, 13, 0, Math.PI * 2);
  ctx.fillStyle = u.side === "ally" ? "#66d0ff" : "#ff6d7e";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${u.name} HP:${u.hp}`, p.x - 34, p.y - 36);
}

function makeButton(x, y, w, h, label, onClick) {
  return { x, y, w, h, label, onClick };
}

function drawCommandWindow() {
  uiState.buttons = [];
  const u = currentUnit();
  if (!u || u.side !== "ally" || gameOver) return;

  const x = 24, y = 500, w = 230, h = 170;
  ctx.fillStyle = "#0b1333e8";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#8396ff";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = "16px sans-serif";
  ctx.fillText(`${u.name} コマンド`, x + 12, y + 24);

  const btns = [];
  if (uiState.phase === "command") {
    btns.push(makeButton(x + 14, y + 40, 200, 30, "移動", () => {
      uiState.phase = "selectMove";
      uiState.highlightedTiles = computeMoveTiles(u);
      uiState.selectedTile = null;
    }));
    btns.push(makeButton(x + 14, y + 78, 200, 30, "攻撃", () => {
      uiState.phase = "selectAttack";
      uiState.highlightedTiles = computeAttackTiles(u);
      uiState.selectedTile = null;
    }));
    btns.push(makeButton(x + 14, y + 116, 200, 30, "待機", () => {
      log(`${u.name} は待機`);
      nextTurn();
    }));
  } else if (uiState.phase === "selectMove" || uiState.phase === "selectAttack") {
    btns.push(makeButton(x + 14, y + 98, 200, 30, "キャンセル", () => {
      uiState.phase = "command";
      uiState.highlightedTiles = [];
      uiState.selectedTile = null;
    }));
    ctx.fillText(uiState.phase === "selectMove" ? "移動先をクリック" : "攻撃対象隣接マス選択", x + 12, y + 66);
  } else {
    btns.push(makeButton(x + 14, y + 78, 200, 30, "決定", () => {
      if (!uiState.selectedTile) return;
      if (uiState.phase === "confirmMove") {
        u.x = uiState.selectedTile.x; u.y = uiState.selectedTile.y;
        log(`${u.name} が移動`);
      } else {
        const t = unitAt(uiState.selectedTile.x, uiState.selectedTile.y);
        if (t && t.side === "enemy" && dist(u, t) === 1) attack(u, t);
        else log("攻撃対象が不正");
      }
      uiState.phase = "command";
      uiState.highlightedTiles = [];
      uiState.selectedTile = null;
      nextTurn();
    }));
    btns.push(makeButton(x + 14, y + 116, 200, 30, "やめる", () => {
      uiState.phase = uiState.phase === "confirmMove" ? "selectMove" : "selectAttack";
      uiState.selectedTile = null;
    }));
    ctx.fillText("実行しますか？", x + 12, y + 52);
  }

  for (const b of btns) {
    uiState.buttons.push(b);
    ctx.fillStyle = "#293b88";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "#9fb0ff";
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#fff";
    ctx.fillText(b.label, b.x + 12, b.y + 21);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) drawTile(x, y, heights[y][x]);

  const color = uiState.phase.includes("Move") ? "#4bc8ff66" : "#ff696966";
  for (const t of uiState.highlightedTiles) drawHighlightTile(t, color);
  if (uiState.selectedTile) drawHighlightTile(uiState.selectedTile, "#fff58f88");

  const cu = currentUnit();
  units.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach((u) => drawUnit(u, cu && cu.alive && cu.side === "ally" && cu === u));

  ctx.fillStyle = "#eef2ff";
  ctx.font = "18px sans-serif";
  if (cu && !gameOver) ctx.fillText(`行動中: ${cu.name} (${cu.side}) SPD:${cu.spd}`, 20, 34);
  drawCommandWindow();

  requestAnimationFrame(render);
}

buildTurnOrder();
log("味方ターンはコマンドウィンドウをマウスクリックで操作。");
log(`${currentUnit().name}の行動開始`);
requestAnimationFrame(render);
