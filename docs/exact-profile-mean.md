# Bounded recovery of numeric profile means

The numeric profile previously refused some means after an intermediate sum overflow, even when positive and negative inputs canceled to a small, representable mean. That conservative guard prevented incorrect large residuals. This follow-up recovers a mean for at most 50,000 valid observations using exact integer accumulation of the already parsed binary64 inputs and one nearest/ties-to-even rounding of their quotient.

This is exact arithmetic over the parsed binary64 numbers, not decimal-source exactness, statistical inference or a weighted estimate. Blank/invalid observations, raw rows, counts, distributions, medians, total overflow policy and analytical query rejection rules remain unchanged. Ordinary profiles keep their existing fast path; recovery runs only when the ordinary total is unavailable. Existing constant-value/exact-opposite proofs remain available outside the recovery bound. Above the bound, an unsupported mean remains unavailable; nonzero results that round to zero remain unavailable with the range warning.

The previously reported [-1e308,-1e308,1,1e308,1e308] mean is now 0.2 rather than unavailable. The total still displays unavailable under its existing intermediate-overflow rule. Previous profile snapshots/results are not rewritten. No stored schema or persistence change.

Verification uses an independent Python Fraction oracle over exact binary64 values, boundary/tie/resource tests, all 30 source orders of the original cancellation, UI/profile-worker checks and source preservation. This improves one descriptive statistic; it does not complete goal15 or validated survey statistics. Native browser, Worker/CSP, performance and assistive-technology acceptance remain unverified.
