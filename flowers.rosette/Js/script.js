/* =========================================================
   ROSETTE FLOWERS — script.js
   GSAP + ScrollTrigger + Lenis + Three.js (3D bloom)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- guards ---------- */
  if (!window.gsap) {
    var pre = document.getElementById('preloader');
    if (pre) pre.style.display = 'none';
    document.body && document.body.classList.remove('is-loading');
    return;
  }
  var hasST = !!window.ScrollTrigger;
  if (hasST) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  var RM    = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE  = window.matchMedia('(pointer: fine)').matches;
  var NAV_H = 72;

  /* ---------- smooth scrolling (Lenis) ---------- */
  var lenis = null;
  if (window.Lenis && !RM) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    if (hasST) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // locked until preloader finishes
  }

  /* ---------- tiny helpers ---------- */
  function debounce(fn, ms) {
    var id; return function () {
      clearTimeout(id); var a = arguments, t = this;
      id = setTimeout(function () { fn.apply(t, a); }, ms);
    };
  }
  function splitLetters(el) {
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = el.classList.contains('hero-giant') ? 'gl' : 'fl';
      s.textContent = text[i];
      el.appendChild(s);
    }
    return el.querySelectorAll('span');
  }
  /* Split by WORDS (keeps Arabic letter-joining intact) */
  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) {
      return '<span class="w"><span class="w-inner">' + w + '</span></span>';
    }).join(' ');
    return el.querySelectorAll('.w-inner');
  }

  /* =====================================================
     CUSTOM CURSOR
     ===================================================== */
  if (FINE) {
    document.body.classList.add('has-cursor');
    var dot  = document.querySelector('.cursor-dot');
    var ring = document.querySelector('.cursor-ring');
    var dX = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power2' }),
        dY = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power2' }),
        rX = gsap.quickTo(ring, 'x', { duration: .38, ease: 'power3' }),
        rY = gsap.quickTo(ring, 'y', { duration: .38, ease: 'power3' });
    window.addEventListener('mousemove', function (e) {
      dX(e.clientX); dY(e.clientY); rX(e.clientX); rY(e.clientY);
    });
    var hoverSel = 'a, button, .g-card, .occ-link, .reel';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(hoverSel)) {
        gsap.to(ring, { scale: 1.7, borderColor: 'rgba(224,80,122,.9)', duration: .3 });
        gsap.to(dot,  { scale: .5, duration: .3 });
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(hoverSel)) {
        gsap.to(ring, { scale: 1, borderColor: 'rgba(244,234,217,.4)', duration: .3 });
        gsap.to(dot,  { scale: 1, duration: .3 });
      }
    });
  }

  /* =====================================================
     MAGNETIC BUTTONS
     ===================================================== */
  if (FINE) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: .4, ease: 'power3' }),
          yTo = gsap.quickTo(el, 'y', { duration: .4, ease: 'power3' });
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * .35);
        yTo((e.clientY - (r.top + r.height / 2)) * .35);
      });
      el.addEventListener('mouseleave', function () { xTo(0); yTo(0); });
    });
  }

  /* =====================================================
     THREE.JS — the blooming rose (instanced petals)
     ===================================================== */
  function initFlowerScene() {
    var canvas = document.getElementById('flowerCanvas');
    if (!canvas || !window.THREE) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (err) { canvas.style.display = 'none'; return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, .1, 120);
    camera.position.set(0, 0, 27);

    /* petal texture drawn on canvas */
    var tex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var g = c.getContext('2d');
      var grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#ffd9e0');
      grad.addColorStop(.45, '#f0688f');
      grad.addColorStop(1, '#8f1030');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(128, 14);
      g.bezierCurveTo(198, 40, 216, 122, 196, 184);
      g.bezierCurveTo(180, 230, 150, 246, 128, 246);
      g.bezierCurveTo(106, 246, 76, 230, 60, 184);
      g.bezierCurveTo(40, 122, 58, 40, 128, 14);
      g.closePath(); g.fill();
      var sheen = g.createRadialGradient(126, 86, 4, 126, 86, 72);
      sheen.addColorStop(0, 'rgba(255,255,255,.55)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen; g.fillRect(0, 0, 256, 256);
      var t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      return t;
    })();

    /* soft glow sprites behind the flower */
    var glowTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 128;
      var g = c.getContext('2d');
      var rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    function addGlow(color, size, x, y, z, opacity) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: color, transparent: true, opacity: opacity, depthWrite: false
      }));
      sp.scale.set(size, size, 1); sp.position.set(x, y, z);
      scene.add(sp);
    }
    addGlow(0xe0507a, 36, 0, 0, -9, .38);
    addGlow(0xf4ead9, 16, -6, 4, -5, .10);

    /* petal geometry with a slight inward curl */
    var petalGeo = new THREE.PlaneGeometry(1.15, 1.5, 8, 10);
    (function () {
      var pos = petalGeo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var y = pos.getY(i);
        var t = (y + .75) / 1.5;
        pos.setZ(i, -Math.pow(t, 2) * .38);
      }
      pos.needsUpdate = true;
      petalGeo.computeVertexNormals();
    })();
    /* white base vertex colors so instance tinting always works */
    function withWhiteColors(geo) {
      var n = geo.attributes.position.count;
      var arr = new Float32Array(n * 3);
      for (var i = 0; i < n * 3; i++) arr[i] = 1;
      geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return geo;
    }
    withWhiteColors(petalGeo);

    var isSmall = Math.min(window.innerWidth, window.innerHeight) < 760;
    var bud = { n: isSmall ? 18 : 26, r: .95, tilt: .32, y: .62, s: .8, col: 0xffdce5 };
    var layers = [
      { n: isSmall ? 36 : 46,  r: 2.0, tilt: .62,  y: .34,  s: 1.05, col: 0xffa8bf },
      { n: isSmall ? 44 : 58,  r: 3.1, tilt: .90,  y: .06,  s: 1.16, col: 0xf76d95 },
      { n: isSmall ? 52 : 72,  r: 4.3, tilt: 1.12, y: -.24, s: 1.24, col: 0xe13a6b },
      { n: isSmall ? 60 : 86,  r: 5.6, tilt: 1.32, y: -.55, s: 1.30, col: 0xc41d50 },
      { n: isSmall ? 66 : 100, r: 7.0, tilt: 1.48, y: -.85, s: 1.32, col: 0x9c1140 }
    ];
    var all = [bud].concat(layers);
    var total = all.reduce(function (a, l) { return a + l.n; }, 0);

    var petalMat = new THREE.MeshBasicMaterial({
      map: tex, vertexColors: true, alphaTest: .5, side: THREE.DoubleSide
    });
    var flower = new THREE.InstancedMesh(petalGeo, petalMat, total);
    flower.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flower.frustumCulled = false;

    var group = new THREE.Group();
    group.add(flower);
    scene.add(group);

    var dummy = new THREE.Object3D();
    var data = [], idx = 0;
    all.forEach(function (L, li) {
      for (var i = 0; i < L.n; i++) {
        var a = (i / L.n) * Math.PI * 2 + li * .55;
        data.push({
          a: a,
          rOpen: L.r * (0.92 + Math.random() * .16),
          tiltOpen: L.tilt + (Math.random() - .5) * .14,
          yOpen: L.y + (Math.random() - .5) * .12,
          size: L.s * (0.9 + Math.random() * .25),
          phase: Math.random() * Math.PI * 2,
          swayAmp: .015 + Math.random() * .03,
          swaySpd: .5 + Math.random() * .9,
          curl: (Math.random() - .5) * .14,
          delay: li * .07 + Math.random() * .05
        });
        var c = new THREE.Color(L.col);
        c.offsetHSL((Math.random() - .5) * .02, 0, (Math.random() - .5) * .07);
        flower.setColorAt(idx++, c);
      }
    });
    if (flower.instanceColor) flower.instanceColor.needsUpdate = true;

    /* drifting petals */
    var FP = isSmall ? 36 : 80;
    var fpGeo = withWhiteColors(new THREE.PlaneGeometry(.55, .75));
    var fpMat = new THREE.MeshBasicMaterial({
      map: tex, vertexColors: true, alphaTest: .5,
      side: THREE.DoubleSide, transparent: true, opacity: .95
    });
    var fp = new THREE.InstancedMesh(fpGeo, fpMat, FP);
    fp.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    fp.frustumCulled = false;
    var fpd = [];
    for (var fi = 0; fi < FP; fi++) {
      fpd.push({
        x: (Math.random() - .5) * 34, y: -14 + Math.random() * 30, z: -6 + Math.random() * 12,
        vy: .5 + Math.random() * 1.1, swayAmp: .6 + Math.random() * 1.6,
        swaySpd: .25 + Math.random() * .6, ph: Math.random() * Math.PI * 2,
        rs: (Math.random() - .5) * 1.4, s: .45 + Math.random() * .8
      });
      var fc = new THREE.Color().setHSL(.93 + Math.random() * .04, .6, .42 + Math.random() * .28);
      fp.setColorAt(fi, fc);
    }
    if (fp.instanceColor) fp.instanceColor.needsUpdate = true;
    scene.add(fp);

    /* state — GSAP animates these */
    var F = { bloom: 0, scroll: 0, mx: 0, my: 0, visible: true, baseScale: 1 };
    var smx = 0, smy = 0;
    var clock = new THREE.Clock();

    function smooth(a, b, x) {
      x = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return x * x * (3 - 2 * x);
    }

    function updatePetals() {
      for (var i = 0; i < data.length; i++) {
        var d = data[i];
        var lp = smooth(d.delay, d.delay + .55, F.bloom);
        var e = lp * lp * (3 - 2 * lp);
        var r = .3 + (d.rOpen - .3) * e;
        var tilt = .05 + (d.tiltOpen - .05) * e;
        var y = d.yOpen * e + (1 - e) * .55;
        var s = d.size * (.18 + .82 * e);
        var sway = Math.sin(clock.elapsedTime * d.swaySpd + d.phase) * d.swayAmp * (.3 + e);
        dummy.position.set(Math.cos(d.a) * r, y, Math.sin(d.a) * r);
        dummy.rotation.set(0, Math.PI / 2 - d.a, 0);
        dummy.rotateX(tilt + sway);
        dummy.rotateZ(d.curl);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        flower.setMatrixAt(i, dummy.matrix);
      }
      flower.instanceMatrix.needsUpdate = true;
    }
    function updateFloat(dt) {
      for (var i = 0; i < FP; i++) {
        var p = fpd[i];
        p.y -= p.vy * dt;
        if (p.y < -14) { p.y = 15; p.x = (Math.random() - .5) * 34; }
        dummy.position.set(p.x + Math.sin(clock.elapsedTime * p.swaySpd + p.ph) * p.swayAmp, p.y, p.z);
        dummy.rotation.set(0, clock.elapsedTime * p.rs * .5 + p.ph, Math.sin(clock.elapsedTime * .7 + p.ph) * .7);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        fp.setMatrixAt(i, dummy.matrix);
      }
      fp.instanceMatrix.needsUpdate = true;
    }

    gsap.ticker.add(function () {
      var dt = Math.min(clock.getDelta(), .05);
      if (!F.visible || document.hidden) return;
      var t = clock.elapsedTime;
      smx += (F.mx - smx) * .05;
      smy += (F.my - smy) * .05;
      group.rotation.y = t * .12 + F.scroll * 1.6;
      group.rotation.x = smy * .16;
      group.scale.setScalar(F.baseScale * (1 - F.scroll * .2));
      group.position.y = Math.sin(t * .5) * .3 + F.scroll * 5;
      camera.position.x = smx * 2.2;
      camera.position.y = -smy * 1.4;
      camera.lookAt(0, 0, 0);
      updatePetals();
      updateFloat(dt);
      renderer.render(scene, camera);
    });

    window.addEventListener('pointermove', function (e) {
      F.mx = (e.clientX / window.innerWidth) * 2 - 1;
      F.my = -((e.clientY / window.innerHeight) * 2 - 1);
    });

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w < 760 ? 33 : 27;
      camera.updateProjectionMatrix();
      F.baseScale = w < 760 ? .62 : (w < 1200 ? .85 : 1);
    }
    window.addEventListener('resize', resize);
    resize();

    return F;
  }
  var F = initFlowerScene();

  /* =====================================================
     COUNTERS
     ===================================================== */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var o = { v: 0 };
    gsap.to(o, {
      v: target, duration: RM ? .01 : 2.2, ease: 'power2.out',
      onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('en-US'); }
    });
  }

  /* =====================================================
     MARQUEE
     ===================================================== */
  var mqRows = Array.prototype.slice.call(document.querySelectorAll('.mq-row'));
  var mqOriginal = mqRows.map(function (r) { return r.innerHTML; });
  var mqTweens = [];
  function buildMarquees() {
    mqTweens.forEach(function (t) { t.kill(); });
    mqTweens = [];
    mqRows.forEach(function (row, i) {
      row.innerHTML = mqOriginal[i];
      var chunk = row.querySelector('.mq-chunk');
      var guard = 0;
      while (chunk.getBoundingClientRect().width * row.children.length < window.innerWidth * 2 + chunk.getBoundingClientRect().width && guard++ < 10) {
        row.appendChild(chunk.cloneNode(true));
      }
      var w = chunk.getBoundingClientRect().width;
      var dur = Math.max(12, w / 110);
      mqTweens.push(
        i === 0
          ? gsap.to(row, { x: -w, duration: dur, ease: 'none', repeat: -1 })
          : gsap.fromTo(row, { x: -w }, { x: 0, duration: dur, ease: 'none', repeat: -1 })
      );
      if (RM) { mqTweens.forEach(function (t) { t.kill(); }); mqTweens = []; }
    });
  }

  /* =====================================================
     GALLERY — build 15 cards + pinned horizontal scroll
     ===================================================== */
  var galleryCaptions = [
    { t: 'الورد الأحمر الكلاسيكي',   g: 'باقات' },
    { t: 'صندوق روزيت الموقّع',      g: 'صناديق' },
    { t: 'أناقة البياض',             g: 'تنسيقات' },
    { t: 'مفاجآت أعياد الميلاد',     g: 'هدايا' },
    { t: 'زنابق بلمسة وردية',        g: 'باقات' },
    { t: 'توصيل حتى بابك',           g: 'توصيل' },
    { t: 'قلوب تسبق الكلام',         g: 'مناسبات' },
    { t: 'باقة الموسم',              g: 'باقات' },
    { t: 'قبعة مليانة ورد',          g: 'صناديق' },
    { t: 'رفقة جديدة للغرفة',        g: 'هدايا' },
    { t: 'تفاصيل تفرّح',             g: 'تنسيقات' },
    { t: 'أحمر بدرجة احتفال',        g: 'باقات' },
    { t: 'صفاء يليق بالمناسبة',      g: 'تنسيقات' },
    { t: 'كيك وهدايا مختارة',        g: 'هدايا' },
    { t: 'توقيع روزيت',              g: 'أعمالنا' }
  ];

  function buildGallery() {
    var track = document.getElementById('galleryTrack');
    if (!track) return;

    var html = '' +
      '<figure class="g-card g-card--text g-lg">' +
        '<span class="g-intro-title">مختارات من <b>9,474+</b> عمل<br>على إنستغرام</span>' +
        '<span class="handle" dir="ltr">@flowers.rosette</span>' +
      '</figure>';

    galleryCaptions.forEach(function (c, i) {
      var cls = i % 3 === 0 ? 'g-lg' : (i % 3 === 1 ? 'g-md' : 'g-sm');
      html += '' +
        '<figure class="g-card ' + cls + '">' +
          '<div class="g-media"><img src="../Images/' + (i + 1) + '.png" alt="' + c.t + '" loading="lazy"></div>' +
          '<span class="g-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<figcaption class="g-cap"><span class="g-tag">' + c.g + '</span><span class="g-title">' + c.t + '</span></figcaption>' +
        '</figure>';
    });

    html += '' +
      '<a class="g-card g-card--text g-cta g-lg" href="https://www.instagram.com/flowers.rosette/" target="_blank" rel="noopener">' +
        '<span class="big">شاهد كل أعمالنا<br>على إنستغرام</span>' +
        '<span class="handle" dir="ltr">@flowers.rosette ↗</span>' +
      '</a>';

    track.innerHTML = html;

    /* hide any missing image gracefully */
    track.addEventListener('error', function (e) {
      if (e.target.tagName === 'IMG') {
        var fig = e.target.closest('.g-card');
        if (fig) fig.remove();
        if (hasST) ScrollTrigger.refresh();
      }
    }, true);
  }

  function initGalleryScroll() {
    if (!hasST) return;
    var track = document.getElementById('galleryTrack');
    var wrap  = document.querySelector('.gallery-wrap');
    if (!track || !wrap) return;

    var getAmount = function () {
      return Math.max(0, track.scrollWidth - wrap.clientWidth);
    };
    var scrollTween = gsap.to(track, {
      x: function () { return -getAmount(); },
      ease: 'none',
      scrollTrigger: {
        trigger: '#gallery',
        start: 'top top',
        end: function () { return '+=' + (getAmount() + window.innerHeight * .35); },
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          gsap.set('#galleryProgress', { scaleX: self.progress });
        }
      }
    });

    /* inner image parallax while cards travel */
    gsap.utils.toArray('.g-card .g-media').forEach(function (m) {
      gsap.fromTo(m, { xPercent: -7 }, {
        xPercent: 7, ease: 'none',
        scrollTrigger: {
          trigger: m.closest('.g-card'),
          containerAnimation: scrollTween,
          start: 'left right',
          end: 'right left',
          scrub: true
        }
      });
    });

    /* 3D tilt on hover */
    if (FINE) {
      gsap.utils.toArray('.g-card:not(.g-card--text)').forEach(function (card) {
        card.addEventListener('mousemove', function (e) {
          var r = card.getBoundingClientRect();
          var rx = ((e.clientY - r.top) / r.height - .5) * -8;
          var ry = ((e.clientX - r.left) / r.width - .5) * 10;
          gsap.to(card, { rotationX: rx, rotationY: ry, transformPerspective: 900, duration: .5, ease: 'power2.out' });
        });
        card.addEventListener('mouseleave', function () {
          gsap.to(card, { rotationX: 0, rotationY: 0, duration: .8, ease: 'elastic.out(1,.5)' });
        });
      });
    }
  }

  /* =====================================================
     SCROLL CHOREOGRAPHY
     ===================================================== */
  function initScrollFX() {
    if (!hasST) return;

    /* nav state + top progress bar */
    gsap.to('#scrollProgress', {
      scaleX: 1, ease: 'none',
      scrollTrigger: {
        start: 0, end: 'max', scrub: .3,
        onUpdate: function (self) {
          document.getElementById('nav').classList.toggle('is-scrolled', self.scroll() > 40);
        }
      }
    });

    /* hero: flower reacts to scroll + content drifts away */
    if (F) {
      ScrollTrigger.create({
        trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: function (s) { F.scroll = s.progress; },
        onToggle: function (s) { F.visible = s.isActive; }
      });
    }
    gsap.to('.hero-content', {
      yPercent: -14, autoAlpha: .3, ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom 30%', scrub: true }
    });
    gsap.to('.hero-giant', {
      yPercent: 36, ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    /* generic reveals */
    gsap.utils.toArray('.sec-head, .about-note, .about-chips, .reels-hint, .dl-note').forEach(function (el) {
      gsap.from(el, {
        y: 44, autoAlpha: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });

    /* about statement — word by word, scrubbed */
    var st = document.querySelector('.about-statement');
    if (st) {
      var words = splitWords(st);
      gsap.fromTo(words, { opacity: .12 }, {
        opacity: 1, stagger: .05, ease: 'none',
        scrollTrigger: { trigger: st, start: 'top 78%', end: 'top 28%', scrub: true }
      });
    }

    /* photo deck fans out */
    gsap.timeline({
      scrollTrigger: { trigger: '.about-grid', start: 'top 80%', end: 'bottom 55%', scrub: 1 }
    })
      .from('.d-mid',   { xPercent: -16, rotation: -14 }, 0)
      .from('.d-back',  { xPercent: 16,  rotation: 14 },  0)
      .from('.d-front', { yPercent: 8,   rotation: 3 },   0);

    /* reels — 3D entrance */
    gsap.from('.reel-col', {
      y: 110, autoAlpha: 0,
      rotationY: function (i) { return i === 1 ? 0 : (i === 0 ? 16 : -16); },
      stagger: .12, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.reels-stage', start: 'top 78%', once: true }
    });

    /* occasions rows */
    gsap.from('.occ-item', {
      y: 40, autoAlpha: 0, stagger: .08, duration: .8, ease: 'power3.out',
      scrollTrigger: { trigger: '.occ-list', start: 'top 82%', once: true }
    });

    /* delivery title */
    gsap.from('.dl-line', {
      yPercent: 110, autoAlpha: 0, stagger: .12, duration: 1, ease: 'power4.out',
      scrollTrigger: { trigger: '.dl-title', start: 'top 85%', once: true }
    });
    gsap.to('.dl-title .dl-line:nth-child(1)', {
      xPercent: -6, ease: 'none',
      scrollTrigger: { trigger: '.delivery', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
    gsap.to('.dl-title .dl-line:nth-child(3)', {
      xPercent: 6, ease: 'none',
      scrollTrigger: { trigger: '.delivery', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });

    /* delivery route — drawn as you scroll */
    var dlp = document.querySelector('.dl-path');
    if (dlp && dlp.getTotalLength) {
      var dlLen = dlp.getTotalLength();
      gsap.set(dlp, { strokeDasharray: dlLen, strokeDashoffset: dlLen });
      gsap.timeline({
        scrollTrigger: { trigger: '.dl-map', start: 'top 82%', end: 'bottom 50%', scrub: 1 }
      })
        .from('.dl-node, .dl-node-ring', { scale: 0, stagger: .25, duration: .5 }, 0)
        .to(dlp, { strokeDashoffset: 0, duration: 1.6, ease: 'none' }, 0);
    }

    /* contact card */
    gsap.from('.contact-card', {
      y: 70, autoAlpha: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact-card', start: 'top 85%', once: true }
    });

    /* footer giant */
    var fg = document.querySelector('.footer-giant');
    if (fg) {
      splitLetters(fg);
      gsap.from(fg.querySelectorAll('.fl'), {
        yPercent: 115, stagger: .035, duration: .9, ease: 'power4.out',
        scrollTrigger: { trigger: fg, start: 'top 92%', once: true }
      });
    }
    gsap.from('.footer-row', {
      autoAlpha: 0, y: 30, duration: 1,
      scrollTrigger: { trigger: '.footer-row', start: 'top 96%', once: true }
    });
  }

  /* =====================================================
     REELS — tap for sound, smart play/pause
     ===================================================== */
  function initReels() {
    document.querySelectorAll('.reel-col').forEach(function (col) {
      var video = col.querySelector('video');
      if (!video) return;
      col.addEventListener('click', function () {
        if (video.muted) {
          document.querySelectorAll('.reel-col video').forEach(function (v) { v.muted = true; });
          document.querySelectorAll('.reel-col').forEach(function (c) { c.classList.remove('is-sound'); });
          video.muted = false;
          col.classList.add('is-sound');
          video.play().catch(function () {});
        } else {
          video.muted = true;
          col.classList.remove('is-sound');
        }
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) video.play().catch(function () {});
            else video.pause();
          });
        }, { threshold: .25 }).observe(col);
      }
    });
  }

  /* =====================================================
     OCCASIONS — floating image preview follows cursor
     ===================================================== */
  function initOccasions() {
    var list = document.querySelector('.occ-list');
    var pv   = document.getElementById('occPreview');
    if (!FINE || !list || !pv) return;
    var pvImg = pv.querySelector('img');
    gsap.set(pv, { xPercent: -50, yPercent: -50, scale: .8, autoAlpha: 0, rotation: -5 });
    var pvX = gsap.quickTo(pv, 'x', { duration: .45, ease: 'power3' }),
        pvY = gsap.quickTo(pv, 'y', { duration: .45, ease: 'power3' }),
        pvR = gsap.quickTo(pv, 'rotation', { duration: .6, ease: 'power3' });
    var lastX = 0;
    list.addEventListener('mousemove', function (e) {
      pvX(e.clientX); pvY(e.clientY);
      pvR(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * .6));
      lastX = e.clientX;
    });
    document.querySelectorAll('.occ-item').forEach(function (item) {
      var src = item.getAttribute('data-img');
      if (src) { var im = new Image(); im.src = src; }
      item.addEventListener('mouseenter', function () {
        if (src) pvImg.src = src;
        gsap.to(pv, { autoAlpha: 1, scale: 1, duration: .45, ease: 'power3.out' });
      });
      item.addEventListener('mouseleave', function () {
        gsap.to(pv, { autoAlpha: 0, scale: .8, duration: .35, ease: 'power3.in' });
        pvR(-5);
      });
    });
  }

  /* =====================================================
     NAV — mobile menu, anchors, back-to-top
     ===================================================== */
  var menuOpen = false;
  var menuTl = gsap.timeline({ paused: true })
    .to('#mobileMenu', { clipPath: 'inset(0% 0% 0% 0%)', duration: .65, ease: 'power4.inOut' })
    .from('.mobile-menu .mm-link, .mobile-menu .mm-meta > *', {
      y: 34, autoAlpha: 0, stagger: .06, duration: .45, ease: 'power3.out'
    }, '-=.25');
  menuTl.eventCallback('onReverseComplete', function () {
    gsap.set('#mobileMenu', { visibility: 'hidden' });
  });

  function toggleMenu(force) {
    menuOpen = (typeof force === 'boolean') ? force : !menuOpen;
    document.body.classList.toggle('menu-open', menuOpen);
    if (menuOpen) {
      gsap.set('#mobileMenu', { visibility: 'visible' });
      menuTl.play();
      if (lenis) lenis.stop();
    } else {
      menuTl.reverse();
      if (lenis && !document.body.classList.contains('is-loading')) lenis.start();
    }
  }
  document.getElementById('burger').addEventListener('click', function () { toggleMenu(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) toggleMenu(false); });

  /* smooth anchors */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        if (menuOpen) toggleMenu(false);
        var target = document.querySelector(id);
        if (lenis) lenis.scrollTo(target, { offset: -NAV_H, duration: 1.4 });
        else target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  document.getElementById('toTop').addEventListener('click', function () {
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* =====================================================
     PRELOADER + INTRO
     ===================================================== */
  function runIntro() {
    buildMarquees();
    buildGallery();
    initScrollFX();
    initGalleryScroll();
    initReels();
    initOccasions();
    if (hasST) ScrollTrigger.refresh();

    var counter = { v: 0 };
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(counter, {
      v: 100, duration: RM ? .2 : 1.6, ease: 'power2.inOut',
      onUpdate: function () {
        document.getElementById('loadCount').textContent = Math.round(counter.v) + '%';
        document.getElementById('loadBar').style.transform = 'scaleX(' + (counter.v / 100) + ')';
      }
    })
      .to('.preloader-inner', { y: -26, autoAlpha: 0, duration: .45, ease: 'power2.in' }, '+=.15')
      .to('#preloader', { clipPath: 'inset(0% 0% 100% 0%)', duration: .85, ease: 'power4.inOut' }, '-=.1')
      .set('#preloader', { display: 'none' })
      .add(function () {
        document.body.classList.remove('is-loading');
        if (lenis) lenis.start();
        if (F) gsap.to(F, { bloom: 1, duration: RM ? .01 : 2.6, ease: 'power2.inOut' });
      }, '-=1.15')
      .from('.nav > *', { y: -24, autoAlpha: 0, stagger: .07, duration: .7 }, '-=.6')
      .from('.hero-kicker', { y: 26, autoAlpha: 0, duration: .7 }, '-=.5')
      .from('.ht-inner', { yPercent: 118, duration: 1.15, stagger: .14, ease: 'power4.out' }, '-=.55')
      .from('.hero-sub', { y: 26, autoAlpha: 0, duration: .7 }, '-=.7')
      .from('.hero-cta > *', { y: 24, autoAlpha: 0, stagger: .09, duration: .6 }, '-=.6')
      .from('.hero-stats .stat', {
        y: 20, autoAlpha: 0, stagger: .09, duration: .6,
        onStart: function () {
          document.querySelectorAll('[data-count]').forEach(animateCount);
        }
      }, '-=.5')
      .from('.hero-giant .gl', { yPercent: 60, autoAlpha: 0, stagger: .05, duration: .8 }, '-=1.1')
      .from(['.hero-scroll', '.hero-side'], { autoAlpha: 0, duration: .8 }, '-=.5');

    if (RM) tl.progress(1);
  }

  /* start once fonts are ready (with a safety timeout) */
  var fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready
    : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })])
    .then(runIntro);

  /* rebuild marquees on resize */
  window.addEventListener('resize', debounce(buildMarquees, 250));

})();