# FilmFetcher 🎬

## Descripción
FilmFetcher es una aplicación web fullstack que automatiza la recopilación y gestión de información sobre proyecciones de cine y eventos culturales. Utiliza técnicas de webscraping con IA para extraer datos de diferentes sitios web y los presenta en una interfaz unificada.

## Características Principales
- 🤖 Webscraping inteligente con OpenAI
- 📱 Bot de WhatsApp integrado para consultas
- 🔐 Autenticación segura con Auth0
- 📊 Dashboard con estadísticas en tiempo real
- 📅 Programación automática de scraping
- 📄 Soporte para carga manual desde PDFs e imágenes
- 📊 Exportación de datos a CSV
- 🎭 Soporte para cines, teatros y museos

## Tecnologías Utilizadas
### Backend
- Node.js
- Express
- MongoDB con Mongoose
- Puppeteer para webscraping
- OpenAI API
- WhatsApp Web.js
- Node-cron para tareas programadas

### Frontend
- React
- Ant Design
- Auth0 para autenticación
- WebSocket para comunicación en tiempo real

## Requisitos Previos
- Node.js (v14 o superior)
- MongoDB
- NPM o Yarn
- Cuenta de Auth0
- Clave API de OpenAI

## Configuración del Entorno
1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/filmfetcher.git
cd filmfetcher
```

2. Instala las dependencias:
```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

3. Configura las variables de entorno:

Crea un archivo `.env` en la carpeta `server`:
```env
MONGO_DB_URI=tu_uri_de_mongodb
OPENAI_API_KEY=tu_clave_api_de_openai
SECRET=tu_secret_de_auth0
BASE_URL=http://localhost:5000
CLIENT_ID=tu_client_id_de_auth0
ISSUER_BASE_URL=https://tu-dominio.auth0.com
```

Crea un archivo `.env` en la carpeta `client`:
```env
REACT_APP_AUTH0_DOMAIN=tu-dominio.auth0.com
REACT_APP_AUTH0_CLIENT_ID=tu_client_id_de_auth0
REACT_APP_API_URL=http://localhost:5000
```

## Ejecución del Proyecto
1. Inicia el servidor:
```bash
cd server
npm start
```

2. Inicia el cliente:
```bash
cd client
npm start
```

## Estructura del Proyecto
```
filmfetcher/
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── config/
│       ├── hooks/
│       └── style/
└── server/
    ├── api/
    ├── models/
    ├── routes/
    └── services/
```

## Uso
1. Accede a la aplicación en `http://localhost:3000`
2. Inicia sesión con tus credenciales
3. Configura los sitios para scraping desde el panel de administración
4. Visualiza la cartelera unificada y gestiona las proyecciones

## Características de Seguridad
- Autenticación mediante Auth0
- Lista blanca de correos electrónicos autorizados
- CORS configurado para endpoints específicos
- Manejo seguro de tokens y sesiones

## Mantenimiento y Monitoreo
- El sistema mantiene registros detallados de cada operación de scraping
- Panel de estadísticas para monitorear el rendimiento
- Sistema de notificaciones para errores críticos
- Exportación de datos para análisis

## Contribución
1. Haz un Fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commitea tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia
Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte
Para soporte, por favor abre un issue en el repositorio de GitHub o contacta al equipo de desarrollo.

## Roadmap
- [ ] Implementación de tests automatizados
- [ ] Mejora en el sistema de reconocimiento de textos
- [ ] Integración con más plataformas de mensajería
- [ ] Sistema de recomendaciones basado en IA
- [ ] Interfaz móvil nativa
