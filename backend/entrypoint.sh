#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

# Demo users and sample products are only created in development, or when
# SEED_DATA=true is set explicitly. Never seed default credentials in production.
SEED_DATA="${SEED_DATA:-$([ "$ENVIRONMENT" = "development" ] && echo true || echo false)}"

if [ "$SEED_DATA" = "true" ]; then
  echo "Creating demo users (if not exists)..."
  python scripts/create_user.py admin@productmanager.dev admin admin123 admin || true
  python scripts/create_user.py editor@productmanager.dev editor editor123 editor || true
  python scripts/create_user.py leitor@productmanager.dev leitor leitor123 leitor || true

  echo "Seeding products (if table is empty)..."
  python scripts/seed_products.py || true
else
  echo "Skipping demo data (ENVIRONMENT=$ENVIRONMENT, SEED_DATA=$SEED_DATA)."
fi

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
