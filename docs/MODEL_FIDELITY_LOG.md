# MODEL FIDELITY LOG

> A record of geometry defects that reached a screen, what caused each one, and which test now
> makes it impossible. Kept separate from `STATE_OF_THE_APP.md` because that document is a dated
> audit snapshot and this one is a running log — the two would fight if merged.
>
> **Why this file exists.** Every defect below was shipped by code that read correctly. None of
> them threw, none of them failed a test, and several had a comment above them explaining the
> wrong thing confidently. They were all found by a person looking at the screen. That is the
> failure mode this log is trying to make cheaper: if the same mistake is about to be made a
> seventh time, the shape of it is written down here.

---

## 1. The member frame, and the mistake that follows from getting it wrong

`src/timber/types.ts` states the convention once:

```
position: member CENTRE in feet
rotation: Euler radians, order 'YXZ'
           length      along local X
           face width  along local Y   (actual.d)
           thickness   along local Z   (actual.w)
```

So **a piece emitted at rotation `[0, 0, 0]` stands ON EDGE** — its face width is vertical. That
is correct for a joist, a rim joist, a ridge, a stud, a wall girt, a cap beam. It is wrong for
everything you walk on or lay down flat, and the flat rotation is `[-PI/2, 0, 0]`.

**THE TELL is always the same, and it is worth learning to spot:** the *position* math around the
emit is written for a flat piece — the loop steps by face width, the height sinks by thickness —
while the *rotation* draws it on edge. The two disagree, nothing validates that they agree, and
the render comes out as a comb of fins with daylight between them.

This exact mistake shipped **six times in five modules**:

| Where | What it looked like |
|---|---|
| `families/platform.ts` — deck planks | a comb of 2x6 fins instead of a deck |
| `families/platform.ts` — deck panels | a 4-ft plywood wall standing on the joists |
| `families/platform.ts` — tent-floor decking | same |
| `families/tower.ts` — platform deck | one 8-ft sheet on edge hanging under the cab (reported as "a random piece of plywood") — and one sheet billed for a deck that takes two |
| `subsystems/access.ts` — treads and landings | a stair with nothing to put a boot on |
| `families/bunker.ts` — roof lagging | a roof with gaps between every board |

Plus two spread-footing variants of the same error (`tower` mudsill, both concrete pads), where a
piece whose whole purpose is to spread load was bearing on its narrow edge.

**Pinned by** `test/timber2-lieflat.test.ts`. The assertion is deliberately NOT "rotation must
equal `[-PI/2,0,0]`" — that is a spelling test and it would fail correctly-sloped ramp decking.
It is the physical claim: **a deck piece's thin dimension points up**, flat or sloped, within 20°
(the steepest doctrine ramp is 1:4 = 14°).

---

## 2. Defects found and fixed in this run

### 2.1 Geometry

**The loading platform's ramp.** Every piece on it carried its own trigonometry and each got a
different sign, so the stringers ran downhill *away* from the platform they served and the planks
tilted against them. Fixed by stating the ramp frame ONCE — `surface(s)`, `upSlope`, `down` — and
placing every piece through it by how far below the walking surface it sits. The ramp also planked
itself regardless of the decking the operator chose.

**Skids carried no posts.** Choosing a skid base emitted three runners lying on the ground and
skipped the posts entirely, so a 4-ft platform hung in mid-air. The two bases differ in what is
*under* the post, not in whether the deck is held up.

**The tower stair** was aimed by picking a plausible-looking base corner and turning a quarter at
each landing. Two flights later it finished four feet past the platform's back corner, at deck
height, over open ground — and the guardrail only opened for a ladder, so a stair delivered people
into a closed rail. A stair is positioned by where you step OFF it: `generateStair` takes
`arriveAt` and translates the whole run to land there. 180° landings keep it two stair-widths wide.

**The cab roof** was four full-width rectangles, one per slope. Four rectangles cannot meet at a
point: they crossed above the hip rafters and hung out past the eaves. A pyramid face is a
TRIANGLE and the tiler already knew how to cut one — `topLengthFt: 0`, the same value a building's
hip ends carry. Routing the cab through the shared covering path also gave it the roofing it had
been specified with all along, which the hand-rolled version dropped entirely.

**Tapered courses.** A course of roofing takes its widest edge so nothing is left bare, and the
overhang past the hip reads as a hip cap. That rule is right, and it is not enough on its own: the
overhang IS the plane's taper over one course height — an inch on a 40-ft building, and FOUR FEET
on an 8-ft cab where a 26-in course spans a 5-ft slope. A tapered row is now cut into as many
pieces up the slope as it takes to hold the error to a cap's width. On a rectangle the taper is
zero and the output is byte-identical.

**No ridge or hip caps existed at all.** Courses are rectangles, so where two slopes meet they are
cut ON the line and their cut edges ARE the roof. The toolkit neither drew a cap nor billed one — a
roof that leaks at every seam, quietly, on paper. Cap lines are derived from the PLANES (a plane's
top edge is a ridge, its slanted sides are hips, a rectangle's vertical sides are a gable rake and
are skipped), so a new roof kind gets its caps for free.

