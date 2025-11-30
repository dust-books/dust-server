# API Tests

Language-agnostic API tests using [Hurl](https://hurl.dev/) that work with both Deno and Zig implementations.

## Prerequisites

Install Hurl:
```bash
cargo install hurl
```

Or via package manager:
```bash
# macOS
brew install hurl

# Linux
# Download from https://github.com/Orange-OpenSource/hurl/releases
```

## Running Tests

### Against Zig Implementation

1. Start the Zig server:
```bash
zig build run
```

2. In another terminal, run tests:
```bash
./tests/run-tests.sh zig
```

### Against Deno Implementation

1. Start the Deno server:
```bash
deno task start
```

2. In another terminal, run tests:
```bash
./tests/run-tests.sh deno 8000
```

### Run Individual Test Files

```bash
# Health checks
hurl --test tests/api/health.hurl

# Authentication flow
hurl --test tests/api/auth.hurl

# Admin operations
hurl --test tests/api/admin.hurl
```

## Test Files

- `health.hurl` - Basic health check endpoints
- `auth.hurl` - User registration, login, token validation
- `admin.hurl` - Admin user management operations

## Writing New Tests

Hurl files use a simple plain-text format:

```hurl
# Comment describing the test
POST http://localhost:8000/api/endpoint
Content-Type: application/json
{
  "key": "value"
}

HTTP 200
[Captures]
variable: jsonpath "$.field"
[Asserts]
jsonpath "$.status" == "success"
```

See [Hurl documentation](https://hurl.dev/docs/tutorial/your-first-hurl-file.html) for more examples.

## Comparing Implementations

These tests help ensure both Deno and Zig implementations have identical behavior. Run the same test suite against both:

```bash
# Test Deno
deno task start &
DENO_PID=$!
sleep 2
./tests/run-tests.sh deno
kill $DENO_PID

# Test Zig
zig build run &
ZIG_PID=$!
sleep 2
./tests/run-tests.sh zig
kill $ZIG_PID
```

## Notes

- Tests assume a fresh database state
- Admin tests require an admin user (may need manual DB setup)
- Tests clean up after themselves where possible
