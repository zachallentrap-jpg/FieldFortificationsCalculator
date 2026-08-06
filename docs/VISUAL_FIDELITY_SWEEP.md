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
| **Rafter-to-plate seat (bird's mouth)** | **Fixed** — the notch is cut, and the roof plane it needed was 1¾ in low on every roof in the catalog. |
| **Shed roof — the high (pony) wall** | **Fixed** — the pony wall had no plate at all: its studs stood free and the rafters ran 1.4 in into their bare ends. |
| **Board-and-batten at the rake** | **Fixed** — every batten stopped dead in a straight line at the cap plate; the gable triangle was bare boards. |
| **Pyramid roof on a building** | **Fixed** — no generator framed it, so a shared link produced a plank of roofing hanging in mid-air over an open building. |
| **Dead stops on the stage scrubber** | **Fixed** — five plans advertised stages nothing would ever build; and the issues panel had never spoken on load at all. |
| **Skid foundation** | **Fixed** — the runners floated 8 in above the ground with the floor buried beneath them, and ran through every joist they crossed. |
| **Members emitted twice in the same place** | **Fixed** — 12 duplicate posts across three families. **Invisible in the render**; 96.5 board feet of phantom stock on the cut list. |
| **Latrine — the riser box** | **Fixed** — the one feature that makes the building a latrine was a solid bench. `seats` sized the dividers and cut no seats. |
| **Crib bunker — the entrance baffle** | **Fixed** — it started at the doorway's CENTRE, leaving two feet of a five-foot opening with a clear straight line in. |
| Guard shack (8×8, four openings) | **Checked, clean.** Nothing wrong. Its unbraced walls are a documented rule, now pinned by a test. |
| Squad hut (50 ft — the longest building) | **Checked, clean.** Nothing wrong. Its fifty-foot runs are already handled, by a module I had not read. |
| Weather barrier / building paper | **Already covered** — an earlier pass fixed it (row above). All that is left is a stale help string; see below. |
| **Hip roof — the four corners** | **Fixed** — every plane stopped over its wall corner while the hip rafters ran on to the true eave corner, so the roof had a square notch at all four corners with a bare hip tail standing in each. |
| **Hip roof — the common rafters' pitch** | **Fixed** — rotated to a rise measured from the plate over a run measured from the eave, so every common sat 1.84 in proud of the roof at the eave and 1.84 in below the ridge. The jacks and hips were right; only the commons dissented. |
| **The ridge cap** | **Fixed** — the cap was laid at DECK level and every course of roofing stacked on top of it, so the 2x8 ridge board showed through the piece whose whole job is to be outermost. |
| **Gable + roof deck "none" + roofing** | **Fixed** — the frozen gable decks itself whatever the spec says, but the roofing's lift was read off the spec, so "no deck" sank every course into the deck that was there and the plywood striped through the roof. |
| **Corrugated banding on a hip** | **Fixed** — the band count was the whole PLANE's taper, so every strip on a hip was cut into the maximum 8 bands: 176 pieces of 26 x 11 in where a gable gave one sheet per strip. |
| **Corrugated sheet layout** | **Fixed** — sheets were laid 8 ft along the eave x 26 in up the slope (on their side) with their joints butted; they now run their length up the slope and side-lap. |
| **Hip + roof deck "none" + roofing** | **Partly fixed.** The hip was UNBACKED and is now dropped — real, measured, pinned. But that was NOT what the specks were; see the correction below. |
| Guard tower — the guardrail gap vs. where the ladder arrives | **Checked, correct.** Nothing wrong. The opening is centred exactly on the ladder; the read that said otherwise is below. |
| Custom card (`custom`) — bare frame, no siding, no roofing | **Checked, clean.** Nothing wrong. Piers on footings, floor frame, framed openings, gable rafters and deck, rake studs stepping up. |
| **Guard tower — the ladder** | **Fixed** — set plumb inside a BATTERED frame, it crossed the leg plane about 9.6 ft up and ran through two brace diagonals with 8.9 in of overlap. |
| Double-coverage roll roofing (`rollDouble`) | **Checked, clean.** Nothing wrong. Five courses where single coverage lays three — the 50% lap — laid along the eave from the eave up, which is how roll goods go on. |
| **Roll roofing below its minimum slope** | **Fixed** — the two minimum-slope figures were cited on every course and checked nowhere, so a 1-in-12 roof under single-coverage roll came out clean. |
| **The hip drop** | **Fixed** — a hip is canted to both slopes it lies under, so a plain stick stood its arrises 0.098 in proud of the roof. Dropped, and the figure is on the cut list. |

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

## The bird's mouth, and what cutting it turned up

Every rafter in the toolkit passed straight THROUGH the cap plate it bears on. Measured on the GP
building's south slope: the cap plate's top is at y = 8.000, and the rafter's underside where it
crosses the wall line was at y = 7.76 — the stick **2.9 in inside a plate 1.5 in thick**, so it
went through and out the far side. Zoom the framing stage and you could watch the rafters cross
the plates as though the plates were not there.

The cause was stated in the design doc, and was a deliberate simplification rather than an
oversight: *"bird's-mouth seat geometry is carried as angles on the member but not notched in
scene geometry."* Every rafter did carry `angles: { plumbCut, seatCut }` — 71.6° and 18.4° on
this roof, correct for a 4:12 — and the member card printed them. The declaration was there; the
shape was not, and a plain stick cannot sit on a plate.

**The notch is derived, not stored.** `birdsMouth.ts` takes a rafter and the plate it crosses and
solves the member's own frame for the two cuts a framing square gives you. It adds nothing to the
model, so the cut list and the bill are untouched; the viewer extrudes the profile in place of the
box prop. Three sign conventions had to be got right, and each one was wrong first:

- **The heel solution.** Solving `run = r0 + k·(lx·cos rz − ly·sin rz)` for the underside gave a
  heel at the plate's CENTRELINE rather than its outer face — one sign, 0.145 ft, one profile
  corner still buried in the plate.
- **The mirrored slope.** A gable's two slopes carry +rz and −rz, so on one of them the heel is
  the low-x end of the notch and on the other it is the high-x end. Measuring the depth at
  whichever end had the lower x read zero on the mirrored slope: **half of every roof came out
  uncut**, 37 of 74 rafters, and the sweep tool reported "37 notched" as though that were fine.
- **A plumb heel is not a square cut.** A plumb line is not a line of constant local x on a
  pitched member. Cutting the heel square across the board leans its face out of the plate and
  eats 1/cos²θ more rafter than the joint needs — 22.4% of the face instead of 20.1% at 4/12.

**And then the notch came out 56% of the rafter, which is not a bird's mouth.** The geometry was
right and what it measured was wrong: the engine placed the rafter's CENTRE LINE on the plate's
outer top corner — a modelling shortcut that sinks the rafter half its own depth into the wall and
calls it seated. A real rafter's elevation is set BY the seat: the seat is one plate wide, the
heel is however deep the pitch makes it over that length, and the height above the plate follows
from those two. For a 2x6 at 4/12 on a 2x4 plate the roof plane was **1¾ in low**, on every roof
in the catalog, framed and decked and roofed and sided at that height.

Raising it is a compat-lock event and is written up in DECISIONS.md. The result, measured across
all nine shipped families: **406 of 406 rafters notched, zero corners left inside a plate, seat
exactly one plate wide, notch 20.1% of the face** — inside the third of the depth a bending member
may lose at its bearing, which is now a test rather than a hope.

**What this cost, and what it says.** The unfixed entry above sat in this log for one iteration
with "do this first" against it, and doing it first was right — but the fix that mattered was two
levels underneath the thing that was reported. The visible defect was rafters intersecting plates.
The actual defect was that no rafter in the toolkit had ever had a height above its plate. The
notch could not be cut correctly without finding that, because a notch is the shape of the gap
between where a rafter is and where it should bear.

## The pony wall that was never a wall

A shed roof's high side is framed as a pony wall — studs above the cap plate making up the height
difference, so `generateWalls` is never asked for an unequal wall. It had **no plate**. Thirty-seven
studs stood free at the top, nothing tying them together, and the rafters ran straight over their
bare ends — **1.4 in INTO them**. The same defect the bird's mouth had just fixed at the low wall,
except here there was no plate for the notch machinery to find, so nothing could detect it: the
sweep reported the shed as fully notched because its ONE notch, at the low wall, was fine.

No shipped family uses a shed roof — every one of the fourteen is a gable — so this only ever
appeared through the Planning UI's roof picker, which offers `shed` on five of them. That is the
lesson worth keeping: **sweeping the catalog is not sweeping the app.** A preset is one point in a
configuration space the picker lets an operator move around in.

Three defects at that one joint, and the second two only became visible once the first was fixed:

**The plate, and the height it goes at.** The pony wall's height was `span · slope`. It is
`(span − plateWidth) · slope`: the seat at the LOW wall lands at its plate's INNER face and the
seat at the HIGH wall at its OUTER face, so the rise between the two plate tops is one plate short
of the full span. The old height stood the wall 7/8 in proud of where the rafters wanted to sit.
Studs are now cut to leave room for the plate, and the plate's top lands exactly on the seat.

**A rafter bears on two plates, and only one was being cut.** `seatCutsFor` kept the DEEPEST
notch per rafter, which is the right answer for a gable (one bearing, then the ridge) and wrong
for a shed (low plate and pony plate, identical notches). It returns every notch now, and
`seatProfile` lays them into the underside in x order, dropping any that would overlap rather
than folding the outline back on itself — a self-intersecting `THREE.Shape` triangulates into
stray garbage rather than failing.

**The minimum-notch guard was a full inch.** A plate-wide seat at 3/12 is 7/8 in deep and at 2/12
is 9/16 in, so the guard meant to reject a rafter merely grazing a plate was throwing away the real
bird's mouth on every shallow roof — every shed, and any gable under 4/12 — which then went back to
running through its plate. The floor is a saw kerf, 1/8 in.

And one found on the way, unrelated to bearing: the shed generator placed each rafter's centre by
subtracting a PERPENDICULAR half-depth and adding back a VERTICAL one. That corrects nothing. It
left every shed rafter **0.085 in below the roof plane the deck is placed off**, so the sheathing
floated a sixteenth of an inch clear of the rafters carrying it.

Checked after the fix across four shed orientations (N/S/E/W high), a flat roof, and a 2/12 gable:
every rafter notched at every plate it bears on, zero corners left inside a plate, no profile that
doubles back.

## Every batten stopped at the plate

Board-and-batten is a PAIR: vertical boards, and a batten over each joint. The wall pass lays
both. The infill pass — everything above the cap plate — laid only the boards. So on a gable end
the wall below the plate was ribbed and the triangle above it was flat, with **every batten in the
building ending on the same horizontal line**. On a 20-ft end that line reads as a seam across the
whole building, and it was there in the shipped storage-shed preset, which is the one family that
ships board-and-batten.

The fix is a batten pass in the infill generator, and the thing worth getting right is that a
batten above the plate is only correct if it CONTINUES the one below it. Three claims, all tested
rather than assumed:

- **Same joint.** The seams are the module boundaries, which is the same grid the wall's boards
  use, so every rake batten lands on the continuation of a board joint below it — 25 of 25 on
  each gable end, to the micron.
- **Same plane.** Standoff is `faceOffset + standoff + boardThickness + battenThickness/2`, so
  the batten's inner face lands exactly on the boards' outer face rather than floating off them
  or sinking into them.
- **No gap at the plate.** The wall batten's top and the rake batten's base are both 8.00000.

Each runs from the plate up to the true rake AT ITS SEAM — between the heights of the two boards
it covers — and seams whose rake height is under a sliver (the last few at each corner, where the
triangle closes) get none, which is what happens on site.

Checked at the same time and NOT a defect: the rake boards themselves already line up with the
wall's boards, because the raked tiler's outer loop steps by the board width and only ever
subdivides WITHIN a module. Plain board siding correctly gets no battens.

## A roof with nothing under it, and four more stages that promised nothing

`pyramid` is the guard tower cab's roof and the tower generator owns it. The BUILDING path frames
gable, hip, shed and flat — and for a pyramid it framed nothing at all, while the covering pass
went ahead and skinned a roof plane that had no rafters under it. What came out was **a single
tilted plank of roofing hanging in the air over a building open to the sky**, with the Ceiling
joists and Rafters & ridge stages both empty and not one word said about any of it.

The picker never offers pyramid for a building, which is why this survived: it is reachable only
through a **shared link**, and `decodeSpec` accepts any JSON carrying a `family` key. That is the
second time in three iterations that the defect lived outside the presets — first the shed roof
through the picker, now a roof kind through a forwarded link.

Normalize downgrades it to a hip and says so. Hip is the honest nearest thing rather than a
refusal: a pyramid IS a hip whose ridge has shrunk to a point, which is what a hip already does on
a square plan, and on a rectangular plan a pyramid is not definable at one pitch at all.

**The guard is the interesting part.** The general invariant is that *the stage plan must not
promise work nothing does*, and asserting it turned up four more violations that nobody had looked
for:

- **`custom` listed Roofing and Siding** while shipping neither. The plan was built from the roof
  and foundation kinds alone, so it could not know the skins were off. It is told now — and both
  are the LAST rows, so dropping them moves no ordinal and the frozen rows 1–6 are untouched.
- **Four huts listed "Screens, doors and fittings"** and only the sea hut and the latrine have any:
  a screen band, and the latrine's riser box. The SWA hut, the B-hut, the squad hut and the guard
  shack each carried a stop that could never contain anything.
- **A skid building's layout row** said "posts and footers set to the building lines" for a
  building that has neither, and showed nothing.
- **The crib bunker's excavation-lines row** is real work with no material.

The last two are not the same defect as the first two, and the difference matters enough to be in
the type. A row may be deliberately memberless — a slab has to cure, a bearing line is cleared and
strung before a skid drops on it — and those now say `noMembers` out loud. What is not allowed is a
row that is empty because no generator was ever written for it. Only the second kind fails the test.

**And the panel had never spoken on load.** Chasing whether the pyramid downgrade actually reached
the operator: it did not. `regenerate()` is what renders normalize's report, and the workbench's
own mount path built the model directly and never called it — so the issues panel only ever
appeared *after* you changed a control. Every warning the engine had was correct, recorded, and
invisible: a forwarded link carrying a roof this engine cannot frame, an opening moved back inside
its wall, a second story dropped. One line, at the point where the build opens.

## The runners that floated, and the floor buried under them

A skid building is meant to lie on the ground and be dragged. `generateSkids` assumed grade was
y = 0 and hung the runner BELOW it — while the caller computed grade as
`joistTop − joistDepth − skidDepth`, more than a foot lower, and the scene drew the ground there.
**Two ideas of where the earth is, inside one function.** What came out:

- the runners **floating 8 in clear** of the ground they are supposed to lie on,
- every joist, rim joist and bridging piece **underground**, with the finished floor at ground level,
- and the two ranges overlapping, so the skids **ran straight through every joist they crossed** —
  **50 interpenetrating pairs** on the storage shed, the worst a rim joist buried 4¾ in into a skid
  over its whole 20-ft length.

The fix is one parameter. Told where grade is, the runner's bottom lands on it and its top lands
exactly on the joist underside — because `gradeY + skidDepth` IS `joistTop − joistDepth` by the
caller's own definition. The interpenetration and the floating go away together, which is the tell
that they were one defect and not two.

**Then the same defect turned up in two more families.** The tent floor and the strongback put
their joists at y = 0 — flat on the earth — with the skids buried underneath carrying nothing at
all. A platform on skids stood its posts on the ground *beside* the runners, so the load went past
them into the soil. Everything above reads a single `deckY`, so lifting each floor by the runner's
depth carried the bents, the eave and the ridge with it.

One more, found in the same call and the same family of mistake as several before it: the outer
runners were inset by the skid's DEPTH where the inset is along Z and wants its THICKNESS. An inch
out, and the rim joist overhung the runner it bears on.

**Two things I found and did not report, because they were my own sweep lying.** The first pass
reported three surviving overlaps on the storage shed and "nothing bears on the platform's skids".
Both were the box-extent helper mishandling members laid flat (rx = −90°) and stood up (rz = ±90°)
— the same frame convention that has bitten this log twice before. The model was right and the
measurement was wrong. The helper in the regression test spells the convention out for that reason.

**And a test was pinning the bug.** `timber2-lieflat` asserted a platform's posts come down below
0.3 ft — true when they stand on the earth beside a buried runner, false when they bear on its
top. It asserts the physical claim now: the post's underside is exactly the bearing surface,
whichever base it is.

## Twelve posts that were never there — and a finding the render could not show

The skid work left behind a general check — solid overlap between members — so this pass ran it
across the whole catalog rather than picking a target by eye. Most of what it reported was
carpentry doing what carpentry does (a let-in brace is LET IN; battered legs and diagonal braces
have huge axis-aligned boxes that overlap when the members do not), but underneath that noise sat
something that cannot be argued with: **members emitted twice at exactly the same coordinates**.

Four in the tower, four in the platform, four in the crib bunker — **every one of them at a
corner**, and all from one cause. A perimeter run places its posts inclusive of both ends, which
is right for a single edge and wrong for a closed loop: each corner gets one post from the side
arriving and another from the side leaving. On the bunker those are 6x6 timbers, 6½ ft each.

**96.5 board feet of stock on the cut list that nobody would ever cut**, 65.5 of it heavy timber.

### It does not show in the picture, and that is the point worth recording

Two identical meshes at identical coordinates look exactly like one. I cropped a doubled corner
post against a single intermediate post at 4× and the outline weight is the same; I went looking
for a selection artefact — the tint applies per member id, so only one of the two would take it —
and could not produce one either. **The render is clean. The bill is not.**

Every finding in this log so far arrived through a screenshot. This one could not have. A crew
orders from the cut list, and the list said four more 6x6 posts than the bunker has holes for.

The fix de-duplicates by POSITION rather than by reasoning about topology: `coveredSpans` can
split a railing edge around a gate or a ladder, so "is this the end of an edge" does not answer
"is a post already standing here". Where two posts land on the same spot, there is one post.

The regression test is deliberately blunt — same role, stock, length, position and rotation means
one member counted twice, with no tolerance and no bounding boxes, so it cannot report a false
positive. That is what lets it run over the whole catalog unattended.

## A latrine with no seats

The latrine had never been rendered in this sweep, and it is the only family with a riser box —
a boxed bench down one side over the pit. Cutting the roof off and looking straight down showed a
**solid, unbroken ten-foot slab**. Four seats specified, four bays framed, five dividers, and not
one hole.

The generator says so itself, in its own opening line:

> The latrine's riser box: a boxed bench down one side over the pit, **with a seat opening per
> seat**.

`seats` sized the divider count and nothing else. This is the same defect as the bird's mouth,
almost word for word — a value the spec carries, consumed for one purpose, and the shape it
describes never cut — and it is worth noticing that both were found the same way: by reading what
the code says it does and then looking at whether it did.

The fix follows the same pattern too. `riserSeats.ts` is pure and adds nothing to the model: the
openings are DERIVED from members the engine already emitted, so the cut list and every golden are
untouched. The bays come from the DIVIDERS rather than from the seat count, so an opening lands
between the boards that are actually there rather than where arithmetic says they should be.

`cutLumberPiece` — written for the bird's mouth — grew hole support to draw them, which is the
first time that machinery has paid for itself twice. `THREE.Shape` wants each hole wound opposite
the outer contour, and it will not tell you when one is not; the winding is computed from the
signed area rather than trusted.

Checked at the same time and NOT defects: the box closes properly (lid on the front board, front
board and dividers to the floor, no gaps), the seat height is 16.8 in, the bays are even, and the
other five huts share the generator and correctly get no box at all.

## A baffle you could see straight past

The crib bunker had never been rendered in this sweep. Most of it holds up — but the entrance
baffle, the one piece of that structure with a single job, was not doing it.

    const baffleZ0 = outerW / 2 - jambT;

`outerW / 2` is the MIDDLE of the doorway, not its edge. The baffle covered the outer half and
left the inner half open: **two feet of a five-foot opening with a clear straight line in from
outside**, on a survivability structure. And the generator has said this since the day it was
written, four lines above the bug:

> A short wall standing off the doorway, **overlapping it far enough that you cannot see or shoot
> straight in**.

That is the third defect in three iterations found by reading what the code says it does and then
checking whether it did — the bird's mouth, the latrine's seats, and now this. The comments in
this repo are unusually good, and that turns out to cut both ways: a comment describing the
intended behaviour is a test nobody ran.

The rule is now stated so it can be tested: cover the doorway **jamb to jamb**, and run past the
far jamb by the standoff distance so the 45° sightline round that end is shut too. The near end
stays open, and that is not a gap — it is the way in. You come down the slot between the baffle
and the wall and turn through the door.

The regression test asserts the sightline rather than the arithmetic, and it measures the standoff
off the POSTS: the lagging hangs on their outer face, half a post further out, and measuring there
would demand the baffle be longer than its own rule asks for. (It caught me doing exactly that on
the first run.)

**Checked at the same time and NOT defects.** The soil ghost — which I first misread in an iso
view as a slab floating off to one side — is exactly right: 2 ft thick, the full footprint, its
underside on the roof deck, translucent and unlit so it can never be mistaken for something built.
The cribwork walls, the cap beams, the overhead stringers and the deck all close properly.

## The guard shack, which was fine

Twenty iterations in, the first one that found nothing to fix.

The guard shack is 8 ft square with an opening in every wall — a door and three windows — which
is the shape that stresses opening placement hardest, and it holds up. One door on the south (no
sill, no cripples below), three windows with sills and cripples, doubled 2x6 headers whose tops
land exactly on the top plate's underside at y = 7.250, and 2.4 ft of clear wall at each end of
every opening. The skids lie on the ground where iteration 17 put them, the fascia is on both
eaves, the framing around every opening is complete.

**Two things I chased and had to put down.**

The gable-end siding looked, at 4× magnification, like it was standing proud of the rake. It is —
by up to 1.6 in, and that is the design: `tileRakedInfill` cuts each strip to the MIDDLE of the
range it spans, "half a step proud at one edge, half shy at the other, which is what a ripped
piece against a sloped line looks like". My sweep compared each strip against the LOWEST rake
across its own width and duly reported every strip in six families as a defect. It was measuring
the documented behaviour and calling it a bug.

Then: **the guard shack has no let-in bracing at all**, where every other shipped building has
eight. That looks alarming until you measure it. The rule in the frozen wall generator places a
brace in the clear wall at each corner, steepens it from 45° up to about 62° as the openings
crowd it, and drops it below a 3 ft run. An 8 ft wall with a 3 ft opening centred leaves 2.0 ft
at each corner, and a brace over a 2 ft run against a 7.1 ft rise stands at **74°** — that is a
stud, not a brace. The wall is braced by its plywood siding instead.

So: not a defect I can substantiate, and I am not going to invent a fix for it. What I did instead
is make the rule VISIBLE — a test that pins the brace count for every shipped family and the angle
range for every brace placed. The guard shack's zero is now a fact somebody chose rather than one
nobody noticed, and a family that has bracing today cannot lose it to an opening someone moves.

## The squad hut, and a fix I had to throw away

Second empty iteration in a row, and this one is worth writing up for the mistake rather than the
result.

The squad hut is 50 ft long — the biggest thing in the catalog — and it renders correctly. Then I
listed the longest single members in every family and found this:

    squad-hut   sill 2x6 @50ft · girder 2x10 x3 @50ft · solePlate 2x4 @50ft ·
                topPlate 2x4 @50ft · capPlate 2x4 @49.4ft · ridge 2x8 @50ft · fascia 1x6 @50ft

The cut list duly said **"3 × 2x10 @ 50'-0""**. No yard on earth stocks a fifty-foot 2x10, and
every shipped building over 20 ft had lines like it. It looked like the biggest bill defect in the
repo, and the render agreed: 50 ft of unbroken plate with no joint anywhere, where a real wall is
three or four pieces with staggered joints.

So I added a `maxStockLengthFt` to doctrine, taught `cutList` to report ⌈length / stock⌉ pieces
per member, surfaced it in the workbench table, and wrote the tests. All of it worked.

**All of it was wrong.** `purchase.ts` — which I had not read — already does this, and does it
better. It carries real stock lengths `[8, 10, 12, 14, 16]`, packs every cut onto them, and
separates the over-length runs into their own list with their lineal feet AND their roles. Ten
long runs on the squad hut, zero on the guard shack. Its comment says exactly why it stops short
of what I had just built:

> Packing it into bins would print "buy four 16-ft sticks", which happens to be **right for a
> plate and badly wrong for a girder**, and the tool cannot tell which without a splice rule it
> does not have.

A built-up girder is three plies with staggered joints and every splice has to land over a post.
⌈50/16⌉ = 4 is a number, and printing it would have been a confident lie in exactly the case where
being wrong costs the most. Two tests already pin the behaviour — *"a run longer than any stock is
surfaced, never silently spliced"* and *"a long run names its roles, so a plate can be told from a
girder"*.

Reverted, all of it. **The lesson for this log: check whether the thing is already solved
somewhere you have not looked, BEFORE building the fix — not after.** Nineteen iterations of
finding real defects makes the twentieth candidate look real too. What made this one different was
not that the evidence was weaker; it was that the evidence was about a surface I had never opened.

## Next targets, unchecked

- **The portrait painter's residual errors** — the real fix is a depth buffer (rasterise per pixel), or drawing only the outermost skin for a finished building.
- Weather barrier BEHIND THE SIDING — the `buildingPaper` role's own label promises it and nothing emits it.

## The hip roof with a notch at every corner

A hip has no rake. All four of its sides are eaves, and each one overhangs past its neighbours'
overhang as well as its own — so on an L × W plan with a 1-ft overhang, the roof's outline in plan
is (L + 2) × (W + 2), and every plane's eave is two overhangs longer than the wall beneath it.

`roofPlanes` gave each hip plane the bare WALL length: `eaveLengthFt: L` for the long slopes and
`W` for the triangular ends, with the long slopes starting at x = 0. Meanwhile `generateHip` runs
its four hip rafters from `(-oh, -oh)` and the other three true eave corners up to the ridge ends.
Frame and skin disagreed about where the roof's corner was, and the frame was right.

What that looked like from above: a square notch of missing roof at each of the four corners, one
overhang on a side, with the bare hip rafter tail standing in the middle of it — plus a stepped
jog in the roof outline where the two short planes failed to meet. The fascia was short by the
same amount on all four sides, because it takes its cut length straight from `eaveLengthFt`.

The taper is the check that the fix is geometry and not a fudge. With the eave at `L + 2*oh` and
the ridge at `L - W`, each end of a long slope draws in by `(W + 2*oh)/2` over the climb — exactly
the `W/2 + oh` of horizontal run a 45-degree hip covers, so the plane's edge *is* the hip line
rather than something parallel to it. Both hip ends' apexes now land on the same two ridge-end
points the long slopes reach, and the test asserts that as well as the corners.

**Two existing tests had been pinning the bug.** Both asserted that an equal-pitch hip and gable on
one building have the same roof area. That is true only if the two cover the same plan, and they do
not: a gable is flush at its two rakes, a hip overhangs there too. The equality held only because
the hip's planes were short by precisely those two rake overhangs. Both now assert the real
identity — a roof's surface is *its own* plan footprint times the framing-square length per foot of
run — which is a stronger statement and one the old geometry fails.

Recovered on a 48 × 20 hip: 12 deck pieces and 26 roofing pieces that were never emitted.

## The hip's common rafters were the wrong pitch

The tan bars recorded as open in the previous pass — short marks lying on both long slopes of a
finished hip, seen from overhead — were the **common rafters**, standing proud of the roof and
showing through the roofing. The app's own raycaster named one: from a camera directly above a
roof with deck and corrugated on it, a `rafter` was still the nearest thing under the cursor.

`generateHip` rotated its commons to `atan2(halfSpan * slope, halfSpan + oh)`. That measures the
RISE from the wall plate and the RUN from the eave, and the numerator forgets that the eave is
`oh` further out and therefore `oh * slope` further down. On a 12-ft-wide 4-in-12 hip it gives
15.945 degrees where the roof is 18.435 — a rise/run of 0.2857 on a 0.3333 roof.

Length and midpoint were always right, so a too-flat rafter pivots about its middle and misses at
both ends: measured off the model, the eave end sat **1.84 in above** where the jacks and hips land
on the same eave line, and the ridge end **1.84 in below** the ridge board it is nailed to, with
0.57 in of horizontal overshoot at each end. Above the plane at the eave is what showed through the
roofing; below the ridge is a gap nobody would see.

Two things make this a clean catch rather than a judgement call. The **jacks and the hips were
always right** — jacks use `Math.atan(slope)` and hips correctly use the diagonal — so three member
families framing one plane disagreed, and only the commons dissented. And the rafter's own
`angles` block, two lines below the rotation, was already derived from `atan(slope)`: the model and
the cut list described two different pieces. Both are now asserted.

## The cap that was under the roof it capped

The tan line along the ridge, recorded as open in the previous pass. The raycaster named it: five
clicks along the line, and the middle one landed on `HP-ridge-01` — the 2x8 ridge board — on a roof
with deck, felt and corrugated all on it. Measured on a 16 × 12 4-in-12 hip: the cap's top sat
**0.13 in below** the ridge board's top, so the board pushed through it.

`generateRidgeCaps` was given `rafterHalfFt + deckThick + paperThick + surfaceLift` — the **deck's**
offset. The roofing courses that go on after it are placed at that same base plus `c * thickness`
each, so all four courses were laid on top of the one piece whose entire job is to be the outermost
thing at the joint. The cap now gets the roofing's outer surface: the same base plus `courses`
layers, then half its own thickness.

**A second bug, and the invariant that caught it.** Every other covering offset in this file is
measured PERPENDICULAR to the roof and applied through `roofTilePlacement`; the cap's was added
straight to Y, which clears the roof by only `lift * cos(pitch)`. The obvious correction is to
divide by `cos` — that lands on the apex where the two roofing planes would meet if extended. It is
wrong, and `timber2-plausible` said so immediately: *"CP-ridgeCap-01 (ridgeCap, roll roofing):
touches nothing at all."* The sheets never reach that apex (below), so a cap placed there floats
3.8 in above the material it is nailed to at 12-in-12. Multiplying by `cos` puts it on the sheets,
which is where a cap actually goes. The plausibility check is worth more than it looks: it caught a
change that was geometrically reasoned, self-consistent, and still floating.

Nine solid thumbnail goldens moved with it — every family whose roof has a ridge or a hip.

## The deck that was there, and the deck the spec asked for

Two different questions, and one line of code answered the wrong one.

A frozen gable emits its own stage-9 deck **whatever the covering spec says** — that is C-9, not an
option. The caller knows it and says so: *"`deckLaidElsewhere` tells it the gable's stage-9 deck
already exists so its thickness still lifts the roofing off the rafters."* But `deckThick`, the
lift that holds the roofing off the rafters, was derived from the spec's `roofDeck` and never read
that flag. So on a gable — the default roof kind, and the only one that decks itself — choosing
**"no roof deck"** dropped half an inch of lift and sank every course of roofing into the plywood
underneath it. On screen the deck won the depth test over the bottom third of the slope: a smooth
tan panel where ribbed corrugated should be, and the selected course highlighting as a smooth plank
instead of a ribbed sheet.

Reachable straight from the config panel — gp-frame, roof deck "none", roofing "corrugated" — and
true of roll roofing the same way. The control render (the same building with roof deck "plywood")
is the proof: identical geometry, correct roof. After the fix the two are pixel-identical, which is
what they should always have been, because the deck is there either way.

Another instance of **"a comment describing intended behaviour is a test nobody ran"**, and this one
had a witness: the felt block six lines below already wrote `deckThick > 0 || deckLaidElsewhere`.
The author knew the flag mattered in one place and missed it in the other.

The fix is a `Math.max`, so it can only ever ADD lift — every case that was already right is
untouched, and no golden moved.

## The hip that was never backed

A hip with **roof deck "none"** and corrugated roofing — both offered on the gp-frame card — comes
out sprinkled with tiny tan specks along the hip creases, seen from overhead. The same building with
roof deck "plywood", same build and same camera, is clean grey. So the difference is real and it is
the deck.

It is NOT a hole in the roofing, and it is not the roofing sitting too low. Measured perpendicular
to the roof plane, on a 16 × 12 4-in-12 hip:

| | above the roof plane |
|---|---|
| common rafter / jack, highest corner | 2.750 in — flush, the piece is centred on the plane |
| **hip rafter, highest corner** | **2.848 in** |
| roofing underside, plywood deck | 3.370 in — clears the hip by 0.522 in |
| roofing underside, **no deck** | 2.870 in — clears the hip by **0.022 in** |

A hip rafter is modelled as a plain rectangular stick lying under the fold between two slopes, so
its top ARRISES stand 0.098 in proud of both of them. Real framing deals with this by BACKING the
hip — beveling its top edge to the two planes — or by DROPPING it, setting it that much lower so the
sheathing lies flat across it. Neither is modelled. With a deck the half inch of plywood buries the
error; without one the roofing clears it by a forty-fifth of an inch, which is coplanar as far as a
depth buffer is concerned, and the arrises z-fight through as specks.

### The drop, done deliberately — and a correction

`hipDropFt(d, w, slope)` states the vertical fall that lands the arrises on the planes:

    (√2/2)·( (d/2)·√(2+t²) + (w/2)·t )  −  (d/2)·√(1+t²)

The first term is where the arris actually sits, perpendicular to a plane — depth plus the
half-thickness the cant swings up — and the second is the `d/2` a common reaches. Both planes give
the same answer, which is what lets ONE drop serve a hip carrying two slopes. At 4-in-12 with a 2x6
it is 0.103 in. `generateHip` applies it and the cut list now says *"DROP the hip 0.103 in (or back
it) so the sheathing lies flat"*, because a framer has to be told which job to do.

