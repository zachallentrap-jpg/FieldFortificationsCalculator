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
| **GP framed building** (48×20, piers, plywood, roll) | **Checked, clean.** Nothing wrong. Four measurements with negative controls: piers, walls, roof covering, gable rake. |
| **The corners, where two skins meet** | **Fixed** — the siding stopped one wall thickness short at each end of the two butting walls, leaving a 3½-in strip of bare framing in every corner of every building, sole plate to cap plate. |
| **Flat / shed roof — the top of the slope** | **Fixed** — a single-slope roof has no ridge, and the cap laid on its top edge hung half its width past the roof; the same edge had no fascia over its rafter tails. |
| **The tent frame's `endDoor`** | **Fixed** — a live "Framed end door" toggle on both tent cards, set `true` by both presets, read by no generator: turning it off produced a byte-identical model. |
| **Crib bunker — the top of the end walls** | **Fixed** — capped on the two long walls only, so both end walls stopped 7¼ in below the overhead: a slot the width of the bunker at each end, under two feet of earth. |
| **Crib bunker — the bays between the stringers** | **Fixed** — every bay was a hole in the long wall, a stringer deep, open at the face and leading straight down into the bunker. |
| **The attic hatch** (`atticAccess`) | **Fixed** — the "absorbed by trimmers" test used half the joist SPACING, so it deleted two ceiling joists at the hatch and put nothing in their place; one of them was inside the opening. |
| **The loading platform's deck** | **Fixed** — the decking was laid INTO the top of every joist, and the last board was clamped instead of ripped, leaving an inch of open deck along the whole edge. |
| **Where a guardrail post's foot is** | **Fixed** — one arithmetic slip, written in `railings.ts` and copied into `access.ts`, put every rail post's foot 1¾ in below the surface it guards, through the deck's edge board. |
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
| **The B-hut's partitions** | **Fixed** — every upright was a quarter turn out, so a partition was 1½ in of wood in its own 3½-in plate; and the doorway was struck off the WALL's thickness instead of the STUD's, which put the king where the jack goes and left the jack standing in the doorway. |
| **The gable end studs** | **Fixed** — the same quarter turn, in `roof.ts`: 186 gable studs across nine cards stood 1½ in across a 3½-in wall, ½ in off the plate's centre and 3½ in off the stud below, and the one at the peak ran 1.45 in into the ridge board. |
| **The guard tower's X-braces** | **Fixed** — both diagonals of every X were drawn on the legs' own centre plane, so each was inside the two legs it braces and inside its twin at the crossing: 162 overlapping pairs, down to 6. |
| **The guard tower's girts** | **Fixed** — every girt ran centre to centre and so was buried in both legs, and the top one sat at DECK level, through all sixteen joists, the deck, the cab posts and the railing's feet: 61 overlapping pairs, down to 8 at 0.007 in. |
| **The guard tower's platform frame** | **Fixed** — the legs ran to the DECK line, so the two outermost joists ran through two corner legs each (2.74 in); and every joist was cut to the cab plan, stopping 0.05 in inside the girt it bears on. |
| **The guard tower's stair** | **Fixed** — the well was struck off the DECK edge and a battered base is two feet wider, so the stair stood inside its own tower; it now stands clear of the frame and a railed landing bridges back to the deck. |
| **Where a guardrail's pieces meet** | **Fixed** — every rail ran straight through every one of its own posts (59 pairs, to 2½ in) and two runs meeting at a corner each sat half a thickness inside the other (12 more). |
| **The hut's girts at a corner** | **Fixed** — the ends were clipped against the perpendicular WALLS' faces, but a girt lies inboard of the studs, so both girts of every corner reached the same 1½-in square: 24 pairs across the six hut cards. |
| **What `platformHeightFt` means** | **Fixed** — on a tower it was the platform FRAME's top with the decking laid on that, so a tower asked for 16 ft walked at 16 ft 0¾ in; the loading platform means the surface, and now both do. |
| **The tower ladder's rails** | **Fixed** — the rails raked the OPPOSITE way to the rungs, so 14 of the 16 rungs floated free of both, the bottom one 17.90 in clear; and once they raked right they leaned into the bracing and the siding. |
| **Floor cross-bridging** | **Fixed** — recorded once as "it cannot be fixed". Both floor generators pitched the board's CENTRELINE across the whole joist depth, so all 698 pieces on eight cards stood 0.78 in outside the joists at both ends: a sawtooth along the underside and a corner out the top of the finished floor. |

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

> **Superseded — it was fixed.** "It cannot be fixed" was a statement about a rule, not about the
> geometry, and the rule has a door in it: a compat-lock event, which two later passes went
> through for `roof.ts`. The measurement above also undercounted, by a lot — it is eight cards and
> 698 pieces, not one card and 144. See **A board has width** at the end of this file.

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

## The last of the unguarded enums

A sweep rather than a single target: every remaining string enum a share link can reach, generated
with each legal value and with one nobody wrote, and the signatures compared.

**Ten fields took any string and said nothing.** Nine fell through to whatever their generator's
`else` happened to be — a bunker with an unreadable `entrance` came back with a baffle, a tower
with an unreadable `footing` came back on concrete pads — and the tenth, the tent size, indexed a
doctrine table with it and **threw**: `Cannot read properties of undefined (reading 'value')`. That
is the failure `normalize.ts`'s own header calls the worst of the three — the shell renders, the
spinner never stops, and the page looks like it is working. All ten are repaired and spoken now,
table-driven, because there is nothing to say about any one of them that is not true of all ten.

Two dead fields fell out of the same sweep:

- **`TowerSpec.cab.roofing`** was declared on the spec, written by the preset, and read by nothing.
  Set it to `'roll'` through a link and the cab still came out corrugated, byte for byte. The cab
  is the tower's only roof, so what covers it is `coverings.roofing` — which is what the panel
  writes and what `tower.ts` reads. The second name is gone.
- **`foundation.kind: 'embedded'` on a BUILDING** fell through to a pier foundation, 926 members
  byte-identical to `{kind:'piers'}`, and said nothing. It belongs to the tower and the bunker,
  whose posts are set in the ground. Told now, exactly as a pyramid roof on a building already was.

### A near-miss worth writing down

The first pass of the sweep reported `cab.walls: 'solid'` and `'open'` as producing identical
geometry — a finding, if the union had those values. It does not: it is
`'open-rail' | 'half-wall' | 'half-wall-screen'`, and I had guessed. Both my "values" were unknown
strings falling through to the same default, which is a different fault and the one this pass
actually fixed. **Read the type before reporting what two of its values do.**

### One existing test moved, and why

`every foundation the union really has survives untouched` fed a BUILDING preset every member of
the foundation union including `'embedded'`, and asserted the kind came through unrepaired. That
was true and said nothing about the building being something else. Narrowed to the foundations a
building really has, with the reason written in it.

Five regression tests, four failing on the old code — the fifth is the guard that must pass both
ways: **every shipped card still normalizes with nothing to repair.** A table-driven repair pass is
one typo away from "fixing" a preset.

## The cab roof with nothing under its high side

The guard tower's cab offers two roofs and the sweep had only ever looked at the pyramid.
`cab.roof: 'shed'` is a slope over the same box, and a slope's high edge is a **wall**:

```
tower preset, 8-ft cab, shed roof
  rafters run      y 22.845  →  26.613
  cab posts and screen panels all top out at   23.063
  → 3 ft 6½ in of roof carried on nothing at all
```

The pyramid gets away without a high wall because its four hips lean on each other at a peak, and
this branch was written as if the same were true. The building's own shed roof has framed a pony
wall for it since T2 — and an earlier pass through this sweep had to give that pony wall the plate
it was missing. The cab now gets the same two pieces: posts up the rear corners, and a plate across
them. Using the `capPlate` role means the existing bird's-mouth derivation finds it, so the rafters
seat on it rather than crossing it.

**And there were three rafters** — at the two edges and the middle, 48 in on centre across an 8-ft
cab, on a card whose own `spacing.rafterSpacingIn` says 16. Hardcoding the count is how a spacing
becomes a coincidence.

### Two wrong versions of the same assertion

1. *"The rafter's high end lands on the plate."* It does not, and should not: a shed's rafters run
   past their high wall by the cab's overhang exactly as they run past the low one. The test failed
   at 1.00 ft, which is `TOWER.cabOverhangFt` to the inch. Restated as bearing **at the plate's own
   station**, interpolated along the rafter.
2. Then the plate itself was 4 in high, because I put its top at `eaveY + fall` — the plane's
   height over the **overhang's far edge**, not over the wall. The bearing line at the wall is
   `eaveY + fall·(2·deckHalf + overhang)/(2·half)`.

### And one existing test moved

`timber2-tower-cab` found the cab's stage as *"the last stage a 4x4 post appears in, which is the
only place 4x4 posts and cladding share a stage."* True until a shed cab grew two 4x4 posts that
are roof framing and land in a later stage with no cladding in it. That file is about cladding
against the posts it hangs on, so the cladding picks the stage now.

Three regression tests, two failing on the old code; the third is the guard that the **pyramid cab
is untouched** — no common rafters, four hips, and no high plate it should never have grown.

## The loading platform's steps, which climbed under the deck

The target was the platform on **skids** — a base nobody had rendered, on a different code path
from the building's skid foundation. The runners themselves were fine: three of them on grade with
the posts standing on their tops, no float and nothing buried. What the skid base *exposed* was
somewhere else entirely.

`platform.ts` positioned its entry stair by stating where the flight **departs**:

```ts
base: [L + 1, W / 2], up: [-1, 0]      // foot one guessed foot beyond the deck, climbing back
```

A 4-ft rise wants 4 ft 2 in of run, so the head finished **3 ft 6 in inside the footprint** and the
whole flight climbed under the platform:

```
stair x span 16.25 → 21.33     deck edge x = 20
  each of the 3 stringers   2⅜ in into PF-joist-14, 1½ in into the decking
  2 of the stair's rail posts   1¾ in up through the deck planks
  on skids: AC-stringer-02      1¾ in through FL-skid-02, the middle runner
```

The skid base is what made it visible: a pier base leaves nothing at grade for the descending
stringer to hit, so the same aiming error had been sitting there since T6 showing only as a stair
that dead-ends into the underside of the deck.

`generateStair` has carried `arriveAt` since the tower's stair was fixed — *"a stair is positioned
by where you step off it, not by where its bottom tread happens to fall"* — and the platform simply
never used it. It does now.

### Three things the fix had to get right

1. **The edge is the rim joist's face, not the grid line.** Every framing member on a grid line
   here is *centred* on it, so the end joists stand half a thickness proud of the decking, which is
   cut to `L`. A head landing on the line is sunk ¾ in into the piece it hangs from. A stringer's
   plumb head bears on the **outside face** of the rim, so that is where the flight arrives.
2. **The rail has to open where the stair lands.** It never had to before, because the flight never
   reached the rail — it stopped three and a half feet short of it, underneath. Gating the gap on
   the ramp alone is the tower's old fault ("a stair delivering people into a closed rail") on a
   different family.
3. **And the gap is a post wider on each side than the flight.** The stair brings its own rail and
   its head posts stand on the flight's own edge lines; a gap cut to the bare stair width puts the
   deck rail's terminal post in the same hole as the newel — two 4x4s in one place, 3½ in of solid
   overlap. One post depth of margin lands the two face to face, which is the joint a newel makes.

### Measuring a cut piece

A stair stringer's stock is square at both ends and the sawtooth is taken out of it, so its
oriented box holds a head that was cut off — a face width times the sine of the pitch, **7 in**
here. A box test therefore reports 7 in of stringer inside the deck whatever the generator does.
`stairStringerProfile` is what the scene draws, so it is what the assertions read. The same trap
runs the other way for the raked *rails*: a world box round one spans its whole climb and reported
1.09 in of a rim joist the rail passes two feet above, so those keep the oriented box. Both are
supersets of the real solid, so a positive gap from either is a proof — and only that direction is
claimed.

Six regression tests, all six failing on the old code, and the platform's two card goldens
regenerated in the same commit.

### Measured, not fixed

- **The end posts hang half off the runners.** On a skid base the posts at `x = 0` and `x = L`
  straddle their grid lines, and the runners are cut to exactly `L` — so 1¾ in of each end post's
  3½ in of bearing is off the end of the timber it stands on. A pier base does not have this: the
  16-in pad is centred on the same line and catches the whole post. The runner would have to run
  past the frame by half a post, which is a change to `generateSkids` and therefore to the
  building's skid foundation too.
- **The end joists project ¾ in past the decking**, which is what makes "the deck edge" two
  different planes. The stair now bears on the outer one. Bringing them together means insetting
  the end joists by half a thickness — the whole joist grid moves.

## The tower's legs, driven through their mudsills

`footing: 'timber-mudsill'` is the guard tower's shipped preset, so this is the tower everyone
sees. The family offers two footings and they put their bearing surface in different places:

```
concrete-pad    poured BELOW grade      y -1.000 → 0.000     top IS grade
timber-mudsill  bedded ON the ground    y  0.000 → 0.458     top is a 6x8's thickness up
```

