"""Clean a raw image-to-3D character for the game.

Imports assets-src/models/<name>_raw.glb, stands it on the ground at a fixed height,
reduces the triangle count, shrinks the texture, exports public/models/characters/<name>.glb
and renders front / three-quarter / side previews to docs/previews/.

Run:  Blender -b -P scripts/blender/character.py -- tusk teal
"""
import math, os, sys
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HEIGHT, TARGET_TRIS, TEX = 1.8, 40000, 1024


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), \
           Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))


def tris(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


def clean(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f"{ROOT}/assets-src/models/{name}_raw.glb")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    before = tris(meshes)

    # One object, transforms applied, feet on the ground, fixed height, facing -Y (Blender front).
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lo, hi = bounds([o])
    s = HEIGHT / (hi.z - lo.z)
    o.scale = (s, s, s)
    o.location = (-(lo.x + hi.x) / 2 * s, -(lo.y + hi.y) / 2 * s, -lo.z * s)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for other in [x for x in bpy.context.scene.objects if x != o]:
        bpy.data.objects.remove(other)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.object.mode_set(mode="OBJECT")
    if tris([o]) > TARGET_TRIS:
        d = o.modifiers.new("decimate", "DECIMATE")
        d.ratio = TARGET_TRIS / tris([o])
        bpy.ops.object.modifier_apply(modifier="decimate")
    bpy.ops.object.shade_smooth()

    sizes = []
    for img in bpy.data.images:
        if img.size[0] > TEX:
            sizes.append(tuple(img.size))
            img.scale(TEX, TEX)
    lo, hi = bounds([o])
    print(f"CHAR {name}: {before} -> {tris([o])} triangles, textures {sizes} -> {TEX}, "
          f"size {hi.x - lo.x:.2f} wide x {hi.y - lo.y:.2f} deep x {hi.z - lo.z:.2f} tall, materials {len(o.data.materials)}")

    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=f"{ROOT}/public/models/characters/{name}.glb", export_format="GLB",
                              use_selection=True, export_yup=True, export_image_format="WEBP", export_image_quality=85)
    return o


def previews(name):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples, sc.cycles.use_denoising = 48, True
    sc.render.resolution_x, sc.render.resolution_y = 700, 900
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.1, 0.09, 0.14, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    sc.world = w
    mid = Vector((0, 0, HEIGHT / 2))
    for kind, loc, energy, size in (("key", (2, -3, 3), 500, 3), ("fill", (-3, -2, 1.5), 150, 4), ("rim", (-1.5, 3, 3), 500, 2)):
        d = bpy.data.lights.new(kind, "AREA")
        d.energy, d.size = energy, size
        l = bpy.data.objects.new(kind, d)
        l.location = loc
        l.rotation_euler = (mid - l.location).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(l)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 70
    sc.collection.objects.link(cam)
    sc.camera = cam
    for view, ang in (("front", 0), ("threequarter", 35), ("side", 90), ("back", 180)):
        a = math.radians(ang)
        cam.location = Vector((math.sin(a) * 5.2, -math.cos(a) * 5.2, HEIGHT * 0.6))
        cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{ROOT}/docs/previews/{name}_{view}.png"
        bpy.ops.render.render(write_still=True)
    # Head close-up
    cam.data.lens = 110
    a = math.radians(20)
    head = Vector((0, 0, HEIGHT * 0.82))
    cam.location = Vector((math.sin(a) * 3.2, -math.cos(a) * 3.2, HEIGHT * 0.84))
    cam.rotation_euler = (head - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{ROOT}/docs/previews/{name}_face.png"
    bpy.ops.render.render(write_still=True)


for n in sys.argv[sys.argv.index("--") + 1:]:
    clean(n)
    previews(n)
