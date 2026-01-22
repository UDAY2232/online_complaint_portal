# Phase 6 & 7 Implementation Guide

## Overview

This document describes the implementation of:
- **Phase 6**: SLA & Auto-Escalation System
- **Phase 7**: Security & JWT Authentication

---

## Phase 6: SLA & Auto-Escalation

### SLA Rules

| Priority | Time Limit | Escalation Trigger |
|----------|------------|-------------------|
| High     | 24 hours   | After 24h unresolved |
| Medium   | 48 hours   | After 48h unresolved |
| Low      | 72 hours   | After 72h unresolved |

### How It Works

1. **Scheduler** runs every hour (configurable)
2. Checks all unresolved complaints
3. For each complaint exceeding SLA:
   - Increments `escalation_level`
   - Sets `escalated_at` timestamp
   - Logs to `escalation_history` table
   - Sends email to `ADMIN_EMAIL`

### Database Columns Added

```sql
ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0;
ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL;
```

### Files Created

- `config/sla.js` - SLA time limits configuration
- `services/escalationService.js` - Escalation logic
- `services/scheduler.js` - Hourly scheduler
- `services/emailService.js` - Email templates

---

## Phase 7: Security & Authentication

### JWT Authentication

#### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Register new user | No |
| POST | `/api/auth/login` | Login & get tokens | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| POST | `/api/auth/logout` | Logout | No |
| GET | `/api/auth/verify-email` | Verify email | No |
| GET | `/api/auth/me` | Get current user | Yes |

#### Login Response

```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": true
  }
}
```

### Role System

| Role | Permissions |
|------|-------------|
| `user` | Submit complaints, view own complaints |
| `admin` | Resolve complaints, update status, view all |
| `superadmin` | Manage users, roles, whitelist |

### Protected Routes

#### User Routes (requires authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/complaints` | Get user's own complaints |
| POST | `/api/user/complaints` | Submit complaint (verified email) |
| GET | `/api/user/complaints/:id` | Get single complaint (owner only) |

#### Admin Routes (requires admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/complaints` | Get all complaints |
| PUT | `/api/admin/complaints/:id/status` | Update status |
| PUT | `/api/admin/complaints/:id/resolve` | Resolve with image |
| GET | `/api/admin/escalated-complaints` | Get escalated complaints |
| POST | `/api/admin/trigger-escalation` | Manual escalation check |
| GET | `/api/admin/dashboard-stats` | Dashboard statistics |

#### Superadmin Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all users |
| PUT | `/api/admin/users/:id/role` | Update user role |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/admin-whitelist` | View whitelist |
| POST | `/api/admin/admin-whitelist` | Add to whitelist |
| DELETE | `/api/admin/admin-whitelist/:email` | Remove from whitelist |

### Authentication Header

```
Authorization: Bearer <access_token>
```

---

## Environment Variables

Add these to your `.env` file:

```env
# Phase 6: Escalation
ADMIN_EMAIL=admin@yourcompany.com

# Phase 7: Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
FRONTEND_URL=http://localhost:5173
```

---

## Database Migration

### For New Installations

Run the updated `schema.sql` file.

### For Existing Databases

Run the migration script automatically on startup, or manually:

```sql
-- Phase 6: Escalation columns
ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 0;
ALTER TABLE complaints ADD COLUMN escalated_at TIMESTAMP NULL;
ALTER TABLE complaints ADD COLUMN resolution_message TEXT;

-- Phase 7: Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role ENUM('user', 'admin', 'superadmin') NOT NULL DEFAULT 'user',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin whitelist
CREATE TABLE admin_whitelist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## Backward Compatibility

All existing routes remain unchanged and functional:

- `POST /api/complaints` - Still works without auth
- `GET /api/complaints` - Still works without auth
- `PUT /api/complaints/:id` - Still works without auth
- `PUT /api/complaints/:id/resolve` - Still works without auth

The new protected routes are **additional** endpoints for secure access.

---

## Email Notifications

### Escalation Email (to Admin)

Sent when complaint exceeds SLA. Contains:
- Complaint ID
- Priority
- Hours pending
- Problem image
- User email (if not anonymous)

### Resolution Email (to User)

Enhanced to include:
- BEFORE image (problem_image_url)
- AFTER image (resolved_image_url)
- Resolution time calculation
- Resolution message

---

## Testing

### 1. Test Signup

```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'
```

### 2. Test Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 3. Test Protected Route

```bash
curl http://localhost:4000/api/user/complaints \
  -H "Authorization: Bearer <access_token>"
```

### 4. Test Admin Route

```bash
curl http://localhost:4000/api/admin/complaints \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## File Structure

```
backend/
├── config/
│   ├── cloudinary.js      # Existing
│   ├── jwt.js             # NEW - JWT config
│   └── sla.js             # NEW - SLA rules
├── middleware/
│   ├── auth.js            # NEW - JWT middleware
│   └── upload.js          # Existing
├── routes/
│   ├── auth.js            # NEW - Auth routes
│   └── admin.js           # NEW - Admin routes
├── services/
│   ├── emailService.js    # NEW - Email service
│   ├── escalationService.js # NEW - Escalation logic
│   └── scheduler.js       # NEW - Cron scheduler
├── utils/
│   ├── cloudinary.js      # Existing
│   ├── migrations.js      # NEW - DB migrations
│   └── multer.js          # Existing
├── migrations/
│   └── phase6_7_migration.sql # NEW - SQL migrations
├── .env.example           # NEW - Env template
├── index.js               # Updated
├── package.json           # Updated
└── schema.sql             # Updated
```

---

## Security Considerations

1. **JWT Secret**: Use a strong, unique secret (32+ chars)
2. **Password Hashing**: bcrypt with 10 rounds
3. **Email Verification**: Optional enforcement available
4. **Admin Whitelist**: Only whitelisted emails can become admins
5. **Rate Limiting**: Consider adding `express-rate-limit` for production
6. **HTTPS**: Always use HTTPS in production
