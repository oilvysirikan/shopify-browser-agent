import React from 'react';
import { Card, EmptyState } from '@shopify/polaris';

export function ProductList() {
  return (
    <EmptyState
      heading="Product List"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Product list will be displayed here</p>
    </EmptyState>
  );
}
