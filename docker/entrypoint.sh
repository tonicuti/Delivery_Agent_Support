#!/bin/sh
# One-time (idempotent) database preparation, then hand over to the backend CLI.
set -e
python /app/docker/init_db.py
exec backend "$@"
