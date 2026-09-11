# Sistema de escenas, capítulos y scripts

Este proyecto organiza la narrativa y la lógica del juego por escenas de Phaser. La idea principal es separar tres cosas:

- la pantalla o escenario visual (`src/scenes/...`)
- el contenido narrativo del capítulo (`assets/scripts/*.txt`)
- los recursos gráficos y de audio (`assets/...`)

Así, un desarrollador puede cambiar diálogos o crear nuevos capítulos sin tener que reescribir toda la lógica de renderizado de la escena.

## 1. Cómo funciona el sistema general

La aplicación inicia en [src/main.js](src/main.js). Allí se registra la lista completa de escenas que Phaser debe cargar:

- escenas globales: inicio, selección de capítulos, ajustes, información
- escenas por capítulo: `chapter1`, `chapter2`, `chapter3`

La carga se hace así:

```js
scene: [
  StartScene,
  ChapterSelectorScene,
  InfoScene,
  SettingsScene,
  ...chapter1Scenes,
  ...chapter2Scenes,
  ...chapter3Scenes
]
```

Cada escena es una clase que extiende `Phaser.Scene`.

Por ejemplo, una escena típica del capítulo se ve así:

```js
export class Chp1_scn1 extends Phaser.Scene {
  constructor() {
    super('Chp1_scn1');
  }

  preload() {
    this.load.text('ch1_script', 'assets/scripts/chapter1.txt');
    this.load.image('sky', 'assets/desert/sky.png');
    this.load.audio('birds', 'assets/sounds/birds.mp3');
  }

  create() {
    const scriptText = this.cache.text.get('ch1_script');
    this.storyRunner = new StoryRunner(this, scriptText);
    this.storyRunner.initUI();
    this.storyRunner.run('Inicio');
  }
}
```

En otras palabras:

- `preload()` carga el guion y los recursos visuales/sonoros de esa escena.
- `create()` crea el `StoryRunner` y lo ejecuta sobre el texto del guion.
- `StoryRunner` toma ese texto y traduce las instrucciones del guion en diálogos, transiciones, preguntas, minijuegos y cambios de escena.

## 2. Estructura de carpetas de capítulos

Cada capítulo se organiza dentro de `src/scenes/chapters/`.

Ejemplo:

```text
src/scenes/chapters/
├── chapter1/
│   ├── index.js
│   ├── chp1_scn1.js
│   ├── chp1_scn2.js
│   ├── chp1_scn3.js
│   ├── chp1_end.js
│   └── ...
├── chapter2/
└── chapter3/
```

Cada carpeta de capítulo tiene:

- `index.js`: exporta el arreglo de escenas del capítulo.
- `chpN_scnX.js`: una escena individual del capítulo.
- `chpN_end.js`: escena final del capítulo.

Por ejemplo, el índice de capítulo 1 es este:

```js
export default [
  Chp1_scn1,
  Chp1_scn2,
  Chp1_scn3,
  Chp1_scn4,
  Chp1_scn5,
  Chp1_scn6,
  Chp1_end
]
```

Y luego `src/main.js` incorpora ese arreglo al juego principal.

## 3. Qué son los archivos en assets/scripts

La carpeta `assets/scripts` contiene los guiones del juego en texto plano.

Por ejemplo:

- `assets/scripts/chapter1.txt`
- `assets/scripts/chapter2.txt`
- `assets/scripts/chapter3.txt`
- `assets/scripts/guia.txt`

Estos archivos no son código JavaScript. Son la narrativa del juego escrita en un lenguaje simple basado en etiquetas tipo `[comando][argumentos]`.

Un fragmento real del archivo `chapter1.txt` se ve así:

```txt
[escena][Inicio]
[personaje][Jouktai][habla]
    [es:Buenos dias {{$jugador}}, mi nombre es Jouktai.]
    [way:Anas watamalü tanulia Jouktai.]
[pregunta_escena][es:¿Qué quiere hacer Jouktai ahora?][correcta:2]
    [op1es:Dormir un rato]
    [op2es:Buscar el molino]
    [op3es:Regresar a casa]
[cambiar_escena][Chp1_scn2]
```

Esto significa que:

- `[escena][Inicio]` define una sección del guion
- `[personaje][Jouktai][habla]` indica que el personaje habla
- `[es:...]` y `[way:...]` permiten texto en español y Wayuunaiki
- `[pregunta_escena]` crea una pregunta con opciones
- `[cambiar_escena]` lleva al siguiente bloque de la historia
- `[minijuego]` invoca un minijuego

La utilidad de estos archivos es central: permiten escribir la historia sin tocar la lógica del videojuego. Los desarrolladores pueden cambiar diálogos, decisiones, preguntas o secuencias cuando lo necesiten.

## 4. Cómo interpreta el parser

El archivo `src/story/parser.js` procesa el texto del guion. Su trabajo es:

- normalizar palabras para comparar comandos sin importar tildes o espacios
- detectar escenas y eventos dentro del texto
- reconocer personajes y emociones utilizadas
- preparar etiquetas para saltos (`goto`, `ir_a`, etc.)
- extraer información para cargar dinámicamente sprites y expresiones de personajes

También se usa `collectCharacterAssets()` para detectar automáticamente qué personajes y emociones aparecen en el guion, y así cargar desde `assets/characters/...` los recursos correctos.

Ejemplo:

