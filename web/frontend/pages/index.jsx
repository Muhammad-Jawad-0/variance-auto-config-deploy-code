import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Stack,
  Link,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation, Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./Home.css";

import { trophyImage } from "../assets";

import { ProductsCard } from "../components";
import { useState } from "react";

export default function HomePage() {

    const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate()
  const { t } = useTranslation();
 return (
    <div className="home-app">
      <div className="home-container">
        <h1 className="app-name">Variance Shopify App</h1>
        <p className="app-tagline">
          Welcome! to Variance Auto Shop
        </p>

        {/* Button instead of Link */}
        <div>
          <div>
            <button style={{ background: "grey", marginBottom: "5px" }} className="cta-btn" onClick={() => navigate("/configurator")}>
              View Configurator
            </button>
          </div>
          <div>

            <button className="cta-btn" onClick={() => setShowModal(true)}>
              View Demo
            </button>
          </div>

        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-btn" onClick={() => setShowModal(false)}>
              ✖
            </button>

            <iframe
              width="100%"
              height="400"
              src="https://www.youtube.com/embed/4Q2OcsIfvp8?si=pxxT_rASPGCj7Lxz"
              title="Demo Video"
              frameBorder="0"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
