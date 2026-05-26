import fetch from "node-fetch";
import shopify from "../shopify.js";
import DecoupeConfig from "../model/DecoupeConfigModel.js";
import { translateDeep } from "../utils/translate.js";

// External API Config
const DECOUPE_BASE_URL = "http://api.variance-auto.com/v1/obtenir/decoupe";
const API_KEY = "Tool4Sign2026!";

// Helper to build external API URLs
const buildDecoupeUrl = (path = "", params = {}) => {
  const urlParams = new URLSearchParams({
    cle: API_KEY,
    ...params
  });
  const endpoint = path ? `${DECOUPE_BASE_URL}/${path}` : DECOUPE_BASE_URL;
  return `${endpoint}?${urlParams.toString()}`;
};

// Fetch all store products with pagination
export async function getAllDecoupeStoreProducts(req, res) {
  try {
    const session = res.locals.shopify.session;
    if (!session) {
      throw new Error("Shopify session is required");
    }

    const shopDomain = session.shop;
    const client = new shopify.api.clients.Graphql({ session });

    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after, sortKey: TITLE) {
          edges {
            node {
              id
              title
              vendor
              productType
              status
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    sku
                    price
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let allProducts = [];
    let hasNextPage = true;
    let endCursor = null;
    const PAGE_SIZE = 250;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;
      console.log(`📦 Fetching decoupe products page ${pageCount}...`);
      
      const variables = { first: PAGE_SIZE, after: endCursor };
      const response = await client.query({
        data: { query, variables },
      });

      const errors = response.body?.errors || response.errors;
      if (errors) {
        throw new Error(errors[0]?.message || "GraphQL error");
      }

      const productsData = response.body?.data?.products || response.data?.products;
      if (!productsData) {
        throw new Error("Invalid response from Shopify");
      }

      const currentProducts = productsData.edges.map((edge) => {
        const product = edge.node;
        const productId = product.id.split("/").pop();
        return {
          id: productId,
          title: product.title || "",
          vendor: product.vendor || "",
          productType: product.productType || "N/A",
          sku: product.variants?.edges?.[0]?.node?.sku || "",
          image: product.images?.edges?.[0]?.node?.url || null,
          status: product.status || "DRAFT",
          price: parseFloat(
            product.variants?.edges?.[0]?.node?.price ||
              product.priceRange?.minVariantPrice?.amount || 0
          ),
        };
      });

      allProducts = [...allProducts, ...currentProducts];
      hasNextPage = productsData.pageInfo.hasNextPage;
      endCursor = productsData.pageInfo.endCursor;
    }

    console.log(`✅ Fetched ${allProducts.length} products for Decoupe Configurator`);

    const config = await DecoupeConfig.findOne({ shop: shopDomain });
    const selectedProductIds = config?.productIds || [];

    res.json({ success: true, products: allProducts, total: allProducts.length, selectedProductIds });
  } catch (error) {
    console.error("🔥 getAllDecoupeStoreProducts error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Save selected products
export async function saveDecoupeProducts(req, res) {
  try {
    const { productIds } = req.body;
    const session = res.locals.shopify.session;
    const shopDomain = session.shop;

    console.log("💾 Saving decoupe products for shop:", shopDomain);

    await DecoupeConfig.findOneAndUpdate(
      { shop: shopDomain },
      { productIds: productIds || [] },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({ success: true, message: "Decoupe products saved successfully" });
  } catch (err) {
    console.error("Save decoupe error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Check product extension allowed
export async function checkDecoupeProductExtension(req, res) {
  try {
    const { productId } = req.query;
    let shopDomain = null;

    if (res.locals.shopify?.session) {
      shopDomain = res.locals.shopify.session.shop;
    } else if (req.query.shop) {
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(req.query.shop);
      if (!sessions || sessions.length === 0) {
        return res.status(401).json({ success: false, allowed: false, error: "Shop not installed" });
      }
      shopDomain = req.query.shop;
    }

    if (!shopDomain) {
      return res.status(400).json({ success: false, allowed: false, error: "Missing shop" });
    }

    const config = await DecoupeConfig.findOne({ shop: shopDomain });
    const isAllowed = config?.productIds?.includes(productId?.toString());

    res.json({
      success: true,
      allowed: isAllowed || false
    });
  } catch (error) {
    console.error("Check decoupe error:", error);
    res.status(500).json({ success: false, allowed: false, error: error.message });
  }
}

// Proxy call: GET decoupe options list
export async function getDecoupeList(req, res) {
  const targetLang = req.query.lang || 'en';
  const url = buildDecoupeUrl();
  try {
    console.log(`Calling Decoupe List API: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ error: "Failed to fetch decoupe options list" });
    }
    const data = await response.json();
    const translatedData = await translateDeep(data, targetLang);
    res.json(translatedData);
  } catch (error) {
    console.error("Decoupe list proxy error:", error.message);
    res.status(500).json({ error: "Decoupe list proxy error", message: error.message });
  }
}

// Proxy call: GET decoupe option detail
export async function getDecoupeDetail(req, res) {
  const { id } = req.params;
  const targetLang = req.query.lang || 'en';
  const url = buildDecoupeUrl(id);
  try {
    console.log(`Calling Decoupe Detail API: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ error: "Failed to fetch decoupe option detail" });
    }
    const data = await response.json();
    const translatedData = await translateDeep(data, targetLang);
    res.json(translatedData);
  } catch (error) {
    console.error("Decoupe detail proxy error:", error.message);
    res.status(500).json({ error: "Decoupe detail proxy error", message: error.message });
  }
}

// Add Decoupe custom product to Shopify cart dynamically
export async function addDecoupeProductToCart(req, res) {
  try {
    console.log("📥 Received add-decoupe-item request");

    const {
      decoupeId,
      decoupeTitle,
      selectedLaize,
      selectedLength,
      totalPrice,
      image,
      reference,
      category
    } = req.body;

    if (!decoupeId || !decoupeTitle || !totalPrice || isNaN(parseFloat(totalPrice))) {
      return res.status(400).json({ success: false, error: "Missing required product configurations" });
    }

    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).json({ success: false, error: "Missing shop parameter" });
    }

    console.log("🔍 Finding session for shop:", shop);
    const sessions = await shopify.config.sessionStorage.findSessionsByShop(shop);
    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ success: false, error: "No session found for shop" });
    }
    const session = sessions[0];
    const client = new shopify.api.clients.Graphql({ session });

    // Format laize and length to remove float/decimal issues in SKU matching
    const laizeStr = String(selectedLaize).replace('.', '_');
    const lengthStr = String(selectedLength).replace('.', '_');
    const sku = `DC-${decoupeId}-${laizeStr}-${lengthStr}`;
    console.log("🔑 Generated Decoupe SKU:", sku);

    // Search if product with this SKU already exists
    try {
      const searchRes = await client.query({
        data: {
          query: `
            query($query: String!) {
              products(first: 1, query: $query) {
                edges {
                  node {
                    id
                    title
                    variants(first: 1) {
                      edges {
                        node {
                          id
                          sku
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { query: `sku:${sku}` }
        },
      });

      const existingProduct = searchRes?.body?.data?.products?.edges?.[0]?.node;

      if (existingProduct && existingProduct.variants?.edges?.[0]?.node) {
        const existingVariantId = existingProduct.variants.edges[0].node.id;
        const numericId = existingVariantId.split('/').pop();
        console.log("✅ Found existing decoupe product:", existingProduct.title, "| Variant:", numericId);
        return res.json({
          success: true,
          variantId: numericId,
          existed: true,
          productTitle: existingProduct.title,
          sku: sku,
        });
      }
      console.log("🆕 No existing decoupe product found, creating new one...");
    } catch (searchError) {
      console.log("⚠️ Search error, continuing:", searchError.message);
    }

    // Create new custom dynamic product
    const priceString = parseFloat(totalPrice).toFixed(2);
    const title = `${decoupeTitle} – Laize ${selectedLaize}cm x ${selectedLength}cm`;
    const descriptionHtml = `
      <p><strong>Custom Cut Tint Film</strong></p>
      <p><strong>Option:</strong> ${decoupeTitle}</p>
      <p><strong>Width (Laize):</strong> ${selectedLaize} cm</p>
      <p><strong>Length:</strong> ${selectedLength} cm</p>
      <p><strong>Reference:</strong> ${reference || 'N/A'}</p>
      <p><strong>Category:</strong> ${category || 'N/A'}</p>
    `.trim();

    console.log("🏗️ Creating decoupe product...");
    const createRes = await client.query({
      data: {
        query: `
          mutation CreateProduct($input: ProductInput!) {
            productCreate(input: $input) {
              product {
                id
                title
                variants(first: 1) {
                  nodes {
                    id
                    inventoryItem { id }
                  }
                }
              }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: {
            title,
            descriptionHtml,
            productType: "Custom Decoupe Film",
            status: "ACTIVE",
            vendor: "Variance Auto",
            tags: ["variance-decoupe", `decoupe-${decoupeId}`],
          }
        },
      },
    });

    const createData = createRes?.body?.data?.productCreate;
    if (!createData || createData.userErrors.length > 0) {
      const errors = createData?.userErrors?.map(e => `${e.field}: ${e.message}`).join(", ") || "Unknown error";
      throw new Error(`Product creation failed: ${errors}`);
    }

    const productId = createData.product.id;
    const variantId = createData.product.variants.nodes[0].id;
    const inventoryItemId = createData.product.variants.nodes[0].inventoryItem.id;
    console.log("✅ Decoupe product created:", productId);

    // Update Price
    await client.query({
      data: {
        query: `
          mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants { id price }
              userErrors { field message }
            }
          }
        `,
        variables: { productId, variants: [{ id: variantId, price: priceString }] },
      },
    });
    console.log("✅ Price updated");

    // Update SKU
    await client.query({
      data: {
        query: `
          mutation($id: ID!, $input: InventoryItemInput!) {
            inventoryItemUpdate(id: $id, input: $input) {
              inventoryItem { id sku }
              userErrors { field message }
            }
          }
        `,
        variables: { id: inventoryItemId, input: { sku } },
      },
    });
    console.log("✅ SKU updated");

    // Set Metafields for admin tracking
    const metafieldsInput = [
      { ownerId: productId, namespace: "decoupe_config", key: "decoupe_id", value: String(decoupeId), type: "single_line_text_field" },
      { ownerId: productId, namespace: "decoupe_config", key: "laize", value: String(selectedLaize), type: "single_line_text_field" },
      { ownerId: productId, namespace: "decoupe_config", key: "length", value: String(selectedLength), type: "single_line_text_field" },
      { ownerId: productId, namespace: "decoupe_config", key: "reference", value: reference || 'N/A', type: "single_line_text_field" },
      { ownerId: productId, namespace: "decoupe_config", key: "sku", value: sku, type: "single_line_text_field" },
    ];

    await client.query({
      data: { 
        query: `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id key value } userErrors { field message } } }`, 
        variables: { metafields: metafieldsInput } 
      },
    });
    console.log("✅ Metafields set");

    // Publish to Online Store sales channel
    try {
      const pubRes = await client.query({ data: { query: `query { publications(first: 10) { edges { node { id name } } } }` } });
      const onlineStore = pubRes?.body?.data?.publications?.edges?.find(p => p.node.name === "Online Store");
      if (onlineStore) {
        await client.query({
          data: { 
            query: `mutation publish($id: ID!, $publicationId: ID!) { publishablePublish(id: $id, input: { publicationId: $publicationId }) { userErrors { field message } } }`, 
            variables: { id: productId, publicationId: onlineStore.node.id } 
          },
        });
        console.log("✅ Published");
      }
    } catch (e) { 
      console.error("Publish error:", e.message); 
    }

    // Set Product image
    if (image && image.startsWith('http')) {
      try {
        await client.query({
          data: { 
            query: `mutation AddImages($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { media { ... on MediaImage { id } } userErrors { field message } } }`, 
            variables: { productId, media: [{ mediaContentType: "IMAGE", originalSource: image }] } 
          },
        });
        console.log("✅ Image uploaded");
      } catch (e) { 
        console.error("Media upload error:", e.message); 
      }
    }

    const numericVariantId = variantId.split('/').pop();
    console.log("🎉 SUCCESS! Decoupe Variant ID:", numericVariantId);
    return res.json({
      success: true,
      variantId: numericVariantId,
      existed: false,
      productTitle: title,
      sku: sku,
      productId: productId.split('/').pop(),
    });

  } catch (error) {
    console.error("❌ Decoupe AddToCart Error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
}
