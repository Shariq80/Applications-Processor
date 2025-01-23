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
        done(null, this.accessToken);
      }
    });
  }

  async getAuthUrl() {
    const msalConfig = {
      auth: {
        clientId: config.microsoft.clientId,
        authority: config.microsoft.authority,
        clientSecret: config.microsoft.clientSecret,
      }
    };

    const pca = new msal.ConfidentialClientApplication(msalConfig);

    const authUrlParameters = {
      scopes: config.microsoft.scopes,
      redirectUri: config.microsoft.redirectUri,
      prompt: 'select_account'
    };

    const authUrl = await pca.getAuthCodeUrl(authUrlParameters);
    return authUrl;
  }

  async handleCallback(code) {
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

    try {
      const response = await pca.acquireTokenByCode(tokenRequest);
      const tokens = {
        access_token: response.accessToken,
        refresh_token: response.refreshToken,
        scope: response.scopes.join(' '),
        token_type: response.tokenType,
        expiry_date: response.expiresOn.getTime(),
        id_token: response.idToken,
      };

      this.accessToken = tokens.access_token;
      const graphClient = this.createGraphClient();
      const userProfile = await graphClient.api('/me').get();

      return { tokens, email: userProfile.mail || userProfile.userPrincipalName };
    } catch (error) {
      console.error('Error acquiring token:', error);
      throw new Error('Failed to acquire token');
    }
  }

  async getAuthorizedClient(userId) {
    const credentials = await OAuthCredential.getCredentials(userId);

    if (this.graphClient) {
      return this.graphClient;
    }

    this.accessToken = credentials.access_token;
    this.graphClient = this.createGraphClient();
    return this.graphClient;
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
        response.value.forEach((message, index) => {
          console.log(`Message ${index + 1}: Subject - ${message.subject}`);
          console.log(`Message ${index + 1}: From - ${message.from.emailAddress.address}`);
          console.log(`Message ${index + 1}: Received - ${message.receivedDateTime}`);
        });
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