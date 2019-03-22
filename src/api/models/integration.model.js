const mongoose = require('mongoose')
const GloSDK = require('@axosoft/glo-sdk')

const ciProviders = ['travis', 'gitlab']

const requiredString = { type: String, required: true }

const integrationSchema = new mongoose.Schema(
  {
    board: requiredString,
    columnTrigger: requiredString,
    columnSuccess: requiredString,
    columnFailed: requiredString,
    ciProvider: {
      type: String,
      required: true,
      enum: ciProviders
    },
    gitlabSettings: {
      type: {
        gitRef: requiredString,
        gitlabToken: requiredString,
        projectId: requiredString
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
  return 'http://localhost:3000/hook/trigger/' + this._id
})

integrationSchema.method({
  async transformGlo () {
    const populated = await this.populate('userId').execPopulate()
    const token = populated.userId.accessToken
    if (!token) return
    const board = await GloSDK(token).boards.get(this.board, {
      fields: ['name', 'columns']
    })

    const obj = this.toJSON()
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
