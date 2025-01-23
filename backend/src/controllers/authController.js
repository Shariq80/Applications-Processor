const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/auth')
const microsoftService = require('../services/microsoftService');
const OAuthCredential = require('../models/OAuthCredential');
const msal = require('@azure/msal-node')



exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const { access_token, refresh_token, expires_in, id_token } = req.body;
    const userId = req.user._id;

    // Decode the ID token to get user information
    const decodedToken = jwt.decode(id_token);
    const email = decodedToken.email || decodedToken.preferred_username;

    // Calculate the expiration date
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save the credentials to the database
    const credentials = new OAuthCredential({
      userId,
      email,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt
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
    const accounts = await microsoftService.getMicrosoftAccounts(userId);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
