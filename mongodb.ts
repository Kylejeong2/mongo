import { MongoClient, Db } from 'mongodb';

// MongoDB connection URI 
// Format: mongodb://username:password@host:port/database
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'scraper_db';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Connects to MongoDB
 */
export async function connectToMongo(): Promise<Db> {
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
export async function closeMongo(): Promise<void> {
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
export async function storeData<T>(collectionName: string, data: T | T[]): Promise<void> {
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
export async function findData<T>(collectionName: string, query = {}): Promise<T[]> {
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
export async function aggregateData<T>(
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