"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { prefersReducedMotion, isMobileViewport } from "@/lib/motion";

export type ScaleNetworkHandle = { setProgress: (t: number) => void };

type Node = { x: number; y: number; z: number };

/**
 * "Pipeline at Scale" — not random particles: a deterministic branching tree
 * (1 root conversation → 6 agents → ~90 accounts → thousands of
 * conversations), built once, then progressively revealed by advancing
 * BufferGeometry draw ranges (root first, then each tier) as scroll
 * progress increases — cheap, and it reads as a structured pipeline
 * growing rather than a firework. Camera pulls back in lockstep.
 */
export function ScaleNetworkScene({
  handleRef,
}: {
  handleRef: React.MutableRefObject<ScaleNetworkHandle | null>;
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
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.05, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // ── build the deterministic pipeline tree ──
    const nodes: Node[] = [{ x: 0, y: 0, z: 0 }];
    const segments: [number, number][] = []; // parent index, child index
    const tierStart: number[] = [0]; // node-array index where each tier begins

    const TIER1 = 6; // agents
    const TIER2_PER = mobile ? 8 : 15; // accounts per agent
    const TIER3_PER = mobile ? 6 : 12; // conversations per account

    tierStart.push(nodes.length);
    const tier1Idx: number[] = [];
    for (let i = 0; i < TIER1; i++) {
      const angle = (i / TIER1) * Math.PI * 2;
      const r = 3.2;
      const idx = nodes.length;
      nodes.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: (Math.random() - 0.5) * 0.6 });
      segments.push([0, idx]);
      tier1Idx.push(idx);
    }

    tierStart.push(nodes.length);
    const tier2Idx: number[] = [];
    tier1Idx.forEach((parentIdx) => {
      const parent = nodes[parentIdx];
      const baseAngle = Math.atan2(parent.y, parent.x);
      for (let j = 0; j < TIER2_PER; j++) {
        const angle = baseAngle + (j / TIER2_PER - 0.5) * 1.6;
        const r = 6.5 + Math.random() * 2;
        const idx = nodes.length;
        nodes.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: parent.z + (Math.random() - 0.5) * 1.4,
        });
        segments.push([parentIdx, idx]);
        tier2Idx.push(idx);
      }
    });

    tierStart.push(nodes.length);
    tier2Idx.forEach((parentIdx) => {
      const parent = nodes[parentIdx];
      const baseAngle = Math.atan2(parent.y, parent.x);
      const baseR = Math.hypot(parent.x, parent.y);
      for (let k = 0; k < TIER3_PER; k++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.5;
        const r = baseR + 2.5 + Math.random() * 3;
        const idx = nodes.length;
        nodes.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: parent.z + (Math.random() - 0.5) * 2.2,
        });
        segments.push([parentIdx, idx]);
      }
    });
    tierStart.push(nodes.length); // sentinel: total node count

    const totalNodes = nodes.length;
    const totalSegments = segments.length;

    // node points, ordered by tier (BFS) so drawRange reveal = tier reveal
    const nodePositions = new Float32Array(totalNodes * 3);
    nodes.forEach((n, i) => {
      nodePositions[i * 3] = n.x;
      nodePositions[i * 3 + 1] = n.y;
      nodePositions[i * 3 + 2] = n.z;
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
    nodeGeo.setDrawRange(0, 1);
    const nodeMat = new THREE.PointsMaterial({
      color: 0xd8cbff,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(nodeGeo, nodeMat);
    scene.add(points);

    // connecting segments, same tier ordering
    const linePositions = new Float32Array(totalSegments * 2 * 3);
    segments.forEach(([a, b], i) => {
      const pa = nodes[a];
      const pb = nodes[b];
      linePositions[i * 6] = pa.x;
      linePositions[i * 6 + 1] = pa.y;
      linePositions[i * 6 + 2] = pa.z;
      linePositions[i * 6 + 3] = pb.x;
      linePositions[i * 6 + 4] = pb.y;
      linePositions[i * 6 + 5] = pb.z;
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setDrawRange(0, 0);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x8f7ae0,
      transparent: true,
      // kept faint on purpose — the structure should read as depth, not
      // as a dense mesh competing with the node points for attention
      opacity: 0.16,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (!mobile) {
      composer.addPass(
        new UnrealBloomPass(new THREE.Vector2(width, height), 0.7, 0.6, 0.2)
      );
    }

    let raf = 0;
    let progress = 0;

    function render() {
      const p = progress;
      // reveal count grows tier by tier: root -> +tier1 -> +tier2 -> +tier3
      const nodeCount = Math.max(1, Math.round(1 + (totalNodes - 1) * p));
      nodeGeo.setDrawRange(0, nodeCount);
      const segCount = Math.max(0, Math.round(totalSegments * p));
      lineGeo.setDrawRange(0, segCount * 2);

      // camera pulls back from close-on-root to the whole sprawling network
      const dist = THREE.MathUtils.lerp(3.2, 26, p);
      const angle = p * 0.9;
      camera.position.set(Math.sin(angle) * dist * 0.3, Math.cos(angle) * dist * 0.15, dist);
      camera.lookAt(0, 0, 0);

      scene.rotation.z += 0.0008;

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
      // See ai-core-scene.tsx — teardown must never throw on an SPA route
      // change, when the subtree may already be detached from the document.
      try {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        handleRef.current = null;
        nodeGeo.dispose();
        nodeMat.dispose();
        lineGeo.dispose();
        lineMat.dispose();
        renderer.dispose();
        composer.dispose();
        if (renderer.domElement.parentElement === mount) {
          mount.removeChild(renderer.domElement);
        }
      } catch (err) {
        console.warn("[scale-network-scene] teardown during unmount — safely ignored:", err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
