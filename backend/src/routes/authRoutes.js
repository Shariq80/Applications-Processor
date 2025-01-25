const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Basic auth routes
router.post('/login', authController.login);
router.get('/check', authenticateToken, authController.checkAuth);
router.post('/logout', authController.logout);

// Microsoft OAuth routes
router.get('/microsoft/url', authenticateToken, authController.getMicrosoftAuthUrl);

// Update this route to include the token in the redirect URI
router.get('/microsoft/callback', authController.handleMicrosoftCallback);

// New route to fetch Microsoft accounts
router.get('/microsoft/accounts', authenticateToken, authController.getMicrosoftAccounts);

// Gmail OAuth routes
router.get('/gmail/accounts', authenticateToken, authController.getGmailAccounts);

module.exports = router;
