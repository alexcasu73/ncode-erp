#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  Ncode ERP - Setup Script
#  Supported OS: Ubuntu / Debian Linux
#  Infrastructure: Nginx + PM2 + Supabase (Docker)
# ============================================================================

APP_NAME="ncode-erp"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_USER="${SUDO_USER:-$USER}"
SERVER_PORT=3001
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}"
SSL_DIR="/etc/ssl/${APP_NAME}"
LOG_DIR="${APP_DIR}/server/logs"
ECOSYSTEM="${APP_DIR}/ecosystem.config.cjs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
#  Utility functions
# ============================================================================

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()     { echo -e "${RED}[ERROR]${NC} $*"; }
section() { echo -e "\n${CYAN}══════════════════════════════════════════════════════${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}══════════════════════════════════════════════════════${NC}\n"; }

confirm() {
    local msg="$1"
    local response
    read -rp "$(echo -e "${YELLOW}$msg [y/N]:${NC} ")" response
    [[ "$response" =~ ^[yY]$ ]]
}

run_as_user() {
    sudo -u "$APP_USER" -- bash -c "cd '$APP_DIR' && $*"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        err "This script must be run with sudo"
        echo "Usage: sudo ./setup.sh <command>"
        exit 1
    fi
}

# ============================================================================
#  INSTALL
# ============================================================================

install_nodejs() {
    section "1/12 - Node.js 20 LTS"
    if command -v node &>/dev/null && node -v | grep -q "^v20"; then
        ok "Node.js $(node -v) already installed"
        return
    fi
    info "Installing Node.js 20 LTS via NodeSource..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null || true
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y -qq nodejs
    ok "Node.js $(node -v) installed"
}

install_docker() {
    section "2/12 - Docker & Docker Compose"
    if command -v docker &>/dev/null; then
        ok "Docker already installed: $(docker --version)"
    else
        info "Installing Docker..."
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
            https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
            > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        ok "Docker installed"
    fi
    if ! groups "$APP_USER" | grep -q docker; then
        info "Adding $APP_USER to docker group..."
        usermod -aG docker "$APP_USER"
        ok "User $APP_USER added to docker group (re-login required for non-sudo usage)"
    fi
}

install_supabase() {
    section "3/12 - Supabase CLI & Start"
    if command -v supabase &>/dev/null; then
        ok "Supabase CLI already installed"
    else
        info "Installing Supabase CLI..."
        npm install -g supabase
        ok "Supabase CLI installed"
    fi
    info "Starting Supabase (this may take a few minutes on first run)..."
    cd "$APP_DIR"
    run_as_user "supabase start" || true
    # Capture keys
    local sb_output
    sb_output=$(run_as_user "supabase status" 2>/dev/null || true)
    SUPABASE_URL=$(echo "$sb_output" | grep -oP 'API URL:\s+\K\S+' || echo "http://127.0.0.1:54321")
    SUPABASE_ANON_KEY=$(echo "$sb_output" | grep -oP 'anon key:\s+\K\S+' || echo "")
    SUPABASE_SERVICE_KEY=$(echo "$sb_output" | grep -oP 'service_role key:\s+\K\S+' || echo "")
    SUPABASE_DB_URL=$(echo "$sb_output" | grep -oP 'DB URL:\s+\K\S+' || echo "postgresql://postgres:postgres@localhost:54322/postgres")
    if [[ -n "$SUPABASE_ANON_KEY" ]]; then
        ok "Supabase running - keys captured"
    else
        warn "Could not capture Supabase keys automatically. You may need to run 'supabase status' and update .env manually."
    fi
}

install_dependencies() {
    section "4/12 - npm install"
    info "Installing root dependencies..."
    run_as_user "npm install"
    info "Installing server dependencies..."
    run_as_user "cd server && npm install"
    ok "Dependencies installed"
}

install_pm2() {
    section "5/12 - PM2"
    if command -v pm2 &>/dev/null; then
        ok "PM2 already installed"
    else
        info "Installing PM2 globally..."
        npm install -g pm2
        ok "PM2 installed"
    fi
    info "Configuring PM2 startup..."
    pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || true
    ok "PM2 startup configured"
}

