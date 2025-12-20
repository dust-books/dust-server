#!/bin/bash
#
# Dust Server Uninstallation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/uninstall.sh | sudo bash
#
# This script will:
# 1. Stop and disable the systemd service
# 2. Remove the service file
# 3. Optionally remove installation directory and data
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

# Functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

stop_and_disable_service() {
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_info "Stopping service..."
        systemctl stop "$SERVICE_NAME"
        print_success "Service stopped"
    fi
    
    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        print_info "Disabling service..."
        systemctl disable "$SERVICE_NAME"
        print_success "Service disabled"
    fi
}

remove_service_file() {
    local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
    
    if [ -f "$service_file" ]; then
        print_info "Removing service file..."
        rm "$service_file"
        systemctl daemon-reload
        print_success "Service file removed"
    fi
}

remove_installation() {
    if [ -d "$INSTALL_DIR" ]; then
        echo ""
        echo -e "${YELLOW}The following will be removed:${NC}"
        echo -e "  - Binary: $INSTALL_DIR/dust-server"
        echo -e "  - Config: $INSTALL_DIR/.env"
        echo -e "  - Data:   $INSTALL_DIR/data/ (includes database)"
        echo ""
        
        if [ -t 0 ]; then
            # Interactive mode
            read -p "Remove installation directory and all data? [y/N] " -n 1 -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_info "Removing installation directory..."
                rm -rf "$INSTALL_DIR"
                print_success "Installation directory removed"
            else
                print_info "Installation directory preserved at: $INSTALL_DIR"
                print_warning "To manually remove later: sudo rm -rf $INSTALL_DIR"
            fi
        else
            # Non-interactive mode - preserve data by default
            print_info "Installation directory preserved at: $INSTALL_DIR"
            print_warning "To manually remove: sudo rm -rf $INSTALL_DIR"
        fi
    fi
}

remove_user() {
    if id "$SERVICE_USER" &>/dev/null; then
        echo ""
        
        if [ -t 0 ]; then
            # Interactive mode
            read -p "Remove system user '$SERVICE_USER'? [y/N] " -n 1 -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_info "Removing user..."
                userdel "$SERVICE_USER" 2>/dev/null || true
                print_success "User removed"
            else
                print_info "User preserved"
            fi
        else
            # Non-interactive mode - preserve user by default
            print_info "User preserved"
        fi
    fi
}

print_completion_message() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Uninstallation Complete${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Dust server has been uninstalled."
    echo ""
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "  ${BLUE}Note:${NC} Installation directory was preserved"
        echo -e "  To remove manually: ${YELLOW}sudo rm -rf $INSTALL_DIR${NC}"
        echo ""
    fi
    
    echo -e "  To reinstall, run:"
    echo -e "  ${YELLOW}curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/install.sh | sudo bash${NC}"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Main uninstallation flow
main() {
    clear 2>/dev/null || echo -e "\n\n"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Dust Server Uninstaller${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    check_root
    
    # Check if Dust is installed
    if [ ! -f "$INSTALL_DIR/dust-server" ] && [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
        print_warning "Dust server does not appear to be installed"
        exit 0
    fi
    
    if [ -t 0 ]; then
        # Interactive mode
        echo -e "${YELLOW}WARNING: This will uninstall Dust server${NC}"
        echo ""
        read -p "Continue with uninstallation? [y/N] " -n 1 -r
        echo ""
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Uninstallation cancelled"
            exit 0
        fi
    else
        # Non-interactive mode
        print_info "Running in non-interactive mode. Proceeding with uninstallation..."
    fi
    
    echo ""
    stop_and_disable_service
    remove_service_file
    remove_installation
    remove_user
    print_completion_message
}

# Run main function
main "$@"
