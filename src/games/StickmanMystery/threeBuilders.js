import * as THREE from "three";
import { INTERACT_DIST, CART_INTERACT_DIST, CART_POS } from "./constants.js";

/** Resolve object shape id to a Three.js mesh — higher-quality geometry */
export function resolveObjectShape(shapeId, mainMat) {
  switch (shapeId) {
    case "chest": {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.72), mainMat);
      body.position.y = 0.72;
      grp.add(body);
      const ridgeMat = mainMat.clone();
      ridgeMat.emissiveIntensity = Math.min((ridgeMat.emissiveIntensity ?? 0.5) + 0.4, 1.2);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.1, 0.74), ridgeMat);
      ridge.position.y = 1.07;
      grp.add(ridge);
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

/** Create a billboard text sprite */
export function createTextSprite(text, color = "#ffffff") {
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
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 1, 1);
  return sprite;
}

/** Build the stickman character (returns object with group + limb refs) */
export function buildStickman(color = 0x00ffd0) {
  const group = new THREE.Group();
  const emissive = new THREE.Color(color).multiplyScalar(0.4);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    roughness: 0.5,
    metalness: 0.2,
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
  head.position.y = 1.9;
  group.add(head);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), mat);
  body.position.y = 1.25;
  group.add(body);

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
export function buildObjectMesh(objData, index) {
  const group = new THREE.Group();

  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x252535,
    emissive: 0x0a0a18,
    emissiveIntensity: 0.3,
    roughness: 0.88,
    metalness: 0.18,
  });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.68, 0.42, 7), pedMat);
  pedestal.position.y = 0.21;
  group.add(pedestal);

  const bandMat = new THREE.MeshStandardMaterial({
    color: objData.color,
    emissive: objData.emissive,
    emissiveIntensity: 0.35,
    roughness: 0.6,
    metalness: 0.25,
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 4, 18), bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.28;
  group.add(band);

  const mainMat = new THREE.MeshStandardMaterial({
    color: objData.color,
    emissive: objData.emissive,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.35,
  });
  const mainMesh = resolveObjectShape(objData.objectShape || "chest", mainMat);
  group.add(mainMesh);

  const beaconMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), beaconMat);
  beacon.position.y = 2.5;
  group.add(beacon);

  const runeRingMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.5,
  });
  const runeRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.028, 4, 28), runeRingMat);
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.72;
  group.add(runeRing);

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

  const poolMat = new THREE.MeshBasicMaterial({
    color: objData.beaconColor,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  group.add(pool);

  const label = createTextSprite(objData.name, objData.labelColor || "#ffffff");
  label.position.y = 2.4;
  group.add(label);

  group.position.set(objData.pos[0], objData.pos[1], objData.pos[2]);

  return { group, mesh: mainMesh, beacon, runeRing, ring, light: null, label };
}

/** Build the answer cart — the player must come here to submit their answer */
export function buildCartMesh() {
  const group = new THREE.Group();

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

  const railMat = new THREE.MeshStandardMaterial({ color: 0x6b4f12, roughness: 0.8 });
  [[-0.85, 1.2, 0], [0.85, 1.2, 0]].forEach(([rx, ry, rz]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.1), railMat);
    rail.position.set(rx, ry, rz);
    rail.castShadow = true;
    group.add(rail);
  });

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.75, metalness: 0.4 });
  const wheelGeo = new THREE.TorusGeometry(0.25, 0.06, 5, 10);
  [[-0.7, 0.25, 0.6], [0.7, 0.25, 0.6], [-0.7, 0.25, -0.6], [0.7, 0.25, -0.6]].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wy, wz);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });

  const scrollMat = new THREE.MeshStandardMaterial({
    color: 0xf5deb3,
    emissive: 0xdaa520,
    emissiveIntensity: 0.6,
    roughness: 0.4,
  });
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 7), scrollMat);
  scroll.position.y = 1.35;
  scroll.rotation.z = Math.PI / 2;
  scroll.castShadow = true;
  group.add(scroll);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff6b35,
    emissive: 0xff6b35,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), beaconMat);
  beacon.position.y = 2.8;
  group.add(beacon);

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

  const light = new THREE.PointLight(0xff6b35, 2.5, 14);
  light.position.y = 2.2;
  group.add(light);

  const label = createTextSprite("Answer Cart", "#ff6b35");
  label.position.y = 2.6;
  group.add(label);

  group.position.set(CART_POS[0], CART_POS[1], CART_POS[2]);

  return { group, beacon, ring, light, scroll };
}

