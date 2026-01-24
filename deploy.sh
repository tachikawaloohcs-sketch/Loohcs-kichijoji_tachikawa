#!/bin/bash

echo "========================================================"
echo "   Google Cloud Run Easy Deploy Script"
echo "========================================================"
echo ""

# 1. Ask for Project ID
read -p "Enter your Google Cloud Project ID: " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then echo "Project ID is required."; exit 1; fi

# 2. Ask for Region
read -p "Enter Region (default: asia-northeast1): " REGION
REGION=${REGION:-asia-northeast1}

# 3. Ask for Cloud SQL Connection Name
echo ""
echo "Find this in Cloud SQL Overview (Example: project-id:asia-northeast1:my-db)"
read -p "Enter Cloud SQL Connection Name: " INSTANCE_CONNECTION_NAME
if [ -z "$INSTANCE_CONNECTION_NAME" ]; then echo "Connection Name is required."; exit 1; fi

# 4. Ask for DB Password
echo ""
read -s -p "Enter DB Password for 'postgres' user: " DB_PASSWORD
echo ""

# 5. Generate Auth Secret if not provided
AUTH_SECRET=$(openssl rand -base64 32)
echo ""
echo "Generated a secure AUTH_SECRET for you."

echo ""
echo "========================================================"
echo "Starting Deployment..."
echo "Target: $PROJECT_ID / $REGION"
echo "Database: $INSTANCE_CONNECTION_NAME"
echo "========================================================"
echo ""

# Execute Deploy Command
gcloud run deploy reservation-service \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --project "$PROJECT_ID" \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "DATABASE_URL=postgresql://postgres:$DB_PASSWORD@localhost/reservation-db?host=/cloudsql/$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "AUTH_SECRET=$AUTH_SECRET"

echo ""
echo "Done!"
