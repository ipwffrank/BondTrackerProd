import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Dashboard() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalVolume: 0,
    buyCount: 0,
    sellCount: 0,
    twoWayCount: 0,
    recentActivities: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData?.organizationId) {
      setLoading(false);
      return;
    }

    try {
      const activitiesRef = collection(db, `organizations/${userData.organizationId}/activities`);
      const q = query(activitiesRef);

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const activities = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()
          }));

          // Calculate statistics
          const totalActivities = activities.length;
          const totalVolume = activities.reduce((sum, a) => sum + (parseFloat(a.size) || 0), 0);
          const buyCount = activities.filter(a => a.direction === 'BUY').length;
          const sellCount = activities.filter(a => a.direction === 'SELL').length;
          const twoWayCount = activities.filter(a => a.direction === 'TWO-WAY').length;
          
          // Get 5 most recent
          const recentActivities = activities
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 5);

          setStats({
            totalActivities,
            totalVolume: totalVolume.toFixed(2),
            buyCount,
            sellCount,
            twoWayCount,
            recentActivities
          });
          setLoading(false);
        },
        (error) => {
          console.error('Error loading stats:', error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Setup error:', error);
      setLoading(false);
    }
  }, [userData?.organizationId]);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  const getDirectionColor = (direction) => {
    switch (direction) {
      case 'BUY': return 'bg-green-100 text-green-800';
      case 'SELL': return 'bg-red-100 text-red-800';
      case 'TWO-WAY': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600">Bond Tracker</h1>
            <div className="flex gap-4 ml-8">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium">
                Dashboard
              </Link>
              <Link to="/activities" className="text-gray-700 hover:text-blue-600 font-medium">
                Activities
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">
                {userData?.name}
              </div>
              <div className="text-xs text-gray-500">
                {userData?.organizationName}
              </div>
            </div>
            {userData?.isAdmin && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-semibold">
                Admin
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome back, {userData?.name}! 👋
          </h2>
          <p className="text-gray-600 mt-1">
            {userData?.organizationName} • {userData?.organizationId}
          </p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Loading statistics...</div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100">
                    <span className="text-2xl">📋</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Activities</p>
                    <p className="text-2xl font-bold">{stats.totalActivities}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Total Volume</p>
                    <p className="text-2xl font-bold">${stats.totalVolume}MM</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-emerald-100">
                    <span className="text-2xl">📈</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">BUY Activities</p>
                    <p className="text-2xl font-bold">{stats.buyCount}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.sellCount} SELL • {stats.twoWayCount} TWO-WAY
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100">
                    <span className="text-2xl">👤</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600">Your Role</p>
                    <p className="text-2xl font-bold">
                      {userData?.isAdmin ? 'Admin' : 'User'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Link
                to="/activities"
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6 hover:from-blue-600 hover:to-blue-700 transition shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">📋 Activities</h3>
                    <p className="text-blue-100">Upload transcripts and track client activities</p>
                  </div>
                  <span className="text-3xl">→</span>
                </div>
              </Link>

              <div className="bg-gray-100 rounded-lg p-6 border-2 border-dashed border-gray-300">
                <h3 className="text-xl font-bold text-gray-700 mb-2">👥 Clients</h3>
                <p className="text-gray-600">Client management coming soon...</p>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold">Recent Activities</h2>
                <Link to="/activities" className="text-blue-600 hover:underline text-sm font-medium">
                  View all →
                </Link>
              </div>
              <div className="p-6">
                {stats.recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="mb-2">No activities yet</p>
                    <Link to="/activities" className="text-blue-600 hover:underline">
                      Add your first activity →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentActivities.map((activity) => (
                      <div key={activity.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold">{activity.clientName}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getDirectionColor(activity.direction)}`}>
                              {activity.direction}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {activity.size}MM {activity.bondName || activity.ticker || 'Bond'}
                            {activity.price && ` @ ${activity.price}`}
                          </p>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {activity.createdAt && new Date(activity.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Platform Status */}
            <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
              <h3 className="text-xl font-bold mb-4 text-gray-800">🎉 Platform Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Multi-tenant architecture active</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Firebase authentication</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Real-time database sync</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>AI transcript analysis ready</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Role-based access control</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    <span>Organization: {userData?.organizationId}</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
