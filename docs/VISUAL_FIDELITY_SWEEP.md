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
| **Crib bunker — the earth cover** | **Fixed** — `actual.w`/`actual.d` were swapped against the shared convention, and the 3D viewer carried a private swap to undo it, so the picker card drew the cover 10.92 ft tall on edge instead of a 2-ft blanket. |
| **Building with `roof.kind: 'none'`** | **Engine clean, panel fixed** — the model builds no roof and advertises no roof stages, but the panel went on offering Roof deck, Roofing and the felt toggle for a roof that does not exist. |
| Custom card (`custom`) — bare frame, no siding, no roofing | **Checked, clean.** Nothing wrong. Piers on footings, floor frame, framed openings, gable rafters and deck, rake studs stepping up. |
| **Guard tower — the ladder** | **Fixed** — set plumb inside a BATTERED frame, it crossed the leg plane about 9.6 ft up and ran through two brace diagonals with 8.9 in of overlap. |
| Double-coverage roll roofing (`rollDouble`) | **Checked, clean.** Nothing wrong. Five courses where single coverage lays three — the 50% lap — laid along the eave from the eave up, which is how roll goods go on. |
| **Roll roofing below its minimum slope** | **Fixed** — the two minimum-slope figures were cited on every course and checked nowhere, so a 1-in-12 roof under single-coverage roll came out clean. |
| **The hip drop** | **Fixed** — a hip is canted to both slopes it lies under, so a plain stick stood its arrises 0.098 in proud of the roof. Dropped, and the figure is on the cut list. |
| **Guard tower — the cab's cladding** | **Fixed** — every panel was centred on the corner posts' own centreline, so it ran 1¾ in into the post at each end and its outer face sat 1½ in inside the frame. All four posts stood proud of the wall they were meant to be behind. |
| **The corrugation pitch on a cut roof** | **Fixed** — the rib scale was rounded to whole texture tiles and floored at one, so every piece narrower than 39 in got twelve corrugations squeezed into it. 48 of 108 pieces on a pyramid, 98 of 304 on a hip, 4 of 104 on a gable. |
| Guard tower cab pyramid — wood showing through the roofing | **Checked, nothing wrong.** The warm band along one hip was my own harness's HOVER tint. See the note below. |
| **The roof a share link hands in** | **Fixed** — three ways a pasted link broke the workbench: a shed with no `highSide` and a spec with no `roof` both THREW, leaving "Laying out the frame…" spinning forever with no canvas; an unknown roof kind framed a building with no roof and said nothing. |
| **Every other section a share link hands in** | **Fixed** — deleting each top-level key of the shipped preset in turn: SIX of the eight threw. `family`, `dims`, `spacing`, `coverings`, `stories` and `foundation` all produced the same dead spinner. An unknown foundation kind silently poured piers. |
| **What fills a rough opening** | **Fixed** — every door and window on all fourteen cards was a HOLE you could see the cripples through. `OpeningSpec.fill` was written by every preset and read by nothing; the roles existed; the plan named the module by filename and it did not exist. |
| **Getting to the door** | **Fixed** — every door on a piered card opened onto a 2 ft 3½ in drop to clear air. `BuildingSpec.entrySteps` was set to `true` by every hut and read by nothing, one field along from `fill`, in the same file. |
| **The ends of a stair stringer** | **Fixed** — every flight in the toolkit ended in two sharp wedges: the foot stabbing 4 in below the ground it stands on, the head the same distance above the landing, and half the board standing proud of the treads it carries. |
| **The loading ramp's toe** | **Fixed** — the ramp's walking surface started AT grade, so everything holding it up was underground: the toe plank entirely, and the stringers 12.34 in deep for the last six feet of a twenty-four-foot run. |
| **Crib bunker — the doorway itself** | **Fixed** — jambs, header and baffle all framed an opening that was then LAGGED SHUT: eleven full-width courses across it and two wall posts standing in the clear span. Every point sampled inside it came back solid. |
| **Crib bunker — `wallType: 'crib'`** | **Fixed** — the crib topped out 5½ in below the cap beam, so the cap, the overhead stringers, the roof lagging and two feet of earth bore on air all the way round; and the stack ran straight through the doorway as well. |

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

## Four walls and no roof

`roof.kind: 'none'` is a real option on the custom card, and the ENGINE handles it properly —
which is worth saying first, because the whole point of checking edge cases is that most of them
turn out fine. A roofless building comes out with zero roof members and a stage plan of seven
stages ending at the siding, every one of them populated: no rafters, no deck, no roofing, and no
dead stop on the scrubber advertising a stage nothing will fill.

The PANEL did not keep up. With the roof set to None it still offered **Roof deck**, **Roofing**
and **Felt under the roofing** — three controls for a roof that does not exist. Pick corrugated
there and nothing appears, nothing is said, and the spec quietly carries `roofDeck: 'plywood'` on a
building with nothing to nail it to. The felt row already had an `applies` predicate, checking the
roof DECK; it just never asked whether there was a roof.

Now gated, in the live panel: with a gable all six covering rows are offered; with None, the three
roof rows go and **wall sheathing and siding stay**, because a roofless building still has walls.
The roof picker stays too, so the choice is reversible.

Two things the tests had to be told, both mine to get wrong. `configSchemaFor` takes a family ID and
returns `{ family, groups }`, not an array. And a role pattern loose enough to catch `ridgeCap` also
catches `capPlate` — which is the plate on top of a WALL and belongs on a roofless building, so the
roof roles are named explicitly rather than matched.

## Two swaps that cancelled each other, and one renderer that never knew

Every member in the toolkit means the same thing by its section: `actual.d` is the face width —
local Y, and at rotation [0,0,0] the VERTICAL one — and `actual.w` is the thickness on local Z.

The crib bunker's `soilGhost` had the two the wrong way round, setting `w` to the cover depth and
`d` to the bunker's width. And `studio.ts` carried a private swap of its own for exactly that role,
building its box as `(len, w, d)` where every other role in the same function uses `(len, d, w)`.
The two cancelled, the 3D view was right, and **every other consumer of `actual` was wrong**.

`thumbnails.ts` reads the convention straight, and it has no special case. So the picker card —
the first thing anyone sees of this family — drew the earth cover **10.92 ft tall and 2 ft deep**
instead of 2 ft tall and 10.92 deep: a dark monolith standing on edge on the bunker's roof,
spanning y 3.37 to 14.29 when the structure itself tops out at 7.83. It engulfed the building it
was supposed to be lying on.

Fixed in the EMITTER, not by teaching the thumbnail painter about the exception — one convention,
every consumer. The viewer's private swap comes out with it, and because both go at once the 3D
geometry is byte-identical: `(len, w, d)` on the old numbers and `(len, d, w)` on the new are the
same box. Only the bunker's solid card moves.

The lesson is the shape of the bug rather than its size. A wrong value and a compensating wrong
reader look **completely correct** from the one place anyone was looking, and stay wrong everywhere
else. The tell was that `studio.ts` needed a special case at all: a role that has to be handled
differently from every other role is usually a role whose data is wrong. The test asserts through
the shared convention rather than against either renderer, because the bug was precisely that two
renderers disagreed about what the numbers meant.

## The one wall that skipped the covering path

Every wall in this toolkit gets its skin from `generateWallCovering`, and `wallTilePlacement`
decides where a panel goes: `s.faceOffsetFt + standoffFt + thickFt / 2`. Read it as a sentence and
it says the panel's INNER face lands on the wall's outer face, and the framing ends up behind it.
That is not a detail — it is the definition of cladding.

The guard tower's cab is the exception. It is hand-rolled in `tower.ts`, and it started from
nothing. Its four panels were placed on the corner LINE:

```ts
position: [(p[0] + q[0]) / 2, cabBaseY + halfW / 2, (p[1] + q[1]) / 2],
cutLengthFt: run,
```

`p` and `q` are the cab corners — which are also where the four 4x4 corner posts are centred. So
the wall was laid down the middle of its own frame. Measured on the shipped preset:

- Each panel ran **1¾ in into each of the two posts it spans between** — 3½ ft × ½ in × 1¾ in of
  one solid inside another, eight times, once per (panel, post) pair.
