/* vv-buttons — buttons.js
   Sin dependencias.
   1. Inyecta las dos capas del borde luminoso en cada .vv-shine-btn
   2. Inyecta máscara + canvas en cada .vv-shimmer-btn y dibuja un campo de
      estrellas (parpadeo, deriva con paralaje, destellos en cruz y fugaces).
      La animación sólo corre mientras el botón está en hover/foco.
   Los botones añadidos después se detectan solos (MutationObserver). */
(() => {
  "use strict";

  /* Paletas [r,g,b] por tema. Los duplicados dan más peso a ese color. */
  const PALETTE = {
    dark:  ["255,255,255", "255,255,255", "255,255,255", "190,220,255", "0,153,255", "255,232,190"],
    light: ["0,153,255", "0,153,255", "0,70,140", "30,30,30", "120,90,200"],
  };

  const root = document.documentElement;
  const theme = () => (root.getAttribute("data-theme") === "light" ? "light" : "dark");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 1) Borde luminoso ---------- */
  function initShine(btn) {
    if (btn.querySelector(":scope > .vv-shine")) return;
    for (const k of ["a", "b"]) {
      const s = document.createElement("span");
      s.className = `vv-shine vv-shine-lyr-${k}`;
      s.setAttribute("aria-hidden", "true");
      btn.append(s);
    }
  }

  /* ---------- 2) Estrellas ---------- */
  const states = new Map(); // botón → estado

  const cssNum = (el, name, fallback) => {
    const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };

  function paletteFor(btn) {
    // data-shimmer-colors="196,181,253;255,255,255"  → paleta propia
    const custom = btn.dataset.shimmerColors;
    return custom ? custom.split(";").map(s => s.trim()).filter(Boolean) : PALETTE[theme()];
  }

  /* Genera el campo de estrellas para el tamaño actual del botón */
  function build(btn, st) {
    const host = st.canvas.parentElement;
    const w = host.offsetWidth, h = host.offsetHeight;
    if (!w || !h) return false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.canvas.width = Math.round(w * dpr);
    st.canvas.height = Math.round(h * dpr);
    st.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    st.w = w; st.h = h;

    const colors = paletteFor(btn);
    const density = cssNum(btn, "--vv-stars-density", 1);
    const count = Math.max(10, Math.round((w * h) / 380 * density));

    st.stars = Array.from({ length: count }, () => {
      const depth = Math.random();                 // 0 lejana … 1 cercana
      const glint = Math.random() < 0.1;           // estrella con destello en cruz
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        depth,
        glint,
        r: glint ? rand(0.9, 1.5) : 0.3 + depth * rand(0.2, 0.95),
        a: rand(0.4, 1),                           // brillo máximo
        sp: rand(0.8, 3),                          // velocidad de parpadeo
        ph: Math.random() * TAU,                   // fase
        c: colors[Math.floor(Math.random() * colors.length)],
      };
    });
    st.shoot = null;
    st.nextShoot = 0.8 + Math.random() * 1.6;
    st.color0 = colors[0];
    return true;
  }

  function draw(btn, st, t) {
    const { ctx, w, h } = st;
    const speed = cssNum(btn, "--vv-stars-speed", 1);
    ctx.clearRect(0, 0, w, h);

    const span = w + 8;
    for (const s of st.stars) {
      // parpadeo suave: nunca se apaga del todo
      const tw = 0.5 + 0.5 * Math.sin(t * s.sp * speed + s.ph);
      const alpha = s.a * (0.2 + 0.8 * tw);
      // deriva hacia la izquierda; las cercanas se mueven más (paralaje)
      const x = ((((s.x - t * 5 * speed * (0.2 + s.depth)) % span) + span) % span) - 4;

      ctx.fillStyle = `rgba(${s.c},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, TAU);
      ctx.fill();

      if (s.glint) {
        const len = s.r * (3 + 4 * tw);
        ctx.strokeStyle = `rgba(${s.c},${alpha * 0.75})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - len, s.y); ctx.lineTo(x + len, s.y);
        ctx.moveTo(x, s.y - len); ctx.lineTo(x, s.y + len);
        ctx.stroke();
      }
    }

    // estrella fugaz ocasional
    if (!st.shoot && t >= st.nextShoot) {
      const ang = rand(0.35, 0.6); // radianes hacia abajo-derecha
      st.shoot = {
        x: rand(-4, w * 0.5), y: rand(-4, h * 0.45),
        vx: Math.cos(ang) * 150 * speed, vy: Math.sin(ang) * 150 * speed,
        born: t, life: 0.75 / Math.max(speed, 0.3),
      };
    }
    if (st.shoot) {
      const k = st.shoot, age = t - k.born, p = age / k.life;
      if (p >= 1) {
        st.shoot = null;
        st.nextShoot = t + rand(2.2, 5);
      } else {
        const hx = k.x + k.vx * age, hy = k.y + k.vy * age;
        const tail = 26;
        const m = Math.hypot(k.vx, k.vy);
        const tx = hx - (k.vx / m) * tail, ty = hy - (k.vy / m) * tail;
        const fade = Math.sin(p * Math.PI);
        const g = ctx.createLinearGradient(tx, ty, hx, hy);
        g.addColorStop(0, `rgba(${st.color0},0)`);
        g.addColorStop(1, `rgba(${st.color0},${0.9 * fade})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.1;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      }
    }
  }

  /* Bucle: sólo corre con hover/foco (+1 s para dejar acabar el fundido) */
  function loop(btn, st) {
    st.raf = requestAnimationFrame(() => loop(btn, st));
    draw(btn, st, (performance.now() - st.t0) / 1000);
  }
  function play(btn, st) {
    clearTimeout(st.stopTimer);
    if (st.raf || reduced.matches) return;
    st.t0 = performance.now() - st.elapsed * 1000;
    loop(btn, st);
  }
  function pauseSoon(btn, st) {
    clearTimeout(st.stopTimer);
    st.stopTimer = setTimeout(() => {
      if (btn.matches(":hover, :focus-visible")) return;
      cancelAnimationFrame(st.raf);
      st.raf = 0;
      st.elapsed = (performance.now() - st.t0) / 1000;
    }, 1000);
  }

  function repaint(btn) {
    const st = states.get(btn);
    if (st && build(btn, st)) draw(btn, st, st.elapsed || 0.001);
  }

  const resizer = new ResizeObserver(entries => {
    for (const e of entries) requestAnimationFrame(() => repaint(e.target));
  });

  function initShimmer(btn) {
    if (btn.querySelector(":scope > .vv-shimmer-mask")) return;
    const mask = document.createElement("span");
    mask.className = "vv-shimmer-mask";
    mask.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    canvas.className = "vv-shimmer";
    mask.append(canvas);
    btn.append(mask);

    const st = {
      canvas, ctx: canvas.getContext("2d"),
      stars: [], w: 0, h: 0, raf: 0, stopTimer: 0,
      t0: 0, elapsed: 0, shoot: null, nextShoot: 1, color0: "255,255,255",
    };
    states.set(btn, st);

    btn.addEventListener("pointerenter", () => play(btn, st));
    btn.addEventListener("focus", () => { if (btn.matches(":focus-visible")) play(btn, st); });
    btn.addEventListener("pointerleave", () => pauseSoon(btn, st));
    btn.addEventListener("blur", () => pauseSoon(btn, st));

    repaint(btn);
    resizer.observe(btn);
  }

  // Repintar al cambiar de tema o al ajustar densidad/velocidad desde fuera
  const repaintAll = () => {
    for (const btn of states.keys()) {
      if (!btn.isConnected) { states.delete(btn); continue; }
      repaint(btn);
    }
  };
  new MutationObserver(repaintAll).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("vv-stars-refresh", repaintAll);

  /* ---------- Arranque + observación del DOM ---------- */
  function scan(scope) {
    scope.querySelectorAll?.(".vv-shine-btn").forEach(initShine);
    scope.querySelectorAll?.(".vv-shimmer-btn").forEach(initShimmer);
    if (scope.matches?.(".vv-shine-btn")) initShine(scope);
    if (scope.matches?.(".vv-shimmer-btn")) initShimmer(scope);
  }

  const start = () => {
    scan(document);
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
