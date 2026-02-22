import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../../context/GameContext";
import "./StickmanMysteryGame.css";

const API_URL = import.meta.env.VITE_API_URL || "";

/* ── Constants ──────────────────────────────────────── */
export const GAME_DURATION = 2700; // 45 min countdown
const CLUE_PENALTY = 15; // seconds lost per clue opened
const TRASH_PENALTY = 30; // seconds lost per trash opened
const TRASH_SLOW_DURATION = 7; // seconds of slowed movement after trash
const TRASH_SHAKE_DURATION = 1; // seconds of camera shake after trash
const SLOW_FACTOR = 0.4; // movement multiplier during slow
const WRONG_ANSWER_PENALTY = 10; // score points deducted per wrong answer
const INTERACT_DIST = 3.5;
const MOVE_SPEED = 8;
const TURN_SPEED = 3;
const BOUNDARY = 18;
const CART_POS = [0, 0, -10];
const CART_INTERACT_DIST = 4;
const DASH_SPEED = 22;
const DASH_DURATION = 0.25; // seconds
const DASH_COOLDOWN = 1.5; // seconds
const JUMP_COOLDOWN = 1.5; // seconds
const JUMP_HEIGHT = 2.5;
const JUMP_DURATION = 0.5; // seconds
const PUSH_DIST = 2;
const PUSH_FORCE = 18;
const POSITION_SYNC_MS = 150;
const TOTAL_STAGES = 5;
const STAGE_MAX_SCORE = 1000;

const PLAYER_COLORS = [
  0xff6b6b, 0x48dbfb, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x01a3a4,
  0xf368e0,
];

/* ── Available 3D object shapes for clue representation ── */
export const AVAILABLE_OBJECTS = [
  { id: "chest", name: "Chest (Box)", icon: "📦" },
  { id: "orb", name: "Orb (Sphere)", icon: "🔮" },
  { id: "tome", name: "Tome (Flat Book)", icon: "📖" },
  { id: "lantern", name: "Lantern (Octahedron)", icon: "🏮" },
  { id: "mirror", name: "Mirror (Tall Slab)", icon: "🪞" },
  { id: "diamond", name: "Diamond (Icosahedron)", icon: "💎" },
  { id: "pillar", name: "Pillar (Cylinder)", icon: "🏛️" },
  { id: "crystal", name: "Crystal (Cone)", icon: "🔷" },
];