- Each panel's outer face sat **1½ in inside the posts' outer faces**, so all four posts stood
  proud of the wall on every elevation, with a reveal line down both sides of each.
- Adjacent panels **overlapped each other ¼ in × ¼ in** in the corner, both of them buried in the
  post anyway.

The screen band above the half-wall had all of it too, on the same centreline.

**Rendered it first.** From far enough away the cab reads as "recessed panels between exposed
posts", which is a real way to build something and is why this survived every previous look at
this family — the stray panel under the cab, the stair, the cab roof, the guardrail gap and the
ladder were all found on this same structure. Cropped hard on one corner it is unmistakable: the
post is a bar standing in front of two panels that vanish into it.

The fix pushes the skin out by the post's half-thickness plus half its own, which is
`wallTilePlacement`'s expression with `faceOffsetFt` supplied by the frame instead of by a wall
surface. That leaves the corner to close, and four panels each spanning corner to corner would meet
in an L with the post's arris showing between them. So the two z-walls run the full outer width and
the two x-walls butt into them — the ordinary sheathing lap, and the reason `cutLengthFt` is no
longer simply the corner-to-corner run. The screen gets the same treatment at its own thickness:
both bands are fastened to the same plane, and the thinner one simply projects less.

The tests measure against the posts **as the model emits them**, not against 3½ in, and they check
both directions. No overlap is half the claim; a skin held off its frame would also have no overlap
and would look nearly the same from outside, so a second test asserts each panel's inner face lands
exactly on the post plane. Four fail on the old generator, naming the numbers above.

Worth recording as a class: **a surface that does not go through the shared path will not have the
shared path's fixes.** Two earlier passes in this file corrected placement bugs in
`wallTilePlacement` — the two-layer standoff and the infill profiles — and neither reached the cab,
because the cab never asked. The cab roof is the counter-example in the same file: its framing is
hand-rolled but its sheathing and roofing go through `generateRoofCovering`, and a comment there
says why. The walls had no such comment because nobody had noticed they needed one.

## A roof made of twelve different metals

Looked at the tower cab's pyramid from directly overhead. The four planes were fine; everything
near the four hips was a patchwork of small squares filled with chevrons and concentric squares,
at obviously different rib scales from their neighbours and from each other.

The corrugated texture is drawn 26 in wide — a sheet's coverage width — and holds exactly twelve
corrugations at the 2 1/6-in pitch the doctrine figure names. So the number of tiles across a piece
is the piece's own width divided by 26 in. The viewer asked for

```ts
Math.round(m.cutLength / 12 / tileFt)   // then Math.max(1, …) inside roofingSheet
```

which is a COUNT where the answer is a RATIO. Rounded and floored at one, every piece narrower than
39 in got a whole tile: twelve corrugations, squeezed into whatever width the hip had left it.
Measured on the shipped models:

| roof | pieces at the wrong pitch | worst rendered pitch |
|---|---|---|
| guard tower cab pyramid | 48 of 108 | 0.274 in (true 2.167) |
| building, hip + corrugated | 98 of 304 | 0.328 in |
| building, gable + corrugated | 4 of 104 | 0.604 in |

The gable row is the reason this survived. A gable's only clipped piece is the last strip on each
plane, so the shape everyone looks at is very nearly clean, and the shapes that are not clean are
the ones whose clipping was itself only fixed recently.

The fix is to stop rounding — the texture wraps, so a fractional repeat is not a compromise, it is
a cut sheet ending mid-rib exactly where the snips went through. Roll goods had the same bug in the
other axis: a double-coverage course is 18 in of exposure against a 36-in tile, so `Math.round`
gave it a whole tile and drew its granules at twice their size.

**The arithmetic now lives in its own module, and that is the actual point.** It was three tokens
inside `studio.ts`, which imports `../three-viewer`, which imports `?url` assets — so it cannot be
loaded outside a Vite build, and for as long as the expression lived there **nothing but the eye
could check it**. The eye had passed it for the whole life of the file. `tiling.ts` imports one
type; the test drives it over every corrugated piece four real roofs actually cut, and four of the
six assertions fail on the old expression.

### The warm band that was mine, not the model's

Worth writing down because it cost most of the iteration. Every render of this cab showed one hip
in rust-orange while the other three were grey, and it looked exactly like a wood member standing
proud of the roofing. It was not. Parking the pointer at the canvas centre — which the zoom step
does, because the wheel needs a position — leaves the studio HOVERING whatever is under it, and the
apex of a pyramid is where four hip caps meet. `HOVER_TINT` multiplies over the real material by
design, so the corrugations still showed through and it read as a rusted sheet.

Two things settled it, and neither was a screenshot: `studio().selected` was null, and the app's own
raycaster said every warm pixel was `CP-ridgeCap-01`. Moving the pointer to (5, 5) before the shot
took the warm pixel count from 18,374 to zero. **Harnesses must park the pointer off the canvas
before they screenshot.**

### Lead, not yet a finding: a shed roof with no `highSide`

> **Resolved in the next pass — it was reachable.** See "Laying out the frame, forever" below.

`RoofSpec` makes `highSide` required on a shed, and nothing supplies it if it is missing —
`normalizeSpec` leaves the roof untouched, and `generateShed` does
`walls.surfaces.find((s) => s.wall === highSide)!` on line 450, where the `!` is a lie: the build
throws `Cannot read properties of undefined (reading 'runFt')`. Twenty lines earlier the same
lookup is written with an `if (high)` guard, so the file already disagrees with itself.

This is only a defect if such a spec can reach the engine — a shared `?c=` link or an import is the
obvious candidate, and that has NOT been checked. Recorded here so the next pass starts from the
question rather than from the crash.

## Laying out the frame, forever

The previous pass left a question rather than a finding: `generateShed` does
`walls.surfaces.find((s) => s.wall === highSide)!` and `highSide` is required on a shed, so the
build throws if it is missing — but could a spec like that ever reach the engine?

It can. `decodeSpec` is the app's untrusted boundary and it is deliberately permissive:

```ts
if (!parsed || typeof parsed !== 'object' || !('family' in parsed)) return null;
return parsed;
```

Any JSON with a `family` key is accepted and handed to `generateStructure`. That is a defensible
design — links have to survive version drift, and the file's own pyramid note already says a
pyramid roof "only arrived through a shared link" — but it means `normalizeSpec` is the whole of
the validation, and it checked the roof's KIND and never its per-kind fields.

Built the link and opened it. **The workbench renders completely and never finishes.** Title bar,
Copy link, Command packet, the View/Stage/Cut menus, the plate-layout card on the right — and in
the middle a spinner reading "Laying out the frame…" that never stops. `hasCanvas: false`, no
members, no issue, no error visible anywhere. It does not look broken; it looks slow.

Probing the whole roof union off one preset found three holes, not one:

| roof off the link | before |
|---|---|
| `{kind:'shed', …}` with no `highSide` | **threw** `Cannot read properties of undefined (reading 'runFt')` |
| `highSide: 'up'` | same throw |
| no `roof` key at all | **threw** `Cannot read properties of undefined (reading 'kind')` |
| `{kind:'dome', …}` | 656 members, **zero roof framing, zero issues** |

The last row is the one worth dwelling on. It is the exact defect the pyramid comment in
`normalize.ts` was written about — "a building open to the sky … and not one word said about it" —
and it was still there for every kind outside the union, because the fix that time was written for
one value rather than for the set.

All three are repaired where every path already goes: `generateStructure` calls `normalizeSpec`
first, so the store, the share link and the importer are all covered by one block. A missing or
malformed roof becomes the standard gable; an unknown kind becomes a gable and names what was
asked for; a shed with no high side takes the north wall, which is what the panel writes anyway,
so an app-made link and a hand-made one now describe the same roof. Every one of them **says so**
in the issues banner — the amber line is now the first thing on the page.

The test file pins the door as well as the guard: its last case asserts that `decodeSpec` really
does pass `{kind:'dome'}` through unvalidated, so if that ever changes, the guard is re-examined
rather than left standing on faith. Five of its seven cases fail on the old normalize, four of
them by throwing.

