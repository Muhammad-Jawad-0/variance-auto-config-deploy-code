import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
    shop: String,
    productIds: [String]
});

export default mongoose.model("Config", configSchema);