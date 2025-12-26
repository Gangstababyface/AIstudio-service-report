'use strict';

const { Sequelize } = require('sequelize');
const User = require('./User');

/**
 * Initialize all models with Sequelize instance
 *
 * @param {Sequelize} sequelize - Sequelize instance
 * @returns {Object} - Object containing all initialized models
 */
function initModels(sequelize) {
  const models = {
    User: User.initModel(sequelize),
  };

  // Initialize associations if any models have them
  Object.values(models).forEach((model) => {
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  });

  return models;
}

module.exports = { initModels, User };
