"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type GlyphParticle = {
  group: THREE.Group;
  xRadius: number;
  zRadius: number;
  angle: number;
  speed: number;
  phase: number;
  y: number;
  lift: number;
  tilt: number;
  baseScale: number;
  textMaterial: THREE.MeshBasicMaterial;
  slabMaterial: THREE.MeshPhysicalMaterial;
};

const GLYPHS = [
  "RTL",
  "Markdown",
  "فارسی",
  "متن",
  "کد",
  "آ",
  "م",
  "ن",
  "پ",
  "چ",
  "#",
  "##",
  "```",
  "</>",
  "{ }",
  "[link]",
  "API",
  "React",
  "Next.js",
  "dir=\"rtl\"",
  "fa-IR",
  "$E=mc^2$",
  "\\frac{1}{3}",
  "=>",
  "&&",
  "::",
  "LTR",
  "LaTeX"
];

const COLORS = [0x8b5cf6, 0x22d3ee, 0x14f195, 0xf8fafc, 0xfb923c];
const RTL_RE = /[\u0600-\u06FF]/;

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function createRoundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createGlyphTexture(token: string, color: THREE.Color) {
  const measuringCanvas = document.createElement("canvas");
  const measuringContext = measuringCanvas.getContext("2d");
  const font =
    "800 72px Vazirmatn, Segoe UI, Tahoma, Arial, sans-serif";

  if (!measuringContext) {
    throw new Error("Could not create canvas context for glyph measurement.");
  }

  measuringContext.font = font;
  const measured = measuringContext.measureText(token).width;
  const width = Math.min(760, Math.max(220, Math.ceil(measured + 156)));
  const height = 148;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create canvas context for glyph texture.");
  }

  const accent = `rgb(${Math.round(color.r * 255)}, ${Math.round(
    color.g * 255
  )}, ${Math.round(color.b * 255)})`;

  ctx.clearRect(0, 0, width, height);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = RTL_RE.test(token) ? "rtl" : "ltr";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(token, width / 2, height / 2 + 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.46;
  ctx.fillText(token, width / 2 + 1, height / 2 + 5);
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  return { texture, aspect: width / height };
}

function createOrbitRing(radius: number, squish: number, color: number) {
  const points: THREE.Vector3[] = [];
  const segments = 180;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle * 2) * 0.28,
        Math.sin(angle) * radius * squish
      )
    );
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.LineLoop(geometry, material);
}

