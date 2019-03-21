const express = require('express')
const controller = require('../../controllers/gitkraken.controller')
const { authorize } = require('../../middlewares/auth')

const router = express.Router()

router.route('/boards').get(authorize(), controller.getBoards)

router.route('/proxy/*').all(authorize(), controller.makeGloRequest)

module.exports = router
