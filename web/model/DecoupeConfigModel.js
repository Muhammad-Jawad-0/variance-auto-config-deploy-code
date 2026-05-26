import mongoose from "mongoose";

const decoupeConfigSchema = new mongoose.Schema({
    shop: String,
    productIds: [String]
});

export default mongoose.model("DecoupeConfig", decoupeConfigSchema);