Measured after: the hip's highest arris reaches **2.7500 in** above the plane at 2, 4, 6 and
12-in-12 — exactly what a common rafter reaches. Disable the drop and the test fails with
`the hip's arris reaches 2.8185 in where a common reaches 2.7500`. The test that used to anchor the
eave line on a HIP now anchors it on a COMMON, deliberately: a common is square to the plane and
defines it, and anchoring on the hip would have hidden the drop inside the datum.

**The correction.** The previous pass blamed the specks on this. That was wrong. With the drop
applied and every arris flush, the specks are still there — and a raycast into one lands on a
CEILING JOIST, two feet below the roof, through a fully finished roofing surface. They are not
framing standing proud; they are **pinholes through the roofing**, and what the plywood deck was
doing in the control was not burying an arris but plugging the hole behind it. The unbacked hip was
real, measured and worth fixing on its own merits; it simply was not the thing in the picture.

## What is still open

- **The steps at a raked edge still butt.** Where a strip genuinely must follow a rake it is
  approximated by a staircase, and consecutive steps share an edge exactly — the same butted-joint
  pinhole, now confined to the hips instead of covering the roof. A gable has none at all. Steps
  are subdivisions of ONE sheet rather than separate sheets, so the fix is not a lap: either stop
  splitting a piece into abutting rectangles, or break the coplanarity the way the side lap now
  does. What is left is a handful of specks along the hip lines, against dozens over the whole
  roof before.
