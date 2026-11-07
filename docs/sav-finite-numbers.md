# Preserve finite SAV observations

The classic SAV reader previously turned any numeric value with magnitude above `1e100` into a blank. This heuristic discarded valid observations and value-label codes. An actual prior-reader fixture containing `[1e101, -1e101, 5]` stores two blanks and reports mean 5 with base 1. Fresh parsing now retains all three values, yielding mean `5/3` with base 3.

Missingness uses the exact file-level system-missing marker. Without a floating-point info record, that marker is `-Number.MAX_VALUE`. A supported machine floating-point record can declare a different finite marker; it applies to numeric cases and numeric value labels. Labels are resolved after the dictionary, because floating-point info follows the label records. Nonfinite values and the standard compressed system-missing opcode remain blank. Malformed, nonfinite or conflicting marker declarations fail without a partial dataset and use the existing integrity-error path that blocks alternate parsing and writes.

The format basis is the GNU PSPP developer reference for [system-file special values](https://www.gnu.org/software/pspp/pspp-dev/html_node/System-File-Format.html) and the [machine floating-point info record](https://www.gnu.org/software/pspp/pspp-dev/html_node/Machine-Floating_002dPoint-Info-Record.html). This correction addresses the current little-endian IEEE reader. It does not add other floating-point representations, general per-variable user-defined missing-value support, encoding support or ZLIB decoding.

## Preservation and verification

- The frozen synthetic `legacy-sav-number-loss.json` contains output from the actual preceding reader, profile and analysis engine. Loading and saving that old study, cache and snapshot preserves them. Only an explicit reimport creates the corrected study; tests save it separately and reopen both versions without rewriting the old source, cache or snapshot.
- Parser tests cover both classic and standard compression, large positive and negative finite values, edge and subnormal values, default and declared missing markers, numeric value labels, late marker declarations, malformed records and conflicting declarations. Inputs are byte-compared before and after.
- Handler tests inspect exact row JSON passed to the existing database writer and the original blob bytes through mocked infrastructure. They also check rejection before fallback or writes when marker metadata is invalid. No live service is used.

Preserving a finite input is not a promise that every aggregation or export can represent it. Existing numerical overflow and underflow guards remain in effect. Values already discarded in historical imports cannot be recovered from their blanks; retain the original file and explicitly reimport it. Native browser, SPSS and live-backend acceptance remain unverified. No saved-data migration is included.
