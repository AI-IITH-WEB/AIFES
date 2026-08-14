/* ── Hero backdrop: a geometric-Brownian-motion price path ──────────
   Quiet, classy watermark behind the hero copy — a single smooth line
   that evolves as true GBM (dS = μS·dt + σS·dW), auto-scaled like a
   real chart, plus a faint echo for depth. No dots, no sparkle field —
   just a calm line so it doesn't compete with the headline.
   Scrolling both nudges the line forward and pulls the whole backdrop
   into a slow parallax/fade as the hero leaves the viewport.
------------------------------------------------------------------- */
(function () {
  const canvas = document.getElementById('hero-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const hero = canvas.closest('#hero') || canvas.parentElement;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // CSS already hides the canvas in this case

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;
  let running = true;

  /* ---- Box-Muller standard normal sampler ---- */
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---- One GBM price path, scrolling left and extending on the right ---- */
  function makeSeries(opts) {
    return {
      step: opts.step,
      mu: opts.mu,       // drift
      sigma: opts.sigma, // volatility per tick
      home: opts.home,       // level the path is pulled back toward
      reversion: opts.reversion, // pull strength per tick, bounds the walk
      prices: [],        // raw GBM levels (unbounded, log-normal)
      offset: 0,
      speed: opts.speed,
      band: opts.band,       // [top, bottom] as a fraction of hero height
      color: opts.color,
      glow: opts.glow,
      lineWidth: opts.lineWidth,
      showLiveDot: opts.showLiveDot,
      type: opts.type || 'line',
      dispMin: 1, dispMax: 1, // smoothed display range (for gentle auto-scale)
      last: 1,
    };
  }

  // Plain GBM has no mean reversion, so the path can drift steadily in
  // one direction for many ticks — the auto-scaled range then has to
  // keep chasing it, which reads as the chart stretching/flattening
  // vertically instead of just scrolling sideways. Pull each new level
  // back toward the series' home value so it stays bounded, the way an
  // Ornstein-Uhlenbeck process would, while keeping GBM's per-tick noise.
  function nextPrice(series) {
    const dt = 1;
    const z = randn();
    const factor = Math.exp((series.mu - (series.sigma * series.sigma) / 2) * dt + series.sigma * Math.sqrt(dt) * z);
    let val = series.last * factor;
    val += (series.home - val) * series.reversion;
    series.last = Math.max(0.05, val);
    return series.last;
  }

  function prependPrice(series) {
    const prev = series.prices[0] ?? series.last;
    const drift = Math.exp((series.mu - (series.sigma * series.sigma) / 2) * 1);
    const jitter = 1 + (Math.random() - 0.5) * 0.14;
    let val = prev * drift * jitter;
    val += (series.home - val) * series.reversion;
    val = Math.max(0.05, val);
    series.prices.unshift(val);
    return val;
  }

  function seedSeries(series) {
    series.last = 1;
    const count = Math.ceil(width / series.step) + 4;
    series.prices = [];
    for (let i = 0; i < count; i++) series.prices.push(nextPrice(series));
    const { min, max } = rangeOf(series.prices);
    series.dispMin = min;
    series.dispMax = max;
  }

  function rangeOf(arr) {
    let min = Infinity, max = -Infinity;
    for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
    if (min === max) { min -= 1; max += 1; }
    return { min, max };
  }

  /* One calm primary line, plus a much fainter twin behind it for a
     touch of depth — echoing the two overlapping curves in the
     reference image, without turning into visual noise. */
  const primary = makeSeries({
    step: 8, speed: 0.36, mu: 0.0004, sigma: 0.09, home: 1, reversion: 0.08,
    band: [0.30, 0.78],
    color: 'rgba(103,232,249,0.28)', glow: 'rgba(165,243,252,0.4)',
    lineWidth: 1.6, showLiveDot: true, type: 'line',
  });
  const echo = makeSeries({
    step: 9, speed: 0.24, mu: 0.0002, sigma: 0.075, home: 1, reversion: 0.06,
    band: [0.22, 0.86],
    color: 'rgba(56,189,248,0.08)', glow: 'rgba(56,189,248,0.1)',
    lineWidth: 1.3, showLiveDot: false, type: 'bars',
  });
  const series = [echo, primary];

  function resize() {
    const rect = hero.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    series.forEach(seedSeries);
  }

  let scrollBoost = 0; // extra px/frame added briefly when the user scrolls

  function advanceSeries(s) {
    s.offset -= s.speed + scrollBoost * (s.speed / primary.speed);

    while (s.offset <= -s.step) {
      s.offset += s.step;
      s.prices.shift();
      s.prices.push(nextPrice(s));
    }

    while (s.offset > 0) {
      s.offset -= s.step;
      prependPrice(s);
      s.prices.pop();
    }

    // gently ease the displayed min/max toward the current window's
    // range, so the chart auto-scales like a real ticker instead of
    // snapping
    const { min, max } = rangeOf(s.prices);
    s.dispMin += (min - s.dispMin) * 0.015;
    s.dispMax += (max - s.dispMax) * 0.015;
  }

  function drawSeries(s, now) {
    const [top, bottom] = s.band;
    const bandH = (bottom - top) * height;
    const bandY = top * height;
    const range = Math.max(1e-6, s.dispMax - s.dispMin);
    const pad = range * 0.12; // headroom so peaks don't touch band edges

    const pts = s.prices.map((v, i) => {
      const norm = (v - (s.dispMin - pad)) / (range + pad * 2);
      return { x: i * s.step + s.offset, y: bandY + (1 - norm) * bandH };
    });
    if (pts.length < 2) return;

    if (s.type === 'bars') {
      ctx.save();
      ctx.fillStyle = s.color;
      const barWidth = Math.max(4, s.step * 0.82);
      const baseY = bandY + bandH;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const barHeight = Math.max(4, Math.abs(baseY - p.y));
        ctx.fillRect(p.x - barWidth / 2, p.y, barWidth, barHeight);
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 6;

    // Keep the path a little more angular and pointy than the
    // previous smoothed quadratic version, while still staying quiet.
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    if (s.showLiveDot) {
      // Small glowing "bulbs" riding along the line at intervals — they
      // scroll with the data, so they read as lights traveling along the
      // path rather than a static decoration. The halo comes entirely
      // from shadowBlur/shadowColor, so both need to be strong — a dim
      // shadowColor here just makes the dot look flat.
      ctx.shadowColor = 'rgba(165,243,252,0.95)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(224,254,254,0.85)';
      for (let i = pts.length - 1; i >= 0; i -= 7) {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // The live point at the current price pulses gently, like a
      // heartbeat/ticker light, instead of sitting at a fixed size.
      const last = pts[pts.length - 1];
      const pulse = 2.6 + 1.4 * (0.5 + 0.5 * Math.sin(now / 450));
      ctx.shadowColor = 'rgba(165,243,252,1)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(224,254,254,0.95)';
      ctx.beginPath();
      ctx.arc(last.x, last.y, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);
    for (const s of series) {
      advanceSeries(s);
      drawSeries(s, now);
    }
    scrollBoost *= 0.9; // scroll nudge decays back to the base speed
    raf = requestAnimationFrame(frame);
  }

  let raf = null;
  function start() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  /* Pause when the hero isn't visible (scrolled away / tab hidden) to
     save battery — resumes automatically when it comes back. */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        running = entries[0].isIntersecting;
        running ? start() : stop();
      }, { threshold: 0.01 })
    : null;
  if (io) io.observe(hero);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); }
    else if (running) { start(); }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  /* Scroll actually does two visible things:
     1) it fast-forwards the line a little, so scrolling reads as
        "driving" the chart forward, not just a background loop;
     2) the whole backdrop pulls back and fades as the hero scrolls
        out of view, then returns cleanly if you scroll back up. */
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    scrollBoost = Math.min(6, Math.max(-6, scrollBoost + dy * 0.15));

    const rect = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    canvas.style.transform = `translateY(${progress * 90}px) scale(${1 + progress * 0.08})`;
    canvas.style.opacity = String(1 - progress * 0.9);
  }, { passive: true });

  resize();
  start();
})();
