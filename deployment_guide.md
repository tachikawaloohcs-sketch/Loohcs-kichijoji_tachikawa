# Easiest Google Cloud Deployment Guide

This guide uses a custom script (`deploy.sh`) to automate the complex deployment commands. You only need to answer a few questions.

## Prerequisites

1.  **Google Cloud Project**: An active GCP project.
2.  **Google Cloud SDK**: `gcloud` CLI installed and logged in (`gcloud auth login`).
3.  **Cloud SQL**: A PostgreSQL instance created and a database named `reservation-db` inside it.

## Deployment Steps

1.  **Open Terminal**: Navigate to the `reservation-site` folder.
2.  **Run the Script**:
    Copy and paste this command:
    ```bash
    sh deploy.sh
    ```
3.  **Answer the Questions**:
    The script will ask you for:
    - **Project ID**: Your Google Cloud Project ID.
    - **Region**: Press Enter to use `asia-northeast1`.
    - **Cloud SQL Connection Name**: (e.g., `my-project:asia-northeast1:my-db`)
    - **DB Password**: The password you set for the database.
4.  **Wait**: The script will upload your code and deploy the app.

## Done!
When it finishes, it will show you the **Service URL**. Click it to verify your website.