generate_env() {
    section "6/12 - Environment configuration"
    local domain="${1:-localhost}"
    local scheme="https"

    # --- Root .env ---
    if [[ -f "$APP_DIR/.env" ]]; then
        warn "Root .env already exists, skipping generation"
    else
        info "Generating root .env..."
        cat > "$APP_DIR/.env" <<ENVEOF
# Supabase Configuration
VITE_SUPABASE_URL=${SUPABASE_URL:-http://127.0.0.1:54321}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-your-supabase-anon-key}

# API URL (via Nginx reverse proxy)
VITE_API_URL=${scheme}://${domain}/api
ENVEOF
        chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
        ok "Root .env generated"
    fi

    # --- Server .env ---
    if [[ -f "$APP_DIR/server/.env" ]]; then
        warn "Server .env already exists, skipping generation"
    else
        info "Generating server .env..."
        cat > "$APP_DIR/server/.env" <<ENVEOF
# Server Configuration
SERVER_PORT=${SERVER_PORT}
NODE_ENV=production

# Frontend URL (for CORS and email links)
FRONTEND_URL=${scheme}://${domain}

# Database (Supabase PostgreSQL)
DATABASE_URL=${SUPABASE_DB_URL:-postgresql://postgres:postgres@localhost:54322/postgres}

# Supabase Service Role Key (for admin operations)
SUPABASE_URL=${SUPABASE_URL:-http://127.0.0.1:54321}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY:-your-service-role-key}
ENVEOF
        chown "$APP_USER:$APP_USER" "$APP_DIR/server/.env"
        ok "Server .env generated"
    fi
}

build_frontend() {
    section "7/12 - Build frontend"
    info "Building frontend (vite build)..."
    run_as_user "npm run build"
    ok "Frontend built -> dist/"
}

create_ecosystem() {
    section "8/12 - PM2 ecosystem config"
    mkdir -p "$LOG_DIR"
    chown "$APP_USER:$APP_USER" "$LOG_DIR"

    cat > "$ECOSYSTEM" <<'JSEOF'
module.exports = {
  apps: [{
    name: 'ncode-erp',
    cwd: './server',
    script: 'src/index.js',
    interpreter: 'node',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '../server/logs/err.log',
    out_file: '../server/logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
JSEOF
    chown "$APP_USER:$APP_USER" "$ECOSYSTEM"
    ok "ecosystem.config.cjs created"
}

install_nginx() {
    section "9/12 - Nginx"
    if command -v nginx &>/dev/null; then
        ok "Nginx already installed"
    else
        info "Installing Nginx..."
        apt-get install -y -qq nginx
        ok "Nginx installed"
    fi
}

install_ssl() {
    section "10/12 - SSL certificates"
    local domain="${1:-}"

    if [[ -n "$domain" ]]; then
        info "Setting up Let's Encrypt SSL for $domain..."
        if ! command -v certbot &>/dev/null; then
            apt-get install -y -qq certbot python3-certbot-nginx
        fi
        certbot --nginx -d "$domain" --non-interactive --agree-tos \
            --register-unsafely-without-email --redirect || {
            warn "Certbot failed. You may need to run it manually after DNS is configured."
            warn "Command: sudo certbot --nginx -d $domain"
            return
        }
        # Auto-renewal cron (certbot usually sets this up, but ensure it)
        if ! crontab -l 2>/dev/null | grep -q certbot; then
            (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
        fi
        ok "Let's Encrypt SSL configured with auto-renewal"
        SSL_CERT="/etc/letsencrypt/live/${domain}/fullchain.pem"
        SSL_KEY="/etc/letsencrypt/live/${domain}/privkey.pem"
    else
        info "No domain specified, generating self-signed certificate..."
        mkdir -p "$SSL_DIR"
        if [[ -f "$SSL_DIR/cert.pem" ]]; then
            ok "Self-signed certificate already exists"
        else
            openssl req -x509 -nodes -days 365 \
                -newkey rsa:2048 \
                -keyout "$SSL_DIR/key.pem" \
                -out "$SSL_DIR/cert.pem" \
                -subj "/C=IT/ST=Local/L=Local/O=Ncode/CN=localhost" 2>/dev/null
            ok "Self-signed certificate generated"
        fi
        SSL_CERT="$SSL_DIR/cert.pem"
        SSL_KEY="$SSL_DIR/key.pem"
    fi
}

configure_nginx() {
    section "11/12 - Nginx configuration"
    local domain="${1:-localhost}"
    local server_name="$domain"
    [[ "$domain" == "localhost" ]] && server_name="_"

    cat > "$NGINX_CONF" <<NGINXEOF
# Ncode ERP - Nginx configuration
# Generated by setup.sh

server {
    listen 80;
    server_name ${server_name};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${server_name};

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root ${APP_DIR}/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90;
    }

    # Static assets - aggressive caching (Vite hashed filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINXEOF

    # Enable site
    ln -sf "$NGINX_CONF" "$NGINX_LINK"

    # Remove default site if present
    rm -f /etc/nginx/sites-enabled/default

    # Test config
    nginx -t 2>/dev/null
    ok "Nginx configured for ${domain}"
}

start_services() {
    section "12/12 - Start services"
    info "Starting PM2..."
    run_as_user "cd '$APP_DIR' && pm2 start ecosystem.config.cjs"
    run_as_user "pm2 save"

    info "Reloading Nginx..."
    systemctl enable nginx 2>/dev/null || true
    systemctl reload nginx 2>/dev/null || systemctl start nginx
    ok "All services started"
}

print_summary() {
    local domain="${1:-localhost}"
    local scheme="https"

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           Ncode ERP - Installation Complete              ║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  URL:     ${CYAN}${scheme}://${domain}${NC}                "
    echo -e "${GREEN}║${NC}  API:     ${CYAN}${scheme}://${domain}/api/health${NC}     "
    echo -e "${GREEN}║${NC}                                                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Useful commands:                                         ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    pm2 status              - Process status               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    pm2 logs ncode-erp      - View logs                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    pm2 restart ncode-erp   - Restart backend              ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    sudo ./setup.sh status  - Full status check            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}    sudo ./setup.sh update  - Pull, build & restart        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                           ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

do_install() {
    local domain=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --domain)
                domain="$2"
                shift 2
                ;;
            *)
                err "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    section "Ncode ERP - Installation"
    info "App directory: $APP_DIR"
    info "App user: $APP_USER"
    [[ -n "$domain" ]] && info "Domain: $domain" || info "Domain: localhost (self-signed SSL)"
    echo ""

    if ! confirm "Proceed with installation?"; then
        info "Installation cancelled."
        exit 0
    fi

    # Initialize key variables
    SUPABASE_URL=""
    SUPABASE_ANON_KEY=""
    SUPABASE_SERVICE_KEY=""
    SUPABASE_DB_URL=""
    SSL_CERT=""
    SSL_KEY=""

    install_nodejs
    install_docker
    install_supabase
    install_dependencies
    install_pm2
    generate_env "${domain:-localhost}"
    build_frontend
    create_ecosystem
    install_nginx
    install_ssl "$domain"
    configure_nginx "${domain:-localhost}"
    start_services
    print_summary "${domain:-localhost}"
}

# ============================================================================
#  UNINSTALL
# ============================================================================

do_uninstall() {
    section "Ncode ERP - Uninstall"
    warn "This will remove Ncode ERP services and configuration."
    warn "Your .env files and dist/ folder will NOT be removed."
    echo ""

    if ! confirm "Are you sure you want to proceed?"; then
        info "Uninstall cancelled."
        exit 0
    fi

    # PM2 processes
    if confirm "Stop and remove PM2 processes?"; then
        info "Stopping PM2 processes..."
        run_as_user "pm2 stop all" 2>/dev/null || true
        run_as_user "pm2 delete all" 2>/dev/null || true
        run_as_user "pm2 save --force" 2>/dev/null || true
        [[ -f "$ECOSYSTEM" ]] && rm -f "$ECOSYSTEM"
        ok "PM2 processes removed"
    fi

    # Nginx
    if confirm "Remove Nginx configuration and uninstall Nginx?"; then
        info "Removing Nginx configuration..."
        rm -f "$NGINX_LINK" "$NGINX_CONF"
        systemctl stop nginx 2>/dev/null || true
        apt-get remove -y -qq nginx nginx-common 2>/dev/null || true
        ok "Nginx removed"
    fi

    # SSL certificates
    if confirm "Remove SSL certificates?"; then
        if [[ -d "$SSL_DIR" ]]; then
            rm -rf "$SSL_DIR"
            ok "Self-signed certificates removed"
        fi
        if command -v certbot &>/dev/null; then
            certbot delete --non-interactive --cert-name "$(ls /etc/letsencrypt/renewal/ 2>/dev/null | head -1 | sed 's/.conf$//')" 2>/dev/null || true
            ok "Certbot certificates cleaned up"
        fi
    fi

    # Supabase
    if confirm "Stop Supabase containers?"; then
        info "Stopping Supabase..."
        run_as_user "cd '$APP_DIR' && supabase stop" 2>/dev/null || true
        ok "Supabase stopped"
    fi

    # Certbot
    if confirm "Uninstall Certbot?"; then
        apt-get remove -y -qq certbot python3-certbot-nginx 2>/dev/null || true
        ok "Certbot removed"
    fi

    # node_modules
    if confirm "Remove node_modules (root + server)?"; then
        rm -rf "$APP_DIR/node_modules" "$APP_DIR/server/node_modules"
        ok "node_modules removed"
    fi

    # Logs
    if confirm "Remove server logs?"; then
        rm -rf "$LOG_DIR"
        ok "Server logs removed"
    fi

    echo ""
    ok "Uninstall complete."
    warn "Files preserved (delete manually if needed):"
    warn "  - $APP_DIR/.env"
    warn "  - $APP_DIR/server/.env"
    warn "  - $APP_DIR/dist/"
}

# ============================================================================
#  UPDATE
# ============================================================================

do_update() {
    section "Ncode ERP - Update"

    info "Pulling latest changes..."
    run_as_user "git pull"

    info "Installing dependencies (root)..."
    run_as_user "npm install"

    info "Installing dependencies (server)..."
    run_as_user "cd server && npm install"

    info "Building frontend..."
    run_as_user "npm run build"

    info "Restarting PM2 processes..."
    run_as_user "pm2 restart all"

    echo ""
    ok "Update complete!"
    echo ""
    run_as_user "pm2 status"
}

# ============================================================================
#  STATUS
# ============================================================================

do_status() {
    section "Ncode ERP - Status"

    # PM2
    echo -e "${CYAN}--- PM2 Processes ---${NC}"
    run_as_user "pm2 status" 2>/dev/null || warn "PM2 not running or not installed"
    echo ""

    # Nginx
    echo -e "${CYAN}--- Nginx ---${NC}"
    if systemctl is-active --quiet nginx 2>/dev/null; then
        ok "Nginx is running"
    else
        err "Nginx is stopped"
    fi
    echo ""

    # Supabase
    echo -e "${CYAN}--- Supabase ---${NC}"
    run_as_user "cd '$APP_DIR' && supabase status" 2>/dev/null || warn "Supabase not running"
    echo ""

    # SSL certificate expiry
    echo -e "${CYAN}--- SSL Certificate ---${NC}"
    if [[ -f "$SSL_DIR/cert.pem" ]]; then
        local expiry
        expiry=$(openssl x509 -enddate -noout -in "$SSL_DIR/cert.pem" 2>/dev/null | cut -d= -f2)
        info "Self-signed cert expires: $expiry"
    elif [[ -d /etc/letsencrypt/live ]]; then
        local domain_dir
        domain_dir=$(ls /etc/letsencrypt/live/ 2>/dev/null | head -1)
        if [[ -n "$domain_dir" ]]; then
            local expiry
            expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${domain_dir}/fullchain.pem" 2>/dev/null | cut -d= -f2)
            info "Let's Encrypt cert ($domain_dir) expires: $expiry"
        fi
    else
        warn "No SSL certificate found"
    fi
    echo ""

    # Health check
    echo -e "${CYAN}--- API Health Check ---${NC}"
    local health
    health=$(curl -sk --max-time 5 "https://localhost/api/health" 2>/dev/null || echo "FAIL")
    if echo "$health" | grep -q '"status"'; then
        ok "API healthy: $health"
    else
        err "API health check failed (is the server running?)"
    fi
    echo ""
}

# ============================================================================
#  MAIN
# ============================================================================

usage() {
    echo "Usage: sudo ./setup.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  install [--domain <domain>]  Install Ncode ERP (full stack)"
    echo "  uninstall                    Remove services and configuration"
    echo "  update                       Pull, build, and restart"
    echo "  status                       Show service status"
    echo ""
    echo "Examples:"
    echo "  sudo ./setup.sh install --domain erp.example.com"
    echo "  sudo ./setup.sh install"
    echo "  sudo ./setup.sh update"
    echo "  sudo ./setup.sh status"
    echo "  sudo ./setup.sh uninstall"
}

main() {
    if [[ $# -lt 1 ]]; then
        usage
        exit 1
    fi

    local command="$1"
    shift

    case "$command" in
        install)
            check_root
            do_install "$@"
            ;;
        uninstall)
            check_root
            do_uninstall
            ;;
        update)
            check_root
            do_update
            ;;
        status)
            check_root
            do_status
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            err "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
