# Preserve newer focus during storage paging

Independent review found two focus edges in the storage inventory. A paging click queued a heading handoff that could override focus deliberately moved or blurred in the same React event batch. Replacing a long inventory with a short result could also leave focus on a connected but newly disabled pager button.

Paging now retains the originating button and checks that it still owns focus at commit. Blur clears that ownership. If a refreshed result disables the still-focused pager, focus moves to the updated range heading. Removed version links retain their existing handoff to search. Focus deliberately moved elsewhere or cleared is respected.

Six regressions cover same-batch paging plus outside focus or blur, shrinking results with owned/outside/blurred Next focus, and a focused Previous button when its page disappears. Four cases fail against the preceding implementation; two preservation cases already pass. Existing tests cover ordinary paging, link removal, save failures and measurement failures.

This is a focus-only correction. Inventory data, size accounting, filters, ordering, page size, stored-version verification, persistence and navigation are unchanged. Native browser and assistive-technology behavior remain unverified, including browser-specific blur when a focused button becomes disabled.
