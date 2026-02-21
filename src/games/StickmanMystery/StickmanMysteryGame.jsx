import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../context/GameContext";
import "./StickmanMysteryGame.css";

const API_URL = import.meta.env.VITE_API_URL || "";

/* ── Constants ──────────────────────────────────────── */
const GAME_DURATION = 300; // 5 min countdown
const CLUE_PENALTY = 15; // seconds lost per clue opened
const TRASH_PENALTY = 30; // seconds lost per trash opened
const TRASH_SLOW_DURATION = 4; // seconds of slowed movement after trash
const TRASH_SHAKE_DURATION = 1; // seconds of camera shake after trash
const SLOW_FACTOR = 0.4; // movement multiplier during slow
const WRONG_ANSWER_PENALTY = 10; // seconds lost per wrong answer
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
const TOTAL_STAGES = 5;
const STAGE_MAX_SCORE = 200;
const CLUES_PER_STAGE = 5;

const PLAYER_COLORS = [
  0xff6b6b, 0x48dbfb, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x01a3a4,
  0xf368e0,
];

/* ── 5 Stages — each with 5 clue objects + 3 trash ─── */
const STAGES = [
  {
    name: "The Awakening",
    answer: "WATER",
    question: "All five clues describe the same thing. What am I?",
    theme: {
      color: 0x00e5ff,
      emissive: 0x006b80,
      beacon: 0x00e5ff,
      label: "#00e5ff",
    },
    clues: [
      {
        name: "Ancient Vessel",
        clue: "I fall from the sky but never get hurt.",
      },
      { name: "Crystal Flask", clue: "I can be solid, liquid, or gas." },
      { name: "Stone Basin", clue: "Fish live inside me." },
      {
        name: "Sealed Amphora",
        clue: "I make up about 60% of the human body.",
      },
      {
        name: "Jade Fountain",
        clue: "I always run downhill but I have no legs.",
      },
    ],
    trash: [
      {
        name: "Cracked Urn",
        msg: "The urn crumbles to dust… worthless trash!",
      },
      {
        name: "Rusted Helm",
        msg: "The helm falls apart in your hands… it was junk!",
      },
      { name: "Broken Tablet", msg: "The writing fades away… just garbage!" },
    ],
  },
  {
    name: "The Shadows",
    answer: "FIRE",
    question: "All five clues describe the same thing. What am I?",
    theme: {
      color: 0xbb86fc,
      emissive: 0x5d4380,
      beacon: 0xbb86fc,
      label: "#bb86fc",
    },
    clues: [
      {
        name: "Obsidian Cube",
        clue: "I dance on a wick but I'm not a dancer.",
      },
      {
        name: "Shadow Prism",
        clue: "I need oxygen to stay alive, but I'm not an animal.",
      },
      {
        name: "Dark Chalice",
        clue: "Campers gather around me for warmth at night.",
      },
      {
        name: "Void Crystal",
        clue: "I can spread through forests faster than any animal can run.",
      },
      {
        name: "Night Lantern",
        clue: "I am the reason early humans could cook their food.",
      },
    ],
    trash: [
      {
        name: "Empty Coffer",
        msg: "The coffer is empty… nothing but a waste of time!",
      },
      { name: "Dead Compass", msg: "The needle spins wildly… it was cursed!" },
      { name: "Cursed Coin", msg: "The coin burns your hand… it was a trap!" },
    ],
  },
  {
    name: "The Inferno",
    answer: "TIME",
    question: "All five clues describe the same thing. What am I?",
    theme: {
      color: 0xff5252,
      emissive: 0x802929,
      beacon: 0xff5252,
      label: "#ff5252",
    },
    clues: [
      {
        name: "Molten Orb",
        clue: "I never stop moving forward, yet I have no legs.",
      },
      {
        name: "Flame Codex",
        clue: "Everyone wants more of me, but no one can save me.",
      },
      { name: "Ember Crown", clue: "Doctors say I heal all wounds." },
      {
        name: "Blazing Mirror",
        clue: "Clocks and watches exist only to track me.",
      },
      {
        name: "Scorched Relic",
        clue: "I fly when you're having fun but crawl when you're bored.",
      },
    ],
    trash: [
      { name: "Ash Pile", msg: "Just a pile of ash… nothing useful here!" },
      {
        name: "Burnt Scroll",
        msg: "The scroll is too burnt to read… total waste!",
      },
      { name: "Cinder Stone", msg: "The stone is just a worthless cinder!" },
    ],
  },
  {
    name: "The Radiance",
    answer: "SHADOW",
    question: "All five clues describe the same thing. What am I?",
    theme: {
      color: 0xffab00,
      emissive: 0x805500,
      beacon: 0xffab00,
      label: "#ffab00",
    },
    clues: [
      {
        name: "Sun Stone",
        clue: "I follow you everywhere during the day, but vanish at night.",
      },
      { name: "Light Shard", clue: "I can only exist when there is light." },
      {
        name: "Golden Eye",
        clue: "The brighter the light, the darker I become.",
      },
      {
        name: "Radiant Key",
        clue: "I copy your every move perfectly, but I am flat.",
      },
      {
        name: "Prism Heart",
        clue: "Peter Pan once lost me and needed help getting me back.",
      },
    ],
    trash: [
      {
        name: "Fool's Gold",
        msg: "It's just fool's gold… completely worthless!",
      },
      { name: "Tarnished Ring", msg: "The ring turns to rust… it was cursed!" },
      { name: "Hollow Gem", msg: "The gem is hollow inside… just a trick!" },
    ],
  },
  {
    name: "The Revelation",
    answer: "ECHO",
    question: "All five clues describe the same thing. What am I?",
    theme: {
      color: 0x00e676,
      emissive: 0x00733b,
      beacon: 0x00e676,
      label: "#00e676",
    },
    clues: [
      {
        name: "Verdant Tome",
        clue: "I repeat everything you say, but I have no voice of my own.",
      },
      {
        name: "Life Seed",
        clue: "I am born in mountains, caves, and large empty halls.",
      },
      { name: "Emerald Scale", clue: "I get weaker every time I speak." },
      {
        name: "Nature's Core",
        clue: "Shout into a canyon and I will answer you.",
      },
      {
        name: "Genesis Orb",
        clue: "I am not a parrot, but I copy every sound you make.",
      },
    ],
    trash: [
      {
        name: "Dead Root",
        msg: "The root withers in your hands… cursed garbage!",
      },
      { name: "Withered Leaf", msg: "The leaf crumbles to nothing… a trap!" },
      { name: "Hollow Bark", msg: "The bark is hollow and rotten… just junk!" },
    ],
  },
];

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
    color: isPerimeter ? 0xb0b0b8 : 0xd0d0d8,
    roughness: 0.82,
    metalness: 0.08,
  });
  // Subtle stone-brick look via a top cap
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
  wall.position.set(w.x, w.h / 2, w.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Lighter cap on top of wall
  const capMat = new THREE.MeshStandardMaterial({
    color: isPerimeter ? 0xc8c8d0 : 0xe8e8f0,
    roughness: 0.75,
    metalness: 0.1,
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

/** Build a trash object — looks similar to clues but with subtle warning hints */
function buildTrashMesh(trashData, shapeIdx) {
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

  // Main shape (similar to clue shapes to blend in)
  const mainMat = new THREE.MeshStandardMaterial({
    color: trashData.color,
    emissive: trashData.emissive,
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.3,
  });
  let mainMesh;
  switch (shapeIdx % 4) {
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

  // Beacon (similar to clues — but animated differently in the loop)
  const beaconMat = new THREE.MeshStandardMaterial({
    color: trashData.beaconColor,
    emissive: trashData.beaconColor,
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

  // Proximity ring — slightly reddish tint as a subtle warning
  const ringColor = new THREE.Color(trashData.beaconColor).lerp(
    new THREE.Color(0xff4444),
    0.25,
  );
  const ringMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.2,
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
  const light = new THREE.PointLight(trashData.beaconColor, 2, 12);
  light.position.y = 2.0;
  group.add(light);

  // Name label
  const label = createTextSprite(
    trashData.name,
    trashData.labelColor || "#ffffff",
  );
  label.position.y = 3.2;
  group.add(label);

  // ★ Warning indicator — small orbiting red dot (subtle hint)
  const warnMat = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    emissive: 0xff0000,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.7,
  });
  const warnDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), warnMat);
  warnDot.position.set(0.8, 1.5, 0);
  group.add(warnDot);

  return { group, mesh: mainMesh, beacon, ring, light, label, warnDot };
}

// (decorative builder removed — replaced by trash system)

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
  const clueMeshesRef = useRef([]);
  const trashMeshesRef = useRef([]);

  /* ── Input refs ────────────────────────────────────── */
  const keysRef = useRef({});
  const stickmanAngleRef = useRef(0);
  const walkCycleRef = useRef(0);
  const interactCoolRef = useRef(false);

  /* ── State↔ref bridges (read from animation loop) ─── */
  const stageCluesFoundRef = useRef([]);
  const stageTrashTriggeredRef = useRef([]);
  const nearClueRef = useRef(null);
  const nearTrashRef = useRef(null);
  const showingModalRef = useRef(false);
  const gameCompleteRef = useRef(false);
  const gameOverRef = useRef(false);
  const isPausedRef = useRef(false);
  const nearCartRef = useRef(false);
  const cartMeshRef = useRef(null);
  const wallBoxesRef = useRef([]);
  const torchFlamesRef = useRef([]);
  const currentStageRef = useRef(0);
  const stageStartTimeRef = useRef(GAME_DURATION);
  const slowTimeRef = useRef(0);
  const shakeTimeRef = useRef(0);
  const isSlowedRef = useRef(false);

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
  const [currentStage, setCurrentStage] = useState(0);
  const [stageCluesFound, setStageCluesFound] = useState([]);
  const [stageTrashTriggered, setStageTrashTriggered] = useState([]);
  const [nearClue, setNearClue] = useState(null);
  const [nearTrash, setNearTrash] = useState(null);
  const [showClue, setShowClue] = useState(null);
  const [showTrash, setShowTrash] = useState(null);
  const [showStageQuestion, setShowStageQuestion] = useState(false);
  const [stageAnswer, setStageAnswer] = useState("");
  const [stageWrongAttempts, setStageWrongAttempts] = useState(0);
  const [error, setError] = useState("");
  const [gameComplete, setGameComplete] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nearCart, setNearCart] = useState(false);
  const [isDashing, setIsDashing] = useState(false);
  const [dashReady, setDashReady] = useState(true);
  const [isSlowed, setIsSlowed] = useState(false);
  const [showStageSummary, setShowStageSummary] = useState(null);
  const [stageScores, setStageScores] = useState([]);
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    roomIdRef.current = currentRoom?._id;
  }, [currentRoom?._id]);

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
      (gameComplete && !showFinalSummary && !showDashboard);
  }, [
    showClue,
    showTrash,
    showStageQuestion,
    showStageSummary,
    showFinalSummary,
    showDashboard,
    gameComplete,
  ]);

  /* ── Detect admin restart ──────────────────────────── */
  useEffect(() => {
    const newStarted = gameState?.startedAt;
    if (newStarted && newStarted !== prevStartedAtRef.current) {
      setTimeLeft(GAME_DURATION);
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
      pushVelocityRef.current = { x: 0, z: 0 };
      // reset stickman position
      if (stickmanRef.current) {
        stickmanRef.current.group.position.set(0, 0, 0);
        stickmanAngleRef.current = 0;
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
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameComplete, gameOver, isPaused, gameState?.status]);

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

    // ── Stickman ──────────────────────────────────────
    const stickman = buildStickman();
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
        const pos = generateRandomPos(occupied, wallBoxes, 4, BOUNDARY - 2, 5);
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
        const pos = generateRandomPos(occupied, wallBoxes, 4, BOUNDARY - 2, 5);
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
            setTimeLeft((prev) => Math.max(0, prev - CLUE_PENALTY));
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
            setTimeLeft((prev) => Math.max(0, prev - TRASH_PENALTY));
            // Extra consequences: slow + camera shake
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
          o.beacon.material.emissiveIntensity =
            1.2 + Math.sin(time * 2 + i * 0.9) * 0.3;
        }
        if (o.mesh && o.clueIdx !== 4) o.mesh.rotation.y += delta * 0.3;
      });

      /* —— Trash beacon pulse — fast, erratic + orbiting warning dot —— */
      trashMeshes.forEach((t, i) => {
        if (!t.group.visible) return;
        if (t.beacon && t.beacon.visible) {
          t.beacon.position.y =
            2.5 +
            Math.sin(time * 4.0 + i * 1.7) * 0.15 +
            Math.sin(time * 11 + i * 3.1) * 0.06;
          t.beacon.material.emissiveIntensity =
            0.8 +
            Math.sin(time * 5.5 + i * 1.2) * 0.8 +
            Math.sin(time * 14 + i * 2.5) * 0.3;
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
      setStageWrongAttempts((p) => p + 1);
      setStageAnswer("");
      setError("That's not correct — think again!");
      return;
    }

    /* ── Correct! Compute stage score ── */
    const timeSpent = stageStartTimeRef.current - timeLeft;
    const trashHit = stageTrashTriggered.length;
    const score = Math.max(
      0,
      STAGE_MAX_SCORE -
        Math.floor(timeSpent) -
        trashHit * 20 -
        stageWrongAttempts * 15,
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
    setShowStageQuestion(false);
    setStageAnswer("");
    setError("");
    setStageWrongAttempts(0);

    if (currentStage < TOTAL_STAGES - 1) {
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
      if (result.success) {
        setFinalScore(result.score || totalScore);
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

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
  const stg = STAGES[Math.min(currentStage, TOTAL_STAGES - 1)];
  const anyModal =
    showClue !== null ||
    showTrash !== null ||
    showStageQuestion ||
    showStageSummary !== null ||
    gameComplete ||
    gameOver;

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
            🔑 {stageCluesFound.length}/5
          </div>
          <div
            className="sm-hud-pill sm-stage-pill"
            style={{
              borderColor: stg.theme.label,
              color: stg.theme.label,
            }}
          >
            🏰 Stage {Math.min(currentStage + 1, TOTAL_STAGES)}/{TOTAL_STAGES}:{" "}
            {currentStage >= TOTAL_STAGES ? "Complete!" : stg.name}
          </div>
          <div
            className={`sm-hud-pill sm-dash-pill${isDashing ? " dashing" : ""}${!dashReady ? " cooldown" : ""}`}
          >
            💨 {isDashing ? "DASH!" : dashReady ? "Ready" : "Cooldown"}
          </div>
          {isSlowed && (
            <div className="sm-hud-pill sm-slowed-pill">🐌 SLOWED</div>
          )}
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

      {/* ── Visual hint bar ──────────────────────── */}
      {!anyModal && currentStage < TOTAL_STAGES && (
        <div className="sm-hint-bar">
          <span className="sm-hint-safe">🟢 Calm glow = Clue</span>
          <span className="sm-hint-danger">
            🔴 Fast pulse + red dot = Trash (avoid!)
          </span>
        </div>
      )}

      {/* ── Collected clue pills (current stage) ── */}
      {stageCluesFound.length > 0 && !anyModal && (
        <div className="sm-collected-pills">
          {stageCluesFound.map((idx) => (
            <span
              key={idx}
              className="sm-collected-pill"
              title={stg.clues[idx].clue}
              style={{
                borderColor: stg.theme.label,
                color: stg.theme.label,
              }}
            >
              ✅ {stg.clues[idx].name}
            </span>
          ))}
        </div>
      )}

      {/* ── Proximity prompt — clue object ────────── */}
      {nearClue !== null && nearTrash === null && !anyModal && !isPaused && (
        <div
          className={`sm-prompt ${stageCluesFound.includes(nearClue) ? "collected" : ""}`}
        >
          {stageCluesFound.includes(nearClue) ? (
            `✅ ${stg.clues[nearClue].name} — already inspected`
          ) : (
            <span>
              Press <kbd>E</kbd> to inspect{" "}
              <strong>{stg.clues[nearClue].name}</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Proximity prompt — trash object ────────── */}
      {nearTrash !== null && nearClue === null && !anyModal && !isPaused && (
        <div
          className={`sm-prompt ${stageTrashTriggered.includes(nearTrash) ? "collected" : ""}`}
        >
          {stageTrashTriggered.includes(nearTrash) ? (
            `💀 Already triggered — it was trash!`
          ) : (
            <span>
              Press <kbd>E</kbd> to inspect <strong>Mysterious Object</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Cart prompt — no clues yet ──────────── */}
      {nearCart && stageCluesFound.length < 1 && !anyModal && !isPaused && (
        <div className="sm-prompt collected">
          🔒 Find at least one clue before answering!
        </div>
      )}

      {/* ── Cart prompt — ready to answer ─────────── */}
      {nearCart &&
        stageCluesFound.length >= 1 &&
        !showStageQuestion &&
        !anyModal &&
        !isPaused && (
          <div className="sm-answer-ready">
            <button onClick={() => setShowStageQuestion(true)}>
              🧩 Answer Stage {currentStage + 1} Question
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
            <h3>{stg.clues[showClue].name}</h3>
            <p className="sm-clue-text">{stg.clues[showClue].clue}</p>
            <div className="sm-penalty-badge">
              ⏱ −{CLUE_PENALTY}s time penalty
            </div>
            <button className="sm-btn" onClick={() => setShowClue(null)}>
              Got it ({stageCluesFound.length}/5 clues)
            </button>
          </div>
        </div>
      )}

      {/* ── Trash modal ───────────────────────────── */}
      {showTrash !== null && (
        <div className="sm-overlay" onClick={() => setShowTrash(null)}>
          <div
            className="sm-modal sm-trap-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">💀</div>
            <h3>It&rsquo;s Trash!</h3>
            <p className="sm-clue-text" style={{ borderLeftColor: "#e74c3c" }}>
              {stg.trash[showTrash]?.msg || "This was trash!"}
            </p>
            <div className="sm-trap-effects">
              <span className="sm-trap-effect-badge">⏱ −{TRASH_PENALTY}s</span>
              <span className="sm-trap-effect-badge">
                🐌 Slowed {TRASH_SLOW_DURATION}s
              </span>
              <span className="sm-trap-effect-badge">📳 Camera shake</span>
            </div>
            <button className="sm-btn" onClick={() => setShowTrash(null)}>
              Ouch! Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Stage question modal ──────────────────── */}
      {showStageQuestion && !gameComplete && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-question-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">🧩</div>
            <h3>
              Stage {currentStage + 1}: {stg.name}
            </h3>
            <p className="sm-question-text">{stg.question}</p>

            <div className="sm-review">
              <h4>Your Collected Clues ({stageCluesFound.length}/5)</h4>
              {stageCluesFound.map((idx, i) => (
                <div key={idx} className="sm-review-row">
                  <span className="sm-review-num">#{i + 1}</span>
                  <span className="sm-review-name">{stg.clues[idx].name}:</span>
                  <span className="sm-review-clue">{stg.clues[idx].clue}</span>
                </div>
              ))}
            </div>

            <form className="sm-answer-form" onSubmit={handleStageAnswer}>
              <input
                type="text"
                value={stageAnswer}
                onChange={(e) => setStageAnswer(e.target.value)}
                placeholder="Type your answer…"
                autoFocus
                maxLength={50}
              />
              <button type="submit" className="sm-btn sm-btn-primary">
                Submit
              </button>
            </form>

            {stageWrongAttempts > 0 && (
              <div className="sm-attempts">
                Wrong attempts: {stageWrongAttempts}
              </div>
            )}
            {error && <div className="sm-error">{error}</div>}

            <button
              className="sm-btn sm-btn-secondary"
              onClick={() => {
                setShowStageQuestion(false);
                setError("");
              }}
            >
              Back to Exploring
            </button>
          </div>
        </div>
      )}

      {/* ── Stage completion summary ─────────────── */}
      {showStageSummary !== null && !gameComplete && (
        <div className="sm-overlay">
          <div
            className="sm-modal sm-stage-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: STAGES[showStageSummary.stage].theme.label }}
          >
            <div className="sm-big-icon">🏆</div>
            <h2>Stage {showStageSummary.stage + 1} Complete!</h2>
            <h3
              style={{
                color: STAGES[showStageSummary.stage].theme.label,
                margin: "4px 0 16px",
              }}
            >
              {showStageSummary.name}
            </h3>
            <div
              className="sm-score-box"
              style={{
                borderColor: STAGES[showStageSummary.stage].theme.label,
              }}
            >
              <span className="sm-score-label">Stage Score</span>
              <span
                className="sm-score-value"
                style={{ color: STAGES[showStageSummary.stage].theme.label }}
              >
                {showStageSummary.score}
              </span>
            </div>
            <div className="sm-stage-stats">
              <div>⏱ Time spent: {Math.floor(showStageSummary.timeSpent)}s</div>
              <div>💀 Trash triggered: {showStageSummary.trashTriggered}</div>
              <div>❌ Wrong answers: {showStageSummary.wrongAttempts}</div>
              <div>📊 Max possible: {STAGE_MAX_SCORE}</div>
            </div>
            <button
              className="sm-btn sm-btn-primary"
              onClick={() => {
                setShowStageSummary(null);
                const next = showStageSummary.stage + 1;
                setCurrentStage(next);
                currentStageRef.current = next;
                stageStartTimeRef.current = timeLeft;
                setStageCluesFound([]);
                setStageTrashTriggered([]);
                setStageWrongAttempts(0);
                setStageAnswer("");
                setError("");
              }}
            >
              {showStageSummary.stage < TOTAL_STAGES - 1
                ? `Continue to Stage ${showStageSummary.stage + 2}: ${STAGES[showStageSummary.stage + 1].name} →`
                : "🏆 View Final Results"}
            </button>
          </div>
        </div>
      )}

      {/* ── Game Complete — final summary ─────────── */}
      {gameComplete &&
        showStageSummary !== null &&
        !showFinalSummary &&
        !showDashboard && (
          <div className="sm-overlay sm-overlay-solved">
            <div
              className="sm-modal sm-stage-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                borderColor: STAGES[showStageSummary.stage].theme.label,
              }}
            >
              <div className="sm-big-icon">🏆</div>
              <h2>Final Stage Complete!</h2>
              <h3
                style={{
                  color: STAGES[showStageSummary.stage].theme.label,
                  margin: "4px 0 16px",
                }}
              >
                {showStageSummary.name}
              </h3>
              <div
                className="sm-score-box"
                style={{
                  borderColor: STAGES[showStageSummary.stage].theme.label,
                }}
              >
                <span className="sm-score-label">Stage Score</span>
                <span
                  className="sm-score-value"
                  style={{ color: STAGES[showStageSummary.stage].theme.label }}
                >
                  {showStageSummary.score}
                </span>
              </div>
              <div className="sm-stage-stats">
                <div>
                  ⏱ Time spent: {Math.floor(showStageSummary.timeSpent)}s
                </div>
                <div>💀 Trash triggered: {showStageSummary.trashTriggered}</div>
                <div>❌ Wrong answers: {showStageSummary.wrongAttempts}</div>
              </div>
              <button
                className="sm-btn sm-btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setShowStageSummary(null);
                  setShowFinalSummary(true);
                }}
              >
                📊 View Full Game Summary
              </button>
            </div>
          </div>
        )}

      {/* ── Game Complete — solved banner ─────────── */}
      {gameComplete &&
        showStageSummary === null &&
        !showFinalSummary &&
        !showDashboard && (
          <div className="sm-overlay sm-overlay-solved">
            <div className="sm-modal sm-solved-modal">
              <div className="sm-big-icon">🎉</div>
              <h2>All Stages Complete!</h2>
              <div className="sm-score-box">
                <span className="sm-score-label">Final Score</span>
                <span className="sm-score-value">{finalScore}</span>
              </div>
              <div className="sm-solve-stats">
                <span>⏱ Time remaining: {fmt(timeLeft)}</span>
                <span>
                  🏰 Stages cleared: {stageScores.length}/{TOTAL_STAGES}
                </span>
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
                  style={{ borderLeftColor: STAGES[s.stage].theme.label }}
                >
                  <div className="sm-stage-row-header">
                    <span style={{ color: STAGES[s.stage].theme.label }}>
                      Stage {s.stage + 1}: {s.name}
                    </span>
                    <span
                      className="sm-stage-row-score"
                      style={{ color: STAGES[s.stage].theme.label }}
                    >
                      {s.score}
                    </span>
                  </div>
                  <div className="sm-stage-row-details">
                    ⏱ {Math.floor(s.timeSpent)}s · 💀 {s.trashTriggered} trash
                    {s.trashTriggered !== 1 ? "" : ""} · ❌ {s.wrongAttempts}{" "}
                    wrong
                  </div>
                </div>
              ))}
            </div>
            <div className="sm-score-box" style={{ marginTop: 16 }}>
              <span className="sm-score-label">Total Score</span>
              <span className="sm-score-value">
                {stageScores.reduce((sum, s) => sum + s.score, 0)}
              </span>
            </div>
            <div
              className="sm-score-box"
              style={{ marginTop: 8, borderColor: "rgba(241,196,15,0.3)" }}
            >
              <span className="sm-score-label">Server Score</span>
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
      {gameOver && !gameComplete && !showDashboard && (
        <div className="sm-overlay sm-overlay-over">
          <div className="sm-modal sm-over-modal">
            <div className="sm-big-icon">⏰</div>
            <h2>Time&rsquo;s Up!</h2>
            <p>
              You ran out of time at{" "}
              <strong>Stage {Math.min(currentStage + 1, TOTAL_STAGES)}</strong>.
            </p>
            {stageScores.length > 0 && (
              <div className="sm-stage-breakdown" style={{ marginTop: 12 }}>
                {stageScores.map((s, i) => (
                  <div
                    key={i}
                    className="sm-stage-row"
                    style={{ borderLeftColor: STAGES[s.stage].theme.label }}
                  >
                    <div className="sm-stage-row-header">
                      <span style={{ color: STAGES[s.stage].theme.label }}>
                        Stage {s.stage + 1}: {s.name}
                      </span>
                      <span
                        className="sm-stage-row-score"
                        style={{ color: STAGES[s.stage].theme.label }}
                      >
                        {s.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="sm-solve-stats">
              <span>🔑 Clues: {stageCluesFound.length}/5 (current stage)</span>
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
            {stageCluesFound.length > 0 && (
              <p className="sm-pause-progress">
                {stageCluesFound.length} clue
                {stageCluesFound.length !== 1 ? "s" : ""} found so far (Stage{" "}
                {currentStage + 1})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StickmanMysteryGame;
