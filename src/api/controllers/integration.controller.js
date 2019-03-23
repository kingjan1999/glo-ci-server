const Integration = require('../models/integration.model')
const {
  handleGitkrakenHook,
  handleGitlabHook,
  handleTravisHook
} = require('../services/hookHandler')

exports.preventUpdate = (req, res, next) => {
  delete req.body.webhook_url
  delete req.body._id
  delete req.body.secret
  delete req.body.created_at
  delete req.body.updated_at
  delete req.body.id
  delete req.body._v
  next()
}

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

exports.get = async (req, res, next) => {
  try {
    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).exec()
    return res.json(integration.toJSON({ virtuals: true }))
  } catch (error) {
    return next(error)
  }
}

exports.update = async (req, res, next) => {
  try {
    const integration = await Integration.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id
      },
      req.body
    ).exec()
    return res.json(integration.toJSON({ virtuals: true }))
  } catch (error) {
    return next(error)
  }
}

exports.delete = async (req, res, next) => {
  try {
    await Integration.deleteOne({ _id: req.params.id, userId: req.user._id })
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
