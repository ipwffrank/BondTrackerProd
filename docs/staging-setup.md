# Staging environment setup

We've been deploying Firestore rules and code straight to prod. One bad
rule = users locked out instantly. This sets up a parallel
`bond-sales-tracker-staging` Firebase project + a staging Netlify deploy
of both apps so you can vet changes before they reach paying users.

Total time: ~30–45 min, mostly waiting on Netlify builds.

The local repo already supports it — `.firebaserc` has a `staging`
alias and `package.json` has `deploy:rules:staging` / `deploy:rules:prod`
scripts. You just need to create the project and add env vars.

---

## 1. Create the Firebase project (10 min)

1. Go to <https://console.firebase.google.com/>, click **Add project**
2. Name: `Axle Staging` (the project ID will be auto-generated; keep
   `bond-sales-tracker-staging` if Firebase offers it, otherwise note
   what it gave you and update `.firebaserc` to match)
3. Disable Google Analytics for staging — not worth it
4. Once the project lands, in the left nav:
   - **Build → Authentication** → Get started → enable **Email/Password**
     (and SAML if you use SSO in prod)
   - **Build → Firestore Database** → Create database → **Start in
     production mode** (rules locked down by default; `firebase deploy`
     will overwrite with our real rules)
   - **Build → Firestore Database → Indexes** — leave empty; the next
     deploy will populate
5. Project Settings → General → scroll to **Your apps** → click the
   web icon `</>` → register a new web app called "Axle Staging Web".
   Copy the firebase config (`apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`). You'll paste these
   into Netlify env vars in step 3.
6. Project Settings → Service accounts → **Generate new private key**.
   This downloads a JSON. Keep it safe — you'll paste its contents
   verbatim into Netlify as `FIREBASE_SERVICE_ACCOUNT` in step 3.

## 2. Deploy initial rules + indexes to staging (2 min)

From this repo:

```bash
firebase use staging          # switches to bond-sales-tracker-staging
npm run deploy:rules:staging  # runs rule tests, then deploys to staging
firebase use prod             # switch back so subsequent commands hit prod
```

The first deploy populates rules + indexes. Verify in the Firebase
Console that `firestore.rules` matches what's in this repo.

## 3. Set up a staging Netlify deploy (15 min)

You need TWO new Netlify sites (one for the main app, one for the
admin portal) pointing at the same repos but a different env config.

For each repo (BondTrackerProd, then bondtracker-admin):

1. **Netlify dashboard** → Add new site → Import from Git → select
   the repo
2. Site name: `axle-staging` (and `axle-admin-staging` for the second).
   This gives you `axle-staging.netlify.app` etc. — fine for staging.
3. Build settings: leave the defaults from `netlify.toml`
4. **Important — branch:** set Production branch to `staging` so the
   live `main` branch keeps deploying to prod. Then create a `staging`
   branch in git (`git checkout -b staging && git push -u origin
   staging`). Whenever you want to test a change, push it to `staging`
   first; promote to `main` to ship to prod.
5. **Environment variables** — Site settings → Environment variables:

   For BondTrackerProd's staging site:
   ```
   VITE_FIREBASE_API_KEY               = <staging firebase config>
   VITE_FIREBASE_AUTH_DOMAIN           = <staging>
   VITE_FIREBASE_PROJECT_ID            = bond-sales-tracker-staging
   VITE_FIREBASE_STORAGE_BUCKET        = <staging>
   VITE_FIREBASE_MESSAGING_SENDER_ID   = <staging>
   VITE_FIREBASE_APP_ID                = <staging>
   FIREBASE_SERVICE_ACCOUNT            = <paste the entire JSON from step 1.6>
   RESEND_API_KEY                      = <separate Resend API key for staging,
                                          OR reuse prod's — see note below>
   OPENAI_API_KEY                      = <reuse prod or use a separate one>
   OPENFIGI_API_KEY                    = <reuse prod>
   VITE_SENTRY_DSN                     = <separate Sentry project for staging>
   VITE_SENTRY_ENVIRONMENT             = staging
   ALLOWED_ORIGINS                     = https://axle-staging.netlify.app,https://axle-admin-staging.netlify.app
   ```

   For bondtracker-admin's staging site: same Firebase config (both
   apps share the staging Firestore), same `FIREBASE_SERVICE_ACCOUNT`,
   own staging Sentry DSN.

6. Trigger the first deploy. Wait for build to go green.

**Note on Resend key:** in staging, emails are real and will send to
real inboxes. Either (a) use prod's API key and only test against your
own email addresses, or (b) create a second Resend project for
staging — but Resend's free tier may not support that. Easiest: keep
staging emails firing only to the small set of real test accounts.

## 4. Verify staging is fully isolated

```bash
# Open https://axle-staging.netlify.app in incognito. Sign up with a
# fresh email. Go through Activities → Add Activity. Then:

firebase use prod
firebase firestore:list-collections | head
# Confirm your staging signup did NOT land in prod.
```

Then run a one-line check from the Firebase Console of each project —
the staging project's `users` collection should contain ONLY the
account you just created; the prod project should be untouched.

## 5. Day-to-day workflow

**To test a code change:**
```bash
git checkout staging
git merge main      # or push your feature branch to staging
git push origin staging
# Wait for Netlify staging build, test on axle-staging.netlify.app
git checkout main
git merge staging
git push origin main   # ships to prod
```

**To test a Firestore rule change:**
```bash
# 1. Edit firestore.rules locally
# 2. Run unit tests
npm run test:rules
# 3. Deploy to staging Firebase
npm run deploy:rules:staging
# 4. Test the rule against staging data
# 5. If green, deploy to prod
npm run deploy:rules:prod
```

The `deploy:rules:*` scripts always run `npm run test:rules` first —
if any rule test fails, the deploy is aborted before it touches the
remote.

## What this DOESN'T cover

- Pilot reminders cron — Netlify scheduled functions only run on the
  primary deploy of each site. Staging won't fire scheduled
  reminders. That's fine: you can manually trigger via the "Run
  reminders now" button.
- Stripe / billing if you add it later — set up a separate Stripe
  test mode account, point staging at it.

## Recovery: rolling back a bad rule deploy

If a rule deploy locks people out:

```bash
# Roll the file back to the previous commit
git log --oneline firestore.rules    # find the last-known-good SHA
git checkout <sha> -- firestore.rules
npm run deploy:rules:prod            # redeploys old version
git checkout HEAD -- firestore.rules # restore working dir
# Then fix the rule properly + run npm run test:rules
```
