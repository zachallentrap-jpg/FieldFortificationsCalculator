"""Photoreal hero renders of every survivability-position asset, for the assets catalog page.

Renders the ACTUAL app assets: the Blender-authored GLBs in src/assets/models are imported and
scaled to real doctrine size, procedural props (plywood) are rebuilt, each is given a real
procedural material (burlap fabric, wood grain, galvanised steel), lit with a fixed studio, framed
to fit, and rendered with Cycles GI to one PNG per asset. This is the "full quality" reference look
(photoreal) — distinct from the app's real-time toon 3D view. Re-run whenever we add or change an
asset, then re-embed the PNGs in the catalog artifact.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/render_assets.py -- <out_dir>
"""
import bpy, bmesh, math, mathutils, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
MODELS = os.path.join(REPO, 'src', 'assets', 'models')
OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/asset-renders'
os.makedirs(OUT, exist_ok=True)
IN = 1.0 / 12.0


# ── node-graph material helpers ──────────────────────────────────────────────────────────────
def _principled(mat):
    return mat.node_tree.nodes.get('Principled BSDF')

def mat_fabric(obj):
    """Tan burlap: crossed weave bump + subtle colour mottle."""
    mat = bpy.data.materials.new('Burlap'); mat.use_nodes = True
    nt = mat.node_tree; b = _principled(mat)
    b.inputs['Base Color'].default_value = (0.70, 0.56, 0.34, 1)
    b.inputs['Roughness'].default_value = 0.88
    tc = nt.nodes.new('ShaderNodeTexCoord')
    # two crossed BAND waves = a fine woven weft/warp; no distortion so it stays a clean weave
    w1 = nt.nodes.new('ShaderNodeTexWave'); w1.inputs['Scale'].default_value = 520; w1.inputs['Distortion'].default_value = 0.0; w1.wave_profile = 'SIN'
    w2 = nt.nodes.new('ShaderNodeTexWave'); w2.inputs['Scale'].default_value = 520; w2.inputs['Distortion'].default_value = 0.0; w2.wave_profile = 'SIN'
    map2 = nt.nodes.new('ShaderNodeMapping'); map2.inputs['Rotation'].default_value = (0, 0, math.radians(90))
    nt.links.new(tc.outputs['Object'], w1.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], map2.inputs['Vector'])
    nt.links.new(map2.outputs['Vector'], w2.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'ADD'; mix.inputs['Fac'].default_value = 1.0
    nt.links.new(w1.outputs['Color'], mix.inputs['Color1'])
    nt.links.new(w2.outputs['Color'], mix.inputs['Color2'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.14
    nt.links.new(mix.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    # gentle base-colour mottle
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.62, 0.49, 0.29, 1)
    ramp.color_ramp.elements[1].color = (0.76, 0.61, 0.38, 1)
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    _assign(obj, mat)

def mat_wood(obj):
    """Sawn softwood: stretched grain + occasional knot, along local X (length)."""
    mat = bpy.data.materials.new('Wood'); mat.use_nodes = True
    nt = mat.node_tree; b = _principled(mat)
    b.inputs['Roughness'].default_value = 0.62
    tc = nt.nodes.new('ShaderNodeTexCoord')
    stretch = nt.nodes.new('ShaderNodeMapping'); stretch.inputs['Scale'].default_value = (0.09, 1.0, 1.0)  # long grain
    nt.links.new(tc.outputs['Object'], stretch.inputs['Vector'])
    wave = nt.nodes.new('ShaderNodeTexWave'); wave.inputs['Scale'].default_value = 3.2
    wave.inputs['Distortion'].default_value = 2.0; wave.inputs['Detail'].default_value = 3
    nt.links.new(stretch.outputs['Vector'], wave.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.66, 0.48, 0.27, 1)
    ramp.color_ramp.elements[1].color = (0.36, 0.23, 0.11, 1)
    nt.links.new(wave.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.22
    nt.links.new(wave.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    _assign(obj, mat)

def mat_steel(obj):
    """Galvanised steel picket: metallic, low roughness, faint spangle bump."""
    mat = bpy.data.materials.new('Steel'); mat.use_nodes = True
    nt = mat.node_tree; b = _principled(mat)
    b.inputs['Base Color'].default_value = (0.56, 0.57, 0.60, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.34
    tc = nt.nodes.new('ShaderNodeTexCoord')
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 55
    nt.links.new(tc.outputs['Object'], v.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.06
    nt.links.new(v.outputs['Distance'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    _assign(obj, mat)

def mat_plywood(obj):
    """Two slots: pale birch face (wavy grain + knots) on the broad faces, layered-ply bands on
    the four sawn edges. Broad faces have the thin (local Z) normal; edges don't."""
    face = bpy.data.materials.new('PlyFace'); face.use_nodes = True
    fb = _principled(face); fb.inputs['Roughness'].default_value = 0.6
    nt = face.node_tree; tc = nt.nodes.new('ShaderNodeTexCoord')
    grain = nt.nodes.new('ShaderNodeTexWave'); grain.inputs['Scale'].default_value = 2.2
    grain.inputs['Distortion'].default_value = 6.0; grain.inputs['Detail'].default_value = 2
    nt.links.new(tc.outputs['Object'], grain.inputs['Vector'])
    framp = nt.nodes.new('ShaderNodeValToRGB')
    framp.color_ramp.elements[0].color = (0.85, 0.74, 0.52, 1)
    framp.color_ramp.elements[1].color = (0.74, 0.60, 0.38, 1)
    nt.links.new(grain.outputs['Color'], framp.inputs['Fac'])
    # sparse dark knots via Voronoi cells, thresholded
    knot = nt.nodes.new('ShaderNodeTexVoronoi'); knot.inputs['Scale'].default_value = 3.0
    kramp = nt.nodes.new('ShaderNodeValToRGB')
    kramp.color_ramp.elements[0].position = 0.0; kramp.color_ramp.elements[0].color = (0.30, 0.19, 0.10, 1)
    kramp.color_ramp.elements[1].position = 0.12; kramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(tc.outputs['Object'], knot.inputs['Vector'])
    nt.links.new(knot.outputs['Distance'], kramp.inputs['Fac'])
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MULTIPLY'; mix.inputs['Fac'].default_value = 1.0
    nt.links.new(framp.outputs['Color'], mix.inputs['Color1'])
    nt.links.new(kramp.outputs['Color'], mix.inputs['Color2'])
    nt.links.new(mix.outputs['Color'], fb.inputs['Base Color'])

    edge = bpy.data.materials.new('PlyEdge'); edge.use_nodes = True
    eb = _principled(edge); eb.inputs['Roughness'].default_value = 0.7
    ent = edge.node_tree; etc = ent.nodes.new('ShaderNodeTexCoord')
    bands = ent.nodes.new('ShaderNodeTexWave'); bands.inputs['Scale'].default_value = 34
    bands.wave_profile = 'SAW'
    emap = ent.nodes.new('ShaderNodeMapping'); emap.inputs['Rotation'].default_value = (0, math.radians(90), 0)
    ent.links.new(etc.outputs['Object'], emap.inputs['Vector'])
    ent.links.new(emap.outputs['Vector'], bands.inputs['Vector'])
    eramp = ent.nodes.new('ShaderNodeValToRGB')
    eramp.color_ramp.elements[0].color = (0.88, 0.78, 0.56, 1)
    eramp.color_ramp.elements[1].color = (0.66, 0.50, 0.30, 1)
    ent.links.new(bands.outputs['Color'], eramp.inputs['Fac'])
    ent.links.new(eramp.outputs['Color'], eb.inputs['Base Color'])

    obj.data.materials.clear()
    obj.data.materials.append(face)   # slot 0
    obj.data.materials.append(edge)   # slot 1
    for p in obj.data.polygons:
        n = p.normal
        p.material_index = 0 if abs(n.z) > 0.7 else 1


def _assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# ── geometry: import GLB, or build ─────────────────────────────────────────────────────────────
def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    news = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    obj = news[0]
    # join any multi-mesh import
    if len(news) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in news:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj

def scale_to(obj, sx, sy, sz):
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)

def shade_smooth(obj, deg=32):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    for p in obj.data.polygons:
        p.use_smooth = True
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(deg))
    except Exception:
        pass

def plywood_panel(w_ft, h_ft, thick_in):
    t = thick_in * IN
    obj = bpy.data.objects.new('Plywood', bpy.data.meshes.new('Plywood'))
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bm.to_mesh(obj.data); bm.free()
    obj.scale = (w_ft, h_ft, t); bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True)
    return obj

def timber(length_ft, w_in, t_in):
    w, t = w_in * IN, t_in * IN
    hw, ht, ch = w / 2, t / 2, 0.12 * IN
    obj = bpy.data.objects.new('Timber', bpy.data.meshes.new('Timber'))
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    prof = [(hw - ch, -ht), (hw, -ht + ch), (hw, ht - ch), (hw - ch, ht),
            (-hw + ch, ht), (-hw, ht - ch), (-hw, -ht + ch), (-hw + ch, -ht)]
    n = len(prof); N = max(2, int(length_ft / 0.5)); rings = []
    for i in range(N + 1):
        x = -length_ft / 2 + length_ft * i / N
        rings.append([bm.verts.new((x, y, z)) for (y, z) in prof])
    bm.verts.ensure_lookup_table()
    for i in range(N):
        a, c = rings[i], rings[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((a[j], a[j2], c[j2], c[j]))
    for ring, sign in ((rings[0], -1), (rings[-1], 1)):
        bm.faces.new(ring if sign > 0 else list(reversed(ring)))
    bm.to_mesh(obj.data); bm.free()
    return obj


# ── studio + framing ─────────────────────────────────────────────────────────────────────────
def setup_studio():
    scene = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
    g = bpy.context.active_object
    gm = bpy.data.materials.new('Ground'); gm.use_nodes = True
    gp = _principled(gm); gp.inputs['Base Color'].default_value = (0.10, 0.10, 0.115, 1); gp.inputs['Roughness'].default_value = 1.0
    g.data.materials.append(gm)
    key = bpy.data.lights.new('Key', 'AREA'); key.energy = 1200; key.size = 7
    ko = bpy.data.objects.new('Key', key); ko.location = (6, -5.5, 7); ko.rotation_euler = (math.radians(48), 0, math.radians(38)); scene.collection.objects.link(ko)
    fill = bpy.data.lights.new('Fill', 'AREA'); fill.energy = 200; fill.size = 12
    fo = bpy.data.objects.new('Fill', fill); fo.location = (-7, -3, 4); scene.collection.objects.link(fo)
    rim = bpy.data.lights.new('Rim', 'AREA'); rim.energy = 700; rim.size = 4
    ro = bpy.data.objects.new('Rim', rim); ro.location = (-1.5, 6.5, 4.5); scene.collection.objects.link(ro)
    if not scene.world:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.05, 0.055, 1)
    scene.render.engine = 'CYCLES'
    try:
        scene.cycles.device = 'GPU'
    except Exception:
        pass
    scene.cycles.samples = 200
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 900
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass

def drop_to_ground(obj):
    bpy.context.view_layer.update()
    zmin = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    obj.location.z -= zmin

def frame_and_render(obj, name):
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = mathutils.Vector((min(p[i] for p in pts) for i in range(3)))
    mx = mathutils.Vector((max(p[i] for p in pts) for i in range(3)))
    center = (mn + mx) / 2
    cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 62
    cam = bpy.data.objects.new('Cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
    view_dir = mathutils.Vector((1.1, -1.5, 0.72)).normalized()
    # binary-search a distance that fits every bbox corner within the frame with margin
    aspect = scene.render.resolution_x / scene.render.resolution_y
    hfov = 2 * math.atan(math.tan(cam_d.angle / 2))            # horizontal (sensor fit = HORIZONTAL)
    vfov = 2 * math.atan(math.tan(cam_d.angle / 2) / aspect)
    corners = [mathutils.Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    def fits(dist):
        cam.location = center + view_dir * dist
        d = mathutils.Vector(cam.location) - center
        cam.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        inv = cam.matrix_world.inverted()
        for c in corners:
            cc = inv @ c
            if cc.z >= -1e-4:
                return False
            ax = math.atan2(abs(cc.x), -cc.z); ay = math.atan2(abs(cc.y), -cc.z)
            if ax > hfov / 2 * 0.82 or ay > vfov / 2 * 0.82:   # 0.82 = margin
                return False
        return True
    lo, hi = 0.5, 200.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if fits(mid):
            hi = mid
        else:
            lo = mid
    fits(hi)
    scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


# ── catalog: (name, builder) — builder returns the finished, materialed object ──────────────────
def a_sandbag():
    o = import_glb(os.path.join(MODELS, 'sandbag.glb'))
    scale_to(o, 1.45, 0.9, 0.55)   # length x depth x height (ft), a plump filled bag
    shade_smooth(o, 34)            # soften the low-poly facets into cloth
    mat_fabric(o); return o

def a_plywood():
    o = plywood_panel(4, 8, 0.5)
    o.rotation_euler = (math.radians(90), 0, math.radians(-20))   # stand up, quarter turn
    mat_plywood(o); return o

def a_picket():
    # this app's picket is a WOODEN driven stake (see three-viewer buildPicketWall), not steel
    o = import_glb(os.path.join(MODELS, 'picket.glb'))
    scale_to(o, 0.18, 0.18, 5.5)   # slim, ~5.5 ft driven stake
    shade_smooth(o, 40); mat_wood(o); return o

# tilt the broad face up toward camera (rotate about length axis) + a little yaw, so the grain reads
def a_2x4():
    o = timber(8, 3.5, 1.5); o.rotation_euler = (math.radians(38), 0, math.radians(16)); mat_wood(o); return o
def a_2x6():
    o = timber(8, 5.5, 1.5); o.rotation_euler = (math.radians(38), 0, math.radians(16)); mat_wood(o); return o
def a_4x4():
    o = timber(8, 3.5, 3.5); o.rotation_euler = (0, 0, math.radians(16)); mat_wood(o); return o

# NOTE: the sandbag is NOT rendered here — the correct bag (burlap weave, tied mouth) lives in the
# sibling CommandHub-Led sandbag_pro.py and was never exported to GLB; the catalog uses that approved
# hero render directly. Everything else renders from this app's actual assets, dark studio to match.
CATALOG = [
    ('plywood', a_plywood), ('picket', a_picket),
    ('lumber_2x4', a_2x4), ('lumber_2x6', a_2x6), ('lumber_4x4', a_4x4),
]

for name, build in CATALOG:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_studio()
    obj = build()
    drop_to_ground(obj)
    frame_and_render(obj, name)
    print('RENDERED', name)
print('DONE', OUT)
