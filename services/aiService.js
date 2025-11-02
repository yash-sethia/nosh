const axios = require('axios');
const MenuItem = require('../models/Menu');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.modelName = process.env.AI_MODEL_NAME || 'gpt-3.5-turbo';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  // Get AI-powered menu recommendations based on preferences
  async getRecommendations(preferences, customerHistory = []) {
    try {
      const {
        dietary = {},
        allergies = [],
        spiceLevel = 'medium',
        priceRange = { min: 0, max: 100 },
        category = null,
        ingredients = []
      } = preferences;

      // Build query based on preferences
      let query = { availability: 'available' };
      
      // Apply dietary restrictions
      if (dietary.vegetarian) query['dietary.vegetarian'] = true;
      if (dietary.vegan) query['dietary.vegan'] = true;
      if (dietary.glutenFree) query['dietary.glutenFree'] = true;
      if (dietary.dairyFree) query['dietary.dairyFree'] = true;
      
      // Apply price range
      query.price = { $gte: priceRange.min, $lte: priceRange.max };
      
      // Apply category filter
      if (category) query.category = category;
      
      // Apply spice level
      if (spiceLevel === 'mild') query['dietary.spicy'] = false;
      else if (spiceLevel === 'hot' || spiceLevel === 'extra-hot') query['dietary.spicy'] = true;
      
      // Exclude items with allergens
      if (allergies.length > 0) {
        query['ingredients.allergens'] = { $nin: allergies };
      }
      
      // Include items with preferred ingredients
      if (ingredients.length > 0) {
        query['ingredients.name'] = { $in: ingredients.map(i => new RegExp(i, 'i')) };
      }

      let recommendations = await MenuItem.find(query)
        .sort({ rating: -1, popularity: -1 })
        .limit(10);

      // If no exact matches, try more flexible search
      if (recommendations.length === 0) {
        query = { availability: 'available' };
        if (dietary.vegetarian || dietary.vegan) {
          query['dietary.vegetarian'] = true;
        }
        recommendations = await MenuItem.find(query)
          .sort({ rating: -1, popularity: -1 })
          .limit(10);
      }

      // Apply AI ranking based on customer history
      if (customerHistory.length > 0) {
        recommendations = await this.rankByAI(recommendations, customerHistory);
      }

      return {
        success: true,
        recommendations,
        count: recommendations.length,
        preferences: preferences
      };

    } catch (error) {
      console.error('Error getting recommendations:', error);
      return {
        success: false,
        error: 'Failed to get recommendations',
        recommendations: []
      };
    }
  }

  // AI-powered ranking of recommendations
  async rankByAI(items, customerHistory) {
    try {
      // Analyze customer history for patterns
      const historyAnalysis = this.analyzeCustomerHistory(customerHistory);
      
      // Score items based on AI analysis
      const scoredItems = items.map(item => {
        let score = 0;
        
        // Base score from rating and popularity
        score += (item.rating.average * 0.4) + (item.popularity * 0.1);
        
        // Category preference score
        if (historyAnalysis.preferredCategories.includes(item.category)) {
          score += 0.3;
        }
        
        // Ingredient preference score
        const ingredientMatch = item.ingredients.filter(ing => 
          historyAnalysis.preferredIngredients.includes(ing.name.toLowerCase())
        ).length;
        score += ingredientMatch * 0.2;
        
        // Price preference score
        if (item.price >= historyAnalysis.priceRange.min && 
            item.price <= historyAnalysis.priceRange.max) {
          score += 0.2;
        }
        
        return { item, score };
      });
      
      // Sort by score and return items
      return scoredItems
        .sort((a, b) => b.score - a.score)
        .map(scored => scored.item);

    } catch (error) {
      console.error('Error in AI ranking:', error);
      return items; // Return original order if AI ranking fails
    }
  }

  // Analyze customer order history for preferences
  analyzeCustomerHistory(history) {
    const analysis = {
      preferredCategories: [],
      preferredIngredients: [],
      priceRange: { min: 0, max: 100 },
      spicePreference: 'medium'
    };

    if (history.length === 0) return analysis;

    // Analyze categories
    const categoryCount = {};
    history.forEach(order => {
      order.items.forEach(item => {
        if (item.menuItem && item.menuItem.category) {
          categoryCount[item.menuItem.category] = (categoryCount[item.menuItem.category] || 0) + 1;
        }
      });
    });

    // Get top 3 preferred categories
    analysis.preferredCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    // Analyze ingredients
    const ingredientCount = {};
    history.forEach(order => {
      order.items.forEach(item => {
        if (item.menuItem && item.menuItem.ingredients) {
          item.menuItem.ingredients.forEach(ingredient => {
            ingredientCount[ingredient.name.toLowerCase()] = (ingredientCount[ingredient.name.toLowerCase()] || 0) + 1;
          });
        }
      });
    });

    // Get top 10 preferred ingredients
    analysis.preferredIngredients = Object.entries(ingredientCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([ingredient]) => ingredient);

    // Analyze price range
    const prices = history.flatMap(order => 
      order.items.map(item => item.price)
    );
    if (prices.length > 0) {
      analysis.priceRange.min = Math.min(...prices) * 0.8;
      analysis.priceRange.max = Math.max(...prices) * 1.2;
    }

    return analysis;
  }

  // Get daily specials with AI-enhanced descriptions
  async getDailySpecials() {
    try {
      const specials = await MenuItem.findSpecials();
      
      if (specials.length === 0) {
        return {
          success: true,
          specials: [],
          message: 'No specials available today'
        };
      }

      // Enhance special descriptions with AI
      const enhancedSpecials = await Promise.all(
        specials.map(async (special) => {
          try {
            const enhancedDescription = await this.enhanceDescription(
              special.description,
              special.ingredients.map(i => i.name)
            );
            
            return {
              ...special.toObject(),
              enhancedDescription: enhancedDescription || special.description
            };
          } catch (error) {
            return special;
          }
        })
      );

      return {
        success: true,
        specials: enhancedSpecials,
        count: enhancedSpecials.length
      };

    } catch (error) {
      console.error('Error getting daily specials:', error);
      return {
        success: false,
        error: 'Failed to get daily specials',
        specials: []
      };
    }
  }

  // AI-enhanced description generation
  async enhanceDescription(originalDescription, ingredients) {
    try {
      if (!this.apiKey) {
        return originalDescription; // Return original if no API key
      }

      const prompt = `Enhance this restaurant dish description to make it more appealing: "${originalDescription}". 
      Use these ingredients: ${ingredients.join(', ')}. 
      Make it sound delicious and highlight the key features. Keep it under 100 words.`;

      const response = await axios.post(
        this.baseUrl,
        {
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that enhances restaurant menu descriptions to make them more appealing and appetizing while keeping them accurate and concise.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        const enhanced = response.data.choices[0].message.content.trim();
        return enhanced || originalDescription;
      }

      return originalDescription;

    } catch (error) {
      console.error('Error enhancing description:', error.response?.data || error.message);
      return originalDescription;
    }
  }

  // Answer customer questions about menu items
  async answerQuestion(question, context = {}) {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          answer: 'AI service is not available. Please contact staff for assistance.',
          source: 'fallback'
        };
      }

      // Get relevant menu context
      const menuContext = await this.getMenuContext(context);
      
      const systemPrompt = `You are a helpful restaurant AI assistant. Your role is to answer customer questions about the menu items, ingredients, dietary restrictions, and recommendations. Be friendly, professional, and accurate. Use the menu context provided to give specific and helpful answers.`;

      const userPrompt = `Customer question: "${question}"
      
      Menu context: ${menuContext || 'General menu information'}
      
      Please provide a helpful, accurate answer based on the menu information. Be friendly and professional.`;

      const response = await axios.post(
        this.baseUrl,
        {
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        const answer = response.data.choices[0].message.content.trim();
        
        return {
          success: true,
          answer: answer || 'I apologize, but I couldn\'t generate a response. Please ask our staff for assistance.',
          source: 'ai'
        };
      }

      return {
        success: false,
        answer: 'I apologize, but I couldn\'t process your question. Please ask our staff for assistance.',
        source: 'fallback'
      };

    } catch (error) {
      console.error('Error answering question:', error.response?.data || error.message);
      return {
        success: false,
        answer: 'I apologize, but I\'m experiencing technical difficulties. Please ask our staff for assistance.',
        source: 'fallback'
      };
    }
  }

  // Get relevant menu context for AI responses
  async getMenuContext(context) {
    try {
      let contextInfo = [];
      
      if (context.category) {
        const categoryItems = await MenuItem.find({ 
          category: context.category, 
          availability: 'available' 
        }).limit(5);
        contextInfo.push(`Category: ${context.category} - ${categoryItems.map(item => item.name).join(', ')}`);
      }
      
      if (context.ingredients && context.ingredients.length > 0) {
        const ingredientItems = await MenuItem.find({
          'ingredients.name': { $in: context.ingredients.map(i => new RegExp(i, 'i')) },
          availability: 'available'
        }).limit(5);
        contextInfo.push(`Ingredients: ${context.ingredients.join(', ')} - ${ingredientItems.map(item => item.name).join(', ')}`);
      }
      
      if (context.priceRange) {
        const priceItems = await MenuItem.find({
          price: { $gte: context.priceRange.min, $lte: context.priceRange.max },
          availability: 'available'
        }).limit(5);
        contextInfo.push(`Price range: $${context.priceRange.min}-$${context.priceRange.max} - ${priceItems.map(item => item.name).join(', ')}`);
      }
      
      return contextInfo.join('\n');
      
    } catch (error) {
      console.error('Error getting menu context:', error);
      return 'Menu information is currently unavailable.';
    }
  }

  // Get personalized menu suggestions
  async getPersonalizedSuggestions(customerProfile) {
    try {
      const {
        dietaryRestrictions = [],
        favoriteIngredients = [],
        dislikedIngredients = [],
        preferredCategories = [],
        budget = { min: 0, max: 100 }
      } = customerProfile;

      let query = { availability: 'available' };
      
      // Apply dietary restrictions
      if (dietaryRestrictions.includes('vegetarian')) query['dietary.vegetarian'] = true;
      if (dietaryRestrictions.includes('vegan')) query['dietary.vegan'] = true;
      if (dietaryRestrictions.includes('gluten-free')) query['dietary.glutenFree'] = true;
      if (dietaryRestrictions.includes('dairy-free')) query['dietary.dairyFree'] = true;
      
      // Apply budget
      query.price = { $gte: budget.min, $lte: budget.max };
      
      // Apply category preferences
      if (preferredCategories.length > 0) {
        query.category = { $in: preferredCategories };
      }
      
      // Exclude disliked ingredients
      if (dislikedIngredients.length > 0) {
        query['ingredients.name'] = { $nin: dislikedIngredients.map(i => new RegExp(i, 'i')) };
      }

      let suggestions = await MenuItem.find(query)
        .sort({ rating: -1, popularity: -1 })
        .limit(15);

      // Boost items with favorite ingredients
      if (favoriteIngredients.length > 0) {
        suggestions = suggestions.map(item => {
          const favoriteMatches = item.ingredients.filter(ing => 
            favoriteIngredients.some(fav => 
              ing.name.toLowerCase().includes(fav.toLowerCase())
            )
          ).length;
          
          return {
            item,
            score: item.rating.average + (favoriteMatches * 0.5)
          };
        });
        
        suggestions.sort((a, b) => b.score - a.score);
        suggestions = suggestions.map(s => s.item);
      }

      return {
        success: true,
        suggestions: suggestions.slice(0, 10),
        count: suggestions.length,
        customerProfile
      };

    } catch (error) {
      console.error('Error getting personalized suggestions:', error);
      return {
        success: false,
        error: 'Failed to get personalized suggestions',
        suggestions: []
      };
    }
  }
}

module.exports = new AIService();
