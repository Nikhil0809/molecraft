# Vercel Deployment Guide for Molecraft

This document provides step-by-step instructions for deploying the Molecraft Next.js workspaces monorepo onto the **Vercel Platform**. 

The monorepo contains two primary Next.js applications:
1. **Molecraft Web Application** (`apps/web`) - The main frontend and API server.
2. **RAG Admin Panel** (`apps/rag-admin`) - The administration interface.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Method A: Deploy via Vercel Web Dashboard (Recommended)](#method-a-deploy-via-vercel-web-dashboard-recommended)
3. [Method B: Deploy via Vercel CLI (Local Command Line)](#method-b-deploy-via-vercel-cli-local-command-line)
4. [Environment Variables Checklist](#environment-variables-checklist)
5. [Database Table Initialization (Migrations)](#database-table-initialization-migrations)
6. [Microservices & AI Model APIs Configuration](#microservices--ai-model-apis-configuration)

---

## Prerequisites

Before deploying, ensure you have:
* A **Vercel Account** (linked to your GitHub, GitLab, or Bitbucket account).
* A **Neon Postgres Database** instance. (Ensure you have the `DATABASE_URL` connection string).
* **API Keys** for Groq, Tavily, and Chroma Cloud (if using).

---

## Method A: Deploy via Vercel Web Dashboard (Recommended)

Using the Vercel Dashboard is the simplest way to configure continuous integration and automated deployments.

### Step 1: Import the Repository
1. Log in to the [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project**.
3. Select your git repository provider and import the `molecraft` repository.

### Step 2: Configure Project Settings
In the configuration screen, adjust the following settings:

* **Framework Preset**: `Next.js`
* **Root Directory**: Click *Edit* and select **`apps/web`** (or `apps/rag-admin` if deploying the admin panel).
* **Include files outside of the Root Directory in the Build Step**: Make sure this checkbox is **Checked** (Enabled). This allows Vercel to access the root workspace configuration and shared `node_modules` during the build phase.
* **Build Command**: Set to `next build --webpack` (Vercel may automatically override this to run NPM workspaces build).
* **Output Directory**: `.next`

### Step 3: Add Environment Variables
Scroll down to the **Environment Variables** section and add the keys listed in the [Environment Variables Checklist](#environment-variables-checklist) below.

### Step 4: Deploy
Click **Deploy**. Vercel will build the application and provide you with a production URL (e.g., `https://molecraft.vercel.app`).

---

## Method B: Deploy via Vercel CLI (Local Command Line)

If you prefer deploying directly from your terminal or setting up custom build scripts, you can use the Vercel CLI.

### Step 1: Install Vercel CLI
Ensure you have Node.js installed, then install the Vercel CLI globally or run it via `npx`:
```bash
npm install -g vercel
# OR
# Just use `npx vercel` for commands
```

### Step 2: Log In to Vercel
Authenticate with your Vercel account:
```bash
npx vercel login
```
This will open a browser window to complete the OAuth authentication flow.

### Step 3: Link Project
Navigate to the root directory of your monorepo and link it to Vercel:
```bash
npx vercel link
```
Follow the interactive prompts:
* Set up and deploy: **Yes**
* Which scope?: **Select your personal/team scope**
* Link to existing project?: **No**
* What's your project's name?: `molecraft-web`
* In which directory is your code located?: `./apps/web` (or `./apps/rag-admin`)

### Step 4: Configure Environment Variables
You can add environment variables via the Vercel CLI or through the Vercel Dashboard project settings. To add a variable via the CLI:
```bash
npx vercel env add DATABASE_URL
```

### Step 5: Deploy
* For a **Preview deployment**:
  ```bash
  npx vercel deploy
  ```
* For a **Production deployment**:
  ```bash
  npx vercel deploy --prod
  ```

---

## Environment Variables Checklist

Ensure these variables are defined in your Vercel Project Settings for **`apps/web`**:

| Variable Name | Example / Source | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:...` | Neon Postgres Connection string (required) |
| `SESSION_SECRET` | `your-secure-session-secret-key` | Secret key for auth sessions (required) |
| `GROQ_API_KEY` | `gsk_...` | Groq API Key for LLM reasoning (required) |
| `GROQ_MODEL` | `mixtral-8x7b-32768` | Model ID to use (required) |
| `TAVILY_API_KEY` | `tvly-dev-...` | Tavily API Key for live web/literature search (required) |
| `EMBEDDING_PROVIDER` | `local` / `openai` | Choose how embeddings are generated (defaults to `local`) |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI Embedding model ID (if provider is `openai`) |
| `CHROMA_HOST` | `api.trychroma.com` | Chroma Cloud API Host (required for cloud vector DB) |
| `CHROMA_TENANT` | `your-tenant-uuid` | Chroma Cloud Tenant ID (required) |
| `CHROMA_DATABASE` | `molecraft` | Chroma Cloud Database Name (required) |
| `CHROMA_COLLECTION` | `molecraft` | Chroma Cloud Collection Name (required) |
| `CHROMA_API_KEY` | `ck-...` | Chroma Cloud API Key (required) |
| `PUBMED_API_KEY` | `your-ncbi-key-here` | NCBI PubMed API Key for higher query limits (optional) |

---

## Database Table Initialization (Migrations)

Once the application is successfully deployed and the `DATABASE_URL` environment variable is configured:
1. Open your browser and navigate to the migration API endpoint of your live site:
   ```
   https://<your-project-domain>.vercel.app/api/migrate
   ```
2. You will receive a JSON response indicating whether the table schemas were successfully initialized:
   ```json
   { "success": true, "message": "Migration completed successfully" }
   ```
   This initializes all core application tables: `projects`, `notifications`, `team_members`, `invoices`, `api_keys`, `conversations`, and `chat_messages`.

---

## Microservices & AI Model APIs Configuration

> [!WARNING]
> **Vercel Serverless & Localhost APIs**:
> In local development (`.env.local`), APIs are configured to point to `localhost` (e.g., `MODEL_API_URL=http://localhost:8001`). When running in Vercel's serverless environment, local ports will not be accessible.

To run the full suite of AI models (molecule generator, docking, simulation, etc.) in production:
1. **Deploy Model Servers**: Deploy the python scripts inside `/models` as separate services on a cloud host (such as AWS EC2, GCP Cloud Run, Render, or Fly.io).
2. **Update URLs**: Update the corresponding API URL environment variables on Vercel to point to those live public endpoints instead of `localhost`:
   * `MODEL_API_URL`
   * `GENERATIVE_API_URL`
   * `RAG_API_URL`
   * `QNA_API_URL`
   * `INGESTION_API_URL`
   * `OMICS_API_URL`
   * `ANTIBODY_API_URL`
   * `PROTAC_API_URL`
   * `RNA_API_URL`
   * `PEPTIDE_API_URL`
   * `CLINICAL_API_URL`
   * `LAB_API_URL`
   * `PHYSICS_API_URL`
   * `PATENT_API_URL`
