const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const OAuthCredential = require('../models/OAuthCredential');

const oauth2Client = new OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

const getGmailAuthUrl = (token) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: token,
    prompt:'select_account'
  });
};

const getGmailTokens = async (code, userId) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Set default expiry if not provided
    if (!tokens.expiry_time) {
      tokens.expiry_time = 3600; // 1 hour in seconds
    }

    oauth2Client.setCredentials(tokens);

    // Save the tokens to the database
    const credential = await OAuthCredential.findOneAndUpdate(
      { userId: userId, provider: 'gmail' },
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expiry_time * 1000),
      },
      { upsert: true, new: true }
    );

    return tokens;
  } catch (error) {
    console.error('Error getting Gmail tokens:', error);
    throw error;
  }
};

const getAuthorizedClient = async (userId) => {
  // Fetch OAuth credentials from the database
  const credential = await OAuthCredential.findOne({ userId, provider: 'gmail' });
  if (!credential) {
    throw new Error('No OAuth credentials found for Gmail');
  }
  oauth2Client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
  });

  // Check if the token is expired
  if (new Date() >= new Date(credential.expiresAt)) {
    console.log('Access token is expired, refreshing...');
    await refreshAccessToken(userId);
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
};

const refreshAccessToken = async (userId) => {
  const credential = await OAuthCredential.findOne({ userId, provider: 'gmail' });
  if (!credential) {
    throw new Error('No OAuth credentials found for Gmail');
  }

  oauth2Client.setCredentials({
    refresh_token: credential.refreshToken,
  });

  try {
    const tokens = await oauth2Client.refreshAccessToken();
    const { access_token, expiry_date } = tokens.credentials;

    credential.accessToken = access_token;
    credential.expiresAt = new Date(expiry_date);
    await credential.save();

    oauth2Client.setCredentials(tokens.credentials);
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
};

const fetchEmails = async (userId, jobTitle) => {
  const gmail = await getAuthorizedClient(userId);
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `subject:${jobTitle}`,
  });
  return res.data.messages || [];
};

const getEmailContent = async (messageId) => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  });
  const message = res.data;
  const body = message.payload.parts.find(part => part.mimeType === 'text/plain').body.data;
  const decodedBody = Buffer.from(body, 'base64').toString('utf-8');
  return {
    subject: message.payload.headers.find(header => header.name === 'Subject').value,
    from: message.payload.headers.find(header => header.name === 'From').value,
    date: message.payload.headers.find(header => header.name === 'Date').value,
    body: decodedBody,
  };
};

const getUserInfo = async (accessToken) => {
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  return userInfo.data;
};

module.exports = {
  getGmailAuthUrl,
  getGmailTokens,
  getAuthorizedClient,
  fetchEmails,
  getEmailContent,
  getUserInfo,
  refreshAccessToken,
};