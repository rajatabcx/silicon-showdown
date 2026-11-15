"""Rig a static character with the skeleton from the animated Musk download.

Measures the same body landmarks on both meshes (feet, crotch, neck, head top, hand tips, leg centres),
moves each bone to the matching place on the new body, binds the mesh with automatic weights,
and exports public/models/characters/<name>.glb. Animations are shared: the game plays Musk's clips on this rig.

Run:  Blender -b -P scripts/blender/rig_teal.py -- teal
"""
import math, os, sys
import bpy, numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
name = sys.argv[sys.argv.index("--") + 1]


def verts(o):
    n = len(o.data.vertices)
    a = np.empty(n * 3, dtype=np.float32)
    o.data.vertices.foreach_get("co", a)
    a = a.reshape(n, 3)
    m = np.array(o.matrix_world)
    return a @ m[:3, :3].T + m[:3, 3]


def landmarks(v):
    H = v[:, 2].max()
    # Crotch: the lowest height where there is no gap between the legs at the centre line.
    crotch = 0.45 * H
    for z in np.arange(0.08 * H, 0.6 * H, 0.006 * H):
        sl = v[(np.abs(v[:, 2] - z) < 0.006 * H) & (np.abs(v[:, 0]) < 0.12 * H)]
        if len(sl) < 20:
            continue
        xs = np.sort(sl[:, 0])
        i = np.searchsorted(xs, 0.0)
        gap = (xs[i] if i < len(xs) else 9) - (xs[i - 1] if i > 0 else -9)
        if gap < 0.012 * H:
            crotch = z
            break
    best, neck = 9, 0.7 * H
    for z in np.arange(0.5 * H, 0.9 * H, 0.008 * H):
        s = v[(np.abs(v[:, 2] - z) < 0.008 * H) & (np.abs(v[:, 0]) < 0.1 * H)]
        if len(s) > 10 and np.ptp(s[:, 0]) < best:
            best, neck = np.ptp(s[:, 0]), z
    tip = v[v[:, 0].argmax()]
    knee = v[(v[:, 0] > 0) & (np.abs(v[:, 2] - crotch * 0.5) < 0.02 * H) & (v[:, 0] < tip[0] * 0.6)]
    return {"H": float(H), "crotch": float(crotch), "neck": float(neck), "tipx": float(tip[0]), "tipz": float(tip[2]),
            "legx": float(knee[:, 0].mean()), "ymid": float(np.median(v[:, 1]))}


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f"{ROOT}/assets-src/models/tusk_anim_raw.glb")
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == "ARMATURE")
src = next(o for o in sc.objects if o.type == "MESH" and o.parent)
M = landmarks(verts(src))
for o in [o for o in sc.objects if o.type == "MESH"]:
    bpy.data.objects.remove(o)
arm.animation_data.action = None

bpy.ops.import_scene.gltf(filepath=f"{ROOT}/assets-src/models/{name}_clean_static.glb")
body = next(o for o in sc.objects if o.type == "MESH")
body.name = "Body"
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
s = M["H"] / body.dimensions.z
body.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
T = landmarks(verts(body))
print("LAND musk", {k: round(v, 3) for k, v in M.items()})
print("LAND", name, {k: round(v, 3) for k, v in T.items()})


def zmap(z):
    ks = [(0, 0), (M["crotch"], T["crotch"]), (M["neck"], T["neck"]), (M["H"], T["H"])]
    for (a0, b0), (a1, b1) in zip(ks, ks[1:]):
        if z <= a1 or a1 == M["H"]:
            return b0 + (z - a0) * (b1 - b0) / (a1 - a0)


def fit(p, kind):
    x, y, z = p
    if kind == "arm":
        return Vector((x * T["tipx"] / M["tipx"], y - M["ymid"] + T["ymid"],
                       T["neck"] + (z - M["neck"]) * (T["tipz"] - T["neck"]) / (M["tipz"] - M["neck"])))
    if kind == "leg":
        return Vector((x * T["legx"] / M["legx"], y - M["ymid"] + T["ymid"], zmap(z)))
    return Vector((x, y - M["ymid"] + T["ymid"], zmap(z)))


W = arm.matrix_world.copy()
W_inv = W.inverted()
print("ARM matrix", [[round(x, 2) for x in r] for r in W])
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for b in arm.data.edit_bones:
    n = b.name.split(":")[-1]
    kind = "arm" if any(k in n for k in ("Arm", "Hand")) else "leg" if any(k in n for k in ("Leg", "Foot", "Toe")) else "body"
    head_kind = "body" if "Shoulder" in n else kind
    tail_kind = "arm" if "Shoulder" in n else kind
    # Bone coordinates are in the armature's own space; the landmarks are in world space.
    b.head, b.tail = W_inv @ fit(W @ b.head, head_kind), W_inv @ fit(W @ b.tail, tail_kind)
