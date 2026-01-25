#!/bin/sh
# Fix cache permission issues for npx/npm
export HOME=/tmp

# Run migration
echo "Running prisma migrate deploy..."
npx prisma migrate deploy
