const { Client } = require('@microsoft/microsoft-graph-client');
const OAuthCredential = require('../models/OAuthCredential');
const msal = require('@azure/msal-node');
const config = require('../config/auth');

class MicrosoftService {
  constructor() {
    this.graphClient = null;
    this.accessToken = null;
  }

  createGraphClient() {
    return Client.init({
      authProvider: (done) => {
        if (!this.accessToken) {
          console.error('Access token is undefined or empty.');
          done(new Error('Access token is undefined or empty.'));
        } else {
          done(null, this.accessToken);
        }
      }
    });
  }

  async getAuthorizedClient(userId) {
    try {
      const credentials = await OAuthCredential.getCredentials(userId);
      console.log('Retrieved credentials:', credentials);

      if (this.graphClient) {
        return this.graphClient;
      }

      this.accessToken = credentials.accessToken;
      console.log('Set access token:', this.accessToken);

      this.graphClient = this.createGraphClient();
      return this.graphClient;
    } catch (error) {
      console.error('Error getting authorized client:', error);
      throw error;
    }
  }

  async fetchEmails(userId, jobTitle) {
    try {
      console.log(`Fetching emails for userId: ${userId} with jobTitle: ${jobTitle}`);
      const graphClient = await this.getAuthorizedClient(userId);
      console.log('Graph client created successfully');

      const filterQuery = `isRead eq false and hasAttachments eq true and contains(subject, '${jobTitle}')`;
      console.log(`Filter Query: ${filterQuery}`);

      const response = await graphClient.api('/me/mailFolders/inbox/messages')
        .filter(filterQuery)
        .get();

      console.log('API Response:', response);

      if (response && response.value) {
        console.log(`Found ${response.value.length} unread messages with attachments and subject containing '${jobTitle}'`);
        for (const message of response.value) {
          console.log(`Processing message: ${message.subject}`);
          // Process the email here
          // ...

          // Mark the email as read
          await this.markEmailAsRead(userId, message.id);
        }
      } else {
        console.log('No messages found');
      }

      return response.value;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  async getEmailContent(userId, messageId) {
    try {
      const graphClient = await this.getAuthorizedClient(userId);
      const response = await graphClient.api(`/me/messages/${messageId}`).expand('attachments').get();
      return response;
    } catch (error) {
      console.error('Error fetching email content:', error);
      throw error;
    }
  }

  async getAttachment(userId, messageId, attachmentId) {
    try {
      const graphClient = await this.getAuthorizedClient(userId);
      const response = await graphClient.api(`/me/messages/${messageId}/attachments/${attachmentId}`).get();
      return Buffer.from(response.contentBytes, 'base64');
    } catch (error) {
      console.error('Error fetching attachment:', error);
      throw error;
    }
  }

  async markEmailAsRead(userId, messageId) {
    try {
      const graphClient = await this.getAuthorizedClient(userId);
      await graphClient.api(`/me/messages/${messageId}`).patch({
        isRead: true
      });
      console.log(`Marked email ${messageId} as read`);
    } catch (error) {
      console.error('Error marking email as read:', error);
      throw error;
    }
  }

  async sendEmail(to, subject, message, attachments = []) {
    try {
      const graphClient = await this.getAuthorizedClient();
      const email = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: message,
          },
          toRecipients: [
            {
              emailAddress: {
                address: to,
              },
            },
          ],
          attachments: attachments.map((attachment) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.filename,
            contentBytes: attachment.data.toString('base64'),
          })),
        },
      };

      await graphClient.api('/me/sendMail').post(email);
      console.log(`Email sent to ${to} with subject '${subject}'`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async getMicrosoftAccounts(userId) {
    try {
      const accounts = await OAuthCredential.find({ userId });
      console.log(`Fetched Microsoft accounts for userId: ${userId}`);
      return accounts;
    } catch (error) {
      console.error('Error fetching Microsoft accounts:', error);
      throw error;
    }
  }
}

module.exports = new MicrosoftService();