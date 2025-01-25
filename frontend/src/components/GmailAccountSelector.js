import React from 'react';

const GmailAccountSelector = ({ onAccountSelect }) => {
  const [gmailAccounts, setGmailAccounts] = React.useState([]);

  React.useEffect(() => {
    const fetchGmailAccounts = async () => {
      try {
        const response = await fetch('/api/auth/gmail/accounts');
        const data = await response.json();
        setGmailAccounts(data);
      } catch (error) {
        console.error('Failed to fetch Gmail accounts:', error);
      }
    };

    fetchGmailAccounts();
  }, []);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900">Select Gmail Account</h3>
      <ul className="mt-2 space-y-2">
        {gmailAccounts.map((account) => (
          <li key={account.email}>
            <button
              onClick={() => onAccountSelect(account)}
              className="w-full text-left px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {account.email}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GmailAccountSelector;