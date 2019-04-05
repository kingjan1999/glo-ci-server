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

const waitFor = timeout => new Promise(resolve => setTimeout(resolve, timeout))

const triggerTravisBuild = async travisSettings => {
  try {
    logger.info('triggering travis!')
    const repoUrl =
      travisSettings.travisEndpoint +
      '/repo/' +
      encodeURIComponent(travisSettings.travisRepo)
    const url = repoUrl + '/requests'
    const reqResponse = await axios.post(
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
    const requestId = reqResponse.data.request.id
    if (!requestId) return [-1, []]

    await waitFor(2000) // TODO !!!!! queue
    const reqResponse2 = await axios.get(repoUrl + '/request/' + requestId, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Travis-API-Version': 3,
        Authorization: 'token ' + travisSettings.travisToken
      }
    })
    const buildIds = reqResponse2.data.builds.map(x => x.id)
    return [requestId, buildIds]
  } catch (err) {
    logger.error(err)
    return [-1, []]
  }
}

const triggerGitlabBuild = async gitlabSettings => {
  try {
    logger.info(
      'triggering gitlab on ' +
        gitlabSettings.gitEndpoint +
        ' for project ' +
        gitlabSettings.projectId
    )
    const response = await axios.post(
      `${gitlabSettings.gitEndpoint}api/v4/projects/${
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
    return -1
  }
}

exports.handleGitkrakenHook = async (req, res, next, integration) => {
  const signature = createSignature(
    JSON.stringify(req.body),
    integration.secret
  )
  if (signature !== req.headers['x-gk-signature']) {
    logger.warn('could not verify signature')
    return res.status(403).send('invalid signature')
  }

  if (req.headers['x-gk-event'] !== 'cards') {
    // we only handle card events
    logger.debug('ignoring gk non card event')
    return res.status(204).end()
  }

  const validActions = ['added', 'moved_column', 'moved_to_board']
  if (!validActions.includes(req.body.action)) {
    logger.debug('ignoring gk action ' + req.body.action)
    return res.status(204).end()
  }

  if (!req.body.card) {
    logger.debug('gk: card is not given in body!')
    return res.status(400).end()
  }
  if (req.body.card.column_id !== integration.columnTrigger) {
    logger.debug(
      'ignoring gk non trigger column: ' +
        req.body.card.column_id +
        ' vs ' +
        integration.columnTrigger
    )
    return res.status(204).end()
  }

  let buildId = -1
  let buildIds = []
  if (integration.ciProvider === 'gitlab') {
    buildId = await triggerGitlabBuild(integration.gitlabSettings)
  } else if (integration.ciProvider === 'travis') {
    const travisIds = await triggerTravisBuild(integration.travisSettings)
    buildId = travisIds[0]
    buildIds = travisIds[1]
  } else {
    logger.warn('ignoring, because ci provider is unknown')
    return res.status(204).end()
  }
  if (buildId === -1) {
    logger.warn('could not trigger build!')
    return res.status(204).end()
  }
  const build = await new Build({
    provider: integration.ciProvider,
    integrationId: integration._id,
    cardId: req.body.card.id,
    travisBuildIds: buildIds,
    buildId
  }).save()
  return res.json({ message: 'build triggered', build }).end()
}

const moveCardByStatus = async (build, integration, status, originalStatus) => {
  // await integration.populate('userId').exec()

  let card = await GloSDK(integration.userId.accessToken).boards.cards.get(
    integration.board,
    build.cardId
  )
  if (status === 'success') {
    card.column_id = integration.columnSuccess
  } else if (status === 'failed') {
    card.column_id = integration.columnFailed
  }

  card = await GloSDK(integration.userId.accessToken).boards.cards.edit(
    integration.board,
    card.id,
    card
  )

  await GloSDK(integration.userId.accessToken).boards.cards.comments.create(
    integration.board,
    card.id,
    {
      text: `[Glo CI](https://glo-ci.xyz) CI build ${
        build.buildId
      } ended with status ${originalStatus}`
    }
  )

  await build.remove()

  return card
}

exports.handleGitlabHook = async (req, res, next, integration) => {
  if (req.headers['x-gitlab-token'] !== integration.secret) {
    return res.status(403).end('invalid token')
  }

  if (req.headers['x-gitlab-event'] !== 'Pipeline Hook') {
    return res.status(204).end()
  }
  res.json({ message: 'processed' }).end()

  const hookBuild = req.body.object_attributes
  const status = hookBuild.status
  const ignoreStatus = ['pending', 'running']
  if (ignoreStatus.indexOf(status) > -1) return

  const build = await Build.findOne({
    integrationId: integration._id,
    buildId: hookBuild.id
  }).exec()
  if (!build) {
    logger.info("gitlab: couldn't find triggered build!")
    return
  }

  return moveCardByStatus(build, integration, status, status)
}

exports.handleTravisHook = async (req, res, next, integration) => {
  const payload = req.body.payload
  const travisSignature = Buffer.from(req.headers.signature, 'base64')

  const configResponse = await axios.get(
    integration.travisSettings.travisEndpoint + '/config'
  )
  const travisPublicKey =
    configResponse.data.config.notifications.webhook.public_key
  let verifier = crypto.createVerify('sha1')
  verifier.update(payload)
  if (!verifier.verify(travisPublicKey, travisSignature)) {
    return res.status(403).end('invalid signature')
  }

  res.json({ message: 'processed' }).end()
  const parsedPayload = JSON.parse(payload)
  const ignoreStatus = ['Pending']
  if (ignoreStatus.indexOf(parsedPayload.status_message) > -1) {
    return
  }

  const build = await Build.findOne({
    integrationId: integration._id,
    travisBuildIds: parsedPayload.id
  }).exec()

  if (!build) {
    logger.info("travis: couldn't find triggered build ")
    return
  }

  if (parsedPayload.status === 0) {
    return moveCardByStatus(
      build,
      integration,
      'success',
      parsedPayload.status_message
    )
  } else {
    return moveCardByStatus(
      build,
      integration,
      'failed',
      parsedPayload.status_message
    )
  }
}
