const express = require('express')
const userRoutes = require('./user.route')
const authRoutes = require('./auth.route')
const gitkrakenRoutes = require('./gitkraken.route')
const integrationRoutes = require('./integration.route')

const packageJson = require('../../../../package.json')

const router = express.Router()

/**
 * GET v1/status
 */
router.get('/status', (req, res) => res.send('OK'))

/**
 * GET v1/version
 */
router.get('/version', (req, res) => res.json({ version: packageJson.version }))

/**
 * GET v1/docs
 */
router.use('/docs', express.static('docs'))

router.use('/users', userRoutes)
router.use('/auth', authRoutes)
router.use('/gitkraken', gitkrakenRoutes)
router.use('/integration', integrationRoutes)

module.exports = router
