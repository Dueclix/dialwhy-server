import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let client: MongoClient;
let dbInstance: Db;

async function connectToDatabase(): Promise<void> {
  if (dbInstance) return;

  try {
    const uri: string = process.env.MONGODB_URI as string;
    if (!uri) {
      throw new Error("Database URI is not defined");
    }
    client = new MongoClient(uri);
    await client.connect();
    dbInstance = client.db("vide0-calling-reactjs");
  } catch (err) {
    console.error("Database connection failed", err);
    throw err;
  }
}

export async function getDb(): Promise<Db> {
  if (!dbInstance) {
    await connectToDatabase(); // Ensure the database is connected before returning the instance
  }
  if (!dbInstance) {
    throw new Error("Failed to connect to the database");
  }
  return dbInstance;
}