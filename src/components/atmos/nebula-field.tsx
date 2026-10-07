"use client";

import { useEffect, useRef } from "react";

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

  vec3 cDeep = vec3(0.015, 0.02, 0.045);
  vec3 cTeal = vec3(0.08, 0.5, 0.62);
  vec3 cViolet = vec3(0.36, 0.2, 0.75);
  vec3 cRose = vec3(0.7, 0.28, 0.5);
  float h = fract(uHue + uTime * 0.0015);
  vec3 tint = mix(cTeal, cViolet, 0.5 + 0.5 * sin(6.2831 * h));
  tint = mix(tint, cRose, 0.3 + 0.3 * sin(6.2831 * (h + 0.37)));

  vec3 col = cDeep + tint * density;
  col += tint * pow(max(density - 0.6, 0.0), 2.0) * 1.8;

  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 zone = (vUv - 0.5) * asp / vec2(0.55, 0.68);
  float clear = smoothstep(0.5, 1.35, length(zone));
  col = mix(cDeep * 1.4, col, clear);

  float vig = smoothstep(1.5, 0.35, length((vUv - 0.5) * asp * 1.15));
  col *= 0.5 + 0.5 * vig;
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

      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uHue: { value: visitHue() },
        uPointer: { value: new THREE.Vector2(0, 0) },
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

      cleanup = () => {
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
