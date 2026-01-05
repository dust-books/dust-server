# Dust Server - Docker Setup

Dust is a media server for ebooks and comics. This guide covers running the server using Docker.

## ⚠️ Required Configuration

**Before running the server, you MUST configure these settings:**

### 1. JWT Secret (REQUIRED)
```bash
# Generate a secure random string for JWT authentication
export JWT_SECRET=$(openssl rand -base64 32)
```

### 2. Book Directories
Create and configure directories containing your ebooks/comics:
```bash
mkdir -p ./books
# Add your book files to this directory
```

### 3. Environment Variables
Set up a `.env` file or export these variables:
```bash
# REQUIRED - JWT secret for authentication
JWT_SECRET=your-secure-random-string-here

# REQUIRED - Directories to scan for books (colon-separated, NOT comma-separated)
DUST_DIRS=/app/books

# OPTIONAL - Server port (default: 4001)
PORT=4001

# OPTIONAL - Database location (default: file:/app/data/dust.db)
DATABASE_URL=file:/app/data/dust.db

# OPTIONAL - Google Books API key for metadata enrichment
GOOGLE_BOOKS_API_KEY=your-api-key-here
```

## Quick Start

### Using Docker Compose (Recommended)

1. **Create environment file:**
```bash
# Clone the repository
git clone <repository-url>
cd dust

# Create .env file with required variables
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
DUST_DIRS=/app/books
PORT=4001
DATABASE_URL=file:/app/data/dust.db
# GOOGLE_BOOKS_API_KEY=your-api-key-here
EOF

# Create a directory for your books
mkdir -p ./books
```

2. **Start the server:**
```bash
# Development setup
docker-compose up -d

# View logs
docker-compose logs -f

# Access the server at http://localhost:4001
```

3. **Production setup:**
```bash
# Copy and customize production configuration
cp docker-compose.prod.yml docker-compose.override.yml

# Edit to set your actual book directories and environment
vim docker-compose.override.yml

# Start with production settings
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

### Using Docker directly

1. **Set up environment variables:**
```bash
# Generate JWT secret
export JWT_SECRET=$(openssl rand -base64 32)

# Set book directories
export BOOK_DIRS="/path/to/your/books"

# Optional: Set Google Books API key
export GOOGLE_BOOKS_API_KEY="your-api-key-here"
```

2. **Build the image:**
```bash
docker build -t dust-server:latest .
```

3. **Run the container:**
```bash
# Minimal setup (REQUIRED environment variables)
docker run -d \
  --name dust-server \
  -p 4001:4001 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e DUST_DIRS="/app/books" \
  -v "$BOOK_DIRS":/app/books:ro \
  -v dust_data:/app/data \
  dust-server:latest

# Full setup with all options
docker run -d \
  --name dust-server \
  -p 4001:4001 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e DUST_DIRS="/app/books:/app/comics" \
  -e PORT=4001 \
  -e DATABASE_URL="file:/app/data/dust.db" \
  -e GOOGLE_BOOKS_API_KEY="$GOOGLE_BOOKS_API_KEY" \
  -v /home/user/Books:/app/books:ro \
  -v /home/user/Comics:/app/comics:ro \
  -v dust_data:/app/data \
  --restart unless-stopped \
  dust-server:latest
```

## ⚙️ Complete Configuration Reference

### Environment Variables (Detailed)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **YES** | none | Secret key for JWT token signing. **Server will not start without this!** |
| `DUST_DIRS` | **YES** | `""` | Colon-separated list of directories to scan for books/comics (e.g., `/app/books:/app/comics`) |
| `PORT` | No | `4001` | Port number for the server |
| `DATABASE_URL` | No | `file:dust.db` | Database connection string (SQLite) |
| `GOOGLE_BOOKS_API_KEY` | No | none | Google Books API key for enhanced metadata |

### Volume Mounts (Required)

| Container Path | Purpose | Recommended Host Mount | Access |
|----------------|---------|------------------------|---------|
| `/app/books` | Primary book directory | `/path/to/your/books` | Read-only |
| `/app/comics` | Comics directory (if using) | `/path/to/your/comics` | Read-only |
| `/app/data` | Database and app data | `dust_data` (named volume) | Read-write |

### Port Mapping

- `4001:4001` - Web server port (or use custom port with `PORT` env var)

## ✅ Setup Validation

After starting the server, verify it's working correctly:

### 1. Health Check
```bash
curl http://localhost:4001/health
```
Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "service": "dust-server"
}
```