- **`roofDeck: 'skip'` is a dead option.** Skip sheathing — spaced boards under corrugated — is in
  both the spec type and the covering module's input type, and nothing produces or consumes it: no
  card offers it, and no branch builds it. A shared link can still set it (`decodeSpec` validates
  only that `family` is present, the same door the pyramid roof came in by). With the deck fix
  above it now renders correctly on a gable, because the frozen deck is counted; on a hip or shed it
  would still produce a roof with no deck at all. Implementing it properly needs a board spacing
  from doctrine, which is not page-checked — so it wants either that figure or a normalize
  downgrade with a warning, the way pyramid → hip was handled.
- **The roofing stops short of the ridge.** Found while measuring the cap, not fixed here. Each
  course is offset perpendicular from its plane and still cut at `slopeLengthFt`, so its top edge
  pulls back from the ridge by `lift * sin(pitch)` and lands `lift * cos(pitch)` up instead of
  `lift / cos(pitch)`. The two slopes' sheets therefore never meet at the peak — there is a notch
  `2 * lift * sin(pitch)` wide, and the cap is what hides it. Invisible at shallow pitch; at
  12-in-12 the sheets reach only 3.09 in above the rafter plane while the 2x8 ridge board's top is
  at 3.63 in, so **the ridge board out-reaches the roofing itself** and no cap height can both rest
  on the sheets and cover the board. That is why the cap test asserts 2, 4 and 6-in-12 and says in
  its own comment why 12 is absent.

  **Attempted, and put back.** Extending each plane's top course by `lift * tan(pitch)` does close
  the ridge — the extended tile's top edge lands exactly on the apex, and the cap then belongs at
  `lift / cos(pitch)` after all. But it only closes the RIDGE. The same pull-back happens along
  every hip line, and those tiles are clipped by `planeSpanAt` in plane coordinates, so extending
  the ridge alone leaves the ridge cap at `lift / cos` and the hip caps at `lift * cos` — a factor
  of two apart at 12-in-12, and they meet at the ridge ends. Trading a seam at the peak for a step
  where three caps converge is not an improvement. The real fix is to build the covering stack as a
  proper OFFSET SURFACE — move each plane out along its normal and re-derive where the offset planes
  intersect, instead of offsetting each tile individually and letting the folds fall open. That is a
  refactor of the whole covering path and moves every covering member in the model, so it wants its
  own pass rather than a patch. The notch is under a 12-in cap at every pitch in the meantime.
