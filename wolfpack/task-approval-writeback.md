# TASK — `Approve & Write-Back to Library`

Paste into: **Agent Incubator → (the incubator/QA agent) → New Task**.

This is the **human-approval → update Test Scenario Library** step. A human reviews a discovery
card and, if happy, moves it to **`ready`** (the approval signal). This task then writes the
approved scenarios into the library wiki and promotes the page's baseline snapshot.

**Name:** `Approve & Write-Back to Library`

**Prompt:**
```
You promote APPROVED test-discovery cards into the Test Scenario Library for the QA discovery
PoC. project_slug: agent-incubator. A card in status `ready` means a human approved it.

1. list_work_items (project_slug agent-incubator, status `ready`). If this times out, retry
   up to 3× with 5/10/20s backoff; if it still fails, exit reporting `transient-mcp-timeout`
   and touch nothing.
2. If none, stop and report "no approved cards".
3. For EACH `ready` card (oldest first):
   a. get_work_item to read its description. Parse three things from it:
      - the feature slug (from the title `[<feature>] ...`),
      - the proposed Gherkin block (```gherkin ... ```),
      - the `## candidate-snapshot` aria YAML block.
   b. Write the scenarios into the library: get_wiki_page `test-scenario-library/<feature>`.
      - If it exists: append the approved scenarios under a fenced marker
        `<!-- auto:discovery <card-id> -->` ... `<!-- /auto:discovery <card-id> -->`. If a
        marker for THIS card-id already exists, replace its contents (idempotent — never
        duplicate on re-run).
      - If it does not exist: create_wiki_page `test-scenario-library/<feature>` with a short
        intro + the marker block.
   c. Promote the baseline: update_wiki_page (or create) `qa-baselines/<slug>` with the
      card's `## candidate-snapshot` YAML as the new approved baseline, so future discovery
      runs diff against this approved state. `<slug>` = route path minus `.html`,
      non-alphanumerics → `-`.
   d. create_work_item_comment summarising what was written (library page + baseline page),
      then update_work_item status → `completed`.
4. Report: cards promoted, library pages written/updated, baselines promoted.

Constraints:
- Only act on `ready` cards. Never touch `new` / `doing` / `blocked` cards.
- Retry MCP timeouts (3× / 5-10-20s). Never mark a card `blocked` for an infra timeout — leave
  it in `ready` and let the next run retry.
- Idempotent: re-running must not duplicate library content (the per-card marker guarantees this).
```

**Scheduling:** off for the PoC (trigger manually after you move a card to `ready`). Enable →
hourly once proven.

**Disabled tools (recommended):** keep **Wiki**, **Work items**, **Skills**. Disable the
Playwright MCP (no browsing needed here), Agents, Discussions, Issues, Journal, Media, Memory,
Notifications, Procedures, Roadmap, Subscriptions, and built-in Edit / Write / Download.
