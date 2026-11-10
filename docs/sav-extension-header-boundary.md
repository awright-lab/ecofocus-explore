# Refuse incomplete SAV extension headers before fallback

Independent review found that a truncated machine floating-point record could fail while reading its size or count, before the existing missing-marker integrity check ran. The resulting generic `DataView` error did not carry `sav_case_integrity`, so the upload handler could enter its alternate-parser path.

The reader now checks all 12 bytes after a recognized extension-record type before reading subtype, size or count. Incomplete headers return the existing integrity error and no dataset. Complete unknown extension headers retain their existing handling, and the missing-marker payload checks remain unchanged.

Twenty-four regressions cover every truncated prefix of the three-field header in the parser and actual handler with mocked infrastructure. Each input is byte-compared. Handler checks require no alternate-parser construction, blob or metadata write, database connection or network request. These tests reproduce the error classification and fallback-entry boundary; they do not establish that the real alternate parser would previously have produced or stored incorrect rows.

The preceding numeric correction and truncation checks are otherwise unchanged. This is a bounded header fix, not comprehensive SAV dictionary validation. Native SPSS/browser and live backend acceptance remain unverified. No saved dataset, report or historical snapshot is modified or migrated.
