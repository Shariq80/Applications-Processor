const mongoose = require('mongoose');

const oAuthCredentialSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  scope: String,
  token_type: String,
  expiry_date: Number,
  id_token: String,
  tenantId: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: true
  }
}, { timestamps: true });

oAuthCredentialSchema.statics.getCredentials = async function(userId) {
  console.log(`Fetching OAuth credentials for userId: ${userId}`);
  
  // Try to find credentials for the specific user
  const userCred = await this.findOne({ userId });
  if (userCred) {
    console.log('User-specific credentials found:', userCred);
    return userCred;
  }

  // Fall back to default credentials if user-specific credentials are not found
  const defaultCred = await this.findOne({ isDefault: true });
  if (!defaultCred) {
    console.error('No OAuth credentials found');
    throw new Error('No OAuth credentials found');
  }
  console.log('Default credentials found:', defaultCred);
  return defaultCred;
};
module.exports = mongoose.model('OAuthCredential', oAuthCredentialSchema);
