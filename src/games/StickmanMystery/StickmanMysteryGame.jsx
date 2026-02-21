import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../context/GameContext";
import "./StickmanMysteryGame.css";

const API_URL = import.meta.env.VITE_API_URL || "";

/* ── Constants ──────────────────────────────────────── */
const GAME_DURATION = 300; // 5 min countdown
const TIME_PENALTY = 30; // seconds lost per clue
const DECOY_PENALTY = 20; // seconds lost per decoy trap
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

/* ── Wall layout — maze style ───────────────────────── */
const WALL_SEGMENTS = [
  // Perimeter walls
  { x: 0, z: -28, w: 58, d: 1.2, h: 3.2 },
  { x: 0, z: 28, w: 58, d: 1.2, h: 3.2 },
  { x: -28, z: 0, w: 1.2, d: 58, h: 3.2 },
  { x: 28, z: 0, w: 1.2, d: 58, h: 3.2 },
  // ── Outer ring ──
  { x: -20, z: -20, w: 14, d: 0.6, h: 2.6 },
  { x: 14, z: -20, w: 14, d: 0.6, h: 2.6 },
  { x: -20, z: 20, w: 18, d: 0.6, h: 2.6 },
  { x: 18, z: 20, w: 10, d: 0.6, h: 2.6 },
  { x: -20, z: -6, w: 0.6, d: 28, h: 2.6 },
  { x: 20, z: 4, w: 0.6, d: 24, h: 2.6 },
  // ── Mid ring ──
  { x: -12, z: -12, w: 10, d: 0.6, h: 2.6 },
  { x: 8, z: -12, w: 12, d: 0.6, h: 2.6 },
  { x: -12, z: 12, w: 12, d: 0.6, h: 2.6 },
  { x: 12, z: 12, w: 8, d: 0.6, h: 2.6 },
  { x: -12, z: 0, w: 0.6, d: 24, h: 2.6 },
  { x: 12, z: -2, w: 0.6, d: 20, h: 2.6 },
  // ── Inner corridors ──
  { x: -4, z: -6, w: 8, d: 0.6, h: 2.6 },
  { x: 4, z: 6, w: 8, d: 0.6, h: 2.6 },
  { x: 0, z: 0, w: 0.6, d: 8, h: 2.6 },
  // ── Dead-end nooks and T-junctions ──
  { x: -16, z: -4, w: 6, d: 0.6, h: 2.6 },
  { x: 16, z: -6, w: 6, d: 0.6, h: 2.6 },
  { x: -6, z: 18, w: 0.6, d: 6, h: 2.6 },
  { x: 6, z: -18, w: 0.6, d: 6, h: 2.6 },
  { x: -24, z: 10, w: 6, d: 0.6, h: 2.6 },
  { x: 24, z: -14, w: 6, d: 0.6, h: 2.6 },
  { x: -16, z: 16, w: 0.6, d: 6, h: 2.6 },
  { x: 16, z: 16, w: 0.6, d: 6, h: 2.6 },
  { x: 8, z: -24, w: 0.6, d: 6, h: 2.6 },
  { x: -8, z: -24, w: 0.6, d: 6, h: 2.6 },
  { x: 24, z: 10, w: 6, d: 0.6, h: 2.6 },
];

