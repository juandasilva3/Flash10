# ⚡ 10

Implementación web (no oficial) del juego de cartas **Flash 10**. Incluye un modo para jugar contra bots y un contador de puntos para usar con las cartas físicas.

No usa frameworks, bundlers ni dependencias — es HTML, CSS y JavaScript planos. No hace falta instalar nada ni levantar un servidor: **con abrir `index.html` en el navegador alcanza.**

## Estructura del proyecto

```
Flash10/
├── index.html          página de inicio: elegir "Jugar online" o "Contador de puntos"
├── juego.html           partida contra bots (variantes Truenos, Relámpagos, Clásico)
├── marcador.html         contador de puntos manual, para partidas con cartas físicas
├── css/
│   ├── base.css          variables de color, tipografía y componentes compartidos
│   │                      (botones, panels, inputs, badges) por las tres páginas
│   ├── index.css          estilos propios de index.html
│   ├── juego.css          estilos propios de juego.html (tablero, cartas, overlay)
│   └── marcador.css       estilos propios de marcador.html (tabla, barra inferior)
└── js/
    ├── common.js          utilidades compartidas (por ahora, escapeHtml)
    ├── juego.js           lógica del juego contra bots
    └── marcador.js         lógica del contador de puntos
```

Cada HTML carga `css/base.css` + su propio `css/<pagina>.css`, y (cuando aplica) `js/common.js` + su propio `js/<pagina>.js`. `index.html` no tiene lógica, así que no carga ningún script.

Son `<link>`/`<script src="...">` normales (no ES modules), por eso funciona abriendo el archivo directo con `file://` — no requieren servidor ni CORS.

## Cómo correrlo / probarlo

Abrí cualquiera de los tres `.html` con doble clic, o arrastralo a una pestaña del navegador. Para desarrollar con recarga automática podés usar cualquier servidor estático (por ejemplo `npx serve` o la extensión Live Server de VS Code), pero no es obligatorio.

## Las páginas

- **`index.html`** — landing simple con dos opciones.
- **`juego.html`** — partida en tiempo real contra bots (1 humano + hasta 5 bots). El humano juega con clicks; los bots roban y colocan cartas solos con un pequeño delay, simulando la dinámica simultánea del juego físico. Variante por defecto: **Truenos** (8→9→10 cartas). También están **Relámpagos** (10 cartas, sin Tormenta) y **Clásico** (120 cartas, con Tormenta).
- **`marcador.html`** — no simula el juego, solo lleva la cuenta: nombres de jugadores, límite de puntos y el puntaje de cada ronda, con el total acumulado. Pensado mobile-first porque es lo que se usa con el celular en la mesa mientras se juega con cartas reales. El estado se guarda en `localStorage` del navegador (no hay backend ni base de datos).

## Convenciones al modificar

- No hay build ni transpilado: lo que edites en `.css`/`.js` es lo que se sirve. Guardá y recargá el navegador.
- `css/base.css` es compartido — si tocás algo ahí, revisá el impacto en las tres páginas.
- Mantené `js/common.js` liviano; solo debería tener funciones realmente compartidas entre `juego.js` y `marcador.js`.
- Los scripts son IIFEs (`(function(){ ... })();`) sin módulos, para poder abrirse con `file://`. Si en algún momento se necesita `import`/`export`, hay que migrar a ES modules y ahí sí pasa a ser obligatorio un servidor local (por las restricciones de CORS de `file://`).
