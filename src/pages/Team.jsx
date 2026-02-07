import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { teamService } from '../services/team.service';

export default function Team() {
  const { userData, currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activityStats, setActivityStats] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  
  // Invite form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user'
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  // Load team data
  useEffect(() => {
    if (!userData?.organizationId || !isAdmin) {
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    // Subscribe to team members
    const membersUnsub = teamService.subscribe(userData.organizationId, (data) => {
      setMembers(data);
      setLoading(false);
    });
    unsubscribes.push(membersUnsub);

    // Subscribe to invitations
    const invitationsUnsub = teamService.subscribeToInvitations(userData.organizationId, (data) => {
      setInvitations(data);
    });
    unsubscribes.push(invitationsUnsub);

    // Load activity stats
    teamService.getActivityLog(userData.organizationId).then(setActivityStats).catch(console.error);

    return () => unsubscribes.forEach(unsub => unsub());
  }, [userData?.organizationId, isAdmin]);

  // Handle invite
  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError('');

    try {
      await teamService.createInvitation(
        userData.organizationId,
        userData.organizationName,
        inviteForm.email,
        inviteForm.role,
        userData.email
      );
      
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'user' });
      alert('Invitation sent successfully! An email has been sent to the invitee.');
    } catch (error) {
      setInviteError(error.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle role change
  const handleRoleChange = async (memberId, newIsAdmin) => {
    if (memberId === currentUser?.uid) {
      alert("You cannot change your own role");
      return;
    }

    try {
      await teamService.updateRole(memberId, newIsAdmin);
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  // Handle remove member
  const handleRemoveMember = async (member) => {
    if (member.id === currentUser?.uid) {
      alert("You cannot remove yourself");
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.name} from the organization?`)) {
      return;
    }

    try {
      await teamService.removeUser(member.id);
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  // Handle cancel invitation
  const handleCancelInvitation = async (invitationId) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await teamService.cancelInvitation(userData.organizationId, invitationId);
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      alert('Failed to cancel invitation');
    }
  };

  // Handle resend invitation - pass full invitation data for email
  const handleResendInvitation = async (invitation) => {
    try {
      await teamService.resendInvitation(userData.organizationId, invitation.id, {
        email: invitation.email,
        organizationName: invitation.organizationName,
        invitedBy: invitation.invitedBy,
        role: invitation.role
      });
      alert('Invitation resent successfully!');
    } catch (error) {
      console.error('Error resending invitation:', error);
      alert('Failed to resend invitation');
    }
  };

  // Get role badge
  const getRoleBadge = (isAdminUser) => {
    return isAdminUser ? (
      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-semibold">
        Admin
      </span>
    ) : (
      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-semibold">
        User
      </span>
    );
  };

  // Get initials
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get random color for avatar
  const getAvatarColor = (name) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700">Loading team...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Only admins can access team management</p>
          <Link to="/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-purple-600">👥 Team</h1>
            <span className="text-gray-400">|</span>
            <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 transition">
              ← Dashboard
            </Link>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">{userData?.organizationName}</div>
            <div className="text-xs text-gray-500">{members.length} members</div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Team Management</h2>
            <p className="text-gray-600 mt-1">
              Manage your organization's team members and invitations
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center gap-2"
          >
            <span>➕</span> Invite Member
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-2xl font-bold">{members.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <span className="text-2xl">👑</span>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Admins</p>
                <p className="text-2xl font-bold">{members.filter(m => m.isAdmin).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <span className="text-2xl">👤</span>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Users</p>
                <p className="text-2xl font-bold">{members.filter(m => !m.isAdmin).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100">
                <span className="text-2xl">✉️</span>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Pending Invites</p>
                <p className="text-2xl font-bold">{invitations.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('members')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'members'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                👥 Members ({members.length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'invitations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                ✉️ Invitations ({invitations.length})
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'activity'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 Activity
              </button>
            </div>
          </div>

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="p-6">
              {members.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-4">👥</div>
                  <p>No team members yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full ${getAvatarColor(member.name)} flex items-center justify-center text-white font-bold`}>
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{member.name}</span>
                            {getRoleBadge(member.isAdmin)}
                            {member.id === currentUser?.uid && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          {member.createdAt && (
                            <p className="text-xs text-gray-400">
                              Joined {new Date(member.createdAt.toDate?.() || member.createdAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {member.id !== currentUser?.uid && (
                        <div className="flex items-center gap-3">
                          <select
                            value={member.isAdmin ? 'admin' : 'user'}
                            onChange={(e) => handleRoleChange(member.id, e.target.value === 'admin')}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invitations Tab */}
          {activeTab === 'invitations' && (
            <div className="p-6">
              {invitations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-4">✉️</div>
                  <p>No pending invitations</p>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="mt-4 text-blue-600 hover:underline"
                  >
                    Invite someone →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{invitation.email}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            invitation.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {invitation.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                          {invitation.emailSent && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                              ✓ Email Sent
                            </span>
                          )}
                          {invitation.emailSent === false && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              ✗ Email Failed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Invited by {invitation.invitedBy} • 
                          {invitation.createdAt && (
                            <span> {new Date(invitation.createdAt.toDate?.() || invitation.createdAt).toLocaleDateString()}</span>
                          )}
                        </p>
                        {invitation.expiresAt && (
                          <p className="text-xs text-orange-600">
                            Expires {new Date(invitation.expiresAt.toDate?.() || invitation.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResendInvitation(invitation)}
                          className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition"
                        >
                          Resend
                        </button>
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="p-6">
              {activityStats.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-4">📊</div>
                  <p>No activity data yet</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Activity (by activities logged)</h3>
                  <div className="space-y-3">
                    {activityStats.map((stat, index) => (
                      <div key={stat.email} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold text-gray-400 w-8">#{index + 1}</span>
                          <div className={`w-10 h-10 rounded-full ${getAvatarColor(stat.name)} flex items-center justify-center text-white font-bold text-sm`}>
                            {getInitials(stat.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{stat.name}</p>
                            <p className="text-xs text-gray-500">{stat.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{stat.count}</p>
                          <p className="text-xs text-gray-500">activities</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Invite Team Member</h2>
            
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="colleague@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="user">User - Can view and add data</option>
                  <option value="admin">Admin - Full access including team management</option>
                </select>
              </div>

              {inviteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {inviteError}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <p className="font-semibold mb-1">📧 How invitations work:</p>
                <p>An email will be sent to the invitee with a link to sign up. They must use this exact email address to join your organization.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteForm({ email: '', role: 'user' });
                    setInviteError('');
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
  );
}
