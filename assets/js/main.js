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
