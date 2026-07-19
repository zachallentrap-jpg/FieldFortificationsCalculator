# Blue-hour photoreal render: two-story farmhouse with permanent LED trim
# lighting sweeping a left-to-right rainbow across the rooflines.
# Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python led_house.py
import bpy, bmesh, math, random, colorsys, os, time
from mathutils import Matrix

t0 = time.time()
random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "led_house.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- render settings ----------
scene.render.engine = 'CYCLES'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
scene.cycles.samples = 160
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
try:
    scene.cycles.adaptive_threshold = 0.05
except Exception:
    pass
scene.cycles.sample_clamp_indirect = 10.0

# GPU (Metal) if available
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

# Color management: AgX + punchy look if present
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

# ---------- material helpers ----------
def principled(name, color, rough=0.8, metallic=0.0):
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

MAT_SIDING   = principled("siding",   (0.52, 0.50, 0.47), rough=0.65)
MAT_ROOF     = principled("roof",     (0.015, 0.015, 0.018), rough=0.55)
MAT_TRIM     = principled("trim",     (0.02, 0.02, 0.022), rough=0.5)
MAT_DOOR     = principled("door",     (0.015, 0.03, 0.035), rough=0.4)
MAT_GARDOOR  = principled("gardoor",  (0.07, 0.08, 0.09), rough=0.5)
MAT_GRASS    = principled("grass",    (0.015, 0.045, 0.015), rough=0.95)
MAT_CONCRETE = principled("concrete", (0.055, 0.055, 0.06), rough=0.12)  # wet after rain
MAT_BUSH     = principled("bush",     (0.01, 0.03, 0.01), rough=0.95)
MAT_FRAME    = principled("frame",    (0.02, 0.02, 0.02), rough=0.5)

def warm_window():
    s = random.uniform(1.1, 2.0)
    c = (1.0, random.uniform(0.45, 0.55), random.uniform(0.18, 0.26))
    return emissive("win" + str(random.random()), c, s)

MAT_PORCH = emissive("porch", (1.0, 0.6, 0.3), 25.0)
MAT_PATH  = emissive("path",  (1.0, 0.6, 0.3), 12.0)

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
    # gable roof, ridge running along X
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,ridge_y,z1),(x1,ridge_y,z1)]
    f = [(0,3,2,1),(0,1,5,4),(2,3,4,5),(0,4,3),(1,2,5)]
    return mesh_obj(name, v, f, mat)

def prism_y(name, x0, x1, y0, y1, z0, ridge_x, z1, mat):
    # gable roof, ridge running along Y
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(ridge_x,y0,z1),(ridge_x,y1,z1)]
    f = [(0,3,2,1),(1,2,5,4),(0,4,5,3),(0,1,4),(2,3,5)]
    return mesh_obj(name, v, f, mat)

# ---------- house ----------
# Main block: two-story, x -5..5, y -4..4, walls to z=5.6
box("main", -5, 5, -4, 4, 0, 5.6, MAT_SIDING)
prism_x("main_roof", -5.6, 5.6, -4.5, 4.5, 5.6, 0.0, 7.8, MAT_ROOF)

# Front cross-gable wing: x -4..0, protrudes to y=-6
box("wing", -4, 0, -6, -3.8, 0, 5.6, MAT_SIDING)
prism_y("wing_roof", -4.4, 0.4, -6.5, -3.6, 5.6, -2.0, 7.44, MAT_ROOF)

# Garage: single story, x 5..11
box("garage", 5, 11, -3.5, 2.5, 0, 3.4, MAT_SIDING)
prism_x("garage_roof", 4.7, 11.4, -4.0, 3.0, 3.4, -0.5, 4.6, MAT_ROOF)

# Chimney
box("chimney", 2.2, 3.0, 1.2, 2.0, 5.5, 8.7, MAT_TRIM)

# Fascia boards the LEDs mount on
box("fascia_main",   -5.6, 5.6, -4.52, -4.44, 5.45, 5.62, MAT_TRIM)
box("fascia_garage",  4.7, 11.4, -4.02, -3.94, 3.25, 3.42, MAT_TRIM)

# Garage door
box("gardoor", 5.8, 10.2, -3.54, -3.5, 0.05, 2.5, MAT_GARDOOR)

# Front door on the wing + sconces
box("door", -2.5, -1.5, -6.04, -6.0, 0.0, 2.1, MAT_DOOR)
for sx in (-2.85, -1.15):
    box("sconce", sx-0.06, sx+0.06, -6.1, -6.0, 2.25, 2.4, MAT_TRIM)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(sx, -6.08, 2.2))
    s = bpy.context.active_object
    s.data.materials.append(MAT_PORCH)

