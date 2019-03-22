const crypto = require('crypto')
const GloSDK = require('@axosoft/glo-sdk')
const axios = require('axios')

const Build = require('../models/builds.model')
const logger = require('../../config/logger')

const createSignature = (buf, secret) => {
  const hmac = crypto.createHmac('sha1', secret)
  hmac.update(buf, 'utf-8')
  return 'sha1=' + hmac.digest('hex')
}

const triggerTravisBuild = async travisSettings => {
  try {
    const url =
      travisSettings.travisEndpoint +
      '/repo/' +
      encodeURIComponent(travisSettings.travisRepo) +
      '/requests'
    const response = await axios.post(
      url,
      {
        request: {
          branch: travisSettings.travisBranch
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Travis-API-Version': 3,
          Authorization: 'token ' + travisSettings.travisToken
        }
      }
    )

    return response.request.id
  } catch (err) {
    logger.error(err)
  }
}

const triggerGitlabBuild = async gitlabSettings => {
  try {
    const response = await axios.post(
      `https://gitlab.com/api/v4/projects/${
        gitlabSettings.projectId
      }/trigger/pipeline`,
      null,
      {
        params: {
          token: gitlabSettings.gitlabToken,
          ref: gitlabSettings.gitRef
        }
      }
    )
    return response.data.id
  } catch (err) {
    logger.error(err)
  }
}

exports.handleGitkrakenHook = async (req, res, next, integration) => {
  const signature = createSignature(req.buf, integration.secret)
  if (signature !== req.headers['x-gk-signature']) {
    return res.status(403).send('invalid signature')
  }

  if (req.headers['x-gk-event'] !== 'cards') {
    // we only handle card events
    return res.status(204)
  }

  const validActions = ['added', 'moved_column', 'moved_to_board']
  if (!validActions.includes(req.body.action)) {
    return res.status(204)
  }

  if (
    !req.body.card ||
    !req.body.card.column_id === integration.triggerColumn
  ) {
    return res.status(204)
  }

  let buildId = -1
  if (integration.ciProvider === 'gitlab') {
    buildId = triggerGitlabBuild(integration.gitlabSettings)
  } else if (integration.ciProvider === 'travis') {
    buildId = triggerTravisBuild(integration.travisSettings)
  } else {
    return res.status(204)
  }
  const build = await new Build({
    provider: integration.ciProvider,
    integrationId: integration._id,
    cardId: req.body.card.id,
    buildId
  }).save()
  return res.json({ message: 'build triggered', build })
}

const moveCardByStatus = async (build, integration, status) => {
  await integration.populate('userId').populateExec()

  let card = await GloSDK(integration.userId.accessToken).cards.get(
    integration.board,
    build.cardId
  )
  if (status === 'success') {
    card.column_id = integration.columnSuccess
  } else if (status === 'failed') {
    card.column_id = integration.columnFailed
  }

  card = await GloSDK(integration.userId.accessToken).cards.edit(
    integration.board,
    card.id,
    card
  )

  return card
}

exports.handleGitlabHook = async (req, res, next, integration) => {
  if (req.header['X-Gitlab-Token'] !== integration.secret) {
    return res.status(403).end('invalid token')
  }

  if (req.header['X-Gitlab-Event'] !== 'Pipeline Hook') {
    return res.status(204)
  }
  res.json({ message: 'processed' }).end()

  const hookBuild = req.body.object_attributes
  const build = await Build.findOne({
    integrationId: integration._id,
    buildId: hookBuild.id
  })

  const status = hookBuild.status
  return moveCardByStatus(build, integration, status)
}

exports.handleTravisHook = async (req, res, next, integration) => {
  const payload = req.body.payload
  const travisSignature = Buffer.from(req.headers.signature, 'base64')

  const configResponse = await axios.get(
    integration.travisSettings.travisEndpoint + '/config'
  )
  const travisPublicKey = configResponse.data.notifications.webhook.public_key
  let verifier = crypto.createVerify('sha1')
  verifier.update(payload)
  if (!verifier.verify(travisPublicKey, travisSignature)) {
    return res.status(403).end('invalid signature')
  }

  res.json({ message: 'processed' }).end()
  if (payload.status_message === 'Pending') {
    return
  }

  const build = await Build.findOne({
    integrationId: integration._id,
    buildId: payload.id
  })

  if (payload.status === 0) {
    return moveCardByStatus(build, integration, 'success')
  } else {
    return moveCardByStatus(build, integration, 'failed')
  }
}
