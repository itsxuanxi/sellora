"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { prefersReducedMotion, isMobileViewport } from "@/lib/motion";

export type AICoreHandle = { setProgress: (t: number) => void };

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * The "Selryn AI Revenue Core" — a real WebGL scene (not a canvas particle
 * sketch): a wireframe icosahedron core with an inner glow shell, three
 * tilted orbital rings, a converging signal-particle field, and a dormant
 * "neural network" point cloud that only becomes visible once the camera
 * passes through the core. Bloom post-processing gives the volumetric-glow
 * look. Entirely progress-driven — the Hero owns the single ScrollTrigger
 * and pushes `progress` in via `handleRef.current.setProgress(t)` on every
 * scrub tick, so there is no autoplay and reversal is exact.
 */
export function AICoreScene({
  handleRef,
}: {
  handleRef: React.MutableRefObject<AICoreHandle | null>;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = prefersReducedMotion();
    const mobile = isMobileViewport();

    const width = mount.clientWidth || 1;
    const height = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 100);
    camera.position.set(0, 0, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const coreGeo = new THREE.IcosahedronGeometry(2.2, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xb4a0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    const innerGeo = new THREE.IcosahedronGeometry(1.4, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xe6deff,
      transparent: true,
      opacity: 0.16,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    scene.add(inner);

    const rings: THREE.Mesh[] = [];
    const ringSpecs: [number, number, number][] = [
      [2.9, 0.35, 0],
      [3.6, -0.5, 1],
      [4.3, 0.2, 2],
    ];
    ringSpecs.forEach(([r, tilt], i) => {
      const geo = new THREE.TorusGeometry(r, mobile ? 0.008 : 0.012, 8, 128);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9f86ff,
        transparent: true,
        opacity: 0.32,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2 + tilt;
      ring.rotation.y = i * 0.6;
      scene.add(ring);
      rings.push(ring);
    });

    const PARTICLE_COUNT = mobile ? 450 : 1300;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    function scatter(i: number, rMin: number, rMax: number) {
      const r = rMin + Math.random() * (rMax - rMin);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      scatter(i, 4, 16);
      speeds[i] = 0.004 + Math.random() * 0.01;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xd8cbff,
      size: 0.055,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    const NEURAL_COUNT = mobile ? 260 : 800;
    const neuralPositions = new Float32Array(NEURAL_COUNT * 3);
    for (let i = 0; i < NEURAL_COUNT; i++) {
      const r = Math.random() * 1.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      neuralPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      neuralPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      neuralPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const neuralGeo = new THREE.BufferGeometry();
    neuralGeo.setAttribute("position", new THREE.BufferAttribute(neuralPositions, 3));
    const neuralMat = new THREE.PointsMaterial({
      color: 0xc4b5fd,
      size: 0.04,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const neural = new THREE.Points(neuralGeo, neuralMat);
    scene.add(neural);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // pushed higher + tighter radius: a harder, more extreme dark/light
    // contrast instead of a soft ambient wash
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      mobile ? 0.7 : 1.35,
      0.4,
      0.1
    );
    if (!mobile) composer.addPass(bloom);

    let raf = 0;
    let progress = 0;

    function render() {
      core.rotation.y += 0.0016;
      core.rotation.x += 0.0007;
      inner.rotation.y -= 0.001;
      rings.forEach((ring, i) => {
        ring.rotation.z += 0.0012 * (i % 2 === 0 ? 1 : -1);
      });

      const posAttr = particleGeo.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const iy = ix + 1;
        const iz = ix + 2;
        const x = arr[ix];
        const y = arr[iy];
        const z = arr[iz];
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        const s = speeds[i];
        arr[ix] = x - (x / len) * s;
        arr[iy] = y - (y / len) * s;
        arr[iz] = z - (z / len) * s;
        if (len < 1.7) scatter(i, 14, 18);
      }
      posAttr.needsUpdate = true;

      const p = progress;
      const eased = easeInOut(p);
      camera.position.z = THREE.MathUtils.lerp(16, -2.4, eased);
      camera.position.x = Math.sin(p * Math.PI) * 0.5;
      camera.position.y = Math.sin(p * Math.PI * 0.6) * 0.25;
      camera.lookAt(0, 0, 0);

      const passT = THREE.MathUtils.clamp((p - 0.68) / 0.32, 0, 1);
      neuralMat.opacity = passT * 0.9;
      coreMat.opacity = THREE.MathUtils.lerp(0.55, 0.06, passT);
      innerMat.opacity = THREE.MathUtils.lerp(0.16, 0.55, passT);
      particleMat.opacity = THREE.MathUtils.lerp(0.8, 0.12, passT);
      rings.forEach((ring) => {
        (ring.material as THREE.MeshBasicMaterial).opacity =
          0.32 * (1 - passT * 0.8);
      });

      if (!mobile) composer.render();
      else renderer.render(scene, camera);

      raf = requestAnimationFrame(render);
    }

    handleRef.current = {
      setProgress: (t: number) => {
        progress = t;
        if (reduced) render();
      },
    };

    render();
    if (reduced) cancelAnimationFrame(raf);

    function onResize() {
      const w = mount!.clientWidth || 1;
      const h = mount!.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      // On an SPA route change the whole subtree can already be gone from
      // the document by the time this runs — never let teardown throw and
      // trip the app's error boundary over what's about to be discarded.
      try {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        handleRef.current = null;
        coreGeo.dispose();
        coreMat.dispose();
        innerGeo.dispose();
        innerMat.dispose();
        rings.forEach((r) => {
          r.geometry.dispose();
          (r.material as THREE.Material).dispose();
        });
        particleGeo.dispose();
        particleMat.dispose();
        neuralGeo.dispose();
        neuralMat.dispose();
        renderer.dispose();
        composer.dispose();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      } catch (err) {
        console.warn("[ai-core-scene] teardown during unmount — safely ignored:", err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