/** Build a wall mesh from segment data — white dungeon stone */
export function buildWallMesh(w) {
  const group = new THREE.Group();
  const isPerimeter = w.w >= 50 || w.d >= 50;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xf0f0f0,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    metalness: 0.05,
  });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), mat);
  wall.position.set(w.x, w.h / 2, w.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const capMat = new THREE.MeshStandardMaterial({
    color: 0xdcdcdc,
    emissive: 0xeaeaea,
    emissiveIntensity: 0.05,
    roughness: 0.85,
    metalness: 0.03,
  });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.1, 0.14, w.d + 0.1), capMat);
  cap.position.set(w.x, w.h + 0.07, w.z);
  cap.receiveShadow = true;
  group.add(cap);

  if (isPerimeter && w.h >= 3) {
    const grooveMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 1.0, metalness: 0.0 });
    [1.0, 2.0].forEach((gy) => {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(w.w + 0.05, 0.06, w.d + 0.05), grooveMat);
      groove.position.set(w.x, gy, w.z);
      group.add(groove);
    });
  }

  return group;
}

/** Build a wall-mounted torch (returns group with animated flame refs) */
export function buildTorch(x, y, z) {
  const group = new THREE.Group();

  const bracketMat = new THREE.MeshStandardMaterial({ color: 0x2e1e08, roughness: 0.7, metalness: 0.65 });
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.32, 5), bracketMat);
  bracket.position.set(x, y - 0.04, z);
  group.add(bracket);

  const cupMat = new THREE.MeshStandardMaterial({ color: 0x4a3010, roughness: 0.65, metalness: 0.7 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.065, 0.14, 6), cupMat);
  cup.position.set(x, y + 0.16, z);
  group.add(cup);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.78 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 7), flameMat);
  flame.position.set(x, y + 0.41, z);
  group.add(flame);

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.95 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), coreMat);
  core.position.set(x, y + 0.29, z);
  group.add(core);

  const flareMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.28 });
  const flare = new THREE.Mesh(new THREE.SphereGeometry(0.21, 6, 5), flareMat);
  flare.position.set(x, y + 0.34, z);
  group.add(flare);

  const torchLight = new THREE.PointLight(0xff6622, 1.1, 11);
  torchLight.position.set(x, y + 0.42, z);
  torchLight.castShadow = false;
  group.add(torchLight);

  return { group, flame, core, flare, light: torchLight };
}

/** Build a trash object — looks similar to clues but with subtle warning hints */
export function buildTrashMesh(trashData, shapeIdx) {
  const group = new THREE.Group();

  const pedMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.85, metalness: 0.15 });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 6), pedMat);
  pedestal.position.y = 0.2;
  group.add(pedestal);

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
      mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.65), mainMat);
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
      mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.13, 0.9), mainMat);
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

  const beaconMat = new THREE.MeshBasicMaterial({ color: trashData.beaconColor, transparent: true, opacity: 0.9 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), beaconMat);
  beacon.position.y = 2.5;
  group.add(beacon);

  const ringColor = new THREE.Color(trashData.beaconColor).lerp(new THREE.Color(0xff4444), 0.25);
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

  const label = createTextSprite(trashData.name, trashData.labelColor || "#ffffff");
  label.position.y = 2.4;
  group.add(label);

  const warnMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.8 });
  const warnDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5), warnMat);
  warnDot.position.set(0.8, 1.5, 0);
  group.add(warnDot);

  return { group, mesh: mainMesh, beacon, ring, light: null, label, warnDot };
}
