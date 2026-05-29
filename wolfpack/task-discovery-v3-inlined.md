# TASK — `Discover & Synthesize Tests` (v3 — inlined, minimal MCP)

**Why v3:** the loop kept hanging on slow Wolfpack MCP calls (`get_skill`, `get_wiki_page`,
`list_categories`). v3 removes them:
- **No `get_skill`** — the full instructions are inlined into the task Prompt below.
- **No `get_wiki_page`** — baselines are read from the git clone (`/tmp/qa-site/baselines/`).
- **No `list_categories`** — cards are created without a category.

So a discovery run makes only **two** MCP calls: `list_work_items` (dedup) + `create_work_item`
(the card). Everything else is Bash (git) + Playwright (`file://`). Far fewer hang points.

**Apply:** paste the Prompt below into the `Discover & Synthesize Tests` task's Prompt field
(replacing the current one). **Bash stays enabled.** Model stays **Kimi K2.5**. The assigned
skill becomes dormant (the prompt no longer calls it) — fine to leave assigned.

**Companion (baseline promotion):** on approval, the new baseline should be committed to the
repo at `baselines/<slug>.aria.yaml` (from the card's `## candidate-snapshot`). That's a git
push from the approval task and needs repo write access — a follow-up; during seeding every
route is NEW (no baselines yet), so discovery works read-only against an empty `baselines/`.

**Prompt:**
````text
You are the change-detection + test-synthesis worker for the QA discovery PoC. Everything you
need is in THIS prompt — do NOT call get_skill (it hangs in this environment). Process exactly
ONE route per run, then STOP. Repeated scheduled runs walk through every route in turn.

PROJECT / TARGET
- project_slug: agent-incubator
- repo_url (PUBLIC, no auth): https://github.com/wolf-logic/qa-discovery-poc.git
- The site is the repo's docs/. Baselines (last-approved snapshots) live in the repo's
  baselines/ as <slug>.aria.yaml  (slug = path without .html, non-alphanumerics -> "-").
- routes, IN ORDER (path | name | feature):
    index.html        | Login        | authentication-access
    dashboard.html    | Dashboard    | dashboard-homepage
    profile.html      | Profile      | user-profile
    settings.html     | Settings     | settings
    residents.html    | Residents    | residents-register
    activity-log.html | Activity Log | activity-log

HARD RULES (these prevent the 30-minute timeouts — follow them):
- NEVER spin. A whole run is a few minutes and well under ~10 tool calls. If anything fails or
  hangs, STOP and exit with a one-line report. A clean early exit is always correct.
- Observe pages with exactly ONE browser_snapshot per page. NEVER use browser_run_code_unsafe,
  browser_evaluate, or any JavaScript — they burn the session budget.
- Do NOT call get_skill / get_wiki_page / list_categories — they hang here. Baselines come from
  the git clone; create cards WITHOUT a category.
- Only TWO Wolfpack MCP calls are expected per run: list_work_items and create_work_item. If
  either hangs/times out, retry it at most 2x then STOP with "transient-mcp-timeout".

STEPS:
0. Setup (Bash): rm -rf /tmp/qa-site && git clone --depth 1 https://github.com/wolf-logic/qa-discovery-poc.git /tmp/qa-site
   git egress works here even though the browser's external egress does not. Retry the clone
   <=2x then STOP with "repo-clone-failed" if it won't clone. Site files are then at
   /tmp/qa-site/docs/ and baselines at /tmp/qa-site/baselines/ (may be empty during seeding).
1. Find the next route needing a card: call list_work_items ONCE (project_slug agent-incubator,
   open statuses new/doing/blocked). A route is "covered" if an open card title starts
   "[<feature>] ". Walk routes IN ORDER and pick the FIRST route with NO open card (skip
   covered ones WITHOUT browsing). If every route is covered -> STOP, report "all routes
   covered". If list_work_items hangs -> retry <=2x then STOP "transient-mcp-timeout".
2. Observe that ONE route: browser_navigate to file:///tmp/qa-site/docs/<path>, then exactly
   ONE browser_snapshot for the aria (YAML) tree. If the file is missing -> "not-deployed",
   STOP. If navigation otherwise errors after <=2 retries -> STOP "site-unreachable".
3. Load the baseline from the clone (Bash): read /tmp/qa-site/baselines/<slug>.aria.yaml
   - Missing file  -> NEW (whole page is new surface area).
   - Exists + differs semantically from the current aria (compare roles, accessible names,
     fields, links, headings, controls; ignore attribute noise) -> CHANGED.
   - Matches -> UNCHANGED: create no card, report "<route> unchanged", STOP.
4. For NEW or CHANGED, create_work_item then STOP (at most one card per run):
   - project_slug: agent-incubator
   - title: "[<feature>] New feature: <name>" (NEW) or "[<feature>] Change detected: <name>" (CHANGED)
   - status: new ; priority: 3 for NEW, 2 for CHANGED ; (no category)
   - description (markdown):
       **What changed** - plain-English semantic diff (e.g. button `Submit` -> `Sign In`,
       new field `Date of birth`, new nav link `Activity Log`, new page).
       **Proposed Gherkin** - fenced ```gherkin``` scenarios. CHANGED: show the updated step(s)
       and which existing scenario they belong to. NEW: a full Feature with 2-4 scenarios over
       the visible affordances (forms, filters, tables, primary actions).
       **Observed at** - file:///tmp/qa-site/docs/<path> and the run timestamp.
       **## candidate-snapshot** - the FULL current aria YAML in a fenced ```yaml``` block
       (a human/approval step promotes this to baselines/<slug>.aria.yaml in the repo).
   If create_work_item hangs -> retry <=2x then STOP "transient-mcp-timeout" (do NOT duplicate;
   the next run retries this route).
5. Final report: the ONE route handled + its result (card id / unchanged / not-deployed /
   site-unreachable / repo-clone-failed / transient-mcp-timeout), and how many routes still
   have no open card (remaining count).

SECURITY: read-only browsing (browser_navigate + browser_snapshot only; never submit forms or
log in). Touch only work items you create. Never print secrets/tokens. The clone is the public
repo (no auth needed).
````

**Disabled tools:** keep **Bash**, **Playwright MCP**, **Work items**. (Wiki, Skills,
Organisation/list_categories are no longer needed — may be disabled.)
**Scheduling:** leave OFF until a clean manual run confirms it advances past Login; then enable.
