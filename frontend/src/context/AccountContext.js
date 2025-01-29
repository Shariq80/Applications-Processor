import React, { createContext, useState } from 'react';

export const AccountContext = createContext();

export const AccountProvider = ({ children }) => {
  const [selectedAccount, setSelectedAccount] = useState(null);

  const selectAccount = (account) => {
    setSelectedAccount(account);
  };

  return (
    <AccountContext.Provider value={{ 
      selectedAccount, 
      selectAccount
    }}>
      {children}
    </AccountContext.Provider>
  );
};