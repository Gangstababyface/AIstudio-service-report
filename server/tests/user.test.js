'use strict';

/**
 * User Model and Google OAuth Tests
 *
 * Verifies:
 * 1. No duplicate emails are created for the same user
 * 2. Case-insensitive email lookup works correctly
 * 3. Name is updated on returning sign-ins
 * 4. New users default to 'technician' role
 */

// Skip Jest tests when running inline
if (process.argv.includes('--inline')) {
  // Inline tests are at the bottom of this file
} else {
  const { Sequelize } = require('sequelize');
  const User = require('../models/User');

  // Use in-memory SQLite for testing
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });

  describe('User Model', () => {
  beforeAll(async () => {
    // Initialize the User model with test database
    User.initModel(sequelize);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clear users table before each test
    await User.destroy({ where: {}, truncate: true });
  });

  describe('findOrCreateFromGoogle', () => {
    /**
     * TEST: Email Deduplication
     *
     * Sign in twice with the same email, confirm only one DB row exists.
     */
    test('should NOT create duplicate users for the same email', async () => {
      const email = 'test@example.com';
      const name1 = 'Test User';
      const name2 = 'Test User Updated';

      // First sign-in: should create user
      const result1 = await User.findOrCreateFromGoogle({ email, name: name1 });
      expect(result1.created).toBe(true);
      expect(result1.user.email).toBe(email.toLowerCase());
      expect(result1.user.name).toBe(name1);
      expect(result1.user.role).toBe('technician');

      // Second sign-in: should NOT create new user
      const result2 = await User.findOrCreateFromGoogle({ email, name: name2 });
      expect(result2.created).toBe(false);
      expect(result2.user.id).toBe(result1.user.id); // Same user

      // Verify only ONE user exists in database
      const userCount = await User.count();
      expect(userCount).toBe(1);

      console.log(
        'TEST PASSED: Two sign-ins with same email resulted in only ONE database row'
      );
    });

    /**
     * TEST: Name Update on Returning Sign-in
     *
     * When user signs in again with updated name from Google,
     * the name should be updated in the database.
     */
    test('should update name on returning sign-in', async () => {
      const email = 'returning@example.com';
      const originalName = 'Original Name';
      const updatedName = 'Updated Name';

      // First sign-in
      const result1 = await User.findOrCreateFromGoogle({
        email,
        name: originalName,
      });
      expect(result1.user.name).toBe(originalName);

      // Second sign-in with different name
      const result2 = await User.findOrCreateFromGoogle({
        email,
        name: updatedName,
      });
      expect(result2.user.name).toBe(updatedName);

      // Verify database was updated
      const userFromDb = await User.findByEmail(email);
      expect(userFromDb.name).toBe(updatedName);

      console.log(
        'TEST PASSED: Name was updated on returning sign-in from',
        originalName,
        'to',
        updatedName
      );
    });

    /**
     * TEST: Case-Insensitive Email Lookup
     *
     * Emails with different cases should match the same user.
     */
    test('should handle case-insensitive email lookup', async () => {
      const name = 'Case Test User';

      // Create user with lowercase email
      const result1 = await User.findOrCreateFromGoogle({
        email: 'case.test@example.com',
        name,
      });
      expect(result1.created).toBe(true);

      // Sign in with UPPERCASE email - should find same user
      const result2 = await User.findOrCreateFromGoogle({
        email: 'CASE.TEST@EXAMPLE.COM',
        name,
      });
      expect(result2.created).toBe(false);
      expect(result2.user.id).toBe(result1.user.id);

      // Sign in with MixedCase email - should find same user
      const result3 = await User.findOrCreateFromGoogle({
        email: 'Case.Test@Example.COM',
        name,
      });
      expect(result3.created).toBe(false);
      expect(result3.user.id).toBe(result1.user.id);

      // Still only one user in database
      const userCount = await User.count();
      expect(userCount).toBe(1);

      console.log(
        'TEST PASSED: Case-insensitive email lookup works correctly'
      );
    });

    /**
     * TEST: Default Role for New Users
     *
     * New users should always have role='technician'.
     */
    test('should set default role to technician for new users', async () => {
      const result = await User.findOrCreateFromGoogle({
        email: 'newuser@example.com',
        name: 'New User',
      });

      expect(result.created).toBe(true);
      expect(result.user.role).toBe('technician');

      console.log(
        'TEST PASSED: New user was created with default role "technician"'
      );
    });

    /**
     * TEST: Role Preservation on Returning Sign-in
     *
     * If admin updates a user's role to 'admin', it should persist
     * across sign-ins (only name is updated, not role).
     */
    test('should preserve role on returning sign-in', async () => {
      const email = 'admin@example.com';

      // Create user
      const result1 = await User.findOrCreateFromGoogle({
        email,
        name: 'Admin User',
      });
      expect(result1.user.role).toBe('technician');

      // Simulate admin promoting user to admin role
      result1.user.role = 'admin';
      await result1.user.save();

      // User signs in again - role should still be admin
      const result2 = await User.findOrCreateFromGoogle({
        email,
        name: 'Admin User Name Updated',
      });
      expect(result2.user.role).toBe('admin');
      expect(result2.user.name).toBe('Admin User Name Updated');

      console.log(
        'TEST PASSED: Admin role was preserved after re-signin'
      );
    });

    /**
     * TEST: Validation - Missing Email
     */
    test('should throw error when email is missing', async () => {
      await expect(
        User.findOrCreateFromGoogle({ email: '', name: 'Test' })
      ).rejects.toThrow('Email and name are required');

      await expect(
        User.findOrCreateFromGoogle({ email: null, name: 'Test' })
      ).rejects.toThrow('Email and name are required');
    });

    /**
     * TEST: Validation - Missing Name
     */
    test('should throw error when name is missing', async () => {
      await expect(
        User.findOrCreateFromGoogle({ email: 'test@example.com', name: '' })
      ).rejects.toThrow('Email and name are required');

      await expect(
        User.findOrCreateFromGoogle({ email: 'test@example.com', name: null })
      ).rejects.toThrow('Email and name are required');
    });
  });

  describe('findByEmail', () => {
    test('should find user by email case-insensitively', async () => {
      await User.findOrCreateFromGoogle({
        email: 'find.me@example.com',
        name: 'Find Me User',
      });

      const user1 = await User.findByEmail('find.me@example.com');
      const user2 = await User.findByEmail('FIND.ME@EXAMPLE.COM');
      const user3 = await User.findByEmail('Find.Me@Example.Com');

      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();
      expect(user3).not.toBeNull();
      expect(user1.id).toBe(user2.id);
      expect(user2.id).toBe(user3.id);
    });

    test('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('Instance methods', () => {
    test('isAdmin should return correct value', async () => {
      const { user } = await User.findOrCreateFromGoogle({
        email: 'methods@example.com',
        name: 'Methods Test',
      });

      expect(user.isAdmin()).toBe(false);

      user.role = 'admin';
      await user.save();

      expect(user.isAdmin()).toBe(true);
    });

    test('toSafeJSON should return safe user data', async () => {
      const { user } = await User.findOrCreateFromGoogle({
        email: 'safe@example.com',
        name: 'Safe JSON Test',
      });

      const safeData = user.toSafeJSON();

      expect(safeData).toHaveProperty('id');
      expect(safeData).toHaveProperty('email', 'safe@example.com');
      expect(safeData).toHaveProperty('name', 'Safe JSON Test');
      expect(safeData).toHaveProperty('role', 'technician');
      expect(safeData).toHaveProperty('createdAt');
      expect(safeData).toHaveProperty('updatedAt');
    });
  });
});
} // End of else block for Jest tests

