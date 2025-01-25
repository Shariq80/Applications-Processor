import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import ApplicationModal from '../components/Applications/ApplicationModal';
import DeleteConfirmModal from '../components/Applications/DeleteConfirmModal';
import ApplicationsTable from '../components/Applications/ApplicationsTable';
import Button from '../components/Common/Button';
import AiScoreInput from '../components/Common/AiScoreInput';

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

  const fetchJobAndApplications = useCallback(async () => {
    try {
      setError(null);
      const [jobRes, appsRes] = await Promise.all([
        api.get(`/jobs/${id}`),
        api.get(`/applications?jobId=${id}`)
      ]);
      setJob(jobRes.data);
      setApplications(appsRes.data);
    } catch (error) {
      setError('Failed to load job and applications');
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJobAndApplications();
  }, [fetchJobAndApplications]);

  const handleFetchEmails = async () => {
    if (!job?.title) return;
    
    setProcessing(true);
    const toastId = toast.loading('Processing new applications...');
    
    try {
      const response = await api.get(`/applications/fetch-emails?jobTitle=${encodeURIComponent(job.title)}`);
      if (response.data.applications) {
        await fetchJobAndApplications();
        toast.success('Successfully processed new applications', { id: toastId });
      }
    } catch (error) {
      toast.error('Failed to process new applications', { id: toastId });
    } finally {
      setProcessing(false);
    }
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
      await fetchJobAndApplications();
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
      await fetchJobAndApplications();
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
          <Button variant="primary" onClick={fetchJobAndApplications} className="mt-4">
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

      <div className="mb-6 flex justify-between items-center">
        <Button
          onClick={handleFetchEmails}
          disabled={processing}
          isLoading={processing}
        >
          Process New Applications
        </Button>

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