const mongoose = require('mongoose');

const oAuthCredentialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, unique: true }, // Enforce unique constraint
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  provider: { type: String, required: true, enum: ['microsoft', 'gmail'] },
}, { timestamps: true });

oAuthCredentialSchema.index({ userId: 1, provider: 1 }, { unique: true });

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