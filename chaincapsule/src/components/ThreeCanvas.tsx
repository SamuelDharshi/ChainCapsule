import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeCanvasProps {
  state?: "neutral" | "active" | "warning" | "uploading" | "unlocked";
}

export default function ThreeCanvas({ state = "neutral" }: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);

  // Store mouse coordinates for subtle parallax
  const mouse = useRef({ x: 0, y: 0 });
  const targetMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene setup with fog for deep space atmosphere
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.012);
    sceneRef.current = scene;

    // 2. Camera setup - positioned slightly looking down at the galaxy
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 7.5);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and transparent background
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 2.0);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f0ff, 5, 20);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Dynamic state tracker light
    const stateLight = new THREE.PointLight(0x00f0ff, 6, 12);
    stateLight.position.set(0, 1, 0);
    scene.add(stateLight);

    // 5. High-Fidelity Swirling Spiral Galaxy (representing decentralized Walrus aggregator shards and smart contracts)
    const particleCount = 4800;
    const vertexArray = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);

    const branches = 3;
    const radius = 8.0;
    const spin = 1.25;
    const power = 3.8;
    const randomness = 0.32;

    const colorInside = new THREE.Color(0x00f3ff); // Electric Cyber Cyan
    const colorOutside = new THREE.Color(0xd946ef); // Aurora Purple / Magenta

    for (let i = 0; i < particleCount; i++) {
      // Create spiral arms on logarithmic scale
      const r = Math.pow(Math.random(), 1.5) * radius;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = r * spin;

      // Exponential spread density
      const randomX = Math.pow(Math.random(), power) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
      const randomY = (Math.random() - 0.5) * 0.5 * ((radius - r) / radius); // Flatter core, thinner outer rim
      const randomZ = Math.pow(Math.random(), power) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;

      const x = Math.cos(branchAngle + spinAngle) * r + randomX;
      const z = Math.sin(branchAngle + spinAngle) * r + randomZ;
      const y = randomY;

      vertexArray[i * 3] = x;
      vertexArray[i * 3 + 1] = y;
      vertexArray[i * 3 + 2] = z;

      // Core illumination interpolation
      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, r / radius);

      // Add intense galactic core glow (shines bright white at center)
      if (r < 1.5) {
        mixedColor.addScalar(0.4 * (1.5 - r));
      }

      colorArray[i * 3] = mixedColor.r;
      colorArray[i * 3 + 1] = mixedColor.g;
      colorArray[i * 3 + 2] = mixedColor.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(vertexArray, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
    starsRef.current = stars;

    // 7. Mouse motion parallax tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      targetMouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    container.addEventListener("mousemove", handleMouseMove);

    // 8. Swirling rotation & vibration loop
    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Cyber camera easing
      mouse.current.x += (targetMouse.current.x - mouse.current.x) * 0.05;
      mouse.current.y += (targetMouse.current.y - mouse.current.y) * 0.05;

      camera.position.x += (mouse.current.x * 2.5 - camera.position.x) * 0.04;
      camera.position.y += ((mouse.current.y * 1.5 + 4.5) - camera.position.y) * 0.04;
      camera.lookAt(0, -0.2, 0);

      // Core color states mapping
      let speedFactor = 1.0;
      let stateColor = 0x0ea5e9;

      switch (state) {
        case "active":
          speedFactor = 2.4;
          stateColor = 0x10b981; // Green
          break;
        case "warning":
          speedFactor = 0.5;
          stateColor = 0xf59e0b; // Amber
          break;
        case "uploading":
          speedFactor = 4.2;
          stateColor = 0x38bdf8; // Blue-white
          break;
        case "unlocked":
          speedFactor = 1.1;
          stateColor = 0xeab308; // Gold
          break;
        case "neutral":
        default:
          speedFactor = 1.0;
          stateColor = 0x0ea5e9; // Cyan
          break;
      }

      // Rotate galaxy
      if (stars) {
        stars.rotation.y = elapsedTime * 0.025 * speedFactor;

        // Visual heartbeat scaling
        if (state === "uploading") {
          const s = 1.0 + Math.sin(elapsedTime * 8) * 0.04;
          stars.scale.set(s, s, s);
        } else {
          stars.scale.set(1, 1, 1);
        }
      }

      stateLight.color.lerp(new THREE.Color(stateColor), 0.08);
      renderer.render(scene, camera);
    };

    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (rendererRef.current && cameraRef.current) {
          rendererRef.current.setSize(newW, newH);
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
        }
      }
    });
    resizeObserver.observe(container);

    // Dismount cleanup
    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
    };
  }, [state]);

  return (
    <div
      ref={containerRef}
      id="three-3d-cryptocanvas"
      className="w-full h-full min-h-[480px] md:min-h-[560px] relative overflow-hidden flex items-center justify-center rounded-3xl"
    >
      {/* Absolute overlay project titles & taglines - positioned centrally of the background swirling galaxy */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none bg-radial from-transparent via-stone-975/35 to-stone-975/65 z-10 pointer-events-none">
        
        {/* VIGIL style Spacious typography layout */}
        <div className="max-w-4xl mx-auto px-4 relative pointer-events-auto transition-all duration-300">
          
          {/* Hackathon Pill Badge */}
          <div className="mx-auto w-fit bg-stone-950/90 border border-emerald-500/30 hover:border-emerald-500/50 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] mb-6 transition-all cursor-pointer">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400">
              ChainCapsule · Sui x Walrus Protocol
            </span>
          </div>

          {/* VIGIL-Inspired Smaller/Compact Typography Header */}
          <h2 className="font-display font-black text-2xl sm:text-4xl md:text-[42px] tracking-tight text-white uppercase leading-[1.08] mb-5">
            DECENTRALIZED <span className="text-outline-cyan glow-cyan font-black">TIME CAPSULES</span> <br className="hidden sm:inline" />
            & DEAD MAN'S <span className="text-[#10b981] glow-emerald font-black">SWITCHES.</span>
          </h2>
          
          {/* Conceptual sub description with standard styled font */}
          <p className="text-xs sm:text-sm md:text-base text-stone-300 leading-relaxed max-w-2xl mx-auto font-sans font-light tracking-wide px-2">
            <strong className="text-white hover:text-cyan-400 transition-colors font-medium">ChainCapsule</strong> is an on-chain Time Capsule & Dead Man's Switch on Sui + Walrus. Encrypt files client-side, host on Walrus, and let Sui smart contracts unlock decryption keys programmatically based on real-time triggers.
          </p>

          {/* Verification tokens */}
          <div className="flex justify-center flex-wrap items-center gap-4 sm:gap-6 mt-6 text-[10px] sm:text-[11px] font-mono text-stone-500">
            <span className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              CLIENT-SIDE AES-256
            </span>
            <span className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              WALRUS SHARDS
            </span>
            <span className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              SUI VM LEDGER
            </span>
          </div>
        </div>

      </div>

      {/* Absolute overlay indicator */}
      <div className="absolute top-4 right-4 z-20 pointer-events-none flex items-center gap-1.5 backdrop-blur-md bg-stone-900/60 border border-stone-800 px-3 py-1.5 rounded-full">
        <span
          className={`w-2 h-2 rounded-full animate-pulse ${
            state === "active"
              ? "bg-emerald-400"
              : state === "warning"
              ? "bg-amber-500"
              : state === "uploading"
              ? "bg-sky-400 animate-spin"
              : state === "unlocked"
              ? "bg-yellow-400"
              : "bg-cyan-400"
          }`}
        />
        <span className="text-[9px] font-mono font-bold tracking-wider text-stone-200 uppercase">
          {state === "neutral" ? "Sui Node Live" : `Node Status: ${state}`}
        </span>
      </div>
    </div>
  );
}