/* ── 5 Stages — varied puzzle types inspired by escape room classics ── */
/* Puzzle types: Stage1=Addition, Stage2=Letter Values(A=1), Stage3=Multiply-Subtract, Stage4=Direction Turns, Stage5=Caesar Cipher */
export const DEFAULT_STAGES = [
  {
    name: "The Awakening",
    answer: "23",
    question: "You found two numbers hidden in the chamber. Solve: First Number + Second Number = ?",
    hint: "Simply add the two values you collected from the clues.",
    storyline: "You awaken in an ancient dungeon. The air is damp and cold. Two glowing ledgers catch your eye. Each holds a secret number — add them together to break the first seal!",
    objective: "Collect both number clues, then walk to the Answer Cart. Add the two values together and type the total.",
    clueCount: 2,
    trashCount: 1,
    theme: {
      color: 0x00e5ff,
      emissive: 0x006b80,
      beacon: 0x00e5ff,
      label: "#00e5ff",
    },
    clues: [
      { name: "Worn Ledger", clue: "First Number = 14", objectShape: "tome" },
      { name: "Crystal Flask", clue: "Second Number = 9", objectShape: "orb" },
    ],
    trash: [
      { name: "Cracked Urn", msg: "The urn crumbles to dust… worthless trash!" },
    ],
    altAnswers: [
      { answer: "12", question: "You found two numbers hidden in the chamber. Solve: First Number + Second Number = ?", clues: [
        { name: "Stone Tablet", clue: "First Number = 7", objectShape: "pillar" },
        { name: "Rune Orb", clue: "Second Number = 5", objectShape: "chest" },
      ]},
      { answer: "30", question: "You found two numbers hidden in the chamber. Solve: First Number + Second Number = ?", clues: [
        { name: "Ancient Chest", clue: "First Number = 18", objectShape: "chest" },
        { name: "Jade Bowl", clue: "Second Number = 12", objectShape: "lantern" },
      ]},
    ],
  },
  {
    name: "The Shadows",
    answer: "13",
    question: "Three rune tablets each reveal an input→output pair. Crack the hidden rule, then apply it: what is the output when the input is 6?",
    hint: "Look at each pair: multiply the input by 2, then add 1. Try it on every pair to confirm, then apply it to 6.",
    storyline: "Beyond the first gate, darkness swallows you whole. Three glowing tablets flicker on the walls, each engraved with a mysterious pair of numbers linked by an arrow. The shadow priests sealed this vault with a numeric rule — only those who can see the pattern will pass!",
    objective: "Collect all 3 pattern tablets. Each shows \"input → output\". Discover the rule linking them, then calculate the missing output for input 6.",
    clueCount: 3,
    trashCount: 2,
    theme: {
      color: 0xbb86fc,
      emissive: 0x5d4380,
      beacon: 0xbb86fc,
      label: "#bb86fc",
    },
    clues: [
      { name: "Shadow Tablet I",  clue: "Pattern Pair I:  2 ➜ 5",  objectShape: "chest" },
      { name: "Shadow Tablet II", clue: "Pattern Pair II: 4 ➜ 9",  objectShape: "orb" },
      { name: "Shadow Tablet III",clue: "Pattern Pair III: 6 ➜ ?", objectShape: "lantern" },
    ],
    trash: [
      { name: "Empty Coffer", msg: "The coffer is empty… nothing but a waste of time!" },
      { name: "Dead Compass", msg: "The needle spins wildly… it was cursed!" },
    ],
    altAnswers: [
      { answer: "11", question: "Three rune tablets each reveal an input→output pair. Crack the hidden rule, then apply it: what is the output when the input is 5?", clues: [
        { name: "Void Tablet I",  clue: "Pattern Pair I:  1 ➜ 3",  objectShape: "diamond" },
        { name: "Void Tablet II", clue: "Pattern Pair II: 3 ➜ 7",  objectShape: "crystal" },
        { name: "Void Tablet III",clue: "Pattern Pair III: 5 ➜ ?", objectShape: "tome" },
      ]},
      { answer: "19", question: "Three rune tablets each reveal an input→output pair. Crack the hidden rule, then apply it: what is the output when the input is 6?", clues: [
        { name: "Night Tablet I",  clue: "Pattern Pair I:  2 ➜ 7",  objectShape: "mirror" },
        { name: "Night Tablet II", clue: "Pattern Pair II: 4 ➜ 13", objectShape: "chest" },
        { name: "Night Tablet III",clue: "Pattern Pair III: 6 ➜ ?", objectShape: "pillar" },
      ]},
    ],
  },
  {
    name: "The Inferno",
    answer: "25",
    question: "Three scorched tablets each show a number and its secret value. Find the hidden rule — then calculate the secret value for 5.",
    hint: "Try multiplying each number by itself (squaring it). Does the rule hold for all three tablets?",
    storyline: "The chamber glows red-hot. Lava cracks beneath the floor. Three scorched stone tablets are mounted on the wall. Each one bears a single number and a result — but the formula connecting them has been burned away. Only the mathematician who rediscovers the rule will survive the Inferno!",
    objective: "Collect all 3 scorched tablets. Each shows \"Number → Secret Value\". Find the mathematical rule and apply it to find the secret value of 5.",
    clueCount: 3,
    trashCount: 2,
    theme: {
      color: 0xff5252,
      emissive: 0x802929,
      beacon: 0xff5252,
      label: "#ff5252",
    },
    clues: [
      { name: "Scorched Tablet I",  clue: "3 ➜ 9",  objectShape: "orb" },
      { name: "Scorched Tablet II", clue: "4 ➜ 16", objectShape: "tome" },
      { name: "Scorched Tablet III",clue: "5 ➜ ?",  objectShape: "lantern" },
    ],
    trash: [
      { name: "Ash Pile", msg: "Just a pile of ash… nothing useful here!" },
      { name: "Burnt Scroll", msg: "The scroll is too burnt to read… total waste!" },
    ],
    altAnswers: [
      { answer: "64", question: "Three scorched tablets each show a number and its secret value. Find the hidden rule — then calculate the secret value for 4.", clues: [
        { name: "Lava Tablet I",  clue: "2 ➜ 8",  objectShape: "diamond" },
        { name: "Lava Tablet II", clue: "3 ➜ 27", objectShape: "mirror" },
        { name: "Lava Tablet III",clue: "4 ➜ ?",  objectShape: "chest" },
      ]},
      { answer: "30", question: "Three scorched tablets each show a number and its secret value. Find the hidden rule — then calculate the secret value for 5.", clues: [
        { name: "Ember Tablet I",  clue: "3 ➜ 12", objectShape: "crystal" },
        { name: "Ember Tablet II", clue: "4 ➜ 20", objectShape: "pillar" },
        { name: "Ember Tablet III",clue: "5 ➜ ?",  objectShape: "orb" },
      ]},
    ],
  },
  {
    name: "The Radiance",
    answer: "WEST",
    question: "Follow the compass directions listed in your clues — in order. You start NORTH. What direction are you facing at the end? (NORTH / EAST / SOUTH / WEST)",
    hint: "Face NORTH. Each turn rotates you 90°: RIGHT = clockwise, LEFT = counter-clockwise.",
    storyline: "Blinding golden light floods the chamber. A compass rose is carved into the floor. Four glowing stones describe a sequence of turns. Only the navigator who reaches the correct final bearing may proceed!",
    objective: "Collect all 4 direction clues. Follow each turn from the starting direction (NORTH) and submit your final bearing.",
    clueCount: 4,
    trashCount: 3,
    theme: {
      color: 0xffab00,
      emissive: 0x805500,
      beacon: 0xffab00,
      label: "#ffab00",
    },
    clues: [
      { name: "Compass Rose", clue: "You start facing NORTH", objectShape: "chest" },
      { name: "Wind Vane I", clue: "First turn: RIGHT", objectShape: "orb" },
      { name: "Sun Dial II", clue: "Second turn: RIGHT", objectShape: "tome" },
      { name: "Sky Chart III", clue: "Third turn: RIGHT", objectShape: "lantern" },
    ],
    trash: [
      { name: "Fool's Gold", msg: "It's just fool's gold… completely worthless!" },
      { name: "Tarnished Ring", msg: "The ring turns to rust… it was cursed!" },
      { name: "Hollow Gem", msg: "The gem is hollow inside… just a trick!" },
    ],
    altAnswers: [
      { answer: "EAST", question: "Follow the compass directions listed in your clues — in order. You start NORTH. What direction are you facing at the end? (NORTH / EAST / SOUTH / WEST)", clues: [
        { name: "Bearing Stone", clue: "You start facing NORTH", objectShape: "diamond" },
        { name: "Course Rune I", clue: "First turn: RIGHT", objectShape: "mirror" },
        { name: "Course Rune II", clue: "Second turn: LEFT", objectShape: "crystal" },
        { name: "Course Rune III", clue: "Third turn: RIGHT", objectShape: "pillar" },
      ]},
      { answer: "SOUTH", question: "Follow the compass directions listed in your clues — in order. You start NORTH. What direction are you facing at the end? (NORTH / EAST / SOUTH / WEST)", clues: [
        { name: "Astrolabe", clue: "You start facing NORTH", objectShape: "chest" },
        { name: "Heading Slab I", clue: "First turn: RIGHT", objectShape: "orb" },
        { name: "Heading Slab II", clue: "Second turn: RIGHT", objectShape: "chest" },
        { name: "Heading Slab III", clue: "Third turn: LEFT", objectShape: "tome" },
      ]},
    ],
  },
  {
    name: "The Revelation",
    answer: "VAULT",
    question: "Five rune stones each hold one encoded letter. The ancient cipher shifts every letter FORWARD 3 positions (A→D, B→E … Z→C). Decode the 5-letter word by shifting each letter BACK 3.",
    hint: "Reverse the shift: subtract 3 from each letter's alphabet position. Y→V, D→A, X→U, O→L, W→T.",
    storyline: "The final chamber. Ancient runes glow green on every wall. Five encoded letters are carved into stone pillars. The cipher of the ancients shifts every letter forward by three — only by reversing the shift will the great door open!",
    objective: "Collect all 5 rune stones. Each shows one encoded letter. Shift each letter BACK by 3 to decode, then submit the 5-letter word.",
    clueCount: 5,
    trashCount: 3,
    theme: {
      color: 0x00e676,
      emissive: 0x00733b,
      beacon: 0x00e676,
      label: "#00e676",
    },
    clues: [
      { name: "Verdant Rune I", clue: "Encoded letter 1: Y", objectShape: "tome" },
      { name: "Verdant Rune II", clue: "Encoded letter 2: D", objectShape: "orb" },
      { name: "Verdant Rune III", clue: "Encoded letter 3: X", objectShape: "lantern" },
      { name: "Verdant Rune IV", clue: "Encoded letter 4: O", objectShape: "chest" },
      { name: "Verdant Rune V", clue: "Encoded letter 5: W", objectShape: "diamond" },
    ],
    trash: [
      { name: "Dead Root", msg: "The root withers in your hands… cursed garbage!" },
      { name: "Withered Leaf", msg: "The leaf crumbles to nothing… a trap!" },
      { name: "Hollow Bark", msg: "The bark is hollow and rotten… just junk!" },
    ],
    altAnswers: [
      { answer: "FLAME", question: "Five rune stones each hold one encoded letter. The ancient cipher shifts every letter FORWARD 3 positions (A→D, B→E … Z→C). Decode the 5-letter word by shifting each letter BACK 3.", clues: [
        { name: "Ember Glyph I", clue: "Encoded letter 1: I", objectShape: "orb" },
        { name: "Ember Glyph II", clue: "Encoded letter 2: O", objectShape: "chest" },
        { name: "Ember Glyph III", clue: "Encoded letter 3: D", objectShape: "pillar" },
        { name: "Ember Glyph IV", clue: "Encoded letter 4: P", objectShape: "diamond" },
        { name: "Ember Glyph V", clue: "Encoded letter 5: H", objectShape: "crystal" },
      ]},
      { answer: "STONE", question: "Five rune stones each hold one encoded letter. The ancient cipher shifts every letter FORWARD 3 positions (A→D, B→E … Z→C). Decode the 5-letter word by shifting each letter BACK 3.", clues: [
        { name: "Rock Cipher I", clue: "Encoded letter 1: V", objectShape: "mirror" },
        { name: "Rock Cipher II", clue: "Encoded letter 2: W", objectShape: "tome" },
        { name: "Rock Cipher III", clue: "Encoded letter 3: R", objectShape: "orb" },
        { name: "Rock Cipher IV", clue: "Encoded letter 4: Q", objectShape: "chest" },
        { name: "Rock Cipher V", clue: "Encoded letter 5: H", objectShape: "lantern" },
      ]},
    ],
  },
];

