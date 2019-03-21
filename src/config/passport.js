const JwtStrategy = require('passport-jwt').Strategy
const BearerStrategy = require('passport-http-bearer')
const OAuth2Straegy = require('passport-oauth2').Strategy
const { ExtractJwt } = require('passport-jwt')
const { jwtSecret, gloClientSecret, gloClientId } = require('./vars')
const authProviders = require('../api/services/authProviders')
const User = require('../api/models/user.model')

const jwtOptions = {
  secretOrKey: jwtSecret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer')
}

const jwt = async (payload, done) => {
  try {
    const user = await User.findById(payload.sub)
    if (user) return done(null, user)
    return done(null, false)
  } catch (error) {
    return done(error, false)
  }
}

const oAuth = service => async (token, done) => {
  try {
    const userData = await authProviders[service](token)
    const user = await User.oAuthLogin(userData)
    return done(null, user)
  } catch (err) {
    return done(err)
  }
}

exports.jwt = new JwtStrategy(jwtOptions, jwt)
exports.gitkraken = new BearerStrategy(oAuth('gitkraken'))
exports.gitkrakenOauth = new OAuth2Straegy(
  {
    authorizationURL: 'https://app.gitkraken.com/oauth/authorize',
    tokenURL: 'https://api.gitkraken.com/oauth/access_token',
    clientID: gloClientId,
    clientSecret: gloClientSecret,
    callbackURL: 'http://localhost:3000/v1/auth/login/gitkraken/callback'
  },
  async (accessToken, refreshToken, profile, cb) => {
    const userData = await authProviders.gitkraken(accessToken)
    const user = await User.oAuthLogin(userData)
    return cb(null, user)
  }
)
