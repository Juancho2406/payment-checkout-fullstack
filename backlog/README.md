# backlog

Canonical timeline of how this kata is assembled: `roadmap.json`.

Each future commit belongs to one item `id` (`RM-01` …). After you commit, set that item to `status: "done"` and append `{ "message", "sha" }`. The reverse index is `byCommit[sha] → [ids]`. Leave `sha` empty on the item that *is* the current commit; the next commit fills it.

Do not invent a parallel markdown backlog — edit the JSON, then render it if you need a board.
