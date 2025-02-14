import React, { createContext, useState } from 'react';

export const AccountContext = createContext({
  selectedAccount: null,
  selectAccount: () => {},
});

export const AccountProvider = ({ children }) => {
  const [selectedAccount, setSelectedAccount] = useState(() => {
    const savedAccount = sessionStorage.getItem('selectedAccount');
    return savedAccount ? JSON.parse(savedAccount) : null;
  });

  const selectAccount = (account) => {
    setSelectedAccount(account);
    sessionStorage.setItem('selectedAccount', JSON.stringify(account));
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