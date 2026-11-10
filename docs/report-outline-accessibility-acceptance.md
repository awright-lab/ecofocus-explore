# Report outline authoring — goal 16 candidate

## Verified problems and behavior

The page outline previously offered Hide/Lock for inactive-page objects even though those document commands address the active page only. The controls could silently do nothing. Inactive object mutations now remain disabled until the user opens that page or selects its object. The outline explains this next action. Active-page operations retain their existing document commands, saving and Undo/Redo.

The two authoring sidebars now declare their existing control-keyboard scope. Focus on their buttons must not cause window-level canvas Delete/Backspace, nudging, duplication or history shortcuts to edit report content. Native controls keep their own keys; explicit document Undo/Redo controls remain available. A real App control removes only this scope marker and reproduces Delete removing the selected canvas object; Undo restores it. This is a DOM control of the old event path, not a separate old application build.

The left sidebar landmark follows its current purpose: report outline, object layers, insert tools, brand styles or data controls. Report navigation exposes the current page, object-list expansion and valid expanded-list relationships. Multi-selection controls and object actions include object and page context; repeated names can be distinguished by object/page position. Selected object state is limited to the active page, including when unrelated pages reuse an object identity.

Search includes both display titles and internal analysis names and announces the number of matching pages. Rename fields identify their page and instructions, respect IME composition, and restore focus after save/cancel. If a renamed page leaves the search results, focus returns to the search input with the query intact.

## Verification and scope

Component tests cover disclosure relationships, current/selected state, duplicate-name/ID context, all selection-control names, inactive-action protection, navigation, active mutations, search/empty state, IME composition and rename focus return/fallback.

Actual App tests use two fabricated pages and a complete synthetic study. They exercise the real window keyboard handler, document commands, workspace writer/session, saved data, Undo/Redo and fresh App cold reopen. The corrected sidebar paths preserve exact original pages under Delete/nudge/duplicate keys, and normal editing changes only the intended page while retaining every source row/field. No document command or save callback is mocked. The preview and canvas use jsdom; browser geometry and accessibility-tree behavior are not established.

A separate reviewer-requested preparation recovery test correction waits for a prepared candidate from the exact expected source rather than any pending autosave. All existing candidate contents, source preservation, Retry and cold-load assertions remain. It is committed separately and does not establish the cause of an earlier intermittent failure.

Goal 16 remains **partial**. Native browser keyboard/touch, visual layout, focus scrolling, screen-reader announcements, full canvas/chart/report reading and cross-browser acceptance remain open. The prior denied socket was not retried. There is no publication, deployment, new persistence format or production data/security change.

## Follow-up: header, export and canvas controls; page action focus

Independent review confirmed the sidebar correction but reproduced the same window-key leak while Help/Undo, export-menu controls or Fit owned focus. The header, workspace-mode/Fit strip, tool rail and canvas control groups now declare control ownership too. Canvas object frames and their surrounding editing area remain outside those scopes. Native control activation is not prevented; explicit Undo/Redo controls continue to work. Canvas-owned nudge and history shortcuts remain operational outside controls. This does not certify every possible popover or external extension.

Page-menu deletion focuses a nearby surviving page button. The current-page footer action focuses the first remaining page, matching its existing document command. Both avoid BODY or the now-disabled final-page deletion button. Moving a page focuses that page's enabled navigation button after reordering, rather than leaving focus on a newly disabled Move up/down button. Existing search fallback is used when the destination is filtered out. Document mutation, ordering, selection and history commands are unchanged.

Seven additional actual App regressions cover Help, enabled Undo, export summary and every export-menu button, Fit, both page-deletion entry points and moving the second page to first. They use genuine focus and window keyboard events; no export or Help activation/download is performed merely to test focus ownership. A real canvas nudge first enables history, protected controls preserve the exact saved pages/study, and a body-owned history event reverses the nudge. Page operations verify enabled focus destinations, real saved state, Undo/Redo and cold reopen. Native browser/CSP, layout and assistive-technology acceptance remain unverified.

## Report navigator follow-up

The new **Browse report** entry provides a separate visual overview and complete filtered object browser. The outline itself now uses 12-page batches and 25-object batches for expanded lists; move/delete/rename focus recovery retains its existing destination even across page batches. Selection and editing callbacks, inactive-page mutation guards, document commands and Undo/Redo are unchanged. The navigator cannot mutate hidden/locked flags.

The earlier browser gaps above describe the prior outline work. For this follow-up, actual Chromium tests now cover the navigator's desktop and 390px layouts, native 200% browser zoom, scrolling to pagination, exact normal/hidden/locked selection, Escape/opener focus, keyboard containment and accessible control names. Synthetic source data, analytical results, geometry, report content and published snapshots remain unchanged after browsing. See the [record and screenshots](validation/report-navigator/README.md). These are browser automation and visual inspection, not actual screen-reader or touch testing, and do not close full-builder or cross-browser acceptance.
