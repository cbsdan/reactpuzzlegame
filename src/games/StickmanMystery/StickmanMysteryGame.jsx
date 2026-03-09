import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../context/GameContext";
import "./StickmanMysteryGame.css";
import {
  GAME_DURATION,
  TRASH_SLOW_DURATION,
  TRASH_SHAKE_DURATION,
  SLOW_FACTOR,
  STAGE_WRONG_TIME_PENALTY,
  STAGE_TRASH_TIME_PENALTY,
  INTERACT_DIST,
  MOVE_SPEED,
  TURN_SPEED,
  BOUNDARY,
  CART_POS,
  CART_INTERACT_DIST,
  DASH_SPEED,
  DASH_DURATION,
  DASH_COOLDOWN,
  JUMP_COOLDOWN,
  JUMP_HEIGHT,
  JUMP_DURATION,
  PUSH_DIST,
  PUSH_FORCE,
  POSITION_SYNC_MS,
  TOTAL_STAGES,
  STAGE_MAX_SCORES,
  PLAYER_COLORS,
  WALL_SEGMENTS,
} from "./constants.js";
import { DEFAULT_STAGES, AVAILABLE_OBJECTS } from "./stageData.js";
import {
  buildStickman,
  buildObjectMesh,
  buildCartMesh,
  buildWallMesh,
  buildTorch,
  buildTrashMesh,
  createTextSprite,
} from "./threeBuilders.js";
import {
  generateRandomPosSeeded,
  makePrng,
  hashStr,
  resolveCollisions,
} from "./gameUtils.js";
import GameHUD from "./GameHUD.jsx";
import GameModals from "./GameModals.jsx";

// Re-export for consumers (AdminDashboard, StickmanSettings)
export { DEFAULT_STAGES, AVAILABLE_OBJECTS };
export { GAME_DURATION };

const API_URL = import.meta.env.VITE_API_URL || "";