export function TypographicGalaxyBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const hostElement = host;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReducedMotion = reducedMotionQuery.matches;
    const random = seededRandom(3110);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050613, 0.026);
    scene.add(new THREE.AmbientLight(0x9bdcff, 0.58));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
    keyLight.position.set(-10, 12, 18);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x22d3ee, 2.4, 70);
    rimLight.position.set(18, -8, 22);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 140);
    camera.position.set(0, 1.6, 40);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.domElement.className = "typographic-galaxy-canvas";
    hostElement.appendChild(renderer.domElement);

    const galaxy = new THREE.Group();
    galaxy.rotation.set(0.18, 0, -0.12);
    scene.add(galaxy);

    const textureDisposals: THREE.Texture[] = [];
    const materialDisposals: THREE.Material[] = [];
    const geometryDisposals: THREE.BufferGeometry[] = [];
    const particles: GlyphParticle[] = [];

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(720 * 3);
    const starColors = new Float32Array(720 * 3);

    for (let i = 0; i < 720; i++) {
      const spread = 78;
      starPositions[i * 3] = (random() - 0.5) * spread;
      starPositions[i * 3 + 1] = (random() - 0.5) * 36;
      starPositions[i * 3 + 2] = (random() - 0.5) * spread - 8;

      const color = new THREE.Color(COLORS[Math.floor(random() * COLORS.length)]);
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;
    }

    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    galaxy.add(stars);
    geometryDisposals.push(starGeometry);
    materialDisposals.push(starMaterial);

    [18, 30, 42].forEach((radius, index) => {
      const ring = createOrbitRing(radius, 0.58 + index * 0.1, COLORS[index]);
      ring.rotation.x = 0.9 + index * 0.28;
      ring.rotation.y = -0.28 + index * 0.21;
      ring.rotation.z = 0.16 * index;
      galaxy.add(ring);
      geometryDisposals.push(ring.geometry);
      materialDisposals.push(ring.material);
    });

    for (let i = 0; i < 86; i++) {
      const token = GLYPHS[i % GLYPHS.length];
      const color = new THREE.Color(COLORS[i % COLORS.length]);
      const { texture, aspect } = createGlyphTexture(token, color);
      textureDisposals.push(texture);

      const height = 0.62 + random() * 0.95;
      const width = height * aspect;
      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.58 + random() * 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: true
      });
      const textMesh = new THREE.Mesh(geometry, material);

      const slabGeometry = new THREE.ExtrudeGeometry(
        createRoundedRectShape(width * 1.12, height * 1.42, height * 0.22),
        {
          depth: 0.18,
          bevelEnabled: true,
          bevelSegments: 5,
          bevelSize: 0.035,
          bevelThickness: 0.045,
          curveSegments: 12
        }
      );
      slabGeometry.center();

      const slabMaterial = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.14,
        metalness: 0.28,
        roughness: 0.2,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: true
      });

      const slabMesh = new THREE.Mesh(slabGeometry, slabMaterial);
      slabMesh.position.z = -0.04;
      textMesh.position.z = 0.12;

      const group = new THREE.Group();
      group.add(slabMesh, textMesh);

      const band = i % 3;
      const xRadius = 15 + band * 7 + random() * 12;
      const zRadius = 12 + band * 5 + random() * 10;
      const angle = i * 0.62 + random() * 1.2;
      const y = (random() - 0.5) * 23;
      group.position.set(Math.cos(angle) * xRadius, y, Math.sin(angle) * zRadius - 5);
      group.rotation.set(
        (random() - 0.5) * 0.6,
        -angle + Math.PI / 2,
        (random() - 0.5) * 0.8
      );
      const scale = 0.95 + random() * 1.5;
      group.scale.setScalar(scale);
      galaxy.add(group);

      particles.push({
        group,
        xRadius,
        zRadius,
        angle,
        speed: 0.045 + random() * 0.045,
        phase: random() * Math.PI * 2,
        y,
        lift: 0.45 + random() * 1.1,
        tilt: (random() - 0.5) * 0.8,
        baseScale: scale,
        textMaterial: material,
        slabMaterial
      });
      geometryDisposals.push(geometry, slabGeometry);
      materialDisposals.push(material, slabMaterial);
    }

    const pointer = { x: 0, y: 0 };
    const targetPointer = { x: 0, y: 0 };
    let previousFrameTime = performance.now();
    const startedAt = previousFrameTime;
    let frameId = 0;

    function resize() {
      const width = Math.max(1, hostElement.clientWidth);
      const height = Math.max(1, hostElement.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      galaxy.position.x = width >= 1200 ? 7.5 : width >= 820 ? 3.4 : 0;
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    }

    function handlePointerMove(event: PointerEvent) {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      targetPointer.x = (event.clientX / width - 0.5) * 2;
      targetPointer.y = (event.clientY / height - 0.5) * 2;
    }

    function animate() {
      const currentFrameTime = performance.now();
      const delta = Math.min((currentFrameTime - previousFrameTime) / 1000, 0.033);
      const elapsed = (currentFrameTime - startedAt) / 1000;
      previousFrameTime = currentFrameTime;

      pointer.x += (targetPointer.x - pointer.x) * 0.035;
      pointer.y += (targetPointer.y - pointer.y) * 0.035;
      galaxy.rotation.y = elapsed * 0.036 + pointer.x * 0.18;
      galaxy.rotation.x = 0.18 + Math.sin(elapsed * 0.2) * 0.04 - pointer.y * 0.1;
      stars.rotation.y = elapsed * 0.015;

      particles.forEach((particle, index) => {
        particle.angle += particle.speed * delta;
        const wave = Math.sin(elapsed * particle.lift + particle.phase);
        const z = Math.sin(particle.angle) * particle.zRadius - 5;
        const frontness = THREE.MathUtils.clamp((z + 22) / 42, 0, 1);
        particle.group.position.set(
          Math.cos(particle.angle) * particle.xRadius,
          particle.y + wave * 1.2,
          z
        );
        particle.group.rotation.y = -particle.angle + Math.PI / 2 + wave * 0.18;
        particle.group.rotation.x = particle.tilt + Math.sin(elapsed * 0.34 + index) * 0.09;
        particle.group.rotation.z = Math.sin(elapsed * 0.22 + particle.phase) * 0.16;
        particle.group.scale.setScalar(particle.baseScale * (0.82 + frontness * 0.28));
        particle.textMaterial.opacity = 0.24 + frontness * 0.58;
        particle.slabMaterial.opacity = 0.12 + frontness * 0.18;
        particle.slabMaterial.emissiveIntensity = 0.05 + frontness * 0.14;
      });

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    if (prefersReducedMotion) {
      galaxy.rotation.y = -0.18;
      galaxy.rotation.x = 0.22;
      renderer.render(scene, camera);
    } else {
      frameId = window.requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      if (frameId) window.cancelAnimationFrame(frameId);
      textureDisposals.forEach((texture) => texture.dispose());
      materialDisposals.forEach((material) => material.dispose());
      geometryDisposals.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="typographic-galaxy" aria-hidden="true" />;
}
