# PoliticAI - v0 Local Development Setup

## Overview
This guide will help you set up a minimal local development environment to validate the Prisma schema. This is **schema validation only** - no migrations, seed data, or API services yet.

---

## Prerequisites

### 1. Node.js
- **Required**: Node.js 18+ and npm
- **Verify**: `node --version` and `npm --version`
- **Why**: Prisma CLI runs on Node.js

### 2. PostgreSQL
- **Required**: PostgreSQL 12+ running locally
- **Why**: Prisma needs a database connection to validate relations and generate the client

---

## Project Structure

```
PoliticAI/
├── prisma/
│   └── schema.prisma          # ✅ Complete schema with relations, indexes, cascades
├── .env.example               # ✅ Database connection template
├── .gitignore                 # ✅ Protects secrets and dependencies
├── package.json               # ✅ Prisma dependencies + scripts
└── README.md                  # ✅ This file
```

**Why this structure?**
- Minimal setup required to run Prisma commands
- Industry standard for Prisma projects
- Easy to extend with APIs later (NestJS, FastAPI)

---

## Setup Steps

### Step 1: Install Dependencies

```bash
cd c:\Users\user\movies\PoliticAI
npm install
```

**What this does:**
- Installs Prisma CLI (`prisma`)
- Installs Prisma Client (`@prisma/client`)
- Creates `node_modules/` and `package-lock.json`

**Why necessary:**
- Prisma CLI is needed for validation and code generation
- Prisma Client will be generated from your schema

---

### Step 2: Configure PostgreSQL

#### Option A: Using Existing PostgreSQL Installation

1. **Create a new database:**
   ```sql
   CREATE DATABASE politicai_dev;
   ```

2. **Copy the environment template:**
   ```bash
   copy .env.example .env
   ```

3. **Update `.env` with your credentials:**
   ```env
   DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/politicai_dev?schema=public"
   ```

   **Example:**
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/politicai_dev?schema=public"
   ```

#### Option B: Using PostgreSQL via Windows Service

1. **Check if PostgreSQL is running:**
   ```powershell
   Get-Service -Name postgresql*
   ```

2. **Start PostgreSQL if needed:**
   ```powershell
   Start-Service postgresql-x64-[version]
   ```

3. **Connect and create database:**
   ```bash
   psql -U postgres
   CREATE DATABASE politicai_dev;
   \q
   ```

**Why necessary:**
- Prisma requires a valid database connection to validate schema
- The connection string tells Prisma where to connect
- Schema validation checks if relations and constraints are valid in PostgreSQL

---

### Step 3: Validate the Prisma Schema

```bash
npm run prisma:validate
```

**What this does:**
- Parses `prisma/schema.prisma`
- Validates syntax, relations, and constraints
- Checks if all `@relation` attributes are correctly configured
- Ensures enums and data types are valid for PostgreSQL

**Why necessary:**
- Catches schema errors early before attempting migrations
- Verifies all bidirectional relations are properly defined
- Confirms indexes and unique constraints are correctly specified

**Expected output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma

The schema is valid ✅
```

---

### Step 4: Generate Prisma Client

```bash
npm run prisma:generate
```

**What this does:**
- Generates TypeScript types from your schema
- Creates the Prisma Client library in `node_modules/@prisma/client`
- Provides type-safe database queries for Node.js/NestJS

**Why necessary:**
- Validates that the schema can generate working TypeScript code
- Required before any Node.js code can use Prisma
- Ensures all models, relations, and enums have proper TypeScript types

**Expected output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma

✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 234ms
```

---

## Optional: Explore Schema with Prisma Studio

```bash
npm run prisma:studio
```

**What this does:**
- Opens a web GUI at `http://localhost:5555`
- Lets you browse your schema structure
- **Note**: Tables are empty until you run migrations

**Why useful:**
- Visual confirmation of your data model
- Easy way to explore relations and fields
- Helpful for planning data entry workflows

---

## What We're NOT Doing (Yet)

❌ **No migrations**: We're only validating the schema, not creating database tables  
❌ **No seed data**: No sample data insertion  
❌ **No APIs**: No NestJS or FastAPI services  
❌ **No Docker**: Using local PostgreSQL directly  

**Why?**
- v0 constraint: minimal and focused setup
- Schema validation must come first
- Migrations and APIs will follow in next phase

---

## Troubleshooting

### Error: "Can't reach database server"
- **Check**: PostgreSQL is running
- **Check**: Credentials in `.env` are correct
- **Check**: Database `politicai_dev` exists

### Error: "Environment variable not found: DATABASE_URL"
- **Fix**: Ensure `.env` file exists in project root
- **Fix**: Restart your terminal to reload environment

### Error: "Invalid `prisma.schema` provided"
- **Fix**: Check for syntax errors in `prisma/schema.prisma`
- **Fix**: Ensure all relations have matching back-relations

---

## Next Steps (Future)

Once schema validation passes:

1. **Create initial migration** (populates database tables)
2. **Add seed data** (sample constituencies, parties, elections)
3. **Build NestJS API Gateway** (user-facing REST APIs)
4. **Build Python Analytics Service** (ETL and aggregations)
5. **Build Next.js frontend** (dashboard UI)

---

## Key Schema Improvements Applied

✅ **All back-relations added** (Prisma requirement)  
✅ **Performance indexes** on foreign keys and query patterns  
✅ **Unique constraints** to prevent duplicate data  
✅ **Cascade behaviors** for referential integrity  
✅ **JobStatus enum** for type safety  
✅ **Comprehensive documentation** with inline comments  

---

## Questions?

- Prisma docs: https://www.prisma.io/docs
- Schema reference: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference
