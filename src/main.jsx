import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'

// Apply the theme attribute BEFORE React renders, so a light-mode user
// never sees a dark flash (and vice versa). Default is light; users can
// toggle via the sidebar and the choice persists in localStorage.
;(function () {
  try {
    const saved = localStorage.getItem('axle-theme');
    document.documentElement.setAttribute('data-theme', saved || 'light');
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

// Redirect Firebase auth action params to /auth-action before React mounts.
// Handles multiple URL formats Firebase may use for password reset emails.
;(function () {
  const _p = new URLSearchParams(window.location.search);

  // Format 1: Firebase Dynamic Link — /?link=ENCODED_DEEP_URL
  const _deepLink = _p.get('link');
  if (_deepLink) {
    try {
      const _u = new URL(decodeURIComponent(_deepLink));
      const _mode = _u.searchParams.get('mode');
      const _oobCode = _u.searchParams.get('oobCode');
      if (_mode && _oobCode) {
        let _target = `/auth-action?mode=${encodeURIComponent(_mode)}&oobCode=${encodeURIComponent(_oobCode)}`;
        const _ak = _u.searchParams.get('apiKey');
        if (_ak) _target += `&apiKey=${encodeURIComponent(_ak)}`;
        window.history.replaceState(null, '', _target);
        return;
      }
    } catch (_) {}
  }

  // Format 2: Firebase params directly on root — /?mode=resetPassword&oobCode=XXX
  const _mode = _p.get('mode');
  const _oobCode = _p.get('oobCode');
  if (_mode && _oobCode && window.location.pathname === '/') {
    let _target = `/auth-action?mode=${encodeURIComponent(_mode)}&oobCode=${encodeURIComponent(_oobCode)}`;
    const _ak = _p.get('apiKey');
    if (_ak) _target += `&apiKey=${encodeURIComponent(_ak)}`;
    window.history.replaceState(null, '', _target);
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