The legs started at `y = 0` either way. Measured on the preset:

```
TW-towerLeg-01 into TW-sill-01 ... 5.86 in
```

— every leg driven through the timber it was supposed to bear on, the tower standing on the earth
between four planks it passed straight through. The render shows the leg continuing past the sill's
top face to the ground plane with the sill spread out around it like something it was hammered into.
It is the same fault, and the same fix, as the loading platform's posts on skids.

### Moving the legs, not the sills

Burying the sill would also stop the leg being inside it, and a mudsill bedded 5½ in under the
earth is not a mudsill. So the legs come up and the sills stay on the ground — which pulls three
more things with it, each of which would have been a new defect on its own:

1. **The bays are divided over the legs' CLIMB**, not over the height above grade. Left alone, the
   bottom bay's girt and both its diagonals still finished at `y = 0`, 5⅞ in below the feet they
   are bolted to. There is a regression test for exactly this half-done state, and it was run
   against it.
2. **The batter is measured over the legs' own climb.** `TOWER.batterPerSideFt` is on the card's
   lock list and is stated as a property of the legs — *"the base is wider than the cab by this
   much per side"* — and the base of a leg is its foot. Measured from grade with the foot 5½ in up,
   the legs would have spread 1 ft 5½ in per side against a locked 1 ft 6 in. The plan footprint is
   unchanged by this: a foot is `batterPerSideFt` outside the cab wherever that foot sits.
3. **The ladder's rake is the legs' rake**, `batter / climb` — and its foot is on the GROUND while
   theirs is on the footing, so its base is set back by the lean it would have picked up over that
   difference. Take the rake off the height above grade and the gap opens with height; skip the
   setback and it closes to 6⅝ in at the bottom, under the 7.2 in this whole block exists to hold.
   It is 7.200 in at every rung on both footings now.

### And a test that had become a copy of the generator

`timber2-tower-ladder` measured its clearance against `cx - (half + batter·(1 − y/h))` — the batter
formula, restated in a second place. It goes stale the moment the datum moves, and it did. It now
interpolates the emitted leg instead, so it measures the frame the generator actually built, and it
runs on both footings.

Six regression tests here, two failing on the old code (the other four are the guards: the sill
still lies on the ground, nothing starts below the leg feet, the locked batter still holds, the
footprint does not move), plus the tower's two card goldens.

### Measured, not fixed

- **The square end cuts.** A leg is raked and cut square to its rake, so the low corner of its foot
  face sits `½·faceWidth·cos(pitch)` = **0.37 in** below the bearing plane. A battered leg's foot
  wants a LEVEL cut, the way a stair stringer's does. The braces are worse for the same reason:
  square-cut on a steeper rake, `TW-towerBrace-01`'s low corner overhangs its own end point by
  **2.19 in**, which now lands inside a mudsill instead of in the dirt. Both want the
  `stringerCuts.ts` treatment — a derived profile, no generator change, no golden moves.
- **The legs are set diamond-wise in plan.** `yaw = atan2(-dz, dx)` aims the member at its lean
  direction, which for a corner leg is the diagonal — and yaw spins the SECTION as well as the
  lean. The 6x6's foot corners come out at (±0.323, ∓0.001) ft, so its 7¾-in diagonal faces along
  the tower's own axes while the girts, at `yaw = 0`, are square to the frame. A girt bolted to a
  leg therefore meets an arris, not a face. Fixing it means giving the leg a two-axis tilt instead
  of yaw-then-pitch, which moves the girt and brace bearings and every tower golden.

## The tent bent, which was a stick diagram

Neither tent family had been rendered. The floor is clean — the runners carry the joists, the joists
carry the deck, nothing floats. The BENTS were a node-and-stick drawing: every member's centreline
ran corner to corner, so at each node all of them occupied the same wood. On the shipped GP Small:

```
rafter into the opposite rafter    1.45 in     at the peak
rafter into the ridge board        0.75 in     the board its nailing note says it is nailed to
collar into the rafter             1.50 in     its whole thickness
collar into the post               0.75 in
rafter into the post               0.66 in     the square foot's corner
```

The house's own roof is the control: `roof.ts` lands its studs and its collar ties on the pieces they
meet at **−0.00 in** — face to face, to the last thousandth — and sets its collar ties one board
thickness off the rafter grid line, *"nailed beside their rafters"*. The tent bent was the outlier.

### The lap is across the face the post presents

Copying `roof.ts`'s one-board-thickness offset gives the wrong number here, and the first attempt
did exactly that. A bent post stands with its **3½-in face** in the bent's plane — `[0, 0, PI/2]`
puts the face width along world X — while the collar runs across the bent and shows its 1½-in edge
there. Face to face is half of each, **2½ in**; at 1½ in the collar was still a quarter of the way
into the post, and the probe missed it because the probe was still selecting the bent by exact x.

### There is no placement of a square-cut rafter head

The head is cut square to the rake, so its low corner reaches half a face width times the sine of
the pitch — **0.82 in** — further along the run than its centreline, and its top corner falls the
same distance short. Land the low corner on the ridge's face and the piece hangs **0.29 in off** the
board; centre it on the face and the low corner is inside both the ridge and its opposite number.
Making the ridge deeper does not help either: the corner is still 0.82 in past the face, just past
more of it. The joint is only placeable once the head is **cut plumb**, which is what a rafter
meeting a ridge actually gets.

So `ridgeHeadProfile` joins `stringerEndProfile` in `stringerCuts.ts` — the head alone, foot left
square, because the level foot that module also cuts lifts a piece by half a face width times the
cosine of the pitch and this rafter's foot is bearing on a post top. With the cut derived, the
centreline runs 0.82 in PAST the ridge face so that the cut lands on it:

```
rafter to ridge   0.0000 in   both sides, both presets — bearing, not biting, not floating
rafter to rafter  clear       the ridge's own thickness between them
collar to post    0.0000 in   face to face
collar to rafter  1.00 in     clear
```

Four regression tests, three failing on the old code; the fourth is the guard that must pass both
ways — **the eave and ridge lines are the doctrine lines**, so every rafter's centreline still
starts on its post's top and still arrives at the tent's own ridge height when produced to it. The
rafters got shorter; the frame did not change shape. Both tent card goldens regenerated.

### Measured, not fixed

- **The rafter's foot, 0.66 in into the post top** (0.69 in on the TEMPER). Square to the rake, like
  the tower's legs and braces — the same family of defect, and the same answer: a derived level cut.
  It is not a one-liner here, because a level foot cut lifts the piece 1.55 in and the post's top is
  `TENT.gpSmall.eaveFt` above the deck, so closing it means deciding whether that doctrine figure is
  the canvas line or the frame's centreline.
- **`endDoor` is a dead field.** `spec.ts` carries it, BOTH tent presets set it `true`, the planning
  card shows a live toggle labelled "Framed end door" (`config.ts`), and **no generator reads it**.
  Toggle it and not one member changes. A GP tent's end wall is framed round a door and there is
  nothing there at all — the recurring class "a field the spec carries and no generator consumes".
- **The ridge is the same size as the rafters.** `roof.ts` cites *"FM 5-426: ridge one size deeper
  than rafters, tops flush"*; the tent's ridge is a 2x4 like everything else in the bent, so the
  plumb-cut heads stand about a fifth of an inch proud above and below the board they bear on.

## The slot over the bunker's doorway

`entrance: 'open'` had never been rendered, and this sweep has carried an unverified note about a
slot along the top of the bunker's entrance wall since the wall was rebuilt. Re-measured, it is
real, it is the same figure in both wall types, and its cause is a member sized out of the wrong
table.

Everything holding this structure up is 6x6 and 6x8 from ATP 3-37.34's dead-load member table. The
header over the doorway came from `LUMBER.headerNominal` — the 2x6 a stud wall puts over a window:

```
                    post-lagging          crib
wall top / jamb top    6.500              6.042
cap beam (6x8)         6.500 → 7.104      6.042 → 6.646
header  (2x6)          6.500 → 6.958      6.042 → 6.500
overhead cover starts  7.104              6.646
                       -------------      -------------
slot over the doorway  1.750 in           1.750 in
```

The cap and the header both start at the wall top and the cap is 1¾ in deeper, so the head of the
doorway finished that far below the line the overhead cover bears on — a slot the full 5-ft width
of the opening, running clean through the end wall into the bunker. And separately: a 2x6 spanning
five feet under a foot and a half of soil is not a header, it is a shim.

The header is the cap continued across the opening, so it is made of the cap stock. Its top lands
on the cap's top and the stringers come down onto a continuous bearing line — **0.000 in** over the
doorway in all four wall-type × entrance combinations, and the piece collides with nothing.

Two regression tests, both failing on the old code, and both stated against the cap beam the model
actually emits rather than against a nominal written in the test — if the dead-load table moves, the
header moves with the piece it is in line with. The crib-bunker card goldens regenerated.

### Also noted

`entrance: 'open'` and `entrance: 'baffle'` differ only by the baffle wall; the jambs, the header
and the doorway itself are common to both and are now checked in both. Nothing else was wrong with
the open entrance.

## Checked clean: the loading platform's panel deck

`deck: 'panel'` had never been rendered. It is right. The nine sheets tile the 20×12 deck with no
gap and no overlap (every sampled point covered, no subfloor-to-subfloor collision); the ramp's six
sheets run their 8-ft length ACROSS the ramp and their 4-ft width up the slope, so the joints land
square across the stringers exactly as the comment claims; and the ramp's surface still arrives at
the deck's own top because `toeY` follows the decking thickness.

Two things were measured and are **below the visual threshold**, and they are in BOTH decking
materials, so they are not a panel-deck defect: the ramp's topmost course overruns the deck's first
board by **0.224 in** on planks and **0.123 in** on sheets (a raked course's up-slope edge crossing
z = 0), and a ramp stringer bites the sill by **0.096 in**. Written down rather than fixed.

## Four posts in four holes: the cab and the deck's guardrail

The next target was `cab.walls: 'open-rail'` — never rendered, and the concrete question was whether
an open cab at 16 ft has anything to stop a fall. It does: the platform's guardrail is there,
railTop and railMid and a toe board. What it also has is the guardrail standing INSIDE the cab.

`railings.ts` has de-duplicated its own posts by position since two edges meeting at a corner were
each found setting one there — *"where two posts land on the same spot, there is one post."* That set
only sees inside the railing pass. The cab's four 4x4 corner posts stand on the deck's own corners
and are emitted by `tower.ts` AFTER the railing runs:

```
RL-railPost-01 into TW-post-01     3.50 in    two 4x4s entirely inside each other,
                                              over 3 ft 8 in of height, at all four corners
railTop / railMid / toeBoard       1.75 in    into the post at each end of each edge
                                              — 28 pairs in all
```

On every cab option, including the shipped one. The doubled corner is visible as a thickened post
in any orbit of the cab.

