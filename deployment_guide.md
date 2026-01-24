# Google Cloud Deployment Guide

This guide details the steps to deploy the Reservation Site to Google Cloud Run, connected to a Google Cloud SQL (PostgreSQL) database.

## Prerequisites

1.  **Google Cloud Project**: You need an active Google Cloud Platform (GCP) project.
2.  **Google Cloud SDK**: Install the `gcloud` CLI tool on your local machine.
3.  **Billing Enabled**: Ensure billing is enabled for your project.

## 1. Setup Environment Variables

Identify the necessary environment variables for your application. You will need to configure these in Cloud Run later.

- `DATABASE_URL`: Connection string for Cloud SQL (will be configured with a socket path).
- `AUTH_SECRET`: Secret key for NextAuth.js.
- `NEXTAUTH_URL`: The URL of your deployed service (you will get this after the first deployment, or you can map a custom domain).

## 2. Cloud SQL Setup (PostgreSQL)

1.  **Create Instance**:
    - Go to the **SQL** section in the Google Cloud Console.
    - Click **Create Instance** and choose **PostgreSQL**.
    - Set an **Instance ID** and **Password** for the `postgres` user.
    - Choose a **Region** (e.g., `asia-northeast1` for Tokyo).
    - Under **Configuration**, starting with a standard machine type (e.g., `db-f1-micro` or `Sandbox`) is recommended for cost saving during development.

2.  **Create Database**:
    - Once the instance is ready, go to the **Databases** tab.
    - Click **Create Database**.
    - Name it (e.g., `reservation-db`).

3.  **Get Connection Name**:
    - On the **Overview** page of your SQL instance, find the **Connection name**. It looks like `project-id:region:instance-id`. Copy this.

## 3. Artifact Registry Setup

1.  **Enable API**: Enable the **Artifact Registry API**.
2.  **Create Repository**:
    - Go to **Artifact Registry**.
    - Click **Create Repository**.
    - Name: `reservation-repo`.
    - Format: `Docker`.
    - Region: Same as your Cloud Run service (e.g., `asia-northeast1`).

3.  **Configure Docker**:
    Run the following command to authenticate Docker with GCP:
    ```bash
    gcloud auth configure-docker asia-northeast1-docker.pkg.dev
    ```
    *(Adjust the region if you chose something other than `asia-northeast1`)*

## 4. Build and Push Docker Image

1.  **Build**:
    Build the image locally. Replace `PROJECT_ID` with your actual project ID.
    ```bash
    docker build -t asia-northeast1-docker.pkg.dev/PROJECT_ID/reservation-repo/reservation-app:latest .
    platform linux/amd64
    ```
    *Note: `--platform linux/amd64` is important if building on an Apple Silicon Mac.*

2.  **Push**:
    Push the image to Artifact Registry.
    ```bash
    docker push asia-northeast1-docker.pkg.dev/PROJECT_ID/reservation-repo/reservation-app:latest
    ```

## 5. Deploy to Cloud Run

1.  **Deploy Command**:
    Run the following command, replacing placeholders.

    ```bash
    gcloud run deploy reservation-service \
      --image asia-northeast1-docker.pkg.dev/PROJECT_ID/reservation-repo/reservation-app:latest \
      --region asia-northeast1 \
      --platform managed \
      --allow-unauthenticated \
      --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_ID \
      --set-env-vars "DATABASE_URL=postgresql://postgres:PASSWORD@localhost/reservation-db?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_ID" \
      --set-env-vars "AUTH_SECRET=your-generated-secret-key"
    ```

    * **Important**: The `DATABASE_URL` format for Cloud Run with Cloud SQL uses a Unix socket: `host=/cloudsql/INSTANCE_CONNECTION_NAME`.

2.  **Migration**:
    You cannot run `npx prisma migrate deploy` directly inside the running container easily since it's a distroless/minimal image in production.
    **Recommended approach for migrations**:
    - Connect to the Cloud SQL instance from your local machine using **Cloud SQL Auth Proxy**.
    - Run `npx prisma migrate deploy` locally pointing to the proxy.

    **Using Cloud SQL Auth Proxy**:
    ```bash
    # 1. Start Proxy
    ./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_ID

    # 2. Run Migration (in a separate terminal)
    DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/reservation-db" npx prisma migrate deploy
    ```

## 6. Verification

- Open the URL provided by the Cloud Run deployment output.
- Sign up/Login to verify database connection.
- Check Cloud Run logs for any errors.
