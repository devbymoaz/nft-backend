import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}/${DB_NAME}`
    );
    console.log(`Mongo DB Connection: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("Connection Error: ", error);
  }
};

export default connectDB;
