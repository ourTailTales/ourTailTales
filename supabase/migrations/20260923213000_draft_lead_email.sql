-- The address the book was sent to, kept on the draft itself.
--
-- The welcome email carries a link to make an account for this exact book.
-- Someone following that link has already given us their address once, and
-- asking for it a second time on the way in is both a needless field and a
-- chance to mistype it into a different account than the one their book is
-- waiting under. Recorded when the email is sent, and readable only through
-- the draft secret.
alter table public.book_drafts
  add column if not exists lead_email text;
