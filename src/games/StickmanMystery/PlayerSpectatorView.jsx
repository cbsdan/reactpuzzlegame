import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DEFAULT_STAGES } from "./StickmanMysteryGame";
import { WALL_SEGMENTS, BOUNDARY, CART_POS } from "./constants";
import { makePrng, hashStr, generateRandomPosSeeded } from "./gameUtils";

const STICKMAN_STORAGE_KEY = "stickman_custom_config";
const THEME_FOR_STAGE = [
  { color: 0x00e5ff, emissive: 0x006b80, beacon: 0x00e5ff, label: "#00e5ff" },
  { color: 0xbb86fc, emissive: 0x5d4380, beacon: 0xbb86fc, label: "#bb86fc" },
  { color: 0xff7043, emissive: 0x802020, beacon: 0xff7043, label: "#ff7043" },
  { color: 0x448aff, emissive: 0x1a3680, beacon: 0x448aff, label: "#448aff" },
  { color: 0x69f0ae, emissive: 0x1a5c35, beacon: 0x69f0ae, label: "#69f0ae" },
  { color: 0xffab00, emissive: 0x805500, beacon: 0xffab00, label: "#ffab00" },
  { color: 0x00e676, emissive: 0x00733b, beacon: 0x00e676, label: "#00e676" },
];

function loadActiveStagesLocal() {
  try {
    const saved = localStorage.getItem(STICKMAN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.stages?.length > 0) {
        return parsed.stages.map((s, i) => ({
          ...s,
          theme: s.theme || THEME_FOR_STAGE[i] || THEME_FOR_STAGE[0],
        }));
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_STAGES;
}

/* ── Same camera constants as the game ─────────────── */
const CAM_DIST    = 9.43;            // sqrt(5²+8²) — exact game value
const CAM_PITCH   = Math.atan2(5, 8); // ≈0.559 rad — default game pitch

const PLAYER_COLORS = [
  0x00ffd0, // watched player — same teal as default game stickman
  0xff6b6b, 0x48dbfb, 0xfeca57, 0xff9ff3,
  0x54a0ff, 0x5f27cd, 0x01a3a4, 0xf368e0,
];



/* ── Scene builder helpers ───────────────────────────── */

function makeFloorTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#111828";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#1a2540"; ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(256,i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10,10);
  return t;
}

/** Build a stickman — same geometry as the game's buildStickman() */
function buildStickman(color) {
  const group = new THREE.Group();
  const emissive = new THREE.Color(color).multiplyScalar(0.4);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.5, metalness: 0.2 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
  head.position.y = 1.9; group.add(head);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), mat);
  body.position.y = 1.25; group.add(body);

  const makeArm = () => {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5);
    g.translate(0, -0.3, 0);
    return new THREE.Mesh(g, mat);
  };
  const lArm = makeArm(); lArm.position.set(-0.2, 1.6, 0); group.add(lArm);
  const rArm = makeArm(); rArm.position.set( 0.2, 1.6, 0); group.add(rArm);

  const makeLeg = () => {
    const g = new THREE.CylinderGeometry(0.045, 0.045, 0.75, 5);
    g.translate(0, -0.375, 0);
    return new THREE.Mesh(g, mat);
  };
  const lLeg = makeLeg(); lLeg.position.set(-0.12, 0.85, 0); group.add(lLeg);
  const rLeg = makeLeg(); rLeg.position.set( 0.12, 0.85, 0); group.add(rLeg);

  return group;
}

