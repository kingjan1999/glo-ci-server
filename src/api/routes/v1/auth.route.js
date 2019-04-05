const express = require('express')
const validate = require('express-validation')
const passport = require('passport')
const base64url = require('base64url')

const controller = require('../../controllers/auth.controller')
const oAuthLogin = require('../../middlewares/auth').oAuth
const {
  oAuth,
  refresh
} = require('../../validations/auth.validation')

const router = express.Router()

/**
 * @api {post} v1/auth/refresh-token Refresh Token
 * @apiDescription Refresh expired accessToken
 * @apiVersion 1.0.0
 * @apiName RefreshToken
 * @apiGroup Auth
 * @apiPermission public
 *
 * @apiParam  {String}  userId         User's id
 * @apiParam  {String}  refreshToken  Refresh token aquired when user logged in
 *
 * @apiSuccess {String}  tokenType     Access Token's type
 * @apiSuccess {String}  accessToken   Authorization Token
 * @apiSuccess {String}  refreshToken  Token to get a new accessToken after expiration time
 * @apiSuccess {Number}  expiresIn     Access Token's expiration time in miliseconds
 *
 * @apiError (Bad Request 400)  ValidationError  Some parameters may contain invalid values
 * @apiError (Unauthorized 401)  Unauthorized     Incorrect email or refreshToken
 */
router.route('/refresh-token').post(validate(refresh), controller.refresh)

router
  .route('/gitkraken')
  .post(validate(oAuth), oAuthLogin('gitkraken'), controller.oAuth)

router.route('/login/gitkraken').get((req, res, next) => {
  passport.authenticate('gitkraken-oauth', {
    scope: 'board:write user:read',
    state: base64url(JSON.stringify({ callback: req.query.callback }))
  })(req, res, next)
})

router.route('/login/gitkraken/callback').get(
  passport.authenticate('gitkraken-oauth', {
    scope: 'board:write user:read',
    session: false
  }),
  controller.oAuth
)

module.exports = router
