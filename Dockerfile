# Build stage
FROM alpine:3.19 AS builder

# Install Zig and dependencies
RUN apk add --no-cache \
    wget \
    xz \
    curl \
    sqlite-dev

# Install Zig 0.15.2
RUN wget https://ziglang.org/download/0.15.2/zig-linux-x86_64-0.15.2.tar.xz && \
    tar -xf zig-linux-x86_64-0.15.2.tar.xz && \
    mv zig-linux-x86_64-0.15.2 /usr/local/zig && \
    ln -s /usr/local/zig/zig /usr/local/bin/zig && \
    rm zig-linux-x86_64-0.15.2.tar.xz

# Set working directory
WORKDIR /app

# Copy build configuration
COPY build.zig build.zig.zon ./

# Copy source code
COPY src ./src

# Copy client files
COPY client/dist ./client/dist

# Build the application in release mode
RUN zig build -Doptimize=ReleaseSafe

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite-libs \
    curl

# Create app user
RUN addgroup -g 1000 dustapp && \
    adduser -D -u 1000 -G dustapp dustapp

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/zig-out/bin/dust-server /app/dust-server

# Copy client files from builder
COPY --from=builder /app/client/dist /app/client/dist

# Create directory for SQLite database
RUN mkdir -p /app/data && chown -R dustapp:dustapp /app/data

# Set environment variables
ENV PORT=4001
ENV DATABASE_URL=file:/app/data/dust.db

# Expose the port
EXPOSE 4001

# Set the user for security
USER dustapp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4001/health || exit 1

# Run the application
CMD ["/app/dust-server"]