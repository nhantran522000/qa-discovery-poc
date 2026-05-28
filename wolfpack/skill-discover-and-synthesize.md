# SKILL — `discover-and-synthesize-tests`

Paste into: **Agent Incubator org → Create Skill**. Assign to the QA Agent (or the incubator
agent) via the agent's Skills tab. Project for all work items / wiki writes: **`agent-incubator`**.

**Name** (lowercase-hyphen): `discover-and-synthesize-tests`

**Description** (shown at session start — keep it a precise trigger):
```
Browse each page of a target web app, capture its accessibility (aria) snapshot, diff it
against the last-approved baseline stored in the wiki, and for any new or changed page draft
Gherkin scenarios and raise a work item. Read-only on the site; never edits the app. Use as
the scheduled change-detection + test-synthesis worker.
```

**Content** (full contract, loaded on demand):
````markdown
# discover-and-synthesize-tests

Observe a web app, detect what changed since the last approved snapshot, and propose the
test scenarios that the change implies. You create advisory work items only — a human
approves them before anything reaches the Test Scenario Library. Strictly read-only on the
target site.

## Inputs (the task prompt supplies these)
- base_url: root URL of the deployed app (e.g. the GitHub Pages URL).
- routes: list of { path, name, feature } to visit.
- project_slug: `agent-incubator` (where work items + wiki pages live).

## Conventions
- Baseline store: one wiki page per route at `qa-baselines/<slug>`, where `<slug>` is the
  path with `.html` removed and non-alphanumerics → `-` (e.g. `activity-log.html` → `activity-log`,
  `index.html` → `index`). The page body is the route's last-APPROVED aria snapshot inside a
  ```` ```yaml ```` block.
- Card title (idempotency key): `[<feature>] <change-kind>: <route name>` where change-kind is
  `New feature` or `Change detected`.
- Library target (written later, by the approval task — NOT here): `test-scenario-library/<feature>`.

## Behaviour
For each route in `routes`:

1. Browse it: `browser_navigate` to `base_url + path`, then `browser_snapshot` to get the
   current aria (YAML) tree. This is the observation — do not click through or mutate anything.
2. Load the baseline: `get_wiki_page` for `qa-baselines/<slug>` in `project_slug`.
   - If MCP times out, retry up to 3× with 5/10/20s backoff. If it still fails, skip this
     route, note `transient-mcp-timeout` for it, and continue to the next route. Do NOT treat
     a timeout as "no baseline".
   - If the page genuinely does not exist (clean not-found, not a timeout) → this route is
     **NEW**.
3. Classify:
   - **NEW** (no baseline page): the whole page is new surface area.
   - **CHANGED** (baseline exists and differs semantically from the current aria): something
     was added/removed/renamed. Ignore cosmetic-only differences (pure attribute noise);
     focus on roles, accessible names, fields, links, headings, controls.
   - **UNCHANGED** (aria matches semantically): do nothing, create no card.
4. Dedup before creating: `list_work_items` (project_slug, search by the card title prefix
   `[<feature>] `). If an OPEN card (status `new`/`doing`/`blocked`) already covers this
   route, append a `create_work_item_comment` with the fresh diff instead of creating a
   duplicate, and move on.
5. For NEW or CHANGED with no open card, `create_work_item`:
   - project_slug: the input project_slug
   - title: `[<feature>] New feature: <name>` or `[<feature>] Change detected: <name>`
   - status: `new`
   - priority: 3 (High) for NEW, 2 (Medium) for CHANGED
   - description (markdown):
     - **What changed** — a plain-English semantic diff (e.g. "button `Submit` → `Sign In`",
       "new read-only field `Date of birth`", "new nav link `Activity Log`", "new page").
     - **Proposed Gherkin** — fenced ```gherkin``` scenarios. For a CHANGE, show the updated
       step(s) and which existing scenario they belong to. For NEW, draft a full Feature with
       2–4 scenarios covering the visible affordances (forms, filters, tables, primary actions).
     - **Observed at** — the `base_url + path` and the run timestamp.
     - **Candidate snapshot** — the FULL current aria YAML inside a fenced ```yaml``` block,
       under a heading `## candidate-snapshot`. The approval task promotes this to the baseline
       on approval, so it must be present and exact.
6. Never promote the baseline here. Baseline promotion happens only after a human approves
   (the approval task does it). This keeps the baseline meaning "last human-approved state".
7. Final report: routes visited, NEW count, CHANGED count, UNCHANGED count, cards created,
   cards commented, routes skipped for transient-mcp-timeout.

## Security rules
- Read-only on the target site. Never submit forms with real data, never attempt logins with
  guessed credentials, never edit or POST. `browser_navigate` + `browser_snapshot` + read-only
  `browser_*` inspection only.
- Touch only `qa-baselines/*` (read) and work items you create/own. Never edit
  `test-scenario-library/*` here — that is the approval task's job, post-human-approval.
- `blocked` is for substantive failures only (page won't load, malformed app). NEVER mark a
  card `blocked` for an MCP/network timeout — skip the route and let the next run retry.
- Never print secrets or tokens.
````

**Advanced:** Allowed Tools — leave empty (needs Playwright MCP, Wiki, Work items).
**Resources:** none.