- **`buildingPaper` the ROLE.** The felt under the roofing was fixed in an earlier pass and is
  emitted under the `felt` role. `buildingPaper` remains in the role union, the thumbnail paint
  order, the handout list and `portrait.ts`, and nothing emits it. Its help string reads "Weather
  barrier behind the siding" — a wall product — while the only control that sets the flag is
  labelled "Felt under the roofing" and gated on the roof deck. Nothing is missing from the model;
  the text is just describing a product this toolkit does not place. Text, not geometry.
- **The portrait painter's residual errors** — needs a per-pixel depth test, or drawing only the
  outermost skin for a finished building.

## Corrugated, laid the way it is laid

Roll goods and corrugated sheet are laid at right angles to each other, and this laid both as roll.
A 36-in roll unrolls ALONG the eave and you work up the slope in courses. A 26 x 96 in corrugated
sheet does not: its corrugations run along its 8-ft LENGTH and that length runs UP the slope, so
the water runs down the channels instead of across them.

Measured before, on a 48 x 20 gable: every full piece **8.000 ft along the eave x 26.00 in up the
slope**, consecutive pieces at an edge-to-edge offset of **exactly 0**. Three faults in one:

- `corrugatedSideLapIn` — the lap between neighbouring sheets ACROSS the slope — was spent between
  courses UP it, where an end lap belongs. There was no end-lap figure at all; there is now, at
  the roll figure and marked (PH) until the corrugated table is page-checked.
