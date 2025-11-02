const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const Joi = require('joi');

// Validation schemas
const recommendationSchema = Joi.object({
  dietary: Joi.object({
    vegetarian: Joi.boolean(),
    vegan: Joi.boolean(),
    glutenFree: Joi.boolean(),
    dairyFree: Joi.boolean()
  }),
  allergies: Joi.array().items(Joi.string().valid('gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'soy', 'fish', 'wheat')),
  spiceLevel: Joi.string().valid('mild', 'medium', 'hot', 'extra-hot'),
  priceRange: Joi.object({
    min: Joi.number().min(0).max(1000),
    max: Joi.number().min(0).max(1000)
  }),
  category: Joi.string().valid('appetizer', 'main', 'dessert', 'beverage', 'side', 'salad', 'soup'),
  ingredients: Joi.array().items(Joi.string().trim())
});

const questionSchema = Joi.object({
  question: Joi.string().required().trim().min(5).max(500),
  context: Joi.object({
    category: Joi.string(),
    ingredients: Joi.array().items(Joi.string()),
    priceRange: Joi.object({
      min: Joi.number(),
      max: Joi.number()
    })
  })
});

const personalizedSchema = Joi.object({
  dietaryRestrictions: Joi.array().items(Joi.string().valid('vegetarian', 'vegan', 'gluten-free', 'dairy-free')),
  favoriteIngredients: Joi.array().items(Joi.string().trim()),
  dislikedIngredients: Joi.array().items(Joi.string().trim()),
  preferredCategories: Joi.array().items(Joi.string().valid('appetizer', 'main', 'dessert', 'beverage', 'side', 'salad', 'soup')),
  budget: Joi.object({
    min: Joi.number().min(0),
    max: Joi.number().min(0)
  })
});

// Get AI-powered menu recommendations
router.post('/recommendations', async (req, res) => {
  try {
    // Validate input
    const { error, value } = recommendationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    // Set default values
    const preferences = {
      dietary: value.dietary || {},
      allergies: value.allergies || [],
      spiceLevel: value.spiceLevel || 'medium',
      priceRange: value.priceRange || { min: 0, max: 100 },
      category: value.category || null,
      ingredients: value.ingredients || []
    };

    // Get customer history if provided
    const customerHistory = req.body.customerHistory || [];

    const result = await aiService.getRecommendations(preferences, customerHistory);

    if (result.success) {
      res.json({
        success: true,
        data: {
          recommendations: result.recommendations,
          count: result.count,
          preferences: result.preferences
        },
        message: `Found ${result.count} recommendations based on your preferences`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI recommendations'
    });
  }
});

// Get daily specials with AI-enhanced descriptions
router.get('/specials', async (req, res) => {
  try {
    const result = await aiService.getDailySpecials();

    if (result.success) {
      res.json({
        success: true,
        data: {
          specials: result.specials,
          count: result.count
        },
        message: result.message || `Found ${result.count} specials today`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error getting daily specials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get daily specials'
    });
  }
});

// Ask AI assistant a question about the menu
router.post('/ask', async (req, res) => {
  try {
    // Validate input
    const { error, value } = questionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const result = await aiService.answerQuestion(value.question, value.context);

    if (result.success) {
      res.json({
        success: true,
        data: {
          answer: result.answer,
          source: result.source
        },
        question: value.question
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.answer
      });
    }

  } catch (error) {
    console.error('Error asking AI question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process your question'
    });
  }
});

// Get personalized menu suggestions
router.post('/personalized', async (req, res) => {
  try {
    // Validate input
    const { error, value } = personalizedSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    // Set default values
    const customerProfile = {
      dietaryRestrictions: value.dietaryRestrictions || [],
      favoriteIngredients: value.favoriteIngredients || [],
      dislikedIngredients: value.dislikedIngredients || [],
      preferredCategories: value.preferredCategories || [],
      budget: value.budget || { min: 0, max: 100 }
    };

    const result = await aiService.getPersonalizedSuggestions(customerProfile);

    if (result.success) {
      res.json({
        success: true,
        data: {
          suggestions: result.suggestions,
          count: result.suggestions.length,
          customerProfile: result.customerProfile
        },
        message: `Found ${result.suggestions.length} personalized suggestions for you`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error getting personalized suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get personalized suggestions'
    });
  }
});

// Get ingredient-based recommendations
router.post('/ingredients', async (req, res) => {
  try {
    const { ingredients, exclude = false } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ingredients array is required'
      });
    }

    // Build query based on ingredients
    let query = { availability: 'available' };
    
    if (exclude) {
      // Find items that don't contain these ingredients
      query['ingredients.name'] = { $nin: ingredients.map(i => new RegExp(i, 'i')) };
    } else {
      // Find items that contain these ingredients
      query['ingredients.name'] = { $in: ingredients.map(i => new RegExp(i, 'i')) };
    }

    const MenuItem = require('../models/Menu');
    const results = await MenuItem.find(query)
      .sort({ 'rating.average': -1, popularity: -1 })
      .limit(15);

    res.json({
      success: true,
      data: {
        items: results,
        count: results.length,
        ingredients: ingredients,
        exclude: exclude
      },
      message: `Found ${results.length} items ${exclude ? 'without' : 'with'} the specified ingredients`
    });

  } catch (error) {
    console.error('Error getting ingredient-based recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ingredient-based recommendations'
    });
  }
});