### 2. Check Server Logs
```bash
# For docker-compose
docker-compose logs dust-server

# For direct docker
docker logs dust-server
```
Look for these success messages:
- ✅ "Dust is bookin' it on port 4001"
- ✅ "Created tag: [various tags]"
- ✅ "Starting enhanced book discovery..."

### 3. Verify Book Scanning
Look for log messages like:
- ✅ "Found X files to process"
- ✅ "Finished processing X books"

### 4. Test Web Interface
Open http://localhost:4001 in your browser - you should see the Dust server page.

### 5. Quick Environment Check
```bash
# Verify environment variables are set
docker exec dust-server env | grep -E "(JWT_SECRET|dirs|PORT)"

# Check mounted volumes
docker exec dust-server ls -la /app/books
docker exec dust-server ls -la /app/data
```

## Supported File Formats

- **Ebooks**: EPUB, MOBI, AZW3, PDF
- **Comics**: CBR, CBZ, PDF

## File Organization

For best results, organize your files as:

```
books/
├── Author Name/
│   └── Book Title/
│       └── book.epub
└── Another Author/
    └── Another Book/
        └── 9781234567890.epub  # ISBN in filename for metadata lookup
```

## Troubleshooting

### ❌ "JWT_SECRET is required" or Authentication Errors
**Cause**: Missing or invalid JWT secret configuration

**Solutions**:
```bash
# Generate a new JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# For docker-compose: Add to .env file
echo "JWT_SECRET=$JWT_SECRET" >> .env

# For direct docker run: Add environment variable
docker run -e JWT_SECRET="$JWT_SECRET" ...
```

### ❌ Container won't start
**Checks**:
- View logs: `docker logs dust-server` or `docker-compose logs`
- Verify all required environment variables are set
- Ensure mounted directories exist and are readable
- Check if port 4001 is already in use: `lsof -i :4001`

### ❌ "No such file or directory" during startup
**Cause**: Book directories don't exist or are incorrectly mounted

**Solutions**:
```bash
# Create book directories on host
mkdir -p ./books

# Check volume mounts in docker-compose.yml
# Ensure host paths exist and container paths match `dirs` env var
```

### ❌ No books found / Empty library
**Checks**:
- Verify book directories are properly mounted: `docker exec dust-server ls -la /app/books`
- Check the `dirs` environment variable matches mounted paths
- Ensure book files are in supported formats (EPUB, PDF, MOBI, etc.)
- Check file permissions (should be readable by container)

### ❌ Metadata not enriching
**Cause**: Missing Google Books API key or invalid configuration

**Solutions**:
```bash
# Get API key from Google Cloud Console
# Add to environment variables
export GOOGLE_BOOKS_API_KEY="your-api-key"
```

### ❌ Database issues
**Checks**:
- Database is automatically created on first run
- For persistent data, ensure `/app/data` is mounted to a volume
- Check database permissions: `docker exec dust-server ls -la /app/data/`
- To reset database: stop container, remove volume, restart

### ❌ Permission denied errors
**Cause**: File permission issues with mounted volumes

**Solutions**:
```bash
# Fix file permissions on host
chmod -R 755 ./books
chown -R $(id -u):$(id -g) ./books

# Or run container with user ID mapping
docker run --user $(id -u):$(id -g) ...
```

## Docker Compose Services

### Development (`docker-compose.yml`)
- Includes health checks
- Mounts `./books` directory
- Persistent database volume

### Production (`docker-compose.prod.yml`)
- Production-ready configuration
- Logging configuration
- Restart policies
- Customizable book/comic directory mounts

## Building from Source

```bash
git clone <repository-url>
cd dust
docker build -t dust-server:latest .
```

## Security Notes

- The container runs as the `dustapp` user (non-root)
- Book directories are mounted read-only by default
- Database and application data are isolated in `/app/data`
- Use environment variables for sensitive configuration like API keys