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

let uiMode = "command"; // command | move_select | attack_select | confirm
let pendingAction = null;
let pendingTarget = null;

const commandButtons = [
  { id: "move", label: "移動", x: 20, y: 610, w: 110, h: 38 },
  { id: "attack", label: "攻撃", x: 140, y: 610, w: 110, h: 38 },
  { id: "wait", label: "待機", x: 260, y: 610, w: 110, h: 38 },
];
const confirmButtons = [
  { id: "confirm", label: "決定", x: 20, y: 655, w: 110, h: 34 },
  { id: "cancel", label: "キャンセル", x: 140, y: 655, w: 120, h: 34 },
];

const allyStats = [
  ["Roland", 120, 30, 14, 16, 1, 6],
  ["Freya", 95, 36, 10, 21, 1, 7],
  ["Bened", 130, 24, 18, 12, 2, 6],
  ["Mina", 100, 32, 12, 18, 2, 7],
  ["Erik", 110, 28, 13, 15, 1, 5],
];
const enemyStats = [
  ["BanditA", 90, 24, 8, 15, 8, 2], ["BanditB", 90, 24, 8, 14, 8, 3],
  ["BanditC", 85, 26, 7, 17, 9, 2], ["BanditD", 100, 22, 10, 13, 7, 2],
  ["ArcherA", 80, 28, 6, 19, 8, 1], ["ArcherB", 80, 28, 6, 18, 9, 1],
  ["KnightA", 120, 26, 14, 11, 7, 3], ["KnightB", 120, 26, 14, 10, 9, 3],
];

function addUnit(side, [name, hp, atk, def, spd, x, y]) {
  units.push({ side, name, hp, maxHp: hp, atk, def, spd, x, y, alive: true });
}
allyStats.forEach((u) => addUnit("ally", u));
enemyStats.forEach((u) => addUnit("enemy", u));

function isoToScreen(x, y, z) { return { x: OFFSET_X + (x - y) * TILE_W / 2, y: OFFSET_Y + (x + y) * TILE_H / 2 - z * 18 }; }
function inMap(x, y) { return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H; }
function unitAt(x, y) { return units.find((u) => u.alive && u.x === x && u.y === y); }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function log(t) { logEl.innerHTML = `${t}<br>` + logEl.innerHTML; }

function currentUnit() { return turnOrder[turnIndex]; }
function buildTurnOrder() {
  turnOrder = units.filter((u) => u.alive).sort((a, b) => b.spd - a.spd);
  turnIndex = 0;
  log("<span class='turn'>--- 新ラウンド ---</span>");
}
buildTurnOrder();

function checkWin() {
  const allies = units.some((u) => u.alive && u.side === "ally");
  const enemies = units.some((u) => u.alive && u.side === "enemy");
  if (!allies || !enemies) { gameOver = true; log(`<b>${allies ? "勝利" : "敗北"}</b>`); }
}

function nextTurn() {
  checkWin();
  if (gameOver) return;
  uiMode = "command";
  pendingAction = null;
  pendingTarget = null;

  turnIndex++;
  while (turnIndex < turnOrder.length && !turnOrder[turnIndex].alive) turnIndex++;
  if (turnIndex >= turnOrder.length) buildTurnOrder();

  const u = currentUnit();
  if (!u) return;
  log(`${u.side === "ally" ? "<span class='ally'>" : "<span class='enemy'>"}${u.name}の行動</span>`);
  if (u.side === "enemy") setTimeout(() => enemyAct(u), 350);
}

function damage(attacker, defender) {
  const hdiff = heights[attacker.y][attacker.x] - heights[defender.y][defender.x];
  return Math.max(1, attacker.atk - defender.def + hdiff * 2);
}
function attack(attacker, defender) {
  const dmg = damage(attacker, defender);
  defender.hp -= dmg;
  log(`${attacker.name} → ${defender.name} ${dmg}ダメージ`);
  if (defender.hp <= 0) {
    defender.alive = false;
    defender.hp = 0;
    log(`${defender.name} を撃破`);
  }
}
function canStep(unit, tx, ty) {
  if (!inMap(tx, ty) || unitAt(tx, ty)) return false;
  if (Math.abs(unit.x - tx) + Math.abs(unit.y - ty) !== 1) return false;
  return Math.abs(heights[unit.y][unit.x] - heights[ty][tx]) <= 1;
}

function getMoveTiles(unit) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  return dirs.map(([dx,dy]) => ({ x: unit.x + dx, y: unit.y + dy })).filter((p) => canStep(unit, p.x, p.y));
}
function getAttackTiles(unit) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  return dirs.map(([dx,dy]) => ({ x: unit.x + dx, y: unit.y + dy })).filter((p) => inMap(p.x, p.y));
}

function enemyAct(enemy) {
  if (!enemy.alive) return nextTurn();
  const targets = units.filter((u) => u.alive && u.side === "ally").sort((a, b) => a.hp - b.hp || dist(enemy, a) - dist(enemy, b));
  const target = targets[0];
  if (!target) return nextTurn();
  if (dist(enemy, target) === 1) { attack(enemy, target); return nextTurn(); }

  let best = null;
  for (const p of getMoveTiles(enemy)) {
    const nd = Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
    if (!best || nd < best.d) best = { ...p, d: nd };
  }
  if (best) { enemy.x = best.x; enemy.y = best.y; }
  if (dist(enemy, target) === 1) attack(enemy, target);
  nextTurn();
}

