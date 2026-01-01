# Admin User Management

## Creating the First Admin

Since there's no admin user yet, you need to create one using the Python script:

### Prerequisites

```bash
pip install bcrypt psycopg2-binary python-dotenv
```

### Create Admin User

```bash
cd backend
python scripts/create_admin.py
```

The script will prompt you for:
- Full Name
- Email (optional)
- Phone (required)
- Password (min 8 characters)

**Example**:
```
Full Name: Admin User
Email: admin@politicai.com
Phone: 9876543210
Password: AdminPass123
```

### What the Script Does

1. ✅ Checks if user already exists (by email or phone)
2. ✅ Hashes password using bcrypt (cost factor 12)
3. ✅ Creates user with role = ADMIN
4. ✅ Sets isActive = true, isTrial = false
5. ✅ Displays login credentials

### After Creating Admin

Once you have an admin user, you can:

1. **Login via API**:
   ```bash
   POST /auth/login
   {
     "emailOrPhone": "admin@politicai.com",
     "password": "AdminPass123"
   }
   ```

2. **Create More Users** (via API as admin):
   ```bash
   POST /admin/users
   {
     "fullName": "John Doe",
     "email": "john@example.com",
     "phone": "9876543211",
     "password": "TempPass123",
     "role": "SUBSCRIBER",
     "isTrial": true
   }
   ```

3. **Create Subscriptions** (via API as admin):
   ```bash
   POST /admin/users/:userId/subscription
   {
     "isTrial": true,
     "startsAt": "2026-01-01T00:00:00Z",
     "endsAt": "2026-01-02T00:00:00Z"
   }
   ```

## Admin User Creation Logic

### Via Script (Initial Setup)
- ✅ **Location**: `backend/scripts/create_admin.py`
- ✅ **Method**: Direct database insertion
- ✅ **Use Case**: Creating first admin before API is available

### Via API (After Initial Setup)
- ✅ **Location**: `AuthService.createUser()`
- ✅ **Method**: POST /admin/users (requires admin authentication)
- ✅ **Use Case**: Creating additional users (admin or subscriber)

### AuthService.createUser() Features

```typescript
async createUser(dto: CreateUserDto): Promise<{ user: User; tempPassword: string }> {
  // ✅ Generates temporary password if not provided
  // ✅ Hashes password with bcrypt
  // ✅ Creates user with specified role (ADMIN or SUBSCRIBER)
  // ✅ Returns user + temp password for email notification
}
```

**What's Implemented**:
- ✅ Password hashing (bcrypt, cost 12)
- ✅ Temporary password generation
- ✅ Role assignment (ADMIN/SUBSCRIBER)
- ✅ Trial user support
- ✅ Returns temp password for email notification

**What's NOT Implemented Yet**:
- ❌ Email sending (EmailService)
- ❌ API endpoint (AdminController)
- ❌ Subscription creation API
- ❌ Geo access assignment API

## Next Steps

1. **Create First Admin** (use script above)
2. **Implement Controllers**:
   - AuthController (login/logout)
   - AdminController (user management, impersonation)
3. **Implement EmailService** (account creation notifications)
4. **Test Authentication Flow**

## Security Notes

⚠️ **Important**:
- The script should only be run in development/staging
- In production, use a secure method to create the first admin
- Always change the default password after first login
- Store admin credentials securely (password manager)
- Never commit `.env` file with real credentials
