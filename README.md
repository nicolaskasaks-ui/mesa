# Mesa — Chuí 🟢

Lista de espera inteligente para Chuí.

## Deploy rápido en Vercel

### Opción A: Desde GitHub (recomendado)

1. Subí esta carpeta a un repo en GitHub
2. Entrá a [vercel.com](https://vercel.com) → "Add New Project"
3. Importá el repo → Deploy

### Opción B: Desde tu compu (sin GitHub)

```bash
npm install -g vercel
cd mesa-app
vercel
```

Seguí las instrucciones del CLI. En 30 segundos está online.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000

## Estructura

```
mesa-app/
├── app/
│   ├── layout.js    ← metadata, PWA config
│   └── page.js      ← toda la app (prototipo completo)
├── package.json
└── next.config.js
```

Todo está en un solo archivo (`page.js`) a propósito — es un prototipo.
Cuando crezca, se separa en componentes.
