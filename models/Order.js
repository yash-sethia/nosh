const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  specialInstructions: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  customization: [{
    name: String,
    price: Number
  }]
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    preferences: {
      dietary: {
        vegetarian: { type: Boolean, default: false },
        vegan: { type: Boolean, default: false },
        glutenFree: { type: Boolean, default: false },
        dairyFree: { type: Boolean, default: false }
      },
      allergies: [String],
      spiceLevel: {
        type: String,
        enum: ['mild', 'medium', 'hot', 'extra-hot'],
        default: 'medium'
      }
    }
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending'
  },
  orderType: {
    type: String,
    enum: ['dine-in', 'takeaway', 'delivery'],
    required: true
  },
  tableNumber: {
    type: Number,
    required: function() { return this.orderType === 'dine-in'; }
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    instructions: String
  },
  estimatedDeliveryTime: {
    type: Date
  },
  actualDeliveryTime: {
    type: Date
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    required: true,
    min: 0
  },
  tip: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'pending'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  assignedTo: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ orderType: 1, status: 1 });
orderSchema.index({ estimatedDeliveryTime: 1 });

// Virtual for order summary
orderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for order duration
orderSchema.virtual('duration').get(function() {
  if (this.status === 'delivered' && this.actualDeliveryTime) {
    return Math.round((this.actualDeliveryTime - this.createdAt) / (1000 * 60)); // minutes
  }
  return null;
});

// Method to calculate totals
orderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => {
    const itemTotal = item.price * item.quantity;
    const customizationTotal = item.customization.reduce((sum, custom) => sum + custom.price, 0);
    return total + itemTotal + customizationTotal;
  }, 0);
  
  this.tax = this.subtotal * 0.08; // 8% tax rate
  this.total = this.subtotal + this.tax + this.tip;
  
  return this;
};

// Method to update status
orderSchema.methods.updateStatus = function(newStatus, notes = '') {
  this.status = newStatus;
  if (notes) this.notes = notes;
  
  // Update timestamps for status changes
  if (newStatus === 'preparing') {
    this.estimatedDeliveryTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  } else if (newStatus === 'ready') {
    this.actualDeliveryTime = new Date();
  }
  
  return this.save();
};

// Method to add item
orderSchema.methods.addItem = function(menuItem, quantity, specialInstructions = '', customization = []) {
  const orderItem = {
    menuItem: menuItem._id,
    quantity,
    specialInstructions,
    price: menuItem.price,
    customization
  };
  
  this.items.push(orderItem);
  this.calculateTotals();
  return this.save();
};

// Method to remove item
orderSchema.methods.removeItem = function(itemIndex) {
  if (itemIndex >= 0 && itemIndex < this.items.length) {
    this.items.splice(itemIndex, 1);
    this.calculateTotals();
    return this.save();
  }
  throw new Error('Invalid item index');
};

// Static method to generate order number
orderSchema.statics.generateOrderNumber = function() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${year}${month}${day}${random}`;
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status) {
  return this.find({ status }).populate('items.menuItem');
};

// Static method to find orders by customer
orderSchema.statics.findByCustomer = function(customerIdentifier) {
  return this.find({
    $or: [
      { 'customer.phone': customerIdentifier },
      { 'customer.email': customerIdentifier }
    ]
  }).populate('items.menuItem').sort({ createdAt: -1 });
};

module.exports = mongoose.model('Order', orderSchema);
