# TASK — `Discover & Synthesize Tests`

Paste into: **Agent Incubator → (the incubator/QA agent) → New Task**.
Assign the `discover-and-synthesize-tests` skill to that agent first.

**Name:** `Discover & Synthesize Tests`

**Prompt:**
```
You are the change-detection + test-synthesis worker for the QA discovery PoC. Load and run
the `discover-and-synthesize-tests` skill (use get_skill; if it times out, retry up to 3×
with 5/10/20s backoff).

Target app (deployed sample site):
  base_url: https://nhantran522000.github.io/qa-discovery-poc/
  project_slug: agent-incubator
  routes:
    - { path: index.html,        name: Login,        feature: authentication-access }
    - { path: dashboard.html,    name: Dashboard,    feature: dashboard-homepage }
    - { path: profile.html,      name: Profile,      feature: user-profile }
    - { path: settings.html,     name: Settings,     feature: settings }
    - { path: residents.html,    name: Residents,    feature: residents-register }
    - { path: activity-log.html, name: Activity Log, feature: activity-log }

The skill processes ONE route per run (the first route that has no open card yet), then stops.
Repeated scheduled runs walk through every route until all are covered — so this task is meant
to run on a schedule, not once.

Notes:
- If a route 404s (e.g. activity-log.html before the v2 deploy), record it as "not-deployed"
  and STOP without a card; the next run retries it.
- Browse read-only: browser_navigate + browser_snapshot only. Never submit forms or log in.
- Leave new cards in `new` for human review.
- If a category is required by create_work_item, call list_categories(agent-incubator) and
  pick the most testing-related one; if none fits, create the card without a category.

Report: the ONE route you handled and its result (card id / "unchanged" / "not-deployed" /
"transient-mcp-timeout"), and how many routes still have no open card (remaining count).
```

**Model:** **Kimi K2.5** (OpenRouter), pinned via the task's *Alternative model* (scoped — does
not affect the shared agent default or the Caredocs tasks). Chosen 2026-05-29 for capability-
per-cost: score 59 at £0.57/£2.66, reasons + tool-calls reliably, ~£0.08/run. (GPT-4o-mini was
too weak — stalled; Haiku 4.5 is the proven fallback if Kimi misbehaves.)

**Scheduling:** **ON → every 10 minutes** (agent-level Schedule, *only* this task toggled on)
so it steps through all routes automatically until each has a card. Once every route is
covered the runs become no-ops ("all routes covered"), and the same loop then serves ongoing
change-detection. (Slow it to hourly/daily once seeded.)

**Ops findings (2026-05-29):**
- The dominant per-run latency is the `get_skill` MCP call (~2–4 min, intermittent) — every
  model sits near-idle at the start waiting on it. Biggest speed win would be inlining the
  skill body into this prompt to skip `get_skill` entirely.
- Weak models (GPT-4o-mini) botch the dedup step and create duplicate cards (saw a duplicate
  `[authentication-access] New feature: Login`). Capable models (Kimi, Sonnet) do the
  `list_work_items` dedup correctly. The dedup `list_work_items` call still lacks an explicit
  retry/timeout guard (only `get_skill`/`get_wiki_page` have one) — harden if dups recur.
- Intermittent container network errors reaching the live site (`ERR_TUNNEL_CONNECTION_FAILED`)
  — transient; the skill should treat an unreachable site like a not-deployed route and retry
  next run.

**Disabled tools (recommended):** keep the **Playwright MCP**, **Wiki**, **Work items**,
**Skills** (get_skill), **Organisation** (list_categories). Disable the rest.
