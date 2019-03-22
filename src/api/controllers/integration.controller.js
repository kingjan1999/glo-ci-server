const Integration = require('../models/integration.model')

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
