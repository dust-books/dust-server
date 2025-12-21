#!/bin/bash
#
# Dust Server Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/install.sh | bash
#
# This script will:
# 1. Detect your system architecture
# 2. Download the latest Dust server binary
# 3. Install it to /opt/dust
# 4. Set up systemd service
# 5. Configure environment variables
#

set -e

# Handle unknown terminal types gracefully
if [ -n "$TERM" ] && ! tput clear >/dev/null 2>&1; then
    export TERM=xterm
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/dust"
SERVICE_USER="dust"
SERVICE_NAME="dust-server"
GITHUB_REPO="dust-books/dust-server"

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_dependencies() {
    local missing_deps=()
    
    for cmd in curl tar systemctl; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        print_info "Install them with: apt-get install ${missing_deps[*]}"
        exit 1
    fi
}

install_runtime_dependencies() {
    print_info "Installing runtime dependencies..."
    
    # Check if we need to install packages
    local packages_to_install=()
    
    # Check for musl
    if ! ldconfig -p | grep -q "musl"; then
        packages_to_install+=("musl")
    fi
    
    if [ ${#packages_to_install[@]} -ne 0 ]; then
        print_info "Installing: ${packages_to_install[*]}"
        apt-get update -qq
        apt-get install -y -qq ${packages_to_install[*]}
        print_success "Dependencies installed"
    else
        print_success "All dependencies already installed"
    fi
    
    print_info "SQLite is bundled with the binary (no system installation needed)"
}

detect_architecture() {
    local arch=$(uname -m)
    
    case "$arch" in
        x86_64)
            echo "linux-x86_64"
            ;;
        aarch64|arm64)
            echo "linux-aarch64"
            ;;
        *)
            print_error "Unsupported architecture: $arch"
            print_info "Supported: x86_64, aarch64"
            exit 1
            ;;
    esac
}

get_latest_version() {
    local version=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$version" ]; then
        print_error "Failed to fetch latest version"
        exit 1
    fi
    
    echo "$version"
}

create_user() {
    if id "$SERVICE_USER" &>/dev/null; then
        print_info "User '$SERVICE_USER' already exists"
    else
        print_info "Creating system user '$SERVICE_USER'..."
        useradd --system --shell /bin/bash --home "$INSTALL_DIR" "$SERVICE_USER"
        print_success "User created"
    fi
}

download_and_install() {
    local arch=$1
    local version=$2
    local filename="dust-server-${arch}.tar.gz"
    local download_url="https://github.com/${GITHUB_REPO}/releases/download/${version}/${filename}"
    
    print_info "Downloading Dust server ${version} for ${arch}..."
    
    # Check if this is an upgrade (service already exists and running)
    local is_upgrade=false
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        is_upgrade=true
        print_info "Detected existing installation, stopping service..."
        systemctl stop "$SERVICE_NAME"
    fi
    
    # Create temporary directory
    local tmp_dir=$(mktemp -d)
    cd "$tmp_dir"
    
    # Download
    if ! curl -fsSL "$download_url" -o "$filename"; then
        print_error "Failed to download from $download_url"
        rm -rf "$tmp_dir"
        # Restart service if it was running
        if [ "$is_upgrade" = true ]; then
            systemctl start "$SERVICE_NAME"
        fi
        exit 1
    fi
    
    print_success "Downloaded successfully"
    
    # Create install directory
    print_info "Installing to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/data"
    
    # Extract
    tar -xzf "$filename" -C "$INSTALL_DIR/"
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR/dust-server"
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$tmp_dir"
    
    print_success "Installed to $INSTALL_DIR"
    
    # Restart service if it was an upgrade
    if [ "$is_upgrade" = true ]; then
        print_info "Restarting service..."
        systemctl start "$SERVICE_NAME"
        sleep 2
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_success "Service restarted successfully"
        else
            print_warning "Service may not have restarted properly"
            print_info "Check logs with: journalctl -u $SERVICE_NAME -n 50"
        fi
    fi
}

