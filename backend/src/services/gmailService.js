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
        refreshToken: tokens.refresh_token || 'dummy_refresh_token', // Ensure refreshToken is set
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
  const credential = await OAuthCredential.findOne({ userId, provider: 'gmail' });
  if (!credential) {
    throw new Error('No OAuth credentials found for Gmail');
  }
  oauth2Client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
  });

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

  if (!credential.refreshToken) {
    throw new Error('No refresh token is set');
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
    labelIds: ['UNREAD']
  });
  return res.data.messages || [];
};

const getAttachment = async (messageId, attachmentId) => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId,
  });
  return Buffer.from(res.data.data, 'base64');
};

const getEmailContent = async (messageId) => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const message = res.data;

  // Extract the body content
  let body = '';
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  } else if (message.payload.body.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  }

  // Extract attachments
  const attachments = [];
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.body && part.body.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          name: part.filename,
          mimeType: part.mimeType,
        });
      }
    }
  }

  return {
    id: messageId, // Include the messageId in the returned object
    subject: message.payload.headers.find(header => header.name === 'Subject').value,
    from: message.payload.headers.find(header => header.name === 'From').value,
    date: message.payload.headers.find(header => header.name === 'Date').value,
    body: body,
    attachments: attachments,
  };
};

const markEmailAsRead = async (messageId) => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      removeLabelIds: ['UNREAD']
    }
  });
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
  getAttachment,
  markEmailAsRead,
  getUserInfo,
  refreshAccessToken,
};