# Recover the owner's catalog (October 15 deploy)

## What happened

On every deploy the Worker compared `public/data/products.json` with the database and,
if the file had changed, wrote every product from the file back into D1. The October 15
commit rewrote that file (photos renamed to `.webp`), so the deploy:

- brought back products the owner had deleted, and
- replaced his new photos, names and prices with the old repo copies.

His uploaded photos were not deleted. They are still in Cloudflare KV (`IMAGES`).
Only the product rows that point to them were overwritten.

This branch stops it happening again: the database is now the only catalog,
`products.json` is used only to fill an empty database, and photos are no longer in the repo.

## Restore his last version (about 10 minutes)

Run these on your computer, in the repo, after `npx wrangler login`. You need Node 22.13 or later.

D1 Time Travel keeps 30 days of history on the paid Workers plan and 7 days on the free
plan. On the free plan, finish before **October 22**.

1. **Back up the database as it is now.**
   ```
   npx wrangler d1 export winwin --remote --output backup-full-now.sql
   ```

2. **Copy the current photos to KV** so nothing breaks once the repo stops shipping them.
   Photos already in KV, including all of the owner's uploads, are skipped and never overwritten.
   ```
   git worktree add ../winwin-photos e80ee89
   npm run cf:images ../winwin-photos/public/img
   git worktree remove ../winwin-photos
   ```

3. **Deploy this branch** (merge it into `main`). Do this before step 5, or the old
   Worker would overwrite the catalog again after the restore.

4. **Save today's products and today's bookmark.**
   ```
   npx wrangler d1 export winwin --remote --table products --output products-now.sql
   npx wrangler d1 time-travel info winwin
   ```
   Write down the bookmark it prints. This is "NOW_BOOKMARK".

5. **Briefly go back to just before the bad deploy and copy the products from then.**
   Get the deploy time from Cloudflare → Workers & Pages → winwin → Deployments, and use
   a time a few minutes before it (UTC). The commit was 2026-10-15 00:29 UTC.
   ```
   npx wrangler d1 time-travel restore winwin --timestamp 2026-10-15T00:25:00Z
   npx wrangler d1 export winwin --remote --table products --output products-before.sql
   npx wrangler d1 time-travel restore winwin --bookmark NOW_BOOKMARK
   ```
   Run the three commands back to back, at a quiet hour. Anything customers save in that
   minute is lost when you go back to NOW_BOOKMARK.

6. **Build the merge and read the report.**
   ```
   npm run recover:products products-before.sql products-now.sql 2026-10-15T00:30:00Z recover-products.sql
   ```
   Use the deploy time from step 5 as the cutoff. The report lists every product:
   - restored to the owner's pre-deploy version (his photo, name, price, stock)
   - deleted again (the deploy had brought it back)
   - kept as it is (he edited or added it after the deploy)

7. **Apply it.**
   ```
   npx wrangler d1 execute winwin --remote --file recover-products.sql
   ```

If anything looks wrong, `backup-full-now.sql` from step 1 has the full database as it was
before you started.
