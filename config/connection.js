import mongoose from "mongoose";
/**
 * @function ConnectDataBase
 * @description Establishes a connection to the MongoDB database using the MONGO_URL from environment variables.
 *
 * @returns {Promise<void>}
 *
 * @example
 * import ConnectDataBase from './config/db.js';
 * ConnectDataBase();
 */

const ConnectDataBase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to \n" + process.env.MONGO_URL.blue.underline);
  } catch (error) {
    console.log(error);
  }
};

export default ConnectDataBase;
