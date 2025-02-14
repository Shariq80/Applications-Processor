const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { authenticateToken } = require('../middleware/auth');

router.post('/fetch-microsoft-emails', authenticateToken, applicationController.fetchMicrosoftEmails);
router.post('/fetch-gmail-emails', authenticateToken, applicationController.fetchGmailEmails);
router.post('/send-shortlisted', authenticateToken, applicationController.sendShortlistedApplications);
router.patch('/:id/shortlist', authenticateToken, applicationController.toggleShortlist);
router.get('/', authenticateToken, applicationController.getAllApplications);
router.get('/:id', authenticateToken, applicationController.getApplication);
router.post('/process-microsoft-email', authenticateToken, applicationController.processMicrosoftEmail);
router.post('/process-gmail-email', authenticateToken, applicationController.processGmailEmail);
router.get('/:applicationId/attachments/:attachmentId', authenticateToken, applicationController.downloadAttachment);
router.delete('/:id', authenticateToken, applicationController.deleteApplication);
router.post('/delete-multiple', authenticateToken, applicationController.deleteMultipleApplications);

module.exports = router;
