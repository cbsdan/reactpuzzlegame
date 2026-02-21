import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../context/GameContext";
import "./StickmanMysteryGame.css";

/* ── Constants ──────────────────────────────────────── */
const GAME_DURATION = 300; // 5 min countdown
const TIME_PENALTY = 30; // seconds lost per clue
const INTERACT_DIST = 3.5;
const MOVE_SPEED = 8;
const TURN_SPEED = 3;
const BOUNDARY = 28;

/* ── Mystery puzzle data ────────────────────────────── */
const MYSTERY = {
  answer: "LIGHT",
  question: "All five clues describe the same thing. What am I?",
  objects: [
    {
      name: "Ancient Chest",
      pos: [10, 0, 10],
      color: 0x8b4513,
      emissive: 0x5c2d0a,
      beaconColor: 0xffd700,
      clue: "I travel at exactly 299,792,458 m/s — the fastest speed possible in the universe.",
    },
    {
      name: "Crystal Orb",
      pos: [-10, 0, -10],
      color: 0x9b59b6,
      emissive: 0x6c3483,
      beaconColor: 0xbb8fce,
      clue: "Without me, there is only complete and total darkness.",
    },
    {
      name: "Arcane Tome",
      pos: [12, 0, -8],
      color: 0xc0392b,
      emissive: 0x922b21,
      beaconColor: 0xe74c3c,
      clue: "I am composed of tiny massless packets of energy called photons.",
    },
    {
      name: "Golden Lantern",
      pos: [-8, 0, 12],
      color: 0xf39c12,
      emissive: 0xd4ac0d,
      beaconColor: 0xf9e79f,
      clue: "I can behave as both a wave and a particle — a famous duality in physics.",
    },
    {
      name: "Enchanted Mirror",
      pos: [-13, 0, 0],
      color: 0xbdc3c7,
      emissive: 0x85929e,
      beaconColor: 0xd5f5e3,
      clue: "Flip a switch and I instantly fill an entire room.",
    },
  ],
};

/* ── Helpers ─────────────────────────────────────────── */

/** Create a billboard text sprite */
function createTextSprite(text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 128;
  ctx.font = "Bold 36px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 1, 1);
  return sprite;
}

