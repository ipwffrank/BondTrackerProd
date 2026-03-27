import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { subscribeContacts, addContact, updateContact, deleteContact } from '../services/contacts.service';

const EMPTY_FORM = { name: '', title: '', email: '', phone: '' };

export default function Contacts() {
  const { userData, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const clientId = searchParams.get('clientId');
  const clientName = searchParams.get('clientName') || 'Client';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editingContact, setEditingContact] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  // Delete confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState(null); // contactId

  // Toast
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    if (!userData?.organizationId || !clientId) { setLoading(false); return; }
    const unsub = subscribeContacts(userData.organizationId, clientId, data => {
      setContacts(data);
      setLoading(false);
    });
    return () => unsub();
  }, [userData?.organizationId, clientId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Contact name is required.'); return; }
    if (!userData?.organizationId || !clientId) return;
    setSubmitting(true);
    try {
      await addContact(userData.organizationId, clientId, {
        name: form.name.trim(),
        title: form.title.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setForm({ ...EMPTY_FORM });
      setToast('Contact added.');
    } catch (err) {
      console.error(err);
      setFormError('Failed to add contact.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(c) {
    setEditingContact(c.id);
    setEditForm({ name: c.name || '', title: c.title || '', email: c.email || '', phone: c.phone || '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm.name.trim()) return;
    setSubmitting(true);
    try {
      await updateContact(userData.organizationId, clientId, editingContact, {
        name: editForm.name.trim(),
        title: editForm.title.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      });
      setEditingContact(null);
      setToast('Contact updated.');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await deleteContact(userData.organizationId, clientId, deleteConfirm);
      setToast('Contact deleted.');
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirm(null);
    }
  }

  if (!clientId) {
    return (
      <div className="app-container">
        <Navigation />
        <main className="main-content">
          <p style={{ color: 'var(--text-secondary)', padding: '40px' }}>No client selected. <a href="/clients" style={{ color: '#C8A258' }}>Go to Clients</a></p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <div className="page-header">
          <div>
            <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: '#C8A258', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
              Back to Clients
            </button>
            <h1 className="page-title">{clientName}</h1>
            <p className="page-description">Contacts &amp; relationship managers</p>
          </div>
        </div>

        {/* Add contact form */}
        <div className="card">
          <div className="card-header">New Contact</div>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="field-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" type="text" placeholder="e.g., Jane Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="form-label">Title / Role</label>
                <input className="form-input" type="text" placeholder="e.g., Portfolio Manager" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="jane@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="form-label">Phone</label>
                <input className="form-input" type="text" placeholder="+65 9000 0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
              {formError && <div className="form-error-banner">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding...' : '+ Add Contact'}</button>
            </div>
          </form>
        </div>

        {/* Contacts list */}
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            Contacts ({contacts.length})
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Title</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No contacts yet. Add the first one above.</td></tr>
                  ) : contacts.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.title || '—'}</td>
                      <td>{c.email ? <a href={`mailto:${c.email}`} style={{ color: '#C8A258' }}>{c.email}</a> : '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-edit" onClick={() => startEdit(c)} title="Edit">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          {isAdmin && (
                            <button className="btn-icon" onClick={() => setDeleteConfirm(c.id)} title="Delete">🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit modal */}
      {editingContact && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Edit Contact</h3>
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="field-group"><label className="form-label">Full Name *</label><input className="form-input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="field-group"><label className="form-label">Title / Role</label><input className="form-input" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div className="field-group"><label className="form-label">Email</label><input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div className="field-group"><label className="form-label">Phone</label><input className="form-input" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-muted" onClick={() => setEditingContact(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', maxWidth: '380px', width: '90%' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', marginBottom: '24px' }}>Delete this contact? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-muted" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--card-bg)', border: '1px solid rgba(200,162,88,0.4)', borderRadius: '8px', padding: '12px 20px', color: 'var(--text-primary)', fontSize: '14px', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <style jsx>{`
        .app-container{min-height:100vh;background:var(--bg-base);color:var(--text-primary);}
        .main-content{max-width:1400px;margin:0 auto;padding:32px 24px;}
        .page-header{margin-bottom:32px;}
        .page-title{font-size:32px;font-weight:700;color:var(--text-primary);margin-bottom:8px;}
        .page-description{font-size:16px;color:var(--text-secondary);}
        .card{background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);}
        .card-header{font-size:17px;font-weight:700;color:var(--text-primary);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
        .field-group{display:flex;flex-direction:column;}
        .form-label{display:block;font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:5px;}
        .form-input{width:100%;padding:10px 14px;background:var(--bg-input);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;font-family:inherit;}
        .form-input:focus{outline:none;border-color:var(--border-focus);}
        .form-error-banner{background:var(--badge-danger-bg);color:var(--badge-danger-text);padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:12px;}
        .btn{padding:10px 18px;border-radius:8px;font-weight:600;font-size:13.5px;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:7px;font-family:inherit;}
        .btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-hover));color:#fff;}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .btn-muted{background:var(--btn-muted-bg);color:var(--btn-muted-text);}
        .btn-danger{background:#dc2626;color:#fff;}
        .btn-icon{background:none;border:none;cursor:pointer;font-size:16px;padding:4px;}
        .btn-edit{background:none;border:1px solid var(--accent);border-radius:6px;cursor:pointer;padding:5px 7px;color:var(--accent);display:inline-flex;align-items:center;justify-content:center;}
        .table-container{overflow-x:auto;}
        .table{width:100%;border-collapse:collapse;font-size:14px;}
        .table thead{background:var(--table-header-bg);}
        .table th{padding:12px 16px;text-align:left;font-weight:600;color:var(--text-secondary);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border);}
        .table td{padding:14px 16px;border-bottom:1px solid var(--border);color:var(--text-primary);}
        .table tbody tr:hover{background:var(--table-hover);}
      `}</style>
    </div>
  );
}
