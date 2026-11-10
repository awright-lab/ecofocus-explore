# Known-base change correction

The selected-column summary now compares two known, own, valid recorded bases independently of numeric-value availability. A compatible average or rate changing from n=100 to n=0 therefore reports one changed base while retaining the unavailable value and withholding numeric arithmetic. Missing, invalid, inherited, rerun-required or incompatible bases are not treated as known comparisons. The hide-identical filter keeps unavailable entries visible.

Synthetic engine fixtures cover average/rate zero-base results; cached missing-value probes cover known bases with unavailable values. UI checks show the changed-base count beside n=100 and unavailable n=0 and retain the row when identical entries are hidden. No source, saved query, cache, export or persistence behavior is changed. Native/browser/AT and build gates remain open; goal13 remains partial.
