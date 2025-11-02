const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/Menu');

// Get basic analytics dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Today's metrics
    const todayMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);

    // Pending orders
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
    const preparingOrders = await Order.countDocuments({ status: 'preparing' });

    const result = {
      today: todayMetrics[0] || { orders: 0, revenue: 0 },
      currentStatus: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        preparing: preparingOrders
      },
      lastUpdated: now.toISOString()
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// Get popular items
router.get('/popular-items', async (req, res) => {
  try {
    const popularItems = await MenuItem.find({ availability: 'available' })
      .sort({ popularity: -1, 'rating.average': -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        items: popularItems,
        count: popularItems.length
      }
    });

  } catch (error) {
    console.error('Error fetching popular items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular items'
    });
  }
});

// Get sales summary
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching sales data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales data'
    });
  }
});

module.exports = router;
