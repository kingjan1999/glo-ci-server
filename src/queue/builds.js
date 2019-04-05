const axios = require('axios')
const kue = require('kue')

const Build = require('../api/models/builds.model')

let redisConfig
if (process.env.NODE_ENV === 'production') {
  redisConfig = {
    redis: {
      port: process.env.REDIS_PORT,
      host: process.env.REDIS_HOST,
      auth: process.env.REDIS_PASS
    }
  }
} else {
  redisConfig = {}
}

kue.prototype.processAsync = function (name, concurrency, handler) {
  return queue.process(name, concurrency, (job, done) => {
    return handler(job)
      .then(() => done(null))
      .catch(done)
  })
}

const queue = kue.createQueue(redisConfig)

queue.watchStuckJobs(6000)

queue.on('ready', () => {
  // If you need to
  console.info('Queue is ready!')
})

queue.on('error', err => {
  // handle connection errors here
  console.error('There was an error in the main queue!')
  console.error(err)
  console.error(err.stack)
})

queue.processAsync('travisBuild', 5, async job => {
  const data = job.data
  const { repoUrl, requestId, travisToken, internalBuildId } = data
  const reqResponse = await axios.get(repoUrl + '/request/' + requestId, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Travis-API-Version': 3,
      Authorization: 'token ' + travisToken
    }
  })
  const buildIds = reqResponse.data.builds.map(x => x.id)
  job.log('$ received job ids')
  job.log(buildIds)

  const build = await Build.findById(internalBuildId)
  build.travisBuildIds = buildIds
  await build.save()

  job.log('updated build')
  job.log(build)
})

queue.processAsync('buildCleanUp', 5, async job => {
  const data = job.data
  const buildId = data.buildId
  job.log('$ trying to find job %s', buildId)

  try {
    await Build.findByIdAndRemove(buildId).exec()
    job.log('$ job was removed')
  } catch (err) {
    job.log('$ removing job was not successful')
  }
})

module.exports.createTravisBuild = data => {
  return new Promise((resolve, reject) => {
    queue
      .create('travisBuild', data)
      .delay(2000)
      .priority('high')
      .attempts(3)
      .backoff(true)
      .save(err => {
        if (err) {
          console.error(err)
          reject(err)
        }
        if (!err) {
          resolve()
        }
      })
  })
}

module.exports.removeBuildIfStillPresent = data => {
  return new Promise((resolve, reject) => {
    queue
      .create('buildCleanUp', data)
      .delay(24 * 60 * 60 * 1000) // 1 day in ms
      // .delay(2 * 60 * 1000)
      .priority('low')
      .attempts(1)
      .backoff(false)
      .save(err => {
        if (err) {
          console.error(err)
          reject(err)
        }
        if (!err) {
          resolve()
        }
      })
  })
}
