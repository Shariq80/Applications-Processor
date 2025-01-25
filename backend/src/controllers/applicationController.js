const microsoftService = require('../services/microsoftService');
const openaiService = require('../services/openaiService');
const Application = require('../models/Application');
const Job = require('../models/Job');
const resumeParserService = require('../services/resumeParserService');
const mongoose = require('mongoose');
const OAuthCredential = require('../models/OAuthCredential');

exports.fetchEmails = async (req, res) => {
  try {
    const { jobTitle } = req.query;
    const userId = req.user._id; // Ensure userId is retrieved from req.user

    if (!jobTitle) {
      return res.status(400).json({ error: 'Job title is required' });
    }

    const existingJob = await Job.findOne({ title: new RegExp(jobTitle, 'i') });
    if (!existingJob) {
      return res.status(404).json({ error: `No job found matching "${jobTitle}". Please create the job first.` });
    }

    // Retrieve OAuth credentials
    const activeCredential = await OAuthCredential.getCredentials(userId);
    if (!activeCredential) {
      return res.status(401).json({ error: 'No OAuth credentials found' });
    }

    // Get authorized Microsoft client
    const microsoft = await microsoftService.getAuthorizedClient(userId);
    const messages = await microsoftService.fetchEmails(userId, jobTitle);

    const existingMessageIds = await Application.distinct('emailMetadata.messageId', { job: existingJob._id });
    const processedEmails = [];

    for (const message of messages) {
      if (existingMessageIds.includes(message.id)) continue;

      const messageData = await microsoftService.getEmailContent(userId, message.id); // Pass userId here
      if (!messageData.subject.toLowerCase().includes(jobTitle.toLowerCase())) continue;

      const processedEmail = await this.processEmail(messageData, jobTitle, userId);
      if (processedEmail) {
        processedEmail.emailMetadata = { messageId: message.id, threadId: message.threadId };
        await processedEmail.save();
        processedEmails.push(processedEmail);
      }
    }

    res.json({ success: true, applications: processedEmails, processed: processedEmails.length, total: messages.length });
  } catch (error) {
    console.error('Error in fetchEmails:', error);
    if (error.message === 'Refresh token is invalid. Please re-authenticate.') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch emails' });
  }
};

