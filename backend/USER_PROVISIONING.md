# User Provisioning - SOLID Principles Implementation

## Overview

Refactored user creation to follow industry best practices and SOLID principles.

## Industry Comparison

### How Other Platforms Handle User Creation

#### 1. **Stripe** (Payment Platform)
```javascript
// Single API call creates customer with payment method and subscription
stripe.customers.create({
  email: 'customer@example.com',
  payment_method: 'pm_xxx',
  invoice_settings: { default_payment_method: 'pm_xxx' },
  subscriptions: [{
    items: [{ price: 'price_xxx' }]
  }]
});
```

#### 2. **AWS IAM** (Identity Management)
```javascript
// User creation includes policies in one transaction
iam.createUser({
  UserName: 'john.doe',
  Tags: [...],
  Permissions: [...],
  Groups: [...]
});
```

#### 3. **Auth0** (Authentication Platform)
```javascript
// User creation includes roles and metadata
auth0.users.create({
  email: 'user@example.com',
  password: 'xxx',
  user_metadata: {...},
  app_metadata: {...},
  roles: ['subscriber']
});
```

## Our Implementation

### Before (Anti-Pattern ❌)

```typescript
// Step 1: Create user
POST /admin/users
{ fullName, email, phone, password, role }

// Step 2: Create subscription (separate API call)
POST /admin/users/:id/subscription
{ isTrial, startsAt, endsAt }

// Step 3: Grant geo access (separate API call)
POST /admin/users/:id/geo-access
{ geoUnitIds: [1, 2, 3] }

// Problems:
// - 3 API calls required
// - User exists without subscription (orphaned state)
// - Email sent before user is fully set up
// - No atomicity (partial failures possible)
// - Poor user experience
```

### After (Best Practice ✅)

```typescript
// Single atomic API call
POST /admin/users
{
  fullName: "John Doe",
  email: "john@example.com",
  phone: "9876543210",
  password: "TempPass123", // optional
  role: "SUBSCRIBER",
  subscription: {
    isTrial: true,
    durationDays: 1, // optional, uses TRIAL_DURATION_DAYS if not provided
    geoUnitIds: [1, 2, 3] // constituencies user can access
  }
}

// Benefits:
// ✅ Single API call
// ✅ Atomic transaction (all or nothing)
// ✅ No orphaned users
// ✅ Immediate access after creation
// ✅ Email sent with complete setup
// ✅ Trial limits enforced
```

## SOLID Principles Applied

### 1. **Single Responsibility Principle (SRP)**

**Before**: `AuthService` handled user creation AND subscription AND geo access
**After**: Separated concerns:
- `AuthService`: Only handles authentication (login, logout, password hashing)
- `UserProvisioningService`: Only handles user provisioning (creation with subscription)
- `AdminService`: Only handles admin operations (listing, updating)
- `EmailService`: Only handles email sending

### 2. **Open/Closed Principle (OCP)**

```typescript
class UserProvisioningService {
  // Open for extension
  async provisionUser() { ... }
  
  // Closed for modification
  async extendSubscription() { ... }
  async convertTrialToPaid() { ... }
  async updateGeoAccess() { ... }
}
```

New features (like `convertTrialToPaid`) can be added without modifying existing code.

### 3. **Liskov Substitution Principle (LSP)**

All services implement clear interfaces and can be mocked/replaced for testing.

### 4. **Interface Segregation Principle (ISP)**

Each service has a focused interface:
- `UserProvisioningService`: User lifecycle management
- `AuthService`: Authentication only
- `EmailService`: Email sending only

### 5. **Dependency Inversion Principle (DIP)**

All services depend on abstractions (PrismaService, ConfigService) not concrete implementations.

## Architecture

```
AdminController
    ↓
UserProvisioningService (NEW)
    ↓ (uses)
    ├── PrismaService (database transactions)
    ├── ConfigService (trial limits, duration)
    └── AuthService (password hashing)
    
After provisioning:
    ↓
EmailService (send welcome email)
```

## Key Features

### 1. **Atomic Transactions**

```typescript
return this.prisma.$transaction(async (tx) => {
  // 1. Create user
  const user = await tx.user.create({...});
  
  // 2. Create subscription
  const subscription = await tx.subscription.create({...});
  
  // 3. Create geo access
  for (const geoUnitId of geoUnitIds) {
    await tx.geoAccess.create({...});
  }
  
  // All or nothing - if any step fails, everything rolls back
  return completeUser;
});
```

