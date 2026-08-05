# Visual-fidelity sweep

A running record of which structures have actually been **looked at** — rendered headlessly and
inspected, not reasoned about. One target per pass. The point of writing it down is that
"I checked that" is worthless without a list, and the same three families get re-checked while
the interesting combinations never do.

Method: `node .scratch/look.mjs <name> <family> '<json edits>' [stage]` builds `dist/`, opens the
family in the Planning workbench, applies the config edits by their `data-path`, and shoots the
model from iso, from underneath, from the end, and optionally at one framing stage. Then the
screenshots get read.

| Target | Verdict |
|---|---|
| Loading platform — deck, ramp, skids | **Fixed** — flat pieces were on edge; the ramp carried per-piece trigonometry with inconsistent signs. |
| Guard tower — platform deck, stair, cab roof | **Fixed** — a sheet on edge under the cab, a stair leaving the footprint, four rectangles where a pyramid needs triangles. |
| Crib bunker — lagging, entrance, baffle | **Fixed** — gaps between every roof board; no jamb posts; a baffle floating clear of the ground. |
| Huts — openings, latrine riser box | **Fixed** — every hut generated with no door and no window; the riser box did not close. |
| Building — hip roof + purlins + corrugated | **Fixed** — hip members stamped into the ceiling stage, purlins unclipped past the hips and sunk in the rafters, roofing flush with the hip tops. |
| Building — gable + purlins | **Fixed** — the frozen gable's own deck plus purlins double-decked the roof and the bill. |
| Building — **shed roof, closing in** | **Fixed** — see below. Siding stopped at the cap plate and left every raked area as open framing. |
| Building — gable end, closing in | **Fixed** with the same change; the apex needed a second pass (below). |
| Grade / underside of every structure | **Fixed** — a solid ground slab and a camera floor made undersides unreachable. |
| Building — **basement foundation + stair** | **Fixed** — the stair stringers ran 6.6 in below the basement slab, through the floor and into the earth. Walls, footings, slab, opening framing, riser count and tread geometry were all correct. |
| Tent frame — strongback and tent-floor | **Checked, clean.** Nothing wrong. Bent posts stand exactly on the deck top, rafters meet the ridge, collars tie the bents, deck on joists on skids. |
| Two-story building | **Not a render defect** — a parked feature (T6b). It was being accepted silently, which is fixed; see below. |
| Storage shed — open front, skids, board-and-batten | **Fixed** — board-and-batten rendered as horizontal clapboard. The geometry was right; the wood grain ran across every board instead of along it. |
| Building — **slab on grade** | **Fixed** — the option emitted no slab at all: a suspended wood floor over clear air, and no concrete in the model or on the bill. |
| Building — flat roof at 1:12 | **Checked, clean.** Nothing wrong. Pony studs exactly span×slope, rafters at atan(1/12) and the right length, deck above the rafters, walls closed in. |
| Building — continuous-wall foundation | **Checked, clean.** Nothing wrong. Every bearing exact to 0.0000: posts on pads, walls on strip footings, sills on walls, girder on posts. |
| **Openings vs. the plates they sit under** | **Fixed** — the storage shed's door header ran 1¾ in through the top plate, and the guard shack had three more. |
| **Sheathing under siding** — the two-layer standoff | **Fixed** — over board sheathing the siding sat a quarter inch inside it, on every wall. |
| **Building paper / felt under the roofing** | **Fixed** — the option was accepted and ignored; no felt was ever emitted, and no way to ask for it. |
| **B-hut partitions** — the bays that define it | **Fixed** — the partitions were computed, put on the spec, and never framed. |
| **The open front** (`openFront`) | **Fixed** — the card offers it, the spec documents it, normalize honours it, and the wall was framed shut. |
| Let-in bracing | **Checked, clean.** Proper diagonals let into the studs at every corner. |
| **Eave / rafter tails** | **Fixed** — no fascia existed, so every roof ended in a row of raw square-cut rafter ends. |
| **Picker & flashcard portraits** | **Improved, not solved** — the painter sorted polygons by their CENTRE; long members painted over the sheets covering them. |

## The shed that had no walls above the plate

Rendering a shed roof end-on showed the whole rake triangle as bare studs — daylight straight
through the building. The cause was one omission with three faces: the covering pass only ever
tiled `walls.surfaces`, which are rectangles that stop at the cap plate. Everything a roof leaves
above that plate — a gable end's triangle, a shed's pony wall, a shed's two rake triangles — was
framed and then never closed in, and the take-off was short by all of it.

`wallInfillProfiles` now states, per roof kind, what each wall has to close in as a height at
every station along its run, and `generateInfillCovering` skins it in the wall's own material.
A hip is the proof the profiles are real geometry rather than a blanket rule: all four of its
slopes land on the plate, so a hip has no infill anywhere — which is why hip walls always looked
right while every gable end did not.

