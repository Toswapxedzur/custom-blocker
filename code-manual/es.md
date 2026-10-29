# Manual de código de la extensión de navegador Vault

[Manual de usuario](../manual/es.md)

## Contrato de las reglas

Código fuente: una expresión de función `(on, v) => { ... }`. Solo se admite JavaScript síncrono y la API indicada abajo; no hay callbacks de programación temporal de JavaScript, red, APIs de extensión ni acceso directo al DOM. Las reglas basadas en el tiempo usan los temporizadores/rastreadores administrados descritos abajo, o `ev.now` y eventos.

- La edición guarda un borrador; **Ejecutar** lo activa y activa el grupo. Los grupos congelados no pueden ejecutar. Un código fuente vacío descarga la regla.
- Una ejecución correcta sustituye los manejadores y paneles, conservando `v.state`. Un fallo de compilación/registro conserva la regla anterior; un tiempo de espera agotado puede detenerla. Recargar el motor vuelve a registrar el último código activado; las variables de los cierres se restablecen.
- El registro puede inicializar el estado, registrar manejadores, mostrar paneles y escribir en el registro. Las acciones de página/archivo y las emisiones deben estar en manejadores; su cola creada durante el registro se descarta.
- Desactivar suprime los manejadores y retira los paneles, hojas de estilo, cubiertas y decisiones sobre elementos gestionados. Activar restaura los paneles/hojas retenidos y vuelve a solicitar elementos. Ejecutar no borra las hojas, cubiertas o decisiones existentes. Eliminar quita la regla, su estado y sus efectos. La navegación, las modificaciones del DOM y las escrituras de archivos no se deshacen.
- Los eventos no están restringidos por los objetivos habituales del grupo; filtre URLs/elementos en la regla. Las acciones se encolan y se aplican después de distribuir el evento. Las excepciones detienen ese manejador sin revertir su estado/acciones; los manejadores posteriores pueden seguir ejecutándose. No hay confirmación de acciones excepto los eventos de archivo/consulta.

## API compartida

- `on(type, handler)` → booleano. Registra `handler(ev)`; varios manejadores se ejecutan en orden de registro. False significa argumentos inválidos o límite de manejadores alcanzado. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` son milisegundos Unix. Los eventos reales de controles renderizados tienen `origin: "user"`; los eventos de `v.emit` tienen `origin: "rule"`.
- `v.state`: objeto JSON mutable, persistido después de distribuir el evento. Inicialice los campos ausentes en lugar de sobrescribir el estado existente. Asignar un valor que no sea objeto o un array lo restablece a `{}`; las actualizaciones no serializables/demasiado grandes no se persisten.
- `v.log(...values)`: escribe en el Registro de este grupo. Los errores de los manejadores y los errores notificados de acciones de página también aparecen aquí; notificarlos no repite las acciones. Los registros/Borrar son independientes por grupo. Los errores de carga aparecen en el estado de ejecución.
- `v.emit(type, data)`: encola una copia JSON de `data` para los manejadores de este grupo después del evento actual, con un `now` nuevo; no es una llamada síncrona.
- `v.panel(id, spec, tabId?)`: sustituye el panel con nombre de este grupo; omita `tabId` para todas las páginas web accesibles o use un ID de pestaña entero. Un `spec` null lo elimina. Véase Paneles.
- `v.file(op, path, payload?)` → cadena con el ID de solicitud. Véase Archivos.
- `v.store(request)` devuelve un ID de solicitud; consulta los registros del grupo.

Las demás llamadas compartidas devuelven `undefined`, excepto las funciones de creación de objetos de tiempo administrados con nombre descritas abajo. Los IDs/estado pertenecen a un grupo, no a su nombre visible.

## Temporizadores administrados y uso en ventana móvil

`v.timer(id, {direction:"down", durationMs:300000})` crea o devuelve una cuenta atrás con nombre, inicialmente en pausa. Use `{direction:"up"}` para un temporizador de cuenta ascendente. El objeto ofrece `start()`, `pause()`, `resume()`, `reset()` y `snapshot()`. Iniciar/reanudar son idempotentes; restablecer lo deja en pausa con cero tiempo transcurrido. Los campos de la instantánea incluyen `ready`, `error`, `elapsedMs`, `remainingMs` (null para la cuenta ascendente), `running` y `completed`.

Los temporizadores en marcha avanzan según el tiempo real transcurrido mientras la aplicación/el navegador están cerrados o la regla está desactivada. Una cuenta atrás completada entrega `timerEnded` con `{id, direction, durationMs, generation, incarnation}` una vez por encarnación y generación del temporizador a cada miembro cuando su regla vuelve a ejecutarse; Ejecutar no lo repite. La entrega depende de los eventos del anfitrión; no es una alarma en tiempo real. Añada `{type:"timer", timerId:"focus", label:"Focus"}` a un panel para mostrarlo mediante el control de texto existente.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` crea o devuelve un rastreador con nombre del uso activo. `assign({websites:["youtube.com","reddit.com"], apps:[]})` sustituye las asignaciones de destinos de este miembro. Las reglas nativas pueden asignar en su lugar identificadores de aplicaciones de la plataforma. Los dominios incluyen los subdominios. Un rastreador agrupa sus destinos; otros identificadores tienen cuotas independientes. `snapshot()` devuelve `ready`, `error`, `usedMs`, `remainingMs`, `available` y `nextReturnAtMs` (el próximo milisegundo en que caduca cualquier uso registrado). `available(target?)` también comprueba la asignación si se proporciona un destino. `reset()` borra el historial de este objeto.

