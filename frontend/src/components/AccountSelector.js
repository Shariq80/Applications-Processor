import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { AccountContext } from '../context/AccountContext';

const AccountSelector = () => {
  const [microsoftAccounts, setMicrosoftAccounts] = useState([]);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [isConnectingMicrosoft, setIsConnectingMicrosoft] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const { selectedAccount, selectAccount } = useContext(AccountContext);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const [microsoftResponse, gmailResponse] = await Promise.all([
          api.get('/auth/microsoft/accounts'),
          api.get('/auth/gmail/accounts')
        ]);
        setMicrosoftAccounts(microsoftResponse.data);
        setGmailAccounts(gmailResponse.data);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        toast.error('Failed to fetch accounts');
      }
    };

    fetchAccounts();
  }, []);

  const handleConnectMicrosoft = async () => {
    try {
      setIsConnectingMicrosoft(true);
      const response = await api.get('/auth/microsoft/url');
      const authUrl = response.data.url;
      console.log('Auth URL:', authUrl);

      const width = 600;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const oauthWindow = window.open(
        authUrl,
        'Connect Microsoft Account',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'oauth-callback') {
          window.removeEventListener('message', handleMessage);
          if (event.data.success) {
            console.log('OAuth callback success');
            toast.success('Microsoft account connected successfully');
            const response = await api.get('/auth/microsoft/accounts');
            setMicrosoftAccounts(response.data);
          } else {
            console.error('OAuth callback error:', event.data.error);
            toast.error(event.data.error || 'Failed to connect Microsoft account');
          }
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Failed to initiate Microsoft connection:', error);
      toast.error('Failed to connect Microsoft account');
    } finally {
      setIsConnectingMicrosoft(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setIsConnectingGmail(true);
      const response = await api.get('/auth/gmail/url');
      const authUrl = response.data.url;
      console.log('Auth URL:', authUrl);

      const width = 600;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const oauthWindow = window.open(
        authUrl,
        'Connect Gmail Account',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'oauth-callback') {
          window.removeEventListener('message', handleMessage);
          if (event.data.success) {
            console.log('OAuth callback success');
            toast.success('Gmail account connected successfully');
            const response = await api.get('/auth/gmail/accounts');
            setGmailAccounts(response.data);
          } else {
            console.error('OAuth callback error:', event.data.error);
            toast.error(event.data.error || 'Failed to connect Gmail account');
          }
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Failed to initiate Gmail connection:', error);
      toast.error('Failed to connect Gmail account');
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleAccountSelect = (account) => {
    selectAccount(account);
    toast.success(`${account.provider} account selected successfully`);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Connect Accounts</h2>
        <div>
          <button
            onClick={handleConnectMicrosoft}
            disabled={isConnectingMicrosoft}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 mr-2"
          >
            {isConnectingMicrosoft ? 'Connecting...' : 'Connect Microsoft Account'}
          </button>
          <button
            onClick={handleConnectGmail}
            disabled={isConnectingGmail}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isConnectingGmail ? 'Connecting...' : 'Connect Gmail Account'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900">Select Account</h3>
        <div className="mt-2">
          <div className="flex items-center mb-4">
            <input
              id="microsoft-account"
              name="account"
              type="radio"
              checked={selectedAccount?.provider === 'microsoft'}
              onChange={() => handleAccountSelect(microsoftAccounts[0])}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              disabled={!microsoftAccounts.length}
            />
            <label htmlFor="microsoft-account" className="ml-3 block text-sm font-medium text-gray-700">
              Microsoft Account
            </label>
          </div>
          {microsoftAccounts.length ? (
            <ul className="space-y-2">
              {microsoftAccounts.map((account) => (
                <li key={account.email}>
                  <button
                    onClick={() => handleAccountSelect(account)}
                    className="w-full text-left px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    {account.email}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No Microsoft account connected</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center mb-4">
          <input
            id="gmail-account"
            name="account"
            type="radio"
            checked={selectedAccount?.provider === 'gmail'}
            onChange={() => handleAccountSelect(gmailAccounts[0])}
            className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
            disabled={!gmailAccounts.length}
          />
          <label htmlFor="gmail-account" className="ml-3 block text-sm font-medium text-gray-700">
            Gmail Account
          </label>
        </div>
        {gmailAccounts.length ? (
          <ul className="space-y-2">
            {gmailAccounts.map((account) => (
              <li key={account.email}>
                <button
                  onClick={() => handleAccountSelect(account)}
                  className="w-full text-left px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {account.email}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No Gmail account connected</p>
        )}
      </div>
    </div>
  );
};

export default AccountSelector;