/** Resolve object shape id to a Three.js mesh — higher-quality geometry */
function resolveObjectShape(shapeId, mainMat) {
  switch (shapeId) {
    case "chest": {
      // Ornate chest — box body + ridge bar on top
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.72), mainMat);
      body.position.y = 0.72;
      grp.add(body);
      const ridgeMat = mainMat.clone();
      ridgeMat.emissiveIntensity = Math.min((ridgeMat.emissiveIntensity ?? 0.5) + 0.4, 1.2);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.1, 0.74), ridgeMat);
      ridge.position.y = 1.07;
      grp.add(ridge);
      grp.position.y = 0; // positioned by parent
      // tag so animation loop can grab it
      grp.isMeshGroup = true;
      return grp;
    }
    case "orb": {
      const mat2 = mainMat.clone();
      mat2.transparent = true;
      mat2.opacity = 0.84;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), mat2);
      m.position.y = 0.88;
      return m;
    }
    case "tome": {
      // Flat open tome — spine + pages
      const grp = new THREE.Group();
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.98), mainMat);
      spine.position.set(-0.36, 0.53, 0);
      grp.add(spine);
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.96), mainMat);
      page.position.set(0.0, 0.52, 0);
      grp.add(page);
      grp.rotation.y = 0.28;
      grp.isMeshGroup = true;
      return grp;
    }
    case "lantern": {
      // Lantern — octahedron + thin cage ring
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), mainMat);
      body.position.y = 0.9;
      grp.add(body);
      const cageMat = mainMat.clone();
      cageMat.wireframe = true;
      cageMat.emissiveIntensity = 0.15;
      const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), cageMat);
      cage.position.y = 0.9;
      grp.add(cage);
      grp.isMeshGroup = true;
      return grp;
    }
    case "mirror": {
      // Mirror — slab with inner glow face
      const grp = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.62, 1.02), mainMat);
      slab.position.y = 1.22;
      grp.add(slab);
      const faceMat = mainMat.clone();
      faceMat.emissiveIntensity = (faceMat.emissiveIntensity ?? 0.5) * 1.5;
      faceMat.transparent = true;
      faceMat.opacity = 0.6;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.5), faceMat);
      face.position.set(0.055, 1.22, 0);
      face.rotation.y = Math.PI / 2;
      grp.add(face);
      grp.isMeshGroup = true;
      return grp;
    }
    case "diamond": {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), mainMat);
      m.position.y = 0.92;
      return m;
    }
    case "pillar": {
      // Column with capital and base
      const grp = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.15, 10), mainMat);
      shaft.position.y = 0.82;
      grp.add(shaft);
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.14, 8), mainMat);
      capital.position.y = 1.46;
      grp.add(capital);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8), mainMat);
      base.position.y = 0.25;
      grp.add(base);
      grp.isMeshGroup = true;
      return grp;
    }
    case "crystal": {
      // Crystal cluster — two offset cones
      const grp = new THREE.Group();
      const main = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 7), mainMat);
      main.position.y = 0.87;
      grp.add(main);
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 6), mainMat);
      shard.position.set(0.22, 0.72, 0.12);
      shard.rotation.z = 0.22;
      grp.add(shard);
      grp.isMeshGroup = true;
      return grp;
    }
    default: {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), mainMat);
      m.position.y = 0.76;
      return m;
    }
  }
}

