import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { pipelineService } from '../services/pipeline.service';
import { exportService } from '../services/export.service';

const STATUSES = [
  { key: 'ANNOUNCED', label: 'Announced', color: 'blue', description: 'New issues announced' },
  { key: 'MARKETED', label: 'Marketed', color: 'yellow', description: 'Currently being marketed' },
  { key: 'PRICED', label: 'Priced', color: 'purple', description: 'Pricing completed' },
  { key: 'CLOSED', label: 'Closed', color: 'green', description: 'Deal closed' }
];

export default function Pipeline() {
  const { userData, isAdmin } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedIssue, setDraggedIssue] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    issuer: '',
    bondType: 'Corporate',
    expectedSize: '',
    currency: 'USD',
    maturity: '',
    coupon: '',
    status: 'ANNOUNCED',
    bookrunners: '',
    pricingDate: '',
    notes: '',
    priority: 'MEDIUM',
    assignedTo: ''
  });

  // Load pipeline issues
  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    const unsubscribe = pipelineService.subscribe(userData.organizationId, (data) => {
      setIssues(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData?.organizationId]);

  // Filter and search issues
  const filteredIssues = issues.filter(issue => {
    const matchesStatus = filterStatus === 'ALL' || issue.status === filterStatus;
    const matchesSearch = !searchTerm || 
      issue.issuer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.bondType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.bookrunners?.some(b => b.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Group issues by status for Kanban view
  const issuesByStatus = STATUSES.reduce((acc, status) => {
    acc[status.key] = filteredIssues.filter(issue => issue.status === status.key);
    return acc;
  }, {});

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const issueData = {
        ...formData,
        expectedSize: parseFloat(formData.expectedSize) || 0,
        coupon: parseFloat(formData.coupon) || null,
        bookrunners: formData.bookrunners.split(',').map(b => b.trim()).filter(b => b),
        addedBy: userData.email,
        addedByName: userData.name
      };

      if (editingIssue) {
        await pipelineService.update(userData.organizationId, editingIssue.id, issueData);
      } else {
        await pipelineService.add(userData.organizationId, issueData);
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving issue:', error);
      alert('Failed to save issue');
    }
  };

  // Handle status change (for Kanban drag or quick update)
  const handleStatusChange = async (issueId, newStatus) => {
    try {
      await pipelineService.update(userData.organizationId, issueId, { status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, issue) => {
    setDraggedIssue(issue);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedIssue && draggedIssue.status !== newStatus) {
      handleStatusChange(draggedIssue.id, newStatus);
    }
    setDraggedIssue(null);
  };

  // Open edit modal
  const handleEdit = (issue) => {
    setEditingIssue(issue);
    setFormData({
      issuer: issue.issuer || '',
      bondType: issue.bondType || 'Corporate',
      expectedSize: issue.expectedSize || '',
      currency: issue.currency || 'USD',
      maturity: issue.maturity || '',
      coupon: issue.coupon || '',
      status: issue.status || 'ANNOUNCED',
      bookrunners: issue.bookrunners?.join(', ') || '',
      pricingDate: issue.pricingDate || '',
      notes: issue.notes || '',
      priority: issue.priority || 'MEDIUM',
      assignedTo: issue.assignedTo || ''
    });
    setShowModal(true);
  };

  // Delete issue
  const handleDelete = async (issueId) => {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    
    try {
      await pipelineService.delete(userData.organizationId, issueId);
    } catch (error) {
      console.error('Error deleting issue:', error);
      alert('Failed to delete issue');
    }
  };

  // Reset form
  const resetForm = () => {
    setEditingIssue(null);
    setFormData({
      issuer: '',
      bondType: 'Corporate',
      expectedSize: '',
      currency: 'USD',
      maturity: '',
      coupon: '',
      status: 'ANNOUNCED',
      bookrunners: '',
      pricingDate: '',
      notes: '',
      priority: 'MEDIUM',
      assignedTo: ''
    });
  };

  // Get status color classes
  const getStatusColor = (status) => {
    switch (status) {
      case 'ANNOUNCED': return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', header: 'bg-blue-500' };
      case 'MARKETED': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', header: 'bg-yellow-500' };
      case 'PRICED': return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', header: 'bg-purple-500' };
      case 'CLOSED': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', header: 'bg-green-500' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', header: 'bg-gray-500' };
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Calculate totals by status
  const getStatusTotals = (status) => {
    const statusIssues = issues.filter(i => i.status === status);
    const volume = statusIssues.reduce((sum, i) => sum + (parseFloat(i.expectedSize) || 0), 0);
    return { count: statusIssues.length, volume: volume.toFixed(2) };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700">Loading pipeline...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-full mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-orange-600">🚀 Pipeline</h1>
            <span className="text-gray-400">|</span>
            <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 transition">
              ← Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'kanban' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📋 List
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-full mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Pipeline Management</h2>
            <p className="text-gray-600 mt-1">
              {issues.length} total issues • ${issues.reduce((sum, i) => sum + (parseFloat(i.expectedSize) || 0), 0).toFixed(2)}MM total volume
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <input
              type="text"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            
            {/* Filter (for list view) */}
            {viewMode === 'list' && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">All Statuses</option>
                {STATUSES.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            )}
            
            {/* Export */}
            {issues.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition border border-gray-300 font-semibold"
                >
                  📥 Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <button
                      onClick={() => {
                        exportService.exportPipelineToExcel(filteredIssues, userData?.organizationName || 'BondTracker');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-t-lg"
                    >
                      📊 Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => {
                        exportService.exportPipelineToPDF(filteredIssues, userData?.organizationName || 'BondTracker');
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
            
            {/* Add Issue */}
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              + Add Issue
            </button>
          </div>
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUSES.map((status) => {
              const colors = getStatusColor(status.key);
              const totals = getStatusTotals(status.key);
              
              return (
                <div
                  key={status.key}
                  className={`bg-gray-50 rounded-lg border-2 ${colors.border} min-h-96`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status.key)}
                >
                  {/* Column Header */}
                  <div className={`${colors.header} text-white p-4 rounded-t-lg`}>
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg">{status.label}</h3>
                      <span className="bg-white bg-opacity-30 px-2 py-1 rounded-full text-sm font-semibold">
                        {totals.count}
                      </span>
                    </div>
                    <p className="text-sm opacity-80 mt-1">${totals.volume}MM</p>
                  </div>
                  
                  {/* Cards */}
                  <div className="p-3 space-y-3">
                    {issuesByStatus[status.key]?.map((issue) => (
                      <div
                        key={issue.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, issue)}
                        className={`bg-white rounded-lg shadow-sm border ${colors.border} p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-900 text-sm">{issue.issuer}</h4>
                          {issue.priority && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(issue.priority)}`}>
                              {issue.priority}
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <p className="flex items-center gap-1">
                            <span className="font-medium">${issue.expectedSize}MM</span>
                            <span className="text-gray-400">•</span>
                            <span>{issue.currency}</span>
                          </p>
                          <p className="text-xs text-gray-500">{issue.bondType}</p>
                          {issue.pricingDate && (
                            <p className="text-xs text-gray-500">
                              📅 {new Date(issue.pricingDate).toLocaleDateString()}
                            </p>
                          )}
                          {issue.bookrunners?.length > 0 && (
                            <p className="text-xs text-gray-400 truncate">
                              🏦 {issue.bookrunners.slice(0, 2).join(', ')}
                              {issue.bookrunners.length > 2 && ` +${issue.bookrunners.length - 2}`}
                            </p>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="mt-3 pt-3 border-t flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(issue)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(issue.id)}
                              className="text-red-600 hover:text-red-800 text-xs font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {issuesByStatus[status.key]?.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">No issues</p>
                        <p className="text-xs">Drag here or add new</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-xl mb-2">📭 No issues found</p>
                <p>Add your first pipeline issue to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issuer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pricing Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookrunners</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredIssues.map((issue) => {
                      const colors = getStatusColor(issue.status);
                      return (
                        <tr key={issue.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{issue.issuer}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {issue.bondType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">${issue.expectedSize}MM</div>
                            <div className="text-xs text-gray-500">{issue.currency}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={issue.status}
                              onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                              className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} border-0 cursor-pointer`}
                            >
                              {STATUSES.map(s => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(issue.priority || 'MEDIUM')}`}>
                              {issue.priority || 'MEDIUM'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {issue.pricingDate ? new Date(issue.pricingDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {issue.bookrunners?.join(', ') || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(issue)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(issue.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">
                {editingIssue ? 'Edit Issue' : 'Add New Issue'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issuer *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.issuer}
                      onChange={(e) => setFormData({...formData, issuer: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Apple Inc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bond Type *
                    </label>
                    <select
                      value={formData.bondType}
                      onChange={(e) => setFormData({...formData, bondType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Corporate">Corporate</option>
                      <option value="Government">Government</option>
                      <option value="Municipal">Municipal</option>
                      <option value="Agency">Agency</option>
                      <option value="Sovereign">Sovereign</option>
                      <option value="High Yield">High Yield</option>
                      <option value="Investment Grade">Investment Grade</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {STATUSES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Size (MM) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.expectedSize}
                      onChange={(e) => setFormData({...formData, expectedSize: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency *
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                      <option value="CNY">CNY</option>
                      <option value="SGD">SGD</option>
                      <option value="HKD">HKD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maturity Date
                    </label>
                    <input
                      type="date"
                      value={formData.maturity}
                      onChange={(e) => setFormData({...formData, maturity: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coupon (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.coupon}
                      onChange={(e) => setFormData({...formData, coupon: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="4.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pricing Date
                    </label>
                    <input
                      type="date"
                      value={formData.pricingDate}
                      onChange={(e) => setFormData({...formData, pricingDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bookrunners (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.bookrunners}
                      onChange={(e) => setFormData({...formData, bookrunners: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Goldman Sachs, JP Morgan, Morgan Stanley"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Additional notes about this issue..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    {editingIssue ? 'Update Issue' : 'Add Issue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
