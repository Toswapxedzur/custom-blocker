# Manual de código de la extensión de navegador Vault

[Manual de usuario](../manual/es.md)

## Contrato de las reglas

Código fuente: una expresión de función `(on, v) => { ... }`. Solo se admite JavaScript síncrono y la API indicada abajo; no hay temporizadores, red, APIs de extensión ni acceso directo al DOM. Las reglas basadas en el tiempo usan `ev.now` y eventos.

- La edición guarda un borrador; **Ejecutar** lo activa y activa el grupo. Los grupos congelados no pueden ejecutar. Un código fuente vacío descarga la regla.
- Una ejecución correcta sustituye los manejadores y paneles, conservando `v.state`. Un fallo de compilación/registro conserva la regla anterior; un tiempo de espera agotado puede detenerla. Recargar el motor vuelve a registrar el último código activado; las variables de los cierres se restablecen.
- El registro puede inicializar el estado, registrar manejadores, mostrar paneles y escribir en el registro. Las acciones de página/archivo y las emisiones deben estar en manejadores; su cola creada durante el registro se descarta.
- Desactivar suprime los manejadores y retira los paneles, hojas de estilo, cubiertas y decisiones sobre elementos gestionados. Activar restaura los paneles/hojas retenidos y vuelve a solicitar elementos. Ejecutar no borra las hojas, cubiertas o decisiones existentes. Eliminar quita la regla, su estado y sus efectos. La navegación, las modificaciones del DOM y las escrituras de archivos no se deshacen.
- Los eventos no están restringidos por los objetivos habituales del grupo; filtre URLs/elementos en la regla. Las acciones se encolan y se aplican después de distribuir el evento. Las excepciones detienen ese manejador sin revertir su estado/acciones; los manejadores posteriores pueden seguir ejecutándose. No hay confirmación de acciones excepto los eventos de archivo/consulta.

## API compartida

- `on(type, handler)` → booleano. Registra `handler(ev)`; varios manejadores se ejecutan en orden de registro. False significa argumentos inválidos o límite de manejadores alcanzado. `ev = { type: string, now: number, data }`; `now` son milisegundos Unix.
- `v.state`: objeto JSON mutable, persistido después de distribuir el evento. Inicialice los campos ausentes en lugar de sobrescribir el estado existente. Asignar un valor que no sea objeto o un array lo restablece a `{}`; las actualizaciones no serializables/demasiado grandes no se persisten.
- `v.log(...values)`: único productor del Registro de este grupo. Los registros/Borrar son independientes por grupo. Los errores de carga aparecen en el estado de ejecución; los diagnósticos de los manejadores no rellenan el Registro.
- `v.emit(type, data)`: encola una copia JSON de `data` para los manejadores de este grupo después del evento actual, con un `now` nuevo; no es una llamada síncrona.
- `v.panel(id, spec, tabId?)`: sustituye el panel con nombre de este grupo; omita `tabId` para todas las páginas web accesibles o use un ID de pestaña entero. Un `spec` null lo elimina. Véase Paneles.
- `v.file(op, path, payload?)` → cadena con el ID de solicitud. Véase Archivos.

Las demás llamadas compartidas devuelven `undefined`. Los IDs/estado pertenecen a un grupo, no a su nombre visible.

## Eventos del navegador