const StickmanMysteryGame = () => {
  const { submitAnswer, currentPlayer, gameState, currentRoom, players } =
    useGame();

  // ── Reload persistence: load any saved progress for this session ──
  const _smKey =
    currentRoom?._id && currentPlayer?._id
      ? `sm-progress-${currentRoom._id}-${currentPlayer._id}`
      : null;
  const _saved = (() => {
    if (!_smKey) return null;
    try {
      const raw = sessionStorage.getItem(_smKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.startedAt !== gameState?.startedAt) return null;
      return parsed;
    } catch {
      return null;
    }
  })();

  // Resolve active stages: admin config → localStorage saved config → built-in defaults
  const adminConfig = gameState?.stickmanConfig;
  const STAGES =
    adminConfig?.stages ||
    (() => {
      try {
        const saved = localStorage.getItem("stickman_custom_config");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed?.stages &&
            Array.isArray(parsed.stages) &&
            parsed.stages.length > 0
          ) {
            // Re-attach themes if missing
            return parsed.stages.map((s, i) => ({
              ...s,
              theme: s.theme ||
                [
                  {
                    color: 0x00e5ff,
                    emissive: 0x006b80,
                    beacon: 0x00e5ff,
                    label: "#00e5ff",
                  },
                  {
                    color: 0xbb86fc,
                    emissive: 0x5d4380,
                    beacon: 0xbb86fc,
                    label: "#bb86fc",
                  },
                  {
                    color: 0xff7043,
                    emissive: 0x802020,
                    beacon: 0xff7043,
                    label: "#ff7043",
                  },
                  {
                    color: 0x448aff,
                    emissive: 0x1a3680,
                    beacon: 0x448aff,
                    label: "#448aff",
                  },
                  {
                    color: 0x69f0ae,
                    emissive: 0x1a5c35,
                    beacon: 0x69f0ae,
                    label: "#69f0ae",
                  },
                  {
                    color: 0xffab00,
                    emissive: 0x805500,
                    beacon: 0xffab00,
                    label: "#ffab00",
                  },
                  {
                    color: 0x00e676,
                    emissive: 0x00733b,
                    beacon: 0x00e676,
                    label: "#00e676",
                  },
                ][i] || {
                  color: 0x00e5ff,
                  emissive: 0x006b80,
                  beacon: 0x00e5ff,
                  label: "#00e5ff",
                },
            }));
          }
        }
      } catch {
        /* ignore */
      }
      return DEFAULT_STAGES;
    })();

  /* ── Three.js refs ─────────────────────────────────── */
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const animFrameRef = useRef(null);
  const stickmanRef = useRef(null);
  const clueMeshesRef = useRef([]);
  const trashMeshesRef = useRef([]);

  /* ── Input refs ────────────────────────────────────── */
  const keysRef = useRef({});
  const stickmanAngleRef = useRef(0);
  const walkCycleRef = useRef(0);
  const interactCoolRef = useRef(false);

  /* ── State↔ref bridges (read from animation loop) ─── */
  const stageCluesFoundRef = useRef(_saved?.stageCluesFound ?? []);
  const stageTrashTriggeredRef = useRef(_saved?.stageTrashTriggered ?? []);
  const nearClueRef = useRef(null);
  const nearTrashRef = useRef(null);
  const showingModalRef = useRef(false);
  const gameCompleteRef = useRef(_saved?.gameComplete ?? false);
  const gameOverRef = useRef(false);
  const isPausedRef = useRef(false);
  const nearCartRef = useRef(false);
  const cartMeshRef = useRef(null);
  // Array of [x, z] spawn positions, one per stage — populated at scene init
  const stageSpawnPositionsRef = useRef([]);
  // Array of [x, z] cart positions, one per stage — populated at scene init
  const stageCartSpawnPositionsRef = useRef([]);
  const wallBoxesRef = useRef([]);
  const torchFlamesRef = useRef([]);
  const currentStageRef = useRef(_saved?.stage ?? 0);
  const stageStartTimeRef = useRef(_saved?.stageStartTime ?? GAME_DURATION);
  const slowTimeRef = useRef(0);
  const shakeTimeRef = useRef(0);
  const isSlowedRef = useRef(false);
  const timePenaltyRef = useRef(_saved?.timePenalty ?? 0);
  const timeLeftRef = useRef(GAME_DURATION);

  /* ── Jump refs ───────────────────────────────────────── */
  const isJumpingRef = useRef(false);
  const jumpCoolRef = useRef(false);
  const jumpTimerRef = useRef(0);

  /* ── Key & Door refs ─────────────────────────────────── */
  const hasKeyRef = useRef(_saved?.hasKey ?? false);
  const doorMeshRef = useRef(null);
  const nearDoorRef = useRef(false);

  /* ── Mouse hover refs ────────────────────────────────── */
  const mouseRef = useRef(new THREE.Vector2(-9999, -9999));
  const hoveredObjectRef = useRef(null);

  /* ── Camera orbit refs ──────────────────────────────── */
  // yaw=0 → camera sits directly behind (+Z offset), pitch=atan2(5,8) → ~32° elevation
  const cameraYawRef = useRef(0);
  const cameraPitchRef = useRef(Math.atan2(5, 8)); // ≈0.559 rad
  const cameraYawTargetRef = useRef(0);
  const cameraPitchTargetRef = useRef(Math.atan2(5, 8));
  const isDragRef = useRef(false);
  const lastDragRef = useRef({ x: 0, y: 0 });

  /* ── Multiplayer refs ──────────────────────────────── */
  const otherPlayersRef = useRef(new Map());
  const pushVelocityRef = useRef({ x: 0, z: 0 });
  const isDashingRef = useRef(false);
  const dashCoolRef = useRef(false);
  const dashTimerRef = useRef(0);
  const syncIntervalRef = useRef(null);
  const roomIdRef = useRef(currentRoom?._id);
  const accumulatedScoreRef = useRef(
    (_saved?.stageScores ?? []).reduce((s, x) => s + (x.score ?? 0), 0),
  );

  /* ── React state ───────────────────────────────────── */
  const [timeLeft, setTimeLeft] = useState(() => {
    // Initialize from server time if game is already running, accounting for saved penalty
    if (gameState?.startedAt && gameState?.status === "playing") {
      const elapsed =
        Date.now() -
        new Date(gameState.startedAt).getTime() -
        (gameState.totalPausedMs || 0);
      return Math.max(
        0,
        GAME_DURATION - Math.floor(elapsed / 1000) - (_saved?.timePenalty ?? 0),
      );
    }
    return GAME_DURATION;
  });
  const [timePenalty, setTimePenalty] = useState(_saved?.timePenalty ?? 0);
  const [currentStage, setCurrentStage] = useState(_saved?.stage ?? 0);
  const [stageCluesFound, setStageCluesFound] = useState(
    _saved?.stageCluesFound ?? [],
  );
  const [stageTrashTriggered, setStageTrashTriggered] = useState(
    _saved?.stageTrashTriggered ?? [],
  );
  const [nearClue, setNearClue] = useState(null);
  const [nearTrash, setNearTrash] = useState(null);
  const [showClue, setShowClue] = useState(null);
  const [showTrash, setShowTrash] = useState(null);
  const [showStageQuestion, setShowStageQuestion] = useState(false);
  const [stageAnswer, setStageAnswer] = useState("");
  const [stageWrongAttempts, setStageWrongAttempts] = useState(0);
  const [error, setError] = useState("");
  const [gameComplete, setGameComplete] = useState(
    _saved?.gameComplete ?? false,
  );
  const [finalScore, setFinalScore] = useState(_saved?.finalScore ?? 0);
  const [gameOver, setGameOver] = useState(false);
  const [nearCart, setNearCart] = useState(false);
  const [isDashing, setIsDashing] = useState(false);
  const [dashReady, setDashReady] = useState(true);
  const [isSlowed, setIsSlowed] = useState(false);
  const [showStageSummary, setShowStageSummary] = useState(null);
  const [stageScores, setStageScores] = useState(_saved?.stageScores ?? []);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [cartAnswerBlocked, setCartAnswerBlocked] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpReady, setJumpReady] = useState(true);
  const [hasKey, setHasKey] = useState(_saved?.hasKey ?? false);
  const [nearDoor, setNearDoor] = useState(false);
  const [showStoryline, setShowStoryline] = useState(_saved ? false : true);
  const [showKeyObtained, setShowKeyObtained] = useState(false);

  useEffect(() => {
    roomIdRef.current = currentRoom?._id;
  }, [currentRoom?._id]);

  // ── Persist progress to sessionStorage on key state changes ────
  useEffect(() => {
    if (!_smKey || !gameState?.startedAt) return;
    if (gameOver) {
      try {
        sessionStorage.removeItem(_smKey);
      } catch {}
      return;
    }
    const pos = stickmanRef.current?.group?.position;
    try {
      sessionStorage.setItem(
        _smKey,
        JSON.stringify({
          startedAt: gameState.startedAt,
          stage: currentStage,
          stageCluesFound,
          stageTrashTriggered,
          stageScores,
          posX: pos?.x ?? 0,
          posZ: pos?.z ?? 0,
          posAngle: stickmanAngleRef.current,
          stageStartTime: stageStartTimeRef.current,
          hasKey,
          gameComplete,
          finalScore,
          timePenalty: timePenaltyRef.current,
        }),
      );
    } catch {}
  }, [
    currentStage,
    stageCluesFound,
    stageTrashTriggered,
    stageScores,
    hasKey,
    gameComplete,
    gameOver,
    finalScore,
    timePenalty,
  ]);

  const prevStartedAtRef = useRef(gameState?.startedAt);
  const isPaused = gameState?.status === "paused";

  /* ── Keep refs in sync ─────────────────────────────── */
  useEffect(() => {
    stageCluesFoundRef.current = stageCluesFound;
  }, [stageCluesFound]);
  useEffect(() => {
    stageTrashTriggeredRef.current = stageTrashTriggered;
  }, [stageTrashTriggered]);
  useEffect(() => {
    gameCompleteRef.current = gameComplete;
  }, [gameComplete]);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);
  useEffect(() => {
    showingModalRef.current =
      showClue !== null ||
      showTrash !== null ||
      showStageQuestion ||
      showStageSummary !== null ||
      showFinalSummary ||
      showDashboard ||
      showStoryline ||
      showKeyObtained ||
      (gameComplete && !showFinalSummary && !showDashboard);
  }, [
    showClue,
    showTrash,
    showStageQuestion,
    showStageSummary,
    showFinalSummary,
    showDashboard,
    showStoryline,
    showKeyObtained,
    gameComplete,
  ]);

  /* ── Detect admin restart ──────────────────────────── */
  useEffect(() => {
    const newStarted = gameState?.startedAt;
    if (newStarted && newStarted !== prevStartedAtRef.current) {
      // Clear saved progress so the fresh game starts clean
      if (_smKey)
        try {
          sessionStorage.removeItem(_smKey);
        } catch {}
      // Compute time from server clock
      const elapsed =
        Date.now() -
        new Date(newStarted).getTime() -
        (gameState?.totalPausedMs || 0);
      setTimeLeft(Math.max(0, GAME_DURATION - Math.floor(elapsed / 1000)));
      setCurrentStage(0);
      setStageCluesFound([]);
      setStageTrashTriggered([]);
      setShowClue(null);
      setShowTrash(null);
      setShowStageQuestion(false);
      setStageAnswer("");
      setStageWrongAttempts(0);
      setError("");
      setGameComplete(false);
      setFinalScore(0);
      setGameOver(false);
      setIsDashing(false);
      setDashReady(true);
      setIsSlowed(false);
      setShowStageSummary(null);
      setStageScores([]);
      setShowFinalSummary(false);
      setShowDashboard(false);
      setCartAnswerBlocked(false);
      setIsJumping(false);
      setJumpReady(true);
      setHasKey(false);
      setNearDoor(false);
      setShowStoryline(true);
      setShowKeyObtained(false);
      // Reset refs
      stageCluesFoundRef.current = [];
      stageTrashTriggeredRef.current = [];
      currentStageRef.current = 0;
      gameCompleteRef.current = false;
      gameOverRef.current = false;
      slowTimeRef.current = 0;
      shakeTimeRef.current = 0;
      stageStartTimeRef.current = GAME_DURATION;
      isDashingRef.current = false;
      dashCoolRef.current = false;
      dashTimerRef.current = 0;
      isJumpingRef.current = false;
      jumpCoolRef.current = false;
      jumpTimerRef.current = 0;
      hasKeyRef.current = false;
      pushVelocityRef.current = { x: 0, z: 0 };
      timePenaltyRef.current = 0;
      setTimePenalty(0);
      // reset stickman and cart to their stage-0 spawn positions
      if (stickmanRef.current) {
        const sp = stageSpawnPositionsRef.current[0] ?? [0, 0];
        stickmanRef.current.group.position.set(sp[0], 0, sp[1]);
        stickmanAngleRef.current = 0;
      }
      if (cartMeshRef.current) {
        const cp = stageCartSpawnPositionsRef.current[0] ?? [
          CART_POS[0],
          CART_POS[2],
        ];
        cartMeshRef.current.group.position.set(cp[0], 0, cp[1]);
      }
      // restore all clue object beacons
      clueMeshesRef.current.forEach((o) => {
        if (o.beacon) o.beacon.visible = true;
        if (o.ring) {
          o.ring.visible = true;
          o.ring.material.opacity = 0.25;
        }
        if (o.light) o.light.intensity = 2;
      });
      // restore all trash object beacons
      trashMeshesRef.current.forEach((t) => {
        if (t.beacon) t.beacon.visible = true;
        if (t.ring) {
          t.ring.material.opacity = 0.2;
        }
        if (t.light) t.light.intensity = 2;
        if (t.warnDot) t.warnDot.visible = true;
      });
      prevStartedAtRef.current = newStarted;
    }
  }, [gameState?.startedAt]);

  /* ── Countdown timer ───────────────────────────────── */
  const timerRef = useRef(null);
  useEffect(() => {
    clearInterval(timerRef.current);
    if (gameComplete || gameOver || isPaused || gameState?.status !== "playing")
      return;
    timerRef.current = setInterval(() => {
      // Re-sync from server clock each tick, subtract accumulated personal penalty
      if (gameState?.startedAt) {
        const elapsed =
          Date.now() -
          new Date(gameState.startedAt).getTime() -
          (gameState?.totalPausedMs || 0);
        const remaining = Math.max(
          0,
          GAME_DURATION - Math.floor(elapsed / 1000) - timePenaltyRef.current,
        );
        setTimeLeft(remaining);
        if (remaining <= 0) {
          setGameOver(true);
        }
      } else {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameOver(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [
    gameComplete,
    gameOver,
    isPaused,
    gameState?.status,
    gameState?.startedAt,
    gameState?.totalPausedMs,
  ]);

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
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.03);
    sceneRef.current = scene;

    // ── Raycaster for mouse hover ─────────────────────
    const raycaster = new THREE.Raycaster();

    // ── Camera ────────────────────────────────────────
    const aspect =
      container.clientWidth && container.clientHeight
        ? container.clientWidth / container.clientHeight
        : 16 / 9;
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 80);
    camera.position.set(0, 6, 10);
    cameraRef.current = camera;

    // ── Renderer (setPixelRatio must come before setSize) ─────
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Lights ────────────────────────────────────────
    // Deep purple ambient — just enough to see the dungeon
    scene.add(new THREE.AmbientLight(0x0f0820, 0.95));

    // Weak cool directional — simulates a far moonbeam filtering in
    const dirLight = new THREE.DirectionalLight(0x5544aa, 0.28);
    dirLight.position.set(10, 20, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.left = -22;
    dirLight.shadow.camera.right = 22;
    dirLight.shadow.camera.top = 22;
    dirLight.shadow.camera.bottom = -22;
    scene.add(dirLight);

    // Hemisphere — dark sky, darker ground
    scene.add(new THREE.HemisphereLight(0x14103a, 0x06060f, 0.35));

    // Faint up-glow from the enchanted floor (spooky purple)
    const floorGlow = new THREE.PointLight(0x1a0a40, 0.7, 32);
    floorGlow.position.set(0, 0.4, 0);
    scene.add(floorGlow);

    // ── Ground — dark enchanted stone floor ──────────
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c1a,
      emissive: 0x060612,
      emissiveIntensity: 0.25,
      roughness: 0.98,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Coarse stone-slab grid (spacing ~2 m)
    const grid = new THREE.GridHelper(40, 20, 0x18182e, 0x101020);
    grid.position.y = 0.011;
    scene.add(grid);
    // Fine mortar joints between slabs
    const fineGrid = new THREE.GridHelper(40, 80, 0x0e0e1c, 0x0c0c1a);
    fineGrid.position.y = 0.013;
    scene.add(fineGrid);

    // Central arcane summoning circle on the floor
    const arcaneRing1 = new THREE.Mesh(
      new THREE.RingGeometry(3.1, 3.4, 36),
      new THREE.MeshBasicMaterial({
        color: 0x2a1a6e,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      }),
    );
    arcaneRing1.rotation.x = -Math.PI / 2;
    arcaneRing1.position.y = 0.015;
    scene.add(arcaneRing1);

    const arcaneRing2 = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 4.8, 36),
      new THREE.MeshBasicMaterial({
        color: 0x1e1060,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    arcaneRing2.rotation.x = -Math.PI / 2;
    arcaneRing2.position.y = 0.015;
    scene.add(arcaneRing2);

    // Inner glow disc
    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x120a38,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 0.014;
    scene.add(glowDisc);

    // ── Stars — varied-colour night sky ──────────────
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 220;
      starPositions[i * 3 + 1] = Math.random() * 65 + 20;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
      // White, faint-blue, or faint-purple tint
      const tint = Math.random();
      starColors[i * 3] = tint < 0.6 ? 1.0 : tint < 0.8 ? 0.72 : 0.85;
      starColors[i * 3 + 1] = tint < 0.6 ? 1.0 : tint < 0.8 ? 0.72 : 0.6;
      starColors[i * 3 + 2] = tint < 0.6 ? 1.0 : tint < 0.8 ? 1.0 : 1.0;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          vertexColors: true,
          size: 0.2,
          transparent: true,
          opacity: 0.82,
        }),
      ),
    );

    // ── Walls ─────────────────────────────────────────
    const wallBoxes = WALL_SEGMENTS.map((w) => ({ ...w }));
    wallBoxesRef.current = wallBoxes;
    const torchFlames = [];
    WALL_SEGMENTS.forEach((w) => {
      const wallMesh = buildWallMesh(w);
      scene.add(wallMesh);
      // Place torches on interior walls
      const isPerimeter = w.w >= 50 || w.d >= 50;
      if (!isPerimeter) {
        const isHorizontal = w.w > w.d;
        const len = isHorizontal ? w.w : w.d;
        const torchCount = Math.max(1, Math.floor(len / 12));
        for (let t = 0; t < Math.min(torchCount, 2); t++) {
          const frac = torchCount === 1 ? 0.5 : t / (torchCount - 1);
          let tx, tz;
          if (isHorizontal) {
            tx = w.x - len / 2 + frac * len;
            tz = w.z + (w.d / 2 + 0.15) * (t % 2 === 0 ? 1 : -1);
          } else {
            tx = w.x + (w.w / 2 + 0.15) * (t % 2 === 0 ? 1 : -1);
            tz = w.z - len / 2 + frac * len;
          }
          const torch = buildTorch(tx, w.h * 0.7, tz);
          scene.add(torch.group);
          torchFlames.push(torch);
        }
      }
    });
    torchFlamesRef.current = torchFlames;

    // ── Decorative stone columns at dungeon corners ───
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      emissive: 0x080810,
      emissiveIntensity: 0.2,
      roughness: 0.95,
      metalness: 0.04,
    });
    const colCapMat = new THREE.MeshStandardMaterial({
      color: 0x22223a,
      emissive: 0x0a0a1a,
      emissiveIntensity: 0.15,
      roughness: 0.9,
      metalness: 0.06,
    });
    [
      [-15, -15],
      [15, -15],
      [-15, 15],
      [15, 15],
    ].forEach(([cx, cz]) => {
      const colGroup = new THREE.Group();
      // Base plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.28, 0.82),
        colCapMat,
      );
      plinth.position.y = 0.14;
      colGroup.add(plinth);
      // Shaft
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.34, 3.5, 8),
        colMat,
      );
      shaft.position.y = 2.05;
      colGroup.add(shaft);
      // Capital flare
      const capital = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.27, 0.26, 8),
        colCapMat,
      );
      capital.position.y = 4.0;
      colGroup.add(capital);
      // Abacus slab
      const abacus = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.14, 0.92),
        colCapMat,
      );
      abacus.position.y = 4.2;
      colGroup.add(abacus);
      // Subtle emissive rune ring at mid-column
      const colRuneMat = new THREE.MeshBasicMaterial({
        color: 0x1e1040,
        transparent: true,
        opacity: 0.35,
      });
      const colRune = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.025, 4, 16),
        colRuneMat,
      );
      colRune.rotation.x = Math.PI / 2;
      colRune.position.y = 2.0;
      colGroup.add(colRune);
      colGroup.position.set(cx, 0, cz);
      scene.add(colGroup);
    });

    // ── Random position generation (seeded per room so all clients match) ────
    const rng = makePrng(hashStr(currentRoom?._id || "room0"));
    const occupied = [];

    // ── Per-stage actor AND cart spawn positions ──────────────────────
    // Generate both pairs together (actor then cart per stage) so they are well
    // separated from each other AND from all clue/trash objects placed afterward.
    const stageActorSpawns = [];
    const stageCartSpawns = [];
    STAGES.forEach((_, i) => {
      const fallbackActor = [0, (i - Math.floor(STAGES.length / 2)) * 4];
      const fallbackCart = [CART_POS[0], CART_POS[2] + i * 3];
      const actor =
        generateRandomPosSeeded(
          rng,
          occupied,
          wallBoxes,
          3.5,
          BOUNDARY - 2,
          5,
        ) ?? fallbackActor;
      occupied.push(actor);
      stageActorSpawns.push(actor);
      const cart =
        generateRandomPosSeeded(rng, occupied, wallBoxes, 4, BOUNDARY - 2, 5) ??
        fallbackCart;
      occupied.push(cart);
      stageCartSpawns.push(cart);
    });
    stageSpawnPositionsRef.current = stageActorSpawns;
    stageCartSpawnPositionsRef.current = stageCartSpawns;

    // ── Stickman (placed at stage 0 spawn) ──────────────────────
    const stickman = buildStickman();
    stickman.group.position.set(
      stageActorSpawns[0][0],
      0,
      stageActorSpawns[0][1],
    );
    scene.add(stickman.group);
    stickmanRef.current = stickman;

    // ── Clue objects (5 per stage × 5 stages = 25) ────
    const clueMeshes = [];
    STAGES.forEach((stage, stageIdx) => {
      stage.clues.forEach((clueData, clueIdx) => {
        const themedData = {
          ...clueData,
          pos: [0, 0, 0],
          color: stage.theme.color,
          emissive: stage.theme.emissive,
          beaconColor: stage.theme.beacon,
          labelColor: stage.theme.label,
        };
        const pos = generateRandomPosSeeded(
          rng,
          occupied,
          wallBoxes,
          4,
          BOUNDARY - 2,
          5,
        );
        if (!pos) return;
        occupied.push(pos);
        const obj = buildObjectMesh(themedData, clueIdx);
        obj.group.position.set(pos[0], 0, pos[1]);
        obj.group.visible = stageIdx === 0;
        scene.add(obj.group);
        clueMeshes.push({ ...obj, stage: stageIdx, clueIdx, data: clueData });
      });
    });
    clueMeshesRef.current = clueMeshes;

    // ── Answer Cart ───────────────────────────────────
    const cart = buildCartMesh();
    // Place at stage-0 random cart spawn (overrides the baked-in CART_POS)
    cart.group.position.set(stageCartSpawns[0][0], 0, stageCartSpawns[0][1]);
    scene.add(cart.group);
    cartMeshRef.current = cart;

    // ── Trash objects (3 per stage × 5 stages = 15) ───
    const trashMeshes = [];
    STAGES.forEach((stage, stageIdx) => {
      stage.trash.forEach((trashData, trashIdx) => {
        const themedData = {
          ...trashData,
          color: stage.theme.color,
          emissive: stage.theme.emissive,
          beaconColor: stage.theme.beacon,
          labelColor: stage.theme.label,
        };
        const pos = generateRandomPosSeeded(
          rng,
          occupied,
          wallBoxes,
          4,
          BOUNDARY - 2,
          5,
        );
        if (!pos) return;
        occupied.push(pos);
        const mesh = buildTrashMesh(themedData, trashIdx);
        mesh.group.position.set(pos[0], 0, pos[1]);
        mesh.group.visible = stageIdx === 0;
        scene.add(mesh.group);
        trashMeshes.push({
          ...mesh,
          stage: stageIdx,
          trashIdx,
          data: trashData,
        });
      });
    });
    trashMeshesRef.current = trashMeshes;

    // ── Restore saved progress (if reloading mid-game) ───────────
    if (_saved) {
      // Restore stickman position (fall back to the saved stage’s random spawn)
      const savedStageSpawn =
        stageActorSpawns[_saved.stage ?? 0] ?? stageActorSpawns[0];
      stickman.group.position.set(
        _saved.posX ?? savedStageSpawn[0],
        0,
        _saved.posZ ?? savedStageSpawn[1],
      );
      stickmanAngleRef.current = _saved.posAngle ?? 0;
      // Hide beacons for clues/trash already interacted in restored stage
      const rStage = _saved.stage ?? 0;
      const rClues = _saved.stageCluesFound ?? [];
      const rTrash = _saved.stageTrashTriggered ?? [];
      clueMeshes.forEach((o) => {
        if (o.stage === rStage && rClues.includes(o.clueIdx)) {
          if (o.beacon) o.beacon.visible = false;
          if (o.ring) o.ring.material.opacity = 0.08;
          if (o.light) o.light.intensity = 0.35;
        }
      });
      trashMeshes.forEach((t) => {
        if (t.stage === rStage && rTrash.includes(t.trashIdx)) {
          if (t.beacon) t.beacon.visible = false;
          if (t.ring) t.ring.material.opacity = 0.06;
          if (t.light) t.light.intensity = 0.2;
          if (t.warnDot) t.warnDot.visible = false;
        }
      });
    }

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
      const done = gameCompleteRef.current;
      const over = gameOverRef.current;
      const canMove = !paused && !modal && !done && !over;
      const curStage = currentStageRef.current;

      /* —— Slow / shake effect timers (only tick when canMove for slow) —— */
      if (canMove && slowTimeRef.current > 0) slowTimeRef.current -= delta;
      if (shakeTimeRef.current > 0) shakeTimeRef.current -= delta;
      const nowSlowed = slowTimeRef.current > 0;
      if (nowSlowed !== isSlowedRef.current) {
        isSlowedRef.current = nowSlowed;
        setIsSlowed(nowSlowed);
      }
      const effectiveSpeed = nowSlowed ? MOVE_SPEED * SLOW_FACTOR : MOVE_SPEED;

      /* —— Stage visibility —— */
      clueMeshes.forEach((o) => {
        o.group.visible = o.stage === curStage && curStage < TOTAL_STAGES;
      });
      trashMeshes.forEach((t) => {
        t.group.visible = t.stage === curStage && curStage < TOTAL_STAGES;
      });

      /* —— Movement —— */
      let isMoving = false;
      if (canMove) {
        // A/D rotate both the stickman and the camera yaw together
        if (keys["a"] || keys["arrowleft"]) {
          stickmanAngleRef.current += TURN_SPEED * delta;
          cameraYawTargetRef.current += TURN_SPEED * delta;
        }
        if (keys["d"] || keys["arrowright"]) {
          stickmanAngleRef.current -= TURN_SPEED * delta;
          cameraYawTargetRef.current -= TURN_SPEED * delta;
        }

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
          // Move relative to camera yaw so W always goes where camera faces
          dir
            .normalize()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYawRef.current);
          // Face the character in the movement direction
          stickmanAngleRef.current = Math.atan2(dir.x, dir.z) + Math.PI;
          stickman.group.position.addScaledVector(dir, effectiveSpeed * delta);
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
          resolveCollisions(stickman.group.position, wallBoxes, 0.4);
        }
      }
      stickman.group.rotation.y = stickmanAngleRef.current;

      /* —— Dash (Shift) — disabled during slow-mo —— */
      if (
        keys["shift"] &&
        !dashCoolRef.current &&
        canMove &&
        !isDashingRef.current &&
        !isSlowedRef.current
      ) {
        dashCoolRef.current = true;
        isDashingRef.current = true;
        dashTimerRef.current = DASH_DURATION;
        setIsDashing(true);
        setDashReady(false);
        setTimeout(() => {
          dashCoolRef.current = false;
          setDashReady(true);
        }, DASH_COOLDOWN * 1000);
      }
      if (isDashingRef.current) {
        dashTimerRef.current -= delta;
        if (dashTimerRef.current <= 0) {
          isDashingRef.current = false;
          setIsDashing(false);
        } else {
          const dashDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            cameraYawRef.current,
          );
          stickman.group.position.addScaledVector(dashDir, DASH_SPEED * delta);
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
          resolveCollisions(stickman.group.position, wallBoxes, 0.4);
          isMoving = true;
          // Push nearby other players
          const myX = stickman.group.position.x;
          const myZ = stickman.group.position.z;
          otherPlayersRef.current.forEach((data, otherId) => {
            if (data.pushed) return;
            const ox = data.targetPos.x;
            const oz = data.targetPos.z;
            const dist = Math.sqrt((myX - ox) ** 2 + (myZ - oz) ** 2);
            if (dist < PUSH_DIST) {
              data.pushed = true;
              const dx = ox - myX || 0.01;
              const dz = oz - myZ || 0.01;
              const len = Math.sqrt(dx * dx + dz * dz);
              const fx = (dx / len) * PUSH_FORCE;
              const fz = (dz / len) * PUSH_FORCE;
              fetch(`${API_URL}/api/rooms/${roomIdRef.current}/push`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  targetId: otherId,
                  forceX: fx,
                  forceZ: fz,
                }),
              }).catch(() => {});
            }
          });
        }
      } else {
        otherPlayersRef.current.forEach((data) => {
          data.pushed = false;
        });
      }

      /* —— Push velocity (received from other players) —— */
      if (pushVelocityRef.current.x !== 0 || pushVelocityRef.current.z !== 0) {
        stickman.group.position.x += pushVelocityRef.current.x * delta;
        stickman.group.position.z += pushVelocityRef.current.z * delta;
        pushVelocityRef.current.x *= Math.pow(0.04, delta);
        pushVelocityRef.current.z *= Math.pow(0.04, delta);
        if (Math.abs(pushVelocityRef.current.x) < 0.3)
          pushVelocityRef.current.x = 0;
        if (Math.abs(pushVelocityRef.current.z) < 0.3)
          pushVelocityRef.current.z = 0;
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
        resolveCollisions(stickman.group.position, wallBoxes, 0.4);
      }

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

      /* —— Jump (Space) —— */
      if (
        keys[" "] &&
        !jumpCoolRef.current &&
        canMove &&
        !isJumpingRef.current
      ) {
        jumpCoolRef.current = true;
        isJumpingRef.current = true;
        jumpTimerRef.current = 0;
        setIsJumping(true);
        setJumpReady(false);
        setTimeout(() => {
          jumpCoolRef.current = false;
          setJumpReady(true);
        }, JUMP_COOLDOWN * 1000);
      }
      if (isJumpingRef.current) {
        jumpTimerRef.current += delta;
        const t = jumpTimerRef.current / JUMP_DURATION;
        if (t >= 1) {
          isJumpingRef.current = false;
          stickman.group.position.y = 0;
          setIsJumping(false);
        } else {
          // parabolic arc
          stickman.group.position.y = JUMP_HEIGHT * 4 * t * (1 - t);
        }
      }

      /* —— Camera follow (mouse-drag orbit) —— */
      const CAM_DIST = 9.43; // sqrt(5² + 8²)
      // Smooth lerp actual yaw/pitch toward targets
      cameraYawRef.current +=
        (cameraYawTargetRef.current - cameraYawRef.current) *
        Math.min(1, 12 * delta);
      cameraPitchRef.current +=
        (cameraPitchTargetRef.current - cameraPitchRef.current) *
        Math.min(1, 12 * delta);
      const yaw = cameraYawRef.current;
      const pitch = cameraPitchRef.current;
      const camOff = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * CAM_DIST,
        Math.sin(pitch) * CAM_DIST,
        Math.cos(yaw) * Math.cos(pitch) * CAM_DIST,
      );
      camera.position.lerp(
        stickman.group.position.clone().add(camOff),
        8 * delta,
      );
      camera.lookAt(
        stickman.group.position.x,
        stickman.group.position.y + 1.5,
        stickman.group.position.z,
      );

      /* —— Camera shake from trash interaction —— */
      if (shakeTimeRef.current > 0) {
        const intensity = 0.15 * (shakeTimeRef.current / TRASH_SHAKE_DURATION);
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity * 0.5;
      }

      /* —— Proximity detection — clue objects —— */
      let nearestClue = null;
      let nearestClueDist = Infinity;
      const px = stickman.group.position.x;
      const pz = stickman.group.position.z;
      for (let i = 0; i < clueMeshes.length; i++) {
        if (clueMeshes[i].stage !== curStage || curStage >= TOTAL_STAGES)
          continue;
        if (stageCluesFoundRef.current.includes(clueMeshes[i].clueIdx))
          continue;
        const ox = clueMeshes[i].group.position.x;
        const oz = clueMeshes[i].group.position.z;
        const d = Math.sqrt((px - ox) ** 2 + (pz - oz) ** 2);
        if (d < INTERACT_DIST && d < nearestClueDist) {
          nearestClue = i;
          nearestClueDist = d;
        }
      }
      if (nearestClue !== nearClueRef.current) {
        nearClueRef.current = nearestClue;
        setNearClue(nearestClue);
      }

      /* —— Proximity detection — trash objects —— */
      let nearestTrash = null;
      let nearestTrashDist = Infinity;
      for (let i = 0; i < trashMeshes.length; i++) {
        if (trashMeshes[i].stage !== curStage || curStage >= TOTAL_STAGES)
          continue;
        if (stageTrashTriggeredRef.current.includes(trashMeshes[i].trashIdx))
          continue;
        const dx = px - trashMeshes[i].group.position.x;
        const dz = pz - trashMeshes[i].group.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < INTERACT_DIST && d < nearestTrashDist) {
          nearestTrash = i;
          nearestTrashDist = d;
        }
      }
      if (nearestTrash !== nearTrashRef.current) {
        nearTrashRef.current = nearestTrash;
        setNearTrash(nearestTrash);
      }

      /* —— Cart proximity —— */
      const curCartPos = stageCartSpawnPositionsRef.current[curStage] ??
        stageCartSpawnPositionsRef.current[0] ?? [CART_POS[0], CART_POS[2]];
      const cartDx = px - curCartPos[0];
      const cartDz = pz - curCartPos[1];
      const cartDist = Math.sqrt(cartDx * cartDx + cartDz * cartDz);
      const isNearCart = cartDist < CART_INTERACT_DIST;
      if (isNearCart !== nearCartRef.current) {
        nearCartRef.current = isNearCart;
        setNearCart(isNearCart);
      }

      /* —— E‑key interaction —— */
      if (keys["e"] && !interactCoolRef.current && canMove) {
        interactCoolRef.current = true;
        setTimeout(() => {
          interactCoolRef.current = false;
        }, 400);
        const stgClues = stageCluesFoundRef.current;
        const stgTrash = stageTrashTriggeredRef.current;
        // Answer cart: available when at least 1 clue in current stage found
        if (
          nearCartRef.current &&
          stgClues.length >= 1 &&
          currentStageRef.current < TOTAL_STAGES
        ) {
          setShowStageQuestion(true);
        }
        // Clue object interaction
        else if (nearClueRef.current !== null) {
          const entry = clueMeshes[nearClueRef.current];
          if (
            entry &&
            entry.stage === curStage &&
            !stgClues.includes(entry.clueIdx)
          ) {
            setShowClue(entry.clueIdx);
            setStageCluesFound((prev) => {
              const next = [...prev, entry.clueIdx];
              stageCluesFoundRef.current = next;
              return next;
            });
            if (entry.beacon) entry.beacon.visible = false;
            if (entry.ring) entry.ring.material.opacity = 0.08;
            if (entry.light) entry.light.intensity = 0.35;
          }
        }
        // Trash object interaction — heavier consequences
        else if (nearTrashRef.current !== null) {
          const entry = trashMeshes[nearTrashRef.current];
          if (
            entry &&
            entry.stage === curStage &&
            !stgTrash.includes(entry.trashIdx)
          ) {
            setShowTrash(entry.trashIdx);
            setStageTrashTriggered((prev) => {
              const next = [...prev, entry.trashIdx];
              stageTrashTriggeredRef.current = next;
              return next;
            });
            // Consequences: slow-mo + camera shake + stage-scaled time penalty
            const trashTimePenalty = STAGE_TRASH_TIME_PENALTY[curStage] ?? 5;
            timePenaltyRef.current += trashTimePenalty;
            setTimePenalty((prev) => prev + trashTimePenalty);
            setTimeLeft((prev) => Math.max(0, prev - trashTimePenalty));
            slowTimeRef.current = TRASH_SLOW_DURATION;
            shakeTimeRef.current = TRASH_SHAKE_DURATION;
            if (entry.beacon) entry.beacon.visible = false;
            if (entry.ring) entry.ring.material.opacity = 0.06;
            if (entry.light) entry.light.intensity = 0.2;
            if (entry.warnDot) entry.warnDot.visible = false;
          }
        }
      }

      /* —— Clue beacon pulse — smooth, slow (safe indicator) —— */
      clueMeshes.forEach((o, i) => {
        if (!o.group.visible) return;
        if (o.beacon && o.beacon.visible) {
          o.beacon.position.y = 2.5 + Math.sin(time * 1.5 + i * 1.3) * 0.2;
          o.beacon.material.opacity = 0.6 + Math.sin(time * 2 + i * 0.9) * 0.3;
        }
        // Rune ring: slow clockwise spin + gentle vertical bob
        if (o.runeRing) {
          o.runeRing.rotation.z += delta * (0.55 + (i % 3) * 0.1);
          o.runeRing.position.y = 0.72 + Math.sin(time * 1.1 + i * 0.8) * 0.18;
          o.runeRing.material.opacity =
            0.38 + Math.sin(time * 1.8 + i * 1.1) * 0.16;
        }
        if (o.mesh && o.clueIdx !== 4) {
          if (o.mesh.isMeshGroup) {
            // rotate the whole group
            o.mesh.rotation.y += delta * 0.28;
          } else {
            o.mesh.rotation.y += delta * 0.3;
          }
        }
      });

      /* —— Trash beacon pulse — fast, erratic + orbiting warning dot —— */
      trashMeshes.forEach((t, i) => {
        if (!t.group.visible) return;
        if (t.beacon && t.beacon.visible) {
          t.beacon.position.y =
            2.5 +
            Math.sin(time * 4.0 + i * 1.7) * 0.15 +
            Math.sin(time * 11 + i * 3.1) * 0.06;
          t.beacon.material.opacity = Math.max(
            0.1,
            0.5 + Math.sin(time * 5.5 + i * 1.2) * 0.45,
          );
        }
        if (t.mesh) t.mesh.rotation.y += delta * 0.3;
        // Orbiting red warning dot
        if (t.warnDot && t.warnDot.visible) {
          const orbitR = 0.8;
          const orbitSpd = 2.5 + Math.sin(i * 2.1) * 0.5;
          t.warnDot.position.x = Math.cos(time * orbitSpd + i * 1.5) * orbitR;
          t.warnDot.position.z = Math.sin(time * orbitSpd + i * 1.5) * orbitR;
          t.warnDot.position.y = 1.5 + Math.sin(time * 3.5 + i) * 0.2;
        }
      });

      // Cart beacon animation
      if (cart.beacon) {
        cart.beacon.position.y = 2.8 + Math.sin(time * 2.5) * 0.25;
        cart.beacon.material.emissiveIntensity =
          1.2 + Math.sin(time * 3.5) * 0.5;
      }

      // Torch flame flicker — cone + core + flare all animated
      torchFlames.forEach((t, i) => {
        const f1 = Math.sin(time * 9.2 + i * 2.7);
        const f2 = Math.sin(time * 14.5 + i * 1.3);
        const flicker = 0.82 + f1 * 0.13 + f2 * 0.05;
        // Outer flame cone: scale + sway
        t.flame.scale.set(
          flicker * (1 + Math.sin(time * 17 + i * 3.1) * 0.06),
          0.9 + f1 * 0.12,
          flicker * (1 + Math.cos(time * 15 + i * 2.4) * 0.06),
        );
        t.flame.material.opacity = 0.65 + f1 * 0.22;
        // Inner core: bright pulsing heart
        if (t.core) {
          t.core.scale.setScalar(0.88 + Math.sin(time * 11.5 + i * 1.8) * 0.14);
          t.core.material.opacity = 0.88 + Math.sin(time * 13 + i * 2.5) * 0.1;
        }
        // Outer flare halo: slow breathe
        if (t.flare) {
          t.flare.scale.setScalar(0.85 + Math.sin(time * 6 + i * 2.1) * 0.18);
          t.flare.material.opacity =
            0.2 + Math.sin(time * 8.5 + i * 1.9) * 0.12;
        }
        // Point light intensity
        t.light.intensity = 0.75 + f1 * 0.28 + f2 * 0.08;
      });

      /* —— Mouse hover raycasting —— */
      if (!showingModalRef.current) {
        const hoverTargets = [];
        const curSt = currentStageRef.current;
        clueMeshes.forEach((o) => {
          if (o.group.visible && o.stage === curSt && o.mesh)
            hoverTargets.push(o.mesh);
        });
        trashMeshes.forEach((t) => {
          if (t.group.visible && t.stage === curSt && t.mesh)
            hoverTargets.push(t.mesh);
        });
        raycaster.setFromCamera(mouseRef.current, camera);
        const intersects = raycaster.intersectObjects(hoverTargets, false);
        const hitMesh = intersects.length > 0 ? intersects[0].object : null;
        const prevMesh = hoveredObjectRef.current;
        if (hitMesh !== prevMesh) {
          // Restore previous
          if (prevMesh && prevMesh.material) {
            prevMesh.material.emissiveIntensity =
              prevMesh.userData._baseEmissive ??
              prevMesh.material.emissiveIntensity;
            prevMesh.scale.setScalar(1);
          }
          // Highlight new
          if (hitMesh && hitMesh.material) {
            hitMesh.userData._baseEmissive = hitMesh.material.emissiveIntensity;
            hitMesh.material.emissiveIntensity = Math.min(
              hitMesh.material.emissiveIntensity + 2.5,
              5,
            );
            hitMesh.scale.setScalar(1.13);
            renderer.domElement.style.cursor = "pointer";
          } else {
            renderer.domElement.style.cursor = "";
          }
          hoveredObjectRef.current = hitMesh;
        }
      }

      /* —— Interpolate other players —— */
      otherPlayersRef.current.forEach((data) => {
        const g = data.stickman.group;
        g.position.x = THREE.MathUtils.lerp(
          g.position.x,
          data.targetPos.x,
          8 * delta,
        );
        g.position.z = THREE.MathUtils.lerp(
          g.position.z,
          data.targetPos.z,
          8 * delta,
        );
        let angleDiff = data.targetPos.angle - g.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        g.rotation.y += angleDiff * 8 * delta;
        const dx = data.targetPos.x - g.position.x;
        const dz = data.targetPos.z - g.position.z;
        const moveDist = Math.sqrt(dx * dx + dz * dz);
        if (moveDist > 0.05) {
          data.walkCycle = (data.walkCycle || 0) + delta * 10;
          const s = Math.sin(data.walkCycle);
          data.stickman.leftLeg.rotation.x = s * 0.6;
          data.stickman.rightLeg.rotation.x = -s * 0.6;
          data.stickman.leftArm.rotation.x = -s * 0.5;
          data.stickman.rightArm.rotation.x = s * 0.5;
        } else {
          data.stickman.leftLeg.rotation.x *= 0.85;
          data.stickman.rightLeg.rotation.x *= 0.85;
          data.stickman.leftArm.rotation.x *= 0.85;
          data.stickman.rightArm.rotation.x *= 0.85;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    /* ── Input handlers ─────────────────────────────── */
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
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
          "shift",
        ].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
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

    /* ── Mouse orbit + hover handlers ──────────────────────── */
    const onMouseDown = (e) => {
      if (e.button === 0) {
        e.preventDefault();
        isDragRef.current = true;
        lastDragRef.current = { x: e.clientX, y: e.clientY };
        renderer.domElement.style.cursor = "grabbing";
      }
    };
    const onMouseUp = () => {
      isDragRef.current = false;
      renderer.domElement.style.cursor = "";
    };
    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      // Update hover NDC coords
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      // Drag-to-orbit
      if (isDragRef.current) {
        const dx = e.clientX - lastDragRef.current.x;
        const dy = e.clientY - lastDragRef.current.y;
        lastDragRef.current = { x: e.clientX, y: e.clientY };
        cameraYawTargetRef.current -= dx * 0.004;
        cameraPitchTargetRef.current = THREE.MathUtils.clamp(
          cameraPitchTargetRef.current + dy * 0.004,
          0.1, // ~6° — keeps camera above ground
          1.35, // ~77° — near top-down
        );
      }
    };
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseleave", () => {
      mouseRef.current.set(-9999, -9999);
      isDragRef.current = false;
      renderer.domElement.style.cursor = "";
    });
    window.addEventListener("mouseup", onMouseUp);

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
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
      if (contentEl) {
        contentEl.style.padding = "";
        contentEl.style.overflow = "";
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Multiplayer position sync ──────────────────────── */
  useEffect(() => {
    if (!currentPlayer?._id || !currentRoom?._id) return;
    if (gameState?.status !== "playing" && gameState?.status !== "paused")
      return;

    const myId = currentPlayer._id;
    const roomId = currentRoom._id;
    let colorIdx = 0;

    const sync = async () => {
      const pos = stickmanRef.current?.group?.position;
      if (!pos) return;
      try {
        const resp = await fetch(
          `${API_URL}/api/rooms/${roomId}/sync-position`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId: myId,
              x: Math.round(pos.x * 100) / 100,
              z: Math.round(pos.z * 100) / 100,
              angle: Math.round(stickmanAngleRef.current * 100) / 100,
              stage: currentStageRef.current,
              progress: {
                stage: currentStageRef.current + 1,
                totalStages: TOTAL_STAGES,
                cluesFound: stageCluesFoundRef.current?.length ?? 0,
                hasKey: hasKeyRef.current,
                solved: gameCompleteRef.current,
                score: accumulatedScoreRef.current,
                timeLeft: timeLeftRef.current,
              },
            }),
          },
        );
        const data = await resp.json();
        if (!data.success) return;

        // Apply pending push from another player
        if (data.pendingPush) {
          pushVelocityRef.current.x += data.pendingPush.fx;
          pushVelocityRef.current.z += data.pendingPush.fz;
        }

        // Update other player stickmen
        const scene = sceneRef.current;
        if (!scene) return;
        const others = (data.positions || []).filter(
          (p) => p.playerId !== myId,
        );
        const currentIds = new Set(others.map((p) => p.playerId));

        // Remove players who left
        for (const [id, d] of otherPlayersRef.current) {
          if (!currentIds.has(id)) {
            scene.remove(d.stickman.group);
            otherPlayersRef.current.delete(id);
          }
        }

        // Add new / update existing
        others.forEach((p) => {
          if (!otherPlayersRef.current.has(p.playerId)) {
            const color = PLAYER_COLORS[colorIdx++ % PLAYER_COLORS.length];
            const sm = buildStickman(color);
            sm.group.position.set(p.x, 0, p.z);
            sm.group.rotation.y = p.angle;
            const label = createTextSprite(p.name || "???", "#ffffff");
            label.position.y = 2.5;
            sm.group.add(label);
            scene.add(sm.group);
            otherPlayersRef.current.set(p.playerId, {
              stickman: sm,
              targetPos: { x: p.x, z: p.z, angle: p.angle },
              walkCycle: 0,
              pushed: false,
            });
          } else {
            otherPlayersRef.current.get(p.playerId).targetPos = {
              x: p.x,
              z: p.z,
              angle: p.angle,
            };
          }
        });
      } catch (e) {
        /* ignore network errors */
      }
    };

    syncIntervalRef.current = setInterval(sync, POSITION_SYNC_MS);
    sync();

    return () => {
      clearInterval(syncIntervalRef.current);
      const scene = sceneRef.current;
      if (scene) {
        otherPlayersRef.current.forEach((d) => scene.remove(d.stickman.group));
      }
      otherPlayersRef.current.clear();
    };
  }, [currentPlayer?._id, currentRoom?._id, gameState?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Stage answer submission (local check per stage) ─ */
  const handleStageAnswer = async (e) => {
    e.preventDefault();
    setError("");
    if (!stageAnswer.trim()) {
      setError("Please type an answer.");
      return;
    }
    if (isPaused) {
      setError("Game is paused — wait for the host to resume.");
      return;
    }

    const stg = STAGES[currentStage];
    const correct =
      stageAnswer.trim().toLowerCase() === stg.answer.toLowerCase();

    if (!correct) {
      const wrongTimePenalty = STAGE_WRONG_TIME_PENALTY[currentStage] ?? 15;
      timePenaltyRef.current += wrongTimePenalty;
      setTimePenalty((prev) => prev + wrongTimePenalty);
      setTimeLeft((prev) => Math.max(0, prev - wrongTimePenalty));
      setStageWrongAttempts((p) => p + 1);
      setStageAnswer("");
      setError(
        `That's not correct — think again! (−${wrongTimePenalty}s time penalty)`,
      );
      return;
    }

    /* ── Correct! Compute stage score ── */
    const stageMaxScore = STAGE_MAX_SCORES[currentStage] || 1000;
    const timeSpent = stageStartTimeRef.current - timeLeft;
    const trashHit = stageTrashTriggered.length;

    // Penalty calculations (percentage-based for balance across difficulty tiers)
    const timePenalty = Math.floor(timeSpent / 5); // 1 point per 5 seconds
    const trashPenalty = Math.floor(trashHit * (stageMaxScore * 0.1)); // 10% of max per trash
    const wrongPenalty = Math.floor(
      stageWrongAttempts * (stageMaxScore * 0.15),
    ); // 15% of max per wrong

    const score = Math.max(
      0,
      stageMaxScore - timePenalty - trashPenalty - wrongPenalty,
    );
    const summary = {
      stage: currentStage,
      name: stg.name,
      score,
      timeSpent,
      trashTriggered: trashHit,
      wrongAttempts: stageWrongAttempts,
    };
    setStageScores((prev) => [...prev, summary]);
    accumulatedScoreRef.current += score;
    setShowStageQuestion(false);
    setStageAnswer("");
    setError("");
    setStageWrongAttempts(0);

    if (currentStage < TOTAL_STAGES - 1) {
      // Grant the player a key — they must find the door to proceed
      setHasKey(true);
      hasKeyRef.current = true;
      setShowKeyObtained(true);
      setShowStageQuestion(false);
      setStageAnswer("");
      setError("");
      setStageWrongAttempts(0);
      // Store the summary so we show it after they use the key
      setShowStageSummary(summary);
    } else {
      /* ── Final stage — submit to server ── */
      const totalScore = [...stageScores, summary].reduce(
        (s, x) => s + x.score,
        0,
      );
      const result = await submitAnswer(stg.answer.trim(), {
        timeLeft,
        stageScores: [...stageScores, summary],
        totalScore,
      });
      if (result.success && result.isCorrect) {
        setFinalScore(result.score != null ? result.score : totalScore);
      } else {
        setFinalScore(totalScore);
      }
      setGameComplete(true);
      gameCompleteRef.current = true;
      setShowStageSummary(summary);
    }
  };

  /* ── Format helpers ────────────────────────────────── */
  const fmt = (s) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  /* =======================================================
     JSX
     ======================================================= */
  const stg = STAGES[Math.min(currentStage, TOTAL_STAGES - 1)];
  const anyModal =
    showClue !== null ||
    showTrash !== null ||
    showStageQuestion ||
    showStageSummary !== null ||
    showStoryline ||
    showKeyObtained ||
    gameComplete ||
    gameOver;

  return (
    <div className="sm-game">
      <div ref={containerRef} className="sm-canvas" />

      <GameHUD
        timeLeft={timeLeft}
        fmt={fmt}
        stageCluesFound={stageCluesFound}
        stg={stg}
        currentStage={currentStage}
        isDashing={isDashing}
        dashReady={dashReady}
        isJumping={isJumping}
        jumpReady={jumpReady}
        hasKey={hasKey}
        isSlowed={isSlowed}
        anyModal={anyModal}
        nearClue={nearClue}
        nearTrash={nearTrash}
        stageTrashTriggered={stageTrashTriggered}
        nearCart={nearCart}
        showStageQuestion={showStageQuestion}
        cartAnswerBlocked={cartAnswerBlocked}
        isPaused={isPaused}
        setShowStageQuestion={setShowStageQuestion}
      />

      <GameModals
        showStoryline={showStoryline}
        showKeyObtained={showKeyObtained}
        showClue={showClue}
        showTrash={showTrash}
        showStageQuestion={showStageQuestion}
        showStageSummary={showStageSummary}
        gameComplete={gameComplete}
        showFinalSummary={showFinalSummary}
        showDashboard={showDashboard}
        gameOver={gameOver}
        isPaused={isPaused}
        stg={stg}
        STAGES={STAGES}
        currentStage={currentStage}
        stageCluesFound={stageCluesFound}
        stageTrashTriggered={stageTrashTriggered}
        stageAnswer={stageAnswer}
        stageWrongAttempts={stageWrongAttempts}
        error={error}
        finalScore={finalScore}
        stageScores={stageScores}
        timeLeft={timeLeft}
        hasKey={hasKey}
        cartAnswerBlocked={cartAnswerBlocked}
        fmt={fmt}
        players={players}
        currentPlayer={currentPlayer}
        gameState={gameState}
        setShowStoryline={setShowStoryline}
        setShowKeyObtained={setShowKeyObtained}
        setShowClue={setShowClue}
        setShowTrash={setShowTrash}
        setShowStageQuestion={setShowStageQuestion}
        setShowStageSummary={setShowStageSummary}
        setShowFinalSummary={setShowFinalSummary}
        setShowDashboard={setShowDashboard}
        setStageAnswer={setStageAnswer}
        setStageWrongAttempts={setStageWrongAttempts}
        setError={setError}
        setStageCluesFound={setStageCluesFound}
        setStageTrashTriggered={setStageTrashTriggered}
        setHasKey={setHasKey}
        setCurrentStage={setCurrentStage}
        setCartAnswerBlocked={setCartAnswerBlocked}
        keysRef={keysRef}
        interactCoolRef={interactCoolRef}
        stickmanRef={stickmanRef}
        stickmanAngleRef={stickmanAngleRef}
        currentStageRef={currentStageRef}
        stageStartTimeRef={stageStartTimeRef}
        hasKeyRef={hasKeyRef}
        stageCluesFoundRef={stageCluesFoundRef}
        stageTrashTriggeredRef={stageTrashTriggeredRef}
        stageSpawnPositionsRef={stageSpawnPositionsRef}
        stageCartSpawnPositionsRef={stageCartSpawnPositionsRef}
        cartMeshRef={cartMeshRef}
        handleStageAnswer={handleStageAnswer}
      />

      {/* In-game player cards (bottom-right) */}
      {!anyModal && !gameComplete && !gameOver && players.length > 1 && (
        <div className="sm-players-panel">
          <div className="sm-players-panel-title">Players</div>
          {players.map((p) => (
            <div
              key={p._id}
              className={`sm-player-row${p._id === currentPlayer?._id ? " sm-player-me" : ""}`}
            >
              <span className="sm-player-name">
                {p._id === currentPlayer?._id ? "\uD83D\uDE4B" : "\uD83D\uDC64"}{" "}
                {p.name}
              </span>
              <span className="sm-player-stage">
                {`Stage ${p.progress?.stage ?? "?"}/${p.progress?.totalStages ?? "?"}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StickmanMysteryGame;
