import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Signup() {
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!firstName.trim() || !surname.trim()) {
      setError('Please enter both your first name and surname.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!consentGiven) {
      setError('You must agree to the Privacy Policy to create an account.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const fullName = `${firstName.trim()} ${surname.trim()}`;
      await signup(email.trim(), password, fullName, organizationName);
      navigate('/activities');
    } catch (err) {
      setError('Failed to create account: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Create Account</h2>
          <p className="text-center text-gray-600 mt-2">
            First user from your domain becomes admin
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Surname</label>
              <input
                type="text"
                required
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Smith"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="you@yourcompany.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Organization Name</label>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Your Company Name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              minLength={8}
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="consent" className="text-sm text-gray-600">
              I agree to the{' '}
              <Link to="/legal" target="_blank" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>{' '}
              and consent to the collection and use of my personal data as described therein.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !consentGiven}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        
        <div className="text-center">
          <Link to="/login" className="text-blue-600 hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