/* ── Wall layout — maze style ───────────────────────── */
const WALL_SEGMENTS = [
  // Perimeter walls (match BOUNDARY=18)
  { x: 0,   z: -18, w: 38, d: 1.2, h: 3.2 },
  { x: 0,   z:  18, w: 38, d: 1.2, h: 3.2 },
  { x: -18, z:   0, w: 1.2, d: 38, h: 3.2 },
  { x:  18, z:   0, w: 1.2, d: 38, h: 3.2 },
  // ── Interior corridors (trimmed to fit ~±15) ──
  { x: -10, z:  -8, w:  8, d: 0.6, h: 2.6 },
  { x:   8, z:  -8, w:  8, d: 0.6, h: 2.6 },
  { x: -10, z:   8, w:  8, d: 0.6, h: 2.6 },
  { x:   8, z:   8, w:  8, d: 0.6, h: 2.6 },
  { x: -10, z:   0, w: 0.6, d: 16, h: 2.6 },
  { x:  10, z:  -2, w: 0.6, d: 12, h: 2.6 },
  { x:  -2, z:  -4, w:  6, d: 0.6, h: 2.6 },
  { x:   2, z:   4, w:  6, d: 0.6, h: 2.6 },
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
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
  head.position.y = 1.9;
  group.add(head);

  // Body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6),
    mat,
  );
  body.position.y = 1.25;
  group.add(body);

  // Arms — geometry translated so pivot is at shoulder
  const makeArm = () => {
    const g = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5);
    g.translate(0, -0.3, 0);
    return new THREE.Mesh(g, mat);
  };
  const leftArm = makeArm();
  leftArm.position.set(-0.2, 1.6, 0);
  group.add(leftArm);

  const rightArm = makeArm();
  rightArm.position.set(0.2, 1.6, 0);
  group.add(rightArm);

  // Legs — geometry translated so pivot is at hip
  const makeLeg = () => {
    const g = new THREE.CylinderGeometry(0.045, 0.045, 0.75, 5);
    g.translate(0, -0.375, 0);
    return new THREE.Mesh(g, mat);
  };
  const leftLeg = makeLeg();
  leftLeg.position.set(-0.12, 0.85, 0);
  group.add(leftLeg);

  const rightLeg = makeLeg();
  rightLeg.position.set(0.12, 0.85, 0);
  group.add(rightLeg);

  return { group, head, body, leftArm, rightArm, leftLeg, rightLeg };
}

