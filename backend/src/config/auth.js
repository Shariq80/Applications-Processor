const jwt = require('./jwt');

module.exports = {
  secret: process.env.JWT_SECRET,
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
  },
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI
  }
};
