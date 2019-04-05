// make bluebird default Promise
// eslint-disable-next-line no-global-assign
Promise = require('bluebird')

const { port, env } = require('./config/vars')
const logger = require('./config/logger')
const app = require('./config/express')
const mongoose = require('./config/mongoose')

// open mongoose connection
mongoose.connect()

// listen to requests
app.listen(port, () => logger.info(`server started on port ${port} (${env})`))

/**
 * Exports express
 * @public
 */
module.exports = app
