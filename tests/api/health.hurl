# Health Check Tests
# Basic health and status endpoints

# Health check endpoint
GET http://localhost:8000/health

HTTP 200
[Asserts]
jsonpath "$.status" == "ok"

# Root endpoint (if exists)
GET http://localhost:8000/

HTTP 200
