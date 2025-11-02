const express = require('express');
const router = express.Router();
const MenuItem = require('../models/Menu');
const Joi = require('joi');

// Validation schemas
const menuItemSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  description: Joi.string().required().trim().min(10).max(500),
  category: Joi.string().required().valid('appetizer', 'main', 'dessert', 'beverage', 'side', 'salad', 'soup'),
  subcategory: Joi.string().trim().max(50),
  price: Joi.number().required().min(0).max(1000),
  ingredients: Joi.array().items(Joi.object({
    name: Joi.string().required().trim(),
    category: Joi.string().valid('vegetable', 'meat', 'dairy', 'grain', 'spice', 'other'),
    allergens: Joi.array().items(Joi.string().valid('gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'soy', 'fish', 'wheat')),
    nutritionalInfo: Joi.object({
      calories: Joi.number().min(0),
      protein: Joi.number().min(0),
      carbs: Joi.number().min(0),
      fat: Joi.number().min(0),
      fiber: Joi.number().min(0)
    })
  })),
  tags: Joi.array().items(Joi.string().trim().max(30)),
  dietary: Joi.object({
    vegetarian: Joi.boolean(),
    vegan: Joi.boolean(),
    glutenFree: Joi.boolean(),
    dairyFree: Joi.boolean(),
    spicy: Joi.boolean()
  }),
  availability: Joi.string().valid('available', 'limited', 'unavailable'),
  preparationTime: Joi.number().min(1).max(120),
  image: Joi.string().uri().allow(null),
  isSpecial: Joi.boolean(),
  specialDescription: Joi.string().trim().max(200)
});

const updateMenuItemSchema = menuItemSchema.fork(
  ['name', 'description', 'category', 'price'],
  (schema) => schema.optional()
);

// Get all menu items with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      subcategory,
      availability = 'available',
      minPrice,
      maxPrice,
      dietary,
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    let query = {};
    
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (availability) query.availability = availability;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    
    // Dietary filters
    if (dietary) {
      const dietaryFilters = dietary.split(',');
      dietaryFilters.forEach(filter => {
        if (filter === 'vegetarian') query['dietary.vegetarian'] = true;
        if (filter === 'vegan') query['dietary.vegan'] = true;
        if (filter === 'glutenFree') query['dietary.glutenFree'] = true;
        if (filter === 'dairyFree') query['dietary.dairyFree'] = true;
        if (filter === 'spicy') query['dietary.spicy'] = true;
      });
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { 'ingredients.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    let sort = {};
    if (sortBy === 'price') {
      sort.price = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'rating') {
      sort['rating.average'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'popularity') {
      sort.popularity = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const menuItems = await MenuItem.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await MenuItem.countDocuments(query);

    res.json({
      success: true,
      data: menuItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items'
    });
  }
});

// Get menu item by ID
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem
    });

  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu item'
    });
  }
});

// Create new menu item
router.post('/', async (req, res) => {
  try {
    // Validate input
    const { error, value } = menuItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    // Check if item with same name already exists
    const existingItem = await MenuItem.findOne({ name: value.name });
    if (existingItem) {
      return res.status(409).json({
        success: false,
        error: 'Menu item with this name already exists'
      });
    }

    const menuItem = new MenuItem(value);
    await menuItem.save();

    res.status(201).json({
      success: true,
      data: menuItem,
      message: 'Menu item created successfully'
    });

  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create menu item'
    });
  }
});

// Update menu item
router.put('/:id', async (req, res) => {
  try {
    // Validate input
    const { error, value } = updateMenuItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    // Check if name is being changed and if it conflicts
    if (value.name) {
      const existingItem = await MenuItem.findOne({ 
        name: value.name, 
        _id: { $ne: req.params.id } 
      });
      if (existingItem) {
        return res.status(409).json({
          success: false,
          error: 'Menu item with this name already exists'
        });
      }
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem,
      message: 'Menu item updated successfully'
    });

  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update menu item'
    });
  }
});

// Delete menu item
router.delete('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete menu item'
    });
  }
});

// Get menu categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await MenuItem.distinct('category');
    const subcategories = await MenuItem.distinct('subcategory');
    
    res.json({
      success: true,
      data: {
        categories: categories.filter(Boolean),
        subcategories: subcategories.filter(Boolean)
      }
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// Get menu items by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { availability = 'available' } = req.query;

    const query = { category, availability };
    const menuItems = await MenuItem.find(query).sort('name');

    res.json({
      success: true,
      data: menuItems,
      count: menuItems.length
    });

  } catch (error) {
    console.error('Error fetching menu items by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu items by category'
    });
  }
});

// Search menu items
router.get('/search/query', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const searchQuery = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { 'ingredients.name': { $regex: q, $options: 'i' } }
      ],
      availability: 'available'
    };

    const results = await MenuItem.find(searchQuery)
      .limit(parseInt(limit))
      .sort({ 'rating.average': -1, popularity: -1 });

    res.json({
      success: true,
      data: results,
      query: q,
      count: results.length
    });

  } catch (error) {
    console.error('Error searching menu items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search menu items'
    });
  }
});

// Update menu item availability
router.patch('/:id/availability', async (req, res) => {
  try {
    const { availability } = req.body;
    
    if (!['available', 'limited', 'unavailable'].includes(availability)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid availability status'
      });
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { availability },
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem,
      message: 'Availability updated successfully'
    });

  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability'
    });
  }
});

// Toggle special status
router.patch('/:id/special', async (req, res) => {
  try {
    const { isSpecial, specialDescription } = req.body;
    
    const updateData = { isSpecial };
    if (specialDescription !== undefined) {
      updateData.specialDescription = specialDescription;
    }

    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    res.json({
      success: true,
      data: menuItem,
      message: 'Special status updated successfully'
    });

  } catch (error) {
    console.error('Error updating special status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update special status'
    });
  }
});

// Rate a menu item
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: 'Menu item not found'
      });
    }

    await menuItem.updateRating(rating);

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      newRating: menuItem.rating
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

module.exports = router;
