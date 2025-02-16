import { useState, useEffect, useCallback, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import ApplicationModal from '../components/Applications/ApplicationModal';
import DeleteConfirmModal from '../components/Applications/DeleteConfirmModal';
import ApplicationsTable from '../components/Applications/ApplicationsTable';
import Button from '../components/Common/Button';
import AiScoreInput from '../components/Common/AiScoreInput';
import { AccountContext } from '../context/AccountContext';

export default function JobReview() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [dateFilter, setDateFilter] = useState('');
  const [aiScoreFilter, setAiScoreFilter] = useState('');
  const [emailCount, setEmailCount] = useState(0); // Add state for email count
  const { accounts, selectedAccount, selectAccount } = useContext(AccountContext);

  const fetchJobDetails = useCallback(async () => {
    try {
      const response = await api.get(`/jobs/${id}`);
      setJob(response.data);
    } catch (error) {
      console.error('Failed to fetch job details:', error);
      toast.error('Failed to fetch job details');
      setError('Failed to fetch job details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchApplications = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await api.get(`/applications?jobId=${id}`, {
        headers: {
          'Account-ID': selectedAccount?._id,
        },
        signal: controller.signal,
      });
      setApplications(response.data);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Fetch applications request timed out');
        toast.error('Fetch applications request timed out');
      } else {
        console.error('Failed to fetch applications:', error);
        toast.error('Failed to fetch applications');
      }
      setError('Failed to fetch applications');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [id, selectedAccount]);

  useEffect(() => {
    fetchJobDetails();
    if (selectedAccount) {
      fetchApplications();
    }
  }, [fetchJobDetails, fetchApplications, selectedAccount]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (selectedAccount) {
        fetchApplications();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [fetchApplications, selectedAccount]);

  const handleAccountSelect = (event) => {
    const selectedAccountId = event.target.value;
    const account = accounts?.find(acc => acc._id === selectedAccountId);
    selectAccount(account);
    toast.success(`Selected ${account.email}`);
  };

  const handleFetchEmails = async () => {
    if (!job || !job.title) {
      toast.error('Job title is required');
      return;
    }
    if (!selectedAccount) {
      toast.error('Please select an account before fetching emails');
      return;
    }
    setProcessing(true);
    const toastId = toast.loading('Processing new applications...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      console.log('Fetching emails with job title:', job.title);
      console.log('Selected account:', selectedAccount);
  
      const response = await api.post(
        selectedAccount.provider === 'microsoft' 
          ? '/applications/fetch-microsoft-emails' 
          : '/applications/fetch-gmail-emails', 
        {
          jobTitle: job.title,
          userId: selectedAccount.userId
        },
        { signal: controller.signal }
      );
  
      if (response.data.applications) {
        const totalApplications = response.data.applications.length;
        let processedCount = 0;

        for (let i = 0; i < totalApplications; i += 20) { // Process in batches of 20
          const batch = response.data.applications.slice(i, i + 20);
          // Process each batch (you can implement your batch processing logic here)
          await processBatch(batch);
          processedCount += batch.length;
          toast.success(`Processed ${processedCount} out of ${totalApplications} applications`, { id: toastId });
        }

        setEmailCount(totalApplications); // Update email count
        await fetchApplications();
        toast.success(`Successfully processed ${totalApplications} new applications`, { id: toastId });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Fetch emails request timed out');
        toast.error('Fetch emails request timed out', { id: toastId });
      } else {
        console.error('Error fetching emails:', error);
        toast.error('Failed to process new applications', { id: toastId });
      }
    } finally {
      clearTimeout(timeoutId);
      setProcessing(false);
      setTimeout(() => toast.dismiss(toastId), 5000); // Dismiss the toast after 5 seconds
    }
  };

  const processBatch = async (batch) => {
    // Implement your batch processing logic here
    // For example, you can send a request to the backend to process the batch
    await api.post('/applications/process-batch', { applications: batch });
  };

  const handleToggleShortlist = async (applicationId) => {
    const toastId = toast.loading('Updating shortlist status...');
    try {
      const response = await api.patch(`/applications/${applicationId}/shortlist`);
      // Update the applications list with the new data
      setApplications(prevApplications =>
        prevApplications.map(app =>
          app._id === applicationId
            ? { ...app, isShortlisted: response.data.isShortlisted }
            : app
        )
      );
      toast.success('Updated shortlist status', { id: toastId });
    } catch (error) {
      toast.error('Failed to update shortlist status', { id: toastId });
      throw error; // Propagate error to modal component
    }
  };

  const handleSendShortlisted = async () => {
    const toastId = toast.loading('Sending shortlisted applications...');
    try {
      const response = await api.post('/applications/send-shortlisted', { jobId: id });
      
      // Update the local applications state with the sent status
      setApplications(prevApplications => 
        prevApplications.map(app => {
          const updatedApp = response.data.updatedApplications.find(
            updated => updated.id === app._id
          );
          if (updatedApp) {
            return { 
              ...app, 
              sentAt: updatedApp.sentAt,
              job: { ...app.job }
            };
          }
          return app;
        })
      );

      toast.success(`Successfully sent ${response.data.sentCount} shortlisted applications`, { id: toastId });
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to send shortlisted applications';
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleDeleteApplication = async () => {
    const toastId = toast.loading('Deleting application...');
    try {
      await api.delete(`/applications/${selectedApp._id}`);
      toast.success('Application deleted successfully', { id: toastId });
      setShowDeleteModal(false);
      setSelectedApp(null);
      await fetchApplications();
    } catch (error) {
      toast.error('Failed to delete application', { id: toastId });
    }
  };

  const handleDeleteSelectedApplications = async () => {
    const toastId = toast.loading('Deleting selected applications...');
    try {
      await api.post('/applications/delete-multiple', { applicationIds: selectedApplications });
      toast.success('Selected applications deleted successfully', { id: toastId });
      setSelectedApplications([]);
      await fetchApplications();
    } catch (error) {
      toast.error('Failed to delete selected applications', { id: toastId });
    }
  };

  const handleSelectApplication = (applicationId, isSelected) => {
    if (applicationId === 'all') {
      if (isSelected) {
        setSelectedApplications(applications.map(app => app._id));
      } else {
        setSelectedApplications([]);
      }
    } else {
      setSelectedApplications(prevSelected =>
        isSelected ? [...prevSelected, applicationId] : prevSelected.filter(id => id !== applicationId)
      );
    }
  };

  // Update the helper function
  const hasUnsentShortlistedApplications = () => {
    const unsentCount = applications.filter(app => app.isShortlisted && !app.sentAt).length;
    return unsentCount > 0;
  };

  const canSendApplications = () => {
    return hasUnsentShortlistedApplications();  // Remove the hiringManagerEmail check
  };

  const filteredApplications = applications.filter(app => {
    const matchesDate = dateFilter ? new Date(app.createdAt) <= new Date(dateFilter) : true;
    const matchesAiScore = aiScoreFilter ? app.aiScore <= aiScoreFilter : true;
    return matchesDate && matchesAiScore;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Error Loading Data</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <Button variant="primary" onClick={fetchJobDetails} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Created on {new Date(job.createdAt).toLocaleDateString()}
        </p>
        <div className="mt-4 prose max-w-none">{job.description}</div>
      </div>

        <h1 className="text-2xl font-bold">Job Review</h1>


      <div className="mb-6 flex justify-between items-center">
        <Button
          onClick={handleFetchEmails}
          disabled={processing}
          isLoading={processing}
        >
          Process New Applications
        </Button>
        {emailCount > 0 && (
          <p className="text-sm text-gray-500">
            {emailCount} new applications processed
          </p>
        )}

        <div className="flex space-x-4">
          <Button
            onClick={handleSendShortlisted}
            variant="success"
            disabled={!canSendApplications()}
            title={!hasUnsentShortlistedApplications()
              ? "No unsent shortlisted applications"
              : "Send shortlisted applications"}
          >
            Send Shortlisted Applications
            {hasUnsentShortlistedApplications() && (
              <span className="ml-1">
                ({applications.filter(app => app.isShortlisted && !app.sentAt).length})
              </span>
            )}
          </Button>

          <Button
            onClick={handleDeleteSelectedApplications}
            variant="danger"
            disabled={selectedApplications.length === 0}
          >
            Delete Selected Applications
          </Button>
        </div>
      </div>

      <div className="mb-6 flex space-x-4">
        <div>
          <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700">
            Filter by Date
          </label>
          <input
            type="date"
            id="dateFilter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <div>
          <label htmlFor="aiScoreFilter" className="block text-sm font-medium text-gray-700">
            Filter by AI Score
          </label>
          <AiScoreInput
            value={aiScoreFilter}
            onChange={setAiScoreFilter}
            min={0}
            max={10}
          />
        </div>
      </div>

      <div className="mt-8">
        <ApplicationsTable 
          applications={filteredApplications}
          onViewDetails={setSelectedApp}
          onToggleShortlist={handleToggleShortlist}
          onSelectApplication={handleSelectApplication}
        />
      </div>

      {selectedApp && (
        <ApplicationModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onDelete={() => setShowDeleteModal(true)}
          onToggleShortlist={handleToggleShortlist}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={handleDeleteApplication}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}