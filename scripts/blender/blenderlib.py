"""Reusable Blender helpers for the FieldFortificationsCalculator prop pipeline.

Design contract (matches src/ui/three-viewer.ts expectations):
  * Every EXPORTED prop is normalized to a unit 1x1x1 bounding box with its base
    sitting at z=0. The app applies the real doctrine dimensions via
    mesh.scale.set(w, h, d) at instance time, so one GLB serves any size input.
  * PREVIEW renders apply a temporary real-proportion scale so what I inspect
    matches what the app will show (a raw unit mesh renders as a meaningless blob).
  * All geometry is deterministic — no random(), so a rebuild of the same inputs
    is byte-identical (mirrors the app's no-Math.random texture rule).

Render helper produces an ORTHOGRAPHIC contact set (front / side / top / iso) so
proportions are judged honestly, not from a single foreshortened angle.
"""
import bpy
import bmesh
import math
import mathutils

OUT_DIR = '/private/tmp/claude-501/-Users-zacharytraphagen-CommandHub-Led/58e0b71b-607d-4fc3-bad9-f591636675f7/scratchpad/blender'


def reset_scene():
    import os
    if os.environ.get('BMCP_LIVE'):
        # Live GUI bridge: read_factory_settings would destroy the UI context
        # mid-exec (killing both the running build AND the bridge server socket).
        # Soft-clear the scene instead.
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.textures,
                     bpy.data.lights, bpy.data.cameras):
            for x in list(coll):
                if x.users == 0:
                    coll.remove(x)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'IMPERIAL'
    sc.unit_settings.length_unit = 'FEET'


def bbox(obj):
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


def normalize_to_unit_bbox(obj):
    """Rescale + recenter so bbox is exactly 1x1x1, base at z=0."""
    minx, maxx, miny, maxy, minz, maxz = bbox(obj)
    sx = 1.0 / max(1e-9, maxx - minx)
    sy = 1.0 / max(1e-9, maxy - miny)
    sz = 1.0 / max(1e-9, maxz - minz)
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    for v in obj.data.vertices:
        v.co.x = (v.co.x - cx) * sx
        v.co.y = (v.co.y - cy) * sy
        v.co.z = (v.co.z - minz) * sz
    obj.data.update()


def verify_unit_bbox(obj, label):
    minx, maxx, miny, maxy, minz, maxz = bbox(obj)
    dx, dy, dz = maxx - minx, maxy - miny, maxz - minz
    print('%s bbox: dx=%.5f dy=%.5f dz=%.5f zmin=%.5f' % (label, dx, dy, dz, minz))
    assert abs(dx - 1) < 1e-4 and abs(dy - 1) < 1e-4 and abs(dz - 1) < 1e-4, label + ' not unit!'
    assert abs(minz) < 1e-4, label + ' base not at z=0!'


def add_material(obj, color, roughness=0.9):
    mat = bpy.data.materials.new(obj.name + 'Mat')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return mat


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _lights_and_world(scene):
    for o in list(scene.collection.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)
    sun = bpy.data.lights.new('Sun', 'SUN')
    sun.energy = 3.5
    so = bpy.data.objects.new('Sun', sun)
    so.rotation_euler = (math.radians(40), 0, math.radians(35))
    scene.collection.objects.link(so)
    fill = bpy.data.lights.new('Fill', 'AREA')
    fill.energy = 60.0
    fo = bpy.data.objects.new('Fill', fill)
    fo.location = (-3, 3, 3)
    fo.scale = (3, 3, 3)
    scene.collection.objects.link(fo)
    if not scene.world:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.86, 0.88, 0.91, 1)


def _ortho_cam(scene, name, loc, look, scale):
    cd = bpy.data.cameras.new(name)
    cd.type = 'ORTHO'
    cd.ortho_scale = scale
    cam = bpy.data.objects.new(name, cd)
    cam.location = loc
    d = mathutils.Vector(loc) - mathutils.Vector(look)
    cam.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    return cam


def contact_sheet(objs, real_scale, name):
    """Render front / side / top / iso orthographic PNGs of a group of objects.

    objs        : list of objects to (temporarily) apply real_scale to
    real_scale  : (sx, sy, sz) real-world proportions for the preview only
    name        : base filename; writes <name>_front|side|top|iso.png
    Returns the list of written file paths.
    """
    scene = bpy.context.scene
    _lights_and_world(scene)

    for o in objs:
        o.scale = real_scale

    # Frame size from the scaled bounding box of all objects.
    allx, ally, allz = [], [], []
    for o in objs:
        minx, maxx, miny, maxy, minz, maxz = bbox(o)
        allx += [minx * o.scale.x, maxx * o.scale.x]
        ally += [miny * o.scale.y, maxy * o.scale.y]
        allz += [minz * o.scale.z, maxz * o.scale.z]
    ex = max(allx) - min(allx)
    ey = max(ally) - min(ally)
    ez = max(allz) - min(allz)
    cx = (max(allx) + min(allx)) / 2
    cy = (max(ally) + min(ally)) / 2
    cz = (max(allz) + min(allz)) / 2
    reach = max(ex, ey, ez)
    frame = reach * 1.25 + 0.05
    look = (cx, cy, cz)
    dist = reach * 3 + 5

    views = {
        'front': ((cx, cy - dist, cz), frame),      # looking +Y (down-range face)
        'side': ((cx + dist, cy, cz), frame),       # looking -X
        'top': ((cx, cy, cz + dist), frame),        # plan
        'iso': ((cx + dist * 0.7, cy - dist * 0.7, cz + dist * 0.6), frame * 1.15),
    }
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    written = []
    for vname, (loc, fscale) in views.items():
        cam = _ortho_cam(scene, 'Cam_' + vname, loc, look, fscale)
        scene.camera = cam
        path = OUT_DIR + '/' + name + '_' + vname + '.png'
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        written.append(path)
        bpy.data.objects.remove(cam, do_unlink=True)
    # Restore unit scale so a subsequent export stays unit-normalized.
    for o in objs:
        o.scale = (1, 1, 1)
    return written


def export_glb(obj, name):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.scale = (1, 1, 1)
    bpy.ops.export_scene.gltf(
        filepath=OUT_DIR + '/' + name + '.glb',
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    print('Exported ' + name + '.glb')
