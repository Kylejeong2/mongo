import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { z } from "zod";
import { MongoClient, Db } from 'mongodb';

/**
 * 🤘 Welcome to Stagehand! Thanks so much for trying us out!
 * 🛠️ CONFIGURATION: stagehand.config.ts will help you configure Stagehand
 *
 * 📝 Check out our docs for more fun use cases, like building agents
 * https://docs.stagehand.dev/
 *
 * 💬 If you have any feedback, reach out to us on Slack!
 * https://stagehand.dev/slack
 *
 * 📚 You might also benefit from the docs for Zod, Browserbase, and Playwright:
 * - https://zod.dev/
 * - https://docs.browserbase.com/
 * - https://playwright.dev/docs/intro
 */

// ========== MongoDB Connection Configuration ==========
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'scraper_db';

let client: MongoClient | null = null;
let db: Db | null = null;

// ========== Schema Definitions ==========
// Product schema for e-commerce websites
const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  price: z.string(),
  currency: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().optional(),
  url: z.string(),
  brand: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  inStock: z.boolean().optional(),
  specs: z.record(z.string()).optional(),
  dateScraped: z.date(),
});

type Product = z.infer<typeof ProductSchema>;

// Product list schema for results from category pages
const ProductListSchema = z.object({
  products: z.array(ProductSchema),
  category: z.string().optional(),
  page: z.number().optional(),
  totalProducts: z.number().optional(),
  websiteName: z.string(),
  dateScraped: z.date(),
});

type ProductList = z.infer<typeof ProductListSchema>;

// Review schema for product reviews
const ReviewSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  author: z.string().optional(),
  rating: z.number(),
  title: z.string().optional(),
  content: z.string(),
  date: z.date().optional(),
  verified: z.boolean().optional(),
  helpful: z.number().optional(),
  dateScraped: z.date(),
});

type Review = z.infer<typeof ReviewSchema>;

// Collection names for MongoDB
const COLLECTIONS = {
  PRODUCTS: 'products',
  PRODUCT_LISTS: 'product_lists',
  REVIEWS: 'reviews',
};

// ========== MongoDB Utility Functions ==========
/**
 * Connects to MongoDB
 */
async function connectToMongo(): Promise<Db> {
  if (db) return db;
  
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    
    db = client.db(DB_NAME);
    return db;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

/**
 * Closes the MongoDB connection
 */
async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
    client = null;
    db = null;
  }
}

/**
 * Stores data in a MongoDB collection
 */
async function storeData<T>(collectionName: string, data: T | T[]): Promise<void> {
  const database = await connectToMongo();
  const collection = database.collection(collectionName);
  
  try {
    if (Array.isArray(data)) {
      if (data.length > 0) {
        await collection.insertMany(data as any[]);
        console.log(`Inserted ${data.length} documents into ${collectionName}`);
      }
    } else {
      await collection.insertOne(data as any);
      console.log(`Inserted 1 document into ${collectionName}`);
    }
  } catch (error) {
    console.error(`Error storing data in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Finds documents in a MongoDB collection
 */
async function findData<T>(collectionName: string, query = {}): Promise<T[]> {
  const database = await connectToMongo();
  const collection = database.collection(collectionName);
  
  try {
    const documents = await collection.find(query).toArray();
    return documents as T[];
  } catch (error) {
    console.error(`Error finding data in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Aggregates data in a MongoDB collection
 */
async function aggregateData<T>(
  collectionName: string, 
  pipeline: object[]
): Promise<T[]> {
  const database = await connectToMongo();
  const collection = database.collection(collectionName);
  
  try {
    const results = await collection.aggregate(pipeline).toArray();
    return results as T[];
  } catch (error) {
    console.error(`Error aggregating data in ${collectionName}:`, error);
    throw error;
  }
}

// ========== Scraping Functions ==========
/**
 * Scrapes a product list from an Amazon category page
 */
async function scrapeProductList(page: Page, categoryUrl: string): Promise<ProductList> {
  await page.goto(categoryUrl);
  
  // Wait for the page to load
  await page.waitForTimeout(2000);

  // Scroll to load more products
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1000);

  // Extract product data using Stagehand
  const data = await page.extract({
    instruction: "Extract all product information from this Amazon category page, including product names, prices, URLs, ratings, and image URLs",
    schema: z.object({
      products: z.array(z.object({
        name: z.string(),
        price: z.string(),
        url: z.string(),
        imageUrl: z.string().optional(),
        rating: z.number().optional(),
        reviewCount: z.number().optional(),
      })),
      category: z.string(),
      totalProducts: z.number().optional(),
    }),
  });

  // Process the extracted data
  const products = data.products.map(product => ({
    ...product,
    dateScraped: new Date(),
  }));

  // Create the product list object
  const productList: ProductList = {
    products,
    category: data.category,
    page: 1,
    totalProducts: data.totalProducts,
    websiteName: "Amazon",
    dateScraped: new Date(),
  };

  // Store the data in MongoDB
  await storeData(COLLECTIONS.PRODUCT_LISTS, productList);
  await storeData(COLLECTIONS.PRODUCTS, products);

  return productList;
}

/**
 * Scrapes detailed information for a single product
 */
async function scrapeProductDetails(page: Page, productUrl: string): Promise<Product> {
  await page.goto(productUrl);
  
  // Wait for the page to load
  await page.waitForTimeout(2000);

  // Scroll down to load more content
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 3);
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight * 2 / 3);
  });
  await page.waitForTimeout(1000);

  // Extract product details using Stagehand
  const product = await page.extract({
    instruction: "Extract detailed product information from this Amazon product page, including name, price, description, specifications, brand, category, image URL, rating, review count, and availability",
    schema: ProductSchema.omit({ dateScraped: true }),
  });

  // Add additional data
  const completeProduct: Product = {
    ...product,
    url: productUrl,
    dateScraped: new Date(),
  };

  // Store the data in MongoDB
  await storeData(COLLECTIONS.PRODUCTS, completeProduct);

  return completeProduct;
}

