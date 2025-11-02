# 🍽️ Restaurant AI Server

A comprehensive, AI-powered backend server for restaurant management that provides intelligent menu recommendations, order management, and business analytics.

## ✨ Features

### 🤖 AI-Powered Services
- **Smart Menu Recommendations**: AI-driven suggestions based on dietary preferences, allergies, and customer history
- **Daily Specials**: AI-enhanced descriptions for promotional items
- **Customer Q&A**: Intelligent responses to menu-related questions
- **Personalized Suggestions**: Tailored recommendations based on customer profiles
- **Ingredient Analysis**: Find dishes based on preferred or excluded ingredients

### 📋 Menu Management
- **Comprehensive Menu Items**: Detailed information including ingredients, allergens, nutritional info
- **Dietary Filters**: Vegetarian, vegan, gluten-free, dairy-free options
- **Category Management**: Organized by appetizers, mains, desserts, beverages, sides, salads, soups
- **Availability Control**: Real-time status updates (available, limited, unavailable)
- **Rating System**: Customer feedback and popularity tracking

### 🛒 Order Management
- **Multi-format Orders**: Dine-in, takeaway, and delivery support
- **Status Tracking**: Complete order lifecycle management
- **Customer Profiles**: Dietary preferences, allergies, and spice level preferences
- **Order Modifications**: Add/remove items, special instructions, customizations
- **Payment Processing**: Multiple payment methods and status tracking

### 📊 Business Analytics
- **Sales Analytics**: Revenue tracking, order volume, and performance metrics
- **Popular Items**: Trending dishes and category performance
- **Customer Insights**: Behavior analysis, segmentation, and lifetime value
- **Operational Metrics**: Fulfillment times, peak hours, and efficiency data
- **Real-time Dashboard**: Live updates on current operations

## 🚀 Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **AI Service**: OpenAI ChatGPT API (GPT-3.5-turbo or GPT-4)
- **Validation**: Joi for request validation
- **Security**: Helmet for security headers
- **Logging**: Morgan for HTTP request logging
- **Scheduling**: Node-cron for automated tasks

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or cloud service)
- OpenAI API key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd restaurant-ai-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/restaurant-ai
   OPENAI_API_KEY=your_openai_api_key_here
   AI_MODEL_NAME=gpt-3.5-turbo
   ```

4. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas (cloud service)
   ```

5. **Seed the database with sample data**
   ```bash
   node utils/seedData.js
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔑 Getting OpenAI API Key

1. Visit [OpenAI](https://platform.openai.com/)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new secret key
5. Copy the key to your `.env` file as `OPENAI_API_KEY`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Health Check
```
GET /health
```

### Menu Endpoints

#### Get All Menu Items
```
GET /menu?page=1&limit=20&category=main&dietary=vegetarian
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `category`: Filter by category
- `dietary`: Filter by dietary preferences
- `search`: Search in names, descriptions, tags
- `minPrice`/`maxPrice`: Price range filter
- `sortBy`: Sort field (name, price, rating, popularity)
- `sortOrder`: asc/desc

#### Get Menu Item by ID
```
GET /menu/:id
```

#### Create Menu Item
```
POST /menu
Content-Type: application/json

{
  "name": "Grilled Salmon",
  "description": "Fresh Atlantic salmon grilled to perfection",
  "category": "main",
  "price": 24.99,
  "ingredients": [...],
  "dietary": {
    "vegetarian": false,
    "glutenFree": true
  }
}
```

#### Update Menu Item
```
PUT /menu/:id
```

#### Delete Menu Item
```
DELETE /menu/:id
```

#### Search Menu Items
```
GET /menu/search/query?q=salmon&limit=10
```

### AI Endpoints

#### Get AI Recommendations
```
POST /ai/recommendations
Content-Type: application/json

{
  "dietary": {
    "vegetarian": true,
    "glutenFree": true
  },
  "allergies": ["nuts", "shellfish"],
  "spiceLevel": "mild",
  "priceRange": {
    "min": 10,
    "max": 30
  }
}
```

#### Get Daily Specials
```
GET /ai/specials
```

#### Ask AI Question
```
POST /ai/ask
Content-Type: application/json

{
  "question": "What vegetarian options do you have?",
  "context": {
    "category": "main",
    "priceRange": { "min": 15, "max": 25 }
  }
}
```

