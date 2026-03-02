export const metadata = {
  title: "Meantime — Tu mesa se está preparando",
  description: "Sistema de espera inteligente para restaurantes",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2D7A4F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <style>{`
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body { margin: 0; padding: 0; background: #FAFAF8; -webkit-font-smoothing: antialiased; }
          input, select, button { font-family: 'DM Sans', sans-serif; }
          ::selection { background: #2D7A4F20; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
