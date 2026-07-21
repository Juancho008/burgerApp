"""Genera una hamburguesa estilizada de alta calidad y la exporta a GLB.

Uso:
  blender -b -P tools/burger_blender.py -- --export public/burger.glb --render tools/preview.png
"""

import math
import random
import sys

import bpy
from mathutils import Vector

random.seed(11)

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg_value(flag, default=None):
    if flag in ARGS:
        return ARGS[ARGS.index(flag) + 1]
    return default


EXPORT_PATH = arg_value("--export")
RENDER_PATH = arg_value("--render")

# ---------------------------------------------------------------- utilidades


def srgb_to_linear(hex_color):
    raw = hex_color.lstrip("#")
    channels = [int(raw[i : i + 2], 16) / 255 for i in (0, 2, 4)]

    def lin(u):
        return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4

    return tuple(lin(u) for u in channels)


def new_material(name, hex_color, rough=0.6, coat=0.0, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(hex_color), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    for key in ("Coat Weight", "Clearcoat"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = coat
            break
    return mat


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def shade_smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def add_subsurf(obj, levels=2):
    mod = obj.modifiers.new("subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return mod


def add_displace(obj, strength=0.04, size=0.35, depth=2):
    tex = bpy.data.textures.new(f"noise_{obj.name}", type="CLOUDS")
    tex.noise_scale = size
    tex.noise_depth = depth
    mod = obj.modifiers.new("displace", "DISPLACE")
    mod.texture = tex
    mod.strength = strength
    return mod


def add_bevel(obj, width=0.08, segments=3):
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(35)
    return mod


PARTS = []


def register(obj, name):
    obj.name = name
    PARTS.append(obj)
    return obj


# ---------------------------------------------------------------- escena

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materiales

MAT_CRUST = new_material("bun_crust", "#DE9440", rough=0.56, coat=0.1)
MAT_CRUMB = new_material("bun_crumb", "#F6E2B0", rough=0.8)
MAT_SEED = new_material("sesame", "#F7E9C4", rough=0.5)
MAT_PATTY = new_material("patty", "#3E2010", rough=0.85)
MAT_CHEESE = new_material("cheese", "#F8981D", rough=0.34, coat=0.3)
MAT_LETTUCE = new_material("lettuce", "#54A22B", rough=0.45)
MAT_TOMATO = new_material("tomato_skin", "#C22A1A", rough=0.3, coat=0.65)
MAT_TOMATO_IN = new_material("tomato_flesh", "#E25B3C", rough=0.55)
MAT_ONION = new_material("onion", "#C9873B", rough=0.58, coat=0.05)
MAT_SAUCE = new_material("sauce", "#C13D10", rough=0.22, coat=0.55)
MAT_BACON = new_material("bacon_meat", "#7E2C18", rough=0.48, coat=0.2)
MAT_BACON_FAT = new_material("bacon_fat", "#E8B67E", rough=0.5)

# ------------------------------------------------------------- pan inferior

bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=1.13, depth=0.44, location=(0, 0, 0.22))
bottom_bun = register(bpy.context.object, "bottom_bun")
add_bevel(bottom_bun, width=0.13, segments=4)
add_subsurf(bottom_bun, 1)
add_displace(bottom_bun, strength=0.022, size=0.5)
shade_smooth(bottom_bun)
assign(bottom_bun, MAT_CRUST)

bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.1, depth=0.03, location=(0, 0, 0.45))
crumb = register(bpy.context.object, "bottom_crumb")
shade_smooth(crumb)
assign(crumb, MAT_CRUMB)

# ------------------------------------------------------------------- salsa

bpy.ops.mesh.primitive_torus_add(
    major_segments=72, minor_segments=18, major_radius=1.0, minor_radius=0.07, location=(0, 0, 0.47)
)
sauce = register(bpy.context.object, "sauce")
sauce.scale = (1.0, 1.0, 0.55)
add_displace(sauce, strength=0.03, size=0.25)
shade_smooth(sauce)
assign(sauce, MAT_SAUCE)

# ----------------------------------------------------------------- lechuga


def make_lettuce(name, z, radius, ruffle_amp, phase):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=36, radius=radius, location=(0, 0, z))
    leaf = register(bpy.context.object, name)
    mesh = leaf.data
    for v in mesh.vertices:
        r_xy = math.hypot(v.co.x, v.co.y)
        theta = math.atan2(v.co.y, v.co.x)
        factor = max(0.0, min(1.0, (r_xy - radius * 0.5) / (radius * 0.5)))
        v.co.z *= 0.035
        v.co.z += factor * ruffle_amp * math.sin(theta * 7 + phase + r_xy * 2.5)
        v.co.z -= (factor**2) * 0.1
        wobble = 1 + factor * 0.11 * math.sin(theta * 11 + phase * 2)
        v.co.x *= wobble
        v.co.y *= wobble
    add_subsurf(leaf, 1)
    shade_smooth(leaf)
    assign(leaf, MAT_LETTUCE)
    return leaf