- A 7.4-ft slope got four horizontal courses where one sheet reaches eave to ridge.
- A butted joint is a hole. A ray at the shared edge passes between the two pieces, which is why a
  raycast into one of the specks came back holding a ceiling joist.

The loop already had the right shape — pieces along u, stepping up in v — so what changed is which
figure feeds which axis. **Roll takes exactly the numbers it had and comes out byte-for-byte.**
After: every piece 2.167 ft across x 8.000 ft up, every neighbour lapped **-3.25 in** exactly, the
eave covered 0.000 to 48.000 with no gap.

**The side lap needed the same treatment the courses already had, on the other axis.** Two coplanar
plates overlapping by 3.25 in z-fight down the whole joint. Stacking monotonically is not available
across a 50-ft eave — 27 strips of a quarter inch is a roof ramping seven inches end to end — so
the strips ALTERNATE, every other sheet over its two neighbours. Bounded at one thickness, reads as
the lap standing proud, and a real way to lay corrugated even if shingling them all one way is
commoner.

The check that it worked is a deckless gable, where nothing is behind the roofing to plug a hole:
**no specks at all**, where before there were dozens.

## Banding a strip by the whole roof's taper

Laying corrugated up the slope turned up a second fault immediately behind the first. A course is
cut into BANDS up the slope so a rectangle can stand in for a tapering one, and the band count was
`ceil(plane taper / hip cap width)` — how much the WHOLE PLANE narrows over the run.

