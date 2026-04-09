#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Creating users (if not exists)..."
python scripts/create_user.py admin@bagaggio.com admin admin123 admin || true
python scripts/create_user.py editor@bagaggio.com editor editor123 editor || true
python scripts/create_user.py leitor@bagaggio.com leitor leitor123 leitor || true

echo "Seeding products (if table is empty)..."
python scripts/seed_products.py || true

echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
