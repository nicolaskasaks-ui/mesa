# FlowTV Apple TV App — Handoff

## Resumen

App de Apple TV (tvOS 17+) para el servicio Flow de Telecom Argentina. Permite ver TV en vivo, contenido on-demand y gestionar la cuenta de Flow desde un Apple TV.

## Estado Actual

### Login Easy Login (WebSocket + HTTP)

Se implementó el flujo de login "Easy Login" que replica el comportamiento real de la SmartTV de Flow. El flujo completo es:

#### Flujo de Autenticación

1. **HTTP GET** `https://easylogin.app.flow.com.ar/easylogin/v1/code`
   - Retorna: `{"code":"T55FY","sessionID":"0be4cf...","expirationTimeInMinutes":5,"expirationTimeInMilliseconds":300000}`
   - El código expira en 5 minutos

2. **WebSocket** `wss://easylogin.app.flow.com.ar`
   - Server envía: `{"sendType":"OUTPUT","method":"code","data":""}`
   - Cliente envía: `{"method":"start","data":{"code":"T55FY","sessionID":"0be4cf...","SDK":true,"sfat":false}}`
   - Cuando el usuario ingresa el código en su celular, el server envía: `{"method":"flowaccesstoken","data":{"flowaccesstoken":"eyJ...","crm":"FAN","accountId":"nico.kskff@gmail.com"}}`
   - Cliente envía: `{"method":"exit"}` y cierra la conexión

3. **Pantalla del Apple TV** muestra el código de 5 caracteres. El usuario lo ingresa en la app Flow del celular (Ajustes > Vincular dispositivo) o escanea el QR.

#### Headers Requeridos
- `Origin: https://fenix-smarttv.dev.app.flow.com.ar`
- `Referer: https://fenix-smarttv.dev.app.flow.com.ar/`
- `User-Agent: Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36`

### Archivos Clave

#### Autenticación
- `FlowTV/Services/EasyLoginService.swift` — Servicio de Easy Login (HTTP + WebSocket)
- `FlowTV/Services/AuthManager.swift` — Gestión de sesión, persiste token en UserDefaults
- `FlowTV/Views/Auth/LoginView.swift` — UI de login con código de vinculación

#### API
- `FlowTV/Services/FlowAPIService.swift` — Cliente REST para la API de Flow
  - Base URL: `https://web.flow.com.ar`
  - Auth: Bearer JWT token
  - Endpoints: `/auth/v2/provision/login`, `/api/v1/content/channels`, `/api/v1/content/channel` (EPG), `/api/v1/content/filter` (VOD), `/api/v1/dynamic/all` (home)
  - Device profile: WEB/PC/WINDOWS (misma config que el plugin Kodi)

#### Streaming
- `FlowTV/Services/StreamingService.swift` — Resolución de streams
- `FlowTV/Services/FairPlayDRMManager.swift` — DRM FairPlay para contenido protegido

#### Vistas
- `FlowTV/App/FlowTVApp.swift` — Entry point, inyecta servicios como environmentObjects
- `FlowTV/App/ContentView.swift` — Router: LoginView si no autenticado, MainTabView si sí
- `FlowTV/Views/Home/HomeView.swift` — Pantalla principal
- `FlowTV/Views/LiveTV/LiveTVView.swift` — TV en vivo con lista de canales
- `FlowTV/Views/Player/PlayerView.swift` — Reproductor de video
- `FlowTV/Views/OnDemand/OnDemandView.swift` — Contenido on-demand
- `FlowTV/Views/Search/SearchView.swift` — Búsqueda
- `FlowTV/Views/Settings/SettingsView.swift` — Configuración

#### Modelos
- `FlowTV/Models/Channel.swift` — Canal de TV
- `FlowTV/Models/VODContent.swift` — Contenido VOD (películas/series)
- `FlowTV/Models/User.swift` — FlowUser, AuthToken, FlowPlan
- `FlowTV/Models/EPG.swift` — Guía de programación

### API de Flow — Endpoints Descubiertos

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/easylogin/v1/code` | GET | Obtener código de vinculación + sessionID |
| `wss://easylogin.app.flow.com.ar` | WebSocket | Canal de notificación para Easy Login |
| `/auth/v2/provision/login` | POST | Login con email/password (requiere reCAPTCHA) |
| `/auth-daima/v1/provision/sendCode` | POST | Enviar OTP (no funciona bien en SmartTV) |
| `/auth-daima/v1/provision/validateCode` | POST | Validar OTP |
| `/auth-sdk/v1/flowaccesstoken` | POST | Intercambiar JWT por flow access token |
| `/api/v1/content/channels` | GET | Lista de canales |
| `/api/v1/content/channel` | POST | EPG (programación) |
| `/api/v1/content/filter` | GET | Catálogo VOD |
| `/api/v1/dynamic/all` | GET | Contenido dinámico (home) |

### Configuración SmartTV de Flow

Obtenida de `https://jsons.dev.app.flow.com.ar/host-web/flow/AR/csdk_config_rc.json`:
- Geo: `geo-atlas.dev.app.flow.com.ar/geo/v1/country`
- Auth DAIMA: `authdaima.dev.app.flow.com.ar`
- Auth SDK: `authsdk.app.flow.com.ar`
- Easy Login: `easylogin.app.flow.com.ar`
- Strings: `jsons.dev.app.flow.com.ar/fenix-stv/flow/AR/language_es.json`
- Settings: `jsons.dev.app.flow.com.ar/fenix-stv/flow/AR/settings.json`
- Features: `jsons.dev.app.flow.com.ar/fenix-stv/flow/AR/feature_rc.json`

## Problemas Conocidos / Pendientes

### Login
- **OTP por email/SMS no funciona**: El endpoint `sendCode` retorna 200 pero el código nunca llega. El Easy Login (WebSocket) es el método correcto para SmartTV.
- **Login con password requiere reCAPTCHA**: No viable en tvOS.
- **CoreImage QR no disponible en tvOS**: `CIFilter.qrCodeGenerator()` no existe en tvOS. Si se quiere mostrar QR, hay que usar una librería propia o generarlo server-side.

### UI
- **Nested ObservableObject**: SwiftUI no observa cambios en objetos anidados. `EasyLoginService` se pasa como `environmentObject` separado para que la UI se actualice.

### Streaming
- **DRM FairPlay**: Implementado pero no probado con contenido real.
- **Streams**: Los URLs de stream vienen en la respuesta de canales. Formato HLS.

## Decisiones Técnicas

1. **Device profile WEB**: Se usa el perfil WEB/PC/WINDOWS en vez de uno específico de tvOS porque Flow valida el tipo de dispositivo y rechaza perfiles desconocidos. El plugin Kodi usa la misma estrategia.

2. **Ephemeral URLSession**: Se usa `URLSessionConfiguration.ephemeral` para evitar errores `-1005` (NSURLErrorNetworkConnectionLost) causados por reutilización de conexiones HTTP/2.

3. **Easy Login sobre OTP**: El OTP requiere que el usuario reciba un código por SMS/email, lo cual no funciona de forma confiable. El Easy Login muestra un código en pantalla que el usuario ingresa en su celular, igual que la SmartTV real de Flow.

## Branch

`claude/apple-tv-flow-app-YSiWA`

## Para Continuar

1. Verificar que el código aparece en pantalla del Apple TV
2. Probar el flujo completo: código → ingresarlo en app Flow del celu → autenticación
3. Una vez autenticado, probar carga de canales y reproducción
4. Agregar QR code (server-side o librería Swift pura)
5. Mejorar UI del login para que coincida con el diseño real de Flow SmartTV
