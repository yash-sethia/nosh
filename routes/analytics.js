const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/Menu');
const cron = require('node-cron');

// Cache for analytics data
let analyticsCache = {
  salesData: null,
  popularItems: null,
  customerInsights: null,
  lastUpdated: null
};

// Cache expiration time (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

// Middleware to check cache
const checkCache = (req, res, next) => {
  if (analyticsCache.lastUpdated && 
      (Date.now() - analyticsCache.lastUpdated) < CACHE_EXPIRY) {
    return res.json({
      success: true,
      data: analyticsCache[req.route.path] || {},
      cached: true,
      lastUpdated: analyticsCache.lastUpdated
    });
  }
  next();
};

// Get comprehensive sales analytics
router.get('/sales', checkCache, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = 'day',
      includeBreakdown = true 
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Group by options
    let groupStage = {};
    if (groupBy === 'hour') {
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' }
      };
    } else if (groupBy === 'day') {
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
    } else if (groupBy === 'week') {
      groupStage = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
    } else if (groupBy === 'month') {
      groupStage = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
    }

    // Aggregate pipeline
    const pipeline = [
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: groupStage,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          totalItems: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
          averageOrderValue: { $avg: '$total' },
          averageItemsPerOrder: { $avg: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ];

    const salesData = await Order.aggregate(pipeline);

    // Calculate summary statistics
    const summary = salesData.reduce((acc, item) => {
      acc.totalOrders += item.totalOrders;
      acc.totalRevenue += item.totalRevenue;
      acc.totalItems += item.totalItems;
      return acc;
    }, { totalOrders: 0, totalRevenue: 0, totalItems: 0 });

    summary.averageOrderValue = summary.totalRevenue / summary.totalOrders || 0;
    summary.averageItemsPerOrder = summary.totalItems / summary.totalOrders || 0;

    // Get order type breakdown if requested
    let orderTypeBreakdown = null;
    if (includeBreakdown === 'true') {
      orderTypeBreakdown = await Order.aggregate([
        { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: '$orderType',
            count: { $sum: 1 },
            revenue: { $sum: '$total' }
          }
        }
      ]);
    }

    const result = {
      summary,
      salesData,
      orderTypeBreakdown,
      groupBy,
      dateRange: { startDate, endDate }
    };

    // Update cache
    analyticsCache.salesData = result;
    analyticsCache.lastUpdated = Date.now();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales analytics'
    });
  }
});

// Get popular menu items analytics
router.get('/popular-items', checkCache, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      limit = 20,
      category = null,
      includeTrends = true 
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get popular items by order count
    const popularByOrders = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItem',
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Get popular items by revenue
    const popularByRevenue = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItem',
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Populate menu item details
    const popularItems = await Promise.all(
      popularByOrders.map(async (item) => {
        const menuItem = await MenuItem.findById(item._id);
        if (!menuItem) return null;
        
        return {
          ...item,
          menuItem: {
            _id: menuItem._id,
            name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            rating: menuItem.rating,
            image: menuItem.image
          }
        };
      })
    );

    // Get category breakdown
    const categoryBreakdown = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'items.menuItem',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: '$menuItem' },
      {
        $group: {
          _id: '$menuItem.category',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Get trending items (items with increasing popularity)
    let trendingItems = null;
    if (includeTrends === 'true') {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const recentPopular = await Order.aggregate([
        { $match: { createdAt: { $gte: weekAgo }, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItem',
            recentOrders: { $sum: 1 }
          }
        }
      ]);

      const previousPopular = await Order.aggregate([
        { $match: { createdAt: { $gte: twoWeeksAgo, $lt: weekAgo }, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItem',
            previousOrders: { $sum: 1 }
          }
        }
      ]);

      trendingItems = recentPopular
        .map(recent => {
          const previous = previousPopular.find(p => p._id.toString() === recent._id.toString());
          const previousCount = previous ? previous.previousOrders : 0;
          const growth = previousCount > 0 ? ((recent.recentOrders - previousCount) / previousCount) * 100 : 100;
          
          return {
            menuItemId: recent._id,
            recentOrders: recent.recentOrders,
            previousOrders: previousCount,
            growth: Math.round(growth * 100) / 100
          };
        })
        .filter(item => item.growth > 20) // Only items with >20% growth
        .sort((a, b) => b.growth - a.growth)
        .slice(0, 10);
    }

    const result = {
      popularByQuantity: popularItems.filter(Boolean),
      popularByRevenue: popularByRevenue,
      categoryBreakdown,
      trendingItems,
      dateRange: { startDate, endDate }
    };

    // Update cache
    analyticsCache.popularItems = result;
    analyticsCache.lastUpdated = Date.now();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching popular items analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular items analytics'
    });
  }
});

