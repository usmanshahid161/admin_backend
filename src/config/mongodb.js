const mongoose =
  require("mongoose");

const config =
  require("./index");


const connectMongoDB =
  async () => {

    try {

      await mongoose.connect(
        config.MONGODB_URI
      );

      console.log(
        "MongoDB Connected Successfully 🚀"
      );

    } catch (error) {

      console.error(
        "MongoDB Connection Failed:",
        error
      );

      throw error;

    }

  };


module.exports = {
  connectMongoDB
};