```js
this.load.on('filecomplete-text-ch1_script', (key, type, data) => {
  const characters = collectCharacterAssets(data);
  characters.forEach((emotions, name) => {
    const states = new Set(['idle', 'camina', ...Array.from(emotions)]);
    // carga assets del personaje
  });
});
```

Eso permite que la escena no tenga que cargar manualmente cada imagen del personaje: el guion dicta qué assets son necesarios.

## 5. Cómo se usa StoryRunner

`src/story/storyRunner.js` es el motor que ejecuta el guion.

Su trabajo es interpretar los comandos del archivo `.txt` y ejecutar acciones en la escena:

- mostrar texto en el panel de diálogo
- desplazar personajes
- cambiar fondos o planos
- abrir y cerrar recuadros
- activar preguntas y elegir opciones
- abrir minijuegos
- cambiar entre escenas
- guardar progreso del capítulo

El patrón típico es:

```js
const scriptText = this.cache.text.get('ch1_script');
this.storyRunner = new StoryRunner(this, scriptText);
this.storyRunner.initUI();
this.storyRunner.run('Inicio');
```

Esto hace que el contenido narrativo quede desacoplado del código visual.

## 6. Cómo crear o editar un capítulo

### Opción A: editar un capítulo existente

1. Abre el archivo correspondiente en `assets/scripts/`.
   - Ejemplo: `assets/scripts/chapter2.txt`
2. Modifica los textos, preguntas o secuencia de escenas.
3. Si el cambio requiere un recurso nuevo, agrega el asset en la carpeta correspondiente dentro de `assets/`.
4. Si la escena usa un personaje o emoción nueva, asegúrate de que el asset exista en `assets/characters/...` o de que el parser pueda localizarlo.
5. Ejecuta el juego para probar la historia.

### Opción B: crear un capítulo nuevo

1. Crea un nuevo archivo de script en `assets/scripts/`.
   - Ejemplo: `assets/scripts/chapter4.txt`
2. Crea una carpeta en `src/scenes/chapters/`.
   - Ejemplo: `src/scenes/chapters/chapter4/`
3. Crea las escenas del capítulo:
   - `chp4_scn1.js`
   - `chp4_scn2.js`
   - `chp4_end.js`
4. Define el array en `src/scenes/chapters/chapter4/index.js`.
5. Importa ese array en [src/main.js](src/main.js) y añádelo a la lista de escenas globales.
6. Agrega una tarjeta del capítulo en [src/scenes/ChapterSelectorScene.js](src/scenes/ChapterSelectorScene.js) si quieres que aparezca en el menú principal.
7. Añade los assets del capítulo en `assets/chapters/` o en otras subcarpetas de `assets/`.

### Estructura recomendada para un nuevo capítulo

```text
src/scenes/chapters/chapter4/
├── index.js
├── chp4_scn1.js
├── chp4_scn2.js
├── chp4_end.js
```

```js
// index.js
import { Chp4_scn1 } from './chp4_scn1.js';
import { Chp4_scn2 } from './chp4_scn2.js';
import { Chp4_end } from './chp4_end.js';

export default [
  Chp4_scn1,
  Chp4_scn2,
  Chp4_end
];
```

## 7. Qué contiene la carpeta assets

La carpeta `assets` es el repositorio visual y sonoro del proyecto. Tiene varias categorías:

- `assets/scripts/`: guiones de historias
- `assets/characters/`: personajes, poses y expresiones
- `assets/desert/`: fondos del ambiente
- `assets/items/`: objetos y elementos interactivos
- `assets/juegos/`: recursos de minijuegos
- `assets/sounds/`: música y efectos de sonido
- `assets/ui/`: botones, indicadores y elementos de interfaz
- `assets/chapters/`: portadas y thumbnails de capítulos

Toda la lógica de escena usa estas rutas como referencia. Es importante que la ruta del asset coincida exactamente con la carga que hace `this.load.image(...)`, `this.load.audio(...)` o `this.load.text(...)`.

## 8. Buenas prácticas para desarrollo

- Mantén un guion por capítulo en `assets/scripts/`.
- Haz que cada escena del capítulo cargue solo los recursos que va a usar.
- Usa nombres consistentes para escenas y scripts: `Chp1_scn1`, `chp1_script`, `chapter1.txt`.
- Si agregas un personaje nuevo, crea su carpeta en `assets/characters/<Nombre>/` y usa los mismos subdirectorios: `mira_jugador`, `mira_lado`, y cada emoción/estado.
- Si agregas un minijuego, añade sus recursos en `assets/juegos/<nombre>/` y luego invócalo desde el guion con `[minijuego][nombre]`.
- Para cambiar la historia, modifica el guion antes que la lógica; la mayoría de las veces no hace falta tocar el código de la escena.

## 9. Resumen práctico

Si quieres entender el flujo real del proyecto, el patrón es este:

1. `src/main.js` registra las escenas del juego.
2. Cada escena carga su guion desde `assets/scripts/*.txt`.
3. `StoryRunner` interpreta el guion.
4. El guion controla diálogos, decisiones, minijuegos y transiciones.
5. Los assets de imagen, sonido y personajes viven en `assets/` y se cargan según el contenido del guion.
6. Para crear un nuevo capítulo, basta con crear el script, la carpeta de escenas y registrar la nueva escena en el sistema.

Con esta estructura, el contenido narrativo y la lógica visual quedan bien separadas, lo que facilita añadir capítulos, editar diálogos y mantener el proyecto de forma ordenada.
