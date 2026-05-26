import express from "express";
import {
  getAllDecoupeStoreProducts,
  saveDecoupeProducts,
  checkDecoupeProductExtension,
  getDecoupeList,
  getDecoupeDetail,
  addDecoupeProductToCart
} from "../controller/decoupe.controller.js";

const DecoupeRoute = express.Router();

DecoupeRoute.get("/getAllDecoupeStoreProducts", getAllDecoupeStoreProducts);
DecoupeRoute.post("/save-decoupe-products", saveDecoupeProducts);
DecoupeRoute.get("/check-decoupe-product-extension", checkDecoupeProductExtension);
DecoupeRoute.get("/decoupe-list", getDecoupeList);
DecoupeRoute.get("/decoupe-detail/:id", getDecoupeDetail);
DecoupeRoute.post("/cart/add-decoupe-item", addDecoupeProductToCart);

export default DecoupeRoute;
