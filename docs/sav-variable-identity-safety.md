# SAV variable identity safety

The classic SAV parser now refuses an empty or repeated decoded primary variable name before building a study. Its integrity error also prevents the server import handler from falling back to another parser or accepting supplied browser metadata for that recognized failure. No automatic renaming occurs.

The previous parser accepted two physical variables named ID and overwrote the first values while constructing row objects. In a preserved original-module synthetic capture, physical values 1, 2, 3 and 10, 20, 30 became only ID=10, 20, 30. The first physical variable's mean should be 2; the previous result was 20. An empty name instead left rows keyed by an empty string while metadata used Column 1. An independent Python struct/Fraction check verifies the original 296-byte files, three cases, names and physical means.

This is an early import safeguard, not a migration. Existing workspace validation already quarantines duplicate source columns. Tests confirm that such raw saves remain untouched, and that an older empty-name study, cached analysis and published snapshot survive load/resave exactly. Explicitly repairing and re-exporting the source imports a separate version; historical data is not rewritten.

The guard compares exact decoded names. Distinct ID/id keys remain supported. Valid trailing-NUL-padded names and ignored dummy names in string continuation records remain supported. This does not establish complete name grammar, encoding repair, case folding, or full continuation-layout validation.

Verification adds 28 tests: 19 parser/analysis compatibility cases, four mocked-handler cases covering ten upload vectors, two persistence cases and three actual App/Home jsdom import/reopen cases. Failed imports make no workspace writes; repaired imports preserve existing studies, reports and snapshots. Handler tests verify no fallback or storage writes on recognized failures and valid continued-string payloads using mocked storage. Inputs and reference fixtures are entirely synthetic.

Native browser/SPSS/Office, operating-system downloads, live backend and Snowflake remain unverified. Full-suite, typecheck, build and source-checkpoint results are recorded in the private acceptance packet. This is bounded data-integrity work; no original forty-goal completion is added.
