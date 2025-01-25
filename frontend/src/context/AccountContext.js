import React, { createContext, useState } from 'react';

export const AccountContext = createContext();

export const AccountProvider = ({ children }) => {
  const [selectedMicrosoftAccount, setSelectedMicrosoftAccount] = useState(null);
  const [selectedGmailAccount, setSelectedGmailAccount] = useState(null);

  return (
    <AccountContext.Provider value={{ 
      selectedMicrosoftAccount, 
      setSelectedMicrosoftAccount,
      selectedGmailAccount,
      setSelectedGmailAccount
    }}>
      {children}
    </AccountContext.Provider>
  );
};