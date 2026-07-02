# 3D MODELING SPEC — One-Man USMC/Army Fighting Position

**Purpose:** authoritative, asset-by-asset build spec for a 3D model of a single-soldier deliberate fighting position. Every dimension carries its source inline. Where USMC and Army differ, it is called out. Values that came back **low-confidence or got a fact-check flag are NOT baked into the geometry below** — they are quarantined in Section 4. Model those with a visible placeholder note.

**Convention used throughout:** "Army infantry" = FM 21-75 / ATP 3-21.8 lineage. "Army engineer" = FM 5-103 / ATP 3-37.34 survivability. "USMC" = FMST 1208 / RP0502. Where the current survivability manual is joint (ATP 3-37.34 / MCTP 3-34C, Apr 2018), both services share the number.

---

## 1. POSITION ENVELOPE (the hole)

### 1.1 Progression (build these as separate LODs / stages if the model shows construction)
| Stage | Depth | Source |
|---|---|---|
| Hasty (shell scrape / prone / skirmisher's trench) | **~0.5 m (18–20 in) deep** | FM 21-75 Ch.2; ATP 3-21.8 hasty prone ~18 in |
| Hasty → deliberate trigger | dig to **≥ 1½ ft (18 in)** before improving into a parapeted position | FM 5-103 Ch.4 Hasty Positions |
| Deliberate one-man hole | **armpit deep** (max, if soil permits) | FM 21-75 Ch.2; ATP 3-21.8 (2024) "Maximum depth is armpit deep (if soil condition permits)"; FM 23-65 App. D |

### 1.2 One-man hole footprint — CRITICAL, read the caveat
Current Army doctrine deliberately gives **NO numeric one-man length or width.** Model the floor plan as:

> **"only large enough for the Soldier and personal equipment."** — FM 21-75 Ch.2; ATP 3-21.8 (2024)

**Do NOT stamp "two M16 lengths × two bayonets" on the one-man hole.** Fact-check confirmed that figure is the **TWO-man** hole dimension in FM 21-75, mislabeled in the raw research. The one-man position is built the same way as a two-man position, only reduced to one-soldier size (FM 21-75 Ch.2; ATP 3-21.8 para ~5-249). For a concrete floor to actually model, derive it from a shoulder-plus slot (see USMC width below) at armpit depth — and flag any exact L×W number as **model-derived, not doctrinal** (Section 4).

For reference only (this is the **two-man** hole it scales down from):
- Length: two M16A2 rifle lengths (~1.8 m / ~5.8 ft) — FM 21-75 Ch.2
- Width: two bayonet lengths (~0.6 m) — FM 21-75 Ch.2

### 1.3 Army vs USMC depth/width — they diverge in how it's expressed
| | Army infantry | USMC |
|---|---|---|
| Fighting depth | **armpit deep** (qualitative) — FM 21-75, ATP 3-21.8 | **≥ 4 ft deep to the fire step**, or chest-high to the tallest man — USMC FMST 1208 (one-man) / RP0502 (generic deliberate) |
| Width | "width of two bayonets" (two-man figure) | **wide enough for a man's shoulders** — RP0502 |
| Length | not dimensioned for one-man | **long enough to use an entrenching tool** — RP0502 |

**Convergence to model:** a narrow, **shoulder-/two-bayonet-wide** slot, dug **~chest-to-armpit-deep (≈4 ft)** for standing fire. Model the depth as ~4 ft; label the exact width as shoulder-width + working clearance.

> Caveat baked in: the USMC "4 ft / shoulder-width / e-tool length" figures are the **generic** Marine deliberate position (RP0502), primary-verified but **not proven to be a one-man-specific** Marine number. See Section 4.

---

## 2. BUILDABLE ASSETS

### 2.a Single sandbag

| Property | Value | Source |
|---|---|---|
| **Filled/laid dimensions (MODEL THIS)** | **10 in × 15 in × 5 in** (width × length × thickness laid flat) | ATP 3-21.8: "one 75 percent full sandbag [is planned] to be 10 inches by 15 inches by 5 inches" |
| Fill level (combat) | **75% (three-quarters) full** — so bags mold together, no gaps | ATP 3-21.8; ATP 3-37.34 Survivability Ops |
| Fill level (flood — do NOT use for a fighting position) | ½ to ⅔ full | USACE flood guidance |
| Empty/cut bag size | **14 in × 26 in** | USACE St. Paul brochure; MIL-B-52472C, NSN 8105-00-142-9345 |
| Empty-size range (14×26 = standard low end) | 14×26 up to 17×32 in | Wikipedia "Sandbag"; sizes.com |
| Filled weight | 35–40 lb (USACE standard bag = 40 lb) | USACE; Dayton Bag & Burlap |
| Material | woven **polypropylene** (UV-treated, ~3.7 oz/sq yd) modern std, OR hessian/burlap (~8.9 oz) | MIL-B-52472C *(superseded — see note)*; militarysupplyhouse.com |
| Closure | choke cords tied; **bottom corners tucked in after filling** | FM 5-103 p.3-32 |
| Post-fill shaping | **pounded flat with a flat object (e.g. a 2×4)** to shape and stabilize | FM 5-103 p.3-32 |

**Modeling note:** the finished bag is a rounded pillow-block ~10×15×5, NOT a plump sack. The 75%-fill + tamping is *why* it reads as a flat brick, not a bag. Model the tucked-corner, tamped-flat form.

> Spec-currency caveat (bake into asset metadata, not geometry): **MIL-B-52472C is a cancelled/superseded spec** — current procurement is commercial-item spec **A-A-52142** under the same NSN. Physical dimensions unaffected. The 1250-denier / 10×10-weave figures are vendor restatements, not spec-verified.

### 2.b Sandbag WALL — stacking rule (revetment / retaining wall)

All from **FM 5-103 (1985) p.3-32/3-33**, "Sandbagging" — the enduring method, now housed in ATP 3-37.34 / MCTP 3-34C (2018), joint Army+USMC (no service divergence).

**Bond (header/stretcher, like brickwork):**
- **Bottom row = ALL headers** (bags end-out).
- **Body = alternating stretcher and header courses.**
- **Top row = ALL headers.**
- **Vertical joints broken (staggered) between courses** — seams never line up, same as brick bond.

**Batter / slope (a sandbag wall CANNOT stand vertical):**
- **Face batter = 1:4** — the face leans against the earth it retains. FM 5-103 p.3-32.
- **Base cut = 4:1 slope** on firm ground — the whole wall leans into the retained earth. FM 5-103 p.3-32.
- Each course laid so **bedding planes are at right angles to the 1:4 slope** (parallel to the base pitch) — courses **step back**, not laid dead level. FM 5-103 p.3-33.
- **Backfill progressively** behind each course to shape the face to 1:4 — earth and bags rise together. FM 5-103 p.3-33.
- **Per-course step-back is NOT a published inch value** — derive it geometrically from the 1:4 ratio × bag height (5 in). See Section 4.

**Seam / choker orientation (weak seam faces the earth, away from the exposed face):**
- On **stretchers**: side seam faces the **revetted (earth/retained) face**.
- On **headers**: choked (tied) end faces the **revetted (earth) face**.
- FM 5-103 p.3-33: "All bags are placed so that side seams on stretchers and choked ends on headers are turned toward the revetted face."

> **Enemy-relative orientation is UNRESOLVED (Section 4).** FM 5-103 orients the tied end toward the *retained-earth* face of a retaining wall; no fighting-position manual states seam/fold orientation relative to the *enemy* side of a one-man hole. Do not model a confident "choker faces away from enemy" rule.

**Fill options for a self-hardening wall (optional detail):** earth, or dry soil-cement **1:10 cement:earth** (1:6 for sand-gravel), or bags dipped in cement slurry. FM 5-103 p.3-32.

### 2.c Overhead-cover (OHC) stringers/timber + earth cap

Primary: **ATP 3-21.8 (2024) paras 5-238, 5-261–5-264; AFH 10-222 Vol 14; TC 3-21.75 (2013).** These are the standard one/two-person position figures. A one-Soldier OHC is **built identically** to the two-Soldier OHC — same supports, stringers, dustproof layer, 18 in sandbags, waterproof layer (ATP 3-21.8 para 5-249; TC 3-21.75 para 6-24).

**Roof supports (beams the stringers rest on):**
| | Value | Source |
|---|---|---|
| Dimensional lumber | **4 in × 4 in × 6 ft** | ATP 3-21.8 para 5-261; AFH 10-222 para 2.5.1.8.1 |
| Count | **3 total (2 front, 1 rear)** | ATP 3-21.8 para 5-261 *(quote is a COUNT — "2 [in] front and 1 in rear" — not a dimension; fix the OCR artifact)* |
| Round-log alternative | **4–6 in diameter** logs (10–15 cm) | AFH 10-222 para 2.5.1.8.1, Table 2.5 |
| Steel-picket alternative | **6 ea 6-ft U-shaped pickets** (3 front, 3 rear) | ATP 3-21.8 para 5-261 |
| Setback from hole edge | **≥ 1 ft (≈ 1 helmet length) OR ¼ the depth of cut, whichever is greater**; supports embedded ~½ their diameter into ground | ATP 3-21.8 para 5-238 |

**Stringers (roof members spanning the hole):**
| | Value | Source |
|---|---|---|
| Dimensional lumber | **4 in × 4 in × 8 ft** | ATP 3-21.8 para 5-261; AFH 10-222 para 2.5.1.8.2 |
| Count | **9 stringers** (two-Soldier position) | ATP 3-21.8 para 5-261 |
| Spacing | **6 in on center** | ATP 3-21.8 para 5-261; AFH 10-222 |
| Min length + overhang | **≥ 8 ft (2.44 m)**; laid side-by-side; **extend ≥ 1 ft past supports each side** into the parapets | TC 3-21.75 para 6-29; AFH 10-222 para 2.5.1.8.2 |
| Round-log alternative | **4–6 in diameter** | AFH 10-222 |
| Steel-picket alternative | **11 ea 8-ft U-shaped pickets**, spaced **5 in on center, open side down** | ATP 3-21.8 para 5-261 |

**Log↔lumber equivalence table (AFH 10-222 Vol 14 Table 2.3):** 5-in-dia log = 4×4; 7-in = 6×6; 8-in = 6×8; 10-in = 8×8; 11-in = 8×10; 12-in = 10×10; 13-in = 10×12; 14-in = 12×12. *(Table confirmed to EXIST but per-row cells are AFH-reproduced only — treat cells as medium confidence, Section 4.)*

**Stakes to secure logs/supports:** ~**2–3 in diameter, ~18 in long** (or a short U-shaped picket). ATP 3-21.8 para 5-238; AFH 10-222 Table 2.5.

**Layer stack, bottom to top (MODEL IN THIS ORDER):**
1. **Stringers** across supports.
2. **Dustproof layer:** one **4 ft × 4 ft** sheet of **¾-in (or 1-in) plywood**, nailed to stringers, centered over the position. Substitutes: sheeting mat, plastic panel, boxes, interlocked U-shaped pickets. ATP 3-21.8 paras 5-242 & 5-262; TC 3-21.75 para 6-22.
3. **Earth/sandbag burst cap — MINIMUM 18 in (46 cm) of sand-filled sandbags = 4 layers** ("length of an extended entrenching tool"). Layer 1 fully covers the plywood; layers 2–4 form a perimeter; the cavity is filled with soil to reach the 18-in minimum. ATP 3-21.8 paras 5-242 & 5-263; TC 3-21.75.
   - OHC cap sandbag count (two-Soldier): **76 bags.** ATP 3-21.8 para 5-263.
4. **Waterproof layer:** poncho / plastic sheeting over the top so soil/sandbags don't gain moisture and overload the supports. ATP 3-21.8 para 5-264; FM 5-103 p.3-24/3-25.

**Built-up vs built-down height:**
- **Built-up OHC:** up to **18 in above ground.** TC 3-21.75 para 6-18; ATP 3-21.8 para 5-245.
- **Built-down OHC:** **≤ 12 in above ground** (low profile). TC 3-21.75 para 6-23.

**Engineering earth-cover rule (fragment protection floor):** **≥ 1½ ft (18 in) of soil cover always required** for fragment penetration. FM 5-103 p.3-25.

**Worked stringer/soil examples (verbatim-confirmed prose, HIGH confidence):**
- 2×4 stringers over a 4-ft span → **16-in center spacing** supports 1½ ft soil (fragment). FM 5-103 p.3-25.
- 4×4 stringers, 8-ft span, **9-in center spacing**, 2 ft loose gravelly-sand soil → defeats **82-mm contact burst.** FM 5-103 p.3-25.

> **The full span/spacing grids (AFH Table 2.4 — the 82/120/152-mm rows) are Section-4 medium confidence** — the two prose examples above are the only verbatim-verified figures; the grid cells are AFH reproductions of image-tables that didn't extract. Also: **treat 18 in as the single burst-protection minimum everywhere.** The AFH "6–8 in of packed dirt" checklist figure is EXPEDIENT/light concealment cover only — never use it for stated burst protection (Section 4).

### 2.d Parapet / frontal cover + standoff

**Frontal-cover earth thickness (a KNOWN DOCTRINAL RANGE, model as a range — do NOT average):**
| Standard | Thickness | Source |
|---|---|---|
| Army infantry soldier-skills **minimum** | **≥ 46 cm (18 in) of dirt** | FM 21-75 Ch.2; STP 071-326-5703 |
| USMC infantry | **≥ 18 in of dirt** | USMC FMST 1208 (agrees with Army) |
| Army **engineer/survivability** standard | **3 ft (36 in)** to stop small-caliber fire | FM 5-103 Ch.4 *(exact inline quote unconfirmed — Section 4)* |

**Parapet dimensions (current Army, ATP 3-21.8 2024 — via InfantryDrills transcription, MEDIUM confidence, Section 4):**
| | Value | Source |
|---|---|---|
| Parapet thickness (front/flank/rear) | **39 in minimum** (= M4/M7 length stock-extended [~33 in] + 6 in) | ATP 3-21.8 para 5-233 |
| Parapet "bayonet" dimension | **10–12 in** = length of a bayonet — this is a **thickness/width figure, NOT a height** | ATP 3-21.8 para 5-233 *(raw research mislabeled it "height" — corrected here, Section 4)* |
| Front retaining wall | **≥ 10 in high**, ~**2⅓ M4/M7 lengths** long | ATP 3-21.8 para 5-238 |
| Flank retaining wall | **≥ 10 in high**, **1⅓ M4/M7 lengths** long | ATP 3-21.8 para 5-238 |
| Rear retaining wall | **≥ 10 in high**, **1⅓ M4/M7 lengths** long | ATP 3-21.8 para 5-238 |
| Reference rifle | **M4/M7 ≈ 33 in, stock extended** | ATP 3-21.8 |

**Height / function (verbatim, HIGH confidence):** frontal cover **high enough to protect your head when you fire over it.** FM 21-75 Ch.2; FM 7-8 task 071-326-5703.

**Build order (governs where the thickest berm goes):** **frontal cover FIRST**, then spoil to flanks, then rear. FM 21-75 Ch.2; ATP 3-21.8 Stage 3 ("front, flanks, and rear").

**Standoff — two distinct setbacks, DO NOT conflate them:**
1. **OHC-support setback (numeric, doctrinal):** **≥ 1 ft (≈ 1 helmet length) OR ¼ the depth of cut, whichever is greater** — from the edge of the hole to the *beginning of the OHC supports.* ATP 3-21.8 para 5-238. *(This is the OHC-support rule specifically — the raw research over-applied it to the frontal berm; see Section 4.)*
2. **Frontal-berm elbow-shelf standoff (qualitative, NO published number):** leave enough undisturbed-earth shelf between the hole and the frontal cover for elbow rests + sector stakes, so the occupant can fire to the front AND oblique. FM 21-75 Ch.2; USMC FMST 1208 ("elbow rest of original earth next to the fighting hole").

**Design bounds for berm thickness (context, HIGH confidence — FM 3-06.11 Ch.7):**
- 7.62 mm ball into dry loose sand: 5 in @ 25 m, 4.5 in @ 100 m, 7 in @ 200 m.
- Cal .50 (worst case @ 200 m): **14 in of sand OR 28 in of packed earth.**
- 7.62 ball: can't reliably penetrate one well-packed sandbag layer @ 50 m; a double layer defeats 7.62 AP.

> **Do NOT scale up to 8 ft.** FM 5-103's "≥ 8 ft thick at the base" parapet is for **vehicle/crew-served** positions and does **not** apply to a one-man rifle position. FM 5-103 Ch.4.

**USMC parapet numbers:** USMC FMST 1208 describes the parapet **functionally** ("soil placed all around," original-earth elbow rest) and gives the **18-in frontal-cover** figure — but **no numeric USMC parapet thickness/height beyond that** (Section 4). Do not assume the Army 39-in / 10-12-in figures are the USMC values.

### 2.e Grenade sump + floor slope

**Two doctrines — model both as options; they are infantry-drill vs engineer-manual, NOT Army-vs-USMC.**

**Army infantry (ATP 3-21.8 / FM 21-75 / FM 7-8) — TWO E-tool-sized sumps:**
| | Value | Source |
|---|---|---|
| Count | **2 sumps — one at each end of the floor** | ATP 3-21.8 para 5-240 |
| Width | **as wide as the entrenching-tool blade** | ATP 3-21.8 / FM 21-75 |
| Depth | **at least as deep as an entrenching tool** | ATP 3-21.8 para 5-240 |
| Length | **as long as the position floor is wide** (trench-shaped, spans the floor at that end) | FM 21-75 / FM 7-8 |
| Floor slope | **slope floor toward the sumps** — steep enough a grenade rolls in and water drains; **NO degree value published** | ATP 3-21.8 para 5-255; FM 7-8 |

**Army engineer (FM 5-103 Ch.4) — SINGLE front-wall sump (deliberate/larger positions):**
| | Value | Source |
|---|---|---|
| Location | **bottom of the front wall**, where water collects | FM 5-103 Ch.4 p.4-2/4-3 |
| Length | **~3 ft** | FM 5-103 Ch.4 (verbatim-confirmed) |
| Width | **½ ft (6 in)** | FM 5-103 Ch.4 (verbatim-confirmed) |
| Bore angle | **30°** (this is the sump *bore* pitch, NOT the floor slope) | FM 5-103 Ch.4 (verbatim-confirmed) |
| Floor slant | channels water AND grenades into the sump (no degree value) | FM 5-103 Ch.4 |
| Longitudinal drainage slope | **1% desirable** along the floor (separate measurement from the 30° bore) | FM 5-103 Ch.3 p.3-45 |

**Seabee corroboration (MEDIUM):** circular sump, large enough for the largest known enemy grenade, sloped down **30°**, excavated under the fire step. Navy/Seabee tpub Fig 7-5.

**Function (both agree):** grenade rolls/kicks into the sump; sump absorbs most of the blast; remainder vents straight up out of the hole.

> The **E-tool inch conversion (~6–7 in wide, ~9–10 in deep)** is Section-4 LOW confidence — it's equipment-derived, NOT a manual figure. If you model a numeric sump, label it as such.

### 2.f Firing step / elbow rests

**KEY FACT for the model:** there is **NO raised "firing step" with a specified height** in a one-man foxhole. The "firing platform" is the **natural-ground shelf at grade** between the front lip of the hole and the frontal cover. Raised/built-up firing steps belong to trenches and vehicle positions, not the individual hole. ATP 3-21.8 (2024) para 5-247; FM 5-103 Ch.4.

| Element | Spec | Source |
|---|---|---|
| Firing platform | build a platform **in the natural terrain to rest elbows on**, sited so the natural ground surface acts as the grazing-fire platform | ATP 3-21.8 para 5-247; FM 5-103 Ch.4 |
| **Elbow holes** | **dig depressions into the shelf** to keep elbows from shifting when firing — **no dimension published** (sized to the occupant's elbows) | FM 21-75 Ch.2; STP 071-326-5703 |
| Frontal-cover height | **high enough to protect the head** when firing over it | FM 21-75 Ch.2; FM 7-8 |
| **Sector stakes** (R + L) | **tree limbs ~18 in (46 cm) long**, two stakes bracketing the sector of fire | FM 21-75 Ch.2 / FM 5-103; STP 071-326-5703 |
| **Aiming stakes** | **forked tree limbs ~12 in (30 cm) long** (shorter than sector stakes), for night/poor-visibility fire into dangerous approaches | FM 21-75 Ch.2 / FM 5-103; STP 071-326-5703 |
| Firing ports (oblique-fire variant) | dig a **port at each end of the hole** so the ground between ports serves as frontal cover; occupant fires oblique through the ports rather than over the front | FM 7-8 / FM 21-75 Ch.2 |
| Grazing-fire geometry | center of cone of fire **≤ 1 m above ground**; grazing band reaches **up to 600 m** on level/uniform slope (M240/M249) | ATP 3-21.8 App C; FM 21-75 Ch.2 |

**USMC:** converged — same numbers (18-in frontal cover, armpit/4-ft depth, 18-in sector & 12-in aiming stakes, E-tool sumps). No USMC-specific firing-platform/elbow-rest dimension differs from the Army values (joint ATP 3-37.34 / MCTP 3-34C). *(This convergence is inferred, not directly read — Section 4.)*

> If the model needs a numeric **firing-step height**, it must be **derived geometrically** (front-wall height above hole floor = armpit-deep minus head-high frontal cover) and flagged **model-derived, not doctrinal** (Section 4).

### 2.g Revetment — pickets + wire + sheeting, and which soils require it

**When revetment is REQUIRED (the doctrinal trigger):**
- **ATP 3-21.8:** revet in **"unstable soil conditions."**
- **FM 5-103 tiers it:**
  - **FACING revetment** (thin, protects the face from weather/occupation) — used **"when soils are stable enough to sustain their own weight."**
  - **RETAINING-WALL / sandbag revetment** — used **"when the soil is very loose and requires a retaining wall."**
  - **Wall sloping (1:3 to 1:4)** — the temporary substitute **"if the soil is loose and no revetting materials are available."**
- *(The raw research's "trenches deeper than 5 ft revetted in any soil" rule is FABRICATED/mis-cited — that's OSHA 29 CFR 1926, not FM 5-103. See Section 4. Do NOT model a "5 ft = always revet" trigger.)*

**Picket specs (FM 5-103 Ch.3, verbatim-extracted; carried in ATP 3-37.34 2018):**
| | Value | Source |
|---|---|---|
| Max spacing along wall | **~6½ ft (6.5 ft) maximum** between pickets | FM 5-103 Ch.3 |
| Driven depth | **≥ 1½ ft (18 in)** into the position floor | FM 5-103 Ch.3 |
| Min wooden picket diameter | **≥ 3 in** (pickets smaller than 3 in NOT used) | FM 5-103 Ch.3 |
| Preferred picket | **standard steel U-shaped barbed-wire-entanglement pickets** are excellent for revetting | FM 5-103 Ch.3 |
| Infantry position quantity | **3 ea 6-ft U-shaped pickets per front and rear wall**, paired with plywood facing | ATP 3-21.8 para 5-240 |
| Cut-timber alternative | 3 ea 4×4×6 supports + 9 ea 4×4×8 stringers @ 6 in | ATP 3-21.8 para 5-261 |

**Tie-back / anchor + wire:**
| | Value | Source |
|---|---|---|
| Anchor setback behind face | **≥ EQUAL to the height of the revetted face**; alternate anchors **staggered ≥ 2 ft farther back** | FM 5-103 Ch.3 |
| Tie-back method | picket tops tied back to an anchor stake/holdfast driven into the top of the bank; **"several strands of wire"** hold pickets against the walls, straight and taut; a **groove/channel cut in the parapet** passes the wire through | FM 5-103 Ch.3 |
| Wire gauge / exact strand count | **NOT specified** ("several strands") — model as illustrative (Section 4) | FM 5-103 Ch.3 |

**Sheeting / facing options:**
| Type | Spec | Source |
|---|---|---|
| **Plywood facing** | **4 ft × 6 ft** sheets per revetted wall | ATP 3-21.8 para 5-240 |
| Corrugated metal OR plywood | edges/ends lapped to build up height/length; **metal smeared with mud** to cut thermal reflection + aid camo | FM 5-103 Ch.3 |
| Top-of-facing elevation | **set BELOW ground level** (facing revetments do not project above grade); above-grade projection = builder's judgment, no doctrinal number (Section 4) | FM 5-103 Ch.3 |
| Burlap + chicken-wire | built like the metal/plywood revetment but **less strength/durability** — facing (stable soil) only, not retaining loose soil | FM 5-103 Ch.3 |
| **Brushwood hurdle** | woven unit ~**6½ ft long**, as high as the wall; **~1-in-dia brushwood** woven on sharpened pickets driven at **20-in intervals**; tops tied back, ends wired together | FM 5-103 Ch.3 |
| **Continuous brush** | sharpened **3-in-dia pickets** at **30-in intervals**, ~**4 in from the earth face**; space behind packed with small straight horizontal brushwood; tops anchored | FM 5-103 Ch.3 |
| **Pole / board-plank** | as continuous brush but horizontal round poles (or boards/planks, preferred for speed) cut to wall length replace brushwood | FM 5-103 Ch.3 |

**Sandbag retaining-wall revetment geometry** = the wall in **§2.b** (1:4 face, 4:1 base, header/stretcher bond, 75% fill).

**Wall sloping (no-materials alternative):** **1:3 or 1:4** in most soils; dig vertical first, then slope. Facing revetments preferred (less excavation, narrower top opening allows OHC). FM 5-103 Ch.3.

---

## 3. ASSEMBLY ORDER

Model the pieces in this dependency order; each rests on / sets the datum for the next.

1. **Excavate the hole** (§1). Armpit-/chest-deep (~4 ft), narrow shoulder-/two-bayonet-wide slot, floor length = soldier + equipment. Slope the floor toward the sump end(s).
2. **Cut the grenade sump(s)** (§2.e) at the low end(s) of the sloped floor — 2 E-tool sumps (infantry) at the floor ends, OR 1 front-wall sump (engineer) at the base of the front wall.
3. **Leave the firing-platform / elbow-shelf** (§2.f) of **undisturbed original earth** between the front lip and where the frontal cover will go — this is a *cut*, not a build. Dig elbow holes into it.
4. **Revet the walls IF the soil requires it** (§2.g): drive pickets **≥ 18 in into the floor**, **≤ 6½ ft apart**, tie tops back to anchors **≥ face-height behind the face** (alternates ≥ 2 ft farther), run wire through a groove in the parapet lip, set plywood/metal/brush facing with its **top below grade**. In very loose soil, build the sandbag retaining wall instead (§2.b). In stable soil with no materials, slope the walls 1:3–1:4.
5. **Build the parapet from spoil, FRONT FIRST** (§2.d): frontal cover to **18 in–3 ft dirt thickness**, high enough to cover the head; retaining walls **≥ 10 in high**; then flanks, then rear. The frontal berm sits **in front of the elbow-shelf**, far enough forward to leave room for elbow rests + sector stakes (qualitative standoff). Emplace **sector stakes (18 in, R+L)** and **aiming stakes (12 in, forked)** on the shelf.
6. **Set the OHC supports** (§2.c): 3 ea 4×4×6 (2 front, 1 rear), **≥ 1 ft OR ¼-cut setback (whichever greater) back from the hole edge**, embedded ~½ diameter, staked with 2–3-in × 18-in stakes.
7. **Lay the stringers** (§2.c): 9 ea 4×4×8 across the supports, **6 in on center**, **overhanging ≥ 1 ft past the supports each side** into the parapets.
8. **Nail the dustproof layer:** one 4×4-ft ¾–1-in plywood sheet, centered.
9. **Build the burst cap:** **18 in / 4 layers of 75%-full sandbags** (layer 1 covers the plywood, layers 2–4 perimeter, cavity soil-filled to 18 in). ~76 bags for the cap.
10. **Cover with the waterproof layer** (poncho / plastic) over the top of the sandbags/soil.
11. **Set final OHC height:** built-up ≤ 18 in above grade, or built-down ≤ 12 in above grade for a low profile.

**Standoff summary to enforce in the scene:**
- Hole edge → OHC supports: **≥ 1 ft or ¼-cut, whichever greater** (numeric, doctrinal).
- Hole front lip → frontal cover: **qualitative elbow-shelf width** (no doctrinal number — model-derived, flag it).
- Stringer overhang past supports: **≥ 1 ft each side.**
- Anchor stakes behind revetment face: **≥ face height** (alternates **≥ 2 ft** farther back).
- Frontal cover: built **FIRST**, thickest berm (18 in–3 ft).

---

## 4. UNCERTAIN / PLACEHOLDER — DO NOT PRESENT AS AUTHORITATIVE

Render every item below with a **visible placeholder note**; do not imply doctrinal certainty.

**A — Wrong attribution / do not model as stated:**
1. **One-man hole L×W = "two M16 lengths × two bayonets"** — WRONG. That is the **TWO-man** hole (FM 21-75). One-man doctrine gives **no numeric L×W**, only "large enough for the Soldier and equipment." Any exact one-man floor dimension you place is **model-derived, not doctrinal.**
2. **Crater expedient "2–3 ft wide," cited to FM 21-75 Ch.2** — CITATION FABRICATED; no "shell crater" text exists in that chapter. Drop or re-source before modeling.
3. **"Trenches deeper than 5 ft revetted in any soil," cited to FM 5-103** — FABRICATED attribution; that's OSHA 29 CFR 1926, civilian, NOT fortification doctrine. Do not model this trigger.
4. **"One M16 length" frontal-parapet thickness & "armpit deep," cited to FM 23-65** — real quotes but they describe the **MACHINE-GUN (crew-served)** position, not the one-man hole. (Armpit-deep is independently corroborated for the individual position; the "one M16 length" frontal figure is MG-specific.)
5. **ATP 3-21.8 "10–12 in parapet HEIGHT"** — MIS-PARSED. The 10–12 in (bayonet length) is a **thickness/width** figure. Front retaining-wall **height** is the separate **"≥ 10 in high"** (para 5-238). Do not model 10–12 in as a vertical dimension.
6. **"Stagger so a full sandbag backs the seams," cited to ATP 3-21.8** — that phrase is NOT in ATP 3-21.8. The staggered-bond principle is real (FM 5-103), but re-attribute; do not cite ATP 3-21.8. LOW confidence.

**B — Medium confidence (secondary-source / transcription; verify before treating as verbatim-primary):**
7. **All ATP 3-21.8 (2024) numeric parapet/setback figures** — 39-in thickness, 10–12 in bayonet dimension, 2⅓ / 1⅓ M4/M7 retaining-wall lengths, M4=33 in, the 1-ft-or-¼-cut setback — captured from **InfantryDrills.com transcription**; the official ARN13842 / APD PDF didn't load. Re-confirm against the primary before treating as authoritative. (Para numbers also had minor slips: front retaining wall is **5-238 not 5-237**; "built the same way as two-man" is **FM 21-75** wording, not ATP.)
8. **AFH Table 2.3 (log↔lumber) and Table 2.4 (82/120/152-mm span/spacing grids)** — the per-row **cells** are AFH reproductions of image-tables that didn't extract; only the two prose worked-examples (2×4/4-ft/16-in and 82-mm/4×4/9-in/8-ft/2-ft) are verbatim-confirmed. Treat grid cells as MEDIUM.
9. **FM 5-103 "3 ft to stop small-caliber fire" inline quote** — the 3-ft engineer figure is real doctrine but the exact parenthetical sentence wasn't surfaced verbatim this pass. Model the frontal cover as the **range 18 in → 3 ft**; do not average.
10. **USMC "4 ft / shoulder-width / e-tool length"** — primary-verified (RP0502) but it is the **GENERIC** Marine deliberate position, **not proven one-man-specific.** The Army↔USMC "convergence" synthesis compares an Army one-man hole to a generic Marine position.
11. **USMC survivability parity (sump, revetment, firing platform, OHC)** — INFERRED from the joint ATP 3-37.34 / MCTP 3-34C (Apr 2018); the current .mil/DTIC PDF was 403-blocked, so "the 2018 manual reproduces FM 5-103 verbatim" is an inference, not a direct read. Also note the 2018 pub superseded a **2013** edition (ATP 3-37.34 / MCWP 3-17.6) that first replaced FM 5-103 — legacy alias **MCWP 3-17.6**.
12. **FM 5-103 currency** — FM 5-103 (1985) figures (30° sump bore, 6½-ft picket spacing, 1:4 batter, etc.) are verbatim-verified but the manual is **superseded**; not independently confirmed that the successor retains every figure unchanged.
13. **Seabee 30° circular sump** — MEDIUM, secondary corroboration.
14. **USACE flood-stacking numbers** ("base = 3× height," "pyramid above ~3 courses") — flood application, NOT fighting-position doctrine; carried from a secondary pamphlet, not primary-verified. Do not present as fighting-position spec.

**C — Low confidence / no published value (must be model-derived or illustrative):**
15. **E-tool sump inch conversion (~6–7 in wide, ~9–10 in deep)** — equipment-derived estimate, NOT a manual number. Doctrine states only "as wide/deep as the E-tool."
16. **Per-course step-back distance for the 1:4 sandbag batter** — no discrete inch value published; derive from 1:4 × 5-in bag height.
17. **Firing-step height** — no doctrinal number exists (the platform is at grade); any numeric height must be geometrically derived (armpit-depth minus head-high frontal cover).
18. **Frontal-berm-to-hole standoff (elbow-shelf width)** — no numeric value in any manual; qualitative ("fits elbow rests + sector stakes"). The 1-ft/¼-cut number is the **OHC-support** setback specifically, not the frontal-berm standoff — do not reuse it there.
19. **Seam/choker orientation relative to the ENEMY** — unresolved. FM 5-103 orients the tied end toward the *retained-earth* face; no fighting-position manual states enemy-relative orientation for a one-man hole. LOW.
20. **Tie-back wire gauge / exact strand count** — "several strands," no number. Model as illustrative.
21. **Above-grade picket/facing projection** — builder's judgment; FM 5-103 only fixes the facing top **below grade.**
22. **"~10 misc" sandbags in the 116-bag breakdown** — the verbatim figures (116 total / 12 front / 18 flank+rear / 76 OHC) sum to 106; the "~10 misc" is a reconstruction, not source text.
23. **MIL-B-52472C** — cancelled/superseded by **A-A-52142** (same NSN); dimensions unaffected. 1250-denier / 10×10-weave are vendor restatements, not spec-verified.
24. **AFH "6–8 in packed dirt" cap** — EXPEDIENT/light concealment cover ONLY. **Never** use for burst protection; the burst-protection minimum is **18 in (4 sandbag layers)** everywhere.