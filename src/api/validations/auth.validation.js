const Joi = require('joi')

module.exports = {
  // POST /v1/auth/gitkraken
  oAuth: {
    body: {
      access_token: Joi.string().required()
    }
  },

  // POST /v1/auth/refresh
  refresh: {
    body: {
      userId: Joi.string()
        .required(),
      refreshToken: Joi.string().required()
    }
  }
}
