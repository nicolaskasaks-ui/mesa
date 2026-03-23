# Flow TV - Apple TV App

App para Apple TV que permite ver la plataforma **Flow** (Personal/Telecom Argentina).

## Características

### 📺 TV en Vivo
- Grilla completa de canales Flow Argentina (+30 canales)
- Filtrado por categoría: Noticias, Deportes, Películas, Series, Infantil, Música, Documentales
- Indicador de programa actual con barra de progreso
- Guía de programación (EPG)
- Indicador EN VIVO

### 🎬 On Demand
- Catálogo de películas y series
- Filtros por género y tipo de contenido
- Vista detallada con sinopsis, rating, duración
- Selector de temporadas y episodios para series
- Lista de favoritos ("Mi Lista")

### 🔍 Búsqueda
- Búsqueda integrada de canales y contenido VOD
- Búsqueda con debounce (espera 500ms antes de buscar)
- Sugerencias de búsquedas populares
- Resultados en tiempo real

### ▶️ Reproductor
- Reproductor nativo con AVKit
- Controles adaptados para Siri Remote
- Soporte para streams HLS
- Indicador de EN VIVO para canales
- Barra de progreso para contenido on-demand
- Auto-hide de controles

### 👤 Mi Cuenta
- Información del plan Flow
- Configuración de calidad de video (Auto/1080p/720p/480p)
- Control parental
- Reproducción automática
- Subtítulos

## Arquitectura

```
FlowTV/
├── App/                    # Entry point y navegación principal
│   ├── FlowTVApp.swift     # @main app
│   ├── ContentView.swift   # Router auth/main
│   └── MainTabView.swift   # Tab navigation
├── Models/                 # Modelos de datos
│   ├── Channel.swift       # Canales y programas
│   ├── VODContent.swift    # Contenido on-demand
│   ├── User.swift          # Usuario y autenticación
│   └── EPG.swift           # Guía electrónica de programas
├── Services/               # Capa de servicios
│   ├── FlowAPIService.swift  # Cliente API Flow
│   ├── AuthManager.swift     # Gestión de autenticación
│   └── MockData.swift        # Datos mock para desarrollo
├── Views/                  # Vistas SwiftUI
│   ├── Auth/               # Login
│   ├── Home/               # Pantalla principal
│   ├── LiveTV/             # TV en vivo
│   ├── OnDemand/           # Contenido on-demand
│   ├── Player/             # Reproductor de video
│   ├── Search/             # Búsqueda
│   └── Settings/           # Configuración
├── Extensions/             # Extensiones
│   └── Color+Flow.swift    # Colores de marca Flow
└── Resources/              # Assets e Info.plist
```

## Requisitos

- tvOS 17.0+
- Xcode 15.0+
- Swift 5.9+
- Cuenta de Flow (Personal/Telecom Argentina)

## Setup

1. Abrí el proyecto en Xcode:
   ```bash
   open FlowTV.xcodeproj
   ```

2. Seleccioná el target "FlowTV" y un simulador de Apple TV

3. Build & Run (⌘R)

## API Flow

La app se conecta a la API de Flow (`api.flow.com.ar`). En modo desarrollo
usa datos mock que simulan el lineup real de canales argentinos.

### Canales incluidos (mock)
- **Aire**: eltrece, Telefe, América TV, TV Pública, Canal 9, NET TV
- **Noticias**: TN, C5N, Crónica TV, LN+
- **Deportes**: ESPN, ESPN 2, ESPN 3, FOX Sports, TyC Sports, DSports
- **Películas**: HBO, HBO 2, Star Channel, TNT, SPACE
- **Series**: AXN, Warner Channel, FX, Paramount Network
- **Infantil**: Disney Channel, Nickelodeon, Cartoon Network
- **Documentales**: National Geographic, Discovery, History Channel
- **Música**: MTV, VH1

### Contenido VOD (mock)
Películas y series argentinas: Argentina 1985, El Secreto de sus Ojos,
Relatos Salvajes, El Clan, Nueve Reinas, El Marginal, El Encargado, Ocupas, etc.

## Navegación con Siri Remote

- **Swipe**: Navegar entre contenidos
- **Click**: Seleccionar/Reproducir
- **Menu**: Volver atrás
- **Play/Pause**: Controlar reproducción
- **Swipe horizontal** (en player): Avanzar/retroceder

## Tecnologías

- **SwiftUI** - UI declarativa
- **AVKit** - Reproducción de video
- **async/await** - Concurrencia moderna
- **Combine** - Reactive programming para estados
