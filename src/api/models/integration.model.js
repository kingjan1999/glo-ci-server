const mongoose = require('mongoose')
const GloSDK = require('@axosoft/glo-sdk')
const uuidv4 = require('uuid/v4')

const { ciProviders, backendUrl } = require('../../config/vars')

const requiredString = { type: String, required: true }

const integrationSchema = new mongoose.Schema(
  {
    board: requiredString,
    columnTrigger: requiredString,
    columnSuccess: requiredString,
    columnFailed: requiredString,
    secret: {
      type: String,
      default: uuidv4
    },
    ciProvider: {
      type: String,
      required: true,
      enum: ciProviders
    },
    gitlabSettings: {
      type: {
        gitRef: requiredString,
        gitlabToken: requiredString,
        projectId: requiredString,
        gitEndpoint: requiredString
      },
      required: false
    },
    travisSettings: {
      type: {
        travisBranch: requiredString,
        travisEndpoint: requiredString,
        travisRepo: { type: Number, required: true },
        travisToken: requiredString
      },
      required: false
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
)

integrationSchema.virtual('webhook_url').get(function () {
  return backendUrl + '/v1/integration/' + this._id + '/hook'
})

integrationSchema.pre('save', function (next) {
  if (this.gitlabSettings && this.gitlabSettings.gitEndpoint) {
    if (!this.gitlabSettings.gitEndpoint.endsWith('/')) {
      this.gitlabSettings += '/'
    }
  }
  next()
})

integrationSchema.method({
  async transformGlo () {
    const populated = await this.populate('userId').execPopulate()
    const token = populated.userId.accessToken
    if (!token) return
    const board = await GloSDK(token).boards.get(this.board, {
      fields: ['name', 'columns']
    })

    const obj = this.toJSON({ virtuals: true })
    obj.board = board
    obj.columnTrigger = board.columns.find(x => x.id === obj.columnTrigger)
    obj.columnSuccess = board.columns.find(x => x.id === obj.columnSuccess)
    obj.columnFailed = board.columns.find(x => x.id === obj.columnFailed)
    obj.userId = obj.userId._id

    return obj
  }
})
/**
 * @typedef Integration
 */
module.exports = mongoose.model('Integration', integrationSchema)
