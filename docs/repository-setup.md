# Repository setup

Repository: https://github.com/matbforge/nsac26-dancing-with-the-sars
Private; admin/push/maintain visible to the connected account. Initial branches list was [].
`gh auth status`: not logged in; publication therefore uses the authorized GitHub connector.
Bootstrap commit: `30f0c7c0cd45c5b4952c432f10695d7bfbce14ba` (README only).
`main` and `develop` point to that baseline. All experimental implementation is on
`poc/backend-validation`, with a draft PR explicitly targeting develop. No merges.

GET /repos/matbforge/nsac26-dancing-with-the-sars/rulesets returned HTTP 403:
`Upgrade to GitHub Pro or make this repository public to enable this feature.`
Status for BOTH main and develop: **BLOCKED_BY_PLAN / UNAVAILABLE_PLAN_RESTRICTION**.
The files in .github/rulesets are **TEMPLATE_ONLY**, not active branch controls.
Repository visibility, billing and secrets were not changed.

Read-only reference GET /repos/univates-deadlock/techpro-app/rulesets/20772636 succeeded:
Main Protection active; no bypass; deletion/non-fast-forward blocked; linear history;
PR requires 1 approval, dismiss stale approvals, resolve conversations.
No settings in that reference repository were modified.

Templates require 1 approval for main; develop starts at 0 until another reviewer is
available. Both request squash-only PR integration. Required CI checks are intentionally
not fabricated: add the actual `backend-quality` check only after a real successful run,
then GET the ruleset and effective rules for each branch before calling them ACTIVE.
Current repository-level merge settings were left unchanged because the available connector
exposes no administration mutation for those settings. Use squash manually.

Manual workflow: review prototype PR + green CI; keep draft until real data review and
eligibility clearance. No CODEOWNERS added: ownership/reviewer assignment was not requested.
References: https://docs.github.com/en/rest/repos/rules and
https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
