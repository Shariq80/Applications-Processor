const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/auth');
const microsoftService = require('../services/microsoftService');
const OAuthCredential = require('../models/OAuthCredential');
const msal = require('@azure/msal-node');
const gmailService = require('../services/gmailService');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, config.secret, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

exports.getMicrosoftAuthUrl = async (req, res) => {
  try {
    const msalConfig = {
      auth: {
        clientId: config.microsoft.clientId,
        authority: config.microsoft.authority,
        clientSecret: config.microsoft.clientSecret,
      }
    };

    const pca = new msal.ConfidentialClientApplication(msalConfig);

    const stateToken = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Generated state token:', stateToken);

    const authUrlParameters = {
      scopes: config.microsoft.scopes,
      redirectUri: config.microsoft.redirectUri,
      state: stateToken,
      prompt: 'select_account'
    };

    const authUrl = await pca.getAuthCodeUrl(authUrlParameters);
    console.log('Generated auth URL:', authUrl);

    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating Microsoft auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

exports.handleMicrosoftCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    console.log('Received code:', code);
    console.log('Received state:', state);

    // Verify the state token to get the user ID
    const decodedState = jwt.verify(state, process.env.JWT_SECRET);
    const userId = decodedState.id;

    console.log('Decoded state:', decodedState);
    console.log('User ID:', userId);

    // Exchange the authorization code for tokens
    const msalConfig = {
      auth: {
        clientId: config.microsoft.clientId,
        authority: config.microsoft.authority,
        clientSecret: config.microsoft.clientSecret,
      }
    };

    const pca = new msal.ConfidentialClientApplication(msalConfig);

    const tokenRequest = {
      code,
      scopes: config.microsoft.scopes,
      redirectUri: config.microsoft.redirectUri,
    };

    const response = await pca.acquireTokenByCode(tokenRequest);

    console.log('Token response:', response);

    const { accessToken, refreshToken, expiresOn, idToken } = response;

    console.log('Access Token:', accessToken);
    console.log('Refresh Token:', refreshToken);
    console.log('Expires On:', expiresOn);
    console.log('ID Token:', idToken);

    // Decode the ID token to get user information
    const decodedToken = jwt.decode(idToken);
    const email = decodedToken.email || decodedToken.preferred_username;

    console.log('Decoded ID Token:', decodedToken);
    console.log('Email:', email);

    // Check if the Microsoft account is already connected to another user
    const existingCredential = await OAuthCredential.findOne({ email });
    if (existingCredential && existingCredential.userId.toString() !== userId) {
      return res.status(400).json({ error: 'This Microsoft account is already connected to another user.' });
    }

    // Calculate the expiration date
    const expiresAt = new Date(expiresOn);

    console.log('Expires At:', expiresAt);

    // Save the credentials to the database
    const credentials = new OAuthCredential({
      userId,
      email,
      accessToken,
      refreshToken: refreshToken || 'dummy_refresh_token', // Ensure refreshToken is set
      expiresAt,
      provider: 'microsoft',
    });

    await credentials.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error in handleMicrosoftCallback:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMicrosoftAccounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const accounts = await OAuthCredential.find({ userId, provider: 'microsoft' });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getGmailAuthUrl = (req, res) => {
  try {
    // Generate a state token with user ID
    const stateToken = jwt.sign({ userId: req.user._id }, config.secret);
    const url = gmailService.getGmailAuthUrl(stateToken);
    res.status(200).json({ url });
  } catch (error) {
    console.error('Gmail Auth URL Error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

exports.handleGmailCallback = async (req, res) => {
  const { code, state } = req.query;

  try {
    console.log('Starting Gmail callback handler');
    console.log('Received state token:', state);
    
    const decoded = jwt.verify(state, config.secret);
    console.log('Decoded token:', decoded);
    
    const userId = decoded.userId;
    console.log('User ID:', userId);

    const tokens = await gmailService.getGmailTokens(code);
    console.log('Received Gmail tokens');

    const userInfo = await gmailService.getUserInfo(tokens.access_token);
    console.log('User email:', userInfo.email);

    // Check existing credential
    const existingCredential = await OAuthCredential.findOne({ 
      email: userInfo.email,
      provider: 'gmail'
    });

    if (existingCredential && existingCredential.userId.toString() !== userId) {
      throw new Error('This Gmail account is already connected to another user');
    }

    // Calculate expiration date
    const expiresAt = new Date();
    if (tokens.expiry_time) {
      expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expiry_time);
    } else {
      // Default expiration of 1 hour if no expiry_time provided
      expiresAt.setHours(expiresAt.getHours() + 1);
    }

    console.log('Expiration date:', expiresAt);

    // Validate date before saving
    if (isNaN(expiresAt.getTime())) {
      throw new Error('Invalid expiration date');
    }

    // Create or update OAuth credentials
    const oauthCredential = await OAuthCredential.findOneAndUpdate(
      { 
        userId,
        email: userInfo.email,
        provider: 'gmail'
      },
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );

    console.log('Saved credential:', oauthCredential);
    res.json({ success: true });
  } catch (error) {
    console.error('Gmail Callback Error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?error=${encodeURIComponent(error.message)}`);
  }
};

exports.getGmailAccounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const accounts = await OAuthCredential.find({ userId, provider: 'gmail' });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};