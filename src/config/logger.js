const winston = require('winston')
const Sentry = require('winston-raven-sentry')
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
      level: 'debug'
    })
  )
} else {
  logger.add(Sentry, {
    dsn: 'https://b57b8dbaac2f4116aacc69d0d1b27786@sentry.io/1432442',
    level: 'warn'
  })
}

logger.stream = {
  write: message => {
    logger.info(message.trim())
  }
}

module.exports = logger
