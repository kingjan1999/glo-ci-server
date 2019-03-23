const mongoose = require('mongoose')

const { ciProviders } = require('../../config/vars')

const buildSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ciProviders,
    required: true
  },
  integrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Integration',
    required: true
  },
  cardId: {
    type: String,
    required: true
  },
  buildId: {
    type: String,
    required: true
  },
  travisBuildIds: {
    type: [Number],
    required: false
  }
})

/**
 * @typedef Build
 */
module.exports = mongoose.model('Build', buildSchema)
