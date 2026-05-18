const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WORLD = { width: canvas.width, height: canvas.height, floorY: 450, left: 40, right: 920 };
const keys = {};
const ATTACKS = {
  light: { key: "KeyZ", damage: 7, reach: 54, startup: 130, active: 90, recovery: 180, knock: 4 },
  medium: { key: "KeyX", damage: 12, reach: 74, startup: 180, active: 110, recovery: 260, knock: 7 },
  heavy: { key: "KeyC", damage: 20, reach: 92, startup: 240, active: 140, recovery: 350, knock: 10 },
};

function buildSprite(colorSet) {
  const sheet = document.createElement("canvas");
  sheet.width = 512;
  sheet.height = 512;
  const sctx = sheet.getContext("2d");
  const frames = {};

  function drawGirl(x, y, p) {
    sctx.save();
    sctx.translate(x, y);
    sctx.fillStyle = colorSet.hair;
    sctx.beginPath();
    sctx.ellipse(0, -58, 22, 20, 0, 0, Math.PI * 2);
    sctx.fill();
    sctx.fillStyle = colorSet.skin;
    sctx.beginPath();
    sctx.arc(0, -52, 16, 0, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = colorSet.outfit;
    sctx.fillRect(-14, -35, 28, 42);

    sctx.fillStyle = colorSet.accent;
    sctx.fillRect(-12, -10, 24, 5);

    sctx.strokeStyle = colorSet.skin;
    sctx.lineWidth = 7;
    sctx.lineCap = "round";

    sctx.beginPath();
    sctx.moveTo(-11, -27);
    sctx.lineTo(-28 - p.arm * 8, -15 + p.arm * 3);
    sctx.moveTo(11, -27);
    sctx.lineTo(28 + p.arm * 20, -15 - p.arm * 6);
    sctx.stroke();

    sctx.beginPath();
    sctx.moveTo(-8, 7);
    sctx.lineTo(-13 - p.leg * 6, 34);
    sctx.moveTo(8, 7);
    sctx.lineTo(14 + p.leg * 6, 34);
    sctx.stroke();
    sctx.restore();
  }

  function addAnim(name, row, poses) {
    const h = 96, w = 96;
    frames[name] = poses.map((pose, i) => {
      const x = i * w, y = row * h;
      drawGirl(x + 48, y + 72, pose);
      return { x, y, w, h };
    });
  }

  addAnim("idle", 0, [{ arm: 0.05, leg: 0 }, { arm: -0.05, leg: 0.03 }]);
  addAnim("walk", 1, [{ arm: 0.3, leg: 0.45 }, { arm: -0.25, leg: -0.4 }, { arm: 0.1, leg: 0.2 }]);
  addAnim("light", 2, [{ arm: 0.25, leg: 0 }, { arm: 0.8, leg: -0.1 }, { arm: 0.15, leg: 0 }]);
  addAnim("medium", 3, [{ arm: 0.15, leg: 0 }, { arm: 1.1, leg: -0.2 }, { arm: 0.35, leg: 0 }]);
  addAnim("heavy", 4, [{ arm: 0.2, leg: 0 }, { arm: 1.3, leg: -0.3 }, { arm: 0.45, leg: 0 }]);
  addAnim("hurt", 5, [{ arm: -0.45, leg: -0.2 }, { arm: -0.15, leg: 0 }]);

  return { sheet, frames };
}

class Fighter {
  constructor(name, x, face, sprite) {
    this.name = name;
    this.x = x;
    this.face = face;
    this.hp = 100;
    this.vx = 0;
    this.speed = 210;
    this.state = "idle";
    this.stateTimer = 0;
    this.animTimer = 0;
    this.frame = 0;
    this.attack = null;
    this.sprite = sprite;
    this.wasHit = false;
  }

  setState(name, duration = 0) {
    if (this.state !== name) {
      this.state = name;
      this.frame = 0;
      this.animTimer = 0;
    }
    this.stateTimer = duration;
  }

  startAttack(name) {
    const attack = ATTACKS[name];
    this.attack = { ...attack, name, timer: attack.startup + attack.active + attack.recovery, hitDone: false };
    this.setState(name, this.attack.timer);
  }

  update(dt, enemy, ai = false) {
    this.wasHit = false;
    if (this.hp <= 0) return;

    if (this.stateTimer > 0) this.stateTimer -= dt * 1000;

    if (this.attack) {
      this.attack.timer -= dt * 1000;
      const progress = (ATTACKS[this.attack.name].startup + ATTACKS[this.attack.name].active + ATTACKS[this.attack.name].recovery) - this.attack.timer;
      const inActive = progress >= ATTACKS[this.attack.name].startup && progress <= ATTACKS[this.attack.name].startup + ATTACKS[this.attack.name].active;
      if (inActive && !this.attack.hitDone) {
        const dist = Math.abs(enemy.x - this.x);
        const directional = (enemy.x - this.x) * this.face > 0;
        if (dist < this.attack.reach && directional) {
          enemy.takeHit(this.attack.damage, this.attack.knock * this.face);
          this.attack.hitDone = true;
        }
      }
      if (this.attack.timer <= 0) {
        this.attack = null;
        this.setState("idle");
      }
    } else if (this.state !== "hurt") {
      if (ai) this.runAI(enemy);
      this.x += this.vx * dt;
      this.x = Math.max(WORLD.left, Math.min(WORLD.right, this.x));
      this.setState(this.vx === 0 ? "idle" : "walk");
    }

    if (this.state === "hurt" && this.stateTimer <= 0) this.setState("idle");

    const frames = this.sprite.frames[this.state] || this.sprite.frames.idle;
    this.animTimer += dt;
    if (this.animTimer > 0.12) {
      this.animTimer = 0;
      this.frame = (this.frame + 1) % frames.length;
    }
  }

  runAI(enemy) {
    const dist = enemy.x - this.x;
    this.face = dist >= 0 ? 1 : -1;
    if (Math.abs(dist) > 95) {
      this.vx = Math.sign(dist) * this.speed * 0.75;
      return;
    }
    this.vx = 0;
    if (Math.random() < 0.03) {
      const pool = ["light", "medium", "heavy"];
      this.startAttack(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  takeHit(dmg, knock) {
    this.hp = Math.max(0, this.hp - dmg);
    this.x += knock;
    this.wasHit = true;
    this.attack = null;
    this.setState("hurt", 230);
  }

  draw() {
    const frames = this.sprite.frames[this.state] || this.sprite.frames.idle;
    const frame = frames[this.frame % frames.length];
    const y = WORLD.floorY - 72;
    ctx.save();
    ctx.translate(this.x, y);
    ctx.scale(this.face, 1);
    if (this.wasHit) ctx.filter = "brightness(1.7)";
    ctx.drawImage(this.sprite.sheet, frame.x, frame.y, frame.w, frame.h, -48, -24, 96, 96);
    ctx.restore();
  }
}

const playerSprite = buildSprite({ hair: "#53337f", skin: "#ffcfb1", outfit: "#ff86c8", accent: "#ffd7ef" });
const cpuSprite = buildSprite({ hair: "#2e3a89", skin: "#ffd6b2", outfit: "#66c8ff", accent: "#c9f0ff" });

const player = new Fighter("Airi", 260, 1, playerSprite);
const cpu = new Fighter("Reina", 700, -1, cpuSprite);

function inputControl() {
  player.vx = 0;
  player.face = cpu.x >= player.x ? 1 : -1;
  if (!player.attack && player.state !== "hurt") {
    if (keys.ArrowLeft) player.vx = -player.speed;
    if (keys.ArrowRight) player.vx = player.speed;
    for (const [name, data] of Object.entries(ATTACKS)) if (keys[data.key]) player.startAttack(name);
  }
}

function drawStage() {
  ctx.fillStyle = "#27284f";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = "#4f5a8a";
  ctx.fillRect(0, WORLD.floorY, WORLD.width, WORLD.height - WORLD.floorY);
  ctx.strokeStyle = "#8d9fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.floorY);
  ctx.lineTo(WORLD.width, WORLD.floorY);
  ctx.stroke();
}

function drawHUD() {
  const barW = 300;
  ctx.fillStyle = "#110c20";
  ctx.fillRect(40, 30, barW, 22);
  ctx.fillRect(WORLD.width - 340, 30, barW, 22);
  ctx.fillStyle = "#ff68b8";
  ctx.fillRect(40, 30, (player.hp / 100) * barW, 22);
  ctx.fillStyle = "#51bfff";
  ctx.fillRect(WORLD.width - 340 + (1 - cpu.hp / 100) * barW, 30, (cpu.hp / 100) * barW, 22);
  ctx.fillStyle = "#fff";
  ctx.font = "18px sans-serif";
  ctx.fillText(`${player.name} HP:${player.hp}`, 40, 24);
  ctx.fillText(`${cpu.name} HP:${cpu.hp}`, WORLD.width - 260, 24);

  if (player.hp <= 0 || cpu.hp <= 0) {
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#fff3a8";
    const msg = player.hp <= 0 ? "YOU LOSE" : "YOU WIN";
    ctx.fillText(msg, WORLD.width / 2 - 100, 220);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  inputControl();
  player.update(dt, cpu, false);
  cpu.update(dt, player, true);
  cpu.face = player.x >= cpu.x ? 1 : -1;

  drawStage();
  player.draw();
  cpu.draw();
  drawHUD();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => (keys[e.code] = true));
window.addEventListener("keyup", (e) => (keys[e.code] = false));
requestAnimationFrame(loop);