/**
 * Scrapes product reviews
 */
async function scrapeProductReviews(page: Page, productUrl: string): Promise<void> {
  // Navigate to reviews page
  const reviewsUrl = productUrl.includes('/dp/') 
    ? productUrl.replace('/dp/', '/product-reviews/') 
    : productUrl;
  
  await page.goto(reviewsUrl);
  await page.waitForTimeout(2000);

  // Extract review data using Stagehand
  const data = await page.extract({
    instruction: "Extract all product reviews from this Amazon reviews page, including review text, rating, author, title, date, and helpful count",
    schema: z.object({
      productId: z.string(),
      reviews: z.array(z.object({
        author: z.string().optional(),
        rating: z.number(),
        title: z.string().optional(),
        content: z.string(),
        date: z.string().optional(),
        helpful: z.number().optional(),
      })),
    }),
  });

  // Process the review data
  const reviews = data.reviews.map(review => ({
    ...review,
    productId: data.productId,
    date: review.date ? new Date(review.date) : undefined,
    dateScraped: new Date(),
    verified: true,
  }));

  // Store reviews in MongoDB
  if (reviews.length > 0) {
    await storeData(COLLECTIONS.REVIEWS, reviews);
    console.log(`Stored ${reviews.length} reviews for product ${data.productId}`);
  }
}

// ========== Data Analysis Functions ==========
/**
 * Run queries on the collected data
 */
async function runQueries(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectToMongo();
    console.log(chalk.blue("🔌 Connected to MongoDB"));

    // Define types for MongoDB query results
    interface CategoryCount {
      _id: string | null;
      count: number;
    }

    // 1. Get total counts for each collection
    console.log(chalk.yellow("\n📊 Collection Counts:"));
    for (const [name, collection] of Object.entries(COLLECTIONS)) {
      const count = (await findData(collection)).length;
      console.log(`${chalk.green(name)}: ${count} documents`);
    }

    // 2. Products by category
    console.log(chalk.yellow("\n📊 Products by Category:"));
    const productsByCategory = await aggregateData<CategoryCount>(
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

    // 3. Find highest rated products
    console.log(chalk.yellow("\n📊 Top Rated Products:"));
    const highestRatedProducts = await findData(
      COLLECTIONS.PRODUCTS,
      { rating: { $gte: 4 } }
    );
    
    console.log(chalk.yellow(`Found ${highestRatedProducts.length} highly rated products (4+ stars)`));
    if (highestRatedProducts.length > 0) {
      console.table(
        highestRatedProducts.map((product: any) => ({
          Name: product.name,
          Price: product.price,
          Rating: product.rating,
          Category: product.category || "Unknown"
        }))
      );
    }
    
    console.log(chalk.green("\n✅ Queries completed successfully!"));
  } catch (error) {
    console.error(chalk.red("❌ Error running queries:"), error);
  }
}

// ========== Main Function ==========
async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  try {
    // Connect to MongoDB
    await connectToMongo();
    
    // Define the category URL for Amazon electronics
    const categoryUrl = "https://www.amazon.com/s?k=laptops";
    
    console.log(chalk.blue("📊 Starting to scrape product listing..."));
    
    // Scrape product listing
    const productList = await scrapeProductList(page, categoryUrl);
    console.log(chalk.green(`✅ Scraped ${productList.products.length} products from category: ${productList.category}`));
    
    // Scrape detailed information for the first 3 products
    const productsToScrape = productList.products.slice(0, 3);
    
    for (const [index, product] of productsToScrape.entries()) {
      console.log(chalk.blue(`📊 Scraping details for product ${index + 1}/${productsToScrape.length}: ${product.name}`));
      
      try {
        // Scrape product details
        const detailedProduct = await scrapeProductDetails(page, product.url);
        console.log(chalk.green(`✅ Scraped detailed information for: ${detailedProduct.name}`));
        
        // Scrape product reviews
        console.log(chalk.blue(`📊 Scraping reviews for: ${detailedProduct.name}`));
        await scrapeProductReviews(page, product.url);
        
        // Wait between requests to avoid rate limiting
        await page.waitForTimeout(2000);
      } catch (error) {
        console.error(chalk.red(`❌ Error scraping product ${product.name}:`), error);
      }
    }
    
    // Run queries on the collected data
    await runQueries();
    
    console.log(chalk.green("🎉 Scraping and MongoDB operations completed successfully!"));
  } catch (error) {
    console.error(chalk.red("❌ Error during scraping:"), error);
  } finally {
    // Close MongoDB connection
    await closeMongo();
  }
}

// ========== Entry Point ==========
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`,
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        },
      ),
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;
  
  await main({
    page,
    context,
    stagehand,
  });
  
  await stagehand.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack",
    )}\n`,
  );
}

run();
