"""Build the game's 3D props in Blender, export each as GLB and render a preview.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/props.py -- [prop ...]
Out:  public/models/props/<prop>.glb   and   docs/previews/<prop>.png
"""
import math, os, sys
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GLB_DIR, PNG_DIR = os.path.join(ROOT, "public/models/props"), os.path.join(ROOT, "docs/previews")


# ---------- helpers ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def finish(o, m, smooth=True):
    """Apply modifiers, set material and shading."""
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = smooth
    return o


def box(name, size, loc, m, bevel=0.0, rot=(0, 0, 0), segs=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width, b.segments = bevel, segs
    return finish(o, m)


def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=32, r2=None, bevel=0.0):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width, b.segments, b.limit_method = bevel, 3, "ANGLE"
    return finish(o, m)


def ball(name, r, loc, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=40, ring_count=20)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m)


def tube(name, pts, radius, m):
    """A round pipe through the given points (smooth curve)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = "3D", radius, 6, 10
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_endpoint_u, sp.order_u = True, min(4, len(pts))
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.object
    o.select_set(False)
    return finish(o, m)


def cut(target, cutter):
    b = target.modifiers.new("cut", "BOOLEAN")
    b.operation, b.object, b.solver = "DIFFERENCE", cutter, "EXACT"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier="cut")
    bpy.data.objects.remove(cutter)


# ---------- props ----------
def sink():
    """A porcelain bathroom sink with taps and a waste pipe still attached."""
    white = mat("porcelain", (0.93, 0.93, 0.9), 0.12)
    chrome = mat("chrome", (0.8, 0.82, 0.85), 0.18, 1.0)
    dark = mat("drain", (0.05, 0.05, 0.05), 0.6)

    body = box("basin", (0.62, 0.46, 0.2), (0, 0, 0.1), white, bevel=0.07, segs=8)
    bowl = ball("bowl", 1, (0, -0.035, 0.215), white, scale=(0.245, 0.16, 0.15))
    cut(body, bowl)
    for p in body.data.polygons:
        p.use_smooth = True
    box("deck", (0.62, 0.11, 0.035), (0, 0.185, 0.215), white, bevel=0.016)
    cyl("drain", 0.028, 0.012, (0, -0.035, 0.07), dark)
    cyl("drain_ring", 0.036, 0.008, (0, -0.035, 0.068), chrome)
    cyl("overflow", 0.012, 0.03, (0, 0.118, 0.17), dark, rot=(math.pi / 2, 0, 0))

    # Mixer tap and two cross handles
    cyl("tap_base", 0.03, 0.035, (0, 0.185, 0.25), chrome, bevel=0.006)
    tube("spout", [(0, 0.185, 0.26), (0, 0.185, 0.37), (0, 0.13, 0.4), (0, 0.06, 0.375), (0, 0.045, 0.33)], 0.016, chrome)
    for s in (-1, 1):
        x = s * 0.17
        cyl(f"handle_base{s}", 0.022, 0.03, (x, 0.185, 0.247), chrome, bevel=0.005)
        cyl(f"handle_stem{s}", 0.01, 0.04, (x, 0.185, 0.28), chrome)
        for a in (0, math.pi / 2):
            cyl(f"handle_bar{s}{a:.0f}", 0.008, 0.085, (x, 0.185, 0.3), chrome, rot=(math.pi / 2, 0, a), bevel=0.003)
        ball(f"handle_cap{s}", 0.014, (x, 0.185, 0.305), mat("hot" if s < 0 else "cold", (0.85, 0.1, 0.1) if s < 0 else (0.1, 0.3, 0.85), 0.3))

    # Waste pipe torn out with it
    tube("trap", [(0, -0.035, 0.0), (0, -0.035, -0.12), (0, 0.0, -0.17), (0, 0.06, -0.15), (0, 0.075, -0.08), (0, 0.14, -0.07)], 0.02, chrome)
    cyl("nut", 0.03, 0.03, (0, -0.035, -0.02), chrome, verts=8)


def chainsaw():
    """A petrol chainsaw: red body, black handles, steel bar with chain teeth."""
    red = mat("saw_red", (0.78, 0.07, 0.05), 0.35)
    black = mat("saw_black", (0.03, 0.03, 0.035), 0.55)
    steel = mat("saw_steel", (0.72, 0.74, 0.78), 0.25, 1.0)
    grey = mat("saw_grey", (0.25, 0.26, 0.28), 0.5)

    box("body", (0.34, 0.2, 0.2), (0, 0, 0.1), red, bevel=0.035, segs=5)
    box("engine_top", (0.2, 0.17, 0.07), (-0.03, 0, 0.225), red, bevel=0.025)
    box("clutch_cover", (0.2, 0.03, 0.15), (0.06, -0.11, 0.09), grey, bevel=0.012)
    for i in range(5):
        box(f"fin{i}", (0.012, 0.19, 0.06), (-0.1 + i * 0.03, 0, 0.245), grey, bevel=0.003)
    cyl("starter", 0.075, 0.03, (-0.02, 0.112, 0.1), black, rot=(math.pi / 2, 0, 0), bevel=0.008)
    cyl("starter_hub", 0.03, 0.045, (-0.02, 0.118, 0.1), grey, rot=(math.pi / 2, 0, 0))
    cyl("fuel_cap", 0.028, 0.03, (-0.12, 0.105, 0.05), black, rot=(math.pi / 2, 0, 0), verts=10)
    box("pull_grip", (0.06, 0.02, 0.022), (-0.02, 0.15, 0.19), black, bevel=0.008)

    # Handles
    tube("front_handle", [(0.08, -0.13, 0.03), (0.08, -0.15, 0.2), (0.07, -0.08, 0.33), (0.07, 0.08, 0.33), (0.08, 0.15, 0.2), (0.08, 0.13, 0.03)], 0.016, black)
    tube("rear_handle", [(-0.15, 0, 0.2), (-0.27, 0, 0.21), (-0.36, 0, 0.17), (-0.37, 0, 0.07), (-0.3, 0, 0.02), (-0.17, 0, 0.03)], 0.022, black)
    box("trigger", (0.05, 0.02, 0.03), (-0.26, 0, 0.165), red, bevel=0.006)
    box("hand_guard", (0.02, 0.2, 0.13), (0.15, 0, 0.26), black, bevel=0.008, rot=(0, -0.35, 0))

    # Guide bar: a flat plate with a rounded nose, and teeth all the way round
    L, H, T, x0, zc = 0.52, 0.075, 0.012, 0.17, 0.09
    box("bar", (L, T, H), (x0 + L / 2, -0.085, zc), steel, bevel=0.002)
    cyl("bar_nose", H / 2, T, (x0 + L, -0.085, zc), steel, rot=(math.pi / 2, 0, 0))
    box("bar_slot", (L * 0.7, T * 1.15, 0.012), (x0 + L * 0.45, -0.085, zc), grey)
    box("chain_top", (L, T * 1.5, 0.012), (x0 + L / 2, -0.085, zc + H / 2 + 0.004), black)
    box("chain_bottom", (L, T * 1.5, 0.012), (x0 + L / 2, -0.085, zc - H / 2 - 0.004), black)
    n = 13
    for i in range(n):
        x = x0 + 0.03 + i * (L - 0.04) / (n - 1)
        box(f"tooth_t{i}", (0.022, T * 1.2, 0.02), (x, -0.085, zc + H / 2 + 0.014), steel, rot=(0, 0.5, 0))
        box(f"tooth_b{i}", (0.022, T * 1.2, 0.02), (x, -0.085, zc - H / 2 - 0.014), steel, rot=(0, 0.5 + math.pi, 0))
    for k in range(5):
        a = -math.pi / 2 + (k + 0.5) * math.pi / 5
        r = H / 2 + 0.014
        box(f"tooth_n{k}", (0.022, T * 1.2, 0.02), (x0 + L + math.cos(a) * r, -0.085, zc + math.sin(a) * r), steel, rot=(0, -a + 0.5 + math.pi / 2, 0))


def steel_ball():
    ball("ball", 0.06, (0, 0, 0.06), mat("ball_steel", (0.75, 0.77, 0.8), 0.12, 1.0))


PROPS = {"sink": (sink, 2.1), "chainsaw": (chainsaw, 2.6), "steel_ball": (steel_ball, 0.7)}


# ---------- output ----------
def render(name, dist):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples, sc.cycles.use_denoising = 64, True
    sc.render.resolution_x, sc.render.resolution_y = 1000, 750
    sc.render.film_transparent = False
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.09, 0.08, 0.13, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    sc.world = w

    # Centre of everything, for framing
    objs = [o for o in sc.objects if o.type == "MESH"]
    lo = Vector((min((o.matrix_world @ Vector(c)).x for o in objs for c in o.bound_box),
                 min((o.matrix_world @ Vector(c)).y for o in objs for c in o.bound_box),
                 min((o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box)))
    hi = Vector((max((o.matrix_world @ Vector(c)).x for o in objs for c in o.bound_box),
                 max((o.matrix_world @ Vector(c)).y for o in objs for c in o.bound_box),
                 max((o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box)))
    mid = (lo + hi) / 2

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, lo.z - 0.001))
    floor = bpy.context.object
    floor.data.materials.append(mat("floor", (0.07, 0.06, 0.11), 0.6))

    def light(kind, loc, energy, size=1.0, color=(1, 1, 1)):
        d = bpy.data.lights.new(kind, "AREA")
        d.energy, d.size, d.color = energy, size, color
        o = bpy.data.objects.new(kind, d)
        o.location = mid + Vector(loc) * dist
        sc.collection.objects.link(o)
        o.rotation_euler = (mid - o.location).to_track_quat("-Z", "Y").to_euler()

    light("key", (0.9, -1.0, 1.2), 45 * dist * dist, 1.2 * dist)
    light("fill", (-1.2, -0.6, 0.5), 12 * dist * dist, 2 * dist, (0.7, 0.8, 1))
    light("rim", (-0.5, 1.2, 0.9), 50 * dist * dist, 0.8 * dist, (1, 0.75, 0.6))

    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 50
    cam.location = mid + Vector((0.85, -1.0, 0.55)).normalized() * dist
    cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.filepath = os.path.join(PNG_DIR, name + ".png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(floor)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    os.makedirs(GLB_DIR, exist_ok=True)
    os.makedirs(PNG_DIR, exist_ok=True)
    for name in args or PROPS:
        build, dist = PROPS[name]
        reset()
        build()
        tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == "MESH" for p in o.data.polygons)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(filepath=os.path.join(GLB_DIR, name + ".glb"), export_format="GLB", use_selection=True, export_yup=True)
        render(name, dist)
        print(f"PROP {name}: {tris} triangles")


main()
