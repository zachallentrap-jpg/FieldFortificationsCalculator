# Headless Blender script — authors the plywood-sheet prop for the 3D viewer, same pipeline as
# sandbag.glb / picket.glb (DECISIONS D28): model at honest proportions, add the subtle organic
# detail that makes it read as a real object (gentle bow, softened edges, smooth shading), then
# normalize to a unit 1x1x1 bounding box so runtime code applies exact doctrine dimensions via
# mesh.scale.set(w, h, d). Deterministic — no random(), same output every run.
#
# Axes: Blender X = sheet width, Blender Z = sheet height (glTF exporter converts Z-up -> Y-up),
# Blender Y = sheet thickness (becomes glTF Z).
#
# Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/make_plywood.py -- src/assets/models/plywood.glb
import bpy
import math
import sys

out_path = sys.argv[sys.argv.index("--") + 1]

bpy.ops.wm.read_factory_settings(use_empty=True)

# Plate at honest 4ft x 8ft x 1/2in proportions (width 1.0, height 2.0, thickness 1/96) is far
# too thin to survive beveling; model at a workable thickness and let normalization + runtime
# scaling impose the real 1/2" — the bow/bevel shape is what matters, not the modeled thickness.
bpy.ops.mesh.primitive_cube_add(size=1)
ob = bpy.context.active_object
ob.name = "plywood"
ob.scale = (1.0, 0.06, 2.0)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Subdivide so the bow has vertices to act on.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.subdivide(number_cuts=8)
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")

# Gentle bow: a stored sheet always relaxes into a slight curve along its length, plus a faint
# diagonal warp so the two ends don't curl identically. Displaces both faces equally so the
# plate keeps constant thickness.
me = ob.data
for v in me.vertices:
    xf = v.co.x            # -0.5 .. 0.5 across width
    zf = v.co.z / 2.0      # -0.5 .. 0.5 along height (plate is 2.0 tall)
    bow = 0.020 * math.sin(math.pi * (zf + 0.5))
    warp = 0.010 * xf * zf * 2.0
    v.co.y += bow + warp

# Soften the machined edges just enough to catch a toon highlight.
bev = ob.modifiers.new("bevel", "BEVEL")
bev.width = 0.010
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

bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_apply=True)
print("wrote", out_path)
