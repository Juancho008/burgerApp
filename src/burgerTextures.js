import * as THREE from 'three'

const textureCache = new Map()

function hash(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x, y, seed = 0) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const a = hash(ix, iy, seed)
  const b = hash(ix + 1, iy, seed)
  const c = hash(ix, iy + 1, seed)
  const d = hash(ix + 1, iy + 1, seed)
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm(x, y, octaves = 4, seed = 0) {
  let value = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq, seed + i * 17)
    amp *= 0.5
    freq *= 2
  }
  return value
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixColor(c1, c2, t) {
  return [
    lerp(c1[0], c2[0], t),
    lerp(c1[1], c2[1], t),
    lerp(c1[2], c2[2], t),
  ]
}

function createCanvas(size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) }
}

function createTextureFromCanvas(canvas, colorSpace = THREE.SRGBColorSpace) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = colorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function createNormalMapFromHeights(heights, size, strength = 2.5) {
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x
      const hL = heights[idxAt(heights, size, x - 1, y)]
      const hR = heights[idxAt(heights, size, x + 1, y)]
      const hD = heights[idxAt(heights, size, x, y - 1)]
      const hU = heights[idxAt(heights, size, x, y + 1)]

      let nx = (hL - hR) * strength
      let ny = (hD - hU) * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len

      const i = idx * 4
      data[i] = (nx * 0.5 + 0.5) * 255
      data[i + 1] = (ny * 0.5 + 0.5) * 255
      data[i + 2] = (nz * 0.5 + 0.5) * 255
      data[i + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function createRoughnessMapFromHeights(heights, size, base = 0.5, range = 0.35) {
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const rough = clamp01(base + (heights[i] - 0.5) * range * 2)
    const v = rough * 255
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function idxAt(heights, size, x, y) {
  const cx = (x + size) % size
  const cy = (y + size) % size
  return cy * size + cx
}

function bakeSurface(size, drawPixel) {
  const { canvas, ctx } = createCanvas(size)
  const image = ctx.createImageData(size, size)
  const heights = new Float32Array(size * size)
  const meta = drawPixel(0.5, 0.5, 0, 0)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const sample = drawPixel(u, v, x, y)
      const idx = y * size + x
      heights[idx] = sample.height ?? 0.5

      const i = idx * 4
      image.data[i] = sample.color[0] * 255
      image.data[i + 1] = sample.color[1] * 255
      image.data[i + 2] = sample.color[2] * 255
      image.data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)

  return {
    map: createTextureFromCanvas(canvas),
    normalMap: createNormalMapFromHeights(heights, size, meta.normalStrength ?? 2.2),
    roughnessMap: createRoughnessMapFromHeights(
      heights,
      size,
      meta.roughBase ?? 0.5,
      meta.roughRange ?? 0.3,
    ),
  }
}

const SURFACE_BUILDERS = {
  bun_crust(u, v) {
    const grain = fbm(u * 18, v * 18, 5, 2)
    const pore = fbm(u * 42, v * 42, 3, 9)
    const toast = fbm(u * 6, v * 6, 2, 4)
    const height = grain * 0.55 + pore * 0.45
    const color = mixColor([0.78, 0.48, 0.22], [0.95, 0.72, 0.38], toast)
    const dark = mixColor(color, [0.45, 0.24, 0.1], pore * 0.35)
    return { color: dark, height, normalStrength: 2.8, roughBase: 0.58, roughRange: 0.28 }
  },

  bun_crumb(u, v) {
    const fine = fbm(u * 28, v * 28, 4, 1)
    const soft = fbm(u * 9, v * 9, 2, 6)
    const height = fine * 0.65 + soft * 0.35
    const color = mixColor([0.96, 0.88, 0.66], [0.99, 0.95, 0.82], soft)
    return { color: mixColor(color, [0.86, 0.74, 0.5], fine * 0.2), height, normalStrength: 1.8, roughBase: 0.78, roughRange: 0.18 }
  },

  sesame(u, v) {
    const speck = fbm(u * 30, v * 30, 3, 3)
    const height = 0.55 + speck * 0.25
    const color = mixColor([0.97, 0.9, 0.68], [0.9, 0.8, 0.55], speck * 0.4)
    return { color, height, normalStrength: 1.4, roughBase: 0.42, roughRange: 0.2 }
  },

  patty(u, v) {
    const grain = fbm(u * 22, v * 22, 4, 5)
    const char = fbm(u * 8, v * 8, 3, 11)
    const grillA = Math.abs(Math.sin((u * 14 + v * 2) * Math.PI))
    const grillB = Math.abs(Math.sin((v * 14 - u * 2) * Math.PI))
    const grill = Math.max(0, 1 - grillA * 0.85) * Math.max(0, 1 - grillB * 0.85)
    const height = grain * 0.5 + char * 0.35 + grill * 0.15
    let color = mixColor([0.22, 0.1, 0.05], [0.42, 0.2, 0.1], grain)
    color = mixColor(color, [0.08, 0.03, 0.02], char * 0.55)
    color = mixColor(color, [0.55, 0.28, 0.12], grill * 0.25)
    return { color, height, normalStrength: 3.2, roughBase: 0.82, roughRange: 0.22 }
  },

  cheese(u, v) {
    const melt = fbm(u * 10, v * 10, 3, 7)
    const ripple = Math.sin((u * 9 + melt * 2) * Math.PI * 2) * 0.5 + 0.5
    const height = melt * 0.45 + ripple * 0.25
    const color = mixColor([0.98, 0.62, 0.12], [1, 0.82, 0.28], ripple * 0.6)
    return { color: mixColor(color, [0.9, 0.45, 0.05], melt * 0.2), height, normalStrength: 1.6, roughBase: 0.28, roughRange: 0.18 }
  },

  lettuce(u, v) {
    const vein = Math.abs(Math.sin((u * 10 + fbm(u * 4, v * 4, 2, 2) * 2) * Math.PI))
    const leaf = fbm(u * 16, v * 16, 4, 8)
    const height = leaf * 0.6 + vein * 0.4
    const color = mixColor([0.2, 0.55, 0.14], [0.45, 0.78, 0.22], leaf)
    return { color: mixColor(color, [0.12, 0.35, 0.08], vein * 0.5), height, normalStrength: 2.4, roughBase: 0.48, roughRange: 0.25 }
  },

  tomato_skin(u, v) {
    const skin = fbm(u * 14, v * 14, 3, 4)
    const seeds = fbm(u * 55, v * 55, 2, 15)
    const height = skin * 0.7 + (seeds > 0.72 ? 0.35 : 0)
    let color = mixColor([0.72, 0.12, 0.08], [0.9, 0.28, 0.12], skin)
    if (seeds > 0.74) color = mixColor(color, [0.95, 0.82, 0.35], 0.55)
    return { color, height, normalStrength: 2, roughBase: 0.22, roughRange: 0.2 }
  },

  tomato_flesh(u, v) {
    const pulp = fbm(u * 12, v * 12, 3, 6)
    const segment = Math.sin((u + v) * Math.PI * 5) * 0.5 + 0.5
    const height = pulp * 0.55 + segment * 0.2
    const color = mixColor([0.88, 0.32, 0.22], [0.95, 0.55, 0.38], segment)
    return { color: mixColor(color, [0.75, 0.2, 0.15], pulp * 0.25), height, normalStrength: 1.5, roughBase: 0.45, roughRange: 0.2 }
  },

  onion(u, v) {
    const ring = Math.sin(Math.hypot(u - 0.5, v - 0.5) * 38) * 0.5 + 0.5
    const layer = fbm(u * 20, v * 20, 2, 3)
    const height = ring * 0.45 + layer * 0.35
    const color = mixColor([0.92, 0.82, 0.72], [0.72, 0.45, 0.62], ring)
    return { color: mixColor(color, [0.55, 0.28, 0.42], layer * 0.3), height, normalStrength: 2.2, roughBase: 0.55, roughRange: 0.22 }
  },

  sauce(u, v) {
    const gloss = fbm(u * 24, v * 24, 2, 1)
    const bubble = fbm(u * 60, v * 60, 2, 9)
    const height = gloss * 0.25 + (bubble > 0.8 ? 0.2 : 0)
    const color = mixColor([0.72, 0.18, 0.06], [0.9, 0.32, 0.1], gloss)
    return { color, height, normalStrength: 1.2, roughBase: 0.12, roughRange: 0.1 }
  },

  bacon_meat(u, v) {
    const streak = Math.sin((v * 18 + fbm(u * 3, v * 3, 2, 2)) * Math.PI) * 0.5 + 0.5
    const crisp = fbm(u * 26, v * 26, 3, 5)
    const height = streak * 0.4 + crisp * 0.45
    const color = mixColor([0.42, 0.12, 0.08], [0.62, 0.22, 0.12], streak)
    return { color: mixColor(color, [0.2, 0.06, 0.04], crisp * 0.35), height, normalStrength: 2.6, roughBase: 0.5, roughRange: 0.25 }
  },

  bacon_fat(u, v) {
    const streak = Math.sin((v * 16 + fbm(u * 4, v * 4, 2, 8) * 1.5) * Math.PI) * 0.5 + 0.5
    const gloss = fbm(u * 18, v * 18, 2, 2)
    const height = streak * 0.35 + gloss * 0.3
    const color = mixColor([0.95, 0.78, 0.55], [0.98, 0.9, 0.75], gloss)
    return { color: mixColor(color, [0.85, 0.55, 0.35], 1 - streak), height, normalStrength: 1.8, roughBase: 0.38, roughRange: 0.2 }
  },
}

const MATERIAL_TUNING = {
  bun_crust: { roughness: 0.56, clearcoat: 0.12, clearcoatRoughness: 0.35 },
  bun_crumb: { roughness: 0.78 },
  sesame: { roughness: 0.38, clearcoat: 0.25, clearcoatRoughness: 0.2 },
  patty: { roughness: 0.84 },
  cheese: { roughness: 0.22, clearcoat: 0.55, clearcoatRoughness: 0.18 },
  lettuce: { roughness: 0.42 },
  tomato_skin: { roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.12 },
  tomato_flesh: { roughness: 0.38 },
  onion: { roughness: 0.52, clearcoat: 0.08, clearcoatRoughness: 0.3 },
  sauce: { roughness: 0.08, clearcoat: 0.85, clearcoatRoughness: 0.08 },
  bacon_meat: { roughness: 0.46, clearcoat: 0.15, clearcoatRoughness: 0.25 },
  bacon_fat: { roughness: 0.35, clearcoat: 0.2, clearcoatRoughness: 0.2 },
}

function getTexturesForMaterial(name, resolution) {
  const key = `${name}-${resolution}`
  if (textureCache.has(key)) return textureCache.get(key)

  const builder = SURFACE_BUILDERS[name]
  if (!builder) return null

  const textures = bakeSurface(resolution, (u, v) => builder(u, v))
  textureCache.set(key, textures)
  return textures
}

function applyTextures(material, resolution) {
  const textures = getTexturesForMaterial(material.name, resolution)
  if (!textures) return

  material.map = textures.map
  material.normalMap = textures.normalMap
  material.roughnessMap = textures.roughnessMap
  material.normalScale = new THREE.Vector2(0.85, 0.85)

  const tuning = MATERIAL_TUNING[material.name]
  if (tuning) {
    if (tuning.roughness !== undefined) material.roughness = tuning.roughness
    if (tuning.clearcoat !== undefined) material.clearcoat = tuning.clearcoat
    if (tuning.clearcoatRoughness !== undefined) material.clearcoatRoughness = tuning.clearcoatRoughness
  }

  material.metalness = 0
  material.needsUpdate = true
}

export function enhanceBurgerMaterials(root, { resolution = 512 } = {}) {
  const materials = new Set()

  root.traverse((child) => {
    if (!child.isMesh) return

    const meshMaterials = Array.isArray(child.material) ? child.material : [child.material]
    meshMaterials.forEach((material) => {
      if (!material || materials.has(material)) return
      materials.add(material)
      applyTextures(material, resolution)
    })
  })
}