// Get customer insights and behavior analytics
router.get('/customer-insights', checkCache, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Customer order frequency
    const customerFrequency = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$customer.phone',
          customerName: { $first: '$customer.name' },
          customerEmail: { $first: '$customer.email' },
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          firstOrder: { $min: '$createdAt' },
          lastOrder: { $max: '$createdAt' },
          averageOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { totalOrders: -1 } },
      { $limit: 50 }
    ]);

    // Customer segments
    const customerSegments = customerFrequency.reduce((segments, customer) => {
      if (customer.totalOrders >= 10) segments.vip.push(customer);
      else if (customer.totalOrders >= 5) segments.regular.push(customer);
      else if (customer.totalOrders >= 2) segments.occasional.push(customer);
      else segments.new.push(customer);
      return segments;
    }, { vip: [], regular: [], occasional: [], new: [] });

    // Customer preferences analysis
    const customerPreferences = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'menuitems',
          localField: 'items.menuItem',
          foreignField: '_id',
          as: 'menuItem'
        }
      },
      { $unwind: '$menuItem' },
      {
        $group: {
          _id: '$customer.phone',
          preferredCategories: { $addToSet: '$menuItem.category' },
          preferredIngredients: { $addToSet: '$menuItem.ingredients.name' },
          averageSpiceLevel: { $avg: { $cond: [{ $eq: ['$customer.preferences.spiceLevel', 'hot'] }, 3, { $cond: [{ $eq: ['$customer.preferences.spiceLevel', 'medium'] }, 2, 1] }] } }
        }
      }
    ]);

    // Customer lifetime value
    const customerLTV = customerFrequency
      .map(customer => ({
        ...customer,
        ltv: customer.totalSpent,
        averageOrderFrequency: customer.totalOrders / Math.max(1, (customer.lastOrder - customer.firstOrder) / (1000 * 60 * 60 * 24)) // orders per day
      }))
      .sort((a, b) => b.ltv - a.ltv);

    // Customer retention analysis
    const retentionData = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$customer.phone',
          orderDates: { $push: '$createdAt' }
        }
      },
      {
        $project: {
          customerId: '$_id',
          orderDates: 1,
          orderCount: { $size: '$orderDates' },
          daysBetweenOrders: {
            $map: {
              input: { $range: [1, { $size: '$orderDates' }] },
              as: 'index',
              in: {
                $divide: [
                  { $subtract: [{ $arrayElemAt: ['$orderDates', '$$index'] }, { $arrayElemAt: ['$orderDates', { $subtract: ['$$index', 1] }] }] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      }
    ]);

    const result = {
      customerFrequency,
      customerSegments,
      customerPreferences,
      customerLTV,
      retentionData,
      summary: {
        totalCustomers: customerFrequency.length,
        vipCustomers: customerSegments.vip.length,
        regularCustomers: customerSegments.regular.length,
        averageOrdersPerCustomer: customerFrequency.reduce((sum, c) => sum + c.totalOrders, 0) / customerFrequency.length || 0,
        averageCustomerLTV: customerLTV.reduce((sum, c) => sum + c.ltv, 0) / customerLTV.length || 0
      }
    };

    // Update cache
    analyticsCache.customerInsights = result;
    analyticsCache.lastUpdated = Date.now();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching customer insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer insights'
    });
  }
});

