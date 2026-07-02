# Headless Blender script — authors the dimensional-lumber props (2x4, 2x6, 4x4) for the 3D
# viewer, same pipeline as sandbag.glb / picket.glb / plywood.glb (DECISIONS D28): model at
# honest DRESSED proportions (a "2x4" is really 1.5" x 3.5"), add the subtle organic detail that
# makes it read as a real board (gentle crown along the length, a faint crook in the weak axis,
# eased S4S edges, smooth shading), then normalize to a unit 1x1x1 bounding box so runtime code
# applies exact dimensions via mesh.scale.set(w, h, d). Deterministic — no random(), same output
# every run.
#
# Each size is its own export so the edge-easing and bow are modeled against that size's true
# cross-section — a 2x4 bows visibly, a 4x4 barely does.
#
# Axes: Blender X = board length, Blender Z = board width/face (glTF exporter converts Z-up ->
# Y-up, so this becomes glTF Y), Blender Y = board thickness (becomes glTF Z).
#
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P make_lumber.py -- <outdir>
import bpy
import math
import sys

outdir = sys.argv[sys.argv.index("--") + 1]

# name -> (dressed width ft, dressed thickness ft, crown ft, crook ft) modeled at 8 ft length.
# Crown/crook are real-world storage-rack amounts: a 2x4 relaxes ~1/2" over 8 ft, a 4x4 ~1/8".
SIZES = {
    "lumber_2x4": (3.5 / 12, 1.5 / 12, 0.030, 0.015),
    "lumber_2x6": (5.5 / 12, 1.5 / 12, 0.025, 0.012),
    "lumber_4x4": (3.5 / 12, 3.5 / 12, 0.010, 0.008),
}
LENGTH = 8.0

for name, (width, thick, crown, crook) in SIZES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (LENGTH, thick, width)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Subdivide along the length so the crown/crook have vertices to act on.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # 5 cuts is enough for a smooth sine crown on a straight board (subdivide cuts every edge,
    # so vertex count grows quadratically — 10 cuts tripled the file size for no visible gain).
    bpy.ops.mesh.subdivide(number_cuts=5)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Crown (bow across the wide face) + crook (edge-wise curve) + a faint twist so the two ends
    # don't sit identically. All displace whole cross-sections, preserving thickness.
    me = ob.data
    for v in me.vertices:
        xf = v.co.x / LENGTH  # -0.5 .. 0.5 along length
        arc = math.sin(math.pi * (xf + 0.5))  # 0 at ends, 1 mid-span
        v.co.y += crown * arc
        v.co.z += crook * arc * 0.7
        twist = 0.02 * xf * math.pi  # ~ +/-1.8 deg end to end
        y, z = v.co.y, v.co.z
        v.co.y = y * math.cos(twist) - z * math.sin(twist)
        v.co.z = y * math.sin(twist) + z * math.cos(twist)

    # Eased S4S edges — dressed lumber ships with ~1/16..1/8" radiused edges.
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = 0.008
    bev.segments = 2
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier="bevel")

    bpy.ops.object.shade_auto_smooth(angle=math.radians(35))

    # Normalize to a unit 1x1x1 bounding box centered on the origin (runtime scales to real dims).
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    for v in me.vertices:
        v.co.x = (v.co.x - (min(xs) + max(xs)) / 2) / (max(xs) - min(xs))
        v.co.y = (v.co.y - (min(ys) + max(ys)) / 2) / (max(ys) - min(ys))
        v.co.z = (v.co.z - (min(zs) + max(zs)) / 2) / (max(zs) - min(zs))
    me.update()

    out_path = f"{outdir}/{name}.glb"
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_apply=True)
    print("wrote", out_path)
