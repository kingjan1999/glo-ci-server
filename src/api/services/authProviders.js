/* eslint-disable camelcase */
const axios = require('axios')

exports.gitkraken = async access_token => {
  const fields = ['email', 'name', 'username']
  const url = 'https://gloapi.gitkraken.com/v1/glo/user'
  const params = { access_token, fields }

  const response = await axios.get(url, { params })
  const { id, name, username, email } = response.data
  return {
    service: 'gitkraken',
    id,
    name,
    email,
    username,
    accessToken: access_token
  }
}
