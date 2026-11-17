/* touch fish · 台球模式（极简物理：摩擦、碰撞、进洞、重置） */
(function () {
  const PALETTE = [
    ['#f5c518', '#c99a00'], ['#2e7dd1', '#17497f'], ['#e0533d', '#9c2e1c'],
    ['#5b3fa8', '#33206b'], ['#1f9c6b', '#0d6042'], ['#e08a2c', '#a25a10'],
    ['#c93f7a', '#8a1f4d'], ['#2ba7b8', '#146c79'], ['#7a8a99', '#46525e']
  ];

  class PoolGame {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.balls = [];
      this.pocket = null;
      this.running = false;
      this.power = 0;
      this.aiming = false;
      this.pending = null;
      this.score = 0;
      this.onScore = () => {};
      this.onHint = () => {};
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = 0;
      this.height = 0;
      this.lastT = 0;
      this.raf = 0;

      this._down = this.onDown.bind(this);
      this._move = this.onMove.bind(this);
      this._up = this.onUp.bind(this);
      this._resize = () => this.resize();
    }

    /** items: [{ id, role, name, x, y, iconUrl }] */
    mount(items) {
      this.items = items;
      this.resize();
      this.reset();
      this.running = true;
      this.preloadIcons();
      this.canvas.addEventListener('mousedown', this._down);
      window.addEventListener('mousemove', this._move);
      window.addEventListener('mouseup', this._up);
      window.addEventListener('resize', this._resize);
      this.lastT = performance.now();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame((t) => this.loop(t));
    }

    unmount() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.canvas.removeEventListener('mousedown', this._down);
      window.removeEventListener('mousemove', this._move);
      window.removeEventListener('mouseup', this._up);
      window.removeEventListener('resize', this._resize);
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    resize() {
      const dpr = this.dpr;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 尺寸变化时把球洞重新居中、球拉回台面内
      if (this.pocket) {
        this.pocket.x = Math.round(this.width / 2);
        this.pocket.y = Math.round((this.height - 40) / 2);
        const W = this.width;
        const H = this.height - 40;
        for (const b of this.balls || []) {
          b.x = Math.min(W - b.r, Math.max(b.r, b.x));
          b.y = Math.min(H - b.r, Math.max(b.r, b.y));
        }
      }
    }

    /**
     * 重新开局：球洞固定桌面正中，白球与彩球随机散落（互不重叠、不压住 HUD）
     */
    reset() {
      const items = this.items || [];
      const cueItem = items.find((i) => i.role === 'cue');
      const others = items.filter((i) => i.role === 'ball');

      const W = this.width;
      const H = this.height - 40;
      const R = 22;
      const POCKET_R = 38;

      this.pocket = { x: Math.round(W / 2), y: Math.round(H / 2), r: POCKET_R };
      this.balls = [];

      // 排除区：右上角 HUD、底部力度条
      const rects = [
        { x: W - 372, y: 0, w: 372, h: 250 },
        { x: W / 2 - 200, y: H - 84, w: 400, h: 84 }
      ];
      const circles = [{ x: this.pocket.x, y: this.pocket.y, r: POCKET_R + 165 }];

      const margin = R + 16;
      let fallback = 0;
      const pick = () => {
        for (let i = 0; i < 500; i++) {
          const x = margin + Math.random() * Math.max(1, W - margin * 2);
          const y = margin + Math.random() * Math.max(1, H - margin * 2);
          if (rects.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)) continue;
          if (circles.some((c) => Math.hypot(x - c.x, y - c.y) < c.r)) continue;
          return { x, y };
        }
        // 兜底：网格抖动，保证一定放得下
        fallback += 1;
        const cols = 6;
        const col = fallback % cols;
        const row = Math.floor(fallback / cols) % 4;
        return {
          x: margin + (col + 0.5) * ((W - margin * 2) / cols),
          y: margin + (row + 0.5) * ((H - margin * 2) / 4)
        };
      };

      const place = (item, radius, gap) => {
        const p = pick();
        circles.push({ x: p.x, y: p.y, r: gap });
        this.balls.push({
          id: item.id, name: item.name, cue: radius === R && item.role === 'cue', icon: item.iconUrl,
          x: p.x, y: p.y, homeX: p.x, homeY: p.y,
          vx: 0, vy: 0, r: radius, pocketed: false, color: null
        });
      };

      if (cueItem) {
        place({ ...cueItem }, 22, R * 2 + 14);
        this.balls[0].cue = true;
        this.balls[0].color = ['#fdfdfd', '#b9c3cb'];
      }

      // 彩球配色随机打散，避免每次开局颜色顺序都一样
      const pool = PALETTE.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      others.forEach((it, idx) => {
        const before = this.balls.length;
        place(it, R, R * 2 + 12);
        if (this.balls.length > before) this.balls[this.balls.length - 1].color = pool[idx % pool.length];
      });

      this.power = 0;
      this.aiming = false;
      this.aim = null;
      this.pending = null;
      this.score = 0;
      this.respawnAt = null;
      this.onScore(this.score);
    }

    onDown(e) {
      if (!this.running) return;
      const cue = this.balls.find((b) => b.cue && !b.pocketed);
      if (!cue || this.moving()) return;
      const x = e.clientX;
      const y = e.clientY;
      const d = Math.hypot(x - cue.x, y - cue.y);
      if (d > cue.r + 26) return;
      this.pending = { x, y, t: performance.now(), cue };
      this.power = 0;
      e.preventDefault();
    }

    onMove(e) {
      if (!this.pending) return;
      const { cue } = this.pending;
      const dx = cue.x - e.clientX;
      const dy = cue.y - e.clientY;
      const dist = Math.hypot(dx, dy);
      if (!this.aiming && (dist > cue.r + 10 || performance.now() - this.pending.t > 210)) {
        this.aiming = true;
        this.onHint('aim');
      }
      if (!this.aiming) return;
      const pull = Math.max(0, Math.min(210, dist - cue.r));
      this.power = pull / 210;
      this.aim = { x: dx / (dist || 1), y: dy / (dist || 1) };
      if (this.onPower) this.onPower(this.power);
    }

    onUp() {
      if (!this.aiming || !this.pending) {
        this.pending = null;
        this.aiming = false;
        return;
      }
      const cue = this.pending.cue;
      const power = this.power;
      this.pending = null;
      this.aiming = false;
      this.power = 0;
      if (this.onPower) this.onPower(0);
      if (power < 0.05 || !this.aim) return;
      const speed = 260 + power * 2100;
      cue.vx = this.aim.x * speed;
      cue.vy = this.aim.y * speed;
      this.click(0.5 + power * 0.5);
    }

    moving() {
      return this.balls.some((b) => !b.pocketed && Math.hypot(b.vx, b.vy) > 6);
    }

    click(v) {
      try {
        if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
        const ac = this.audio;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'triangle';
        o.frequency.value = 520 + Math.random() * 240;
        g.gain.value = 0.035 * Math.min(1, v);
        o.connect(g).connect(ac.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
        o.stop(ac.currentTime + 0.1);
      } catch {}
    }

    loop(t) {
      if (!this.running) return;
      const dt = Math.min(0.032, (t - this.lastT) / 1000 || 0.016);
      this.lastT = t;
      this.step(dt);
      this.draw();
      this.raf = requestAnimationFrame((n) => this.loop(n));
    }

    step(dt) {
      const W = this.width;
      const H = this.height - 40;
      const friction = Math.exp(-1.05 * dt);

      for (const b of this.balls) {
        if (b.pocketed) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp < 7) {
          b.vx = 0;
          b.vy = 0;
          continue;
        }
        const steps = Math.max(1, Math.ceil((sp * dt) / 5));
        const sdt = dt / steps;
        for (let s = 0; s < steps; s++) {
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;

          // 边界反弹
          if (b.x - b.r < 0) { b.x = b.r; b.vx = -b.vx * 0.86; this.click(0.2); }
          if (b.x + b.r > W) { b.x = W - b.r; b.vx = -b.vx * 0.86; this.click(0.2); }
          if (b.y - b.r < 0) { b.y = b.r; b.vy = -b.vy * 0.86; this.click(0.2); }
          if (b.y + b.r > H) { b.y = H - b.r; b.vy = -b.vy * 0.86; this.click(0.2); }

          // 球球碰撞
          for (const o of this.balls) {
            if (o === b || o.pocketed) continue;
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            const d2 = dx * dx + dy * dy;
            const min = b.r + o.r;
            if (d2 > 0 && d2 < min * min) {
              const d = Math.sqrt(d2);
              const nx = dx / d;
              const ny = dy / d;
              const overlap = min - d;
              b.x -= nx * overlap * 0.5;
              b.y -= ny * overlap * 0.5;
              o.x += nx * overlap * 0.5;
              o.y += ny * overlap * 0.5;

              const rvx = o.vx - b.vx;
              const rvy = o.vy - b.vy;
              const sep = rvx * nx + rvy * ny;
              if (sep < 0) {
                const imp = -(1 + 0.94) * sep / 2;
                b.vx -= imp * nx;
                b.vy -= imp * ny;
                o.vx += imp * nx;
                o.vy += imp * ny;
                this.click(Math.min(1, Math.abs(sep) / 500));
              }
            }
          }

          // 进洞判定
          if (this.pocket && Math.hypot(b.x - this.pocket.x, b.y - this.pocket.y) < this.pocket.r * 0.82) {
            b.pocketed = true;
            b.vx = 0;
            b.vy = 0;
            b.sink = 0;
            if (!b.cue) {
              this.score += 1;
              this.onScore(this.score);
            }
            this.click(1);
            break;
          }
        }

        b.vx *= friction;
        b.vy *= friction;
      }

      // 白球落袋 → 归位
      const cue = this.balls.find((b) => b.cue);
      if (cue && cue.pocketed) {
        if (!this.respawnAt) this.respawnAt = performance.now() + 720;
        if (performance.now() > this.respawnAt) {
          cue.pocketed = false;
          cue.x = cue.homeX;
          cue.y = cue.homeY;
          cue.vx = 0;
          cue.vy = 0;
          this.respawnAt = null;
          this.onHint('respawn');
        }
      }

      // 彩球落袋动画值
      for (const b of this.balls) {
        if (b.pocketed && b.sink !== undefined) b.sink = Math.min(1, b.sink + dt * 3);
      }
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      // 球洞（回收站位置）
      if (this.pocket) {
        const p = this.pocket;
        const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r + 8);
        g.addColorStop(0, 'rgba(0,0,0,0.95)');
        g.addColorStop(0.72, 'rgba(0,0,0,0.8)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,210,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(200,235,255,0.5)';
        ctx.font = '11px "Microsoft YaHei"';
        ctx.textAlign = 'center';
        ctx.fillText('球洞', p.x, p.y + p.r + 18);
      }

      // 瞄准辅助线
      const cue = this.balls.find((b) => b.cue && !b.pocketed);
      if (this.aiming && cue && this.aim) {
        this.drawGuide(cue);
      }

      // 球
      for (const b of this.balls) {
        if (b.pocketed && b.sink >= 1) continue;
        this.drawBall(b);
      }

      // 待击球呼吸环
      if (cue && !this.aiming && !this.moving() && !cue.pocketed) {
        const tt = (performance.now() % 1800) / 1800;
        ctx.save();
        ctx.globalAlpha = 0.55 * (1 - tt);
        ctx.strokeStyle = '#7fd0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cue.x, cue.y, cue.r + 5 + tt * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 球杆
      if (this.aiming && cue && this.aim) this.drawCue(cue);
    }

    drawBall(b) {
      const ctx = this.ctx;
      const scale = b.pocketed ? Math.max(0.15, 1 - b.sink) : 1;
      const r = b.r * scale;
      const x = b.x;
      const y = b.y;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;

      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
      g.addColorStop(0, b.cue ? '#ffffff' : this.lighten(b.color[0], 0.35));
      g.addColorStop(0.55, b.color[0]);
      g.addColorStop(1, b.color[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 高光
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.32, y - r * 0.42, r * 0.3, r * 0.2, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 球心图标
      const icon = this.iconCache && this.iconCache[b.id];
      if (icon && icon.complete && r > 8) {
        const s = r * 1.0;
        ctx.save();
        ctx.globalAlpha = b.cue ? 0.92 : 0.95;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(icon, x - s / 2, y - s / 2, s, s);
        ctx.restore();
      }

      // 白球描边
      if (b.cue) {
        ctx.strokeStyle = 'rgba(90,170,235,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r - 1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawGuide(cue) {
      const ctx = this.ctx;
      const dx = this.aim.x;
      const dy = this.aim.y;
      let len = 460;
      // 预测最近的球
      for (const o of this.balls) {
        if (o === cue || o.pocketed) continue;
        const ox = o.x - cue.x;
        const oy = o.y - cue.y;
        const proj = ox * dx + oy * dy;
        if (proj <= 0) continue;
        const perp2 = ox * ox + oy * oy - proj * proj;
        const rr = (cue.r + o.r) * (cue.r + o.r);
        if (perp2 < rr) {
          const back = Math.sqrt(rr - perp2);
          len = Math.min(len, proj - back);
        }
      }
      ctx.save();
      ctx.setLineDash([7, 8]);
      ctx.strokeStyle = 'rgba(190,235,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cue.x, cue.y);
      ctx.lineTo(cue.x + dx * len, cue.y + dy * len);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cue.x + dx * len, cue.y + dy * len, cue.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(190,235,255,0.45)';
      ctx.stroke();
      ctx.restore();
    }

    drawCue(cue) {
      const ctx = this.ctx;
      const back = cue.r + 14 + this.power * 130;
      const dx = -this.aim.x;
      const dy = -this.aim.y;
      const len = 260;
      const x1 = cue.x + dx * back;
      const y1 = cue.y + dy * back;
      const x2 = cue.x + dx * (back + len);
      const y2 = cue.y + dy * (back + len);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, '#f4e3c3');
      grad.addColorStop(0.18, '#e0c08a');
      grad.addColorStop(0.55, '#a9713c');
      grad.addColorStop(1, '#4a2b16');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // 皮头
      ctx.strokeStyle = '#3f7fbf';
      ctx.lineWidth = 7.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + dx * 9, y1 + dy * 9);
      ctx.stroke();
      ctx.restore();
    }

    lighten(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt));
      const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt));
      const b = Math.min(255, (n & 255) + Math.round(255 * amt));
      return `rgb(${r},${g},${b})`;
    }

    preloadIcons() {
      this.iconCache = this.iconCache || {};
      for (const b of this.balls) {
        if (this.iconCache[b.id]) continue;
        const img = new Image();
        img.src = b.icon;
        this.iconCache[b.id] = img;
      }
    }
  }

  window.PoolGame = PoolGame;
})();
