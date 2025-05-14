import { z } from 'zod';

// Product schema for e-commerce websites
export const ProductSchema = z.object({
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

export type Product = z.infer<typeof ProductSchema>;

// Product list schema for results from category pages
export const ProductListSchema = z.object({
  products: z.array(ProductSchema),
  category: z.string().optional(),
  page: z.number().optional(),
  totalProducts: z.number().optional(),
  websiteName: z.string(),
  dateScraped: z.date(),
});

export type ProductList = z.infer<typeof ProductListSchema>;

// Review schema for product reviews
export const ReviewSchema = z.object({
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

export type Review = z.infer<typeof ReviewSchema>;

// Collection names for MongoDB
export const COLLECTIONS = {
  PRODUCTS: 'products',
  PRODUCT_LISTS: 'product_lists',
  REVIEWS: 'reviews',
}; 