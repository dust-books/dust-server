# Admin User Management Tests
# Tests require an admin user to be set up

# First, create an admin user (this assumes database is seeded or we create one)
POST http://localhost:8000/api/register
Content-Type: application/json
{
  "email": "admin@example.com",
  "password": "admin123",
  "name": "Admin User"
}

HTTP 201
[Captures]
admin_token: jsonpath "$.token"

# Note: In real setup, this user needs to be promoted to admin in the database
# For now, we'll test the endpoints assuming admin access

# List all users (admin only)
GET http://localhost:8000/api/admin/users
Authorization: Bearer {{admin_token}}

HTTP 200
[Asserts]
jsonpath "$" isCollection

# Get specific user by ID
GET http://localhost:8000/api/admin/users/1
Authorization: Bearer {{admin_token}}

HTTP 200
[Asserts]
jsonpath "$.id" == 1
jsonpath "$.email" exists

# Update user (admin only)
PUT http://localhost:8000/api/admin/users/1
Authorization: Bearer {{admin_token}}
Content-Type: application/json
{
  "name": "Updated Name",
  "is_admin": false
}

HTTP 200
[Asserts]
jsonpath "$.name" == "Updated Name"

# Delete user (admin only)
DELETE http://localhost:8000/api/admin/users/2
Authorization: Bearer {{admin_token}}

HTTP 204

# Try to access admin route without admin token (should fail)
POST http://localhost:8000/api/register
Content-Type: application/json
{
  "email": "regular@example.com",
  "password": "regular123",
  "name": "Regular User"
}

HTTP 201
[Captures]
regular_token: jsonpath "$.token"

GET http://localhost:8000/api/admin/users
Authorization: Bearer {{regular_token}}

HTTP 403
[Asserts]
jsonpath "$.error" exists
