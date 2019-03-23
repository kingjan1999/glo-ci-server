const express = require('express')
const controller = require('../../controllers/integration.controller')
const { authorize } = require('../../middlewares/auth')

const router = express.Router()

router.route('/').post(authorize(), controller.create)
router.route('/').get(authorize(), controller.list)
router.route('/:id').delete(authorize(), controller.delete)
router.route('/:id/hook').post(controller.hook)

module.exports = router
