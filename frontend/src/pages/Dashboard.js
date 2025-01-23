import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import MicrosoftAccountSelector from '../components/MicrosoftAccountSelector';
import JobFormModal from '../components/Jobs/JobFormModal';
import EditJobModal from '../components/Jobs/EditJobModal';
import Button from '../components/Common/Button';
import ConfirmationModal from '../components/Common/ConfirmationModal';
import { AccountContext } from '../context/AccountContext';

const Dashboard = () => {
  const [microsoftAccounts, setMicrosoftAccounts] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobFormModal, setShowJobFormModal] = useState(false);
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const navigate = useNavigate();
  const { selectedAccount, setSelectedAccount } = useContext(AccountContext);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await api.get('/jobs');
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to fetch jobs');
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const fetchMicrosoftAccounts = async () => {
      try {
        const response = await api.get('/auth/microsoft/accounts');
        setMicrosoftAccounts(response.data);
      } catch (error) {
        console.error('Failed to fetch Microsoft accounts:', error);
        toast.error('Failed to fetch Microsoft accounts');
      }
    };

    fetchMicrosoftAccounts();
  }, []);

  const handleMicrosoftAccountSelect = (account) => {
    setSelectedAccount(account);
    toast.success('Account selected successfully');
  };

  const handleConnectMicrosoft = async () => {
    try {
      setIsConnecting(true);
      const response = await api.get('/auth/microsoft/url');
      const authUrl = response.data.url;
      console.log('Auth URL:', authUrl);
  
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in first');
        return;
      }
  
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
      setIsConnecting(false);
    }
  };

  const handleCreateJob = () => {
    setShowJobFormModal(true);
  };

  const handleEditJob = (job) => {
    setSelectedJob(job);
    setShowEditJobModal(true);
  };

  const handleDeleteJob = (jobId) => {
    setJobToDelete(jobId);
    setShowConfirmationModal(true);
  };

  const confirmDeleteJob = async () => {
    const toastId = toast.loading('Deleting job...');
    try {
      await api.delete(`/jobs/${jobToDelete}`);
      toast.success('Job deleted successfully', { id: toastId });
      fetchJobs();
    } catch (error) {
      toast.error('Failed to delete job', { id: toastId });
    } finally {
      setShowConfirmationModal(false);
      setJobToDelete(null);
    }
  };

  const handleViewJob = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Microsoft Accounts</h2>
          <button
            onClick={handleConnectMicrosoft}
            disabled={isConnecting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Microsoft Account'}
          </button>
        </div>
        
        <MicrosoftAccountSelector onAccountSelect={handleMicrosoftAccountSelect} />
        {selectedAccount && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h2 className="text-lg font-medium text-gray-900">Selected Account</h2>
            <p className="mt-2 text-sm text-gray-500">{selectedAccount.email}</p>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Jobs</h2>
          <Button onClick={handleCreateJob}>Create Job</Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Description</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {jobs.map((job) => (
                <tr key={job._id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">{job.title}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{job.description}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{job.status}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 space-x-2">
                    <Button variant="secondary" onClick={() => handleEditJob(job)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDeleteJob(job._id)}>Delete</Button>
                    <Button variant="primary" onClick={() => handleViewJob(job._id)}>View</Button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-4 text-sm text-gray-500 text-center">
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showJobFormModal && (
        <JobFormModal
          onClose={() => setShowJobFormModal(false)}
          onSuccess={() => {
            setShowJobFormModal(false);
            fetchJobs();
          }}
        />
      )}

      {showEditJobModal && selectedJob && (
        <EditJobModal
          job={selectedJob}
          onClose={() => setShowEditJobModal(false)}
          onSuccess={() => {
            setShowEditJobModal(false);
            fetchJobs();
          }}
        />
      )}

      {showConfirmationModal && (
        <ConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => setShowConfirmationModal(false)}
          onConfirm={confirmDeleteJob}
          message="Are you sure you want to delete this job? This action cannot be undone."
        />
      )}
    </div>
  );
};

export default Dashboard;