Todo uso observado que reúna los requisitos cuenta, incluido el que supera la cuota; el rastreador por sí solo no bloquea páginas ni aplicaciones. Los intervalos superpuestos de páginas visibles cuentan una vez, y las aplicaciones nativas cuentan el uso observado en primer plano. Las reglas desactivadas no añaden uso; el historial sigue caducando en los límites exactos de los intervalos. La disponibilidad solo se recupera cuando el historial restante está por debajo del límite. Las muestras periódicas se limitan a cinco segundos; los huecos por cierre o desactivación no generan actividad. Los eventos emitidos por el usuario no añaden uso.

Los mismos identificadores de objeto en grupos personalizados vinculados comparten una autoridad local en el concentrador nativo. La vinculación combina el historial y las asignaciones de los rastreadores y conserva el estado del temporizador iniciador; las configuraciones incompatibles impiden vincular. Cada miembro recibe su propio evento de finalización. La desconexión deja los rastreadores compartidos no disponibles y rechaza los controles de temporizador hasta que vuelven a estar disponibles los datos actuales de la autoridad. Al desvincular, cada miembro conserva el uso compartido final y el estado del temporizador, restaura sus propios destinos y descarta los comandos del vínculo anterior. El concentrador conserva la instantánea final hasta que el miembro que regresa la guarda y confirma; las transferencias pendientes terminan antes de que haya un nuevo vínculo disponible.

Los objetos con nombre se conservan al Ejecutar y reiniciar en el campo reservado `v.state.$vaultTime`; no edite ese campo directamente. Elimínelos explícitamente con `v.removeTime(id)`. Los identificadores tienen de 1 a 80 letras ASCII, dígitos, `_` o `-`; se rechazan los nombres de propiedad reservados. Hasta 32 objetos comparten el límite de estado de la regla de 64 KiB en UTF-8. Las duraciones son milisegundos enteros de hasta 365 días. El historial móvil se limita a 1024 bloques de un minuto y 2048 intervalos combinados. Los errores de capacidad del historial dejan el rastreador no disponible hasta que se restablece explícitamente; las configuraciones no válidas y los guardados demasiado grandes notifican errores sin borrar los datos guardados.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Eventos del navegador

