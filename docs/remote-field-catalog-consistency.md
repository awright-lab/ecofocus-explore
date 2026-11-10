# Remote field catalog consistency

Remote field pages now reject detectable contradictions: changing total counts,
or repeated field IDs/source columns across offsets. All loaded pages are discarded,
pending page tokens are revoked, and automatic loads stop until explicit Retry.
Retry starts a fresh catalog; late responses from the previous attempt cannot enter it.
Independent ordinary page errors still retain successful pages and retry only failures.
The Data explorer suppresses selected-field details while the catalog is invalid.
No study rows, cached dataset metadata, persisted workspaces or server records change.

This is bounded protection, not a server snapshot protocol. A changing catalog with
the same count and disjoint identities can still evade detection. A shared server
catalog revision is needed for full consistency. Already-created analyses are not
revoked. Native browser, live catalog changes and Snowflake acceptance remain open;
goal 7 remains partial. No deployment, publication or backend changes are included.