function getPickedTile(mx, my) {
  let picked = null, min = 26;
  for (let y=0; y<MAP_H; y++) for (let x=0; x<MAP_W; x++) {
    const p = isoToScreen(x, y, heights[y][x]);
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d < min) { min = d; picked = {x,y}; }
  }
  return picked;
}
function hitButton(mx, my, buttons) {
  return buttons.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
}

canvas.addEventListener("click", (e) => {
  if (gameOver) return;
  const u = currentUnit();
  if (!u || u.side !== "ally" || !u.alive) return;

  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (canvas.width / r.width);
  const my = (e.clientY - r.top) * (canvas.height / r.height);

  if (uiMode === "command") {
    const cmd = hitButton(mx, my, commandButtons);
    if (!cmd) return;
    if (cmd.id === "wait") { log(`${u.name} は待機`); return nextTurn(); }
    pendingAction = cmd.id;
    pendingTarget = null;
    uiMode = cmd.id === "move" ? "move_select" : "attack_select";
    return;
  }

  if (uiMode === "move_select" || uiMode === "attack_select") {
    const tile = getPickedTile(mx, my);
    if (!tile) return;
    if (uiMode === "move_select") {
      const ok = getMoveTiles(u).some((p) => p.x === tile.x && p.y === tile.y);
      if (!ok) return;
      pendingTarget = tile; uiMode = "confirm";
    } else {
      const t = unitAt(tile.x, tile.y);
      const ok = t && t.side === "enemy" && dist(u, t) === 1;
      if (!ok) return;
      pendingTarget = tile; uiMode = "confirm";
    }
    return;
  }

  if (uiMode === "confirm") {
    const act = hitButton(mx, my, confirmButtons);
    if (!act) return;
    if (act.id === "cancel") {
      uiMode = pendingAction === "move" ? "move_select" : "attack_select";
      pendingTarget = null;
      return;
    }
    if (pendingAction === "move" && pendingTarget) {
      u.x = pendingTarget.x; u.y = pendingTarget.y;
      log(`${u.name} が移動`);
    }
    if (pendingAction === "attack" && pendingTarget) {
      const t = unitAt(pendingTarget.x, pendingTarget.y);
      if (t && t.side === "enemy" && dist(u, t) === 1) attack(u, t);
    }
    nextTurn();
  }
});

function drawTile(x, y, h) {
  const p = isoToScreen(x, y, h);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE_H/2);
  ctx.lineTo(p.x + TILE_W/2, p.y);
  ctx.lineTo(p.x, p.y + TILE_H/2);
  ctx.lineTo(p.x - TILE_W/2, p.y);
  ctx.closePath();
  const c = 50 + h * 35;
  ctx.fillStyle = `rgb(${c},${120+c/4},${70+c/5})`;
  ctx.fill();
  ctx.strokeStyle = "#243053";
  ctx.stroke();
}

function drawOverlayTile(x, y, color) {
  const p = isoToScreen(x, y, heights[y][x]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE_H/2);
  ctx.lineTo(p.x + TILE_W/2, p.y);
  ctx.lineTo(p.x, p.y + TILE_H/2);
  ctx.lineTo(p.x - TILE_W/2, p.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawUnit(u) {
  if (!u.alive) return;
  const p = isoToScreen(u.x, u.y, heights[u.y][u.x]);
  const cu = currentUnit();
  if (cu && cu === u && u.side === "ally" && !gameOver) {
    ctx.beginPath();
    ctx.arc(p.x, p.y - 24, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 242, 92, 0.35)";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y - 24, 13, 0, Math.PI * 2);
  ctx.fillStyle = u.side === "ally" ? "#66d0ff" : "#ff6d7e";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${u.name} HP:${u.hp}`, p.x - 34, p.y - 36);
}

function drawButton(b, active=false) {
  ctx.fillStyle = active ? "#7d8cff" : "#2a356c";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = "#b7c1ff";
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = "#eef2ff";
  ctx.font = "16px sans-serif";
  ctx.fillText(b.label, b.x + 26, b.y + 24);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y=0; y<MAP_H; y++) for (let x=0; x<MAP_W; x++) drawTile(x, y, heights[y][x]);

  const u = currentUnit();
  if (u && u.side === "ally" && !gameOver) {
    if (uiMode === "move_select" || (uiMode === "confirm" && pendingAction === "move")) {
      getMoveTiles(u).forEach((p) => drawOverlayTile(p.x, p.y, "rgba(80,170,255,.35)"));
    }
    if (uiMode === "attack_select" || (uiMode === "confirm" && pendingAction === "attack")) {
      getAttackTiles(u).forEach((p) => drawOverlayTile(p.x, p.y, "rgba(255,90,90,.35)"));
    }
  }

  units.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(drawUnit);

  ctx.fillStyle = "#eef2ff";
  ctx.font = "18px sans-serif";
  if (u && !gameOver) ctx.fillText(`行動中: ${u.name} (${u.side}) SPD:${u.spd}`, 20, 32);
  ctx.fillText(`モード: ${uiMode}`, 20, 58);

  if (u && u.side === "ally" && !gameOver) {
    commandButtons.forEach((b) => drawButton(b, (uiMode === "move_select" && b.id === "move") || (uiMode === "attack_select" && b.id === "attack")));
    if (uiMode === "confirm") confirmButtons.forEach((b) => drawButton(b, b.id === "confirm"));
  }

  requestAnimationFrame(render);
}

log("味方はマウス操作: コマンド選択 → 範囲確認 → 決定。");
log(`${currentUnit().name}の行動開始`);
requestAnimationFrame(render);
