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
let currentAction = "move";
let selectedUnit = null;
let gameOver = false;

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
  units.push({ side, name, hp, maxHp: hp, atk, def, spd, x, y, alive: true, acted: false });
}
allyStats.forEach((u) => addUnit("ally", u));
enemyStats.forEach((u) => addUnit("enemy", u));

function isoToScreen(x, y, z) {
  return { x: OFFSET_X + (x - y) * TILE_W / 2, y: OFFSET_Y + (x + y) * TILE_H / 2 - z * 18 };
}
function inMap(x, y) { return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H; }
function unitAt(x, y) { return units.find((u) => u.alive && u.x === x && u.y === y); }
function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function buildTurnOrder() {
  turnOrder = units.filter((u) => u.alive).sort((a, b) => b.spd - a.spd);
  turnIndex = 0;
  turnOrder.forEach((u) => (u.acted = false));
  log("<span class='turn'>--- 新ラウンド ---</span>");
}
buildTurnOrder();

function log(t) { logEl.innerHTML = `${t}<br>` + logEl.innerHTML; }

function currentUnit() { return turnOrder[turnIndex]; }

function nextTurn() {
  checkWin();
  if (gameOver) return;
  selectedUnit = null;
  turnIndex++;
  while (turnIndex < turnOrder.length && (!turnOrder[turnIndex] || !turnOrder[turnIndex].alive)) turnIndex++;
  if (turnIndex >= turnOrder.length) buildTurnOrder();
  const u = currentUnit();
  if (!u) return;
  log(`${u.side === "ally" ? "<span class='ally'>" : "<span class='enemy'>"}${u.name}の行動</span>`);
  if (u.side === "enemy") setTimeout(() => enemyAct(u), 350);
}

function checkWin() {
  const allies = units.some((u) => u.alive && u.side === "ally");
  const enemies = units.some((u) => u.alive && u.side === "enemy");
  if (!allies || !enemies) {
    gameOver = true;
    log(`<b>${allies ? "勝利" : "敗北"}</b>`);
  }
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

function tryMove(unit, tx, ty) {
  if (!inMap(tx, ty) || unitAt(tx, ty)) return false;
  if (Math.abs(unit.x - tx) + Math.abs(unit.y - ty) !== 1) return false;
  if (Math.abs(heights[unit.y][unit.x] - heights[ty][tx]) > 1) return false;
  unit.x = tx; unit.y = ty; return true;
}

function enemyAct(enemy) {
  if (!enemy.alive) return nextTurn();
  const targets = units.filter((u) => u.alive && u.side === "ally").sort((a, b) => a.hp - b.hp || dist(enemy, a) - dist(enemy, b));
  const target = targets[0];
  if (!target) return nextTurn();
  if (dist(enemy, target) === 1) {
    attack(enemy, target);
    return nextTurn();
  }
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let best = null;
  for (const [dx, dy] of dirs) {
    const nx = enemy.x + dx, ny = enemy.y + dy;
    if (!inMap(nx, ny) || unitAt(nx, ny)) continue;
    if (Math.abs(heights[enemy.y][enemy.x] - heights[ny][nx]) > 1) continue;
    const nd = Math.abs(nx - target.x) + Math.abs(ny - target.y);
    if (!best || nd < best.d) best = { nx, ny, d: nd };
  }
  if (best) { enemy.x = best.nx; enemy.y = best.ny; }
  if (dist(enemy, target) === 1) attack(enemy, target);
  nextTurn();
}

canvas.addEventListener("click", (e) => {
  if (gameOver) return;
  const u = currentUnit();
  if (!u || u.side !== "ally" || !u.alive) return;
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * (canvas.width / r.width);
  const my = (e.clientY - r.top) * (canvas.height / r.height);

  let picked = null, min = 26;
  for (let y=0; y<MAP_H; y++) for (let x=0; x<MAP_W; x++) {
    const p = isoToScreen(x, y, heights[y][x]);
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d < min) { min = d; picked = {x,y}; }
  }
  if (!picked) return;

  if (currentAction === "move") {
    if (tryMove(u, picked.x, picked.y)) log(`${u.name} が移動`);
    else log("移動不可");
  } else if (currentAction === "attack") {
    const t = unitAt(picked.x, picked.y);
    if (t && t.side === "enemy" && dist(u, t) === 1) attack(u, t);
    else log("攻撃不可(射程1)");
  } else {
    log(`${u.name} は待機`);
  }
  nextTurn();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Digit1") currentAction = "move";
  if (e.code === "Digit2") currentAction = "attack";
  if (e.code === "Digit3") currentAction = "wait";
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

function drawUnit(u) {
  if (!u.alive) return;
  const p = isoToScreen(u.x, u.y, heights[u.y][u.x]);
  ctx.beginPath();
  ctx.arc(p.x, p.y - 24, 13, 0, Math.PI * 2);
  ctx.fillStyle = u.side === "ally" ? "#66d0ff" : "#ff6d7e";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${u.name} HP:${u.hp}`, p.x - 34, p.y - 36);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y=0; y<MAP_H; y++) for (let x=0; x<MAP_W; x++) drawTile(x, y, heights[y][x]);
  units.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(drawUnit);
  const cu = currentUnit();
  ctx.fillStyle = "#eef2ff";
  ctx.font = "18px sans-serif";
  ctx.fillText("キー1:移動 2:攻撃 3:待機", 20, 32);
  ctx.fillText(`現在コマンド: ${currentAction}`, 20, 58);
  if (cu && !gameOver) ctx.fillText(`行動中: ${cu.name} (${cu.side}) SPD:${cu.spd}`, 20, 84);
  requestAnimationFrame(render);
}

log("味方ターンはクリックで実行。数字キー1/2/3でコマンド切替。");
log(`${currentUnit().name}の行動開始`);
requestAnimationFrame(render);
