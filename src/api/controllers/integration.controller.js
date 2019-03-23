const Integration = require('../models/integration.model')
const {
  handleGitkrakenHook,
  handleGitlabHook,
  handleTravisHook
} = require('../services/hookHandler')

exports.create = async (req, res, next) => {
  try {
    req.body.userId = req.user._id
    const integration = await new Integration(req.body).save()
    return res.json({ integration, webhook_url: integration.webhook_url })
  } catch (error) {
    return next(error)
  }
}

exports.list = async (req, res, next) => {
  try {
    const integrations = await Promise.all(
      (await Integration.find({ userId: req.user._id })).map(x =>
        x.transformGlo()
      )
    )
    return res.json({ integrations })
  } catch (error) {
    return next(error)
  }
}

exports.delete = async (req, res, next) => {
  try {
    await Integration.deleteOne({ _id: req.params.id })
    return res.status(204).end()
  } catch (error) {
    return next(error)
  }
}

exports.hook = async (req, res, next) => {
  const integration = await Integration.findOne({ _id: req.params.id })
    .populate('userId')
    .exec()
  if (req.headers['x-gk-signature']) {
    // gitkraken
    return handleGitkrakenHook(req, res, next, integration)
  } else if (req.headers['signature']) {
    // travis
    return handleTravisHook(req, res, next, integration)
  } else if (req.headers['x-gitlab-token']) {
    // gitlab
    return handleGitlabHook(req, res, next, integration)
  } else {
    return res.status(400).send('unknown webhook')
  }
}
