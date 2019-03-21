/* eslint-disable camelcase */
const axios = require('axios')

exports.facebook = async access_token => {
  const fields = 'id, name, email, picture'
  const url = 'https://graph.facebook.com/me'
  const params = { access_token, fields }
  const response = await axios.get(url, { params })
  const { id, name, email, picture } = response.data
  return {
    service: 'facebook',
    picture: picture.data.url,
    id,
    name,
    email
  }
}

exports.google = async access_token => {
  const url = 'https://www.googleapis.com/oauth2/v3/userinfo'
  const params = { access_token }
  const response = await axios.get(url, { params })
  const { sub, name, email, picture } = response.data
  return {
    service: 'google',
    picture,
    id: sub,
    name,
    email
  }
}

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
