'use strict';

/**
 * Sequelize Migration: Create Users Table
 *
 * Creates the users table with:
 * - UUID primary key
 * - Unique email (case-insensitive via CITEXT or LOWER index)
 * - Name field
 * - Role enum (technician/admin) defaulting to technician
 * - Timestamps
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        // Store email lowercase for case-insensitive uniqueness
        set(value) {
          this.setDataValue('email', value.toLowerCase().trim());
        },
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('technician', 'admin'),
        allowNull: false,
        defaultValue: 'technician',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Create a unique index on lowercase email for case-insensitive lookups
    // This works across PostgreSQL, MySQL, and SQLite
    await queryInterface.addIndex('users', {
      name: 'users_email_lower_unique',
      unique: true,
      fields: [Sequelize.fn('LOWER', Sequelize.col('email'))],
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the index first
    await queryInterface.removeIndex('users', 'users_email_lower_unique');

    // Drop the table
    await queryInterface.dropTable('users');

    // For PostgreSQL, also drop the ENUM type
    // This is done automatically in some dialects but explicit here for safety
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
    } catch (error) {
      // Ignore if not PostgreSQL or type doesn't exist
    }
  },
};
