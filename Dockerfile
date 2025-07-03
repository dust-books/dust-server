# Use the official Deno image
FROM denoland/deno:2.1.4

# Set working directory
WORKDIR /app

# Copy deno configuration files first (for better layer caching)
COPY deno.json deno.lock* ./

# Copy source code
COPY . .

# Cache dependencies
RUN deno cache main.ts

# Create directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chown -R deno:deno /app/data

# Set environment variables
ENV PORT=4001
ENV DENO_DIR=/deno-dir/
ENV DATABASE_URL=file:/app/data/dust.db

# Expose the port
EXPOSE 4001

# Set the user to deno for security
USER deno

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4001/health || exit 1

# Run the application
CMD ["deno", "run", "--allow-all", "main.ts"]