**The bunker's baffle wall** was a single 6x6 rotated so its LENGTH stood vertical: one post alone
in the dirt two feet clear of the structure, a quarter of it underground. **Its entrance header**
bore on nothing, and over a crib bunker — whose ends are open by construction — there was nothing
it could ever have borne on.

**The latrine's riser box** did not close. Three parts, three datums: the front board hung off the
seat height minus half its face width, the lid sat exactly ON it, the dividers were centred at half
of it. The lid floated four inches above its own dividers and eight inches behind its own front
board.

### 2.2 Not geometry

**Every hut built blind.** `spec.openings ?? defaultOpenings(...)` never once fired, because
`normalizeSpec` runs first and turns an absent record into `{}` — which is not nullish. Squad hut,
SWA hut, B-hut, guard shack and latrine all generated with no door and no window while their own
cards promised "windows down both sides". Resolved at normalize now, so the openings editor has
something real to show and an empty record honestly means *none*.

**Selection highlight reached almost nothing.** `tint()` tested
`o.material instanceof MeshToonMaterial`, but a plywood sheet carries an ARRAY of six materials, so
does a roofing course, and insect screen is a `MeshBasicMaterial` because it has to be
see-through. Clicking a panel highlighted zero pixels.

**Duplicate stage-plan keys stamped hip and shed members into "Ceiling joists".** The legacy
building plan spelled its subfloor row `floor` and its ceiling row `roof-frame`, and
`requireOrdinal` — first match, by design — answered with the FIRST one. Every ridge, hip, common
and jack on a hip roof landed at ordinal 7 and the member card printed *"Stage 7 — Ceiling
joists"* under a hip rafter, which is how it was caught. The plan is now built per roof kind
(`stagePlanForBuilding`) with unique keys — `subfloor` and `ceiling` joined the vocabulary — a
shed's plan has no ceiling row at all, and a hip emits real ceiling joists so its ceiling stage
is never an empty stop. Pinned by a uniqueness test over every roof kind.

**Purlins ran full eave length on tapered planes and sat inside the rafters.** `generatePurlins`
never consulted `planeSpanAt`, so on a hip every upper course lanced past the hip lines and hung
over the neighbouring slope; its lift was half its own thickness instead of rafter-half plus
that, so the sticks were also buried in the rafters' top halves; and the roofing counted purlin
thickness as zero, landing flush with the hip rafters' top edges and letting them break through
the metal. One member frame convention (`roofTilePlacement`'s), one clip per course at its
up-slope edge, and purlin thickness in the covering's deck stack fixed all three. Pinned by a
plane-coordinate contract test (offset, both ends inside the span, nothing past the peak).
The adjacent corner: every family that offers purlins also offers a gable, whose frozen branch
lays its own solid deck (C-9) — so gable+purlins double-decked the roof and the bill. The engine
now resolves that combination to the deck a gable actually gets, the panel stops offering
purlins under a gable, and switching a purlin roof to gable carries the consequence into the
spec so the control never displays a value it does not hold.

**The stage scrubber's ghosts were clickable.** three.js raycasters test meshes the renderer is
hiding (`visible === false` is checked in the renderer, not `Raycaster`), so with a build
scrubbed back to the frame stage a tap on a rafter selected the invisible roofing above it and
the card named a piece that was not on screen. `memberAt` now skips hidden hits, so the ray
falls through to what you can actually see — same rule the cutaway already enforced.

---

## 3. The invariants that now hold

| Test | The claim |
|---|---|
| `timber2-lieflat.test.ts` | A deck piece's thin dimension points up. Ramps and skid/panel option combinations included. |
| `timber2-plausible.test.ts` | Every shipped structure, in ~100 option combinations, is a physical object: nothing zero-sized, nothing absurdly large, nothing buried that does not belong below ground, and **nothing floating free with no other member touching it anywhere**. |
| `timber2-thumbs.test.ts` | Both drawings — line art for print, solid for screen — are byte-pinned, deterministic, self-contained and inside a size budget. |
| `timber2-worksheet.test.ts` | Numbered leaders never collide, never print off the page, and never cross. |
| `timber2-number-free.test.ts` | No bare doctrinal magnitude inline in a generator. *(It failed this run's first cut of the hip-cap constants, correctly.)* |
| `timber2-fasteners.test.ts` | No nailing schedule goes uncounted. *(It failed the moment ridge caps shipped with prose no rule could parse, correctly.)* |

**Why the plausibility sweep runs the option MATRIX and not the presets:** every defect above lived
in a branch. The ramp only planked wrong with a panel deck. The posts only vanished with skids. The
header only hung in mid-air with crib walls.

---

## 4. What is still open

- **The `custom` family** is excluded from the plausibility matrix — it is a blank sheet whose
  shape is whatever an operator types, so "every configuration" is not a finite set. The fuzz and
  boundary corpora in `timber2-sweep.test.ts` cover it instead.
- **Interpenetration is not tested.** Nothing asserts that two members do not occupy the same
  space. Bounding boxes overlap legitimately at every joint, so a naive check is all false
  positives; a real one needs oriented-box intersection with a joint allowance.
- **Doctrine is still (PH) throughout.** Every geometry fix above changed what the tool DRAWS, not
  what it CLAIMS. The citations remain pending a manual page check and the packet says so on every
  page.
