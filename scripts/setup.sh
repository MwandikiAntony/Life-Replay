#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
#  LifeReplay – Local Development Setup Script
# ──────────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${CYAN}[info]${NC} $1"; }
ok()    { echo -e "${GREEN}[ok]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       LifeReplay – Setup Script        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# ── Check prerequisites ───────────────────────────────────────────────
info "Checking prerequisites..."
command -v python3 >/dev/null 2>&1 || error "Python 3.10+ required"
command -v node >/dev/null 2>&1    || error "Node.js 18+ required"
command -v npm >/dev/null 2>&1     || error "npm required"

PYTHON_VER=$(python3 --version | cut -d' ' -f2)
NODE_VER=$(node --version)
info "Python: $PYTHON_VER | Node: $NODE_VER"

# ── .env check ────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  warn ".env not found, copying from template..."
  cp .env.example .env 2>/dev/null || true
  warn "Please edit .env and set GEMINI_API_KEY before running"
fi

# ── Backend setup ─────────────────────────────────────────────────────
info "Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
  python3 -m venv venv
  ok "Virtual environment created"
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
ok "Backend dependencies installed"

cd ..

# ── Frontend setup ────────────────────────────────────────────────────
info "Setting up frontend..."
cd frontend
npm install --legacy-peer-deps --silent
ok "Frontend dependencies installed"

cd ..

echo ""
ok "Setup complete!"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo "  1. Edit .env and set your GEMINI_API_KEY"
echo "  2. Place your aiplatform-sa-key.json in backend/"
echo "  3. Run: ${CYAN}./scripts/dev.sh${NC}"
echo ""