**The apex needed a second look.** The first cut sized each module's subdivision from the height
at its two ENDS, which is blind to a peak in the middle. A gable's ridge lands inside a module
whose ends are then the same height, so that module read as flat and came out as a single 4-ft
slab standing at ridge height in the middle of the gable end — clearly wrong on screen, invisible
to an area test, which is exactly why the loop looks at pictures. The tiler now walks each module
in fine cells and merges while the top edge stays inside one `rakeStepFt`, so a flat top emits one
piece per module and a peak breaks the run where it actually is.

## The stair that went through the basement floor

The basement was the first thing worth looking at precisely because nobody could have seen it
before: until grade stopped being an opaque slab, the entire foundation was behind it. Almost
everything checked out — walls on their footings, the slab bearing on the footing ledges, the
opening framed with doubled trimmers and headers, 13 risers and 12 treads landing exactly on
the slab. The stringers did not: they reached 6.6 in below the basement floor.

Two compounding mistakes, written up in full in `DECISIONS.md` under 2026-08-05. The length came
from `hypot(runFt, totalRiseFt)`, which mixes TREADS unit runs with RISERS unit rises and so
describes a line at a different pitch than the board is rotated to; and the board was then
dropped half its depth square to the run, which is right at the top and wrong at the bottom.
The board is now placed off its two real ends — lower corner on the slab, upper corner at the
floor above — and both errors go away together.

This was a **compat-lock event**: `floor.ts` is frozen legacy and both golden sets moved. The
blast radius was exactly three members in two cases, because no other foundation builds a stair.
The existing test had been asserting the length equalled `hypot(runFt, totalRiseFt)` — pinning
the bug rather than the claim — and now asserts the physical endpoints instead.

## The strongback, which was fine

Rendered from iso and end-on, and the first read of the iso shot looked wrong — the deck seemed
to sit offset from the bents. It does not. Measured as true AABBs rather than eyeballed:
deck `x 0..32, y 0.60..0.73, z 0..20`, posts `y 0.73..7.23` standing exactly on the deck top and
`z 0.19..19.81` inside its edges, rafters closing on the ridge at `y 11.08..11.38`. The apparent
offset was perspective — an eleven-foot frame over a knee-high deck projects up and away from it.
The end-on view settles it. Recorded as checked and clean; no change made.

That is worth writing down precisely because the loop's failure mode is inventing a defect to
justify a commit. A screenshot is where a defect gets NOTICED; the numbers are where it gets
CONFIRMED, and this one did not survive them.

## The second story nobody was told about

Two stories was never a render defect, because a second story is not built at all: the engine
frames `stories[0]` and stops. That parking is deliberate — TIMBER2_PLAN scopes the story loop,
the second-floor bearing and the interior stairwell as T6b, first on its own descope ladder.

The defect was the silence. `normalizeSpec` accepted `stories: [a, b]` with **zero issues**, and
the model that came out was byte-identical to the one-story it was not — same 321 members, same
overall height. Every downstream artifact, the render and the cut list and the packet, described
a different building than the one asked for, and nothing anywhere said so. The clamp that existed
only caught THREE or more stories, so the one case that could actually be requested passed
straight through. It now clamps at one and warns, exactly like every other out-of-scope input.

## Wood grain that ran the wrong way

The storage shed is the board-and-batten card, and it rendered as horizontal lap siding —
clapboard, unmistakably. The geometry was not the problem and it is worth saying why that took a
minute to establish: `timber2-coverings` already asserts board siding and battens run vertically,
and it passes. Probing the members confirmed it — 28 boards side by side across the south wall,
each 8 ft long with its length axis at `[0, 1, 0]`.

The material was the liar. Measured straight off the GLB props, a lumber piece is a unit cube
with a box-atlas unwrap, and on the broad face that atlas puts **V across the full length** while
U is a sliver about 3.5% wide — corner `(-0.5, -0.46)` maps to `(0.076, 0.998)` and `(+0.5, +0.43)`
to `(0.041, 0.002)`. The grain was drawn as lines of constant canvas-Y, which is constant V: every
line crossed the board and the set of them repeated ALONG it. Nine lines over an eight-foot board
is a band every eleven inches, and a wall of vertical boards banded every eleven inches is a wall
of clapboard.

The grain is now drawn as vertical canvas lines, which that atlas maps along the length, with
`repeat.x` compensating for the sliver so a board carries a few lines rather than part of one.
This dresses every stick of lumber in the app, so framing was re-checked at the rafter stage too.

`timber2-lumber-grain` pins the fact the texture depends on: if the props are ever re-exported
with a different unwrap, it fails and names `lumberTexture()` — rather than the siding quietly
going back to looking like lap.

## Slab on grade, which poured no concrete

