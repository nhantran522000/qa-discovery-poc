# v2 change-set — ground truth for grading detection

This is the **known** set of changes between the baseline (v1) and v2. The discovery agent
should detect exactly these — no more, no fewer. Use it to score precision/recall.

| # | Page | Change | Type | Expected detection |
|---|------|--------|------|--------------------|
| 1 | `index.html` (Login) | Button label `Submit` → `Sign In` | Label change | **Update** the existing login scenario's button step |
| 2 | `dashboard.html` (Dashboard) | New nav link **Activity Log** | New element | **Flag** the new nav affordance; note it links to a new page |
| 3 | `profile.html` (Profile) | New read-only field **Date of birth** | New field | **Modify** the profile scenario to assert the new field |
| 4 | `activity-log.html` | Entirely new page (filter + activity table) | New feature | **New** work item + fresh scenarios for the activity log |
| — | `settings.html` (Settings) | *none* | Control | **No card** — proves no false positives |
| — | `residents.html` (Residents) | *none* | Control | **No card** — proves no false positives |

## Scoring

- **True positives:** changes 1–4 each produce a change/feature work item (or a scenario update).
- **False positives:** any card raised against `settings.html` or `residents.html`.
- **Idempotency:** re-running detection after v2 is the baseline must produce **0** new cards.

## Detection expectations in detail

1. **Login button** — the aria snapshot node `button "Submit"` becomes `button "Sign In"`.
   A pure rename of an interactive control: the scenario step `When I press "Submit"` should
   become `When I press "Sign In"`. Should NOT be reported as a brand-new button.
2. **Dashboard nav** — a new `link "Activity Log"` appears under the `navigation` landmark.
   New affordance on an existing page.
3. **Profile field** — a new `text "Date of birth"` label + read-only value node appears.
   Existing scenario gains a field assertion.
4. **Activity log page** — a route that did not exist in the v1 snapshot set. Entire page is
   new: heading, a filter `combobox`, and a `table` of entries.
