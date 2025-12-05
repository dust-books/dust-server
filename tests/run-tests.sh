#!/bin/bash
# Run all Hurl API tests
# Usage: ./run-tests.sh [zig|deno] [port]

IMPLEMENTATION=${1:-zig}
PORT=${2:-8000}
BASE_URL="http://localhost:${PORT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Running API tests against ${IMPLEMENTATION} implementation on port ${PORT}"
echo "Base URL: ${BASE_URL}"
echo ""

# Check if server is running
if ! curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Server is not running on port ${PORT}${NC}"
    echo "Start the server first:"
    if [ "$IMPLEMENTATION" = "zig" ]; then
        echo "  zig build run"
    else
        echo "  deno task start"
    fi
    exit 1
fi

# Clean up test database before running tests
echo "Preparing test environment..."
if [ "$IMPLEMENTATION" = "zig" ]; then
    # For Zig, you might want to reset the database
    rm -f dust.db
    echo "Database reset for fresh test run"
fi

# Run tests
FAILED=0
PASSED=0

run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file" .hurl)
    
    echo -e "${YELLOW}Running: ${test_name}${NC}"
    
    if hurl --test --variable base_url="${BASE_URL}" "$test_file"; then
        echo -e "${GREEN}✓ ${test_name} passed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
        ((FAILED++))
    fi
    echo ""
}

# Run all test files
for test_file in tests/api/*.hurl; do
    if [ -f "$test_file" ]; then
        run_test "$test_file"
    fi
done

# Summary
echo "================================"
echo "Test Results:"
echo -e "  ${GREEN}Passed: ${PASSED}${NC}"
echo -e "  ${RED}Failed: ${FAILED}${NC}"
echo "================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
