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
router.get('/microsoft/callback', authController.handleMicrosoftCallback);
router.get('/microsoft/accounts', authenticateToken, authController.getMicrosoftAccounts);

// Gmail OAuth routes
router.get('/gmail/url', authenticateToken, authController.getGmailAuthUrl);
router.get('/gmail/callback', authController.handleGmailCallback);
router.get('/gmail/accounts', authenticateToken, authController.getGmailAccounts);

module.exports = router;