make_lettuce("lettuce_a", 0.5, 1.34, 0.09, 0.0)
make_lettuce("lettuce_b", 0.55, 1.27, 0.085, 2.1)

# ----------------------------------------------------------------- tomates


def make_tomato(name, x, y, rot_z):
    bpy.ops.mesh.primitive_cylinder_add(vertices=56, radius=0.6, depth=0.11, location=(x, y, 0.64))
    slice_obj = register(bpy.context.object, name)
    slice_obj.rotation_euler = (0, 0, rot_z)
    add_bevel(slice_obj, width=0.03, segments=2)
    add_subsurf(slice_obj, 1)
    shade_smooth(slice_obj)
    assign(slice_obj, MAT_TOMATO)

    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.5, depth=0.012, location=(x, y, 0.7))
    inner = register(bpy.context.object, name + "_flesh")
    shade_smooth(inner)
    assign(inner, MAT_TOMATO_IN)


for i in range(3):
    angle = 0.35 + i * (math.tau / 3)
    make_tomato(f"tomato_{i}", math.cos(angle) * 0.56, math.sin(angle) * 0.56, angle)

# --------------------------------------------------------------------- carne

bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=1.06, depth=0.4, location=(0, 0, 0.86))
patty = register(bpy.context.object, "patty")
add_bevel(patty, width=0.11, segments=4)
add_subsurf(patty, 2)
add_displace(patty, strength=0.05, size=0.17, depth=4)
shade_smooth(patty)
assign(patty, MAT_PATTY)

# --------------------------------------------------------------------- queso

bpy.ops.mesh.primitive_grid_add(x_subdivisions=34, y_subdivisions=34, size=2.35, location=(0, 0, 1.2))
cheese = register(bpy.context.object, "cheese")
cheese.rotation_euler = (0, 0, math.radians(21))
mesh = cheese.data
drape_start = 0.7
for v in mesh.vertices:
    r_xy = math.hypot(v.co.x, v.co.y)
    if r_xy > drape_start:
        over = r_xy - drape_start
        v.co.z -= (over**1.5) * 0.55
        pull = 1 - 0.15 * (over / 1.1)
        v.co.x *= pull
        v.co.y *= pull
    v.co.z += 0.014 * math.sin(v.co.x * 9) + 0.012 * math.cos(v.co.y * 8)
solidify = cheese.modifiers.new("solidify", "SOLIDIFY")
solidify.thickness = 0.06
add_subsurf(cheese, 2)
shade_smooth(cheese)
assign(cheese, MAT_CHEESE)

# --------------------------------------------------------------------- bacon


def make_bacon(name, location, rot_z, phase):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=56, y_subdivisions=10, size=1.0, location=location)
    strip = register(bpy.context.object, name)
    strip.rotation_euler = (0, 0, rot_z)
    mesh = strip.data
    half_width = 0.19
    for v in mesh.vertices:
        v.co.x *= 2.55
        v.co.y *= 2 * half_width
        v.co.z += 0.05 * math.sin(v.co.x * 8.5 + phase)
        v.co.y += 0.025 * math.sin(v.co.x * 3.6 + phase)
        overhang = abs(v.co.x) - 1.02
        if overhang > 0:
            v.co.z -= (overhang**1.5) * 1.25
            v.co.x *= 1 - 0.05 * (overhang / 0.26)
    mesh.materials.append(MAT_BACON)
    mesh.materials.append(MAT_BACON_FAT)
    for poly in mesh.polygons:
        lane = poly.center.y / half_width
        poly.material_index = 1 if (abs(lane) > 0.62 or abs(lane) < 0.14) else 0
    solid = strip.modifiers.new("solidify", "SOLIDIFY")
    solid.thickness = 0.04
    add_subsurf(strip, 1)
    shade_smooth(strip)


make_bacon("bacon_a", (0.05, -0.18, 1.21), math.radians(24), 0.6)
make_bacon("bacon_b", (-0.04, 0.16, 1.23), math.radians(-32), 2.4)

# ------------------------------------------------------------------- cebolla

onion_spots = (
    (0.52, 0.34, 0.2),
    (-0.6, 0.14, -0.16),
    (0.08, -0.58, 0.12),
    (-0.18, 0.6, 0.3),
    (0.62, -0.3, -0.25),
)
for i, (ox, oy, rot) in enumerate(onion_spots):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=48,
        minor_segments=14,
        major_radius=0.24 + (i % 3) * 0.05,
        minor_radius=0.042,
        location=(ox, oy, 1.27),
    )
    ring = register(bpy.context.object, f"onion_{i}")
    ring.rotation_euler = (rot, rot * 0.7, random.uniform(0, 3))
    add_displace(ring, strength=0.03, size=0.15)
    shade_smooth(ring)
    assign(ring, MAT_ONION)

# -------------------------------------------------------------- pan superior

bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.99, depth=0.09, location=(0, 0, 1.37))
top_crumb = register(bpy.context.object, "top_crumb")
add_bevel(top_crumb, width=0.03, segments=2)
shade_smooth(top_crumb)
assign(top_crumb, MAT_CRUMB)

bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=40, radius=1.18, location=(0, 0, 1.48))
top_bun = register(bpy.context.object, "top_bun")
mesh = top_bun.data
for v in mesh.vertices:
    if v.co.z >= 0:
        v.co.z *= 0.62
    else:
        v.co.z *= 0.1
        v.co.x *= 0.99
        v.co.y *= 0.99
add_subsurf(top_bun, 1)
add_displace(top_bun, strength=0.024, size=0.55)
shade_smooth(top_bun)
assign(top_bun, MAT_CRUST)

# sésamo distribuido sobre la cúpula
seed_count = 0
attempts = 0
placed = []
while seed_count < 85 and attempts < 4000:
    attempts += 1
    u = random.uniform(-1, 1)
    w = random.uniform(-1, 1)
    if u * u + w * w > 1:
        continue
    z_dir = math.sqrt(max(0.0, 1 - (u * u + w * w)))
    if z_dir < 0.34:
        continue
    direction = Vector((u, w, z_dir))
    too_close = any((Vector(p) - direction).length < 0.11 for p in placed)
    if too_close:
        continue
    placed.append(direction[:])
    surface = Vector((direction.x * 1.18, direction.y * 1.18, direction.z * 1.18 * 0.62)) * 0.995
    world_pos = surface + Vector((0, 0, 1.48))
    normal = Vector((direction.x, direction.y, direction.z * 1.55)).normalized()

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1.0, location=world_pos)
    seed = register(bpy.context.object, f"seed_{seed_count}")
    size = random.uniform(0.85, 1.15)
    seed.scale = (0.041 * size, 0.026 * size, 0.012 * size)
    quat = normal.to_track_quat("Z", "X")
    seed.rotation_mode = "QUATERNION"
    seed.rotation_quaternion = quat
    seed.rotation_mode = "XYZ"
    seed.rotation_euler.rotate_axis("Z", random.uniform(0, math.pi))
    shade_smooth(seed)
    assign(seed, MAT_SEED)
    seed_count += 1

# ---------------------------------------------------------------- iluminación

world = bpy.data.worlds.new("world")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.26, 0.23, 0.21, 1.0)
bg.inputs[1].default_value = 0.65
scene.world = world

TARGET = Vector((0, 0, 1.05))


def aim(obj, target=TARGET):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.light_add(type="SUN", location=(2.6, -2.2, 3.6))
sun = bpy.context.object
sun.data.energy = 3.4
sun.data.color = (1.0, 0.9, 0.74)
sun.data.angle = math.radians(12)
aim(sun)

bpy.ops.object.light_add(type="AREA", location=(-3.4, -1.6, 1.9))
fill = bpy.context.object
fill.data.energy = 160
fill.data.size = 4.5
fill.data.color = (1.0, 0.95, 0.9)
aim(fill)

bpy.ops.object.light_add(type="AREA", location=(0.6, 3.4, 2.3))
rim = bpy.context.object
rim.data.energy = 240
rim.data.size = 3.5
rim.data.color = (1.0, 0.62, 0.34)
aim(rim)

bpy.ops.object.camera_add(location=(3.3, -3.3, 2.1))
camera = bpy.context.object
camera.data.lens = 50
aim(camera)
scene.camera = camera

# ------------------------------------------------------------------- salida

scene.render.engine = "CYCLES"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900

if RENDER_PATH:
    scene.render.filepath = RENDER_PATH
    bpy.ops.render.render(write_still=True)

if EXPORT_PATH:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=EXPORT_PATH, use_selection=True, export_apply=True)

# bounding box del conjunto para el encuadre en three.js
low = Vector((1e9, 1e9, 1e9))
high = Vector((-1e9, -1e9, -1e9))
depsgraph = bpy.context.evaluated_depsgraph_get()
for obj in PARTS:
    evaluated = obj.evaluated_get(depsgraph)
    for corner in evaluated.bound_box:
        world_corner = evaluated.matrix_world @ Vector(corner)
        low = Vector(map(min, low, world_corner))
        high = Vector(map(max, high, world_corner))
print(f"BBOX min={tuple(round(c, 3) for c in low)} max={tuple(round(c, 3) for c in high)}")
print("BURGER DONE")
"""
# ---------------------------
     `    ``               `
      ``  _ `      `       ``
     `   |_| `  `` ``    `  `
    ``  -___-_` `   ` --------------
  ``   /      )      | This is fine |`
 `____/| (0) (0)_()  |/-------------  `
/|   | |   ^____)      ``      ``
||   |_|    \_//     Uɔ````   `` ``
||    || |    |    ========`  ``  ``
||    || |    |      ||     ``   `
||     \\_\   |\     ||   ```    `
=========||====||    ||  ``       `
  || ||   \Ɔ || \Ɔ   ||   ``    ``
  || ||      ||      ||  `     ``
-------------------------------
"""