That is right for a roll course, which spans the entire eave and really must step down the rake. It
is nonsense for a 26-in strip. Measured on a 16 × 12 hip: the plane narrows 14 ft over its slope, so
every strip took the capped maximum of 8 bands and the roof came out as **176 pieces of 26 × 11 in**
— including the strips sitting squarely in the middle of a slope with nothing to clip them. The
gable, whose taper is zero, gave **one 7.4-ft sheet per strip**: the right answer, and the tell.

What decides whether one rectangle can stand in for a strip is how much THAT STRIP's own clipped
width changes over the run — zero for a strip lying wholly inside the plane, whatever the rest of
the roof is doing. With that, a hip lays whole sheets down the middle of each slope and steps only
along its rakes. Eight butted seams up every strip was also eight more places for a ray to pass
between two coplanar rectangles, which is what the specks scattered across a hip were.

**And the plausibility check caught what the change broke.** Near the apex of a triangular face a
strip clips to almost nothing, and the tower's cab came out with quarter-inch "sheets". Two floors,
both derived rather than picked: from the second strip on, the SIDE LAP (both strips clip to the
same edge and the previous one starts a lap further back, so anything narrower is already inside
it); for the first strip, ONE CORRUGATION — the side lap over the corrugations it spans, 3¼ in
across 1½, which doctrine already carries. You cannot cut and fasten a piece of corrugated narrower
than a single rib.

