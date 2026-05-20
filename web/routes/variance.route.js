import express from "express";
import {
    getBrands,
    getModelsByBrand,
    getDeclinaisonsByModel,
    getKitsByDeclinaison,
    getFilmsByDeclinaisonAndKit,
    getFilmDetail,
    getPdfMapping,
    getFullConfiguration,
    textTranslate
} from "../controller/variance.controller.js";

const VarianceRouter = express.Router();

// All routes
VarianceRouter.get("/brands", getBrands);
VarianceRouter.get("/models", getModelsByBrand);
VarianceRouter.get("/declinaisons", getDeclinaisonsByModel);
VarianceRouter.get("/kits", getKitsByDeclinaison);
VarianceRouter.get("/films", getFilmsByDeclinaisonAndKit);
VarianceRouter.get("/film-detail", getFilmDetail);
VarianceRouter.get("/pdf-mapping", getPdfMapping);
VarianceRouter.post("/translate-text", textTranslate);

// Optional: Get everything in one request
VarianceRouter.get("/full-config", getFullConfiguration);

export default VarianceRouter;