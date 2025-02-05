import React, { createContext, useState, useEffect } from 'react';

export const AccountContext = createContext({
  selectedAccount: null,
  selectAccount: () => {},
});

export const AccountProvider = ({ children }) => {
  const [selectedAccount, setSelectedAccount] = useState(() => {
    const savedAccount = localStorage.getItem('selectedAccount');
    return savedAccount ? JSON.parse(savedAccount) : null;
  });

  const selectAccount = (account) => {
    setSelectedAccount(account);
    localStorage.setItem('selectedAccount', JSON.stringify(account));
  };

  const value = {
    selectedAccount,
    selectAccount,
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};