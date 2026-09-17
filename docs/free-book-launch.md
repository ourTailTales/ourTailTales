# Free book flow launch checklist

The free-book flow is embedded below the hardcover and paperback showcase on
the landing page, with `/create` retained as a direct and recovery route. It is
implemented and production-buildable, but still needs the following environment
and Supabase setup before it can be enabled for customers.

## Supabase

- Reconcile the linked project's migration history before applying anything.
  Migration `0003_video_memories.sql` contains an older Video Memory schema that
  was previously reverted in the live project, so do not run an unrestricted
  `supabase db push` from this checkout.
- Review and apply only
  `supabase/migrations/20260917114038_create_book_projects.sql` through the
  Supabase SQL editor or after repairing migration history.
- Confirm `book_projects` has RLS enabled and that an authenticated user can
  select only rows where `user_id = auth.uid()`.
- Confirm the `book-previews` bucket is private and a user cannot read a path
  whose first folder segment is another user ID.

## Authentication and environment

- Set `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in local, preview, and production
  environments. Never put the service-role key in a public variable.
- Add the production `/auth/callback` URL to Supabase's redirect allow list.
- Enable Google Auth and add its production OAuth callback configuration.
- Configure production SMTP before relying on email confirmation.

## Release verification

- From the landing page, upload at least 25 photos on a phone-sized viewport,
  add another batch, and
  verify the combined album is chronological and duplicate-safe.
- Generate the five-chapter book, refresh `/create`, and confirm the local draft
  and preview recover from IndexedDB.
- Create an account and confirm exactly one `book_projects` row is written when
  Save is retried.
- Open `/book/[id]` in the owner's session, a signed-out browser, and a different
  user's session. Only the owner should see the preview.
- Confirm PostHog receives `album_selected`, `album_processing_completed`,
  `free_book_generation_completed`, `auth_gate_viewed`, `free_book_saved`, and
  `free_book_opened` without filenames, image content, or coordinates.
- Run `npm test`, `npm run lint`, and `npm run build` before deployment.
