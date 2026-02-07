import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export const analyticsService = {
  // Get analytics for date range
  async getAnalytics(organizationId, startDate, endDate) {
    try {
      const activitiesRef = collection(db, `organizations/${organizationId}/activities`);
      
      // Query activities in date range
      const q = query(
        activitiesRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
      );
      
      const snapshot = await getDocs(q);
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));

      return this.calculateMetrics(activities);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw error;
    }
  },

  // Calculate all metrics from activities
  calculateMetrics(activities) {
    // Total volume
    const totalVolume = activities.reduce((sum, a) => sum + (parseFloat(a.size) || 0), 0);
    
    // Volume by direction
    const volumeByDirection = {
      BUY: 0,
      SELL: 0,
      'TWO-WAY': 0
    };
    
    activities.forEach(a => {
      const direction = a.direction || 'UNKNOWN';
      const size = parseFloat(a.size) || 0;
      if (volumeByDirection.hasOwnProperty(direction)) {
        volumeByDirection[direction] += size;
      }
    });
    
    // Top clients by volume
    const clientVolumes = {};
    activities.forEach(a => {
      const client = a.clientName || 'UNKNOWN';
      const size = parseFloat(a.size) || 0;
      clientVolumes[client] = (clientVolumes[client] || 0) + size;
    });
    
    const topClients = Object.entries(clientVolumes)
      .map(([name, volume]) => ({ name, volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
    
    // Activities by date
    const activitiesByDate = {};
    activities.forEach(a => {
      if (a.createdAt) {
        const dateKey = a.createdAt.toISOString().split('T')[0];
        activitiesByDate[dateKey] = (activitiesByDate[dateKey] || 0) + 1;
      }
    });
    
    const timeline = Object.entries(activitiesByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Count by direction
    const countByDirection = {
      BUY: activities.filter(a => a.direction === 'BUY').length,
      SELL: activities.filter(a => a.direction === 'SELL').length,
      'TWO-WAY': activities.filter(a => a.direction === 'TWO-WAY').length
    };
    
    // Average deal size
    const avgDealSize = activities.length > 0 ? totalVolume / activities.length : 0;
    
    return {
      totalActivities: activities.length,
      totalVolume: totalVolume.toFixed(2),
      volumeByDirection,
      countByDirection,
      topClients,
      timeline,
      avgDealSize: avgDealSize.toFixed(2)
    };
  }
};