### 2. **Trial Limits Enforcement**

```typescript
if (dto.subscription?.isTrial) {
  const maxConstituencies = this.configService.get('TRIAL_MAX_CONSTITUENCIES', 3);
  if (dto.subscription.geoUnitIds.length > maxConstituencies) {
    throw new BadRequestException(
      `Trial users can access maximum ${maxConstituencies} constituencies`
    );
  }
}
```

### 3. **Flexible Duration**

```typescript
// Trial user with default duration (1 day from config)
subscription: { isTrial: true, geoUnitIds: [1, 2, 3] }

// Trial user with custom duration
subscription: { isTrial: true, durationDays: 7, geoUnitIds: [1, 2, 3] }

// Paid user with 30-day subscription
subscription: { isTrial: false, durationDays: 30, geoUnitIds: [1, 2, 3] }

// Paid user with lifetime subscription
subscription: { isTrial: false, geoUnitIds: [1, 2, 3] } // endsAt = null
```

### 4. **Additional Operations**

```typescript
// Update geo access
userProvisioningService.updateGeoAccess(userId, [4, 5, 6]);

// Extend subscription
userProvisioningService.extendSubscription(userId, 30); // +30 days

// Convert trial to paid
userProvisioningService.convertTrialToPaid(userId, 365); // 1 year
```

## API Examples

### Create Trial User

```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionToken=ADMIN_TOKEN" \
  -d '{
    "fullName": "Trial User",
    "email": "trial@example.com",
    "phone": "9876543210",
    "role": "SUBSCRIBER",
    "subscription": {
      "isTrial": true,
      "geoUnitIds": [1, 2, 3]
    }
  }'
```

**Response**:
```json
{
  "message": "User created successfully",
  "user": {
    "id": 5,
    "fullName": "Trial User",
    "email": "trial@example.com",
    "phone": "9876543210",
    "role": "SUBSCRIBER",
    "isTrial": true,
    "subscription": {
      "id": 3,
      "isTrial": true,
      "startsAt": "2026-01-01T16:30:00Z",
      "endsAt": "2026-01-02T16:30:00Z",
      "geoAccess": [
        { "geoUnitId": 1, "geoUnitName": "Bangalore North", "geoUnitLevel": "CONSTITUENCY" },
        { "geoUnitId": 2, "geoUnitName": "Bangalore South", "geoUnitLevel": "CONSTITUENCY" },
        { "geoUnitId": 3, "geoUnitName": "Bangalore Central", "geoUnitLevel": "CONSTITUENCY" }
      ]
    }
  },
  "tempPassword": "Abc123XyzDef",
  "emailSent": true
}
```

### Create Paid User (Lifetime)

```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: sessionToken=ADMIN_TOKEN" \
  -d '{
    "fullName": "Premium User",
    "email": "premium@example.com",
    "phone": "9876543211",
    "role": "SUBSCRIBER",
    "subscription": {
      "isTrial": false,
      "geoUnitIds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    }
  }'
```

## Benefits

1. **Atomic Operations**: All-or-nothing user creation
2. **No Orphaned Data**: User always has subscription and geo access
3. **Single API Call**: Better UX for admins
4. **Immediate Access**: User can login right after creation
5. **Trial Limits**: Automatically enforced
6. **Scalable**: Easy to add new features (e.g., payment integration)
7. **Testable**: Each service has single responsibility
8. **Maintainable**: Clear separation of concerns

## Migration from Old API

If you have existing code using the old 3-step process:

**Old**:
```typescript
// 1. Create user
const user = await createUser({...});

// 2. Create subscription
await createSubscription(user.id, {...});

// 3. Grant access
await grantGeoAccess(user.id, {...});
```

**New**:
```typescript
// Single call
const user = await createUser({
  ...userDetails,
  subscription: {
    isTrial: true,
    geoUnitIds: [1, 2, 3]
  }
});
```

## Summary

This refactoring follows industry best practices from Stripe, AWS, and Auth0:
- ✅ Atomic user provisioning
- ✅ SOLID principles
- ✅ Single API call
- ✅ Better error handling
- ✅ Scalable architecture
- ✅ Maintainable code
