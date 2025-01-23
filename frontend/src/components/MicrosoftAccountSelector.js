import React, { useState, useEffect } from 'react';
import api from '../services/api';

const MicrosoftAccountSelector = ({ onAccountSelect }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/auth/microsoft/accounts');
        setAccounts(response.data);
      } catch (error) {
        console.error('Failed to fetch Microsoft accounts:', error);
      }
    };

    fetchAccounts();
  }, []);

  const handleAccountChange = (event) => {
    const selectedAccountId = event.target.value;
    setSelectedAccount(selectedAccountId);
    const account = accounts.find(acc => acc._id === selectedAccountId);
    onAccountSelect(account);
  };

  return (
    <div className="mt-4">
      <label htmlFor="account-select" className="block text-sm font-medium text-gray-700">
        Select Microsoft Account:
      </label>
      <select
        id="account-select"
        value={selectedAccount || ''}
        onChange={handleAccountChange}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        <option value="" disabled>
          Select an account
        </option>
        {accounts.map((account) => (
          <option key={account._id} value={account._id}>
            {account.email}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MicrosoftAccountSelector;