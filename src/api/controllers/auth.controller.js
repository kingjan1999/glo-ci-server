const base64url = require('base64url')
const User = require('../models/user.model')
const RefreshToken = require('../models/refreshToken.model')
const moment = require('moment-timezone')
const { jwtExpirationInterval } = require('../../config/vars')

/**
 * Returns a formated object with tokens
 * @private
 */
function generateTokenResponse (user, accessToken) {
  const tokenType = 'Bearer'
  const refreshToken = RefreshToken.generate(user).token
  const expiresIn = moment().add(jwtExpirationInterval, 'minutes')
  return {
    tokenType,
    accessToken,
    refreshToken,
    expiresIn
  }
}

/**
 * login with an existing user or creates a new one if valid accessToken token
 * Returns jwt token
 * @public
 */
exports.oAuth = async (req, res, next) => {
  try {
    if (!req.query.state) {
      throw new Error('state not found')
    }

    const callback = JSON.parse(base64url.decode(req.query.state)).callback
    const { user } = req
    const accessToken = user.token()
    const token = generateTokenResponse(user, accessToken)
    // const userTransformed = user.transform()
    return res.redirect(callback + '?token=' + token.accessToken)
    // return res.json({ token, user: userTransformed })
  } catch (error) {
    return next(error)
  }
}

/**
 * Returns a new jwt when given a valid refresh token
 * @public
 */
exports.refresh = async (req, res, next) => {
  try {
    const { email, refreshToken } = req.body
    const refreshObject = await RefreshToken.findOneAndRemove({
      userEmail: email,
      token: refreshToken
    })
    const { user, accessToken } = await User.findAndGenerateToken({
      email,
      refreshObject
    })
    const response = generateTokenResponse(user, accessToken)
    return res.json(response)
  } catch (error) {
    return next(error)
  }
}
