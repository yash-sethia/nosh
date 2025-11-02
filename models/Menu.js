const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['vegetable', 'meat', 'dairy', 'grain', 'spice', 'other'],
    default: 'other'
  },
  allergens: [{
    type: String,
    enum: ['gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'soy', 'fish', 'wheat']
  }],
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number
  }
});

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['appetizer', 'main', 'dessert', 'beverage', 'side', 'salad', 'soup']
  },
  subcategory: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  ingredients: [ingredientSchema],
  tags: [{
    type: String,
    trim: true
  }],
  dietary: {
    vegetarian: { type: Boolean, default: false },
    vegan: { type: Boolean, default: false },
    glutenFree: { type: Boolean, default: false },
    dairyFree: { type: Boolean, default: false },
    spicy: { type: Boolean, default: false }
  },
  availability: {
    type: String,
    enum: ['available', 'limited', 'unavailable'],
    default: 'available'
  },
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  image: {
    type: String,
    default: null
  },
  isSpecial: {
    type: Boolean,
    default: false
  },
  specialDescription: {
    type: String,
    trim: true
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  popularity: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
menuItemSchema.index({ category: 1, availability: 1 });
menuItemSchema.index({ tags: 1 });
menuItemSchema.index({ 'ingredients.name': 1 });
menuItemSchema.index({ isSpecial: 1 });
menuItemSchema.index({ rating: -1 });
menuItemSchema.index({ popularity: -1 });

// Virtual for full price display
menuItemSchema.virtual('priceFormatted').get(function() {
  return `$${this.price.toFixed(2)}`;
});

// Method to check if item is available
menuItemSchema.methods.isAvailable = function() {
  return this.availability === 'available';
};

// Method to update rating
menuItemSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

// Method to increment popularity
menuItemSchema.methods.incrementPopularity = function() {
  this.popularity += 1;
  return this.save();
};

// Static method to find specials
menuItemSchema.statics.findSpecials = function() {
  return this.find({ isSpecial: true, availability: 'available' });
};

// Static method to find by dietary preferences
menuItemSchema.statics.findByDietary = function(preferences) {
  const query = { availability: 'available' };
  
  if (preferences.vegetarian) query['dietary.vegetarian'] = true;
  if (preferences.vegan) query['dietary.vegan'] = true;
  if (preferences.glutenFree) query['dietary.glutenFree'] = true;
  if (preferences.dairyFree) query['dietary.dairyFree'] = true;
  
  return this.find(query);
};

module.exports = mongoose.model('MenuItem', menuItemSchema);