Unchecked, and the obvious next question: `foundation` is the other discriminated union on a
building spec, with per-kind fields of its own (`crawlFt`, `depthFt`, `stairs`). Nothing here has
looked at what a link does to it.

> **Answered in the next pass, and it was much bigger than the foundation.** See below.

## Six of eight

The previous pass fixed the roof a share link hands in, and wrote down its own lesson: *"that fix
was written for one value rather than for the set."* So this one started with the set. Delete each
top-level key of the shipped GP-frame preset, one at a time, and generate:

| key | before |
|---|---|
| `family` | **threw** — `Cannot destructure property 'spec' of 'normalizeSpec(...)'`: the switch had no default case and returned `undefined` |
| `dims` | **threw** on `.lengthFt` |
| `spacing` | **threw** on `.joistSpacingIn` |
| `coverings` | **threw** on `.roofing` |
| `stories` | **threw** on `.length` |
| `roof` | fine — fixed last pass |
| `foundation` | **threw** on `.kind` |
| `bridging` | fine — genuinely optional |

Six of eight. Every one of them the same dead page: the workbench chrome renders in full and the
viewport sits on "Laying out the frame…" with no canvas, no members and nothing said. Rendered and
confirmed before touching anything.

And one silence to go with them: `generateBuilding` falls through its foundation switch to piers,
so `{kind:'raft'}` came out **byte-identical to a pier foundation** — 42 members, zero issues. The
user asked for one thing and got another with no way to tell.

Everything else in `normalize.ts` repairs a FIELD. This repairs a missing SECTION, which is a
different failure: `clampPath` on `undefined.crawlFt` never runs, because the generator reached the
`undefined` first. `repairSections` fills any section that did not arrive, and reports **one**
summary issue naming what was missing rather than one line per section — a link carrying nothing
but `{family:'building'}` would otherwise bury its own headline.

### The sections are not the same set for every family

The first cut applied the building's six to everything, and an existing test caught it
immediately: `sea-hut: a preset that needs clamping is a preset with a wrong number in it`. A
`HutSpec` has **no `stories` key at all** — it carries `wallHeightFt` and derives the rest from its
variant, and its `roof` and `foundation` are optional. So the shipped sea-hut card was being
"repaired". A guard that fires on good input is a bug with a warning attached.

Split accordingly: `SPEC_SECTIONS_COMMON` (the three every family extends `SpecCommon` for) is
repaired for all of them, and the three only a `BuildingSpec` declares are repaired only for a
building. Zero of the fourteen shipped cards trip any repair, and there is now a test that says so
by walking the whole catalog rather than a hand-picked list.

### Where the fallback lives, and why it cannot drift

`normalize.ts` cannot import the catalog — catalog → families/hut → families/building → normalize
is already a chain and importing back would close it into a cycle. So the fallback values are
stated in `spec.ts`, beside the shapes they fill. That is a second set of numbers, which is exactly
the hazard this codebase keeps finding, so it is pinned the only way that cannot drift: a test
assembles a spec from `SPEC_SECTION_FALLBACK` alone and asserts it normalizes with **zero** issues.
If any value ever falls outside the bounds `SPEC_PATH_DEFS` declares, that test fails.

Five of the new cases fail on the old normalize, four of them by throwing.

Still uncovered, and recorded rather than half-done: the per-family fields beyond `SpecCommon` — a
tower's `platformHeightFt` and `cabPlanFt`, a bunker's cover depth, a platform's ramp. Same door,
same shape, not yet probed.

## Every door in the toolkit was a hole

Zoomed in on the GP building's south wall. The four windows are rectangles you look **through** —
the cripples and the rough sill are visible inside each one, because the siding is correctly cut
around the rough opening and nothing was ever put in it. Same at both doors. Same on all fourteen
cards.

What makes this one worth writing down is that everything needed to notice was already in the tree:

- `OpeningSpec.fill` is written by every catalog preset and by both the "+ Door" and "+ Window"
  buttons, as `'door-ledged'` and `'window-shutter'`. **Nothing read it.** Not one branch, anywhere.
- `MemberRole` has carried `'doorBoard' | 'doorLedge' | 'doorBrace' | 'shutter'` since T5.
  Nothing emitted them.
- `labels.ts` has a plain-language name for `shutter` — for a member that had never existed.
- `TIMBER2_PLAN.md`'s T5 contents name **`builtOpenings.ts` by filename**, and its acceptance
  list names the test — "ledged door w/ brace-direction test" — which was never written because
  the module never was. T5 is marked complete.

A field nothing reads is invisible. A field that **everything writes and nothing reads** is
invisible in a way that looks finished.

### What got built

A **ledged-and-braced door** as a real assembly, because its geometry is the teaching point:
1x6 boards, three ledges across the back, two braces between them. The brace direction is the
whole of it — a brace running down from the hinge jamb to the latch is in TENSION across nailed
lap joints and the door racks into a parallelogram, so it has to rise AWAY from the hinge and take
the leaf's sag in compression. The hinge jamb is stated (the u0 edge) rather than inferred, because
with no hinge in the model the direction would otherwise be arbitrary and no test could tell right
from wrong. A positive `rz` in the wall's own frame is the assertion, on every brace of every card.

**Shutters** as a closed side-hinged pair, hung on the finished wall rather than in the opening,
lapping it by an inch so a closed one shows no light gap. Built as boards and battens: a leaf of
loose boards is not a shutter, and nobody buys a 19-inch-wide 1x6.

**Screen inserts** for the fills that ask for them, using the `screenPanel` the hut's screened
band already uses.

Openings whose `fill` is `'rough'` still get nothing, which is a real state and not an oversight —
the storage shed says `'rough'` explicitly on its 8-ft opening, and that is right: that one is a
bay you back a trailer into, not a leaf. A card with nothing closing it in (`custom` ships with no
sheathing and no siding, so it has no closing-in stage) gets no doors either, which is right for a
framing drawing.

### Three things the tests found that the eye did not

**The braces were cut to the full diagonal.** A brace is a stick with WIDTH, and a rectangle of
width w laid on a diagonal overhangs the corners of its bay by half that width in each direction.
Cut to the diagonal, each brace stood 3⅝ in outside the leaf — past the jamb, in the wall. Its own
nailing note said "cut to fit between the ledges" and it did not. Shortened by the width's own
projection, using the larger of the two ratios because the bay is not square.

**The `batten` role was already taken.** The shutter's cross-pieces were first emitted as
`batten` — the right carpentry word — and the first probe written against the change duly
reported 117 built-opening members on the storage shed, which has none: `batten` already means the
strip over a board-and-batten SIDING joint. A role is a question the model gets asked, and two
answers to it is a role nothing can filter on. They carry `shutter` now.

**The hardware bill was silently skipping four whole schedules.** `timber2-fasteners` has a test
whose entire job is to fail on any nailing schedule the take-off cannot read — "silence here is
the whole honesty claim" — and it walked `gp-frame` and stopped. `gp-frame` has no screened band,
no tower legs and no crib wall, so:

| schedule | members | on |
|---|---|---|
| `staples @ 4" + batten` | 4 per hut | every screened band |
| `bolted at both ends and where the diagonals cross` (+4 more) | 36 | the guard tower |
| `spiked to each post` / `spiked to every stringer` | 73 | the crib bunker |

None of it was on the hardware list. The test now walks **every shipped card**, and the take-off
learned staples, bolts and spikes — plus an explicit "nothing to fasten" list for massing, earth
and the pieces that stand by their own embedment, because `return true` there means "read, and the
count is none" and must never be reached by a pattern loose enough to swallow something real.

### Cost

The solid picker cards grew: gp-frame is 310 KB against a 300 KB budget. Raised to 340 KB with the
same reasoning the last raise used — doors and shutters are real geometry the drawing was
previously missing, the budget's job is catching a renderer that emits a polygon per nail, and
30 KB of headroom above the largest real card still does that. The frozen frame and compat goldens
did **not** move: built openings are appended after the legacy path, which is untouched.

### Left undone, on purpose

- **Hinges and hasps are not counted.** The plan's T5 wants T-hinges and hasps as counted items;
  there is a `hardware` role for it and nothing populates it. A door with no hinge is still a door
  you can see; a bill with no hinges is a bill somebody has to catch.
- **Propped shutters.** `HutSpec.shutters` is now consumed — `'none'` suppresses the pair — but
  `'propped'` draws the same closed pair as `'side'`. A propped leaf is a rotated panel plus a
  prop stick, and no shipped card sets it.
- **`ac-sleeve`** builds nothing. It is in the fill union and no card asks for it.

## The door with nothing under it

Having just built the door leaves, the obvious next question is what you stand on to reach one.
`BuildingSpec.entrySteps` is declared, set to `true` by every hut in `buildingSpecForHut`, and read
by **nothing** — one field along from `fill`, found the same way, in the same file. The plan says it
in a line: *"Entry steps: stair math reused at every door when floor raised ≥ 1.5 ft."*

Measured on the shipped cards:

| threshold above grade | cards |
|---|---|
| 2 ft 3½ in | gp-frame, sea/swa/b/squad hut, latrine |
| 1 ft 1½ in | guard shack, storage shed |

An elevation of the GP building's door end shows it plainly: leaf, floor band, then clear air down
to a pier footing. Five cards had a door nobody could use.

`generateEntrySteps` places the flight and `generateStair` cuts it — same riser rule, same
stringers, same LS figures, no second copy of the stair math. `arriveAt` is why the placement is
one line: a flight is positioned by where you step OFF it, and you step off an entry stair at the
threshold, facing in. The two cards at 1 ft 1½ in get nothing, which is the rule doing its job:
that is a long step up, not a stair.

### What the tests caught that the render did not

**The top tread was buried in the wall.** A flight normally puts a tread at every riser top
including the last, flush with the landing — correct for a deck you step off sideways onto, wrong
for a threshold with a wall in it. Kept, it put 189 cubic inches of tread inside the sole plate and
27 inside the siding, at every door. The landing IS that tread: `omitTopTread` drops it, opt-in, so
the tower's and the platform's stairs do not move.

**Both flights numbered their pieces from one.** `generateStair` hard-coded `makeEmitter('AC')`,
which is right while a structure has ONE stair. A building with two doors has two, and the seeded
sweep found `AC-stringer-01` twice in the same model within a dozen specs. Ids are what selection,
the highlight and the packet's anchors key on. Each flight now carries its own `ES<n>` prefix.

**The footprint check had to learn what an entry stair is.** C-7 asserts nothing flies off into
space, and a stair is the one thing here that is *supposed* to leave the footprint. The allowance is
derived from `solveFlight` — the same solver the stair is cut with, not an estimate of it — and
from the rise to the THRESHOLD rather than to the floor, because the fuzzer writes doors with a sill
on them and a door 3 ft 6 in up needs a flight that much longer. Both corrections came from the test
failing on cases a hand-picked list would never have contained.

**The LS gate wanted a consumer.** `entryStepMinRiseFt` is life-safety — the failure mode is a step
out of a doorway into a drop — and the register requires every LS constant to name the members it
produces. It names `tread` and `stringer`.

### Measured and left alone: the stringer's foot

A stringer is drawn as a plain raked stick, so its lower corner dips **4.04 in below the ground it
stands on**; the real piece is cut square at the foot. That is `generateStair`'s geometry and the
tower's and platform's stairs have had it as long as they have existed, so it is recorded here with
its number rather than folded into this change. The flight's centreline does start exactly at grade,
which is what the test asserts.

> **Taken up in the next pass, and it was two errors rather than one.** See below.

Worth noting for the method: the first version of that test asserted on the stringers' bounding
box and failed, and the box was not the piece — **a box round a raked member spans its whole lean**,
the same trap this sweep has now hit three times. The stringers are checked by sampling their
centreline; the treads are flat and axis-aligned, so their boxes are exact and are used directly.

## A stringer is not a stick on a slope

The previous pass measured this and left it: a stair stringer's lower corner dips 4.04 in below the
ground the flight starts on. Cropped hard on the entry steps, what that looks like is three sharp
diagonal wedges stabbing through the ground plane, and three more waving in the air above the top
tread. Every stair in the toolkit — the tower's, the platform's, the new entry steps — ends that
way at both ends.

Reading the picture rather than the number turned up a second error the number had hidden. **Half
the board was standing above the treads it carries.** `generateStair` places the stringer centred
on the line from the flight's base to its landing, and that line is the stringer's TOP EDGE — the
line of the tread nosings. Centred on it, a 2x12 stood 4 in proud of every tread and buried the
same 4 in in the earth, which is also why the foot's dip and the head's rise were the same figure.

So two fixes, and they are different in kind:

**Where the piece goes** is `generateStair`'s: the centre drops half a face width along the board's
own local −Y — not straight down, because the board is pitched. `stringerDropFt` returns it as a
world offset so nothing has to know the rotation convention twice.

**What shape the piece is** is a cut profile, the same route the rafter's bird's-mouth notch
already travels: a 2D outline in the member's own frame handed to `cutLumberPiece`. A stringer's
ends are cut square to the WORLD rather than to the board — level at the foot so it sits flat on
the ground, plumb at the head so it bears flat on the header. For a pitched board those are not
square cuts, which is exactly why a box got both wrong. The two bites are reciprocals — face width
over the tangent at the foot, face width times it at the head — because one is measured against the
horizontal and the other against the vertical.

Nothing here touches `cutLength`: you cut the ends OFF a board of that length, and the cut list is
right to ask for the whole board.

### The tests had to be rewritten to describe the piece

Both of the previous pass's stringer tests failed on the fix, and both were right to: they measured
the raw stick. One asserted the CENTRELINE starts at grade, which stopped being true the moment the
piece dropped below it; the other sampled the centreline for collisions and found it entering a
floor joist, which the cut piece does not — the plumb face stops at the wall.

They sample `stringerEndProfile` now. The lesson is one this sweep keeps relearning in new forms:
after a bounding box round a raked member, and an orthographic elevation, the third thing that is
not the piece is **the piece before it is cut**. The sampler takes the profile's own corners
explicitly as well as a grid, because an even-odd test is ambiguous exactly ON the boundary and the
boundary is where the answer lives — the first version missed the lowest corner by 0.046 in and
reported the foot as floating.

### Still out of scope, and named

- **The basement stair** is emitted by the frozen `floor.ts` (`FL-stringer-*`), which is C-10 and
  not editable here. It has the same 4.44-in wedges.
- **The platform's ramp** (`PF-stringer-*`) is its own emitter in `families/platform.ts`, not
  `generateStair`, and its stringers dip 5.55 in. Same shape of fix, different file.
  *(Taken up in the next pass — and the dip was 12.34 in, not 5.55: the earlier figure came from
  a sign error in the throwaway probe, not from the model. See below.)*
- **The thumbnail painter draws boxes**, so the picker cards still show the uncut stringer. At
  220x150 over a forty-foot building that is well under a pixel; the 3D view and the solid card are
  what this change is for.

## A ramp with its last six feet underground

`platform.ts` parameterises its ramp better than anything else in the toolkit. One function places
every piece —

```
surface(s) = (x, deckY·s, -run·(1-s))    s = 0 at grade, s = 1 at the platform edge
```

— and each piece says how far square BELOW the walking surface it sits, which is how a carpenter
would describe it. The comment above it explains why: an earlier version gave every piece its own
trigonometry and they disagreed about signs.

The parameterisation is right and the datum was wrong. `s = 0` puts the **walking surface** at
grade, so everything holding it up is under the ground: the toe plank lay entirely below it, and
the stringers ran **12.34 in deep for the last six feet** of a twenty-four-foot run. Their own
nailing note reads *"bolted at the deck; bedded at grade"* — buried a foot under it is not bedded.

Two independent changes:

**The datum.** The toe board lies ON the earth, so the surface starts one deck thickness up and
the rise the slope is measured over is what is left. The slope itself — the life-safety figure — is
untouched; a test measures it off the stringers' own pitch and pins it exactly at every value the
doctrine offers.

