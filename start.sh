#!/bin/bash

screen -S gamjo-cloud-backend -dm bash -c 'cd /home/nathangamache/projects/gamjo-cloud && source .venv/bin/activate && cd backend && uvicorn main:app --reload --port 8081'

screen -S gamjo-cloud-health -dm bash -c 'cd /home/nathangamache/projects/gamjo-cloud && source .venv/bin/activate && cd backend && HEALTH_HOST=0.0.0.0 python health_server.py'

screen -S gamjo-cloud-frontend -dm bash -c 'cd /home/nathangamache/projects/gamjo-cloud/frontend && npx vite --host 0.0.0.0 --port 5173'

echo "Started:"
echo "  Backend  -> screen -r gamjo-cloud-backend    (port 8081)"
echo "  Health   -> screen -r gamjo-cloud-health     (port 8082)"
echo "  Frontend -> screen -r gamjo-cloud-frontend   (port 5173)"
