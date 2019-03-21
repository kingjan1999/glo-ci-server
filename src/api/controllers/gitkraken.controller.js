const GloSDK = require('@axosoft/glo-sdk')
const axios = require('axios')

const apiUrl = 'https://gloapi.gitkraken.com/v1/glo'

exports.getBoards = async (req, res, next) => {
  const user = req.user
  const authToken = user.accessToken
  const boards = await GloSDK(authToken).boards.getAll()
  return res.json(boards)
}

exports.makeGloRequest = async (req, res, next) => {
  const user = req.user
  const authToken = user.accessToken
  const url =
    apiUrl + req.originalUrl.substr(req.originalUrl.indexOf('proxy') + 5)
  console.log('new url: ' + url)
  const response = await axios({
    method: req.method,
    url,
    data: req.body,
    params: req.params,
    headers: {
      Authorization: 'Bearer ' + authToken
    }
  })

  return res.json(response.data)
}