/**
 * INLINE TEST RUNNER (for environments without Jest)
 *
 * Run with: node tests/user.test.js --inline
 */
if (process.argv.includes('--inline')) {
  const { Sequelize } = require('sequelize');
  const User = require('../models/User');

  (async () => {
    console.log('\n=== INLINE USER TESTS ===\n');

    const testSequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });

    User.initModel(testSequelize);
    await testSequelize.sync({ force: true });

    try {
      // Test 1: Email Deduplication
      console.log('Test 1: Email Deduplication');
      const email = 'dedup@test.com';

      const r1 = await User.findOrCreateFromGoogle({ email, name: 'First' });
      console.log(`  - First login: created=${r1.created}`);

      const r2 = await User.findOrCreateFromGoogle({ email, name: 'Second' });
      console.log(`  - Second login: created=${r2.created}`);

      const count = await User.count();
      console.log(`  - Total users in DB: ${count}`);

      if (count === 1 && r1.user.id === r2.user.id) {
        console.log('  PASSED: Only one user row exists\n');
      } else {
        console.log('  FAILED: Duplicate user was created!\n');
        process.exit(1);
      }

      // Test 2: Name Update
      console.log('Test 2: Name Update on Re-signin');
      const userAfter = await User.findByEmail(email);
      console.log(`  - Name after second login: ${userAfter.name}`);

      if (userAfter.name === 'Second') {
        console.log('  PASSED: Name was updated\n');
      } else {
        console.log('  FAILED: Name was not updated!\n');
        process.exit(1);
      }

      // Test 3: Case Insensitivity
      console.log('Test 3: Case Insensitive Email');
      await User.destroy({ where: {}, truncate: true });

      await User.findOrCreateFromGoogle({
        email: 'case@test.com',
        name: 'Case',
      });
      const r3 = await User.findOrCreateFromGoogle({
        email: 'CASE@TEST.COM',
        name: 'Case',
      });

      if (!r3.created) {
        console.log('  PASSED: Case insensitive lookup works\n');
      } else {
        console.log('  FAILED: Duplicate created due to case!\n');
        process.exit(1);
      }

      // Test 4: Default Role
      console.log('Test 4: Default Role');
      await User.destroy({ where: {}, truncate: true });

      const r4 = await User.findOrCreateFromGoogle({
        email: 'role@test.com',
        name: 'Role Test',
      });

      if (r4.user.role === 'technician') {
        console.log('  PASSED: Default role is technician\n');
      } else {
        console.log(`  FAILED: Role is ${r4.user.role}\n`);
        process.exit(1);
      }

      console.log('=== ALL TESTS PASSED ===\n');
    } catch (error) {
      console.error('Test Error:', error);
      process.exit(1);
    } finally {
      await testSequelize.close();
    }
  })();
}
