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

## Observation method — CRITICAL, do this exactly
- Capture each page with **ONE** `browser_snapshot` call. It returns the aria (YAML) tree —
  the canonical, cheap observation, and all you need.
- **NEVER use `browser_run_code_unsafe`, `browser_evaluate`, or ANY JavaScript execution** to
  read or scrape the page. They are slow, burn the whole session budget, and have repeatedly
  caused 30-minute timeouts and £2+ runaway runs. `browser_snapshot` already gives you the
  full structure — JS adds nothing here.
- Do not re-navigate or re-snapshot a route. Budget ≈ 3–4 tool calls per route:
  `browser_navigate` → `browser_snapshot` → `get_wiki_page` → (optionally one
  `create_work_item` / `create_work_item_comment`). If you feel the urge to run JS in a loop,
  STOP — you already have the snapshot; move on to the diff.

## Inputs (the task prompt supplies these)
- repo_url: PUBLIC git repo whose `docs/` holds the site. Cloned locally (see Setup) so we
  browse via `file://` and avoid the container's flaky external browser egress (ERR_TUNNEL).
- base_url: the LOCAL base to browse — `file:///tmp/qa-site/docs/` (the task sets this).
- routes: list of { path, name, feature } to visit.
- project_slug: `agent-incubator` (where work items + wiki pages live).

## Conventions
- Baseline store: one wiki page per route at `qa-baselines/<slug>`, where `<slug>` is the
  path with `.html` removed and non-alphanumerics → `-` (e.g. `activity-log.html` → `activity-log`,
  `index.html` → `index`). The page body is the route's last-APPROVED aria snapshot inside a
  ```` ```yaml ```` block — **store the aria TREE ONLY, with no url/metadata header lines**.
  (Verified failure mode: if the stored snapshot includes a `# url:`/environment header, an
  unrelated environment difference makes every page look "changed". Compare aria bodies only.)
- Diffing rule: compare the aria TREE bodies semantically (roles, accessible names, fields,
  links, headings, controls). Ignore any comment/metadata lines and pure attribute noise.
- Card title (idempotency key): `[<feature>] <change-kind>: <route name>` where change-kind is
  `New feature` or `Change detected`.
- Library target (written later, by the approval task — NOT here): `test-scenario-library/<feature>`.

## Behaviour — ONE route per run (resumable)
Process exactly ONE route per run, then STOP. Repeated scheduled runs walk through every
route in turn, so a session never times out and a route that hits a timeout simply retries on
the next run instead of being skipped/lost.

**Hard bail-fast rule (prevents 30-minute timeouts): NEVER spin on failure.** A whole run is
only a handful of tool calls. If the target site is unreachable, or any step keeps failing,
STOP and exit immediately with a one-line report — do NOT keep retrying toward the session
time limit. A clean early exit is always correct; the next scheduled run retries. Total budget
per run: a few minutes and well under ~10 tool calls. If you find yourself past that, STOP.

0. **Local-site setup** (once per run — this is what avoids the container's flaky browser
   egress to the public site). With Bash:
   `rm -rf /tmp/qa-site && git clone --depth 1 <repo_url> /tmp/qa-site`
   The repo is PUBLIC — no auth, and `git` egress works in this container even though the
   browser's external egress does not. Retry the clone ≤2× then STOP with `repo-clone-failed`
   if it won't clone. The site is then at `/tmp/qa-site/docs/` and you browse it via the local
   `file://` scheme (`base_url` already points there) — local file access, no network, immune
   to `ERR_TUNNEL`. (Fallback ONLY if `file://` navigation is rejected:
   `cd /tmp/qa-site/docs && python3 -m http.server 8000 &` then use `http://127.0.0.1:8000/`.)
