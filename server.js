const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.set('view engine', 'ejs');
app.use(express.json()); // For parsing JSON bodies

// Define the MongoDB URI and connect to the database
mongoose.connect('mongodb://127.0.0.1:27017/productdb')
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

// Define the Product schema
const productSchema = new mongoose.Schema({
  id: { type: Number },
  title: { type: String },
  price: { type: Number },
  description: { type: String },
  category: { type: String },
  image: { type: String },
  sold: { type: Boolean, default: false },
  year: { type: Number },
  month: { type: String }
});

// Create a Mongoose model for products
const Product = mongoose.model('Product', productSchema);

// Helper function to convert numeric month to month name
const getMonthName = (month) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[parseInt(month) - 1]; // Convert numeric month to index
};

// Fetch product data from the external API and save to MongoDB
app.get('/initialize-db', async (req, res) => {
    try {
      // Fetch data from the external API
      const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json'); // Use the actual URL here
      console.log('Full Response:', response.data); // Log the full response to inspect data structure

      const productData = response.data;  // Assuming the response is an array of products
      console.log('Product Data:', productData);  // Log the product data to inspect fields

      // Loop through the product data array and process each product
      const productsToSave = [];
      for (let i = 0; i < productData.length && i < 60; i++) {
        const product = productData[i];

        // Check if dateOfSale exists and is in the correct format
        const dateOfSale = product.dateOfSale;
        if (!dateOfSale) {
          console.error('Invalid or missing dateOfSale for product:', product);
          continue; // Skip this product if dateOfSale is missing
        }

        // Split dateOfSale to extract year and month
        const dateParts = dateOfSale.split('-');
        const year = dateParts[0];  // First part is the year
        const month = dateParts[1]; // Second part is the month

        // Convert numeric month to month name
        const monthName = getMonthName(month);

        // Prepare the new product object
        const newProduct = new Product({
          id: product.id,
          title: product.title,
          price: product.price,
          description: product.description,
          category: product.category,
          image: product.image,
          sold: product.sold || false,
          year: parseInt(year), // Store year as an integer
          month: monthName       // Store month as a string (e.g., "January", "February")
        });

        // Add the new product to the array to be saved
        productsToSave.push(newProduct);
      }

      // Save all products at once (bulk insert)
      await Product.insertMany(productsToSave);

      res.status(200).json({ message: `${productsToSave.length} products initialized successfully` });

    } catch (error) {
      console.error('Error fetching or saving data:', error);
      res.status(500).json({ message: 'Error initializing database', error: error.message });
    }
});

app.get('/transactions', async (req, res) => {
    try {
      // Get query parameters for pagination and search
      const { page = 1, perPage = 10, search = '' } = req.query;
      const skip = (page - 1) * perPage;  // Calculate skip based on page
  
      // Construct search query for title, description, or price
      const searchQuery = search ? {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { price: { $regex: search, $options: 'i' } }
        ]
      } : {}; // If no search, return all products
  
      // Find products with search query and pagination
      const products = await Product.find(searchQuery)
        .skip(skip)
        .limit(parseInt(perPage))
        .exec();
  
      // Get the total count of matching products for pagination info
      const totalCount = await Product.countDocuments(searchQuery);
  
      // Return products along with pagination info
      res.status(200).json({
        totalCount,
        totalPages: Math.ceil(totalCount / perPage),
        currentPage: parseInt(page),
        perPage: parseInt(perPage),
        products,
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: 'Error fetching transactions', error: error.message });
    }
  });
  
  // Render the EJS page for displaying products with search and pagination
  app.get('/transactions-page', async (req, res) => {
    try {
      // Get query parameters for pagination and search
      const { page = 1, perPage = 10, search = '' } = req.query;
      const skip = (page - 1) * perPage;  // Calculate skip based on page
  
      // Construct search query for title, description, or price
      const searchQuery = search ? {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { price: { $regex: search, $options: 'i' } }
        ]
      } : {}; // If no search, return all products
  
      // Find products with search query and pagination
      const products = await Product.find(searchQuery)
        .skip(skip)
        .limit(parseInt(perPage))
        .exec();
  
      // Get the total count of matching products for pagination info
      const totalCount = await Product.countDocuments(searchQuery);
  
      // Render the EJS page with pagination and product data
      res.render('transactions', {
        products,
        totalCount,
        totalPages: Math.ceil(totalCount / perPage),
        currentPage: parseInt(page),
        perPage: parseInt(perPage),
        search,
      });
    } catch (error) {
      console.error('Error fetching transactions page:', error);
      res.status(500).send('Error fetching transactions page');
    }
  });





  // API to fetch statistics for selected month and year
  app.get('/price-range-stats', async (req, res) => {
    try {
      const { month } = req.query;
  
      if (!month) {
        // Render the form with an empty data object if month is not provided
        return res.render('price-range-stats', { data: null });
      }
  
      // Query the database for products matching the month only
      const products = await Product.find({ month: month });
  
      // Calculate counts for each price range
      const priceRanges = [
        { range: '0-100', count: products.filter(p => p.price >= 0 && p.price <= 100).length },
        { range: '101-200', count: products.filter(p => p.price >= 101 && p.price <= 200).length },
        { range: '201-300', count: products.filter(p => p.price >= 201 && p.price <= 300).length },
        { range: '301-400', count: products.filter(p => p.price >= 301 && p.price <= 400).length },
        { range: '401-500', count: products.filter(p => p.price >= 401 && p.price <= 500).length },
        { range: '501-600', count: products.filter(p => p.price >= 501 && p.price <= 600).length },
        { range: '601-700', count: products.filter(p => p.price >= 601 && p.price <= 700).length },
        { range: '701-800', count: products.filter(p => p.price >= 701 && p.price <= 800).length },
        { range: '801-900', count: products.filter(p => p.price >= 801 && p.price <= 900).length },
        { range: '901-above', count: products.filter(p => p.price >= 901).length }
      ];
  
      // Render the page with the data if month is provided
      res.render('price-range-stats', { data: { priceRanges, month } });
  
    } catch (error) {
      console.error('Error fetching price range stats:', error);
      res.status(500).send('Error fetching statistics');
    }
  });
  app.get('/category-stats', async (req, res) => {
    const { month } = req.query;
  
    let categoryStats = [];
  
    if (month) {
        try {
            // Aggregate data by category and count items for the selected month
            const stats = await Product.aggregate([
                { $match: { month } },
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]);
  
            categoryStats = stats.map(stat => ({
                category: stat._id,
                count: stat.count
            }));
        } catch (error) {
            console.error('Error fetching category stats:', error);
            return res.status(500).json({ message: 'Error fetching category stats', error: error.message });
        }
    }
  
    // Render the category stats page with category data
    res.render('category-stats', { month: month || 'Select a Month', categoryStats });
  });


  
  
  
  
  




// Start the server on a specified port
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});




