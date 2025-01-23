import React, { createContext, useState } from 'react';

export const AccountContext = createContext();

export const AccountProvider = ({ children }) => {
  const [selectedAccount, setSelectedAccount] = useState(null);

  return (
    <AccountContext.Provider value={{ selectedAccount, setSelectedAccount }}>
      {children}
    </AccountContext.Provider>
  );
};