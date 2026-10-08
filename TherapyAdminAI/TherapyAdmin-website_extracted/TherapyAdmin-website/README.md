# TherapyAdmin AI — Complete App File Reference

## File Structure
```
/
├── index.html          → Redirect to login or dashboard
├── login.html          → OAuth + email login page
├── onboarding.html     → 4-step new user setup (practice profile + voice calibration)
├── dashboard.html      → Main app (nav, generate, documents, settings)
├── billing.html        → Pricing + Stripe checkout + FAQ
├── offline.html        → PWA offline fallback page
├── app.js              → Central app logic (Auth, API, Generator, DocViewer, Notifications)
├── sw.js               → Service worker (caching, push notifications, offline)
├── manifest.json       → PWA manifest (install, shortcuts, icons)
├── icon-192.png        → App icon (you supply this — your logo at 192×192px)
├── icon-512.png        → App icon (you supply this — your logo at 512×512px)
└── TherapyAdminAI_FullSpec.pdf  → Complete product spec, patents, HIPAA architecture
```

## Page Flow
```
New user:   login.html → onboarding.html → dashboard.html
Returning:  login.html → dashboard.html
Upgrade:    dashboard.html → billing.html → Stripe Checkout → dashboard.html
PWA:        Install banner appears after 8s on any page → home screen icon
```

## Backend Routes Required
These pages call the following server endpoints (see auth.js for implementation):

### Auth
- POST /auth/google          → OAuth redirect
- GET  /auth/google/callback → OAuth callback
- POST /auth/microsoft       → OAuth redirect
- GET  /auth/microsoft/callback
- POST /auth/login           → Email/password login
- POST /auth/signup          → New account
- POST /auth/refresh         → Rotate JWT
- POST /auth/logout          → Clear session

### API (all require Authorization: Bearer <token>)
- POST /api/generate                    → Generate document (calls Claude)
- GET  /api/documents                   → List user's documents
- POST /api/documents                   → Save document
- DELETE /api/documents/:id             → Delete document
- GET  /api/voice-profile               → Get voice profile
- PUT  /api/voice-profile               → Update voice profile
- POST /api/billing/checkout            → Create Stripe checkout session
- POST /api/billing/portal              → Create Stripe billing portal session
- POST /api/stripe/webhook              → Stripe webhook handler

### Webhooks
- POST /api/stripe/webhook              → Handle Stripe events (see auth.js)

## Environment Variables (.env)
```
APP_URL=https://therapyadmin.ai
JWT_SECRET=<256-bit random>
SESSION_SECRET=<256-bit random>

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxx

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PRICE_STARTER=price_xxx
PRICE_PRO=price_xxx
PRICE_GROUP=price_xxx

DATABASE_URL=postgres://...
ANTHROPIC_API_KEY=sk-ant-...  (for server-side generation)
```

## Deploy in 15 minutes (Vercel)
1. Push all files to a GitHub repo
2. Connect repo to vercel.com
3. Add all environment variables in Vercel dashboard
4. Deploy — Vercel handles SSL, CDN, and serverless functions automatically

## Add your icons
Create two PNG files:
- icon-192.png (192×192px) — your practice logo
- icon-512.png (512×512px) — same logo, larger

Free tool: pwabuilder.com/imageGenerator — upload any image, download all sizes

## Connect Google OAuth
1. console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web Application
3. Add authorized redirect URI: https://therapyadmin.ai/auth/google/callback
4. Copy Client ID and Secret to .env

## HIPAA checklist before accepting patients
- [ ] Anthropic BAA signed (contact Anthropic sales)
- [ ] AWS BAA signed (free in AWS console under Support)
- [ ] Stripe BAA (only if linking client IDs to billing — likely not needed)
- [ ] Healthcare attorney reviewed your Privacy Policy and Terms of Service
- [ ] Provisional patent applications filed for 4 innovations (see FullSpec.pdf)
- [ ] Penetration test scheduled (before 100 paying users)
