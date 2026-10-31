/* Feynlearn — GSAP choreography.
   ScrollSmoother (smooth scroll + data-speed parallax), SplitText (headline reveals),
   DrawSVG (hand-drawn doodles), MorphSVG (scribble brain → lightbulb),
   MotionPath (Feyn walks the roadmap) and pinned ScrollTrigger timelines
   (hero "aha" moment + 3D notebook page flips). */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;

  // Mode is resolved in <head>: full | calm (OS reduced-motion) | off (visitor opt-out)
  const mode = root.dataset.motion || 'full';
  const off = mode === 'off';
  const full = mode === 'full';
  let smoother = null;

  /* ---------------- Feyn's scribble brain (seeded, like the logo) ---------------- */
  function buildScribble() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pts = [];
    const LOOPS = 13;
    for (let i = 0; i < LOOPS; i++) {
      const a = (i / LOOPS) * Math.PI * 2 + rnd() * 0.6;
      const k = 0.35 + rnd() * 0.6;
      const cx = 260 + Math.cos(a) * 150 * k, cy = 158 + Math.sin(a) * 92 * k;
      const r = 36 + rnd() * 30, s = rnd() * Math.PI * 2;
      for (let j = 0; j <= 13; j++) {
        const t = s + (j / 12) * Math.PI * 2;
        pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.86]);
      }
    }
    // Catmull-Rom → cubic Bézier for one smooth, continuous pen stroke
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    $('#scribble').setAttribute('d', d);
  }
  buildScribble();

  /* ---------------- Motion toggle (footer) ---------------- */
  const motionToggle = $('.motion-toggle');
  motionToggle.setAttribute('aria-pressed', String(off));
  motionToggle.textContent = off ? 'Enable motion' : 'Reduce motion';
  motionToggle.addEventListener('click', () => {
    try { off ? localStorage.removeItem('fl-motion') : localStorage.setItem('fl-motion', 'off'); } catch (e) {}
    location.reload();
  });

  /* ---------------- Mobile menu ---------------- */
  const toggle = $('.nav-toggle');
  const menu = $('#mobile-menu');
  const setMenu = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (smoother) smoother.paused(open);
    if (open && window.gsap && !off) gsap.from($$('a', menu), { x: -40, autoAlpha: 0, stagger: 0.06, duration: 0.5, ease: 'back.out(1.6)' });
  };
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); } });

  // Without GSAP the page stays in its static, fully readable layout.
  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('js'); return; }
  gsap.registerPlugin(...[ScrollTrigger, window.ScrollSmoother, window.SplitText, window.DrawSVGPlugin, window.MorphSVGPlugin, window.MotionPathPlugin].filter(Boolean));
  const has = { split: !!window.SplitText, draw: !!window.DrawSVGPlugin, morph: !!window.MorphSVGPlugin, path: !!window.MotionPathPlugin };

  /* ---------------- Smooth scroll ---------------- */
  if (full && window.ScrollSmoother) {
    smoother = ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1.1, effects: true, smoothTouch: 0.1 });
  }

  /* ---------------- Anchor links ---------------- */
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 && $(id);
      if (!target) return;
      e.preventDefault();
      if (!menu.hidden) setMenu(false);
      if (smoother) smoother.scrollTo(target, true, 'top 84px');
      else window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - 84, behavior: off ? 'auto' : 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    })
  );

  /* ---------------- Road path between roadmap stops ---------------- */
  const road = $('.road');
  const roadSvg = $('.road-svg');
  const roadPath = $('#road-path');
  const roadBg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  roadBg.setAttribute('class', 'road-bg');
  roadSvg.insertBefore(roadBg, roadPath);
  function buildRoad() {
    const rr = road.getBoundingClientRect();
    const W = road.offsetWidth, H = road.offsetHeight;
    roadSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pts = $$('.stop-dot', road).map((dot) => {
      const r = dot.getBoundingClientRect();
      return [r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2];
    });
    let d = `M${pts[0][0]} 0 L${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], my = (y1 + y2) / 2;
      d += ` C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
    }
    d += ` L${pts[pts.length - 1][0]} ${H}`;
    roadPath.setAttribute('d', d);
    roadBg.setAttribute('d', d);
  }
  buildRoad();

  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(init);

  function init() {
  /* ---------------- Counters ---------------- */
  const countUp = (el) => {
    const end = parseFloat(el.dataset.count), o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) });
  };

  /* ================= OFF: final static states only ================= */
  if (off) {
    gsap.set('.hero .h-in, .hero-title, .feyn, .hero-note', { autoAlpha: 1 });
    if (has.draw) $$('.mk-bar').forEach((b) => gsap.set(b, { drawSVG: `0% ${b.dataset.v}%` }));
    $$('.stop').forEach((s) => s.classList.add('is-lit'));
    if (has.path) gsap.set('.road-feyn', { motionPath: { path: roadPath, align: roadPath, alignOrigin: [0.5, 0.85], end: 0.02 } });
    addEventListener('resize', buildRoad);
    return;
  }

  /* ================= HERO: intro ================= */
  const scribble = $('#scribble');
  const bulbBits = ['.bulb-base', '.bulb-fil', '.bulb-rays'];
  if (has.draw) gsap.set(bulbBits, { drawSVG: '0%' });
  gsap.set(['.bulb-extra', '.aha'], { autoAlpha: 1 });
  gsap.set('.aha', { scale: 0, transformOrigin: '50% 50%' });
  gsap.set('.mark', { '--s': 0 });

  let titleChars = [];
  if (has.split) {
    const st = SplitText.create($$('.hero-title .ht-line').slice(0, 2), { type: 'chars' });
    titleChars = st.chars;
  }
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .set('.hero-title', { autoAlpha: 1 })
    .from('.nav', { y: -90, duration: 0.9, ease: 'back.out(1.4)' }, 0)
    .from(titleChars.length ? titleChars : '.ht-line', { yPercent: 120, rotation: 10, autoAlpha: 0, stagger: 0.03, duration: 0.8, ease: 'back.out(1.8)' }, 0.15)
    .from('.mark', { scale: 0.4, rotation: -12, autoAlpha: 0, duration: 0.7, ease: 'back.out(2.2)' }, 0.65)
    .to('.mark', { '--s': 1, duration: 0.5, ease: 'power2.inOut' }, 0.95)
    .fromTo('.hero .h-in', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.1, duration: 0.8 }, 0.9)
    .fromTo('.feyn', { autoAlpha: 0, y: 90, scale: 0.6, svgOrigin: '260 570' }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.55)' }, 0.5)
    .fromTo('.hero-note', { autoAlpha: 0, y: -80, rotation: -30 }, { autoAlpha: 1, y: 0, rotation: -7, duration: 1, ease: 'bounce.out' }, 1.3);
  if (has.draw) {
    intro
      .fromTo(scribble, { drawSVG: '0%' }, { drawSVG: '100%', duration: 2.4, ease: 'power1.inOut', onComplete: () => gsap.set(scribble, { clearProps: 'strokeDasharray,strokeDashoffset' }) }, 0.8)
      .fromTo('.mark-circle .draw', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, ease: 'power2.inOut' }, 1.3)
      .fromTo('.hero-for-arrow .draw', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6 }, 1.6);
  }

  // Feyn's idle life (full motion only)
  if (full) {
    gsap.timeline({ repeat: -1, repeatDelay: 2.8, delay: 2 })
      .to('.f-eyes', { scaleY: 0.1, svgOrigin: '100 114', duration: 0.08 })
      .to('.f-eyes', { scaleY: 1, duration: 0.12 });
    gsap.to('.f-tassel', { rotation: 10, svgOrigin: '100 66', duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo('.f-arm-r', { rotation: -14 }, { rotation: 12, svgOrigin: '130 168', duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1, repeatDelay: 0.1 });
    gsap.to('.f-head', { y: -3, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  /* ================= HERO: pinned "aha" — scribble untangles into a lightbulb ================= */
  if (has.morph) {
    const aha = gsap.timeline({
      scrollTrigger: {
        trigger: '.hero', start: 'bottom bottom', end: '+=90%', pin: true, scrub: 0.8, // on phones the art sits below the fold; pin once it's in view
        onEnter: () => intro.progress() < 1 && intro.progress(1),
      },
    });
    aha
      .to('.scroll-hint', { autoAlpha: 0, duration: 0.2 }, 0)
      .to(scribble, { morphSVG: { shape: '#bulb-shape' }, stroke: '#f5a524', strokeWidth: 5, duration: 1, ease: 'power1.inOut' }, 0)
      .to('.f-mouth', { morphSVG: 'M88 128q12 18 24 0', duration: 0.3 }, 0.75)
      .to('.f-arm-l', { morphSVG: 'M70 168q-20-10-30-34', duration: 0.3 }, 0.75)
      .to('.aha', { scale: 1, rotation: -10, duration: 0.3, ease: 'back.out(2.5)' }, 1.05)
      .to('.hero-caption', { autoAlpha: 0, duration: 0.2 }, 0.9);
    if (has.draw) {
      aha
        .to(['.bulb-base', '.bulb-fil'], { drawSVG: '100%', duration: 0.35, stagger: 0.1 }, 0.75)
        .to('.bulb-rays', { drawSVG: '100%', duration: 0.3 }, 1.0);
    }
  }

  /* ================= Tape marquees — speed + direction follow your scroll ================= */
  const tapeTweens = $$('.tape-track').map((t, i) =>
    gsap.fromTo(t, { xPercent: i % 2 ? -50 : 0 }, { xPercent: i % 2 ? 0 : -50, duration: 28, ease: 'none', repeat: -1 })
  );
  let tapeVel = 0, tapeDir = 1, tapeSpeed = full ? 1 : 0;
  ScrollTrigger.create({ onUpdate: (self) => { tapeVel = self.getVelocity(); tapeDir = self.direction; } });
  gsap.ticker.add(() => {
    const boost = Math.min(Math.abs(tapeVel) / 250, 7);
    const target = tapeDir * ((full ? 1 : 0) + boost);
    tapeSpeed += (target - tapeSpeed) * 0.08;
    tapeVel *= 0.9;
    tapeTweens.forEach((t) => t.timeScale(tapeSpeed || 0.0001));
  });

  /* ================= Headings: SplitText word pop + hand-drawn extras ================= */
  if (has.split) {
    $$('.split').forEach((el) => {
      SplitText.create(el, {
        type: 'words',
        autoSplit: true,
        onSplit: (self) => {
          const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
          tl.from(self.words, { y: 46, rotation: () => gsap.utils.random(-8, 8), autoAlpha: 0, stagger: 0.06, duration: 0.8, ease: 'back.out(1.7)' });
          $$('.hl-block, .mark-y', el).forEach((h) => tl.fromTo(h, { '--s': 0 }, { '--s': 1, duration: 0.6, ease: 'power2.inOut' }, '-=0.25'));
          if (has.draw) $$('.doodle .draw', el).forEach((p) => tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, ease: 'power2.inOut' }, '-=0.2'));
          return tl;
        },
      });
    });
  }
  if (has.draw) {
    $$('.doodle .draw').forEach((p) => {
      if (p.closest('.hero') || p.closest('.chalk-line') || p.closest('.red-circle') || (has.split && p.closest('.split'))) return;
      gsap.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1, delay: 0.1, ease: 'power2.inOut', scrollTrigger: { trigger: p.closest('svg'), start: 'top 88%', once: true } });
    });
  }
  gsap.utils.toArray('.fade').forEach((el) =>
    gsap.from(el, { y: 50, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
  );

  /* ================= Problem: sticky notes slap onto the page ================= */
  gsap.from('.note-card', {
    y: -160, rotationX: -80, rotation: () => gsap.utils.random(-25, 25), autoAlpha: 0, transformPerspective: 900, transformOrigin: '50% 0%',
    duration: 1.1, stagger: 0.18, ease: 'back.out(1.3)',
    scrollTrigger: { trigger: '.notes', start: 'top 80%', once: true },
  });

  // Report card: marker strokes, red-pen circle, counters
  const report = gsap.timeline({ scrollTrigger: { trigger: '.report', start: 'top 70%', once: true } });
  if (has.draw) {
    $$('.mk-bar').forEach((b, i) => report.fromTo(b, { drawSVG: '0%' }, { drawSVG: `0% ${b.dataset.v}%`, duration: 1.2, ease: 'power3.out' }, i * 0.15));
    report.fromTo('.red-circle .draw', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power2.inOut' }, 1);
  }
  report
    .add(() => $$('.report [data-count]').forEach(countUp), 0)
    .from('.red-note', { scale: 0, rotation: -20, duration: 0.5, ease: 'back.out(2.5)', transformOrigin: '0% 50%' }, 1.3);

  /* ================= Blackboard: the quote gets chalk-written as you scroll ================= */
  if (has.split) {
    SplitText.create('.chalk-text', {
      type: 'chars, words', autoSplit: true,
      onSplit: (self) => gsap.from(self.chars, {
        autoAlpha: 0, y: 8, rotation: () => gsap.utils.random(-12, 12), stagger: 0.04, ease: 'none',
        scrollTrigger: { trigger: '.chalk-quote', start: 'top 78%', end: 'bottom 50%', scrub: true },
      }),
    });
  }
  if (has.draw) {
    gsap.fromTo('.chalk-line .draw', { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', scrollTrigger: { trigger: '.chalk-quote', start: 'bottom 70%', end: 'bottom 45%', scrub: true } });
    gsap.fromTo('.chalk-atom .draw', { drawSVG: '0%' }, { drawSVG: '100%', stagger: 0.2, ease: 'none', scrollTrigger: { trigger: '.board-stat', start: 'top 85%', end: 'center 55%', scrub: true } });
  }
  if (full) gsap.to('.chalk-atom .draw-g', { rotation: 360, svgOrigin: '100 100', duration: 30, ease: 'none', repeat: -1 });
  ScrollTrigger.create({ trigger: '.board-stat', start: 'top 75%', once: true, onEnter: () => $$('.board-stat [data-count]').forEach(countUp) });
  gsap.from('.index-card', {
    rotationY: (i) => (i ? 90 : -90), autoAlpha: 0, transformPerspective: 1000, duration: 1, stagger: 0.2, ease: 'back.out(1.4)',
    scrollTrigger: { trigger: '.board-grid', start: 'top 80%', once: true },
  });

  /* ================= How it works: the 3D notebook ================= */
  const mm = gsap.matchMedia();
  const how = $('.how');
  const book = $('.book');
  const pages = $$('.page', book);
  const dots = $$('.book-steps span');
  mm.add('(min-width: 900px) and (min-height: 600px)', () => {
    how.classList.add('is-3d');
    $$('.face', book).forEach((f) => { if (!$('.shade', f)) f.insertAdjacentHTML('beforeend', '<span class="shade"></span>'); });
    gsap.set(pages, { zIndex: (i) => 3 - i, transformPerspective: 2600 });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: how, start: 'top top', end: '+=320%', pin: true, scrub: 1,
        snap: { snapTo: 'labels', duration: { min: 0.2, max: 0.6 }, delay: 0.1, ease: 'power1.inOut' },
        onUpdate: (self) => { const step = Math.round(self.progress * 3); dots.forEach((d, i) => d.classList.toggle('is-on', i === step)); },
      },
    });
    tl.addLabel('p0').fromTo(book, { rotationX: 18, scale: 0.92, transformPerspective: 2400 }, { rotationX: 6, scale: 1, duration: 3.6, ease: 'none' }, 0);
    pages.forEach((page, i) => {
      const at = i * 1.2;
      const front = $('.front .shade', page), back = $('.back .shade', page);
      tl.to(page, { rotationY: -180, duration: 1 }, at)
        .set(page, { zIndex: 10 + i }, at + 0.5)
        .fromTo(front, { opacity: 0 }, { opacity: 0.45, duration: 0.5, ease: 'none' }, at)
        .fromTo(back, { opacity: 0.45 }, { opacity: 0, duration: 0.5, ease: 'none', immediateRender: false }, at + 0.5)
        .addLabel('p' + (i + 1), at + 1);
    });
    return () => { how.classList.remove('is-3d'); gsap.set([book, ...pages], { clearProps: 'all' }); };
  });
  mm.add('(max-width: 899px), (max-height: 599px)', () => {
    gsap.utils.toArray('.book .face').forEach((f) =>
      gsap.from(f, { y: 60, rotationX: -25, transformPerspective: 900, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: f, start: 'top 88%', once: true } })
    );
  });

  /* ================= Extras: stickers peel on, chips pop ================= */
  gsap.from('.sticker-wrap', {
    y: 140, rotation: () => gsap.utils.random(-35, 35), scale: 1.35, autoAlpha: 0, duration: 0.9, stagger: 0.15, ease: 'back.out(1.5)',
    scrollTrigger: { trigger: '.stickers', start: 'top 80%', once: true },
  });
  gsap.from('.chips li', { scale: 0, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: 'back.out(2.5)', scrollTrigger: { trigger: '.chips', start: 'top 90%', once: true } });

  /* ================= Roadmap: Feyn walks the road ================= */
  ScrollTrigger.addEventListener('refreshInit', buildRoad);
  if (has.draw) {
    gsap.fromTo(roadBg, { drawSVG: '0%' }, { drawSVG: '100%', ease: 'none', scrollTrigger: { trigger: road, start: 'top 60%', end: 'bottom 60%', scrub: true } });
  }
  if (has.path) {
    gsap.to('.road-feyn', {
      motionPath: { path: roadPath, align: roadPath, alignOrigin: [0.5, 0.85] },
      ease: 'none', immediateRender: true,
      scrollTrigger: { trigger: road, start: 'top 60%', end: 'bottom 60%', scrub: 1, invalidateOnRefresh: true },
    });
    if (full) gsap.to('.road-feyn use', { rotation: 7, transformOrigin: '50% 100%', duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
  $$('.stop').forEach((stop, i) => {
    ScrollTrigger.create({ trigger: stop, start: 'top 60%', onEnter: () => stop.classList.add('is-lit'), onLeaveBack: () => stop.classList.remove('is-lit') });
    gsap.from($('.stop-card', stop), { x: i % 2 ? 90 : -90, rotation: i % 2 ? 6 : -6, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.4)', scrollTrigger: { trigger: stop, start: 'top 82%', once: true } });
  });
  gsap.from('.you-here', { scale: 0, rotation: -30, duration: 0.6, ease: 'back.out(3)', delay: 0.6, scrollTrigger: { trigger: '.stop', start: 'top 75%', once: true } });

  /* ================= Parents letter ================= */
  gsap.from('.letter', { y: 120, rotation: -6, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.letter', start: 'top 85%', once: true } });

  /* ================= CTA: Feyn jumps, confetti bursts ================= */
  const confetti = $('.confetti');
  const colors = ['#f5a524', '#52b788', '#f4a58a', '#2457d6', '#e8772e', '#1a2a52'];
  ScrollTrigger.create({
    trigger: '.cta', start: 'top 55%', once: true,
    onEnter: () => {
      gsap.fromTo('.cta-feyn', { y: 80, scale: 0.4 }, { y: 0, scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.5)' });
      if (full) gsap.to('.cta-feyn', { y: -18, duration: 0.45, ease: 'power1.out', yoyo: true, repeat: -1, delay: 1.3, repeatDelay: 0.6 });
      for (let i = 0; i < 46; i++) {
        const bit = document.createElement('i');
        bit.style.background = colors[i % colors.length];
        confetti.appendChild(bit);
        gsap.fromTo(bit, { x: 0, y: 0, rotation: 0, autoAlpha: 1 }, {
          x: gsap.utils.random(-560, 560), y: gsap.utils.random(-320, 420), rotation: gsap.utils.random(-720, 720),
          autoAlpha: 0, duration: gsap.utils.random(1.4, 2.6), ease: 'power2.out', onComplete: () => bit.remove(),
        });
      }
    },
  });

  /* ================= Nav: active section ================= */
  const navLinks = $$('.nav-links a');
  ['how', 'science', 'roadmap', 'parents', 'faq'].forEach((id) =>
    ScrollTrigger.create({
      trigger: '#' + id, start: 'top center', end: 'bottom center',
      onToggle: (self) => self.isActive && navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id)),
    })
  );

  addEventListener('load', () => ScrollTrigger.refresh());
  }
})();
