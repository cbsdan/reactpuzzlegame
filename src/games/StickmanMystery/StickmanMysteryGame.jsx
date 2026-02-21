import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../context/GameContext";
import "./StickmanMysteryGame.css";

const API_URL = import.meta.env.VITE_API_URL || "";

/* ── Constants ──────────────────────────────────────── */
const GAME_DURATION = 300; // 5 min countdown
const TIME_PENALTY = 30; // seconds lost per clue
const INTERACT_DIST = 3.5;
const MOVE_SPEED = 8;
const TURN_SPEED = 3;
const BOUNDARY = 28;
const CART_POS = [0, 0, -15];
const CART_INTERACT_DIST = 4;
const DASH_SPEED = 22;
const DASH_DURATION = 0.25; // seconds
const DASH_COOLDOWN = 2; // seconds
const PUSH_DIST = 2;
const PUSH_FORCE = 18;
const POSITION_SYNC_MS = 150;

const PLAYER_COLORS = [
  0xff6b6b, 0x48dbfb, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x01a3a4,
  0xf368e0,
];

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

/* ── Wall layout ────────────────────────────────────── */
const WALL_SEGMENTS = [
  // Perimeter walls
  { x: 0, z: -29, w: 60, d: 2, h: 3.5 },
  { x: 0, z: 29, w: 60, d: 2, h: 3.5 },
  { x: -29, z: 0, w: 2, d: 60, h: 3.5 },
  { x: 29, z: 0, w: 2, d: 60, h: 3.5 },
  // Interior walls — corridors & nooks
  { x: -10, z: -8, w: 12, d: 0.6, h: 2.8 },
  { x: 8, z: 3, w: 0.6, d: 14, h: 2.8 },
  { x: -5, z: 16, w: 10, d: 0.6, h: 2.8 },
  { x: 18, z: -10, w: 0.6, d: 10, h: 2.8 },
  { x: -20, z: -16, w: 8, d: 0.6, h: 2.8 },
  { x: 5, z: -22, w: 0.6, d: 6, h: 2.8 },
  { x: -16, z: 8, w: 0.6, d: 10, h: 2.8 },
  { x: 22, z: 20, w: 8, d: 0.6, h: 2.8 },
  { x: -24, z: 22, w: 0.6, d: 6, h: 2.8 },
  { x: 14, z: -18, w: 6, d: 0.6, h: 2.8 },
];

/* ── Decorative (non-clue) object catalogue ─────────── */
const DECOR_TYPES = [
  { name: "Barrel", color: 0x8b5e3c, emissive: 0x3d2a1a, shape: "barrel", radius: 0.5 },
  { name: "Wooden Crate", color: 0x9e7b4f, emissive: 0x4a3820, shape: "crate", radius: 0.55 },
  { name: "Boulder", color: 0x5a5a6e, emissive: 0x2a2a33, shape: "rock", radius: 0.6 },
  { name: "Mushroom", color: 0xe74c3c, emissive: 0x722626, shape: "mushroom", radius: 0.3 },
  { name: "Dead Stump", color: 0x5c4033, emissive: 0x2e201a, shape: "stump", radius: 0.5 },
  { name: "Broken Pillar", color: 0x6b6b80, emissive: 0x34343f, shape: "brokenPillar", radius: 0.45 },
  { name: "Old Pot", color: 0x8b7355, emissive: 0x453928, shape: "pot", radius: 0.4 },
  { name: "Tombstone", color: 0x7f8c8d, emissive: 0x3e4445, shape: "tombstone", radius: 0.5 },
  { name: "Rusted Shield", color: 0xb87333, emissive: 0x5a3818, shape: "shield", radius: 0.45 },
  { name: "Bone Pile", color: 0xd5c4a1, emissive: 0x6a6250, shape: "bones", radius: 0.4 },
];
const DECOR_COUNT = 22;

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
function buildStickman(color = 0x00ffd0) {
  const group = new THREE.Group();
  const emissive = new THREE.Color(color).multiplyScalar(0.4);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
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
  const glow = new THREE.PointLight(color, 0.6, 4);
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

/** Build the answer cart — the player must come here to submit their answer */
function buildCartMesh() {
  const group = new THREE.Group();

  // Wagon body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x8b6914,
    emissive: 0x4a3a0a,
    emissiveIntensity: 0.3,
    roughness: 0.65,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.1), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Side rails
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x6b4f12,
    roughness: 0.8,
  });
  [
    [-0.85, 1.2, 0],
    [0.85, 1.2, 0],
  ].forEach(([rx, ry, rz]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.1), railMat);
    rail.position.set(rx, ry, rz);
    rail.castShadow = true;
    group.add(rail);
  });

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    roughness: 0.75,
    metalness: 0.4,
  });
  const wheelGeo = new THREE.TorusGeometry(0.25, 0.06, 8, 16);
  [
    [-0.7, 0.25, 0.6],
    [0.7, 0.25, 0.6],
    [-0.7, 0.25, -0.6],
    [0.7, 0.25, -0.6],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });

  // Glowing scroll on top
  const scrollMat = new THREE.MeshStandardMaterial({
    color: 0xf5deb3,
    emissive: 0xdaa520,
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });
  const scroll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.7, 12),
    scrollMat,
  );
  scroll.position.y = 1.35;
  scroll.rotation.z = Math.PI / 2;
  scroll.castShadow = true;
  group.add(scroll);

  // Beacon
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff6b35,
    emissive: 0xff6b35,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    beaconMat,
  );
  beacon.position.y = 2.8;
  group.add(beacon);

  // Ground ring
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff6b35,
    emissive: 0xff6b35,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CART_INTERACT_DIST - 0.3, CART_INTERACT_DIST, 48),
    ringMat,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  // Point light
  const light = new THREE.PointLight(0xff6b35, 2.5, 14);
  light.position.y = 2.2;
  group.add(light);

  // Label
  const label = createTextSprite("Answer Cart", "#ff6b35");
  label.position.y = 3.5;
  group.add(label);

  group.position.set(CART_POS[0], CART_POS[1], CART_POS[2]);

  return { group, beacon, ring, light, scroll };
}