La notación de datos siguiente describe tipos; no es código ejecutable. `?` marca campos opcionales.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` es aproximado; use marcas de tiempo, no recuentos de ticks. `active` significa seleccionado dentro de una ventana del navegador, no demuestra que el usuario lo esté mirando. Las URLs pueden estar vacías/restringidas.
- `visible` procede de páginas accesibles y no ocultas; `elapsedMs` es el tiempo desde su último latido, cero mientras están cubiertas. No es uso acumulado ni tiempo de reproducción.
- `items` informa de elementos nuevos/modificados de fuentes compatibles y los reenvía tras Ejecutar/reactivar. `ref` identifica una tarjeta de esa página, no un ID de contenido duradero; `ref === "page"` denota la propia página. Puede haber títulos/URLs/autores vacíos. `authors` contiene identificadores de fuentes específicos de la plataforma.
- IDs de plataforma: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. La disponibilidad de elementos depende del marcado compatible de la página.
- Las etiquetas requieren el Clasificador de escritorio conectado y una compilación/plataforma con etiquetado habilitado (Chromium y Safari: YouTube, Reddit, Bilibili, X/`twitter`). La confianza es 1–5. `tagsSettled === false` significa pendiente/no disponible, no sin etiquetas; un `tags: []` finalizado significa sin etiquetas.
- `snooze` significa que se pulsó el botón Posponer del grupo. Por sí mismo no aplica una pausa.
- Las respuestas de consultas/archivos se dirigen al grupo solicitante. Correlacione `requestId`, compruebe `error`/`ok` y establezca un plazo usando ticks: las respuestas pueden perderse al cerrar una página, recargar el motor o desactivar el grupo. Los IDs de solicitud pueden repetirse después de Ejecutar; las solicitudes pendientes no son trabajo duradero.

## Acciones del navegador

El entero `tabId` debe proceder de un evento. Las acciones de página requieren una página a la que Vault tenga acceso; las páginas internas del navegador no están disponibles. Las entradas inválidas/objetivos no disponibles generalmente no producen ningún efecto.

- `v.item(tabId, ref, verdict)`: `"hide"` elimina una tarjeta de la fuente, `"dim"` cubre sus medios, `"allow"` la exime de los grupos inferiores, `null` borra la decisión de este grupo. Las referencias desconocidas no hacen nada; use `v.cover` para `isPage`. Las decisiones siguen el orden de la lista de grupos: hide superior prevalece; dim superior se mantiene frente a allow inferior; allow impide las decisiones inferiores. Una tarjeta reciclada/eliminada necesita una nueva decisión.
- `v.cover(tabId, on, message?)`: true cubre la página, false retira su cubierta personalizada; el mensaje está vacío por defecto (máximo 500 caracteres). Una sola cubierta personalizada por página; prevalece la última llamada aplicada, independientemente del orden de grupos. Los cambios de dirección la retiran; el bloqueo habitual puede seguir cubriendo la página.
- `v.go(tabId, target)`: una URL HTTP(S) o `"back"`, `"forward"`, `"reload"` (objetivo máximo 4096 caracteres).
- `v.close(tabId)`: cierra la pestaña.
- `v.css(tabIdOrStar, id, css)`: ID de pestaña entero o `"*"`; sustituye la hoja del grupo con ese ID o la elimina con null. Las hojas de pestaña terminan al cambiar la dirección; las hojas `"*"` llegan a páginas futuras. ID máximo 80, CSS máximo 100000 caracteres.
- `v.dom(tabId, selector, op, arg?)`: selector CSS (máximo 1000); todas las coincidencias, excepto `scrollTo`, que usa la primera. Operaciones: `hide` establece en línea `display:none!important`; `show` elimina el display en línea; `click`; `setText` sustituye el texto por `arg`; `addClass`/`removeClass` usan un nombre de clase; `scrollTo` desplaza hasta mostrarlo. Argumento máximo 2000. Las modificaciones persisten hasta su reversión explícita/sustitución de la página.
- `v.query(tabId, selector)` → cadena con el ID de solicitud o null para argumentos inválidos. El resultado es un evento `query` posterior: hasta 50 coincidencias, `tag` en minúsculas, texto normalizado ≤1000 caracteres, atributos ≤2000, valor ≤1000. Sin coincidencias es un `[]` correcto; CSS inválido produce `error: "invalid-selector"`. Una página sin receptor Vault puede no responder nunca.

## Paneles

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Valores predeterminados: posición abajo a la derecha; disposición vertical; alineación izquierda; rol region; anchura según el contenido. Las anchuras predefinidas son 220/280/360px; la anchura numérica del panel se limita a 180–520px. La anchura de los controles se limita a 32–520px y la altura a 20–360px. Los tamaños numéricos también aceptan cadenas en píxeles. Las variantes verticales cambian el espaciado; inline/row no ajustan líneas; wrap/toolbar las ajustan; twoColumn/grid/split/form usan cuadrículas; stack minimiza el espaciado. El rol aporta semántica de accesibilidad, no bloqueo modal.

Los IDs se normalizan a letras/dígitos ASCII/`_`/`-` (máximo 80); elija IDs únicos y estables. Si se omite el ID del control, pasa a ser `control-N`; el tipo omitido/desconocido pasa a ser text. Los textos/listas omitidos están vacíos; disabled es false. Llamar a `v.panel` sustituye toda la especificación. Un `value` omitido reutiliza el último valor del evento del control y después normaliza el tipo; un `value` explícito lo sobrescribe. Autofocus es false por defecto. Los campos desconocidos se descartan; no se admiten colores/fuentes/CSS de panel definidos por la regla.

Campos y valores de los controles:

- `text`: cadena `text`; por defecto, etiqueta. `html`: cadena `html`; se eliminan scripts, atributos de eventos, URLs peligrosas y estilos.
- `button`: `label`, `action: "submit" | "cancel" | "close"` opcional; el valor es una cadena (vacía por defecto). Las acciones emiten eventos; no envían/cierran nada automáticamente.
- `checkbox`, `toggle`: `value` booleano (false por defecto).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; valor de cadena (vacío por defecto). Los valores de opciones vacíos se eliminan; las etiquetas usan el valor por defecto.
- `textInput`, `textarea`: valor de cadena (vacío por defecto), `placeholder`; textarea `rows` 1–12 (3 por defecto).
- `numberInput`, `range`: valor numérico (0 por defecto), `min`, `max`, `step` positivo. Los valores se limitan a los límites; los límites de normalización no especificados son −1000000…1000000. Los controles range usan 0…100 por defecto; establezca límites explícitos.
- `date`: cadena `YYYY-MM-DD`; `time`: cadena `HH:MM` o `HH:MM:SS`; los formatos iniciales inválidos quedan vacíos. `color`: `#RRGGBB` (`#000000` por defecto).
- `pin`: cadena de dígitos; `length` 3–12 (6 por defecto), `masked` true por defecto, `autoSubmit` false. `section`: `text`, `controls`, layout/align/role opcionales (rol group por defecto); las secciones hijas de profundidad 3 no tienen hijos (controles raíz, profundidad 0).

