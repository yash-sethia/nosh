const mongoose = require('mongoose');
const MenuItem = require('../models/Menu');
require('dotenv').config();

// Sample menu data
const sampleMenuItems = [
  // Appetizers
  {
    name: "Bruschetta",
    description: "Toasted bread topped with fresh tomatoes, basil, and mozzarella",
    category: "appetizer",
    subcategory: "cold",
    price: 8.99,
    ingredients: [
      {
        name: "Bread",
        category: "grain",
        allergens: ["gluten", "wheat"]
      },
      {
        name: "Tomatoes",
        category: "vegetable"
      },
      {
        name: "Basil",
        category: "spice"
      },
      {
        name: "Mozzarella",
        category: "dairy",
        allergens: ["dairy"]
      },
      {
        name: "Olive Oil",
        category: "other"
      }
    ],
    tags: ["italian", "vegetarian", "fresh"],
    dietary: {
      vegetarian: true,
      vegan: false,
      glutenFree: false,
      dairyFree: false,
      spicy: false
    },
    availability: "available",
    preparationTime: 10,
    isSpecial: false
  },
  {
    name: "Chicken Wings",
    description: "Crispy fried chicken wings with your choice of sauce",
    category: "appetizer",
    subcategory: "hot",
    price: 12.99,
    ingredients: [
      {
        name: "Chicken Wings",
        category: "meat"
      },
      {
        name: "Flour",
        category: "grain",
        allergens: ["gluten", "wheat"]
      },
      {
        name: "Hot Sauce",
        category: "spice"
      }
    ],
    tags: ["american", "spicy", "fried"],
    dietary: {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      dairyFree: true,
      spicy: true
    },
    availability: "available",
    preparationTime: 15,
    isSpecial: true,
    specialDescription: "Our signature wings - crispy on the outside, juicy on the inside!"
  },
  {
    name: "Guacamole & Chips",
    description: "Fresh guacamole made with ripe avocados, served with crispy tortilla chips",
    category: "appetizer",
    subcategory: "cold",
    price: 9.99,
    ingredients: [
      {
        name: "Avocado",
        category: "vegetable"
      },
      {
        name: "Lime",
        category: "vegetable"
      },
      {
        name: "Cilantro",
        category: "spice"
      },
      {
        name: "Tortilla Chips",
        category: "grain",
        allergens: ["gluten", "wheat"]
      }
    ],
    tags: ["mexican", "vegan", "gluten-free"],
    dietary: {
      vegetarian: true,
      vegan: true,
      glutenFree: false,
      dairyFree: true,
      spicy: false
    },
    availability: "available",
    preparationTime: 8,
    isSpecial: false
  },

  // Main Courses
  {
    name: "Grilled Salmon",
    description: "Fresh Atlantic salmon grilled to perfection with herbs and lemon",
    category: "main",
    subcategory: "seafood",
    price: 24.99,
    ingredients: [
      {
        name: "Salmon",
        category: "meat",
        allergens: ["fish"]
      },
      {
        name: "Lemon",
        category: "vegetable"
      },
      {
        name: "Herbs",
        category: "spice"
      },
      {
        name: "Olive Oil",
        category: "other"
      }
    ],
    tags: ["seafood", "healthy", "grilled"],
    dietary: {
      vegetarian: false,
      vegan: false,
      glutenFree: true,
      dairyFree: true,
      spicy: false
    },
    availability: "available",
    preparationTime: 20,
    isSpecial: false
  },
  {
    name: "Beef Burger",
    description: "Juicy beef patty with lettuce, tomato, and cheese on a brioche bun",
    category: "main",
    subcategory: "sandwich",
    price: 16.99,
    ingredients: [
      {
        name: "Beef Patty",
        category: "meat"
      },
      {
        name: "Brioche Bun",
        category: "grain",
        allergens: ["gluten", "wheat", "dairy"]
      },
      {
        name: "Lettuce",
        category: "vegetable"
      },
      {
        name: "Tomato",
        category: "vegetable"
      },
      {
        name: "Cheese",
        category: "dairy",
        allergens: ["dairy"]
      }
    ],
    tags: ["american", "classic", "juicy"],
    dietary: {
      vegetarian: false,
      vegan: false,
      glutenFree: false,
      dairyFree: false,
      spicy: false
    },
    availability: "available",
    preparationTime: 12,
    isSpecial: false
  },
  {
    name: "Vegetarian Pasta",
    description: "Al dente pasta with seasonal vegetables in a light tomato sauce",
    category: "main",
    subcategory: "pasta",
    price: 18.99,
    ingredients: [
      {
        name: "Pasta",
        category: "grain",
        allergens: ["gluten", "wheat"]
      },
      {
        name: "Tomato Sauce",
        category: "vegetable"
      },
      {
        name: "Bell Peppers",
        category: "vegetable"
      },
      {
        name: "Zucchini",
        category: "vegetable"
      },
      {
        name: "Basil",
        category: "spice"
      }
    ],
    tags: ["italian", "vegetarian", "pasta"],
    dietary: {
      vegetarian: true,
      vegan: true,
      glutenFree: false,
      dairyFree: true,
      spicy: false
    },
    availability: "available",
    preparationTime: 18,
    isSpecial: false
  },

  // Desserts
  {
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with a molten chocolate center, served with vanilla ice cream",
    category: "dessert",
    subcategory: "chocolate",
    price: 11.99,
    ingredients: [
      {
        name: "Chocolate",
        category: "other"
      },
      {
        name: "Flour",
        category: "grain",
        allergens: ["gluten", "wheat"]
      },
      {
        name: "Eggs",
        category: "other",
        allergens: ["eggs"]
      },
      {
        name: "Vanilla Ice Cream",
        category: "dairy",
        allergens: ["dairy"]
      }
    ],
    tags: ["chocolate", "warm", "indulgent"],
    dietary: {
      vegetarian: true,
      vegan: false,
      glutenFree: false,
      dairyFree: false,
      spicy: false
    },
    availability: "available",
    preparationTime: 15,
    isSpecial: true,
    specialDescription: "Our most popular dessert - pure chocolate heaven!"
  },
  {
    name: "New York Cheesecake",
    description: "Classic New York style cheesecake with a graham cracker crust",
    category: "dessert",
    subcategory: "cheesecake",
    price: 9.99,
    ingredients: [
      {
        name: "Cream Cheese",
        category: "dairy",
        allergens: ["dairy"]
      },
      {
        name: "Graham Crackers",
        category: "grain",
        allergens: ["gluten", "wheat"]
      },
      {
        name: "Sugar",
        category: "other"
      },
      {
        name: "Vanilla",
        category: "spice"
      }
    ],
    tags: ["classic", "creamy", "new-york"],
    dietary: {
      vegetarian: true,
      vegan: false,
      glutenFree: false,
      dairyFree: false,
      spicy: false
    },
    availability: "available",
    preparationTime: 5,
    isSpecial: false
  },

  // Beverages
  {
    name: "Fresh Fruit Smoothie",
    description: "Blend of seasonal fruits with yogurt and honey",
    category: "beverage",
    subcategory: "smoothie",
    price: 6.99,
    ingredients: [
      {
        name: "Mixed Berries",
        category: "vegetable"
      },
      {
        name: "Banana",
        category: "vegetable"
      },
      {
        name: "Yogurt",
        category: "dairy",
        allergens: ["dairy"]
      },
      {
        name: "Honey",
        category: "other"
      }
    ],
    tags: ["healthy", "refreshing", "fruity"],
    dietary: {
      vegetarian: true,
      vegan: false,
      glutenFree: true,
      dairyFree: false,
      spicy: false
    },
    availability: "available",
    preparationTime: 5,
    isSpecial: false
  },
  {
    name: "Iced Latte",
    description: "Espresso with cold milk and ice, perfect for hot days",
    category: "beverage",
    subcategory: "coffee",
    price: 4.99,
    ingredients: [
      {
        name: "Espresso",
        category: "other"
      },
      {
        name: "Milk",
        category: "dairy",
        allergens: ["dairy"]
      },
      {
        name: "Ice",
        category: "other"
      }
    ],
    tags: ["coffee", "cold", "refreshing"],
    dietary: {
      vegetarian: true,
      vegan: false,
      glutenFree: true,
      dairyFree: false,
      spicy: false
    },
    availability: "available",
    preparationTime: 3,
    isSpecial: false
  },

  // Sides
  {
    name: "French Fries",
    description: "Crispy golden fries seasoned with sea salt",
    category: "side",
    subcategory: "potato",
    price: 5.99,
    ingredients: [
      {
        name: "Potatoes",
        category: "vegetable"
      },
      {
        name: "Vegetable Oil",
        category: "other"
      },
      {
        name: "Sea Salt",
        category: "spice"
      }
    ],
    tags: ["classic", "crispy", "potato"],
    dietary: {
      vegetarian: true,
      vegan: true,
      glutenFree: true,
      dairyFree: true,
      spicy: false
    },
    availability: "available",
    preparationTime: 8,
    isSpecial: false
  },
  {
    name: "Garden Salad",
    description: "Fresh mixed greens with cherry tomatoes, cucumber, and balsamic vinaigrette",
    category: "side",
    subcategory: "salad",
    price: 7.99,
    ingredients: [
      {
        name: "Mixed Greens",
        category: "vegetable"
      },
      {
        name: "Cherry Tomatoes",
        category: "vegetable"
      },
      {
        name: "Cucumber",
        category: "vegetable"
      },
      {
        name: "Balsamic Vinaigrette",
        category: "other"
      }
    ],
    tags: ["healthy", "fresh", "light"],
    dietary: {
      vegetarian: true,
      vegan: true,
      glutenFree: true,
      dairyFree: true,
      spicy: false
    },
    availability: "available",
    preparationTime: 6,
    isSpecial: false
  }
];

