import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { teamService } from '../services/team.service';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);

  const { signupWithInvitation } = useAuth();
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const orgId = searchParams.get('org');

  useEffect(() => {
    async function loadInvitation() {
      if (!token || !orgId) {
        setError('Invalid invitation link. Please contact your administrator for a new invitation.');
        setInvitationLoading(false);
        return;
      }

      try {
        const invitationData = await teamService.getInvitationByToken(orgId, token);

        if (!invitationData) {
          setError('Invitation not found. It may have been cancelled or already used.');
          setInvitationLoading(false);
          return;
        }

        if (invitationData.status !== 'pending') {
          setError('This invitation has already been used or cancelled.');
          setInvitationLoading(false);
          return;
        }

        // Check if expired
        const expiresAt = invitationData.expiresAt?.toDate ? invitationData.expiresAt.toDate() : new Date(invitationData.expiresAt);
        if (expiresAt < new Date()) {
          setError('This invitation has expired. Please contact your administrator for a new invitation.');
          setInvitationLoading(false);
          return;
        }

        setInvitation(invitationData);
        setInvitationLoading(false);
      } catch (err) {
        console.error('Error loading invitation:', err);
        setError('Failed to load invitation. Please try again or contact support.');
        setInvitationLoading(false);
      }
    }

    loadInvitation();
  }, [token, orgId]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      setError('');
      setLoading(true);

      await signupWithInvitation(
        invitation.email,
        password,
        name,
        invitation.organizationId,
        invitation.organizationName,
        invitation.role,
        token
      );

      // Mark invitation as accepted
      await teamService.acceptInvitation(orgId, token);

      navigate('/activities');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please login instead.');
      } else {
        setError('Failed to create account: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow text-center">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h2 className="text-2xl font-bold text-gray-800">Invalid Invitation</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <div className="mt-6">
            <Link
              to="/login"
              className="text-blue-600 hover:underline"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Join {invitation?.organizationName}</h2>
          <p className="text-center text-gray-600 mt-2">
            You've been invited by {invitation?.invitedBy}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Email:</strong> {invitation?.email}
          </p>
          <p className="text-sm text-blue-800 mt-1">
            <strong>Role:</strong> {invitation?.role === 'admin' ? 'Administrator' : 'Team Member'}
          </p>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength={6}
              placeholder="Create a password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              minLength={6}
              placeholder="Confirm your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 font-medium"
          >
            {loading ? 'Creating account...' : 'Accept Invitation & Create Account'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
