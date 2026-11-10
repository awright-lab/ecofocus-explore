# Keep rejected catalog metadata quarantined through retry

The first catalog-consistency candidate cleared its invalid flag when Retry began.
This let the Data explorer fall back to cached dataset metadata before a fresh page
arrived, after a failed retry, or for a selected ID missing from the fresh catalog.

Retry now reopens network loading without clearing the invalid flag. The first
accepted fresh page clears it; failed requests leave it set. Remote field details
and field-specific actions use fetched catalog fields exclusively, including normal
initial loading. Cached dataset metadata remains unchanged and is still used for
local studies. Generic analysis creation remains available without passing a stale
remote field. Existing analyses are unchanged.

A real DataExplorer component regression covers initial loading, detected conflict,
pending retry, failed retry and fresh replacement lacking the old selection. Existing
arrival-order, late-response and independent-error regressions remain in the suite.
No server revision token is added; goal7 remains partial and native/live acceptance
remains open. No publication, deployment or persistent data changes are included.
