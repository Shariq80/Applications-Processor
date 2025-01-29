import { Fragment, useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { useAuth } from '../../context/AuthContext';
import { AccountContext } from '../../context/AccountContext';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', href: '/dashboard' }
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { selectedAccount, selectAccount } = useContext(AccountContext);
  const [accounts, setAccounts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const [microsoftResponse, gmailResponse] = await Promise.all([
          api.get('/auth/microsoft/accounts'),
          api.get('/auth/gmail/accounts')
        ]);
        setAccounts([...microsoftResponse.data, ...gmailResponse.data]);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        toast.error('Failed to fetch accounts');
      }
    };

    fetchAccounts();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAccountSelect = (account) => {
    selectAccount(account);
    toast.success(`${account.provider} account selected successfully`);
  };

  const getSelectedAccountType = () => {
    if (selectedAccount) return `${selectedAccount.provider.charAt(0).toUpperCase() + selectedAccount.provider.slice(1)} Account Selected`;
    return null;
  };

  const getSelectedAccountColor = () => {
    if (selectedAccount?.provider === 'microsoft') return 'text-blue-600';
    if (selectedAccount?.provider === 'gmail') return 'text-red-600';
    return 'text-gray-700';
  };

  return (
    <Disclosure as="nav" className="bg-white shadow">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <div className="flex flex-shrink-0 items-center">
                  <Link to="/" className="text-xl font-bold text-indigo-600">
                    Prosapiens Application Portal
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                {getSelectedAccountType() && (
                  <div className={`mr-4 text-sm ${getSelectedAccountColor()}`}>
                    {getSelectedAccountType()}
                  </div>
                )}
                <Menu as="div" className="relative ml-3">
                  <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    <span className="sr-only">Open account menu</span>
                    <div className="h-12 px-3 rounded-full bg-indigo-100 flex items-center justify-center text-sm text-indigo-700">
                      Accounts
                    </div>
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      {accounts.map((account) => (
                        <Menu.Item key={account.email}>
                          {({ active }) => (
                            <button
                              onClick={() => handleAccountSelect(account)}
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block w-full px-4 py-2 text-left text-sm text-gray-700 truncate`}
                              title={`${account.email} (${account.provider})`}
                            >
                              ({account.provider}) {account.email}
                            </button>
                          )}
                        </Menu.Item>
                      ))}
                    </Menu.Items>
                  </Transition>
                </Menu>
                <Menu as="div" className="relative ml-3">
                  <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                    <span className="sr-only">Open user menu</span>
                    <div className="h-12 px-3 rounded-full bg-indigo-100 flex items-center justify-center text-sm text-indigo-700">
                      {user?.name || 'User'}
                    </div>
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={`${
                              active ? 'bg-gray-100' : ''
                            } block w-full px-4 py-2 text-left text-sm text-gray-700`}
                          >
                            Sign out
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>
            </div>
          </div>
        </>
      )}
    </Disclosure>
  );
}