Chosen because the underside is newly visible, and it showed a full wood floor — joists,
bridging, subfloor — with nothing whatever beneath it. The `grounded` branch handled skids and
slabs together and only the skid case emitted anything below the floor, so "Slab on grade"
framed a suspended floor and left out the slab it is named after. Nothing in the cut list said
concrete either.

A slab is now what it is: one pour whose top IS the floor at y = 0, its edge thickened under
every wall line to carry them, no joists and no deck. Putting a wood floor on a slab is not a
foundation choice, it is two floors.

**One thing this got wrong first, and the sweep caught it.** The slab plan initially DROPPED the
"Floor joists" and "Subfloor" rows, on the reasoning that a stage with nothing in it is a dead
stop on the scrubber. That broke the frozen branch: `walls.ts` stamps a sole plate as stage 5 and
a cap plate as stage 6 as LITERALS, so removing a row above them landed every wall member a stage
late or past the end of the plan — which the seeded sweep caught immediately, and which the
stage-plan file's own comment had already warned about ("rows 1–6 never move"). The rows keep
their positions now and change their MEANING instead: thickened edge poured, slab poured, slab
cures. A curing slab really is a step a crew plans around, and it is honest that no member
appears during it.

## Two that were fine, and one that was not

The flat roof and the continuous-wall foundation were both rendered and both **correct** — no
change made. Flat: pony studs exactly `span × slope`, rafters rotated to `atan(1/12)` and cut to
22.08 ft, the deck riding above them, every wall closed in. Wall foundation: posts land on their
pads, walls on their strip footings, sills on the walls and the girder on the posts, every
bearing exact to four decimal places.

The third — the storage shed's wide-door framing — was not. Its 8-ft door needs a **2x10** by the
span table (that was itself a fix, recorded in `DECISIONS.md`), a 2x10 is 9¼ in deep, and an 8-ft
wall leaves 91½ in between plates. A 7-ft door plus that header wants 93¼. The header was drawn
anyway, running **1¾ in through the top plate** — two solid members in the same space, on a
shipped card, hidden by siding and visible only with the framing stage scrubbed up. Fixing the
header's DEPTH had created a HEADROOM conflict, and nothing checked the second thing.

Generalised rather than patched: `maxOpeningTopFt` states what a wall can carry — sole plate,
sill, opening and header all have to fit under the doubled top plate — and `normalizeSpec` clamps
anything over it with the usual visible warning. That immediately found three more on the guard
shack, whose 7.5-ft walls carried windows at the standard 3½-ft sill.

Two smaller things fell out of it. `OPENING.doorHeightFt` was **6.7 ft while its own citation
said "6 ft 8 in"** — 6.667 — and those four tenths of an inch were exactly what pushed the guard
shack's door past its wall. And `defaultOpenings` now places a window sill that fits the wall it
is going into: the window's SIZE is doctrine and does not move, but where the default sill sits is
the generator's choice, and a default that cannot be built is not a default.

## Two skins in the same quarter inch

Sheathing and siding had never been rendered together. Measured across all four combinations,
plywood-under-anything was exact and **board sheathing was a quarter inch out**: the siding sat
INSIDE the layer it is nailed to, on every wall of the building.

The cause is worth naming because it is not a geometry mistake. `generateBuilding` computed the
siding's standoff as `PANEL.sidingThickIn` — a constant that is correct for plywood sheathing
(½ in) and wrong for boards (¾). Nothing was miscalculated; the wrong quantity was consulted, and
it agreed with the right one in the case anyone had looked at.

`wallLayerThicknessFt` now answers "how thick is one layer of this" once, and the sheet tiler,
the board tiler, the raked infill and the standoff all ask it. That is the actual fix — a single
constant two call sites can disagree about is the bug, not the quarter inch it produced.

## An option that was accepted and ignored

`spec.coverings.buildingPaper` reached `generateRoofCovering` as a declared input field, was
never destructured, and emitted nothing. Around that hole, every other part of the feature was
already in place: `ROOFING.feltWidthIn` and `feltLapIn` in doctrine (unused), the `felt` role in
the type union (never emitted) with the label *"Underlayment between deck and roofing"*, the
portrait renderer and the worksheet omit-set both handling it — and this module's own header
claiming felt was among the things it generates. Everything existed except the part that makes
it exist. There was also no control anywhere to turn it on.

Felt is now laid: 36-in courses lapping 2 in, from the eave up, banded across a hip's taper the
same way the roofing is, with the roofing and the ridge caps lifted onto it. The panel offers it
wherever there is a deck to lay it on.

Two details worth keeping. The lap is real material, so the felt bills about 6% MORE than the
roof's area — which is the point of modelling the lap rather than the coverage. And the roofing's
lift is measured **square to the slope**, so its vertical rise is the felt's thickness times
cos(pitch); the test asserts that rather than the plain thickness, which would pass on a flat
roof and would not tell a layer stacked along the normal from one nudged straight up.

