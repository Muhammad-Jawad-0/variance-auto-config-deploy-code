import shopify from "../shopify.js";
import ConfigModel from "../model/ConfigModel.js";

// ✅ Updated controller with pagination loop
export async function getAllStoreProducts(req, res) {
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
      console.log(`📦 Fetching page ${pageCount}...`);
      
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

    console.log(`✅ Fetched ${allProducts.length} products in ${pageCount} pages`);

    const config = await ConfigModel.findOne({ shop: shopDomain });
    const selectedProductIds = config?.productIds || [];

    res.json({ success: true, products: allProducts, total: allProducts.length, selectedProductIds });
  } catch (error) {
    console.error("🔥 getAllStoreProducts error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Save selected products (already working)
export async function saveProductId(req, res) {
  try {
    const { productIds } = req.body;
    const session = res.locals.shopify.session;
    const shopDomain = session.shop;

    console.log("💾 Saving for shop:", shopDomain);

    await ConfigModel.findOneAndUpdate(
      { shop: shopDomain },
      { productIds: productIds || [] },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({ success: true, message: "Products saved successfully" });

  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function checkProductExtension(req, res) {
  try {
    const { productId } = req.query;
    let shopDomain = null;

    // Admin requests ke liye session se shop lo
    if (res.locals.shopify?.session) {
      shopDomain = res.locals.shopify.session.shop;
    }
    // Storefront proxy requests ke liye query param se shop lo
    else if (req.query.shop) {
      // Optional: double-check ke shop valid hai (authenticateUser already verify karta hai)
      const sessions = await shopify.config.sessionStorage.findSessionsByShop(req.query.shop);
      if (!sessions || sessions.length === 0) {
        return res.status(401).json({ success: false, allowed: false, error: "Shop not installed" });
      }
      shopDomain = req.query.shop;
    }

    if (!shopDomain) {
      return res.status(400).json({ success: false, allowed: false, error: "Missing shop" });
    }

    const config = await ConfigModel.findOne({ shop: shopDomain });
    const isAllowed = config?.productIds?.includes(productId?.toString());

    res.json({
      success: true,
      allowed: isAllowed || false
    });

  } catch (error) {
    console.error("Check error:", error);
    res.status(500).json({ success: false, allowed: false, error: error.message });
  }
}

// =========================================================================
export const addConfiguredProductToCart = async (req, res) => {
  try {
    console.log("📥 Received add-configured-item request");

    const {
      marque_id, modele_id, declinaison_id, vitre_id, film_id,
      brandName, modelName, declinaisonLabel, kitLabel, filmName,
      totalPrice, filmImages, modelImageUrl, brandImageUrl,
      reference, basePrice, filmPrice, uv, solar, light,
      technicalSheetUrl, technicalSheetName,
    } = req.body;

    if (!marque_id || !modele_id || !declinaison_id || !vitre_id || !film_id) {
      return res.status(400).json({ success: false, error: "Missing configuration IDs" });
    }
    if (!totalPrice || isNaN(parseFloat(totalPrice))) {
      return res.status(400).json({ success: false, error: "Invalid total price" });
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

    const sku = `VT-${marque_id}-${modele_id}-${declinaison_id}-${vitre_id}-${film_id}`;
    console.log("🔑 Generated SKU:", sku);

    // 3. Search existing product by SKU
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
        console.log("✅ Found existing product:", existingProduct.title, "| Variant:", numericId);
        return res.json({
          success: true,
          variantId: numericId,
          existed: true,
          productTitle: existingProduct.title,
          sku: sku,
        });
      }
      console.log("🆕 No existing product found, creating new one...");
    } catch (searchError) {
      console.log("⚠️ Search error, continuing:", searchError.message);
    }

    // 4. Create new product
    const priceString = parseFloat(totalPrice).toFixed(2);
    const title = `${filmName} – ${brandName} ${modelName} (${declinaisonLabel})`;
    const descriptionHtml = `
      <p><strong>Brand:</strong> ${brandName || 'N/A'}</p>
      <p><strong>Model:</strong> ${modelName || 'N/A'}</p>
      <p><strong>Year/Trim:</strong> ${declinaisonLabel || 'N/A'}</p>
      <p><strong>Window Kit:</strong> ${kitLabel || 'N/A'}</p>
      <p><strong>Tint Film:</strong> ${filmName || 'N/A'}</p>
      <p><strong>Reference:</strong> ${reference || 'N/A'}</p>
      ${uv ? `<p><strong>UV Protection:</strong> ${uv}%</p>` : ''}
      ${solar ? `<p><strong>Solar Protection:</strong> ${solar}%</p>` : ''}
      ${light ? `<p><strong>Light Transmission:</strong> ${light}%</p>` : ''}
      ${technicalSheetUrl ? `<p><strong>Technical Sheet:</strong> <a href="${technicalSheetUrl}" target="_blank">Download PDF</a></p>` : ''}
    `.trim();

    const allImages = [];
    if (modelImageUrl) allImages.push(modelImageUrl);
    if (brandImageUrl) allImages.push(brandImageUrl);
    if (Array.isArray(filmImages)) allImages.push(...filmImages);

    console.log("🏗️ Creating product...");
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
            title, descriptionHtml,
            productType: "Window Tint Film",
            status: "ACTIVE",
            vendor: "Variance Auto",
            tags: ["variance-auto", `brand-${marque_id}`, `model-${modele_id}`],
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
    console.log("✅ Product created:", productId);

    // Update price
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

    // Metafields
    const metafieldsInput = [
      { ownerId: productId, namespace: "variance_config", key: "brand", value: brandName || '', type: "single_line_text_field" },
      { ownerId: productId, namespace: "variance_config", key: "model", value: modelName || '', type: "single_line_text_field" },
      { ownerId: productId, namespace: "variance_config", key: "declinaison", value: declinaisonLabel || '', type: "single_line_text_field" },
      { ownerId: productId, namespace: "variance_config", key: "kit", value: kitLabel || '', type: "single_line_text_field" },
      { ownerId: productId, namespace: "variance_config", key: "film", value: filmName || '', type: "single_line_text_field" },
      { ownerId: productId, namespace: "variance_config", key: "reference", value: reference || '', type: "single_line_text_field" },
      { ownerId: productId, namespace: "variance_config", key: "configuration_sku", value: sku, type: "single_line_text_field" },
    ];
    if (uv) metafieldsInput.push({ ownerId: productId, namespace: "variance_config", key: "uv_protection", value: uv, type: "single_line_text_field" });
    if (solar) metafieldsInput.push({ ownerId: productId, namespace: "variance_config", key: "solar_protection", value: solar, type: "single_line_text_field" });
    if (light) metafieldsInput.push({ ownerId: productId, namespace: "variance_config", key: "light_transmission", value: light, type: "single_line_text_field" });
    if (technicalSheetUrl) metafieldsInput.push({ ownerId: productId, namespace: "variance_config", key: "technical_sheet", value: technicalSheetUrl, type: "single_line_text_field" });

    await client.query({
      data: { query: `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id key value } userErrors { field message } } }`, variables: { metafields: metafieldsInput } },
    });
    console.log("✅ Metafields set");

    // Publish
    try {
      const pubRes = await client.query({ data: { query: `query { publications(first: 10) { edges { node { id name } } } }` } });
      const onlineStore = pubRes?.body?.data?.publications?.edges?.find(p => p.node.name === "Online Store");
      if (onlineStore) {
        await client.query({
          data: { query: `mutation publish($id: ID!, $publicationId: ID!) { publishablePublish(id: $id, input: { publicationId: $publicationId }) { userErrors { field message } } }`, variables: { id: productId, publicationId: onlineStore.node.id } },
        });
        console.log("✅ Published");
      }
    } catch (e) { console.error("Publish error:", e.message); }

    // Images
    if (allImages.length > 0) {
      try {
        const payload = allImages.filter(url => url?.startsWith('http')).slice(0, 10).map(url => ({ mediaContentType: "IMAGE", originalSource: url }));
        if (payload.length) {
          await client.query({
            data: { query: `mutation AddImages($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { media { ... on MediaImage { id } } userErrors { field message } } }`, variables: { productId, media: payload } },
          });
          console.log("✅ Images uploaded");
        }
      } catch (e) { console.error("Media error:", e.message); }
    }

    // 5. Return SUCCESS with numeric ID
    const numericVariantId = variantId.split('/').pop();
    console.log("🎉 SUCCESS! Numeric Variant ID:", numericVariantId);
    return res.json({
      success: true,
      variantId: numericVariantId,
      existed: false,
      productTitle: title,
      sku: sku,
      productId: productId.split('/').pop(),
    });

  } catch (error) {
    console.error("❌ FATAL ERROR:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};