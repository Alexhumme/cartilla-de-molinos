# Miiruku

Miiruku es un juego educativo desarrollado para promover el cuidado del agua, la conciencia ambiental y la apropiación del conocimiento sobre los molinos y sus procesos dentro de la comunidad. El proyecto combina narrativa, mecánicas de juego y actividades interactivas para apoyar la enseñanza en contextos escolares y comunitarios.

## Objetivos

- Incentivar la reflexión sobre la importancia del agua y su uso responsable.
- Fomentar el aprendizaje mediante experiencias lúdicas y contextualizadas.
- Fortalecer la relación entre la comunidad, la cultura local y el conocimiento técnico.
- Presentar contenido educativo con una interfaz amigable y accesible para diferentes públicos.
- Generar una experiencia multiplataforma que pueda ejecutarse en navegador, Android e iOS.

## Tecnologías utilizadas

- JavaScript
- Phaser 3 para la lógica del juego y la interfaz visual
- HTML5 y CSS para la estructura base de la aplicación
- Capacitor para empaquetar la aplicación como APK y preparar la entrega para iOS
- Assets gráficos y de audio locales para la narración y la experiencia interactiva

## Estructura del proyecto

```text
Miiruku/
├── android/                     # Proyecto Android generado con Capacitor
├── assets/                      # Imágenes, sonidos, personajes, fondos y recursos del juego
├── scripts/                     # Scripts auxiliares del proyecto
├── src/                         # Código principal del juego
│   ├── main.js                  # Punto de entrada
│   ├── scenes/                  # Escenas del juego
│   ├── story/                  # Motor de historias y narración
│   └── utils/                  # Utilidades generales
├── index.html                   # Página de arranque
├── phaser.js                    # Librería Phaser
├── capacitor.config.json        # Configuración de Capacitor
├── package.json                 # Scripts del proyecto y dependencias
├── .gitignore                   # Archivos y carpetas ignoradas por Git
├── README.md                    # Documentación del proyecto
├── dist/                        # Build web generado para despliegue
└── project.config               # Configuración del proyecto
```

## Método de ejecución

### Ejecutar en navegador

1. Instala dependencias:

```bash
npm install
```

2. Inicia el proyecto localmente:

```bash
npm run dev
```

3. O bien, usa un servidor estático:

```bash
python3 -m http.server 8080
```

4. Abre la aplicación en el navegador en la dirección:

```text
http://localhost:8080
```

### Generar APK con Capacitor

1. Asegúrate de tener instaladas las dependencias del proyecto:

```bash
npm install
```

2. Genera la versión web del juego:

```bash
npm run build
```

3. Sincroniza la aplicación con Android:

```bash
npx cap sync android
```

4. Genera el paquete de depuración:

```bash
cd android
./gradlew assembleDebug
```

5. El APK quedará en una ruta similar a:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

6. Para una versión de producción:

```bash
cd android
./gradlew assembleRelease
```

El APK de producción se generará en:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Método de despliegue para iOS

Para preparar la versión para iPhone o iPad:

1. Agrega la plataforma iOS si aún no existe:

```bash
npx cap add ios
```

2. Sincroniza los recursos web con la app iOS:

```bash
npx cap sync ios
```

3. Abre el proyecto en Xcode:

```bash
npx cap open ios
```

4. Desde Xcode, selecciona el esquema de la aplicación, conecta un dispositivo o el simulador, y genera el archivo IPA mediante `Archive` o `Export`.

> Para producción, es necesario contar con una cuenta de desarrollador de Apple y certificados/signing configurados correctamente en Xcode.

## Dispositivos compatibles

### Navegador web
- Computadores con navegadores modernos
- Chrome, Edge, Firefox y Safari compatibles con HTML5

### Android
- Dispositivos Android con versión 8.0 o superior
- Compatibles con pantallas táctiles y resolución moderna

### iOS
- iPhone y iPad con iOS 15 o superior
- Recomendado para dispositivos con pantalla moderna y capacidad gráfica suficiente

## Sitio web institucional

La aplicación también incluye acceso al sitio de Sennova: https://appsennovaguajira.com

## Descripción general

Miiruku busca convertir el aprendizaje en una experiencia cercana, activa y motivadora, conectando contenidos educativos con temas relevantes para la comunidad. La combinación de historia, minijuegos, gráficos y audio permite que los usuarios interactúen con conceptos clave de forma natural y memorable.
