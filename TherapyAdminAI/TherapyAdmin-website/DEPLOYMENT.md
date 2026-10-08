# TherapyAdmin AI - Deployment Guide

## Option 1: Vercel (Recommended for Free Tier)

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and connect your GitHub account
3. Import your repository
4. Vercel will automatically detect it's a Node.js application
5. Add the following Environment Variables:
   - `PORT` = 3000
   - `APP_URL` = your-vercel-app-url.vercel.app
   - `JWT_SECRET` = [generate a random 32+ character string]
   - `SESSION_SECRET` = [generate a random 32+ character string]
   - `GEMINI_API_KEY` = your-anthropic-api-key (get from [ai.google.dev](https://www.ai.google.dev))
   - `GOOGLE_CLIENT_ID` = your-google-oauth-client-id
   - `GOOGLE_CLIENT_SECRET` = your-google-oauth-client-secret
   - `MICROSOFT_CLIENT_ID` = your-microsoft-oauth-client-id
   - `MICROSOFT_CLIENT_SECRET` = your-microsoft-oauth-client-secret
   - `STRIPE_SECRET_KEY` = your-stripe-secret-key (for production)
   - `STRIPE_PUBLISHABLE_KEY` = your-stripe-publishable-key (for production)
   - `STRIPE_WEBHOOK_SECRET` = your-stripe-webhook-secret
   - `PRICE_STARTER` = your-stripe-price-id-for-starter-plan
   - `PRICE_PRO` = your-stripe-price-id-for-pro-plan
   - `PRICE_GROUP` = your-stripe-price-id-for-group-plan
   - `DATABASE_URL` = (leave empty for SQLite, or set to PostgreSQL URL for production)

6. Deploy!

## Option 2: Traditional Server/VPS

1. Install Node.js (v18+ recommended)
2. Clone/download the repository
3. Run `npm install` to install dependencies
4. Create a `.env` file based on `.env.example`
5. Set your environment variables (see above)
6. Run `npm start` or `node server.js`
7. The application will be available at http://localhost:3000

## Option 3: Docker

1. Create a Dockerfile:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```
2. Build and run:
   ```bash
   docker build -t therapyadmin-ai .
   docker run -p 3000:3000 --env-file .env therapyadmin-ai
   ```

## Cost Optimization Tips for Free Tier

1. **Database**: Use SQLite (default) for development and low-traffic production. Only upgrade to PostgreSQL if you exceed SQLite's capabilities.

2. **AI Usage**: 
   - Monitor Google Gemini API usage
   - Consider implementing caching for voice profiles
   - Use the mock mode during development

3. **Storage**: 
   - Files are stored as text in the database (SQLite file)
   - For production with significant file storage, consider moving to object storage (AWS S3, etc.)

4. **Scaling**:
   - Start with the free tier on Vercel
   - Monitor usage and upgrade as needed
   - Consider using Vercel's serverless functions for automatic scaling

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Port to run on (default: 3000) | No |
| APP_URL | Base URL of your application | Yes |
| JWT_SECRET | Secret for signing JWT tokens | Yes |
| SESSION_SECRET | Secret for session handling | Yes |
| DATABASE_URL | PostgreSQL connection string (empty for SQLite) | No |
| GEMINI_API_KEY | API key for Gemini AI | Yes |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | Yes (for Google login) |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret | Yes (for Google login) |
| MICROSOFT_CLIENT_ID | Microsoft OAuth Client ID | Yes (for Microsoft login) |
| MICROSOFT_CLIENT_SECRET | Microsoft OAuth Client Secret | Yes (for Microsoft login) |
| STRIPE_SECRET_KEY | Stripe secret key | Yes (for payments) |
| STRIPE_PUBLISHABLE_KEY | Stripe publishable key | Yes (for payments) |
| STRIPE_WEBHOOK_SECRET | Stripe webhook secret | Yes (for webhooks) |
| PRICE_STARTER | Stripe price ID for starter plan | Yes (for payments) |
| PRICE_PRO | Stripe price ID for pro plan | Yes (for payments) |
| PRICE_GROUP | Stripe price ID for group plan | Yes (for payments) |

## First-Time Setup

1. After deployment, visit your domain
2. Create an account via email/password or OAuth
3. Complete the onboarding process (practice profile + voice calibration)
4. Start generating documents!

## Maintenance

- Monitor logs for errors
- Keep dependencies updated: `npm update`
- Backup your SQLite database periodically (`therapyadmin.db` file)
- For PostgreSQL, set up regular backups
- Watch your AI usage to avoid unexpected charges
