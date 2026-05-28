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
  base_url: <PAGES_URL>
  project_slug: agent-incubator
  routes:
    - { path: index.html,        name: Login,        feature: authentication-access }
    - { path: dashboard.html,    name: Dashboard,    feature: dashboard-homepage }
    - { path: profile.html,      name: Profile,      feature: user-profile }
    - { path: settings.html,     name: Settings,     feature: settings }
    - { path: residents.html,    name: Residents,    feature: residents-register }
    - { path: activity-log.html, name: Activity Log, feature: activity-log }

Notes:
- The routes list above is the v2 set (includes activity-log.html). On the FIRST (baseline)
  run, activity-log.html will not yet be deployed — if a route 404s, record it as
  "not-deployed" and skip it; do not create a card for a route that does not load.
- Browse read-only: browser_navigate + browser_snapshot only. Never submit forms or log in.
- Create at most one card per route. Leave new cards in `new` for human review.
- If a category is required by create_work_item, call list_categories(agent-incubator) and
  pick the most testing-related one; if none fits, create the card without a category.

Report: routes visited, NEW / CHANGED / UNCHANGED counts, cards created, cards commented,
routes skipped (timeout or not-deployed).
```

**Scheduling:** off for the PoC runs (trigger manually: baseline run, then detection run after
the v2 change-set is deployed). Enable → daily once it's proven.

**Disabled tools (recommended):** keep the **Playwright MCP**, **Wiki**, **Work items**,
**Skills** (get_skill), **Organisation** (list_categories). Disable the rest.
