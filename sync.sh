#!/bin/bash
# Sync con Lovable — siempre pull antes de push
set -e

echo "⬇ Pulling cambios de Lovable..."
git pull origin main --rebase

echo "⬆ Pushing al repo..."
git push origin main

echo "✓ Sync completo"
