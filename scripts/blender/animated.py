"""Turn the rigged, animated Meshy download into the game's character file.

In:   assets-src/models/tusk_anim_raw.glb   (Mixamo-style skeleton + animation clips)
Out:  public/models/characters/tusk.glb      (mesh + skeleton + all clips, small textures)
      public/models/characters/clips.json    (per clip: length, the frame where the strike lands, root travel)

Run:  Blender -b -P scripts/blender/animated.py
"""
import json, os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f"{ROOT}/assets-src/models/tusk_anim_raw.glb")
sc = bpy.context.scene
for o in list(sc.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)          # stray helper sphere
arm = next(o for o in sc.objects if o.type == "ARMATURE")
mesh = next(o for o in sc.objects if o.type == "MESH")
arm.name, mesh.name = "Rig", "Body"
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)

# Measure each clip: where do the hands/feet reach furthest from the hips? That frame is the hit.
fps = sc.render.fps
tips = ["mixamorig:LeftHand", "mixamorig:RightHand", "mixamorig:LeftFoot", "mixamorig:RightFoot"]
clips = {}
if not arm.animation_data:
    arm.animation_data_create()
for act in bpy.data.actions:
    arm.animation_data.action = act
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    best, best_f, limb = -1, f0, ""
    hx, hy, hz = [], [], []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        hips = arm.pose.bones["mixamorig:Hips"].head
        hx.append(hips.x); hy.append(hips.y); hz.append(hips.z)
        for t in tips:
            p = arm.pose.bones[t].head
            d = Vector((p.x - hips.x, p.y - hips.y)).length + max(0, p.z - hips.z) * 0.5
            if d > best:
                best, best_f, limb = d, f, t.split(":")[1]
    clips[act.name] = {
        "seconds": round((f1 - f0) / fps, 3), "impact": round((best_f - f0) / fps, 3), "limb": limb,
        "travel": [round(max(hx) - min(hx), 2), round(max(hy) - min(hy), 2), round(max(hz) - min(hz), 2)],
    }
    print("CLIP", act.name, clips[act.name])
arm.animation_data.action = None
sc.frame_set(0)

rest = {b.name.split(":")[-1]: [round(v, 4) for v in (arm.matrix_world @ b.head_local)] for b in arm.data.bones
        if b.name.split(":")[-1] in ("Hips", "Neck", "Head", "HeadTop_End", "LeftArm", "LeftForeArm", "LeftHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "Spine", "Spine1", "Spine2", "LeftShoulder")}
dims = [round(v, 3) for v in mesh.dimensions]
json.dump({"fps": fps, "height": dims[2], "clips": clips, "rest": rest}, open(f"{ROOT}/public/models/characters/clips.json", "w"), indent=1)
print("REST", rest, "DIMS", dims)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=f"{ROOT}/public/models/characters/tusk.glb", export_format="GLB", use_selection=True,
                          export_yup=True, export_image_format="WEBP", export_image_quality=85,
                          export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
                          export_optimize_animation_size=True)
