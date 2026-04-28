// Minimal type definitions for @shopify/polaris
declare module '@shopify/polaris' {
  import * as React from 'react';
  
  export interface ButtonProps {
    children?: React.ReactNode;
    primary?: boolean;
    plain?: boolean;
    onClick?(): void;
    icon?: React.ReactElement | React.ComponentType<any>;
    fullWidth?: boolean;
  }

  export interface CardProps {
    children?: React.ReactNode;
    title?: string | React.ReactNode;
    sectioned?: boolean;
  }

  export interface TextProps {
    children?: React.ReactNode;
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
    variant?: 'headingXl' | 'headingLg' | 'headingMd' | 'headingSm' | 'headingXs' | 'bodyLg' | 'bodyMd' | 'bodySm';
    color?: 'success' | 'critical' | 'warning' | 'subdued' | 'text-inverse';
  }

  export interface LayoutProps {
    children?: React.ReactNode;
  }

  export interface SectionProps {
    children?: React.ReactNode;
    oneHalf?: boolean;
  }

  export interface BannerProps {
    children?: React.ReactNode;
    title?: string;
    status?: 'success' | 'info' | 'warning' | 'critical';
  }

  export interface ButtonGroupProps {
    children?: React.ReactNode;
    segmented?: boolean;
  }

  export const Button: React.ComponentType<ButtonProps>;
  export const Card: React.ComponentType<CardProps>;
  export const Text: React.ComponentType<TextProps>;
  export const Layout: React.ComponentType<LayoutProps> & {
    Section: React.ComponentType<SectionProps>;
  };
  export const Banner: React.ComponentType<BannerProps>;
  export const ButtonGroup: React.ComponentType<ButtonGroupProps>;
  export const AppProvider: React.ComponentType<{
    children?: React.ReactNode;
    i18n: any;
  }>;
  export const Page: React.ComponentType<{
    children?: React.ReactNode;
    title?: string;
  }>;
  export const SkeletonBodyText: React.ComponentType<{
    lines?: number;
  }>;
  export const SkeletonDisplayText: React.ComponentType<{
    size?: 'small' | 'medium' | 'large' | 'extraLarge';
  }>;
  export const Icon: React.ComponentType<{
    source: React.ReactElement | React.ComponentType<any> | string;
    color?: 'base' | 'subdued' | 'critical' | 'interactive' | 'warning' | 'highlight' | 'success';
  }>;
  export const Spinner: React.ComponentType<{
    size?: 'small' | 'large';
  }>;
  export const DataTable: React.ComponentType<{
    columnContentTypes: ('text' | 'numeric')[];
    headings: string[];
    rows: (string | number | React.ReactNode)[][];
  }>;
}