# ---------- windows ----------
def window(cx, cz, w, h, face_y=None, face_x=None):
    # frame + warm pane + muntin bars, slightly proud of the wall
    if face_y is not None:
        box("wframe", cx-w/2-0.06, cx+w/2+0.06, face_y-0.03, face_y+0.03, cz-h/2-0.06, cz+h/2+0.06, MAT_FRAME)
        box("wpane",  cx-w/2, cx+w/2, face_y-0.05, face_y-0.04, cz-h/2, cz+h/2, warm_window())
        box("wbar_v", cx-0.02, cx+0.02, face_y-0.055, face_y-0.035, cz-h/2, cz+h/2, MAT_FRAME)
        box("wbar_h", cx-w/2, cx+w/2, face_y-0.055, face_y-0.035, cz-0.02, cz+0.02, MAT_FRAME)
    else:
        box("wframe", face_x-0.03, face_x+0.03, cx-w/2-0.06, cx+w/2+0.06, cz-h/2-0.06, cz+h/2+0.06, MAT_FRAME)
        box("wpane",  face_x-0.05, face_x-0.04, cx-w/2, cx+w/2, cz-h/2, cz+h/2, warm_window())
        box("wbar_v", face_x-0.055, face_x-0.035, cx-0.02, cx+0.02, cz-h/2, cz+h/2, MAT_FRAME)
        box("wbar_h", face_x-0.055, face_x-0.035, cx-w/2, cx+w/2, cz-0.02, cz+0.02, MAT_FRAME)

# Main block front face (y=-4)
for wx in (1.5, 3.6):
    window(wx, 1.7, 1.4, 1.6, face_y=-4.0)
    window(wx, 4.2, 1.3, 1.3, face_y=-4.0)
window(-4.5, 1.7, 0.8, 1.6, face_y=-4.0)
window(-4.5, 4.2, 0.8, 1.3, face_y=-4.0)
# Wing front face (y=-6): upper window over the door
window(-2.0, 4.2, 1.5, 1.3, face_y=-5.96)
# Left side of main (x=-5), camera sees this face at an angle
window(-1.5, 1.7, 1.4, 1.6, face_x=-4.96)
window(-1.5, 4.2, 1.3, 1.3, face_x=-4.96)

# ---------- ground, driveway, walkway ----------
box("ground", -400, 400, -400, 400, -0.05, 0.0, MAT_GRASS)
box("driveway", 4.8, 11.4, -24, -3.5, 0.0, 0.012, MAT_CONCRETE)
box("walkway", -2.7, -1.3, -24, -6.0, 0.0, 0.014, MAT_CONCRETE)

# Path lights lining the walkway
for py in (-8.5, -11.0, -13.5, -16.0, -18.5):
    for px in (-3.05, -0.95):
        box("stake", px-0.02, px+0.02, py-0.02, py+0.02, 0, 0.3, MAT_TRIM)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(px, py, 0.34))
        s = bpy.context.active_object
        s.data.materials.append(MAT_PATH)

# Bushes along the front walls
for bx, by in ((0.8,-4.6),(2.6,-4.6),(4.4,-4.6),(-3.5,-6.6),(-0.5,-6.6),(-4.8,-4.6)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(bx, by, 0.32))
    b = bpy.context.active_object
    b.scale = (0.65, 0.6, 0.42)
    b.data.materials.append(MAT_BUSH)

# ---------- permanent LED trim: rainbow sweep, left to right ----------
RUNS = [
    ((4.7, -4.08, 3.46), (11.4, -4.08, 3.46)),    # garage eave
    ((-5.6, -4.58, 5.66), (5.6, -4.58, 5.66)),    # main front eave
    ((-4.4, -6.52, 5.64), (-2.0, -6.52, 7.46)),   # wing rake left
    ((-2.0, -6.52, 7.46), (0.4, -6.52, 5.64)),    # wing rake right
    ((-5.68, -4.5, 5.66), (-5.68, 0.0, 7.84)),    # main left gable rake
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
    # hidden larger twins cast the colored wash onto walls and eaves
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

# ---------- camera ----------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 30
cam_data.dof.use_dof = True
cam_data.dof.focus_distance = 17.0
cam_data.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (-7.5, -18.5, 1.8)
target = bpy.data.objects.new("target", None)
bpy.context.collection.objects.link(target)
target.location = (0.5, -2.0, 4.2)
con = cam.constraints.new('TRACK_TO')
con.target = target
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'
scene.camera = cam

# ---------- compositor: fog-glow bloom on the LEDs ----------
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

# ---------- render ----------
print("Scene built in %.1fs, rendering..." % (time.time() - t0))
bpy.ops.render.render(write_still=True)
print("Wrote %s in %.1fs total" % (OUT, time.time() - t0))