/** Build the stickman character (returns object with group + limb refs) */
function buildStickman() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x00ffd0,
    emissive: 0x006650,
    roughness: 0.5,
    metalness: 0.2,
  });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), mat);
  head.position.y = 1.9;
  head.castShadow = true;
  group.add(head);

  // Body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8),
    mat,
  );
  body.position.y = 1.25;
  body.castShadow = true;
  group.add(body);

  // Arms — geometry translated so pivot is at shoulder
  const makeArm = () => {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8);
    g.translate(0, -0.3, 0);
    return new THREE.Mesh(g, mat);
  };
  const leftArm = makeArm();
  leftArm.position.set(-0.2, 1.6, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = makeArm();
  rightArm.position.set(0.2, 1.6, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs — geometry translated so pivot is at hip
  const makeLeg = () => {
    const g = new THREE.CylinderGeometry(0.045, 0.045, 0.75, 8);
    g.translate(0, -0.375, 0);
    return new THREE.Mesh(g, mat);
  };
  const leftLeg = makeLeg();
  leftLeg.position.set(-0.12, 0.85, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = makeLeg();
  rightLeg.position.set(0.12, 0.85, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Small glow under stickman
  const glow = new THREE.PointLight(0x00ffd0, 0.6, 4);
  glow.position.y = 0.5;
  group.add(glow);

  return { group, head, body, leftArm, rightArm, leftLeg, rightLeg };
}

/** Build a mystery object (pedestal + shape + beacon + label + light) */
function buildObjectMesh(objData, index) {
  const group = new THREE.Group();

  // Stone pedestal
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x333344,
    roughness: 0.85,
    metalness: 0.15,
  });
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 0.4, 8),
    pedMat,
  );
  pedestal.position.y = 0.2;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // Main shape — unique per object
  const mainMat = new THREE.MeshStandardMaterial({
    color: objData.color,
    emissive: objData.emissive,
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.3,
  });

  let mainMesh;
  switch (index) {
    case 0: // Chest — box
      mainMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.7), mainMat);
      mainMesh.position.y = 0.72;
      break;
    case 1: {
      // Orb — sphere
      const orbMat = mainMat.clone();
      orbMat.transparent = true;
      orbMat.opacity = 0.82;
      mainMesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 24), orbMat);
      mainMesh.position.y = 0.85;
      break;
    }
    case 2: // Tome — flat box
      mainMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.14, 0.95),
        mainMat,
      );
      mainMesh.position.y = 0.52;
      mainMesh.rotation.y = 0.3;
      break;
    case 3: // Lantern — octahedron
      mainMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), mainMat);
      mainMesh.position.y = 0.9;
      break;
    case 4: // Mirror — tall thin box
      mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 1.0), mainMat);
      mainMesh.position.y = 1.22;
      break;
    default:
      mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mainMat);
      mainMesh.position.y = 0.75;
  }
  mainMesh.castShadow = true;
  group.add(mainMesh);

  // Floating beacon (pulsing sphere)
  const beaconMat = new THREE.MeshStandardMaterial({
    color: objData.beaconColor,
    emissive: objData.beaconColor,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 12),
    beaconMat,
  );
  beacon.position.y = 2.5;
  group.add(beacon);

  // Proximity ring on the ground
  const ringMat = new THREE.MeshStandardMaterial({
    color: objData.beaconColor,
    emissive: objData.beaconColor,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(INTERACT_DIST - 0.3, INTERACT_DIST, 48),
    ringMat,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  // Point light
  const light = new THREE.PointLight(objData.beaconColor, 2, 12);
  light.position.y = 2.0;
  group.add(light);

  // Name label
  const label = createTextSprite(objData.name);
  label.position.y = 3.2;
  group.add(label);

  // World position
  group.position.set(objData.pos[0], objData.pos[1], objData.pos[2]);

  return { group, mesh: mainMesh, beacon, ring, light, label };
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
const StickmanMysteryGame = () => {
  const { submitAnswer, currentPlayer, gameState } = useGame();

  /* ── Three.js refs ─────────────────────────────────── */
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const animFrameRef = useRef(null);
  const stickmanRef = useRef(null);
  const objMeshesRef = useRef([]);

  /* ── Input refs ────────────────────────────────────── */
  const keysRef = useRef({});
  const stickmanAngleRef = useRef(0);
  const walkCycleRef = useRef(0);
  const interactCoolRef = useRef(false);

  /* ── State↔ref bridges (read from animation loop) ─── */
  const cluesFoundRef = useRef([]);
  const nearObjRef = useRef(null);
  const showingModalRef = useRef(false);
  const solvedRef = useRef(false);
  const gameOverRef = useRef(false);
  const isPausedRef = useRef(false);

  /* ── React state ───────────────────────────────────── */
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [cluesFound, setCluesFound] = useState([]);
  const [nearObject, setNearObject] = useState(null);
  const [showClue, setShowClue] = useState(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [solved, setSolved] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const prevStartedAtRef = useRef(gameState?.startedAt);
  const isPaused = gameState?.status === "paused";

  /* ── Keep refs in sync ─────────────────────────────── */
  useEffect(() => {
    cluesFoundRef.current = cluesFound;
  }, [cluesFound]);
  useEffect(() => {
    solvedRef.current = solved;
  }, [solved]);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    showingModalRef.current = showClue !== null || showQuestion;
  }, [showClue, showQuestion]);

  /* ── Detect admin restart ──────────────────────────── */
  useEffect(() => {
    const newStarted = gameState?.startedAt;
    if (newStarted && newStarted !== prevStartedAtRef.current) {
      setTimeLeft(GAME_DURATION);
      setCluesFound([]);
      setShowClue(null);
      setShowQuestion(false);
      setAnswer("");
      setError("");
      setSolved(false);
      setFinalScore(0);
      setWrongAttempts(0);
      setGameOver(false);
      cluesFoundRef.current = [];
      solvedRef.current = false;
      gameOverRef.current = false;
      // reset stickman position
      if (stickmanRef.current) {
        stickmanRef.current.group.position.set(0, 0, 0);
        stickmanAngleRef.current = 0;
      }
      // restore beacons
      objMeshesRef.current.forEach((o) => {
        if (o.beacon) o.beacon.visible = true;
        if (o.ring) o.ring.visible = true;
        if (o.light) o.light.intensity = 2;
      });
      prevStartedAtRef.current = newStarted;
    }
  }, [gameState?.startedAt]);

  /* ── Countdown timer ───────────────────────────────── */
  const timerRef = useRef(null);
  useEffect(() => {
    clearInterval(timerRef.current);
    if (solved || gameOver || isPaused || gameState?.status !== "playing")
      return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [solved, gameOver, isPaused, gameState?.status]);

  /* ════════════════════════════════════════════════════
     Three.js scene — runs once on mount
     ════════════════════════════════════════════════════ */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Ensure parent has no padding/scroll (fallback for browsers without :has()) ──
    const contentEl = container.closest(".game-fullscreen-content");
    if (contentEl) {
      contentEl.style.padding = "0";
      contentEl.style.overflow = "hidden";
    }

    // ── Scene ─────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.022);
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────
    const aspect =
      container.clientWidth && container.clientHeight
        ? container.clientWidth / container.clientHeight
        : 16 / 9;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 200);
    camera.position.set(0, 6, 10);
    cameraRef.current = camera;

    // ── Renderer (setPixelRatio must come before setSize) ─────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Lights ────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x222244, 0.7));

    const dirLight = new THREE.DirectionalLight(0x8888cc, 0.4);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -35;
    dirLight.shadow.camera.right = 35;
    dirLight.shadow.camera.top = 35;
    dirLight.shadow.camera.bottom = -35;
    scene.add(dirLight);

    // hemisphere fill
    scene.add(new THREE.HemisphereLight(0x1a1a3e, 0x0a0a1a, 0.3));

    // ── Ground ────────────────────────────────────────
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x16162a,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(80, 40, 0x2a2a50, 0x1e1e3e);
    grid.position.y = 0.01;
    scene.add(grid);

    // ── Stars ─────────────────────────────────────────
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 160;
      starPositions[i * 3 + 1] = Math.random() * 50 + 12;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 }),
      ),
    );

    // ── Decorative pillars ────────────────────────────
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x222240,
      roughness: 0.9,
    });
    const pillarPositions = [
      [18, 0, 0],
      [-18, 0, 0],
      [0, 0, 18],
      [0, 0, -18],
      [15, 0, 15],
      [-15, 0, -15],
    ];
    pillarPositions.forEach(([px, , pz]) => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 4, 6),
        pillarMat,
      );
      pillar.position.set(px, 2, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
    });

    // ── Stickman ──────────────────────────────────────
    const stickman = buildStickman();
    scene.add(stickman.group);
    stickmanRef.current = stickman;

    // ── 5 Mystery objects ─────────────────────────────
    const objMeshes = MYSTERY.objects.map((data, i) => {
      const obj = buildObjectMesh(data, i);
      scene.add(obj.group);
      return obj;
    });
    objMeshesRef.current = objMeshes;

    // ── Animation loop ────────────────────────────────
    const clock = clockRef.current;
    clock.start();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();

      const keys = keysRef.current;
      const paused = isPausedRef.current;
      const modal = showingModalRef.current;
      const done = solvedRef.current;
      const over = gameOverRef.current;
      const canMove = !paused && !modal && !done && !over;

      /* —— Movement —— */
      let isMoving = false;
      if (canMove) {
        if (keys["a"] || keys["arrowleft"])
          stickmanAngleRef.current += TURN_SPEED * delta;
        if (keys["d"] || keys["arrowright"])
          stickmanAngleRef.current -= TURN_SPEED * delta;

        const dir = new THREE.Vector3();
        if (keys["w"] || keys["arrowup"]) {
          dir.z -= 1;
          isMoving = true;
        }
        if (keys["s"] || keys["arrowdown"]) {
          dir.z += 1;
          isMoving = true;
        }

        if (isMoving) {
          dir
            .normalize()
            .applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              stickmanAngleRef.current,
            );
          stickman.group.position.addScaledVector(dir, MOVE_SPEED * delta);
          stickman.group.position.x = THREE.MathUtils.clamp(
            stickman.group.position.x,
            -BOUNDARY,
            BOUNDARY,
          );
          stickman.group.position.z = THREE.MathUtils.clamp(
            stickman.group.position.z,
            -BOUNDARY,
            BOUNDARY,
          );
        }
      }
      stickman.group.rotation.y = stickmanAngleRef.current;

      /* —— Walk cycle —— */
      if (isMoving && canMove) {
        walkCycleRef.current += delta * 10;
        const s = Math.sin(walkCycleRef.current);
        stickman.leftLeg.rotation.x = s * 0.6;
        stickman.rightLeg.rotation.x = -s * 0.6;
        stickman.leftArm.rotation.x = -s * 0.5;
        stickman.rightArm.rotation.x = s * 0.5;
      } else {
        stickman.leftLeg.rotation.x *= 0.85;
        stickman.rightLeg.rotation.x *= 0.85;
        stickman.leftArm.rotation.x *= 0.85;
        stickman.rightArm.rotation.x *= 0.85;
      }

      /* —— Camera follow —— */
      const camOff = new THREE.Vector3(0, 5, 8).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        stickmanAngleRef.current,
      );
      camera.position.lerp(
        stickman.group.position.clone().add(camOff),
        4 * delta,
      );
      camera.lookAt(
        stickman.group.position.x,
        stickman.group.position.y + 1.5,
        stickman.group.position.z,
      );

      /* —— Proximity detection —— */
      let nearest = null;
      let nearestDist = Infinity;
      const px = stickman.group.position.x;
      const pz = stickman.group.position.z;
      for (let i = 0; i < objMeshes.length; i++) {
        const [ox, , oz] = MYSTERY.objects[i].pos;
        const d = Math.sqrt((px - ox) ** 2 + (pz - oz) ** 2);
        if (d < INTERACT_DIST && d < nearestDist) {
          nearest = i;
          nearestDist = d;
        }
      }
      if (nearest !== nearObjRef.current) {
        nearObjRef.current = nearest;
        setNearObject(nearest);
      }

      /* —— E‑key interaction —— */
      if (keys["e"] && !interactCoolRef.current && canMove) {
        interactCoolRef.current = true;
        setTimeout(() => {
          interactCoolRef.current = false;
        }, 400);
        const idx = nearObjRef.current;
        if (idx !== null && !cluesFoundRef.current.includes(idx)) {
          setShowClue(idx);
          setCluesFound((prev) => [...prev, idx]);
          setTimeLeft((prev) => Math.max(0, prev - TIME_PENALTY));
          // dim collected object
          const o = objMeshes[idx];
          if (o.beacon) o.beacon.visible = false;
          if (o.ring) o.ring.material.opacity = 0.08;
          if (o.light) o.light.intensity = 0.35;
        }
      }

      /* —— Beacon pulse animation —— */
      objMeshes.forEach((o, i) => {
        if (o.beacon && o.beacon.visible) {
          o.beacon.position.y = 2.5 + Math.sin(time * 2.2 + i * 1.3) * 0.2;
          o.beacon.material.emissiveIntensity =
            1.2 + Math.sin(time * 3 + i * 0.9) * 0.5;
        }
        // slow rotate main mesh
        if (o.mesh && i !== 4) o.mesh.rotation.y += delta * 0.3;
      });

      renderer.render(scene, camera);
    };
    animate();

    /* ── Input handlers ─────────────────────────────── */
    const onKeyDown = (e) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ",
        ].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    /* ── Resize via ResizeObserver (handles initial layout + window resize) ── */
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Force a resize on the next frame to guarantee correct dimensions
    requestAnimationFrame(() => {
      if (!container.isConnected) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });

    /* ── Cleanup ────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
      if (contentEl) {
        contentEl.style.padding = "";
        contentEl.style.overflow = "";
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Answer submission ─────────────────────────────── */
  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    setError("");
    if (!answer.trim()) {
      setError("Please type an answer.");
      return;
    }
    if (isPaused) {
      setError("Game is paused — wait for the host to resume.");
      return;
    }

    const result = await submitAnswer(answer.trim(), {
      timeLeft,
      cluesFound: cluesFound.length,
      wrongAttempts,
    });

    if (!result.success) {
      setError(result.error || "Submission failed.");
      return;
    }

    if (result.isCorrect) {
      setSolved(true);
      setFinalScore(result.score);
    } else {
      setWrongAttempts((prev) => prev + 1);
      setAnswer("");
      setError("That's not correct — think again!");
    }
  };

  /* ── Format helpers ────────────────────────────────── */
  const fmt = (s) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const allClues = cluesFound.length === MYSTERY.objects.length;

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
  return (
    <div className="sm-game">
      {/* Three.js canvas */}
      <div ref={containerRef} className="sm-canvas" />

      {/* ── HUD ──────────────────────────────────── */}
      <div className="sm-hud">
        <div className="sm-hud-left">
          <div
            className={`sm-hud-pill sm-timer ${timeLeft <= 60 ? "warn" : ""} ${timeLeft <= 30 ? "critical" : ""}`}
          >
            ⏱ {fmt(timeLeft)}
          </div>
          <div className="sm-hud-pill sm-clue-count">
            🔑 {cluesFound.length}/{MYSTERY.objects.length}
          </div>
        </div>
        <div className="sm-hud-right">
          <div className="sm-hud-pill sm-controls-hint">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> Move &nbsp;· <kbd>E</kbd> Interact
          </div>
        </div>
      </div>

      {/* Collected clue pills */}
      {cluesFound.length > 0 &&
        !showClue &&
        !showQuestion &&
        !solved &&
        !gameOver && (
          <div className="sm-collected-pills">
            {cluesFound.map((idx) => (
              <span
                key={idx}
                className="sm-collected-pill"
                title={MYSTERY.objects[idx].clue}
              >
                ✅ {MYSTERY.objects[idx].name}
              </span>
            ))}
          </div>
        )}

      {/* Proximity prompt */}
      {nearObject !== null &&
        !showClue &&
        !showQuestion &&
        !solved &&
        !gameOver &&
        !isPaused && (
          <div
            className={`sm-prompt ${cluesFoundRef.current.includes(nearObject) ? "collected" : ""}`}
          >
            {cluesFoundRef.current.includes(nearObject) ? (
              `✅ ${MYSTERY.objects[nearObject].name} — already inspected`
            ) : (
              <span>
                Press <kbd>E</kbd> to inspect{" "}
                <strong>{MYSTERY.objects[nearObject].name}</strong>
              </span>
            )}
          </div>
        )}

      {/* Answer-ready button */}
      {allClues &&
        !showQuestion &&
        !solved &&
        !gameOver &&
        showClue === null &&
        !isPaused && (
          <div className="sm-answer-ready">
            <button onClick={() => setShowQuestion(true)}>
              🧩 Answer the Mystery
            </button>
          </div>
        )}

      {/* ── Clue modal ────────────────────────────── */}
      {showClue !== null && (
        <div className="sm-overlay" onClick={() => setShowClue(null)}>
          <div
            className="sm-modal sm-clue-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">🔍</div>
            <h3>{MYSTERY.objects[showClue].name}</h3>
            <p className="sm-clue-text">{MYSTERY.objects[showClue].clue}</p>
            <div className="sm-penalty-badge">
              ⏱ −{TIME_PENALTY}s time penalty
            </div>
            <button className="sm-btn" onClick={() => setShowClue(null)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Question modal ────────────────────────── */}
      {showQuestion && !solved && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-question-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">🧩</div>
            <h3>The Mystery Question</h3>
            <p className="sm-question-text">{MYSTERY.question}</p>

            <div className="sm-review">
              <h4>Your Collected Clues</h4>
              {MYSTERY.objects.map((obj, i) => (
                <div key={i} className="sm-review-row">
                  <span className="sm-review-num">#{i + 1}</span>
                  <span className="sm-review-name">{obj.name}:</span>
                  <span className="sm-review-clue">{obj.clue}</span>
                </div>
              ))}
            </div>

            <form className="sm-answer-form" onSubmit={handleSubmitAnswer}>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
                autoFocus
                maxLength={50}
              />
              <button type="submit" className="sm-btn sm-btn-primary">
                Submit
              </button>
            </form>

            {wrongAttempts > 0 && (
              <div className="sm-attempts">Wrong attempts: {wrongAttempts}</div>
            )}
            {error && <div className="sm-error">{error}</div>}

            <button
              className="sm-btn sm-btn-secondary"
              onClick={() => {
                setShowQuestion(false);
                setError("");
              }}
            >
              Back to Exploring
            </button>
          </div>
        </div>
      )}

      {/* ── Solved ────────────────────────────────── */}
      {solved && (
        <div className="sm-overlay sm-overlay-solved">
          <div className="sm-modal sm-solved-modal">
            <div className="sm-big-icon">🎉</div>
            <h2>Mystery Solved!</h2>
            <p>
              The answer is: <strong>{MYSTERY.answer}</strong>
            </p>
            <div className="sm-score-box">
              <span className="sm-score-label">Final Score</span>
              <span className="sm-score-value">{finalScore}</span>
            </div>
            <div className="sm-solve-stats">
              <span>⏱ Time remaining: {fmt(timeLeft)}</span>
              <span>❌ Wrong attempts: {wrongAttempts}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Time's up ─────────────────────────────── */}
      {gameOver && !solved && (
        <div className="sm-overlay sm-overlay-over">
          <div className="sm-modal sm-over-modal">
            <div className="sm-big-icon">⏰</div>
            <h2>Time&rsquo;s Up!</h2>
            <p>You ran out of time.</p>
            <p>
              The answer was: <strong>{MYSTERY.answer}</strong>
            </p>
            <div className="sm-solve-stats">
              <span>
                🔑 Clues found: {cluesFound.length}/{MYSTERY.objects.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Paused ────────────────────────────────── */}
      {isPaused && (
        <div className="sm-overlay">
          <div className="sm-modal sm-pause-modal">
            <div className="sm-modal-icon">⏸️</div>
            <h3>Game Paused</h3>
            <p>Waiting for the host to resume…</p>
            {cluesFound.length > 0 && (
              <p className="sm-pause-progress">
                {cluesFound.length} clue{cluesFound.length !== 1 ? "s" : ""}{" "}
                found so far
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StickmanMysteryGame;
