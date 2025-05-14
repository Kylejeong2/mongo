# Stagehand MongoDB Scraper

A web scraping project that uses Stagehand to extract structured data from e-commerce websites and store it in MongoDB for analysis.

## Features

- **Web Scraping**: Uses Stagehand (built on Playwright) for intelligent web scraping
- **Data Extraction**: Extracts structured product data using AI-powered instructions
- **MongoDB Storage**: Stores scraped data in MongoDB for persistence and querying
- **Schema Validation**: Uses Zod for schema validation and TypeScript interfaces
- **Error Handling**: Robust error handling to prevent crashes during scraping
- **Data Analysis**: Example MongoDB queries for data analysis

## Prerequisites

- Node.js 16 or higher
- MongoDB installed locally or MongoDB Atlas account
- Stagehand API key

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd stagehand-mongodb-scraper
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   ```
   # Create a .env file with the following variables
   MONGO_URI=mongodb://localhost:27017
   DB_NAME=scraper_db
   ```

## Usage

1. Start MongoDB locally:
   ```
   mongod
   ```

2. Run the scraper:
   ```
   npm start
   ```

3. The script will:
   - Scrape product listings from Amazon
   - Extract detailed information for the first 3 products
   - Extract reviews for each product
   - Store all data in MongoDB
   - Run sample queries to demonstrate MongoDB functionality

4. Run additional queries on the collected data:
   ```
   npm run query
   ```
   
   This will analyze the data with these reports:
   - Collection counts
   - Products by category
   - Price range analysis (min, max, average)
   - Top-rated products
   - Products with the most reviews

## Project Structure

- `index.ts`: Main entry point and scraping workflow
- `scraper.ts`: Scraping functions for products and reviews
- `mongodb.ts`: MongoDB connection and data access functions
- `schemas.ts`: Zod schemas and TypeScript types
- `utils.js`: Utility functions for Stagehand
- `stagehand.config.js`: Stagehand configuration
- `query.ts`: Data analysis and reporting queries

## Data Models

The project uses the following data models:

- **Product**: Individual product information
- **ProductList**: List of products from a category page
- **Review**: Product reviews

## MongoDB Collections

Data is stored in the following MongoDB collections:

- **products**: Individual product information
- **product_lists**: Lists of products from category pages
- **reviews**: Product reviews

## Example Queries

The project includes example MongoDB queries:

- Count products by category
- Find highest-rated products (4+ stars)
- Price range analysis
- Products with the most reviews

## License

MIT

## Acknowledgements

- [Stagehand](https://docs.stagehand.dev/) for the powerful web scraping capabilities
- [MongoDB](https://www.mongodb.com/) for the flexible document database
- [Zod](https://zod.dev/) for runtime schema validation