## A rule printed on every course and enforced nowhere

`rollDouble` was the target and `rollDouble` is fine: on a 16 × 12 gable it lays five courses where
single coverage lays three — the 50 per cent lap, exactly — along the eave and from the eave up,
which is how roll goods go on. Checked, clean.

What it turned up is next to it. `rollMinSlopePer12` (2 in 12) and `rollDoubleMinSlopePer12`
(1 in 12) sat in doctrine used for **nothing but the `doctrineRef` string stamped on each piece**.
Measured: a 1-in-12 gable under single-coverage roll produced **zero issues**, while every course of
it carried the citation *"FM 5-426 exposed-nail roll roofing minimum slope"* — a roof at half the
slope that rule requires, quoting the rule.

Reachable straight from the panel: every card offers `flat`, every card offers `roll`, and flat
floors at 1 in 12. Normalize's own comment says why it floors there — *"because that is the minimum
slope double-coverage roll roofing is rated for"* — which is only true if the roofing IS double
coverage. The rule was written down in the code that needed it and never asked.

Now warned, at the spec level, naming both figures and the remedy. **WARN, never substitute**: this
module clamps numbers, it does not choose materials, and handing back a covering nobody selected
would put a different roof on the drawing than the one the operator asked for. Confirmed in the
live app, not just in a test — the message reaches the issues panel on a flat roof with plain roll.

