"""Real-scale (feet) doctrine asset builders for the one-man fighting position.

Every builder returns a Blender object at REAL size in feet (1 unit = 1 ft),
positioned sensibly for assembly (centered in XY, base at z=0 unless noted).
Dimensions trace to docs/ONE_MAN_POSITION_MODELING_SPEC.md.
"""
import bpy, bmesh, math

IN = 1.0 / 12.0   # inches -> feet


# ── shared ────────────────────────────────────────────────────────────────
def _new(name):
    mesh = bpy.data.meshes.new(name + 'Mesh')
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, mesh


def _finish(obj, bm, color, rough=0.9, smooth_angle=None):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if smooth_angle is not None:
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
        except Exception:
            bpy.ops.object.shade_smooth()
    mat = bpy.data.materials.new(obj.name + 'Mat')
    mat.use_nodes = True
    b = mat.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1)
    b.inputs['Roughness'].default_value = rough
    obj.data.materials.append(mat)
    obj.select_set(False)
    return obj


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def _rounded_rect(hw, hh, r, seg):
    r = min(r, hw, hh)
    corners = [(hw - r, hh - r, 0, 90), (-hw + r, hh - r, 90, 180),
               (-hw + r, -hh + r, 180, 270), (hw - r, -hh + r, 270, 360)]
    pts = []
    for cx, cz, a0, a1 in corners:
        for i in range(seg):
            a = math.radians(a0 + (a1 - a0) * i / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


# ── 1. Sandbag (15 x 10 x 5 in, tamped flat) ────────────────────────────────
def sandbag(seed=0.0):
    L, W, H = 15 * IN, 10 * IN, 5 * IN
    hw, hh = W / 2, H / 2
    obj, mesh = _new('Sandbag')
    bm = bmesh.new()
    base = _rounded_rect(hw, hh, 2 * IN, 6)
    n = len(base)
    N = 20

    def lscale(t):
        if t < 0.12:
            return 0.62 + 0.38 * smoothstep(0.0, 0.12, t)
        if t > 0.80:
            return 1.0 - 0.55 * smoothstep(0.80, 1.0, t)
        return 1.0

    rings = []
    for i in range(N + 1):
        t = i / N
        x = (t - 0.5) * L
        s = lscale(t)
        wb = 1.0 + 0.05 * math.sin(math.pi * min(1.0, max(0.0, (t - 0.1) / 0.8)))
        ring = []
        for (y, z) in base:
            yy = y * s * wb
            zz = z * 0.72 * s if z < 0 else z * (1.06 - 0.10 * abs(t - 0.45)) * s
            # tiny deterministic wrinkle
            wob = 1.0 + 0.03 * math.sin(y * 9.1 + z * 7.3 + t * 12.0 + seed)
            ring.append(bm.verts.new((x, yy * wob, zz * wob)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((a[j], a[j2], b[j2], b[j]))
    for ring, sign in ((rings[0], -1), (rings[-1], 1)):
        c = bm.verts.new((sign * (L / 2 + 0.02), 0, hh * 0.15 if sign > 0 else 0))
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((ring[j2], ring[j], c) if sign < 0 else (ring[j], ring[j2], c))
    _finish(obj, bm, (0.70, 0.56, 0.33), 0.94, smooth_angle=40)
    # rest base on z=0
    zmin = min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices:
        v.co.z -= zmin
    obj.data.update()
    return obj


# ── 2. Squared timber 4x4 (length in feet) ──────────────────────────────────
def timber_4x4(length_ft, axis='x'):
    s = 4 * IN                     # 4 inch nominal squared section
    hs = s / 2
    ch = 0.35 * IN                 # chamfer
    obj, mesh = _new('Timber4x4')
    bm = bmesh.new()
    # chamfered square cross-section in (y,z)
    prof = [
        (hs - ch, -hs), (hs, -hs + ch), (hs, hs - ch), (hs - ch, hs),
        (-hs + ch, hs), (-hs, hs - ch), (-hs, -hs + ch), (-hs + ch, -hs),
    ]
    n = len(prof)
    L = length_ft
    N = max(2, int(length_ft / 0.5))
    rings = []
    for i in range(N + 1):
        x = -L / 2 + L * i / N
        ring = [bm.verts.new((x, y, z)) for (y, z) in prof]
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((a[j], a[j2], b[j2], b[j]))
    for ring, sign in ((rings[0], -1), (rings[-1], 1)):
        vs = ring if sign > 0 else list(reversed(ring))
        bm.faces.new(vs)
    _finish(obj, bm, (0.52, 0.38, 0.22), 0.8)   # softwood tan-brown
    if axis == 'z':
        obj.rotation_euler = (0, math.radians(90), 0)
    return obj


# ── 3. Plywood panel (w x h ft, thickness in) ──────────────────────────────
def plywood(w_ft, h_ft, thick_in=0.75):
    obj, mesh = _new('Plywood')
    bm = bmesh.new()
    t = thick_in * IN
    hw, hh, ht = w_ft / 2, h_ft / 2, t / 2
    for sx in (-1, 1):
        pass
    verts = [bm.verts.new((x, y, z)) for x in (-hw, hw) for y in (-hh, hh) for z in (-ht, ht)]
    # index: x0y0z0, x0y0z1, x0y1z0, x0y1z1, x1y0z0, x1y0z1, x1y1z0, x1y1z1
    v = verts
    faces = [
        (v[0], v[2], v[3], v[1]), (v[4], v[5], v[7], v[6]),
        (v[0], v[1], v[5], v[4]), (v[2], v[6], v[7], v[3]),
        (v[0], v[4], v[6], v[2]), (v[1], v[3], v[7], v[5]),
    ]
    for f in faces:
        bm.faces.new(f)
    _finish(obj, bm, (0.66, 0.52, 0.32), 0.85)
    return obj


# ── 4. U-shaped steel picket (length ft, standing vertical, point down) ─────
def u_picket(length_ft):
    obj, mesh = _new('UPicket')
    bm = bmesh.new()
    wflange = 1.5 * IN
    web = 1.4 * IN
    thick = 0.18 * IN
    L = length_ft
    point = 4 * IN
    # U cross-section (open toward +y) as a thin channel outline in (x,y)
    prof = [
        (-web / 2, 0), (web / 2, 0),
        (web / 2, wflange), (web / 2 - thick, wflange),
        (web / 2 - thick, thick), (-web / 2 + thick, thick),
        (-web / 2 + thick, wflange), (-web / 2, wflange),
    ]
    n = len(prof)
    N = 16
    rings = []
    for i in range(N + 1):
        t = i / N
        z = t * L
        # taper to a point in the bottom `point` length
        if z < point:
            sc = max(0.06, z / point)
        else:
            sc = 1.0
        ring = [bm.verts.new((x * sc, y * sc, z)) for (x, y) in prof]
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((a[j], a[j2], b[j2], b[j]))
    bm.faces.new(list(reversed(rings[-1])))
    bm.faces.new(rings[0])
    _finish(obj, bm, (0.30, 0.32, 0.34), 0.55)   # dark steel
    return obj


# ── 5. Sector stake (18 in) / aiming stake (12 in forked) ───────────────────
def _limb(length_ft, r_ft, forked=False):
    obj, mesh = _new('Stake')
    bm = bmesh.new()
    SIDES = 8
    N = 10
    point = 0.18 * length_ft
    rings = []
    for i in range(N + 1):
        t = i / N
        z = t * length_ft
        if z < point:
            rad = r_ft * max(0.05, (z / point) ** 1.4)
        else:
            rad = r_ft * (0.95 + 0.08 * math.sin(t * 6))
        ring = [bm.verts.new((rad * math.cos(2 * math.pi * s / SIDES),
                              rad * math.sin(2 * math.pi * s / SIDES), z)) for s in range(SIDES)]
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(N):
        a, b = rings[i], rings[i + 1]
        for s in range(SIDES):
            s2 = (s + 1) % SIDES
            bm.faces.new((a[s], a[s2], b[s2], b[s]))
    c = bm.verts.new((0, 0, 0))
    for s in range(SIDES):
        s2 = (s + 1) % SIDES
        bm.faces.new((rings[0][s2], rings[0][s], c))
    if not forked:
        bm.faces.new(list(reversed(rings[-1])))
    _finish(obj, bm, (0.40, 0.29, 0.16), 0.82, smooth_angle=30)
    if forked:
        # add two short prongs at the top -> a Y fork
        top = length_ft
        for sign in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r_ft * 0.7,
                                                depth=length_ft * 0.32,
                                                location=(sign * r_ft * 1.0, 0, top + length_ft * 0.11))
            prong = bpy.context.active_object
            prong.rotation_euler = (0, math.radians(sign * 26), 0)
            bpy.ops.object.select_all(action='DESELECT')
            prong.select_set(True)
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.join()
        # the joined prongs came in with no material (default white) — unify to
        # one wood material across every face so the whole fork reads as wood.
        obj.data.materials.clear()
        mat = bpy.data.materials.new('StakeMat')
        mat.use_nodes = True
        b = mat.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = (0.40, 0.29, 0.16, 1)
        b.inputs['Roughness'].default_value = 0.82
        obj.data.materials.append(mat)
        for p in obj.data.polygons:
            p.material_index = 0
    return obj


def sector_stake():
    return _limb(18 * IN, 0.5 * IN, forked=False)


def aiming_stake():
    return _limb(12 * IN, 0.45 * IN, forked=True)
