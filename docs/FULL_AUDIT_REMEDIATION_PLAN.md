# SAP-1 / TIMBER-1 — Full-App Audit & Remediation Plan

> Fable 5 multi-agent audit (226 subagents, adversarial verification, 3 deep-hunt rounds) + live browser pass + project toolchain. **Plan only — no code changed.** Execute in an Opus/Sonnet session.

## How to use

- Findings grouped into **execution phases** by priority. Do Phase 1 first.
- Each finding has a concrete **Fix** and **effort**, produced during adversarial verification against the real code.
- Each was independently re-checked by an agent trying to *refute* it; only survivors listed. 1 reported issue was refuted and dropped.
- Ground truth at audit time: typecheck clean, **179/179 tests pass**, `npm run build` green (3 Vite builds + standalone + offline gate, 12 files, zero external URLs). Latent issues, not current breakage.

## Summary

| Metric | Count |
|---|---|
| Confirmed | 143 |
| Plausible (judgment call) | 12 |
| Refuted/dropped | 1 |

**Severity:** high **17**, medium **62**, low **64**

**Category:** bug 38, ux 36, build 21, data 17, a11y 13, ui 10, perf 6, security 2

| Phase | Scope | Count |
|---|---|---|
| 1 Correctness & deploy-blockers | critical+high | 17 |
| 2 UX/robustness/a11y | medium | 62 |
| 3 Polish | low | 64 |
| Judgment calls | plausible | 12 |

## Consolidation hints (several findings share one root cause — fix once)

The independent finder agents reported overlapping facets of the same underlying defect. Treat each cluster as ONE change:

- **Service worker / offline / deploy caching** — findings **1, 2, 3, 4, 5** (all `public/sw.js`, plus `vite.config.ts` hashless names). One coherent fix: bump the cache name, make navigations network-first, guard cache writes on `res.ok`, and reconcile the precache `CORE` list (or hashed asset names) with what Vite actually emits. Add a `check-offline.ts` assertion so `CORE` can't drift again.
- **Downloaded SVG renders black/invisible** — findings **13, 14, 15** (`src/render/svg.ts` / `drawPlan`/`drawSection` export path). One fix: inline concrete color values (or an embedded `<style>`) into exported standalone SVGs instead of `var(--…)` that only resolves inside the app's DOM. This is the single most user-visible bug — the on-screen drawings look fine (the page defines the vars), but the *downloaded* files are unusable.
- **Doctrine-fill values ignored by the engine** — findings **6, 7** (`src/doctrine` + `src/engine`): the engine snapshots doctrine at module load and never re-reads applied fills; the importer also accepts `0` for divisor leaves. Fix together when touching the doctrine→engine boundary.

**Note:** plausible (judgment-call) items show `effort: ?` because their verdict was *uncertain* — confirm reachability in the code before spending effort on them. The 2 `security` findings (CSV formula injection, dev-server `--host` binding) are both low/medium and live in Phases 2–3, not Phase 1 — this app's real risk surface is correctness and deploy hygiene, not exploitation (it's a single-user offline tool).

---

## Phase 1 — Correctness & deploy-blockers (critical + high)

#### 1. Cache-first SW with unbumped cache version and hashless asset names pins users to the first deploy forever

`public/sw.js:5` · **HIGH** · bug · effort: small

**Problem.** The fetch handler is strictly cache-first with no revalidation (sw.js:25-27), and vite.config.ts emits DETERMINISTIC, HASHLESS asset names (assets/index.js, assets/three-viewer.js, assets/woodframe.js — confirmed in dist/). Once a user's SW runtime-caches assets/index.js, every later deploy serves the stale copy forever: the URL never changes, the cache is never revalidated, and CACHE is still 'sap1-v1' (unchanged in this WIP despite the multi-page restructure). Worse, sw.js itself is byte-identical across deploys, so the browser's SW update check finds no change and the install/activate handlers never re-run; and even if sw.js were edited without a cache-name bump, activate only deletes OTHER caches (sw.js:15) and install's addAll refreshes only CORE, leaving stale runtime-cached JS in 'sap1-v1'. Failure scenario: user visits once, owner pushes a bug fix and republishes on Replit, user reloads any number of times — they still run the old JS with no recovery path short of manually clearing site data.

```
const CACHE = 'sap1-v1';
...
caches.match(e.request).then(
  (hit) =>
    hit || fetch(e.request)
```

**Fix.** Three files. (1) vite.config.ts: delete the custom output block at lines 44-49 (entryFileNames/chunkFileNames/assetFileNames) so Vite emits default hashed names (assets/[name]-[hash].js). The stated reason for stable names — the standalone inliner — is already served by vite.standalone.config.ts → dist-standalone/, which scripts/build-standalone.ts prefers; verify the package.json standalone script runs `vite build -c vite.standalone.config.ts` before scripts/build-standalone.ts, and either drop the dist/ fallback in build-standalone.ts or confirm it parses asset names out of index.html rather than hardcoding assets/index.js (it errors cleanly at line ~20 if index.html is missing, so worst case is a clear failure, not silent breakage). (2) public/sw.js: bump CACHE to 'sap1-v2' (forces a byte change so all existing pinned users update and activate purges sap1-v1), and make navigations network-first: in the fetch handler, if e.request.mode === 'navigate' (or destination === 'document'), do fetch-then-cache with catch → caches.match(e.request) → caches.match('./index.html'); keep cache-first for everything else, which becomes safe once assets are content-hashed. Preserve: same-origin-only guard, GET-only guard, offline fallback to './index.html', plain-JS-in-public/ shipping, and skipWaiting/clients.claim. (3) Offline gate (§2.3): confirm the gate scans still pass — hashed filenames introduce no external URLs, and the stripVendorCitationUrls plugin is unaffected. Edge cases: file:// standalone never registers the SW (main.ts guard) so it is untouched; old hashed assets slowly accumulate in the runtime cache across deploys — acceptable, or optionally inject a build id into CACHE at build time (small Vite closeBundle plugin rewriting a __BUILD__ token in dist/sw.js) so activate purges per deploy. Verify with: npm run build, inspect dist/assets for hashed names, serve dist/, load twice, redeploy a changed build, confirm reload picks up new JS (DevTools → Application → SW shows new worker activating).

#### 2. Fetch handler caches non-OK responses (404/500) permanently

`public/sw.js:31` · **HIGH** · bug · effort: trivial

**Problem.** The runtime-caching path stores every same-origin GET response without checking res.ok. Combined with cache-first and no revalidation, one bad response is poisoned into the cache forever. Concrete scenario on the actual deploy stack: Replit autoscale runs scripts/serve.js against dist/ while `npm run build` rebuilds with emptyOutDir:true — during that window serve.js returns 404 'Not found' (serve.js:58) or 500 (serve.js:65) for assets/three-viewer.js; the SW caches that 404 body under the asset URL and serves it on every subsequent load. Because filenames are hashless (see vite.config.ts:46-48), the poisoned URL never rotates — the 3D viewer (or the whole app if index.js is hit) is permanently broken for that user until they manually clear storage.

```
.then((res) => {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined);
  return res;
})
```

**Fix.** File: /Users/zacharytraphagen/FieldFortificationsCalculator/public/sw.js. (1) In the fetch handler (lines 28-33), guard the cache write with res.ok: `.then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => undefined); } return res; })` — always return res to the page whether or not it was cached. (2) Bump `const CACHE = 'sap1-v1'` to 'sap1-v2' so the existing activate handler (which deletes all non-matching cache names) purges already-poisoned caches for users in the field; without the bump, the fix does not heal existing victims. Edge cases to preserve: keep the same-origin and GET-only guards (sw.js:21-23); keep the `.catch(() => caches.match('./index.html'))` offline navigation fallback (it does not cache, so it needs no change); the install-time `addAll(CORE)` already rejects on non-OK and needs no change. No other files involved — vite copies public/sw.js verbatim to dist/. Verification: after `npm run build`, confirm dist/sw.js contains the res.ok guard and the new cache name (the build's check:offline gate already scans dist).

#### 3. Hashless chunk names + cache-first SW with fixed cache name pins users to stale code and causes chunk version-skew

`public/sw.js:25` · **HIGH** · bug · effort: small

**Problem.** The SW serves every same-origin GET cache-first from a never-versioned cache ('sap1-v1'), and vite.config.ts deliberately emits hashless deterministic filenames (assets/index.js, assets/three-viewer.js, assets/woodframe.js). Once a returning user has assets cached, a redeploy never reaches them: the URL is identical, caches.match hits, fetch never happens, and the activate handler only deletes caches whose NAME differs (it never changed). Worse, the multi-page build shares chunks: a user who previously visited index.html has assets/three-viewer.js cached; after a redeploy they open woodframe.html for the first time — woodframe.html and assets/woodframe.js are fetched fresh (new version) but the shared ./assets/three-viewer.js import is served from the stale cache, mixing two build versions in one page (broken/missing exports, e.g. the WIP diff that adds paletteFor/soil params to three-viewer would throw at import time). The sw.js cache version string was not bumped despite the uncommitted multi-page restructure.

```
const CACHE = 'sap1-v1';            // sw.js:5
caches.match(e.request).then((hit) => hit || fetch(e.request) ...   // sw.js:25-28
// vite.config.ts:46-48
entryFileNames: 'assets/[name].js',
chunkFileNames: 'assets/[name].js',
```

**Fix.** Two-part fix, both in-repo, no new dependencies.

(1) Immediate stopgap, same commit as the multi-page migration: bump public/sw.js:5 to 'sap1-v2' so already-deployed users' caches are purged on next visit (activate handler already deletes non-matching cache names, and skipWaiting+clients.claim make it take effect promptly).

(2) Durable fix — inject a build id into the cache name at build time so this never needs manual bumping again:
- public/sw.js: change line 5 to derive from a placeholder, e.g. const CACHE = 'sap1-__BUILD_ID__'; keep a fallback so the file still works if served unprocessed (e.g. dev server serves public/ verbatim — the literal placeholder string is a valid, stable cache name in dev, which is fine).
- vite.config.ts: add a ~15-line plugin (next to stripVendorCitationUrls) with a writeBundle/closeBundle hook that reads dist/sw.js and replaces __BUILD_ID__ with a short deterministic hash (node:crypto sha256 over the concatenated emitted chunk code collected in generateBundle, sliced to 8-12 hex chars). Deterministic hash > Date.now() so identical builds stay reproducible and don't churn user caches.

Edge cases the fix must preserve:
- The offline gate (§2.3) scans dist/ for external URLs — the injected id must be plain hex, no scheme/URL.
- scripts/build-standalone.ts relies on hashless deterministic asset filenames — do NOT switch to hashed chunk names; only the SW cache name changes. sw.js is not used by the file:// standalone (SWs don't run from file://), so the standalone path is unaffected.
- vite.standalone.config.ts / vite.woodframe.config.ts: check whether they also copy public/ and, if so, whether they need the same plugin (likely no-op since only the main PWA build ships sw.js, but verify).
- Keep the fetch handler's same-origin guard and offline index.html fallback intact.
- One runnable check (per repo norms): tiny assertion in the existing build gate or a test that dist/sw.js contains no literal '__BUILD_ID__' after a build, so a silent plugin regression can't re-pin users.

Files touched: public/sw.js, vite.config.ts, plus one small test/gate assertion. Optional hardening (skip unless asked, per ponytail): a controllerchange listener in main.ts to reload once on SW update, closing the small in-session skew window when a new SW activates under an old page.

#### 4. Precache list (CORE) omits every JS/CSS asset vite emits — offline is broken after the advertised 'first load'

`public/sw.js:6` · **HIGH** · bug · effort: small

**Problem.** CORE precaches only './', './index.html', manifest, and icon. But dist/index.html loads assets/index.js, assets/index.css, and assets/three-viewer.js as separate files (confirmed in built dist/ — assetsInlineLimit does not inline entry chunks). On the FIRST visit those assets are fetched before the SW is registered/controlling (registration happens on window 'load', main.ts:741-746), so they never pass through the fetch handler and are never runtime-cached. If the user then goes offline and reloads — the exact scenario the header comment promises ('fully offline after the first load') — index.html is served from precache but assets/index.js misses the cache, fetch rejects, and the catch returns index.html HTML as the module body; the browser refuses text/html for a module script, leaving a blank shell. Offline only actually works after a SECOND online visit. The list has also drifted from the new multi-page build: hub.html, woodframe.html, and assets/woodframe.js (all emitted per vite.config.ts inputs) are absent, and no build gate (check-offline.ts scans URLs only) validates CORE against what vite emitted.

```
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];
// dist/index.html:
// <script type="module" crossorigin src="./assets/index.js"></script>
// <link rel="stylesheet" crossorigin href="./assets/index.css">
```

**Fix.** Two files. (A) public/sw.js: (1) extend CORE to the deterministic names vite.config.ts guarantees (entryFileNames/chunkFileNames/assetFileNames are hashless, vite.config.ts:44-49): './', './index.html', './hub.html', './woodframe.html', './assets/index.js', './assets/index.css', './assets/three-viewer.js', './assets/woodframe.js', './manifest.webmanifest', './icons/icon.svg'. Changing sw.js bytes makes installed browsers re-run install, so the same 'sap1-v1' cache name works, but bumping to 'sap1-v2' is cleaner (activate already deletes old caches). (2) Fix the fallback at sw.js:34 to only serve './index.html' when e.request.mode === 'navigate'; for failed asset fetches return the rejection (or Response.error()) so a cache miss fails loudly instead of feeding HTML to a module script. Consider dropping the .catch(() => undefined) on install addAll (sw.js:9) so a 404'd CORE entry fails install and the old SW keeps serving, rather than silently shipping an empty precache. (B) scripts/check-offline.ts: add a CORE-vs-dist assertion — read dist/sw.js, regex out the CORE array literal (const CORE = [...]), and for every entry except './' assert the corresponding file exists under dist/; fail the gate with the missing paths listed. This catches future drift when a page is added to vite.config.ts inputs (the config comment says 'adding a tool = one more input here' — the gate must force the matching CORE update). Edge cases to preserve: do NOT precache dist/sap1.html (stale output from a prior build, not in current inputs; emptyOutDir will remove it — the gate would rightly reject it); keep the same-origin-only guard and GET-only guard in the fetch handler; keep behavior irrelevant to the file:// standalone (SW never runs there, build-standalone.ts only inlines dist/index.html). Alternative (more robust, more machinery): generate CORE at build time from vite's manifest via a small plugin — not needed while output names are pinned hashless, the gate covers drift.

#### 5. SW offline fallback returns SAP-1 index.html for ANY failed same-origin GET; hub.html/woodframe.html never precached

`public/sw.js:34` · **HIGH** · bug · effort: small

**Problem.** CORE precaches only ./, ./index.html, manifest, and icon — not hub.html or woodframe.html — yet the SW (registered from index with scope covering the whole origin) intercepts all same-origin navigations. Scenario: user opens SAP-1 once (SW installs), goes offline, then navigates to ./hub.html or ./woodframe.html for the first time: cache miss → fetch fails → catch returns ./index.html, so the SAP-1 app silently renders under the /woodframe.html URL — the wrong tool, contradicting hub.html:55's 'Single offline bundle: every tool ships in one deploy' promise. The same catch also answers failed ASSET requests with index.html: an offline miss on assets/woodframe.js returns HTML with a text/html MIME type, which the browser rejects for a module script, leaving a blank page with only a console error.

```
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg'];  // sw.js:6
.catch(() => caches.match('./index.html')),   // sw.js:34
```

**Fix.** 1) /Users/zacharytraphagen/FieldFortificationsCalculator/public/sw.js: (a) extend CORE with './hub.html', './woodframe.html', './assets/index.js', './assets/index.css', './assets/three-viewer.js', './assets/woodframe.js' — safe to hardcode because vite.config.ts pins deterministic hashless names (entryFileNames 'assets/[name].js'); (b) bump CACHE to 'sap1-v2' so the activate handler purges the stale v1 cache and reinstall precaches the new CORE; (c) restrict the fallback: `.catch(() => e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())` so asset misses surface as network errors instead of HTML-as-JS. 2) /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/hub.html and src/ui/woodframe.html: add the same 3-line SW registration guard used in main.ts:741 (http-only, load event) so entering via hub/woodframe also installs the SW — required for the footer's offline promise. 3) Update the vite.config.ts comment ('Adding a tool = one more input here + one more card in hub.html') to also name the sw.js CORE list as a third touchpoint, and add one small test (test/sw-core.test.ts) that reads public/sw.js and asserts CORE contains one './<name>.html' per rollup input key, keeping them in sync. Edge cases to preserve: install's addAll catch (sw.js:9) must stay — in vite dev the './assets/*.js' entries 404 and cache.addAll is atomic, so dev silently skips precache (acceptable, dev doesn't need it); keep the same-origin and GET-only guards; the file:// standalone path is unaffected (SWs don't run from file://); no new external URLs so the §2.3 offline gate still passes.

#### 6. Doctrine importer accepts 0 for divisor leaves — BOM silently reports 0 sandbags

`src/doctrine/io.ts:175` · **HIGH** · bug · effort: small

**Problem.** importDoctrine's numeric sanity bound is 0 <= v < 1000, so a value of exactly 0 passes validation for leaves the engine divides by (materials.sandbag.L/W/H, protection overhead.stringerSpacing, revetment spacing). Failure scenario: in the doctrine fill table a user types 0 into sandbag.L (input has no min attribute, tools.ts:190) or imports a doctrine JSON with a 0 from a blank spreadsheet cell — the all-or-nothing importer applies it, compute.ts:237 yields bagVol = 0, bagsParapet = ceilInt(parapetRing/0 * waste) = ceilInt(Infinity), and round.ts ceilInt coerces Infinity to 0 — so the BOM, job sheet, and CSV report ZERO sandbags for a position that needs hundreds, with no warning. saveFill persists the bad fill so the wrong numbers survive every reload. Same path makes stringerSpacing=0 report 1 roof stringer. The bound's own comment says values outside it are 'a transcription error, not real doctrine' — 0 is the most common transcription error and it is admitted.

```
if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value >= MAX_MAGNITUDE)) {
  rejected.push({ path, reason: 'number out of range...' });
// compute.ts:237-239
const bagVol = sandbag.L.value * sandbag.W.value * sandbag.H.value;
const bagsParapet = isVehicle ? 0 : ceilInt((parapetRing / bagVol) * waste);
```

**Fix.** 1) src/doctrine/io.ts:175 — change the bound from `value < 0` to `value <= 0` and update the reason string to 'number out of range (0 < v < ' + MAX_MAGNITUDE + ')'. This single choke point fixes all three reachable routes (file import, inline fill-table edits, and boot-time restoreFill — a previously persisted 0-fill will be rejected all-or-nothing on next load and the app falls back to placeholders with the banner, the safe direction). Also update the comment at io.ts:46-47 to say 0 < v < 1000. 2) src/layout/tools.ts:190 — add ` min="0.000001"` to the number input for browser-side nudging (advisory only; the importer rejection is the real guard and its report block already lists the offending path per entry). 3) test/doctrine-io.test.ts — next to the existing out-of-range assertion at line 57, add `assert.ok(!importDoctrine(mk({ value: 0 })).ok, 'zero rejected');`. Edge cases the fix must preserve: (a) round-trip of the current full export must still import cleanly — verified no registry leaf is <= 0 today; (b) doctrine-integrity test asserts p.value >= 0 on fresh build (test/doctrine-integrity.test.ts:42) — no conflict, it never asserts 0 is importable; (c) boolean/string leaves are untouched (the check is gated on typeof value === 'number'); (d) if a future leaf legitimately needs 0, add a per-leaf min to Provenance then — not now (YAGNI). Do NOT add guards inside compute.ts — round.ts's non-finite-to-0 coercion is the engine's deliberate NaN firewall; the importer is the trust boundary.

#### 7. Engine snapshots labor doctrine at module load — applied doctrine fills for all 7 labor values are silently ignored by compute()

`src/engine/compute.ts:354` · **HIGH** · data · effort: small

**Problem.** importDoctrine() (src/doctrine/io.ts:210-216) mutates the live Provenance leaves in place, and the whole regime depends on consumers reading .value at call time (doctrine/index.ts: 'leaf stays mutable ... so a validated doctrine import can update value/status/source in place'). compute.ts instead copies all seven labor values into a module-level const ONCE at import time. Failure scenario (reproduced): import a valid fill setting labor.baseMH 4.0 -> 8.0 (status DOCTRINE, real source) — import reports ok/applied, the live leaf reads 8, the placeholder banner burns down, the job sheet stamps 'Computed against doctrine fill <hash>', but compute(defaultInputs()).labor.manHoursPerPosition stays 12.1 (unchanged). All labor outputs (man-hours, machine-hours, schedule feasibility) keep using the illustrative placeholders while being presented as doctrine-verified. Secondary corruption: stages.ts and explain.ts DO read the live leaves, so after importing e.g. labor.overheadAdd 3.0 -> 5.0 the stage decomposition subtracts the new adder from the stale total (excavation labor silently squeezed from 8.6 to 6.6 mh) and the derivation trace shows operands that no longer reproduce the published total.

```
const baseLabor = {
  baseMH: laborDoctrine.baseMH.value,
  perVolMH: laborDoctrine.perVolMH.value,
  machinePerVolMH: laborDoctrine.machinePerVolMH.value,
  overheadAdd: laborDoctrine.overheadAdd.value,
```

**Fix.** File: /Users/zacharytraphagen/FieldFortificationsCalculator/src/engine/compute.ts. (a) Move the `import { labor as laborDoctrine } from '../doctrine/labor'` from line 353 up with the other top-of-file imports. (b) Delete the module-level `const baseLabor = {...}` (lines 354-362) and read leaves at call time: simplest is a per-call snapshot at the top of computeCalc's labor section — `const baseLabor = { baseMH: laborDoctrine.baseMH.value, perVolMH: ..., machinePerVolMH: ..., overheadAdd: ..., revetAdd: ..., sumpAdd: ..., camoAdd: laborDoctrine.camoAdd.value };` — so lines 266-276 need no changes. A per-compute() snapshot is safe (single-threaded; import cannot interleave mid-compute) and keeps a compute() Result internally consistent. (c) Fix the now-false comment at lines 351-352 ('pulled once'). (d) Verify no other module-scope snapshot exists — checked: geometry.ts wraps rampSlope in a function (call-time, fine); compute.ts baseLabor is the only offender. (e) Add a regression test in test/doctrine-io.test.ts following the existing restore() pattern (tests mutate global singletons and must call restore() after): import a fill with labor.baseMH=8.0 and labor.overheadAdd=5.0 (status DOCTRINE, real source), assert compute(defaultInputs()).labor.manHoursPerPosition moved from the pre-import value (default inputs use earth_on_stringers roof, so expect +4.0 base +2.0 overhead = old+6.0, subject to round1), and assert computeStages(result).steps for 'overhead' equals 5.0 while the excavation stages still sum to total minus the adders actually in force — i.e., partition consistent with the SAME doctrine the total was computed under. Then restore() and assert compute output returns to 12.1. Edge cases to preserve: default placeholder output must remain exactly 12.1 (round1 rounding unchanged) so existing tests (stage-sum-equals-total assertion referenced in stages.ts:40, banner tests) keep passing; do not touch LABOR_FIDELITY or the placeholderReport path (counts() is already live). Run `npm run verify` after.

#### 8. Mission BOM merges materially different items under one line — stringer sizes and revetment panel types collapse into the first-seen label

`src/engine/mission.ts:39` · **HIGH** · bug · effort: small

**Problem.** aggregateMission merges BOM lines by id only, but two ids carry material identity in the LABEL: 'stringers' embeds the doctrine size ('Overhead stringers (4×4)' vs '(8×8)', materials.ts:105-112) and 'revet_panels' embeds the revetment system ('Corrugated metal — facing area' vs 'Timber & plywood — facing area', materials.ts:98-100). Merging keeps the first item's label and sums the quantities. Verified: a mission of bunker_op_cp (needs 8×8 stringers) plus two_man (needs 4×4) renders a single supply line 'Overhead stringers (8×8) :: 19' — with the items reversed it reads '(4×4)', silently ordering undersized 4×4 stringers for the bunker's 8-ft structural span. Likewise corrugated_metal + timber_plywood positions render 'Corrugated metal — facing area :: 144' covering both. The mission overlay (src/layout/tools.ts:71-75) prints exactly this merged label as the order sheet. test/plan-mission.test.ts only merges identical-label lines, so this is untested.

```
const existing = merged.get(line.id);
if (existing) {
  existing.qtyTotal += line.qtyTotal;
// materials.ts:107 'Overhead stringers' + (calc.stringerSize ... ? ' (' + calc.stringerSize + ')' : '')
// materials.ts:99 add('revet_panels', calc.revet.label + ' — facing area', ...)
```

**Fix.** Contain the fix to src/engine/mission.ts (do NOT rename buildBom ids — 'stringers'/'revet_panels' are pinned by test/formula-honesty.test.ts:25,86,146, test/engine-formula.test.ts:82,93, test/protection.test.ts:36, test/snapshot.test.ts:42, test/stages.test.ts:53, and the 'stringers' derivation key). 1) In aggregateMission, merge on a composite key: const key = line.id + '|' + line.label; use it for merged.get/set AND emit it as the MissionBomLine's id ({ ...line, id: key }). This automatically fixes downstream consumers with zero changes: the onHand lookup (mission.ts:51) and the overlay's data-onhand attribute (src/layout/tools.ts:74) both use l.id, so on-hand quantities key per variant instead of one input silently covering both; the sort tiebreak (mission.ts:56) stays deterministic and groups variants adjacently within the same sortKey. src/ui/main.ts needs no change (main.ts:310 reads dataset verbatim; session.ts accepts arbitrary string onHand keys). 2) Update the header comment (mission.ts:1-4), which currently asserts 'merge by id (NOT label)' — state the new id+label semantics. 3) Add tests to test/plan-mission.test.ts using test/helpers.ts defaultInputs: (a) aggregateMission([bunker_op_cp overheadCover:true, two_man overheadCover:true]) yields two distinct stringer lines, labels containing '(8×8)' and '(4×4)', each qtyTotal equal to its position's individual compute; (b) reversing item order yields the same set of labels/quantities (order-independence); (c) revetment corrugated_metal + timber_plywood yields two revet_panels lines. Edge cases the fix must preserve: identical-material lines from different positions still merge into one row (existing test plan-mission.test.ts:28 must keep passing — same id AND same label merges); fromPlaceholder OR-merge; zero-line omission (handled upstream in buildBom); non-finite onHand guard defaulting to 0; previously persisted session onHand keys ('stringers') orphan harmlessly — shortfall falls back to full need, the fail-safe direction the code already documents (mission.ts:49-50). Bonus covered for free: 'cover_soil_fill' label variants (per-threat coverMaterial, materials.ts:81) also stop collapsing.

#### 9. scheduleStages double-counts machine assist — stand-to clock up to 2.5x too optimistic

`src/engine/stages.ts:122` · **HIGH** · bug · effort: small

**Problem.** compute.ts already multiplies the per-volume dig labor by machine.excavationFactor (0.4) when machineAssist is on (compute.ts:264-267), and computeStages partitions that already-reduced total. scheduleStages then multiplies effectiveDiggers by 1/0.4 = 2.5 a second time — and applies that speedup to ALL stages, including non-machine work (overhead-cover build, revetment, camo adders). The caller (src/ui/main.ts:112) always passes machineAssist straight from the same result's inputs, so the double-count fires every time machine assist is on. Verified: vehicle_hull_defilade / deliberate / loam / team 4 / machineAssist yields engine elapsedHours 11.3 h, but scheduleStages reports totalElapsedHours 4.5 h and feasible=true for an 8-hour stand-to — the same Result contradicts itself and tells the operator they will be ready when the engine's own labor math says they will not. No test covers scheduleStages with machineAssist:true (test/stages.test.ts only ever passes machineAssist:false to scheduleStages).

```
const machineSpeed = opts.machineAssist ? 1 / machine.excavationFactor.value : 1; // dozer digs faster
const effectiveDiggers = team * posture * machineSpeed;
// compute.ts:264-267 already applied: excavBank * baseLabor.perVolMH * machineFactor (0.4)
```

**Fix.** 1) src/engine/stages.ts: delete line 122 (machineSpeed) and make effectiveDiggers = team * posture; remove machineAssist from ScheduleOpts (line 103) and drop the now-stale "(× machine speed-up)" comment on the effectiveDiggers field (line 116). Remove `machine` from the import on line 15 (keep `revetments` — still used by chargedRevetLabor). 2) src/ui/main.ts:112: remove the machineAssist property from the scheduleStages opts object (TypeScript will flag it once the opt is gone). 3) test/stages.test.ts: remove machineAssist:false from the six existing calls, and add one test: compute a machineAssist:true result (e.g. vehicle_hull_defilade/deliberate/loam), run scheduleStages(computeStages(r), {teamSize: r.teamSize, availableHours: 24, securityPostureFrac: 1}) and assert totalElapsedHours ≈ r.labor.elapsedHours (within round1 tolerance, ±0.1) — this pins schedule/engine consistency and would have caught the bug. Edge cases to preserve: posture clamp (0.01..1), teamSize floor/min-1, round1 rounding of cumulativeHours only for display (exact accumulation internally), feasibility epsilon 1e-9, and the existing partition-equals-total invariant. Do NOT add a per-stage machine model unless requested — the man-hours already embed it. Run npm run verify after.

#### 10. Printed job sheet silently omits every validation error/warning the app shows on screen

`src/render/jobSheet.ts:102` · **HIGH** · ux · effort: small

**Problem.** jobSheet() renders Inputs, Specifications, Drawings, BOM, Labor, the engineer hand-off block, Priorities of work, and a signature block — but never result.validation (grep for 'validation' in jobSheet.ts and csv.ts returns nothing). The in-app 'Things to double-check' panel (src/layout/panels.ts:129) shows error-severity issues like REVET_REQUIRED_SOIL: 'This soil requires revetment but none is selected — walls will slough' (src/engine/codes.ts:19-24). Failure scenario: user sets soil=sand with revetment=none, sees the red error on screen, taps Print report, and hands the crew a clean-looking signed job sheet with 'Prepared by / Verified by' lines and zero mention of the sloughing-walls error or the CUT_DEPTH_SHORING warning — the team builds from the paper without the safety caveats the app itself computed.

```
'<section><h2>Labor</h2><table>' + laborRows + '</table></section>' +
    engineerBlock(result) +
    '<section class="pow"><h2>Priorities of work (build in this order)</h2>...' +
    powRows(result) + '</tbody></table></section>' +
    '<section class="sign">...' // no result.validation anywhere
```

**Fix.** 1) src/render/jobSheet.ts: add a private validationSection(result: Result): string that returns '' when result.validation.length === 0 (mirroring validationPanel's early-out), otherwise renders '<section class="checks"><h2>Things to double-check</h2><ul>…</ul></section>' with one <li> per issue: a severity prefix using the same mapping as panels.ts (error→'Error', warning→'Warning', advisory→'Note') followed by esc(v.message). esc is already imported. Insert the call in the jobSheet() return string between the powRows section (line 105) and the '<section class="sign">' signature block (line 106), per the auditor's placement. 2) Add minimal print CSS to PRINT_CSS: '.checks li{...}' with the severity word rendered in bold text — keep the textual severity label load-bearing (not color-only) so it survives grayscale/B&W printing; existing '@media print' rule already gives section break-inside:avoid. 3) Do NOT re-sort issues — runValidation already emits deterministic errors→warnings→advisories order. Edge cases to preserve: zero issues → no section at all (no empty heading); messages contain dynamic detail like '(cut 8.2 ft, limit 6 ft)' and must go through esc(); jobSheet must stay pure (no clock/DOM access). 4) Optional but recommended per the auditor: in src/render/csv.ts append a 'Validation' section (columns: severity, code, message) when result.validation is non-empty. 5) One pinning test (repo rule: non-trivial logic leaves a runnable check): in an existing render test file or a small new one, build a result with soil forcing revetment + revetment 'none' and assert jobSheet() output contains 'Things to double-check' and the REVET_REQUIRED_SOIL message, and that a clean result's jobSheet() does not contain that heading.

#### 11. Firing-platform semantics inverted: engine digs it BELOW the bay floor, both renderers draw a raised deck ON the floor

`src/render3d/scene3d.ts:366` · **HIGH** · bug · effort: small

**Problem.** The doctrine contract (src/doctrine/positions.ts:21) defines FiringPlatform.depthBelowHole as 'platform floor is this far below the fighting bay floor', and compute.ts (lines 202-204, 217) accordingly ADDS platformVol = L*W*depthBelowHole to excavBank, charging extra digging labor and spoil for a pit sunk below the bay floor. But both renderers consume geometry.section.platformDepth (geometry.ts:152, = depthBelowHole) with the opposite sign: scene3d.ts:366 places a box of height platformDepth resting ON the bay floor labeled 'Standing platform' (three-viewer.ts:746-747 then builds it as a 2x6 plank deck), and drawSection.ts:79-80 draws a raised block from depthOfCut-platformDepth down to depthOfCut. Failure scenario: select mg_crew, fifty_cal, or atgm_javelin — the printed job-sheet section and the 3D model teach the crew to BUILD a 1.5 ft raised lumber platform inside the bay (lumber that appears in no BOM line), while the BOM/labor/spoil numbers on the same sheet charge for EXCAVATING an extra 3x2x1.5 ft pit below the floor. The construction drawing and the material/labor plan for the same position contradict each other.

```
// positions.ts:21  depthBelowHole: ... // platform floor is this far below the fighting bay floor
// compute.ts:217   const excavBank = holeVol + platformVol + sumpVol + rampVol;
// scene3d.ts:366   parts.push({ kind: 'box', x: 0, y: -s.depthOfCut + s.platformDepth / 2, z: -halfW + p.platform.W / 2,
//                    w: p.platform.L, h: s.platformDepth, d: p.platform.W, role: 'platform', label: 'Standing platform' });
// drawSection.ts:79 const stepTL = px(-halfBay, s.depthOfCut - s.platformDepth);
```

**Fix.** Adopt raised-platform semantics (what both renderers already draw, and what MG-position doctrine describes: the gun platform is undug earth left proud of the deeper crew floor). Changes: (1) src/doctrine/positions.ts — rename FiringPlatform.depthBelowHole to heightAboveFloor (same values 1.5/1.0/0.5) and rewrite the line-21 comment to 'bay floor is dug this far below the platform surface; the platform is undug earth left in place'; update the three rows' provenance notes ('platform below bay' → 'bay below platform'). (2) src/engine/compute.ts:199-217 — the platform footprint is left undug, so flip the sign: excavBank = holeVol - platformVol + sumpVol + rampVol; update the §9 comment. Keep hasPlatform keyed on the structural leaf so the firingStep-toggle invariance test (test/engine-audit-fixes.test.ts:59-70) still passes unchanged. (3) src/engine/geometry.ts:152 — rename the passthrough to platformHeight (value unchanged); renderers already treat it as height above the floor, so scene3d.ts:366 and drawSection.ts:79-82 geometry need no change beyond the field rename. (4) Material honesty: the platform is earth, not lumber — in src/ui/three-viewer.ts:746-747 stop routing role 'platform' to buildPlankDeck and give it the dirtTexture/bayFloor treatment (leave 'firingStep' as-is or match); in src/render/drawSection.ts:80 change fill from var(--draw-timber) to the earth/parapet fill. Do NOT instead add platform lumber to the BOM — that invents doctrine. (5) Parity test (extend test/engine-audit-fixes.test.ts or new test): assert compute(mg_crew) excavation_loose = (holeL*holeW*D - 3*2*1.5 + sumpVol) * swellFactor, and assert the scene3d 'platform' part spans y ∈ [-depthOfCut, -depthOfCut + platformHeight] (top above floor) so any future sign flip on either side fails. Edge cases to preserve: default two-man snapshot (test/snapshot.test.ts) is platform-less — unaffected; engine-formula.test.ts:42 uses platformVol=0 — unaffected; one_man/firingStep no-op behavior; vehicle_ramp path untouched; excavBank stays positive for all three positions (platform prisms 9/12/6 ft³ vs holes 64/72/96 ft³), but a cheap Math.max(0, excavBank) guard is fine insurance.

#### 12. OC layout grid shifted +3/4": panel edges land on member faces, not centers

`src/timber/walls.ts:105` · **HIGH** · bug · effort: small

**Problem.** All three generators start the OC grid at t/2 (0.75") and step by the spacing, so stud/joist/rafter CENTERS sit at 0.75", 16.75", 32.75"... instead of the standard layout (first member flush at the end, subsequent centers at 16", 32", 48") that makes 4x8 panel edges land on member centers. Verified: floor joist centers are 0.75, 16.75, 32.75, 48.75" while generateFloor's own subfloor panels have edges at exactly 48"/96"/144" — the joint at 48" falls on the joist's left FACE (joist spans 48.0–49.5"), giving the [0,48] panel zero bearing. Same shift applies to wall studs (future sheathing) and rafters vs roof-panel joints at 96"/192". It also makes layoutStrip — presented in the UI as 'the marks a carpenter would pencil on the plate' — emit X marks at 0'-0 3/4", 1'-4 3/4", 2'-8 3/4"..., which contradicts FM 5-426 modular layout; a wall framed to those marks cannot take modular sheathing. test/timber-walls.test.ts only asserts gaps <= OC (uniform 16" passes) and never checks modularity.

```
for (let s = t / 2; s < f.runFt - t / 2 - 0.01; s += oc) gridXs.push(s);
// same pattern: floor.ts:121 (joists), roof.ts:65 (ceiling joists + rafter grid)
```

**Fix.** Replace the phase-shifted grid with flush end members + modular interior centers, identically in three places.

1. /Users/zacharytraphagen/FieldFortificationsCalculator/src/timber/walls.ts:104-106 — replace
   `for (let s = t / 2; s < f.runFt - t / 2 - 0.01; s += oc) gridXs.push(s); gridXs.push(f.runFt - t / 2);`
   with
   `const gridXs: number[] = [t / 2]; for (let s = oc; s < f.runFt - 1.5 * t; s += oc) gridXs.push(s); gridXs.push(f.runFt - t / 2);`
   The `s < runFt - 1.5*t` bound skips any modular center within one thickness of the far end-stud center (prevents overlapping members); the first modular center is oc >= 16" so it never collides with the flush stud at 0.75" or the extra corner stud at 2.25".

2. /Users/zacharytraphagen/FieldFortificationsCalculator/src/timber/floor.ts:120-122 — same transform for joistXs (bounds use L). ALSO fix line 136: bridging length is hardcoded `oc - t`, but after the fix the first/last bays are 15.25" center-to-center, so use per-bay `joistXs[i + 1]! - joistXs[i]! - t` to avoid bridging overlapping the end joists.

3. /Users/zacharytraphagen/FieldFortificationsCalculator/src/timber/roof.ts:64-66 — same transform for the ceiling joistXs; rafters (line 79) and collar ties (line 101) iterate joistXs so they inherit it. Do NOT touch the gable-stud z-grid (line 109) — it already starts at oc and is modular from z=0.

4. Tests: in /Users/zacharytraphagen/FieldFortificationsCalculator/test/timber-walls.test.ts add an assertion that the golden N wall (no openings) has stud centers at 4.0 and 8.0 ft (+-0.01) — panel-edge bearing at 48" multiples. In test/timber-frame.test.ts (or a new floor test) assert every interior subfloor joint x has a joist whose center is within (actual.w/2 - eps)... simplest robust form: a joist center exists within 0.01 ft of x=4, 8, 12 ft, and that layoutStrip S-wall 'X' marks other than the two end/corner marks (0.75", 2.25", run-0.75", run-2.25") satisfy atIn % 16 === 0.

Edge cases the fix must preserve: (a) walls shorter than oc must still emit both flush end studs and zero grid studs (the loop naturally yields none); (b) determinism test (deepEqual of two runs) — pure loops, unaffected; (c) existing OC-gap test still passes (first gap becomes 15.25", last gap <= 16"); (d) opening bay logic and cripples reuse gridXs unchanged; (e) E/W walls are a known residual: their wall-local 0 is inset t/2 from the building corner (wallFrames, walls.ts:48-49, runFt = widthFt - t), so a wall-local k*oc grid is still 3/4" off the building-corner modular grid — acceptable while no wall sheathing is generated, but mark with a `ponytail:` comment naming that ceiling; (f) elevation.ts needs no change (it projects member positions), and 2D/3D parity + BOM tests don't pin member counts, which shift by at most one per run.

#### 13. Downloaded SVG drawings reference undefined CSS variables and render black/invisible

`src/ui/main.ts:700` · **HIGH** · bug · effort: small

**Problem.** The 'Download drawings' action writes drawPlan()/drawSection() output directly to sap1-plan.svg / sap1-section.svg. Every fill/stroke in the drawing is var(--surface), var(--ink), var(--draw-earth), etc. (chrome.ts, svg.ts), but the standalone SVG string contains no <style> block and no :root token definitions (verified by rendering drawPlan at runtime: has var()=true, has <style>=false, has :root=false). Opened outside the app (image viewer, browser, Word/brief insert — the advertised 'range-card packet' use), every var() is invalid at computed-value time: fills collapse to default black and stroked dimension/hidden lines (initial stroke: none) vanish. The exported drawing is an unreadable black-on-black blob. The job sheet already solves this with print-tokens.ts DAY_TOKENS_CSS — the raw SVG export path just never got it.

```
download('sap1-plan.svg', drawPlan(lastResult), 'image/svg+xml');
// chrome.ts svgRoot: el('rect', { ... fill: 'var(--surface)' })
// runtime check: has var(): true, has <style: false, has :root: false
```

**Fix.** 1) Add a small helper, e.g. `export function standaloneSvg(svg: string): string` in src/render/print-tokens.ts (keeps render-layer ownership and makes it testable): return svg.replace(/^(<svg[^>]*>)/, '$1<style>' + DAY_TOKENS_CSS + '</style>'). Safe because svgRoot's opening-tag attributes (xmlns, viewBox, role, aria-labelledby, font-family) contain no '>', and DAY_TOKENS_CSS contains no '<' or '&' so no CDATA is needed. In a standalone SVG document :root matches the outer <svg>, so all var() references (colors and --w-* stroke widths) resolve to the Day palette. 2) In src/ui/main.ts doSvg() (lines 696-702), import standaloneSvg and wrap both downloads: download('sap1-plan.svg', standaloneSvg(drawPlan(lastResult)), 'image/svg+xml') and same for sap1-section.svg. 3) Edge cases the fix MUST preserve: (a) do NOT inject the style inside svgRoot()/chrome.ts — in-app SVGs are innerHTML-inlined and an inline-SVG <style> with :root would restyle the whole page and break Night-theme live theming; injection is download-path only; (b) keep the style element immediately after the opening <svg> tag so the output stays a single valid root element; (c) leave jobSheet.ts untouched (it already inlines DAY_TOKENS_CSS). 4) Pin it with one test (repo convention requires a runnable check): e.g. test/svg-export.test.ts asserting standaloneSvg(drawPlan(result)) contains '<style' and '--surface:' before the first var() use, and that raw drawPlan(result) still contains no '<style' (protects in-app theming).

#### 14. Downloaded SVG exports render as a solid black box (all colors are unresolved CSS variables)

`src/ui/main.ts:700` · **HIGH** · bug · effort: small

**Problem.** doSvg() downloads the raw drawPlan/drawSection strings as standalone .svg files. Every fill/stroke/stroke-width in those strings is a var(--token) reference (94 occurrences in a generated sap1-plan.svg), and svgRoot (src/render/chrome.ts:219-238) embeds no <style> block — the tokens live only in ui/tokens.css, which is not part of the file. Opened outside the app (browser tab, <img>, Office/briefing insert — the stated use case in the code comment 'drops into any range-card packet or briefing'), every var() is invalid-at-computed-value: fill unsets to inherited black, strokes to none. Empirically verified by rendering the exported markup as an image and pixel-sampling: background rect, parapet fill, and text all return rgba(0,0,0,255) — the exported drawing is an illegible black rectangle. The job-sheet export already solves this for itself by inlining DAY_TOKENS_CSS (print-tokens.ts); the raw SVG download path was never given the same treatment.

```
download('sap1-plan.svg', drawPlan(lastResult), 'image/svg+xml');
download('sap1-section.svg', drawSection(lastResult), 'image/svg+xml');
// chrome.ts svgRoot: '<svg' + attrs + '>' + drawingDefs() + a11yDefs + el('rect',{...fill:'var(--surface)'}) + body + '</svg>'  — no <style>
```

**Fix.** 1) src/render/print-tokens.ts: split the token block — export const DAY_TOKENS_VARS = '--bg:#f4f2ec;…--w-thin:0.9;' (the existing declaration list verbatim) and redefine DAY_TOKENS_CSS = ':root{' + DAY_TOKENS_VARS + '}' so jobSheet.ts is untouched. 2) src/ui/main.ts doSvg(): wrap both downloads with a tiny local helper, e.g. const standalone = (svg: string) => svg.replace('>', '><style>svg{' + DAY_TOKENS_VARS + '}</style>'); then download('sap1-plan.svg', standalone(drawPlan(lastResult)), …) and same for section. The first '>' in the string safely terminates the opening <svg> tag — svgRoot's attrs (xmlns, viewBox, role, aria-labelledby, font-family) contain no '>' (verified in chrome.ts:226-229). Use the svg{} selector, NOT :root{} — :root would leak Day tokens document-wide if the exported markup is ever inlined into an HTML page. 3) Edge cases to preserve: do NOT add the style inside svgRoot itself — the same strings are injected inline in-app where tokens.css drives the Day/Night theme, and a hardcoded Day block would freeze the drawings on Day (or, with :root, break Night for the whole document). Exports are intentionally always Day (matches the job-sheet print rationale in print-tokens.ts / DECISIONS.md D14). 4) Test (repo uses node --import tsx --test, files in test/): add test/svg-export.test.ts that builds the wrapped export string and asserts (a) it contains '<style>svg{', and (b) every distinct token name matched by /var\(--([\w-]+)/g in drawPlan+drawSection output appears as '--name:' in DAY_TOKENS_VARS — this pins the export against future renderer tokens being added to tokens.css but forgotten in print-tokens.ts.

#### 15. Exported standalone SVGs render black-on-black — every color is an undefined var()

`src/ui/main.ts:700` · **HIGH** · bug · effort: small

**Problem.** doSvg() downloads drawPlan()/drawSection() output directly as sap1-plan.svg / sap1-section.svg, but every fill/stroke in those drawings is a CSS custom-property reference (fill="var(--surface)", stroke="var(--draw-outline)", stroke-width="var(--w-outline)", ...) and svgRoot() (src/render/chrome.ts:219-238) embeds no <style> defining those tokens — they exist only in ui/tokens.css (the live app) and DAY_TOKENS_CSS (inlined only into the job sheet HTML, src/render/jobSheet.ts:24). Opened standalone (browser, <img>, Word/PowerPoint insert — the toast explicitly pitches 'drops into any range-card packet or briefing'), every var() is invalid-at-computed-value time. Verified empirically in Chromium: fill="var(--surface)" computes to rgb(0,0,0), stroke="var(--draw-outline)" computes to 'none', text fill computes to black. The full-canvas background rect (fill=var(--surface)) paints black and all shapes/text on top are black with no strokes — the downloaded drawing is an unreadable black rectangle. The comment above the download ('renderers already produce standalone SVG strings') is wrong: they are only standalone-well-formed, not standalone-styled.

```
// The renderers already produce standalone SVG strings — a plan + section download needs no
// rasterization, stays fully offline...
download('sap1-plan.svg', drawPlan(lastResult), 'image/svg+xml');
download('sap1-section.svg', drawSection(lastResult), 'image/svg+xml');
```

**Fix.** Fix in src/ui/main.ts only — do NOT touch svgRoot() unconditionally. In doSvg(), import DAY_TOKENS_CSS from '../render/print-tokens' and inject it into the downloaded strings: e.g. const standalone = (svg: string) => svg.replace('>', '><style>' + DAY_TOKENS_CSS + '</style>'); then download('sap1-plan.svg', standalone(drawPlan(lastResult)), ...) and same for the section. Replacing the first '>' is safe because svgRoot's opening-tag attributes (xmlns, viewBox numbers, role, aria-labelledby ids, font-family) contain no '>'. DAY_TOKENS_CSS is already a ':root{...}' block and :root matches the outer <svg> in a standalone SVG document, so all existing var() references resolve unchanged. Edge cases the fix must preserve: (1) never bake the style into svgRoot/chrome.ts — an inline <style>:root{...}</style> inside in-app SVG would leak Day tokens to the whole document and break the Night theme, and would double-inject into the job sheet; (2) leave jobSheet.ts alone (it already inlines DAY_TOKENS_CSS at line 24); (3) existing tests (a11y.test.ts, fuzz.test.ts, render-*.test.ts) operate on raw drawPlan output and stay green since renderers are untouched; (4) also update the now-wrong comment above the download call ('renderers already produce standalone SVG strings'). Per repo rules add one small test (e.g. test/svg-export.test.ts) asserting the exported string contains '<style>' with '--surface:' before the first var() use — exercise the same helper by exporting it or replicating the injection in a tiny exported function.

#### 16. Time planner 'Use' applies a stale full-input snapshot, silently reverting every edit made after the plan was run

`src/ui/main.ts:510` · **HIGH** · bug · effort: small

**Problem.** Sequence: open Time planner, click 'Find achievable standard' (lastPlan captures base = current inputs, main.ts:506), close the overlay, then change threat/soil/position/count in the form, then reopen Time planner. openPlan() (main.ts:500) renders the STALE lastPlan table with live 'Use' buttons and no stale indicator — the elapsed-hours shown are for the old position. Clicking 'Use' runs store.replaceInputs(opt.inputs), and each PlanOption embeds the ENTIRE old base snapshot ({...req.base, standard, overheadCover, revetment, teamSize}, src/engine/plan.ts:57) — so the user's newer threat/soil/count edits are silently reverted to the old base, and teamSize is overwritten with the planner-form value. The user believes they picked only a standard/roof/revetment row; they actually got a plan for the wrong threat/soil.

```
case 'plan': openPlan(); break;
case 'plan-run': { ... lastPlan = planForTime({ availableHours: planHours, teamSize: planTeam, base: store.getState().inputs }); ... }
case 'plan-apply': { const opt = lastPlan?.feasible[Number(actionEl.dataset['idx'])]; if (opt) { store.replaceInputs(opt.inputs); history.push(opt.inputs); syncHistory(); hideOverlay(); } break; }
// plan.ts:57: const inputs: Inputs = { ...req.base, standard, overheadCover, revetment, teamSize };
```

**Fix.** All changes in src/ui/main.ts; no engine changes needed. Two-part fix to close both staleness windows: (1) In openPlan() (main.ts:163-165), recompute before rendering when a plan exists: `if (lastPlan) lastPlan = planForTime({ availableHours: planHours, teamSize: planTeam, base: store.getState().inputs });` — this keeps the reopened table's elapsed-hours honest for current inputs instead of showing an empty state (better than nulling lastPlan on every commit, which loses the result and touches more call sites). (2) In the 'plan-apply' case (main.ts:510), stop applying the embedded snapshot; apply only the option's delta onto CURRENT inputs: `const next: Inputs = { ...store.getState().inputs, standard: opt.standard, overheadCover: opt.overheadCover, revetment: opt.revetment, teamSize: lastPlan!.teamSize }; store.replaceInputs(next); history.push(next); ...` — this also covers the Ctrl+Z-while-overlay-open window (global keydown handlers at main.ts:540-542 can mutate inputs under an open overlay). Edge cases to preserve: (a) teamSize must still come from the plan (lastPlan.teamSize, already clamped via Math.max(1, Math.round()) in plan.ts:51), since the displayed elapsed-hours depend on it — do not drop it from the delta; (b) keep history.push + syncHistory + hideOverlay exactly as-is so undo still restores pre-apply inputs; (c) planOverlay's empty state (plan===null) must still render the intro prompt — part (1)'s recompute only fires when lastPlan is non-null, preserving that; (d) plan-run behavior (main.ts:501-506) is already fresh — leave it untouched. Optional pin: a small test asserting that applying an option's delta over mutated inputs preserves the mutated threat/soil would live at the engine level (pure function extracted from the plan-apply delta merge) since main.ts has no DOM test harness; extracting `applyPlanOption(current: Inputs, opt: PlanOption, teamSize: number): Inputs` into src/engine/plan.ts with a 5-line test in test/plan-mission.test.ts is the cheapest way to pin it.

#### 17. TIMBER-1 canvas height balloons by the scroll offset on every resize

`src/ui/woodframe-scene.ts:69` · **HIGH** · ui · effort: trivial

**Problem.** fitViewport() computes the canvas height from viewport.getBoundingClientRect().top, which is scroll-position-dependent (negative once the user scrolls past the viewport). Any resize event that fires while the page is scrolled makes h = innerHeight + |scrollY| instead of the remaining screen height. On mobile browsers, resize fires constantly (URL-bar collapse/expand while scrolling, orientation change), so a user who scrolls down to the plate layout strips gets a canvas that jumps to roughly innerHeight + scrollY tall, massively growing the page; each further resize while scrolled compounds it. Verified live: at scrollY=0 the canvas was 575.5px tall; after window.scrollTo(0,600) + one resize event it became 1101px (top was -297); in an earlier state it reached 1798.5px.

```
function fitViewport(): void {
  const w = Math.max(1, viewport.clientWidth);
  const h = Math.max(320, window.innerHeight - viewport.getBoundingClientRect().top - 8);
  renderer.setSize(w, h);
```

**Fix.** One-line change in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/woodframe-scene.ts line 69: replace the scroll-dependent rect top with the document-relative offset by adding window.scrollY back in — `const h = Math.max(320, window.innerHeight - (viewport.getBoundingClientRect().top + window.scrollY) - 8);`. rect.top + scrollY is scroll-invariant, and because it is recomputed on every resize it still tracks the header/toolbar wrapping to more rows at narrow widths (which a one-time cached offset would not). Prefer this over viewport.offsetTop: offsetTop happens to equal the document offset today (no positioned ancestor between #viewport and body), but rect.top + scrollY stays correct if someone later positions <main>. Edge cases to preserve: keep the 320px minimum clamp and the -8 bottom margin; keep the same formula for both the perspective aspect and the ortho top/bottom (h/w) that follow at lines 71-75, which need no change. Known remaining (acceptable) behavior: on mobile, innerHeight itself still changes as the URL bar collapses, so the canvas height will shift by the URL-bar height during scroll — bounded and harmless; if jitter is ever unwanted, switch to visualViewport.height or debounce, but that is out of scope. Verification: in the dev preview, scroll to the strips, dispatch new Event('resize') on window, and confirm the canvas height stays equal to its scrollY=0 value instead of growing.

---

## Phase 2 — UX, robustness & accessibility (medium)

#### 18. Install swallows precache failure — SW takes control with an empty cache, then serves undefined offline

`public/sw.js:9` · **MEDIUM** · bug · effort: trivial

**Problem.** `caches.addAll(CORE)` is atomic: if any one of the four CORE fetches fails (flaky network on first load, or a deploy where icons/icon.svg 404s — note the SW would also cache that 404 per the other finding), the whole precache rejects. The `.catch(() => undefined)` converts that into a successful install, so skipWaiting + clients.claim promote a SW whose cache is empty, and install never re-runs to retry. Later, offline, the fetch catch's `caches.match('./index.html')` resolves to undefined; respondWith settling with undefined rejects and the user gets the browser's generic network-error page — while the app has been claiming PWA/offline capability since registration succeeded. Also, non-navigation failures hit the same undefined path.

```
e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => undefined));
...
.catch(() => caches.match('./index.html'))
```

**Fix.** Single file: /Users/zacharytraphagen/FieldFortificationsCalculator/public/sw.js. (1) Line 9: drop the `.catch(() => undefined)` so a failed precache fails install — `e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));`. A failed install leaves no SW (or the previous one) in control and the browser retries on the next registration; registration in src/ui/main.ts:743 already catches failures so nothing user-visible breaks. Keep skipWaiting (no-op on failed install). (2) Line 34: guard the fallback so respondWith always gets a Response — `.catch(async () => (await caches.match('./index.html')) || Response.error())`. Edge cases to preserve: GET-only + same-origin-only handling (lines 21-23); runtime cache.put of successful responses (line 31); './index.html' relative resolution against the SW script at scope root (sw.js is served from /, so it resolves to /index.html — unchanged). Note addAll also rejects on non-ok responses, so a deployed 404 for icons/icon.svg will now block install until fixed — that is the intended fail-closed behavior. Optional (skip per ponytail): per-URL allSettled precache requiring only index.html; not needed for the minimal fix.

#### 19. Offline fallback returns SAP-1 index.html for every failed same-origin GET, including other pages and subresources

`public/sw.js:34` · **MEDIUM** · ux · effort: small

**Problem.** The single catch-all `caches.match('./index.html')` is applied to ALL same-origin GET failures, not just navigations to the main app. Failure scenarios: (1) user who has used SAP-1 opens /hub.html or /woodframe.html for the first time while offline — the SW (scope covers the whole origin via clients.claim) serves the SAP-1 planner under the hub/TIMBER-1 URL, a silently wrong page; (2) any failed asset request (CSS, JS chunk, manifest) receives an HTML body with the wrong Content-Type, producing confusing MIME-refusal errors instead of a clean network failure. Note also that only index.html registers the SW (main.ts:741) — hub.html has no script at all — so users whose entry point is the hub never get offline support for any page.

```
.catch(() => caches.match('./index.html'))
```

**Fix.** All changes are small and localized.

1. /Users/zacharytraphagen/FieldFortificationsCalculator/public/sw.js — scope the fallback and precache all pages:
   - Bump `CACHE` to 'sap1-v2' (the activate handler already purges old caches; the byte change also triggers SW update, and skipWaiting+clients.claim roll it out).
   - Extend CORE with the other emitted pages: './hub.html', './woodframe.html' (asset filenames are deterministic/hashless per vite.config.ts, so optionally also './assets/index.js', './assets/woodframe.js' — but pages alone satisfy this finding).
   - Replace line 34's catch with a navigate-only, per-page fallback:
     `.catch(() => e.request.mode === 'navigate' ? caches.match(e.request, { ignoreSearch: true }).then((p) => p || caches.match('./index.html')) : Response.error())`
     Note: the outer `caches.match(e.request)` before fetch uses exact search params, so the ignoreSearch retry inside the catch is the per-page fallback; keep './index.html' only as the last resort for the root scope ('/'). If stricter behavior is wanted, gate the './index.html' fallback to `url.pathname` of '/' or '/index.html' and return Response.error() for uncached other pages — an honest offline error beats a silently wrong page.
   - Edge cases to preserve: never intercept cross-origin (keep the origin check); non-GET passthrough; `caches.match` resolving undefined inside respondWith yields a network error, which is acceptable; file:// standalone never runs the SW (registration guard in main.ts already handles this).

2. Registration gap (called out in the finding's note): add a tiny inline registration script to /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/hub.html and reuse the same three-line guarded snippet in woodframe.html (or woodframe-scene.ts), mirroring main.ts:741-746 (`'serviceWorker' in navigator && location.protocol.startsWith('http')`). hub.html currently has no script tag at all, so inline is the minimal change; vite inlines it fine.

3. Verification: no existing test pins sw.js. Add one small assert-based check (e.g. test/sw-fallback.test.ts) that loads public/sw.js as text and asserts the catch handler branches on `request.mode`/navigate — or, more robustly, unit-test the extracted fallback decision as a pure function if sw.js is refactored to expose one. Manual check: build, serve dist, load index.html twice online, go offline (DevTools), navigate to /hub.html → expect hub page (precached) not SAP-1; request a bogus /assets/nope.js → expect network error, not HTML.

#### 20. build-standalone silently falls back to multi-page dist/ and emits a broken file:// artifact

`scripts/build-standalone.ts:16` · **MEDIUM** · build · effort: small

**Problem.** The inliner prefers dist-standalone/ but falls back to dist/ when dist-standalone/index.html is absent. Since the (uncommitted) vite.config.ts went multi-page, dist/index.html's entry chunk statically imports a shared chunk (verified: dist/assets/index.js begins with import{...}from"./three-viewer.js"). The npm script `build:standalone` runs ONLY the inliner (package.json line 18: "node --import tsx scripts/build-standalone.ts" with no preceding vite build), so on any tree where dist/ exists but dist-standalone/ does not (fresh clone after plain `vite build`, or after cleaning dist-standalone/), it inlines the multi-page entry, strips the modulepreload hints that would reveal the dependency, prints a success message, and writes dist/sap1.html whose inline module still does `import "./three-viewer.js"` — which fails from file:// (the artifact's only purpose), yielding a blank page. The related `if (!existsSync(p)) return m;` guards (lines 30, 38) likewise leave un-inlined <script src>/<link href> tags in the output without any error or non-zero exit.

```
const SRC = existsSync(join(SINGLE, 'index.html')) ? SINGLE : DIST;
...
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (m, src: string) => {
  const p = resolve(src);
  if (!existsSync(p)) return m;
```

**Fix.** Two files. (1) scripts/build-standalone.ts: delete the fallback — replace line 16 with `const SRC = SINGLE;` (keep DIST only as the output dir for sap1.html, which must stay in dist/ so check-offline scans it and the static server serves it); the existing lines 19-22 already print the right error and exit(1) when dist-standalone/index.html is missing. Change both silent guards (lines 30 and 39) from `return m;` to console.error + process.exit(1) naming the missing asset. Add a single-chunk assertion inside the script-inline callback: if `/^\s*import[\s{"']/.test(js)` fail with 'entry chunk has static imports — not a single-chunk build; run vite build -c vite.standalone.config.ts' (rollup hoists static imports to the top of minified output, so this is reliable and avoids false positives from string literals deeper in the bundle). After the replaces, assert `!/<script\b[^>]*\bsrc=/.test(html)` and `!/<link\b[^>]*rel="stylesheet"/.test(html)`, exit(1) otherwise. (2) package.json line 18: make the command self-sufficient — `"build:standalone": "vite build -c vite.standalone.config.ts && node --import tsx scripts/build-standalone.ts"`. Edge cases to preserve: `npm run build` (line 17) must keep passing (it will — dist-standalone exists at that point; it now runs the standalone vite build twice, which is acceptable, or drop the now-redundant explicit `vite build -c vite.standalone.config.ts` from `build` and call `npm run build:standalone` there instead); keep the </script>-escaping guard (line 32), the modulepreload/manifest stripping (lines 44-45), and sap1.html landing in dist/. Verify with: `rm -rf dist-standalone && npm run build:standalone` (must now succeed and emit a ~1 MB+ sap1.html) and `npm run build`.

#### 21. build-standalone.ts silently emits a broken air-gap artifact when falling back to multi-page dist/

`scripts/build-standalone.ts:16` · **MEDIUM** · build · effort: small

**Problem.** The inliner prefers dist-standalone/ but silently falls back to dist/ when dist-standalone/index.html is absent. The multi-page dist/ build shares chunks: dist/assets/index.js begins with a static import from "./three-viewer.js". When that entry is inlined into dist/sap1.html as an inline <script type="module">, the import specifier resolves against the document URL (dist/three-viewer.js — which does not exist; the real file is dist/assets/three-viewer.js), so the app never boots; from file:// the module fetch is additionally blocked by CORS. Failure scenario: fresh clone, run `vite build` then the exposed `npm run build:standalone` (without `vite build -c vite.standalone.config.ts` first) — the script prints "wrote dist/sap1.html (N KB)" and exits 0 while producing a blank-page artifact. check-offline cannot catch it because the leftover reference is a relative URL. Verified: the currently built dist/sap1.html is fine (0 unresolved imports) because `npm run build` orders the steps correctly; only the fallback path is broken.

```
const SRC = existsSync(join(SINGLE, 'index.html')) ? SINGLE : DIST;
// dist/assets/index.js (multi-page build) first bytes:
// import{P as E,s as yt,...}from"./three-viewer.js";
```

**Fix.** All changes in /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/build-standalone.ts plus one line in package.json.

1. Remove the dist/ fallback (line 16): set SRC = SINGLE unconditionally; if dist-standalone/index.html is missing, print the existing instructive message ("run `vite build -c vite.standalone.config.ts` first" or "use `npm run build`") and exit 1. Delete the now-false "fall back to dist/ for the legacy single-page pipeline" comment (lines 11-14). Keep the output path join(DIST,'sap1.html'); add mkdirSync(DIST, {recursive:true}) before writeFileSync since dist/ may not exist if only the standalone config was built.

2. Post-inline assertion before writeFileSync: fail (console.error + process.exit(1), do NOT write) if the html still contains (a) a script tag with a src attribute (/<script\b[^>]*\bsrc=/) or (b) a relative bare-chunk import (/\bfrom\s*["']\.{0,2}\//  — Rollup emits minified chunk imports exactly as from"./name.js") or (c) a relative dynamic import (/import\(\s*["']\.{0,2}\//). Verified today's good single-chunk output has zero matches for all three, so no false positive on the blessed path.

3. package.json: make the exposed script self-sufficient — "build:standalone": "vite build -c vite.standalone.config.ts && node --import tsx scripts/build-standalone.ts". Then simplify "build" to "vite build && npm run build:standalone && npm run check:offline" to avoid double-building dist-standalone.

Edge cases to preserve: the </script>-escaping guard when inlining JS (line 32); the stylesheet inlining and modulepreload/manifest link stripping (lines 37-45); check:offline must still run after sap1.html is written (npm run build ordering); the assertion must not fire on the legitimate dist-standalone single-chunk output (verified clean today).

#### 22. build-standalone.ts silently produces a broken sap1.html when it falls back to the multi-page dist/

`scripts/build-standalone.ts:16` · **MEDIUM** · build · effort: trivial

**Problem.** If dist-standalone/index.html is absent (e.g. running `npm run build:standalone` after only a default `vite build`), the script falls back to dist/ — but dist/index.html is now the multi-page build whose entry chunk statically imports the shared chunk (verified in dist/assets/index.js: `...from"./three-viewer.js"`). The inliner only inlines the <script src> tag; the ESM import inside the inlined code remains, and from file:// Chrome blocks relative module fetches (CORS), so the generated dist/sap1.html — the air-gap artifact — dies on load. The script prints a success line ('wrote dist/sap1.html') either way, and the comment calling dist/ the 'legacy single-page pipeline' is stale: dist/ is never single-page anymore, so the fallback can only ever produce a broken artifact.

```
const SRC = existsSync(join(SINGLE, 'index.html')) ? SINGLE : DIST;  // build-standalone.ts:16
// dist/assets/index.js (multi-page build): ...d as Ln}from"./three-viewer.js"
// dist/index.html:13: <link rel="modulepreload" crossorigin href="./assets/three-viewer.js">
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/build-standalone.ts: (a) replace line 16's ternary with `const SRC = SINGLE;` — keep the DIST constant, since the output path join(DIST, 'sap1.html') at line 47 must stay (the suite deploy layout and check:offline both expect dist/sap1.html); (b) the existing existsSync guard at lines 19-22 already prints the correct remediation ('run vite build -c vite.standalone.config.ts first') and exits 1, so it becomes the hard-fail with no new code; (c) rewrite the stale comment at lines 11-14 to state that dist/ is multi-page with shared chunks and is not a valid inline source; (d) edge case: with the fallback gone, `build:standalone` can now run when dist/ does not exist (dist-standalone present, dist absent), so add `mkdirSync(DIST, { recursive: true })` before the writeFileSync at line 47 (import mkdirSync from node:fs). Edge cases to preserve: full `npm run build` chain (vite build → vite build -c vite.standalone.config.ts → this script → check:offline) must keep producing dist/sap1.html from dist-standalone exactly as today; the </script>-escaping and stylesheet inlining logic is untouched. Optional one-line hardening: after inlining, fail if any `<script ... src=` remains in html, catching future regressions where the standalone build itself emits multiple chunks.

#### 23. check-offline gate never scans dist-woodframe/, so the TIMBER-1 publishable artifact bypasses the offline guarantee

`scripts/check-offline.ts:13` · **MEDIUM** · build · effort: small

**Problem.** check-offline.ts hardcodes DIST to ../dist and scans nothing else, while `npm run build:woodframe` (package.json line 20: "vite build -c vite.woodframe.config.ts" with no check step) emits dist-woodframe/woodframe.html, which vite.woodframe.config.ts's own comment calls "publishable to its own webpage" with "same offline posture as the app". If a vendor chunk, citation URL, or future dependency introduces an external URL into the woodframe bundle, every gate stays green and the shipped page silently violates the zero-external-request invariant that check-offline exists to enforce — the exact class of regression the gate was built for, on the one artifact it cannot see.

```
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// package.json: "build:woodframe": "vite build -c vite.woodframe.config.ts"
```

**Fix.** Two files. (1) /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/check-offline.ts: replace the single hardcoded DIST constant with roots derived from argv — const args = process.argv.slice(2); const roots = (args.length ? args : ['dist']).map(d => fileURLToPath(new URL('../' + d, import.meta.url))). In main(), loop over roots; preserve the existing pass-when-missing behavior ONLY for the default (no-args) invocation so "npm run verify" still passes on a fresh checkout before any build, but exit 1 if an explicitly named root is missing (catches typos and stale-artifact publishes). Generalize the offender path display (currently file.replace(DIST, 'dist')) to replace each root with its basename so output reads dist-woodframe/... correctly. Update the final PASS log to name the scanned roots. Keep ALLOW list, TEXT_EXT filter, and all three regex patterns untouched. (2) /Users/zacharytraphagen/FieldFortificationsCalculator/package.json line 20: "build:woodframe": "vite build -c vite.woodframe.config.ts && node --import tsx scripts/check-offline.ts dist-woodframe". Edge cases to preserve: default "npm run check:offline" (used by verify and build) must keep scanning dist/ exactly as today including pass-on-missing; the W3C namespace allowlist must still apply to the woodframe bundle (its SVG output relies on it); dist-standalone needs no separate scan since its content is inlined into dist/sap1.html which is already scanned. Verification: run npm run build:woodframe and confirm PASS; then temporarily inject an https:// URL into src/ui/woodframe-scene.ts, rebuild, and confirm exit 1.

#### 24. SPA fallback serves SAP-1 index.html for extensionless multi-page routes (/hub, /woodframe)

`scripts/serve.js:56` · **MEDIUM** · ux · effort: trivial

**Problem.** serve.js still assumes a single-page app, but dist/ is now multi-page (index.html, hub.html, woodframe.html all confirmed present in dist/). Any extensionless miss falls back to index.html, so on the deployed Replit URL a user who types or shares /hub or /woodframe (without .html) gets the SAP-1 planner with a 200 status instead of the hub or TIMBER-1 page — silently the wrong app, no 404 to hint at the mistake. Internal links in hub.html use explicit ./woodframe.html so in-app navigation works; only bare-path URLs break. The fallback should map known extensionless routes (or any /<name> where dist/<name>.html exists) to the matching page.

```
let resolved = await fileAt(target);
if (!resolved && !extname(rel)) resolved = await fileAt(join(DIST, 'index.html'));
```

**Fix.** Edit /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/serve.js, replacing line 56 with a two-step fallback:

let resolved = await fileAt(target);
if (!resolved && !extname(rel)) {
  resolved = await fileAt(join(DIST, rel + '.html'));            // /hub -> hub.html, /woodframe -> woodframe.html
  if (!resolved) resolved = await fileAt(join(DIST, 'index.html')); // SPA fallback stays last
}

Edge cases to preserve: (1) traversal guard — `rel` was already validated via `target.startsWith(DIST + sep)` before this point, and appending '.html' to a path inside DIST cannot escape it, so no new guard needed; (2) MIME type — the resolved path ends in .html so the existing `MIME[extname(resolved)]` lookup emits text/html automatically; (3) index.html must remain the FINAL fallback so unknown extensionless routes (e.g. /foo) still get the SPA rather than a 404, matching current behavior; (4) directories like /assets still fall through to index.html as before (fileAt returns null for dirs, 'assets.html' doesn't exist). Optional nicety, not required: strip a trailing slash from rel so /hub/ also maps to hub.html; currently /hub/ would fall to index.html same as today. Verify with: PORT=5187 node scripts/serve.js & curl -s http://127.0.0.1:5187/hub | grep '<title>' (expect "Combat Engineer Toolkit") and same for /woodframe (expect the TIMBER-1 title), plus /nonexistent still returning index.html.

#### 25. serve.js SPA fallback serves the SAP-1 app for extensionless multi-page routes (/hub, /woodframe)

`scripts/serve.js:56` · **MEDIUM** · ux · effort: trivial

**Problem.** Any extensionless path that is not an exact file falls back to dist/index.html. The dist/ it serves is now multi-page (verified: dist/ contains hub.html and woodframe.html), so a user or shared link hitting /hub or /woodframe on the Replit deployment silently receives the full SAP-1 planner instead of the suite landing page or TIMBER-1 — no 404, no redirect, just the wrong app. The fallback predates the multi-page migration and was correct when index.html was the only page.

```
let resolved = await fileAt(target);
if (!resolved && !extname(rel)) resolved = await fileAt(join(DIST, 'index.html'));
```

**Fix.** One-line insert in /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/serve.js between lines 55 and 56: after `let resolved = await fileAt(target);` add `if (!resolved && !extname(rel)) resolved = await fileAt(join(DIST, rel + '.html'));` and keep the existing index.html fallback as the last resort (all needed imports — join, extname — are already in scope). Edge cases the fix must preserve: (1) traversal guard — rel has already passed the startsWith(DIST) check on `target`, and appending '.html' to a path inside DIST cannot escape it, so no new guard is needed; (2) `/` and `''` still map to index.html via the existing `rel = 'index.html'` normalization at line 48; (3) directory hits like /assets and trailing-slash paths like /hub/ behave as before (the '.html' probe misses, falls through to the old fallback); (4) paths with extensions (e.g. /missing.png) still 404 — the new probe is gated on `!extname(rel)` just like the old fallback. Optional hardening (skippable per the auditor's note that the app has no client-side routes): drop the index.html fallback entirely so unknown extensionless paths 404; but the minimal insert alone fixes /hub and /woodframe. Verify by running `node scripts/serve.js` after a build and curling /hub, /woodframe (expect hub.html/woodframe.html bodies) and /nonexistent.png (expect 404).

#### 26. No relational validation on import: excavationSplit fractions can be filled to sum != 1, breaking the declared exact stage partition

`src/doctrine/io.ts:175` · **MEDIUM** · data · effort: small

**Problem.** doctrine/stages.ts declares the invariant that the four excavationSplit fractions 'sum to 1 so the partition is exact' and engine/stages.ts relies on it ('per-stage man-hours sum EXACTLY to the position total'). importDoctrine validates each entry only in isolation (finite, 0 <= v < 1000), so a fill setting stages.excavationSplit.hasty to 0.9 while the others keep 0.05/0.45/0.2 is accepted — reproduced: after the import the live fractions sum to 1.6. computeStages then emits security/hasty/deliberate/parapet man-hours totalling excav*1.6 while StagePlan.totalManHours still reports result.labor.manHoursPerPosition, so the displayed stage clock and scheduleStages cumulative/feasibility/shortfall numbers are inflated ~60% relative to the published labor total. The stage-partition test only runs against the pristine placeholder values, so a bad fill ships silently.

```
if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value >= MAX_MAGNITUDE)) {
  rejected.push({ path, reason: 'number out of range (0 ≤ v < ' + MAX_MAGNITUDE + ')' });
  continue;
}
```

**Fix.** File: src/doctrine/io.ts. After the per-entry loop (line 188) and BEFORE the `if (rejected.length > 0)` all-or-nothing gate at line 192, add a cross-field invariant pass over the would-be post-apply state so violations merge into the same rejected[] report (this automatically covers dryRun previews too, since the dryRun branch is later). Implementation: build `const stagedByPath = new Map(staged.map(s => [s.path, s.value]))` and a helper `eff(path) => stagedByPath.has(path) ? stagedByPath.get(path) : getByPath(path)?.value`. Invariant 1 (the confirmed bug): sum of eff('stages.excavationSplit.security'|'.hasty'|'.deliberate'|'.parapet') must satisfy |sum - 1| < 1e-9; otherwise push {path:'stages.excavationSplit', reason:'fractions must sum to 1 (got <sum>)'}. Skip the check gracefully (no crash) if a leaf is missing from the registry. Invariant 2 (same hook, auditor's secondary): walk 'protection.spanSizes[i].maxSpan' for i=0,1,2... while getByPath returns a leaf; require non-decreasing effective values, else reject with a clear reason — stringerSizeForSpan's first-match loop depends on ascending order. Edge cases the fix must preserve: (a) a file touching NONE of the four fractions must still pass (eff falls back to live values which sum to 1 — including after a previous good fill changed them); (b) re-importing a pristine exportDoctrine() file must pass (0.05+0.3+0.45+0.2 has float dust, hence the 1e-9 epsilon — do NOT use exact equality); (c) partial fills touching only some fractions are validated against the live remainder, which is the correct semantics since commit mutates in place; (d) all-or-nothing stays intact — nothing is mutated when the invariant fails, and the report message/count format is unchanged. Tests: extend test/doctrine-io.test.ts with three cases: hasty=0.9 alone → ok:false, live value unchanged (0.3), rejected reason mentions sum; all four set to 0.25 → ok:true and computeStages partition still exact; protection.spanSizes[0].maxSpan=999 → ok:false. Effort: ~30 lines of code + ~30 lines of test.

#### 27. importDoctrine silently ignores the entry's declared unit — a value transcribed in the wrong unit is applied unchecked to safety-critical leaves

`src/doctrine/io.ts:170` · **MEDIUM** · data · effort: trivial

**Problem.** exportDoctrine emits unit (e.g. 'ft') on every DoctrineEntryDTO, so the file format advertises the field, and the whole workflow is 'a qualified user fills real values OFFLINE'. But the validation loop never reads e['unit']: an entry like {path:'protection.radiationHalving.soil', value:0.15, unit:'m', status:'DOCTRINE', source:'FM 5-103'} passes all checks and 0.15 is applied as FEET (the app's internal unit) — a 3.28x error on a safetyCritical shielding value, exactly the 'transcription error, not real doctrine' class the importer's own MAX_MAGNITUDE bound exists to catch. The commit comment ('unit ... never come[s] from a file') covers not applying units, but a declared unit that CONTRADICTS the target's unit is silently accepted rather than rejected, violating the strict all-or-nothing validation posture at this trust boundary.

```
const value = e['value'];
if (typeof value !== typeof target.value) {
  rejected.push({ path, reason: 'value type mismatch' });
  continue;
}
```

**Fix.** 1) In /Users/zacharytraphagen/FieldFortificationsCalculator/src/doctrine/io.ts, inside the entry loop, after the value type/range checks (~line 178), add a strict unit-consistency guard: const unit = e['unit']; if (unit !== undefined && unit !== target.unit) { rejected.push({ path, reason: 'unit mismatch (file: ' + String(unit) + ', expected: ' + (target.unit ?? 'none') + ')' }); continue; } Use the strict form (reject a declared unit even when target.unit is undefined, and reject non-string units automatically since they never equal a string) rather than the auditor's both-defined form - a declared unit on a unit-less leaf is equally a contradiction. 2) Add one assertion to the 'rejects the specific hazards' test in /Users/zacharytraphagen/FieldFortificationsCalculator/test/doctrine-io.test.ts: pick a path whose registry leaf has unit 'ft' (e.g. via all().find(en => getByPath(en.path)... or just use exportDoctrine().entries.find(en => en.unit === 'ft')) and assert !importDoctrine(mk({ path: thatPath, unit: 'm' })).ok. Edge cases the fix must preserve: (a) export-then-reimport round-trip still passes (export emits units identical to the registry, so unit === target.unit); (b) entries that OMIT unit remain valid (undefined skips the check) - this keeps fullFill()/ORIGINAL test fixtures and any previously saved doctrineFill blobs working; (c) all-or-nothing semantics unchanged (guard uses the same rejected.push + continue pattern before any mutation); (d) do NOT start applying e['unit'] to leaves - unit stays structural, this is validation only. Run npm test (doctrine-io.test.ts and doctrine-integrity) to confirm no regressions.

#### 28. Overhead-cover BOM omits sheathing/dustproof layers although doctrine defines them — dead safety-relevant leaves users are asked to verify

`src/doctrine/protection.ts:187` · **MEDIUM** · data · effort: small

**Problem.** overhead.sheathingThickness (~1 in roof sheathing) and overhead.dustproofThickness are registered Provenance leaves — they appear in the placeholder counts, the doctrine-fill table, and DOCTRINE_SOURCES.md as values to confirm — but grep shows zero consumers anywhere in src/engine, src/render, or src/render3d. Consequences: (1) the BOM for every covered position lists stringers at 1.0-ft spacing plus loose soil/sandbag fill with NO sheathing line, so the mission order sheet omits a required material (soil poured on stringers spaced 1 ft apart with ~8-in gaps falls through — the layer doctrine itself defines); (2) a user who fills/verifies these two safety-relevant values via doctrine import changes nothing in any output, contradicting the app's core promise that filled doctrine values drive the numbers (the same dead-leaf class the validate.ts:41-43 comment treats as a pre-Phase-1 bug for retainingWall.maxHeight).

```
sheathingThickness: P(0.083, { unit: 'ft', note: 'roof sheathing ~1 in (illustrative)' }),
dustproofThickness: P(0.02, { unit: 'ft', note: 'dustproof layer (illustrative)' }),
// grep -rn sheathingThickness|dustproofThickness src/ test/ → only this definition
```

**Fix.** Consume the leaves rather than delete them (deletion would change the io.ts export checksum, orphan the DOCTRINE_SOURCES.md rows, and make older doctrine files import with rejected paths). Concretely: (1) src/engine/compute.ts — in the earth-roof block (~lines 220-245, next to coverL/coverW at 221-222), add `const sheathingArea = buildsEarthRoof ? coverL * coverW : 0;` and (if billing the dustproof layer separately) `dustproofArea` the same way; export both plus the leaf references (like coverLeaf/radHalvingLeaf are exported) on the Calc interface (~line 79). (2) src/engine/materials.ts — in buildBom, add `add('roof_sheathing', 'Roof sheathing', 'ft²', calc.sheathingArea, 61, isPh(overhead.sheathingThickness.status) || dimsPh)` and a parallel 'dustproof_layer' line at sortKey 62 keyed on dustproofThickness.status; import `overhead` from ../doctrine/protection. The existing add() guard already omits the lines when qty is 0. (3) Cover-height math: do NOT fold the ~1.2 in combined thickness into coverT (that would silently change shielding/rad-halving numbers); instead add a one-line comment at compute.ts:183 documenting the deliberate exclusion of sheathing/dustproof thickness from protective thickness, satisfying the "explicitly document its exclusion" branch. (4) Tests — add cases to the existing engine BOM test file: earth-roof position emits roof_sheathing and dustproof_layer with area coverL*coverW and fromPlaceholder true; roofPath 'none' and 'engineered_required' emit neither (preserves the §2.7 invariant that engineered roofs get no fabricated material); flipping the leaf status to DOCTRINE clears fromPlaceholder. If any test pins the exact BOM line count or CSV snapshot, update it. (5) DOCTRINE_SOURCES.md:175-176 — flip the "consumed" column for both rows. Edge cases to preserve: zero-line omission, deterministic sortKey ordering (61/62 slot after stringers at 60), the sandbagged vs loose-fill cover split at compute.ts:243-245 (sheathing applies to both), and vehicle positions (buildsEarthRoof already gates correctly via coverOn/roofPath).

#### 29. Unknown revetment string silently drops revetment materials and labor — the only doctrine fallback with no validation error

`src/engine/compute.ts:141` · **MEDIUM** · bug · effort: small

**Problem.** positionType, soil, threat, and standard all set calc.invalid flags and raise error-severity issues when unknown, but an unknown revetment id silently resolves to the 'none' row with no flag and no code (codes.ts has no INVALID_REVETMENT; validate.ts:21-24 checks only the other four). The import schema (src/state/schema.ts:62-63) only requires revetment to be a string, so a hand-edited or externally generated plan JSON with a typo ('sandbag-facing') validates cleanly. Verified: loam + revetment 'sandbag-facing' computes 0 errors, omits the sandbags_revet BOM line, and drops 2.0 mh of revet labor versus the intended plan — the position is silently under-planned with no revetment materials on the order sheet. (On revet-forced soils the user instead gets the misleading REVET_REQUIRED_SOIL 'none is selected' error while their file names a revetment.)

```
const revet = revetments[raw.revetment] ?? revetments['none']!;
// vs the pattern used for the other four:
const posRow = positions[raw.positionType];
const invalidPosition = posRow === undefined;
// validate.ts:21-24 — no revetment case; codes.ts — no INVALID_REVETMENT
```

**Fix.** Mirror the INVALID_SOIL pattern in four files. 1) src/engine/compute.ts: in computeCalc replace line 141 with the three-line pattern used for soil — `const revetRow = revetments[raw.revetment]; const invalidRevetment = revetRow === undefined; const revet = revetRow ?? revetments['none']!;` — extend the Calc interface's invalid member (line 47) to `{ position; soil; threat; standard; revetment }` and add `revetment: invalidRevetment` to the invalid object literal at line 288. No special-casing of 'none' is needed: 'none' is a real key in the revetments table (src/doctrine/materials.ts:33), so it never flags. 2) src/engine/codes.ts: add `INVALID_REVETMENT: def('INVALID_REVETMENT', 'error', 'Unknown revetment — treated as none.')` next to the other INVALID_* defs. 3) src/engine/validate.ts: after line 24 add `if (calc.invalid.revetment) errors.push(issue(CODES.INVALID_REVETMENT));`. 4) test/validate.test.ts: add `{ revetment: '___' }` to the scenarios array in the 'each validation code is reachable' test (lines 13-32) — this test asserts every catalog code fires, so the fix FAILS CI without it. Edge cases to preserve: (a) revetment 'none' stays error-free (covered by the existing 'clean deliberate build' test at line 54); (b) unknown revetment on a revet-forced soil will now fire BOTH INVALID_REVETMENT and REVET_REQUIRED_SOIL — acceptable and arguably correct (the invalid error explains why 'none' is in effect); leave as-is rather than suppressing; (c) tiered-ordering test (errors first) is unaffected since the new push is in the errors block; (d) fuzz.test.ts only draws valid keys so it is unaffected. Skip the auditor's optional schema.ts membership check: schema deliberately does not enforce doctrine membership for positionType/soil/threat either — engine-level validation with a visible error is this codebase's established pattern, and a schema reject would break forward-compat with doctrine-table edits.

#### 30. planForTime recommends configurations the engine itself flags as errors (revet-forced soils) with no indication

`src/engine/plan.ts:79` · **MEDIUM** · bug · effort: small

**Problem.** The planner's search space includes revetment 'none' but never inspects the computed result's validation. On sand or gravel (soils.revetForced=true), every 'none' option carries the error-severity REVET_REQUIRED_SOIL issue ('walls will slough'), yet PlanOption carries no error info and planOverlay (src/layout/tools.ts:234-241) renders it as a ranked feasible row with a 'Use' button. Verified: soil=sand, one_man, budget 5.7 h, team 1 → the feasible list is exactly ['hasty/none/4.7h'] — the tool's single recommendation is a build whose walls slough per the engine's own doctrine check, presented as the achievable standard with nothing flagging it. test/plan-mission.test.ts only exercises loam.

```
const feasible = options.filter((o) => o.feasible).sort(rank);
// options are built from compute(inputs) but r.validation is never read;
// REVETS = ['none', 'sandbag_facing', 'pickets_wire'] includes 'none' even when soil.revetForced
```

**Fix.** Fix in src/engine/plan.ts (engine) so every consumer benefits, plus a pinning test.

1. src/engine/plan.ts:
   - Add `hasErrors: boolean` to PlanOption. In the loop (after `const r = compute(inputs)`), set `hasErrors: r.validation.some(v => v.severity === 'error')` — compute is already called, zero added cost.
   - Change line 79 to exclude errored options from the feasible list: `options.filter(o => o.feasible && !o.hasErrors)`.
   - For infeasibleBest, prefer valid options: rank `options.filter(o => !o.feasible && !o.hasErrors)` first; if that is empty but errored fitting options exist, fall back to the current behavior (or return null — planOverlay already renders '—' for null). Recommended simple form: infeasibleBest = best of (!feasible && !hasErrors), else null.
   - Degenerate-case guard (important edge case): INVALID_SOIL/INVALID_THREAT/INVALID_POSITION/INVALID_STANDARD errors come from base inputs and apply to ALL 18 options equally, which would empty both feasible and infeasibleBest. Either accept that (the main view already flags invalid base inputs, and the UI selects make invalid keys unreachable except via imported state), or restrict the disqualifier to the only code that varies across the search space: `r.validation.some(v => v.severity === 'error' && v.code === 'REVET_REQUIRED_SOIL')`. The narrow REVET-only check is the safer minimal fix; if chosen, mark it with a `ponytail:` comment noting the ceiling (future search-space-dependent error codes need adding).

2. src/layout/tools.ts: no change required if errored options are excluded from `feasible` (all rendered rows are then valid). Optionally extend the empty-state copy ('Nothing fits...') — it already handles the sand/tight-budget case correctly by pointing at infeasibleBest, which after the fix will be the cheapest VALID build (e.g. hasty/sandbag_facing), i.e. correct guidance: 'you need X hr to build something that will not slough'.

3. test/plan-mission.test.ts: add one test pinning the fix — `planForTime({availableHours: 5.7, teamSize: 1, base: defaultInputs({ soil: 'sand', positionType: 'one_man', standard: 'hasty', threat: 'sa-556', overheadCover: false, teamSize: 1 })})` asserts (a) no feasible option has revetment 'none' (or more directly: no feasible option's compute() has an error-severity issue), and (b) infeasibleBest is non-null and has revetment !== 'none'. Also assert existing loam tests still pass unchanged (they will: loam is revetForced=false, and the impossible-budget test's infeasibleBest stays non-null since loam 'none' options carry no errors).

Edge cases the fix must preserve: deterministic ordering (existing rank + tieKey untouched); the impossible-budget test (budget 0.001, loam) must still return infeasibleBest !== null; plan-apply indexing in src/ui/main.ts:510 uses lastPlan.feasible[idx], which stays consistent because tools.ts renders from the same filtered array.

#### 31. computeStages subtracts LIVE doctrine adder values from compute()'s module-load labor snapshot — stage hours corrupt (can go negative) after a doctrine fill

`src/engine/stages.ts:53` · **MEDIUM** · bug · effort: small

**Problem.** This is a distinct downstream corruption beyond the already-reported 'compute snapshots labor doctrine at module load' finding: excavationLabor() in stages.ts recovers the excavation share by subtracting the four adders read LIVE from doctrine/labor (a.overheadAdd.value etc. at call time), while result.labor.manHoursPerPosition was built from the values snapshotted into baseLabor at module load (compute.ts:354-362). The two modules read the same leaves at different times. Failure scenario: user applies a doctrine import (or restoreFill on a later boot re-applies one) that raises overheadAdd from 4.0 to 8.0 with an earth roof on — manHoursPerPosition still embeds 4.0, excavationLabor subtracts 8.0, so the excavation stages are under-counted by 4 mh; on a small position (one_man hasty, total ~6 mh) 'excav' goes NEGATIVE and the Build-schedule overlay and job-sheet priorities-of-work table print negative or decreasing per-stage man-hours while claiming the partition 'sums exactly'.

```
// stages.ts:51-57 (LIVE reads)
const a = laborDoctrine;
if (roofEarth) adders += a.overheadAdd.value;
return l.manHoursPerPosition - adders;
// compute.ts:354-355 (module-load snapshot)
const baseLabor = { baseMH: laborDoctrine.baseMH.value, ...
```

**Fix.** One change in src/engine/compute.ts plus one test. (1) compute.ts: delete the module-scope snapshot at lines 354-362 and move the `const baseLabor = { ... }` object literal (same property names, same laborDoctrine reads) INSIDE computeCalc, just above the labor block at line ~263 — this keeps lines 265-276 (baseMH, perVolMH, overheadAdd, revetAdd, sumpAdd, camoAdd, machinePerVolMH usages) textually unchanged while making every leaf read live per call, matching how soil.digFactor/standard.laborMul are already read live on line 266. Move the mid-file `import { labor as laborDoctrine } from '../doctrine/labor'` (line 353) up to the top import block. This single change also fixes the parent 'compute snapshots labor doctrine at module load' finding — both modules now read the same live leaves. (2) Test (extend test/stages.test.ts or add to test/doctrine-io.test.ts): directly mutate `labor.overheadAdd.value` (or apply a minimal importDoctrine payload raising it, e.g. 3.0 → 9.0) inside try/finally that restores the original value so shared module state does not leak into sibling tests in the same process; then for a one_man position with overheadCover on, run compute → computeStages and assert (a) every step.manHours >= 0, (b) sum of step.manHours ≈ result.labor.manHoursPerPosition within 1e-9 (the partition is against the round1'd total, same tolerance the existing partition test uses), (c) the overhead stage's manHours equals the new adder value. Edge cases the fix must preserve: manHoursPerPosition stays round1'd (partition exactness in stages relies on subtracting from the rounded total — unchanged); machineHrsPerPos (line 276) must also read live; determinism/snapshot tests (test/snapshot.test.ts asserts 12.1 mh) still pass because default doctrine values are unchanged at load. No API or type changes.

#### 32. Closed mobile bottom sheet keeps the entire input form keyboard-focusable while aria-hidden

`src/layout/mobile.ts:27` · **MEDIUM** · a11y · effort: small

**Problem.** The closed sheet gets aria-hidden="true" but is hidden only by transform: translateY(100%) (styles.css:204) — no display:none, visibility:hidden, or inert. All controls inside (13+ selects/checkboxes/number inputs from controlsHtml) remain in the tab order. Concrete failure: on the mobile layout with the sheet closed, a keyboard or switch-control user tabbing past the bottom toolbar lands on invisible, offscreen form controls; focus indicator disappears entirely, and a screen reader (which honors aria-hidden) reports nothing while focus is trapped in a dozen ghost fields. This is axe-core's critical 'aria-hidden-focus' violation and a WCAG 2.4.3/4.1.2 failure on the primary input path of the mobile app.

```
'<div class="bottom-sheet" data-open="' + sheetOpen + '" aria-hidden="' + !sheetOpen + '" role="dialog" aria-label="Edit inputs">' +
/* styles.css: .bottom-sheet { transform: translateY(100%); } */
```

**Fix.** Use the native `inert` attribute (baseline-supported since 2023; no polyfill needed for this app). Two files: (1) src/layout/mobile.ts:27 — bake the initial state into the markup, matching the file's own design note that state must be correct in the first paint: add `(sheetOpen ? '' : ' inert')` to the bottom-sheet div, i.e. '<div class="bottom-sheet"' + (sheetOpen ? '' : ' inert') + ' data-open=...'. This matters because the whole shell re-renders via innerHTML on every input change, so applySheet() alone would leave a window where a fresh render lacks inert. (2) src/ui/main.ts applySheet() (~line 616) — add `sheet.inert = !sheetOpen;` next to the aria-hidden toggle so open/close toggles it without a re-render. Edge cases to preserve: (a) when open, controls and the sheet-drag-handle pointerdown path must stay interactive — inert must be strictly false when sheetOpen; (b) closing via Escape/backdrop/swipe while focus is inside the sheet: the browser drops focus to body when the subtree goes inert — optionally restore focus to the toolbar trigger (`app.querySelector('button[data-action="sheet-toggle"]')?.focus()`) in the close paths for better 2.4.3 behavior, but inert alone resolves the aria-hidden-focus violation; (c) do NOT put inert on the sheet-backdrop — it is aria-hidden="true" always and intentionally tap-interactive when open. Leave the aria-hidden toggle in place (harmless alongside inert). Add one small assertion to a test (e.g. new case in an existing layout/shell test file): arrangeMobile(parts, false) markup contains ' inert' and arrangeMobile(parts, true) does not.

#### 33. BOM, Mission BOM, CSV and job sheet ignore the metric display setting — quantities always printed in ft³/ft²/ft while the rest of the same screen converts

`src/layout/panels.ts:96` · **MEDIUM** · ux · effort: small

**Problem.** The units layer's contract (doctrine/units.ts:1-6) is 'math in feet, only display converted; one toggle (Inputs.unit) governs display', and fmtVolume/fmtArea exist for exactly this. But BomLine.unit is hardcoded imperial in engine/materials.ts ('ft³' line 43, 'ft²' line 99, 'ft' line 104), and every consumer prints the raw number + raw unit with no conversion: bomPanel (panels.ts:96), missionOverlay (tools.ts:73), jobSheet BOM rows (jobSheet.ts:79), and toCsv. Meanwhile summaryBar (panels.ts:141) converts the SAME excavation_loose quantity via fmtVolume and the specs panel converts every length. Failure scenario: set units to 'Meters' — the mobile summary bar shows spoil as '2.5 m³' while the BOM card directly below shows '87.5 ft³' for the same number, and every exported artifact (CSV, job sheet, mission rollup) stays imperial; a metric-planning user tasking haul capacity off the Mission BOM gets cubic feet where the app's own toggle promised meters.

```
// panels.ts:96 (BOM row — raw)
'</td><td class="n">' + num(l.qtyTotal) + '</td><td>' + esc(l.unit) + '</td></tr>'
// materials.ts:43  'ft³',
// panels.ts:141 (summary — converted)  cell('Spoil', fmtVolume(spoil, u)) +
// units.ts:2  '...math is done in feet as floats and only display is converted.'
```

**Fix.** Add one shared quantity formatter in src/doctrine/units.ts next to fmtVolume, then route all four consumers through it.

1) src/doctrine/units.ts — add:
   - `qtyToDisplay(qty: number, unit: string, u: UnitSystem): number` — metric: 'ft³'→qty*M3_PER_FT3 (round 2dp), 'ft²'→*M2_PER_FT2 (2dp), 'ft'→*M_PER_FT (2dp); imperial and any other unit ('ea','mh','hr'): passthrough with existing rounding.
   - `qtyUnitLabel(unit: string, u: UnitSystem): string` — metric maps 'ft³'→'m³', 'ft²'→'m²', 'ft'→'m'; everything else passthrough.
   IMPORTANT edge case: do NOT reuse fmtLength for 'ft' BOM lines — that would regress imperial tie-wire from "120 ft" to feet-inches ("120'-0\""). Imperial output strings must stay byte-identical to today.

2) src/layout/panels.ts bomPanel (lines 91-98): pass result.inputs.unit in; render qtyPerPosition/qtyTotal via qtyToDisplay and the unit cell via qtyUnitLabel. Keep BOM_TRACE val() wrapping and num() formatting.

3) src/render/jobSheet.ts (lines 74-81): same treatment using the existing `unit` local (line 48).

4) src/render/csv.ts toCsv (lines 41-44): emit qtyToDisplay(...) for Per position/Total and qtyUnitLabel(...) for Unit, keyed off result.inputs.unit; keep csv's own num() for '.'-decimal/no-grouping. Existing test (test/units-format.test.ts:36-45) uses imperial defaultInputs so it still passes unchanged.

5) src/layout/tools.ts missionOverlay (lines 71-75) + src/ui/main.ts (lines 309-310): convert the Need and Short columns for display via the helpers; the on-hand input must then be interpreted in DISPLAY units — in main.ts convert the entered value back to internal feet-units (divide by the same factor, keyed by the line's unit from the mission lines in state) before storing in the onHand map, so mission.ts shortfall math (src/engine/mission.ts:53) stays in internal units. Change the input from parseInt/step="1" to parseFloat/step="any" for continuous-unit lines (metric m³ values like 2.48 would truncate to 2 under parseInt); keep integer step for 'ea' lines. Also render the stored onHand value converted to display units so it round-trips when the toggle flips.

6) Test (repo requires one runnable check): extend test/units-format.test.ts — compute with unit:'metric', assert toCsv output contains 'm³' and not ',ft³,', and assert qtyToDisplay/qtyUnitLabel mappings including 'ea' passthrough and the imperial-passthrough identity.

Edge cases to preserve: zero-line omission in buildBom untouched (engine stays pure-feet — only render layers change); 'ea'/'mh'/'hr' unaffected in both systems; imperial rendering identical to current output; CSV RFC-4180 rules unchanged; fromPlaceholder handling unchanged.

#### 34. Build-stage scrubber gives no stage name — users must recall what 0–6 mean

`src/layout/shell.ts:163` · **MEDIUM** · ux · effort: small

**Problem.** The 3D stage scrubber is a bare range input 0–6 labeled 'Build stage'; neither shell.ts nor the input handler in main.ts:345-354 renders the current stage's name (the engine has labels via computeStages, and the comment says '0 = post security … 6 = camouflage' — but only in source code). Failure scenario: user drags the slider to 3, the model changes, and nothing on screen says what stage 3 is ('parapet'? 'overhead cover'?) — they cannot connect the model state to the priorities-of-work table without counting stages themselves; screen readers likewise announce only the number. (Distinct from the already-reported never-rendered datalist: even with tick marks, no current-value name is ever displayed.)

```
'<input type="range" id="three-stage" min="0" max="6" step="1" value="6" aria-label="Construction stage" list="stage-ticks">' +
// main.ts input handler: threeStage = ...; threeViewer?.update(...) — no label element updated
```

**Fix.** Use doctrine STAGE_ORDER (fixed 7 entries, index === slider value), NOT computeStages().steps (it drops empty stages, so indices misalign — e.g. when no overhead cover is requested).

1. src/layout/shell.ts (~line 162-164): inside the stageScrubber string, after the input, add an output element, e.g. '<output id="three-stage-name" for="three-stage">' + STAGE_ORDER[6].label + '</output>'. Import STAGE_ORDER from '../doctrine/stages'. Note shell.ts hardcodes value="6"; main.ts:242-243 already re-syncs scrub.value after each shell re-render — extend that same block to also set the output's textContent and the input's aria-valuetext from STAGE_ORDER[threeStage].label so a re-render mid-scrub doesn't show a stale/wrong name.

2. src/ui/main.ts (input handler, lines 345-354): after computing threeStage, look up const label = STAGE_ORDER[threeStage]?.label ?? ''; set document.getElementById('three-stage-name').textContent = label and el.setAttribute('aria-valuetext', label). Import STAGE_ORDER from '../doctrine/stages'. Keep this in the existing lightweight handler — do NOT trigger a shell re-render (the comment at main.ts:342-344 explains dragging must stay smooth).

3. Also set the initial aria-valuetext in the shell markup (aria-valuetext="Camouflage (continuous)" alongside value="6") so the first screen-reader read is correct before any input event.

Edge cases to preserve: stage 0 must display "Post security & stake sectors" (the handler's existing Number.isFinite guard against parseInt falsiness at main.ts:348-351 already handles value 0 — don't disturb it); threeStage>=6 still passes stage:undefined to the viewer (full model) but should still show the camo label; non-WebGL fallback renders no scrubber, so all lookups must stay inside the existing webglOk/element-null guards. Optional CSS: give #three-stage-name a min-width or flex-basis in styles.css so the row doesn't jitter as label lengths change. Per repo convention, one small test (e.g. in test/ alongside engine-palette.test.ts) asserting STAGE_ORDER.length === 7 and that the shell markup for webglOk=true contains id="three-stage-name" pins the contract.

#### 35. Forcing 'Phone' layout preview removes the only control to switch back

`src/layout/shell.ts:101` · **MEDIUM** · ux · effort: small

**Problem.** The 'Screen size' picker row is omitted entirely whenever layoutMode === 'mobile', and resolveLayout returns the override unconditionally (resolve.ts:17), ignoring the real window. So a desktop/tablet user who selects 'Phone' in the menu instantly loses the picker and is stuck in the phone layout. The only in-app exit is the Reset button (main.ts:374-380 resets layoutOverride to 'auto'), which ALSO destroys their inputs; the other escape is knowing that a full page reload drops the override (it is not persisted). Scenario: user tries the Phone preview out of curiosity → trapped, and the documented escape hatch costs them their whole setup.

```
const viewRow =
  state.layoutMode === 'mobile' ? '' :
  '<div class="menu-row">…<select data-action="layout-override"…' 
// resolve.ts: if (e.override !== 'auto') return e.override;
```

**Fix.** 1) src/layout/shell.ts, topbar(), lines 98-103: change the viewRow condition from `state.layoutMode === 'mobile' ? '' : …` to `state.layoutMode === 'mobile' && state.layoutOverride === 'auto' ? '' : …`, and update the comment (hide the picker only when phone layout is genuine/auto; keep it visible while a manual override is pinned so the user can switch back). No other code change needed: the document-level change listener in src/ui/main.ts:328-331 already handles the select regardless of layout, and the hamburger menu markup is shared by all three arrange* layouts. 2) Update the now-stale comment at src/ui/main.ts:370-373 (Reset is no longer the ONLY path back; it still resets the override, which is fine to keep). 3) Do NOT touch src/layout/resolve.ts — test/layout-resolve.test.ts pins that a manual override always wins. 4) Edge cases to preserve: real phones (layoutOverride==='auto', layoutMode==='mobile') must still get no picker row; the selected option must render correctly in the pinned state (overrideOpts already marks state.layoutOverride as selected). 5) Add one small test (e.g. test/shell-topbar.test.ts) building a Result from DEFAULT_INPUTS and asserting renderApp output contains data-action="layout-override" when {layoutMode:'mobile', layoutOverride:'mobile'} and omits it when {layoutMode:'mobile', layoutOverride:'auto'}.

#### 36. Hamburger uses role="menu"/"menuitem" without the ARIA menu keyboard pattern, and contains a non-menuitem <select>

`src/layout/shell.ts:59` · **MEDIUM** · a11y · effort: trivial

**Problem.** The <details> disclosure panel is annotated role="menu" with role="menuitem" buttons, but none of the required menu semantics are implemented: no arrow-key navigation, no Home/End, no aria-haspopup on the trigger, no roving tabindex. Screen readers announce 'menu' and users apply the ARIA menu interaction model (arrow keys) — which does nothing here; only Tab works. Worse, on tablet/desktop the panel's last child is a <div class="menu-row"> containing a <select> (shell.ts:102-103) and there are role="presentation" group-title divs — invalid children for role=menu, so AT item counts and positions ('3 of 12') are wrong. A plain disclosure needs no menu role at all; the comment even says it's meant to work 'with zero extra JS'.

```
'<div class="menu-panel" role="menu">' + items + '</div>' +
...
'<button type="button" class="menu-item" role="menuitem" data-action="...">'
```

**Fix.** Take the suggested "drop the roles" option (matches the file's own stated intent of a zero-JS disclosure). In /Users/zacharytraphagen/FieldFortificationsCalculator/src/layout/shell.ts make three attribute deletions: (1) line 59: change '<div class="menu-panel" role="menu">' to '<div class="menu-panel">'; (2) line 65: remove ' role="menuitem"' from the menuItem button template; (3) line 73: remove ' role="presentation"' from menuGroupTitle (a plain div is already non-semantic, and without the menu role the presentation role serves no purpose). With the menu role gone, the <select> in viewRow (lines 102-103) becomes a legitimate child and needs no relocation, and the group titles are ordinary visible text. Edge cases to preserve: keep the class names menu-panel/menu-item/menu-group-title/menu-row unchanged — main.ts:261 uses '.menu-panel' in its focus-restore fallback selector, main.ts close handlers select 'details.menu', and styles.css targets the classes (no CSS selects on role). No tests reference these roles so nothing else changes. Do NOT implement APG menu keyboard handling — it adds JS for no benefit over the native disclosure pattern, contradicting the component's design comment.

#### 37. Doctrine fill-table value editors have no accessible name

`src/layout/tools.ts:190` · **MEDIUM** · a11y · effort: trivial

**Problem.** Every 'New value' editor in the doctrine fill table — the number/text input and the boolean <select> — has no label, aria-label, or title. Accessible name is empty. Concrete failure: a screen-reader user in the Doctrine values overlay (the workflow that clears the NOT-FOR-FIELD-USE banner) tabs through dozens of identical unnamed 'edit text' / 'spin button' fields with no way to tell which doctrine path (e.g. a safety-critical cover thickness) each edits — the path is only in a sibling <td>. Misfiling a safety-critical value here changes engine outputs. The mission on-hand input on line 74 shows the correct pattern (aria-label="On hand ..."), so this table is an omission, not a style choice.

```
: '<input type="' + (isNum ? 'number' : 'text') + '" step="any" data-fillpath="' + esc(e.path) + '" data-filltype="' + (isNum ? 'number' : 'string') + '" value="' + esc(String(e.value)) + '">';
```

**Fix.** All edits in /Users/zacharytraphagen/FieldFortificationsCalculator/src/layout/tools.ts, inside `rowFor` in `doctrineOverlay`:
1. Line 189 (boolean select): add ` aria-label="New value for ' + esc(e.path) + '"` to the <select> tag.
2. Line 190 (number/text input): add the same ` aria-label="New value for ' + esc(e.path) + '"`.
3. Line 195 (.fill-src input): add ` aria-label="Source for ' + esc(e.path) + '"` (keep the placeholder as a visual hint).
4. Optional same-class cleanup: the verified checkbox (line 196) is named only "verified" on every row; add ` aria-label="Verified ' + esc(e.path) + '"` to disambiguate rows.
Edge cases to preserve: use the existing esc() on e.path (paths contain dots/brackets, e.g. "table[3].x", and esc must keep the attribute well-formed — it already does for data-fillpath); do NOT touch data-fillpath/data-fillsrc/data-fillverify attributes — applyInlineDoctrineEdits in src/ui/main.ts (lines 578 and 586) queries by those selectors, and the fix must stay attribute-additive with zero behavioral change. Pin it with one assertion (per repo convention of a runnable check) in test/doctrine-io.test.ts, which already imports doctrineOverlay: assert.match(doctrineOverlay(all(), counts(), getFillState(), false, null), /aria-label="New value for /) and /aria-label="Source for /.

#### 38. Mission set is a black box: only a count is shown, with no membership list and no way to remove one position

`src/layout/tools.ts:77` · **MEDIUM** · ux · effort: small

**Problem.** missionOverlay shows 'Group job list — N position(s)' plus the aggregated BOM; the individual positions in the set are never listed and the only removal control is Clear (wipe all). mission-add (src/ui/main.ts:492) appends the current inputs and immediately re-renders the overlay. Failure scenario: user double-taps 'Add current position' (easy, since the overlay rebuilds under the finger) — the set silently contains the position twice, every material quantity and man-hour total doubles, and nothing in the UI reveals it; the only recovery is Clear and rebuilding the whole set from memory. Contrast: compareOverlay lists each entry as a column with its own remove button.

```
'<div class="tools"><h2>Group job list — ' + result.totalPositions + ' position(s)</h2>' + addClear +
// main.ts:492: case 'mission-add': store.setState({ missionSet: [...missionSet, { inputs: {...inputs} }] }); openMission();
```

**Fix.** Mirror the compareOverlay remove pattern. Two files. (A) src/layout/tools.ts — change the signature to `missionOverlay(result: MissionResult, items: MissionItem[])` (import MissionItem from '../engine/types'; `positions`, `standards`, and `esc` are already imported). Key the empty branch off `items.length === 0` instead of `count === 0`. When non-empty, render a membership list between `addClear` and the BOM table: one row per item showing `esc(it.label ?? positions[it.inputs.positionType]?.label ?? it.inputs.positionType)`, the standard via `standards[it.inputs.standard]?.label`, `× it.inputs.count`, and `<button type="button" class="btn tiny" data-action="mission-remove" data-idx="' + i + '">✕</button>` — same markup pattern as tools.ts:93. Keep the heading's `result.totalPositions` (it sums inputs.count and is NOT the same as items.length — do not conflate the two). Keep Clear. (B) src/ui/main.ts — in openMission() (line 151-154) pass `set` instead of `set.length`; add `case 'mission-remove'` beside line 493 copying the compare-remove handler at line 497 verbatim in structure: `const idx = Number(actionEl.dataset['idx']); const set = store.getState().missionSet.slice(); if (idx >= 0 && idx < set.length) { set.splice(idx, 1); store.setState({ missionSet: set }); } openMission();`. Edge cases to preserve: (1) esc() every interpolated label — MissionItem.label round-trips through session import (src/state/session.ts:67) so it is untrusted, matching the file's own XSS comment at tools.ts:18-20; (2) index-based removal is safe here because the overlay innerHTML is fully rebuilt after every action, same as compare; (3) bounds-check the idx exactly as compare-remove does; (4) keep the count===0 empty-state text and the Clear button. Add one small render test (new test or extend test/plan-mission.test.ts) asserting missionOverlay emits one `data-action="mission-remove"` button per item and the empty-set message when items is [] — no existing test pins the old two-arg signature, so only the main.ts call site needs updating.

#### 39. CSV formula injection via scenario name and unvalidated input ids

`src/render/csv.ts:32` · **MEDIUM** · security · effort: small

**Problem.** toCsv() writes user-controlled strings into CSV cells with no formula neutralization. field() only quotes when the value contains [",\r\n] and never defuses a leading =, +, -, @ or tab. Two attacker-controlled sources reach it: (1) meta.scenario — the scenario name, set via window.prompt (src/ui/main.ts:394) or, cross-user, via an imported scenario JSON file (ScenarioStore.parseImportMany validates name only as 'is a string', src/state/schema.ts:108); (2) result.inputs.positionType/soil/threat (csv.ts lines 34-37) — validateInputs (src/state/schema.ts:62-63) accepts ANY string for these fields, compute() silently falls back to defaults but copies the raw strings into result.inputs (src/engine/compute.ts:152 'const inputs = { ...raw, count, teamSize }'), so they survive into the export. Failure scenario: a teammate shares sap1-scenarios.json containing name '=HYPERLINK("http://evil.example/x","totals")' or soil '=cmd|\' /C calc\'!A0'; the victim imports it (a designed sharing flow), loads the scenario, clicks Export CSV, and opens sap1-bom.csv in Excel — the cell is evaluated as a formula (quoting does not prevent this; Excel evaluates a leading '=' after CSV unquoting), enabling data exfiltration via HYPERLINK or DDE command execution behind one warning dialog.

```
function field(v: string | number): string {
  const s = typeof v === 'number' ? num(v) : v;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
...
lines.push(row('Scenario', meta.scenario));
```

**Fix.** Single-point fix in src/render/csv.ts field() — it is the choke point every cell passes through via row(). Change field() to defuse string values (never number-typed ones) whose first char is one of = + - @ tab or CR, per OWASP CSV-injection guidance, by prefixing a single quote BEFORE the existing quoting check: `function field(v){ let s = typeof v==='number' ? num(v) : v; if (typeof v!=='number' && /^[=+\-@\t\r]/.test(s)) s = "'"+s; return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }`. Edge cases the fix must preserve: (a) numbers go through num() and must NOT be prefixed so negative quantities (e.g. -3) stay numeric — the typeof v==='number' guard handles this; (b) empty-string cells (used as spacers in the Labor rows, csv.ts:48-49) must pass through unchanged — the regex doesn't match ''; (c) lab.assumptions strings could legitimately start with '-' and will gain a visible apostrophe in plain-text viewers — acceptable and standard per OWASP, invisible in Excel; (d) keep CRLF endings and dot-decimal behavior pinned by test/units-format.test.ts. Add one test (extend test/units-format.test.ts): toCsv with meta.scenario = '=HYPERLINK("http://evil/x","t")' must produce a Scenario cell starting with "'=", and a numeric cell like 167832 must remain bare. Skip the suggested schema.ts tightening: doctrine ids are user-extensible via doctrine import, and compute() intentionally tolerates unknown ids with advisory fallbacks — hard-coding an id allowlist in validateInputs would fight that design; defusing at the CSV sink covers all sources including future ones.

#### 40. Plan view labels relative sector angles as absolute compass azimuths (with mils) and pins a north arrow pointing at the enemy

`src/render/drawPlan.ts:75` · **MEDIUM** · data · effort: small

**Problem.** The sector wedge is drawn relative to the front/enemy direction (edge(deg) measures deg from 'straight ahead': drawPlan.ts:59), but the printed labels run the same numbers through azimuthLabel(), which normalizes them as compass azimuths and appends mils. With the default sectors (leftDeg -45/rightDeg 45, geometry.ts:131-132 — set even when the user never entered azimuths), every plan and printed job sheet shows '315° (5600 mils)' and '45° (800 mils)' as sector limits. Simultaneously northArrow() (chrome.ts:170-176) always draws north pointing straight up — the same direction as the ENEMY arrow — so the drawing asserts the enemy is due north for every position. A leader copying these onto a real range card records wrong azimuths for any position not facing 0° (e.g. facing east, true limits are 45°-135°, not 315°-45°). The field header's blank 'AZIMUTH OF FIRE' line confirms the tool does not actually know the facing.

```
const edge = (deg) => px(Rft * Math.sin(toRad(deg)), -halfW - Rft * Math.cos(toRad(deg)));  // relative to front
textEl(l[0] - 4, l[1] - 4, azimuthLabel(p.sectors.leftDeg), ...)  // printed as absolute: '315° (5600 mils)'
// chrome.ts northArrow: fixed vertical arrow — north always = enemy direction
```

**Fix.** 1) src/render/chrome.ts — add sectorOffsetLabel(deg: number): string returning relative-offset notation: side prefix ('L ' for deg<0, 'R ' for deg>0, '' for 0) + Math.abs(Math.round(deg)) + '° (' + degToMils(Math.abs(deg)) + ' mils)'. Keep degToMils unchanged (its normalization test at range-card.test.ts:13-18 stays valid). Either keep azimuthLabel exported for a future azimuth-of-fire input or delete it and its assertion at range-card.test.ts:18 — do not silently leave it wired to relative values.
2) src/render/drawPlan.ts:75-76 — swap azimuthLabel(p.sectors.leftDeg/rightDeg) for sectorOffsetLabel; update the import on line 10.
3) North arrow: remove the northArrow(...) call at drawPlan.ts:178 (it is only used there — chrome.ts is its sole definition, drawPlan its sole caller) and replace with a small honest caption near the same spot, e.g. 'enemy-up — orient to ground' in ink-soft mono, or nothing. If northArrow becomes dead, delete it and the mk-north marker in drawingDefs (chrome.ts:43-46) or leave the marker (harmless).
4) test/range-card.test.ts — update pinned behavior: line 23 (/mils/) still passes; lines 24 and 36 currently assert mk-north presence — flip them to assert its ABSENCE (or assert the new caption), and add one assertion that the default mg_crew plan contains 'L 45°' and 'R 45°' rather than '315°', pinning the fix.
Edge cases to preserve: FPL line geometry along the left sector edge (drawPlan.ts:80-85) is untouched; non-sector positions (sectors.present false) still render no labels; asymmetric imported sectors (e.g. -30/60) label per-side correctly; deg=0 gets no L/R prefix; circular/inverted-T/L-shape branches unaffected. Run the full test suite after — fuzz.test.ts and schema-import.test.ts exercise sectorAzimuths and must stay green.

#### 41. Job sheet prints raw internal enum ids (sa-127, sandy_loam) where the app promises plain language

`src/render/jobSheet.ts:55` · **MEDIUM** · ux · effort: trivial

**Problem.** The Inputs table of the printable job sheet interpolates result.inputs.soil and result.inputs.threat directly, and engineerBlock's threatName() (line 128-130) also returns the raw id. The doctrine tables define human labels ('12.7mm (.50 cal)' for 'sa-127' in protection.ts:73, 'Sandy loam' for 'sandy_loam' in soils.ts:33) and every in-app panel/overlay uses them — tools.ts even carries the comment 'Plain-language names, never raw enum ids'. Failure scenario: user selects soil 'Sandy loam' and threat '12.7mm (.50 cal)', prints the report — the deliverable handed up the chain reads 'Soil: sandy_loam', 'Threat: sa-127', and the engineer hand-off block reads 'Threat to defeat: at-rpg', which the engineer receiving the paper cannot decode without the app.

```
specRow('Standard', result.inputs.standard) +
    specRow('Soil', result.inputs.soil) +
    specRow('Threat', result.inputs.threat) + ...
function threatName(result: Result): string {
  return result.inputs.threat === 'none' ? 'none' : result.inputs.threat;
}
```

**Fix.** In src/render/jobSheet.ts: (a) add imports `import { soils } from '../doctrine/soils'; import { standards } from '../doctrine/standards'; import { threats } from '../doctrine/protection';` (soils/standards are also re-exported from '../doctrine' — match whichever import style the file already uses; it currently imports positions directly from '../doctrine/positions', so direct module imports fit). (b) Lines 54-55: `specRow('Standard', standards[result.inputs.standard]?.label ?? result.inputs.standard)` and `specRow('Soil', soils[result.inputs.soil]?.label ?? result.inputs.soil)`. (c) Line 56: `specRow('Threat', threatName(result))` to reuse the helper. (d) Fix threatName (lines 128-130): `return result.inputs.threat === 'none' ? 'none' : threats[result.inputs.threat]?.label ?? result.inputs.threat;`. Edge cases the fix must preserve: keep the `?? raw-id` fallback so unknown/future ids from an imported doctrine fill print the id rather than 'undefined'; keep the special-case 'none' threat (it has no entry in the threats table); labels flow through specRow's esc() so HTML-escaping is already handled — do not double-escape. Optionally apply the same three lookups in src/render/csv.ts:35-37 (same fallback pattern). Pin it with one assertion added to the existing job-sheet test in test/range-card.test.ts: build `jobSheet(compute(defaultInputs({ soil: 'sandy_loam', threat: 'sa-127' })), ...)` and assert the sheet includes 'Sandy loam' and '12.7mm' and does not include 'sandy_loam'.

#### 42. Overhead-cover slab placed at grade in 3D (parapet-height term multiplied by zero) — interpenetrates the parapet ring and contradicts the job-sheet section

`src/render3d/scene3d.ts:352` · **MEDIUM** · ui · effort: small

**Problem.** scene3d computes the cover slab's height as `p.parapetW * 0 + s.coverT / 2 + 0.15` — the parapet term is literally zeroed (and uses parapetW, not parapetH, even in the dead term), so the sandbag roof slab spans y = 0.15..coverT+0.15 at grade. The slab is holeL+2 x holeW+2, i.e. 1 ft wider than the hole on every side, so it occupies the same volume as the inner portion of the 1.1-ft-tall parapet ring (pushRing, line 296): with any earth roof on (e.g. two_man + 5.56mm + overheadCover) the batched cover bags and parapet bags interpenetrate, and the roof reads sunk INTO the parapet. The stringers land at y=0 (coverY - coverT/2 - 0.15), half-buried at grade. Meanwhile drawSection.ts:109-110 rests the same slab ON the parapet tops (slabBottomY = px(0, -s.parapetH)). Failure scenario: print the job sheet — the section teaches bearing the roof on the parapet; rotate the 3D model — it shows the roof at ground level passing through the parapet bags with visible z-fighting/overlap. Two authoritative views of one Result give contradictory construction guidance.

```
// scene3d.ts:352  const coverY = p.parapetW * 0 + s.coverT / 2 + 0.15;
// scene3d.ts:353  parts.push({ kind: 'box', ..., y: coverY, w: p.holeL + 2, h: s.coverT, d: p.holeW + 2, role: 'cover', finish: 'sandbag' });
// scene3d.ts:296  pushRing(..., p.parapetW, 1.1, entranceGap);  // ring occupies y 0..1.1 over the same footprint
// drawSection.ts:109  const slabBottomY = px(0, -s.parapetH)[1]; // rests on parapet tops
```

**Fix.** File: src/render3d/scene3d.ts only (plus one test assertion). 1) Hoist the rectangular parapet ring's drawn height into a module or local constant, e.g. const RING_H = 1.1, and use it both in the pushRing call at line 296 and in the earthRoof branch; for geo.shape==='circular' the ring is drawn at 1.2 (line 202), so compute ringTop = geo.shape === 'circular' ? 1.2 : RING_H (the earthRoof branch excludes only vehicle_ramp, so circular pits do take this path). 2) Replace line 352 with placement that bears the roof on the parapet tops, matching drawSection: stringers first — y = ringTop + 0.15 (box h=0.3 spans [ringTop, ringTop+0.3], resting ON the ring instead of buried at grade); then slab — coverY = ringTop + 0.3 + s.coverT/2 so the slab bottom sits flush on the stringer tops. Delete the dead 'p.parapetW * 0' term entirely. Keep the existing holeL+2 x holeW+2 footprint: with the slab now above ringTop it reads as bearing on the inner portion of the 3-ft ring, which is exactly what drawSection.ts:109 teaches (slabBottomY = parapet top), so the two views agree without touching drawSection. 3) Edge cases to preserve: (a) camouflage net at fixed y=1.8 (line 379) — slab top becomes ringTop+0.3+coverT, which exceeds 1.8 whenever coverT > 0.4 ft (all indirect threats); raise the net to Math.max(1.8, slabTop + 0.4) so it clears the roof; (b) engineeredRoof branch (line 361, y=1.4, spans 1.3..1.5) already clears the 1.1 ring — leave it alone; (c) camera-framing bounds at the bottom of buildScene3D size from drawn parts — verify the raised slab is included so the reset camera still frames it (it iterates parts, so it should be automatic). 4) Per repo test discipline, add one assertion to test/scene3d.test.ts's existing earth-roof loop: every role==='cover' box satisfies y - h/2 >= 1.1 and every role==='stringer' box satisfies y - h/2 >= 1.1 (never below the parapet top / sunk at grade), pinning the agreement between the two renderers.

#### 43. floor.ts bridging blocks are cut too long for the final joist bay — interpenetration and wrong cut list

`src/timber/floor.ts:136` · **MEDIUM** · bug · effort: trivial

**Problem.** generateFloor emits every bridging block with cutLength = oc - t (full on-center gap), but the last joist bay is narrower whenever (L - t) is not a multiple of the spacing, because the end joist is force-placed at L - t/2. Verified by execution: for lengthFt=20, widthFt=18, joistSpacingIn=16, all 30 bridging pieces are cut at 14.5 in while the final bay's clear gap is 13.0 in — the block interpenetrates both joists by 1.5 in in the 3D scene, and the stage-3 cut list (bomSummary/cutList, the deliverable a carpenter cuts from) lists 14.5 in pieces that do not fit. Unreachable in the shipped demo only because BUILDING.widthFt=16 suppresses bridging (W/2 <= 8); any consumer with widthFt > 16 hits it.

```
for (let i = 0; i < joistXs.length - 1; i++) {
  emit('bridging', '2x4', oc - t, [(joistXs[i]! + joistXs[i + 1]!) / 2, joistY, zMid], [0, 0, 0], 3, {
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/timber/floor.ts, inside the bridging loop (lines 135-140), compute the per-bay clear gap and use it as the cut length: `const gap = joistXs[i + 1]! - joistXs[i]! - t;` then `emit('bridging', '2x4', gap, ...)` — the block center `(joistXs[i]! + joistXs[i + 1]!) / 2` is already correct and unchanged. Edge cases to preserve/handle: (1) regular bays must still come out at exactly oc - t (they do, since loop spacing is exact — assert this doesn't change the widthFt≤16 demo output, which emits no bridging at all); (2) degenerate final bay — the loop condition `x < L - t/2 - 0.01` can leave the last stepped joist within t (1.5 in) on-center of the force-pushed end joist, making gap ≤ 0; guard with `if (gap <= 0.02) continue;` so no zero/negative-length member reaches the cut list; (3) both bridging rows (zMid = W/4 and 3W/4) use the same loop, so one fix covers both. Add one pinning assertion in /Users/zacharytraphagen/FieldFortificationsCalculator/test/timber-frame.test.ts (widthFt=18 or 24 case): for every bridging member, cutLength/12 === joist gap of its bay within 1e-9, i.e., block ends never cross adjacent joist faces.

#### 44. floor.ts staggered subfloor rows emit overlapping coplanar panels (double-counted in BOM) for 8 < lengthFt < 12

`src/timber/floor.ts:154` · **MEDIUM** · bug · effort: small

**Problem.** The wPanel clip `Math.min(8, 2 * Math.min(xC, L - xC))` shrinks a panel symmetrically about its center instead of clipping only the wall side, so on staggered rows the loop panel near the end wall shrinks away from the half-panel starter, and the remainder closer then re-covers the same span. Verified by execution: lengthFt=10, widthFt=16 emits, per staggered row, panels covering 0-4 ft, 6-10 ft, AND 4-10 ft — the 6-10 ft span is covered by two coplanar panels (z-fighting in the 3D scene) and the row uses 3 panel members (14 ft of coverage) for a 10 ft row. bomSummary counts panels per member (`panels * MH_PER_PANEL`), so stage-4 panel count and man-hours are inflated by one full panel per staggered row.

```
for (const xC of xs) {
  const wPanel = Math.min(8, 2 * Math.min(xC, L - xC));
  emit('subfloor', '4x8 panel', wPanel, [xC, -panelT / 2, zC], ...)
```

**Fix.** File: src/timber/floor.ts, stage-4 block (lines 143-161). Replace the center-list + symmetric-clip + remainder-push logic with a left-to-right interval walk per row: for each row r, set cursor x0 = 0; if the row is staggered (r % 2 === 1) emit a starter panel of width Math.min(4, L) covering [0, min(4, L)] and advance x0; then while x0 < L - 0.01, set x1 = Math.min(x0 + 8, L), emit a panel of width (x1 - x0) centered at (x0 + x1) / 2, advance x0 = x1. Keep the same emit() call shape (role 'subfloor', nominal '4x8 panel', actual {w: 0.75, d: 48}, same nailing/doctrineRef, same zC = Math.min(r * 4 + 2, W - 2), y = -panelT / 2, rotation [-Math.PI/2, 0, 0], stage 4). Edge cases the fix must preserve: (1) L exactly a multiple of 8 or of 4 must not emit a zero-width trailing panel — the x0 < L - 0.01 guard handles it; (2) L <= 4 on staggered rows must not emit anything past the starter; (3) verify the default L=20 output is byte-identical to today's (I traced it: even rows produce spans [0,8],[8,16],[16,20] and staggered rows [0,4],[4,12],[12,20] under both old and new code, same order and centers, so determinism/snapshot tests over the L=20 golden should not change — run test/timber-frame.test.ts, test/determinism.test.ts, and test/snapshot.test.ts to confirm). Add one runnable check per repo convention: in test/timber-frame.test.ts, for lengthFt in [6, 8.5, 10, 13.5, 20], group stage-4 subfloor members by z, sort spans [x - w/2, x + w/2] per row, and assert cursor-walk finds zero overlap and zero gap with total coverage exactly L (this also retroactively pins the already-tested 13.5 case, which currently overlaps). Effort: small — one localized loop rewrite (~10 lines) plus ~15 lines of test.

#### 45. Last roof-sheathing course overlaps the previous course coplanar — z-fighting in the shipped demo

`src/timber/roof.ts:124` · **MEDIUM** · ui · effort: small

**Problem.** The final course is re-centered with Math.min(c*4+2, slopeLen-2) but keeps its full 48" width, so whenever slopeLen is not a multiple of 4 ft the last course overlaps the previous one in the same plane (both offset +0.06 from the same eave-ridge line). For the hardcoded demo building (W=16, rise 4, overhang 1): slopeLen = 9.487 ft, course centers 2.0 / 6.0 / 7.487 → course 3 spans 5.487–9.487, overlapping course 2 (4–8) by 2.5 ft across the full 20 ft length of BOTH slopes — two coincident 0.5"-thick panel faces z-fight in the default woodframe.html view. The identical pattern in the subfloor (floor.ts:147, zC = Math.min(r*4+2, W-2)) does the same for any widthFt not a multiple of 4 (demo's W=16 escapes it).

```
const sMid = Math.min(c * 4 + 2, slopeLen - 2); // along-slope center of this course
// floor.ts:147: const zC = Math.min(r * 4 + 2, W - 2);
```

**Fix.** 1) src/timber/roof.ts (course loop, lines ~123-138): compute const courseD = Math.min(4, slopeLen - c * 4); const sMid = c * 4 + courseD / 2; and emit the panel with actual: { w: 0.5, d: courseD * 12 }. Keep cutLength = wPanel (X dimension) untouched; keep the +0.06 lift and rotation math untouched. When slopeLen is an exact multiple of 4, Math.min yields courseD = 4 and sMid = c*4+2 — identical output to today (determinism test stays green). courses = Math.ceil(slopeLen/4) guarantees courseD > 0 for all c < courses. 2) src/timber/floor.ts (subfloor loop, lines ~145-160): same pattern — const rowD = Math.min(4, W - r * 4); const zC = r * 4 + rowD / 2; emit with actual: { w: 0.75, d: rowD * 12 }. Demo W=16 output is bit-identical (rowD=4 for all rows). 3) Regression check (per repo ponytail rule: one runnable check for non-trivial logic): in test/timber-frame.test.ts roof-geometry test, assert roofPanel along-slope intervals per slope are non-overlapping — recompute sMid ± actual.d/24 from the emitted members grouped by rotation sign and assert consecutive intervals touch but don't overlap (epsilon 1e-9); optionally same for subfloor rows with a widthFt=12.25 model. Edge cases the fix must preserve: panel member count per stage unchanged (BOM man-hours use panel count, bom.ts:92); cut-list grouping keys on nominal+cutLength, which is untouched; slopeLen < 4 (single course) yields courseD = slopeLen centered at slopeLen/2 — valid.

#### 46. E/W walls inset by plate thickness (1.5") instead of wall depth (3.5") — corners interpenetrate, cut list 2" long

`src/timber/walls.ts:48` · **MEDIUM** · bug · effort: small

**Problem.** Walls are centered on the perimeter lines and are 3.5" deep in plan (flat plates: face width d=3.5" horizontal). Butt walls must therefore be inset by d/2 = 1.75" per end, but wallFrames insets E/W by tFt/2 = 0.75" (stud thickness confused with stud depth). Verified: E sole plate runs z = 0.75"..191.25" while the S wall plates occupy z <= 1.75" — every corner has 1" x 1.75" solid-through-solid interpenetration of all three plates plus the end/corner studs, visible in the shipped woodframe demo. The E/W plate cutLength is 190.5" where the model's own geometry requires 188.5", so the carpenter-facing cut list (stage panel in woodframe-scene.ts) is 2" too long for 6 plates. elevation.ts:15-16 duplicates the same constant and must change in lockstep (its comment demands exact match).

```
{ wall: 'E', start: [lengthFt, tFt / 2], dir: [0, 1], runFt: widthFt - tFt, yaw: -Math.PI / 2 },
{ wall: 'W', start: [0, widthFt - tFt / 2], dir: [0, -1], runFt: widthFt - tFt, yaw: Math.PI / 2 },
```

**Fix.** 1) src/timber/walls.ts wallFrames() (lines 43-51): DRESSED is already imported; add `const dFt = DRESSED['2x4']!.d / FT;` and change E to `start: [lengthFt, dFt / 2], runFt: widthFt - dFt` and W to `start: [0, widthFt - dFt / 2], runFt: widthFt - dFt` (dir/yaw unchanged). 2) src/timber/elevation.ts wallFrame() (lines 15-16): mirror exactly — add `const D = 3.5 / FT;` (or import DRESSED) and use D/2 and widthFt - D for E/W, preserving the line-10 "must match walls.ts exactly" contract; this keeps the 2D/3D parity test and layoutStrip u-coordinates consistent since both sides shift start identically. 3) Add a corner no-overlap assertion to test/timber-walls.test.ts: for the golden config, take each wall's solePlate, compute its plan rectangle (run span = position +/- cutLength/2 along dir; cross span = position +/- d/2 = 1.75"/12 ft along the normal) and assert every perpendicular pair has zero-area intersection (touching allowed, overlap <= 1e-9); additionally assert E/W plate cutLength === widthFt*12 - 3.5 (188.5" for widthFt=16). Edge cases the fix must preserve: (a) N/S remain the full-length through walls — do not touch lines 46-47; (b) stud grid, end studs, and opening framing are all expressed relative to f.start/runFt so they follow automatically (E-wall openings shift 1" in world space, consistent across 3D/2D/cut list by construction); (c) golden-config stud counts are unchanged (verified: grid limit 15.80 -> 15.64 ft, last grid stud at 14.73 ft), so no existing test assertion breaks — but walls.ts and elevation.ts MUST land in the same commit or the parity test's u-range check (test/timber-frame.test.ts line 118) can trip; (d) fuzz range min widthFt=8 ft keeps runFt positive, no guard needed. Run `npm test` after.

#### 47. Grid end-guard epsilon (0.01 ft) lets a grid member interpenetrate the forced end member

`src/timber/walls.ts:105` · **MEDIUM** · bug · effort: small

**Problem.** The loop excludes grid positions only within 0.01 ft (0.12") of the forced end member, but members are 1.5" thick, so any wall/floor length where (run - t) mod oc falls in (0.12", ~1.5") emits a grid member overlapping the end member (~9% of arbitrary lengths). Verified with lengthFt=13.5 (a value the existing fuzz test itself uses): S-wall stud centers end ...159.75, 160.75, 161.25 — three studs whose 1.5"-wide bodies mutually interpenetrate at the wall end, and the cut list counts one extra stud per wall. The same pattern duplicates the last floor joist (floor.ts:121), ceiling joist, and a whole rafter PAIR (roof.ts:65) — a doubled rafter is 2 extra ~9.5 ft 2x6 in the BOM plus z-fighting. The fuzz test only asserts finiteness, so it passes.

```
for (let s = t / 2; s < f.runFt - t / 2 - 0.01; s += oc) gridXs.push(s);
gridXs.push(f.runFt - t / 2);
```

**Fix.** Three one-line loop-bound changes plus one test. (1) src/timber/walls.ts:105 — change `for (let s = t / 2; s < f.runFt - t / 2 - 0.01; s += oc)` to `for (let s = t / 2; s <= f.runFt - 2.5 * t + 1e-9; s += oc)`. Must be 2.5t (not the auditor's 1.5t) because the extra corner stud sits at runFt - 1.5t (walls.ts:115); 2.5t leaves >= one full thickness (faces touching allowed, matching the start-of-wall pattern where grid stud t/2 and corner stud 1.5t touch exactly). (2) src/timber/floor.ts:121 — `for (let x = t / 2; x <= L - 1.5 * t + 1e-9; x += oc)` (no corner member; forced end joist at L - t/2, so 1.5t leaves exactly one thickness clear). (3) src/timber/roof.ts:65 — same change as floor (`x <= L - 1.5 * t + 1e-9`); this single line fixes ceiling joists, rafter pairs (line 79 reuses joistXs), and collar-tie indexing at once. (4) Test: in test/timber-frame.test.ts, extend the existing fuzz loop (lines 44-57) to assert min clear distance: for each wall, sort role==='stud' members by position-along-run and assert consecutive center gaps >= 0.125 ft - 1e-6; same for stage-3 'joist' by x, stage-7 'joist' by x, and 'rafter' grouped by slope side (sign of rotation[2]) by x. Restrict to these roles only — king/jack pairs and doubled headers/corner studs legitimately sit exactly t apart (assertion >= t - eps still holds) but headers share along-position at different lateral offsets, so do not include 'header'. Edge cases the fix must preserve: forced end member always emitted (end-stud test at timber-walls.test.ts:37 requires >= 2 studs/wall); grid measured from t/2 at wall start; degenerate very-short runs must still not crash (loop simply yields fewer/zero grid points); existing OC-max-gap test (timber-walls.test.ts:48) still passes for the golden 20-ft config (end gap there is 1.208 ft, unaffected); note the last-bay gap between final grid member and forced end member can now legitimately reach oc + 2.5t on walls — do not add a max-gap assertion tighter than that. Verify with `npm run verify` (typecheck + tests + offline check).

#### 48. Post pipeline builds HalfFloat MSAA target without EXT_color_buffer_float check — black 3D view on affected mobile GPUs

`src/ui/engine/post.ts:172` · **MEDIUM** · bug · effort: small

**Problem.** createPipeline unconditionally creates a HalfFloatType render target with MSAA samples for the 'medium'/'high' tiers, but detectTier() only checks that a webgl2 context exists (post.ts:82-89). Rendering to (and multisample-resolving) RGBA16F in WebGL2 requires the EXT_color_buffer_float extension, which is NOT core WebGL2; three r185 merely enables the extension if present (three.module.js:11251 `extensions.get('EXT_color_buffer_float')`) and has no fallback for user-created targets (its own transmission target DOES guard: `hasHalfFloatSupport ? HalfFloatType : UnsignedByteType`). On a WebGL2 device lacking the extension (older Adreno/Mali drivers, some Android WebViews), the composer framebuffer is incomplete, every EffectComposer.render() fails with GL_INVALID_FRAMEBUFFER_OPERATION, and the 3D pane is permanently black. The FPS watchdog in three-viewer.ts cannot rescue it — failed draws complete fast, so avg frame time never exceeds 40 ms and the tier is never demoted to 'low' (the tier that would render correctly).

```
const target = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType,
  samples: tier === 'high' ? 4 : 2,
});
composer = new EffectComposer(renderer, target);
```

**Fix.** Single-file fix in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/engine/post.ts, inside build() in createPipeline (line ~172). Mirror three's own transmission-target guard using the ACTUAL renderer context (better than probing a throwaway canvas in detectTier, and keeps MSAA + grade/tilt passes working on RGBA8): const hdr = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'); then type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType in the WebGLRenderTarget options. Accept EITHER extension — EXT_color_buffer_half_float alone makes RGBA16F renderable and multisample-capable, exactly matching three r185's hasHalfFloatSupport check. Keep samples as-is (RGBA8 multisampling is core WebGL2). Add a short comment noting the UnsignedByteType path clamps pre-tonemap values at 1.0 (grade shader runs in what is then LDR, slightly different vignette/contrast feel) — cosmetic only, vastly better than a black pane. Edge cases to preserve: (1) do NOT touch detectTier's guarded navigator/screen/document access — tests run under a DOM shim (comment at post.ts:79-81); the fix lives in createPipeline which is never invoked under the shim, so no test breakage; (2) setTier rebuilds call build() again — the hdr check re-runs against the same renderer, harmless; (3) leave the 'low' tier early-return untouched. Testing: a unit test is impractical without a real GL context (renderer.extensions requires a live WebGLRenderer); the guard is a one-line mirror of upstream three code, so per ponytail rules mark it with a brief comment naming the ceiling instead of a synthetic test. Optional belt-and-suspenders (skippable): none needed — the fallback fully covers the failure mode, unlike a detectTier demotion to 'low' which would needlessly drop MSAA and the grade pass for affected devices.

#### 49. Active scenario is invisible in the shell and exports keep its name after the inputs diverge

`src/ui/main.ts:672` · **MEDIUM** · ux · effort: small

**Problem.** meta() labels every job sheet/CSV/JSON export with activeScenarioName, but nothing clears or qualifies that name when the user edits inputs afterwards (commit() at line 300 touches only history), and topbar() (src/layout/shell.ts:126-131) renders only the brand — no current-scenario indicator or modified marker exists anywhere in the shell. Failure scenario: user loads 'OP North', changes standard hasty→reinforced and soil, prints the report — the masthead reads 'OP North', so the printed sheet presents a modified, never-saved configuration as the saved plan; the platoon later reloads 'OP North' and gets different numbers than the paper. plan-apply (line 510) likewise swaps in planner-generated inputs while keeping the old name.

```
function meta() {
  return { scenario: store.getState().activeScenarioName ?? 'Unsaved setup', ... };
}
// commit(): store.setInputs(patch); history.push(...); — activeScenarioName untouched
```

**Fix.** Dirty-flag via saved-inputs snapshot; the flag derives everything, so plan-apply/undo/redo need no special-casing.

1. src/state/store.ts — add `savedScenarioInputs: Inputs | null` to AppState (default null in createStore). Not persisted: session restore already drops the scenario name, so the snapshot correctly starts null after reload.

2. src/ui/main.ts —
   - scenario-save (~401): include `savedScenarioInputs: store.getState().inputs` in the setState so a just-saved setup reads clean.
   - scenario-load (~414): include `savedScenarioInputs: s.inputs`.
   - reset (377) and scenario-delete (431): include `savedScenarioInputs: null` alongside clearing the name.
   - Add a small exported helper `scenarioDirty(state): boolean` → `state.activeScenarioName !== null && JSON.stringify(state.inputs) !== JSON.stringify(state.savedScenarioInputs)`. Inputs objects are always spread-copies of one shape so key order is stable; if paranoid, compare per-key over Object.keys(state.inputs).
   - meta() (671): when a name is active and scenarioDirty, return `name + ' (modified)'`; unchanged otherwise. This automatically fixes print, CSV, SVG-adjacent job sheet, and the exported JSON filename-name (which then honestly says "(modified)").
   - plan-apply (510): no change needed — replaceInputs diverges inputs from the snapshot, so the dirty flag qualifies the name. Undo/redo also come out correct for free: undoing back to the exact saved inputs makes it clean again (JSON comparison), which the fix must preserve — do NOT clear the name on edit, only qualify it.

3. src/layout/shell.ts topbar() (126-131): render a scenario indicator after the brand, e.g. `<span class="scenario-name">OP North (modified)</span>` using activeScenarioName + scenarioDirty(state) (topbar already receives AppState, and savedScenarioInputs now lives on it); render nothing when no active scenario. Add ellipsis/max-width truncation CSS for the mobile topbar so a long name can't push the hamburger off-screen.

4. Edge cases to preserve: (a) saving under a new name must snapshot at save time (step 2 first bullet) so the header immediately drops "(modified)"; (b) 'Unsaved setup' fallback in meta() stays as-is — never append "(modified)" to it; (c) scenario-delete of the ACTIVE scenario already clears the name — keep snapshot clearing paired with it.

5. One pinning test (test/): construct the state transitions with the helper — clean after load, dirty after a field change, clean again after reverting to the loaded inputs.

#### 50. Bottom-sheet scroll lock survives a mobile→tablet/desktop layout switch with no visible way to release it

`src/ui/main.ts:624` · **MEDIUM** · ux · effort: trivial

**Problem.** Sequence: on the mobile layout tap Edit (sheetOpen = true, html gets class 'sheet-open' with overflow:hidden per styles.css:19), then rotate the device / widen the window so resolveLayout switches to tablet or desktop. The new layout renders no .bottom-sheet, no .sheet-backdrop, and no sheet-toggle button (arrangeTablet/arrangeDesktop contain no sheet; bottomToolbar's Edit slot is mobile-only, shell.ts:142-145), but applySheet() still unconditionally toggles 'sheet-open' on <html> from the never-cleared sheetOpen flag — so window scrolling stays disabled. On desktop the center drawings column relies on window scroll (only .controls-region/.rail have their own overflow, styles.css:110-111), so content below the fold is unreachable. The only recovery is the undiscoverable Escape key or resizing back to mobile to close the sheet.

```
// main.ts applySheet():
document.documentElement.classList.toggle('sheet-open', sheetOpen);
// styles.css:19: html.sheet-open { overflow: hidden; }
// shell.ts:144: state.layoutMode === 'mobile' ? toolbarBtn('sheet-toggle', ...) : ''
```

**Fix.** One guarded line in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts, at the top of render() (line ~227, right after `const state = store.getState();`): `if (state.layoutMode !== 'mobile' && sheetOpen) sheetOpen = false;`. render() is the single choke point for every layout-switch path (resize/orientationchange via recomputeLayout's setState, the layout-override select at line 328, and reset at line 374 — all end in a store change → scheduleRender → render), and it runs before renderApp(state, ..., sheetOpen) at line 233 and applySheet() at line 266, so the desktop/tablet markup is built with the sheet closed and line 624 clears the html 'sheet-open' class in the same frame. Edge cases to preserve: (1) do NOT clear sheetOpen when layoutMode IS 'mobile' — mobile re-renders deliberately bake the open sheet into markup (src/layout/mobile.ts:7 comment) so the sheet must stay open across input edits; (2) sheetOpen can never legitimately be true in non-mobile layouts (the only setter is the mobile-only sheet-toggle action), so the reset is safe and idempotent; (3) resizing back to mobile after a switch now shows the sheet closed rather than reopened — acceptable and less surprising. Verify manually: open sheet at <640px width, widen window past 640/1024, confirm page scrolls and html has no 'sheet-open' class; also repeat via the Screen size override select. No jsdom harness exists for main.ts, so no automated test is practical without new infra.

#### 51. Compute error puts the app into an infinite rAF re-render loop with no recovery UI and a poisoned session

`src/ui/main.ts:249` · **MEDIUM** · bug · effort: small

**Problem.** render()'s error branch calls store.setState({ lastError: c.error }). setState (src/state/store.ts:70-73) unconditionally builds a new state object and notifies all listeners even when the patch is identical, and scheduleRender is a subscriber (main.ts:281). So: rAF -> render -> compute throws -> setState -> notify -> scheduleRender schedules the next rAF -> render -> throws again -> forever. Every frame does a full safeCompute, an app.innerHTML swap, AND a synchronous localStorage JSON.stringify write via the persistSession subscriber (main.ts:282). Worse, the error branch replaces the ENTIRE #app shell with errorCardHtml (src/ui/errorBoundary.ts:31-40), which contains zero controls — the topbar Undo/Reset buttons are gone, so the card's own advice ('Adjust a value') is impossible; only the document-level Ctrl+Z keydown handler can escape, which does not exist on touch devices. And because persistSession already saved the failing inputs, a reload restores them via restoreSession and re-enters the loop at boot — a mobile user is stuck until they clear site data. Trigger: any Inputs combination that passes schema.ts validation but makes compute() throw (exactly the 'unexpected throw' case the §14 error boundary was built for; e.g. a future engine regression or doctrine-value edge case). The designed recovery path is self-defeating.

```
} else {
    store.setState({ lastError: c.error });   // notify -> scheduleRender -> rAF -> render -> throws again
    app.innerHTML = errorCardHtml(c.error);   // whole shell replaced; card has no buttons
}
// store.ts:71  state = { ...state, ...patch }; notify();  // no equality check
```

**Fix.** Two files, ~10 lines. (1) /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts, error branch at line 249: guard the notify — `if (store.getState().lastError !== c.error) store.setState({ lastError: c.error });` then `app.innerHTML = errorCardHtml(c.error);`. First failing frame still notifies once (diagnostics at main.ts:599 still reads lastError), second frame sees the identical error and stops rescheduling — loop becomes bounded at one extra frame. Do NOT add a global equality/no-op check to store.setState in store.ts: syncHistory and the number-clamp snap logic (main.ts:319-326) document assumptions about when notifies/re-renders fire, and a global skip-on-equal would silently change repaint timing across the app. (2) /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/errorBoundary.ts, errorCardHtml: add two buttons inside the card — `<button data-action="undo">Undo last change</button> <button data-action="reset">Reset to defaults</button>`. Zero new wiring needed: the card renders inside #app and the click handler is delegated at document level (main.ts:357), so the existing 'reset' case (main.ts:374) fires, replaceInputs(DEFAULT_INPUTS) triggers a successful render, AND the persistSession subscriber immediately overwrites the poisoned localStorage session with defaults — this fixes the reload-poisoning without touching persistSession or session.ts. Keep the existing HTML-escaping of the error string in the card. Edge cases to preserve: lastError must still reach the store exactly once per distinct error (diagnostics depends on it); the Undo button is best-effort (history may be empty after a poisoned reload) — Reset is the load-bearing control and always works; lastError is never cleared on success today (existing behavior, leave it). Verification: one tiny test (e.g. test/error-card.test.ts) asserting errorCardHtml output contains data-action="reset" and escapes `<` in the message; the setState guard is a one-line conditional not worth a jsdom harness.

#### 52. Compute error replaces the entire shell with a dead-end card — no recovery controls, and reload re-enters the error

`src/ui/main.ts:250` · **MEDIUM** · ux · effort: small

**Problem.** On compute failure, app.innerHTML = errorCardHtml(c.error) wipes the whole shell: the input controls, the bottom toolbar (Undo/Reset), and the hamburger menu all disappear. The card text says 'Adjust a value or open Diagnostics' but both affordances were just destroyed — errorCardHtml (errorBoundary.ts:31-39) contains no buttons at all. On a touch device there is no Ctrl+Z, so there is zero in-app recovery. Worse, persistSession already saved the offending inputs (they are schema-valid, so restoreSession at session.ts:51-52 happily restores them), so reloading the page re-runs compute on the same inputs and lands straight back on the dead card — the app is bricked until the user manually clears localStorage.

```
store.setState({ lastError: c.error });
app.innerHTML = errorCardHtml(c.error);
// errorCardHtml: '<strong>Something went wrong…</strong> … Adjust a value or open Diagnostics.' — no controls rendered
```

**Fix.** Three small changes, two files (plus one test). (1) src/ui/errorBoundary.ts: add errorRecoveryCardHtml(error) — same escaped card plus two buttons: <button type="button" data-action="undo">Undo last change</button> and <button type="button" data-action="reset">Reset to defaults</button>. Keep the existing plain errorCardHtml unchanged — shell.ts:38-39 uses it for per-panel failures where an embedded full Reset would be too destructive. No new handler code is needed: the document-level click delegation (main.ts:364-380) survives the innerHTML wipe and already implements case 'undo' (line 368) and case 'reset' (line 374, which replaceInputs(DEFAULT_INPUTS) → notify → persistSession overwrites the poisoned localStorage → next render succeeds — full unbrick). (2) src/ui/main.ts render() error branch (lines 248-251): use errorRecoveryCardHtml, and guard the loop: only call store.setState({lastError: c.error}) when state.lastError !== c.error (compare message strings so a DIFFERENT consecutive error still updates) — this kills the infinite rAF re-render + per-frame localStorage write. (3) src/ui/main.ts boot (lines 47-53): gate restored inputs through the boundary — if restored && !safeCompute(restored.inputs).ok, drop restored.inputs (fall back to DEFAULT_INPUTS) but STILL restore missionSet/comparisonSet/onHand; this guarantees a reload always lands on a working shell even if bad inputs were persisted by an older build or mid-session crash (also makes the post-reload state correct: history seeds from defaults, canUndo=false is truthful). Edge cases to preserve: keep HTML-escaping of the error string (trust boundary); leave shell.ts per-panel safeRender path untouched; undo-with-empty-history is already safe (history.undo() returns null, applyInputs(null) no-ops at main.ts:535); the refocus/scroll-restore code after the error branch now has [data-action] buttons to re-target — no changes needed there; 'reset' also clears layoutOverride/scenario which is acceptable (it is the same Reset the toolbar offers). One runnable check per repo convention: a vitest asserting errorRecoveryCardHtml contains data-action="undo" and data-action="reset" and escapes '<script>' in the message, plus a session-restore test that a snapshot whose inputs make safeCompute fail falls back to defaults while keeping missionSet/onHand.

#### 53. Compute-error render path triggers infinite rAF re-render loop

`src/ui/main.ts:249` · **MEDIUM** · bug · effort: trivial

**Problem.** render()'s error branch calls store.setState({ lastError }) while store.setState (src/state/store.ts:70-73) unconditionally notifies all subscribers, and scheduleRender is a subscriber (main.ts:281). So: compute throws -> render() -> setState -> notify -> scheduleRender -> rAF -> render() -> compute throws again -> setState -> ... forever. The app re-renders the error card at display refresh rate, and the persistSession subscriber (main.ts:282) writes the session JSON to localStorage on every frame. Concrete scenario: any input state that makes compute() throw (the entire premise of the error boundary) pegs a CPU core, drains a phone battery, and hammers localStorage until the tab is killed.

```
} else {
    store.setState({ lastError: c.error });
    app.innerHTML = errorCardHtml(c.error);
}
// store.ts: setState(patch){ state={...state,...patch}; notify(); }
```

**Fix.** One-line guard in src/ui/main.ts render() error branch (line 249): replace `store.setState({ lastError: c.error });` with `if (store.getState().lastError !== c.error) store.setState({ lastError: c.error });`. String comparison is by value, and compute is deterministic (same inputs -> same error message), so the second frame's setState is skipped and the loop dies after exactly one extra render. Edge cases to preserve: (1) diagnostics must still see the error — the first setState still fires, and showDiagnostics reads store.getState().lastError directly, so unaffected; (2) a genuinely different error message (inputs changed to a different failing state) must still update lastError — the !== guard allows that; (3) do NOT move the setState out of the render path into a notify-free setter unless the store grows one — the guard is sufficient and smaller. Optional pinning test: in test/state.test.ts, assert that a subscriber which re-enters setState with an unchanged lastError under this guard pattern does not recurse — but the real loop involves rAF/DOM, so the one-line guard plus the existing subscriber wiring is the pragmatic stop (ponytail: guard at the single call site; upgrade path is change-detection in store.setState itself if more subscriber loops appear).

#### 54. Ctrl/Cmd+Z is globally hijacked, including inside text fields — undoes app inputs instead of typing

`src/ui/main.ts:541` · **MEDIUM** · ux · effort: trivial

**Problem.** The keydown handler preventDefaults Ctrl/Cmd+Z(/Y) unconditionally, with no check that the event target is a text-editing element. Scenario: while typing a pub reference into a doctrine 'source' field (or a value in the fill table, plan/schedule number fields, on-hand fields), the user mistypes and presses Ctrl+Z — instead of undoing their typing, the app undoes the last INPUT edit, silently mutating the planner state behind the open overlay, while the text they wanted to fix stays wrong. Native text-edit undo is unreachable everywhere in the app.

```
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); applyInputs(history.undo()); syncHistory(); }
```

**Fix.** Single file: /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts, keydown handler at lines 540-549. At the top of the handler compute a text-editing guard and bail out of ONLY the undo/redo branches when it holds, e.g.: `const t = e.target as HTMLElement; const editing = t instanceof HTMLTextAreaElement || t.isContentEditable || (t instanceof HTMLInputElement && !/^(checkbox|radio|range|button|submit|reset|color|file)$/.test(t.type));` then wrap the two undo/redo branches in `if (!editing) { ... }` (or early-return before them when the combo is Z/Y with ctrl/meta and editing is true). Edge cases the fix must preserve: (a) the Escape branch must remain unguarded — Escape currently closes the overlay/menu/sheet even when focus is inside an input (e.g. the fill table), and that behavior should not change; (b) `type="number"` inputs must be treated as editable (browsers support native text undo in them — the deny-list-of-non-text-types approach above handles this, unlike an allow-list of just type=text); (c) the `type="range"` stage slider (shell.ts:163) and checkboxes must still allow app undo when focused — the type regex excludes them from the guard; (d) `<select>` elements (fill-table enums) are not text-editable and fall through to app undo, which matches current behavior and is acceptable. No new dependencies, ~4 lines changed. Existing tests (node-based, no DOM) are unaffected; a DOM-level test would require adding jsdom, which the repo does not use — skip per repo conventions and ponytail rules, since the guard is a trivial conditional.

#### 55. Doctrine inline edits silently discarded by the safety-critical filter toggle and by any overlay dismissal

`src/ui/main.ts:476` · **MEDIUM** · ux · effort: small

**Problem.** Inline doctrine edits live only in the overlay's DOM until 'Apply inline edits' is clicked. The 'Safety-critical only' toggle rebuilds the whole fill table from registry state (openDoctrine -> doctrineOverlay -> rowFor renders value=e.value, tools.ts:190), wiping every typed-but-unapplied value/source/verified checkbox. The same total loss happens on Escape (main.ts:545), a click on the overlay backdrop (main.ts:569-571), or the Close button — none of which check for dirty edits. Scenario: the battalion cell types 30 sourced values, clicks 'Safety-critical only' to cross-check one entry (or stray-clicks outside the card) → all 30 entries silently revert.

```
case 'doctrine-sc-toggle': doctrineScOnly = !doctrineScOnly; openDoctrine(); break;
// tools.ts rowFor: value="' + esc(String(e.value)) + '" — rebuilt from registry, not the DOM
```

**Fix.** Single file: src/ui/main.ts (no changes needed in src/layout/tools.ts — the data-fillpath/data-fillsrc/data-fillverify attributes it already emits are sufficient keys).

1. Add module-level `const pendingFill = new Map<string, { v?: string; s?: string; ver?: boolean }>()` near the other doctrine state (doctrineScOnly, line ~60).
2. Add one delegated listener on overlayBody ('input' and 'change') that records edits: if target has data-fillpath store raw el.value as v (raw string — do NOT parseFloat; number validation stays in applyInlineDoctrineEdits); data-fillsrc -> s; data-fillverify -> ver (checked). Key = the path dataset value.
3. In openDoctrine(), after showOverlay(...), re-seed: for each pendingFill entry, set the matching [data-fillpath] input/select .value, [data-fillsrc] .value, [data-fillverify] .checked (skip paths not in the current DOM — they stay in the map so toggling the SC filter back restores them). This alone fixes the sc-toggle wipe AND the rejected-apply wipe at main.ts:473.
4. Clearing rules: `case 'doctrine'` (fresh open, line 448) -> pendingFill.clear() alongside the existing doctrineReport/pendingImport resets. On 'doctrine-apply-edits' success (report.ok), delete from pendingFill only the paths present in the current overlay DOM (edge case: with SC-only filter on, hidden non-SC pending edits must survive the apply, since applyInlineDoctrineEdits only reads visible rows). Same-path successful 'doctrine-import-apply' -> clear() (imported file supersedes).
5. Discard guard in hideOverlay(): if pendingFill.size > 0 AND overlayBody.querySelector('.tools.doctrine') exists (the doctrine overlay is the one open), window.confirm('Discard ' + n + ' unapplied doctrine edit(s)?'); on cancel, return without hiding; on confirm, pendingFill.clear() then hide. One guard covers Escape, backdrop, and overlay-close since all three route through hideOverlay(). Verify no interference: plan-apply/scenario-load also call hideOverlay but cannot run while the doctrine overlay is open.

Edge cases to preserve: boolean <select> uses 'change' not 'input' (listen to both); recording raw strings keeps parseFloat/Number.isFinite validation in applyInlineDoctrineEdits authoritative; the map must survive a failed apply so the user can fix the one rejected value.

One runnable check (project already has vitest tests in test/): a small jsdom-style test or an assert-based check exercising the record/re-seed round-trip of the map logic if the DOM handlers are extracted into a testable helper; if extraction is too invasive, a happy-dom/jsdom test that builds the overlay HTML via doctrineOverlay(), simulates an input, rebuilds, and asserts the value survives.

#### 56. Doctrine-fill attribution (author/date) and content hash are lost across reload — job-sheet provenance changes for identical doctrine

`src/ui/main.ts:466` · **MEDIUM** · data · effort: small

**Problem.** io.ts's stated contract: 'Every applied fill carries a manifest (content hash + optional author/date) so a DOCTRINE stamp is attributable evidence, printed on the job sheet.' main.ts persists the fill via saveFill(persistAdapter) with NO manifest argument, so doctrineFill.saveFill stores exportDoctrine(undefined) whose manifest is {contentHash} only — the author/date from the imported file's manifest (held in getFillState()) are never persisted. On next boot restoreFill() re-imports the stored full export, and appliedFill becomes {contentHash: <hash of ALL registry entries>}. Reproduced: after importing a fill with manifest {author:'MAJ Doe', date:'2026-07-02'}, getFillState() = {contentHash:'26032c0b', author:'MAJ Doe', date:'2026-07-02'}; after saveFill + simulated reboot + restoreFill, getFillState() = {contentHash:'545b522c'} — author and date gone, and for any partial fill the hash also differs (file-entries hash vs full-export hash). Job sheets printed before vs after a reload show different fill hashes and drop the 'filled by MAJ Doe' attribution (jobSheet.ts:162, tools.ts:169-170) for the exact same doctrine state, defeating the attribution/change-detection purpose. The doctrine-io persistence test masks this by passing the manifest explicitly to saveFill, which the app never does.

```
if (doctrineReport.ok) { saveFill(persistAdapter); showToast(doctrineReport.applied + ' doctrine value(s) applied and saved on this device.'); scheduleRender(); }
```

**Fix.** Three files, two parts. Part A (attribution loss — the core bug): in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts change both apply sites (line 466 doctrine-import-apply, line 472 doctrine-apply-edits) to saveFill(persistAdapter, doctrineReport.manifest) — DoctrineManifest is structurally compatible with saveFill's {author?, date?} param and exportDoctrine only reads author/date. Part B (hash stability for partial fills): persist the applied manifest verbatim and re-install on restore. In /Users/zacharytraphagen/FieldFortificationsCalculator/src/doctrine/io.ts add export function setFillState(m: DoctrineManifest): void { appliedFill = m; } next to resetFillState (io.ts:71). In /Users/zacharytraphagen/FieldFortificationsCalculator/src/state/doctrineFill.ts: saveFill stores JSON.stringify({ ...exportDoctrine(manifest), appliedFill: getFillState() }); restoreFill, ONLY after report.ok, reads parsed.appliedFill and, if it is an object with a string contentHash (author/date optional strings, type-checked field by field), calls setFillState with it — otherwise keep importDoctrine's recomputed manifest (current behavior). Edge cases the fix must preserve: (a) restore still goes through importDoctrine's all-or-nothing validation — never install the stored manifest when the import fails; (b) the user-file import path must keep RECOMPUTING contentHash (io.ts:196) — never trust a hash inside an arbitrary imported file; only the local persistence blob re-installs verbatim; (c) old-format stored blobs (no appliedFill key) must restore exactly as today (importDoctrine ignores unknown top-level keys — graceful, no migration); (d) hasDangerousKeys scans the whole blob — the new appliedFill key with plain string fields passes; (e) inline-edits path has no author/date in its report manifest (base export carries none), so forwarding it is a harmless no-op there. Tests: extend the persistence test in /Users/zacharytraphagen/FieldFortificationsCalculator/test/doctrine-io.test.ts (~line 96) to mirror the real app call: import a PARTIAL fill whose file manifest has author/date, saveFill(adapter, report.manifest), restore() to simulate reboot, restoreFill, then assert getFillState() deep-equals the pre-reload manifest (same contentHash + author + date). Severity stays medium: it corrupts printed provenance/attribution — the feature's entire purpose — on every reload, but never corrupts doctrine values (restore re-validates) and is not security-exploitable.

#### 57. Inline doctrine edit: unparseable number is silently ignored while the 'verified' checkbox still promotes the placeholder value to DOCTRINE

`src/ui/main.ts:583` · **MEDIUM** · data · effort: small

**Problem.** In applyInlineDoctrineEdits, a number field whose text does not parse (e.g. the user typed '1..5' or '3.5.' into the type=number input — the browser exposes el.value === '' for such input — or cleared the field) is silently skipped: entry.value keeps the current placeholder magnitude. But the row's status is still recomputed from the 'verified' checkbox on line 589. So a user who mistyped a safety-critical value, filled the Source field with a real pub reference (clearing the TODO source that would otherwise trip io.ts's DOCTRINE+TODO rejection) and checked 'verified' gets the UNCHANGED placeholder magnitude stamped as DOCTRINE, decrementing the NOT-FOR-FIELD-USE burn-down and printing a DOCTRINE fill hash on job sheets — with no warning that the typed value was discarded.

```
if (type === 'number') { const n = parseFloat(el.value); if (Number.isFinite(n)) entry.value = n; }
...
entry.status = verify?.checked ? 'DOCTRINE' : 'PLACEHOLDER';
```

**Fix.** Single file: src/ui/main.ts, function applyInlineDoctrineEdits (lines 575-592). (1) Import counts from '../doctrine/registry' (already exported; io.ts uses it). (2) Inside the loop, accumulate rejections: for type==='number', if !Number.isFinite(parseFloat(el.value)) push { path, reason: 'new value is empty or not a number' } and continue (skipping the source/status writes for that row is fine since the whole apply will be refused). (3) After the loop, if rejected.length > 0 return an all-or-nothing failure report matching io.ts's shape — { ok: false, applied: 0, dryRun: false, rejected, message: 'Rejected — ' + rejected.length + ' entr(y/ies) failed validation; nothing was applied.', counts: counts() } — so the existing reportBlock renderer in src/layout/tools.ts:173-183 lists each bad row with no new UI code. Otherwise fall through to the existing importDoctrine call. Edge cases to preserve: (a) untouched rows are pre-filled with their current value (tools.ts:190) so they always parse — rejecting on empty cannot break unedited rows; (b) boolean/string rows are unaffected; (c) the caller at main.ts:470-475 already branches on report.ok, so no changes needed there; (d) keep the all-or-nothing contract — do not partially apply the parseable rows. Optionally add one test if the harness has DOM available (a11y.test.ts suggests it does): render the fill table, blank one number input, check verified, assert the returned report has ok:false and the leaf's status is still PLACEHOLDER.

#### 58. Loading a saved setup silently discards the current unsaved setup and wipes the undo stack

`src/ui/main.ts:414` · **MEDIUM** · ux · effort: trivial

**Problem.** scenario-load replaces inputs and calls history.reset(s.inputs) (which empties past AND future in src/state/history.ts:45-49) with no confirmation and no history push. Failure scenario: user spends 20 minutes tuning an unsaved position, opens Saved setups to peek at an old one, taps Load — the working setup is gone, Ctrl+Z does nothing (undo stack was reset), and there is no path back. Contrast: scenario-delete on the very same overlay does window.confirm, and plan-apply (line 510) correctly uses history.push so it stays undoable.

```
if (id) scenarioStore.load(id).then((s) => { if (s) { store.replaceInputs(s.inputs); history.reset(s.inputs); syncHistory(); ... hideOverlay(); } });
```

**Fix.** One-line change in src/ui/main.ts:414: replace `history.reset(s.inputs)` with `history.push(s.inputs)`, exactly matching the existing plan-apply pattern at line 510 (syncHistory() is already called on the same line, so undo-button state updates correctly). Also update the now-stale design comment at src/state/history.ts:2-3 ("scenario changes are deliberately NOT history events") to say scenario LOADS are history events since they replace inputs. Edge cases to preserve: (a) keep `history.reset(DEFAULT_INPUTS)` in the 'reset' action (main.ts:376) as-is — reset-to-defaults is explicitly labeled destructive and intentionally clears history; (b) known cosmetic wrinkle to accept or optionally handle: after undoing a load, inputs revert but activeScenarioId/activeScenarioName (set at main.ts:414) still show the loaded scenario's name — if desired, clear them in the 'undo'/'redo' cases, but the minimal fix can accept the label mismatch; (c) no test changes required (test/state.test.ts pins only the history data structure), though a one-line assertion that push after load keeps canUndo() true would pin the new behavior. The alternative fix (confirm-if-dirty) requires tracking a last-committed snapshot and adds a modal — history.push is strictly less code and makes Load undoable rather than merely guarded.

#### 59. Loading a scenario mid-edit destroys the unsaved working state with no confirmation and wipes the undo history

`src/ui/main.ts:414` · **MEDIUM** · ux · effort: small

**Problem.** Sequence: build/edit an unsaved setup, open Saved setups, click Load on any scenario. The handler calls store.replaceInputs(s.inputs) AND history.reset(s.inputs) — the redo/undo stacks are emptied, so unlike a normal edit there is no way back: the unsaved working inputs are unrecoverable (the continuous session persistence has also already been overwritten by the post-load setState). One mis-tap on Load in the scenario list permanently discards in-progress work; contrast with 'plan-apply' (line 510), which pushes onto history so it can be undone.

```
case 'scenario-load': {
  const id = actionEl.dataset['id'];
  if (id) scenarioStore.load(id).then((s) => { if (s) { store.replaceInputs(s.inputs); history.reset(s.inputs); syncHistory(); ... } });
  break;
}
```

**Fix.** Use a confirmation guard, NOT history.push (push contradicts the documented design in src/state/history.ts:2-3 that scenario changes are not history events, and undo-after-load would leave activeScenarioId/activeScenarioName stale since the undo/redo handlers never clear them). In src/ui/main.ts, case 'scenario-load' (line 412-416): before calling scenarioStore.load, add a dirty check — `if (history.canUndo() && !window.confirm('Load this scenario? Your current unsaved edits will be replaced.'))` then break. history.canUndo() is a precise dirty signal because every flow that establishes a clean baseline (boot at line 54, 'reset' at 375-376, and a prior scenario-load itself) calls history.reset, so canUndo()===true exactly when the user has made input edits since the last baseline. Optionally include the scenario name in the message by adding data-name="' + esc(s.name) + '" to the Load button in src/layout/tools.ts:45 (mirroring the existing delete button's data-name) and reading actionEl.dataset['name']. Edge cases to preserve: (1) keep history.reset(s.inputs) after a confirmed load — the loaded scenario must become the new clean baseline with empty undo/redo stacks; (2) keep the existing setState({activeScenarioId, activeScenarioName}) and hideOverlay() ordering; (3) minor accepted over-prompt: after 'scenario-save' the history is not reset, so canUndo() stays true and the confirm will appear even though work was just saved — acceptable, or optionally call history.reset(store.getState().inputs)+syncHistory() in the save success handler to make save establish a clean baseline too. This matches the window.confirm precedent already used by 'scenario-delete' (main.ts:429). No test currently pins the handler; the pure history-reset semantics test (test/state.test.ts:73-74) is unaffected.

#### 60. Mission BOM on-hand entry rebuilds the overlay after every field, destroying focus and scroll

`src/ui/main.ts:312` · **MEDIUM** · ux · effort: small

**Problem.** Every 'change' on a data-onhand input calls openMission(), which replaces overlayBody.innerHTML with a freshly rendered table. The focus-restore machinery only covers #app (focusKey bails when the active element is not inside app, main.ts:196-197), so focus is dumped to <body> and the overlay's scroll position resets after every single entry. Scenario: a user entering on-hand quantities for a 12-line mission BOM — Tab to the next field fires change on the previous one, the table is rebuilt mid-keystroke, and they must re-locate and re-click every subsequent field (mouse users lose the click that was targeting the next field, since it lands on a destroyed node).

```
if (el instanceof HTMLInputElement && el.dataset['onhand']) {
  onHand[el.dataset['onhand']] = Math.max(0, parseInt(el.value, 10) || 0);
  persistSession();
  openMission();
  return;
}
```

**Fix.** Surgical in-place update instead of a rebuild — only the row's shortfall cell can change when on-hand changes (aggregateMission totals are labor-based and independent of onHand, so the .mission-tot line never changes).

1. src/layout/tools.ts: export the existing private num() helper (line 29) so the cell format stays byte-identical to a full re-render (it renders num(l.shortfall ?? 0)).
2. src/ui/main.ts, change-handler branch at lines 309-314: keep the onHand[...] = Math.max(0, parseInt(el.value,10) || 0) write and persistSession(), but replace openMission() with:
   - const v = onHand[el.dataset['onhand']]; if (el.value !== String(v)) el.value = String(v);  // preserves the clamp-snap the full rebuild provided implicitly (e.g. typing -3 must display 0)
   - const line = aggregateMission(store.getState().missionSet, { onHand }).lines.find(l => l.id === el.dataset['onhand']);
   - const cell = el.closest('tr')?.lastElementChild as HTMLElement | null;
   - if (line && cell) { cell.textContent = num(line.shortfall ?? 0); cell.classList.toggle('short', (line.shortfall ?? 0) > 0); }
   (aggregateMission and num need importing in main.ts; aggregateMission is already imported for openMission.)

Edge cases to preserve: (a) mission-add / mission-clear actions at main.ts:491-493 must keep calling openMission() — full rebuild is correct there since they're button clicks, not mid-entry; (b) the clamp-snap of the visible value (negative/NaN input shows the clamped 0); (c) persistSession() must still fire since onHand lives outside the store; (d) the shortfall cell is the row's lastElementChild per the fixed 4-column row template in tools.ts:71-75 — if that template changes, prefer a data-shortfall attribute on the cell, but closest('tr').lastElementChild is fine today. Optionally pin with a small jsdom test asserting that a change event on a data-onhand input does not replace the sibling inputs (same element identity before/after) and updates the shortfall cell text.

#### 61. Mission/compare working sets destroyed by one un-confirmed tap: Clear buttons and compare-standards overwrite, none undoable

`src/ui/main.ts:493` · **MEDIUM** · ux · effort: small

**Problem.** mission-clear (line 493) and compare-clear (line 498) wipe their sets on a single click with no confirmation, and compareStandards() (lines 707-710) silently REPLACES a hand-built comparison set with the three-standards preset — the button sits right next to 'Add current' in the same overlay. These sets are not in the undo history (only Inputs are, per src/state/history.ts), so the loss is unrecoverable. Failure scenario: user assembles a 12-position mission set with on-hand quantities entered, reaches for 'Add current position' and hits the adjacent 'Clear' — everything gone instantly. Inconsistent with scenario-delete on the scenarios overlay, which does window.confirm.

```
case 'mission-clear': store.setState({ missionSet: [] }); openMission(); break;
...
function compareStandards(): void {
  store.setState({ comparisonSet: (['hasty','deliberate','reinforced'] as const).map(...) });
```

**Fix.** All edits in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts, mirroring the existing scenario-delete confirm pattern (main.ts:429) including its 'This cannot be undone.' copy style. (1) case 'mission-clear' (line 493): read n = store.getState().missionSet.length; only clear when n === 0 || window.confirm('Clear all ' + n + ' position(s)? This cannot be undone.'); always call openMission() afterward regardless of choice so the overlay re-renders. (2) case 'compare-clear' (line 498): same pattern with comparisonSet ('Clear the comparison (' + n + ' setup(s))? …'). (3) compareStandards() (line 707): at top, const set = store.getState().comparisonSet; if (set.length > 0 && !window.confirm('Replace the current comparison (' + set.length + ' setup(s)) with Hasty vs Deliberate vs Reinforced?')) { openCompare(); return; } then proceed. Edge cases to preserve: never prompt when the set is empty — the empty-state compare overlay (src/layout/tools.ts:87) advertises the standards button as a one-click entry point and must stay frictionless (the mission Clear button is already hidden at count 0 per tools.ts:67, but keep the n===0 short-circuit for safety); always re-open the overlay after the handler so the details-menu auto-close logic at main.ts:521-524 still leaves a consistent view; do not touch the module-level onHand record (it is intentionally keyed by BOM line id and survives clears). No test updates needed — no existing test dispatches these actions; optionally add one jsdom test asserting mission-clear is a no-op when confirm returns false.

#### 62. Modal overlay never receives focus — no focus move, trap, or restore

`src/ui/main.ts:561` · **MEDIUM** · a11y · effort: small

**Problem.** showOverlay() sets innerHTML and unhides the overlay but never moves focus into the dialog; hideOverlay() never restores it. The dialog is marked role="dialog" aria-modal="true" (index.html:22), so screen readers treat everything OUTSIDE it as inert — yet keyboard focus stays on the trigger button behind the modal. Concrete failure: a keyboard/NVDA user picks 'Help' from the hamburger menu → the dialog opens, focus remains on the (now aria-modal-hidden) menu item; Tab walks through background controls the SR reports as nonexistent, and the dialog content is unreachable without manual virtual-cursor navigation. WCAG 2.4.3 failure on every overlay (trace, help, scenarios, mission, compare, plan, doctrine, diagnostics).

```
function showOverlay(html: string): void {
  overlayBody.innerHTML = html;
  overlay.hidden = false;
}
function hideOverlay(): void {
  overlay.hidden = true;
```

**Fix.** Single file: src/ui/main.ts (markup needs no change — .overlay-close at src/ui/index.html:23 is a static sibling of #overlay-body inside .overlay-card, so innerHTML swaps never destroy it).

1. Add module-level `let overlayReturnFocus: HTMLElement | null = null;` near the overlay section (~line 560).
2. In showOverlay(): ONLY when `overlay.hidden` is true (hidden→visible transition), capture `document.activeElement instanceof HTMLElement ? document.activeElement : null` into overlayReturnFocus. This guard is load-bearing: openDoctrine() re-calls showOverlay while the overlay is already open (doctrine-sc-toggle at line 476, doctrine-apply-edits at 470), and capturing then would save an element inside the dialog. After unhiding, call `overlay.querySelector<HTMLElement>('.overlay-close')?.focus()`.
3. In hideOverlay(): after hiding, `if (overlayReturnFocus?.isConnected) overlayReturnFocus.focus({ preventScroll: true });` then null it. The isConnected guard matters because hideOverlay is also called from scenario-load (line 414) and plan-apply (line 510), which trigger a full shell re-render that replaces the trigger element; preventScroll matches the existing refocus convention at lines 257/263.
4. Tab trap: add a keydown listener on `overlay` — on 'Tab', query focusable elements inside .overlay-card (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`, filtered by !disabled), and wrap focus from last→first (and Shift+Tab first→last) via preventDefault + focus. Doctrine fill-table inputs/selects must remain tabbable inside the trap.
5. Do NOT touch the global Escape handler (line 543-545) or backdrop-click close (569-571) — both already route through hideOverlay and get restore for free.
6. Optional runnable check per repo convention: a small vitest jsdom test (like existing test/*.test.ts style, if a DOM environment is configured) asserting showOverlay moves focus to .overlay-close and hideOverlay restores it to the trigger; skip if the test setup is node-only, since the logic is thin DOM glue.

#### 63. Offline behavior differs per entry page: SW registered only by index; standalone woodframe deploy ships no sw.js at all

`src/ui/main.ts:741` · **MEDIUM** · ux · effort: small

**Problem.** Only main.ts registers ./sw.js; woodframe-scene.ts and hub.html register nothing. Consequences: (1) a user who bookmarks woodframe.html or hub.html directly on the multi-page deploy and never opens SAP-1 gets zero offline capability, while a user who happened to visit index first gets whole-origin SW control (and then the wrong-page fallback from the sw.js finding); (2) the dist-woodframe standalone deployment cannot be offline-capable at all — vite.woodframe.config.ts sets publicDir:false so sw.js is not even copied — yet woodframe.html's header comment claims 'Same offline posture as the app' (vite.woodframe.config.ts:7) and hub/footers advertise offline-first.

```
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {   // main.ts:741
  navigator.serviceWorker.register('./sw.js')...
// vite.woodframe.config.ts:12: publicDir: false,
// woodframe.html / hub.html: no serviceWorker registration anywhere
```

**Fix.** Three coordinated edits. (1) src/ui/hub.html and src/ui/woodframe.html: add one identical inline script before </body> mirroring the main.ts guard exactly — if ('serviceWorker' in navigator && location.protocol.startsWith('http')) { addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {})); }. The protocol guard preserves the file:// standalone artifact (SWs don't run from file://), and the .catch makes the registration harmless in dist-woodframe if sw.js is absent (404 -> rejected promise, swallowed). Keep the snippet same-origin-only so the check:offline gate still passes. (2) public/sw.js: add './hub.html' and './woodframe.html' to CORE (line 6) so any first-visited page precaches all three entries, and bump CACHE to 'sap1-v2' so existing installs refresh (the activate handler already deletes old caches). Do NOT touch the './index.html' offline fallback at sw.js:34 here — that's the separate wrong-page-fallback finding; just ensure hub/woodframe being precached means the fallback rarely fires for them. (3) vite.woodframe.config.ts: lazy option (recommended) — correct the line-7 comment to state the standalone artifact makes zero external requests but has no service worker (not offline-after-first-load over http); alternatively, if true offline parity is wanted, add a tiny closeBundle hook that writes a woodframe-scoped sw.js (CORE: ['./', './woodframe.html'] plus the emitted assets/*.js) into dist-woodframe — but the comment fix is the honest minimum. Edge cases the fix must preserve: file:// operation of the inlined standalone (protocol guard), the check:offline external-URL gate over ALL emitted pages, and the fact that woodframe.html source is shared by both the multi-page and standalone builds (the inline snippet must be safe in both, which the .catch guarantees). Verification: npm run build, then serve dist/, visit only hub.html, kill network, reload — hub and woodframe must load from cache.

#### 64. Overlay dialog never receives focus and has no focus trap despite aria-modal

`src/ui/main.ts:561` · **MEDIUM** · a11y · effort: small

**Problem.** showOverlay only sets innerHTML and hidden=false; focus is never moved into the dialog and never returned on close. The card is marked role=dialog aria-modal=true (index.html:22), which tells screen readers the background is inert — but keyboard focus actually stays on the (now-closed) menu item behind the modal, and Tab walks through the visually obscured background controls instead of the dialog. Scenario: a keyboard/SR user opens Help from the hamburger menu — the SR reports a modal dialog, yet the next Tab lands on background toolbar buttons they cannot see; interacting with them mutates the page behind the modal.

```
function showOverlay(html: string): void {
  overlayBody.innerHTML = html;
  overlay.hidden = false;
}
// index.html: <div class="overlay-card" role="dialog" aria-modal="true" …>
```

**Fix.** Two files. (1) src/ui/index.html:22 — add tabindex="-1" to the .overlay-card div so it can receive programmatic focus. (2) src/ui/main.ts — a) add module-level `let overlayReturn: HTMLElement | null = null;` near the overlay consts (line ~38); b) in showOverlay (line 561), only when `overlay.hidden` is currently true (guards the re-entrant doctrine re-renders at lines 65/470/476 from clobbering the return target or stealing focus from an input mid-edit): capture `overlayReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null`, then after unhiding call `overlay.querySelector<HTMLElement>('.overlay-card')?.focus()`; c) in hideOverlay (line 565), after hiding: `if (overlayReturn?.isConnected) overlayReturn.focus({ preventScroll: true }); overlayReturn = null;` — the isConnected guard matters because the app shell re-renders as an HTML string and may have replaced the trigger; if disconnected, optionally fall back to the menu summary via the existing focusKey-style selector, or accept focus dropping to body (acceptable floor); d) focus trap: add one keydown listener on `overlay` for Tab that queries visible focusables inside .overlay-card (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`, filtered by offsetParent !== null since the card scrolls) and wraps first<->last on Tab/Shift+Tab; because overlayBody content is swapped via innerHTML, the query must run per-keydown, not be cached. Edge cases to preserve: Escape close path (main.ts:543-545) must still work and now also restores focus via hideOverlay; backdrop-click close (line 569) same; the Close button stays first in DOM order so Shift+Tab from the card lands on it; doctrine overlay inline inputs (data-fillpath) must keep focus across the sc-toggle/apply-edits re-render — the hidden-check in (b) plus the existing shell refocus mechanism cover this since the overlay never transitions hidden→visible during those re-renders.

#### 65. Reset is one un-confirmed tap that irrecoverably destroys the current setup (undo history wiped too)

`src/ui/main.ts:375` · **MEDIUM** · ux · effort: trivial

**Problem.** The Reset button lives in the always-visible bottom toolbar directly between Redo and Theme (shell.ts:148-151), a mis-tap magnet on mobile. The handler replaces inputs with defaults AND calls history.reset(DEFAULT_INPUTS), which clears past/future (history.ts:45-49) — so Undo cannot bring the setup back, and persistSession immediately overwrites the stored session with defaults. scenario-delete gets a window.confirm (main.ts:429) but this equally destructive action gets none. Scenario: user fat-fingers Reset while reaching for Redo/Theme → unsaved plan gone with no recovery path.

```
case 'reset':
  store.replaceInputs(DEFAULT_INPUTS);
  history.reset(DEFAULT_INPUTS);
  store.setState({ activeScenarioId: null, activeScenarioName: null, layoutOverride: 'auto' });
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts line 376, change `history.reset(DEFAULT_INPUTS)` to `history.push(DEFAULT_INPUTS)`, mirroring the existing undoable-replacement pattern at main.ts:510 ('plan-apply': replaceInputs + history.push + syncHistory). Prefer this over a confirm dialog — shell.ts documents the toolbar as actions "used constantly while iterating," so a dialog adds friction while push makes one Undo restore the prior setup (persistSession re-fires on undo, so the stored session recovers too). Keep everything else in the case unchanged: setState clearing activeScenarioId/activeScenarioName and layoutOverride:'auto' (the layoutOverride reset is the documented escape hatch when a forced mobile layout hides the View picker — see comment at main.ts:370-373), plus recomputeLayout() and syncHistory(). Edge cases to preserve: (1) Undo after reset restores inputs but intentionally NOT the scenario association or layout override — history.ts's header states layout/theme/scenario changes are deliberately not history events, so this is consistent; (2) push clears the redo branch, which is standard and correct; (3) do NOT touch the history.reset at main.ts:414 (scenario-load) — starting a fresh history when loading a scenario is intentional and out of scope for this finding. Optionally add a 3-line assertion to a test (e.g. new test/history-reset-undo.test.ts) pinning that push-then-undo returns the prior inputs, since no existing test covers the reset action.

#### 66. Save always creates a brand-new scenario and the list shows undated name-only rows — duplicates are indistinguishable

`src/ui/main.ts:394` · **MEDIUM** · ux · effort: small

**Problem.** scenario-save always prompts for a name and mints a new id (newId()) even when a scenario is active (activeScenarioId set) — there is no 'update the loaded setup' path. scenariosOverlay (src/layout/tools.ts:42-48) renders only s.name per row; savedAt is stored by makeScenario but never displayed. Failure scenario: user loads 'OP North', tweaks it, saves it again typing the same name — the list now shows two identical 'OP North' rows with no date or any distinguishing detail; days later they Load the stale copy and build from outdated numbers.

```
case 'scenario-save': {
  const name = window.prompt('Scenario name:');
  if (name !== null) {
    const id = newId();
    ... scenarioStore.save(makeScenario(id, finalName, store.getState().inputs, new Date().toISOString()))
```

**Fix.** Two edits, no new files. (1) src/ui/main.ts case 'scenario-save' (line 393): read activeScenarioId/activeScenarioName from store.getState() first. If active, ask window.confirm('Update "<activeName>"? Cancel to save as a new scenario.') — on OK, reuse the active id and name (skip the name prompt), call scenarioStore.save(makeScenario(activeId, activeName, inputs, new Date().toISOString())) with the same .then (toast 'Updated …', openScenarios) and .catch (lastError + storage-failure toast) as the existing branch; on Cancel fall through to the existing prompt+newId flow unchanged. If no active scenario, behavior is exactly as today. (2) src/layout/tools.ts scenariosOverlay row (lines 42-48): add a '<span class="scn-date">' rendering s.savedAt formatted via new Date(s.savedAt).toLocaleString() — savedAt is OPTIONAL in the schema (imported scenarios may omit it, schema.ts:103) and may be an arbitrary string from import, so guard: only render when present and Number.isFinite(Date.parse(s.savedAt)), else render nothing or an em dash; pass output through esc() per the file's XSS convention. Add a small .scn-date rule (muted color, smaller font) in src/ui/styles.css next to the existing .scn styles. Edge cases to preserve: save-failure catch path with lastError + toast in both branches; activeScenarioId/Name state update after save; scenario-delete's active-clear logic untouched; escaping of all interpolated strings. Optional per auditor suggestion (skip to stay lazy): one-line position/standard summary per row — not required to fix the core defect. Add/extend one test asserting scenariosOverlay renders savedAt when present and omits it when absent (tools.ts render functions are pure, easy to unit test).

#### 67. Schedule overlay reopens with a stale 'ready by stand-to' verdict computed for previous inputs, with no recompute or stale marker

`src/ui/main.ts:478` · **MEDIUM** · bug · effort: trivial

**Problem.** Sequence: run 'Build the timeline' for the current position (lastSchedule cached from lastResult), close the overlay, change standard/soil/threat/count (compute re-runs, lastResult changes), then reopen Build schedule from the menu. openSchedule() renders the cached lastSchedule verbatim — scheduleOverlay prints 'Ready with N hr to spare' / 'NOT ready by stand-to — short N hr' (tools.ts:124-126) for the PREVIOUS position with no indication it is stale. A leader who upgraded hasty→reinforced and reopens the schedule sees the old 'Ready' verdict and per-stage H+ times that no longer partition the new position's man-hours.

```
case 'schedule': openSchedule(); break;
// main.ts:115-117:
function openSchedule(): void {
  showOverlay(scheduleOverlay(lastSchedule, schedTeam, schedHours, schedPosture));
}
```

**Fix.** In src/ui/main.ts, make openSchedule() recompute before rendering when a schedule has ever been built: change openSchedule() (line 115-117) to `function openSchedule(): void { if (lastSchedule) runSchedule(); showOverlay(scheduleOverlay(lastSchedule, schedTeam, schedHours, schedPosture)); }`. runSchedule() already guards `if (!lastResult) return` and reads teamSize/hours/posture from the persisted schedTeam/schedHours/schedPosture and machineAssist from the current lastResult.inputs, so the recomputed schedule always matches the current position with the user's saved scheduler settings. Edge cases to preserve: (1) first-open empty state — lastSchedule null skips recompute and still shows the form-only overlay (tools.ts:121-122); (2) the 'schedule-run' handler (main.ts:479-488) will now compute twice (runSchedule in the handler, then again in openSchedule) — idempotent and cheap, no change needed, or optionally drop the explicit runSchedule() call there; (3) compute-error state — render() keeps the previous good lastResult on error, so the recomputed schedule stays consistent with what the app displays. Optionally apply the same one-line pattern to openPlan()/lastPlan (main.ts:164, 506), which has the identical stale-cache defect. Add one small test if the harness allows (e.g. in test/, assert scheduleStages output changes when the underlying stages change) — though the fix itself is a UI wiring one-liner and existing engine tests already cover scheduleStages.

#### 68. Second tab silently overwrites the newer session: single sap1-session key written on every state change, no storage-event sync

`src/ui/main.ts:282` · **MEDIUM** · data · effort: small

**Problem.** persistSession is subscribed to EVERY store change (theme toggle, layout-mode change on resize, mission/compare mutations — not just input edits) and writes the whole snapshot (inputs + missionSet + comparisonSet + onHand) to the single localStorage key 'sap1-session' (src/state/session.ts:12). There is no 'storage' event listener anywhere in src/ (verified by grep), so two tabs never resynchronize. Failure: user builds a new plan in tab B, then briefly returns to an older tab A and toggles the theme or triggers a breakpoint change by resizing — tab A's subscriber immediately rewrites sap1-session with its stale inputs/mission/compare sets. If the user then closes both tabs (or tab B is evicted), reopening the app restores tab A's stale plan and the newer work is gone.

```
store.subscribe(scheduleRender);
store.subscribe(persistSession);
// session.ts:12: export const SESSION_KEY = 'sap1-session';
// grep addEventListener('storage') in src/ → no matches
```

**Fix.** Single-file fix in src/ui/main.ts: adopt the other tab's snapshot when localStorage changes under us, so this tab's next write can never clobber newer data. (1) Import SESSION_KEY from ../state/session (already exported). (2) Extract a small adoptSnapshot(snap: SessionSnapshot) helper that: clears and Object.assigns the module-level onHand record, calls store.setState({ inputs: snap.inputs, missionSet: snap.missionSet, comparisonSet: snap.comparisonSet }), then history.push(store.getState().inputs) and syncHistory() so undo/redo buttons stay coherent. (3) Add near the boot code: window.addEventListener('storage', (e) => { if (e.key !== SESSION_KEY || !sessionStorage_) return; const snap = restoreSession(sessionStorage_); if (snap) adoptSnapshot(snap); }). Edge cases to preserve: reuse restoreSession so all adopted bytes go through schema.ts validation (session.ts header: never trust stored bytes) and a null/invalid snapshot is ignored; guard on sessionStorage_ being null (private mode); no ping-pong loop — storage events fire only in other tabs and only when the value actually changes, and adopting then re-persisting identical JSON is a no-op for other tabs; the setState-triggered re-render already handles focus/scroll restore via render()'s existing capture/restore logic. The adopt path's validation logic is already covered by existing session tests (restoreSession); the listener itself is DOM glue — optionally add one jsdom test dispatching a StorageEvent against the extracted adoptSnapshot if the repo's test conventions demand it. Do NOT rename sessionStorage_ in the same change (cosmetic churn), though a follow-up rename to localStorage_ would prevent future confusion.

#### 69. Two open tabs silently clobber each other's working-session snapshot (last write wins)

`src/ui/main.ts:282` · **MEDIUM** · data · effort: small

**Problem.** Every state change in every tab writes the FULL session snapshot (inputs, mission set, compare set, on-hand) to the single fixed localStorage key 'sap1-session' (session.ts:12), and there is no 'storage' event listener or BroadcastChannel anywhere in the app to detect or reconcile a concurrent writer. Failure scenario: user builds a mission set in tab A (persisted on each change), then touches any control in an older tab B that still holds default state — B overwrites the key with its empty snapshot. After closing both tabs, the next boot restores B's snapshot and tab A's unsaved working plan is gone, despite the module's stated guarantee that 'a plan built on a phone must not vanish'.

```
main.ts:282  store.subscribe(persistSession);
session.ts:12  export const SESSION_KEY = 'sap1-session';
session.ts:29  storage.setItem(SESSION_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...snap }));
(grep: no addEventListener('storage') or BroadcastChannel in src/)
```

**Fix.** All changes in src/ui/main.ts; src/state/session.ts stays pure (tests inject a Map-backed KVSync fake — do not put window listeners there). Approach: adopt-the-newer-write via the native 'storage' event, no timestamps needed (localStorage is inherently last-write-wins, so whatever is stored IS newest). (1) Factor an adoptSession() helper in main.ts: call restoreSession(sessionStorage_) — reusing the existing schema validation, never parse e.newValue directly — and if non-null, set a module-level `adopting = true` flag, store.setState({inputs, missionSet, comparisonSet}), mutate the existing `onHand` object in place (delete all keys then Object.assign — it is a captured const referenced by handlers), push adopted inputs onto history and call syncHistory(), then clear the flag. (2) Guard persistSession with `if (adopting) return;` — critical: without it, adoption triggers setState → persistSession → a fresh write → storage event in the other tab → potential adopt/write ping-pong. (3) window.addEventListener('storage', e => { if (e.key === SESSION_KEY && e.newValue !== null) adoptSession(); }). (4) Belt-and-braces for frozen/BFCache mobile tabs that miss storage events: in persistSession record the serialized string as lastWrittenRaw (or have saveSession return it); on document visibilitychange→visible, read the raw key and if it differs from lastWrittenRaw, adoptSession(). Edge cases to preserve: quota/private-mode try/catch in saveSession unchanged; restoreSession's degrade-to-defaults validation path unchanged; e.newValue === null (key cleared) must not adopt; the existing rAF render + refocus/scroll-restore path handles the re-render an adoption triggers. Known ceiling (mark with a ponytail: comment): an overlay open in the stale tab shows stale contents until reopened, and simultaneous edits in both tabs still resolve last-write-wins per keystroke — full CRDT merge is out of scope. Add one small test (e.g. in test/state.test.ts or a new test/session-multitab.test.ts) exercising the factored adopt logic with the fake KVSync: write snapshot A, mutate storage externally to snapshot B, adopt, assert store state matches B and that persist-during-adopt is suppressed.

#### 70. typeof localStorage throws at module scope when storage is disabled — app never boots

`src/ui/main.ts:46` · **MEDIUM** · bug · effort: trivial

**Problem.** In Chrome with 'Block all cookies' enabled (and in sandboxed/storage-partitioned iframes), accessing window.localStorage throws SecurityError from the property getter itself, and the typeof operator does NOT suppress getter throws (it only special-cases unresolvable references). main.ts evaluates `typeof localStorage` at module top level with no try/catch, so the whole module throws before first render — blank page, no error boundary. The codebase clearly intends to survive this environment: theme.ts wraps every localStorage access in try/catch and session.ts documents 'private-mode failures are non-fatal', but this one line defeats all of it. Failure scenario: user with cookies/site-data blocked opens the app -> white screen instead of a working planner with defaults.

```
const sessionStorage_ = typeof localStorage !== 'undefined' ? localStorage : null;
```

**Fix.** Single edit in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts line 46. Replace `const sessionStorage_ = typeof localStorage !== 'undefined' ? localStorage : null;` with: `let sessionStorage_: Storage | null = null; try { sessionStorage_ = window.localStorage; } catch { /* storage blocked (cookies disabled / sandboxed iframe) — boot with defaults, no session persistence */ }`. Edge cases to preserve: (a) keep the type `Storage | null` so restoreSession/saveSession (which accept the KVSync subset) still typecheck; (b) both existing call sites (line 47 restore, line 69 persistSession) already null-check, so no other changes needed; (c) the try/catch also covers non-browser evaluation (ReferenceError on `window`), preserving the intent of the old typeof guard; (d) do NOT touch theme.ts/session.ts/persistence.ts — they are already correctly guarded. No new test is practical for top-level app wiring; optionally verify manually by running the app with a devtools-injected throwing localStorage getter or Chrome's Block-all-cookies setting and confirming the planner renders with defaults.

#### 71. Closed mobile bottom-sheet keeps its whole form keyboard-focusable while aria-hidden="true"

`src/ui/styles.css:200` · **MEDIUM** · a11y · effort: small

**Problem.** The closed sheet is hidden purely by transform: translateY(100%) — no visibility:hidden or inert — while the markup sets aria-hidden="true" (mobile.ts:27). All ~15 selects/inputs/checkboxes inside remain in the Tab order. Scenario: a keyboard user on the mobile layout tabs past the toolbar and lands on invisible, off-screen controls; typing changes inputs with no visible feedback. For screen readers this is the classic aria-hidden-on-focusable-content failure (WCAG 4.1.2): focus lands on elements the accessibility tree says do not exist.

```
.bottom-sheet {
  position: fixed; … transform: translateY(100%); transition: transform 0.22s ease; …
}
.bottom-sheet[data-open="true"] { transform: translateY(0); }
// mobile.ts: aria-hidden="' + !sheetOpen + '"
```

**Fix.** Use the inert attribute, mirrored everywhere data-open is set (inert removes content from both the tab order and the accessibility tree, and — unlike visibility:hidden — needs no transition-delay hack because it does not affect rendering, so the 220ms close animation still plays; baseline browser support since 2023).

1. src/layout/mobile.ts:27 — bake initial state into the markup, matching the existing 'never a wrong state to force-paint' invariant documented at the top of that file: add (sheetOpen ? '' : ' inert') to the .bottom-sheet div string, alongside the existing data-open/aria-hidden.
2. src/ui/main.ts applySheet() (~line 614-617) — add sheet.toggleAttribute('inert', !sheetOpen) next to the aria-hidden setAttribute. This single choke point covers all close paths: toolbar toggle (line 389), Escape (line 547), and drag-dismiss (endDrag, line 659).
3. Focus restore on close: when Escape or drag-dismiss closes the sheet while focus is inside it, inert blurs focus to <body>; move it to the toolbar trigger instead — in applySheet(), if (!sheetOpen && sheet.contains(document.activeElement)) trigger?.focus({ preventScroll: true }). The trigger element is already queried at line 613.
4. Keep aria-hidden as-is (belt-and-braces with inert is harmless and the pair stays consistent).
5. Test: add a small node:test case (pattern of existing test/*.ts) asserting arrangeMobile(parts, false) output contains 'inert' on the .bottom-sheet div and arrangeMobile(parts, true) does not — pins the markup half of the fix.

Edge cases to preserve: the 220ms open/close transition must not replay on re-render (why state is baked into markup — step 1 preserves this); drag-to-dismiss threshold behavior in endDrag must still call the single applySheet(); the refocus-after-rerender logic at main.ts:252-265 uses preventScroll — mirror that in step 3 to avoid mobile scroll jumps.

#### 72. Night theme input hints fail WCAG AA contrast (3.66:1 at 11px)

`src/ui/styles.css:129` · **MEDIUM** · a11y · effort: trivial

**Problem.** .ctrl-hint renders 11px text in var(--ink-soft) at opacity 0.8. In night theme --ink-soft is #c76a45 (tokens.css:72) on --surface #140c0a; at 80% opacity the effective color is #a35739, giving a computed contrast of 3.66:1 — below the 4.5:1 WCAG AA minimum for normal-size text (11px is far from the 18.66px-bold large-text exemption). Every plain-language hint under every form control ('What you're digging into…', 'A bigger weapon needs thicker cover…') is degraded in exactly the low-light mode built for field use, contradicting tokens.css's own header claim 'Both meet WCAG AA (§12)'. Day theme passes (5.23:1); full-opacity night ink-soft passes (5.13:1) — the opacity: 0.8 is the sole culprit.

```
.ctrl-hint { font-size: 11px; color: var(--ink-soft); opacity: 0.8; }
/* tokens.css night: --ink-soft: #c76a45; --surface: #140c0a → blended #a35739 = 3.66:1 */
```

**Fix.** Option A (simplest, one line): delete `opacity: 0.8` from `.ctrl-hint` in src/ui/styles.css:129. Night becomes 5.13:1 and day 9.23:1 — both pass. Side effect: day hints darken from the current muted #6f6c66 look to full #4b4740, losing the visual hierarchy between hint and label. Option B (preserves day appearance pixel-identically): add a `--ink-hint` token in src/ui/tokens.css — day block: `--ink-hint: #6f6c66;` (exactly the current day blended color, 5.23:1) and night block: `--ink-hint: #c76a45;` (same as ink-soft, 5.13:1) — then change styles.css:129 to `color: var(--ink-hint);` and drop the opacity. Option B is preferred because it fixes only the failing theme. Edge cases to preserve: keep font-size 11px (matches the --label-min-px legibility floor token); do not touch .three-hint (styles.css:100), which already passes without opacity; if any print.css styles hints, verify the new token has a sensible print fallback (day value is fine for print). Verification: recompute the two ratios with the same WCAG formula (>=4.5) — a tiny assert-style check or manual node one-liner suffices; also update nothing in tokens.css's header comment since the AA claim becomes true again.

#### 73. Both 3D viewers render the full post pipeline every rAF frame forever — no idle, visibility, or detached-canvas gating

`src/ui/three-viewer.ts:1018` · **MEDIUM** · perf · effort: medium

**Problem.** loop() re-queues itself with requestAnimationFrame and calls pipeline.render() (MSAA render target + tilt-shift + grade + ACES output passes at devicePixelRatio up to 2) on every single frame, even when the camera is idle, no fly/rise animation is active, an overlay fully covers the view, or the canvas is not in the DOM at all — the compute-error path (main.ts:248-251) replaces the shell with errorCardHtml so the canvas is detached, yet WebGL keeps rendering it every frame. woodframe-scene.ts:299-304 has the identical unconditional loop. There is no visibilitychange/IntersectionObserver/on-demand-render logic anywhere in src/ (grep confirms zero hits). rAF pauses only when the TAB is hidden; with the tab visible the GPU runs flat-out continuously. Failure scenario: the app's stated use case is a phone in the field — leaving the planner open on screen while reading the BOM panel drains battery continuously for a completely static diorama; on the error card the GPU burns for a canvas nobody can see.

```
function loop(): void {
  raf = requestAnimationFrame(loop);
  ...
  controls.update();
  pipeline.render();
```

**Fix.** Render-on-demand with a self-extending dirty loop, two files (optionally three).

1. src/ui/three-viewer.ts (main change):
   - Add `let needsFrame = true; let rafActive = false;` and `function requestFrame(): void { needsFrame = true; if (!rafActive) { rafActive = true; raf = requestAnimationFrame(loop); } }`.
   - Rewrite loop(): at the top set `rafActive = false; if (!needsFrame) return;` then `needsFrame = false`. After the existing fly/rise/controls/render/watchdog body, re-arm (`requestFrame()`) iff any continuation condition holds: `fly !== null`, `riseAnims.length > 0`, or a damping-settle tail is active. For damping: OrbitControls with enableDamping fires 'change' whenever update() moves the camera, so hook `controls.addEventListener('change', requestFrame)` — that alone self-sustains the damping tail (each rendered frame's controls.update() emits 'change' until converged) and covers drag/zoom/pan. Also hook 'start' and 'end' with requestFrame for safety.
   - Call requestFrame() from every mutation point: end of update() (three-viewer.ts:1088+ after rebuild), setTheme, setStage-driven paths if separate, flyTo(), startStageRise(), applyCutaway callers, doResize() (covers the ResizeObserver in attach()), and attach() itself. Replace the bare `loop()` at line 1064 with `requestFrame()`.
   - Detached-canvas guard: at the top of loop(), `if (!canvas.isConnected) return;` (leaving needsFrame=false is fine because attach() calls doResize() → requestFrame() on reattach — verify that ordering, it exists today at lines 1079-1087).
   - Watchdog edge case (must preserve): the demotion logic requires 60 contiguous frame deltas; the existing dt>250ms outlier reset (lines 1047-1052) already resets the window after idle gaps, so on-demand pauses cannot poison the average — leave it as-is, but also reset `lastFrameAt = 0` when the loop goes idle so the first frame after a pause doesn't enter the window at all.
   - Preserve: dispose() still cancels raf (no change needed since raf always holds the latest id); the very-first-frame snap path (everFramed) unchanged.

2. src/ui/woodframe-scene.ts:299-304: same pattern, simpler — no damping, no fly/rise. Replace the unconditional loop with requestFrame(); hook controls 'change' (and re-hook after each `new OrbitControls` in setCamera, line 101 — easy to miss), window resize/fitViewport, setStage, rebuild, and the onPropAssetsReady(rebuild) callback (line 295) so the GLB swap-in repaints.

3. Optional: src/ui/props-gallery.ts:79 has the same unconditional loop (dev-only gallery page) — apply the same pattern or explicitly waive with a ponytail: comment.

Verification: one manual check per page — confirm the canvas repaints on drag, stage scrub, theme change, soil change, resize, and after the error card → valid input round-trip (canvas reattach must repaint); confirm via DevTools performance panel that GPU work stops ~1s after the last interaction.

#### 74. Full 3D scene dispose+rebuild on every store notify, and twice per theme toggle

`src/ui/three-viewer.ts:1088` · **MEDIUM** · perf · effort: small

**Problem.** ThreeViewer.update() has no result/opts identity check: it unconditionally runs disposeObject(partsGroup) and rebuilds every mesh, geometry, material, label-sprite canvas texture, and the instanced sandbag batcher, then re-fits lights/shadow camera. main.ts render() (line 238) calls update() on EVERY store notify, so state changes that cannot alter the model still trigger a complete GPU teardown/rebuild: 'compare-add'/'compare-remove'/'compare-clear' (main.ts:496-498), 'mission-add'/'mission-clear' (main.ts:492-493), 'compare-standards' (main.ts:709), scenario save/delete setState (main.ts:401, 431), and layout-override changes. Worse, toggleTheme (main.ts:553-557) calls threeViewer.setTheme(next) — which itself runs api.update() (three-viewer.ts:1204), rebuilding the scene INCLUDING the 1024-px terrain canvas repaint (terrain cache key contains theme) — and then setState({theme}) schedules a second render that rebuilds everything again. Failure scenario: on a mid-range phone, tapping the Theme button performs two back-to-back full scene rebuilds plus two terrain repaints (a visible multi-hundred-ms stall); tapping 'Add to comparison' three times stalls three times for a change that is invisible in 3D. test/perf.test.ts only budgets compute() (measured ~0.014 ms mean) — the actual per-edit heavy path (buildScene3D + viewer rebuild) has zero perf coverage.

```
update(result: Result, opts: ViewOpts = {}) {
  const prevStage = lastOpts.stage;
  lastResult = result;
  ...
  disposeObject(partsGroup);
  partsGroup.clear();
```

**Fix.** Two files. (A) src/ui/main.ts render(): memoize compute by inputs reference — keep `let lastComputedInputs: Inputs | null = null`; if `state.inputs === lastComputedInputs && lastResult` reuse lastResult, else compute and cache both. This is safe because store.setState({...patch}) preserves the state.inputs reference; only setInputs/replaceInputs create a new inputs object. This gives the viewer a stable Result reference. (B) src/ui/three-viewer.ts api.update(): before the disposeObject(partsGroup) line, early-return when nothing that feeds the build changed — compare (result reference, opts.stage, opts.cutaway, closure `theme`, pipeline.tier, and a local `assetsGeneration` counter) against the values captured at the last completed build. Edge cases the guard MUST preserve: (1) onAssetsReady (line 1187) rebuilds with identical result/opts after GLB props load — bump assetsGeneration++ there so the guard misses; (2) resetView (main.ts three-reset, line 512) sets framed=false then calls update with identical args expecting the flyTo re-frame — do not early-return when `!framed` (or have resetView clear the cached build key); (3) setTheme's eager api.update still runs once (theme differs from the captured value), and the second, store-scheduled render then hits the guard (same result ref via fix A, same theme) — this collapses the theme-toggle double rebuild to one with no change to toggleTheme; (4) runtime tier demotion in the frame loop — pipeline.tier is in the key so the next update after demotion rebuilds (terrain fallback path at line 1107 depends on it); (5) stage scrub forward still rebuilds (opts.stage differs) so the startStageRise animation and prevStage logic are untouched. (C) Test: extend test/perf.test.ts with a buildScene3D timing budget (pure function, node-safe, no WebGL needed), and if the guard is extracted as a small pure `sameBuild(prev, next)` helper, add one unit test pinning that identical inputs skip and that stage/theme/assetsGeneration changes do not. Do NOT try to reference-compare inside update() without fix A — safeCompute currently allocates a new Result every render, so the guard would never hit.

#### 75. No WebGL-failure guard: renderer construction failure blanks the entire TIMBER-1 page including its pure-DOM panes

`src/ui/woodframe-scene.ts:56` · **MEDIUM** · ux · effort: small

**Problem.** woodframe-scene.ts constructs THREE.WebGLRenderer unconditionally at module top level. When WebGL context creation fails (GPU blocklist, remote desktop, corporate policy, exhausted contexts), the constructor throws, aborting the whole module — so the stage scrubber, cut-list table, member card, and SVG layout strips (all plain DOM that need no WebGL) never render either. The user sees only the static header/footer with an empty toolbar and empty panels. The main app already guards this exact case (main.ts:122 const webglOk = isWebGLAvailable(); isWebGLAvailable is exported from three-viewer.ts, which this file already imports from) but TIMBER-1 skips the check. props-gallery.ts (dev-only) has the same unguarded pattern at line 9.

```
const viewport = document.getElementById('viewport')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
```

**Fix.** File: /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/woodframe-scene.ts (single file; optional one-liner in props-gallery.ts).

Approach — gate the GL-only pieces, keep the DOM pipeline unconditional:
1. Add `isWebGLAvailable` to the existing import from './three-viewer' (line 8).
2. Replace lines 56-58 with a guarded construction: `const renderer = isWebGLAvailable() ? new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }) : null;` (keep the exact options — preserveDrawingBuffer is load-bearing for the screenshot pipeline). If null, set `viewport.innerHTML` to a short note, e.g. '3D view unavailable (WebGL could not start). Cut lists and layout strips below remain usable.', styled inline to match the page palette. If non-null, keep setPixelRatio + appendChild as-is.
3. Guard the five renderer/controls touchpoints:
   - line 65: `let controls = renderer ? new OrbitControls(persp, renderer.domElement) : null;`
   - fitViewport (line 67): early-return when `!renderer` (it only sizes the canvas/cameras).
   - setCamera (line 98): early-return when `!renderer` (VIEWS buttons become no-ops; they can still be created or skipped — simplest is early-return).
   - raycaster click listener (line 163): only attach when `renderer` is non-null.
   - loop() (lines 299-304): only start when `renderer` is non-null; inside, `controls` is non-null iff renderer is.
4. Leave rebuild()/buildMember()/setStage()/renderStagePanel()/renderStrips() untouched — lumberPiece/plywoodSheet/disposeObject construct geometries, canvas textures, and materials with no GL context (GL upload happens only at render time), so the existing boot `setStage(11); renderStrips();` runs unchanged and the stage chips, cut-list table, member card (reachable via layout-strip clicks, which call renderMemberCard + rebuild + scrollTo — all safe), and SVG strips all work.
5. Keep the `window.__frame` debug hook (line 297); `camera()`/`controls()` may return the unused persp/null in fallback — acceptable for a debug hook.
6. Optional, same pattern, dev-only: props-gallery.ts:9 — wrap in the same isWebGLAvailable() check and `document.body.textContent = 'WebGL unavailable — the prop gallery is 3D-only.'` then skip the rest (that page has no non-GL content, so message-and-stop is correct there).

Edge cases the fix must preserve: exact renderer options (antialias + preserveDrawingBuffer) and Math.min(2, devicePixelRatio) for the existing screenshot workflow; the resize listener must not throw in fallback (covered by fitViewport early-return); strip-mark click → member card flow must keep working without a renderer.

Verification: `npm run build:woodframe` must pass; manual check by stubbing `HTMLCanvasElement.prototype.getContext = () => null` in devtools before load — page should show the note plus fully populated stage chips, cut list, and strips. No automated test: WebGL-context failure is not reproducible under vitest/jsdom without heavy mocking that would pin implementation details rather than behavior.

#### 76. Orbit-drag release clears/changes the member selection and rebuilds the whole scene

`src/ui/woodframe-scene.ts:163` · **MEDIUM** · ux · effort: small

**Problem.** The canvas 'click' listener raycasts and then always calls rebuild(). Browsers fire a click whenever mousedown and mouseup land on the same element, regardless of pointer movement, so every OrbitControls drag (rotate/pan/zoom-drag) ends in a click at the release point. Failure: user taps a stud, Member Card opens; user then rotates the view and releases the pointer over empty sky — selectedId becomes null, the card silently closes and the highlight vanishes (or a random member behind the release point gets selected). Additionally, every such click — including misses — disposes and re-creates all ~242 member wrappers (~484 meshes plus materials), a visible hitch per orbit gesture on weak hardware. There is no pointer-down/up movement threshold anywhere in the handler.

```
renderer.domElement.addEventListener('click', (ev) => {
  ...
  selectedId = id;
  renderMemberCard();
  rebuild();
});
```

**Fix.** Single file: src/ui/woodframe-scene.ts. (1) Add a drag guard: before the existing click listener, add `let downPos: { x: number; y: number } | null = null;` and `renderer.domElement.addEventListener('pointerdown', (ev) => { downPos = { x: ev.clientX, y: ev.clientY }; });`. At the top of the click handler, bail out if `downPos` exists and `Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y) > 5` (the standard three.js click-vs-orbit threshold; works for mouse and touch since pointer events cover both, and setPointerCapture guarantees the events land on the canvas). (2) Skip redundant work: after resolving `id`, `if (id === selectedId) return;` before assigning — this kills both the null→null miss rebuild and re-click-same-member rebuild while still allowing a genuine stationary click on empty space to deselect (null !== current id). Edge cases to preserve: the SVG layout-strip click handlers in renderStrips() (lines 259-266) also set selection + rebuild — leave them untouched (DOM clicks, no orbit involved); deselect-on-genuine-empty-click must keep working; the stage-highlight tint logic inside rebuild() must be unchanged. Do NOT attempt the re-tint-only optimization unless needed — tint() mutates material colors on wrappers whose materials come from lumberPiece/plywoodSheet, and restoring the correct base vs current-stage-highlight color per member duplicates rebuild()'s logic; the full rebuild is acceptable once it only runs on actual selection changes (ponytail: full rebuild kept, re-tint map is the upgrade path). Verification: run the woodframe page (vite dev with vite.woodframe.config.ts), select a stud, orbit-drag and release over sky — card must stay open and highlight intact; a stationary click on sky must still deselect.

#### 77. TIMBER-1 3D canvas has no text alternative

`src/ui/woodframe-scene.ts:58` · **MEDIUM** · a11y · effort: trivial

**Problem.** woodframe-scene.ts appends renderer.domElement into #viewport with no role, aria-label, or fallback content. The canvas — the page's primary content, carrying the whole frame model — is exposed to assistive tech as an anonymous, unlabeled graphic (or skipped entirely). A screen-reader user on /woodframe.html gets the toolbar chips and side tables but no indication of what the central region is or that clicking it selects members. The main app's viewer explicitly sets role="img" plus a descriptive aria-label (three-viewer.ts:820-821), so this is a regression in the new page, not a project convention.

```
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
viewport.appendChild(renderer.domElement);
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/woodframe-scene.ts, immediately after line 57 (setPixelRatio) and before viewport.appendChild(renderer.domElement) at line 58, add: renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', 'Interactive 3D wood-frame model — drag to rotate, scroll to zoom; click a member for its cut card');. Mirror the wording style of three-viewer.ts:821 and mention the click-to-inspect interaction since the canvas has a click handler (line 163). No other files need changes; the SVG layout strips at line 253 already have role/aria-label. Edge cases to preserve: attributes go on renderer.domElement (the canvas), not the #viewport wrapper, so the label survives fitViewport resizes and camera/controls swaps at line 101 (the same canvas element is reused throughout — nothing recreates it). Optionally extend test/timber-walls.test.ts or add one assertion where the scene module is tested, but the existing tests are engine-level (no DOM), so a runnable check is not practical here — this is a two-line attribute fix matching an established in-repo pattern.

#### 78. TIMBER-1 member selection is pointer-only — canvas raycast and SVG strip marks have no keyboard path

`src/ui/woodframe-scene.ts:259` · **MEDIUM** · a11y · effort: small

**Problem.** The Member Card (size, cut length, angles, nailing, doctrine ref — the page's core data, per the header 'tap one for its card') is reachable only two ways, both pointer-only: a raycast click on the canvas (line 163) and click listeners on <g data-member> marks in the layout-strip SVGs, which get cursor:pointer styling but no tabindex, no role, and no keydown handler. Concrete failure: a keyboard-only user cannot select any member on the page — the Member Card feature is 100% unavailable (WCAG 2.1.1). The strip marks are the natural keyboard surrogate for canvas picking and are plain SVG elements, so the fix is cheap there.

```
return `<g data-member="${mk.memberId}" style="cursor:pointer">
...
el.addEventListener('click', () => { selectedId = (el as SVGGElement).dataset.member ?? null;
```

**Fix.** All edits in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/woodframe-scene.ts renderStrips() (lines 227-267), plus one CSS line in src/ui/woodframe.html.

1. Mark template (line 246): add keyboard/AT attributes and a human label. Map kinds once: const KIND_LABEL = { X: 'stud', K: 'king stud', J: 'jack stud', C: 'cripple' }. Emit: `<g data-member="${mk.memberId}" tabindex="0" role="button" aria-label="${KIND_LABEL[mk.kind]} at ${fmtFtIn(mk.atIn)}, ${label} wall" style="cursor:pointer">`. `label` (e.g. 'South (front)') and `mk.atIn`/`mk.kind` (LayoutMark from src/timber/elevation.ts) are already in scope; fmtFtIn already exists in the file.

2. Containing svg (line 253): remove role="img" (keep or move aria-label, e.g. role="group") — role="img" flattens the subtree for assistive tech and would hide the new buttons from screen readers even with tabindex set. Without this, the fix passes keyboard but fails AT.

3. Listener wiring (lines 259-266): hoist the click body into `const pick = () => { selectedId = ...; renderMemberCard(); rebuild(); window.scrollTo({ top: 0, behavior: 'smooth' }); }`, keep `el.addEventListener('click', pick)`, and add `el.addEventListener('keydown', (e) => { const k = (e as KeyboardEvent).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(); } })`. preventDefault on Space is required to stop page scroll.

4. Focus visibility (woodframe.html style block, ~line 37): add `#strips [data-member]:focus-visible { outline: 2px solid #2b2419; outline-offset: 2px; }` so tabbing shows where you are (WCAG 2.4.7; without it the keyboard path is technically present but unusable).

Edge cases to preserve: (a) strips are rendered once at boot and NOT re-rendered on selection (rebuild() only touches the 3D group), so the focused mark retains focus after Enter — do not move the renderStrips() call into the selection path or focus is lost; (b) keep the smooth scrollTo(top) — focus stays on the mark so it does not fight keyboard users; (c) all `<details>` start open, so marks are tabbable initially, and browsers natively skip content of closed details — no extra handling; (d) the canvas raycast stays pointer-only, and only X/K/J/C wall members get keyboard access — mark that ceiling with a `ponytail:` comment (upgrade path: a focusable member list per stage in the cut-list panel for full-model parity). Optional runnable check per repo convention: extract the mark-template string into a small exported helper and add one assert in test/a11y.test.ts that its output contains tabindex="0" and role="button".

#### 79. TIMBER-1 stage chips announce only a bare number and hide their selected state from AT

`src/ui/woodframe-scene.ts:283` · **MEDIUM** · a11y · effort: small

**Problem.** Stage buttons get textContent = String(s.id) with the stage name only in title. Per HTML-AAM name computation, content ('1', '2', …'11') wins over title, so a screen reader hears '1, button' with no hint it means 'Excavation/footings' etc. The active stage is conveyed solely by the .on class (setStage line 220 classList.toggle) — pure color change, no aria-pressed/aria-current — so AT users can't tell which stage is displayed, and the stage panel that updates in response (textContent swaps, no live region) is silent. Concrete failure: an SR user tabbing the toolbar hears eleven numbered buttons with identical-sounding names and no state.

```
b.dataset.stage = String(s.id);
b.title = s.name;
b.textContent = String(s.id);
/* setStage: b.classList.toggle('on', ...) — no aria-pressed */
```

**Fix.** All in src/ui/woodframe-scene.ts plus one line in src/ui/woodframe.html, plus a test. (1) Chip creation (~lines 281-287): after b.textContent = String(s.id), add b.setAttribute('aria-label', `Stage ${s.id}: ${s.name}`) and b.setAttribute('aria-pressed', 'false'). Keep textContent as the digit (visual design unchanged) — aria-label overrides name-from-content. (2) setStage (~lines 219-221): compute the boolean once per button (const on = Number(...dataset.stage) === s) and set both b.classList.toggle('on', on) and b.setAttribute('aria-pressed', String(on)). Because setStage(11) runs at boot (line 293) after chips are created, initial state is correct with no extra wiring. (3) src/ui/woodframe.html line 55: add aria-live="polite" to <h2 id="stageTitle"> only — do NOT make #stageBom (a full table) or #stageNote live, or every stage click becomes a wall of speech; the title announcement ("Stage 4: Wall framing") is sufficient. (4) View chips (lines 271-277) already have real text names and track no active state at all (not even .on), so no change there — matches the auditor's "if one is added" caveat. (5) Pin it: extend test/a11y.test.ts following its existing string-includes style — read src/ui/woodframe-scene.ts source and assert it contains "aria-pressed" and "aria-label', `Stage" (or read woodframe.html for aria-live). Edge cases to preserve: the dataset.stage Number() comparison in setStage must stay the single source of truth for both class and aria-pressed so they can never diverge; the loop filters STAGES to those present in BOM.stages (line 280), so labels must come from s (the STAGES entry), not by index.

---

## Phase 3 — Polish (low)

#### 80. All dev-server launch configs bind to every network interface via --host

`.claude/launch.json:11` · **LOW** · security · effort: trivial

**Problem.** Every one of the 11 launch configurations passes `--host`, making Vite listen on 0.0.0.0 instead of localhost. Failure scenario: developing on shared Wi-Fi, any device on the LAN can load the dev server and read the full project source through Vite's module graph and /@fs/ endpoints (server.fs.strict permits everything under the project root). The installed vite 6.4.3 is patched against the known /@fs escape CVEs, so exposure is limited to project files — but that is still the entire codebase served unauthenticated on the local network for every dev session, by default.

```
"runtimeArgs": ["run", "dev", "--", "--host", "--port", "5173"]
```

**Fix.** Edit /Users/zacharytraphagen/FieldFortificationsCalculator/.claude/launch.json: delete the "--host" element from the runtimeArgs array of all 11 configurations (it takes no value, so removing the single string is sufficient — do NOT remove the adjacent "--port"/"--strictPort" pairs or the "--" npm separator). Vite then defaults to localhost, which is all the preview_start tooling needs. Edge cases to preserve: (1) keep each config's "port" field matching its --port arg so preview_start still connects; (2) the "mobilecheck" config was plausibly created for phone-on-LAN testing — either leave --host in that one config only, or drop it everywhere and note that "--host" can be re-added ad hoc when LAN testing is actually needed (auditor's suggested approach; confirm with user if in doubt). No code or test changes required.

#### 81. launch config "sap1" pins port 5173 without --strictPort, so tooling can attach to the wrong server

`.claude/launch.json:4` · **LOW** · build · effort: trivial

**Problem.** The "sap1" configuration declares `"port": 5173` but, unlike all ten other configurations, omits `--strictPort`. If 5173 is already occupied (e.g., another concurrent session's dev server — a documented recurring situation for this project), Vite silently auto-increments to 5174 while the preview/launch tooling connects to 5173, so screenshots and interactions run against a different (possibly stale or different-branch) app instance with no error.

```
{ "name": "sap1", ... "runtimeArgs": ["run", "dev", "--", "--host", "--port", "5173"], "port": 5173 }
// every other config additionally passes "--strictPort"
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/.claude/launch.json, add "--strictPort" as the last element of the sap1 config's runtimeArgs array (after "5173", i.e., insert a line between current lines 13 and 14), exactly matching the pattern of the other ten configurations. Keep the "--" separator (needed so npm forwards the flags to vite), keep "port": 5173 unchanged, and preserve valid JSON (comma after "5173"). Resulting behavior: if 5173 is occupied, Vite exits with a "Port 5173 is already in use" error instead of silently serving on 5174 — the desired fail-fast. No code/tests affected; verify with `node -e "JSON.parse(require('fs').readFileSync('.claude/launch.json','utf8'))"` or by starting the sap1 preview once.

#### 82. .gitignore misses __pycache__/ and compiled bytecode already exists in the tree

`.gitignore:8` · **LOW** · build · effort: trivial

**Problem.** scripts/blender/__pycache__/assets.cpython-311.pyc exists on disk (byproduct of the Blender asset pipeline) and no .gitignore rule covers it. Failure scenario: the in-flight WIP (src/timber/, scripts/blender/, etc.) gets committed with a blanket `git add .` and the binary .pyc lands in history — machine-specific compiled bytecode that will drift stale against assets.py and bloat the repo.

```
$ find scripts -name '*.pyc'
scripts/blender/__pycache__/assets.cpython-311.pyc
# .gitignore has no __pycache__ / *.pyc entry
```

**Fix.** Append two lines to /Users/zacharytraphagen/FieldFortificationsCalculator/.gitignore: `__pycache__/` and `*.pyc`. Keep the existing 8 entries untouched (file is already listed as modified in the working tree, so append rather than rewrite). Verify with `git check-ignore scripts/blender/__pycache__/assets.cpython-311.pyc` exiting 0. Edge cases: `__pycache__/` (unanchored, trailing slash) covers pycache dirs at any depth, which matters because Python scripts live in both scripts/ and scripts/blender/; `*.pyc` additionally catches stray bytecode compiled outside a __pycache__ dir (e.g. python2-style or PYTHONPYCACHEPREFIX edge cases). No git rm/history cleanup needed since nothing is tracked yet.

#### 83. scripts/blender/__pycache__/ is untracked and not gitignored

`.gitignore:1` · **LOW** · build · effort: trivial

**Problem.** scripts/blender/__pycache__/ exists on disk (byproduct of Blender importing blenderlib/assets) and .gitignore has no __pycache__/ or *.pyc entry (verified via git check-ignore, which matches nothing for it). Any blanket `git add .` or `git add scripts/` — likely while committing the in-flight timber/props work sitting untracked right now — commits compiled Python bytecode into the repo.

```
node_modules/
dist/
*.log
.DS_Store
.vite/
coverage/
dist-woodframe/
dist-standalone/
```

**Fix.** Append two lines to /Users/zacharytraphagen/FieldFortificationsCalculator/.gitignore: `__pycache__/` and `*.pyc`. Use the directory form __pycache__/ (not a scripts/blender-scoped path) so future Python dirs are covered too. No un-tracking needed since the .pyc was never committed. Note .gitignore is already modified in the working tree (`M .gitignore` in git status) — append, don't overwrite, to preserve the uncommitted edits.

#### 84. dist-woodframe/ publishable artifact bypasses the check:offline gate entirely

`package.json:20` · **LOW** · build · effort: small

**Problem.** scripts/check-offline.ts hardcodes DIST = '../dist' and `build:woodframe` is not part of `build` or `verify`, so the separately publishable dist-woodframe/ artifact is never scanned for external URLs. The repo's offline guarantee (README §2.3, enforced by the gate for every dist/ page) is unenforced for this artifact. Failure scenario: a future dependency or asset introduces an external URL into the woodframe bundle — `npm run build:woodframe` succeeds and the URL ships in the published page, silently violating the zero-external-requests requirement. Verified today's dist-woodframe/ is clean (jcgt.org citation is stripped, no https:// hits), so this is a gate gap, not live breakage.

```
"build:woodframe": "vite build -c vite.woodframe.config.ts"
// scripts/check-offline.ts:13
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
```

**Fix.** Two-file change. (1) scripts/check-offline.ts: read an optional directory argument — `const dir = process.argv[2] ?? 'dist';` — and resolve `const DIST = fileURLToPath(new URL('../' + dir, import.meta.url));`. Replace the three hardcoded 'dist' strings in output with `dir`: the existsSync pass message (line 64), the offender path label `file.replace(DIST, dir)` (line 74), and the FAIL header (line 83), so failures point at the right artifact. Preserve: default no-arg behavior identical (scans dist/), the pass-when-directory-missing path, the W3C ALLOW list, and the TEXT_EXT filter (dist-woodframe/assets/*.js is covered by it). (2) package.json: change build:woodframe to `vite build -c vite.woodframe.config.ts && node --import tsx scripts/check-offline.ts dist-woodframe`. Optionally also append `&& node --import tsx scripts/check-offline.ts dist-woodframe` to the `check:offline` script so `verify` and `build` cover a previously built dist-woodframe/ too — safe because the script passes when the directory is absent. Sanity check after: run `npm run build:woodframe` and confirm 'check-offline: PASS' names dist-woodframe, then plant a fake `https://example.com` string in dist-woodframe/woodframe.html and confirm `node --import tsx scripts/check-offline.ts dist-woodframe` exits 1 (then rebuild to clean up).

#### 85. npm test glob requires Node >=21 but engines allows Node 20

`package.json:15` · **LOW** · build · effort: trivial

**Problem.** The test script passes a quoted glob (`"test/**/*.test.ts"`) to `node --test`. Glob-pattern support for test-runner positional arguments was added in Node 21.0.0 and was not backported to 20.x; on Node 20 the string is treated as a literal path that does not exist and the runner errors, breaking both `npm test` and `npm run verify`. Yet `engines` declares `"node": ">=20"`, so Node 20 LTS (still in maintenance until April 2026) is an advertised-supported runtime on which the verify gate cannot run. (Local machine is v24 so this only bites contributors/CI on 20.)

```
"test": "node --import tsx --test \"test/**/*.test.ts\"",
...
"engines": { "node": ">=20" }
```

**Fix.** Two one-line edits, aligning the declared floor with what the scripts actually need (Node >=21 for the test glob; 22 is the minimum still-supported LTS since 20 went EOL in April 2026):

1. /Users/zacharytraphagen/FieldFortificationsCalculator/package.json line 9: change `"node": ">=20"` to `"node": ">=22"`.
2. /Users/zacharytraphagen/FieldFortificationsCalculator/.replit line 12: change `modules = ["nodejs-20"]` to `modules = ["nodejs-22"]` so the Replit workspace (the one real Node-20 environment in use) can actually run `npm test` / `npm run verify`.

Edge cases to preserve:
- Replit deployment build (`npm ci && npm run build`) must keep working under nodejs-22 — vite 6, tsx `--import`, and the standalone build script are all fine on 22 (devDeps already pin @types/node ^22).
- After pushing, the Replit workspace needs a pull + module reload; per the user's standing memory, print the Replit pull/build snippet and Republish reminder with the commit.
- Do NOT switch the script to an unquoted shell glob (`test/*.test.ts`) to keep Node 20 alive: it would silently miss any future nested test files and break on Windows cmd; Node 20 is EOL so raising the floor is the correct direction.
- npm engines is only a warning by default (no engine-strict in the repo), so the bump breaks nobody's install; it just makes the advertised support honest.

#### 86. blenderlib.py hardcodes a stale session-specific scratchpad path from a different project as its output directory

`scripts/blender/blenderlib.py:20` · **LOW** · build · effort: trivial

**Problem.** OUT_DIR is a hardcoded /private/tmp path containing another project's slug (CommandHub-Led) and a one-time session UUID. /private/tmp/claude-501 is machine-specific and periodically wiped (macOS clears /private/tmp on reboot/cleanup). export_glb() (line 186) and contact_sheet() (line 169) both write there unconditionally and never create the directory: after a reboot, on any other machine, or for any other contributor, export_glb raises inside Blender's glTF exporter (directory does not exist), and even when it works the exported .glb assets land in an unrelated project's temp folder instead of anywhere near this repo — the checked-in pipeline script is unusable as committed.

```
OUT_DIR = '/private/tmp/claude-501/-Users-zacharytraphagen-CommandHub-Led/58e0b71b-607d-4fc3-bad9-f591636675f7/scratchpad/blender'
```

**Fix.** Single file: /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/blender/blenderlib.py. (1) Move `import os` to the module top (delete the local import inside reset_scene at line 24). (2) Replace line 20 with an env-override + repo-local default that survives being exec'd via the live Blender bridge, where __file__ is undefined: `try: _here = os.path.dirname(os.path.abspath(__file__))` / `except NameError: _here = os.getcwd()` then `OUT_DIR = os.environ.get('PROP_OUT', os.path.join(_here, 'out'))`. (3) Add `os.makedirs(OUT_DIR, exist_ok=True)` at the top of both contact_sheet() and export_glb() — at call time, not import time, because OUT_DIR is a module global that authoring sessions may reassign after import, and importing the lib for its geometry helpers should not create directories. (4) Add `scripts/blender/out/` to .gitignore so default-location exports/renders never get committed (.gitignore is already modified in the working tree — append there). Edge cases to preserve: BMCP_LIVE exec path (no __file__), OUT_DIR reassignment by callers, deterministic export flags in export_glb, and the existing filename patterns (<name>_front|side|top|iso.png, <name>.glb).

#### 87. Standalone sap1.html still issues an external favicon request, breaking its zero-request contract

`scripts/build-standalone.ts:44` · **LOW** · build · effort: trivial

**Problem.** Toolchain run results first: npm run typecheck exits 0; npm test passes 179/179; npm run build (multi-page vite + standalone vite + inline step + check:offline) exits 0 with 'check-offline: PASS — scanned 12 file(s), zero external URLs'; npm run build:woodframe exits 0. During step-4 artifact verification, one contract violation surfaced: build-standalone.ts promises dist/sap1.html 'runs from file:// with ZERO external requests' (its header comment) and strips modulepreload and manifest links, but leaves <link rel="icon" href="./icons/icon.svg"> in the output. dist/sap1.html (built just now) contains that href. Failure scenario: the single-file air-gap artifact is copied alone to a USB stick / air-gapped machine (its stated purpose); the browser requests ./icons/icon.svg next to the file, which does not exist — a failed external request and a missing tab icon. Cosmetic only; app functionality is unaffected. check-offline does not catch it because it only flags http(s) URLs, not relative refs.

```
// Drop now-redundant preload/manifest/SW hints — the standalone needs no external fetch.
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');
html = html.replace(/<link\b[^>]*\brel="manifest"[^>]*>/g, '');
// (no rule for rel="icon"; grep dist/sap1.html → <link rel="icon" href="./icons/icon.svg" type="image/svg+xml" />)
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/build-standalone.ts, immediately after the manifest replace (line 45), add one replace that inlines the favicon as a data: URI, falling back to dropping the tag: html = html.replace(/<link\b[^>]*\brel="icon"[^>]*>/g, (m) => { const href = m.match(/\bhref="([^"]+)"/)?.[1]; if (!href) return ''; const p = resolve(href); if (!existsSync(p)) return ''; return '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(readFileSync(p, 'utf8')) + '" type="image/svg+xml" />'; }). Edge cases to preserve: (1) use the existing resolve() helper so the icon is read from SRC (dist-standalone/ when present, dist/ as fallback — both contain icons/icon.svg today); (2) encodeURIComponent the SVG text so quotes/# inside the SVG don't break the attribute or the data URI; (3) if the file is missing, drop the tag rather than leave a dangling relative ref — either outcome satisfies the zero-request contract; (4) the callback form handles the (currently single) icon link generically. Verify with: npm run build, then grep dist/sap1.html for 'icons/icon.svg' (expect no match) and 'data:image/svg+xml' (expect one match); check:offline must still pass. Optional hardening (skippable per severity): extend check-offline.ts to flag relative src/href refs specifically inside dist/sap1.html.

#### 88. Offline build gate never scans dist-woodframe/ — build:woodframe artifact bypasses the zero-external-URL guarantee

`scripts/check-offline.ts:13` · **LOW** · build · effort: trivial

**Problem.** check-offline.ts hardcodes DIST to ../dist and package.json wires check:offline only into the main `build` chain, while `build:woodframe` (vite build -c vite.woodframe.config.ts -> dist-woodframe/) has no gate at all. dist-woodframe/ is its own publishable artifact for the TIMBER-1 page; if a future dependency, font, or asset reference introduces a CDN/external URL into that bundle, the gate that exists specifically to enforce the offline invariant (§16/§2.3 per the file's own header) never sees it and the artifact ships making network requests. dist/woodframe.html from the multi-page build IS scanned, so the two woodframe artifacts are held to different standards.

```
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// package.json: "build:woodframe": "vite build -c vite.woodframe.config.ts"
```

**Fix.** Two files. (1) /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/check-offline.ts: accept an optional scan-root name as argv, defaulting to 'dist' so existing `check:offline`, `verify`, and `build` invocations are byte-for-byte unchanged. Replace line 13 with: `const DIST_NAME = process.argv[2] ?? 'dist'; const DIST = fileURLToPath(new URL('../' + DIST_NAME, import.meta.url));`. Preserve edge cases: keep the existsSync early-pass (missing dir = pass with message, echoing DIST_NAME instead of literal 'dist/'); update the offender-path rewrite on line 74 from `file.replace(DIST, 'dist')` to `file.replace(DIST, DIST_NAME)` so failures print dist-woodframe/... paths; keep the W3C ALLOW list and TEXT_EXT filtering untouched. (2) /Users/zacharytraphagen/FieldFortificationsCalculator/package.json: change build:woodframe to `vite build -c vite.woodframe.config.ts && node --import tsx scripts/check-offline.ts dist-woodframe`. Verify with `npm run build:woodframe` (expect PASS scanning dist-woodframe) and `npm run build` (expect unchanged PASS on dist/). Note: dist-standalone/ is an intermediate of the gated `build` chain whose final inlined artifact lands in dist/ and is already scanned, so it needs no separate gate.

#### 89. Offline gate allowlists the entire w3.org host, not just namespace identifiers — fetchable w3.org URLs pass silently

`scripts/check-offline.ts:16` · **LOW** · build · effort: small

**Problem.** The header comment says only XML/SVG namespace IDENTIFIERS (never dereferenced) are allowlisted, but ALLOW contains the bare prefixes 'http://www.w3.org/' and 'https://www.w3.org/', and stripAllowed() deletes those substrings anywhere in a line before the URL regexes run. Any genuinely fetchable w3.org resource — e.g. <link rel="stylesheet" href="https://www.w3.org/StyleSheets/TR/base.css"> or a DTD fetched by a strict XML parser — is stripped down to a non-URL remnant and passes the gate, so a real external network request can ship while the build reports 'zero external URLs'. The gate's whole purpose is to catch exactly this class of accidental reference.

```
const ALLOW = [
  'http://www.w3.org/',
  'https://www.w3.org/',
  'http://www.w3.org/2000/svg',
  ...
];
```

**Fix.** Single file: scripts/check-offline.ts. (1) Replace ALLOW with a Set of exact namespace URIs actually needed: 'http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xlink', 'http://www.w3.org/XML/1998/namespace', and — critically — 'http://www.w3.org/1999/xhtml', which appears twice in the current dist/assets JS and would fail the gate if omitted. Drop both bare host prefixes. (2) Delete stripAllowed() and switch from strip-then-scan to scan-then-filter: run the three regexes on the raw line and filter absolute-URL hits with `!ALLOW.has(m[0])`. Exact-match filtering (rather than exact-string stripping) also closes the residual bypass where a longer URL sharing an allowed prefix (e.g. http://www.w3.org/2000/svg/evil.js) would strip to a non-URL remnant; with scan-then-filter it matches as a full URL, is not exactly in the Set, and fails the gate. The regex terminates at quotes/whitespace, so xmlns="..." attributes and createElementNS('...') calls match the bare namespace URI exactly — verified against the 8 w3.org occurrences in the current dist. (3) Update the header comment to say exact identifiers are compared, not prefixes. Verify by running `npm run check:offline` against the existing dist (must PASS) and a one-off check that a w3.org stylesheet URL now FAILs. Optional follow-up outside this finding's scope: tighten the `(?!www\.w3\.org)` host-wide lookahead in test/offline.test.ts the same way.

#### 90. check-offline reports PASS when dist/ does not exist, so `npm run verify` can green-light without verifying anything

`scripts/check-offline.ts:63` · **LOW** · build · effort: trivial

**Problem.** main() returns success with a 'pass' message when dist/ is absent. `npm run verify` (package.json line 16: "typecheck && test && check:offline") never builds, so on a clean checkout or after `rm -rf dist` the verify pipeline prints 'check-offline: PASS'-equivalent output and exits 0 having scanned zero files — a CI job wired to `npm run verify` would report the offline invariant as verified when it was never checked.

```
if (!existsSync(DIST)) {
  console.log('check-offline: dist/ not present yet — nothing to scan (pass).');
  return;
}
```

**Fix.** Single edit in /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/check-offline.ts: in main(), replace the soft-pass branch (lines 63-66) with a hard fail — `console.error('check-offline: FAIL — dist/ not found; run `npm run build` first.'); process.exit(1);`. Edge cases to preserve: (1) `npm run build` is unaffected because vite build creates dist/ immediately before check:offline runs in that chain; (2) keep the existing PASS/FAIL output format so any log grepping stays valid; (3) the error message must name the remedy (`npm run build`) since verify on a clean checkout will now fail until a build exists — that is the intended behavior change. Optionally update README line 53 to note that `npm run verify` requires a prior `npm run build` for the offline gate, or alternatively (if the maintainer prefers verify to be self-contained) change package.json verify to `npm run typecheck && npm run test && npm run build`, since build already ends with check:offline — but the one-line hard fail is the minimal correct fix. No test needed beyond running `npm run check:offline` once without dist/ (expect exit 1) and once after `npm run build` (expect PASS).

#### 91. check:offline gate never scans dist-woodframe/ — the separately publishable TIMBER-1 artifact bypasses the zero-external-URL guarantee

`scripts/check-offline.ts:13` · **LOW** · build · effort: small

**Problem.** check-offline.ts walks only ../dist. `npm run build:woodframe` (package.json:20) emits dist-woodframe/ with no gate after it and is not part of `npm run build` or `npm run verify`. Today the same sources happen to be scanned via the multi-page dist/, but the configs already diverge (publicDir:false, hashed filenames, own chunking); any woodframe-only regression that introduces an external URL (a font, CDN import, non-jcgt citation URL in a future vendor chunk) ships silently in the artifact the woodframe.html comment calls 'publishable on its own'.

```
const DIST = fileURLToPath(new URL('../dist', import.meta.url));  // check-offline.ts:13
"build:woodframe": "vite build -c vite.woodframe.config.ts"       // package.json:20 (no gate)
```

**Fix.** Two files. (1) /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/check-offline.ts — accept an optional target dir name: `const TARGET = process.argv[2] ?? 'dist';` then `const DIST = fileURLToPath(new URL('../' + TARGET, import.meta.url));` (resolving relative to the script keeps it cwd-independent, same as today). Thread TARGET into the three messages that currently hardcode 'dist': the line-64 soft-pass ("${TARGET}/ not present yet"), the line-74 display-path `file.replace(DIST, TARGET)`, and the line-83 FAIL header. (2) /Users/zacharytraphagen/FieldFortificationsCalculator/package.json:20 — chain the gate: `"build:woodframe": "vite build -c vite.woodframe.config.ts && node --import tsx scripts/check-offline.ts dist-woodframe"`. Edge cases to preserve: default (no arg) must stay 'dist' so `verify` and `build` behave identically, including the existsSync soft-pass when dist/ is absent (verify relies on it before any build); keep the W3C ALLOW list and TEXT_EXT filtering untouched; offender display paths must still show the dir prefix (now dist-woodframe/...). Optional sanity check after the edit: `npm run build:woodframe` should print "check-offline: PASS — scanned N file(s)" with N > 0.

#### 92. render-sample.ts defaults its output to the repo root, and its artifacts are not gitignored

`scripts/render-sample.ts:26` · **LOW** · build · effort: trivial

**Problem.** With no argument, outDir is '.' — running `node --import tsx scripts/render-sample.ts` from the repo root drops plan.svg, section.svg, and preview.html directly into the project root. None of those names are covered by .gitignore (verified: only node_modules/, dist*/, *.log, .DS_Store, .vite/, coverage/), so a subsequent blanket `git add .` commits dev-harness artifacts into the tree. If invoked with an outDir that does not exist, writeFileSync also crashes with a bare ENOENT.

```
const outDir = process.argv[2] ?? '.';
...
writeFileSync(outDir + '/plan.svg', drawPlan(mg));
```

**Fix.** Two edits, no behavior change for callers who pass an explicit outDir. (1) scripts/render-sample.ts: change line 26 to default to a dedicated ignored dir, e.g. `const outDir = process.argv[2] ?? '.samples';`, and add `mkdirSync(outDir, { recursive: true });` immediately after (import mkdirSync alongside readFileSync/writeFileSync on line 3). mkdirSync with recursive:true is a no-op if the dir exists, so explicit outDir args like '.' or existing paths keep working, and previously-crashing nonexistent paths now succeed — an improvement, not a regression. (2) .gitignore: append `.samples/`. Optionally also append plan.svg/section.svg/preview.html for belt-and-suspenders, but the ignored default dir alone closes the reported path. No test needed — trivial fs plumbing in a dev-only harness.

#### 93. Malformed percent-encoding in a request URL returns 500 instead of 400 in serve.js

`scripts/serve.js:45` · **LOW** · bug · effort: trivial

**Problem.** decodeURIComponent throws URIError on malformed sequences (e.g. GET /%zz or a truncated /%E0). The throw is only caught by the outer catch, which replies '500 Server error' and logs a full stack trace via console.error — a routine bad-client request is misreported as a server fault and pollutes deployment logs, and health/uptime tooling that treats 5xx as outage will misfire on garbage requests.

```
const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
...
} catch (err) {
  res.writeHead(500).end('Server error');
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/serve.js, hoist the decode into its own try/catch at the top of the request handler (replacing line 45): `let rawPath; try { rawPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400).end('Bad request'); return; }` — no console.error on this path (it is client noise, not a server fault). Keep the outer catch unchanged as the genuine-fault 500 backstop. Edge cases the fix must preserve: (a) split on '?' BEFORE decoding, so an encoded %3F in the path does not get treated as a query separator — the new code keeps that order; (b) the decode must still happen BEFORE normalize/join so the traversal guard at lines 47-53 continues to see decoded `%2e%2e%2f` sequences — do not move the decode after the guard; (c) preserve the `req.url || '/'` fallback. Optionally pin with one tiny test (Node test runner, start server on port 0, assert GET /%zz → 400 and GET / → 200), consistent with the repo's one-runnable-check rule; the repo currently has no serve.js tests.

#### 94. No caching headers on unhashed multi-megabyte assets — full re-download every visit

`scripts/serve.js:62` · **LOW** · perf · effort: small

**Problem.** serve.js sends only Content-Type — no Cache-Control, ETag, or Last-Modified — and the built asset filenames carry no content hash (dist/assets/three-viewer.js is ~1.0 MB, plus index.js 117 KB, woodframe.js 17 KB, confirmed by ls). With no validators the browser has nothing to revalidate against, so on the autoscale deployment every navigation that misses the service worker (first visits, hub.html and woodframe.html which sw.js does not precache, any browser with SW disabled) re-downloads the full ~1 MB+ bundle. On Replit autoscale this is both slow first paint and metered egress on every hit.

```
res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] || 'application/octet-stream' });
res.end(body);
```

**Fix.** Single file: /Users/zacharytraphagen/FieldFortificationsCalculator/scripts/serve.js. Use the validator approach (Last-Modified + If-Modified-Since 304 + Cache-Control: no-cache); do NOT take the finding's 'immutable if hashed' branch — hashless names are a deliberate design constraint (vite.config.ts:45-48, standalone inliner needs stable targets), and long-max-age on unhashed names would serve stale bundles after redeploys. Steps: (1) change fileAt() to return the Stats it already fetches (e.g. `{ path, mtime: s.mtime }`) instead of discarding them — this includes the SPA-fallback call at line 56 so the fallback index.html gets its own mtime; (2) compute `const lastMod = mtime.toUTCString()`; if `Date.parse(req.headers['if-modified-since'])` is a valid number >= mtime floored to whole seconds (HTTP dates have 1s granularity — compare `Math.floor(mtime.getTime()/1000)*1000` or the 304 never fires), respond `res.writeHead(304, { 'Last-Modified': lastMod, 'Cache-Control': 'no-cache' }).end()` and skip readFile; (3) otherwise add `'Last-Modified': lastMod, 'Cache-Control': 'no-cache'` to the existing 200 writeHead at line 62. Edge cases to preserve: zero-dependency invariant (node built-ins only — mtime-based validation needs no etag lib); unparseable/absent If-Modified-Since must fall through to a full 200; 403/404/500 paths unchanged; traversal guard unchanged; the `npm run check:offline` build gate must stay green (fix doesn't touch the build, only response headers); Cache-Control: no-cache is transparent to sw.js's cache-first handler. Per repo convention, leave one runnable check: a small test (or assert-based self-check) that starts the server on an ephemeral port and asserts (a) 200 responses carry Last-Modified + Cache-Control and (b) a request with If-Modified-Since = that Last-Modified returns 304 with an empty body. Redeploy note: Replit autoscale rebuilds dist/ on deploy (npm ci && npm run build), refreshing mtimes — which is exactly the desired cache invalidation.

#### 95. serve.js extensionless fallback serves the SAP-1 app for /hub and /woodframe (wrong page), and / serves SAP-1 instead of the suite hub

`scripts/serve.js:56` · **LOW** · ux · effort: trivial

**Problem.** The SPA fallback maps every extensionless miss to index.html. In the new multi-page suite, a user typing /hub or /woodframe (natural short forms of the pages hub.html links to) silently gets the SAP-1 planner instead of the hub or TIMBER-1 — no 404, no redirect, just the wrong app under that URL. The '/' route also still resolves to index.html (SAP-1), while hub.html's own header comment declares it the suite landing page ('One deploy ships every tool'). This is the production Replit path (package.json start script), so it is user-visible on the deployed origin.

```
if (rel === '' || rel === '.') rel = 'index.html';           // serve.js:48
if (!resolved && !extname(rel)) resolved = await fileAt(join(DIST, 'index.html'));  // serve.js:56
```

**Fix.** In scripts/serve.js, insert one line between the fileAt(target) lookup (line 55) and the index.html fallback (line 56): `if (!resolved && !extname(rel)) resolved = await fileAt(join(DIST, rel + '.html'));` so /hub → dist/hub.html and /woodframe → dist/woodframe.html, keeping the existing index.html fallback as last resort for SAP-1 deep links. Edge cases to preserve: (1) the traversal guard at lines 50-53 already rejected any rel escaping DIST before this point, and appending '.html' to a validated in-DIST path cannot escape, so no new guard needed; (2) Content-Type is derived from extname(resolved) at line 62, so the .html sibling gets text/html automatically; (3) '/' must continue serving index.html — do NOT flip root to hub.html in this fix, because manifest.webmanifest start_url "./", sw.js CORE/offline-fallback, and .replit entrypoint all pin '/' as SAP-1; if the user wants the hub at '/', that is a separate deliberate change touching manifest scope/start_url and sw.js. Optionally add a tiny node:test that starts the server on an ephemeral port against dist/ and asserts GET /hub returns hub.html content (the repo has no serve.js test today).

#### 96. Duplicate paths in a doctrine file are accepted: last entry silently wins and the applied count is inflated

`src/doctrine/io.ts:210` · **LOW** · data · effort: trivial

**Problem.** The validation loop has no duplicate-path check, so a file containing two entries for the same path (e.g. a hand-merged fill from two contributors with conflicting values 6.0 and 2.0 for labor.baseMH) passes validation; the commit loop applies them in order so the last one silently wins. Reproduced: ok=true, applied=2, live value=2 — the report tells the user two values were applied when only one path changed, and the conflict (which of the two sourced values is in effect) is never surfaced, contradicting the importer's 'never trusts a file blindly' strictness. The contentHash also covers both conflicting rows, so the recorded manifest hashes data that does not match the applied state.

```
for (const s of staged) {
  const target = getByPath(s.path)!;
  target.value = s.value;
  target.status = s.status;
  target.source = s.source;
```

**Fix.** File: /Users/zacharytraphagen/FieldFortificationsCalculator/src/doctrine/io.ts. In importDoctrine, declare `const seen = new Set<string>();` next to the `rejected`/`staged` declarations (line ~146-147). Immediately after the `typeof path !== 'string'` check (line ~159), add: `if (seen.has(path)) { rejected.push({ path, reason: 'duplicate path in file' }); continue; } seen.add(path);`. Placing it before getByPath means the second occurrence is flagged as duplicate regardless of whether it would otherwise validate; the existing all-or-nothing gate (line 192) then refuses the whole file, so nothing mutates and the manifest/contentHash inconsistency disappears (rejected files never set appliedFill). Edge cases the fix must preserve: (1) full export→import round-trip must still pass — safe because the registry is a Map keyed by path (src/doctrine/registry.ts line 27) so exportDoctrine never emits duplicates; (2) restoreFill (src/state/doctrineFill.ts) re-imports a stored exportDoctrine snapshot — also duplicate-free, unaffected; (3) applyInlineDoctrineEdits (src/ui/main.ts line 575) builds from a Map by path — unaffected; (4) dryRun previews get the same rejection since the check lives in the validation loop before the dryRun branch. Add one test to /Users/zacharytraphagen/FieldFortificationsCalculator/test/doctrine-io.test.ts (repo requires a runnable check): a file with two entries for the same registry path (e.g. labor.baseMH with values 6 and 2) must yield ok=false, applied=0, a rejected entry whose reason mentions duplicate, and the live value unchanged; restore the pristine state afterward like the other mutating cases (via the file's existing restore() helper).

#### 97. Roof-setback dimension's (PH) flag keys on the generic setbackMin leaf, not the threat-specific standoff that actually fed the value

`src/engine/geometry.ts:99` · **LOW** · bug · effort: trivial

**Problem.** compute.ts derives setback from standoffMinFor(threat) — the per-munition standoffMin leaf — falling back to overhead.setbackMin only for 'none'/unknown threats, and explain.ts:46 correctly attributes the derivation to calc.standoffLeaf. But the drawing dimension's placeholder flag reads overhead.setbackMin.status unconditionally. After a partial doctrine fill that verifies setbackMin and setbackDepthFrac but not the selected munition's standoffMin, the plan/section drawing shows the safety-critical 'Roof setback' dimension WITHOUT the (PH) suffix while the operand that actually produced the number is still an unverified placeholder — under-flagging on exactly the honesty axis the app is built around.

```
key: 'setback',
valueFt: calc.setback,
placeholder: ph(overhead.setbackMin.status) || ph(overhead.setbackDepthFrac.status),
// compute.ts:171-173: standoffMin = standoffMinFor(threat); setback = max(standoffMin, frac*depth)
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/engine/geometry.ts line 99, change the setback dim's flag from `ph(overhead.setbackMin.status) || ph(overhead.setbackDepthFrac.status)` to `ph((calc.standoffLeaf ?? overhead.setbackMin).status) || ph(overhead.setbackDepthFrac.status)`, mirroring explain.ts:46. calc.standoffLeaf (Provenance<number> | undefined) is already on Calc (compute.ts:61, set at :172 from standoffLeafFor(threat)), so no new plumbing. Edge cases to preserve: (1) threat 'none' or unknown → standoffLeaf is undefined → falls back to overhead.setbackMin, identical to current behavior; (2) keep the setbackDepthFrac term — the max() can be won by either operand and the repo convention flags if ANY feeding leaf is placeholder; (3) default all-placeholder doctrine must produce byte-identical Results (it does — both expressions yield true). Add one pinning test (e.g. in test/engine-audit-fixes.test.ts): compute with a known threat (e.g. 'ind-mtr-81'), temporarily flip overhead.setbackMin.status and overhead.setbackDepthFrac.status to 'DOCTRINE' (leaves are intentionally mutable; restore in try/finally), assert geometry dims 'setback'.placeholder is still true while the threat leaf is PLACEHOLDER, and false once threats['ind-mtr-81'].standoffMin.status is also flipped.

#### 98. Keyboard shortcuts exist but are documented nowhere in the UI

`src/layout/help.ts:8` · **LOW** · ux · effort: trivial

**Problem.** main.ts:540-548 implements Ctrl/Cmd+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo) and Escape (close overlay/menu/sheet), but helpHtml() covers only the input fields, and the toolbar button titles ('Undo the last change', shell.ts:148) omit the shortcut. Failure scenario: a desktop user who would use Ctrl+Z never discovers it exists (and conversely cannot learn why Ctrl+Z is 'not working' in text fields — the already-reported hijack) because no help entry, tooltip, or hint anywhere names a single shortcut; flexibility/efficiency features are invisible.

```
export function helpHtml(): string {
  return ('<div class="help"><h2>How to use SAP-1</h2>' + ... // items cover inputs only; no mention of Ctrl+Z / Ctrl+Y / Escape
```

**Fix.** Two files, string-only edits. (1) src/layout/help.ts — append one entry to the existing <dl> using the local item() helper, e.g. item('Keyboard shortcuts', 'Ctrl+Z (Cmd+Z on Mac) undoes an input change; Ctrl+Y or Ctrl+Shift+Z redoes it; Esc closes an open overlay, menu, or edit sheet.'). Keep it inside the </dl> so styling is inherited. (2) src/layout/shell.ts lines 148-149 — change titles to 'Undo the last change (Ctrl+Z)' and 'Redo the last undone change (Ctrl+Y)'. Edge cases to preserve: toolbarBtn interpolates the title raw into both title="…" and aria-label="…" attributes, so use only plain text with no double quotes (parentheses and + are safe); the aria-label picking up the shortcut text is desirable, not a regression. Do not claim Escape works in the tooltip of unrelated buttons — Escape's targets (overlay/menu/sheet) belong in the help entry only. Mention Cmd for Mac in the help text (the handler checks metaKey) but keep toolbar titles short with just Ctrl. USER_GUIDE.md already documents the shortcuts (lines 43, 231) and needs no change — keep the new help wording consistent with it. Note the pre-existing, separately-reported issue that Ctrl+Z is hijacked inside text fields; this fix must not attempt to solve that, only document the global shortcuts.

#### 99. Stage scrubber references a datalist that is never rendered

`src/layout/shell.ts:163` · **LOW** · ui · effort: trivial

**Problem.** The build-stage range input carries list="stage-ticks", but no <datalist id="stage-ticks"> exists anywhere in the codebase (grep confirms the only occurrence is this attribute). The promised tick marks for the 7 build stages never render, and the IDREF dangles. Scenario: users scrubbing the 3D build stage get no visual notches marking the discrete stages the attribute was added to provide.

```
'<input type="range" id="three-stage" min="0" max="6" step="1" value="6" aria-label="Construction stage" list="stage-ticks">'
```

**Fix.** In src/layout/shell.ts, inside the stageScrubber string (lines 161-165), append the datalist immediately after the input and before the Cutaway button: '<datalist id="stage-ticks"><option value="0"></option><option value="1"></option><option value="2"></option><option value="3"></option><option value="4"></option><option value="5"></option><option value="6"></option></datalist>'. Edge cases to preserve: (1) keep it inside the webglOk ternary branch so the datalist only exists when the input does; (2) options 0..6 must match the input's min/max — if stage count ever changes, both must move together (a short comment noting this is enough); (3) datalist is display:none by default so no CSS/layout changes needed. Alternative equally valid one-liner: delete list="stage-ticks" from line 163 (drops the tick-mark promise entirely). Tick rendering is browser-dependent (Chrome/Edge/Safari render ticks; Firefox support is partial), which is acceptable for a cosmetic affordance.

#### 100. Compare-table remove button's only name is '✕'

`src/layout/tools.ts:93` · **LOW** · a11y · effort: trivial

**Problem.** The per-column remove control in the compare overlay is a button whose accessible name is the character '✕' — announced as 'multiplication x' or nothing depending on the SR. With 2-3 identical buttons in the header row, a screen-reader user cannot tell what the button does or which setup it removes.

```
'<th>#' + (i + 1) + ' <button type="button" class="btn tiny" data-action="compare-remove" data-idx="' + i + '">✕</button></th>'
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/layout/tools.ts line 93, add an aria-label to the button in the head template: '<button type="button" class="btn tiny" data-action="compare-remove" data-idx="' + i + '" aria-label="Remove setup ' + (i + 1) + '">✕</button>'. aria-label overrides the '✕' text in accessible-name computation, so wrapping the glyph in an aria-hidden span (the auditor's second suggestion) is unnecessary — skip it. Edge cases to preserve: keep data-action="compare-remove" and data-idx="' + i + '" unchanged (the delegated click handler at src/ui/main.ts:497 reads dataset.idx, 0-based), and use i + 1 in the label so it matches the visible 1-based '#1'/'#2'/'#3' column headers.

#### 101. Time planner labels no-op cover options as 'cover' when threat is none, listing duplicate identical rows

`src/layout/tools.ts:239` · **LOW** · ux · effort: small

**Problem.** With threat 'none', compute treats overheadCover as a no-op (coverOn=false, roofPath 'none', no cover volume or labor — validate even emits COVER_NO_THREAT). planForTime still enumerates overheadCover true and false, producing pairs of options with identical man-hours and identical protection scores (plan.ts:67 correctly zeroes the cover bonus). The overlay's roof column then renders 'cover' for the overheadCover=true twin because it keys on o.overheadCover instead of o.roofPath — so the user picks a row claiming overhead cover and gets a position with none, at the same price as the '—' row right next to it.

```
'<td>' + (o.overheadCover ? (o.roofPath === 'engineered_required' ? 'engineered' : 'cover') : '—') + '</td>'
// plan.ts enumerates overheadCover ∈ {true,false} even when compute makes it a no-op (roofPath 'none')
```

**Fix.** Two one-line edits plus a pinned test. (1) src/layout/tools.ts:239 — render the roof cell from roofPath, not overheadCover: `o.roofPath === 'earth_on_stringers' ? 'cover' : o.roofPath === 'engineered_required' ? 'engineered' : '—'`. Safe for all paths: with a real threat, coverOn && earth_on_stringers still shows 'cover', engineered_required (threat- or span-driven) still shows 'engineered', and cover-off always has roofPath 'none' → '—'. (2) src/engine/plan.ts:55 — kill the duplicates at the source: `const coverChoices = req.base.threat === 'none' ? [false] : [true, false];` and iterate that instead of the literal `[true, false]`. threat is constant across the loop and overheadCover is a guaranteed no-op when threat==='none' (compute.ts:180), so enumerating only false is exact — and it means "Use" never applies a no-op overheadCover=true that would trip the COVER_NO_THREAT advisory. Edge cases to preserve: tieKey/rank determinism (unchanged — fewer options, same ordering rules); the span-driven engineered_required path with real threats must keep both cover choices (it does — the guard only fires for threat 'none'). (3) Add one assertion to test/plan-mission.test.ts: planForTime with threat 'none' yields no option with overheadCover=true and no two feasible options sharing (standard, revetment, manHoursTotal).

#### 102. Scale-bar unit label uses a fixed run of spaces, so the '5'' / '1 m' text does not sit under the end tick at most scales

`src/render/chrome.ts:120` · **LOW** · ui · effort: trivial

**Problem.** scaleBar prints one text element '0            5''' (12 hard spaces) starting at the left tick, while the bar length is proj.lenPx(5ft) and varies with drawing scale. The label only aligns with the right tick when the bar happens to be ~90px. In the default one-man plan the bar is 116.7px (x 20->136.7) but the '5'' glyphs land at ~x 98-110 — 30px short of the tick they label; at smaller scales (lenPx floor is 8px) the '5'' lands well past the right tick. Since the drawings ARE uniformly scaled (one projector), the ruler is the one element meant to be measured against, and its unit label floats detached from the tick.

```
const lenPx = Math.max(8, proj.lenPx(spanFt));
const label = unit === 'metric' ? '0            1 m' : "0            5'";
textEl(xPx, yPx + 15, label, ...)  // single left-anchored string, tick at xPx + lenPx
```

**Fix.** Single-function change in src/render/chrome.ts scaleBar (lines 117-127). Delete the `label` const with the hard-space runs and emit two text elements: (1) '0' left-anchored (current default 'start') at textEl(xPx, yPx + 15, '0', {fill: 'var(--ink-soft)', 'font-size': 10, 'font-family': 'ui-monospace, monospace'}); (2) the unit label (unit === 'metric' ? '1 m' : "5'") at textEl(xPx + lenPx, yPx + 15, ..., same attrs plus 'text-anchor': 'end'). Prefer 'end' over 'middle' for the unit label: it guarantees the text never overflows past the right tick toward the drawing edge, and it minimizes collision with the '0' at the degenerate lenPx floor of 8px (with 'middle', a ~12px-wide "1 m" centered 8px from the '0' would overlap it). Edge cases to preserve: the Math.max(8, ...) floor must stay (guards degenerate/huge bounds); both call sites (drawPlan.ts:181, drawSection.ts:141) pick the fix up automatically; render-intuitive.test.ts:94 (`class="scale"`) still passes unchanged. Per the repo's test norms, optionally extend render-intuitive.test.ts with one assertion that the section/plan SVG contains a text element whose x equals the right-tick x (parse the emitted scale group), pinning label-tracks-tick.

#### 103. CSV labor rows emit 6 fields under a 5-column header (trailing empty column)

`src/render/csv.ts:48` · **LOW** · data · effort: trivial

**Problem.** The section header declares 5 columns (Section, Item, Unit, Per position, Total) but both Labor rows pass a 6th empty-string cell, producing a trailing comma / phantom 6th column. Verified in generated output: 'Labor,Man-hours per position,mh,3.9,3.9,' vs header 'Section,Item,Unit,Per position,Total'. Spreadsheets show a stray empty column; strict column-count CSV parsers flag or reject the rows.

```
lines.push(row('Labor', 'Man-hours per position', 'mh', lab.manHoursPerPosition, lab.manHoursTotal, ''));
lines.push(row('Labor', 'Elapsed (team of ' + result.inputs.teamSize + ')', 'hr', '', lab.elapsedHours, ''));
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/render/csv.ts, delete the final '' argument from both row() calls on lines 48 and 49. Edge case to preserve: line 49's fourth argument '' is the intentionally blank 'Per position' cell for the Elapsed row and must stay — only the sixth (last) '' is removed on each line. Optionally extend the existing CSV test in test/units-format.test.ts with one assertion that every non-blank line after the section header splits into at most 5 comma-separated fields (simple split is safe here since no current field contains commas except the quoted case, or just assert the two Labor lines don't end with ','). Existing tests (dot decimals, CRLF) are unaffected.

#### 104. Exported CSV is UTF-8 without a BOM while its labels contain non-ASCII — mojibake in Excel

`src/render/csv.ts:52` · **LOW** · data · effort: trivial

**Problem.** toCsv() emits UTF-8 text containing non-ASCII characters (unit 'ft³' from materials.ts:42, em-dashes in item labels like 'Sandbags — parapet') and download() wraps it in a Blob with no UTF-8 BOM prefix (src/ui/main.ts:675). Excel on Windows (and legacy macOS Excel) opens double-clicked .csv files using the ANSI code page unless a BOM is present, so the materials list — the file's primary consumer — renders 'ft³' as 'ftÂ³' and '—' as 'â€"' in the Unit/Item columns. The charset=utf-8 MIME parameter on the Blob does not survive to the saved file; only a BOM does.

```
csv.ts:52  return lines.join('\r\n') + '\r\n';
materials.ts:42  'ft³',
materials.ts:57  'Sandbags — parapet',
main.ts:675  const blob = new Blob([text], { type: mime });
```

**Fix.** One-line change at the call site, src/ui/main.ts:685: prepend the BOM to the CSV text only — download('sap1-bom.csv', '﻿' + toCsv(lastResult, meta()), 'text/csv;charset=utf-8') — with a short comment (// BOM so Excel double-click decodes UTF-8). Do NOT add the BOM inside download() generically: the same helper serves JSON exports at main.ts:437/450/693 (a BOM breaks strict JSON.parse consumers), SVG at :700-701, and HTML at :719. Do NOT change toCsv() itself, keeping the pure renderer's RFC-4180 output canonical and leaving test/units-format.test.ts:37-44 untouched (those assertions would still pass either way, but the call-site fix avoids touching the tested pure layer). Edge cases to preserve: no BOM on any non-CSV export; existing CRLF endings and dot-decimal formatting unchanged. Optional: if any future second CSV export appears (mission aggregate), apply the same prefix there.

#### 105. .50 cal machine-gun position never gets the FPL (grazing-fire line) because of a startsWith('mg') key match

`src/render/drawPlan.ts:80` · **LOW** · data · effort: small

**Problem.** The FPL is gated on result.inputs.positionType.startsWith('mg'). The registry key for the .50 cal machine-gun position is 'fifty_cal' (doctrine/positions.ts:89, label '.50 cal position (L-shape)'), so selecting it produces a range card with sectors but no grazing-fire line, while 'mg_crew' gets one — contradicting the code's own intent comment ('Machine-gun positions get a final protective line'). The 'crewSize &&' half of the guard is dead: every position in the registry defines crewSize > 0, so the string prefix is the only real condition.

```
if (positions[result.inputs.positionType]?.crewSize && result.inputs.positionType.startsWith('mg')) {
  ... 'grazing-fire line (FPL)' ...
// positions.ts:89  fifty_cal: { label: '.50 cal position (L-shape)', ... crewSize: 3 }
```

**Fix.** 1) src/doctrine/positions.ts: add optional `laysFPL?: boolean` to the PositionRow interface (after sectorsOfFire, ~line 37) and set `laysFPL: true` on the mg_crew (line 73) and fifty_cal (line 89) rows only — optional flag keeps the other 9 rows untouched. 2) src/render/drawPlan.ts:80: replace the guard with `if (positions[result.inputs.positionType]?.laysFPL) {` — this deletes the dead crewSize check and the string-prefix match while preserving the unknown-key safety (optional chaining yields undefined → no FPL for imported scenarios with unregistered positionType). The block already sits inside `if (p.sectors.present)` so non-sector positions structurally cannot get an FPL even if misflagged. 3) test/range-card.test.ts: extend the existing FPL test (line 28) to also assert `drawPlan(compute(defaultInputs({ positionType: 'fifty_cal' })))` matches /grazing-fire line/ and /FPL/, pinning the fixed behavior. Edge cases to preserve: mg_crew keeps its FPL (existing test), unknown positionType keys must not throw, mortar_pit/vehicle positions stay FPL-free.

#### 106. MemoryAdapter fallback makes scenario save claim 'Saved on this device' while nothing persists

`src/state/persistence.ts:34` · **LOW** · data · effort: small

**Problem.** createStorageAdapter() silently returns the in-memory MemoryAdapter when typeof indexedDB === 'undefined' (older WebViews, hardened/lockdown browser profiles, some file:// contexts — the audience for the air-gapped dist/sap1.html standalone build). MemoryAdapter.set always resolves, so the scenario-save flow in src/ui/main.ts:398-404 takes the success path and toasts 'Saved "<name>" on this device.' The scenario exists only in the page's Map and is gone on reload — silent data loss behind an explicit success message. The same false-success applies to duplicate, import ('N scenario(s) imported.') and the doctrine fill saveFill. Note the sibling failure mode IS handled (an idb.open rejection reaches .catch and warns 'Save FAILED — device storage unavailable'), so the missing-indexedDB path is an inconsistency, not a design choice.

```
const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
if (!idb) return new MemoryAdapter();
// main.ts:402: showToast('Saved "' + finalName + '" on this device.');
```

**Fix.** 1) src/state/persistence.ts: change createStorageAdapter() to return { adapter: StorageAdapter; persistent: boolean } — `{ adapter: new MemoryAdapter(), persistent: false }` on the !idb branch, `{ adapter: {…idb impl…}, persistent: true }` otherwise. Leave MemoryAdapter and StorageAdapter exports untouched (tests in test/trust.test.ts, test/doctrine-io.test.ts, test/schema-import.test.ts import MemoryAdapter directly and must keep working). 2) src/ui/main.ts:55: destructure `const { adapter: persistAdapter, persistent: storagePersistent } = createStorageAdapter();` — line 56 (ScenarioStore) and line 755 (restoreFill) keep using persistAdapter unchanged. 3) Gate the success toasts on storagePersistent, reusing the existing failure wording: scenario-save (line 402) → when !persistent, toast 'Saved "<name>" for this session only — device storage unavailable. Export a settings file instead.'; same treatment for import (line 442), duplicate success (line 421), and the two saveFill toasts (lines 466, 472: '…applied — session only, export a doctrine file to keep it.'). Simplest implementation: a small helper `persistNote(okMsg, sessionMsg)` or just ternaries at each of the 5 call sites. 4) Add one pinning assertion (Node has no indexedDB, so vitest exercises the fallback): expect(createStorageAdapter().persistent).toBe(false) — drop it into test/trust.test.ts or a 3-line new test. Edge cases to preserve: the existing .catch failure toasts for real idb errors must remain; scenario-export/doctrine-export paths don't touch the adapter and need no change; restoreFill on MemoryAdapter harmlessly resolves with nothing restored.

#### 107. Scenario import silently overwrites existing scenarios that share an id

`src/state/scenarios.ts:24` · **LOW** · data · effort: small

**Problem.** ScenarioStore.save keys rows on 'scenario:' + s.id and parseImportMany preserves the ids embedded in the imported file; main.ts:441 saves every imported scenario with no collision check or prompt. Failure scenario: user exports all scenarios as a backup, keeps editing scenario A on-device, then later imports the old backup to retrieve scenario B — scenario A's stored row is silently reverted to the stale backup copy (same UUID), destroying the newer edits with no warning and no undo. A deliberately crafted file can likewise overwrite any scenario whose id it names.

```
async save(s: Scenario): Promise<void> {
  await this.adapter.set(PREFIX + s.id, JSON.stringify(s));
}
// main.ts:441
Promise.all(r.value.map((s) => scenarioStore.save(s))).then(() => {
```

**Fix.** In src/ui/main.ts, case 'scenario-import' (lines 438-445): before saving, fetch existing ids with scenarioStore.list(), compute clashes = r.value.filter(s => existingIds.has(s.id)); if clashes.length > 0, gate on window.confirm(clashes.length + ' scenario(s) in this file already exist on this device ("' + names + '") and will be overwritten. Continue?'), mirroring the scenario-delete confirmation pattern at line 429. If declined, abort the whole import (preserves the module's documented all-or-nothing semantics — do not partially import only non-clashing rows without saying so). Optionally add a pure helper in src/state/scenarios.ts (e.g. collidingIds(existing: Scenario[], incoming: Scenario[]): string[]) so the logic gets one node test in test/trust.test.ts, since window.confirm itself is untestable there. Edge cases to preserve: (1) importing the app's own export where nothing changed still round-trips (confirm fires but Yes is safe); (2) list() skips corrupt rows, so a corrupt stored row with a clashing key won't trigger the confirm and will be overwritten — acceptable/desirable, but note it; (3) if activeScenarioId is among the overwritten ids, refresh activeScenarioName from the imported copy (or at minimum re-render via openScenarios, which already happens); (4) keep the existing catch/toast for storage failure. Do NOT remint ids on collision — that would double scenarios on repeated imports of the same backup.

#### 108. Unvalidated sectorAzimuths from imported scenarios draw a nonsensical sector wedge over/behind the position

`src/state/schema.ts:74` · **LOW** · ux · effort: trivial

**Problem.** validateInputs only checks leftDeg/rightDeg are finite numbers — no range or ordering constraint — and no UI exists to set them (file import is the only source). An imported scenario with e.g. {leftDeg: 200, rightDeg: 340} makes drawPlan's edge() (y = -halfW - R*cos(deg), cos negative) place both wedge vertices behind the front edge: the sector polygon and its degree/mil labels are painted across the bay/parapet underneath the structure while the ENEMY arrow still points up — a self-contradictory drawing on the exported range card. leftDeg > rightDeg similarly draws a crossed wedge with the left/right labels swapped onto the wrong sides (l is anchored 'end', r 'start').

```
if (!isObj(s) || !isNum(s['leftDeg']) || !isNum(s['rightDeg'])) return { ok: false, error: 'Invalid sectorAzimuths.' };
sectorAzimuths = { leftDeg: s['leftDeg'], rightDeg: s['rightDeg'] };  // no range/order clamp
```

**Fix.** Single validation point in src/state/schema.ts (import is the only source, so no need to touch the renderer). In validateInputs, extend the sectorAzimuths block (lines 71-76): after the isNum checks, bind l = s['leftDeg'], r = s['rightDeg'] and reject with { ok: false, error: 'sectorAzimuths: need -90 <= leftDeg < rightDeg <= 90.' } unless l >= -90 && r <= 90 && l < r. Rejection (not clamping) matches the file's existing strict philosophy ('never trust a file'; bad standard/unit already reject) and scenarios.ts's all-or-nothing import contract. Edge cases to preserve: (a) sectorAzimuths omitted stays valid — geometry.ts:131-132 falls back to -45/45; (b) boundary values ±90 remain accepted (cos=0 puts wedge edges exactly along the front line, still coherent); (c) leftDeg === rightDeg is rejected (degenerate zero-width wedge). Add two lines to test/schema-import.test.ts next to line 33: assert validateInputs rejects { leftDeg: 200, rightDeg: 340 } and { leftDeg: 45, rightDeg: -45 }, and accepts { leftDeg: -60, rightDeg: 30 }. Run npm test to confirm.

#### 109. boardFeet() silently returns 0 for any nominal outside its map — custom headers vanish from BF totals

`src/timber/bom.ts:53` · **LOW** · bug · effort: small

**Problem.** boardFeet falls back to 0 for unknown nominals (intended for panels), but Opening.headerNominal is a free string: a caller passing e.g. '4x6' gets headers silently excluded from board-feet and man-hour totals with no error, while walls.ts:84 simultaneously falls back to 2x4 dressed dims for the member (and line 126 to 2x6 for header depth), so the same header is drawn with two contradictory sizes. The 'stage BOMs partition the total' test can't catch it because both sides use the same boardFeet().

```
const perLf = BF_PER_LF[m.nominal];
return perLf ? (m.cutLength / 12) * perLf : 0;
// walls.ts:84: actual: DRESSED[nominal] ?? DRESSED['2x4']!,  vs  walls.ts:126: ?? DRESSED['2x6']
```

**Fix.** Two small edits plus one pinning test. (1) src/timber/walls.ts: normalize the header nominal once so geometry and BOM always agree — replace lines 125-126 with: const headerNominal = o.headerNominal && DRESSED[o.headerNominal] ? o.headerNominal : '2x6'; const headerDepthFt = DRESSED[headerNominal]!.d / FT; This makes the emitted member's actual dims (line 84 lookup now always hits) and the placement depth use the SAME size, with one consistent 2x6 fallback for unknown strings. (2) src/timber/bom.ts: delete the BF_PER_LF map and compute BF from the nominal itself in boardFeet(): const mm = /^(\d+)x(\d+)$/.exec(m.nominal); return mm ? (m.cutLength / 12) * ((+mm[1]! * +mm[2]!) / 12) : 0; The anchored regex keeps '4x8 panel' (and any future 'built-up' nominals) at 0 BF, preserving the panel/MH_PER_PANEL accounting, while covering every plain AxB nominal including future header sizes like 4x6. Edge cases the fix must preserve: panels still 0 BF and counted via panels/MH_PER_PANEL in bomSummary; default header stays doubled 2x6 so the golden configs in test/timber-walls.test.ts and test/timber-frame.test.ts produce identical Member[] (both goldens omit headerNominal, so determinism/partition tests must pass unchanged); BF uses NOMINAL dims (e.g. 2*6/12), not dressed dims. (3) Add one test (test/timber-walls.test.ts): generate walls with an opening whose headerNominal is '2x8' (valid) and one with 'bogus' — assert the '2x8' headers appear in cutList with nonzero boardFeet and actual {w:1.5,d:7.25}, and the 'bogus' one falls back to 2x6 dims for BOTH actual and position (header y-center consistent with 5.5" depth).

#### 110. floor.ts joist grid end-guard epsilon (0.01 ft) lets a grid joist interpenetrate the forced end joist

`src/timber/floor.ts:121` · **LOW** · bug · effort: small

**Problem.** The joist loop guard `x < L - t/2 - 0.01` only prevents a 0.12 in overlap, but joists are 1.5 in thick, so any building length where the last grid center lands within 1.5 in of the forced end joist (L - t/2) produces two interpenetrating joists and one phantom joist in the stage-3 cut list. Verified by execution: lengthFt 12.2, 12.22, and 16.19 at 16 in OC produce last-two-joist center distances of 0.90 in, 1.14 in, and 0.78 in respectively — all overlapping. Same defect class as the already-reported walls.ts grid end-guard, but in a different generator that round 1 never audited (walls fix will not fix this copy).

```
for (let x = t / 2; x < L - t / 2 - 0.01; x += oc) joistXs.push(x);
joistXs.push(L - t / 2);
```

**Fix.** Apply one consistent guard of a full member thickness in all three generators (they must match so the geometry stays in lockstep):

1. src/timber/floor.ts:121 — change `for (let x = t / 2; x < L - t / 2 - 0.01; x += oc)` to `for (let x = t / 2; x < L - t / 2 - t; x += oc)`. This drops any grid joist whose center lands within 1.5 in of the forced end joist at L - t/2 (touching-or-overlapping range), while keeping every joist a full OC away (oc = 16 or 24 in >> t = 1.5 in, so no legitimate joist is ever dropped).
2. src/timber/roof.ts:65 — same one-line change (`x < L - t / 2 - t`). This single array feeds ceiling joists (stage 7) and rafter pairs (stage 8), so the fix removes both the interpenetrating ceiling joist and the doubled rafter pair.
3. src/timber/walls.ts:105 — already reported separately; whatever lands there (`s < f.runFt - t / 2 - t`) must use the same expression.

Edge cases to preserve:
- The start member at t/2 and forced end member at L - t/2 must always both emit (they still do; the loop only trims interior grid points).
- A grid point exactly one full OC before the end (e.g. L = 20 ft, 16" OC: last grid joist at 18.729 ft, end at 19.9375 ft) must survive — it does, since 18.729 < 19.9375 - 0.125.
- Boundary where the grid center lands exactly at L - t/2 - t (members touching, not overlapping): strict `<` drops it, leaving a last bay of exactly oc + t center-to-center — harmless and consistent with the walls suggestion. Do not use <= with an epsilon; keep it simple and identical across the three files.
- Bridging (floor.ts:133-141) hardcodes cut length `oc - t` per bay; the last bay was already irregular before this fix and remains so after — no regression, but note it as a pre-existing nit (per-bay length should be joistXs[i+1]-joistXs[i]-t) if a follow-up is wanted.

Test: extend the existing fuzz test in test/timber-frame.test.ts (which already iterates lengthFt 13.5 — a triggering value) to assert minimum center-to-center spacing >= t (1.5 in, minus 1e-9 epsilon) between consecutive sorted stage-3 floor joists, stage-7 ceiling joists, and per-wall studs. That one assertion pins all three generators and fails on the current code at 13.5 ft.

#### 111. Collar-tie spacing breaks its own <=5 ft doctrine cite at 24" rafter spacing

`src/timber/roof.ts:101` · **LOW** · data · effort: trivial

**Problem.** Collar ties are placed on every 3rd rafter index unconditionally. At rafterSpacingIn=24 (a legal value of the union type) that is 6 ft apart, violating the '<=5 ft per manual' constraint stated in the code's own comment and emitted doctrineRef — the member card would cite a rule the geometry does not satisfy.

```
// Collar ties on every third rafter pair (≤5 ft apart per manual)...
for (let i = 0; i < joistXs.length; i += 3) {
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/timber/roof.ts (lines 98-106): before the tie loop add `const tieStride = Math.max(1, Math.floor(60 / input.rafterSpacingIn));` (60" = 5 ft) and change the loop to `for (let i = 0; i < joistXs.length; i += tieStride)`. Update the line-98 comment and make the doctrineRef honest, e.g. `FM 5-426: collar tie every ${tieStride} rafter pairs / ≤5 ft (PH page)` or drop the "every 3rd" phrasing and keep only "≤5 ft". Edge cases to preserve: (1) at rafterSpacingIn=16, floor(60/16)=3 — output must be byte-identical to today so existing timber-frame.test.ts expectations and member IDs (RF-collarTie-NN) are unchanged; (2) joistXs is not perfectly uniform (final joist pushed at L - t/2, line 66), so the last gap may be shorter than stride*oc — that still satisfies ≤5 ft, no special handling needed; (3) the Math.max(1,...) guard keeps the loop terminating if the union type ever widens. Per repo convention (non-trivial logic gets one runnable check), add a single assertion to test/timber-frame.test.ts: generate with rafterSpacingIn=24 and assert consecutive collarTie member X positions differ by ≤5 ft.

#### 112. Rafter cut length omits the half-ridge shortening the model's own ridge board requires

`src/timber/roof.ts:77` · **LOW** · bug · effort: small

**Problem.** rafterLen is the full centerline distance from eave tail to the ridge center (run * lenPerFtRun), but the model also emits a 1.5"-thick 2x8 ridge board at z = W/2. The framing-square method the doctrineRef cites requires deducting half the ridge thickness (3/4" along the horizontal, ~0.79" along the slope for 4:12); without it the carpenter-facing cut list is ~3/4" long on every rafter and the rafter tips from both slopes interpenetrate the ridge board (and each other) in the 3D scene. The roof test asserts cutLength equals the undeducted formula, locking the error in.

```
const rafterLen = run * lenPerFtRun;
...
emit('ridge', '2x8', L, [L / 2, ridgeY + ridgeD / 2, W / 2], ...)
```

**Fix.** 1) src/timber/roof.ts — in the Stage 8 block: ridge thickness in feet already exists as `t` (line 56, 1.5/FT). Change line 77 to `const rafterLen = (run - t / 2) * lenPerFtRun;`. Inside the per-side loop (lines 82-86), pull the ridge-end of the centerline back half the ridge thickness along the same slope line: `const zRidge = W / 2 + side * (t / 2);` (side -1 → W/2 − t/2, side +1 → W/2 + t/2) and `const yRidgeEnd = ridgeY - (t / 2) * (input.risePer12 / 12);` then center with `const zC = (zEave + zRidge) / 2; const yC = (yEave + yRidgeEnd) / 2;`. Because the endpoint moves along the existing centerline, the rafter's plane is unchanged — collar-tie geometry (tieY/tieHalf, lines 99-100), gable studs, and sheathing (slopeLen at line 120 intentionally keeps full run so panels still reach the ridge) all remain valid untouched. Optionally note the deduction in the rafter doctrineRef string. 2) test/timber-frame.test.ts:76 — update expectation to `const expected = (run - 0.75 / 12) * (Math.sqrt(144 + input.risePer12 ** 2) / 12) * 12;` and consider adding one assertion that each rafter tip z stays clear of W/2 ∓ 0.0625 ft. Edge cases to preserve: no-NaN fuzz (risePer12 2–12, widths ≥ 8 ft — run ≥ 5 ft so run − t/2 stays positive), determinism (pure function, unchanged), BOM partition (cutLength change flows through boardFeet consistently), and the 0.01" test tolerance (deduction is exact, so tolerance is fine).

#### 113. risePer12 = 0 produces NaN collar ties and NaN BOM totals

`src/timber/roof.ts:100` · **LOW** · bug · effort: trivial

**Problem.** tieHalf divides by input.risePer12. BuildingInput.risePer12 is an unconstrained number and generateFrame validates nothing; with risePer12=0 (flat roof — a plausible value once the planned control panel lands) the expression is 0/0. Verified: every collarTie member gets cutLength NaN, which propagates through boardFeet() into bomSummary — totalBoardFeet and totalManHours are NaN, so the stage panel renders 'NaN BF · NaN MH' and the 3D member gets a NaN length scale (mesh vanishes). The fuzz test in timber-frame.test.ts only sweeps risePer12 in [2,4,6,12], so this is unasserted. Negative risePer12 similarly yields a ridge below the walls and negative gable-stud logic with no guard.

```
const tieY = ridgeY - (ridgeY - H) / 3;
const tieHalf = ((ridgeY - tieY) * 12) / input.risePer12;
```

**Fix.** 1) src/timber/roof.ts line 100: replace `const tieHalf = ((ridgeY - tieY) * 12) / input.risePer12;` with `const tieHalf = halfSpan / 3;` — algebraically identical for all rise > 0 (verified: yields exactly 64 in vs 64.00000000000003 in for the golden 16 ft span; the 3e-14 in difference is invisible after cutList's 1/8-inch rounding, and no test asserts the exact tie length). 2) Same file: wrap the collar-tie loop (lines 101-106) in `if (input.risePer12 > 0) { ... }` so flat/negative pitches emit no ties (a collar tie at plate height is meaningless). Gable studs need no change — the `riseHere < 0.2` continue at line 111 already skips them for rise <= 0. 3) test/timber-frame.test.ts line 47: change the fuzz sweep to `[0, 2, 4, 6, 12]` (the fuzz test asserts only finiteness, which passes at rise 0 after the fix: lenPerFtRun=1, ridgeY=H, all finite). Edge cases to preserve: collar ties must still appear every 3rd rafter pair with cutLength 2*halfSpan/3 for all positive pitches (golden test's deepEqual determinism and BOM-partition tests must stay green); do not add a throw for negative rise — a negative-pitch guard belongs at the future control-panel trust boundary, not in the pure generator. Verify with `npm test`.

#### 114. No opening validation: negative-cutLength cripples and framing emitted outside the wall

`src/timber/walls.ts:147` · **LOW** · bug · effort: small

**Problem.** Openings are consumed unchecked. Verified failure cases: (1) sillHeightFt=0.1 ft (1.2", less than plate thickness) passes the `> 0` guard and emits below-sill cripples with cutLength = -0.3" — violating the module's own cutLength > 0 invariant (asserted only for golden inputs), producing an inverted-scale mesh in 3D and negative board-feet in the cut list; (2) offsetFt=0 emits a king stud centered at -2.25" — outside the wall run, overlapping the corner studs, and giving a negative atIn in layoutStrip; (3) an opening wider than the wall (offsetFt=2, widthFt=25 on a 20 ft wall) emits a 303" header on a 240" wall with kings/jacks 7 ft past the wall end. BuildingInput is currently hardcoded in woodframe-scene.ts, but the comment there says it 'becomes user input when TIMBER-1 grows its control panel', at which point all three are one keystroke away.

```
if (o.sillHeightFt > 0) {
  ...
  emit('cripple', '2x4', sillTop - 2 * t, s, t + (sillTop - 2 * t) / 2, 'vertical');
// and line 130: emit('kingStud', '2x4', studLen, edge + (side * 3 * t) / 2, ...)
```

**Fix.** All changes in /Users/zacharytraphagen/FieldFortificationsCalculator/src/timber/walls.ts plus one test. (1) Validate openings per wall: replace line 103 `const walls = input.openings.filter((o) => o.wall === f.wall)` with a filter that also drops openings failing any of: widthFt > 0 && heightFt > 0; sillHeightFt === 0 || sillHeightFt >= t (t = 0.125 ft, so a sill never intersects the sole plate); offsetFt >= 3*t (room for king+jack inboard of the wall start); offsetFt + widthFt + 3*t <= f.runFt (must use f.runFt, not the raw building dims — E/W walls run widthFt - t); headBottom + headerDepthFt <= H - 2*t where headBottom = sillHeightFt + heightFt + t and headerDepthFt = (DRESSED[o.headerNominal ?? '2x6'] ?? DRESSED['2x6']!).d / FT (header must fit under the doubled top plate). Dropping (not clamping) keeps output well-formed and is the lazy-correct choice; the future control panel validates at its own trust boundary. (2) Guard the below-sill cripple emit at line 147 with `sillTop - 2*t > 0.05`, mirroring the epsilon guard the above-header block already uses at line 152 — this covers the boundary case sillHeightFt === t where cripple length is exactly 0. (3) Add one test block to /Users/zacharytraphagen/FieldFortificationsCalculator/test/timber-walls.test.ts feeding the three degenerate openings (sillHeightFt 0.1, offsetFt 0, widthFt 25 on a 20 ft wall) and asserting every member has cutLength > 0 and along-wall center within [0, runFt]. Edge cases to preserve: golden inputs in test/timber-walls.test.ts and test/timber-frame.test.ts must produce byte-identical output (all golden openings pass the new filter — verify the deepEqual determinism tests still pass); door openings (sillHeightFt === 0) must still skip sill/below-cripples; header nominal fallback '2x6' must match line 125-126 so the filter and the emit agree on header depth.

#### 115. Suite hub ships developer-facing scaffolding text to end users

`src/ui/hub.html:50` · **LOW** · ui · effort: trivial

**Problem.** The ghost card on the deployed hub reads 'Next tool goes here — bridging, culverts, demolition calcs… one card + one page per tool.' The final clause is an instruction to the developer (mirroring the HTML comment at the top of the file about adding a rollup input in vite.config.ts), not information for a user. Failure scenario: every visitor to the production suite landing page sees repo-maintenance instructions rendered as product UI, which reads as an unfinished mockup and dilutes the page's credibility next to the 'NOT FOR FIELD USE' safety badge.

```
<div class="card ghost">
  <p>Next tool goes here —<br />bridging, culverts, demolition calcs…<br />
  one card + one page per tool.</p>
</div>
```

**Fix.** Edit src/ui/hub.html lines 50-51 only: replace the ghost card paragraph text with user-facing copy, e.g. "<p>More tools coming —<br />bridging, culverts, demolition calcs.</p>". Keep the element a non-clickable div.card.ghost (the dashed placeholder styling at line 24 works as a coming-soon teaser) and leave the developer HTML comment at line 4 untouched — comments are stripped/invisible and are the right home for the "one card + one rollup input" instruction. No other files reference this text and no tests assert on hub.html, so no other changes are needed.

#### 116. hub.html and woodframe.html have no favicon link — guaranteed /favicon.ico 404 and inconsistent tab branding

`src/ui/hub.html:9` · **LOW** · ui · effort: trivial

**Problem.** index.html links ./icons/icon.svg, but hub.html and woodframe.html declare no icon, so browsers request /favicon.ico, which exists in neither public/ nor any dist output — serve.js returns a hard 404 (extension '.ico' skips the SPA fallback), and offline the SW fallback answers it with index.html's HTML. Result: a 404 on every hub/woodframe load, console/network noise on the pages you are actively developing, and blank tab icons next to SAP-1's branded tab. The icon asset already ships in dist/ via publicDir, so the fix is one line per page (except dist-woodframe, where publicDir:false means the icon must be referenced from src so vite inlines/emits it).

```
// hub.html <head> (lines 6-9): charset, viewport, <title> — no <link rel="icon">
// woodframe.html <head> (lines 8-11): same omission
// index.html:10: <link rel="icon" href="./icons/icon.svg" type="image/svg+xml" />
```

**Fix.** Two one-line edits. (1) src/ui/hub.html — after the <title> on line 9, add exactly the line index.html already uses: <link rel="icon" href="./icons/icon.svg" type="image/svg+xml" />. hub.html is only built by the main vite.config.ts, whose publicDir ('../../public') copies icons/ to the dist root alongside hub.html, and the dev server serves /icons/icon.svg from publicDir, so the relative href works in both dev and dist (base is './'). (2) src/ui/woodframe.html — this file is an input to BOTH builds (vite.config.ts and vite.woodframe.config.ts), and the latter has publicDir:false, so ./icons/icon.svg would 404 in dist-woodframe. Instead inline the icon as a data: URI: <link rel="icon" href="data:image/svg+xml,<url-encoded contents of public/icons/icon.svg>" /> — the SVG is only 806 bytes, so the encoded URI is negligible and works identically in dist/, dist-woodframe/, dev, and offline (no network request at all). Edge cases to preserve: dist-woodframe must stay self-contained with publicDir:false (data URI honors this — do NOT use ./icons/icon.svg there); the app's zero-external-request/offline invariant (both fixes are same-origin or no-request); do not touch scripts/serve.js or public/sw.js — once the pages declare an icon, browsers stop probing /favicon.ico, so no server/SW special-casing is needed. Verify by rebuilding (npm run build and the woodframe build) and grepping dist/hub.html, dist/woodframe.html, and dist-woodframe/woodframe.html for rel="icon". Alternative for woodframe.html if data URI is disliked: href="../../public/icons/icon.svg" lets vite emit a hashed asset in both builds (vite processes link[href]), at the cost of a duplicate hashed copy in the main build.

#### 117. Branding mismatch: hub card says 'Survivability Position Planner' / SAP-1, but the page it opens titles itself 'Fighting Position Planner'

`src/ui/index.html:11` · **LOW** · ux · effort: trivial

**Problem.** index.html's <title>, meta description, and manifest.webmanifest name all say 'Fighting Position Planner', while hub.html:36-37 labels the same link 'SAP-1 / Survivability Position Planner' and package.json/docs use 'SAP-1 — Survivability Position Planner'. A user clicking the hub card lands on a tab titled differently from the card they clicked, which reads as landing on the wrong page; the installed-PWA name also won't match the suite's naming.

```
<title>Fighting Position Planner</title>              // index.html:11
"name": "Fighting Position Planner",                  // public/manifest.webmanifest
<span class="tag">SAP-1</span>
<h2>Survivability Position Planner</h2>               // hub.html:36-37
```

**Fix.** Standardize on "SAP-1 — Survivability Position Planner" (the name already used by package.json, README, csv.ts, jobSheet.ts, and the hub card). Four string edits: (1) src/ui/index.html:11 title → "SAP-1 — Survivability Position Planner"; line 7 meta description → replace the leading "Fighting Position Planner" with the same. (2) public/manifest.webmanifest: name → "SAP-1 — Survivability Position Planner", short_name → "SAP-1" (keep short_name ≤12 chars per PWA guidance so the installed icon label doesn't truncate). (3) src/layout/shell.ts:128 brand <strong> → "SAP-1 — Survivability Position Planner" (check header width on mobile; if it wraps badly, use just "Survivability Position Planner" with SAP-1 elsewhere). Edge cases: do NOT touch hub.html, csv.ts, jobSheet.ts (already correct); leave manifest start_url/scope/icons/theme_color unchanged; no tests reference either string so nothing else to update. Note installed PWAs cache the manifest name — existing installs update lazily, which is acceptable.

#### 118. Every overlay announces as the same generic 'Detail' dialog

`src/ui/index.html:22` · **LOW** · a11y · effort: small

**Problem.** The single reusable overlay carries a hardcoded aria-label="Detail", but it hosts nine different tools (help, scenarios, mission BOM, compare, time planner, schedule, doctrine fill, diagnostics, derivation trace). A screen-reader user always hears 'Detail, dialog' on open regardless of content, and since focus is also not moved (separate finding), the announced name is the only cheap orientation cue — and it's wrong for every overlay.

```
<div class="overlay-card" role="dialog" aria-modal="true" aria-label="Detail">
```

**Fix.** Pass the accessible name through showOverlay rather than aria-labelledby (headings have no ids, and trace uses h3 not h2, so labelledby would need id churn in three generator files). 1) src/ui/main.ts: add a module-level ref `const overlayCard = overlay.querySelector('.overlay-card')!` next to the existing overlay/overlayBody refs (lines 38-39); change signature to `showOverlay(html: string, label: string)` and add `overlayCard.setAttribute('aria-label', label)` before unhiding. 2) Update all nine call sites with labels matching each overlay's visible heading: main.ts:65 'Doctrine values', :116 'Priorities of work', :149 'Saved setups', :153 'Group job list (Mission BOM)', :161 'Compare setups', :164 'Time planner', :387 'How to use SAP-1', :600 'Status', and :596 pass the dynamic derivation label (`d.label`) so each trace announces its own name. 3) index.html:22 keep `aria-label="Detail"` as the static fallback (harmless; overwritten on every open) or change it to 'Dialog' — either is fine since showOverlay always sets it. Edge cases: hideOverlay needs no change (label is set on every show); overlays that re-render on interaction (doctrine fill, schedule, planner) re-enter through showOverlay so the label stays correct; no test pins the old label, and add one line to test/a11y.test.ts if the suite pattern allows (assert index.html dialog still has role="dialog" and that main.ts sets aria-label — or simplest, skip the test since it is a one-line DOM attribute set exercised on every overlay open).

#### 119. Suite navigation is one-way: no link back to the hub from SAP-1

`src/ui/index.html:13` · **LOW** · ux · effort: trivial

**Problem.** hub.html links to index.html and woodframe.html, and woodframe.html has a '⌂ Combat Engineer Toolkit' back-link (woodframe.html:45), but nothing in index.html or the rendered SAP-1 shell references hub.html (verified: zero 'hub' hits across src/ui/main.ts, src/layout/, index.html). A user who enters via the hub and clicks into SAP-1 has no in-app way back to the suite — inconsistent with TIMBER-1 and dependent on the browser back button, which is lost if SAP-1 was opened in a new tab or installed as a PWA (manifest start_url './').

```
// grep -rn "hub.html" src/ --include="*.ts" → no matches
// index.html body: skip-link, #root, #overlay — no hub link
// woodframe.html:45 has: <a href="./hub.html" ...>⌂ Combat Engineer Toolkit</a>
```

**Fix.** Mirror woodframe.html's pattern in the SAP-1 topbar. In src/layout/shell.ts topbar() (line ~127), change the brand div to include the link: '<div class="brand"><strong>Fighting Position Planner</strong> <a class="hub-link" href="./hub.html">⌂ Combat Engineer Toolkit</a></div>' (or place the anchor between brand and hamburgerMenu). Add a small .hub-link rule in src/ui/styles.css (font-size ~12px, muted color, ellipsis/hide the text label on narrow mobile widths so it doesn't crowd the ☰ Menu button — e.g. show only '⌂' below ~480px). Edge cases to preserve: (1) do NOT add data-action or data-field to the anchor — main.ts's delegated click handler (line 357) only intercepts [data-action] elements, so a plain href navigates natively, which is what we want; (2) topbar() re-renders on every state change, so a static anchor string is fine — no listener wiring needed; (3) the air-gap standalone build (vite.standalone.config.ts builds index.html only) will ship a dangling ./hub.html link — same accepted precedent as the dist-woodframe standalone's hub link; if that bothers anyone later, strip the anchor in scripts/build-standalone.ts post-processing, but it is not required now. No test needed beyond eyeballing: the existing shell render tests (if any snapshot topbar HTML) may need the new anchor added to expectations — grep test/ for 'topbar' or 'Fighting Position Planner' before committing.

#### 120. Compare overlay removes the wrong setup when an entry fails compute

`src/ui/main.ts:497` · **LOW** · bug · effort: small

**Problem.** openCompare silently filters out entries whose compute fails (main.ts:158-160), so the overlay's column indices are positions in the FILTERED results array (tools.ts:93 data-idx=i), but compare-remove splices the UNFILTERED comparisonSet at that index. Scenario: comparisonSet = [A(broken), B, C]; overlay shows #1=B, #2=C; clicking ✕ on #2 (idx 1) deletes B — the column the user kept. Additionally the overlay's 'Add current' disabled state uses results.length (tools.ts:98) while the handler guards set.length < 3 (main.ts:496), so with one broken entry the button renders enabled but the click silently does nothing.

```
case 'compare-remove': { const idx = Number(actionEl.dataset['idx']); const set = store.getState().comparisonSet.slice(); if (idx >= 0 && idx < set.length) { set.splice(idx, 1); … } }
// openCompare: if (c.ok) results.push(c.value);  ← filtered
```

**Fix.** Carry the original set index through rendering instead of the filtered position. (1) src/ui/main.ts openCompare: build entries with their source index — const set = store.getState().comparisonSet; const entries = set.map((inp, setIdx) => ({ setIdx, c: safeCompute(inp) })).flatMap(e => e.c.ok ? [{ setIdx: e.setIdx, result: e.c.value }] : []); then showOverlay(compareOverlay(entries, set.length)). (2) src/layout/tools.ts compareOverlay: change signature to compareOverlay(entries: { result: Result; setIdx: number }[], setLength: number); in the header row use data-idx="' + entries[i].setIdx + '" (keep the displayed #N as i+1); change the Add-current disabled condition from results.length >= 3 to setLength >= 3, and apply the same disabled condition to the Add-current button in the empty-state branch (currently never disabled — with 3 broken entries it would render enabled and no-op). Internal metric lambdas keep operating on entries[i].result. (3) Edge cases to preserve: the empty branch when entries.length === 0 but setLength > 0 (all broken) should still render, ideally with the Clear button available so the user can recover; the compare-remove handler's existing bounds check (idx >= 0 && idx < set.length) already covers stale indices, keep it. (4) Add one small test (e.g., in test/trust.test.ts or a new test/compare-overlay.test.ts) calling compareOverlay directly with synthetic entries [{result: r1, setIdx: 1}, {result: r2, setIdx: 2}] and setLength 3, asserting the rendered data-idx values are 1 and 2 and that Add current is disabled — this pins index parity without needing to force a compute throw.

#### 121. Diagnostics 'Last error' is never cleared, so Status reports stale errors indefinitely

`src/ui/main.ts:599` · **LOW** · ux · effort: small

**Problem.** store.lastError is set on compute failure (line 249) and scenario-save failure (line 406) but never reset to null after recovery — no code path writes lastError: null after boot (store.ts:55). The Status overlay prints it verbatim via diagnosticsText ('Last error: ...', diagnostics.ts:41). Failure scenario: a save fails once while storage is full; weeks later the user opens Status to check the app before an exercise and it still reports 'Last error: Scenario save failed…' as if the app is currently broken, and that stale line ends up in bug reports.

```
function showDiagnostics(): void {
  const d = collectDiagnostics(store.getState().lastError);
// set at 249: store.setState({ lastError: c.error }); and 406 — never set back to null
```

**Fix.** Two scoped clears in src/ui/main.ts (do NOT clear unconditionally in render — see edge cases). (1) Compute errors: in render()'s c.ok branch (after line 231), add a guarded clear: if (state.lastError?.startsWith('Compute failed')) store.setState({ lastError: null }). The startsWith scope prevents wiping a save error (the save-failure setState at :406 itself triggers a render whose compute succeeds — an unscoped clear would erase the save error the instant it is set). The guard also prevents a render loop: setState always notifies, scheduleRender is rAF-batched (main.ts:184-191), so a guarded clear costs one extra frame then stabilizes; an unguarded setState would loop forever. (2) Save errors: in the scenario-save .then success handler (main.ts:401), add lastError: null to the existing setState — a later successful save clears the prior save failure. Safe because scenario-save is unreachable during a compute-error state (errorCardHtml replaces the whole app shell at :250). Alternative/addition per auditor: relabel diagnostics.ts:41 to 'Last recorded error' and prepend a timestamp when setting at :249/:406 — nice-to-have, not required. Add one small test (e.g. in test/ alongside existing suites) asserting a compute-error → successful-compute cycle leaves lastError null, per the repo's one-runnable-check rule.

#### 122. Doctrine 'applied and saved on this device' toast shown even when persistence failed

`src/ui/main.ts:466` · **LOW** · data · effort: small

**Problem.** saveFill (src/state/doctrineFill.ts:14-17) swallows every storage error and returns a resolved promise; main.ts fires it and unconditionally toasts 'doctrine value(s) applied and saved on this device'. Failure scenario: Firefox private browsing or IndexedDB quota exhaustion — the S-3's painstakingly filled doctrine values apply for the session, the app asserts they were saved, and on the next boot everything silently reverts to NOT-FOR-FIELD-USE placeholders. The user was explicitly told persistence succeeded when it did not (scenario saves handle this correctly with a .catch and a 'Save FAILED' toast; the doctrine path does not).

```
if (doctrineReport.ok) { saveFill(persistAdapter); showToast(doctrineReport.applied + ' doctrine value(s) applied and saved on this device.'); ... }
// doctrineFill.ts
try { await adapter.set(KEY, JSON.stringify(exportDoctrine(manifest))); } catch { /* storage failure is non-fatal */ }
```

**Fix.** 1) src/state/doctrineFill.ts: change saveFill to return Promise<boolean> — return true after a successful adapter.set, false in the existing catch. Keep the catch (do NOT rethrow): the non-fatal semantics must be preserved so the apply itself never fails because of storage.
2) src/ui/main.ts:466 (doctrine-import-apply): keep the synchronous flow (scheduleRender(), openDoctrine()) but move the toast into the promise: saveFill(persistAdapter).then((saved) => showToast(saved ? applied + " doctrine value(s) applied and saved on this device." : applied + " doctrine value(s) applied but NOT saved — will not survive reload. Export the doctrine file as backup.")). Capture doctrineReport.applied in a local const before the async toast, since doctrineReport is module state that other actions reset (e.g. case 'doctrine' sets it null).
3) src/ui/main.ts:472 (doctrine-apply-edits): same pattern; success toast stays "applied.", failure toast uses the same NOT-saved warning.
4) test/doctrine-io.test.ts: existing test at line 99 still passes unchanged (awaits saveFill, ignores return). Add one small assertion: saveFill with an adapter whose set() rejects resolves to false and does not throw; with MemoryAdapter it resolves true.
Edge cases to preserve: restoreFill's all-or-nothing re-validation untouched; clearFill semantics untouched; known ceiling — when indexedDB is absent the MemoryAdapter fallback "succeeds" so the toast still says saved even though persistence is session-only (mark with a ponytail: comment; fixing that would require the adapter to self-report persistence class, out of scope for this finding).

#### 123. Doctrine import bypasses the 512 KB file-size cap enforced on every other import

`src/ui/main.ts:456` · **LOW** · bug · effort: trivial

**Problem.** Scenario/session imports go through safeJsonParse (schema.ts) which rejects files over 512 KB before parsing, but the doctrine import handler calls raw JSON.parse(text) on the full file contents; importDoctrine's maxEntries=5000 check only runs after the entire file has been parsed and deep-walked by hasDangerousKeys. Failure scenario: user picks a multi-hundred-MB .json (mis-selected file or a hostile 'doctrine file' handed over on a stick) — f.text() plus JSON.parse block the main thread and can OOM the tab, losing any unsaved on-hand/plan state, instead of the instant 'file too large' rejection every other import gives.

```
pickFile((text) => {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { showToast('Import failed: not valid JSON.'); return; }
  pendingImport = parsed;
```

**Fix.** In src/ui/main.ts: (1) add safeJsonParse to the existing imports (import { safeJsonParse } from '../state/schema'); (2) in the 'doctrine-import' case (lines 453-461), replace the try { parsed = JSON.parse(text) } catch block with: const p = safeJsonParse(text); if (!p.ok) { showToast('Import failed: ' + p.error); return; } pendingImport = p.value; doctrineReport = importDoctrine(p.value, { dryRun: true }); openDoctrine(). Edge cases to preserve: keep the 'Import failed: ' toast prefix (error text becomes safeJsonParse's message — 'Not valid JSON.', 'File too large (max 512 KB).', or the prototype-pollution message, all appropriate); keep the dryRun preview flow and pendingImport staging exactly as-is; importDoctrine's own hasDangerousKeys check stays (redundant with safeJsonParse's but harmless and still guards the loadFill/localStorage path in src/state/doctrineFill.ts that does not go through safeJsonParse). Optional hardening (cheap, benefits scenario import too): in pickFile (main.ts:138), reject before reading when f.size > 512*1024 (toast 'File too large') so a multi-hundred-MB file is never materialized as a string at all — safeJsonParse alone still lets f.text() allocate the full string before rejecting. One-line test: add a case to test/doctrine-io.test.ts or a small main-path test asserting safeJsonParse rejects a >512KB string, if the repo's convention wants the behavior pinned (safeJsonParse's cap may already be covered by scenario import tests).

#### 124. File-picker read failures are swallowed silently — an import that fails to read gives zero feedback

`src/ui/main.ts:144` · **LOW** · ux · effort: trivial

**Problem.** pickFile discards read errors with .catch(() => undefined). Failure scenario: user taps Import JSON (scenarios or doctrine) and picks a file whose read fails — e.g. a cloud-provider file that fails to materialize on mobile, or a file deleted between selection and read — and nothing happens at all: no toast, no alert, no overlay change. The user cannot tell whether the import silently succeeded, failed, or was ignored (the parse-error paths downstream do show messages, but they are never reached).

```
input.addEventListener('change', () => {
  const f = input.files?.[0];
  if (f) f.text().then(cb).catch(() => undefined);
});
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts, line 144, change `.catch(() => undefined)` to `.catch(() => showToast('Import failed: could not read the selected file.'))`. Edge cases to preserve: (1) keep the `if (f)` guard — a cancelled dialog fires no change event and must stay silent; (2) the message must be caller-agnostic since pickFile serves both scenario-import and doctrine-import (a generic 'could not read the selected file' covers both); (3) do not invoke cb on failure — downstream parse/persist toasts must remain unreachable on read failure. showToast is already defined above pickFile in the same file, so no new imports or ordering changes. Trivial one-liner; no test required.

#### 125. No-op clamped edits push dead entries onto the undo stack

`src/ui/main.ts:302` · **LOW** · ux · effort: trivial

**Problem.** commit() always calls history.push() after setInputs, even when the coerced/clamped value equals the value already in state. Concrete case (acknowledged by the comment at main.ts:319-321): count is 1, user types 0, coerce clamps back to 1 -> patch {count:1} -> commit pushes a snapshot identical to the current present. history.canUndo() becomes true, the topbar Undo button enables, and pressing Undo visibly does nothing (identical Inputs). Repeating the rejected edit N times requires N dead Undo presses before reaching the last real edit. With MAX=100 (src/state/history.ts:7), dead entries also evict real ones from the bounded stack.

```
function commit(patch: Partial<Inputs>): void {
  store.setInputs(patch);
  history.push(store.getState().inputs); // pushed even when nothing changed
  syncHistory();
}
```

**Fix.** In src/ui/main.ts commit() (lines 300-304), add an early return before setInputs when every patched field already equals current state: `const prev = store.getState().inputs; if ((Object.keys(patch) as (keyof Inputs)[]).every((k) => prev[k] === patch[k])) return;`. Strict === is safe: every field routed through commit (via coerce and the threat-class handler) is a primitive (number/string/boolean). Edge cases to preserve: (1) the field-snap at main.ts:322-325 must still correct the visible input text after a rejected clamp — it operates directly on el.value in the change handler after commit returns, so the early return does not affect it (this is the behavior the main.ts:319-321 comment exists to protect); (2) do NOT add the guard inside history.push itself — the plan-apply path (main.ts:510) and store.replaceInputs callers legitimately push after replaceInputs and guarding there would change their semantics beyond this finding; (3) skipping setInputs on a no-op also correctly skips persistSession/scheduleRender listeners (nothing changed). Optionally add one test case to test/state.test.ts asserting the guard predicate logic, though commit() is UI glue and the one-line guard is arguably below the repo's test threshold.

#### 126. Numeric field coercion parseInt misreads scientific notation — typing 1e5 into a count field commits 1 instead of clamping to the max

`src/ui/main.ts:293` · **LOW** · bug · effort: trivial

**Problem.** coerce() parses number-input values with parseInt(el.value, 10). type=number inputs accept scientific notation as valid text, so el.value can legitimately be '1e5' (or '2e1'): parseInt stops at 'e' and yields 1 — the committed value is 1 instead of the clamped 999 (count) or 50 (teamSize) the user's 100000/20 should map to. The snap-back on line 323 then rewrites the field to '1', so a user entering a crew of '2e1' (20) silently plans labor for a team of 2 → elapsed-hours 10x too high. Decimals are likewise truncated ('2.9' → 2) rather than rounded, diverging from the engine's own Math.round normalization in compute.ts:143-144.

```
const n = parseInt(el.value, 10);
const fallback = Number.isFinite(min) ? min : 0;
const v = Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
```

**Fix.** File: /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts. (1) Line 292: replace `const n = parseInt(el.value, 10);` with `const n = Math.round(el.valueAsNumber);`. valueAsNumber parses full float syntax including scientific notation ('1e5' → 100000, '2e1' → 20, '2.9' → 2.9 → rounds to 3, matching compute.ts's Math.round), and returns NaN for empty/invalid input, so Math.round(NaN)=NaN flows into the existing `Number.isFinite(n) ? n : fallback` guard unchanged — empty-field fallback-to-min behavior is preserved (do NOT use Number(el.value), since Number('')===0 would change empty-field semantics for any future min<=0 field). Extreme overflow like '1e999' → Infinity → Number.isFinite false → fallback to min, which is safe. (2) Line 310 (on-hand path, same defect): replace `Math.max(0, parseInt(el.value, 10) || 0)` with `Math.max(0, Math.round(el.valueAsNumber) || 0)` — Math.round(NaN)||0 → 0 preserves the existing empty→0 and floor-at-0 behavior. Edge cases to preserve: empty string → min (coerce) / 0 (onHand); the snap-back at lines 323-325 must still fire when the typed text differs from the committed number (it will — '1e5' commits 999 and the field is rewritten to '999'). Optional pin: a small vitest+jsdom test asserting coerce-equivalent behavior (input.value='1e5' with min=1,max=999 commits 999) if the test environment already has jsdom; skip if it does not — the change is two lines of stdlib.

#### 127. Reset says 'Clear everything' but mission and comparison sets survive

`src/ui/main.ts:374` · **LOW** · ux · effort: trivial

**Problem.** The toolbar button is titled 'Clear everything and start fresh' (shell.ts:150), but the reset case only replaces inputs and the scenario/override — missionSet, comparisonSet, and onHand persist (and are re-saved to the session). Scenario: user resets to plan a new site, opens 'Combine positions', and the mission BOM still aggregates the previous site's positions; an exported materials list then includes positions they believed were cleared.

```
store.replaceInputs(DEFAULT_INPUTS);
history.reset(DEFAULT_INPUTS);
store.setState({ activeScenarioId: null, activeScenarioName: null, layoutOverride: 'auto' });
// missionSet / comparisonSet / onHand untouched
```

**Fix.** Single-file fix in src/ui/main.ts, case 'reset' (line 374-380): (1) before the setState, clear the module-level onHand object in place — `for (const k of Object.keys(onHand)) delete onHand[k];` — it must be mutated BEFORE setState so the store subscriber (main.ts:69-71) persists the cleaned session snapshot, since onHand lives outside the store; (2) extend the setState to `store.setState({ activeScenarioId: null, activeScenarioName: null, layoutOverride: 'auto', missionSet: [], comparisonSet: [] })`. Edge cases to preserve: do NOT clear scenarioStore (named saves are deliberate persistence, not session state), theme, or doctrine overrides; keep the layoutOverride:'auto' reset and recomputeLayout()/syncHistory() calls exactly as-is (the comment at main.ts:370-373 explains why layoutOverride must reset). Consideration: reset has no confirm dialog, and this fix makes it more destructive — optionally wrap in window.confirm matching the existing scenario-delete pattern (main.ts:429), but that is a product call; the minimal fix is the two changes above. Testing: the main.ts click handlers have no test harness; if one runnable check is wanted, a store-level assertion isn't meaningful (the bug is in the handler), so either leave untested per existing repo pattern or add a small jsdom test dispatching a click on [data-action=reset] — otherwise verify manually: add position to mission set, enter on-hand qty, Reset, reopen Mission tool, expect empty state message.

#### 128. SVG export fires two programmatic downloads in one gesture — second is blocked in Chrome while the toast claims success

`src/ui/main.ts:700` · **LOW** · ux · effort: trivial

**Problem.** doSvg calls download() twice back-to-back (plan then section). Chrome's multiple-automatic-downloads policy allows the first and blocks the second behind a permission prompt users routinely dismiss; Safari can block it outright. The toast then asserts 'Plan and section downloaded as SVG drawings.' Scenario: a Chrome user exports drawings for a range-card packet, gets only sap1-plan.svg, and discovers the missing section drawing at the printer.

```
download('sap1-plan.svg', drawPlan(lastResult), 'image/svg+xml');
download('sap1-section.svg', drawSection(lastResult), 'image/svg+xml');
showToast('Plan and section downloaded as SVG drawings.');
```

**Fix.** Split the export into one download per click (no new deps, keeps everything offline). (1) src/layout/shell.ts:117 — replace the single menuItem('svg', 'Download drawings', ...) with two items under "Save & print": menuItem('svg-plan', 'Download plan drawing', 'Top-down plan as an image file') and menuItem('svg-section', 'Download section drawing', 'Cross-section as an image file'). (2) src/ui/main.ts — replace case 'svg' at line 385 with case 'svg-plan' and case 'svg-section', and change doSvg() into doSvg(kind: 'plan' | 'section') that keeps the `if (!lastResult) return;` guard, calls download('sap1-plan.svg', drawPlan(lastResult), 'image/svg+xml') or download('sap1-section.svg', drawSection(lastResult), 'image/svg+xml'), and toasts the specific filename saved. Edge cases to preserve: exact filenames sap1-plan.svg/sap1-section.svg (users may have workflows around them), the image/svg+xml mime, the lastResult guard, and leave the shared download() helper untouched — its other callers (csv, scenario export, doctrine export, pop-up-blocked job-sheet fallback) are single-download-per-gesture and unaffected. Do NOT use a setTimeout stagger (Chrome's policy counts downloads per gesture, not per tick) and do not add a zip dependency. Alternative if one-click-both-files is required: emit a single combined sap1-drawings.svg with plan and section stacked via nested <svg> elements — more code and changes the deliverable format, so the two-menu-item split is preferred.

#### 129. Schedule '% on the tools' silently resets to a hardcoded 75 on empty or 0 input, unlike its sibling fields

`src/ui/main.ts:485` · **LOW** · ux · effort: trivial

**Problem.** schedule-run coerces team and hours with `|| schedTeam` / `|| schedHours` (fall back to the previous value), but posture uses `(parseInt(p.value, 10) || 75) / 100` — a hardcoded 75. Failure scenario: user set posture to 50%, later clears the field (or types 0) and clicks 'Build the timeline' — the schedule is silently computed at 75% on the tools instead of their previous 50%, changing the feasibility verdict ('Ready with X hr to spare') without any indication the input was replaced.

```
schedTeam = t ? Math.max(1, parseInt(t.value, 10) || schedTeam) : schedTeam;
schedHours = h ? Math.max(1, parseInt(h.value, 10) || schedHours) : schedHours;
schedPosture = p ? Math.min(1, Math.max(0.1, (parseInt(p.value, 10) || 75) / 100)) : schedPosture;
```

**Fix.** One-line edit in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/main.ts line 485: change `(parseInt(p.value, 10) || 75)` to `(parseInt(p.value, 10) || Math.round(schedPosture * 100))`, keeping the existing `Math.min(1, Math.max(0.1, ...))` clamp. Edge cases the fix preserves: (1) first-use behavior is unchanged because schedPosture initializes to 0.75, so the fallback is still 75 by default; (2) empty/NaN/0 input now falls back to the previous value, exactly matching sibling behavior at lines 483-484 (where 0 is also falsy and falls back); (3) the clamp still bounds the result to 0.1..1 so out-of-range typed values (e.g. 500) remain capped. Math.round guards against float fuzz in schedPosture*100. No test currently pins this; optionally add a case to the existing test suite, but the change is a trivial consistency fix.

#### 130. props.html lacks a viewport meta tag

`src/ui/props.html:7` · **LOW** · ui · effort: trivial

**Problem.** props.html (dev-only prop gallery) declares charset but no <meta name="viewport">, unlike the three shipped pages. Opening the gallery on a phone/tablet during asset review renders at the legacy 980px virtual viewport — the canvas sizing logic in props-gallery.ts (window.innerWidth-based fitViewport) then produces a zoomed-out, mis-scaled turntable. Dev-only, so severity is polish. Its header comment ('vite only builds index.html') is also stale now that vite.config.ts builds three pages.

```
<meta charset="utf-8" />
<title>SAP-1 prop gallery (dev only)</title>   // props.html:7-8 — no viewport meta
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/props.html: (1) insert `<meta name="viewport" content="width=device-width, initial-scale=1" />` in the head immediately after the charset meta (line 7), matching hub.html/woodframe.html exactly (index.html additionally uses viewport-fit=cover, which a dev gallery does not need); (2) rewrite the line 2 comment from "vite only builds index.html" to state that props.html is not listed in vite.config.ts rollupOptions.input, e.g. "NOT part of any vite build input — dev-server only". Edge cases to preserve: do NOT add props.html to the build inputs (it must stay out of dist/ so the offline gate and standalone inliner never see it), and leave the existing body { margin: 0 } / canvas display:block styling and the fitViewport 40px bar offset in props-gallery.ts untouched. No test needed — static markup only.

#### 131. 3D model rotation has no keyboard control

`src/ui/three-viewer.ts:850` · **LOW** · a11y · effort: trivial

**Problem.** OrbitControls is created without listenToKeyEvents()/keyboard wiring, so orbit/zoom in the main app's 3D card is pointer-only; a keyboard user can reach the stage slider, Cutaway, and Reset-view buttons but can never rotate the model to see the rear/interior. Rated low because equivalent information exists in accessible form (plan/section SVGs with title/desc, specs panel), but the advertised 'drag to turn it around' interaction is unavailable to keyboard users (WCAG 2.1.1).

```
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
/* no controls.listenToKeyEvents(...) or keydown handler on the canvas */
```

**Fix.** Single file: src/ui/three-viewer.ts, inside createThreeViewer(). Use OrbitControls' built-in keyboard support instead of a custom keydown handler — three 0.185's _handleKeyDown already does arrows=pan, Shift/Ctrl/Meta+arrows=rotate, and calls event.preventDefault() so a focused canvas won't scroll the page. Three small edits: (1) after line 821, make the canvas focusable: `canvas.tabIndex = 0;` and extend the aria-label to mention keys, e.g. 'Interactive 3D model of the position — drag or arrow keys to pan, Shift+arrows to rotate, scroll to zoom'. (2) after the controls config block (~line 855), add `controls.listenToKeyEvents(renderer.domElement);`. (3) no dispose work needed — dispose() at line 1179 already calls controls.dispose(), which runs disconnect() → stopListenToKeyEvents(), so the listener is cleaned up. Edge cases to preserve: attach the listener to the canvas, NOT window (window would hijack arrow-key page scrolling app-wide and conflict with the stage slider's arrow keys — a focused range input must keep its arrows, which it does since keydown targets the slider, not the canvas); keep the touchAction='pan-y' overrides at lines 830/859 untouched (listenToKeyEvents does not touch touchAction); the global :focus-visible outline in styles.css line 31 already gives the canvas a visible focus ring, so no CSS needed. Optionally set `controls.keyRotateSpeed` (default 1.0 is slow on a large canvas; ~3-5 feels right) — verify by tabbing to the canvas in the dev server and pressing Shift+ArrowLeft. Same gap exists in src/ui/woodframe-scene.ts if it also creates OrbitControls; apply the identical 2-line fix there if so.

#### 132. Each of the five GLB props fires its own full scene rebuild on load — up to 5 uncoalesced boot rebuilds in both viewers

`src/ui/three-viewer.ts:74` · **LOW** · perf · effort: trivial

**Problem.** loadProp's onLoad callback runs `for (const cb of rerenderCallbacks) cb();` once PER ASSET, and five assets load independently (sandbag, picket, 3 lumber sizes). Each callback is a full-scene rebuild: the SAP-1 viewer's onAssetsReady (three-viewer.ts:1187-1190) calls api.update(lastResult, lastOpts) — complete partsGroup dispose+rebuild — and woodframe registers onPropAssetsReady(rebuild) (woodframe-scene.ts:295), where rebuild() disposes and recreates every one of the several hundred frame members (each a Group with fresh geometry plus 2-3 fresh materials). Since data-URI GLBs still resolve asynchronously and independently, boot performs the initial render plus up to five additional back-to-back full rebuilds within the first moments of page life. Failure scenario: on a mid-range phone the TIMBER-1 page visibly re-hitches several times right after first paint (hundreds of geometries/materials created and thrown away five times over), and the SAP-1 diorama does the same behind first interaction.

```
(gltf) => {
  const geo = extractFirstGeometry(gltf.scene);
  if (!geo) return;
  sharedGeometries.add(geo);
  assign(geo);
  for (const cb of rerenderCallbacks) cb();
},
```

**Fix.** Single-file fix in src/ui/three-viewer.ts, inside loadModelAssets() (~8 lines). Use a pending counter so the rerenderCallbacks dispatch fires exactly once, when all five loads have settled: declare `let pending = 0;` in loadModelAssets; in loadProp increment pending before loader.load; define `const settle = () => { if (--pending === 0) for (const cb of rerenderCallbacks) cb(); };` and call settle() at the end of the onLoad callback (after assign) AND in the onError callback (after the console.error), so a failed GLB never starves the dispatch — the procedural fallbacks still get swapped-in for whichever props did load. Edge cases to preserve: (a) error path must still trigger the single dispatch (settle in both onLoad and onError); (b) onLoad's early `if (!geo) return;` must not skip settle — restructure so settle() runs regardless (e.g. wrap the geometry work in the if, call settle() after); (c) callbacks registered AFTER the dispatch (viewer created later than asset resolution) need no notification because the geometries are already assigned when their first build runs — current behavior, unchanged; (d) onPropAssetsReady consumers (woodframe-scene.ts:295 and props-gallery) expect at least one fire once real props exist — one all-settled fire satisfies both. Chosen over rAF-debounce because the five fetch/parse resolutions can span multiple frames (rAF could still yield up to 5 rebuilds); all-settled counting is deterministic: exactly one rebuild per page. Since all five data-URI GLBs resolve near-simultaneously, delaying the swap until the slowest one is imperceptible. No test currently pins dispatch behavior; the three/WebGL module is not unit-tested in node, so verify by loading /woodframe.html and the main app and confirming a single post-boot rebuild (e.g. temporary console.count in rebuild/onAssetsReady during manual verification).

#### 133. TIMBER-1 bundle ships and parses the sandbag + picket GLBs it never renders (~103 KB dead base64, boot-time parse, memory pinned)

`src/ui/three-viewer.ts:86` · **LOW** · perf · effort: small

**Problem.** loadModelAssets() runs at module scope, referencing all five inlined GLB data URIs and parsing them through GLTFLoader the moment three-viewer.ts is imported. woodframe-scene.ts (line 8) imports only lumberPiece/plywoodSheet/onPropAssetsReady/disposeObject/toonGradient, but the module side effect drags every prop along: the built dist-woodframe/assets/woodframe-ASp4P6VZ.js (939,490 bytes) contains all 5 'data:model/gltf-binary;base64' URIs, of which sandbag.glb (61,780 B) and picket.glb (15,164 B) — ~103 KB as base64, ~11% of the bundle — are never used by any TIMBER-1 code path. GLTFLoader also parses both at boot and registers their geometries in sharedGeometries, where they are retained for the page lifetime. Rollup successfully tree-shook terrain/sky/post/scene3d out of this bundle (verified by grep: 0 hits for DioramaGradeShader/buildTerrain/EffectComposer), so the module-scope loadModelAssets() call is the sole reason the dead assets survive. Failure scenario: every TIMBER-1 page load over a slow field link downloads, base64-decodes, and GLB-parses two props that can never appear, and holds their vertex buffers in GPU/JS memory forever.

```
loadProp(sandbagGlbUrl, 'sandbag.glb', (g) => (sandbagGeometry = g));
loadProp(picketGlbUrl, 'picket.glb', (g) => (picketGeometry = g));
...
loadModelAssets();
```

**Fix.** Single file: src/ui/three-viewer.ts (plus rebuild verification). (1) Delete the module-scope loadModelAssets() call at line 86 and split the function into two idempotent lazy loaders reusing the existing loadProp helper: ensureLumberAssets() loading lumber_2x4/2x6/4x4, and ensureDioramaProps() loading sandbag+picket. Each sets its started-boolean BEFORE calling loader.load so concurrent callers cannot double-parse or double-register geometries in sharedGeometries (idempotence is the key correctness edge). (2) Call sites: lumberPiece() (line 633) calls ensureLumberAssets() first — this covers woodframe-scene with zero API change, and the existing procedural-fallback + rerenderCallbacks machinery (lines 42-46, 74, onPropAssetsReady at 1254) already handles the async gap, so the visual swap-in behavior is preserved identically, just shifted from import time to first use. createThreeViewer() (line 818) and buildPropShowcase() (line 1218) call both loaders, since the main app and props gallery render all five props. (3) Do NOT touch the five ?url imports or GLTFLoader import — once sandbagGlbUrl/picketGlbUrl are referenced only inside ensureDioramaProps (reachable solely from the two functions woodframe already tree-shakes), Rollup drops the bindings and Vite stops inlining those assets. (4) Edge cases to preserve: keep loads asynchronous (never invoke assign synchronously) so consumers that register onPropAssetsReady in the same synchronous script tick never miss the ready callback; keep the error-callback console fallback; main-app bundle must still contain all 5 URIs. (5) Verify: npm run build:woodframe, then grep dist-woodframe/assets/*.js for 'data:model/gltf-binary;base64' — expect exactly 3 occurrences (down from 5) and the bundle ~100 KB smaller (~836 KB); npm run build for the main app and confirm 5 occurrences remain; load /woodframe.html and /props.html to confirm Blender props still replace procedural placeholders.

#### 134. Terrain build retained (never disposed) after watchdog demotes the pipeline tier to 'low'

`src/ui/three-viewer.ts:1123` · **LOW** · perf · effort: trivial

**Problem.** When the frame-time watchdog demotes the pipeline to tier 'low' (loop(), lines 1053-1059), the next update() computes useTerrain=false and only hides the terrain group — terrainDispose is never called, terrainKey stays stale, and since setTier only ever demotes (never re-promotes), the last-built terrain is kept for the remainder of the session: a 1024x1024 ground CanvasTexture (~4 MB GPU), the extruded earth geometry, per-scene toon materials, and the tuft/rock InstancedMesh buffers. Failure scenario: a memory-constrained phone that triggered the demotion precisely because it is struggling permanently retains several MB of invisible GPU resources it can never use again (the low tier renders the flat role-'ground' parts instead).

```
if (useTerrain && model.terrain) {
  ...
  terrainGroup.visible = true;
} else {
  terrainGroup.visible = false;
}
```

**Fix.** In src/ui/three-viewer.ts, in update()'s terrain else branch (currently line 1122-1124), free the cached build only when the tier is 'low' (the irreversible case), preserving the content-key cache for the transient model.terrain===undefined case on healthy tiers:

```
} else {
  // Tier demotion is one-way (watchdog, loop()) — at 'low' the cached terrain can never be
  // shown again this session, so free its GPU resources instead of hiding several MB forever.
  if (terrainKey && pipeline.tier === 'low') {
    terrainKey = '';
    terrainDispose?.();
    terrainDispose = null;
    disposeObject(terrainGroup);
    terrainGroup.clear();
  }
  terrainGroup.visible = false;
}
```

Edge cases to preserve: (1) keep the existing dispose() teardown at lines 1172-1173 unchanged — terrainDispose?.() is null-safe so double-dispose is fine; (2) do NOT dispose when model.terrain is undefined but tier is medium/high — that hidden group is the intentional keystroke cache; (3) terrainKey must be reset to '' so any future rebuild path (defensive) rebuilds instead of reusing a disposed group; (4) the guard `if (terrainKey && ...)` keeps the branch a no-op when nothing was ever built (initial low-tier devices). No test harness exists for the WebGL viewer (would need a GL context), so no new test; the change mirrors the already-exercised dispose() pattern.

#### 135. devicePixelRatio changes never reach the renderer — canvas/composer resolution mismatch after moving between monitors

`src/ui/three-viewer.ts:1071` · **LOW** · ui · effort: trivial

**Problem.** renderer.setPixelRatio is called exactly once at viewer creation (line 836) with the DPR of the monitor the page opened on, but doResize() re-reads window.devicePixelRatio on every resize and passes it only to pipeline.setSize (which calls composer.setPixelRatio in post.ts applySize). Failure scenario: user opens the app on a 2x retina laptop, then drags the window to an external 1x monitor (or vice versa). The ResizeObserver fires, the composer's render targets are rebuilt at the NEW ratio while the canvas drawing buffer (sized by renderer.setSize using the stale internal _pixelRatio) stays at the OLD ratio — the OutputPass blit rescales the frame, producing a visibly soft/blurry (or wastefully supersampled) 3D view for the rest of the session. On the composer-less 'low' tier the canvas simply keeps the wrong sharpness. The tilt-shift strength divisor (TILT_STRENGTH / lastPr) is also computed from the mismatched ratio.

```
function doResize(): void {
  ...
  renderer.setSize(w, h, false);
  pipeline.setSize(w, h, Math.min(2, window.devicePixelRatio || 1));
// creation (line 836): renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
```

**Fix.** Single edit in /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/three-viewer.ts, doResize() (lines 1066-1075): hoist the clamped ratio into a local and feed it to both the renderer and the pipeline so they can never disagree:

  const pr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  pipeline.setSize(w, h, pr);

Order/edge cases to preserve: (1) call renderer.setPixelRatio BEFORE renderer.setSize — three's setPixelRatio internally re-runs setSize with old dimensions, so the explicit setSize(w, h, false) after it establishes the final buffer size; (2) keep updateStyle=false (the canvas is styled width/height 100% at creation, lines 823-824); (3) keep the min(2) clamp identical in both places — reuse the one local so a future clamp change can't reintroduce the skew; (4) leave line 836's creation-time setPixelRatio as-is (harmless initial value, doResize now corrects it). Optional (skip per ponytail — the minimal fix covers every path where rendering resolution is recomputed): a matchMedia('(resolution: Xdppx)') change listener calling doResize() would also catch the bare macOS monitor-drag case where the ResizeObserver never fires; without it that case stays stale-but-consistent (old sharpness, no blit mismatch), which is the pre-existing, less-bad behavior. No test needed — one-line-class cosmetic fix with no logic branching.

#### 136. Boot stage state is inconsistent: panel claims 'Stage 9' while no stage chip is active

`src/ui/woodframe-scene.ts:293` · **LOW** · ux · effort: trivial

**Problem.** Boot calls setStage(11), but the generators emit members only up to stage 9 (roof.ts stops at stage 9; no stage-10/11 members exist), and stage chips are only created for stages with members. So setStage(11) can highlight no chip, while renderStagePanel's fallback (cur = find(stage===11) ?? active[last]) shows 'Stage 9: Roof sheathing' with stage 9's cut list. Verified live: the page opens with the panel titled 'Stage 9: Roof sheathing' and its cut list shown, yet chips 1-9 all render unselected — and clicking chip 9 then changes the 3D highlight (stage-9 members tint) while the panel content stays identical, which reads as a broken control.

```
fitViewport();
VIEWS[2]![1](); // Iso SE default
setStage(11);
// chips: if (!BOM.stages.some((b) => b.stage === s.id)) continue; — no chip for 10/11
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/woodframe-scene.ts line 293, replace `setStage(11);` with `setStage(BOM.stages[BOM.stages.length - 1]!.stage);` — no cast needed, StageBom.stage is already typed StageId; the non-null assertion is safe because the hardcoded demo BUILDING always produces members. Optionally also change the initializer at line 126 (`let currentStage: StageId = 11;`) to the same expression for consistency, though setStage at boot overwrites it before first render. Edge cases to preserve: (1) boot will now tint stage-9 roof panels yellow (the `currentStage < 11` guard at line 157 no longer suppresses the highlight) — this is the desired consistency with clicking chip 9, but if the untinted 'finished frame' boot look must be kept, instead keep boot at 11 and fix renderStagePanel to show a 'Complete frame' summary title when no exact stage matches; the one-liner is the better fix. (2) The `__frame.setStage` debug hook still accepts any StageId including 11 — harmless, leave it. No scene tests exist to update.

#### 137. TIMBER-1 E/W layout-strip ruler uses the full wall width while marks are measured from the inset frame — every mark drawn 3/4 in off

`src/ui/woodframe-scene.ts:235` · **LOW** · bug · effort: trivial

**Problem.** renderStrips scales the E/W tape to runIn = BUILDING.widthFt * 12 with the 0 ft tick at the building corner, but layoutStrip returns atIn measured from the E/W wall frame origin, which walls.ts/elevation.ts place at z = T/2 (0.75 in inside the corner) with a run of widthFt - T. Every K/J/X/C mark on the East and West strips therefore renders 0.75 in short of its true position against the drawn foot ticks, and the tape claims 16'-0" of plate when the plate is 15'-10.5". The strip's stated purpose is 'the marks a carpenter would pencil on the plate' — a systematic 3/4 in transfer error on two of four walls. Independent of the reported E/W corner-inset bug: fixing the inset to 3.5 in makes this mismatch larger (1.75 in), not smaller, unless the renderer and frame agree on one origin.

```
const marks = layoutStrip(MODEL.members, wall, BUILDING.lengthFt, BUILDING.widthFt);
const runIn = (wall === 'S' || wall === 'N' ? BUILDING.lengthFt : BUILDING.widthFt) * 12;
```

**Fix.** In /Users/zacharytraphagen/FieldFortificationsCalculator/src/ui/woodframe-scene.ts renderStrips(), derive the tape run from the engine's own wall frame instead of the raw building dimension: add wallElevation to the existing import from '../timber/elevation' (it is already exported) and replace line 235 with `const runIn = wallElevation(MODEL.members, wall, BUILDING.lengthFt, BUILDING.widthFt, 0).runFt * 12;` (or, to avoid recomputing rects, change layoutStrip to return { runIn, marks } and update its one other caller in test/timber-frame.test.ts). Do NOT hardcode `widthFt*12 - 1.5`: the auditor correctly notes a sibling finding may change the E/W corner inset from T/2 to the full wall thickness, and sourcing runFt from the engine keeps ruler and marks agreeing on one origin automatically no matter how wallFrames changes. Edge cases to preserve: (1) N/S strips must be unchanged (their runFt = lengthFt, so the expression is identity there); (2) the tick loop `for (i = 0; i <= runIn; i += 12)` naturally drops the phantom 16' tick since 190.5 is not a multiple of 12 — the last tick becomes 15', which is correct because the plate ends at 15'-10 1/2"; (3) the plate rect width and mark positions already share the x=20 origin, so no other coordinates move. Add one assertion to the existing layout-strip test in /Users/zacharytraphagen/FieldFortificationsCalculator/test/timber-frame.test.ts: for wall 'E', every mark satisfies atIn <= widthFt*12 - 1.5 and the max mark sits ~0.75 in from that run end (the forced end stud), pinning the shared-origin contract.

#### 138. Standalone TIMBER-1 build ships a dead './hub.html' nav link (page not in vite.woodframe.config.ts inputs)

`src/ui/woodframe.html:45` · **LOW** · build · effort: trivial

**Problem.** woodframe.html's header contains a back-link to ./hub.html, but vite.woodframe.config.ts builds woodframe.html as its sole rollup input into dist-woodframe/ (verified: dist-woodframe/ contains only woodframe.html + assets/). The page's own comment says it is 'publishable on its own via npm run build:woodframe', so in that deployment the visible '⌂ Combat Engineer Toolkit' link 404s (or, behind a host with SPA fallback, lands on an unrelated page). Works only in the multi-page dist/ build and dev server.

```
<a href="./hub.html" style="margin-left:auto; ...">⌂ Combat Engineer Toolkit</a>  // woodframe.html:45
input: fileURLToPath(new URL('src/ui/woodframe.html', import.meta.url)),  // vite.woodframe.config.ts:21
```

**Fix.** Strip the hub link at build time in the standalone config only. In /Users/zacharytraphagen/FieldFortificationsCalculator/vite.woodframe.config.ts, add a tiny inline plugin to the plugins array: { name: 'strip-hub-link', transformIndexHtml(html) { return html.replace(/<a href="\.\/hub\.html"[^>]*>[^<]*<\/a>/, ''); } }. To make the match non-fragile against future style edits, optionally add id="hubLink" to the anchor in src/ui/woodframe.html:45 and match on that id instead. Edge cases to preserve: (a) the link must keep working in dev and in the multi-page dist/ build driven by vite.config.ts (do NOT edit woodframe.html itself to remove it); (b) do not add hub.html as a second input to the woodframe build — hub.html links to index.html and other tools, which would just push the 404 one level deeper; (c) keep stripVendorCitationUrls and the assetsInlineLimit offline posture unchanged. Verify with: npm run build:woodframe && ! grep -q 'hub.html' dist-woodframe/woodframe.html.

#### 139. Standalone dist-woodframe build ships a dead './hub.html' navigation link

`src/ui/woodframe.html:45` · **LOW** · build · effort: trivial

**Problem.** woodframe.html's header links to ./hub.html, but vite.woodframe.config.ts builds only the woodframe.html input into dist-woodframe/ (its stated purpose: 'publishable on its own'). Verified by running npm run build:woodframe against the current tree: dist-woodframe/ contains only woodframe.html + assets/, yet grep shows href="./hub.html" survives in the built page. Anyone deploying dist-woodframe (the documented standalone TIMBER-1 publish path) ships a home link that 404s — and behind scripts/serve.js the extensionless /hub fallback would serve the wrong page entirely. The link is only valid in the multi-page dist/ build.

```
<a href="./hub.html" style="margin-left:auto; font-size:12px; color:#6b6250">⌂ Combat Engineer Toolkit</a>
(dist-woodframe/ after build: assets/, woodframe.html — no hub.html; grep: href="./hub.html")
```

**Fix.** Edit only /Users/zacharytraphagen/FieldFortificationsCalculator/vite.woodframe.config.ts: add a tiny inline plugin to the plugins array that strips the hub anchor at build time, e.g. { name: 'strip-hub-link', transformIndexHtml: (html) => html.replace(/<a href="\.\/hub\.html"[^>]*>[\s\S]*?<\/a>\s*/, '') }. Anchor the regex on the href attribute (not the label text) so the link label can change without silently breaking the strip. Do NOT touch src/ui/woodframe.html or vite.config.ts — the multi-page dist/ build must keep the working hub link. Do NOT add hub.html to the standalone inputs (contradicts the build's stated 'independent of the main app build' purpose and would drag in index.html). Removal of the anchor is layout-safe: its margin-left:auto only positions itself. Verify with: npm run build:woodframe && ! grep -q 'hub.html' dist-woodframe/woodframe.html, and npm run build && grep -q 'hub' dist/woodframe.html to confirm the main build still links.

#### 140. dist-woodframe artifact ships a dead ./hub.html back-link

`src/ui/woodframe.html:45` · **LOW** · build · effort: trivial

**Problem.** vite.woodframe.config.ts declares dist-woodframe/ 'publishable to its own webpage, completely independent of the main app build' with publicDir:false and a single woodframe.html input. The built dist-woodframe/woodframe.html contains only woodframe.html + assets/woodframe-ASp4P6VZ.js, yet the page header links to ./hub.html, which is not in that artifact. Failure scenario: dist-woodframe/ is deployed standalone as the config intends; a user clicks the '⌂ Combat Engineer Toolkit' header link and gets a 404. (The link works only in the multi-page dist/ build, where hub.html coexists.) Verified by grepping the freshly built dist-woodframe/woodframe.html: href="./hub.html" present, hub.html absent from the directory listing.

```
<a href="./hub.html" style="margin-left:auto; font-size:12px; color:#6b6250">⌂ Combat Engineer Toolkit</a>
<!-- dist-woodframe/ contains only: woodframe.html, assets/woodframe-ASp4P6VZ.js -->
```

**Fix.** Build-time strip, not a runtime probe (a fetch-HEAD check would violate the artifact's declared zero-external-requests/file:// posture and adds runtime code for a static fact). In /Users/zacharytraphagen/FieldFortificationsCalculator/vite.woodframe.config.ts, add a tiny inline plugin to the plugins array: { name: 'strip-hub-link', transformIndexHtml: (html) => html.replace(/<a href="\.\/hub\.html"[^]*?<\/a>/, '') }. Edge cases to preserve: (1) the link must remain in the main multi-page build (vite.config.ts) and in dev serving — transformIndexHtml in this config only runs for `npm run build:woodframe`, so both are untouched; (2) keep the existing stripVendorCitationUrls plugin; (3) the regex anchors on the href, not the styling, so cosmetic edits to the anchor don't break the strip — but if the href ever changes, the strip silently no-ops, so verify with `npm run build:woodframe && grep -c hub.html dist-woodframe/woodframe.html` expecting 0 (add this as a one-line assertion in the build script or a test if the repo's conventions demand it; otherwise the grep check in the PR description suffices per ponytail).

#### 141. hub.html and woodframe.html duplicate a hardcoded light palette with no dark-mode handling, diverging from index.html's color-scheme support

`src/ui/woodframe.html:14` · **LOW** · ui · effort: small

**Problem.** index.html declares <meta name="color-scheme" content="light dark"> and the SAP-1 app has a theme system (data-theme), but hub.html and woodframe.html each embed their own inline copy of the same palette (#f4f2ec / #fbf9f4 / #c9c0ad / #2b2419) with no color-scheme meta or prefers-color-scheme query. A user running SAP-1 in its dark theme (or OS dark mode) who navigates to the hub or TIMBER-1 gets a full-brightness white page, and the palette now lives in three places (hub.html:12-26, woodframe.html:12-39, plus the SAP-1 stylesheet) so any future color tweak will drift between pages.

```
body { margin: 0; background: #f4f2ec; ... color: #2b2419; }   // hub.html:12
body { margin: 0; background: #f4f2ec; ... color: #2b2419; }   // woodframe.html:14
<meta name="color-scheme" content="light dark" />              // index.html:6 only
```

**Fix.** Keep styles inline per page (do NOT extract a shared CSS file — both standalone builds depend on self-contained pages: vite.woodframe.config.ts builds woodframe.html alone with all assets inlined, and scripts/build-standalone.ts regex-inlines only index.html's stylesheet links). Per page: (1) In src/ui/hub.html and src/ui/woodframe.html, hoist the repeated hexes into a :root custom-property block (--bg:#f4f2ec; --surface:#fbf9f4; --border:#c9c0ad; --ink:#2b2419; --ink-soft:#6b6250; --line:#ddd6c8; --row:#eee7d8) with `color-scheme: light`, replace the hardcoded hexes with var() refs, and add a `@media (prefers-color-scheme: dark)` override setting `color-scheme: dark` plus a neutral dark set (e.g. --bg:#1c1813; --surface:#26211a; --border:#4b4436; --ink:#e9e4d8; --ink-soft:#a89d87). Do not copy SAP-1's night tokens verbatim — that is a red/amber light-discipline theme, not a generic dark mode. (2) In src/ui/woodframe-scene.ts line 61, pick scene.background from matchMedia('(prefers-color-scheme: dark)') (light 0xf4f2ec / dark 0x1c1813) or read the computed --bg; also change the hardcoded #2b2419 strokes/fills in the plate-strip SVG at lines 247-248 to currentColor or var(--ink) so strips stay legible on dark. (3) Optional (note as ponytail ceiling if skipped): a 2-line inline script reading localStorage['sap1.theme'] (key defined at src/theme/theme.ts:6, values 'day'|'night') to honor a user who manually toggled SAP-1 to night while their OS is light — media query alone misses that case. Edge cases to preserve: pages must remain zero-external-request and work from file:// (inline everything); hub hover/badge colors (#7a1f1a badge, rgba shadows) need dark-legible equivalents or can stay as-is; props.html/props-gallery.ts is a dev-only gallery and can be left out of scope.

#### 142. typecheck skips vite.standalone.config.ts and vite.woodframe.config.ts

`tsconfig.json:24` · **LOW** · build · effort: trivial

**Problem.** tsconfig `include` lists only `vite.config.ts` among the root configs; the two new build configs (both untracked WIP) are excluded from `npm run typecheck` and therefore from `npm run verify`. Vite transpiles config files with esbuild without type checking, so a type error or typoed build option in either config (exactly the class of mistake excess-property checking catches, e.g. `assetInlineLimit`) passes verify and only surfaces — or silently misbuilds — at `vite build` time.

```
"include": ["src", "test", "scripts", "vite.config.ts"]
```

**Fix.** One-line edit in /Users/zacharytraphagen/FieldFortificationsCalculator/tsconfig.json line 24: change "include" to ["src", "test", "scripts", "vite.config.ts", "vite.standalone.config.ts", "vite.woodframe.config.ts"] — or equivalently the glob "vite*.config.ts", which matches all three (verified glob semantics: * matches zero chars, so vite.config.ts is covered). Edge cases: (1) both new configs import { stripVendorCitationUrls } from './vite.config' — that export must stay exported (it is); (2) verified `npx tsc --noEmit` passes with both files included as of today, so the change cannot break `npm run verify`; (3) if further vite.*.config.ts files are added later, the glob form future-proofs, so prefer "include": ["src", "test", "scripts", "vite*.config.ts"]. No other tsconfig changes needed (types already includes "node").

#### 143. dist-woodframe artifact has no index.html — publishing it serves 404 at the site root

`vite.woodframe.config.ts:21` · **LOW** · build · effort: trivial

**Problem.** The TIMBER-1 standalone build keeps its entry named woodframe.html (rollup input src/ui/woodframe.html, root src/ui), so dist-woodframe/ contains woodframe.html + assets/ and no index.html. The config's own contract says the folder is 'publishable to its own webpage', but every default static host (Replit static deploy, GitHub Pages, nginx, the repo's own scripts/serve.js pointed at it) serves index.html at '/': a visitor to the published root gets 404/empty-listing and must know to type /woodframe.html. Distinct from the already-reported dead hub-link and offline-gate findings — this makes the artifact's front door itself unreachable.

```
// Run: npm run build:woodframe  →  dist-woodframe/woodframe.html
...
rollupOptions: {
  input: fileURLToPath(new URL('src/ui/woodframe.html', import.meta.url)),
}
```

**Fix.** Edit /Users/zacharytraphagen/FieldFortificationsCalculator/vite.woodframe.config.ts only (do NOT touch vite.config.ts — the main build must keep emitting dist/woodframe.html because hub.html links to it). Add a tiny inline plugin to the plugins array that renames the emitted page after the bundle closes: import { rename } from 'node:fs/promises', then plugins: [stripVendorCitationUrls(), { name: 'woodframe-as-index', closeBundle: () => rename(fileURLToPath(new URL('dist-woodframe/woodframe.html', import.meta.url)), fileURLToPath(new URL('dist-woodframe/index.html', import.meta.url))) }]. (Use copyFile instead of rename if /woodframe.html deep links should keep working; rename is fine since the artifact has never been published.) Edge cases the fix must preserve: (1) base: './' keeps asset refs relative (./assets/...), so a same-directory rename stays valid — no href rewriting needed; (2) do not use an input alias { index: ... } — Vite ignores alias keys for HTML entry output names; (3) emptyOutDir: true already prevents a stale woodframe.html surviving future builds; (4) update the config's line-8 comment ("Run: npm run build:woodframe → dist-woodframe/woodframe.html") and the header comment in src/ui/woodframe.html to say index.html. Verify with: npm run build:woodframe && ls dist-woodframe (expect index.html + assets/).

---

## Judgment calls (plausible — verify reachability first)

#### 144. 3D model hardcodes parapet height (1.1/1.2 ft) instead of consuming geometry.section.parapetH — contradicts the 2D section, the dims table, and the sandbag count

`src/render3d/scene3d.ts:296` · **MEDIUM** · ui · effort: ?

**Problem.** buildGeometry exports section.parapetH (doctrine parapet.H = 0.5 ft, protection.ts:169, user-fillable via doctrine import), and drawSection draws the parapet at that true height with a dimension label. buildScene3D never reads parapetH: pushRing is called with a literal height 1.1 (line 296) and the circular parapet ring uses literal 1.2 (line 202). The bag count in the BOM is computed from parapetRing volume using parapetH=0.5 ft (~2 courses at 0.33 ft/course), but the 3D view tiles bagWallLayout over a 1.1 ft wall (~3 courses) — more than double the billed height. Failure scenario: a battalion cell fills the real doctrine parapet height (say 1.0 ft) — the 2D section, dims table and sandbag BOM all update, the 3D diorama stays frozen at 1.1 ft, violating this file's own stated contract ('Materials are honest, not decorative: what the BOM actually specifies is what you SEE').

```
// scene3d.ts:296  pushRing(parts, 0, 0, p.holeL, p.holeW, p.parapetW, 1.1, entranceGap);
// scene3d.ts:202  parts.push({ kind: 'ring', ..., outerR: rHole + p.parapetW, innerR: rHole, height: 1.2, role: 'parapet' });
// doctrine/protection.ts:169  H: P(0.5, { unit: 'ft', note: 'parapet height above grade (illustrative)' }),
// drawSection.ts:66  const paraFront = px(-(halfBay + s.parapetW), -s.parapetH);
```

#### 145. serve.js sends no anti-framing headers — public deployment is clickjackable onto one-tap destructive actions

`scripts/serve.js:62` · **LOW** · security · effort: ?

**Problem.** The only header ever written is Content-Type; there is no X-Frame-Options or Content-Security-Policy frame-ancestors (and frame-ancestors cannot be set via meta tag, so nothing in the built HTML compensates). The Replit deployment is publicly reachable, and the app exposes un-confirmed one-tap destructive actions ('reset' wipes inputs + undo history, 'mission-clear'/'compare-clear' wipe working sets — all confirmed in main.ts with no window.confirm). Failure scenario: an attacker page iframes https://<app>.replit.app, overlays it with decoy UI (or uses opacity:0), and a victim who has the planner's plan data in that origin's localStorage clicks what lands on Reset — their working session snapshot is silently overwritten with defaults on the next persistSession, with no recovery. X-Content-Type-Options: nosniff is also absent, though no attacker-controlled content exists on the origin, so framing is the concrete path.

```
res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] || 'application/octet-stream' });
res.end(body);
```

#### 146. Failure notices are 2.6-second toasts that most error paths never record anywhere

`src/ui/main.ts:94` · **MEDIUM** · ux · effort: ?

**Problem.** Nielsen: error recovery / visibility of status. Every failure surfaced via showToast() auto-dismisses after a fixed 2600 ms regardless of message length or severity, and the scenario-duplicate failure (main.ts:422), scenario-import save failure (main.ts:444), and doctrine JSON-parse failure (main.ts:456) never set store.lastError — unlike scenario-save (main.ts:406) which does. Failure scenario: storage quota is exhausted (e.g. Safari private mode), user taps Duplicate, looks at the keyboard for 3 seconds, the 'Duplicate FAILED — device storage unavailable.' toast is gone; the scenario list shows no copy, Diagnostics/Status reports 'Last error: none', and there is no way to find out what happened.

```
toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
...
.catch(() => showToast('Duplicate FAILED — device storage unavailable.'));
```

#### 147. Applied doctrine fill is irrevocable from the UI — clearFill() exists but is never wired to any control

`src/layout/tools.ts:210` · **MEDIUM** · ux · effort: ?

**Problem.** Nielsen: user control and freedom. The doctrine overlay offers Export / Import / Apply inline edits / SC-toggle, but no 'remove fill / revert to shipped placeholders' action. src/state/doctrineFill.ts:20 exports clearFill() and src/doctrine/io.ts:71 exports resetFillState(), yet the only callers outside those modules are tests (test/doctrine-io.test.ts). main.ts imports only saveFill/restoreFill (main.ts:31) and restoreFill re-applies the stored fill on every boot (main.ts:755). Failure scenario: an S-3 applies a doctrine file with a wrong-but-in-range value (the importer validates types/ranges, not correctness); every safety-relevant output is now computed from it, it survives reload and even the 'Reset — Clear everything and start fresh' button, and the only recovery is manually wiping site data in browser settings.

```
'<button type="button" class="btn" data-action="doctrine-export">Export doctrine file</button>' +
'<button type="button" class="btn" data-action="doctrine-import">Import doctrine file…</button>' +
'<button type="button" class="btn" data-action="doctrine-apply-edits">Apply inline edits</button>' +
'<button type="button" class="btn" data-action="doctrine-sc-toggle">' + ...
```

#### 148. Clearing a numeric field commits the range minimum instead of restoring the prior value

`src/ui/main.ts:292` · **MEDIUM** · ux · effort: ?

**Problem.** Nielsen: error prevention. coerce() maps an empty/unparseable number input to the field's min ('const fallback = ... min'), so select-all + delete + blur silently replaces the previous value with the minimum. Failure scenario: 'How many positions' is 25, the user clears the field to retype and gets interrupted (tap elsewhere fires change) — count commits as 1, and every BOM total, man-hour figure, and subsequent CSV/job-sheet export is now for 1 position. It is also internally inconsistent: the schedule and time-planner forms keep the previous value on empty input (main.ts:483 'parseInt(t.value, 10) || schedTeam', main.ts:504), while the main form destroys it.

```
const n = parseInt(el.value, 10);
const fallback = Number.isFinite(min) ? min : 0;
const v = Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
```

#### 149. Help drawer entries are keyed by jargon names that no longer match the visible control labels

`src/layout/help.ts:15` · **MEDIUM** · ux · effort: ?

**Problem.** Nielsen: consistency, recognition over recall. The menu promises 'Plain-language explanation of every input' (shell.ts:121), but help.ts defines terms by the old doctrinal names while the form shows renamed plain-language labels (controls.ts): 'Overhead cover' vs control 'Roof overhead' (controls.ts:108); 'Grenade sump(s)' vs 'Grenade catch-pit (sump)' (109); 'Firing step' vs 'Step to shoot from' (110); 'Camouflage / Machine assist' vs 'Use machinery to dig' (112); 'Positions / Team size' vs 'How many positions' / 'Crew size' (115-116); 'Units' vs 'Show measurements in' (117). Failure scenario: a user unsure what the 'Roof overhead' toggle does opens Help and scans the definition list for that label — no entry with that name exists, so they must already know the jargon Help was supposed to explain.

```
item('Overhead cover', 'Adds an earth-on-stringers roof ...') +
// controls.ts:108
toggleCtrl('overheadCover', 'Roof overhead', inputs.overheadCover, 'Adds a roof for protection from above.') +
```

#### 150. Status panel's advertised 'offline status' is a hardcoded constant, never a measurement

`src/layout/diagnostics.ts:16` · **MEDIUM** · ux · effort: ?

**Problem.** Nielsen: visibility of system status. The hamburger menu sells Diagnostics as 'App version, offline status, and how many practice values remain' (shell.ts:122), but Diagnostics.online is the literal constant false with diagnosticsText() always printing 'Network: offline by design' (diagnostics.ts:28,42). It never checks navigator.serviceWorker.controller or caches, so it cannot distinguish 'fully precached, safe to go off-grid' from 'SW registration failed / nothing cached'. Failure scenario: a user checks Status before leaving connectivity, reads the reassuring offline line, and in the field the app fails to load because the service worker never installed (a failure mode this app demonstrably has) — the one panel meant to report offline readiness was structurally incapable of warning them.

```
lastError: string | null;
online: false; // SAP-1 makes no network calls, ever
...
'Network: offline by design'
```

#### 151. Two menu items open overlays whose titles share no words with the menu label

`src/layout/shell.ts:110` · **LOW** · ux · effort: ?

**Problem.** Nielsen: consistency. Tapping 'Combine positions' opens a panel titled 'Group job list (Mission BOM)' (tools.ts:69,77); tapping 'Build schedule' opens 'Priorities of work (ready by stand-to)' (tools.ts:122,131) — zero vocabulary overlap in either pair, so the user can't confirm they landed where they intended. Same pattern on the export side: 'Print report' produces a document the toast and filename call a 'job sheet' (main.ts:719-720, 'sap1-job-sheet.html'). Failure scenario: a user asked to 'open the group job list' scans the menu and finds no such item; a user whose pop-up was blocked searches Downloads for 'report' and finds nothing.

```
menuItem('mission', 'Combine positions', 'Roll several positions into one materials list') +
// tools.ts:77
'<div class="tools"><h2>Group job list — ' + result.totalPositions + ' position(s)</h2>'
```

#### 152. Exported/printed document date is the UTC date, not the user's local date

`src/ui/main.ts:672` · **LOW** · data · effort: ?

**Problem.** meta() stamps the job sheet header and CSV metadata with new Date().toISOString().slice(0,10), which is the UTC calendar date. Failure scenario: a user in Honolulu (UTC-10) prints the job sheet at 19:00 on 1 July; the document is dated 2 July — a wrong as-of date on a work order that crews and logs will reference, off by a day for any evening use west of UTC (or early-morning use east of it).

```
return { scenario: store.getState().activeScenarioName ?? 'Unsaved setup', date: new Date().toISOString().slice(0, 10) };
```

#### 153. TIMBER-1 view chips never indicate which view is active

`src/ui/woodframe-scene.ts:272` · **LOW** · ui · effort: ?

**Problem.** Nielsen: visibility of system status / internal consistency. Stage chips toggle the '.on' class when selected (setStage, lines 219-221), but the seven view chips (Iso NE…Left) in the same toolbar never receive any active state — the click handler only moves the camera. Failure scenario: at boot the app is in 'Iso SE' (line 292) yet no View chip appears selected; after orbiting freely the user cannot tell which named view they diverged from, while the adjacent Stage group does show its selection, teaching a state-display convention the View group silently breaks.

```
const b = document.createElement('button');
b.className = 'chip';
b.textContent = name;
b.addEventListener('click', go);
```

#### 154. TIMBER-1 strip-mark selection of a member hidden by the stage filter gives no visible 3D result

`src/ui/woodframe-scene.ts:259` · **LOW** · ux · effort: ?

**Problem.** Nielsen: visibility of system status. Clicking a plate-layout mark sets selectedId, rebuilds, and smooth-scrolls to the top — but rebuild() skips every member with m.stage > currentStage (line 154), and the click handler never raises the stage. Failure scenario: the user is inspecting Stage 1 (footings), clicks a 'K' king-stud mark on the South strip; the page scrolls them up to a 3D scene in which nothing is highlighted (the stud isn't built at stage 1), and only the small member card hints anything happened — the tap looks like it selected nothing.

```
el.addEventListener('click', () => {
  selectedId = (el as SVGGElement).dataset.member ?? null;
  renderMemberCard();
  rebuild();
  window.scrollTo({ top: 0, behavior: 'smooth' });
```

#### 155. Overlay dialogs have no background scroll containment — scrolling past the end scrolls the page behind

`src/ui/styles.css:221` · **LOW** · ui · effort: ?

**Problem.** The only body scroll lock in the app is html.sheet-open (styles.css:19) for the mobile bottom sheet; opening #overlay locks nothing and .overlay-card has overflow:auto without overscroll-behavior, so scroll chaining reaches the document. Failure scenario: on a phone, the user opens the long Doctrine values overlay mid-way down the results page, flick-scrolls the fill table to its bottom, and continued scrolling silently scrolls the page behind the fixed backdrop; on closing the overlay they are dumped at a different scroll position than where they left off.

```
.overlay { position: fixed; inset: 0; z-index: 50; ... }
.overlay-card { ... max-height: 84vh; overflow: auto; padding: 18px 20px; }
```

