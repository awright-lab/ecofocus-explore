# Refuse incomplete SAV respondent streams

The original classic SAV reader could accept fewer cases than the file declared and report a successful read. A synthetic two-case file returned one case after removing the last row or part of its final value. Standard compressed input could similarly stop at a partial case, early terminator, truncated raw value or incomplete control block and return the preceding rows.

The reader now refuses these known integrity failures without returning a partial dataset. Uncompressed known counts must have enough physical case bytes. Unknown-count uncompressed data must end at a complete physical case boundary. Standard compressed data must complete each case and satisfy a positive declared count; partial controls and raw values are errors. Invalid nonpositive physical case widths are also refused before reading.

An optional `sav_case_integrity` import error code distinguishes this refusal from unsupported formats. The upload handler stops before trying another parser or accepting supplied browser metadata, and before writing files, metadata or database rows. Other fallback behavior is unchanged. The workspace import client can report the server error and repeat the local check, but cannot turn this same incomplete stream into a successful partial study.

## Compatibility and preservation

Complete classic and standard-compressed cases, including raw compressed values and clean unknown-count endings, retain their values. Existing variable-label, value-label, string-continuation, import-budget and upload-identity tests remain applicable. Unsupported ZLIB compression retains the existing metadata-only and fallback behavior. No saved dataset, historical cache, report or snapshot is migrated or repaired automatically; affected earlier imports require the original complete source file and explicit reimport.

An unknown-count file missing whole final cases cannot be distinguished from an intentionally shorter complete stream by these checks. Known-count trailing data retains existing handling. This is not comprehensive SPSS format validation, native SPSS acceptance, or proof that all missing-value conventions are supported.

## Verification

Twenty regression cases fail against the original reader; seven compatibility cases already pass. Additional tests cover invalid widths and the handler boundary. Every parser case compares input bytes before and after. The handler tests use synthetic binary fixtures and mocked infrastructure, including the actual upload client and local fallback; rejected imports preserve the existing browser workspace bytes. Native browser and live backend acceptance remain unverified. No real respondent data, remote storage, production database or credentials are used.