#### Get Personalized Suggestions
```
POST /ai/personalized
Content-Type: application/json

{
  "dietaryRestrictions": ["vegetarian", "gluten-free"],
  "favoriteIngredients": ["avocado", "quinoa"],
  "budget": { "min": 10, "max": 30 }
}
```

### Order Endpoints

#### Create Order
```
POST /orders
Content-Type: application/json

{
  "customer": {
    "name": "John Doe",
    "phone": "+1234567890",
    "preferences": {
      "dietary": { "vegetarian": false },
      "spiceLevel": "medium"
    }
  },
  "items": [
    {
      "menuItemId": "menu_item_id_here",
      "quantity": 2,
      "specialInstructions": "Extra crispy"
    }
  ],
  "orderType": "dine-in",
  "tableNumber": 5
}
```

#### Get Orders
```
GET /orders?status=pending&orderType=dine-in&page=1&limit=20
```

#### Update Order Status
```
PATCH /orders/:id/status
Content-Type: application/json

{
  "status": "preparing",
  "notes": "Chef started preparation"
}
```

#### Get Order by Number
```
GET /orders/number/ORD241201001
```

### Analytics Endpoints

#### Sales Analytics
```
GET /analytics/sales?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
```

#### Popular Items
```
GET /analytics/popular-items?limit=20&includeTrends=true
```

#### Customer Insights
```
GET /analytics/customer-insights?startDate=2024-01-01&endDate=2024-01-31
```

#### Real-time Dashboard
```
GET /analytics/dashboard
```

## 🧪 Testing the API

### Using cURL

1. **Get all menu items**
   ```bash
   curl http://localhost:3000/api/menu
   ```

2. **Get AI recommendations**
   ```bash
   curl -X POST http://localhost:3000/api/ai/recommendations \
     -H "Content-Type: application/json" \
     -d '{"dietary":{"vegetarian":true},"priceRange":{"min":10,"max":25}}'
   ```

3. **Create an order**
   ```bash
   curl -X POST http://localhost:3000/api/orders \
     -H "Content-Type: application/json" \
     -d '{"customer":{"name":"Test User","phone":"+1234567890"},"items":[{"menuItemId":"menu_id_here","quantity":1}],"orderType":"takeaway"}'
   ```

### Using Postman

Import the following collection structure:
- **Menu**: GET, POST, PUT, DELETE operations
- **AI**: POST requests for recommendations and questions
- **Orders**: Full CRUD operations
- **Analytics**: GET requests for various reports

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/restaurant-ai |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `AI_MODEL_NAME` | AI model to use | gpt-3.5-turbo |
| `JWT_SECRET` | JWT secret for authentication | - |
| `RATE_LIMIT_WINDOW_MS` | Rate limiting window | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

### AI Model Options

The server supports various OpenAI models:
- `gpt-3.5-turbo` (default) - Fast and cost-effective, good for most use cases
- `gpt-4` - More advanced, better understanding and responses
- `gpt-4-turbo` - Latest GPT-4 variant with improved performance

## 📊 Database Schema

### Menu Items
- Basic info (name, description, price, category)
- Ingredients with allergens and nutritional info
- Dietary restrictions and tags
- Availability and special status
- Ratings and popularity metrics

### Orders
- Customer information and preferences
- Order items with quantities and customizations
- Status tracking and timestamps
- Payment and delivery details

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input Validation**: Joi schema validation
- **Rate Limiting**: Request throttling
- **Error Handling**: Secure error responses

## 📈 Performance Features

- **Database Indexing**: Optimized queries
- **Caching**: Analytics data caching
- **Pagination**: Efficient data retrieval
- **Aggregation**: MongoDB aggregation pipelines

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the API documentation
2. Review the error logs
3. Create an issue in the repository
4. Contact the development team

## 🔮 Future Enhancements

- **Real-time Notifications**: WebSocket support for live updates
- **Mobile App Integration**: Native mobile app APIs
- **Payment Gateway**: Stripe/PayPal integration
- **Inventory Management**: Stock tracking and alerts
- **Customer Loyalty**: Points and rewards system
- **Multi-language Support**: Internationalization
- **Advanced Analytics**: Machine learning insights
- **Integration APIs**: Third-party service connections

---

**Built with ❤️ for the restaurant industry**
