const express = require('express');
const app = express();

// Simple test server to verify basic functionality
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({
    message: '✅ Restaurant AI Server is working!',
    timestamp: new Date().toISOString(),
    features: [
      'Menu Management',
      'AI-Powered Recommendations',
      'Order Management',
      'Business Analytics',
      'Customer Insights'
    ]
  });
});

app.post('/test-ai', (req, res) => {
  const { preferences } = req.body;
  
  // Mock AI response
  const mockRecommendations = [
    {
      name: "Grilled Salmon",
      description: "Fresh Atlantic salmon grilled to perfection",
      price: 24.99,
      category: "main",
      dietary: { vegetarian: false, glutenFree: true }
    },
    {
      name: "Vegetarian Pasta",
      description: "Al dente pasta with seasonal vegetables",
      price: 18.99,
      category: "main",
      dietary: { vegetarian: true, vegan: true }
    }
  ];

  res.json({
    success: true,
    recommendations: mockRecommendations,
    preferences: preferences,
    message: "Mock AI recommendations generated successfully"
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🤖 AI test endpoint: http://localhost:${PORT}/test-ai`);
  console.log(`\n📋 Test with cURL:`);
  console.log(`   curl http://localhost:${PORT}/test`);
  console.log(`   curl -X POST http://localhost:${PORT}/test-ai -H "Content-Type: application/json" -d '{"preferences":{"vegetarian":true}}'`);
});