exports.processEmail = async (emailData, jobTitle, userId) => {
  try {
    console.log('=== Starting processEmail ===');
    
    const subject = emailData.subject;
    const from = emailData.from.emailAddress.address;
    const fromName = emailData.from.emailAddress.name || from.split('@')[0]; // Extract name or use email prefix

    if (!subject || !from) {
      throw new Error('Missing required email headers');
    }

    if (!subject.toLowerCase().includes(jobTitle.toLowerCase())) {
      throw new Error('Job title not found in subject');
    }

    const job = await Job.findOne({ 
      title: { $regex: new RegExp(jobTitle, 'i') }
    }).select('title description'); // Add description to the query
    
    if (!job) {
      throw new Error(`No matching job found for title: ${jobTitle}`);
    }

    // Process attachments
    const attachments = [];
    let resumeText = '';
    
    if (emailData.attachments && emailData.attachments.length > 0) {
      for (const attachment of emailData.attachments) {
        if (attachment.name.endsWith('.pdf') || attachment.name.endsWith('.doc') || attachment.name.endsWith('.docx')) {
          const attachmentData = await microsoftService.getAttachment(userId, emailData.id, attachment.id);
          attachments.push({
            filename: attachment.name,
            contentType: attachment.contentType,
            data: attachmentData
          });

          // Get resume text for the first attachment only
          if (!resumeText) {
            resumeText = await resumeParserService.parseResume(attachmentData, attachment.name);
          }
        }
      }
    }

    if (attachments.length === 0) {
      throw new Error('No valid attachments found');
    }

    // Get AI score and summary
    const aiResult = await openaiService.scoreResume(resumeText, job.description);

    // Strip HTML tags from email body
    const emailBody = emailData.body.content.replace(/<\/?[^>]+(>|$)/g, "");

    // Create application record
    const application = new Application({
      job: job._id,
      applicantEmail: from,
      applicantName: fromName,
      emailSubject: subject,
      emailBody: emailBody,
      attachments: attachments,
      resumeText: resumeText,
      aiScore: aiResult.score,
      aiSummary: aiResult.summary,
      processedBy: userId
    });

    await application.save();
    return application;

  } catch (error) {
    console.error('Error in processEmail:', error);
    throw error;
  }
};
exports.getAllApplications = async (req, res) => {
  try {
    const { jobId } = req.query;
    const query = { processedBy: req.user._id };
    
    if (jobId) {
      query.job = jobId;
    }
    
    const applications = await Application.find(query)
      .populate('job')
      .sort({ createdAt: -1 });
      
    res.json(applications);
  } catch (error) {
    console.error('Error in getAllApplications:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('job');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



exports.downloadAttachment = async (req, res) => {
  try {
    const { applicationId, attachmentId } = req.params;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const attachment = application.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Set response headers for file download
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);

    // Send the file buffer
    res.send(attachment.data);

  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
};

exports.toggleShortlist = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    application.isShortlisted = !application.isShortlisted;
    await application.save();
    
    res.json({ 
      isShortlisted: application.isShortlisted,
      message: `Application ${application.isShortlisted ? 'shortlisted' : 'removed from shortlist'}`
    });
  } catch (error) {
    console.error('Error in toggleShortlist:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.sendShortlistedApplications = async (req, res) => {
  try {
    console.log('\n=== Starting sendShortlistedApplications ===');
    
    const { jobId } = req.body;
    
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    // Find all shortlisted but unsent applications for this job
    const applications = await Application.find({
      job: jobId,
      isShortlisted: true,
      sentAt: null
    }).populate('job');

    if (!applications.length) {
      throw new Error('No unsent shortlisted applications found');
    }

    // Get Microsoft client
    const graphClient = await microsoftService.getAuthorizedClient(req.user._id);

    // Create HTML content for email
    const htmlContent = `
      <h2>Shortlisted Applications for ${applications[0].job.title}</h2>
      ${applications.map(app => `
        <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
          <h3>${app.applicantName}</h3>
          <p><strong>Email:</strong> ${app.applicantEmail}</p>
          <p><strong>AI Score:</strong> ${app.aiScore}/10</p>
          <p><strong>AI Summary:</strong> ${app.aiSummary}</p>
          <p><strong>Date Received:</strong> ${new Date(app.createdAt).toLocaleDateString()}</p>
          <p><strong>Attachments:</strong></p>
          <ul style="margin-left: 20px;">
            ${app.attachments.map(attachment => `
              <li>${attachment.filename}</li>
            `).join('')}
          </ul>
          <p><strong>Email Body:</strong></p>
          <div style="margin-left: 20px;">${app.emailBody}</div>
        </div>
      `).join('')}
    `;

    // Create email message with attachments
    const email = {
      message: {
        subject: `Shortlisted Applications for ${applications[0].job.title}`,
        body: {
          contentType: 'HTML',
          content: htmlContent,
        },
        toRecipients: [
          {
            emailAddress: {
              address: req.user.email,
            },
          },
        ],
        attachments: applications.flatMap(app => 
          app.attachments.map(attachment => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.filename,
            contentBytes: attachment.data.toString('base64'),
          }))
        ),
      },
    };

    // Send the email
    await graphClient.api('/me/sendMail').post(email);

    // Update sentAt for all applications
    const updatedApplications = await Promise.all(
      applications.map(async (app) => {
        app.sentAt = new Date();
        await app.save();
        return {
          id: app._id,
          sentAt: app.sentAt
        };
      })
    );

    console.log(`Successfully sent ${applications.length} shortlisted applications for job: ${applications[0].job.title}`);

    res.json({
      message: 'Applications sent successfully',
      sentCount: applications.length,
      updatedApplications
    });
  } catch (error) {
    console.error('Error in sendShortlistedApplications:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedApplication = await Application.findByIdAndDelete(id);
    
    if (!deletedApplication) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: error.message });
  }
};