Eventos de panel: los controles de entrada envían `input`/`change` (la entrada de texto cambia al perder el foco/Enter; textarea al perder el foco/Ctrl-o-Cmd+Enter). Los controles normales también envían `focus`, `blur`, `key`; los metadatos de teclas no se transmiten a la regla. Los botones envían `click` **y** su acción configurada como eventos separados: gestione uno. PIN envía `change` y también `submit` cuando autoSubmit lo completa. Montar/desmontar usa `controlId: ""`, `value: true`. `values` contiene los valores de entrada actuales por ID; excluye botones/texto/HTML. Los eventos no tienen ID de pestaña de origen; use IDs de panel distintos para interacciones específicas de pestaña.

Límites de texto: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; texto de entrada 2000; otras cadenas de valor 512; valor/etiqueta de opción 256. El exceso se trunca.

## Archivos

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Requiere **Carpeta de reglas personalizadas** en Ajustes y su permiso. Safari usa su selector de carpetas nativo y una autorización de acceso con ámbito de seguridad conservada; solo está disponible la carpeta elegida.

- `path` es relativo; `/` separa directorios. Los segmentos permiten letras/dígitos ASCII, espacios y `_.,@()-`; no un punto inicial, `.`/`..`, una ruta absoluta o una URL. Sufijos de archivo: `.txt`, `.csv`, `.json` (sin distinguir mayúsculas). La ruta de list es un directorio; `""` lista la raíz elegida.
- Read devuelve texto UTF-8. Write sustituye/crea; append crea/añade sin salto de línea automático. Las escrituras crean los directorios superiores. Los datos de cadena se escriben literalmente; otros datos JSON se serializan; null/omitido significa texto vacío. Analizar JSON/CSV es tarea de la regla. Tamaño máximo del archivo: 1048576 bytes UTF-8.
- List devuelve los subdirectorios visibles inmediatos y los archivos compatibles. Entradas: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension incluye el punto en los archivos. Exists devuelve un booleano para una ruta de archivo compatible.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Los campos de resultado sin usar son null; con éxito, error está vacío. Los fallos incluyen invalid-path, unsupported-file-type, permiso/carpeta no disponible, archivo ausente y file-too-large. Trate error como cadena, no como enum fijo y exhaustivo. Las solicitudes no garantizan transacciones/orden; serialice las operaciones de lectura-modificación-escritura por ruta.

## Límites

Por evento y grupo: 256 acciones en cola, 200 llamadas de registro, 64 emisiones; el exceso se descarta. Por regla: 1000 manejadores, 24 paneles; cada lista de controles tiene 32 entradas y cada selección 64 opciones; el exceso se ignora/trunca. Las cadenas de emisiones se detienen tras 16 generaciones. Límite de estado serializado: 65536 caracteres de cadena JavaScript. Mantenga el registro y los manejadores combinados de cada evento por debajo de 1 segundo; los excesos repetidos o un tiempo de espera estricto agotado detienen el grupo hasta Ejecutar. El registro conserva 200 entradas, acepta 50/segundo por grupo y trunca mensajes largos cerca de 4096 caracteres. Los temporizadores/respuestas son de mejor esfuerzo, sin garantías de tiempo real.

## Regla completa

Una pausa de cinco minutos, activada mediante Posponer o el botón de su panel:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```
