# Deployment Guide

## Quick Deployment

The `dist/` folder contains a complete, self-contained web application that can be deployed anywhere.

### Built Files

After running `npm run build`, you'll have:

```
dist/
├── index.html              # Main HTML file (8.30 kB)
├── main.js                 # Application bundle (589 kB, 153 kB gzipped)
├── pdf-reader.js           # PDF reader bundle (371 kB, 109 kB gzipped)
├── pdf.worker.min.mjs      # PDF.js web worker
├── favicon.svg             # Application icon
└── (other TypeScript declaration files)
```

### Static File Server

Any static file server can host this application:

**Python (for testing):**
```bash
cd dist
python -m http.server 8080
# Open http://localhost:8080
```

**Node.js serve:**
```bash
npx serve dist
```

**nginx configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /path/to/dust/client/dist;
    index index.html;
    
    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Compress and cache static assets
    location ~* \.(js|css|svg|mjs)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip on;
        gzip_types text/javascript application/javascript text/css image/svg+xml;
    }
}
```

### CDN Deployment

**Vercel:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod dist/`

**Netlify:**
1. Drag and drop the `dist/` folder to netlify.com
2. Or use Netlify CLI: `netlify deploy --prod --dir=dist`

**AWS S3 + CloudFront:**
```bash
aws s3 sync dist/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM nginx:alpine

# Copy built application
COPY dist/ /usr/share/nginx/html/

# Copy nginx configuration
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|svg|mjs)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build and run:**
```bash
docker build -t dust-client .
docker run -p 3000:80 dust-client
```

### Environment Configuration

The client automatically detects the Dust server based on where it's deployed:

- **Development**: Proxies to `http://localhost:4001`
- **Production**: Uses relative URLs (same origin as the client)

To override the server URL, you can:

1. **Build time**: Set `VITE_API_URL` environment variable
2. **Runtime**: Modify the server configuration in the app

### Performance Notes

- **Initial load**: ~306KB gzipped (main.js + HTML + CSS)
- **PDF reader**: ~109KB gzipped (lazy loaded when needed)
- **Total**: ~415KB gzipped for full functionality
- **Fast loading**: Modern ES modules with tree shaking
- **Caching**: Assets are cacheable for 1 year

### Security Considerations

- All assets are served over HTTPS in production
- JWT tokens are stored in localStorage (not httpOnly cookies)
- CORS headers must be configured on the Dust server
- Content Security Policy recommended for production

### Monitoring

The application includes:
- Error boundaries with user-friendly error screens
- Console logging for debugging
- Performance timing for key operations
- Network request monitoring