// Get operational performance metrics
router.get('/performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Order fulfillment time
    const fulfillmentTime = await Order.aggregate([
      { $match: { ...dateFilter, status: 'delivered', actualDeliveryTime: { $exists: true } } },
      {
        $project: {
          fulfillmentTime: {
            $divide: [
              { $subtract: ['$actualDeliveryTime', '$createdAt'] },
              1000 * 60 // Convert to minutes
            ]
          },
          orderType: 1,
          category: 1
        }
      },
      {
        $group: {
          _id: null,
          averageFulfillmentTime: { $avg: '$fulfillmentTime' },
          minFulfillmentTime: { $min: '$fulfillmentTime' },
          maxFulfillmentTime: { $max: '$fulfillmentTime' }
        }
      }
    ]);

    // Order status distribution
    const statusDistribution = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Peak hours analysis
    const peakHours = await Order.aggregate([
      { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Table turnover (for dine-in orders)
    const tableTurnover = await Order.aggregate(
      { $match: { ...dateFilter, orderType: 'dine-in', status: 'delivered' } },
      {
        $group: {
          _id: '$tableNumber',
          orders: { $push: { createdAt: '$createdAt', deliveredAt: '$actualDeliveryTime' } },
          totalOrders: { $sum: 1 }
        }
      },
      {
        $project: {
          tableNumber: '$_id',
          totalOrders: 1,
          averageTurnoverTime: {
            $avg: {
              $map: {
                input: '$orders',
                as: 'order',
                in: {
                  $divide: [
                    { $subtract: ['$$order.deliveredAt', '$$order.createdAt'] },
                    1000 * 60 // Convert to minutes
                  ]
                }
              }
            }
          }
        }
      }
    );

    const result = {
      fulfillmentTime: fulfillmentTime[0] || {},
      statusDistribution,
      peakHours,
      tableTurnover,
      operationalMetrics: {
        orderCompletionRate: statusDistribution.find(s => s._id === 'delivered')?.count / statusDistribution.reduce((sum, s) => sum + s.count, 0) || 0,
        averageFulfillmentTime: fulfillmentTime[0]?.averageFulfillmentTime || 0,
        peakHour: peakHours.reduce((peak, hour) => hour.orderCount > peak.orderCount ? hour : peak, { orderCount: 0 })
      }
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

// Get real-time dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), now.getMonth(), 1);

    // Today's metrics
    const todayMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          items: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } }
        }
      }
    ]);

    // Yesterday's metrics
    const yesterdayMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: yesterday, $lt: today }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          items: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } }
        }
      }
    ]);

    // This week's metrics
    const weekMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: thisWeek }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          items: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } }
        }
      }
    ]);

    // This month's metrics
    const monthMetrics = await Order.aggregate([
      { $match: { createdAt: { $gte: thisMonth }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          items: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } }
        }
      }
    ]);

    // Pending orders
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const confirmedOrders = await Order.countDocuments({ status: 'confirmed' });
    const preparingOrders = await Order.countDocuments({ status: 'preparing' });

    // Recent orders
    const recentOrders = await Order.find({ status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('items.menuItem');

    const result = {
      today: todayMetrics[0] || { orders: 0, revenue: 0, items: 0 },
      yesterday: yesterdayMetrics[0] || { orders: 0, revenue: 0, items: 0 },
      thisWeek: weekMetrics[0] || { orders: 0, revenue: 0, items: 0 },
      thisMonth: monthMetrics[0] || { orders: 0, revenue: 0, items: 0 },
      currentStatus: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        preparing: preparingOrders
      },
      recentOrders,
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

// Clear analytics cache
router.delete('/cache', (req, res) => {
  analyticsCache = {
    salesData: null,
    popularItems: null,
    customerInsights: null,
    lastUpdated: null
  };

  res.json({
    success: true,
    message: 'Analytics cache cleared successfully'
  });
});

// Schedule cache refresh every 5 minutes
cron.schedule('*/5 * * * *', () => {
  analyticsCache = {
    salesData: null,
    popularItems: null,
    customerInsights: null,
    lastUpdated: null
  };
  console.log('Analytics cache refreshed');
});

module.exports = router;