/* ── Decoy objects — look like real clues but are traps ── */
const DECOY_OBJECTS = [
  {
    name: "Forgotten Scroll",
    color: 0xd4a574,
    emissive: 0x6a5238,
    beaconColor: 0xffd700,
    shape: 0,
    msg: "This scroll crumbles into dust… it was a decoy!",
  },
  {
    name: "Glowing Gem",
    color: 0xe056a0,
    emissive: 0x702850,
    beaconColor: 0xff69b4,
    shape: 1,
    msg: "The gem flickers and goes dark… it was a trap!",
  },
  {
    name: "Dusty Relic",
    color: 0xb07d4b,
    emissive: 0x583e25,
    beaconColor: 0xdaa520,
    shape: 2,
    msg: "The relic shatters on touch… just a fake!",
  },
  {
    name: "Shadow Orb",
    color: 0x7b68ee,
    emissive: 0x3d3477,
    beaconColor: 0x9370db,
    shape: 1,
    msg: "Dark energy drains your time… it was cursed!",
  },
  {
    name: "Mystic Chalice",
    color: 0xc0c0c0,
    emissive: 0x606060,
    beaconColor: 0xe0e0e0,
    shape: 3,
    msg: "The chalice was empty — a worthless decoy!",
  },
  {
    name: "Rune Stone",
    color: 0x8fbc8f,
    emissive: 0x475e47,
    beaconColor: 0x90ee90,
    shape: 2,
    msg: "The runes fade away… this was a trap!",
  },
  {
    name: "Enchanted Skull",
    color: 0xdcdcdc,
    emissive: 0x6e6e6e,
    beaconColor: 0xf0f0f0,
    shape: 0,
    msg: "The skull laughs at you… time wasted on a fake!",
  },
  {
    name: "Phoenix Feather",
    color: 0xff4500,
    emissive: 0x802200,
    beaconColor: 0xff6347,
    shape: 3,
    msg: "The feather burns up — it was just a trick!",
  },
];
const DECOY_INTERACT_DIST = 3.5;

/* ── Stage system ────────────────────────────────────── */
const TOTAL_STAGES = 5;
const STAGE_MAX_SCORE = 200;
const STAGE_THEMES = [
  {
    name: "The Awakening",
    color: 0x00e5ff,
    emissive: 0x006b80,
    beacon: 0x00e5ff,
    label: "#00e5ff",
  },
  {
    name: "The Shadows",
    color: 0xbb86fc,
    emissive: 0x5d4380,
    beacon: 0xbb86fc,
    label: "#bb86fc",
  },
  {
    name: "The Inferno",
    color: 0xff5252,
    emissive: 0x802929,
    beacon: 0xff5252,
    label: "#ff5252",
  },
  {
    name: "The Radiance",
    color: 0xffab00,
    emissive: 0x805500,
    beacon: 0xffab00,
    label: "#ffab00",
  },
  {
    name: "The Revelation",
    color: 0x00e676,
    emissive: 0x00733b,
    beacon: 0x00e676,
    label: "#00e676",
  },
];
// Which DECOY_OBJECTS indices belong to each stage (0-based)
const STAGE_DECOY_MAP = [
  [0, 1], // Stage 1
  [2, 3], // Stage 2
  [4, 5], // Stage 3
  [6], // Stage 4
  [7], // Stage 5
];

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
  const label = createTextSprite(objData.name, objData.labelColor || "#ffffff");
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

/** Build a wall mesh from segment data — lighter stone colour */
function buildWallMesh(w) {
  const group = new THREE.Group();
  const isPerimeter = w.w >= 50 || w.d >= 50;
  const mat = new THREE.MeshStandardMaterial({
    color: isPerimeter ? 0x4a4a6e : 0x6a6a90,
    roughness: 0.82,
    metalness: 0.12,
  });
  // Subtle stone-brick look via a top cap
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
  wall.position.set(w.x, w.h / 2, w.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Lighter cap on top of wall
  const capMat = new THREE.MeshStandardMaterial({
    color: isPerimeter ? 0x5a5a80 : 0x8484a8,
    roughness: 0.75,
    metalness: 0.15,
  });
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.1, 0.12, w.d + 0.1),
    capMat,
  );
  cap.position.set(w.x, w.h + 0.06, w.z);
  cap.receiveShadow = true;
  group.add(cap);

  return group;
}

