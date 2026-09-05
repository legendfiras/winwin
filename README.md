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

Product photos in `public/img` are copied into the build and served at `/img/<filename>`. The original CSV and download folder stay gitignored. Optional R2 upload: `npm run cf:bucket` then `npm run cf:images` (requires R2 enabled on the account).

**Publish to Base44**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
