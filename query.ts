import { connectToMongo, closeMongo, findData, aggregateData } from "./mongodb.js";
import { COLLECTIONS } from "./schemas.js";
import chalk from "chalk";

/**
 * MongoDB Query Utility
 * 
 * This utility provides common queries for analyzing the scraped data.
 * Run this file to see statistics and insights from your collected data.
 */
async function runQueries() {
  try {
    // Connect to MongoDB
    await connectToMongo();
    console.log(chalk.blue("🔌 Connected to MongoDB"));

    // 1. Get total counts for each collection
    console.log(chalk.yellow("\n📊 Collection Counts:"));
    for (const [name, collection] of Object.entries(COLLECTIONS)) {
      const count = (await findData(collection)).length;
      console.log(`${chalk.green(name)}: ${count} documents`);
    }

    // 2. Products by category
    console.log(chalk.yellow("\n📊 Products by Category:"));
    const productsByCategory = await aggregateData<{ _id: string | null; count: number }>(
      COLLECTIONS.PRODUCTS,
      [
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]
    );
    console.table(
      productsByCategory.map(item => ({
        Category: item._id || "Unknown",
        Count: item.count
      }))
    );

    // 3. Price range analysis
    console.log(chalk.yellow("\n📊 Price Range Analysis:"));
    const priceRangeAnalysis = await aggregateData<{ 
      _id: null;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
    }>(
      COLLECTIONS.PRODUCTS,
      [
        {
          $addFields: {
            numericPrice: {
              $toDouble: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: "$price",
                      find: "$",
                      replacement: ""
                    }
                  },
                  find: ",",
                  replacement: ""
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: "$numericPrice" },
            minPrice: { $min: "$numericPrice" },
            maxPrice: { $max: "$numericPrice" }
          }
        }
      ]
    );
    
    if (priceRangeAnalysis.length > 0) {
      const { avgPrice, minPrice, maxPrice } = priceRangeAnalysis[0];
      console.log(`Average Price: $${avgPrice.toFixed(2)}`);
      console.log(`Minimum Price: $${minPrice.toFixed(2)}`);
      console.log(`Maximum Price: $${maxPrice.toFixed(2)}`);
    }

    // 4. Top rated products
    console.log(chalk.yellow("\n📊 Top Rated Products:"));
    const topRatedProducts = await findData(
      COLLECTIONS.PRODUCTS,
      { rating: { $gte: 4 } }
    );
    
    if (topRatedProducts.length > 0) {
      console.table(
        topRatedProducts.map((product: any) => ({
          Name: product.name,
          Price: product.price,
          Rating: product.rating,
          Category: product.category || "Unknown"
        }))
      );
    } else {
      console.log("No highly rated products found");
    }

    // 5. Products with most reviews
    console.log(chalk.yellow("\n📊 Products with Most Reviews:"));
    const productsWithMostReviews = await findData(
      COLLECTIONS.PRODUCTS,
      { reviewCount: { $exists: true } }
    );
    
    if (productsWithMostReviews.length > 0) {
      console.table(
        productsWithMostReviews
          .sort((a: any, b: any) => (b.reviewCount || 0) - (a.reviewCount || 0))
          .slice(0, 10)
          .map((product: any) => ({
            Name: product.name,
            Reviews: product.reviewCount || 0,
            Rating: product.rating || "N/A"
          }))
      );
    } else {
      console.log("No products with review counts found");
    }

    console.log(chalk.green("\n✅ Queries completed successfully!"));
  } catch (error) {
    console.error(chalk.red("❌ Error running queries:"), error);
  } finally {
    // Close MongoDB connection
    await closeMongo();
  }
}

// Run the queries if this file is executed directly
if (require.main === module) {
  runQueries();
}

export { runQueries }; 