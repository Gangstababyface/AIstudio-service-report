'use strict';

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token and extract user info
 *
 * @param {string} idToken - Google ID token from client
 * @returns {Promise<Object>} - User info from Google
 */
async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error('Invalid Google token payload');
  }

  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    googleId: payload.sub,
  };
}

/**
 * Generate JWT session token for the user
 *
 * @param {User} user - User model instance
 * @returns {string} - JWT token
 */
function generateSessionToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'xovr-service-report',
    }
  );
}

/**
 * POST /auth/google/callback
 *
 * Google OAuth callback handler.
 * Receives the Google ID token from the frontend, verifies it,
 * and creates/updates the user in the database.
 *
 * Request body:
 *   - credential: Google ID token (JWT)
 *
 * Response:
 *   - success: true/false
 *   - user: User object (on success)
 *   - token: JWT session token (on success)
 *   - error: Error message (on failure)
 *
 * Flow:
 *   1. Verify Google ID token
 *   2. Extract email and name from Google profile
 *   3. Check if user exists by email (case-insensitive)
 *   4. If exists: Update name if changed
 *   5. If not exists: Create new user with role='technician'
 *   6. Generate session JWT
 *   7. Return user data and token
 */
router.post('/google/callback', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Missing Google credential token',
      });
    }

    // 1. Verify Google token and extract profile
    let googleProfile;
    try {
      googleProfile = await verifyGoogleToken(credential);
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Google token',
      });
    }

    const { email, name, picture } = googleProfile;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email not provided by Google',
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name not provided by Google',
      });
    }

    // 2. Find or create user (case-insensitive email lookup)
    // - If user exists: update name if changed
    // - If user doesn't exist: create with role='technician'
    const { user, created } = await User.findOrCreateFromGoogle({
      email,
      name,
    });

    console.log(
      created
        ? `New user created: ${email} (role: technician)`
        : `Existing user signed in: ${email} (role: ${user.role})`
    );

    // 3. Generate session token
    const token = generateSessionToken(user);

    // 4. Return success response
    return res.status(created ? 201 : 200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        picture, // Pass through Google profile picture
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
      isNewUser: created,
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);

    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors.map((e) => e.message),
      });
    }

    // Handle unique constraint violations (shouldn't happen with upsert logic, but safety net)
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication',
    });
  }
});

/**
 * GET /auth/me
 *
 * Get current user info from JWT token.
 * Requires Authorization header with Bearer token.
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Fetch fresh user data from DB
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      user: user.toSafeJSON(),
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /auth/logout
 *
 * Logout endpoint (for JWT invalidation if using a blocklist)
 * Currently a no-op since JWTs are stateless
 */
router.post('/logout', (req, res) => {
  // For stateless JWT, logout is handled client-side by deleting the token
  // If you need server-side logout, implement a token blocklist
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = router;