/** Build a wall mesh from segment data */
function buildWallMesh(w) {
  const group = new THREE.Group();
  const isPerimeter = w.w >= 50 || w.d >= 50;
  const mat = new THREE.MeshStandardMaterial({
    color: isPerimeter ? 0x1a1a32 : 0x2a2a48,
    roughness: 0.92,
    metalness: 0.08,
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
  wall.position.set(w.x, w.h / 2, w.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Torch on interior walls
  if (!isPerimeter) {
    const torchLight = new THREE.PointLight(0xff6633, 0.6, 8);
    torchLight.position.set(w.x, w.h + 0.5, w.z);
    group.add(torchLight);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff6633,
      emissive: 0xff4400,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
    });
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      flameMat,
    );
    flame.position.set(w.x, w.h + 0.2, w.z);
    group.add(flame);
  }
  return group;
}

/** Build a decorative (non-clue) object */
function buildDecorObject(typeData) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: typeData.color,
    emissive: typeData.emissive,
    emissiveIntensity: 0.15,
    roughness: 0.85,
    metalness: 0.1,
  });
  switch (typeData.shape) {
    case "barrel": {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.35, 0.9, 12),
        mat,
      );
      barrel.position.y = 0.45;
      barrel.castShadow = true;
      group.add(barrel);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.7,
        metalness: 0.5,
      });
      [0.15, 0.75].forEach((y) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.41, 0.025, 8, 16),
          ringMat,
        );
        ring.position.y = y;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      });
      break;
    }
    case "crate": {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        mat,
      );
      crate.position.y = 0.4;
      crate.castShadow = true;
      crate.rotation.y = Math.random() * Math.PI;
      group.add(crate);
      break;
    }
    case "rock": {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.55, 0),
        mat,
      );
      rock.position.y = 0.3;
      rock.castShadow = true;
      rock.rotation.set(Math.random(), Math.random(), 0);
      group.add(rock);
      break;
    }
    case "mushroom": {
      const stemMat = new THREE.MeshStandardMaterial({
        color: 0xf5deb3,
        roughness: 0.9,
      });
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.35, 8),
        stemMat,
      );
      stem.position.y = 0.175;
      group.add(stem);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2,
        ),
        mat,
      );
      cap.position.y = 0.35;
      cap.castShadow = true;
      group.add(cap);
      const glow = new THREE.PointLight(typeData.color, 0.25, 2.5);
      glow.position.y = 0.45;
      group.add(glow);
      break;
    }
    case "stump": {
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.42, 0.5, 8),
        mat,
      );
      stump.position.y = 0.25;
      stump.castShadow = true;
      group.add(stump);
      break;
    }
    case "brokenPillar": {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.35, 1.2, 6),
        mat,
      );
      pillar.position.y = 0.6;
      pillar.rotation.z = 0.12;
      pillar.castShadow = true;
      group.add(pillar);
      break;
    }
    case "pot": {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.32, 0.45, 12),
        mat,
      );
      pot.position.y = 0.225;
      pot.castShadow = true;
      group.add(pot);
      break;
    }
    case "tombstone": {
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.9, 0.12),
        mat,
      );
      stone.position.y = 0.45;
      stone.castShadow = true;
      group.add(stone);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.12, 0.25),
        mat,
      );
      base.position.y = 0.06;
      group.add(base);
      break;
    }
    case "shield": {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 8),
        mat,
      );
      disc.position.set(0, 0.55, 0);
      disc.rotation.x = -0.2;
      disc.castShadow = true;
      group.add(disc);
      const stickMat = new THREE.MeshStandardMaterial({
        color: 0x5c4033,
        roughness: 0.9,
      });
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6),
        stickMat,
      );
      stick.position.y = 0.45;
      stick.rotation.z = 0.12;
      group.add(stick);
      break;
    }
    case "bones": {
      for (let i = 0; i < 5; i++) {
        const bone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6),
          mat,
        );
        bone.position.set(
          (Math.random() - 0.5) * 0.4,
          0.03,
          (Math.random() - 0.5) * 0.4,
        );
        bone.rotation.set(
          Math.random() * Math.PI * 0.5,
          Math.random() * Math.PI,
          Math.random() * Math.PI * 0.5,
        );
        group.add(bone);
      }
      break;
    }
    default: {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        mat,
      );
      box.position.y = 0.3;
      box.castShadow = true;
      group.add(box);
    }
  }
  return group;
}

