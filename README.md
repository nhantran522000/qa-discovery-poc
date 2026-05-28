# CareDocs QA — Change-Detection & Test-Synthesis PoC

A controlled proof-of-concept for the agentic QA loop:

```
observe a page → diff vs last-approved snapshot → synthesize Gherkin → work item
  → human approves → write-back to the Test Scenario Library + promote the baseline
```

It runs on the **Wolfpack platform** (Agent Incubator org, `agent-incubator` project) against a
**deployed sample site** (this repo, served by GitHub Pages). The sample site is a small,
accessible "Bramblewood Care" app with a *known* set of changes between two versions, so we can
score the agent's detection precision and recall instead of guessing.

> Why a sample site and not the real CareDocs first: the real app is noisy and the cost of a
> false positive is a human's time. Here the ground truth is fixed (`changeset-v2/CHANGES.md`),
> so we can prove the loop end-to-end and measure it before pointing it at production.

## Live site

- Baseline (v1): **<PAGES_URL>**
- Pages serves the `docs/` directory on the `main` branch.

## Layout

```
docs/                     # the sample site (GitHub Pages root)
  index.html              # Login            (v2: button "Submit" → "Sign In")
  dashboard.html          # Dashboard        (v2: + "Activity Log" nav link)
  profile.html            # Profile          (v2: + "Date of birth" field)
  settings.html           # Settings         (control — never changes)
  residents.html          # Residents        (control — never changes)
  styles.css  app.js
changeset-v2/             # the "product changed" injection
  docs/...                # v2 copies of the three changed pages + the new activity-log.html
  routes.v2.json          # route map including the new page
  apply-v2.sh             # copies v2 files into docs/ and bumps routes.json
  CHANGES.md              # GROUND TRUTH — what detection must find (and must not)
tooling/
  snapshot.mjs            # Playwright aria-snapshot + screenshot per route (local reference impl)
  package.json
snapshots/                # committed baselines for the local reference run (agent uses the wiki)
routes.json               # v1 route map
wolfpack/                 # paste-ready Wolfpack artifacts
  skill-discover-and-synthesize.md
  task-discovery.md
  task-approval-writeback.md
```

## Snapshot format (the design decision)

| Format | Role |
|---|---|
| **Playwright aria snapshot (YAML)** | **Canonical diff source.** Semantic (roles, names, fields, links) → robust to CSS churn, diffable, grep-able. The Wolfpack agent gets the identical format from the Playwright MCP `browser_snapshot`. |
| Screenshot (PNG) | Human-review artifact only. Pixel diffs are too noisy to drive detection. |
| Raw DOM/HTML | Rejected — class/hash churn drowns the signal. |

**Agent "memory":** the last *approved* aria snapshot, stored as a wiki page `qa-baselines/<route>`
in the `agent-incubator` project. Detection diffs the freshly-observed aria against it. The
baseline is promoted to the new state only when a human approves the change — so the baseline
always means "last approved state".

## The experiment protocol

### 0. Local sanity check (optional, no Wolfpack)
```bash
cd tooling && npm install && npx playwright install chromium
node snapshot.mjs --base-url <PAGES_URL> --routes ../routes.json --out ../snapshots
```
Captures v1 aria + screenshots locally so you can eyeball the canonical format.

### 1. Wolfpack baseline run
- Create the skill + two tasks from `wolfpack/` in the Agent Incubator UI; assign the skill to
  the agent. Set the discovery task's `base_url` to the Pages URL.
- Run **`Discover & Synthesize Tests`** once. On a clean board it will treat every page as NEW.
  Approve each card (move to `ready`) and run **`Approve & Write-Back to Library`** to seed
  `qa-baselines/*` + `test-scenario-library/*`. The board is now baselined.

### 2. Inject the change-set
```bash
bash changeset-v2/apply-v2.sh
git add -A && git commit -m "feat: v2 change-set" && git push
```
Wait for Pages to redeploy (~1 min).

### 3. Detection run
- Run **`Discover & Synthesize Tests`** again.

**Expected (graded against `changeset-v2/CHANGES.md`):**

| Page | Expected |
|---|---|
| Login | 1 card — `Change detected`: button `Submit` → `Sign In` (scenario step update) |
| Dashboard | 1 card — `Change detected`: new `Activity Log` nav link |
| Profile | 1 card — `Change detected`: new `Date of birth` field |
| Activity Log | 1 card — `New feature`: full feature + scenarios |
| Settings | **no card** (control) |
| Residents | **no card** (control) |

- **Precision** = correct cards ÷ total cards (false positive on a control = precision miss).
- **Recall** = changes detected ÷ 4.
- **Idempotency:** approve the 4 cards, write-back, then run discovery a third time with no
  further site changes → expect **0** new cards.

## Status

- [x] Sample site (v1) + v2 change-set + ground truth
- [x] Snapshot tooling (local reference impl)
- [x] Wolfpack skill + discovery task + approval/write-back task (paste-ready)
- [ ] Deployed to GitHub Pages — fill `<PAGES_URL>` above
- [ ] Wolfpack baseline run
- [ ] Detection run + precision/recall scored
