import express from "express";
import { saveProductId, getAllStoreProducts, checkProductExtension ,addConfiguredProductToCart } from "../controller/StoreProducts.Controller.js";

const ConfiguratorRoute = express.Router();

// All routes
ConfiguratorRoute.post("/save-selected-products", saveProductId);
ConfiguratorRoute.get("/getAllStoreProducts", getAllStoreProducts);
ConfiguratorRoute.get("/check-product-extension", checkProductExtension);
ConfiguratorRoute.post("/cart/add-configured-item", addConfiguredProductToCart); 

export default ConfiguratorRoute;