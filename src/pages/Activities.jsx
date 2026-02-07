import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { exportService } from '../services/export.service';

export default function Activities() {
  const { userData, isAdmin } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedActivities, setParsedActivities] = useState([]);
  const [error, setError] = useState('');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDirection, setFilterDirection] = useState('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSizeMin, setFilterSizeMin] = useState('');
  const [filterSizeMax, setFilterSizeMax] = useState('');
  const [filterClient, setFilterClient] = useState('');

  // Load activities from Firestore
  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      const q = query(activitiesRef, orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const activitiesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()
          }));
          setActivities(activitiesData);
          setLoading(false);
        },
        (error) => {
          console.error('Error loading activities:', error);
          setError('Failed to load activities');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Setup error:', err);
      setError('Failed to setup activities listener');
      setLoading(false);
    }
  }, [userData?.organizationId]);

  // Filter activities based on all criteria
  const filteredActivities = activities.filter(activity => {
    // Global search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        activity.clientName?.toLowerCase().includes(search) ||
        activity.bondName?.toLowerCase().includes(search) ||
        activity.ticker?.toLowerCase().includes(search) ||
        activity.isin?.toLowerCase().includes(search) ||
        activity.notes?.toLowerCase().includes(search) ||
        activity.addedByName?.toLowerCase().includes(search);
      
      if (!matchesSearch) return false;
    }

    // Direction filter
    if (filterDirection !== 'ALL' && activity.direction !== filterDirection) {
      return false;
    }

    // Client filter
    if (filterClient && !activity.clientName?.toLowerCase().includes(filterClient.toLowerCase())) {
      return false;
    }

    // Date range filter
    if (filterDateFrom && activity.createdAt) {
      const activityDate = new Date(activity.createdAt).setHours(0, 0, 0, 0);
      const fromDate = new Date(filterDateFrom).setHours(0, 0, 0, 0);
      if (activityDate < fromDate) return false;
    }

    if (filterDateTo && activity.createdAt) {
      const activityDate = new Date(activity.createdAt).setHours(0, 0, 0, 0);
      const toDate = new Date(filterDateTo).setHours(0, 0, 0, 0);
      if (activityDate > toDate) return false;
    }

    // Size range filter
    const size = parseFloat(activity.size) || 0;
    if (filterSizeMin && size < parseFloat(filterSizeMin)) {
      return false;
    }
    if (filterSizeMax && size > parseFloat(filterSizeMax)) {
      return false;
    }

    return true;
  });

  // Clear all filters function
  function clearFilters() {
    setSearchTerm('');
    setFilterDirection('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterSizeMin('');
    setFilterSizeMax('');
    setFilterClient('');
  }

  // Analyze transcript with AI
  async function analyzeTranscript() {
    if (!transcript.trim()) {
      alert('Please enter a transcript');
      return;
    }

    setAnalyzing(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/analyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.activities && data.activities.length > 0) {
        setParsedActivities(data.activities);
      } else {
        alert('No activities found in transcript');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Failed to analyze transcript: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  }

  // Save parsed activities to Firestore
  async function saveActivities() {
    if (parsedActivities.length === 0) return;

    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      
      for (const activity of parsedActivities) {
        await addDoc(activitiesRef, {
          ...activity,
          transcript: transcript,
          addedBy: userData.email,
          addedByName: userData.name,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      setTranscript('');
      setParsedActivities([]);
      setShowUpload(false);
      alert(`Successfully saved ${parsedActivities.length} activities!`);
    } catch (error) {
      console.error('Save error:', error);
      setError('Failed to save activities: ' + error.message);
    }
  }

  // Delete activity (admin only)
  async function deleteActivity(activityId) {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this activity?')) return;

    try {
      await deleteDoc(doc(db, `organizations/${userData.organizationId}/activities/${activityId}`));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete activity');
    }
  }

  // Get color for direction badge
  const getDirectionColor = (direction) => {
    switch (direction) {
      case 'BUY': return 'bg-green-100 text-green-800';
      case 'SELL': return 'bg-red-100 text-red-800';
      case 'TWO-WAY': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold">Loading activities...</div>
          <div className="text-gray-600 mt-2">Please wait</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow mb-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Activities</h1>
          <Link to="/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Activity Log</h2>
            <p className="text-gray-600 mt-1">{activities.length} activities total</p>
          </div>
          <div className="flex gap-3">
            {activities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition border border-gray-300 font-semibold"
                >
                  📥 Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={() => {
                        exportService.exportActivitiesToExcel(filteredActivities, userData?.organizationName || 'BondTracker');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-t-lg"
                    >
                      📊 Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => {
                        exportService.exportActivitiesToPDF(filteredActivities, userData?.organizationName || 'BondTracker');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-b-lg"
                    >
                      📄 PDF
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Add Activity
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">🔍 Search & Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Global Search */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Activities
              </label>
              <input
                type="text"
                placeholder="Search by client, bond, ISIN, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Direction Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Direction
              </label>
              <select
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">All Directions</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="TWO-WAY">TWO-WAY</option>
              </select>
            </div>

            {/* Client Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
              </label>
              <input
                type="text"
                placeholder="Filter by client..."
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Range Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Range End */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Size Range Min */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Size (MM)
              </label>
              <input
                type="number"
                placeholder="0"
                value={filterSizeMin}
                onChange={(e) => setFilterSizeMin(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Size Range Max */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Size (MM)
              </label>
              <input
                type="number"
                placeholder="1000"
                value={filterSizeMax}
                onChange={(e) => setFilterSizeMax(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition border border-gray-300 font-semibold"
              >
                🗑️ Clear All Filters
              </button>
            </div>
          </div>

          {/* Filter Summary */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              Showing <span className="font-bold text-blue-600">{filteredActivities.length}</span> of <span className="font-bold text-gray-900">{activities.length}</span> activities
              {filteredActivities.length !== activities.length && (
                <span className="ml-2 text-orange-600 font-medium">
                  (filtered)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Upload Transcript</h2>
              
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your chat transcript here...

Example:
Bosera: Bosera bid 10mm DKS 52
Paul: @ 100
Bosera: Done"
                className="w-full h-48 border border-gray-300 rounded-lg p-4 mb-4 font-mono text-sm"
              />

              <div className="flex gap-2 mb-4">
                <button
                  onClick={analyzeTranscript}
                  disabled={analyzing || !transcript.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {analyzing ? 'Analyzing with AI...' : 'Analyze with AI'}
                </button>
                <button
                  onClick={() => {
                    setShowUpload(false);
                    setTranscript('');
                    setParsedActivities([]);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>

              {/* Parsed Activities Preview */}
              {parsedActivities.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold mb-4 text-lg">
                    Detected Activities ({parsedActivities.length})
                  </h3>
                  <div className="space-y-3 mb-4">
                    {parsedActivities.map((activity, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-lg">{activity.clientName}</span>
                          <span className={`px-2 py-1 rounded text-sm font-medium ${getDirectionColor(activity.direction)}`}>
                            {activity.direction}
                          </span>
                          {activity.confidence && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                              {activity.confidence} confidence
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p><strong>Bond:</strong> {activity.bondName || activity.ticker || 'N/A'}</p>
                          <p><strong>Size:</strong> {activity.size} MM {activity.currency || 'USD'}</p>
                          {activity.price && <p><strong>Price:</strong> {activity.price}</p>}
                          {activity.isin && <p><strong>ISIN:</strong> {activity.isin}</p>}
                          {activity.notes && (
                            <p className="text-gray-600 mt-2 italic">{activity.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={saveActivities}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    💾 Save All {parsedActivities.length} Activities
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activities List */}
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-600 mb-4 text-lg">
              {activities.length === 0 ? 'No activities yet' : 'No activities match your filters'}
            </p>
            {activities.length === 0 ? (
              <button
                onClick={() => setShowUpload(true)}
                className="text-blue-600 hover:underline font-semibold"
              >
                Add your first activity →
              </button>
            ) : (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:underline font-semibold"
              >
                Clear filters to see all activities →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold">{activity.clientName}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDirectionColor(activity.direction)}`}>
                        {activity.direction}
                      </span>
                      {activity.confidence && (
                        <span className="text-xs text-gray-500">
                          {activity.confidence} confidence
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Bond:</span>
                        <p className="font-medium">{activity.bondName || activity.ticker || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Size:</span>
                        <p className="font-medium">{activity.size} MM</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Currency:</span>
                        <p className="font-medium">{activity.currency || 'USD'}</p>
                      </div>
                      {activity.price && (
                        <div>
                          <span className="text-gray-600">Price:</span>
                          <p className="font-medium">{activity.price}</p>
                        </div>
                      )}
                    </div>

                    {activity.notes && (
                      <p className="mt-3 text-gray-700 bg-gray-50 p-3 rounded text-sm">
                        {activity.notes}
                      </p>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                      Added by {activity.addedByName || activity.addedBy} • 
                      {activity.createdAt && new Date(activity.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => deleteActivity(activity.id)}
                      className="ml-4 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete activity"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
