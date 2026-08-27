# backlog

Fuente de verdad del kata: `roadmap.json`. Cada commit futuro pertenece a un `id` (`RM-01` …).

## Cómo se mueve el tablero (nativo de GitHub)

GitHub **solo** autoenlaza `#<número-de-issue>` (por ejemplo `#12`). **No** entiende `#RM-07`.

Por eso cada ítem RM se abre como un Issue cuyo título humano es `RM-07 — Root README`, y el número real se escribe de vuelta en `githubIssue.number`.

En el PR o commit que cierra el slice usa:

```
Closes #12
```

Eso cierra el issue y mueve la tarjeta a **Done**. Poner `RM-07` en el mensaje es solo para humanos; **no** mueve la tarjeta.

Sincronizar (idempotente; no duplica issues):

```
node backlog/sync-projects.mjs
```

Requiere `gh` autenticado con scopes `repo` y `project`. Crea un Project **público** (si el repo es público) con campos `Wave`, `Kind` y `Status`, abre/cierra issues según `status`, y actualiza `roadmap.json`.

En el tablero: **Group by → Wave** para ver las 5 fases como swimlanes.

## Schema (`roadmap.json`)

| Campo | Rol |
|---|---|
| `id` | Id humano estable `RM-NN`. Va en el título del issue. |
| `seq` | Orden de montaje. |
| `wave` | `0`–`4`. Campo Project `Wave` (5 fases). |
| `title` | Título corto. Issue: `{id} — {title}`. |
| `kind` | `feat` / `docs` / `chore` / `ci` / `infra` / `test`. Label + campo `Kind`. |
| `status` | `planned` → Todo (issue abierto); `in_progress` → In Progress; `done` → Done (issue cerrado). |
| `dependsOn` | Ids RM. Cuerpo del issue y relación nativa “blocked by” si GitHub lo permite. |
| `plannedCommit` | Mensaje de commit previsto. Cuerpo del issue. |
| `commits[]` | `{ message, sha }` de commits reales. |
| `byCommit` | `sha → [ids]` (mapa inverso commit → ítems). |
| `githubIssue` | `{ number, url }` después del sync; `null` hasta entonces. |
| `byIssue` | `"12" → "RM-07"` (mapa inverso issue → ítem). |
| `github.project` | Número / URL / id del Project V2. |

`#RM-NN` en un commit **no** mueve la tarjeta. `Closes #<number>` sí.

Tras cada commit del slice: `status: "done"`, append `{ message, sha }`. Deja `sha` vacío en el ítem que *es* el commit actual; el siguiente lo rellena. No hace falta un commit aparte “update roadmap”.

No inventes un backlog paralelo en markdown: edita el JSON y vuelve a correr el sync si hace falta.
