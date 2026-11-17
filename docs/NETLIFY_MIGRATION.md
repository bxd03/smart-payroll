# Netlify deployment and owner activation

Project: `smartpayroll-lyqc` in the owner's Netlify account. GitHub `main` is linked for continuous deployment.

## Build

The committed `netlify.toml` selects `npm run build` and `.next`. The app now uses standard Next.js. Installing `@netlify/database` enables automatic database provisioning; SQL migrations are committed under `netlify/database/migrations`. Provisioning and plan availability must succeed in the Netlify deployment. No database credentials belong in GitHub.

`.netlify` is ignored. The old Sites/Cloudflare configuration is retained for reference but is not the Netlify build target. Do not republish this main branch through the old Sites build workflow.

## Owner activation (required)

In Netlify, open Environment variables and create the following for Production / Functions (all scopes also works):

- `SMARTPAYROLL_OWNER_EMAIL`: your account email, lowercase.
- `SMARTPAYROLL_ADMIN_SETUP_KEY`: a new private random key, at least 24 characters. Mark it secret. Keep it in a password manager.

Redeploy after adding these settings. Visit `/login`, choose Create account, use exactly the configured owner email, choose a password of 12–128 characters, and enter the private setup key. This creates the superadmin. Ordinary accounts leave the key empty and cannot register the reserved owner email. Passwords use salted scrypt hashes; sessions use hashed opaque tokens, expire after seven days, and use HttpOnly cookies. Authentication attempts are limited. Public registration does not send email verification or password recovery messages yet.

Remove the setup key after activating the owner and redeploy. Keep the owner email set. Subsequent owner sign-in only needs email and password. Do not change the owner email to an existing ordinary account: administrator role is separately checked.

Make the production site public in Netlify visitor access controls only after verifying that guest and administrator data isolation works. App authentication and admin checks remain enforced independently of project visibility.

## Existing data

The old host's database and uploaded files do not automatically move. Keep it available until transfer is checked.

1. Sign in as owner at the previous SmartPayroll address.
2. Open workspace administration, select each workspace and export its raw JSON.
3. Sign in as owner on the Netlify app and open `/migrate`.
4. Import each export (version 2, maximum 2 MB). This imports workers, companies, shifts, attendance, payroll, settings and audit entries. An existing workspace with saved data cannot be overwritten.
5. Select the imported workspace through superadmin administration. Check worker counts, attendance dates, working hours and payroll totals against the old site.
6. Original uploaded document binaries are not included in the JSON export. Download and archive those separately from the old site. Existing attendance source references remain historical references; the migration does not claim those files have transferred. New uploads are stored in PostgreSQL on Netlify, with a 4 MB file limit to fit serverless request limits.

Guest cookies and ChatGPT account sessions do not transfer between domains. New email/password accounts are separate; superadmin import preserves workspace keys and provides access to the transferred records.

## Verification

- `npm test`: existing payroll calculations and workflow checks.
- `npm run test:netlify`: PostgreSQL-compatible integration check of migrations, owner setup, forbidden forged identity, account isolation, session revocation, import conflict protection, revision/audit atomicity and stored file bytes.
- `npm run build`: standard Next.js production compilation and types.
- Production deployment status, DB provisioning and real HTTP smoke tests must be checked separately. A locally passing build is not proof of deployment.