Corrugated carries no minimum slope in doctrine, so nothing is invented for it: no figure, no check.

## A plumb ladder on a battered tower

The tower's deck, stair and cab roof were all checked long ago. Its LADDER was not — and the
ladder is what the shipped preset actually uses.

`generateLadder` was right in itself: rails 19 ft for a 16-ft climb (the 36-in extension EM 385-1-1
asks for), sixteen rungs at 12 in, top rung on the landing. What was wrong is where the tower put
it. `tower.ts` set the foot at `deckHalf + ladderClearanceFt` — the doctrine clearance, measured
off the DECK EDGE. Right arithmetic, wrong datum: the legs are battered 1.5 ft per side, so the
frame sweeps from **z = 0.0 at the ground to z = 1.5 at the deck**, and the deck edge is its
narrowest point. A plumb ladder at z = 0.90 sits between those figures and must cross the leg
plane — at 0.9/1.5 × 16 ≈ **9.6 ft up**, which is exactly where it ran through the brace diagonals,
overlapping them by **8.9 in**.

Standing it outside the widest point instead clears the frame and leaves the climber reaching
2.1 ft across open air at the top, which is not an improvement. **Raking it at the frame's own
batter is what a ladder bolted to a battered face does**, and it holds the clearance constant:
0.6 ft at the foot, 0.6 ft at the deck, 0.6 ft at every rung between — measured, and asserted as
constant rather than merely sufficient.

Two traps worth recording. The first render looked damning and proved nothing: a front elevation is
orthographic, so a ladder 0.9 ft in front of a brace crosses it on screen whether or not it touches.
The second was mine — after raking the ladder I re-ran a BOUNDING-BOX clearance check and it
reported the overlap had got worse, because a box round a leaning member spans its whole lean.
A raked member has to be sampled at matching heights, and the rungs, sitting on the centreline, are
the sample points. Same mistake as the sweep made in its very first pass, caught quicker.

The rake also has to be paid for in the rail: 36 in above the landing is a HEIGHT, so a raked rail
is longer than a plumb one by its own hypotenuse — 19.083 ft, not 19. The wall ladder the two-story
building uses takes `leanPerFt` 0 by default and comes out exactly as before.

## Two clean checks, and a finding that wasn't

Nothing was wrong this pass. Both targets are recorded above; what is worth writing down is how
close the first came to being reported as a defect on the strength of a code read alone.

**The tower's guardrail gap.** Having just moved the ladder, the obvious next question was whether
the rail still opens where the ladder arrives. `tower.ts` computes it as

    accessEdgeGap = [cabPlanFt/2 - accessWidth/2, cabPlanFt/2 + accessWidth/2]

centred on `cabPlanFt/2` = 4.0 — while the deck's centre, and the ladder, are at `cx` = 5.5. A
1.5-ft offset, exactly the batter, on a life-safety rail: it reads like the same `cx`-vs-half
mix-up that has turned up elsewhere in this sweep, and the sentence describing it was half written.

Measured, the front rail's gap runs **x 4.25 .. 6.75, centred at 5.50, 2.50 ft wide** — precisely
the ladder's arrival and precisely the access width. `accessEdgeGap` is expressed in the rail RUN's
own 0-based coordinates, not world X, and the railing subsystem adds the deck origin. `cabPlanFt/2`
is the midpoint of an 8-ft run, and it is right.

The rule that saved it is the one this log keeps relearning: a plausible reading of the code is not
a finding. Measure the model.

**The custom card.** Never rendered before, and it is the card a user lands on to start from
scratch — `NO_COVERINGS`, so nothing is hidden behind siding or roofing and every member is on
show. Piers on footings, floor frame and subfloor, stud walls with header, trimmers and sill at
both openings, gable rafters, plywood deck, and the gable-end studs stepping up under the rake.
Clean.