configure_environment() {
    local env_file="$INSTALL_DIR/.env"
    
    if [ -f "$env_file" ]; then
        print_warning "Environment file already exists at $env_file"
        print_info "Skipping environment setup (existing config preserved)"
        return
    fi
    
    print_info "Configuring environment..."
    
    # Generate JWT secret
    local jwt_secret=$(openssl rand -base64 32)
    
    # Prompt for media directories
    local media_dirs
    local port
    
    if [ -t 0 ]; then
        # Interactive mode
        echo ""
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}  Configuration${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        read -p "Enter directories to scan for media (colon-separated) [/media/books:/media/comics]: " media_dirs
        media_dirs=${media_dirs:-/media/books:/media/comics}
        
        read -p "Enter server port [4001]: " port
        port=${port:-4001}
        echo ""
    else
        # Non-interactive mode - use defaults
        media_dirs="/media/books:/media/comics"
        port=4001
        print_info "Using default media directories: $media_dirs"
        print_info "Using default port: $port"
    fi
    
    # Create environment file
    cat > "$env_file" <<EOF
# Dust Server Environment Variables
# Generated on $(date)

# REQUIRED: JWT Secret for authentication
JWT_SECRET=$jwt_secret

# REQUIRED: Directories to scan for books/comics (colon-separated)
DUST_DIRS=$media_dirs

# Server port
PORT=$port

# Database path
DATABASE_URL=file:$INSTALL_DIR/data/dust.db

# OPTIONAL: Google Books API key for enhanced metadata fetching
# Get your API key from: https://developers.google.com/books/docs/v1/using#APIKey
# GOOGLE_BOOKS_API_KEY=your-google-books-api-key-here
EOF
    
    chown "$SERVICE_USER:$SERVICE_USER" "$env_file"
    chmod 600 "$env_file"
    
    print_success "Environment configured"
    
    # Show configured directories
    print_info "Configured media directories: $media_dirs"
    
    # Set up media directory permissions
    setup_media_permissions "$media_dirs"
}

setup_media_permissions() {
    local media_dirs=$1
    
    print_info "Setting up media directory permissions..."
    
    # Split colon-separated paths
    IFS=':' read -ra DIRS <<< "$media_dirs"
    
    for dir in "${DIRS[@]}"; do
        # Trim whitespace
        dir=$(echo "$dir" | xargs)
        
        if [ -d "$dir" ]; then
            # Add read/execute permissions for the dust user
            # We use ACLs if available, otherwise fall back to group permissions
            if command -v setfacl &> /dev/null; then
                print_info "Adding ACL permissions for $dir"
                setfacl -R -m u:$SERVICE_USER:rX "$dir" 2>/dev/null || {
                    print_warning "Failed to set ACLs on $dir - trying group permissions"
                    # Fall back to adding dust user to the directory owner's group
                    local dir_owner=$(stat -c '%U' "$dir")
                    local dir_group=$(stat -c '%G' "$dir")
                    usermod -aG "$dir_group" "$SERVICE_USER" 2>/dev/null || true
                }
            else
                print_info "Adding group permissions for $dir"
                # No setfacl, use group permissions
                local dir_group=$(stat -c '%G' "$dir")
                usermod -aG "$dir_group" "$SERVICE_USER" 2>/dev/null || {
                    print_warning "Could not add $SERVICE_USER to group $dir_group"
                    print_warning "You may need to manually grant access to $dir"
                }
            fi
            print_success "Configured permissions for $dir"
        else
            print_warning "Directory does not exist: $dir"
            print_info "Please create it and ensure $SERVICE_USER can read it"
        fi
    done
    
    print_info "Media directory permissions configured"
    print_info "Note: If you still see permission errors, you may need to:"
    print_info "  sudo chmod -R +rX /path/to/media"
    print_info "  Or: sudo chown -R $SERVICE_USER:$SERVICE_USER /path/to/media"
}

