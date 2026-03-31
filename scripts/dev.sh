#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
#  LifeReplay – Start Development Servers
# ──────────────────────────────────────────────────────────────────────
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

cleanup() {
  echo -e "\n${CYAN}Shutting down...${NC}"
  kill 0
}
trap cleanup SIGINT SIGTERM

echo -e "${CYAN}Starting LifeReplay in development mode...${NC}"

# Load .env
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# ── Backend ───────────────────────────────────────────────────────────
echo -e "${GREEN}[backend]${NC} Starting FastAPI on :8000"
cd backend
source venv/bin/activate 2>/dev/null || true
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug &
BACKEND_PID=$!
cd ..

sleep 2

# ── Frontend ──────────────────────────────────────────────────────────
echo -e "${GREEN}[frontend]${NC} Starting Next.js on :3000"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "  ${CYAN}Backend:  ${NC}http://localhost:8000"
echo -e "  ${CYAN}Frontend: ${NC}http://localhost:3000"
echo -e "  ${CYAN}API Docs: ${NC}http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

wait
