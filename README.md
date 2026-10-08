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
EOF
