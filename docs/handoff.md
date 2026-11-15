# Handoff notes (16 Nov 2026)

State of the project for whoever picks it up next. Read with [premium-plan.md](./premium-plan.md), [super-move-anatomy.md](./super-move-anatomy.md) and [quotes.md](./quotes.md).

## What exists

| Thing | Where | State |
|---|---|---|
| Fight engine (deterministic, 60 Hz, tests) | `src/game/sim/` | Works. 10 tests pass (`pnpm test`). Old v1 move set. |
| v1 game shell (menus, HUD, ticker, newspaper) | `src/game/ui/`, `src/game/Game.ts` | Works, but the look was rejected. Renderer uses box-and-capsule fighters (`src/game/render/bobblehead.ts`), to be replaced. |
| **Melon Tusk model, rigged and animated** | `public/models/characters/tusk.glb` (3.7 MB) | Good. Mixamo-named 66-bone skeleton, 18 clips at 24 fps. |
| Clip measurements | `public/models/characters/clips.json` | Per clip: length, the time the strike lands, how far the hips travel. |
| **Peter Teal model, static** | `public/models/characters/teal.glb` (1.4 MB) | Good mesh and texture. **Not rigged.** |
| Teal rig attempt | `scripts/blender/rig_teal.py`, output in `assets-src/models/teal_rig_attempt.glb` | **Broken.** See below. |
| Props | `public/models/props/{sink,chainsaw,steel_ball}.glb`, built by `scripts/blender/props.py` | Good. Chainsaw has a small black wedge at the bar tip. |
| Voice clips (real interview audio) | `public/audio/voice/*.mp3` + `manifest.json`, cut by `scripts/cut_clips.py` | 21 clips, wording checked, approved by the owner by ear. |
| Raw downloads (not in git) | `assets-src/models/`, `recordings/` | Meshy originals and interview audio. |
| Concept art | `docs/concepts/` | Owner-approved caricatures. |

## Tusk's animation clips
`Block1`, `Face_Punch_Reaction`, `Hit_Reaction`, `Knock_Down`, `Left_Hook_from_Guard`, `Left_Jab_from_Guard`, `Leg_Sweep`, `Long_Breathe_and_Look_Around`, `Right_Jab_from_Guard`, `Right_Uppercut_from_Guard`, `Roundhouse_Kick`, `Running`, `Spartan_Kick`, `Stand_Dodge`, `Stand_Up1`, `Victory_Fist_Pump`, `Walk_Fight_Forward`, `Walking`.

Notes:
- There is no dedicated fight-stance idle. The "from Guard" clips start and end in a boxing guard, so their first frame works as the stance. The clips turn the body side-on, as a boxer stands.
- Missing and needing a stand-in or a hand-made pose: walk backward (play `Walk_Fight_Forward` in reverse), crouch, jump, out-of-breath, grab, and the signature moves (straight-arm gesture, sink throw, chainsaw swing).
- Clips are long (a jab is 1.7 s). Use `clips.json` to play only the part around the strike.

## The Teal rig problem
Meshy's free plan rigged one model; the second asks for the Pro plan. So `rig_teal.py` copies Tusk's skeleton onto Teal in Blender: it measures landmarks on both meshes, moves the bones, binds through a voxel-remeshed copy with automatic weights, and transfers the weights.

Result: the rest pose is fine, but in motion a hand stretches into a long band and the legs collapse. Two bugs are already fixed (leg-join height, arm weights bleeding into the torso); it is still wrong. Likely causes, untested: weights not transferring cleanly from the remeshed copy, or leg bones sitting outside the short legs.

Options, cheapest first:
1. Fix the script (try binding the real mesh directly, a finer remesh, or checking each bone sits inside the mesh).
2. Mixamo's free auto-rigger (needs the owner's Adobe login and a manual upload/download). Its rest pose differs from Meshy's, so Tusk's clips may not transfer; Mixamo's own fight clips would be used for Teal.
3. One month of Meshy Pro (about ₹850) and rig him there, which guarantees the same skeleton.

## Things learned the hard way
- Driving Meshy's website through the browser pane is slow and costly. Ask the owner to do Meshy clicks and downloads by hand; do everything else locally.
- The browser pane cannot upload local files to a website.
- Meshy downloads: GLB, skeleton template "Mixamo", "All Added", single file, and at most 20 motions per download. The Starter plan has 20 downloads a month (about 17 left).
- Blender runs headless: `/Applications/Blender.app/Contents/MacOS/Blender -b -P <script> -- <args>`.
- Speech-to-text with word timing: `recordings/.venv/bin/python` has `mlx-whisper`.
