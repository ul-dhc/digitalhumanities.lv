[Website](https://digitalhumanities.lv)

## Google Sheets content

`pnpm sync:data` imports the existing updates/archive and two additional tabs
from the same content spreadsheet:

- **DigiLATEs jaunumi** (`gid=2026101301`): updates shown on `/lv/projekti/digilate/`
  and `/en/projects/digilate/`. Leave `project_id` blank or select `digilates`.
- **Semināri** (`gid=2026101302`): entries shown in the workshop series and the
  updates archive. Leave `series_id` blank or select `digitalhumanities-lv`.
  `event_date` must be `YYYY-MM-DD`; `event_time` is local time and `timezone`
  defaults to `Europe/Riga`. Speakers, location, registration and recording URLs
  are optional.

Use one row per language (`lv`/`en`), with a shared `translation_id` for translations.
Fill `title`, `slug`, `published_at`, and `content_type` (`news`/`event` for the project;
`seminar` for workshops). If `record_id` is empty, the importer generates
`translation_id-language`. The `slug` is also the stable link anchor: keep it
unique within each language and avoid changing it after publication.
Only `status=published` appears on the site. Other statuses remain unpublished.
The full text accepts paragraphs, Markdown links, bold text and bullet lists.
Use a direct public image URL or a site-relative path for `image_url`.

The two new tabs use the public spreadsheet CSV export, so they do not need
separate “Publish to web” configuration. The spreadsheet must remain readable
without login. Environment overrides: `GOOGLE_SHEETS_CONTENT_ID`,
`GOOGLE_SHEETS_PROJECTS_GID`, `GOOGLE_SHEETS_SEMINARS_GID`.

The deployment workflow rebuilds on pushes to `main` and manual **Run workflow**.
New tab support becomes live after these code changes are merged to `main`.
Run `node --test scripts/sync-google-sheets.test.mjs` and `pnpm build` to verify.

## Publishing reliability

The newest deployment cancels an older run in the same `pages` concurrency group.
Builds have a 10-minute execution limit; deployment and live-version verification
have a 5-minute limit. Google requests have 30-second timeouts and up to three
attempts for transient failures. Invalid or inaccessible data stops publication
instead of replacing the live site with incomplete content.

Every build writes `/version.json` with its Git commit and build time. The deployment
job verifies this file on the public domain before reporting success. Manual
builds keep the same commit but receive a new build time and fresh spreadsheet data.
GitHub-hosted runner queueing and environment approvals are separate from job
execution timeouts; cancel an obsolete blocked run in Actions if it blocks the queue.

For content edits: set the row status to `published`, open GitHub Actions →
**Deploy Digitalhumanities.lv** → **Run workflow**, select `main`, and run it.
Spreadsheet edits are imported by that run; no six-hour polling is configured.
