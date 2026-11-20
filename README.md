# ClassCraft Adda247 — Vercel edition

The current ClassCraft Adda247 app, packaged for Vercel with the original light/dark Adda247 templates, bundled fonts, browser OCR, editable PowerPoint export and server-side AI routes.

## Deploy from this ZIP

1. Extract the ZIP. Open a terminal inside **ClassCraft-Adda247-Vercel** (the folder containing `package.json` and `vercel.json`). Install Node.js **24 LTS** on your computer if needed.
2. Run `npx vercel login`, then `npx vercel --prod`. Select your Vercel account and create a project. Use this folder (`./`) as the project root. The included configuration sets the build options.
3. For cloud refinement/translation, open the Vercel project's **Settings → Environment Variables**, add `GEMINI_API_KEY`, and redeploy. Set `GEMINI_MODEL` if your account uses another supported model. No API keys are included in this ZIP.

**GitHub alternative:** upload the extracted project contents to a repository, then import that repository using Vercel **Add New → Project**. Choose the folder containing `package.json` as the Root Directory.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist/client` |
| Fluid Compute | Enabled |

The source ZIP is intentionally small: document reader/OCR runtimes are generated from the pinned dependencies during build. Do not upload only `dist/client`; the root `api/` files are needed for cloud AI.

## हिंदी में

ZIP extract करें और **ClassCraft-Adda247-Vercel** folder खोलें। इसी folder से `npx vercel login` और फिर `npx vercel --prod` चलाएँ। GitHub से करना हो तो इसी folder की files repository में upload करके Vercel में import करें। Build settings पहले से दी गई हैं।

Gemini इस्तेमाल करने के लिए Vercel की Environment Variables में `GEMINI_API_KEY` जोड़ें, फिर Redeploy करें। सामान्य slide editing, file extraction/OCR और PPT/PDF export बिना cloud API key के काम करते हैं।

## Server configuration

Use `.env.example` for the supported environment variable names. Provider priority is Gemini, OpenAI, then Groq. Configure only the provider you intend to use. Keys must be server variables, never `VITE_` variables. Model availability and provider quotas depend on your account.

This export does not include the original hosting platform's private-access policy. If this is a private teaching tool, configure Vercel Deployment Protection before sharing the deployment or enabling a paid provider key.

The app stores projects/presets in the browser. Saved data on the old website does not automatically move to a new domain: use the app's backup and restore controls to transfer it.

## Local commands

```sh
npm ci
npm run dev
npm run build
npm run preview
npm test
```

`dev` and `preview` run the frontend; use `npx vercel dev` to run the Vercel API routes locally as well. For local server variables, copy `.env.example` to `.env.local` and fill only the required values. Keep that file out of source control.

API endpoints: `/api/health`, `/api/refinement/status`, `/api/refine`, `/api/translate`. POST operations accept same-origin browser requests and retain the app's input validation and provider timeouts.

## Validation and references

See `VERIFICATION.txt` for the checks performed on this package. A live Vercel deployment is not included in this delivery.

Official guidance: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node.js API functions](https://vercel.com/docs/functions/runtimes/node-js), [CLI deployment](https://vercel.com/docs/cli/deploying-from-cli), [environment variables](https://vercel.com/docs/environment-variables).