// Get dietary preference recommendations
router.post('/dietary', async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Dietary preferences object is required'
      });
    }

    // Build query based on dietary preferences
    let query = { availability: 'available' };
    
    if (preferences.vegetarian) query['dietary.vegetarian'] = true;
    if (preferences.vegan) query['dietary.vegan'] = true;
    if (preferences.glutenFree) query['dietary.glutenFree'] = true;
    if (preferences.dairyFree) query['dietary.dairyFree'] = true;
    if (preferences.spicy !== undefined) query['dietary.spicy'] = preferences.spicy;

    const MenuItem = require('../models/Menu');
    const results = await MenuItem.find(query)
      .sort({ 'rating.average': -1, popularity: -1 })
      .limit(20);

    res.json({
      success: true,
      data: {
        items: results,
        count: results.length,
        preferences: preferences
      },
      message: `Found ${results.length} items matching your dietary preferences`
    });

  } catch (error) {
    console.error('Error getting dietary recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dietary recommendations'
    });
  }
});

// Get price-based recommendations
router.post('/price-range', async (req, res) => {
  try {
    const { minPrice = 0, maxPrice = 100, sortBy = 'price' } = req.body;
    
    if (minPrice < 0 || maxPrice < 0 || minPrice > maxPrice) {
      return res.status(400).json({
        success: false,
        error: 'Invalid price range'
      });
    }

    const MenuItem = require('../models/Menu');
    let sort = {};
    
    if (sortBy === 'price') {
      sort.price = 1;
    } else if (sortBy === 'rating') {
      sort['rating.average'] = -1;
    } else if (sortBy === 'popularity') {
      sort.popularity = -1;
    } else {
      sort.name = 1;
    }

    const results = await MenuItem.find({
      price: { $gte: minPrice, $lte: maxPrice },
      availability: 'available'
    })
    .sort(sort)
    .limit(25);

    res.json({
      success: true,
      data: {
        items: results,
        count: results.length,
        priceRange: { min: minPrice, max: maxPrice },
        sortBy: sortBy
      },
      message: `Found ${results.length} items in your price range`
    });

  } catch (error) {
    console.error('Error getting price-based recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get price-based recommendations'
    });
  }
});

// Get combination recommendations (multiple criteria)
router.post('/combination', async (req, res) => {
  try {
    const { 
      category,
      dietary,
      priceRange,
      ingredients,
      excludeIngredients,
      limit = 15
    } = req.body;

    // Build comprehensive query
    let query = { availability: 'available' };
    
    if (category) query.category = category;
    if (dietary) {
      if (dietary.vegetarian) query['dietary.vegetarian'] = true;
      if (dietary.vegan) query['dietary.vegan'] = true;
      if (dietary.glutenFree) query['dietary.glutenFree'] = true;
      if (dietary.dairyFree) query['dietary.dairyFree'] = true;
      if (dietary.spicy !== undefined) query['dietary.spicy'] = dietary.spicy;
    }
    if (priceRange) {
      query.price = { $gte: priceRange.min || 0, $lte: priceRange.max || 1000 };
    }
    if (ingredients && ingredients.length > 0) {
      query['ingredients.name'] = { $in: ingredients.map(i => new RegExp(i, 'i')) };
    }
    if (excludeIngredients && excludeIngredients.length > 0) {
      query['ingredients.name'] = { $nin: excludeIngredients.map(i => new RegExp(i, 'i')) };
    }

    const MenuItem = require('../models/Menu');
    const results = await MenuItem.find(query)
      .sort({ 'rating.average': -1, popularity: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        items: results,
        count: results.length,
        criteria: {
          category,
          dietary,
          priceRange,
          ingredients,
          excludeIngredients
        }
      },
      message: `Found ${results.length} items matching your combination criteria`
    });

  } catch (error) {
    console.error('Error getting combination recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get combination recommendations'
    });
  }
});

// Get trending/popular items
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10, timeframe = 'week' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (timeframe === 'day') {
      dateFilter = { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
    } else if (timeframe === 'week') {
      dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
    } else if (timeframe === 'month') {
      dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
    }

    const MenuItem = require('../models/Menu');
    const results = await MenuItem.find({
      availability: 'available',
      ...dateFilter
    })
    .sort({ popularity: -1, 'rating.average': -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        items: results,
        count: results.length,
        timeframe: timeframe
      },
      message: `Top ${results.length} trending items this ${timeframe}`
    });

  } catch (error) {
    console.error('Error getting trending items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending items'
    });
  }
});

// Health check for AI service
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    res.json({
      success: true,
      status: 'operational',
      aiService: hasApiKey ? 'available' : 'unavailable',
      model: process.env.AI_MODEL_NAME || 'gpt-3.5-turbo',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;
