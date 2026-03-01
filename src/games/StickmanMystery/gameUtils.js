/** Check if a point is inside any wall (with padding radius) */
export function isInsideWall(x, z, radius, walls) {
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
export function generateRandomPos(existing, walls, minDist, boundary, avoidCenter) {
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
export function resolveCollisions(pos, walls, radius) {
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

/** Simple djb2 string hash → unsigned 32-bit integer (shared seed for all clients) */
export function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Creates a fast LCG pseudo-random number generator from a seed integer */
export function makePrng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Same as generateRandomPos but uses a seeded rng() so all clients get identical layouts */
export function generateRandomPosSeeded(rng, existing, walls, minDist, boundary, avoidCenter) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = (rng() - 0.5) * boundary * 2;
    const z = (rng() - 0.5) * boundary * 2;
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
