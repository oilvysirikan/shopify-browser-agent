import {
  AppProvider as ShopifyAppProvider,
  type AppProviderProps,
} from "@shopify/shopify-app-remix";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { I18nContext, I18nManager, useI18n } from "@shopify/react-i18n";
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { type AppLoadContext } from "@remix-run/node";
import {
  type LoaderFunctionArgs,
  LinksFunction,
  MetaFunction,
} from "@remix-run/node";
import { i18n } from "./i18n";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export const loader = ({ request }: LoaderFunctionArgs) => {
  return {
    locale: i18n.locale,
    i18n: i18n.messages,
  };
};

function AppProvider({ children, ...rest }: AppProviderProps) {
  const { locale, i18n: translations } = useLoaderData<typeof loader>();
  
  return (
    <ShopifyAppProvider {...rest} i18n={translations}>
      <I18nContext.Provider value={new I18nManager({ id: 'app', locale, translations })}>
        <PolarisProvider i18n={translations}>
          {children}
        </PolarisProvider>
      </I18nContext.Provider>
    </ShopifyAppProvider>
  );
}

export default function App() {
  const { shop, apiKey } = useLoaderData<typeof loader>();
  
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Seafood Marketplace</title>
        <meta name="referrer" content="no-referrer-when-downgrade" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider
          isEmbeddedApp={true}
          apiKey={apiKey}
          shopOrigin={shop}
        >
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
