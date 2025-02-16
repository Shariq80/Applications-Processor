const microsoftService = require('../services/microsoftService');
const gmailService = require('../services/gmailService');
const openaiService = require('../services/openaiService');
const Application = require('../models/Application');
const Job = require('../models/Job');
const resumeParserService = require('../services/resumeParserService');
const mongoose = require('mongoose');
const OAuthCredential = require('../models/OAuthCredential');
const ObjectId = mongoose.Types.ObjectId;

exports.fetchMicrosoftEmails = async (req, res) => {
  try {
    const { userId, jobTitle } = req.body;

    const emails = await microsoftService.fetchEmails(userId, jobTitle);
    const applications = [];

    for (const email of emails) {
      const emailData = await microsoftService.getEmailContent(userId, email.id);
      const application = await exports.processMicrosoftEmail(userId, emailData, jobTitle);
      applications.push(application);
    }

    res.status(200).json(applications);
  } catch (error) {
    console.error('Error in fetchMicrosoftEmails:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.fetchGmailEmails = async (req, res) => {
  try {
    const { userId, jobTitle } = req.body;

    const emails = await gmailService.fetchEmails(userId, jobTitle);
    const applications = [];

    for (const email of emails) {
      const emailContent = await gmailService.getEmailContent(email.id);
      const application = await exports.processGmailEmail(userId, emailContent, jobTitle);
      if (application) {
        applications.push(application);
      }
    }

    res.status(200).json(applications); // Send the applications back to the client
  } catch (error) {
    console.error('Error in fetchGmailEmails:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.processMicrosoftEmail = async (userId, emailData, jobTitle) => {
  try {
    console.log('=== Starting processMicrosoftEmail ===');

    // Find the job by title
    const job = await Job.findOne({ title: jobTitle });
    if (!job) {
      throw new Error(`Job with title "${jobTitle}" not found`);
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
    const aiResult = await openaiService.scoreResume(resumeText, jobTitle);

    // Strip HTML tags from email body
    const emailBody = emailData.body.content.replace(/<\/?[^>]+(>|$)/g, "");

    // Extract email address from the applicantEmail object
    const applicantEmail = emailData.from.emailAddress.address;

    // Create application record
    const application = new Application({
      job: job._id, // Use job._id instead of jobTitle
      applicantEmail: applicantEmail,
      applicantName: emailData.from.emailAddress.name,
      emailSubject: emailData.subject,
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
    console.error('Error in processMicrosoftEmail:', error);
    throw error;
  }
};

exports.processGmailEmail = async (userId, emailData, jobTitle) => {
  try {
    console.log('=== Starting processGmailEmail ===');
    console.log('Email Data:', JSON.stringify(emailData, null, 2));

    // Find the job by title
    const job = await Job.findOne({ title: jobTitle });
    if (!job) {
      throw new Error(`Job with title "${jobTitle}" not found`);
    }

    // Process attachments
    const attachments = [];
    let resumeText = '';

    if (emailData.attachments && emailData.attachments.length > 0) {
      for (const attachment of emailData.attachments) {
        console.log(`Processing attachment: ${attachment.name}`);
        if (attachment.name.endsWith('.pdf') || attachment.name.endsWith('.doc') || attachment.name.endsWith('.docx')) {
          console.log(`Fetching attachment: ${attachment.name} with ID: ${attachment.id}`);
          const attachmentData = await gmailService.getAttachment(emailData.id, attachment.id);
          attachments.push({
            filename: attachment.name,
            contentType: attachment.mimeType,
            data: attachmentData
          });

          // Get resume text for the first attachment only
          if (!resumeText) {
            console.log(`Parsing resume: ${attachment.name}`);
            resumeText = await resumeParserService.parseResume(attachmentData, attachment.name);
            console.log(`Parsed resume text: ${resumeText}`);
          }
        } else {
          console.log(`Skipping unsupported attachment type: ${attachment.name}`);
        }
      }
    } else {
      console.log('No attachments found in email data');
    }

    if (attachments.length === 0) {
      console.warn('No valid attachments found for email:', emailData.id);
      return null; // Exit gracefully if no valid attachments are found
    }

    // Get AI score and summary
    console.log('Scoring resume with AI');
    const aiResult = await openaiService.scoreResume(resumeText, jobTitle);
    console.log('AI Result:', aiResult);

    // Strip HTML tags from email body
    const emailBody = emailData.body ? emailData.body.replace(/<\/?[^>]+(>|$)/g, "") : "";

    // Extract applicant's name and email from emailData
    const applicantEmail = emailData.from;
    const applicantName = emailData.from.split('<')[0].trim(); // Extract name from "Name <email>"

    // Create application record
    const application = new Application({
      job: job._id, // Use job._id instead of jobTitle
      applicantEmail: applicantEmail,
      applicantName: applicantName,
      emailSubject: emailData.subject,
      emailBody: emailBody,
      attachments: attachments,
      resumeText: resumeText,
      aiScore: aiResult.score,
      aiSummary: aiResult.summary,
      processedBy: userId
    });

    console.log('Saving application to database');
    await application.save();
    console.log('Application saved successfully');

    // Mark email as read
    console.log(`Marking email as read: ${emailData.id}`);
    await gmailService.markEmailAsRead(emailData.id);
    console.log(`Email marked as read: ${emailData.id}`);

    return application;

  } catch (error) {
    console.error('Error in processGmailEmail:', error);
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
      .sort({ createdAt: -1 }) // Add sorting if needed
      .allowDiskUse(true); // Enable disk usage for sorting

    res.status(200).json(applications);
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

exports.deleteMultipleApplications = async (req, res) => {
  try {
    const { applicationIds } = req.body;
    const result = await Application.deleteMany({ _id: { $in: applicationIds } });
    res.json({ message: 'Applications deleted successfully', result });
  } catch (error) {
    console.error('Error deleting applications:', error);
    res.status(500).json({ error: error.message });
  }
};