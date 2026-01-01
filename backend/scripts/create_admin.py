#!/usr/bin/env python3
"""
Admin User Creation Script

Creates an admin user in the database for initial system access.
This script should be run once to create the first admin user.

USAGE:
    python create_admin.py

REQUIREMENTS:
    - DATABASE_URL environment variable
    - bcrypt library (pip install bcrypt)
"""

import os
import sys
import bcrypt
from datetime import datetime
from dotenv import load_dotenv

try:
    import psycopg2
except ImportError:
    print("[ERROR] psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)


def hash_password(password: str) -> str:
    """Hash password using bcrypt with cost factor 12"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def create_admin_user(conn, full_name: str, email: str, phone: str, password: str):
    """Create an admin user in the database"""
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute(
            'SELECT id, "fullName", email, phone, role FROM "User" WHERE email = %s OR phone = %s',
            (email, phone)
        )
        existing = cursor.fetchone()
        
        if existing:
            print(f"\n[WARNING] User already exists:")
            print(f"  ID: {existing[0]}")
            print(f"  Name: {existing[1]}")
            print(f"  Email: {existing[2]}")
            print(f"  Phone: {existing[3]}")
            print(f"  Role: {existing[4]}")
            
            response = input("\nDo you want to update this user to ADMIN role? (yes/no): ")
            if response.lower() in ['yes', 'y']:
                cursor.execute(
                    'UPDATE "User" SET role = %s, "isActive" = true WHERE id = %s',
                    ('ADMIN', existing[0])
                )
                conn.commit()
                print(f"\n[SUCCESS] User {existing[1]} updated to ADMIN role")
            else:
                print("\n[CANCELLED] No changes made")
            return
        
        # Hash password
        password_hash = hash_password(password)
        
        # Insert new admin user
        cursor.execute(
            '''
            INSERT INTO "User" ("fullName", email, phone, "passwordHash", role, "isActive", "isTrial", "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, "fullName", email, phone, role
            ''',
            (full_name, email, phone, password_hash, 'ADMIN', True, False, datetime.now(), datetime.now())
        )
        
        user = cursor.fetchone()
        conn.commit()
        
        print("\n" + "="*60)
        print("[SUCCESS] ADMIN USER CREATED")
        print("="*60)
        print(f"  ID:       {user[0]}")
        print(f"  Name:     {user[1]}")
        print(f"  Email:    {user[2]}")
        print(f"  Phone:    {user[3]}")
        print(f"  Role:     {user[4]}")
        print("="*60)
        print("\nYou can now login with:")
        print(f"  Email/Phone: {email} or {phone}")
        print(f"  Password: {password}")
        print("\n[IMPORTANT] Please change your password after first login!")
        print("="*60)
        
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Failed to create admin user: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cursor.close()


def main():
    """Main execution"""
    print("\n" + "="*60)
    print("ADMIN USER CREATION SCRIPT")
    print("="*60)
    
    # Get database URL
    db_url = os.getenv('DATABASE_URL_PG') or os.getenv('DATABASE_URL')
    if not db_url:
        print("\n[ERROR] DATABASE_URL not found in .env file")
        sys.exit(1)
    
    # Get admin details from user input
    print("\nEnter admin user details:")
    print("-" * 60)
    
    full_name = input("Full Name: ").strip()
    if not full_name:
        print("[ERROR] Full name is required")
        sys.exit(1)
    
    email = input("Email (optional, press Enter to skip): ").strip() or None
    
    phone = input("Phone: ").strip()
    if not phone:
        print("[ERROR] Phone is required")
        sys.exit(1)
    
    password = input("Password (min 8 characters): ").strip()
    if len(password) < 8:
        print("[ERROR] Password must be at least 8 characters")
        sys.exit(1)
    
    password_confirm = input("Confirm Password: ").strip()
    if password != password_confirm:
        print("[ERROR] Passwords do not match")
        sys.exit(1)
    
    # Confirm creation
    print("\n" + "-"*60)
    print("Please confirm the following details:")
    print(f"  Full Name: {full_name}")
    print(f"  Email:     {email or 'Not provided'}")
    print(f"  Phone:     {phone}")
    print(f"  Role:      ADMIN")
    print("-"*60)
    
    confirm = input("\nCreate this admin user? (yes/no): ")
    if confirm.lower() not in ['yes', 'y']:
        print("\n[CANCELLED] Admin user creation cancelled")
        sys.exit(0)
    
    # Connect to database
    try:
        conn = psycopg2.connect(db_url)
        print("\n[OK] Connected to database")
    except Exception as e:
        print(f"\n[ERROR] Database connection failed: {e}")
        sys.exit(1)
    
    # Create admin user
    try:
        create_admin_user(conn, full_name, email, phone, password)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