**The toe cut.** `stringerEndProfile`, written for the stair last pass, already cuts a level foot —
but it cut the wrong end. The toolkit contains **both handednesses**: a stair climbs out of its +X
end and its foot is at −hx, while the ramp is written the other way round ("walking out the +X end
of the stringer goes DOWNHILL") and its foot is at +hx. Cutting the level face onto the wrong end
would have left the buried end square and hung the long wedge in the air at the deck — worse than
not cutting at all. The function reads the SIGN of the pitch now, not just its magnitude.

At 1:6 the level cut is 5.6 ft long, which is a proper feathered ramp toe rather than the stair's
few inches — the same expression, a very different-looking piece, and `MAX_BITE` was already there
to stop it eating a piece that is too short to carry one.

### Three things this iteration got wrong before getting them right

**The iso view said the ramp stopped in mid-air.** It does not; it runs to the ground. In an
isometric projection something receding from the camera moves UP the screen, so a descending ramp
that recedes can end higher on screen than the deck it came from. An elevation settled it in one
shot. That is the same trap as the orthographic-elevation note earlier in this file, from the other
direction: **a projection is not a measurement**, whichever projection it is.

**The 5.55-in figure recorded last pass was wrong** — the real dip is 12.34 in. The earlier number
came from a throwaway probe that assumed the length axis points uphill, which is true of a stair and
false of this ramp; it measured from the wrong end. The model was never 5.55 in out. Recorded here
because a wrong number carried forward is worse than no number.

**Three of the six new tests failed on their first run for being wrong themselves**: one flagged the
platform's own FOOTINGS as "underground", which is where footings go; one demanded the toe board's
underside sit exactly on grade when the boards are laid across the ramp from the toe up, so the
first board's underside is legitimately half a board's rise above it; and one measured the slope
from a bounding box round those boards and read 3% shallow.

## A doorway with everything but the hole

The crib bunker's entrance has had two passes already — one added the jamb posts, one moved the
baffle so it actually shuts the sightline instead of covering half the opening. Both were about
what stands AROUND the doorway. Nobody had checked the doorway.

`bunker.ts` frames it exactly: two jamb posts on the opening's edges, a header spanning them, a
baffle wall standing off outside. Fifty lines earlier, the wall pass emits a lagging course at
every height across the **full run of every side**, and knows nothing about a door. So the opening
was boarded over — eleven full-width courses from the ground to the wall top — and two of the
wall's own posts stood inside the clear span, each overlapping a jamb by 0.6 in for good measure.
Sampling the doorway rectangle: **160 of 160 points solid.** The bunker had no way in.

The fix moves the doorway's geometry above the wall block — it was computed fifty lines below the
only code that needed to know — and gives the entrance wall a gap: posts that would stand in the
opening are not built (the jamb is their replacement), and each lagging course becomes the two
boards either side of it, which is what you would actually cut. The other three sides are
untouched, and a test asserts that by counting distinct course lengths: three unbroken sides have
exactly two.

The conservation check is the one this codebase already uses for siding — **covered plus hole equals
wall**, measured per course so a missing course cannot hide inside a total.

### The test that passed for the wrong reason

The first cut of "no post stands in the doorway" passed against the OLD generator, which is how I
found out it was worthless. It identified the jambs as "posts on the entrance wall standing under
the header" — and the two posts that were standing in the opening also stand under the header, so
they were classified as jambs and excluded from the check that was looking for them.

A jamb is a post whose **outer face is where the header ends**. Under that definition the two
intruders are what they are, and the test fails on the old code with `BK-post-13 intrudes 5.50 in
into the opening the header spans`. Three of the five new cases fail there now; before the fix to
the fixture, only two did.

### Recorded, not changed

- **A 1¾-in gap above the header.** The long walls carry a cap beam filling the band from the post
  tops to the overhead stringers; the end wall has only the header, which is shallower, so a slot
  runs along the top of the entrance wall between the header and the overhead cover. It is not
  structural — the stringers span the short way and bear on the long walls — but it is a hole in
  the overhead line, and worth a look on its own.
- **`wallType: 'crib'`** builds its walls through `generateCribWall`, an entirely separate emitter
  that also knows nothing about the doorway. The shipped preset is `post-plank`, so this pass
  fixed what ships; the crib option needs the same treatment and has not had it.
  *(Done in the next pass — and the doorway turned out to be the smaller of two things wrong
  with it. See below.)*

## The crib that held up nothing

Went after the recorded item — the doorway that `generateCribWall` knows nothing about — and found
a bigger one on the way in.

**A crib is stacked in whole courses and stops at the last one that fits.** There is no half a log.
So a 6 ft 6 in wall of 7¼-in timbers tops out at 6 ft 0½ in. Nothing consumed that: `bunker.ts`
set its cap beam at the height it ASKED for. On a crib bunker the cap — carrying the overhead
stringers, the roof lagging and two feet of earth — bore on a **5½-in air gap the whole way round**,
crossed only by the two door jambs, which are cut to the nominal height and do reach it.

`cribWallTopFt` states where a crib actually comes up, `bunker.ts` puts the cap and the door frame
there, and the build **says** what it did: *"A crib is built in whole courses and there is no half a
log: 6.5 ft of wall comes out at 6.04 ft, ten courses of 6x8."* Silent correction is how a tool
teaches the wrong number.

The doorway was the recorded half: the entrance wall's stretcher courses now stop at the jambs and
the ties that would land in the opening are not laid. 380 of 1995 sampled points were solid timber
before; none are now. The cut list shows it — twenty 3'-11" logs appear and ten 12'-9" ones go.

### Three wrong tests, in order

Worth writing down as a sequence, because each was wrong in a different way and the third is the
only one that says what the defect actually was.

1. **Comparing the highest point of everything against the cap. PASSED on the broken model** — the
   two door jambs are cut to the height asked for and do touch it. That is the *second pass running*
   in which a pair of posts by a doorway made a test agree with a model that was wrong.
2. **Probing for material under every station along the cap. FAILED on the FIXED model** — a crib's
   top course is ties on a spacing, and a cap beam is a beam: it spans between bearings, exactly as
   it does over the posts of a post-plank wall. The premise was an engineering mistake, not a
   measurement one.
3. **The wall must come up to the cap.** Simpler than either, true of both wall types, and it fails
   on the old code with the number: *"the cap starts at 6.5000 and the wall stops at 6.0417 —
   5.50 in of air under everything it carries."*

A fourth, smaller one: the tie-log guard first compared tie CENTRES against the opening, so a tie
centred on its edge still laid 2¾ in of timber across the way in. The test caught it.

### Seen while measuring, not changed

- **The cap beam is not centred on the wall it caps.** On a post-plank bunker it sits half a wall
  thickness inboard, so its inner half overhangs the interior with nothing under it. Bearing is
  real over the outer half; this is why the station probe above had to sample across the cap's
  width rather than down its centreline.
- **The top lagging course overshoots the posts by 1¾ in** on a post-plank wall and laps into the
  cap beam, because the course loop runs `y < H` and the last course starts below it.
- **The shipped card does not move.** `post-plank` walls are cut to the height asked for, so
  `wallTopY` is exactly what it was and the goldens are byte-identical. Everything above was
  reachable only through the non-default option — which is precisely why it lasted.

## The wall that stood outside the building

Went after the recorded item — *"the cap beam is not centred on the wall it caps"* — and it turned
out the cap was never wrong. The wall was.

`outerL = interiorLengthFt + 2·wallThick` makes the rectangle `[0, outerL] × [0, outerW]` the
bunker's **outer face**. The wall was built ON that rectangle — *centred* on it. So half of every
post and half of every lagging board stood outside the structure:

```
post-plank, shipped card (16 × 10 interior, 5½-in walls, outer 16.917 × 10.917)
  posts     z −0.2292 .. 11.1458      ← 2¾ in past the building line, both sides
  lagging   z −0.0625 .. 10.9792
  capBeam   z  0.0000 .. 10.9167      ← correctly on the wall band, at wallThick / 2
  cap over post: 0.2292 ft of a 0.4583 ft cap — exactly half, the inner half over open air
  clear interior 10.458 × 16.458 of a stated 10 × 16 — 5½ in over, each way
```

In plan it is unmistakable: **post tabs projecting past the roof line at every station down both
long walls**, and a matching row down each end. Fixed by putting the four corners on the wall's own
centreline, inset `wallThick / 2` from the outer face. One four-line change; the two `onEntryWall`
tests move with it.

Everything the wall was supposed to *meet* was already in the right place — the jambs and header at
`wallThick / 2`, the caps at `wallThick / 2`, the stringers on the caps. That is what made it
invisible from every direction but straight down: the wall was the only piece that disagreed, and
from inside or outside it simply looked like a wall.

### What the tests had to say instead

- **It fills its own footprint.** The envelope of every wall member is exactly `[0, outerL] ×
  `[0, outerW]`. Fails on the old code with *"the wall reaches x=−0.2292 against an outer face at
  0.0000 — 2.75 in of it is on the wrong side of the building line."*
- **The interior is the interior asked for.** Measured with rays through the building rather than a
  bounding box, and read **per side**: the two end walls never both present a post at the same
  station — the doorway takes two out of the near one — so no single ray measures the stated length,
  and demanding one measures the wrong thing. Between two posts the wall is only the 1½-in plank, so
  the clear run there is genuinely wider; the per-ray claim is a *bound*, and the per-side equality
  is what pins where the wall is.
- **The cap bears across its whole width**, compared against the wall's top course *as a band* —
  a cap is a beam and spans between bearings. Members that run the length of another wall are left
  out; an end-wall stretcher crosses the cap's band and says nothing about what the cap sits on.

### Seen while measuring, not changed

- **The overhead stringers hang 3⅝ in out of each end of the bunker.** They are placed at
  `x = outerL · i / (n−1)`, so the first and last are *centred on* the end faces: half of each 8×8
  projects past the end wall, past the end of the cap it bears on, and out from under both the roof
  lagging and the earth cover. The same "placed on a face instead of inside it" mistake as the wall,
  one loop further down. **Next target.**
- **The wall lagging is centred on the post line**, so at every post station the plank passes
  through the post. Physically the lagging retains the earth and belongs on the *outer* face of the
  posts. Pre-existing and unchanged by this pass.

## The two beams cantilevered over the ends of the bunker

The recorded next target, and it went the same way as the wall: the visible defect was one of two,
and the second one was in the number rather than the geometry.

The overhead stringers were placed at `x = outerL · i / (n − 1)` — the first and last **centred on**
the end faces of the building. Half of each 8×8 hung 3⅝ in past the end wall, past the end of the
cap it bears on, and out from under both the roof lagging and the earth cover. A front elevation of
the stringer stage shows it plainly: the end stringer's outer face sits clear of the wall below it,
with air under the overhanging half.

```
post-plank, shipped card (outer 16.917 ft long, 8x8 stringers 7¼ in thick)
  before   x −0.3021 .. 17.2188   n = 9    25⅜ in on centre
  after    x  0.0000 .. 16.9167   n = 10   21¾ in on centre
```

**The count was wrong too.** `floor(outerL / spacing) + 1` is the number of stringers that fit at
*least* the doctrine spacing apart — the wrong side of a maximum. `BUNKER.stringerSpacingFt` is
`doc(2, …, { lifeSafety: true })`, and the shipped card came out at 25⅜ in on centre against 24.
The run that has to be divided is the building less one stringer, and it has to be divided into
**enough** bays: `ceil(run / spacing)`.

Three regression tests, all failing on the old generator across five interior lengths and both
wall types: *"the first stringer's outer face is at −0.3021 against an end wall at 0 — 3.63 in of
it is outside the building"*, *"26.20 in on centre against a 24 in maximum"*, and *"3.63 in of it
is past the end of what carries it."* The spacing test is bounded from **above** as well — one
fewer stringer would have to break the spacing — so a later change cannot buy its way out of it
with timber the table never asked for.

### Seen while measuring, not changed

- **The post spacing has the same bug.** `Math.round(run / postSpacing) + 1` gives 4 ft 1⅜ in on
  centre against a `postSpacingFt` of 4 ft, also flagged life-safety and also named on the card's
  own lock list. Same wrong side of a maximum, different loop. **Next target.**
- **The roof deck stops ½ in short of the far long wall.** `for (let z = lagW/2; z < outerW; z += lagW)`
  ends when the next board's centre would fall outside, so the last board's far edge lands at
  10.875 ft of a 10.917 ft building — a ½-in strip of the overhead with earth straight onto the
  stringers. The `Math.min` clamp in the position was meant to catch this and does not fire.

## The treads that were not on the steps

Moved off the bunker to a family/member combination not yet looked at: the **entry steps and stair
treads** on `gp-frame`. A side elevation of a hut's entry flight shows three loose boards floating
beside the stringer, the lowest one detached in mid-air past the end of it.

Two defects, one line apart.

**`base` is documented as "the nose of the lowest riser", and the generator centred tread i on the
nose line.** So every tread sat half its own depth (4⅝ in of a 9¼-in 2x10) downhill of the step it
belongs to. Measured through the stringers' cut profiles:

```
                     underside over stringer material
                     before        after
gp-frame  tread 1     0%            38%      ← the whole bottom tread was in the air,
          tread 2    15%            65%        and half of it stood past the foot of
          tread 3    43%            93%        the stringers entirely
platform  tread 1     0%            28%
          tread 2     0%            48%
```

**A flight of N risers has N−1 treads**, and every flight in the toolkit built N. The N-th surface
is the landing — the deck, the platform between flights, the threshold — and whoever built that
built it already. An `omitTopTread` flag had been added for the entry steps when that tread turned
up buried in a sole plate; it was the general rule wearing a local name, and on the loading
platform the same tread sat inside the deck planks it arrived at, 14 in³ of one solid inside
another. The flag is gone.

Three regression tests, all failing on the old generator: the tread count against the riser count;
*"ES1-tread-01 runs 50.1563..50.9271 along a flight that runs −2.5417..50.5417 — 4.62 in of it is
off the end"*; and *"ES1-tread-01 has 0 of 205 points of its underside over stringer material — it
is standing in the air."* The bearing test is asked EXACTLY, against the cut profile polygon; the
first version sampled the stringer instead and failed on the FIXED model, reporting no stringer
under a tread that had 28% bearing — a 1½-in board leaves a thin band for a sample to land in.

### The real one, measured and not yet fixed

**The stringer has no sawtooth.** Its top edge is a straight rake from the flight's base to the
landing, and you cannot lay flat treads on a straight raked edge: each tread meets it along a
line, so the stringer now stands *through* 20–93% of each tread's own thickness (it did before as
well — 0–43% — with the treads in the wrong place). The three lines involved:

- the **nosing line** through the nose points, slope `R/T`, from `(0, R)` to `((N−1)T, N·R)`;
- the **stringer's line as built**, from `(0, 0)` to `((N−1)T, N·R)` — slope `N·R/((N−1)T)`, a
  third steeper, one riser low at the foot and level with the nosing line only at the head;
- the **sawtooth**, which is what actually carries treads: a horizontal seat at `i·R − t` from
  `(i−1)T` to `iT`, and a plumb riser face between each pair.

The profile machinery already exists — `stringerEndProfile` feeds `cutLumberPiece`, the same route
the bird's-mouth travels — and the local-frame mapping is
`localX = −hx + Δd·cos p + Δh·sin p`, `localY = hy − Δd·sin p + Δh·cos p` from the flight's base.
What it needs beyond that is the stringer repositioned onto the nosing line (so there is material
above the seats to cut away) and the foot drop that goes with it. **Next target.**

## The stringer that was never cut

The recorded target, and the one the tread pass could not reach. **A stair stringer is CUT, and the
cuts are the stair.** Its top edge is not a rake, it is a staircase: a level seat under every tread
and a plumb riser face between each pair. Drawn as a board with a straight top edge, flat treads
laid on it can only ever meet it along a *line* — so every tread was part buried in the stringer
and part hanging in the air, and no arrangement of the treads could fix it, because the fault was
the shape of the board under them.

```
share of each tread's own thickness the stringer stood THROUGH
              before        after
platform  1    20%           0%
          2    38%           0%
          3    55%           0%
          4    73%           0%
          5    93%           0%

share of each tread's depth actually seated on the stringer
gp-frame  1    36%          100%
```

Three lines are involved and only one of them is the stringer:

- **The nosing line** runs through the nose of every tread — slope `R/T`, from `(0, R)` at the base
  to `((N−1)T, N·R)` at the landing. This is the line a framing square walks, and the line the
  stock is laid out from: the board hangs its full face width below it.
- **The line as built** ran from `(0, 0)` to `((N−1)T, N·R)` — from the *ground* at the base to the
  landing at the head. A third steeper than the nosing line, a full riser low at the foot, level
  with it only at the very top. Every tread crossed it.
- **The sawtooth** is what carries treads: seat `i` level at `h = i·R − t` from `d = (i−1)T` to
  `d = iT`, with a plumb face between each seat and the next.

The board moves onto the nosing line and `stairStringerProfile` cuts the rest — sawtooth, level
foot where the underside reaches the ground (a 9⅙-in flat on a 2x12 at 7¼/10), plumb head at the
landing edge, all one polygon. Traced into world space on a hut's entry flight:

```
foot            y −2.2917   = grade exactly
seats           y −1.8125, −1.2083, −0.6042   = the three tread undersides, exactly
riser faces     x 50.5417, 49.7083, 48.8750, 48.0417   = one unit run apart, exactly
head            y  0.1250   = the threshold
```

**Nothing is threaded through the model to do this.** The unit run is doctrine and the same for
every flight, the pitch gives the riser, and the length gives the count — so `stairGeometryOf`
reads the whole flight back off the piece, the way `birdsMouth` and `riserSeats` read theirs off
the members the engine already emitted. The loading platform's RAMP shares the `stringer` role,
carries a NEGATIVE pitch and has no steps; it reads as not-a-stair and keeps its two end cuts.

Four regression tests, three of which fail on the pre-sawtooth placement (*"is not readable as a
cut stringer"*, *"stands through ES1-tread-01"*, *"seated over 36% of its depth, not all of it"*)
and one — the ramp guard — which must pass both ways and does.

### A test that was a proxy, and stopped being true

`A STRINGER IS CUT LEVEL AT THE FOOT` asserted the foot was not below the low end of the board's
own **centreline**. That held only while the board lay on the base-to-landing line. A cut stringer
is laid on the nosing line, and its centreline low end necessarily sits about a fifth of an inch
*above* its foot corner — because the corner is what touches the ground. Replaced with the two
claims the proxy stood for: nothing of the cut piece is under the ground, and the flight that
starts at grade starts exactly there.

## Collar ties — checked, clean

A member type nothing in this sweep had looked at. Every tie on `gp-frame`, `sea-hut`, `b-hut`,
`squad-hut` and `swa-hut` laps BOTH opposing rafters: measured in each rafter's own frame, the
tie's end sits at local y = 0.0000 — dead centre of the rafter's 5½-in face — and at local x well
inside its length. The ties stand on edge, in the roof's upper third, on a 4-ft spacing that lands
on a rafter station because 4 ft is exactly three 16-in bays. A gable-end elevation at the rafter
stage confirms it. **Nothing wrong.**

Two of my own probes were wrong before the third was right, and both are the raked-box trap in new
clothes: a bounding box round a rafter spans its whole lean, so "the tie's box touches the rafter's
box" is nearly content-free; and walking along the tie's own centreline never enters the rafter at
all, because the tie is nailed to its SIDE — the two centrelines are 1½ in apart by construction.

## The shutter mode that drew the other mode's shutter

`shutters` is a three-value enum on `BuildingSpec` and on `HutSpec`, it survives a share link, and
`emitShutterPair` was the only thing any value but `'none'` reached. So **`'side'` and `'propped'`
produced byte-identical geometry** — a hut shut up for the night and the same hut open to the
breeze were the same model. No preset writes the field, so the only way to reach it is a link, and
a link is exactly where an unchecked value comes from: **any other string at all was accepted in
silence** and came back as the closed pair.

`'propped'` now builds what it says: ONE leaf the full width of the opening, hinged along its top
edge, swung out 45° and held by a stick that meets its free edge. Not a pair — a pair is
side-hinged, which is what `'side'` means, and is why the two modes are different pieces rather
than the same pieces at an angle. The unknown value is repaired to `'side'` and says so, the same
way the roof kind and the foundation kind already do a few lines up in `normalize.ts`.

### The sign I got wrong, and what hid it

`rx` tilts a wall-mounted piece toward the local +Z of `[0, yaw, 0]` — which is the wall's
**inward** normal, not its outward one. `π − angle` swung every leaf back *through* the wall it
hangs on. The battens are placed by position alone and were right either way, so the render came
out as a tangle of crossing sticks rather than as a leaf pointing the wrong way, and it took a
numeric probe of the members' own axes to see which piece was actually wrong.

Two guardrail tests then caught two bare magnitudes in the new code, and both were right to. The
prop's foot had been "85% down the leaf"; it now meets the leaf's **free edge**, which is where a
prop actually goes and is a place rather than a number. Its minimum length is now the toolkit's
own `TOLERANCE.minSliverFt` rather than a hand-picked half inch.

## The stair the safety rule forced on, with nothing to hold

A family/access combination the sweep had never rendered: **the guard tower at a height that makes
a ladder illegal.** `normalizeSpec` switches a 24-ft tower to a switchback stair and says so — the
card's own lock list cites EM 385-1-1 for exactly this. Three flights, two landings, 24 ft of
climb, and **not one rail anywhere on it.** Every one of the model's 21 rail and toe-board members
was at 24 ft or above, on the platform the stair arrives at.

`StairResult.landings` has carried the comment *"Landing centres, for the railing pass"* since the
module was written. Grep found no reader anywhere — `tower.ts` takes `.members` and drops the rest.
The same shape as `fill`, `entrySteps` and `shutters` before it: **the field that names the missing
work is right there in the type, written by the thing that knows and read by nobody.**

Now emitted by `generateStair` itself, because whether an edge needs a rail is not the caller's
decision to make — that is `railings.ts`'s stated philosophy and `railRequired` is its answer:

- **Every flight, both sides.** Posts plumb on the stringers at the doctrine spacing; top and mid
  rails **raked at the flight's own pitch**, their heights measured PLUMB from the nosing line,
  which is how a stair rail is measured and why the rails lean and the posts do not.
- **Every landing**, through the existing `generateRailing` and the `landings` the API already
  returned — railed on all four sides but the ones a flight passes through. A 180° turn puts both
  flights on the same side, so three sides are railed; a quarter turn opens two.
- **Nothing below the threshold.** A hut's entry steps rise 2 ft 5 in against a 2 ft 6 in
  fall-protection figure and are left alone. Three steps with a handrail would be this tool
  inventing a requirement.

`generateRailing` needed an `idPrefix` of its own: every call numbers from one, so a platform and
two landings all produced `RL-railPost-01`. The stair generator hit this exact thing with its own
flights and it is the same fix.

Seven regression tests, four failing on the old code. Two guard the boundary in both directions —
the sub-threshold flight and id uniqueness — and one had to be tightened after it passed
**vacuously** on the old model: "each rail runs its own flight" is trivially true when there are no
rails, so it now asserts there are twelve to check first.

### One wrong test, and the reason

Matching a mid rail to its top rail by plan position alone found a rail 9¾ ft away. A switchback
stacks its flights over one another, so flight 1 and flight 3 share a plan line *exactly*. Matched
on height as well.

## The landing built on the gap between the flights

Last pass's railing work left one thing flagged and not checked: whether the switchback landing is
big enough. It is not, and the number is exact.

`walkPath` turns a switchback in place and steps **sideways one stair width**, so the two flights
stand side by side and the pair is two widths across. The landing was drawn as a square of ONE
width centred between their two centrelines:

```
24-ft tower, 2 ft 6 in flights
  landing            x[3.000, 5.500]   ← 2 ft 6 in, the gap between the centrelines
  arriving flight    x[4.250, 6.750]
  departing flight   x[1.750, 4.250]
  plan overlap       15.0 in of a 30-in tread, at both landings, both flights — exactly half
```

So **half the width of every flight stepped off onto air.** The landing also straddled the plane
it should have started at, hanging a foot back over the last tread of the flight below.

Measured now in the arriving flight's own frame: **across**, from the far edge of one flight to the
far edge of the other; **along**, from wherever the two flights actually meet it, forward to at
least the stair's own width — a landing shorter than the stair is wide is not one you can turn on.
Both flights now meet it over their full 30 in.

**And it is decked in boards that exist.** The landing was ONE piece of `2x10` with a face width of
30 in written onto it — a board nobody can cut, on a list somebody has to fill. It is a floor, so
it gets floor boards, the last one ripped.

Four regression tests over the two changes, all failing on the old code, and the geometric one had
to be re-ordered to say so: it asserted the plank COUNT before the overlap, so on the old model it
failed with *"2 landing planks"* instead of *"AC-tread-12 is 30.0 in wide and only 15.0 in of it is
over the landing"* — the right number, reported by the wrong claim.

## A post-and-plank wall is two layers, and it was modelled as one

The planks were laid on the posts' own centreline, so at every post station a plank ran straight
**through** the post it crossed:

```
crib-bunker, shipped post-plank card
  lagging-through-post overlaps   176 pairs
  deepest                          59.8 in³   (BK-lagging-27 inside BK-post-11)
```

And it is not a question of which side looks tidier. **The earth is outside and it pushes in**, so
the planks belong on the outer face with the posts behind them: the load then bears the planks
*onto* the posts, which is the whole reason a soldier-pile wall is built that way round. On the
posts' own line the planks were retaining nothing.

So the wall band is now the plank plus the post — `postThick + lagThick` — with the plank at the
outer face and the post line inset behind it. The clear interior is unchanged (it is measured from
the posts' inner face either way); the bunker's outside grew by the plank, 16.917 ft to 17.167.
Three things moved with the post line and had to: the **cap beam**, which centred on the whole band
would hang a plank's width out over the lagging and miss as much of the post it bears on; and the
**door jambs and header**, which are posts.

**The baffle had the same mistake at half the depth.** It stood its own lagging off by HALF a
post — which puts the plank's centre on the post's face and half of every board inside it. Face to
face now, like the wall.

Three regression tests, all failing on the old wall, and the second one is the reason the first is
not enough: a plank laid *inboard* of the posts would be just as free of overlaps and exactly
wrong, so it is measured per side against the building line — the planks' outer face IS the
building line, and the posts are inboard of them.

Three existing tests moved with it, and only their constant: `bunkerGeom` derived the wall
thickness from the post alone. The claims — the wall fills its footprint, the interior is the
interior asked for, the stringers lie inside the building — are unchanged.

### Seen while measuring, not changed

- **The top lagging course stands 1¾ in proud of the posts and laps into the cap beam.** 6 ft 6 in
  of wall is 10.759 courses of a 7¼-in plank; the loop runs `y < H` so it lays eleven, and the last
  one's top reaches 6.6458 against a wall top of 6.5000 and a cap underside of 6.5000. Visible in
  an outside view as a step at every post. The fix is to RIP the last course to fit — stopping the
  loop early instead would leave a 5½-in slot under the cap, which is worse. **Next target.**

## Three board runs, three ways of getting the remainder wrong

The recorded target, and looking for it turned up two more of the same thing. This family lays
boards in three places and none of them closed:

```
6 ft 6 in of wall  = 10.759 courses of a 7¼-in plank
11 ft 2 in of roof = 18.483 boards

  WALL      laid eleven whole courses    → top course 1¾ in proud of the posts,
                                            and 1¾ in INTO the cap beam, all the way round
  BAFFLE    clamped the last centre down → that board lay 1¾ in ON TOP OF the one below it
  OVERHEAD  clamped the same way across  → 3½ in SHORT of the far wall, which is 3½ in of
                                            overhead with the earth straight onto the stringers
```

Same figure twice as an overshoot and as duplicated material, and a third time as a hole. **One
answer to all three: the last board of a run is ripped to fit** — the same thing `boardRun` in
`builtOpenings.ts` has always done for a wall's siding. All three runs now start at 0, close
exactly on their limit, and meet edge to edge with nothing doubled.

The overhead went from 18 boards to 19; the nineteenth is the 3½-in rip.

One regression test with the claim stated once and checked in all three places, plus two guards
that matter more than they look:

- **A rip is NARROWER than the stock, never wider.** Closing a run by widening the last board
  satisfies every other assertion here and puts a board on the cut list that nobody can cut — the
  landing's fake 30-in `2x10` two passes ago was exactly that mistake.
- **At least one board in each run must actually be ripped**, or the case divides evenly and the
  test is checking nothing.

It fails on the old generator at the first of the three: *"the wall: the last board ends at 6.6458
against a limit of 6.5000 — 1.75 in past it."*

## Floor cross-bridging — measured, wrong, and OUT OF BOUNDS

A member type nothing in this sweep had looked at, and it is wrong. The ends are cut square to the
board instead of plumb against the joists they bear on, so on the shipped `gp-frame`:

```
144 bridging pieces, 1x3 at 25.4°, between 2x8 joists
  every corner    0.780 in above the joist tops and 0.780 in below their soffit
  288 of 1152     corners inside the SUBFLOOR — two per piece, through the floor deck
  576 of 1152     corners inside a JOIST — the square end drives into the joist beside it
```

**It cannot be fixed.** `FL-bridging-*` comes from `floor.ts`, and `timber2-compat.test.ts` opens
with *"Red here past 1e-12 is a stop-the-line event — never 'update the golden' to make it pass;
the goldens ARE the contract."*

And a viewer-side cut — the `birdsMouth`/`riserSeats` pattern, pure, no golden moves — only gets
half of it. Cutting each end plumb removes the 576 corners driving into the joists, but the piece's
world-height extent is set by the board's own width and its pitch, and the plumb cut passes exactly
through the two corners that were already extreme. The 288 corners through the subfloor survive it
untouched. A half-fix that leaves the visible half is not worth the machinery.

**What it would take:** the centreline ends moved in by half the end face's height
(`boardWidth / 2 / cos(pitch)` = 1.38 in here) so the bevelled end sits inside the joist depth —
which is the generator, which is frozen. Recorded here so the next person to unfreeze `floor.ts`
has the number.

## The roof deck option, which had three faults

`coverings.roofDeck` is a five-value enum and only two of the five meant anything.

**A board deck was plywood.** `'boards'` and `'plywood'` came out of the covering pass byte for
byte the same — the same `4x8 panel` members, the same nominal on the cut list, the same smooth tan
sheet on screen. The wall pass next door has always laid its board siding as real boards at their
true dressed width with the last one ripped; this side never did. Now `LUMBER.deckBoardNominal`
(1x8) laid across the rafters, stepping up the slope, ripped at the ridge.

It needed its **own course loop** rather than `tileSurface`. That tiler splits a course into bands
up the slope when a hip tapers faster than a sheet's height can follow — right for a 4-ft sheet,
and on a 7¼-in board it sliced every course into four 1⅞-in strips. A board is one piece.

And **the deck's thickness now follows its material**: the roofing's lift came off
`PANEL.roofDeckThickIn` for both, so a ¾-in board deck lifted the courses by ½ in and they sank
into it. (The test for this had to be corrected once: the lift is perpendicular to the roof plane,
so a ¼-in difference raises a course by ¼ in × cos(pitch), not by ¼ in.)

**`'skip'` was a synonym for `'none'`** that no card offered and no generator told apart. Gone from
the type; a link still carrying it is repaired to the thing it always meant, out loud.

**And the whole section took any string.** `siding: "nonsense"` and `roofing: "nonsense"` came back
with the same member count as a real answer; `wallSheathing` and `roofDeck` came back with none.
Nothing said a word. All four are guarded now, the same way the roof kind, the foundation kind and
the shutter mode already were — a share link is the only way to reach any of it, and a share link
is exactly where a typo comes from.

Five regression tests, all five failing on the old code.
