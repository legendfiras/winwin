**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

**Cloudflare (Workers + static assets)**

Git deploys must use `npx wrangler deploy` (not `wrangler pages deploy`). Wrangler builds Vite into `dist/` and uploads it as static assets.

Dashboard settings:
- Build command: leave empty (Wrangler runs `npm run build`)
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Local deploy after `npx wrangler login`:

```
npm run cf:deploy
```

Product photos are not in the repo. They live in Cloudflare storage (the `IMAGES` KV namespace, and the `PRODUCT_IMAGES` R2 bucket when bound) and the Worker serves them at `/img/<filename>`. The live D1 database is the owner's catalog: `public/data/products.json` only seeds an empty database, so deploys never undo the owner's admin edits. `npm run cf:images [folder]` uploads photos to KV and skips any that are already there. See `RECOVERY.md` to restore the owner's catalog after the October 15 deploy.

**Publish to Base44**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