/** Build a mystery object (pedestal + shape + beacon + rune ring + label) */
function buildObjectMesh(objData, index) {
  const group = new THREE.Group();

  // Stone pedestal — hexagonal with inset band
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x252535,
    emissive: 0x0a0a18,
    emissiveIntensity: 0.3,
    roughness: 0.88,
    metalness: 0.18,
  });
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.68, 0.42, 7),
    pedMat,
  );
  pedestal.position.y = 0.21;
  group.add(pedestal);

  // Pedestal inset band — carved groove
  const bandMat = new THREE.MeshStandardMaterial({
    color: objData.color,
    emissive: objData.emissive,
    emissiveIntensity: 0.35,
    roughness: 0.6,
    metalness: 0.25,
  });
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.035, 4, 18),
    bandMat,
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.28;
  group.add(band);

  // Main shape — unique per object
  const mainMat = new THREE.MeshStandardMaterial({
    color: objData.color,
    emissive: objData.emissive,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.35,
  });

  const mainMesh = resolveObjectShape(objData.objectShape || "chest", mainMat);
  group.add(mainMesh);

  // Floating beacon (pulsing sphere)
  const beaconMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    beaconMat,
  );
  beacon.position.y = 2.5;
  group.add(beacon);

  // Horizontal rune ring — slowly rotates, sits above pedestal
  const runeRingMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.5,
  });
  const runeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.028, 4, 28),
    runeRingMat,
  );
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.72;
  group.add(runeRing);

  // Outer wide proximity ring on the ground
  const ringMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(INTERACT_DIST - 0.3, INTERACT_DIST, 20),
    ringMat,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  // Subtle floor glow pool under object
  const poolMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 16),
    poolMat,
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  group.add(pool);

  // Name label
  const label = createTextSprite(objData.name, objData.labelColor || "#ffffff");
  label.position.y = 3.2;
  group.add(label);

  // World position
  group.position.set(objData.pos[0], objData.pos[1], objData.pos[2]);

  return { group, mesh: mainMesh, beacon, runeRing, ring, light: null, label };
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
  const wheelGeo = new THREE.TorusGeometry(0.25, 0.06, 5, 10);
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
    new THREE.CylinderGeometry(0.12, 0.12, 0.7, 7),
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
    new THREE.SphereGeometry(0.18, 6, 6),
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
    new THREE.RingGeometry(CART_INTERACT_DIST - 0.3, CART_INTERACT_DIST, 16),
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

/** Build a wall mesh from segment data — dark dungeon stone */
function buildWallMesh(w) {
  const group = new THREE.Group();
  const isPerimeter = w.w >= 50 || w.d >= 50;
  // Dark, weathered granite stone
  const mat = new THREE.MeshStandardMaterial({
    color: isPerimeter ? 0x18182c : 0x141428,
    emissive: 0x07070e,
    emissiveIntensity: 0.2,
    roughness: 0.96,
    metalness: 0.03,
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
  wall.position.set(w.x, w.h / 2, w.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Slightly lighter stone coping on top
  const capMat = new THREE.MeshStandardMaterial({
    color: isPerimeter ? 0x22223a : 0x1c1c32,
    emissive: 0x0a0a15,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    metalness: 0.05,
  });
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.1, 0.14, w.d + 0.1),
    capMat,
  );
  cap.position.set(w.x, w.h + 0.07, w.z);
  cap.receiveShadow = true;
  group.add(cap);

  // Horizontal mortar groove lines on perimeter walls — two dark strips
  if (isPerimeter && w.h >= 3) {
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d1a,
      roughness: 1.0,
      metalness: 0.0,
    });
    [1.0, 2.0].forEach((gy) => {
      const groove = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.05, 0.06, w.d + 0.05),
        grooveMat,
      );
      groove.position.set(w.x, gy, w.z);
      group.add(groove);
    });
  }

  return group;
}

