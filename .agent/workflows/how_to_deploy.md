---
description: How to deploy the application to Vercel
---

# Deploying to Vercel

This guide outlines the steps to deploy the Reservation Site application to Vercel, making it accessible to the world.

## Prerequisites

1.  **GitHub Account**: Ensure you have a GitHub account.
2.  **Vercel Account**: Sign up for Vercel using your GitHub account at [vercel.com](https://vercel.com).
3.  **Code Pushed to GitHub**: The application code must be pushed to a GitHub repository.

## Step 1: Push Code to GitHub

If you haven't already, initialize a git repository and push your code:

```bash
git init
git add .
git commit -m "Initial commit for deployment"
# Replace <your-repo-url> with your actual GitHub repository URL
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## Step 2: Set up a Database

You need a PostgreSQL database accessible from the internet.

**Option A: Vercel Postgres (Recommended for ease of use)**
1.  Go to the Vercel Dashboard and select "Storage".
2.  Create a newly Postgres database.
3.  Choose a region (e.g., Tokyo `hnd1` if your users are in Japan).

**Option B: Neon or Supabase**
1.  Create an account on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2.  Create a new project/database.
3.  Get the **Connection String** (it starts with `postgres://...` or `postgresql://...`).

## Step 3: Deploy Project on Vercel

1.  Go to the Vercel Dashboard and click **"Add New..."** -> **"Project"**.
2.  Select your GitHub repository for this project.
3.  **Configure Project**:
    *   **Framework Preset**: Next.js (should be auto-detected).
    *   **Root Directory**: `./` (default).
    *   **Build Command**: `next build` (default).
    *   **Install Command**: `npm install` (default).
4.  **Environment Variables**:
    *   Expand the "Environment Variables" section.
    *   Add the following variables:
        *   `DATABASE_URL`: The connection string for your production database (from Step 2).
        *   `NEXTAUTH_SECRET`: Generate a random string (e.g., using `openssl rand -base64 32`) and paste it here.
        *   `NEXTAUTH_URL`: Set this to your production URL (e.g., `https://your-project.vercel.app`) once you know it, or leave it for Vercel to handle automatically (NextAuth.js v5 often handles this, but setting it is safer).
        *   *(Optional)* `AUTH_TRUST_HOST`: Set to `true` if deploying behind a proxy or on Vercel to trust the host header.

5.  Click **"Deploy"**.

## Step 4: Run Database Migrations

Once the deployment starts (or finishes), you need to apply your database schema to the new production database.

**From your local machine:**
1.  Create a `.env.production` file (or just set the var temporarily) with your *production* `DATABASE_URL`.
    ```bash
    # Example command to run migration against production DB
    DATABASE_URL="your_production_db_connection_string" npx prisma migrate deploy
    ```
2.  This command pushes the SQL schema to your production database without resetting data.

**Alternatively (via Vercel Build Step - Advanced):**
You can add `npx prisma migrate deploy` to the build command, but running it manually or via a separate CI/CD step is often safer to avoid accidental schema changes during simple deployments.

## Step 5: Verify Deployment

1.  Visit the URL provided by Vercel (e.g., `https://reservation-site.vercel.app`).
2.  Try to **Register** a new administrator account (since your local DB data wasn't copied).
3.  Test the flows (Instructor dashboard, Student dashboard).

## Troubleshooting

*   **Database Connection Errors**: Check if `DATABASE_URL` is correct and if the database accepts connections from Vercel IPs (Neon/Vercel Postgres allow all by default).
*   **Login Issues**: Ensure `NEXTAUTH_SECRET` is set. Check Vercel Function logs for error details.