The fix is not to move the railing off the corner — the corner is where a guardrail post belongs.
It is to tell the railing what the frame has already stood there. `RailingInput.standing` takes the
plan spots and widths of posts that are not the railing's to emit; the pass skips those holes and
lands its rails on the faces of what is standing, which is the joint a rail nailed to a corner post
actually makes. The tower passes its cab corners; the deck now carries two rail posts (the access
gap's ends) instead of six, and every run touches the post it is nailed to at **0.000 in**.

Four regression tests, three failing on the old code. The fourth is the one that matters for blast
radius: **`standing` is opt-in** — a railing told nothing posts its corners and runs its rails
corner to corner exactly as before, which is what the loading platform relies on. Told about one
post, it skips that hole, shortens the two rails meeting there by half its width, and leaves the
other two alone. Only the tower's card goldens moved, which is the same claim from the other side.

## The tower's legs were set diamond-wise

Recorded two iterations ago from the numbers; now rendered, confirmed and fixed. The legs were
yawed onto their lean direction and then pitched up, which puts the AXIS exactly where it belongs
and takes the SECTION with it. A corner leg leans diagonally, so `yaw` came out at 45°:

```
foot corners of a 6x6 leg   (±0.323, ∓0.001) ft     — its 7¾-in DIAGONAL along the tower's axes
plan footprint              7.742 in of x            where the stock's face is 5.5
girt meets the leg at       45.00° off square        and every girt is bolted to a leg
```

On screen it is a post with a line down its middle — the arris facing the camera — and a step where
each girt lands on it. Both are visible at any zoom that shows a bay.

Under YXZ the yaw is the term that spins the section, so the lean has to be done with the other
two. Solving R·(1,0,0) = (dx, climb, dz)/len with **ry = 0** gives one answer:

```
rx = atan2(dz, climb)                  the lean across
rz = atan2(hypot(climb, dz), dx)       the lean along, and the rake
```

which sends local Z to (0, −sin rx, cos rx) and local Y to (−sin rz, …) — both faces square to the
frame, tilted only by the lean itself. With no batter it degenerates to `[0, 0, PI/2]`, a plumb
post. The plan footprint is now 5.475 × 5.525 in on a 5½-in section, the girt runs straight at a
face, and the joints got shallower with it (girt 3.28 → 3.02 in, brace 4.50 → 3.85 in).

The assertions are the CONSEQUENCE, not the arithmetic: the section may be tilted by the leg's own
lean — 5½° here — and by nothing else. Four tests, three failing on the old code; the fourth is the
guard that the rotation changed and the LINE did not, so the tower still stands where it stood.

### Two tests that had become copies of the convention

- `timber2-tower-ladder` computed a leg's axis as `[cos rz·cos ry, sin rz, −cos rz·sin ry]`, which
  is the axis only while rx is zero. It reported the ladder 6.31 in from a leg that had not moved.
  It uses the full YXZ rotation now.
- `timber2-tower-footing` bounded the square foot's dip at `½·faceWidth·cos(rz)`, true while the
  whole lean lived in one angle. Both tilts contribute, and the same claim restated for the frame
  the legs are actually in gives 0.526 in where it used to give 0.361.

### Measured, not fixed

The square foot got **0.165 in deeper** — 0.361 → 0.526 in below the bearing plane — because a
square cut on a doubly-tilted member drops more of its corner. It is the same recorded defect (a
battered leg's foot wants a LEVEL cut, like a stair stringer's), now slightly larger, and it is
still the right trade: the section being square to the frame is a defect you can see from across
the room, and this one is a sixth of an inch under a mudsill.

## The latrine's bench did not close

The latrine had never been rendered in this sweep. Its riser box carries a comment headed *"THE BOX
HAS TO CLOSE"* from an earlier fix that pulled its three parts onto one datum. Two joints in it
still did not.

**THE DIVIDERS RAN INTO THE FRONT BOARD.** Each divider spanned the full depth from the front FACE
to the back, and the front board occupies the first 1½ in of that, so every divider's leading
thickness was inside the board it is nailed to:

```
HT-riserBox-02 + HT-riserBox-03 … 07     1.50 x 15.30 x 1.50 in
                                          five times over on the shipped four-seat bench
```

**AND THE BACK STOPPED SHORT OF THE WALL.** `zBack = widthFt - 0.5` is a guessed half-foot; the
framing's inner face is at `widthFt - wallThickness`, which on this latrine is 7.7083 against the
bench's 7.5000 — a **2½-in slot the whole 10-ft length of the bench**, straight down into the pit,
under a comment that has read *"spanning the full depth from the front board to the wall"* since the
box was written. `BuildingResult.walls` is a `WallsContract` and it has known its own
`thicknessFt` all along.

Both are fixed off the same two lines: the back lands on the wall contract's face, and the dividers
run from the BACK of the front board. The bench keeps its doctrine depth and seat spacing — 2.5 ft
on centre, unchanged — and the seat openings, which are DERIVED from the lid and the dividers,
still land one per bay without touching `riserSeats.ts`.

Three regression tests, two failing on the old code. The third passes both ways on purpose: **it is
still a box** — the lid reaches the front face and the wall, everything under it comes up to the
lid's underside, and everything reaches the floor. That is the guard that closing two joints did not
open a third. The latrine's card goldens regenerated.

## The huts' girts ran through every stud

`generateGirts` serves all six hut variants and had never been measured. `WallSurface.origin` is
the wall's CENTRELINE, and the girt was placed on it with no offset — so a 2x4 girt sat dead in the
middle of a 3½-in wall and passed clean through every stud it crossed, sharing the whole
1½ × 3½ × 1½-in block at each one:

```
sea hut 70    swa hut 78    b-hut 72    squad hut 102    guard shack 27    latrine 40
```

plus every king stud and jack stud at every opening, and the door braces. That the run is
continuous is the POINT of the piece — *"a girt is CUT at an opening on site, and the take-off bills
the stock it is cut from, which is what a runner needs"* — and is not the fault. The fault is the
plane, and the nailing note (`2-16d ea end`) was describing a different piece.

**Inboard**, because that is the side that is clear: the siding is applied outboard of the studs and
the let-in braces are notched into their OUTER face, so a girt put there trades one collision for
two. The nailing note now reads `2-16d ea stud`, which is what a continuous girt gets.

### And the clear run has to be clear of the other walls

A rectangle is framed with one pair of walls running through and the other pair butting between
them, so a through wall's own `runFt` is the whole outside length and its ends are INSIDE the
butting walls. In the stud plane that never showed; moved inboard, where the butting walls are,
each end landed in a corner stud. The girt is now trimmed to the walls it actually runs between.

**And that trim sits on a knife edge** — a butting wall's face lands exactly on the through wall's
end, so the comparison is `x <= x`. Without a tolerance the N wall's rounding fell the other way
from the S wall's, and the b-hut came out with its S girt at 35.417 ft and its N girt at 35.708,
one of the pair still in a corner stud and the other not. The regression test for that is stated as
**opposite walls match**, because a square hut has one girt length and an oblong two, so counting
distinct lengths says nothing.

```
girt-into-stud pairs, after:  sea 0   swa 0   squad 0   guard shack 0   latrine 0   b-hut 6
```

Four tests, three failing on the old code; the fourth is the guard that a girt shifted out of the
wall did not go missing on the way — four walls, doctrine spacing, and outside the wall's own
thickness. Six card goldens regenerated.

### Measured, not fixed

- **The b-hut's 6.** It is the only shipped hut with partitions, and a through-wall girt still
  crosses a partition's end studs where one lands on an exterior wall. Same case as an opening,
  where the girt is cut on site — except that at a partition there IS wood. Closing it means
  splitting the girt at the partition, which is the one thing the billing comment exists to avoid.
- **THE SCREEN BAND'S SILL AND HEAD HAVE THE SAME FAULT AND NEED A DIFFERENT FIX.** They are in the
  stud plane and run the full wall, so they cross every stud too — **46 pairs on one wall of a sea
  hut**, at the same 1½ × 3½ × 1½ in. But a sill and a head are FRAMING, like a window's: they
  belong between the studs, cut to the bay, not nailed across on a face. Next target.
- **The screen panel grazes the studs by 0.03 in** — half its own cloth thickness — because it sits
  on the wall's outer-face plane at z = 0 while the studs start there.
- **The doctrinal alternative for the girt.** A girt is also the siding's NAILER, and that reading
  puts it OUTBOARD with the siding standing off by its thickness — which is how a SEA hut with
  vertical siding is really built. It is a covering-system change across six families, so it is
  written down rather than guessed at.

## The screened band was a ribbon through the studs

The target recorded last iteration. The band's sill and head were emitted as one piece the full run
of the wall, on the wall's CENTRELINE — so each ran clean through every stud it crossed, sharing the
whole 1½ × 3½ × 1½-in block at each one:

```
sea hut 190 pairs      latrine 88 pairs      + 39 × 2¾ × ¾ in out of a door header
```

and the sill ran straight across the doorway at 6 ft, a bar where the door is. The comment on the
band has said *"between the studs"* since it was written and the nailing note has said `2-16d ea
end`, which is a piece with two ends — neither describes a ribbon run past them. **The girt next
door is the opposite case and got the opposite fix**: a girt IS continuous, so it moved onto a face.
A sill is not, so it is cut into the bays.

### Three things had to be true at once, and each was wrong on the first attempt

1. **The band must not frame its own head out of existence.** `WallSurface.cutouts` carries the BAND
   as a cutout with a NEGATIVE `openingIndex`, so the siding is cut away over it. Matching it as an
   opening dropped the whole 7½-ft row on every wall of every screened hut — the screen left with
   nothing along its top.
2. **What is in the way at the head is not "the studs."** The head row runs where the CRIPPLES over
   each opening stand and where the header itself is. A bay list built from studs alone put the band
   through both. The rule now is: anything of this wall that shares the band member's height AND its
   plane is an obstruction, and the piece is cut to what is left between them. (A let-in brace shares
   neither, which is why it is not in the way.)
3. **And those obstructions overlap.** A header spans several bays and contains the king studs, the
   jacks and the cripples over it; walking a sorted list in pairs finds a "gap" between one of them
   and the next INSIDE that header. 14½ in of blocking was framed into a door header before the
   intervals were merged.

```
screenFrame into wall framing, after:   sea hut 0      latrine 0
```

Two existing guardrails caught the rest, which is what they are for: the number-free gate rejected a
bare `/ 24` in the new half-extent helper, and the plausibility gate found **eight 0.25-in pieces**
on a sea hut — slivers where a cripple all but touches a jack stud. Bays under `TOLERANCE.minSliverFt`
are not cut.

Three regression tests, two failing on the old code. The third — nothing framed across a doorway,
nothing left unframed where the wall is solid — passes both ways and says so: a ribbon run the whole
wall covers everything. It is the guard on the fix, that cutting the band into bays did not drop one,
and it is sampled along every wall at both band heights rather than restating the algorithm. Two card
goldens regenerated.

### Measured, not fixed

- **The band's head meets the raking rafters** on the gable walls — 0.63 in of vertical overlap over
  half an inch of length. That is the gable-rake family already in this sweep, and `roof.ts` is frozen.
- **The siding's hole is 1½ in above the frame.** `wallBands` is measured from the sole plate TOP and
  the band's members are placed at absolute height, so the cutout comes out at v[6.13, 7.63] against
  members at 6.00 and 7.50. It shows as the siding lapping the screen by 1.50 in along the bottom.
- **The screen panel's own plane.** It sits on the wall's outer face, so it crosses the let-in braces
  (67 × 18 × 0.06 in — its own thickness) and grazes the studs by 0.03 in. The frame it is stapled to
  is now in the stud plane, 1¾ in behind it.

## The band did not fill the hole cut for it

The target recorded last iteration: *"the siding's hole is 1½ in above the frame."* It is worth
saying what a datum mismatch of one plate thickness looks like from outside the hut, because that is
where it was found — walking the outer skin of the S wall of a sea hut from the sole plate to the
eave and printing what covers each strip:

```
siding y bands:  0.0000..3.6250   0.0000..6.1250   7.6250..8.0000
screen y:                         6.0000..7.5000
```

The siding stops at 6.125 and the screen starts at 6.000, so along the bottom the boards lap 1½ in
over the screen. Along the top the siding does not start again until 7.625 and the screen has ended
at 7.500 — **a 1½-in strip with neither siding nor screen on it**, an open slot right round the
building under the eave. On a sea hut that is 96 running feet of it.

`wallContract` owns this datum and says so in as many words: a band is *"measured from the sole-plate
TOP, like an opening's sill, so callers use one convention"*, and it adds `PLATE_THICK_FT` itself
when it turns the band into the cutout the siding is laid around. `generateScreenBand` placed its own
members at the raw figure, which is the sole-plate BOTTOM. Both readings are defensible in isolation;
only one of them is the contract's.

### Raising it broke the head row a second time

Putting the sill at `plateThicknessFt + sillFt` and CENTRING the head on `sill + heightFt` sent the
head's top face to 7.771 where the top plate's underside is 7.750. An eighth of an inch of
interference — enough that the obstruction pass from last iteration correctly saw a 32-ft plate
lying in the head's way and cut the row out of existence again. There is only 1½ in of wall between
the band and the plate, which is no room for a 3½-in member. The framing belongs INSIDE the light it
frames, so both rows are inset by half a face:

```ts
const heads = [sill + halfFace, sill + band.heightFt - halfFace];
```

which is also how a window is built: the sill sits on the bottom of the opening and the head hangs
under its top, and the glass is the distance between them.

```
after:  screenFrame by height  6.2708:60  7.4792:68      NOTHING rows in the skin walk: 0
        screen 6.1250..7.6250 = the hole exactly         screenFrame into wall framing: 0
```

The `screened` gate moved onto the same datum, so a band that would now be pushed through the top
plate is declined rather than drawn through it.

Two of last iteration's own tests had to be retargeted, having been written against the wrong datum —
they asserted rows at `sillFt` and `sillFt + heightFt`. They now read the hole off
`walls.surfaces[].cutouts` (the contract is the authority for where the hole is) and the rows off the
model, and assert the two agree: the screen spans the hole exactly, no siding laps into it, and every
frame piece lies inside it. Both fail on the pre-iteration generator, quoting the 1.50-in gap.

### Measured, not fixed

- **The 0.38-in rafter graze** on the gable walls. Raised onto its proper datum the head row is
  0.38 in into the raking rafters where they cross the E and W walls, against 0.63 in before. Same
  gable-rake family already in this sweep, same frozen `roof.ts`.
- **The screen panel's plane** is unchanged: it is still on the wall's outer face, 1¾ in in front of
  the frame it is stapled to. Filling the hole exactly is what this iteration was for; which face of
  the wall the cloth hangs on is the covering-plane question the vertical-siding entry already
  raises, and it should be answered once for all the coverings rather than twice.

## The GP framed building, which was fine

The workhorse card — `gp-frame`, 48 × 20 on piers, plywood siding, plywood deck, roll roofing,
gable at 4 in 12 with a 1-ft eave, eight shuttered windows, a ledged door in each end, cross
bridging — and the last shipped family never rendered. **Nothing was wrong with it.** That is the
whole finding, and it is written up at this length because a clean verdict is the easiest thing in
this sweep to get wrong: the loop's failure mode is inventing a defect to justify a commit, and its
second failure mode is a check too blunt to fail.

Six things were suspected off a screenshot and every one of them came back explained:

- **The rake has no overhang.** The deck stops dead at x = 0 and x = 48 while the eaves run 1.086 ft
  past the walls. That is the documented shape, already in this sweep at the hip entry: *a gable is
  flush at its two rakes, a hip overhangs there too.*
- **A white slot over each door.** 0.25 in, top and bottom and both jambs — `OPENING.leafClearanceIn`.
  A door hung in a rough opening has to have it, and it reads as light because the wall behind is
  back-faced.
- **The gable infill looked like 4-ft panels with 16-in steps.** It is 25 strips a foot wide
  stepping 3¼ in; the "steps" were the plywood texture's own 4-ft panel lines.
- **The girder looked unsupported** — its underside is 7¾ in below every pier post's top. The centre
  piers are a different length: posts 15–21 stop at −1.4375, which is exactly the girder's soffit,
  and the edge posts stop at −0.7917, which is exactly the sill's.
- **The roofing floats above the deck** — 0.121 in, which is `TOLERANCE.surfaceLiftFt` (0.01 ft), the
  anti-z-fighting standoff every covering in the toolkit carries.
- **Tan flecks along the eaves in plan.** No geometry under them: the courses lap in sequence
  (each 0.0207 ft = one covering thickness above the one below), the cap spans the ridge gap, and a
  perpendicular walk of every deck panel finds zero uncovered samples.

Also measured and correct: 36 floor-joist bays, every one bridged in both rows and no stray piece
outside a bay; 21 piers, each on its own footing to 0.0000 and each carrying the sill or the girder
to 0.0000; ceiling joists lapped beside their rafters rather than into them; shutter pairs lapping
each opening by the doctrine inch; collar ties landing inside the rafters' own depth.

### Four tests, each with a negative control

The reason this is a commit rather than a line in the table is that "checked, clean" is worth
exactly as much as the sampler behind it, and three of my four first attempts were too blunt to
see anything:

- a skin walk sampled on the wall CENTRELINE, where the siding is not, and reported every station
  on every wall as uncovered;
- an OBB ray 0.004 ft long, which cannot reach a covering that sits 0.104 ft off the deck because
  five courses are stacked under it;
- and a negative control that removed the RIDGE CAP, whose strip is 0.12 in wide — narrower than
  the grid, so the sampler passed the control by failing to see the hole.

So each test now proves itself on the same model, broken on purpose: strip every door and shutter
and the wall walk must find the ten openings; drop one roofing course and the bare band must come
back **inside that course's own footprint**. The rake test needs no control because it is a fit —
least squares over the strip tops on each side of the peak, which must come out at the roof's own
4 in 12 with no strip more than a step off the line. A staircase, a kink, or a rake at the wrong
pitch all fail it.

### Measured, not fixed

- **One let-in brace on each 48-ft wall.** `walls.ts` skips a corner brace where the clear run to
  the first opening is under 3 ft, and the GP building's end windows leave 2.5 ft at one end of the
  S wall and the other end of the N wall. So each long wall is braced at one corner only. The rule
  is documented and `walls.ts` is C-10 frozen legacy; noted here rather than changed.
- **The two end doors are 5 in out of line with each other.** Both are `offsetFt: 8` on their own
  wall, and `u` runs the same rotational sense on all four walls — so on facing walls it runs
  opposite ways. The convention is consistent; it is the preset that is not symmetric.

## The corners, where two skins meet

Found on the storage shed with a **shed roof, purlins and corrugated roofing** — a combination
nothing had rendered. The roof was fine. What the screenshot showed was a thin white line running
down the corner of the building, from just under the eave to about three feet above the floor,
where the two walls' siding meet.

**A wall's skin covers the face it presents to the weather, and on a butting wall that face runs
corner to corner.** `WallSurface.runFt` is the wall's CLEAR STRUCTURAL span: a rectangle is framed
with one pair of walls running through and the other pair butting between them, so the butting
pair's run starts and ends at the through walls' INNER faces. The covering pass tiled exactly that
run. On a 20 × 12 shed the E and W skins therefore ran z 0.2917..11.7083 while the building runs
0..12 — 3½ in short at each end, top to bottom, on all four corners of every shipped building:

```
gp-frame  E/W short 3.50 in / 3.50 in     storage shed  the same     every hut  the same
```

### Why it survived every check there is

**It is not daylight.** The through wall's own corner stud fills the wall's thickness right behind
the strip, so a ray cast along any axis is stopped: 0 clear sight lines through 120 000 stations,
before the fix. What is there is the stud, half an inch back, in a channel between two sheets of
siding — and at a glancing angle that channel reads as a slot with the background at the bottom of
it. Neither the daylight walk added last iteration nor the per-wall skin walk could see it, because
both sampled u ∈ [0, runFt] and the strip is **outside every wall's own run** — it belongs to no
wall by the coordinates each test was using.

And the conservation test said the area was right, because it asked the wrong question. `C-5 on
real walls` asserted, per wall, `siding + openings == runFt × heightFt` — which the tiler satisfies
by construction whatever `runFt` is. It has been restated as the building's own **perimeter**:
`2(L + W) × height`, a figure no set of four clear runs adds up to unless every corner is closed.

### The fix, and the two ways it could have gone wrong

`skinReach` asks, per wall end, whether a perpendicular wall's INNER face lands on this wall's run
end — which is what "this wall butts into that one" means — and if so the skin runs on to that
wall's OUTER face. Through walls get nothing, because their run already is their face.

- **The two skins must MEET, not overlap.** Closing a gap by lapping is not closing it, and an area
  check cannot tell an overlap from a gap of the same size. Perpendicular planes intersect in a
  line, so the pieces touch along the corner arris: 0 cross-wall clashes on all nine shipped
  structures with a skin, before and after.
- **The openings must not move.** Reaching past the run means the tiler's u = 0 is no longer the
  surface's origin, so every cutout shifts with it. Get that wrong by a wall thickness and every
  door and window on the butting walls slides 3½ in along the wall — which no area check would
  notice and no render would obviously show.

The infill above the plate had the same bound and got the same treatment. On a gable end the
corner triangle is under two inches tall and hardly showed; on a **shed's rake wall the corner
strip at the high end is the pony wall's full height**, which is a hole you could put an arm
through. Its profile is read straight through rather than clamped at the run's ends — `topAt`
evaluates the roof plane at whatever world station u lands on, and the roof really does continue
over the corner. Clamping it flat there put a kink in a profile that has none, and a strip
straddling the kink came out cut to the average of two different things (0.0136 sf out on a 45-sf
triangle, and the rake's area is exact again without it).

### A trap in the test, worth writing down

The first version of the corner test rebuilt each hut's wall contract from `f.preset`. That is not
the contract the model was built against: `generateStructure` NORMALIZES before it generates, and
on the guard shack the raw preset and the normalized one disagree about the window sill by 4 in.
The test duly reported siding lapping 24 × 4 in into an opening — a defect that does not exist, in
a place the model is correct. `model.spec` is the normalized spec and is what a test must use.

### Measured, not fixed

- **The corner channel is still 3½ in of stud face, not a corner board.** The siding now runs to
  the arris on both sides, which is how the toolkit's other skins meet; a real building would
  often carry a corner board over the joint. That is a covering-system addition, not a geometry
  fix, and it belongs with the vertical-siding question already in this sweep.

## A single-slope roof has no ridge

Target: the storage shed with a **flat roof, no deck, corrugated roofing** — the last roof kind on
that card nothing had rendered. The roof frames and covers correctly. What is wrong is what happens
at the top of the slope, and it is wrong in two opposite directions at once.

**A ridge is where two slopes meet.** `generateRidgeCaps` capped every plane's top edge, on the
stated grounds that *"a plane's TOP edge is a ridge"*. That is true of a gable, whose other plane
comes up to the same line, and false of a shed or a flat roof, which is ONE plane whose top edge is
the eave over the high wall. Capped anyway:

```
storage shed, flat roof:   cap z 12.500..13.500      roofing ends z 12.978
```

Six inches of a twelve-inch cap, over the building's whole twenty feet, hanging in the air with
nothing under it.

**And the same edge had the opposite problem below it.** The fascia is emitted once per plane at
v = 0 — right for a gable, where each plane has exactly one open edge, and wrong here: a shed's
rafters overhang the pony wall by the same foot as the low eave, with the same square-cut tails
showing, and nothing covered them. So the one edge in the toolkit that carried a cap it should not
have was also the one edge missing the board it should. That is the defect the fascia was added to
fix at the other three edges, surviving at the fourth.

Both now ask one function. `freeTopEdges` counts how many planes come up to each top line — a
shared line is seen twice, a free edge once — and the dedup that already existed in the cap
generator was the answer sitting unused. A free top edge gets a fascia and no cap; a shared one
gets a cap and no fascia. Hips are exempt from the count because a plane's side edges are only
generated where it TAPERS, which is where a neighbour meets it by construction.

```
             caps  fascia            caps  fascia
gable          1      2      shed      0      2   (was 1 and 1)
hip            5      4      flat      0      2   (was 1 and 1)
pyramid        5      4
```

### The claim a test can make about a cap

The first version asserted "roofing under every point of the cap" and failed on the GABLE, at the
ridge line itself — where there is deliberately no roofing, because each course is offset
perpendicular from its own plane and cut at `slopeLengthFt`, so both slopes' sheets pull back from
the line. Spanning that gap is what the cap is for. The claim that is actually true is the one the
cap's own fastener note makes — *nailed on BOTH sides of the joint* — and it is exactly the one a
cap over a free edge cannot satisfy: one side lies on the roofing and the other is over nothing.

The second test is the general form of the missing board: **every rafter end is either continued by
another slope or closed with a fascia.** A gable's upper ends are continued, its lower ends are
closed, a hip's are one or the other everywhere — and a shed's high ends were neither. All three
tests fail on the old generator.

No card ships a shed or a flat roof, so no thumbnail golden moved; both are offered by the storage
shed's and the custom card's roof pickers.

### Measured, not fixed

- **Corrugated over `roofDeck: 'none'`** puts the sheets straight on rafters at 16 in o.c. The
  engine's own span check already says the rest: on this preset it warns that a 2x6 rafter runs
  14.0 ft where the table allows 12 ft at that spacing, and that the fix is a deeper stick, closer
  spacing, or a purlin.
- **A shed and a flat roof have no rake overhang and no barge board**, the same as a gable. That is
  the gable-rake entry already in this sweep, and it is one decision for all three.

## The tent's framed end door, which was a switch wired to nothing

Recorded as measured-not-fixed two passes ago and now closed. `endDoor` has been on
`TentFrameSpec` since the family was written, BOTH shipped tent presets set it `true`, the
planning card offers it as a live toggle labelled *"Framed end door"* — and no generator ever read
it. Turning it off produced a model byte-identical to leaving it on:

```
tent-floor  endDoor=true  105 members      endDoor=false  105 members
```

Fifth of its kind in this sweep, after `fill`, `entrySteps`, `openFront`, `partitions` and
`shutters`: a field the spec carries, the card exposes and nothing consumes, so the knob moves and
the drawing does not.

**What a tent door has to be.** There is no wall here to cut a hole in — a tent frame is a deck and
a rank of bents, and the end is closed by canvas. So the door is FRAMED rather than opened: two
jambs standing on the deck and a head across them, in the END BENT'S OWN PLANE, which is what the
canvas end laces to and what a man walks through. Its size is `OPENING.doorWidthFt` ×
`OPENING.doorHeightFt` — the same 3 ft by 6 ft 8 in rough opening a hut door gets, so a tent door
is not the toolkit's second opinion about what a doorway is.

**Both ends.** The field names no end, a tent frame's two ends are identical, and the toolkit's own
vocabulary pairs them — the sea hut's standard drawing is *"2 end doors"*. Framing one and not the
other would have been an arbitrary choice made silently, which is worse than either answer.

### Two things caught it before the tests did

- **The engine's own span check failed the build.** The first head was cut from the bents' 2x4
  like the jambs, and `timber2-spans` refused the card: *"2× 2x4 header spans 3.3 ft; the table
  allows 3 ft."* It is right — the head spans the opening plus a jamb at each side. It is sized by
  `headerForSpan` now, the same function every other doorway in the toolkit asks, and comes out a
  2x6. A life-safety gate catching a member added ten minutes earlier is the gate working.
- **My own clash probe was wrong first.** An AABB round a bent RAFTER spans its whole lean, and it
  duly reported four collisions between the door frame and rafters that pass eight feet above it.
  On SAT with oriented boxes: zero. The tightest real figure is the collar tie, which crosses the
  doorway at eave height and is lapped beside the bent — it passes the jambs face to face at
  exactly 0.000 in, touching and sharing nothing.

Four tests, all four failing on the old generator, and each states its own precondition so none of
them can pass by finding nothing to check. Both tent cards' thumbnails moved.

### Measured, not fixed

- **A jamb half-overhangs the deck end**, x −0.1458..0.1458 against a deck starting at x = 0. That
  is not the door's doing: the END BENT'S OWN POSTS do exactly the same, because a bent is centred
  on the deck's end line. Matching them is the right call for a frame standing in the bent's plane;
  whether the whole end bent should be held half a post inboard is one decision about the family,
  not about this doorway.

## The bunker's end walls did not reach their own overhead

Target: the crib bunker with **`wallType: 'post-plank'` and `entrance: 'open'`** — the one bunker
combination the five earlier bunker entries never rendered. The open entrance itself is right: the
doorway is clear, the jambs and header frame it, the baffle is correctly absent, and nothing
interpenetrates anywhere in the model. What is wrong is thirty inches above the door head.

*"Caps along the two long walls, carrying the stringers."* As a statement about what CARRIES the
overhead that is exactly right — the stringers span the width and land on those two. But a cap is
not only a bearing: **it is the course that closes the top of a wall**, and with none on the ends
the two end walls stopped 7¼ in short of the roof they hold up:

```
wall lagging tops out  6.5000        stringer soffit  7.1042
5472 clear sight lines straight through the building, all at y 6.51..7.10
```

Five feet four inches of the ten-foot width, at BOTH ends, on both wall types and with either
entrance — an open slot with two feet of earth resting over it.

**The header already said so.** It is emitted as `capNominal` and documented in as many words as
*"the cap continued across the doorway"* — which presupposes a cap on that wall for it to continue.
There was none either side of it: the entrance end was a header hanging between two lengths of
nothing. The fix reads like the sentence that was already there — the end caps butt between the
long ones, exactly as the end walls butt between the long walls, and are interrupted by the doorway
exactly as the wall below them is, with the header as that course's middle piece.

```
after:  5 cap pieces        clear sight lines through the building at cap height: 0
        0 interpenetrations, both wall types, both entrances
```

The 266 rays that survive are not a breach: they run in the 1½-in band directly above the wall
lagging and OUTSIDE the cap, parallel to the wall and blocked inboard by it — a rebate in the
outside face that the earth fills, not a way in.

### Two existing tests said "exactly two caps"

Both had to be restated rather than renumbered, because both were describing the defect. *"The cap
beam is centred on the wall it caps"* asserted `caps.length === 2` and then measured each cap
across z — which only makes sense for a cap lying along x. It now reads the axis off the piece and
checks the same thing on whichever way the cap runs. *"Every stringer bears on both caps"* is now
explicit that it means the two SIDE caps: the end caps close their walls and carry nothing, which
is the point of separating the two jobs a cap does.

One more thing that had to change with them: an end cap lands ON the corner post, meeting its end
exactly rather than overlapping it, so a bearing filter written with strict inequalities found no
wall under the end caps at all. Touching counts.

### Measured, not fixed — the same defect one course higher

Between the stringers, the LONG walls are open by exactly as much:

```
7020 clear sight lines through the building, all at y 7.13..7.69
```

That is the course between the stringers' soffit and the roof lagging — 7¼ in tall, running the
whole 17-ft length of each long wall, open in every bay between one stringer and the next, and
leading straight down into the bunker. Closing it needs BLOCKING between the stringers over each
cap: a piece the toolkit does not have, with no nominal and no citation of its own, which is a
decision about the overhead system rather than a correction to this one. It is the next target.

## Every bay between the stringers was a hole in the wall

The residue the last pass recorded and did not close, and this one is the same defect one course
higher. The stringers cross the side caps and the roof lagging goes over them, so between one
stringer and the next there is a course as deep as a stringer — open at the wall face, and leading
straight down into the bunker:

```
stringer soffit 7.1042    roof lagging 7.7083    7020 sight lines clean through, every bay
```

On screen it is a row of little dark notches all along the top of each long wall with daylight in
them, which is what the first render of this card showed and what nobody had read as a hole.

**The two ends were already closed, and by a rule worth stating**: the outermost stringers sit
flush with the end walls, so there is no bay there to fill. That is why the sight-line walk found
this band only along Z and never along X, and why blocking is a two-wall job. It is asserted as a
measurement rather than assumed, because if the end stringers ever move inboard the ends grow a bay
and this test has to notice.

The blocking is cut from the **stringer's own stock**, so it fills the course exactly however the
dead-load table sizes the stringer for the span — not from the cap's, which happens to be the same
7¼ in on the shipped card and would quietly stop being so on a wider one.

```
after:  post-plank 5 caps + 18 blocks    crib 5 caps + 20 blocks
        clear sight lines through the overhead: 0        interpenetrations: 0
```

A new role, `ohcBlocking`, with its plain name and its what-it-does line — the dictionary test
requires both of every role a shipped card emits, which is the guard that stopped this being a raw
enum on the card.

### Measured, not fixed

- **The wall lagging's top edge is exposed for the height of the cap course.** The cap bears on the
  POSTS and is narrower than the wall, deliberately — *"a cap centred on the whole band would hang
  a plank's width out over the lagging and miss as much of the post it is supposed to bear on"* —
  so the outer 1½ in of the wall has nothing over it for 7¼ in. It is not a way in: the cap blocks
  it inboard along its whole length, and the 266 sight lines that survive run ALONG that groove and
  out the ends rather than into the bunker. What it looks like is a thin open line round the
  building at cap height. The honest fix is to carry the lagging up to the cap's top rather than
  the posts', which is a change to how tall a wall's planking is cut — a decision about the wall,
  not about the cap.

## The attic hatch deleted two ceiling joists

`atticAccess` is wired end to end — the card offers it as "Attic hatch", `BuildingSpec` carries it,
and `roof.ts` frames the opening the way the floor frames a stairwell: doubled trimmers, doubled
headers, tail joists to the headers. It had never been rendered. Shot at the ceiling-joist stage in
plan, the framing is there and it is wrong in one specific way.

**The "absorbed by trimmers" test used half the joist SPACING where it should have used the width of
the wood.** `Math.abs(x - edge) < oc / 2` is eight inches on a 16-in layout, so every ceiling joist
within eight inches of an opening edge was deleted — and nothing took its place, because the
trimmers stay on the opening line; they do not move out to the joist line. On the shipped custom
card that is two joists of fourteen:

```
x = 8.125   outside the opening, 7½ in from its edge, 5¼ in clear of the trimmer — deleted
x = 10.792  INSIDE the opening, where the pattern says a pair of tails — deleted
```

leaving 19¾ and 21½-in bays in a ceiling laid out at 16 in on centre, one of them straight across
the hatch. A trimmer 5¼ in away has absorbed nothing; it is a separate member. The test is now the
width of the wood: each trimmer pair runs 2t outward from its edge and a joist is t wide, so they
share wood only over `(edge − 2½t, edge + ½t)` at the low side and the mirror at the high one.

**Absorption is still allowed, and a second size proves it is real geometry rather than a blanket
rule.** On a 24-ft ceiling the hatch edge falls half an inch off a joist line, and that joist IS
absorbed — correctly, because it would land inside the trimmer. On the 20-ft one the nearest joist
is 5¼ in clear. The test walks both, plus a 32-ft ceiling, and asks the same question of each.

### The compat lock

`roof.ts` is frozen legacy and the goldens were pinning the missing wood, so this is a **compat-lock
event** — the second in this sweep, after the basement stair. The blast radius, measured rather than
asserted:

```
curated fixtures   1 of 13 moves:  demo-braced-attic  325 → 328
                   added   RF-tailJoist-03, RF-tailJoist-04, RF-joist-12
                   removed (none)          moved (none)
matrix rows        36 of 72 — exactly the rows with the hatch on
everything else    byte-identical
```

The change is purely additive: three members restored on the one fixture that has an attic hatch,
none deleted and none moved, and every spec without the hatch is untouched. No frame golden and no
thumbnail moved, because no shipped card has it on by default.

**The existing test was not pinning the bug, but it could not have caught it.** `attic scuttle:
framed opening in the ceiling joists` asked for `tails.length >= 2`, which a scuttle that has lost
half its tails passes. It now asks for a whole number of PAIRS — one each side of the opening for
every joist line that crosses it — and the layout claim itself lives in the new file: no bay in the
ceiling wider than the spacing, and every line through the hatch cut into tails that run to the
headers and stop there.

## The platform's deck was inside its own joists

Target: the loading platform with **`deck: 'panel'`, piers, ramp and steps together** — the one
platform combination the earlier passes took a piece at a time. The ramp, the steps, the rail gaps
and the pier line are all right. The deck is not, in two ways, and the second one only shows if you
walk the surface rather than count the boards.

**THE DECK SITS ON THE JOISTS, AND `deckHeightFt` IS THE SURFACE YOU WALK ON.** Everything under the
deck was hung off `deckY` with the JOISTS' TOPS at it, and then the decking was laid with ITS top
at the same figure — so the boards were buried in the top 1½ in of every joist, over the platform's
whole 20 by 12 ft:

```
plank   joists 3.3958..4.0000   deck 3.8750..4.0000   420 overlapping pairs
panel   joists 3.3958..4.0000   deck 3.9375..4.0000    58
```

The tent frame **in the same file** has it right — it stacks skid + joist + deck and calls the TOP
of that `deckY` — and that is what settles which of the two has to move. `deckHeightFt` is a fall
height to the rail pass (`railRequired(deckY)`) and a landing to the stair pass, so the surface
stays exactly where the operator asked for it and the frame drops by the deck's thickness. The test
asserts both halves, because dropping the frame is only right if the height the card promises did
not drop with it.

**And the last board is ripped to fit.** `Math.min(z, W - w / 2)` clamped the last board's CENTRE
back inside the platform, which does not widen the board — it just stops short. Twelve feet is
26.18 boards, so an inch of deck along the whole 20-ft edge was open, on a thing people walk on with
their hands full. The identical `Math.min` was in the tent floor, an inch short down its 29½-ft
length; `bunker.ts` already had this written up as the wrong answer to the same question, one
family over.

```
after:  0 bare stations of 16000 on both decks and both tent floors
        0 deck-into-frame pairs, 0 boards lapping each other
```

Four tests, all four failing on the old generator. Two platform thumbnails and two tent thumbnails
moved; no compat golden did, because neither family is on the frozen path.

### Measured, not fixed

- **A guardrail post passes through the deck's edge.** Each post runs from 1¾ in below the walking
  surface, so it shares 1¾ × 1½ × 1¾ in with the edge board — 21 pairs on the shipped platform. It
  is the anchoring detail rather than a placement error (the post reaches past the deck to be
  fastened to the frame), but the post is centred ON the deck edge, half in and half out, which is
  the "a member placed ON a face instead of INSIDE it" pattern this sweep keeps finding. It lives in
  `railings.ts` and so belongs to every railed structure, not just this one.
- **The rail heights themselves are exact**, measured from the deck surface after the drop: top rail
  42.00 in, midrail 21.00 in, toe board sitting 0.25 in clear — against EM 385-1-1's 42, 21 and 4.

## A guardrail post stood 1¾ inches under the deck it guards

The residue the platform pass recorded, and it turned out not to be the platform's at all.

**A POST STANDS ON THE SURFACE IT GUARDS AND FINISHES FLUSH WITH THE TOP RAIL.** Both ends were set
by one expression — length `topH + the POST's own face`, centred on `deckY + topH / 2` — and it is
right at the TOP **by coincidence**: a 4x4 and a 2x4 are both 3½ in, so half the post's face happens
to equal half the RAIL's depth, which is what the post must clear to finish flush. The other half of
that same extra went the other way, and put the foot 1¾ in below the walking surface, through the
edge board of every deck, stopping in mid-air — landing on neither the deck nor the frame its own
nailing note says it is bolted to.

**Written once and copied.** `access.ts` frames the stair rails with the identical arithmetic, so a
stair post's foot sat 1¾ in below the nosing line, into the treads, and at the head of a flight into
the deck it lands on. Both now measure the overhang from the RAIL's depth, because that is the piece
the question is about; the coincidence is not a reason to keep asking the wrong one.

```
                     real SAT overlaps on the rail posts        worst
guard tower  before  6 on 2 posts                               2.50 in
             after   2                                          2.00
loading platform before 42 on 15 posts                          2.46 in
             after   2                                          1.09
```

Measured with SAT throughout, because a stair stringer is raked: an AABB round one spans its whole
climb and calls every post on the flight a collision. The box test said 34 pairs where SAT says 42
real ones and a different set — neither number is the other's.

**The rails did not move**, which is the guard on the fix and its own test: top rail 42.00 in over
the deck, midrail 21.00, toe board clear of it, against EM 385-1-1's 42 and 21. Raising a post's
foot is only right if the thing bolted to it stays where doctrine puts it, and a post is easy to
move by changing the wrong end. Four tests; three fail on the old generator and the fourth is that
guard. Four thumbnails moved — the platform's and the tower's — and no compat golden, because
neither family is on the frozen path.

### Measured, not fixed

Two overlaps survive on each structure, and they are a different question — where a post sits **in
plan**, not how far its foot drops:

- **The stair's lowest rail post is coincident with its own stringer**, 1.09 in. The post is at the
  flight's half-width and so is the stringer, and the nailing note says "bolted to the stringer" —
  which means beside it, on its face, not in its plane.
- **The tower cab's rail posts cross a girt**, 2.00 in. Same shape: the rail line and the frame line
  are the same line, and two 3½-in members cannot both be on it.

Both are smaller than they were, and both are about lateral placement — the fix for either is to
decide which side of the frame the rail line belongs on, for every railed structure at once.

## The partition that was a quarter turn out

The roles told me where to look. Thirty of the thirty member roles are named somewhere in this
document; `kingStud`, `jackStud`, `cripple` and `rimJoist` are among the nine that are not, and a
role nobody has written about is a role nobody has looked at. So: SAT on the wall frame of every
shipped card — studs, kings, jacks, cripples, headers, sills and the three plates, every pair.
Thirteen of the fourteen came back clean. The b-hut came back with **15 overlapping pairs, all of
them in its partitions**, and the whole set 1.500 in deep, which is a 2x4's thickness — the tell
for two pieces of wood occupying the same plane rather than merely touching.

**Two slips with one root.** `walls.ts` builds a vertical member with the wall's yaw plus a quarter
turn (`f.yaw + Math.PI / 2`), which is what stands a stud ACROSS the wall: 3½ in of face spanning
the plate's width, 1½ in of edge showing along the run. `partitions.ts` wrote the yaw without the
quarter turn. Every stud, king, jack and cripple in every partition was therefore laid flat IN the
wall — 3½ in along the run, 1½ in across — so a b-hut divider read in plan as a hairline through a
building whose exterior walls, and whose own sole and top plates, are 3½ in thick:

```
                        across the wall   along the run
  E wall stud (walls.ts)      3.50 in         1.50 in
  partition stud              1.50            3.50      <- turned
```

The doorway arithmetic was then written to match the wrong stud, and it is worth being precise
about how, because the numbers look reasonable until you draw them. King and jack were spaced off
`thick` — the WALL's 3½ in — rather than off the stud's 1½. In the b-hut's 36-in doorway, in the
partition's own coordinate along the run:

```
  before   king  12.00 .. 15.50 in     jack  13.75 .. 17.25     opening 15.50 .. 51.50
           header 13.75 .. 53.25       cripples 13.75, 29.75, 45.75
  after    king  12.50 .. 14.00        jack  14.00 .. 15.50     opening 15.50 .. 51.50
           header 14.00 .. 53.00       cripples 18.75, 34.75
```

Read the "before" line: **the king is standing where the jack belongs** — its inner face exactly on
the opening edge — and the jack is straddling that edge, half of it inside the king it is nailed
to and half of it in the doorway, over a sole plate that is cut out from under it. Three
consequences, all of them things a person would see:

- **A 36-in door came out 32½ in clear.** The rough opening is measured between the jacks' inner
  faces and each jack ate 1¾ in of it.
- **The header ran 1¾ in into both kings**, because its length was `width + thick` — the right form
  with the wrong thickness.
- **The first cripple was laid on the jack**, and the last was clamped onto the far one by
  `at(Math.min(u, d1))` — the same clamp that left an inch of the loading platform undecked. A
  cripple inside another piece of wood is not a cripple.

The fix is `walls.ts`'s own layout, which has been right all along: jack on the edge, king outboard
of it and touching, header `width + 2 × studT` so it bears fully on both jacks and butts both
kings, cripples on the wall's own stud layout wherever that layout falls clear inside the opening.
The layout itself is now struck off the stud's thickness too, so a partition's end stud stands
flush against the wall it butts into instead of an inch inside it. The header is **doubled**, as
every other framed opening in the toolkit is: a single on-edge piece was consistent with a 1½-in
partition and would have left 1½ in of header in a 3½-in wall the moment the studs stood up.

```
  partition members overlapping anything in the model (SAT)   21 -> 6
  b-hut member count                                          740 -> 740   (3 cripples out, 3 header pieces in)
```

Five tests in `test/timber2-partition-frame.test.ts`; all five fail on the old generator. One
existing test had to be restated rather than pinned: `timber2-building`'s "four bays need three
dividers" counted DISTINCT x coordinates, which is three walls only while nothing straddles a
centreline — a doubled header does, by ¾ in each way. It now measures each member to the nearest
quarter point of the hut and asserts three lines are used, which is the claim it was making.

Two thumbnails moved, both the b-hut's, and no compat golden: the b-hut is the only card in the
catalog with partitions, so the blast radius is exactly one family.

### Measured, not fixed

- **A partition's end stud stands in the hut's girt**, 3½ × 3½ × 1½ in, twice per partition and six
  times on the b-hut. It is unchanged by this commit and predates it: the stud's foot is at the
  exterior wall's inner face (`z 3.50..5.00 in`) and `HT-girt-01` runs the whole length of the
  building through exactly that space (`z 3.50..5.00`, `y 3.854..4.146`). The girt's own comment
  says it is "CUT at an opening on site" and cut again at each corner; a partition is one more
  place it has to be cut, and that is a change to `hut.ts`'s girt run, not to the partition layout.
- **The gable's rake studs have the same quarter turn**, in `roof.ts`: `RF-stud-01` measures 1.50 in
  across the wall and 3.50 along its run, standing on a cap plate that is 3½ in across, directly
  above E/W wall studs that are 3½ across and 1½ along. Every gable in the catalog does it — 22
  studs on the b-hut, 28 on gp-frame. `roof.ts` is frozen legacy, so turning them is a compat-lock
  event and gets its own pass.

## The gable end, where the wall changed its mind about which way a stud faces

The last pass turned the partition studs and wrote down, as a measured residue, that `roof.ts`'s
gable-end studs have the same quarter turn. This is that. It is a **compat-lock event** — `roof.ts`
is frozen legacy — so it is written up with the blast radius measured rather than asserted.

Render a gable end at the roof-framing stage and the defect reads straight off the picture: below
the cap plate the studs are thin edges, above it they are chunky posts. Same wall, same nominal,
two different pieces of wood. The numbers:

```
                              across the wall   along the run   off the plate's centre
  E wall stud (walls.ts)          3.50 in          1.50 in            0.00
  gable stud  (roof.ts)           1.50             3.50               0.50
```

`walls.ts` builds a vertical member with the wall's yaw PLUS a quarter turn — `f.yaw + Math.PI / 2`
— which is what stands a stud ACROSS a wall. `roof.ts` wrote the quarter turn alone. Everything
else in that eight-line loop was then chosen to suit the turned stud, and each choice is its own
defect:

- **It was set at 1½ stud thicknesses in from the building line**, which is a ROOF coordinate. It
  was picked so a 1½-in stud tucked in BESIDE the end rafter instead of standing under it — and it
  left the stud ½ in off the centre of the cap plate it stands on, and ½ in inside the plane the
  gable's own siding is hung on.
- **It marched in z from the building's OUTSIDE face** (`for (let z = oc; z < W; z += oc)`), while
  the end wall's studs are laid out along the wall's own clear run, which starts one wall thickness
  in. Every gable stud in the toolkit was therefore 3.50 in off the stud below it. Not "most" —
  **186 of 186, on all nine gable cards, with no wall framing under any of them at all.**
- **It stopped at the RAFTER line even at the peak**, where the thing overhead is a 2x8 ridge board
  and not a 2x6 rafter. A stud there ran **1.4525 in into the ridge** — five of the nine cards,
  every one whose half-width lands on the layout, the shipped b-hut among them.

Two things had to be got right for the fix rather than assumed. **Each end wall is laid out from
its own start corner, viewed from outside**, so the E wall's studs march up in z and the W wall's
march down; the clear run is 185 in on a 16-ft hut, which is not a whole number of 16-in bays, so
one shared layout lands on one end and misses the other by 7 in. The layout is struck per end. And
standing the stud on the wall puts it UNDER the end rafter rather than beside it, so its head is
now cut at the rafter's underside beneath its own LOW corner — cut at the centre, half of a 1½-in
stud is above that line and inside the rafter.

`RoofInput` gained an optional `studSpacingIn`, defaulting to `rafterSpacingIn`. The gable studs
continue the WALL's layout and the wall's spacing is a different field; every shipped card sets
both to 16, so leaving it off changes nothing, and `building.ts` now passes the real one.

### The blast radius, measured

Old and new member lists dumped for all 84 compat fixtures and compared by id:

```
  fixtures touched          84 of 84      (every fixture in the set has a gable roof)
  members moved             1836
  members added                2
  members removed              0
  touched members that are NOT an RF- gable stud:  0
```

Nothing else in any model moves — no rafter, no plate, no joist, no covering. The two added members
are both on `shallow-2-12-no-overhang` (306 → 308): the wall's layout puts one more station per end
within reach, and on a 2:12 roof those two studs come out 2.54 in long, which clears the generator's
own 0.2-ft minimum. Every other fixture keeps its exact member count.

**No test was pinning the bug.** The six failures before the goldens were regenerated were four
golden comparisons (`T0/TD12`, `curated goldens`, `full option matrix`, `TD5 emission order`) and
the two thumbnail goldens — all of them the golden mechanism itself, none of them a claim about
gable studs. The one test that mentions rake studs, in `timber2-roofs`, is about the SHED's
`rakeStud` role, which is a different member from a different generator and did not move.

Regenerated in this commit: `test/goldens/frame-compat/` (12 curated + 72 matrix hashes),
`test/goldens/frame/` (17 cases), and 18 thumbnails — the nine gable cards, plain and solid.

Four tests in `test/timber2-gable-studs.test.ts`, all four failing on the old generator:

```
  gable studs with wall framing under them   0 of 186  ->  186 of 186
  gable studs sharing wood with anything     10        ->  0
```

The ridge case is pinned by calling `generateRoof` directly at 199 in of width, because the layout
change means no shipped card puts a stud on the peak any more — the cap is what makes it right for
any width that does, and a test that only exercised the shipped cards would not touch it.

### Measured, not fixed

- **A partition's end stud stands in the hut's girt**, 3½ × 3½ × 1½ in, six times on the b-hut.
  Carried over from the last pass, unchanged: the girt has to be cut at each partition, which is a
  change to `hut.ts`'s girt run.

## The tower's X-braces, which were inside everything they braced

The girt that a partition's end stud runs into was the residue on the list, so the pass started by
running SAT over every `girt` in the catalog against everything else. Four of the five hut girts
came back clean and the b-hut came back with the six known pairs — but the **guard tower's girts
came back with 101**, and a full audit of the tower found 733 overlapping pairs in one structure.
Most of that is roofing courses and panels stacked a tenth of an inch apart, which is how the
covering layers are lifted and is a different question. The frame is not:

```
  towerBrace x towerBrace   40  worst 2.67 in      girt x towerLeg   16  worst 3.02 in
  towerBrace x towerLeg     32        3.85         girt x joist      16        1.50
  towerBrace x girt         48        1.50         girt x girt        8        0.75
```

**A brace is bolted to the FACE of the frame, so it cannot be in it.** Both diagonals of every X
were drawn on the legs' own centre plane, corner centre to corner centre — inside the two legs each
one braces, and, since the pair shared that plane, inside each other at the crossing. The render is
unambiguous: the X in every bay is two sticks fighting for the same pixels down the middle, on all
four faces of every bay of the tower.

Two things had to be right, and the second is the one that matters.

**Standing off the leg is not half its width.** A battered leg is a raked box, so how far its
section reaches from its own axis along a given direction is the support of that box —
`(w/2)(|e_y·n| + |e_z·n|)` over the section axes its own rotation gives it. `legReach` reads it off
the leg's `[rx, 0, rz]`, so the two stay together if the batter ever changes.

**And the board has to LIE FLAT on the face.** The rotation was built from the plan run and the
rise alone, which leaves it on edge in a VERTICAL plane. The face leans with the legs, and the two
diagonals of one X lean opposite ways in plan, so their two vertical planes cross at about 10° —
and no amount of offsetting separates two planes that cross. Offsetting alone got brace-vs-brace
from 2.67 in down to 0.69 and no further, which is what sent me back to the rotation. Built from
the face's own frame — length along the true 3D run, thickness along the face normal — the second
diagonal then stacks on the first at exactly one board thickness. The Euler triple for `R = Ry·Rx·Rz`
with the third column equal to `n` and the first equal to the unit run is
`rx = asin(−n_y)`, `ry = atan2(n_x, n_z)`, `rz = atan2(t_y, b_y)` with `b = n × t`; with no batter
`n` is horizontal and it collapses to the old `[0, yaw, rake]` exactly, which is the check that it
is the same construction generalised rather than a different one.

**Outside, not inside.** Both were tried and measured. Inside the legs is worse in every direction
— 70 pairs against 6 — because the braces of adjacent faces then meet at the inside corners and
cross each other (24 pairs, 4.87 in), and because the girts still run to the leg centres and stick
out into exactly that space.

```
  brace overlaps, by card option        before    after
  shipped preset (ladder, mudsill)        162        6
  concrete-pad footing                    162        8
  stair access                            162       10
  24-ft platform                          241       12
```

Four tests in `test/timber2-tower-brace.test.ts` over those four options; three fail on the old
generator and the fourth is the guard — that a brace still spans its bay corner to corner and lands
on the legs, which is what standing it off the frame could have broken. Two thumbnails moved, the
tower's; no other golden set has a tower in it.

### Measured, not fixed

- **A brace's square-cut LOWER END dips into the footing beside it** — 6 pairs at 1.91 in on the
  mudsill, 8 at 1.90 in on a concrete pad. The board is raked and its end is cut square, so its
  low corner reaches below the corner point it is struck from. Same shape as the stair stringer's
  ends, which were fixed by placing the board off its two real corners rather than its centreline.
- **With `access: 'stair'` the stair well is inside the frame's sweep, and this change makes it
  worse**, which is worth stating plainly rather than burying: stringer 1.87 → 3.46 in, railMid
  1.07 → 2.66, plus a tread at 0.80 and a rail top at 1.03 that did not touch before. The frame
  already swept into the well — the ladder had the same defect and was fixed by raking it at the
  frame's own batter — and pushing the braces out to where they can be bolted moves the frame's
  outer face 4¼ in further into it. The stair needs the ladder's fix: its clearance struck off the
  frame's widest point, not off the deck edge.
- **The tower's girts are still centre to centre**, 16 pairs at 3.02 in into the legs, 8 where two
  girts meet at a corner, and the top one is at deck level and so runs through 16 joists, the deck,
  8 cab posts, the rail posts and the toe boards. That is the platform's bearing line and a bigger
  question than the bracing: a girt at the top of the legs is what the joists should sit ON.

## The tower's girts, and the one holding the platform up ten inches too high

The bracing pass left the girts on the list with their numbers already taken, so this is them.

**A girt is framed BETWEEN the legs.** Every one was cut to the distance between the two leg
CENTRES and centred on that line, so both of its ends were buried in a leg — and the girts of two
adjacent faces, both running to the same corner, were inside each other there as well.

**And the top one carries the platform.** It sat at the leg tops, which is the DECK SURFACE. The
joists hang under that surface, so the girt meant to carry them was a joist's depth plus its own —
ten inches — above where it belongs, and passed through all sixteen joists, the decking over them,
the four cab posts and the railing's posts and toe boards standing on the deck.

```
  girt overlaps, shipped preset          before   after
    towerLeg                             16 / 3.019 in     8 / 0.007 in
    girt (two faces at one corner)        8 / 0.750        0
    joist 16, subfloor 6, post 8,
    railPost 2, toeBoard 5               37                0
                                         61                8

  top girt's top edge vs joist underside     -10.0000 in   ->   0.0000
```

Two corrections on the way, both about a battered frame and both measured rather than guessed.

**The stop is not half a leg's width.** A horizontal girt runs into a RAKED leg, so its direction
has a component along the leg's own length and it leaves through a side face that is tilted to it.
The exit distance is `(w/2) / max(|u·e_y|, |u·e_z|)` — `legFaceAlong`, which is the box's support
again whenever the two are square and larger whenever they are not. Cutting to the support left
0.29 in.

**And a board is cut SQUARE while the gap it fits narrows going up.** The legs splay downward, so
the tightest place on a 5½-in-deep girt is its TOP arris, not its centre; struck at the centre
every girt still bit 0.27 in into both legs along its bottom edge. Struck at the top arris the
residue is 0.007 in — the girt's own corner against a raked prism, a hundredth of an inch on stock
quoted to sixteenths, and the tests bound it at a sixty-fourth.

Four tests in `test/timber2-tower-girt.test.ts` over four card options; three fail on the old
generator and the fourth is the guard — one girt per face per bay, level round the tower, none cut
to nothing — which a change that deleted a girt would otherwise pass by not having one. Two
thumbnails moved, the tower's.

### Measured, not fixed

- **The platform joists only lap the top girt by 0.05 in.** They are cut to the cab plan, which is
  the leg square at the DECK, while the girt sits lower where the legs are already wider — so a
  joist's end kisses the girt's inner arris rather than bearing on it. The joists want to run to
  the girts' far faces, which is the same question as the next one.
- **The two outermost joists still run through the corner legs**, 4 pairs at 2.74 in. They sit on
  the leg lines by construction, so the platform's own framing — how long a joist is and where the
  edge ones go — is the target that follows this.
- **With `access: 'stair'` the girt/stringer clash gets worse**, 2.24 → 6.28 in, because the top
  girt drops ten inches into a stair well that the frame already swept into. That is the same
  pre-existing defect the bracing pass ran into from the other side, and it is now the loudest
  thing on the tower: the stair needs the ladder's fix — clearance struck off the frame's widest
  point rather than off the deck edge.

## The platform that was inside the legs instead of on them

The girt pass left two figures on the list and this is both of them.

**A leg stops under the platform it carries.** Every leg was run to `platformHeightFt`, which is the
DECK's own line, so the top 7¼ in of each one stood in the joists' band. The two outermost joists
sit on the leg lines by construction, so each ran through two corner legs — 4 pairs, 2.74 in a
piece.

**A joist is as long as the thing it bears on.** Cut to the cab plan — the leg square at the DECK —
every joist stopped 0.05 in inside the girt beneath it, because the girts are struck a joist's depth
lower, where the batter has already carried the frame 0.7 in further out. A joist's end kissed the
girt's inner arris instead of sitting on it.

```
  joist x towerLeg                          4 / 2.74 in   ->   0
  a joist's bearing on the girt under it         0.05 in  ->   1.50  (the girt's full thickness)
```

**And the batter had to be re-datumed, which the life-safety register caught before I did.**
`halfAt` measured the batter from the foot to `platformHeightFt`; a leg that now stops a joist below
that only realises part of it. `timber2-tower-footing`'s own test failed with *"the legs batter
1.4417 ft per side; the card locks 1.5"* — a locked LS figure, silently 5/8 in short. `topY` now
moves the top of that span the way `baseY` already moved the bottom for a mudsill; left at the
platform height it is the old formula exactly.

**Trimming the legs' square ends was tried and is wrong, twice over.** A box end is square to its own
AXIS, so on a raked leg the arris stands 0.526 in past the point the axis stops — which is what
clips the outermost joists by 0.149 in now that they run out to the girts. Trimming it back breaks
the batter, because the batter the card locks is measured BETWEEN THE AXIS ENDS: a trimmed leg
comes out at 1.4954 ft per side. And trimming the foot floats the leg 0.55 in over the sill it is
supposed to stand on — which `timber2-tower-footing` also states in so many words, naming the
0.547 in a square cut at this pitch leaves below the bearing plane. The protrusion is a modelling
artifact this file already owns; the new test bounds the joist overlap by it rather than by zero.

One existing test needed restating rather than pinning. The footing suite's *"the platform is still
where the operator asked for it"* guard read the platform's height off the LEGS' HEADS — the same
figure only because the legs ran to the deck surface, which is exactly the defect. It now measures
the platform FRAME's top, which is the claim it was making.

Four tests in `test/timber2-tower-platform.test.ts` over four card options; two fail on the old
generator and two are guards — the locked batter, and the deck's size and height. Two thumbnails
moved, the tower's.

### Measured, not fixed

- **The tower's `platformHeightFt` is the FRAME's top, not the walking surface.** The deck is laid
  ON the joists, so the surface a person stands on is ¾ in above the stated height. That is the
  opposite of the loading platform's convention, which an earlier pass fixed precisely so that
  "`deckHeightFt` IS the surface you walk on". Found while restating the guard above, and left
  alone because moving it moves the railing, the cab and the access with it.
- **The tower stair is still inside the frame's sweep**, and is now the oldest thing on this list:
  girt/stringer 6.28 in, brace/stringer 3.46 in. The well is struck off the deck edge while the
  frame flares out below it. The ladder had exactly this and was fixed by raking it at the frame's
  own batter; the stair needs the same datum and a landing to bridge back to the deck edge.

## The stair that stood inside its own tower

Third time on the "measured, not fixed" list, and the reason it stayed there is that moving the
stair is only half of it. Both halves are here.

**Clear of the FRAME, which is not the deck edge.** The well was struck off the platform's front
edge. A battered tower's base is two feet wider than its deck on every side, so the lowest flight's
foot sat on the deck-edge line at ground level — 23.94 in inside the frame's outermost line — and
the run crossed the front face's bracing on the way down:

```
  stringer x brace 3.46 in    stringer x mudsill 1.19    tread x brace 0.80    railMid x brace 2.66
  the top flight through the platform's own edge girt 6.28 and its rim joist 4.91
```

This is the LADDER's lesson applied to the other way up. That fix reads the frame's own batter curve
rather than the deck edge and holds the clearance at every rung; the stair's datum is now read off
the frame **as built** — the members already emitted — so the batter, the legs' section and the
bracing's standoff cannot drift away from it.

**Two passes, because a switchback is deeper than its arrival.** Every landing runs forward from
where its two flights meet by at least the stair's own width, so on a three-flight run — a 24-ft
tower — the first turn reaches back under the tower even when the arrival is clear: 3.75 in of its
toe board inside the bay-1 girt, which a first attempt shipped without noticing because the probe
filtered on `AC-` and the landing rails carry `ACL1-`. The run is now laid out once, measured
against the frame's widest line, and moved back by whatever still reaches past it.

**And a landing bridges back to the deck**, because a stair that stops short of what it serves is
not one: 3 ft 2 in of it on a 16-ft tower, 5 ft 3 in on a 24-ft one, decked in the stair's own
planks and railed on both open sides by the platform's own pass. It is planked to the platform's
DECKING and not to `platformHeightFt` — that figure is the joists' top, so decking the bridge to it
leaves a ¾-in step at the threshold.

```
  stair members sharing wood with the frame   16 ft: 14 -> 0    24 ft: 18 -> 0
```

Four tests in `test/timber2-tower-stair.test.ts`; all four fail on the old generator. Two existing
tests in `timber2-stair-rail` were restated rather than pinned: both counted every decked level in
the model as a switchback turn, which read three once the tower decked a landing at the top, so
they now take the stair's own landings by id prefix. Two thumbnails moved, the tower's.

### Checked this pass and NOT a defect

**The hip and pyramid roof decks lap each other** — 64 pairs of 72 on the tower's cab, 98 of 164 on
a hip building, worst 1.08 in, while gable, shed and flat are clean. That is not an oversight: it
is the documented `'average'` taper clip, and `tileSurface` carries a long comment weighing it
against `'cover'` — a rectangle cannot be cut on a diagonal, so a hip's deck either overhangs into
the next slope or leaves thin triangular gaps along the hip, and the deck averages while the
roofing covers. The residue is the taper left inside a band once `TOLERANCE.maxTaperBands` caps the
subdivision. Recording it so the next sweep does not re-find it as new.

### Measured, not fixed

- **The tower's `platformHeightFt` is the FRAME's top, not the walking surface** — carried over
  from the platform pass, and the bridge landing had to work around it.

## The rail that ran through every post it was nailed to

Found by taking the SAT audit off the tower and over the whole catalog. Most of what it turns up is
joinery a box cannot express — a rafter notched over its plate is 406 "overlaps" on gp-frame alone,
and a tread let into a stringer is another 114 — but two role pairs are not joinery at all.

**A rail is nailed to a post's face, so the two cannot be on one line.** `railings.ts` already knew
it: `standingHalf` stops a rail on the face of any post the FRAME stands at a span's end, and the
comment says why — *"run to the centreline instead and the rail is half a post deep inside it."*
Its OWN posts, at every interval along every run, were passed straight through. `access.ts` had the
same line copied for a stair's raked rails.

**And two runs meeting at a corner both ran to the corner POINT**, so each was half its own
thickness inside the other — top rail, mid rail and toe board alike, at every corner where the
frame does not already stand a post.

```
  post inside a rail    loading platform 53 / 2.50 in   tower 6 / 1.75   ramp stair 8 / 2.50   -> 0
  rail inside a rail    loading platform 12 / 0.75 in                                          -> 0
```

**The RAIL line is the one that cannot move.** It is the deck edge, the toe board's line, the gap
the access opens, and — since last pass — the line a tower's stair bridge meets. So the POST steps
back off it by half a post and half a rail, which is also where a post belongs: standing on the
deck edge it had half its own foot out over the drop. A CORNER post steps back off BOTH runs,
diagonally; stepping back off only the one that placed it left the other run's three members still
through it, which is 20 of the 53. Which way "back" is gets read off the run itself — the centroid
of the edges in a pass is inside whatever is being railed, whether that is a deck's loop, a
landing's three sides or the two sides of a bridge — so nothing has to be told where the drop is.

Four tests in `test/timber2-rail-joints.test.ts`; two fail on the old generator and two are guards —
that a post still carries a rail rather than standing clear of them all, and that the rails are
still at the 42 and 21 in EM 385-1-1 puts them at. Three existing tests were restated rather than
pinned, all three for the same reason: they located posts by the RAIL's line, which is exactly what
moved. One of them, the platform's newel test, asserted that the stair's head post butts the deck
rail's terminal post face to face; with each stepping back off its own line those two now stand
2½ in apart, and the joint is made by the rails meeting rather than by the posts touching — the
restated assertion bounds the gap by the two setbacks instead of requiring contact. Four thumbnails
moved, the platform's and the tower's.

### Checked this pass and NOT a defect

The catalog-wide audit's biggest numbers are all joinery: `capPlate x rafter` 406 pairs at 1.11 in
is the bird's mouth, `stringer x tread` 114 at 6.95 in is a tread let into its stringer, and
`towerLeg x sill` 4 at 0.53 in is the square end cut this repo already owns and pins. A box member
cannot carry a notch, so the mesh is cut and the member is not. Recorded so the next sweep does not
re-open them.

## Two girts in one corner

The same shape as the rail corners, one module along, and `generateGirts` had already written down
the rule it was breaking: it clips each girt's ends against the perpendicular WALLS' inner faces
and the comment ends *"A girt is cut at the corner."*

The clip is against the wall SLAB, and a girt is not in the wall slab — an earlier pass moved it
INBOARD of the studs by its own thickness, which is further along the crossing wall's run than
that wall's face is. So both girts of every corner reached the same 1½ in square and sat inside
each other there, on all six hut cards:

```
  before   S girt x 3.50..596.50   W girt z 3.50..236.50    both own (3.50..5.00, 3.50..5.00)
  after    S girt x 3.50..596.50   W girt z 5.00..235.00    the butting pair stops on the face

  girt inside a girt, whole catalog    24 -> 0
```

Which of the two gives is read off the geometry rather than off the wall's name: the end a wall's
slab already clipped belongs to a THROUGH wall and stays where it is; the end that needed no clip
belongs to a BUTTING wall — its run starts on the through wall's face — and that is the one that
takes the extra thickness. A rectangle framed with one pair running through is the same convention
the walls themselves use, so the girts now match the studs under them.

Four tests in `test/timber2-hut-girt.test.ts`; two fail on the old generator, and the other two are
the guards that matter more than the fix. **The corner has to stay CLOSED** — trimming both girts
instead of one would pass any "no overlap" check and leave a 1½ in hole with nothing bracing it, so
the joint is asserted to TOUCH. And **the girt is still nailed to the studs, inboard, at the
doctrine spacing** — the plane and the level are what two earlier passes fixed here, and a length
change is exactly the sort of edit that quietly undoes them. Twelve thumbnails moved, all six huts.

### Measured, not fixed

- **A hut girt still runs through a partition's end stud** — 6 pairs at 1.50 in on the b-hut, the
  only card with partitions. Carried over: the girt's own comment says it is cut at an opening and
  at a corner, and a partition is one more place it has to be cut. Both directions of the fix need
  something the modules do not have — `generateGirts` is handed only the wall contract, and
  `partitions.ts` is a building subsystem that knows nothing about a hut's girts.

## Two families, one figure, two answers

Not an overlap — a SIZE. The tower's `platformHeightFt` was the platform FRAME's top, and the
decking was then laid on that, so a tower asked for 16 ft came out with its walking surface at
16 ft 0¾ in. The loading platform had exactly this and an earlier pass fixed it the other way
round — *"`deckHeightFt` IS the surface you walk on"* — so the two families disagreed about what
the one figure an operator types actually means:

```
  tower, asked 16 / 24 / 32 ft      walked at 16.0625 / 24.0625 / 32.0625   ->  16 / 24 / 32
  loading platform, asked 4 ft      walked at 4.0000 all along
```

The frame drops by the decking's thickness and the surface lands where it was asked for. What made
this more than an arithmetic tidy is what else was reading the frame's line as though it were the
deck: **the ladder's landing and the stair's top both took `deckY`**, which is the joists' top, so
the way up delivered you to the frame with the decking ¾ in above it. Those, the cab's base and the
guardrail's datum now all take `walkY`, and `levels.subfloorTop` — which is named for the decking —
reports the decking rather than the joists.

Four tests in `test/timber2-tower-height.test.ts`; one fails on the old generator and three are
guards, which is the right shape for a change like this. Dropping the DECK instead of the frame
would have put the surface right and left it hanging under the joists it is nailed to, so the
decking's thickness and its bearing on the joists are both asserted; everything standing on the
platform is asserted to start AT the surface; and the loading platform is asserted still to mean
the same thing by its own figure, since agreement between the two is the whole point. Two
thumbnails moved, the tower's.

### Checked this pass and NOT a defect

**The tent frame's bents at the ridge** — `bentRafter x ridge` 34 pairs at 1.56 in and
`bentRafter x bentRafter` 17 at 1.50 across the two tent cards. A rafter meeting a ridge board is
cut PLUMB, `ridgeHeadProfile` derives that cut off the piece, and `studio.ts` feeds it to
`cutLumberPiece` — so the mesh is cut and the member's box is not. The generator's own comment
already states the trade and says why there is no placement of a square-cut head that both bears on
the board and stays out of it. Third documented approximation this sweep has re-found; recorded
here with the two before it so a fourth pass does not open it again.

## A ladder of floating sticks

Four passes running, the catalog-wide overlap audit came back with nothing but joinery — the same
bird's mouth, the same let-in tread, the same plumb cut. An audit that keeps re-finding its own
documented approximations has stopped being a measurement, so this pass changed the AXIS: instead
of asking which members are inside each other, ask which members touch **nothing at all**.

```
  members whose SAT gap to every other member is positive, whole catalog     14
  every one of them on the guard tower, every one of them a ladder rung
```

A ladder is one piece of geometry. The rungs climb a line and the two rails ARE that line, moved
half the ladder's width to either side; rake the rungs and the rails have to rake with them.
`generateLadder` learned the rake for the tower — whose legs are battered, so a plumb ladder is a
collision, not a near-miss — and it leaned the rungs one way and the rails the other:

```
  rotation: [0, Math.atan2(facing[0], -facing[1]) - Math.PI / 2, Math.atan2(1, lean)]
```

which reduces to `atan2(facing[1], facing[0])`. That puts the rake ALONG `facing` in X and AGAINST
it in Z, and the tower's ladder faces −Z, so the whole rake was mirrored. The pair crossed once
near mid-height and opened symmetrically from there:

```
  before   rungs reaching neither rail   14 of 16      bottom rung 17.90 in clear, top 13.08
  after    rungs reaching neither rail    0 of 16      let into both, 0.75 in, at every height
```

Solving `R·(1,0,0) = (facing[0]·lean, 1, facing[1]·lean)/rake` for the yaw gives
`atan2(-facing[1], facing[0])` — the rung line's own lean. Plumb takes its own branch, so a wall
ladder comes out byte-for-byte.

This is the kind of defect a still render hides. From the front the rails are behind the rungs;
from the side they are behind the frame; and a ladder of sticks floating in the right places still
reads as a ladder. It took a measurement that asks a different question to see it at all.

**And the second half only appeared once the first was fixed.** The ladder's base was struck off
`legBaseZ`, the leg's own line — but the X-bracing is bolted to the OUTSIDE of the legs, 4¼ in of
it, and the cab's siding hangs past that again. While the rails leaned backwards they leaned AWAY
from all of it and nothing touched; leaning them the right way put 0.34 in of rail into the bottom
bay's diagonals and 1.23 in into the siding. The base now reads the frame's outermost line off the
members ACTUALLY EMITTED — `planReach` over `FRAME_ROLES`, the same datum the stair has used since
its own pass — and the whole ladder stands clear on both footings, tightest 5.58 in.

Four tests in `test/timber2-tower-ladder-rungs.test.ts`, and the split matters: the first two fail
on the old `access.ts` and the third fails on the old `tower.ts` **with the rake already fixed**, so
each half of the change is guarded by the half of the test the other half exposes. The fourth pins
the plumb branch, since `generateLadder` also serves a wall that does not lean. Two thumbnails
moved, the tower's.

```
  members touching nothing, whole catalog (6247 members, 14 cards)     14 -> 0
```

### Checked this pass and NOT a defect

**Siding over a rafter tail** — 469 pairs at 1.25–1.34 in across the nine clad cards, `siding` on
eight of them and `sidingBoard`/`batten` on the storage shed.
It is the bird's mouth again, seen half an inch further out: the notch that seats the rafter on the
cap plate also passes the wall's outer face, and the siding runs up to that face. `cutLumberPiece`
cuts the mesh and the member's box keeps its full section, so the pair reads as an overlap and
renders as a seated rafter. Fourth documented approximation this sweep has re-found; recorded with
the three before it.

## A board has width

The sweep's own record said of floor cross-bridging: *"It cannot be fixed."* That was a statement
about a rule — `floor.ts` is the frozen legacy and `timber2-compat.test.ts` forbids updating a
golden to make a test pass — and the rule has a door in it. Two earlier passes went through it for
`roof.ts`. A compat-lock event is allowed; what is not allowed is going through the door without
being able to say exactly what came out the other side.

**And the original measurement undercounted.** It was recorded against one card. Re-measuring
first, before touching anything:

```
  gp-frame 144   sea-hut 96   swa-hut 96   b-hut 108   squad-hut 152
  guard-shack 12   storage-shed 30   custom 60          = 698 pieces on 8 of 14 cards

  1396 corners   0.780 in below the joist soffit  — a sawtooth the whole length of the underside
   698 pairs     through the SUBFLOOR, the corner passing out the top of the finished floor
  1396 pairs     0.536 in into the joist beside them (0.938 on the squad hut's short bay)
```

A cutaway elevation of the floor band shows it directly: pointed tips above the joist line and a
serrated edge below it, in every bay of every row, on every one of those eight cards.

**The cause is one line, and it is in both floor generators.** `const rise = joistD - inset` pitches
the board's CENTRELINE across the joist depth. A board of face width `d` pitched at `a` stands
`d / cos a` taller than its centreline — 2.5 in of 1x3 at 24.24° is 2.74 in of extra height, half
of it out each end. `floorSystem.ts`, the un-frozen sibling, had the identical line; no shipped
preset reaches its bridging today, so it was a defect waiting rather than a defect showing.

The pitch that fits the BOARD rather than its centreline solves

```
  R + d · hypot(G, R) / G = T          R rise, G clear bay, d board width, T the band it must fit
```

which is a quadratic in `R` whose smaller root is the answer (the other puts `T − R` negative — the
artefact of squaring). `bridgingRise.ts` holds it, one copy, because both generators need it and
one of them must not grow a second. The pieces do not move and do not change in number; they get
shallower and shorter:

```
  1x3 between 2x8 joists at 16 in oc      24.24° -> 15.20°     15.903 in -> 15.026
  corners outside the joists          1396 -> 0
  pairs through the subfloor           698 -> 0
```

**The blast radius, stated exactly**, which is the part a compat-lock event exists to make you do:

```
  34 of 84 frame fixtures touched
  2728 members changed          0 added, 0 removed
  every one of them role `bridging`
  fields that moved             cutLength and rotation, and nothing else
  worst deltas                  0.921 in of length, 9.453° of pitch
```

Nothing else in any model moved — not a joist, not a panel, not an id. Three golden sets
regenerated in the same commit: 17 frame cases, 12 compat fixtures plus 72 hashed matrix rows, and
16 of the 28 thumbnails.

**One test was pinning the old pitch**, and it is worth naming because it was not pinning the bug.
`timber-features.test.ts` asserted `Math.abs(rotation[2]) > 0.3` rad on every cross piece. What the
line means is "diagonal, not flat blocking" — the difference between this branch and the `solid`
one two lines below — and 0.3 rad is a threshold that happened to sit between the buggy 24.24° and
nothing in particular. Correcting the pitch to 15.2° put a correct model under it. Restated as
`!== 0`, plus the claim it was really reaching for: a crossed pair pitches equally, both ways.

Four tests in `test/timber2-bridging.test.ts`; two fail on the old generators. The other two are
the guards. **The boards still REACH both joists** — shortening them until they cleared everything
would pass a "nothing sticks out" check and leave a row of loose sticks bracing nothing — and the
derivation itself is asserted to land ON the band rather than merely inside it, at the bay widths
and board sizes the catalog uses, plus the degenerate cases where no diagonal fits at all.

### Checked this pass and NOT a defect

**The square end of a bridging board.** The old measurement's third line — corners inside the joist
beside them — survives the fix at 0.344 in (0.661 on the squad hut's short bay), down from 0.536
and 0.938. It is the same square-end-on-a-raked-member approximation this repo already owns and
pins for `towerLeg × sill`: a real bridging board is bevel-cut so its end face lies flat on the
joist, a box member's ends are square to its length, and the centreline is placed to BEAR on the
joist rather than to keep its corners out of it. Fifth documented approximation this sweep has
re-found.