/** Billboard name label sprite */
function makeLabel(text, colorHex) {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 72;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(4,4,312,64,8); else ctx.rect(4,4,312,64);
  ctx.fill();
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#" + colorHex.toString(16).padStart(6,"0");
  ctx.fillText(text, 160, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(3.2, 0.72, 1);
  return sp;
}

/* ─────────────────────────────────────────────────────
   PlayerSpectatorView
   Replicates the exact third-person camera the player uses.
   The watched player's own stickman is rendered in-scene.
   Only players on the same stage are shown.
───────────────────────────────────────────────────── */
const PlayerSpectatorView = ({ watchedPlayer, allPlayers, stages, roomId }) => {
  const containerRef = useRef(null);
  const watchedRef   = useRef(watchedPlayer);
  const allRef       = useRef(allPlayers);
  const stagesRef    = useRef(stages || loadActiveStagesLocal());
  const roomIdRef    = useRef(roomId);

  useEffect(() => { watchedRef.current = watchedPlayer; }, [watchedPlayer]);
  useEffect(() => { allRef.current    = allPlayers;    }, [allPlayers]);
  useEffect(() => { stagesRef.current = stages?.length > 0 ? stages : loadActiveStagesLocal(); }, [stages]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ── Renderer ─────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x0a0a1e);
    container.appendChild(renderer.domElement);

    /* ── Scene ────────────────────────────────────────── */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1e, 0.042);

    /* ── Lighting — same as game ──────────────────────── */
    scene.add(new THREE.AmbientLight(0x334466, 1.5));
    const sun = new THREE.DirectionalLight(0x6699cc, 0.6);
    sun.position.set(8, 18, 8);
    scene.add(sun);

    /* ── Floor ────────────────────────────────────────── */
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: makeFloorTex(), roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    /* ── Ceiling ──────────────────────────────────────── */
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x080c18, roughness: 1 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 5.2;
    scene.add(ceil);

    /* ── Walls — same style as game's buildWallMesh() ─── */
    WALL_SEGMENTS.forEach((w) => {
      const isPerimeter = w.w >= 36 || w.d >= 36;
      const mat = new THREE.MeshStandardMaterial({
        color: isPerimeter ? 0xb0b0b8 : 0xd0d0d8,
        roughness: 0.82, metalness: 0.08,
      });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
      wall.position.set(w.x, w.h / 2, w.z);
      scene.add(wall);
      // Cap
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.1, 0.12, w.d + 0.1),
        new THREE.MeshStandardMaterial({ color: isPerimeter ? 0xc8c8d0 : 0xe8e8f0, roughness: 0.75 }),
      );
      cap.position.set(w.x, w.h + 0.06, w.z);
      scene.add(cap);
    });

    /* ── Seeded position pre-computation (mirrors game's build sequence) ── */
    const activeStagesSnap = stagesRef.current;
    const wallBoxes = WALL_SEGMENTS.map((w) => ({ ...w }));
    const rng = makePrng(hashStr(roomIdRef.current || "room0"));
    const occupied = [];

    // 1. Per-stage actor + cart spawns (must occur before clue/trash to match RNG order)
    const stageCartPositions = [];
    activeStagesSnap.forEach((_, si) => {
      const fallbackActor = [0, (si - Math.floor(activeStagesSnap.length / 2)) * 4];
      const fallbackCart  = [CART_POS[0], CART_POS[2]];
      const actor = generateRandomPosSeeded(rng, occupied, wallBoxes, 3.5, BOUNDARY - 2, 5) ?? fallbackActor;
      occupied.push(actor);
      const cart  = generateRandomPosSeeded(rng, occupied, wallBoxes, 4,   BOUNDARY - 2, 5) ?? fallbackCart;
      occupied.push(cart);
      stageCartPositions.push(cart);
    });

    // 2. Clue positions (all stages × all clues, in stage order)
    const allCluePositions = activeStagesSnap.map((stage) =>
      (stage.clues ?? []).map(() => {
        const pos = generateRandomPosSeeded(rng, occupied, wallBoxes, 4, BOUNDARY - 2, 5) ?? [0, 0];
        occupied.push(pos);
        return pos;
      })
    );

    // 3. Trash positions (all stages × all trash, after all clues — same as game)
    // Uses same relaxed params as game (minDist=2.5, avoidCenter=0) to keep sequences in sync.
    const allTrashPositions = activeStagesSnap.map((stage) =>
      (stage.trash ?? []).map(() => {
        const pos = generateRandomPosSeeded(rng, occupied, wallBoxes, 2.5, BOUNDARY - 2, 0) ?? [0, 0];
        occupied.push(pos);
        return pos;
      })
    );

    /* ── Answer Cart — same as game's buildCartMesh() ─── */
    const cartGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, emissive: 0x4a3a0a, emissiveIntensity: 0.3, roughness: 0.65 });
    const cartBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.1), bodyMat);
    cartBody.position.y = 0.75; cartGroup.add(cartBody);
    const scroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.7, 7),
      new THREE.MeshStandardMaterial({ color: 0xf5deb3, emissive: 0xdaa520, emissiveIntensity: 0.6 }),
    );
    scroll.position.y = 1.35; scroll.rotation.z = Math.PI / 2; cartGroup.add(scroll);
    const cartBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xff6b35, emissive: 0xff6b35, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 }),
    );
    cartBeacon.position.y = 2.8; cartGroup.add(cartBeacon);
    const cartLight = new THREE.PointLight(0xff6b35, 2.5, 14);
    cartLight.position.y = 2.2; cartGroup.add(cartLight);
    // Cart label
    const cartLabelSprite = makeLabel("Answer Cart", 0xff6b35);
    cartLabelSprite.scale.set(4, 0.9, 1);
    cartLabelSprite.position.y = 3.5; cartGroup.add(cartLabelSprite);
    const stage0CartPos = stageCartPositions[0] ?? [CART_POS[0], CART_POS[2]];
    cartGroup.position.set(stage0CartPos[0], 0, stage0CartPos[1]);
    scene.add(cartGroup);

    /* ── Stage objects (clues + trash) — rebuilt when watched stage changes ── */
    let lastStage = -1;
    let stageObjs = [];

    function buildStageObjects(stageDef, stageIdx) {
      const objs = [];
      const cluePos  = allCluePositions[stageIdx]  ?? [];
      const trashPos = allTrashPositions[stageIdx] ?? [];
      (stageDef.clues ?? []).forEach((clue, i) => {
        const [gx, gz] = cluePos[i] ?? [0, 0];
        const group = new THREE.Group();
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.38, 0),
          new THREE.MeshStandardMaterial({ color: 0x00c9a7, emissive: 0x004433, transparent: true, opacity: 0.85 }),
        );
        gem.position.y = 0.55;
        group.add(gem);
        const gLight = new THREE.PointLight(0x00c9a7, 0.45, 3.5);
        gLight.position.y = 1.2;
        group.add(gLight);
        const lbl = makeLabel(`📦 ${clue.name}`, 0x00ffd0);
        lbl.position.y = 1.75;
        group.add(lbl);
        group.position.set(gx, 0, gz);
        group.userData.isClue = true;
        scene.add(group);
        objs.push(group);
      });
      (stageDef.trash ?? []).forEach((trash, i) => {
        const [gx, gz] = trashPos[i] ?? [0, 0];
        const group = new THREE.Group();
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.45, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.9 }),
        );
        box.position.y = 0.5;
        group.add(box);
        const lbl = makeLabel(`🗑 ${trash.name}`, 0x8899aa);
        lbl.position.y = 1.3;
        group.add(lbl);
        group.position.set(gx, 0, gz);
        scene.add(group);
        objs.push(group);
      });
      return objs;
    }

    /* ── Camera ───────────────────────────────────────── */
    const camera = new THREE.PerspectiveCamera(
      72, container.clientWidth / container.clientHeight, 0.1, 60,
    );

    /* ─────────────────────────────────────────────────────
       PLAYER STICKMEN
       stickmenMap: _id → { group, label, color, lastName, isWatched }
       The watched player gets their own dedicated group (watchedGroup)
       so it's always in the scene regardless of map churn.
    ───────────────────────────────────────────────────── */
    const stickmenMap = new Map();  // other players
    const colorOrder  = [];

    function colorFor(pid) {
      let i = colorOrder.indexOf(pid);
      if (i === -1) { i = colorOrder.length; colorOrder.push(pid); }
      // offset by 1 so index 0 (0x00ffd0) is reserved for watched player
      return PLAYER_COLORS[1 + (i % (PLAYER_COLORS.length - 1))];
    }

    // Watched player's own stickman — always in scene
    const watchedGroup = buildStickman(PLAYER_COLORS[0]); // teal
    scene.add(watchedGroup);
    let watchedLabel = null;
    let watchedLabelName = null;

    function ensureOther(p) {
      if (stickmenMap.has(p._id)) return stickmenMap.get(p._id);
      const color = colorFor(p._id);
      const group = buildStickman(color);
      scene.add(group);
      const entry = { group, label: null, color, lastName: null };
      stickmenMap.set(p._id, entry);
      return entry;
    }

    /* ── Resize ───────────────────────────────────────── */
    const ro = new ResizeObserver(() => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    /* ── Animation loop ───────────────────────────────── */
    const clock = new THREE.Clock();
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.05);
      void delta; // not used but keeps the clock ticking

      /* Cart glow */
      cartLight.intensity = 2.3 + Math.sin(time * 2.5) * 0.5;
      cartBeacon.material.opacity = 0.75 + Math.sin(time * 3) * 0.2;

      /* ── Watched player: position + camera ─────────── */
      const wp  = watchedRef.current;

      /* Rebuild stage objects and move cart when watched player advances a stage */
      {
        const newStage = wp?.progress?.stage ?? 1;
        if (newStage !== lastStage) {
          lastStage = newStage;
          // Move cart to this stage's computed position
          const stageIdx = (newStage - 1) % activeStagesSnap.length;
          const cartPos = stageCartPositions[stageIdx] ?? stage0CartPos;
          cartGroup.position.set(cartPos[0], 0, cartPos[1]);
          // Rebuild clue/trash objects
          stageObjs.forEach((g) => scene.remove(g));
          stageObjs = [];
          const def = activeStagesSnap[stageIdx] ?? DEFAULT_STAGES[stageIdx];
          if (def) stageObjs = buildStageObjects(def, stageIdx);
        }
      }
      /* Animate clue gems (spin + float) */
      stageObjs.forEach((group) => {
        if (group.userData.isClue) {
          const gem = group.children[0];
          if (gem?.isMesh) {
            gem.rotation.y = time * 1.5 + group.id * 0.9;
            gem.position.y = 0.42 + Math.sin(time * 2 + group.id) * 0.14;
          }
        }
      });
      const all = allRef.current ?? [];

      if (wp && wp.posX != null) {
        const px    = wp.posX ?? 0;
        const pz    = wp.posZ ?? 0;
        const angle = wp.posAngle ?? 0;  // ≈ cameraYaw in the real game

        /* Place watched stickman */
        watchedGroup.position.set(px, 0, pz);
        watchedGroup.rotation.y = angle;

        /* Refresh watched label */
        const nm = wp.name ?? "";
        if (watchedLabelName !== nm) {
          if (watchedLabel) watchedGroup.remove(watchedLabel);
          watchedLabel = makeLabel(`👁 ${nm}`, PLAYER_COLORS[0]);
          watchedLabel.scale.set(3.8, 0.86, 1);
          watchedLabel.position.y = 2.85;
          watchedGroup.add(watchedLabel);
          watchedLabelName = nm;
        }

        /*
         * Camera orbit — exact replica of the game formula:
         *   yaw   = stickmanAngle (cameraYaw tracks movement direction)
         *   pitch = atan2(5,8)  (fixed default — no pitch info in sync)
         *   offset = (sin(yaw)*cos(pitch)*CAM_DIST,
         *             sin(pitch)*CAM_DIST,
         *             cos(yaw)*cos(pitch)*CAM_DIST)
         *   camera = playerPos + offset
         *   lookAt = playerPos + (0, 1.5, 0)
         */
        const yaw   = angle;
        const cosPitch = Math.cos(CAM_PITCH);
        const camOff = new THREE.Vector3(
          Math.sin(yaw) * cosPitch * CAM_DIST,
          Math.sin(CAM_PITCH) * CAM_DIST,
          Math.cos(yaw) * cosPitch * CAM_DIST,
        );
        camera.position.set(px + camOff.x, camOff.y, pz + camOff.z);
        camera.lookAt(px, 1.5, pz);
      }

      /* ── Same-stage other players ────────────────────── */
      const watchedStage = wp?.progress?.stage ?? null;
      const sameStage = all.filter(
        (p) =>
          p._id !== wp?._id &&
          p.posX != null &&
          (watchedStage == null || (p.progress?.stage ?? null) === watchedStage),
      );
      const liveIds = new Set(sameStage.map((p) => p._id));

      for (const [pid, entry] of stickmenMap) {
        if (!liveIds.has(pid)) {
          scene.remove(entry.group);
          stickmenMap.delete(pid);
        }
      }

      sameStage.forEach((p) => {
        const entry = ensureOther(p);
        entry.group.position.set(p.posX, 0, p.posZ ?? 0);
        entry.group.rotation.y = p.posAngle ?? 0;
        const nm = p.name ?? "";
        if (entry.lastName !== nm) {
          if (entry.label) entry.group.remove(entry.label);
          const sp = makeLabel(nm, entry.color);
          sp.position.y = 2.85;
          entry.group.add(sp);
          entry.label = sp;
          entry.lastName = nm;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    /* ── Cleanup ──────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      scene.remove(watchedGroup);
      stageObjs.forEach((g) => scene.remove(g));
      for (const e of stickmenMap.values()) scene.remove(e.group);
      stickmenMap.clear();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── React HUD overlay ───────────────────────────────── */
  const wp  = watchedPlayer;
  const stg = wp?.progress?.stage       ?? "?";
  const tot = wp?.progress?.totalStages ?? 5;
  const clf = wp?.progress?.cluesFound  ?? 0;
  const scr = wp?.score ?? wp?.progress?.score ?? 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Top-left HUD */}
      <div style={{
        position: "absolute", top: 10, left: 12,
        display: "flex", flexDirection: "column", gap: 6,
        pointerEvents: "none",
      }}>
        <div style={{
          background: "rgba(0,0,0,0.72)", borderRadius: 8,
          padding: "5px 14px", color: "#00ffd0",
          fontFamily: "monospace", fontSize: 13, fontWeight: "bold",
          border: "1px solid rgba(0,255,208,0.35)",
        }}>
          👁 {wp?.name ?? "—"}
        </div>
        <div style={{
          background: "rgba(0,0,0,0.68)", borderRadius: 8,
          padding: "6px 14px", color: "#e2e8f0",
          fontFamily: "monospace", fontSize: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <span>🗺 Stage <b style={{ color: "#fbbf24" }}>{stg}</b> / {tot}</span>
          <span>🔍 Clues: <b style={{ color: "#60a5fa" }}>{clf}</b></span>
          <span>🏆 Score: <b style={{ color: "#34d399" }}>{scr}</b></span>
          {wp?.progress?.hasKey  && <span>🔑 <b style={{ color: "#fcd34d" }}>Carries Key</b></span>}
          {wp?.progress?.solved  && <span>✅ <b style={{ color: "#4ade80" }}>Solved!</b></span>}
        </div>
      </div>

      {/* Top-right stage notice */}
      <div style={{
        position: "absolute", top: 10, right: 12,
        background: "rgba(0,0,0,0.60)", borderRadius: 8,
        padding: "5px 10px", color: "#94a3b8",
        fontFamily: "monospace", fontSize: 11,
        border: "1px solid rgba(255,255,255,0.10)",
        pointerEvents: "none",
      }}>
        Stage {stg} — peers only
      </div>
    </div>
  );
};

export default PlayerSpectatorView;