1. Find the next route that needs work. Call `list_work_items` ONCE (project_slug, open
   statuses `new`/`doing`/`blocked`) and note which routes already have a discovery card
   (title starts `[<feature>] `). Walk `routes` IN ORDER and pick the FIRST route that does
   NOT yet have an open card — routes that already have one are handled, so skip them WITHOUT
   browsing (this is what makes runs resumable + idempotent). If EVERY route already has an
   open card, STOP and report "all routes covered — nothing to do".
2. Observe that ONE route: `browser_navigate` to `base_url + path`, then exactly ONE
   `browser_snapshot` (no JS — see the Observation rules above).
   - You browse local `file://`, so there is no network/proxy to fail. If the page **file is
     missing** from the cloned `docs/` (route not present), treat it as `not-deployed` for that
     route, report it, and STOP (the next run retries).
   - If navigation otherwise errors and won't recover after ≤2 quick retries, **STOP the run
     immediately** with `site-unreachable: <error>` — never keep retrying toward the 30-minute
     cap, never `blocked` a card. **This is the rule that stops runs grinding to the timeout.**
3. Load its baseline: `get_wiki_page` for `qa-baselines/<slug>`.
   - On MCP timeout, retry 3× with 5/10/20s backoff. If it still times out, STOP and report
     `transient-mcp-timeout` for this route — do NOT skip it; the next run retries it.
   - Clean not-found → **NEW**. Exists and differs semantically → **CHANGED**. Matches → **UNCHANGED**.
4. Act, then STOP (at most one card per run):
   - **UNCHANGED** → create no card; report "<route> unchanged" and STOP (the next run takes
     the next uncovered route).
   - **NEW or CHANGED** → `create_work_item`, then STOP:
     - project_slug: the input project_slug
     - title: `[<feature>] New feature: <name>` or `[<feature>] Change detected: <name>`
     - status: `new`; priority: 3 (High) for NEW, 2 (Medium) for CHANGED
     - description (markdown):
       - **What changed** — plain-English semantic diff (e.g. "button `Submit` → `Sign In`",
         "new read-only field `Date of birth`", "new nav link `Activity Log`", "new page").
       - **Proposed Gherkin** — fenced ```gherkin``` scenarios. For a CHANGE, show the updated
         step(s) and which existing scenario they belong to. For NEW, draft a full Feature with
         2–4 scenarios covering the visible affordances (forms, filters, tables, primary actions).
       - **Observed at** — the `base_url + path` and the run timestamp.
       - **Candidate snapshot** — the FULL current aria YAML inside a fenced ```yaml``` block
         under a heading `## candidate-snapshot` (the approval task promotes this to the
         baseline, so it must be present and exact).
5. Never promote the baseline here — that happens only on human approval (the approval task),
   which keeps the baseline meaning "last human-approved state".
6. Final report: the ONE route you handled and its result (card id / "unchanged" /
   `transient-mcp-timeout` / `site-unreachable` / `not-deployed`), plus how many routes still
   have NO open card (the remaining count) so progress is visible across runs.

> Scale note: for a small known route list this one-per-run loop is enough. For hundreds of
> pages, shard by storing a cursor in a `qa-discovery/progress` wiki page and processing a
> bounded batch per run from the cursor; and seed the route list from a sitemap or a
> link-crawl frontier rather than a hardcoded list.

## Security rules
- Read-only on the target site. Never submit forms with real data, never attempt logins with
  guessed credentials, never edit or POST. Observe with `browser_navigate` + `browser_snapshot`
  ONLY — NEVER `browser_run_code_unsafe` or `browser_evaluate` (they burn the session budget
  and cause timeouts).
- Touch only `qa-baselines/*` (read) and work items you create/own. Never edit
  `test-scenario-library/*` here — that is the approval task's job, post-human-approval.
- `blocked` is for substantive failures only (page won't load, malformed app). NEVER mark a
  card `blocked` for an MCP/network timeout — skip the route and let the next run retry.
- Never print secrets or tokens.
````

**Advanced:** Allowed Tools — leave empty (needs Playwright MCP, Wiki, Work items).
**Resources:** none.
