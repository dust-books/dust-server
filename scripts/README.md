# Installation Scripts

This directory contains automated installation and management scripts for Dust server.

## Install Script

**Quick install on Ubuntu/Debian:**

```bash
curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/install.sh | sudo bash
```

### What it does:

- Detects your system architecture (x86_64 or ARM64)
- Downloads the latest release from GitHub
- Creates a dedicated system user (`dust`)
- Installs to `/opt/dust`
- Generates JWT secret automatically
- Prompts for media directory configuration
- Creates and configures systemd service
- Enables and starts the service
- Provides post-installation instructions

### Requirements:

- Ubuntu 20.04+ or Debian 10+
- Root access (via sudo)
- curl, tar, systemctl installed
- Internet connection

### What you'll be asked:

1. **Confirm installation** - Press Y to proceed
2. **Media directories** - Enter colon-separated paths (e.g., `/media/books:/media/comics`)
3. **Server port** - Default is 4001

### After installation:

The service will be running and accessible at `http://localhost:4001`

View status:
```bash
sudo systemctl status dust-server
```

View logs:
```bash
sudo journalctl -u dust-server -f
```

## Uninstall Script

**To uninstall:**

```bash
curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/uninstall.sh | sudo bash
```

### What it does:

- Stops and disables the systemd service
- Removes the service file
- Optionally removes installation directory (`/opt/dust`)
- Optionally removes the database and configuration
- Optionally removes the system user

### Interactive prompts:

The uninstaller will ask before:
- Removing installation directory and data
- Removing the system user

This gives you control over what to keep (e.g., for reinstallation or data backup).

## Manual Installation

If you prefer manual installation or need more control, see [UBUNTU-SETUP.md](../UBUNTU-SETUP.md) for detailed step-by-step instructions.

## Supported Platforms

- Ubuntu 20.04+
- Debian 10+
- x86_64 (AMD/Intel)
- ARM64/aarch64 (Raspberry Pi, etc.)

## Security Notes

### Reviewing scripts before running:

While we encourage using the one-liner for convenience, you can review the script before running:

```bash
# Download and review
curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/install.sh > install.sh
less install.sh

# Run after review
sudo bash install.sh
```

### What the scripts do:

- **No external dependencies** - Only uses standard tools (curl, tar, systemctl)
- **No telemetry** - Scripts don't send any data anywhere
- **Idempotent** - Safe to run multiple times
- **Open source** - Full source visible in this repository

## Troubleshooting

### "Permission denied"

Make sure you're running with sudo:
```bash
curl -fsSL https://raw.githubusercontent.com/dust-books/dust-server/main/scripts/install.sh | sudo bash
```

### "Architecture not supported"

Currently supported: x86_64, ARM64/aarch64

Check your architecture:
```bash
uname -m
```

### "Failed to download"

Check your internet connection and GitHub status. You can also download the release manually from:
https://github.com/dust-books/dust-server/releases/latest

### Service won't start

Check logs for details:
```bash
sudo journalctl -u dust-server -n 50 --no-pager
```

Common issues:
- Media directories don't exist or aren't readable
- Port already in use
- Insufficient permissions

## Development

### Testing the install script locally:

```bash
# From repository root
sudo bash scripts/install.sh
```

### Testing the uninstall script:

```bash
sudo bash scripts/uninstall.sh
```

## License

These scripts are part of the Dust server project and follow the same license.