// Function to seed the database
async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-ai', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await MenuItem.deleteMany({});
    console.log('🗑️  Cleared existing menu items');

    // Insert sample data
    const insertedItems = await MenuItem.insertMany(sampleMenuItems);
    console.log(`✅ Inserted ${insertedItems.length} menu items`);

    // Display some statistics
    const categories = await MenuItem.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Menu Statistics:');
    categories.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.count} items`);
    });

    const specials = await MenuItem.countDocuments({ isSpecial: true });
    console.log(`\n⭐ Specials: ${specials} items`);

    const avgPrice = await MenuItem.aggregate([
      { $group: { _id: null, avgPrice: { $avg: '$price' } } }
    ]);
    console.log(`💰 Average Price: $${avgPrice[0]?.avgPrice.toFixed(2) || '0.00'}`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n🍽️  Sample menu items available:');
    insertedItems.slice(0, 5).forEach(item => {
      console.log(`   - ${item.name} ($${item.price})`);
    });

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Function to add more sample data
async function addMoreItems() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-ai', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const additionalItems = [
      {
        name: "Spicy Tacos",
        description: "Three soft corn tortillas filled with seasoned ground beef, lettuce, and spicy salsa",
        category: "main",
        subcategory: "mexican",
        price: 14.99,
        ingredients: [
          { name: "Corn Tortillas", category: "grain" },
          { name: "Ground Beef", category: "meat" },
          { name: "Lettuce", category: "vegetable" },
          { name: "Spicy Salsa", category: "spice" }
        ],
        tags: ["mexican", "spicy", "tacos"],
        dietary: {
          vegetarian: false,
          vegan: false,
          glutenFree: true,
          dairyFree: true,
          spicy: true
        },
        availability: "available",
        preparationTime: 12,
        isSpecial: false
      },
      {
        name: "Caesar Salad",
        description: "Romaine lettuce with Caesar dressing, croutons, and parmesan cheese",
        category: "side",
        subcategory: "salad",
        price: 10.99,
        ingredients: [
          { name: "Romaine Lettuce", category: "vegetable" },
          { name: "Caesar Dressing", category: "other" },
          { name: "Croutons", category: "grain", allergens: ["gluten", "wheat"] },
          { name: "Parmesan Cheese", category: "dairy", allergens: ["dairy"] }
        ],
        tags: ["classic", "salad", "caesar"],
        dietary: {
          vegetarian: true,
          vegan: false,
          glutenFree: false,
          dairyFree: false,
          spicy: false
        },
        availability: "available",
        preparationTime: 7,
        isSpecial: false
      }
    ];

    await MenuItem.insertMany(additionalItems);
    console.log(`✅ Added ${additionalItems.length} more menu items`);

  } catch (error) {
    console.error('❌ Error adding more items:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Export functions
module.exports = {
  seedDatabase,
  addMoreItems
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}
