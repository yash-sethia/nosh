const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/Menu');
const Joi = require('joi');

// Validation schemas
const orderItemSchema = Joi.object({
  menuItemId: Joi.string().required(),
  quantity: Joi.number().required().min(1).max(50),
  specialInstructions: Joi.string().trim().max(200),
  customization: Joi.array().items(Joi.object({
    name: Joi.string().required().trim(),
    price: Joi.number().min(0)
  }))
});

const orderSchema = Joi.object({
  customer: Joi.object({
    name: Joi.string().required().trim().min(2).max(100),
    phone: Joi.string().trim().pattern(/^[\+]?[1-9][\d]{0,15}$/),
    email: Joi.string().email().trim().lowercase(),
    preferences: Joi.object({
      dietary: Joi.object({
        vegetarian: Joi.boolean(),
        vegan: Joi.boolean(),
        glutenFree: Joi.boolean(),
        dairyFree: Joi.boolean()
      }),
      allergies: Joi.array().items(Joi.string()),
      spiceLevel: Joi.string().valid('mild', 'medium', 'hot', 'extra-hot')
    })
  }).required(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  orderType: Joi.string().required().valid('dine-in', 'takeaway', 'delivery'),
  tableNumber: Joi.when('orderType', {
    is: 'dine-in',
    then: Joi.number().required().min(1),
    otherwise: Joi.forbidden()
  }),
  deliveryAddress: Joi.when('orderType', {
    is: 'delivery',
    then: Joi.object({
      street: Joi.string().required().trim(),
      city: Joi.string().required().trim(),
      state: Joi.string().required().trim(),
      zipCode: Joi.string().required().trim(),
      instructions: Joi.string().trim()
    }).required(),
    otherwise: Joi.forbidden()
  }),
  tip: Joi.number().min(0).max(100),
  notes: Joi.string().trim().max(500)
});

const updateOrderSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'),
  notes: Joi.string().trim().max(500),
  assignedTo: Joi.string().trim(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
  estimatedDeliveryTime: Joi.date()
});

// Create new order
router.post('/', async (req, res) => {
  try {
    // Validate input
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    // Validate menu items and get prices
    const orderItems = [];
    let subtotal = 0;

    for (const item of value.items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) {
        return res.status(404).json({
          success: false,
          error: `Menu item with ID ${item.menuItemId} not found`
        });
      }

      if (!menuItem.isAvailable()) {
        return res.status(400).json({
          success: false,
          error: `Menu item "${menuItem.name}" is not available`
        });
      }

      const itemTotal = menuItem.price * item.quantity;
      const customizationTotal = (item.customization || []).reduce((sum, custom) => sum + custom.price, 0);
      
      orderItems.push({
        menuItem: menuItem._id,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions || '',
        price: menuItem.price,
        customization: item.customization || []
      });

      subtotal += itemTotal + customizationTotal;
    }

    // Calculate totals
    const tax = subtotal * 0.08; // 8% tax rate
    const tip = value.tip || 0;
    const total = subtotal + tax + tip;

    // Create order
    const order = new Order({
      orderNumber: Order.generateOrderNumber(),
      customer: value.customer,
      items: orderItems,
      orderType: value.orderType,
      tableNumber: value.tableNumber,
      deliveryAddress: value.deliveryAddress,
      subtotal,
      tax,
      tip,
      total,
      notes: value.notes || ''
    });

    await order.save();

    // Increment popularity for ordered items
    for (const item of orderItems) {
      await MenuItem.findByIdAndUpdate(item.menuItem, { $inc: { popularity: 1 } });
    }

    // Populate menu items for response
    await order.populate('items.menuItem');

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

// Get all orders with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      orderType,
      customerPhone,
      customerEmail,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;
    if (customerPhone) query['customer.phone'] = customerPhone;
    if (customerEmail) query['customer.email'] = customerEmail;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Build sort object
    let sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .populate('items.menuItem')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.menuItem');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// Get order by order number
router.get('/number/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).populate('items.menuItem');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order'
    });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    await order.updateStatus(status, notes);

    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Update order details
router.put('/:id', async (req, res) => {
  try {
    // Validate input
    const { error, value } = updateOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true }
    ).populate('items.menuItem');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully'
    });

  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order'
    });
  }
});

// Add item to existing order
router.post('/:id/items', async (req, res) => {
  try {
    const { menuItemId, quantity, specialInstructions, customization } = req.body;
    
    if (!menuItemId || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Menu item ID and quantity are required'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify order that is not pending'
      });
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    if (!menuItem.isAvailable()) {
      return res.status(400).json({
        success: false,
        error: 'Menu item is not available'
      });
    }

    await order.addItem(menuItem, quantity, specialInstructions, customization);
    await order.populate('items.menuItem');

    res.json({
      success: true,
      data: order,
      message: 'Item added to order successfully'
    });

  } catch (error) {
    console.error('Error adding item to order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to order'
    });
  }
});

// Remove item from order
router.delete('/:id/items/:itemIndex', async (req, res) => {
  try {
    const { itemIndex } = req.params;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify order that is not pending'
      });
    }

    await order.removeItem(parseInt(itemIndex));
    await order.populate('items.menuItem');

    res.json({
      success: true,
      data: order,
      message: 'Item removed from order successfully'
    });

  } catch (error) {
    console.error('Error removing item from order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove item from order'
    });
  }
});

// Cancel order
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel delivered order'
      });
    }

    await order.updateStatus('cancelled', reason || 'Order cancelled');

    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// Get orders by customer
router.get('/customer/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const orders = await Order.findByCustomer(identifier);

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });

  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer orders'
    });
  }
});

// Get orders by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const orders = await Order.findByStatus(status);

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });

  } catch (error) {
    console.error('Error fetching orders by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders by status'
    });
  }
});

// Get order statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          statusCounts: {
            $push: '$status'
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          statusBreakdown: {}
        }
      });
    }

    const stat = stats[0];
    const statusBreakdown = stat.statusCounts.reduce((acc, status) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalOrders: stat.totalOrders,
        totalRevenue: stat.totalRevenue,
        averageOrderValue: stat.averageOrderValue,
        statusBreakdown
      }
    });

  } catch (error) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics'
    });
  }
});

// Get orders for kitchen display
router.get('/kitchen/display', async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $in: ['confirmed', 'preparing'] }
    })
    .populate('items.menuItem')
    .sort({ priority: -1, createdAt: 1 });

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });

  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch kitchen orders'
    });
  }
});

module.exports = router;
