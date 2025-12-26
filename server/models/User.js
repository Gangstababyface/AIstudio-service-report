'use strict';

const { Model, DataTypes } = require('sequelize');

/**
 * User Model
 *
 * Represents a user authenticated via Google OAuth.
 * - Email is stored lowercase for case-insensitive uniqueness
 * - Role defaults to 'technician' for new users
 * - Name is updated on each sign-in from Google profile
 */
class User extends Model {
  /**
   * Find or create a user by email (case-insensitive).
   * Updates name if user exists.
   *
   * @param {Object} googleProfile - Google OAuth profile data
   * @param {string} googleProfile.email - User's email from Google
   * @param {string} googleProfile.name - User's display name from Google
   * @returns {Promise<{user: User, created: boolean}>}
   */
  static async findOrCreateFromGoogle({ email, name }) {
    if (!email || !name) {
      throw new Error('Email and name are required from Google profile');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing user (case-insensitive)
    let user = await this.findOne({
      where: this.sequelize.where(
        this.sequelize.fn('LOWER', this.sequelize.col('email')),
        normalizedEmail
      ),
    });

    if (user) {
      // User exists - update name if changed
      if (user.name !== name) {
        user.name = name;
        await user.save();
      }
      return { user, created: false };
    }

    // Create new user with default role 'technician'
    user = await this.create({
      email: normalizedEmail,
      name,
      role: 'technician',
    });

    return { user, created: true };
  }

  /**
   * Find user by email (case-insensitive)
   *
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  static async findByEmail(email) {
    if (!email) return null;

    const normalizedEmail = email.toLowerCase().trim();

    return this.findOne({
      where: this.sequelize.where(
        this.sequelize.fn('LOWER', this.sequelize.col('email')),
        normalizedEmail
      ),
    });
  }

  /**
   * Initialize the model with Sequelize instance
   *
   * @param {Sequelize} sequelize - Sequelize instance
   * @returns {User}
   */
  static initModel(sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: true,
          validate: {
            isEmail: {
              msg: 'Must be a valid email address',
            },
            notEmpty: {
              msg: 'Email cannot be empty',
            },
          },
          // Normalize email to lowercase before saving
          set(value) {
            if (value) {
              this.setDataValue('email', value.toLowerCase().trim());
            }
          },
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: {
              msg: 'Name cannot be empty',
            },
            len: {
              args: [1, 255],
              msg: 'Name must be between 1 and 255 characters',
            },
          },
        },
        role: {
          type: DataTypes.ENUM('technician', 'admin'),
          allowNull: false,
          defaultValue: 'technician',
          validate: {
            isIn: {
              args: [['technician', 'admin']],
              msg: 'Role must be either technician or admin',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true, // Adds createdAt and updatedAt
        indexes: [
          {
            unique: true,
            fields: [sequelize.fn('LOWER', sequelize.col('email'))],
            name: 'users_email_lower_unique',
          },
        ],
      }
    );

    return User;
  }

  /**
   * Check if user has admin privileges
   * @returns {boolean}
   */
  isAdmin() {
    return this.role === 'admin';
  }

  /**
   * Promote user to admin role
   * @returns {Promise<User>}
   */
  async promoteToAdmin() {
    this.role = 'admin';
    return this.save();
  }

  /**
   * Return safe user data for API responses (excludes sensitive fields if any)
   * @returns {Object}
   */
  toSafeJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = User;
