"""Rig a static character with the skeleton from the animated Tusk download, so Tusk's clips play on it.

How it works (v2, replaces the voxel-remesh attempt):
1. Measure the same body landmarks on both meshes and map every joint position from Tusk's body to the new one.
2. Move each bone's head there but keep the bone's exact rest *orientation* (direction and roll) from Tusk's rig.
   Because the rest rotations are identical, Tusk's clips (local rotations) drive this skeleton with no retargeting:
   every body part turns by exactly the same world rotation as on Tusk. The game strips the per-bone translation
   tracks (except the hips) so the new body keeps its own proportions.
3. Weight the real mesh directly: each vertex follows its nearest bone segment (joint to child joint), blended with
   that bone's parent or child near a joint, with hard rules so a vertex never follows the other side's limb or an
   arm bone from the legs. No automatic heat weights, no remeshed proxy.

Run:  Blender -b -P scripts/blender/rig_teal.py -- teal --crotch 0.44 [--render]
Out:  public/models/characters/<name>.glb (mesh + skeleton, no clips), docs/previews/<name>_rig_*.png with --render
"""
import os, sys
import bpy, numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
args = sys.argv[sys.argv.index("--") + 1:]
name = args[0]
RENDER = "--render" in args


def verts(o):
    n = len(o.data.vertices)
    a = np.empty(n * 3, dtype=np.float32)
    o.data.vertices.foreach_get("co", a)
    a = a.reshape(n, 3)
    m = np.array(o.matrix_world)
    return a @ m[:3, :3].T + m[:3, 3]


def landmarks(v):
    H = v[:, 2].max()
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
if arm.animation_data:
    arm.animation_data.action = None
M = landmarks(verts(src))
for o in [o for o in sc.objects if o.type == "MESH"]:
    bpy.data.objects.remove(o)

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
V = verts(body)
T = landmarks(V)
if "--crotch" in args:
    # The gap detector fails when the legs nearly touch (Teal); measure the crotch from a front render instead.
    T["crotch"] = float(args[args.index("--crotch") + 1])
print("LAND tusk", {k: round(v, 3) for k, v in M.items()})
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


def short(n):
    return n.split(":")[-1]


def kind_of(n):
    if any(k in n for k in ("Arm", "Hand")):
        return "arm"
    if any(k in n for k in ("Leg", "Foot", "Toe")):
        return "leg"
    return "body"


def centre_in_mesh(p, n, radius):
    """Pull a joint to the centre of the mesh slice around it, so limb bones run down the middle of the limb."""
    if n.startswith(("LeftHand", "RightHand")) and n not in ("LeftHand", "RightHand"):
        return p  # fingers: leave mapped
    near = V[np.linalg.norm(V - np.array(p), axis=1) < radius]
    side = 1 if n.startswith("Left") else -1 if n.startswith("Right") else 0
    if side:
        near = near[near[:, 0] * side > 0.01]
    if len(near) < 12:
        return p
    c = (near.min(axis=0) + near.max(axis=0)) / 2
    return Vector((c[0], c[1], p.z)) if kind_of(n) == "leg" else Vector(c) if kind_of(n) == "arm" else Vector((p.x, c[1], p.z))


# Map every joint, then move bones keeping orientation. Matrix_world is identity-rotation after import.
W = arm.matrix_world.copy()
W_inv = W.inverted()
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones
for b in eb:
    b.use_connect = False
heads, dirs = {}, {}
for b in eb:
    n = short(b.name)
    wh = W @ b.head
    k = "body" if "Shoulder" in n else kind_of(n)
    p = fit(wh, k)
    if n in ("LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand", "LeftUpLeg", "RightUpLeg",
             "LeftLeg", "RightLeg", "LeftFoot", "RightFoot"):
        p = centre_in_mesh(p, n, 0.045 if "Leg" in n or "Foot" in n else 0.035)
    heads[b.name] = p
    dirs[b.name] = (b.tail - b.head, b.roll)
for b in eb:
    d, roll = dirs[b.name]
    b.head = W_inv @ heads[b.name]
    b.tail = b.head + d
    b.roll = roll
bpy.ops.object.mode_set(mode="OBJECT")
print("JOINTS", {short(k): tuple(round(c, 3) for c in v) for k, v in heads.items() if "Hand" not in short(k)[4:] or short(k).endswith("Hand")})

# ---- Weights: nearest bone segment, region rules, parent/child blend.
DEFORM = ["Hips", "Spine", "Spine1", "Spine2", "Neck", "Head"] + [f"{s}{p}" for s in ("Left", "Right") for p in
                                                                  ("Shoulder", "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase")]
full = {short(b.name): b.name for b in arm.data.bones}
parent = {short(b.name): short(b.parent.name) if b.parent else None for b in arm.data.bones}
END = {"Hips": "Spine", "Spine": "Spine1", "Spine1": "Spine2", "Spine2": "Neck", "Neck": "Head", "Head": "HeadTop_End"}
for s in ("Left", "Right"):
    END.update({f"{s}Shoulder": f"{s}Arm", f"{s}Arm": f"{s}ForeArm", f"{s}ForeArm": f"{s}Hand", f"{s}Hand": f"{s}HandMiddle2",
                f"{s}UpLeg": f"{s}Leg", f"{s}Leg": f"{s}Foot", f"{s}Foot": f"{s}ToeBase", f"{s}ToeBase": f"{s}Toe_End"})
