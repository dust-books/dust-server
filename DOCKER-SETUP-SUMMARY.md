# 🐳 Dust Server Docker Setup - Complete Guide

## 📋 Prerequisites Checklist

Before running Dust in Docker, ensure you have:

- [ ] **Docker installed** (version 20.10+ recommended)
- [ ] **Docker Compose installed** (or Docker Desktop)
- [ ] **Book/comic files** to serve
- [ ] **OpenSSL** for generating JWT secrets (or any secure random generator)

## 🚀 Quick Start (5 minutes)

### Step 1: Get the Code
```bash
git clone <repository-url>
cd dust
```

### Step 2: Set Up Environment
```bash
# Create environment file with required settings
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
DUST_DIRS=/app/books
PORT=4001
DATABASE_URL=file:/app/data/dust.db
EOF
```

### Step 3: Prepare Book Directory
```bash
# Create local book directory
mkdir -p ./books

# Copy your ebooks/comics to this directory
# cp /path/to/your/books/* ./books/
```

### Step 4: Start the Server
```bash
# Start with Docker Compose
docker compose up -d

# Check logs
docker compose logs -f

# Access the server
open http://localhost:4001
```

## ⚙️ Required Configuration

### 🔑 Essential Environment Variables

| Variable | Status | Description | Example |
|----------|--------|-------------|---------|
| `JWT_SECRET` | **REQUIRED** | Secret for JWT authentication | `$(openssl rand -base64 32)` |
| `DUST_DIRS` | **REQUIRED** | Book directories to scan (colon-separated) | `/app/books:/app/comics` |
| `PORT` | Optional | Server port | `4001` |
| `DATABASE_URL` | Optional | Database location | `file:/app/data/dust.db` |
| `GOOGLE_BOOKS_API_KEY` | Optional | Metadata enrichment | `your-api-key` |

### 📁 Required Volume Mounts

| Container Path | Purpose | Host Example | Access |
|----------------|---------|--------------|---------|
| `/app/books` | Book files | `./books` | Read-only |
| `/app/data` | Database & app data | Named volume | Read-write |
| `/app/comics` | Comics (optional) | `./comics` | Read-only |

### 🌐 Required Port Mapping

- `4001:4001` - Web server access (or custom port via `PORT` env var)

## 📂 File Organization Examples

### Simple Setup
```
dust/
├── .env                    # Environment variables
├── docker-compose.yml     # Docker configuration
├── books/                 # Your book directory
│   ├── author1/
│   │   └── book1.epub
│   └── author2/
│       └── book2.pdf
└── README-Docker.md       # This guide
```

### Advanced Setup
```
dust/
├── .env
├── docker-compose.yml
├── docker-compose.override.yml  # Production overrides
├── data/                        # Persistent database
├── books/                       # Ebooks
│   ├── Fiction/
│   ├── Technical/
│   └── Biography/
└── comics/                      # Comics collection
    ├── Marvel/
    └── DC/
```

## ✅ Validation Commands

After starting the server, verify everything works:

```bash
# 1. Health check
curl http://localhost:4001/health

# 2. Check environment
docker exec dust-dust-server-1 env | grep JWT_SECRET

# 3. Verify volumes
docker exec dust-dust-server-1 ls -la /app/books
docker exec dust-dust-server-1 ls -la /app/data

# 4. Check logs for success messages
docker compose logs | grep -E "(Dust is bookin|Found.*files|Created tag)"
```

## 🛠 Production Deployment

### Step 1: Create Production Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit with secure values
vim .env
```

### Step 2: Configure Production Overrides
```bash
# Copy production template
cp docker-compose.prod.yml docker-compose.override.yml

# Edit paths and settings
vim docker-compose.override.yml
```

### Step 3: Deploy
```bash
# Start in production mode
docker compose up -d

# Enable automatic restarts
docker update --restart unless-stopped dust-dust-server-1
```

## 🔧 Common Issues & Solutions

### ❌ "JWT_SECRET is required"
```bash
# Add to .env file
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

### ❌ "No such file or directory"
```bash
# Create book directories
mkdir -p ./books
# Check docker-compose.yml volume mounts
```

### ❌ Permission denied
```bash
# Fix file permissions
chmod -R 755 ./books
```

### ❌ Port already in use
```bash
# Check what's using port 4001
lsof -i :4001

# Or change port in .env
echo "PORT=4002" >> .env
```

## 📊 Success Indicators

When everything is working correctly, you should see:

### ✅ In Docker Logs:
- "Dust is bookin' it on port 4001"
- "Created tag: [various tags]"
- "Found X files to process"
- "Finished processing X books"

### ✅ Health Endpoint Response:
```json
{
  "status": "ok",
  "version": "1.0.0", 
  "service": "dust-server"
}
```

### ✅ Web Interface:
- http://localhost:4001 loads successfully
- Shows Dust server page with embedded content

## 🔐 Security Notes

- **JWT_SECRET**: Keep this secret secure and use a strong random value
- **Book mounts**: Use read-only mounts (`:ro`) for book directories
- **User context**: Container runs as non-root `dustapp` user
- **Database isolation**: App data is contained in `/app/data`
- **Environment variables**: Use `.env` file for sensitive config

## 📚 Next Steps

1. **Add books**: Copy your ebook/comic collection to the mounted directories
2. **Configure metadata**: Set up Google Books API key for enhanced metadata
3. **Set up users**: Access the web interface to create user accounts
4. **Organize content**: Use the tagging and categorization features
5. **Monitor usage**: Check logs and health endpoints regularly

## 🆘 Getting Help

If you encounter issues:

1. **Check logs**: `docker compose logs -f`
2. **Verify config**: Review `.env` and volume mounts
3. **Test health**: `curl http://localhost:4001/health`
4. **Validate environment**: Use the validation commands above
5. **Review documentation**: See `README-Docker.md` for detailed troubleshooting

---

**🎉 You're ready to serve your digital library with Dust!**