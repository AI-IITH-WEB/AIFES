/* ── Navbar scroll shadow ── */
(function() {
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 24);
  }, { passive: true });
})();

/* ── Theme toggle ── */
(function() {
  const btn  = document.getElementById('theme-toggle');
  const root = document.documentElement;
  btn.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    const next   = isDark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('aifes-theme', next);
  });
})();

/* ── Hamburger menu toggle ── */
(function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');
  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
    });
  });
})();

/* ── Scroll-reveal for cards/rows (fade + rise into view) ── */
(function() {
  const targets = document.querySelectorAll(
    '.theme-card, .output-card, .person-card, .comm-card, .partner-cat, ' +
    '.infra-item, .pillar, .tl-item, .edu-feat, .course, .rg-faculty-item'
  );
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  targets.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 6) * 60}ms`;
    observer.observe(el);
  });

  // Safety net: content must never stay invisible for a visitor, screen
  // reader, or crawler that doesn't trigger a scroll/intersection event —
  // force-reveal anything still hidden shortly after load.
  setTimeout(() => {
    targets.forEach(el => el.classList.add('in-view'));
    observer.disconnect();
  }, 2500);
})();

/* ── Hero background: live-scrolling trading chart ── */
(function() {
  const canvas = document.getElementById('hero-chart');
  const hero = document.getElementById('hero');
  if (!canvas || !hero) return;
  const ctx = canvas.getContext('2d');

  // 'gbm' = smooth scrolling curve (current). 'candles' = candlestick chart
  // — swap this back to 'candles' to restore it.
  const MODE = 'gbm';

  // Box-Muller standard normal sample, the noise term driving each GBM step.
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // dS = mu*S*dt + sigma*S*dW — one discretized GBM step from a given price.
  function nextGBM(price, mu, sigma, dt) {
    return price * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * randn());
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;

  /* ---- background bars (static trading-dashboard texture) ---- */
  const bars = { spacing: 68, heights: [] };

  function seedBars() {
    const count = Math.ceil(width / bars.spacing) + 2;
    bars.heights = Array.from({ length: count }, () => .18 + Math.random() * .55);
  }

  function drawBars() {
    const top = height * .12;
    const band = height * .76;
    const barW = bars.spacing * .48;
    bars.heights.forEach((h, i) => {
      const x = i * bars.spacing + bars.spacing * .5;
      const barH = band * h;
      ctx.fillStyle = 'rgba(56,189,248,.09)';
      ctx.fillRect(x - barW / 2, top + band - barH, barW, barH);
    });
  }

  /* ---- line-chart series (MODE: 'gbm') ----
     Dense points + real per-tick GBM noise, joined by straight segments —
     this is what an actual price series looks like (Google/Robinhood-style
     ticker), as opposed to a hand-smoothed decorative wave. */
  const lines = [
    { color: 'rgba(103,232,249,.9)', width: 2, spacing: 4, speed: 46, mu: .01, sigma: .3, dt: .05, price: 100, points: [], offset: 0,
      fill: true, fillTop: 'rgba(34,211,238,.22)', fillBottom: 'rgba(34,211,238,0)', glow: true, dotEvery: 9, dotColor: 'rgba(224,254,254,.95)' },
    { color: 'rgba(148,163,184,.4)', width: 1.25, spacing: 5, speed: 30, mu: -.005, sigma: .22, dt: .05, price: 100, points: [], offset: 0,
      dash: [5, 4] },
  ];

  function seedLine(line) {
    const count = Math.ceil(width / line.spacing) + 4;
    line.points = [line.price];
    for (let i = 1; i < count; i++) {
      line.points.push(nextGBM(line.points[i - 1], line.mu, line.sigma, line.dt));
    }
    line.offset = 0;
  }

  function drawLine(line, now) {
    const values = line.points;
    let min = Infinity, max = -Infinity;
    for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
    const range = Math.max(max - min, 1e-6);
    const top = height * .18;
    const band = height * .64;
    const pts = values.map((v, i) => ({
      x: i * line.spacing - line.offset,
      y: top + band - ((v - min) / range) * band,
    }));
    const lastPt = pts[pts.length - 1];

    if (line.fill) {
      const grad = ctx.createLinearGradient(0, top, 0, top + band);
      grad.addColorStop(0, line.fillTop);
      grad.addColorStop(1, line.fillBottom);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, top + band);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(lastPt.x, top + band);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.setLineDash(line.dash || []);
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (line.glow) { ctx.shadowColor = line.color; ctx.shadowBlur = 8; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    if (line.dotEvery) {
      ctx.fillStyle = line.dotColor;
      for (let i = pts.length - 1; i >= 0; i -= line.dotEvery) {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      const r = 3 + 1.5 * (0.5 + 0.5 * Math.sin(now / 400));
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = line.color;
      ctx.shadowColor = line.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /* ---- candlestick series (MODE: 'candles') ---- */
  const candles = {
    spacing: 18, speed: 26, mu: .015, sigma: .5, dt: .08, price: 100,
    bars: [], offset: 0,
    up:   { body: 'rgba(74,222,128,.55)',  wick: 'rgba(134,239,172,.7)' },
    down: { body: 'rgba(248,113,113,.55)', wick: 'rgba(252,165,165,.7)' },
  };

  function nextCandle(prevClose) {
    const open = prevClose;
    const close = nextGBM(open, candles.mu, candles.sigma, candles.dt);
    const body = Math.abs(close - open) || open * .002;
    const high = Math.max(open, close) + Math.random() * body * .8;
    const low  = Math.min(open, close) - Math.random() * body * .8;
    return { open, close, high, low };
  }

  function seedCandles() {
    const count = Math.ceil(width / candles.spacing) + 4;
    let prev = candles.price;
    candles.bars = [];
    for (let i = 0; i < count; i++) {
      const bar = nextCandle(prev);
      candles.bars.push(bar);
      prev = bar.close;
    }
    candles.offset = 0;
  }

  function drawCandles() {
    const bars = candles.bars;
    let min = Infinity, max = -Infinity;
    for (const b of bars) { if (b.low < min) min = b.low; if (b.high > max) max = b.high; }
    const range = Math.max(max - min, 1e-6);
    const top = height * .16;
    const band = height * .68;
    const bodyW = candles.spacing * .55;
    const y = v => top + band - ((v - min) / range) * band;

    bars.forEach((bar, i) => {
      const x = i * candles.spacing - candles.offset;
      const up = bar.close >= bar.open;
      const c = up ? candles.up : candles.down;

      ctx.strokeStyle = c.wick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y(bar.high));
      ctx.lineTo(x, y(bar.low));
      ctx.stroke();

      const yOpen = y(bar.open), yClose = y(bar.close);
      ctx.fillStyle = c.body;
      ctx.fillRect(x - bodyW / 2, Math.min(yOpen, yClose), bodyW, Math.max(Math.abs(yClose - yOpen), 1.5));
    });
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedBars();
    if (MODE === 'gbm') lines.forEach(seedLine); else seedCandles();
  }

  function renderStatic() {
    const now = performance.now();
    drawBars();
    if (MODE === 'gbm') lines.forEach(line => drawLine(line, now)); else drawCandles();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderStatic();
    return;
  }

  let last = performance.now();
  (function tick(now) {
    const dt = Math.min((now - last) / 1000, .1);
    last = now;
    ctx.clearRect(0, 0, width, height);
    drawBars();

    if (MODE === 'gbm') {
      lines.forEach(line => {
        line.offset += line.speed * dt;
        while (line.offset >= line.spacing) {
          line.offset -= line.spacing;
          line.points.shift();
          line.points.push(nextGBM(line.points[line.points.length - 1], line.mu, line.sigma, line.dt));
        }
        drawLine(line, now);
      });
    } else {
      candles.offset += candles.speed * dt;
      while (candles.offset >= candles.spacing) {
        candles.offset -= candles.spacing;
        candles.bars.shift();
        candles.bars.push(nextCandle(candles.bars[candles.bars.length - 1].close));
      }
      drawCandles();
    }

    requestAnimationFrame(tick);
  })(last);
})();