seg = {}
for n in DEFORM:
    a = np.array(heads[full[n]])
    e = END[n]
    b = np.array(heads[full[e]]) if e in full else a + np.array(W @ (arm.data.bones[full[n]].tail_local) - W @ arm.data.bones[full[n]].head_local)
    seg[n] = (a, b)
hand_l = max(heads[full["LeftHand"]].x, 0.1)
arm_x = {s: abs(heads[full[f"{s}Arm"]].x) for s in ("Left", "Right")}


def seg_dist(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


D = np.stack([seg_dist(V, *seg[n]) for n in DEFORM], axis=1)
x, z = V[:, 0], V[:, 2]
crotch = T["crotch"]
for j, n in enumerate(DEFORM):
    bad = np.zeros(len(V), bool)
    if n.startswith("Left"):
        bad |= x < -0.005
    if n.startswith("Right"):
        bad |= x > 0.005
    if kind_of(n) == "arm":
        side = "Left" if n.startswith("Left") else "Right"
        bad |= np.abs(x) < arm_x[side] * 0.85  # torso never follows the arm
    if kind_of(n) == "leg":
        bad |= np.abs(x) > max(arm_x.values()) * 1.15  # hanging hands never follow a leg
    if n in ("LeftLeg", "RightLeg", "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"):
        bad |= z > crotch
    if n in ("LeftUpLeg", "RightUpLeg"):
        bad |= z > crotch + 0.12
    if n in ("Neck", "Head"):
        bad |= z < T["neck"] - 0.06
    if n == "Head":
        bad |= z < T["neck"] - 0.01
    D[bad, j] = 99
order = np.argsort(D, axis=1)
idx = {n: j for j, n in enumerate(DEFORM)}
for n in DEFORM:
    if body.vertex_groups.get(full[n]) is None:
        body.vertex_groups.new(name=full[n])
groups = {n: body.vertex_groups[full[n]] for n in DEFORM}
BLEND = 0.035  # metres of soft transition around a joint
counts = {}
for vi in range(len(V)):
    j1 = order[vi, 0]
    n1 = DEFORM[j1]
    d1 = D[vi, j1]
    w = {n1: 1.0}
    for j2 in order[vi, 1:4]:
        n2 = DEFORM[j2]
        if parent.get(n2) == n1 or parent.get(n1) == n2:
            d2 = D[vi, j2]
            if d2 < 90 and d2 - d1 < BLEND:
                t = 0.5 * (1 - (d2 - d1) / BLEND)
                w = {n1: 1 - t, n2: t}
            break
    for n, wt in w.items():
        groups[n].add([vi], float(wt), "REPLACE")
        counts[n] = counts.get(n, 0) + 1
print("WEIGHTS", counts)

body.parent = arm
am = body.modifiers.new("Armature", "ARMATURE")
am.object = arm
arm.name = "Rig"

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
body.select_set(True)
bpy.ops.export_scene.gltf(filepath=f"{ROOT}/public/models/characters/{name}.glb", export_format="GLB", use_selection=True,
                          export_yup=True, export_image_format="WEBP", export_image_quality=85, export_animations=False)
print("EXPORTED")

if RENDER:
    # Play three of Tusk's clips, rotations only (as the game does), and render.
    for act in bpy.data.actions:
        bags = [act] if hasattr(act, "fcurves") else [cb for l in act.layers for st in l.strips for cb in st.channelbags]
        for bag in bags:
            for fc in list(bag.fcurves):
                if fc.data_path.endswith("location") and "Hips" not in fc.data_path:
                    bag.fcurves.remove(fc)
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 500, 600
    wd = bpy.data.worlds.new("w"); wd.use_nodes = True
    wd.node_tree.nodes["Background"].inputs[0].default_value = (0.25, 0.24, 0.3, 1)
    sc.world = wd
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 4
    sun.rotation_euler = (0.8, 0.2, 0.6); sc.collection.objects.link(sun)
    mid = Vector((0, 0, 0.85))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.lens = 45
    cam.location = (2.6, -3.4, 1.3); cam.rotation_euler = (mid - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(cam); sc.camera = cam
    if not arm.animation_data:
        arm.animation_data_create()
    fps = sc.render.fps
    for clip, t in (("Left_Jab_from_Guard", 0.5), ("Roundhouse_Kick", 0.83), ("Walk_Fight_Forward", 0.4),
                    ("Right_Uppercut_from_Guard", 0.6), ("Knock_Down", 1.9)):
        arm.animation_data.action = bpy.data.actions[clip]
        sc.frame_set(int(t * fps))
        sc.render.filepath = f"{ROOT}/docs/previews/{name}_rig_{clip}.png"
        bpy.ops.render.render(write_still=True)
