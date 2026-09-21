# Field visits and access hardening

## Access model

YVY uses Passport/Google login, PostgreSQL sessions and a server-side database connection.
It does not use Supabase Auth identities for farm ownership. Public database tables are
backend-only: RLS enabled, no browser-role grants or permissive policies. The absence
of policies is intentional (deny direct Data API access). Server routes enforce ownership
or administrator access. Do not add `auth.uid()` policies against the integer user IDs.

The new `farm_visits` table is additive. Existing farms/stages/readings/reports are not
rewritten. Farm deletion cascades to its visits. Visit uploads go to a separate private
Storage bucket, `farm-visit-photos`, provisioned by the server Storage API. Existing
satellite/cover image buckets are unchanged. Viewing URLs expire after ten minutes;
possession of a signed URL allows viewing until expiry, even after a session ends.
Deleting a farm removes visit records but does not physically purge Storage objects.

The clients CRM is administrator-only, matching its existing sidebar visibility. Task
and alert operations require ownership or administrator role; tasks cannot be reassigned
to another farm by changing the request body. Removed daily-actions UI remains removed.

## Verification

- `npm run check`, `npm test`, `npm run build`.
- `tests/visits-access.test.ts`: authentication, owner/other/admin matrix, farm isolation,
  chronological list and pagination, strict input validation, cascade cleanup.
- `tests/visit-photos.test.ts`: private bucket requirement, upload metadata and downloaded
  signatures, missing/invalid files, expiring URLs, preserving records on failure.
- `supabase/tests/backend_access.sql`: assert RLS and denied browser grants for every
  application table while maintaining backend access. Run as postgres after migrations.
- Browser: farm -> Vistorias -> Registrar vistoria -> fill -> save -> reload -> reopen.
- Test up to four JPG/PNG/WebP photos (6 MB each), verify thumbnails and full-size view.
- Verify the private image cannot be fetched through the public Storage URL.
- Check desktop and 390px mobile layout, login, dashboard, existing farm and finance tabs.

## Reports and limits

The latest five visits (by observation date) are included as textual context in new AI
reports. The snapshot records that exact context. A newly changed visit context prevents
reusing a report from the same reading. The prompt distinguishes field observations from
satellite evidence and does not claim the photos were analyzed. Existing report records
remain unchanged. Text generation quality still requires agronomist review.

Visits are append-only in this first version: review before saving; corrections can be
documented as another dated visit. Uploads completed before an abandoned/failed submission
can remain as private objects. Automatic cleanup and visit editing are not implemented.

This is not a complete security audit. In particular, the existing PayPal upgrade route
still trusts a client order ID instead of validating payment server-side; address that in
a separate payment-focused change with sandbox checkout tests. Existing cover photos use
the existing public bucket and are not converted by this migration.
