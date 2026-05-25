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
  Pagination, // ✅ Import Pagination
} from '@shopify/polaris';

const Configurator = () => {
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [saving, setSaving] = useState(false);

  // ✅ Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // You can make it adjustable

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/getAllStoreProducts');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
        setProducts(normalizedProducts);
        setSelectedIds((data.selectedProductIds || []).map(id => String(id)));
        setTotalProducts(normalizedProducts.length);
        setCurrentPage(1); // Reset to first page on new fetch
      } else {
        setError(data.error || 'Failed to fetch');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ✅ Pagination calculations
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    // Scroll to top (optional)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resourceName = useMemo(() => ({ singular: 'product', plural: 'products' }), []);

  const handleSelectionChange = (selectionType, toggleType, selection) => {
    if (selectionType === 'all') {
      if (toggleType) {
        // Select all products on CURRENT page only? Or all products overall?
        // Usually in paginated list, "select all" means select all on current page.
        // But user might expect select all across pages. Let's do current page.
        setSelectedIds(prev => {
          const currentPageIds = currentProducts.map(p => p.id);
          const newSelected = [...prev];
          currentPageIds.forEach(id => {
            if (!newSelected.includes(id)) newSelected.push(id);
          });
          return newSelected;
        });
      } else {
        // Deselect all on current page
        setSelectedIds(prev => prev.filter(id => !currentProducts.some(p => p.id === id)));
      }
    }
    if (selectionType === 'single') {
      const id = selection;
      setSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(item => item !== id);
        else return [...prev, id];
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
      if (data.success) toast.success(`✅ ${selectedIds.length} products saved!`);
      else toast.error('❌ Save failed');
    } catch (err) {
      toast.error('❌ Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page title="Store Products">
        <div style={{ textAlign: 'center', padding: '60px' }}><Spinner /><p>Loading products...</p></div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Store Products">
        <Layout><Layout.Section><Banner tone="critical"><p>{error}</p><Button onClick={fetchProducts}>Try Again</Button></Banner></Layout.Section></Layout>
      </Page>
    );
  }

  const headings = [
    { title: 'Image' }, { title: 'Product Title' }, { title: 'Type' },
    { title: 'Vendor' }, { title: 'Price' }, { title: 'Status' }, { title: 'SKU' },
  ];

  return (
    <Page title="Store Products">
      <Layout>
        <Layout.Section>
          <LegacyCard>
            <LegacyCard.Section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="headingMd">All Products</Text>
                <Button onClick={handleSave} loading={saving}>Save</Button>
              </div>
              <Box padding="200" background="bg-surface-secondary" borderRadius="200" marginBlockStart="200">
                <Text variant="bodySm">Selected: <strong>{selectedIds.length}</strong> / {totalProducts} total</Text>
              </Box>
            </LegacyCard.Section>
            <Divider />
            <LegacyCard.Section>
              <IndexTable
                resourceName={resourceName}
                itemCount={currentProducts.length}
                selectedItemsCount={currentProducts.filter(p => selectedIds.includes(p.id)).length}
                onSelectionChange={handleSelectionChange}
                headings={headings}
              >
                {currentProducts.map((product, index) => (
                  <IndexTable.Row id={product.id} key={product.id} selected={selectedIds.includes(product.id)} position={index}>
                    <IndexTable.Cell>
                      {product.image ? <Thumbnail source={product.image} alt={product.title} size="small" /> : <Box width="40px" height="40px">📷</Box>}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{product.title}</IndexTable.Cell>
                    <IndexTable.Cell><Badge>{product.productType}</Badge></IndexTable.Cell>
                    <IndexTable.Cell>{product.vendor}</IndexTable.Cell>
                    <IndexTable.Cell>€{product.price.toFixed(2)}</IndexTable.Cell>
                    <IndexTable.Cell>{product.status === 'ACTIVE' ? <Badge tone="success">Active</Badge> : <Badge>Draft</Badge>}</IndexTable.Cell>
                    <IndexTable.Cell>{product.sku}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>

              {/* ✅ Pagination Component */}
              {totalPages > 1 && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={() => handlePageChange(currentPage - 1)}
                    hasNext={currentPage < totalPages}
                    onNext={() => handlePageChange(currentPage + 1)}
                    label={`Page ${currentPage} of ${totalPages}`}
                  />
                </div>
              )}
              <Box padding="200" textAlign="center">
                <Text variant="bodySm" tone="subdued">
                  Showing {startIndex + 1}–{Math.min(endIndex, totalProducts)} of {totalProducts} products
                </Text>
              </Box>
            </LegacyCard.Section>
          </LegacyCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default Configurator;