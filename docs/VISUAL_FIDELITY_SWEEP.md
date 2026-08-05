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

## Next targets, unchecked

- Continuous-wall foundation; skid foundation (rendered incidentally with the storage shed, not examined).
- Storage shed's wide door header and its jack/king framing at that span (the shed was rendered for its siding; the header was not examined).
- Flat roof at its 1:12 drain slope — the covering path at near-zero pitch.
- Pyramid roof on a building (the tower cab uses it; a building never has been rendered with one).
- Board-and-batten and board siding at the rake (the infill path renders them, unphotographed).