/** Check if a point is inside any wall (with padding radius) */
function isInsideWall(x, z, radius, walls) {
  for (const w of walls) {
    const halfW = w.w / 2 + radius;
    const halfD = w.d / 2 + radius;
    if (Math.abs(x - w.x) < halfW && Math.abs(z - w.z) < halfD) {
      return true;
    }
  }
  return false;
}

/** Generate a random position that doesn't overlap walls or existing points */
function generateRandomPos(existing, walls, minDist, boundary, avoidCenter) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = (Math.random() - 0.5) * boundary * 2;
    const z = (Math.random() - 0.5) * boundary * 2;
    if (isInsideWall(x, z, 1.5, walls)) continue;
    if (avoidCenter && Math.sqrt(x * x + z * z) < avoidCenter) continue;
    let tooClose = false;
    for (const [ex, ez] of existing) {
      if (Math.sqrt((x - ex) ** 2 + (z - ez) ** 2) < minDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    return [x, z];
  }
  return null;
}

/** Resolve collisions against walls (AABB) and decor objects (circle) */
function resolveCollisions(pos, walls, decors, radius) {
  for (const w of walls) {
    const halfW = w.w / 2 + radius;
    const halfD = w.d / 2 + radius;
    const dx = pos.x - w.x;
    const dz = pos.z - w.z;
    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        pos.x += dx > 0 ? overlapX : -overlapX;
      } else {
        pos.z += dz > 0 ? overlapZ : -overlapZ;
      }
    }
  }
  for (const d of decors) {
    const ddx = pos.x - d.x;
    const ddz = pos.z - d.z;
    const dist = Math.sqrt(ddx * ddx + ddz * ddz);
    const minDist = d.r + radius;
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      pos.x += (ddx / dist) * push;
      pos.z += (ddz / dist) * push;
    }
  }
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
const StickmanMysteryGame = () => {
  const { submitAnswer, currentPlayer, gameState, currentRoom } = useGame();

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
  const nearCartRef = useRef(false);
  const cartMeshRef = useRef(null);
  const wallBoxesRef = useRef([]);
  const decorCollidersRef = useRef([]);

  /* ── Multiplayer refs ──────────────────────────────── */
  const otherPlayersRef = useRef(new Map());
  const pushVelocityRef = useRef({ x: 0, z: 0 });
  const isDashingRef = useRef(false);
  const dashCoolRef = useRef(false);
  const dashTimerRef = useRef(0);
  const syncIntervalRef = useRef(null);
  const roomIdRef = useRef(currentRoom?._id);

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
  const [nearCart, setNearCart] = useState(false);
  const [isDashing, setIsDashing] = useState(false);
  const [dashReady, setDashReady] = useState(true);

  useEffect(() => {
    roomIdRef.current = currentRoom?._id;
  }, [currentRoom?._id]);

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
      isDashingRef.current = false;
      dashCoolRef.current = false;
      dashTimerRef.current = 0;
      pushVelocityRef.current = { x: 0, z: 0 };
      setIsDashing(false);
      setDashReady(true);
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

    // ── Walls ─────────────────────────────────────────
    const wallBoxes = WALL_SEGMENTS.map((w) => ({ ...w }));
    wallBoxesRef.current = wallBoxes;
    WALL_SEGMENTS.forEach((w) => {
      const wallMesh = buildWallMesh(w);
      scene.add(wallMesh);
    });

    // ── Random position generation ────────────────────
    const occupied = [[0, 0], [CART_POS[0], CART_POS[2]]];
    const randomPositions = MYSTERY.objects.map((obj) => {
      const pos = generateRandomPos(occupied, wallBoxes, 5, BOUNDARY - 2, 6);
      if (pos) {
        occupied.push(pos);
        return pos;
      }
      occupied.push([obj.pos[0], obj.pos[2]]);
      return [obj.pos[0], obj.pos[2]];
    });

    // ── Stickman ──────────────────────────────────────
    const stickman = buildStickman();
    scene.add(stickman.group);
    stickmanRef.current = stickman;

    // ── 5 Mystery objects (randomised positions) ──────
    const objMeshes = MYSTERY.objects.map((data, i) => {
      const obj = buildObjectMesh(data, i);
      const rp = randomPositions[i];
      obj.group.position.set(rp[0], 0, rp[1]);
      scene.add(obj.group);
      return obj;
    });
    objMeshesRef.current = objMeshes;

    // ── Answer Cart ───────────────────────────────────
    const cart = buildCartMesh();
    scene.add(cart.group);
    cartMeshRef.current = cart;

    // ── Decorative (non-clue) objects ─────────────────
    const decorColliders = [];
    for (let i = 0; i < DECOR_COUNT; i++) {
      const typeIdx = Math.floor(Math.random() * DECOR_TYPES.length);
      const typeData = DECOR_TYPES[typeIdx];
      const pos = generateRandomPos(occupied, wallBoxes, 3, BOUNDARY - 2, 3);
      if (!pos) continue;
      occupied.push(pos);
      const decorMesh = buildDecorObject(typeData);
      decorMesh.position.set(pos[0], 0, pos[1]);
      decorMesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(decorMesh);
      decorColliders.push({ x: pos[0], z: pos[1], r: typeData.radius });
    }
    decorCollidersRef.current = decorColliders;

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
          resolveCollisions(stickman.group.position, wallBoxes, decorColliders, 0.4);
        }
      }
      stickman.group.rotation.y = stickmanAngleRef.current;

      /* —— Dash (Space) —— */
      if (
        keys[" "] &&
        !dashCoolRef.current &&
        canMove &&
        !isDashingRef.current
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
            stickmanAngleRef.current,
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
          resolveCollisions(stickman.group.position, wallBoxes, decorColliders, 0.4);
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
        resolveCollisions(stickman.group.position, wallBoxes, decorColliders, 0.4);
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
        const ox = objMeshes[i].group.position.x;
        const oz = objMeshes[i].group.position.z;
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

      /* —— Cart proximity —— */
      const cartDx = px - CART_POS[0];
      const cartDz = pz - CART_POS[2];
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
        // Answer cart takes priority
        if (nearCartRef.current && cluesFoundRef.current.length > 0) {
          setShowQuestion(true);
        } else {
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

      // Cart beacon animation
      if (cart.beacon) {
        cart.beacon.position.y = 2.8 + Math.sin(time * 2.5) * 0.25;
        cart.beacon.material.emissiveIntensity =
          1.2 + Math.sin(time * 3.5) * 0.5;
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
          <div
            className={`sm-hud-pill sm-dash-pill${isDashing ? " dashing" : ""}${!dashReady ? " cooldown" : ""}`}
          >
            💨 {isDashing ? "DASH!" : dashReady ? "Ready" : "Cooldown"}
          </div>
        </div>
        <div className="sm-hud-right">
          <div className="sm-hud-pill sm-controls-hint">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> Move &nbsp;· <kbd>E</kbd> Interact &nbsp;·{" "}
            <kbd>Space</kbd> Dash
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

      {/* Cart proximity prompt — no clues yet */}
      {nearCart &&
        nearObject === null &&
        cluesFound.length === 0 &&
        !showClue &&
        !showQuestion &&
        !solved &&
        !gameOver &&
        !isPaused && (
          <div className="sm-prompt collected">
            🔒 Find at least one clue before answering!
          </div>
        )}

      {/* Answer-ready button — only at the Answer Cart */}
      {nearCart &&
        cluesFound.length > 0 &&
        !showQuestion &&
        !solved &&
        !gameOver &&
        showClue === null &&
        !isPaused && (
          <div className="sm-answer-ready">
            <button onClick={() => setShowQuestion(true)}>
              🧩 Answer the Mystery
            </button>
            <div className="sm-answer-hint">
              or press <kbd>E</kbd>
            </div>
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
              <h4>
                Your Collected Clues ({cluesFound.length}/
                {MYSTERY.objects.length})
              </h4>
              {cluesFound.map((idx, i) => (
                <div key={idx} className="sm-review-row">
                  <span className="sm-review-num">#{i + 1}</span>
                  <span className="sm-review-name">
                    {MYSTERY.objects[idx].name}:
                  </span>
                  <span className="sm-review-clue">
                    {MYSTERY.objects[idx].clue}
                  </span>
                </div>
              ))}
              {cluesFound.length < MYSTERY.objects.length && (
                <p
                  style={{
                    color: "#888",
                    fontSize: "0.78rem",
                    marginTop: 8,
                    marginBottom: 0,
                  }}
                >
                  💡 You haven't found all clues yet — answering is harder with
                  fewer clues!
                </p>
              )}
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
