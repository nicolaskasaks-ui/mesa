export const metadata = {
  title: "Meantime — Entrá a la fila",
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
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo-dark.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <style dangerouslySetInnerHTML={{ __html: `
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body { margin: 0; padding: 0; background: #F0EDE8; background-image: radial-gradient(ellipse at 20% 0%, rgba(45,122,79,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(184,148,62,0.06) 0%, transparent 50%); background-attachment: fixed; min-height: 100dvh; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          input, select, button { font-family: 'Nunito', sans-serif; }
          ::selection { background: #2D7A4F20; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          @keyframes countdownPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
          @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          @keyframes toast { 0% { opacity: 0; transform: translateY(20px) scale(0.95); } 10% { opacity: 1; transform: translateY(0) scale(1); } 90% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-10px) scale(0.95); } }
          button { transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease, box-shadow 0.2s ease; }
          button:active { transform: scale(0.97) !important; }
          .glass-overlay { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
          .glass { background: rgba(255,255,255,0.55); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border: 1px solid rgba(255,255,255,0.35); }
          .glass-dark { background: rgba(26,26,26,0.65); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border: 1px solid rgba(255,255,255,0.08); }
          .glass-accent { background: rgba(45,122,79,0.12); backdrop-filter: saturate(150%) blur(16px); -webkit-backdrop-filter: saturate(150%) blur(16px); border: 1px solid rgba(45,122,79,0.15); }
          .card-enter { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .card-enter-delay-1 { animation-delay: 0.05s; }
          .card-enter-delay-2 { animation-delay: 0.1s; }
          .card-enter-delay-3 { animation-delay: 0.15s; }
          .card-enter-delay-4 { animation-delay: 0.2s; }
          .bottom-sheet { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .modal-enter { animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
          .toast { animation: toast 3s cubic-bezier(0.16, 1, 0.3, 1) both; }
          ::-webkit-scrollbar { width: 0; height: 0; }
          .safe-top { padding-top: max(16px, env(safe-area-inset-top)); }
          .safe-bottom { padding-bottom: max(20px, env(safe-area-inset-bottom)); }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