La notación de datos siguiente describe tipos; no es código ejecutable. `?` marca campos opcionales.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` es aproximado; use marcas de tiempo, no recuentos de ticks. `active` significa seleccionado dentro de una ventana del navegador, no demuestra que el usuario lo esté mirando. Las URLs pueden estar vacías/restringidas.
- `visible` procede de páginas accesibles y no ocultas; `elapsedMs` es el tiempo desde su último latido, cero mientras están cubiertas. No es uso acumulado ni tiempo de reproducción.
- `items` (`platform: "web"` fuera de sitios reconocidos) informa de elementos nuevos/modificados de fuentes compatibles y los reenvía tras Ejecutar/reactivar. `ref` identifica una tarjeta de esa página, no un ID de contenido duradero; `ref === "page"` denota la propia página. Puede haber títulos/URLs/autores vacíos. `authors` contiene identificadores de fuentes específicos de la plataforma.
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

Por evento y grupo: 256 acciones en cola, 200 llamadas de registro, 64 emisiones; el exceso se descarta. Por regla: 1000 manejadores, 24 paneles; cada lista de controles tiene 32 entradas y cada selección 64 opciones; el exceso se ignora/trunca. Las cadenas de emisiones se detienen tras 16 generaciones. Límite de estado serializado: 65536 bytes UTF-8. Mantenga el registro de la regla y los manejadores combinados de cada evento por debajo de 1 segundo; los excesos repetidos o un tiempo de espera estricto agotado detienen el grupo hasta Ejecutar. El registro conserva 200 entradas, acepta 50/segundo por grupo y trunca los mensajes largos en torno a los 4096 caracteres. Los temporizadores/respuestas funcionan según el mejor esfuerzo, sin garantías de tiempo real.

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


## Llamadas de IA desde una regla activa

Cada grupo personalizado elige conexión/modelo y nivel de razonamiento en **AI calls**. Las reglas de Mac y navegador usan la misma API; las solicitudes del navegador requieren Mac Vault conectado y las credenciales del proveedor permanecen allí. Los grupos vinculados comparten la selección y un límite diario opcional. En blanco significa sin límite de grupo; siguen aplicándose los límites de la cuenta. El límite usa el día UTC, persiste tras reinicio y cuenta intentos enviados, incluidos fallos. Vincular combina el uso previo; desvincular conserva el uso anterior.

El prompt y el contexto guardados se comparten entre grupos vinculados y están disponibles en los handlers como `v.context.ai.prompt` y `v.context.ai.context`. Vault no los envía automáticamente; la regla decide qué incluye en cada llamada `v.ai`.

`v.ai({ prompt, input? })` devuelve un ID de solicitud inmediatamente. Llámala dentro de un handler, no al registrar la regla. `input` acepta cualquier JSON; cada prompt/input está limitado a20KB. Las respuestas llegan como eventos `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`: {requestId, ok, text, citations, error}. Texto exitoso hasta48KB; citas {url,title}. Conserva enlaces de fuente visibles y clicables al mostrar respuestas de búsqueda web. La búsqueda siempre está disponible para el modelo. No hay plazo fijo de la app; la concurrencia es limitada; no hay alternativa de proveedor ni reintento automático. Las respuestas son datos, nunca JavaScript ejecutable; la regla decide qué acciones existentes tomar.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Las llamadas pendientes no se reproducen tras reiniciar. Run, desactivar/activar y eliminar descartan respuestas obsoletas; un navegador desconectado informa `ai-unavailable`. Otros errores: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Las llamadas fallidas no sustituyen un resultado anterior conservado por la regla. El estado mantiene el límite64KB.

Descubre opciones sin credenciales con `rule_ai_models` en Mac o `settings-rule-ai-models` en navegador; configura `ruleAI` mediante la ruta set-group existente. Campos: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) y `dailyRequestLimit` (null o1–100000). Usa una opción devuelta; no incluyas una clave o URL de proveedor en el código fuente.
Los campos guardados opcionales son `prompt` y `context`, cadenas de hasta 16KB cada una.

## Registros del grupo

`v.store(request)` inicia una operación asíncrona de registro JSON dentro de un handler. Los registros son privados del grupo, persisten tras Run y reinicio, y se eliminan con el grupo. Los grupos vinculados tienen registros separados. La regla elige claves, valores, versiones, invalidación de caché y prioridad de comentarios. Mac y navegador usan la misma API, pero cada app/navegador tiene su almacén.

| Solicitud | Resultado |
|---|---|
| `{op:"get", key}` | `record` o `null` |
| `{op:"put", key, value, version?, ifRevision?}` | `record` guardado |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | `entries` ordenadas y `next` |
| `{op:"clear", prefix?}` | recuento `deleted` |

Cada registro contiene `{value, revision, version, updatedAt}`. revision es opaca y cambia con una escritura real; `version` son metadatos del llamador. `list` devuelve encabezados sin valores; usa `get` para leer uno y `after: next` `put` `delete` para la página siguiente. Sin `ifRevision`, put/delete son incondicionales; `null` exige que no exista la clave y una cadena de revisión exige coincidencia exacta. Un conflicto devuelve `ok:false`, `error:"store-conflict"` y el `record` actual. Así una respuesta automática tardía no sobrescribe comentarios del usuario. `v.context.revision` es un marcador opaco de configuración que la regla puede incluir en su versión; el framework no impone política de caché.

Límites: clave 1–2048 caracteres, versión ≤128, valor JSON ≤64KiB, profundidad ≤32, 10000 claves por grupo y documento total de16MiB. `list` devuelve como máximo100 encabezados y96KiB por página. Máximo32 solicitudes por grupo y128 inicios/segundo en total; la sobrecarga informa un `store-busy` por grupo y segundo y descarta las demás. Los errores de almacenamiento devuelven `ok:false`; un documento futuro o malformado se conserva y produce `store-unavailable`. No hay reintentos ni expulsión automáticos. Usa ticks para plazos.

## Adjuntos de contenido guardados

`v.attach(tabId, item, id, spec)` guarda una insignia o una vista pasiva HTML/CSS para un elemento de contenido observado. Pasa el `item` completo de un evento `items` o `attachment`; un `ref` aislado no es un identificador de adjunto. `contentId` identifica el contenido guardado y `instanceId` su aparición actual. Conserva el identificador original mientras esperas a AI. Vault rechaza adjuntos tardíos para objetivos eliminados, reciclados o navegados. `v.item(tabId, ref, verdict)` sigue siendo independiente.

Para una insignia, `spec` es `{type:"pill", text, tone?, tooltip?}`; los tonos son `blue`, `cyan`, `gold`, `pink` y `red`. El texto sin formato admite 240 caracteres y tooltip, 1000. Para una vista, spec es `{type:"html", html, css?, label?}`. Límites: HTML 32000 caracteres, CSS 16000 y label 200. La vista se reconstruye desde HTML/SVG pasivo permitido, dentro de una shadow root cerrada con CSS limitado. Se eliminan scripts, atributos de evento, recursos remotos, embeds y CSS no seguro. La vista queda dentro de la tarjeta y permite desplazamiento a 480px de alto. Los ID admiten 1–80 letras/dígitos ASCII, _ o -. Un spec null elimina la insignia del grupo. Llama desde un handler; los fallos de persistencia/entrega aparecen en Log y no se reintentan automáticamente.

Cada elemento expone los adjuntos de este grupo en `item.attachments` como instantánea de solo lectura; los de otros grupos no aparecen allí. Si los datos no están disponibles, `attachments` es null y se establece `attachmentError`; no significa que la caché esté vacía. Los demás handlers continúan. Usa el ejemplo para no pedir AI de nuevo cuando el contenido ya tiene un resultado guardado.

Las activaciones con puntero, Enter y Space generan un evento `attachment` para el grupo. Las insignias envían `click`. Los controles de una vista usan `data-control` o `id` como `controlId` y envían `click`, `input` o `change`, junto con el `value` actual y los `values` limitados de controles con nombre. Los eventos reales de UI tienen `ev.origin === "user"`; los de la regla, `origin === "rule"`. Incluyen `tabId`, `attachmentId` y el `item` actual. La vista no ejecuta código de reglas. Tanto insignias como vistas impiden que sus interacciones naveguen la tarjeta subyacente. Los datos guardados no contienen callbacks ni código ejecutable; una revisión antigua de pill no puede invocar un adjunto actual. Los eventos emitidos por reglas son lógica ordinaria y el navegador valida por separado los mensajes de clic reales.

Los adjuntos se guardan en este perfil del navegador por grupo/contenido/ID y reaparecen al volver a encontrarlo, navegar, reiniciar el navegador o hacer Run. Disable los oculta y conserva; enable los restaura. Eliminar el grupo borra sus adjuntos. Los grupos vinculados conservan los suyos por separado; no hay sincronización automática entre navegadores/dispositivos. YouTube, Reddit, X y Bilibili conocidos usan ID de plataforma. Otro contenido usa una URL normalizada de forma conservadora, por lo que depende del marcado de página compatible.

Límites: 8 adjuntos por grupo/contenido, 32 por elemento entre todos los grupos, 10000 entradas por grupo y documento serializado de 8MB. Al alcanzar un límite se rechaza la nueva modificación con `attachment-item-limit` o `attachment-storage-limit` en Log; se preservan los datos existentes. Dispatch agrupa las escrituras y no reescribe el almacenamiento con spec idénticos. Los adjuntos son UI de contenido del navegador, también en el motor nativo de reglas de Safari. Las reglas de la app Mac no tienen manejadores de contenido del navegador ni una superficie de adjuntos en la app.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

`code-manual/generic-example.js` es un ejemplo de política ejecutable. Usa registros, llamadas AI, comentarios de usuario, compare-and-swap, controles HTML, decisiones sobre elementos e informes de uso de la regla; esas conductas están en el ejemplo, no son funciones especiales del almacenamiento.
