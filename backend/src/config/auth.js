const jwt = require('./jwt');

module.exports = {
  jwt,
  microsoft: {
    clientId: process.env.OUTLOOK_CLIENT_ID,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
    redirectUri: process.env.OUTLOOK_REDIRECT_URI,
    authority: process.env.OUTLOOK_AUTHORITY,
    scopes: [
      'offline_access',
      'User.Read',
      'Mail.Read',
      'Mail.ReadWrite',
      'openid',
      'profile'
    ],
    tenantId: 'common'
  }
};