## The hut whose defining feature was not built

A B-hut is a hut divided into bays; that is what makes it a B-hut rather than a squad hut.
`bHutPartitions()` computed three dividers, `buildingSpecForHut` put them on the `BuildingSpec`,
and `isLegacyBuilding` even tested for their presence — while `generateBuilding` never read the
field. Nothing was framed. The card's own cutaway reads *"cut across the bays — see how the
partitions land between the studs"*, which pointed a cut plane at empty air.

That is the same shape as the slab, the second story and the building paper: **a field the spec
carries, the plumbing passes along, and no generator consumes.** Four instances now, all found by
rendering the thing rather than reading the code — which is the argument for this loop.

Partitions are framed as what they are: a NON-BEARING wall. Sole plate, studs, **one** top plate
(an exterior wall's doubled cap is what carries a roof; a partition carries nothing), and a
framed doorway with kings, jacks, a header and cripples over it. They butt between the exterior
walls rather than running through them, the convention `wallSystem` already uses.

The test checks the stack meets at every joint — floor→sole→studs→plate and jacks→header→
cripples→plate — and that the squad hut, whose card promises "one long open bay, no partitions",
has none.

## The wall the card promised to leave open

The storage-shed card says it plainly: *"Covered storage with a wide door bay — or leave the
whole front open."* `spec.ts` documented `openFront` as "posts + header". `normalizeSpec`
honoured it, dropping that wall's openings with the warning "the whole wall is the opening".
`isLegacyBuilding` excluded it from the frozen path. And no generator read the field: a spec with
`openFront` produced a model **byte-identical** to one without — same 288 members, same 18 studs
on the wall that was supposed to be a hole.

That is the fifth instance of the same shape, and the worst of them, because here the model was
not merely missing something — it asserted the opposite of what the card said.

An open front is now posts on the wall line and a beam across them, tight under the plates. The
plates stay: they are what the rafters bear on, and the beam is what carries them now. Bay width
follows `LAYOUT.postSpacingMaxFt` — the same rule the foundation posts use — and each bay's beam
is sized by the header table for its span, so an open front cannot quietly carry a longer span on
the same stick than a doorway would.

**Removing the studs was only half of it.** The first cut left the wall clad: sheathing and siding
tile `walls.surfaces`, so the open bay came back skinned from the outside and the opening was
invisible from every angle that mattered. Both passes now skip the open wall, while the RAKED
INFILL above the plates is deliberately kept — a gable end over an open bay is still closed in.

C-10 was never in the way. `generateWalls` is frozen and still frames four walls; the building
family drops what the open wall does not have and adds what it does, the same composition the
shed and flat roofs already use. The compat goldens cannot move, because `isLegacyBuilding` has
always refused a spec with an open front.

## "Why are there always pieces of wood sticking out of the roofs?"

The owner, about every render in the repo. Two separate things were behind it.

**In the 3D model: no fascia.** The wedges along every eave were the RAFTER TAILS, and they were
not poking through anything — measured square to the roof they sit an inch below the roofing,
exactly where they belong. What was missing is the board that covers them. An eave is finished
with a fascia across the tails; without one, every roof ended in a row of raw square-cut rafter
ends. Now emitted at the deck stage, depth matched to the rafter so it covers what it is nailed
to.

**In the picker thumbnails: the painter's sort.** `portrait.ts` has no depth buffer — it sorts
polygons and paints them back to front, and it sorted each face by the depth of its CENTRE. That
is exact only while faces are small next to the distances between them, and a 7-ft rafter next to
a 4×8 deck sheet is not: both span feet of depth, so their centres can order backwards while
every actual pixel of the sheet is nearer than the stick under it. The stick paints over the
sheet, and the card reads as a heap of loose lumber lying on a roof.

Sorting by each face's NEAREST corner instead fixes most of it at zero cost — the roof comes back
as a roof and the walls as walls. **It does not fix all of it**, and the honest statement is that
a polygon painter cannot: correctness here needs a per-pixel depth test. Subdividing long faces
into strips was tried and made things worse, because the covering sheets get split too and then
sort independently of their neighbours — many small errors instead of a few big ones, at four
times the file size. That measurement is recorded in the code so the next person to have the idea
can see the result rather than re-derive it.

## Next targets, unchecked

- **The portrait painter's residual errors** — the real fix is a depth buffer (rasterise per pixel), or drawing only the outermost skin for a finished building.
- Skid foundation (rendered incidentally with the storage shed, not examined on its own).
- Weather barrier BEHIND THE SIDING — the `buildingPaper` role's own label promises it and nothing emits it.
- Pyramid roof on a building (the tower cab uses it; a building never has been rendered with one).
- Board-and-batten and board siding at the rake (the infill path renders them, unphotographed).
