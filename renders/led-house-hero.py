# Hero-grade blue-hour still: procedural lap siding, shingle courses,
# particle grass, silhouette trees, porch, puddled concrete, DOF bokeh.
# Zero downloaded assets — every material and mesh is built in code.
# Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python led_house_v2.py
import bpy, bmesh, math, random, colorsys, os, time
from mathutils import Matrix

t0 = time.time()
random.seed(11)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "led_house_hero.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

scene.render.engine = 'CYCLES'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
scene.cycles.samples = 192
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
try:
    scene.cycles.adaptive_threshold = 0.03
except Exception:
    pass
scene.cycles.sample_clamp_indirect = 10.0

try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    print("Cycles device: GPU/Metal")
except Exception as e:
    print("GPU setup failed, CPU fallback:", e)

try:
    scene.view_settings.view_transform = 'AgX'
except Exception:
    pass
for look in ('AgX - Punchy', 'AgX - Medium High Contrast', 'None'):
    try:
        scene.view_settings.look = look
        break
    except Exception:
        continue
scene.view_settings.exposure = 2.0

# ---------- materials ----------
def simple(name, color, rough=0.8, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    return m

def emissive(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (color[0], color[1], color[2], 1.0)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

def lap_siding(name, color, row_h, mortar, bump_strength, rough=0.65, mortar_col=None):
    # world-space horizontal courses via Brick texture driven by Geometry.Position
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = rough
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Row Height'].default_value = row_h
    brick.inputs['Brick Width'].default_value = 60.0  # no vertical joints
    brick.inputs['Mortar Size'].default_value = mortar
    try:
        brick.inputs['Mortar Smooth'].default_value = 0.4
    except Exception:
        pass
    c = color
    mc = mortar_col if mortar_col else (c[0]*0.35, c[1]*0.35, c[2]*0.35)
    brick.inputs['Color1'].default_value = (c[0], c[1], c[2], 1.0)
    brick.inputs['Color2'].default_value = (c[0]*0.92, c[1]*0.92, c[2]*0.92, 1.0)
    brick.inputs['Mortar'].default_value = (mc[0], mc[1], mc[2], 1.0)
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = bump_strength
    nt.links.new(geo.outputs['Position'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(brick.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def wet_concrete(name, base=(0.05, 0.052, 0.058)):
    # noise-mixed roughness: dry patches ~0.35, puddles ~0.04
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (base[0], base[1], base[2], 1.0)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.9
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.04, 0.04, 0.04, 1.0)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (0.35, 0.35, 0.35, 1.0)
    nt.links.new(geo.outputs['Position'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Roughness'])
    fine = nt.nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = 40.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.03
    nt.links.new(geo.outputs['Position'], fine.inputs['Vector'])
    nt.links.new(fine.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def warm_window():
    # noise-driven warmth gradient so no two windows glow alike
    m = bpy.data.materials.new("win" + str(random.random()))
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = random.uniform(1.0, 1.8)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = random.uniform(0.8, 2.0)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (1.0, 0.32, 0.10, 1.0)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (1.0, 0.62, 0.33, 1.0)
    nt.links.new(geo.outputs['Position'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m

MAT_SIDING   = lap_siding("siding", (0.50, 0.48, 0.45), row_h=0.21, mortar=0.010, bump_strength=0.35)
MAT_ROOF     = lap_siding("roof", (0.016, 0.016, 0.019), row_h=0.38, mortar=0.015, bump_strength=0.5, rough=0.55,
                          mortar_col=(0.004, 0.004, 0.005))
MAT_TRIM     = simple("trim",    (0.02, 0.02, 0.022), rough=0.5)
MAT_DOOR     = simple("door",    (0.015, 0.03, 0.035), rough=0.4)
MAT_GARDOOR  = simple("gardoor", (0.07, 0.08, 0.09), rough=0.5)
MAT_GROOVE   = simple("groove",  (0.03, 0.035, 0.04), rough=0.5)
MAT_GRASS    = simple("grass",   (0.015, 0.045, 0.015), rough=0.95)
MAT_LAWN     = simple("lawn",    (0.02, 0.06, 0.02), rough=0.9)
MAT_CONCRETE = wet_concrete("concrete")
MAT_BUSH     = simple("bush",    (0.01, 0.03, 0.01), rough=0.95)
MAT_FRAME    = simple("frame",   (0.02, 0.02, 0.02), rough=0.5)
MAT_BARK     = simple("bark",    (0.03, 0.022, 0.015), rough=0.9)
MAT_LEAF     = simple("leaf",    (0.012, 0.03, 0.01), rough=0.9)
MAT_LEAF2    = simple("leaf2",   (0.022, 0.05, 0.018), rough=0.85)
MAT_PORCH    = emissive("porch", (1.0, 0.6, 0.3), 25.0)
MAT_PATH     = emissive("path",  (1.0, 0.6, 0.3), 12.0)

# ---------- geometry helpers ----------
def box(name, x0, x1, y0, y1, z0, z1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0+x1)/2, (y0+y1)/2, (z0+z1)/2))
    o = bpy.context.active_object
    o.name = name
    o.scale = ((x1-x0), (y1-y0), (z1-z0))
    o.data.materials.append(mat)
    return o

def mesh_obj(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o

def prism_x(name, x0, x1, y0, y1, z0, ridge_y, z1, mat):
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,ridge_y,z1),(x1,ridge_y,z1)]
    f = [(0,3,2,1),(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)]
    return mesh_obj(name, v, f, mat)

def prism_y(name, x0, x1, y0, y1, z0, ridge_x, z1, mat):
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(ridge_x,y0,z1),(ridge_x,y1,z1)]
    f = [(0,3,2,1),(1,2,5,4),(0,4,5,3),(0,1,4),(2,3,5)]
    return mesh_obj(name, v, f, mat)

# ---------- house ----------
box("main", -5, 5, -4, 4, 0, 5.6, MAT_SIDING)
prism_x("main_roof", -5.6, 5.6, -4.5, 4.5, 5.6, 0.0, 7.8, MAT_ROOF)
box("wing", -4, 0, -6, -3.8, 0, 5.6, MAT_SIDING)
prism_y("wing_roof", -4.4, 0.4, -6.5, -3.6, 5.6, -2.0, 7.44, MAT_ROOF)
box("garage", 5, 11, -3.5, 2.5, 0, 3.4, MAT_SIDING)
prism_x("garage_roof", 4.7, 11.4, -4.0, 3.0, 3.4, -0.5, 4.6, MAT_ROOF)
box("chimney", 2.2, 3.0, 1.2, 2.0, 5.5, 8.7, MAT_TRIM)
box("fascia_main",   -5.6, 5.6, -4.52, -4.44, 5.45, 5.62, MAT_TRIM)
box("fascia_garage",  4.7, 11.4, -4.02, -3.94, 3.25, 3.42, MAT_TRIM)
box("gutter_main",   -5.6, 5.6, -4.56, -4.42, 5.34, 5.45, MAT_TRIM)
box("gutter_garage",  4.7, 11.4, -4.06, -3.92, 3.14, 3.25, MAT_TRIM)

# corner boards
for cx, cy in ((-5, -4), (5, -4), (-4, -6), (0, -6)):
    box("corner", cx-0.07, cx+0.07, cy-0.07, cy+0.07, 0, 5.6, MAT_TRIM)
for cx, cy in ((5, -3.5), (11, -3.5)):
    box("corner_g", cx-0.06, cx+0.06, cy-0.06, cy+0.06, 0, 3.4, MAT_TRIM)

# garage door with panel grooves
box("gardoor", 5.8, 10.2, -3.54, -3.5, 0.05, 2.5, MAT_GARDOOR)
for gz in (0.65, 1.25, 1.85):
    box("groove", 5.8, 10.2, -3.56, -3.53, gz-0.02, gz+0.02, MAT_GROOVE)

# porch: stoop, step, posts, slab roof, door, handle, sconces
box("stoop", -2.9, -1.1, -6.9, -5.96, 0, 0.18, MAT_CONCRETE)
box("step",  -2.8, -1.2, -7.25, -6.9, 0, 0.09, MAT_CONCRETE)
for px in (-2.8, -1.2):
    box("post", px-0.05, px+0.05, -6.8, -6.7, 0.18, 2.55, MAT_TRIM)
box("porch_roof", -3.0, -1.0, -6.95, -5.9, 2.55, 2.67, MAT_ROOF)
box("door", -2.5, -1.5, -6.04, -6.0, 0.18, 2.28, MAT_DOOR)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=(-1.62, -6.06, 1.25))
bpy.context.active_object.data.materials.append(MAT_TRIM)
for sx in (-2.85, -1.15):
    box("sconce", sx-0.06, sx+0.06, -6.1, -6.0, 2.25, 2.4, MAT_TRIM)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(sx, -6.08, 2.2))
    bpy.context.active_object.data.materials.append(MAT_PORCH)

# ---------- windows (frame + sill + varied warm pane + muntins) ----------
def window(cx, cz, w, h, face_y=None, face_x=None):
    if face_y is not None:
        box("wframe", cx-w/2-0.06, cx+w/2+0.06, face_y-0.03, face_y+0.03, cz-h/2-0.06, cz+h/2+0.06, MAT_FRAME)
        box("wsill",  cx-w/2-0.10, cx+w/2+0.10, face_y-0.09, face_y+0.02, cz-h/2-0.11, cz-h/2-0.06, MAT_TRIM)
        box("wpane",  cx-w/2, cx+w/2, face_y-0.05, face_y-0.04, cz-h/2, cz+h/2, warm_window())
        box("wbar_v", cx-0.02, cx+0.02, face_y-0.055, face_y-0.035, cz-h/2, cz+h/2, MAT_FRAME)
        box("wbar_h", cx-w/2, cx+w/2, face_y-0.055, face_y-0.035, cz-0.02, cz+0.02, MAT_FRAME)
    else:
        box("wframe", face_x-0.03, face_x+0.03, cx-w/2-0.06, cx+w/2+0.06, cz-h/2-0.06, cz+h/2+0.06, MAT_FRAME)
        box("wsill",  face_x-0.09, face_x+0.02, cx-w/2-0.10, cx+w/2+0.10, cz-h/2-0.11, cz-h/2-0.06, MAT_TRIM)
        box("wpane",  face_x-0.05, face_x-0.04, cx-w/2, cx+w/2, cz-h/2, cz+h/2, warm_window())
        box("wbar_v", face_x-0.055, face_x-0.035, cx-0.02, cx+0.02, cz-h/2, cz+h/2, MAT_FRAME)
        box("wbar_h", face_x-0.055, face_x-0.035, cx-w/2, cx+w/2, cz-0.02, cz+0.02, MAT_FRAME)

for wx in (1.5, 3.6):
    window(wx, 1.7, 1.4, 1.6, face_y=-4.0)
    window(wx, 4.2, 1.3, 1.3, face_y=-4.0)
window(-4.5, 1.7, 0.8, 1.6, face_y=-4.0)
window(-4.5, 4.2, 0.8, 1.3, face_y=-4.0)
window(-2.0, 4.2, 1.5, 1.3, face_y=-5.96)
window(-1.5, 1.7, 1.4, 1.6, face_x=-4.96)
window(-1.5, 4.2, 1.3, 1.3, face_x=-4.96)

# ---------- grounds ----------
box("ground", -400, 400, -400, 400, -0.05, 0.0, MAT_GRASS)
box("driveway", 4.8, 11.4, -24, -3.5, 0.0, 0.012, MAT_CONCRETE)
box("walkway", -2.7, -1.3, -24, -7.25, 0.0, 0.014, MAT_CONCRETE)

# particle-hair lawns flanking the walkway (guarded: scene still works without)
def lawn(name, x0, x1, y0, y1, count):
    bpy.ops.mesh.primitive_plane_add(size=1, location=((x0+x1)/2, (y0+y1)/2, 0.005))
    o = bpy.context.active_object
    o.name = name
    o.scale = ((x1-x0), (y1-y0), 1)
    o.data.materials.append(MAT_LAWN)
    try:
        o.modifiers.new("grass", type='PARTICLE_SYSTEM')
        s = o.particle_systems[0].settings
        s.type = 'HAIR'
        s.count = count
        s.hair_length = 0.10
        s.child_type = 'INTERPOLATED'
        s.child_percent = 2
        s.rendered_child_count = 6
        try:
            s.root_radius = 0.6
        except Exception:
            pass
        s.material = 1
    except Exception as e:
        print("grass particles failed:", e)

lawn("lawn_L", -30, -2.75, -26, -4.2, 60000)
lawn("lawn_R", -1.25, 4.75, -26, -6.2, 30000)

# path lights
for py in (-8.5, -11.0, -13.5, -16.0, -18.5):
    for px in (-3.05, -0.95):
        box("stake", px-0.02, px+0.02, py-0.02, py+0.02, 0, 0.3, MAT_TRIM)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(px, py, 0.34))
        bpy.context.active_object.data.materials.append(MAT_PATH)

# bushes
for bx, by, bs in ((0.8,-4.6,0.65),(2.6,-4.6,0.72),(4.4,-4.6,0.6),(-3.5,-6.6,0.68),(-0.5,-6.6,0.6),(-4.8,-4.6,0.7)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(bx, by, 0.32))
    b = bpy.context.active_object
    b.scale = (bs, bs*0.9, bs*0.62)
    b.data.materials.append(MAT_BUSH)

# trees: tapered trunk + many small jittered canopy puffs (rounded, not a monolith)
def tree(x, y, h, spread):
    bpy.ops.mesh.primitive_cone_add(radius1=h*0.03, radius2=h*0.012, depth=h*0.55, location=(x, y, h*0.27))
    bpy.context.active_object.data.materials.append(MAT_BARK)
    # dense cloud of small spheres reads as foliage, not a hexagon
    for i in range(26):
        u = random.uniform(0, 1) ** 0.5
        ang = random.uniform(0, 2*math.pi)
        ox = math.cos(ang) * spread * u
        oy = math.sin(ang) * spread * u
        oz = random.uniform(-h*0.06, h*0.22) + (1.0 - u) * h * 0.10
        r = random.uniform(spread*0.28, spread*0.5)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=(x+ox, y+oy, h*0.6+oz))
        c = bpy.context.active_object
        c.scale = (1.0, 1.0, random.uniform(0.82, 0.98))
        # slight per-puff lightness so the silhouette has interior form
        lm = MAT_LEAF if random.random() < 0.5 else MAT_LEAF2
        c.data.materials.append(lm)

tree(-14.5, -10, 7.5, 2.2)
tree(19.0, 6.0, 9.5, 2.8)
tree(-18, 4, 10.0, 3.0)

# ---------- LED trim (static rainbow, same runs as v1) ----------
RUNS = [
    ((4.7, -4.08, 3.46), (11.4, -4.08, 3.46)),
    ((-5.6, -4.58, 5.66), (5.6, -4.58, 5.66)),
    ((-4.4, -6.52, 5.64), (-2.0, -6.52, 7.46)),
    ((-2.0, -6.52, 7.46), (0.4, -6.52, 5.64)),
    ((-5.68, -4.5, 5.66), (-5.68, 0.0, 7.84)),
]
SPACING = 0.3
points = []
for (a, b) in RUNS:
    dx, dy, dz = b[0]-a[0], b[1]-a[1], b[2]-a[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    n = max(2, int(length / SPACING))
    for i in range(n + 1):
        t = i / n
        points.append((a[0]+dx*t, a[1]+dy*t, a[2]+dz*t))

xmin = min(p[0] for p in points)
xmax = max(p[0] for p in points)
NBUCKETS = 28
buckets = {}
for p in points:
    hue = 0.83 * (p[0]-xmin) / (xmax-xmin)
    buckets.setdefault(min(NBUCKETS-1, int(hue/0.83*NBUCKETS)), []).append((hue, p))

def sphere_cloud(name, pts, radius, mat, camera_visible=True):
    bm = bmesh.new()
    for p in pts:
        try:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius, matrix=Matrix.Translation(p))
        except TypeError:
            bmesh.ops.create_icosphere(bm, subdivisions=1, diameter=radius, matrix=Matrix.Translation(p))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    if not camera_visible:
        try:
            o.visible_camera = False
        except Exception:
            pass
    return o

for bi, entries in buckets.items():
    hue = sum(e[0] for e in entries) / len(entries)
    r, g, b = colorsys.hsv_to_rgb(hue, 0.95, 1.0)
    pts = [e[1] for e in entries]
    sphere_cloud("led_%d" % bi, pts, 0.035, emissive("ledm_%d" % bi, (r, g, b), 40.0))
    sphere_cloud("ledglow_%d" % bi, pts, 0.10, emissive("ledg_%d" % bi, (r, g, b), 7.0), camera_visible=False)

# ---------- sky, moonlight ----------
world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = next(n for n in wn.nodes if n.type == 'BACKGROUND')
sky = wn.nodes.new('ShaderNodeTexSky')
try:
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(-4.5)
    sky.sun_rotation = math.radians(35.0)
    sky.dust_density = 2.5
except Exception:
    pass
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 1.2

moon_data = bpy.data.lights.new("moon", 'SUN')
moon_data.energy = 0.06
moon_data.color = (0.55, 0.65, 1.0)
moon = bpy.data.objects.new("moon", moon_data)
bpy.context.collection.objects.link(moon)
moon.rotation_euler = (math.radians(50), 0, math.radians(160))

# ---------- camera: 32mm, f/2.8, focused on the house ----------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 32
cam_data.dof.use_dof = True
cam_data.dof.focus_distance = 16.0
cam_data.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (-8.5, -19.5, 1.6)
target = bpy.data.objects.new("target", None)
bpy.context.collection.objects.link(target)
target.location = (0.3, -2.0, 4.0)
con = cam.constraints.new('TRACK_TO')
con.target = target
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'
scene.camera = cam

# ---------- compositor bloom ----------
scene.use_nodes = True
nt = scene.node_tree
nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers')
glare = nt.nodes.new('CompositorNodeGlare')
for attr, val in (('glare_type', 'FOG_GLOW'), ('quality', 'HIGH'), ('threshold', 1.0), ('size', 8), ('mix', 0.0)):
    try:
        setattr(glare, attr, val)
    except Exception:
        pass
for iname, val in (('Threshold', 1.0), ('Strength', 0.55), ('Size', 0.05), ('Saturation', 1.0)):
    try:
        if iname in glare.inputs:
            glare.inputs[iname].default_value = val
    except Exception:
        pass
comp = nt.nodes.new('CompositorNodeComposite')
nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
nt.links.new(glare.outputs['Image'], comp.inputs['Image'])

print("Scene built in %.1fs, rendering..." % (time.time() - t0))
bpy.ops.render.render(write_still=True)
print("Wrote %s in %.1f min" % (OUT, (time.time() - t0) / 60.0))
