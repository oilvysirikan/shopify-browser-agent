import React from 'react';
import { Navigation as PolarisNavigation, Frame } from '@shopify/polaris';
import { HomeMajor, ListMajor, MagicButtonMajor } from '@shopify/polaris-icons';
import { useLocation, Link } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();

  const navigationMarkup = [
    {
      label: 'Dashboard',
      icon: HomeMajor,
      url: '/',
      selected: location.pathname === '/',
    },
    {
      label: 'Generate Content',
      icon: MagicButtonMajor,
      url: '/generate',
      selected: location.pathname === '/generate',
    },
    {
      label: 'Content Library',
      icon: ListMajor,
      url: '/content',
      selected: location.pathname === '/content',
    },
  ];

  const NavigationMarkup = () => (
    <PolarisNavigation location="/">
      {navigationMarkup.map((item) => (
        <PolarisNavigation.Section
          key={item.label}
          items={[
            {
              ...item,
              onClick: () => {
                // Navigation is handled by the Link component
              },
              label: <Link to={item.url} style={{
                color: item.selected ? 'var(--p-color-text-emphasis)' : 'var(--p-color-text)',
                textDecoration: 'none',
                width: '100%',
                display: 'block',
                padding: 'var(--p-space-2) var(--p-space-2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--p-space-2)' }}>
                  <span style={{ display: 'flex' }}><item.icon /></span>
                  <span>{item.label}</span>
                </div>
              </Link>
            },
          ]}
        />
      ))}
    </PolarisNavigation>
  );

  return (
    <Frame navigation={<NavigationMarkup />}>
      {/* Main content will be rendered here */}
    </Frame>
  );
}