/** Build a wall-mounted torch (returns group with animated flame refs) */
function buildTorch(x, y, z) {
  const group = new THREE.Group();

  // Iron wall sconce bracket
  const bracketMat = new THREE.MeshStandardMaterial({
    color: 0x2e1e08,
    roughness: 0.7,
    metalness: 0.65,
  });
  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.06, 0.32, 5),
    bracketMat,
  );
  bracket.position.set(x, y - 0.04, z);
  group.add(bracket);

  // Iron cup / holder at top
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0x4a3010,
    roughness: 0.65,
    metalness: 0.7,
  });
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.065, 0.14, 6),
    cupMat,
  );
  cup.position.set(x, y + 0.16, z);
  group.add(cup);

  // Outer flame cone (orange, pointing up)
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.78,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 7), flameMat);
  flame.position.set(x, y + 0.41, z);
  group.add(flame);

  // Inner flame core (bright yellow-white)
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffe080,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), coreMat);
  core.position.set(x, y + 0.29, z);
  group.add(core);

  // Outer glow halo
  const flareMat = new THREE.MeshBasicMaterial({
    color: 0xff3300,
    transparent: true,
    opacity: 0.28,
  });
  const flare = new THREE.Mesh(new THREE.SphereGeometry(0.21, 6, 5), flareMat);
  flare.position.set(x, y + 0.34, z);
  group.add(flare);

  // Warm flickering point light — wider range than before
  const torchLight = new THREE.PointLight(0xff6622, 1.1, 11);
  torchLight.position.set(x, y + 0.42, z);
  torchLight.castShadow = false;
  group.add(torchLight);

  return { group, flame, core, flare, light: torchLight };
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
    new THREE.CylinderGeometry(0.5, 0.7, 0.4, 6),
    pedMat,
  );
  pedestal.position.y = 0.2;
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
      mainMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), orbMat);
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
  mainMesh.castShadow = false;
  group.add(mainMesh);

  // Beacon (similar to clues — but animated differently in the loop)
  const beaconMat = new THREE.MeshBasicMaterial({
    color: trashData.beaconColor,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 6, 6),
    beaconMat,
  );
  beacon.position.y = 2.5;
  group.add(beacon);

  // Proximity ring — slightly reddish tint as a subtle warning
  const ringColor = new THREE.Color(trashData.beaconColor).lerp(
    new THREE.Color(0xff4444),
    0.25,
  );
  const ringMat = new THREE.MeshBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(INTERACT_DIST - 0.3, INTERACT_DIST, 16),
    ringMat,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  // No per-object point light

  // Name label
  const label = createTextSprite(
    trashData.name,
    trashData.labelColor || "#ffffff",
  );
  label.position.y = 3.2;
  group.add(label);

  // ★ Warning indicator — small orbiting red dot (subtle hint)
  const warnMat = new THREE.MeshBasicMaterial({
    color: 0xff3333,
    transparent: true,
    opacity: 0.8,
  });
  const warnDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5), warnMat);
  warnDot.position.set(0.8, 1.5, 0);
  group.add(warnDot);

  return { group, mesh: mainMesh, beacon, ring, light: null, label, warnDot };
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
  const STAGES = adminConfig?.stages || (() => {
    try {
      const saved = localStorage.getItem("stickman_custom_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.stages && Array.isArray(parsed.stages) && parsed.stages.length > 0) {
          // Re-attach themes if missing
          return parsed.stages.map((s, i) => ({
            ...s,
            theme: s.theme || [
              { color: 0x00e5ff, emissive: 0x006b80, beacon: 0x00e5ff, label: "#00e5ff" },
              { color: 0xbb86fc, emissive: 0x5d4380, beacon: 0xbb86fc, label: "#bb86fc" },
              { color: 0xff5252, emissive: 0x802929, beacon: 0xff5252, label: "#ff5252" },
              { color: 0xffab00, emissive: 0x805500, beacon: 0xffab00, label: "#ffab00" },
              { color: 0x00e676, emissive: 0x00733b, beacon: 0x00e676, label: "#00e676" },
            ][i] || { color: 0x00e5ff, emissive: 0x006b80, beacon: 0x00e5ff, label: "#00e5ff" },
          }));
        }
      }
    } catch { /* ignore */ }
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
  const wallBoxesRef = useRef([]);
  const torchFlamesRef = useRef([]);
  const currentStageRef = useRef(_saved?.stage ?? 0);
  const stageStartTimeRef = useRef(_saved?.stageStartTime ?? GAME_DURATION);
  const slowTimeRef = useRef(0);
  const shakeTimeRef = useRef(0);
  const isSlowedRef = useRef(false);

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
    // Initialize from server time if game is already running
    if (gameState?.startedAt && gameState?.status === 'playing') {
      const elapsed = Date.now() - new Date(gameState.startedAt).getTime() - (gameState.totalPausedMs || 0);
      return Math.max(0, GAME_DURATION - Math.floor(elapsed / 1000));
    }
    return GAME_DURATION;
  });
  const [currentStage, setCurrentStage] = useState(_saved?.stage ?? 0);
  const [stageCluesFound, setStageCluesFound] = useState(_saved?.stageCluesFound ?? []);
  const [stageTrashTriggered, setStageTrashTriggered] = useState(_saved?.stageTrashTriggered ?? []);
  const [nearClue, setNearClue] = useState(null);
  const [nearTrash, setNearTrash] = useState(null);
  const [showClue, setShowClue] = useState(null);
  const [showTrash, setShowTrash] = useState(null);
  const [showStageQuestion, setShowStageQuestion] = useState(false);
  const [stageAnswer, setStageAnswer] = useState("");
  const [stageWrongAttempts, setStageWrongAttempts] = useState(0);
  const [error, setError] = useState("");
  const [gameComplete, setGameComplete] = useState(_saved?.gameComplete ?? false);
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
      try { sessionStorage.removeItem(_smKey); } catch {}
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
      if (_smKey) try { sessionStorage.removeItem(_smKey); } catch {}
      // Compute time from server clock
      const elapsed = Date.now() - new Date(newStarted).getTime() - (gameState?.totalPausedMs || 0);
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
      // Re-sync from server clock each tick to stay accurate
      if (gameState?.startedAt) {
        const elapsed = Date.now() - new Date(gameState.startedAt).getTime() - (gameState?.totalPausedMs || 0);
        const remaining = Math.max(0, GAME_DURATION - Math.floor(elapsed / 1000));
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
  }, [gameComplete, gameOver, isPaused, gameState?.status, gameState?.startedAt, gameState?.totalPausedMs]);

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
    scene.background = new THREE.Color(0x05050e);
    scene.fog = new THREE.FogExp2(0x05050e, 0.030);
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Coarse stone-slab grid (spacing ~2 m)
    const grid = new THREE.GridHelper(50, 25, 0x18182e, 0x101020);
    grid.position.y = 0.011;
    scene.add(grid);
    // Fine mortar joints between slabs
    const fineGrid = new THREE.GridHelper(50, 100, 0x0e0e1c, 0x0c0c1a);
    fineGrid.position.y = 0.013;
    scene.add(fineGrid);

    // Central arcane summoning circle on the floor
    const arcaneRing1 = new THREE.Mesh(
      new THREE.RingGeometry(3.1, 3.4, 36),
      new THREE.MeshBasicMaterial({ color: 0x2a1a6e, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    );
    arcaneRing1.rotation.x = -Math.PI / 2;
    arcaneRing1.position.y = 0.015;
    scene.add(arcaneRing1);

    const arcaneRing2 = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 4.8, 36),
      new THREE.MeshBasicMaterial({ color: 0x1e1060, transparent: true, opacity: 0.2, side: THREE.DoubleSide }),
    );
    arcaneRing2.rotation.x = -Math.PI / 2;
    arcaneRing2.position.y = 0.015;
    scene.add(arcaneRing2);

    // Inner glow disc
    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 32),
      new THREE.MeshBasicMaterial({ color: 0x120a38, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 0.014;
    scene.add(glowDisc);

    // ── Stars — varied-colour night sky ──────────────
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors    = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3]     = (Math.random() - 0.5) * 220;
      starPositions[i * 3 + 1] = Math.random() * 65 + 20;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
      // White, faint-blue, or faint-purple tint
      const tint = Math.random();
      starColors[i * 3]     = tint < 0.6 ? 1.0 : tint < 0.8 ? 0.72 : 0.85;
      starColors[i * 3 + 1] = tint < 0.6 ? 1.0 : tint < 0.8 ? 0.72 : 0.6;
      starColors[i * 3 + 2] = tint < 0.6 ? 1.0 : tint < 0.8 ? 1.0  : 1.0;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color",    new THREE.BufferAttribute(starColors, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ vertexColors: true, size: 0.2, transparent: true, opacity: 0.82 }),
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
    [[-15, -15], [15, -15], [-15, 15], [15, 15]].forEach(([cx, cz]) => {
      const colGroup = new THREE.Group();
      // Base plinth
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.28, 0.82), colCapMat);
      plinth.position.y = 0.14;
      colGroup.add(plinth);
      // Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 3.5, 8), colMat);
      shaft.position.y = 2.05;
      colGroup.add(shaft);
      // Capital flare
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.27, 0.26, 8), colCapMat);
      capital.position.y = 4.0;
      colGroup.add(capital);
      // Abacus slab
      const abacus = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.92), colCapMat);
      abacus.position.y = 4.2;
      colGroup.add(abacus);
      // Subtle emissive rune ring at mid-column
      const colRuneMat = new THREE.MeshBasicMaterial({ color: 0x1e1040, transparent: true, opacity: 0.35 });
      const colRune = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 4, 16), colRuneMat);
      colRune.rotation.x = Math.PI / 2;
      colRune.position.y = 2.0;
      colGroup.add(colRune);
      colGroup.position.set(cx, 0, cz);
      scene.add(colGroup);
    });

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

    // ── Restore saved progress (if reloading mid-game) ───────────
    if (_saved) {
      // Restore stickman position
      stickman.group.position.set(_saved.posX ?? 0, 0, _saved.posZ ?? 0);
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
            .applyAxisAngle(
              new THREE.Vector3(0, 1, 0),
              cameraYawRef.current,
            );
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
      cameraYawRef.current += (cameraYawTargetRef.current - cameraYawRef.current) * Math.min(1, 12 * delta);
      cameraPitchRef.current += (cameraPitchTargetRef.current - cameraPitchRef.current) * Math.min(1, 12 * delta);
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
            // Consequences: slow-mo + camera shake (no time penalty)
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
          o.beacon.material.opacity =
            0.6 + Math.sin(time * 2 + i * 0.9) * 0.3;
        }
        // Rune ring: slow clockwise spin + gentle vertical bob
        if (o.runeRing) {
          o.runeRing.rotation.z += delta * (0.55 + (i % 3) * 0.1);
          o.runeRing.position.y = 0.72 + Math.sin(time * 1.1 + i * 0.8) * 0.18;
          o.runeRing.material.opacity = 0.38 + Math.sin(time * 1.8 + i * 1.1) * 0.16;
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
          t.flare.material.opacity = 0.2 + Math.sin(time * 8.5 + i * 1.9) * 0.12;
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
              prevMesh.userData._baseEmissive ?? prevMesh.material.emissiveIntensity;
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
          0.1,  // ~6° — keeps camera above ground
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
        Math.floor(timeSpent / 5) -
        trashHit * 20 -
        stageWrongAttempts * WRONG_ANSWER_PENALTY,
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

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
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
            🔑 {stageCluesFound.length}/{stg.clues.length}
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
          <div
            className={`sm-hud-pill sm-jump-pill${isJumping ? " jumping" : ""}${!jumpReady ? " cooldown" : ""}`}
          >
            🦘 {isJumping ? "JUMP!" : jumpReady ? "Ready" : "Cooldown"}
          </div>
          {hasKey && (
            <div className="sm-hud-pill sm-key-pill">🗝️ KEY</div>
          )}
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
            <kbd>Space</kbd> Jump &nbsp;· <kbd>Shift</kbd> Dash
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

      {/* ── Storyline intro modal ────────────────── */}
      {showStoryline && !gameOver && !gameComplete && !isPaused && gameState?.status === "playing" && (
        <div className="sm-overlay">
          <div className="sm-modal sm-storyline-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-icon">📜</div>
            <h3>Stage {currentStage + 1}: {stg.name}</h3>
            <p className="sm-storyline-text">{stg.storyline}</p>
            <p className="sm-objective-text"><strong>📌 Objective:</strong> {stg.objective}</p>
            <div className="sm-storyline-info">
              <span>🔑 Clues to find: {stg.clues.length}</span>
              <span>💀 Traps hidden: {stg.trash.length}</span>
              {currentStage > 0 && <span>⚠️ Difficulty increased!</span>}
            </div>
            <button className="sm-btn sm-btn-primary" onClick={() => { setShowStoryline(false); keysRef.current = {}; }}>
              ⚔️ Begin Exploration
            </button>
          </div>
        </div>
      )}

      {/* ── Key obtained modal ───────────────────── */}
      {showKeyObtained && hasKey && !showStageSummary && (
        <div className="sm-overlay">
          <div className="sm-modal sm-key-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sm-big-icon">🗝️</div>
            <h2>Key Obtained!</h2>
            <p className="sm-key-text">
              You solved the riddle of <strong>{stg.name}</strong>!
              A mysterious key materializes in your hand. Use it to unlock the door to the next stage.
            </p>
            <button className="sm-btn sm-btn-primary" onClick={() => setShowKeyObtained(false)}>
              🚪 Open the Door →
            </button>
          </div>
        </div>
      )}

      {/* ── Collected clue pills (current stage) ── */}
      {stageCluesFound.length > 0 && !anyModal && (
        <div className="sm-collected-pills">
          {stageCluesFound.map((idx) => {
            const clue = stg.clues[idx];
            if (!clue) return null;
            return (
              <span
                key={idx}
                className="sm-collected-pill"
                title={clue.clue}
                style={{
                  borderColor: stg.theme.label,
                  color: stg.theme.label,
                }}
              >
                ✅ {clue.name}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Proximity prompt — clue object ────────── */}
      {nearClue !== null && nearTrash === null && !anyModal && !isPaused && stg.clues[nearClue] && (
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
        !cartAnswerBlocked &&
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
        <div className="sm-overlay" onClick={() => { setShowClue(null); keysRef.current = {}; }}>
          <div
            className="sm-modal sm-clue-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm-modal-icon">🔍</div>
            <h3>{stg.clues[showClue]?.name ?? 'Clue'}</h3>
            <p className="sm-clue-text">{stg.clues[showClue]?.clue ?? ''}</p>
            <div className="sm-penalty-badge">
              ⏱ −{CLUE_PENALTY}s time penalty
            </div>
            <button className="sm-btn" onClick={() => { setShowClue(null); keysRef.current = {}; }}>
              Got it ({stageCluesFound.length}/{stg.clues.length} clues)
            </button>
          </div>
        </div>
      )}

      {/* ── Trash modal ───────────────────────────── */}
      {showTrash !== null && (
        <div className="sm-overlay" onClick={() => { setShowTrash(null); keysRef.current = {}; }}>
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
            <button className="sm-btn" onClick={() => { setShowTrash(null); keysRef.current = {}; }}>
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
              <h4>Your Collected Clues ({stageCluesFound.length}/{stg.clues.length})</h4>
              {stageCluesFound.map((idx, i) => {
                const clue = stg.clues[idx];
                if (!clue) return null;
                return (
                  <div key={idx} className="sm-review-row">
                    <span className="sm-review-num">#{i + 1}</span>
                    <span className="sm-review-name">{clue.name}:</span>
                    <span className="sm-review-clue">{clue.clue}</span>
                  </div>
                );
              })}
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
                setCartAnswerBlocked(true);
                interactCoolRef.current = true;
                // Clear all held keys — keyup events are missed while modal was open
                keysRef.current = {};
                setTimeout(() => {
                  setCartAnswerBlocked(false);
                  interactCoolRef.current = false;
                }, 600);
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
                setShowKeyObtained(false);
                const next = showStageSummary.stage + 1;
                setCurrentStage(next);
                currentStageRef.current = next;
                stageStartTimeRef.current = timeLeft;
                setStageCluesFound([]);
                setStageTrashTriggered([]);
                setStageWrongAttempts(0);
                setStageAnswer("");
                setError("");
                setHasKey(false);
                hasKeyRef.current = false;
                setShowStoryline(true);
                // Teleport player to a new random spot for the new stage
                if (stickmanRef.current) {
                  stickmanRef.current.group.position.set(0, 0, 0);
                  stickmanAngleRef.current = 0;
                }
              }}
            >
              {showStageSummary.stage < TOTAL_STAGES - 1
                ? `🗝️ Use Key → Enter Stage ${showStageSummary.stage + 2}: ${STAGES[showStageSummary.stage + 1].name}`
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
              <span>🔑 Clues: {stageCluesFound.length}/{stg.clues.length} (current stage)</span>
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

      {/* ── In-game player cards (bottom-right) ──── */}
      {!anyModal && !gameComplete && !gameOver && players.length > 1 && (
        <div className="sm-players-panel">
          <div className="sm-players-panel-title">Players</div>
          {players.map((p) => (
            <div
              key={p._id}
              className={`sm-player-row${p._id === currentPlayer?._id ? ' sm-player-me' : ''}`}
            >
              <span className="sm-player-name">
                {p._id === currentPlayer?._id ? '🙋' : '👤'} {p.name}
              </span>
              <span className="sm-player-stage">
                {`Stage ${p.progress.stage || '?'}/${p.progress.totalStages || '?'}`}
              </span>
            </div>
          ))}
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
