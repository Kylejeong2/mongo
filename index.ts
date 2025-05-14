import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { z } from "zod";
import { scrapeProductList, scrapeProductDetails, scrapeProductReviews } from "./scraper.js";
import { connectToMongo, closeMongo, findData, aggregateData } from "./mongodb.js";
import { COLLECTIONS } from "./schemas.js";

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
async function main({
  page,
  context,
  stagehand,
}: {
  page: Page; // Playwright Page with act, extract, and observe methods
  context: BrowserContext; // Playwright BrowserContext
  stagehand: Stagehand; // Stagehand instance
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
    
    // Query example: Show statistics from MongoDB
    console.log(chalk.blue("📊 Querying MongoDB for statistics..."));
    
    // Define types for MongoDB query results
    interface CategoryCount {
      _id: string | null;
      count: number;
    }

    // Count products by category
    const productsByCategory = await aggregateData<CategoryCount>(COLLECTIONS.PRODUCTS, [
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log(chalk.yellow("Products by category:"));
    console.table(productsByCategory.map(item => ({ 
      Category: item._id || "Unknown", 
      Count: item.count 
    })));
    
    // Find highest rated products
    const highestRatedProducts = await findData(COLLECTIONS.PRODUCTS, {
      rating: { $gte: 4 }
    });
    
    console.log(chalk.yellow(`Found ${highestRatedProducts.length} highly rated products (4+ stars)`));
    if (highestRatedProducts.length > 0) {
      console.table(highestRatedProducts.map(product => ({
        Name: (product as any).name,
        Price: (product as any).price,
        Rating: (product as any).rating
      })));
    }
    
    console.log(chalk.green("🎉 Scraping and MongoDB operations completed successfully!"));
  } catch (error) {
    console.error(chalk.red("❌ Error during scraping:"), error);
  } finally {
    // Close MongoDB connection
    await closeMongo();
  }
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
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