create_systemd_service() {
    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
    
    print_info "Creating systemd service..."
    
    # Read media directories from env file
    local media_dirs=$(grep "^DUST_DIRS=" "$INSTALL_DIR/.env" | cut -d'=' -f2)
    local readonly_paths=""
    
    # Convert colon-separated dirs to space-separated for ReadOnlyPaths
    if [ -n "$media_dirs" ]; then
        readonly_paths=$(echo "$media_dirs" | tr ':' ' ')
    fi
    
    cat > "$service_file" <<EOF
[Unit]
Description=Dust Media Server
After=network.target
Documentation=https://github.com/dust-books/dust-server

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
Environment="LD_LIBRARY_PATH=$INSTALL_DIR"
ExecStart=$INSTALL_DIR/dust-server

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/data

# Allow access to media directories
ReadOnlyPaths=$readonly_paths

# Restart configuration
Restart=on-failure
RestartSec=5s

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF
    
    print_success "Systemd service created"
}

enable_and_start_service() {
    print_info "Enabling and starting service..."
    
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    if systemctl start "$SERVICE_NAME"; then
        print_success "Service started successfully"
    else
        print_error "Failed to start service"
        print_info "Check logs with: journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
    
    # Wait a moment for service to initialize
    sleep 2
    
    # Check service status
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_success "Service is running"
    else
        print_warning "Service may not be running properly"
        print_info "Check status with: systemctl status $SERVICE_NAME"
    fi
}

print_completion_message() {
    local port=$(grep "^PORT=" "$INSTALL_DIR/.env" | cut -d'=' -f2)
    port=${port:-4001}
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Dust server has been installed successfully!"
    echo ""
    echo -e "  ${BLUE}Service Management:${NC}"
    echo -e "    Start:   ${YELLOW}sudo systemctl start $SERVICE_NAME${NC}"
    echo -e "    Stop:    ${YELLOW}sudo systemctl stop $SERVICE_NAME${NC}"
    echo -e "    Restart: ${YELLOW}sudo systemctl restart $SERVICE_NAME${NC}"
    echo -e "    Status:  ${YELLOW}sudo systemctl status $SERVICE_NAME${NC}"
    echo -e "    Logs:    ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}"
    echo ""
    echo -e "  ${BLUE}Access:${NC}"
    echo -e "    Web Interface: ${YELLOW}http://localhost:$port${NC}"
    echo -e "    Health Check:  ${YELLOW}curl http://localhost:$port/health${NC}"
    echo ""
    echo -e "  ${BLUE}Configuration:${NC}"
    echo -e "    Config file:   ${YELLOW}$INSTALL_DIR/.env${NC}"
    echo -e "    Database:      ${YELLOW}$INSTALL_DIR/data/dust.db${NC}"
    echo -e "    Binary:        ${YELLOW}$INSTALL_DIR/dust-server${NC}"
    echo ""
    echo -e "  ${BLUE}Next Steps:${NC}"
    echo -e "    1. Create your admin account at http://localhost:$port"
    echo -e "    2. The server will automatically scan your media directories"
    echo -e "    3. Configure firewall if needed: ${YELLOW}sudo ufw allow $port/tcp${NC}"
    echo ""
    echo -e "  ${BLUE}Documentation:${NC}"
    echo -e "    https://github.com/$GITHUB_REPO"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Main installation flow
main() {
    clear 2>/dev/null || echo -e "\n\n"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Dust Server Installer${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    check_root
    check_dependencies
    install_runtime_dependencies
    
    print_info "Fetching latest release information..."
    local arch=$(detect_architecture)
    print_success "Detected architecture: $arch"
    
    local version=$(get_latest_version)
    print_success "Latest version: $version"
    
    echo ""
    if [ -t 0 ]; then
        # Interactive mode
        read -p "Install Dust server $version? [Y/n] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ -n $REPLY ]]; then
            print_info "Installation cancelled"
            exit 0
        fi
    else
        # Non-interactive mode (piped from curl)
        print_info "Running in non-interactive mode. Proceeding with installation..."
    fi
    
    echo ""
    create_user
    download_and_install "$arch" "$version"
    configure_environment
    create_systemd_service
    enable_and_start_service
    print_completion_message
}

# Run main function
main "$@"
