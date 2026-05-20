import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  Page,
  Layout,
  Button,
  Banner,
  Spinner,
  Text,
  Badge,
  Thumbnail,
  LegacyCard,
  Box,
  Divider,
  IndexTable,
} from '@shopify/polaris';

const Configurator = () => {
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [saving, setSaving] = useState(false);



  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/getAllStoreProducts');

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error('Server error body:', errorBody);
        throw new Error(errorBody?.error || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const normalizedProducts = (data.products || []).map((product) => ({
          ...product,
          id: String(product.id),
          title: product.title || '',
          vendor: product.vendor || '',
          productType: product.productType || 'N/A',
          sku: product.sku || '',
          image: product.image || null,
          status: product.status || 'DRAFT',
          price: Number(product.price || 0),
        }));

        // ✅ DB se selected IDs load
        const savedIdsFromDb = data.selectedProductIds || [];

        setProducts(normalizedProducts);
        setSelectedIds(savedIdsFromDb.map(id => String(id))); // 🔥 important
        setTotalProducts(data.total || normalizedProducts.length);
      } else {
        setError(data.error || 'Failed to fetch products');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resourceName = useMemo(() => ({
    singular: 'product',
    plural: 'products',
  }), []);

  // ✅ selection handler (single + all)
  const handleSelectionChange = (selectionType, toggleType, selection) => {
    if (selectionType === 'all') {
      if (toggleType) {
        setSelectedIds(products.map(p => p.id));
      } else {
        setSelectedIds([]);
      }
    }

    if (selectionType === 'single') {
      const id = selection;

      setSelectedIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(item => item !== id);
        } else {
          return [...prev, id];
        }
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const res = await fetch('/api/save-selected-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedIds }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`✅ ${selectedIds.length} products saved successfully!`);
      } else {
        toast.error('❌ Save failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('❌ Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page title="Store Products">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Spinner />
          <p style={{ marginTop: '16px' }}>Loading products...</p>
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Store Products">
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <p>{error}</p>
              <Button onClick={fetchProducts}>Try Again</Button>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const headings = [
    { title: 'Image' },
    { title: 'Product Title' },
    { title: 'Type' },
    { title: 'Vendor' },
    { title: 'Price' },
    { title: 'Status' },
    { title: 'SKU' },
  ];

  return (
    <Page title="Store Products">
      <Layout>
        <Layout.Section>
          <LegacyCard>

            <LegacyCard.Section>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text variant="headingMd">All Products</Text>
                <Button onClick={handleSave} loading={saving}>Save</Button>
              </div>

              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm">
                  Selected: <strong>{selectedIds.length}</strong>
                </Text>
              </Box>
            </LegacyCard.Section>

            <Divider />

            <LegacyCard.Section>
              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                selectedItemsCount={selectedIds.length}
                onSelectionChange={handleSelectionChange}
                headings={headings}
              >
                {products.map((product, index) => (
                  <IndexTable.Row
                    id={product.id}
                    key={product.id}
                    selected={selectedIds.includes(product.id)}
                    position={index}
                  >
                    <IndexTable.Cell>
                      {product.image ? (
                        <Thumbnail source={product.image} alt={product.title} size="small" />
                      ) : (
                        <Box width="40px" height="40px">📷</Box>
                      )}
                    </IndexTable.Cell>

                    <IndexTable.Cell>{product.title}</IndexTable.Cell>
                    <IndexTable.Cell><Badge>{product.productType}</Badge></IndexTable.Cell>
                    <IndexTable.Cell>{product.vendor}</IndexTable.Cell>
                    <IndexTable.Cell>€{product.price.toFixed(2)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      {product.status === 'ACTIVE'
                        ? <Badge tone="success">Active</Badge>
                        : <Badge>Draft</Badge>}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{product.sku}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </LegacyCard.Section>

          </LegacyCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default Configurator;