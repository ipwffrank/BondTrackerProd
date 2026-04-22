import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeContacts, addContact, updateContact, deleteContact } from '../services/contacts.service';

const EMPTY_FORM = { name: '', title: '', email: '', phone: '' };

export default function Contacts() {
  const { userData, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Clients list
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientsLoading, setClientsLoading] = useState(true);

  // Selected client
  const [selectedClient, setSelectedClient] = useState(null);

  // Contacts for selected client
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const contactsUnsubRef = useRef(null);

  // Add form
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editingContact, setEditingContact] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // CSV bulk import
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvNotification, setCsvNotification] = useState(null);
  const csvInputRef = useRef(null);

  // Toast
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  // Load all clients
  useEffect(() => {
    if (!userData?.organizationId) { setClientsLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, `organizations/${userData.organizationId}/clients`), orderBy('name', 'asc')),
      snapshot => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setClients(list);
        setClientsLoading(false);

        // Auto-select from URL param on first load
        const urlClientId = searchParams.get('clientId');
        if (urlClientId) {
          const match = list.find(c => c.id === urlClientId);
          if (match) selectClient(match);
        }
      }
    );
    return () => unsub();
  }, [userData?.organizationId]);

  // Subscribe to contacts when a client is selected
  function selectClient(client) {
    if (selectedClient?.id === client.id) return;
    setSelectedClient(client);
    setContacts([]);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    // Update URL without navigation
    setSearchParams({ clientId: client.id, clientName: client.name }, { replace: true });

    if (contactsUnsubRef.current) contactsUnsubRef.current();
    setContactsLoading(true);
    contactsUnsubRef.current = subscribeContacts(userData.organizationId, client.id, data => {
      setContacts(data);
      setContactsLoading(false);
    });
  }

  useEffect(() => () => { if (contactsUnsubRef.current) contactsUnsubRef.current(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Contact name is required.'); return; }
    if (!selectedClient) return;
    setSubmitting(true);
    try {
      await addContact(userData.organizationId, selectedClient.id, {
        name: form.name.trim(), title: form.title.trim(),
        email: form.email.trim(), phone: form.phone.trim(),
      });
      setForm({ ...EMPTY_FORM });
      setToast('Contact added.');
    } catch (err) {
      console.error(err);
      setFormError('Failed to add contact.');
    } finally { setSubmitting(false); }
  }

  function startEdit(c) {
    setEditingContact(c.id);
    setEditForm({ name: c.name || '', title: c.title || '', email: c.email || '', phone: c.phone || '' });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm.name.trim() || !selectedClient) return;
    setSubmitting(true);
    try {
      await updateContact(userData.organizationId, selectedClient.id, editingContact, {
        name: editForm.name.trim(), title: editForm.title.trim(),
        email: editForm.email.trim(), phone: editForm.phone.trim(),
      });
      setEditingContact(null);
      setToast('Contact updated.');
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  }

  async function confirmDelete() {
    if (!deleteConfirm || !selectedClient) return;
    try {
      await deleteContact(userData.organizationId, selectedClient.id, deleteConfirm);
      setToast('Contact deleted.');
    } catch (err) { console.error(err); }
    finally { setDeleteConfirm(null); }
  }

  // Parse a single CSV line, handling simple quoted fields.
  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  function downloadContactsTemplate() {
    const header = 'name,title,email,phone\n';
    const sample = 'Jane Smith,Portfolio Manager,jane.smith@example.com,+65 9000 0000\n';
    const blob = new Blob([header + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleContactsCsvUpload(e) {
    const file = e.target.files[0];
    if (file) e.target.value = ''; // allow re-selecting the same file later
    if (!file || !userData?.organizationId || !selectedClient) return;

    setCsvUploading(true);
    setCsvNotification(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length === 0) {
        setCsvNotification({ type: 'error', message: 'CSV file is empty.' });
        return;
      }

      // Skip header row if present
      let startIdx = 0;
      const firstLower = lines[0].toLowerCase();
      if (firstLower.includes('name') || firstLower.includes('email') || firstLower.includes('title')) startIdx = 1;

      const rows = lines.slice(startIdx).map(line => {
        const cols = parseCsvLine(line);
        return {
          name: cols[0] || '',
          title: cols[1] || '',
          email: cols[2] || '',
          phone: cols[3] || '',
        };
      }).filter(r => r.name);

      if (rows.length === 0) {
        setCsvNotification({ type: 'error', message: 'No valid rows found. The "name" column is required.' });
        return;
      }

      // Dedup: skip rows whose email OR (name + title) already exists for this client
      const existingEmails = new Set(contacts.map(c => (c.email || '').toLowerCase()).filter(Boolean));
      const existingNameTitle = new Set(contacts.map(c => `${(c.name || '').toLowerCase()}|${(c.title || '').toLowerCase()}`));

      let added = 0;
      let skipped = 0;
      for (const r of rows) {
        const emailKey = r.email.toLowerCase();
        const nameTitleKey = `${r.name.toLowerCase()}|${r.title.toLowerCase()}`;
        if ((emailKey && existingEmails.has(emailKey)) || existingNameTitle.has(nameTitleKey)) {
          skipped++;
          continue;
        }
        await addContact(userData.organizationId, selectedClient.id, r);
        if (emailKey) existingEmails.add(emailKey);
        existingNameTitle.add(nameTitleKey);
        added++;
      }

      const parts = [`Added ${added} contact${added !== 1 ? 's' : ''}`];
      if (skipped > 0) parts.push(`skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}`);
      setCsvNotification({ type: added > 0 ? 'success' : 'error', message: parts.join(', ') + '.' });
    } catch (err) {
      console.error('Contacts CSV import error:', err);
      setCsvNotification({ type: 'error', message: `Import failed: ${err.message}` });
    } finally {
      setCsvUploading(false);
    }
  }

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="app-container">
      <Navigation />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Contacts</h1>
            <p className="page-description">Relationship managers by client institution</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── Left: client list ── */}
          <div className="card">
            <div className="card-header" style={{ padding: '16px 20px' }}>
              <span style={{ fontSize: '14px' }}>Clients ({filteredClients.length})</span>
            </div>
            <div style={{ padding: '12px' }}>
              <input
                className="form-input"
                type="text"
                placeholder="Search clients…"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                style={{ marginBottom: '8px' }}
              />
            </div>
            <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {clientsLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
              ) : filteredClients.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No clients found.</div>
              ) : filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectClient(c)}
                  style={{
                    width: '100%', textAlign: 'left', background: selectedClient?.id === c.id ? 'rgba(200,162,88,0.1)' : 'transparent',
                    border: 'none', borderLeft: selectedClient?.id === c.id ? '3px solid #C8A258' : '3px solid transparent',
                    padding: '12px 16px', cursor: 'pointer', transition: 'background 0.15s',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: selectedClient?.id === c.id ? '#C8A258' : 'var(--text-primary)', marginBottom: '2px' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.type} · {c.region}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: contacts panel ── */}
          {!selectedClient ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.3, marginBottom: '12px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <p style={{ fontSize: '14px' }}>Select a client to view contacts</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Client header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{selectedClient.name}</h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedClient.type} · {selectedClient.region}</span>
              </div>

              {/* Add contact form */}
              <div className="card">
                <div className="card-header" style={{ fontSize: '15px' }}>New Contact</div>
                <form onSubmit={handleSubmit}>
                  <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div className="field-group">
                      <label className="form-label">Full Name *</label>
                      <input className="form-input" type="text" placeholder="Jane Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <label className="form-label">Title / Role</label>
                      <input className="form-input" type="text" placeholder="Portfolio Manager" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
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
                  <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
                    {formError && <div className="form-error-banner">{formError}</div>}
                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding…' : '+ Add Contact'}</button>
                  </div>
                </form>
              </div>

              {/* Contacts table */}
              <div className="card">
                <div className="card-header" style={{ fontSize: '15px' }}>
                  <span>Contacts ({contacts.length})</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={downloadContactsTemplate}
                      className="btn btn-muted"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      title="Download a CSV template with the expected columns"
                    >
                      Download Template
                    </button>
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className="btn btn-secondary"
                      disabled={csvUploading}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      title="Bulk-import contacts for this client from a CSV"
                    >
                      {csvUploading ? 'Uploading...' : 'Upload CSV'}
                    </button>
                    <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleContactsCsvUpload} />
                  </div>
                </div>
                {csvNotification && (
                  <div style={{
                    padding: '10px 24px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 500,
                    background: csvNotification.type === 'success' ? 'var(--badge-success-bg)' : 'var(--badge-danger-bg)',
                    color: csvNotification.type === 'success' ? 'var(--badge-success-text)' : 'var(--badge-danger-text)',
                  }}>
                    <span>{csvNotification.message}</span>
                    <button onClick={() => setCsvNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px', lineHeight: 1 }}>×</button>
                  </div>
                )}
                {contactsLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Actions</th>
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
                                {isAdmin && <button className="btn-icon" onClick={() => setDeleteConfirm(c.id)} title="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/><path d="M10 11v6M14 11v6"/></svg></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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

      {/* Delete confirm */}
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
        .page-header{margin-bottom:24px;}
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
        @media(max-width:768px){
          .main-content > div[style*="grid-template-columns"]{grid-template-columns:1fr !important;}
        }
      `}</style>
    </div>
  );
}