/** Build a wall-mounted torch (returns group with animated flame ref) */
function buildTorch(x, y, z) {
  const group = new THREE.Group();
  // Bracket
  const bracketMat = new THREE.MeshStandardMaterial({
    color: 0x4a3a2a,
    roughness: 0.9,
    metalness: 0.3,
  });
  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6),
    bracketMat,
  );
  bracket.position.set(x, y, z);
  bracket.castShadow = true;
  group.add(bracket);

  // Flame (will be animated)
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff8833,
    emissive: 0xff5500,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.9,
  });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), flameMat);
  flame.position.set(x, y + 0.3, z);
  group.add(flame);

  // Warm light
  const torchLight = new THREE.PointLight(0xff6633, 0.8, 10);
  torchLight.position.set(x, y + 0.35, z);
  torchLight.castShadow = false;
  group.add(torchLight);

  return { group, flame, light: torchLight };
}

/** Build a decoy object — looks exactly like a real clue with beacon + label */
function buildDecoyMesh(decoyData) {
  const group = new THREE.Group();

  // Pedestal (same as real clues)
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

  // Main shape (same shapes as real clues to deceive)
  const mainMat = new THREE.MeshStandardMaterial({
    color: decoyData.color,
    emissive: decoyData.emissive,
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.3,
  });
  let mainMesh;
  switch (decoyData.shape) {
    case 0:
      mainMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.65),
        mainMat,
      );
      mainMesh.position.y = 0.7;
      break;
    case 1: {
      const orbMat = mainMat.clone();
      orbMat.transparent = true;
      orbMat.opacity = 0.82;
      mainMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), orbMat);
      mainMesh.position.y = 0.85;
      break;
    }
    case 2:
      mainMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.13, 0.9),
        mainMat,
      );
      mainMesh.position.y = 0.52;
      mainMesh.rotation.y = Math.random() * 0.5;
      break;
    case 3:
      mainMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.33), mainMat);
      mainMesh.position.y = 0.9;
      break;
    default:
      mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mainMat);
      mainMesh.position.y = 0.75;
  }
  mainMesh.castShadow = true;
  group.add(mainMesh);

  // Beacon (identical to real clues)
  const beaconMat = new THREE.MeshStandardMaterial({
    color: decoyData.beaconColor,
    emissive: decoyData.beaconColor,
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

  // Proximity ring (identical to real clues)
  const ringMat = new THREE.MeshStandardMaterial({
    color: decoyData.beaconColor,
    emissive: decoyData.beaconColor,
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

  // Point light (same as real clues)
  const light = new THREE.PointLight(decoyData.beaconColor, 2, 12);
  light.position.y = 2.0;
  group.add(light);

  // Name label (looks exactly like real clues)
  const label = createTextSprite(
    decoyData.name,
    decoyData.labelColor || "#ffffff",
  );
  label.position.y = 3.2;
  group.add(label);

  return { group, mesh: mainMesh, beacon, ring, light, label };
}

// (decorative builder removed — replaced by decoy system)

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

/** Resolve collisions against walls (AABB) */
function resolveCollisions(pos, walls, radius) {
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
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
const StickmanMysteryGame = () => {
  const { submitAnswer, currentPlayer, gameState, currentRoom, players } =
    useGame();

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
  const decoyMeshesRef = useRef([]);
  const decoysTriggeredRef = useRef([]);
  const nearDecoyRef = useRef(null);
  const torchFlamesRef = useRef([]);

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
  const [nearDecoy, setNearDecoy] = useState(null);
  const [showDecoyTrap, setShowDecoyTrap] = useState(null);
  const [decoysTriggered, setDecoysTriggered] = useState([]);
  const [currentStage, setCurrentStage] = useState(0);
  const [stageScores, setStageScores] = useState([]);
  const [showStageSummary, setShowStageSummary] = useState(null);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

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
    currentStageRef.current = currentStage;
  }, [currentStage]);
  useEffect(() => {
    showingModalRef.current =
      showClue !== null ||
      showQuestion ||
      showDecoyTrap !== null ||
      showStageSummary !== null ||
      showFinalSummary ||
      showDashboard;
  }, [
    showClue,
    showQuestion,
    showDecoyTrap,
    showStageSummary,
    showFinalSummary,
    showDashboard,
  ]);

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
      // restore decoys
      decoyMeshesRef.current.forEach((d) => {
        if (d.beacon) d.beacon.visible = true;
        if (d.ring) d.ring.material.opacity = 0.25;
        if (d.light) d.light.intensity = 2;
      });
      setDecoysTriggered([]);
      decoysTriggeredRef.current = [];
      setShowDecoyTrap(null);
      setNearDecoy(null);
      // Reset stage system
      setCurrentStage(0);
      setStageScores([]);
      setShowStageSummary(null);
      setShowFinalSummary(false);
      setShowDashboard(false);
      currentStageRef.current = 0;
      stageStartTimeRef.current = GAME_DURATION;
      stageDecoysRef.current = [0, 0, 0, 0, 0];
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
    const torchFlames = [];
    WALL_SEGMENTS.forEach((w) => {
      const wallMesh = buildWallMesh(w);
      scene.add(wallMesh);
      // Place torches on interior walls
      const isPerimeter = w.w >= 50 || w.d >= 50;
      if (!isPerimeter) {
        const isHorizontal = w.w > w.d;
        const len = isHorizontal ? w.w : w.d;
        const torchCount = Math.max(1, Math.floor(len / 5));
        for (let t = 0; t < torchCount; t++) {
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

    // ── Random position generation ────────────────────
    const occupied = [
      [0, 0],
      [CART_POS[0], CART_POS[2]],
    ];
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

    // ── 5 Mystery objects (one per stage, stage-colored) ──────
    const objMeshes = MYSTERY.objects.map((data, i) => {
      const theme = STAGE_THEMES[i];
      const themedData = {
        ...data,
        color: theme.color,
        emissive: theme.emissive,
        beaconColor: theme.beacon,
        labelColor: theme.label,
      };
      const obj = buildObjectMesh(themedData, i);
      const rp = randomPositions[i];
      obj.group.position.set(rp[0], 0, rp[1]);
      obj.stage = i;
      obj.group.visible = i === 0; // Only stage 0 visible initially
      scene.add(obj.group);
      return obj;
    });
    objMeshesRef.current = objMeshes;

    // ── Answer Cart ───────────────────────────────────
    const cart = buildCartMesh();
    scene.add(cart.group);
    cartMeshRef.current = cart;

    // ── Decoy objects (stage-assigned, same color as their stage clue) ──
    const decoyMeshes = [];
    STAGE_DECOY_MAP.forEach((decoyIndices, stageIdx) => {
      const theme = STAGE_THEMES[stageIdx];
      decoyIndices.forEach((dIdx) => {
        const decoyData = {
          ...DECOY_OBJECTS[dIdx],
          color: theme.color,
          emissive: theme.emissive,
          beaconColor: theme.beacon,
          labelColor: theme.label,
        };
        const pos = generateRandomPos(occupied, wallBoxes, 4, BOUNDARY - 2, 5);
        if (!pos) return;
        occupied.push(pos);
        const decoy = buildDecoyMesh(decoyData);
        decoy.group.position.set(pos[0], 0, pos[1]);
        decoy.group.visible = stageIdx === 0;
        scene.add(decoy.group);
        decoyMeshes.push({ ...decoy, data: decoyData, pos, stage: stageIdx });
      });
    });
    decoyMeshesRef.current = decoyMeshes;

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
      const curStage = currentStageRef.current;

      /* —— Stage visibility —— */
      objMeshes.forEach((o, i) => {
        o.group.visible = i === curStage && curStage < TOTAL_STAGES;
      });
      decoyMeshes.forEach((d) => {
        d.group.visible = d.stage === curStage && curStage < TOTAL_STAGES;
      });

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
          resolveCollisions(stickman.group.position, wallBoxes, 0.4);
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
        if (i !== curStage || curStage >= TOTAL_STAGES) continue;
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

      /* —— Decoy proximity detection —— */
      let nearestDecoy = null;
      let nearestDecoyDist = Infinity;
      for (let i = 0; i < decoyMeshes.length; i++) {
        if (decoyMeshes[i].stage !== curStage || curStage >= TOTAL_STAGES)
          continue;
        const dx = px - decoyMeshes[i].group.position.x;
        const dz = pz - decoyMeshes[i].group.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < DECOY_INTERACT_DIST && d < nearestDecoyDist) {
          nearestDecoy = i;
          nearestDecoyDist = d;
        }
      }
      if (nearestDecoy !== nearDecoyRef.current) {
        nearDecoyRef.current = nearestDecoy;
        setNearDecoy(nearestDecoy);
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
        if (nearCartRef.current && currentStageRef.current >= TOTAL_STAGES) {
          setShowQuestion(true);
        } else if (
          nearObjRef.current !== null &&
          !cluesFoundRef.current.includes(nearObjRef.current)
        ) {
          // Real clue
          const idx = nearObjRef.current;
          setShowClue(idx);
          setCluesFound((prev) => [...prev, idx]);
          setTimeLeft((prev) => Math.max(0, prev - TIME_PENALTY));
          const o = objMeshes[idx];
          if (o.beacon) o.beacon.visible = false;
          if (o.ring) o.ring.material.opacity = 0.08;
          if (o.light) o.light.intensity = 0.35;
        } else if (
          nearDecoyRef.current !== null &&
          !decoysTriggeredRef.current.includes(nearDecoyRef.current)
        ) {
          // Decoy trap!
          const dIdx = nearDecoyRef.current;
          setShowDecoyTrap(dIdx);
          setDecoysTriggered((prev) => {
            const next = [...prev, dIdx];
            decoysTriggeredRef.current = next;
            return next;
          });
          setTimeLeft((prev) => Math.max(0, prev - DECOY_PENALTY));
          const d = decoyMeshes[dIdx];
          if (d.beacon) d.beacon.visible = false;
          if (d.ring) d.ring.material.opacity = 0.08;
          if (d.light) d.light.intensity = 0.35;
          // Track per-stage decoy count
          if (d.stage !== undefined) stageDecoysRef.current[d.stage]++;
        }
      }

      /* —— Beacon pulse animation —— */
      objMeshes.forEach((o, i) => {
        if (!o.group.visible) return;
        if (o.beacon && o.beacon.visible) {
          o.beacon.position.y = 2.5 + Math.sin(time * 2.2 + i * 1.3) * 0.2;
          o.beacon.material.emissiveIntensity =
            1.2 + Math.sin(time * 3 + i * 0.9) * 0.5;
        }
        if (o.mesh && i !== 4) o.mesh.rotation.y += delta * 0.3;
      });

      // Decoy beacon pulse (identical to real clues)
      decoyMeshes.forEach((d, i) => {
        if (!d.group.visible) return;
        if (d.beacon && d.beacon.visible) {
          d.beacon.position.y =
            2.5 + Math.sin(time * 2.2 + (i + 10) * 1.3) * 0.2;
          d.beacon.material.emissiveIntensity =
            1.2 + Math.sin(time * 3 + (i + 10) * 0.9) * 0.5;
        }
        if (d.mesh) d.mesh.rotation.y += delta * 0.3;
      });

      // Cart beacon animation
      if (cart.beacon) {
        cart.beacon.position.y = 2.8 + Math.sin(time * 2.5) * 0.25;
        cart.beacon.material.emissiveIntensity =
          1.2 + Math.sin(time * 3.5) * 0.5;
      }

      // Torch flame flicker
      torchFlames.forEach((t, i) => {
        const flicker =
          0.8 +
          Math.sin(time * 8 + i * 2.7) * 0.15 +
          Math.sin(time * 13 + i * 1.3) * 0.05;
        t.flame.scale.setScalar(flicker);
        t.flame.material.emissiveIntensity =
          1.5 + Math.sin(time * 10 + i * 3) * 0.5;
        t.light.intensity = 0.6 + Math.sin(time * 7 + i * 2) * 0.2;
      });

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
            className="sm-hud-pill sm-stage-pill"
            style={{
              borderColor:
                STAGE_THEMES[Math.min(currentStage, TOTAL_STAGES - 1)]?.label,
              color:
                STAGE_THEMES[Math.min(currentStage, TOTAL_STAGES - 1)]?.label,
            }}
          >
            🏰 Stage {Math.min(currentStage + 1, TOTAL_STAGES)}/{TOTAL_STAGES}:{" "}
            {currentStage >= TOTAL_STAGES
              ? "Complete!"
              : STAGE_THEMES[currentStage]?.name}
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
                style={{
                  borderColor: STAGE_THEMES[idx]?.label,
                  color: STAGE_THEMES[idx]?.label,
                }}
              >
                ✅ Stage {idx + 1}: {MYSTERY.objects[idx].name}
              </span>
            ))}
          </div>
        )}

      {/* Proximity prompt — real clue */}
      {nearObject !== null &&
        nearDecoy === null &&
        !showClue &&
        !showQuestion &&
        !showDecoyTrap &&
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

      {/* Proximity prompt — decoy (looks identical to real) */}
      {nearDecoy !== null &&
        nearObject === null &&
        !showClue &&
        !showQuestion &&
        !showDecoyTrap &&
        !solved &&
        !gameOver &&
        !isPaused && (
          <div
            className={`sm-prompt ${decoysTriggered.includes(nearDecoy) ? "collected" : ""}`}
          >
            {decoysTriggered.includes(nearDecoy) ? (
              `💀 ${decoyMeshesRef.current[nearDecoy]?.data?.name || "Object"} — it was a trap!`
            ) : (
              <span>
                Press <kbd>E</kbd> to inspect{" "}
                <strong>
                  {decoyMeshesRef.current[nearDecoy]?.data?.name || "Object"}
                </strong>
              </span>
            )}
          </div>
        )}

      {/* Cart proximity prompt — stages not complete */}
      {nearCart &&
        nearObject === null &&
        currentStage < TOTAL_STAGES &&
        !showClue &&
        !showQuestion &&
        !solved &&
        !gameOver &&
        !isPaused && (
          <div className="sm-prompt collected">
            🔒 Complete all {TOTAL_STAGES} stages to unlock the final question!
          </div>
        )}

      {/* Answer-ready button — only after all stages complete */}
      {nearCart &&
        currentStage >= TOTAL_STAGES &&
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
            <button
              className="sm-btn"
              onClick={() => {
                const idx = showClue;
                setShowClue(null);
                // Stage completion check
                if (idx === currentStage && currentStage < TOTAL_STAGES) {
                  const timeSpent = stageStartTimeRef.current - timeLeft;
                  const stgDecoys = stageDecoysRef.current[currentStage];
                  const score = Math.max(
                    0,
                    STAGE_MAX_SCORE - Math.floor(timeSpent) - stgDecoys * 20,
                  );
                  const summary = {
                    stage: currentStage,
                    score,
                    timeSpent,
                    decoysTriggered: stgDecoys,
                  };
                  setShowStageSummary(summary);
                  setStageScores((prev) => [...prev, summary]);
                }
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Decoy trap modal ───────────────────────── */}
      {showDecoyTrap !== null && (
        <div className="sm-overlay" onClick={() => setShowDecoyTrap(null)}>
          <div
            className="sm-modal sm-trap-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">💀</div>
            <h3>It&rsquo;s a Trap!</h3>
            <p className="sm-clue-text" style={{ borderLeftColor: "#e74c3c" }}>
              {decoyMeshesRef.current[showDecoyTrap]?.data?.msg ||
                "This was a decoy!"}
            </p>
            <div className="sm-penalty-badge">
              ⏱ −{DECOY_PENALTY}s time penalty
            </div>
            <button className="sm-btn" onClick={() => setShowDecoyTrap(null)}>
              Ouch! Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Stage completion modal ─────────────────── */}
      {showStageSummary !== null && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-stage-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: STAGE_THEMES[showStageSummary.stage]?.label }}
          >
            <div className="sm-big-icon">🏆</div>
            <h2>Stage {showStageSummary.stage + 1} Complete!</h2>
            <h3
              style={{
                color: STAGE_THEMES[showStageSummary.stage]?.label,
                margin: "4px 0 16px",
              }}
            >
              {STAGE_THEMES[showStageSummary.stage]?.name}
            </h3>
            <div
              className="sm-score-box"
              style={{
                borderColor: STAGE_THEMES[showStageSummary.stage]?.label,
              }}
            >
              <span className="sm-score-label">Stage Score</span>
              <span
                className="sm-score-value"
                style={{ color: STAGE_THEMES[showStageSummary.stage]?.label }}
              >
                {showStageSummary.score}
              </span>
            </div>
            <div className="sm-stage-stats">
              <div>⏱ Time spent: {Math.floor(showStageSummary.timeSpent)}s</div>
              <div>💀 Decoys triggered: {showStageSummary.decoysTriggered}</div>
              <div>📊 Max possible: {STAGE_MAX_SCORE}</div>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              onClick={() => {
                setShowStageSummary(null);
                if (showStageSummary.stage < TOTAL_STAGES - 1) {
                  const next = showStageSummary.stage + 1;
                  setCurrentStage(next);
                  currentStageRef.current = next;
                  stageStartTimeRef.current = timeLeft;
                } else {
                  setCurrentStage(TOTAL_STAGES);
                  currentStageRef.current = TOTAL_STAGES;
                }
              }}
            >
              {showStageSummary.stage < TOTAL_STAGES - 1
                ? `Continue to Stage ${showStageSummary.stage + 2}: ${STAGE_THEMES[showStageSummary.stage + 1]?.name} →`
                : "🛒 Go to Answer Cart"}
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
      {solved && !showFinalSummary && !showDashboard && (
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
            <button
              className="sm-btn sm-btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => setShowFinalSummary(true)}
            >
              📊 View Stage Summary
            </button>
          </div>
        </div>
      )}

      {/* ── Final summary with stage breakdown ─────── */}
      {showFinalSummary && !showDashboard && (
        <div className="sm-overlay sm-overlay-solved">
          <div className="sm-modal sm-summary-modal">
            <div className="sm-big-icon">📊</div>
            <h2>Game Summary</h2>
            <div className="sm-stage-breakdown">
              {stageScores.map((s, i) => (
                <div
                  key={i}
                  className="sm-stage-row"
                  style={{ borderLeftColor: STAGE_THEMES[s.stage]?.label }}
                >
                  <div className="sm-stage-row-header">
                    <span style={{ color: STAGE_THEMES[s.stage]?.label }}>
                      Stage {s.stage + 1}: {STAGE_THEMES[s.stage]?.name}
                    </span>
                    <span
                      className="sm-stage-row-score"
                      style={{ color: STAGE_THEMES[s.stage]?.label }}
                    >
                      {s.score}
                    </span>
                  </div>
                  <div className="sm-stage-row-details">
                    ⏱ {Math.floor(s.timeSpent)}s · 💀 {s.decoysTriggered} decoy
                    {s.decoysTriggered !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="sm-score-box" style={{ marginTop: 16 }}>
              <span className="sm-score-label">Total Stage Score</span>
              <span className="sm-score-value">
                {stageScores.reduce((sum, s) => sum + s.score, 0)}
              </span>
            </div>
            <div
              className="sm-score-box"
              style={{ marginTop: 8, borderColor: "rgba(241,196,15,0.3)" }}
            >
              <span className="sm-score-label">Final Answer Score</span>
              <span className="sm-score-value" style={{ color: "#f1c40f" }}>
                {finalScore}
              </span>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setShowDashboard(true)}
            >
              🏅 View Dashboard &amp; Rankings
            </button>
            <button
              className="sm-btn sm-btn-secondary"
              onClick={() => setShowFinalSummary(false)}
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ── Dashboard / Leaderboard ────────────────── */}
      {showDashboard && (
        <div className="sm-overlay sm-overlay-solved">
          <div className="sm-modal sm-dashboard-modal">
            <div className="sm-big-icon">🏅</div>
            <h2>Leaderboard</h2>
            {(() => {
              const sorted = [...(players || [])]
                .filter((p) => p.score > 0)
                .sort((a, b) => b.score - a.score);
              const myRank =
                sorted.findIndex((p) => p._id === currentPlayer?._id) + 1;
              const top3 = sorted.slice(0, 3);
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <>
                  <div className="sm-leaderboard">
                    {top3.length === 0 && (
                      <p style={{ color: "#888" }}>No scores yet</p>
                    )}
                    {top3.map((p, i) => (
                      <div
                        key={p._id}
                        className={`sm-lb-row ${p._id === currentPlayer?._id ? "sm-lb-me" : ""}`}
                      >
                        <span className="sm-lb-medal">{medals[i]}</span>
                        <span className="sm-lb-name">{p.name}</span>
                        <span className="sm-lb-score">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  {myRank > 0 && (
                    <div className="sm-my-rank">
                      Your Rank: <strong>#{myRank}</strong> out of{" "}
                      {sorted.length} player{sorted.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {myRank === 0 && (
                    <div className="sm-my-rank" style={{ color: "#888" }}>
                      You haven&rsquo;t scored yet
                    </div>
                  )}
                </>
              );
            })()}
            <button
              className="sm-btn sm-btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => setShowDashboard(false)}
            >
              ← Back to Summary
            </button>
          </div>
        </div>
      )}

      {/* ── Time's up ─────────────────────────────── */}
      {gameOver && !solved && !showDashboard && (
        <div className="sm-overlay sm-overlay-over">
          <div className="sm-modal sm-over-modal">
            <div className="sm-big-icon">⏰</div>
            <h2>Time&rsquo;s Up!</h2>
            <p>
              You ran out of time at{" "}
              <strong>Stage {Math.min(currentStage + 1, TOTAL_STAGES)}</strong>.
            </p>
            <p>
              The answer was: <strong>{MYSTERY.answer}</strong>
            </p>
            {stageScores.length > 0 && (
              <div className="sm-stage-breakdown" style={{ marginTop: 12 }}>
                {stageScores.map((s, i) => (
                  <div
                    key={i}
                    className="sm-stage-row"
                    style={{ borderLeftColor: STAGE_THEMES[s.stage]?.label }}
                  >
                    <div className="sm-stage-row-header">
                      <span style={{ color: STAGE_THEMES[s.stage]?.label }}>
                        Stage {s.stage + 1}: {STAGE_THEMES[s.stage]?.name}
                      </span>
                      <span
                        className="sm-stage-row-score"
                        style={{ color: STAGE_THEMES[s.stage]?.label }}
                      >
                        {s.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="sm-solve-stats">
              <span>
                🔑 Clues found: {cluesFound.length}/{MYSTERY.objects.length}
              </span>
              <span>
                📊 Total: {stageScores.reduce((sum, s) => sum + s.score, 0)}
              </span>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => setShowDashboard(true)}
            >
              🏅 View Dashboard
            </button>
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
