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
      email: Joi.string()
        .email()
        .required(),
      refreshToken: Joi.string().required()
    }
  }
}
