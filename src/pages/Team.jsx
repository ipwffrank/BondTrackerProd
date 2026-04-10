import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { teamService } from '../services/team.service';
import { getAuditLogs } from '../services/audit.service';
import { dataAccessService } from '../services/data-access.service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const ACTION_LABELS = {
  export_activities_excel: 'Export Activities (Excel)',
  export_activities_pdf: 'Export Activities (PDF)',
  export_clients_excel: 'Export Clients (Excel)',
  export_clients_pdf: 'Export Clients (PDF)',
  export_pipeline_issues_excel: 'Export Pipeline Issues (Excel)',
  export_pipeline_issues_pdf: 'Export Pipeline Issues (PDF)',
  export_orderbook_excel: 'Export Order Book (Excel)',
  export_orderbook_pdf: 'Export Order Book (PDF)',
  export_analytics_excel: 'Export Analytics (Excel)',
  export_analytics_pdf: 'Export Analytics (PDF)',
  export_analytics_csv: 'Export Analytics (CSV)',
};

function AuditTrailTab({ orgId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    getAuditLogs(orgId, 50).then(({ logs: data, lastDoc: ld }) => {
      setLogs(data);
      setLastDoc(ld);
      setHasMore(data.length === 50);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orgId]);

  const loadMore = async () => {
    if (!lastDoc || !hasMore) return;
    const { logs: more, lastDoc: ld } = await getAuditLogs(orgId, 50, lastDoc);
    setLogs(prev => [...prev, ...more]);
    setLastDoc(ld);
    setHasMore(more.length === 50);
  };

  const fmtDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleString();
  };

  return (
    <div className="card">
      <div className="card-header">
        <span>Audit Trail</span>
      </div>
      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No audit logs yet</p>
            <p style={{ fontSize: '14px' }}>Export actions will be recorded here automatically.</p>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(log.timestamp)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                      <div style={{ fontWeight: 500 }}>{log.userName || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.userEmail || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{ACTION_LABELS[log.action] || log.action}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button onClick={loadMore} className="btn btn-secondary" style={{ fontSize: '13px' }}>Load More</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MyDataTab({ userData, currentUser }) {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  async function handleExport() {
    if (!currentUser?.uid || !userData?.organizationId) return;
    setExporting(true);
    try {
      const data = await dataAccessService.exportUserData(
        currentUser.uid,
        userData.organizationId,
        userData
      );
      dataAccessService.downloadAsJson(data, userData.name);
      setExported(true);
    } catch (err) {
      alert('Failed to export data: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span>My Data</span>
      </div>
      <div style={{ padding: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
          Download all of your personal data stored in Axle, including your profile, activities you created, audit logs, transcript uploads, AI corrections, and consent records. The data will be exported as a structured JSON file.
        </p>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn btn-primary"
          style={{ padding: '10px 24px', fontSize: '14px' }}
        >
          {exporting ? 'Preparing download...' : exported ? 'Download Again' : 'Download My Data'}
        </button>

        {exported && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
            Your data export has been downloaded. This action has been logged in the audit trail.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Team() {
  const { userData, currentUser, isAdmin, orgPlan } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activityStats, setActivityStats] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('members');
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [ssoStatus, setSsoStatus] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [seatLimitInfo, setSeatLimitInfo] = useState(null); // { maxUsers, currentCount }

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user'
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/activities');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!userData?.organizationId || !isAdmin) {
      setLoading(false);
      return;
    }

    const unsubscribes = [];

    const membersUnsub = teamService.subscribe(userData.organizationId, (data) => {
      setMembers(data);
      setLoading(false);
    });
    unsubscribes.push(membersUnsub);

    const invitationsUnsub = teamService.subscribeToInvitations(userData.organizationId, (data) => {
      setInvitations(data);
    });
    unsubscribes.push(invitationsUnsub);

    // Activity stats loaded separately after members are available

    return () => unsubscribes.forEach(unsub => unsub());
  }, [userData?.organizationId, isAdmin]);

  // Load activity stats after members are available (to enrich with email)
  useEffect(() => {
    if (!userData?.organizationId || !isAdmin) return;
    teamService.getActivityLog(userData.organizationId, members).then(setActivityStats).catch(console.error);
  }, [userData?.organizationId, isAdmin, members]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Load SSO status for this org
  useEffect(() => {
    if (!userData?.organizationId) return;
    getDoc(doc(db, `organizations/${userData.organizationId}`)).then(snap => {
      if (snap.exists() && snap.data().ssoEnabled) {
        setSsoStatus({ enabled: true, provider: snap.data().samlProviderId || 'SAML' });
      }
    }).catch(() => {});
  }, [userData?.organizationId]);

  async function handleInvite(e) {
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
      setToast('Invitation sent successfully! An email has been sent to the invitee.');
    } catch (error) {
      setInviteError(error.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    if (memberId === currentUser?.uid) {
      setToast("You cannot change your own role");
      return;
    }

    const newIsAdmin = newRole === 'admin';

    try {
      await teamService.updateRole(memberId, newIsAdmin, userData.organizationId);
      setToast(`User role updated to ${newRole === 'admin' ? 'Admin' : 'User'} successfully!`);
    } catch (error) {
      console.error('Error updating role:', error);
      setToast('Failed to update role');
    }
  }

  async function handleRemoveMember(member) {
    if (member.id === currentUser?.uid) {
      setToast("You cannot remove yourself");
      return;
    }

    setConfirmModal({
      message: `Are you sure you want to remove ${member.name} from the organization? This will permanently delete all of their data, including activities and transcripts they uploaded.`,
      onConfirm: async () => {
        try {
          await teamService.removeUser(member.id, userData?.organizationId);
        } catch (error) {
          setToast('Failed to remove member');
        }
      }
    });
  }

  async function handleCancelInvitation(invitationId) {
    setConfirmModal({
      message: 'Are you sure you want to cancel this invitation?',
      onConfirm: async () => {
        try {
          await teamService.cancelInvitation(userData.organizationId, invitationId);
        } catch (error) {
          console.error('Error cancelling invitation:', error);
          setToast('Failed to cancel invitation');
        }
      }
    });
  }

  async function handleResendInvitation(invitation) {
    try {
      await teamService.resendInvitation(userData.organizationId, invitation.id, {
        email: invitation.email,
        organizationName: invitation.organizationName,
        invitedBy: invitation.invitedBy,
        role: invitation.role
      });
      setToast('Invitation resent successfully!');
    } catch (error) {
      console.error('Error resending invitation:', error);
      setToast('Failed to resend invitation');
    }
  }

  async function openInviteModal() {
    try {
      const result = await teamService.checkSeatLimit(userData.organizationId);
      if (!result.allowed) {
        setSeatLimitInfo({ maxUsers: result.maxUsers, currentCount: result.currentCount });
        setShowLimitModal(true);
        return;
      }
      setShowInviteModal(true);
    } catch (error) {
      console.error('Error checking seat limit:', error);
      // On error, allow the invite attempt — createInvitation will handle failures
      setShowInviteModal(true);
    }
  }

  const getRoleBadge = (isAdminUser) => {
    return isAdminUser ? (
      <span className="badge badge-primary">Admin</span>
    ) : (
      <span className="badge badge-primary" style={{opacity: 0.6}}>User</span>
    );
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getDisplayName = (member) => {
    if (!member.name || member.name === member.email) return null;
    return member.name;
  };

  const fmtVol = (v) => {
    if (!v || v === 0) return '0';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (v >= 1) return v.toFixed(1).replace(/\.0$/, '') + 'MM';
    return v.toFixed(2) + 'MM';
  };

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
      <div className="app-container">
        <Navigation />
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
          <div style={{textAlign: 'center'}}>
            <div className="spinner" style={{width: '40px', height: '40px', margin: '0 auto 16px'}}></div>
            <div style={{color: 'var(--text-primary)'}}>Loading team...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="app-container">
        <Navigation />
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh'}}>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '64px', marginBottom: '16px'}}>🔒</div>
            <h2 style={{fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px'}}>Access Denied</h2>
            <p style={{color: 'var(--text-secondary)'}}>Only admins can access team management</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navigation />
      
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Admin</h1>
            <p className="page-description">Invite members, assign roles, and manage your team</p>
          </div>
          {/* PROMINENT INVITE BUTTON IN HEADER */}
          <button
            onClick={openInviteModal}
            className="btn-invite-hero"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '8px'}}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Invite New Member
          </button>
        </div>

        {/* SSO Status Banner */}
        {ssoStatus?.enabled && (
          <div style={{
            background: 'rgba(200,162,88,0.08)', border: '1px solid rgba(200,162,88,0.2)',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8A258" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ color: '#C8A258', fontWeight: 600 }}>SSO Enabled</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              — Team members sign in via your company identity provider ({ssoStatus.provider}). New SSO users are provisioned automatically.
            </span>
          </div>
        )}

        {/* Sub-tabs */}
        <div className="sub-tabs">
          <button 
            className={`sub-tab ${activeSubTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('members')}
          >
            👥 Members ({members.length})
          </button>
          <button 
            className={`sub-tab ${activeSubTab === 'invitations' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('invitations')}
          >
            ✉️ Pending Invitations ({invitations.length})
          </button>
          <button
            className={`sub-tab ${activeSubTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('activity')}
          >
            📊 Activity Stats
          </button>
          <button
            className={`sub-tab ${activeSubTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('audit')}
          >
            📋 Audit Trail
          </button>
          <button
            className={`sub-tab ${activeSubTab === 'mydata' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('mydata')}
          >
            📥 My Data
          </button>
        </div>

        {/* Members Tab */}
        {activeSubTab === 'members' && (
          <div className="card">
            <div className="card-header">
              <span>Team Members ({members.length})</span>
              <button onClick={openInviteModal} className="btn btn-primary">
                + Invite Member
              </button>
            </div>
            
            <div style={{padding: '24px'}}>
              {/* Info Box */}
              <div className="info-box" style={{marginBottom: '24px'}}>
                <h4 style={{fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent)'}}>
                  💡 Role Permissions
                </h4>
                <ul style={{fontSize: '13px', lineHeight: 1.6, paddingLeft: '20px', margin: 0, color: 'var(--text-primary)'}}>
                  <li><strong>Admin:</strong> Can invite members, assign roles, delete clients, and access team management</li>
                  <li><strong>User:</strong> Can view and add data (activities, clients, etc.) but cannot manage team or delete clients</li>
                  <li>You can change any member's role using the dropdown below (except your own)</li>
                </ul>
              </div>

              {members.length === 0 ? (
                <div style={{textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)'}}>
                  <div style={{fontSize: '64px', marginBottom: '16px'}}>👥</div>
                  <p style={{fontSize: '18px', marginBottom: '16px', fontWeight: 600}}>No team members yet</p>
                  <p style={{fontSize: '14px', marginBottom: '24px'}}>Start by inviting your first team member!</p>
                  <button
                    onClick={openInviteModal}
                    className="btn btn-primary"
                    style={{fontSize: '16px', padding: '12px 24px'}}
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '8px'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                    </svg>
                    Invite First Member
                  </button>
                </div>
              ) : (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px'}}>
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="member-card"
                      style={{flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 16px'}}
                    >
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
                        <div
                          className={getAvatarColor(member.name)}
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '17px',
                            background: '#C8A258'
                          }}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap'}}>
                            <span style={{fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)'}}>
                              {getDisplayName(member) || member.email}
                            </span>
                            {getRoleBadge(member.isAdmin)}
                            {member.id === currentUser?.uid && (
                              <span className="badge badge-success" style={{fontSize: '10px'}}>You</span>
                            )}
                          </div>
                          {getDisplayName(member) && (
                          <p style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px', wordBreak: 'break-all'}}>
                            {member.email}
                          </p>
                          )}
                          {member.lastLogin && (
                            <p style={{fontSize: '11px', color: 'var(--text-muted)'}}>
                              Last active: {new Date(member.lastLogin.toDate?.() || member.lastLogin).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {member.id !== currentUser?.uid && (
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', marginTop: 'auto'}}>
                          <select
                            value={member.isAdmin ? 'admin' : 'user'}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className="form-select"
                            style={{padding: '6px 10px', fontSize: '12px', width: '100px'}}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="btn btn-danger"
                            style={{padding: '6px 12px', fontSize: '12px'}}
                            title="Remove member"
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
          </div>
        )}

        {/* Invitations Tab */}
        {activeSubTab === 'invitations' && (
          <div className="card">
            <div className="card-header">
              <span>Pending Invitations ({invitations.length})</span>
              <button onClick={openInviteModal} className="btn btn-primary">
                + Send New Invitation
              </button>
            </div>
            
            <div style={{padding: '24px'}}>
              {invitations.length === 0 ? (
                <div style={{textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)'}}>
                  <div style={{fontSize: '64px', marginBottom: '16px'}}>✉️</div>
                  <p style={{fontSize: '18px', marginBottom: '8px', fontWeight: 600}}>No pending invitations</p>
                  <p style={{fontSize: '14px', marginBottom: '24px'}}>Invite team members to join your organization</p>
                  <button
                    onClick={openInviteModal}
                    className="btn btn-primary"
                    style={{fontSize: '16px', padding: '12px 24px'}}
                  >
                    Send Invitation
                  </button>
                </div>
              ) : (
                <div style={{display: 'grid', gap: '12px'}}>
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      style={{
                        padding: '16px',
                        background: 'var(--badge-warning-bg)',
                        border: '1px solid var(--badge-warning-text)',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                        <div style={{flex: 1}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                            <span style={{fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)'}}>
                              {invitation.email}
                            </span>
                            <span className="badge badge-primary" style={{opacity: invitation.role === 'admin' ? 1 : 0.6}}>
                              {invitation.role === 'admin' ? '👑 Admin' : '👤 User'}
                            </span>
                            {invitation.emailSent && (
                              <span className="badge badge-success" style={{fontSize: '10px'}}>
                                ✓ Email Sent
                              </span>
                            )}
                            {invitation.emailSent === false && (
                              <span className="badge badge-danger" style={{fontSize: '10px'}}>
                                ✗ Email Failed
                              </span>
                            )}
                          </div>
                          <p style={{fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px'}}>
                            Invited by {invitation.invitedBy}
                            {invitation.createdAt && (
                              <> • {new Date(invitation.createdAt.toDate?.() || invitation.createdAt).toLocaleDateString()}</>
                            )}
                          </p>
                          {invitation.expiresAt && (
                            <p style={{fontSize: '11px', color: 'var(--badge-warning-text)'}}>
                              Expires {new Date(invitation.expiresAt.toDate?.() || invitation.expiresAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div style={{display: 'flex', gap: '8px'}}>
                          <button
                            onClick={() => handleResendInvitation(invitation)}
                            className="btn btn-secondary"
                            style={{padding: '8px 16px', fontSize: '13px'}}
                          >
                            Resend Email
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="btn btn-danger"
                            style={{padding: '8px 16px', fontSize: '13px'}}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeSubTab === 'activity' && (
          <div className="card">
            <div className="card-header">
              <span>Team Activity Leaderboard</span>
            </div>
            
            <div style={{padding: '24px'}}>
              {activityStats.length === 0 ? (
                <div style={{textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)'}}>
                  <div style={{fontSize: '64px', marginBottom: '16px'}}>📊</div>
                  <p style={{fontSize: '18px'}}>No activity data yet</p>
                </div>
              ) : (
                <div style={{display: 'grid', gap: '12px'}}>
                  {activityStats.map((stat, index) => (
                    <div 
                      key={stat.email}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        background: 'var(--section-label-bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                        <span style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--text-muted)', width: '40px'}}>
                          #{index + 1}
                        </span>
                        <div 
                          className={getAvatarColor(stat.name)}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            background: '#C8A258'
                          }}
                        >
                          {getInitials(stat.name)}
                        </div>
                        <div>
                          <p style={{fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)'}}>
                            {getDisplayName(stat) || stat.email}
                          </p>
                          {getDisplayName(stat) && (
                          <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>
                            {stat.email}
                          </p>
                          )}
                        </div>
                      </div>
                      <div style={{textAlign: 'right'}}>
                        <p style={{fontSize: '28px', fontWeight: 'bold', color: 'var(--accent)'}}>
                          {fmtVol(stat.executedVolume)}
                        </p>
                        <p style={{fontSize: '11px', color: 'var(--text-muted)'}}>
                          executed volume · {stat.executedCount} trade{stat.executedCount !== 1 ? 's' : ''} · {stat.count} total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'audit' && (
          <AuditTrailTab orgId={userData?.organizationId} />
        )}

        {activeSubTab === 'mydata' && (
          <MyDataTab userData={userData} currentUser={currentUser} />
        )}
      </main>

      {/* Invite Modal - HIGHLY VISIBLE */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)'}}>
              ✉️ Invite New Team Member
            </h2>
            <p style={{fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px'}}>
              Send an invitation email to add someone to your organization
            </p>
            
            <form onSubmit={handleInvite}>
              <div className="field-group" style={{marginBottom: '20px'}}>
                <label className="form-label" style={{fontSize: '14px', marginBottom: '8px'}}>
                  Email Address <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="form-input"
                  placeholder="colleague@example.com"
                  style={{fontSize: '15px', padding: '12px 16px'}}
                />
                <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px'}}>
                  They must sign up with this exact email address
                </p>
              </div>

              <div className="field-group" style={{marginBottom: '20px'}}>
                <label className="form-label" style={{fontSize: '14px', marginBottom: '8px'}}>
                  Assign Role <span style={{color: '#ef4444'}}>*</span>
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="form-select"
                  style={{fontSize: '15px', padding: '12px 16px'}}
                >
                  <option value="user">👤 User - Can view and add data</option>
                  <option value="admin">👑 Admin - Full access + team management</option>
                </select>
              </div>

              {inviteError && (
                <div style={{
                  padding: '14px',
                  background: 'var(--badge-danger-bg)',
                  color: 'var(--badge-danger-text)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  marginBottom: '20px',
                  border: '1px solid var(--badge-danger-text)'
                }}>
                  ⚠️ {inviteError}
                </div>
              )}

              <div className="info-box" style={{marginBottom: '24px'}}>
                <p style={{fontWeight: 600, marginBottom: '8px', fontSize: '13px'}}>📧 How invitations work:</p>
                <ul style={{fontSize: '13px', lineHeight: 1.6, paddingLeft: '20px', margin: 0}}>
                  <li>An email will be sent to the invitee with a signup link</li>
                  <li>They must use the exact email address you entered</li>
                  <li>Once they sign up, they'll join your organization with the assigned role</li>
                  <li>You can change their role anytime in the Members tab</li>
                </ul>
              </div>

              <div style={{display: 'flex', gap: '12px'}}>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="btn btn-primary"
                  style={{flex: 1, fontSize: '15px', padding: '14px'}}
                >
                  {inviteLoading ? (
                    <>
                      <span className="spinner"></span>
                      Sending Invitation...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      Send Invitation Email
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteForm({ email: '', role: 'user' });
                    setInviteError('');
                  }}
                  className="btn btn-muted"
                  style={{flex: 1, fontSize: '15px', padding: '14px'}}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--card-bg)', border: '1px solid rgba(200,162,88,0.3)', borderRadius: '8px', padding: '12px 20px', color: 'var(--text-primary)', fontSize: '14px', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '90%' }}>
            <p style={{ color: 'var(--text-primary)', marginBottom: '24px', fontSize: '15px' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '8px 20px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showLimitModal && seatLimitInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', maxWidth: '460px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128274;</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              User Limit Reached
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              Maximum of <strong style={{ color: 'var(--accent)' }}>{seatLimitInfo.maxUsers}</strong> users reached.<br />
              Contact <a href="mailto:info@axle-finance.com" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>info@axle-finance.com</a> to add more.
            </p>
            <button
              onClick={() => { setShowLimitModal(false); setSeatLimitInfo(null); }}
              className="btn btn-primary"
              style={{ padding: '12px 40px', fontSize: '15px' }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .page-header {
          margin-bottom: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
        }

        .page-title {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .page-description {
          font-size: 16px;
          color: var(--text-secondary);
        }

        .btn-invite-hero {
          background: #C8A258;
          color: #0F2137;
          padding: 14px 28px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 16px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          box-shadow: 0 4px 12px rgba(200, 162, 88, 0.3);
          transition: all 0.2s ease;
        }

        .btn-invite-hero:hover {
          background: #D4B06A;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(200, 162, 88, 0.4);
        }

        .sub-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 2px solid var(--border);
        }

        .sub-tab {
          padding: 12px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -2px;
        }

        .sub-tab:hover {
          color: var(--accent);
        }

        .sub-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
        }

        .card-header {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .member-card {
          display: flex;
          align-items: center;
          justifyContent: space-between;
          padding: 18px;
          background: var(--section-label-bg);
          border: 1.5px solid var(--border);
          borderRadius: 12px;
          transition: all 0.2s;
        }

        .member-card:hover {
          border-color: var(--accent);
          box-shadow: 0 2px 8px var(--accent-glow);
        }

        .info-box {
          padding: 16px;
          background: var(--badge-primary-bg);
          border-radius: 8px;
          border: 1px solid var(--badge-primary-text);
          color: var(--text-primary);
        }

        .field-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 5px;
        }

        .form-input,
        .form-select {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: var(--border-focus);
          background: var(--bg-input-focus);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .btn {
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13.5px;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: inherit;
          white-space: nowrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent), var(--accent-hover));
          color: #fff;
          box-shadow: 0 2px 8px var(--accent-glow-strong);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--accent-glow-strong);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--btn-secondary-bg);
          color: #fff;
        }

        .btn-secondary:hover {
          background: var(--btn-secondary-hover);
        }

        .btn-danger {
          background: #dc2626;
          color: #fff;
        }

        .btn-danger:hover {
          background: #b91c1c;
        }

        .btn-muted {
          background: var(--btn-muted-bg);
          color: var(--btn-muted-text);
        }

        .btn-muted:hover {
          background: var(--btn-muted-hover);
        }

        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          transition: transform 0.2s;
        }

        .btn-icon:hover {
          transform: scale(1.2);
        }

        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          display: inline-block;
        }

        .badge-primary {
          background: var(--badge-primary-bg);
          color: var(--badge-primary-text);
        }

        .badge-success {
          background: var(--badge-success-bg);
          color: var(--badge-success-text);
        }

        .badge-danger {
          background: var(--badge-danger-bg);
          color: var(--badge-danger-text);
        }

        .spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: var(--card-bg);
          border-radius: 16px;
          padding: 32px;
          max-width: 550px;
          width: 100%;
          border: 1.5px solid var(--border);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .range-btn {
          padding: 5px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          transition: all 0.2s;
          white-space: nowrap;
        }

        .range-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .range-btn-active {
          background: rgba(200, 162, 88, 0.15);
          border-color: var(--accent);
          color: var(--accent);
          font-weight: 600;
        }

        .table-container {
          overflow-x: auto;
        }

        .perf-table {
          width: 100%;
          border-collapse: collapse;
          font-family: inherit;
        }

        .perf-table thead th {
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
          text-align: left;
        }

        .perf-table tbody td,
        .perf-table tfoot td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
        }

        .perf-table tbody tr:hover {
          background: var(--section-label-bg);
        }

        .csv-btn {
          opacity: 0;
          padding: 4px 10px;
          background: rgba(200,162,88,0.1);
          border: 1px solid rgba(200,162,88,0.3);
          border-radius: 6px;
          color: var(--accent);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .perf-row:hover .csv-btn {
          opacity: 1;
        }

        .csv-btn:hover {
          background: rgba(200,162,88,0.2);
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .btn-invite-hero {
            width: 100%;
            justify-content: center;
          }

          .member-card {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
