"use client";

import { useEffect, useRef } from "react";
import { getTheme, subscribeTheme, type Theme } from "@/lib/theme";

type NebulaPalette = {
  deep: [number, number, number];
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  edge: number;
  centerBoost: number;
  clearAmt: number;
  tintGain: number;
  stars: number;
};

/* Paletas del shader por tema: cósmica (oscuro) y blanco/dorado (light) */
const PALETTES: Record<Theme, NebulaPalette> = {
  dark: {
    deep: [0.023, 0.027, 0.075],
    a: [0.22, 0.74, 0.97],
    b: [0.72, 0.42, 1.0],
    c: [0.85, 0.27, 0.94],
    edge: 0.5,
    centerBoost: 1.4,
    clearAmt: 1.0,
    tintGain: 1.0,
    stars: 0.0,
  },
  light: {
    deep: [0.945, 0.925, 0.875],
    a: [1.0, 0.84, 0.36],
    b: [0.74, 0.78, 0.9],
    c: [0.88, 0.56, 0.16],
    edge: 0.84,
    centerBoost: 1.05,
    clearAmt: 0.4,
    tintGain: 1.5,
    stars: 1.0,
  },
};

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform float uHue;
uniform vec2 uPointer;
uniform vec3 uDeep;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uTintC;
uniform float uEdge;
uniform float uCenterBoost;
uniform float uClearAmt;
uniform float uTintGain;
uniform float uStars;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = rot * p * 2.0 + vec2(3.7, 1.1);
    amp *= 0.55;
  }
  return value;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  p += uPointer * 0.08;
  float t = uTime * 0.035;
  float r = length(p) + 0.0001;
  float ang = atan(p.y, p.x);

  vec2 spiral = vec2(cos(ang + r * 3.2 - t * 1.2), sin(ang + r * 3.2 - t * 1.2)) * r;
  vec2 q = spiral * 2.6 + vec2(t * 1.3, -t * 0.9);
  float warp = fbm(q * 1.5 + t);
  float n = fbm(q + warp * 1.1);
  float n2 = fbm(q * 0.55 - vec2(t * 0.7, t * 0.4) + 7.3);
  float density = n * 0.8 + n2 * 0.5;
  density = smoothstep(0.28, 1.0, density + 0.3 - r * 0.6);

  vec3 cDeep = uDeep;
  vec3 cTeal = uTintA;
  vec3 cViolet = uTintB;
  vec3 cRose = uTintC;
  float h = fract(uHue + uTime * 0.0015);
  vec3 tint = mix(cTeal, cViolet, 0.5 + 0.5 * sin(6.2831 * h));
  tint = mix(tint, cRose, 0.3 + 0.3 * sin(6.2831 * (h + 0.37)));
  tint *= uTintGain;

  vec3 col = cDeep + tint * density;
  col += tint * pow(max(density - 0.6, 0.0), 2.0) * 1.8;

  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 zone = (vUv - 0.5) * asp / vec2(0.55, 0.68);
  float clear = smoothstep(0.5, 1.35, length(zone)) * uClearAmt;
  col = mix(cDeep * uCenterBoost, col, clear);

  float vig = smoothstep(1.5, 0.35, length((vUv - 0.5) * asp * 1.15));
  col *= mix(uEdge, 1.0, vig);

  /* Destellos: estrellas doradas y plateadas parpadeando (modo claro) */
  vec2 sCell = floor(gl_FragCoord.xy / 3.5);
  float sRand = hash(sCell);
  float sGate = step(0.991, sRand);
  float sTwinkle = 0.55 + 0.45 * sin(uTime * (1.5 + sRand * 4.0) + sRand * 6.2831);
  vec2 sLocal = fract(gl_FragCoord.xy / 3.5) - 0.5;
  float sDot = smoothstep(0.42, 0.05, length(sLocal));
  vec3 sCol = mix(vec3(0.98, 0.82, 0.38), vec3(0.78, 0.82, 0.95), step(0.55, fract(sRand * 7.31)));
  col += sCol * sGate * sDot * sTwinkle * uStars;

  float grain = hash(gl_FragCoord.xy + fract(uTime * 0.7) * vec2(17.1, 23.7));
  col += (grain - 0.5) * 0.03;

  gl_FragColor = vec4(col, 1.0);
}
`;

function visitHue(): number {
  try {
    const stored = window.sessionStorage.getItem("nebula-hue");
    if (stored !== null) {
      const n = Number(stored);
      if (Number.isFinite(n)) return n;
    }
    const hue = Math.random();
    window.sessionStorage.setItem("nebula-hue", String(hue));
    return hue;
  } catch {
    return Math.random();
  }
}

/* Duración/easing canónicos del cambio de tema: idénticos a la transición
   de tokens en :root (0.65s cubic-bezier(0.4, 0, 0.2, 1)) para que todo
   lo que esté en pantalla se repinte on sync. */
const THEME_MS = 650;
const easeTheme = (() => {
  const x1 = 0.4, y1 = 0, x2 = 0.2, y2 = 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-7) break;
      t -= e / d;
    }
    return sy(Math.min(Math.max(t, 0), 1));
  };
})();

export function NebulaField({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !document.createElement("canvas").getContext("webgl2")
    ) {
      canvas.style.display = "none";
      return;
    }

    let disposed = false;
    let cleanup: () => void = () => {};

    void (async () => {
      const [gsapModule, THREE] = await Promise.all([import("gsap"), import("three")]);
      if (disposed) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
        });
      } catch {
        canvas.style.display = "none";
        return;
      }

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;

      const startPalette = PALETTES[getTheme()];
      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uHue: { value: visitHue() },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uDeep: { value: new THREE.Color(...startPalette.deep) },
        uTintA: { value: new THREE.Color(...startPalette.a) },
        uTintB: { value: new THREE.Color(...startPalette.b) },
        uTintC: { value: new THREE.Color(...startPalette.c) },
        uEdge: { value: startPalette.edge },
        uCenterBoost: { value: startPalette.centerBoost },
        uClearAmt: { value: startPalette.clearAmt },
        uTintGain: { value: startPalette.tintGain },
        uStars: { value: startPalette.stars },
      };

      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(geometry, material));

      let ratio = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setPixelRatio(ratio);
        renderer.setSize(w, h, false);
        uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      };
      resize();

      const pointerTarget = new THREE.Vector2(0, 0);
      const onPointer = (event: PointerEvent) => {
        pointerTarget.set(
          event.clientX / window.innerWidth - 0.5,
          0.5 - event.clientY / window.innerHeight,
        );
      };

      let slowFrames = 0;
      const tick = (_time: number, deltaTime: number) => {
        if (disposed || document.hidden) return;
        uniforms.uTime.value += Math.min(deltaTime, 64) / 1000;
        uniforms.uPointer.value.lerp(pointerTarget, 0.05);

        if (deltaTime > 26) {
          slowFrames += 1;
          if (slowFrames > 45 && ratio > 0.5) {
            ratio = Math.max(ratio * 0.7, 0.5);
            slowFrames = 0;
            resize();
          }
        } else {
          slowFrames = 0;
        }

        renderer.render(scene, camera);
      };

      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onPointer, { passive: true });
      const { gsap } = gsapModule;
      gsap.ticker.add(tick);

      /* Cambio de tema: interpola los uniforms de color con GSAP usando la
         MISMA duración y easing que los tokens CSS, para que la nebulosa
         cruce en sincronía con el resto de la pantalla */
      const tweenColor = (
        color: { r: number; g: number; b: number; setRGB: (r: number, g: number, b: number) => void },
        rgb: [number, number, number],
        animate: boolean,
      ) => {
        if (animate) {
          gsap.to(color, { r: rgb[0], g: rgb[1], b: rgb[2], duration: THEME_MS / 1000, ease: easeTheme, overwrite: "auto" });
        } else {
          color.setRGB(rgb[0], rgb[1], rgb[2]);
        }
      };
      const applyPalette = (animate: boolean) => {
        const palette = PALETTES[getTheme()];
        tweenColor(uniforms.uDeep.value, palette.deep, animate);
        tweenColor(uniforms.uTintA.value, palette.a, animate);
        tweenColor(uniforms.uTintB.value, palette.b, animate);
        tweenColor(uniforms.uTintC.value, palette.c, animate);
        const tweens = [
          { u: uniforms.uEdge, v: palette.edge },
          { u: uniforms.uCenterBoost, v: palette.centerBoost },
          { u: uniforms.uClearAmt, v: palette.clearAmt },
          { u: uniforms.uTintGain, v: palette.tintGain },
          { u: uniforms.uStars, v: palette.stars },
        ];
        for (const { u, v } of tweens) {
          if (animate) {
            gsap.to(u, { value: v, duration: THEME_MS / 1000, ease: easeTheme, overwrite: "auto" });
          } else {
            u.value = v;
          }
        }
      };
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const unsubscribeTheme = subscribeTheme(() => applyPalette(!reducedMotion.matches));

      cleanup = () => {
        unsubscribeTheme();
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}
