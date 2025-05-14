import { Page } from "@browserbasehq/stagehand";
import { z } from "zod";
import { Product, ProductList, ProductSchema, COLLECTIONS } from "./schemas.js";
import { storeData } from "./mongodb.js";

/**
 * Scrapes a product list from an Amazon category page
 */
export async function scrapeProductList(page: Page, categoryUrl: string): Promise<ProductList> {
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
export async function scrapeProductDetails(page: Page, productUrl: string): Promise<Product> {
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
export async function scrapeProductReviews(page: Page, productUrl: string): Promise<void> {
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