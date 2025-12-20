# Authentication Flow Tests
# Test user registration, login, and token validation

# Register a new user
POST http://localhost:8000/api/register
Content-Type: application/json
{
  "email": "test@example.com",
  "password": "test123",
  "name": "Test User"
}

HTTP 201
[Captures]
token: jsonpath "$.token"
user_id: jsonpath "$.user.id"
[Asserts]
jsonpath "$.token" exists
jsonpath "$.user.email" == "test@example.com"
jsonpath "$.user.name" == "Test User"
jsonpath "$.user.is_admin" == false

# Login with the same credentials
POST http://localhost:8000/api/login
Content-Type: application/json
{
  "email": "test@example.com",
  "password": "test123"
}

HTTP 200
[Captures]
login_token: jsonpath "$.token"
[Asserts]
jsonpath "$.token" exists
jsonpath "$.user.email" == "test@example.com"

# Get current user with valid token
GET http://localhost:8000/api/user
Authorization: Bearer {{login_token}}

HTTP 200
[Asserts]
jsonpath "$.email" == "test@example.com"
jsonpath "$.name" == "Test User"

# Try to access protected route without token
GET http://localhost:8000/api/user

HTTP 401
[Asserts]
jsonpath "$.error" exists

# Try to login with wrong password
POST http://localhost:8000/api/login
Content-Type: application/json
{
  "email": "test@example.com",
  "password": "wrongpassword"
}

HTTP 401
[Asserts]
jsonpath "$.error" exists

# Try to register with existing email
POST http://localhost:8000/api/register
Content-Type: application/json
{
  "email": "test@example.com",
  "password": "test456",
  "name": "Another User"
}

HTTP 400
[Asserts]
jsonpath "$.error" exists