bpy.ops.object.mode_set(mode="OBJECT")

# Bind. Automatic weights need a clean surface, so weight a voxel-remeshed copy and transfer to the real mesh.
proxy = body.copy()
proxy.data = body.data.copy()
sc.collection.objects.link(proxy)
bpy.ops.object.select_all(action="DESELECT")
proxy.select_set(True)
bpy.context.view_layer.objects.active = proxy
r = proxy.modifiers.new("remesh", "REMESH")
r.mode, r.voxel_size = "VOXEL", 0.012
bpy.ops.object.modifier_apply(modifier="remesh")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
weighted = sum(1 for v in proxy.data.vertices if v.groups)
print("PROXY verts", len(proxy.data.vertices), "weighted", weighted)

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
for g in proxy.vertex_groups:
    body.vertex_groups.new(name=g.name)
dt = body.modifiers.new("dt", "DATA_TRANSFER")
dt.object, dt.use_vert_data, dt.data_types_verts, dt.vert_mapping = proxy, True, {"VGROUP_WEIGHTS"}, "POLYINTERP_NEAREST"
dt.layers_vgroup_select_src, dt.layers_vgroup_select_dst = "ALL", "NAME"
bpy.ops.object.modifier_apply(modifier="dt")

# The arms hang close to the jacket, so the remeshed copy fuses them and weights bleed across.
# Split by position: vertices out past the armpit belong to that side's arm chain only; torso vertices never follow an arm.
armpit = abs((arm.matrix_world @ arm.data.bones["mixamorig:LeftArm"].head_local).x)
elbow_z = (arm.matrix_world @ arm.data.bones["mixamorig:LeftForeArm"].head_local).z
is_arm = lambda n: any(k in n for k in ("Arm", "Hand"))
groups = {g.index: g for g in body.vertex_groups}
fixed = 0
for v in body.data.vertices:
    x, z = (body.matrix_world @ v.co).x, (body.matrix_world @ v.co).z
    side = "Left" if x > 0 else "Right"
    out = abs(x) > armpit * 1.02 and z < T["neck"]
    for ge in list(v.groups):
        n = groups[ge.group].name.split(":")[-1]
        bad = False
        if out:
            mine = n.startswith(side) and (is_arm(n) or "Shoulder" in n)
            near_shoulder = z > elbow_z and n in ("Spine2", "Spine1")
            bad = not (mine or near_shoulder)
        elif abs(x) < armpit * 0.8:
            bad = is_arm(n) and "Shoulder" not in n
        if bad:
            groups[ge.group].remove([v.index]); fixed += 1
    if not v.groups:
        groups[body.vertex_groups[f"mixamorig:{side}ForeArm" if out else "mixamorig:Spine1"].index].add([v.index], 1.0, "REPLACE")
print("WEIGHT fixes", fixed, "armpit", round(armpit, 3))
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.data.objects.remove(proxy)
body.parent = arm
am = body.modifiers.new("Armature", "ARMATURE")
am.object = arm
arm.name = "Rig"
print("BODY weighted", sum(1 for v in body.data.vertices if v.groups), "of", len(body.data.vertices))

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
body.select_set(True)
for a in list(bpy.data.actions):
    a.use_fake_user = True
bpy.ops.export_scene.gltf(filepath=f"{ROOT}/public/models/characters/{name}.glb", export_format="GLB", use_selection=True,
                          export_yup=True, export_image_format="WEBP", export_image_quality=85, export_animations=False)

# Test renders: play three of Musk's clips on the new rig.
sc.render.engine = "CYCLES"
sc.cycles.samples, sc.cycles.use_denoising = 32, True
sc.render.resolution_x, sc.render.resolution_y = 600, 700
w = bpy.data.worlds.new("w"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.1, 0.09, 0.14, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.world = w
mid = Vector((0, 0, 0.9))
for kind, loc, e in (("key", (2, -3, 3), 500), ("fill", (-3, -2, 1.5), 200), ("rim", (-1.5, 3, 3), 400)):
    d = bpy.data.lights.new(kind, "AREA"); d.energy, d.size = e, 3
    l = bpy.data.objects.new(kind, d); l.location = loc
    l.rotation_euler = (mid - l.location).to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(l)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.lens = 60
cam.location = (3.6, 2.6, 1.3); cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.collection.objects.link(cam); sc.camera = cam
fps = sc.render.fps
for clip, t in (("Left_Jab_from_Guard", 0.5), ("Roundhouse_Kick", 0.83), ("Walk_Fight_Forward", 0.4)):
    arm.animation_data.action = bpy.data.actions[clip]
    sc.frame_set(int(t * fps))
    sc.render.filepath = f"{ROOT}/docs/previews/{name}_rig_{clip}.png"
    bpy.ops.render.render(write_still=True)
