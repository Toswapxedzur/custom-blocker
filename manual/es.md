# Bloqueador web personalizado - Manual de instrucciones

Este es el manual de referencia completo de la extensión. Comienza con los flujos de trabajo más sencillos y comunes y avanza gradualmente hacia temas avanzados, como reglas de bloqueo personalizadas basadas en eventos y la API auxiliar.

Si eres nuevo, lee **Inicio rápido** y **Descripción general de los grupos de bloques**. Todo lo que se encuentra debajo de esas secciones es opcional, dependiendo de lo que quieras hacer.

---

## 1. Qué hace esta extensión

Custom Web Blocker te permite bloquear sitios web y distracciones en línea según las reglas que tú mismo definas. Puedes:

- Bloquear sitios inmediatamente con el bloqueo de red nativo del navegador (el mismo tipo de bloqueo que produce `ERR_BLOCKED_BY_CLIENT`).
- Permítase una cierta cantidad de minutos por día en un sitio y luego bloquéelo una vez que supere ese límite.
- Bloquee tipos específicos de contenido en Yutub, Tic Toc, Feisbuk, Instagran, Tüich y Rédit (no en todo el sitio).
- Oculte el contenido bloqueado de los feeds en las plataformas compatibles en lugar de bloquear solo páginas individuales.
- Programar cuándo una regla está activa por día de la semana y por ventanas de tiempo `HHMM-HHMM`.
- Congele una regla para que no pueda cambiarla fácilmente. La congelación estricta lo bloquea durante un número específico de horas y requiere un ritual de confirmación de 20 pasos para deshacerlo.
- Posponer una regla temporalmente, pero sólo después de escribir una justificación lo suficientemente larga.
- Escriba reglas personalizadas **basadas en eventos** en lenguaje de guiones con ayudas para temporizadores de avance/retroceso, almacenamiento persistente por grupo, intenciones DOM por plataforma (ocultar botones de navegación, ocultar tarjetas de alimentación por predicado, configurar temporizadores por subsección), utilidades de URL y registro estructurado.
- Elija entre una biblioteca incorporada de más de 50 plantillas listas para usar (temporizadores, programaciones, ocultación de feeds, sesiones de enfoque, redireccionamientos, empujones, persistencia, ajustes de DOM, ayudas de depuración).
- Utilice la extensión en más de 20 idiomas.

La extensión es una extensión navegador Cromo Manifest V3 con una página de editor (la ventana emergente), un trabajador de servicio en segundo plano, una zona de pruebas fuera de la pantalla que aloja código de reglas personalizadas y un script de contenido que se ejecuta en cada página. Las reglas personalizadas se encuentran en la zona de pruebas fuera de la pantalla; se cargan una vez por clic en Ejecutar y permanecen registrados hasta que la regla se deshabilita o elimina.

---

## 2. Recorrido por la interfaz de usuario

Cuando haces clic en el ícono de la extensión, el editor se abre como una página web completa (no como una pequeña ventana emergente). La página tiene estas áreas:

- **Barra superior**
  - Botón **Manual de instrucciones** (este documento)
  - Selector de **Idioma**
  - Equipo de **Configuración** (alternancias avanzadas, incluido el **modo de depuración**)
- **Panel izquierdo: Grupos de bloques**
  - Lista de tus grupos de bloques. Cada tarjeta muestra el nombre del grupo, una breve línea de resumen y una casilla de verificación para habilitar/deshabilitar.
  - El botón **Agregar** crea un nuevo grupo. El menú desplegable al lado elige el tipo.
  - **Eliminar todo** elimina todos los grupos, con confirmaciones adicionales si algún grupo está congelado.
  - Puede arrastrar el controlador `::` de una tarjeta hacia arriba o hacia abajo para reordenar los grupos.
  - Puedes arrastrar el divisor vertical para cambiar el tamaño de este panel.
- **Panel derecho — Editor**
  - Edita el grupo seleccionado actualmente: nombre, comportamiento de bloqueo, listas de bloqueo, filtros de tipo específico, programación, congelación, repetición.
  - Todos los cambios se guardan automáticamente una fracción de segundo después de que dejas de escribir o interactuar.
  - Para grupos **Personalizados**, el editor también muestra el navegador **Plantillas**, el botón **Ejecutar** y el panel **Registro** (rebautizado como *Registro de actividad* en v1.1).
- **Toast** (ventana emergente centrada que se desvanece): muestra mensajes de estado como "Cambios guardados". o errores de entrada.
- **Superposición en la página**: mientras una pestaña tiene un temporizador o bloque activo, aparece una superposición en su esquina superior izquierda que muestra todas las restricciones que la afectan en formato `hh:mm:ss` (o `mm:ss`). Varias restricciones se acumulan en varias líneas. Las cuentas regresivas predeterminadas de los grupos de bloques y los temporizadores de reglas personalizadas comparten esta superposición.

---

## 3. Inicio rápido1. Haga clic en el icono de extensión. El editor se abre como una página completa.
2. En el panel **Grupos de bloques**, elija un tipo de grupo del menú desplegable:
   - `Default`, `Yutub`, `Tic Toc`, `Feisbuk`, `Instagran`, `Tüich`, `Rédit` o `Custom`.
3. Haga clic en **Agregar**. Aparece un nuevo grupo y el editor lo abre.
4. Dale un nombre.
5. Complete los campos específicos del tipo (para `Default`, eso significa la lista **Sitios web bloqueados**).
6. Asegúrese de que la casilla de verificación del grupo en el panel izquierdo esté activada.
7. Visite uno de los sitios enumerados. El bloqueo debería entrar en vigor de inmediato.

Ése es todo el camino feliz. El resto de este manual son sólo opciones adicionales a esto.

> Cuando presiona **Ejecutar** en un grupo personalizado, la nueva regla se adjunta a eventos de página **futuros**. Las pestañas ya abiertas siguen ejecutando la regla anterior hasta que las vuelvas a cargar. La ventana emergente muestra un recordatorio a tal efecto después de cada ejecución exitosa.

---

## 4. Descripción general de los grupos de bloques

Todo en esta extensión está organizado como **grupos de bloques**. Un grupo de bloques es un conjunto de reglas:

- Tiene un nombre, un tipo y un estado habilitado/deshabilitado.
- Tiene un comportamiento de bloqueo (inmediato, tras un número de minutos, o cuenta atrás fija).
- Tiene un horario opcional (días + ventanas de tiempo) y controles opcionales de congelación/posposición.
- Dependiendo del tipo, tiene campos adicionales como una lista de sitios web, filtros de creadores de Yutub, nombres de subreddit o una regla de lenguaje de guiones basada en eventos.

Puedes tener cualquier número de grupos. Se pueden postular varios grupos a la misma página; en ese caso gana la regla **más estricta**:

- "Bloquear inmediatamente" supera a "bloquear después de un tiempo".
- Un grupo al que le queda menos tiempo vence a un grupo al que le queda más tiempo.

Por lo tanto, agregar más grupos solo puede hacer que una página se bloquee lo antes posible, nunca más tarde.

**El orden de evaluación es de abajo hacia arriba.** Cuando la extensión itera sus grupos de bloques, comienza con el grupo al final de la lista y avanza hacia arriba. El grupo en la parte superior de la lista se evalúa en último lugar y obtiene la "última palabra". Por ejemplo, si un grupo inferior llama a `helpers.getPlatformHelper().youtube().hideShortButton()` y un grupo superior llama a `showShortButton()`, el botón permanece visible. Arrastre el controlador `::` en una tarjeta para cambiar este orden.

---

## 5. Tipos de grupos

### 5.1 `Default`: bloquea sitios web comunes

Para bloquear dominios específicos (el caso de uso típico).

- **Sitios web bloqueados**: un sitio por línea. Tanto `facebook.com` como `https://www.facebook.com/somepage` funcionan; la extensión extrae y normaliza el nombre de host.
- Se aplica una regla del sitio a ese nombre de host y a todos sus subdominios.
- Este tipo de grupo utiliza el bloqueo de red nativo de navegador Cromo, similar a `ERR_BLOCKED_BY_CLIENT`. Eso significa que la navegación a una URL bloqueada se detiene incluso antes de que se cargue la página.

### 5.2 `Yutub`: bloquea Yutub y sitios de vídeos similares

Agrega una sección **Filtros** al editor:

- **Tipo de contenido**:
  - `Apply to all Yutub pages`: cada página de Yutub cuenta.
  - `Apply to Shorts`: solo cuentan las páginas de cortos.
  - `Apply to long videos` — solo `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to Yutub posts`: publicaciones de la comunidad (`/post/...`, pestañas de publicaciones/comunidad del canal).
- **Filtro de autor**:
  - `Do not filter by author`: la identidad del autor no importa.
  - `Apply to certain authors`: solo los autores enumerados activan este grupo.
  - `Apply to all except certain authors`: los autores enumerados están exentos.
- **Autores**: un autor por línea. Acepta `@handle`, URL completas, `/channel/UC...`, `/c/...`, `/user/...`.
- **Ocultar entradas bloqueadas en el feed de Yutub**: mientras este grupo está bloqueando activamente, las tarjetas coincidentes en el feed de Yutub están ocultas. Cuando el bloque queda inactivo, vuelven en la siguiente actualización.

Para los tipos de contenido de Cortos y Publicaciones, cuando no se establece ningún filtro de autor y el grupo está actualmente bloqueado, la extensión también oculta las entradas de navegación relevantes (entrada de la barra lateral de Cortos, pestañas del canal Comunidad/Publicaciones) y los estantes correspondientes, como "Últimas publicaciones de Yutub".

La detección de corto versus largo se extiende a otros sitios de videos como Tic Toc, Vimeo, clips/VOD de Tüich y Dailymotion cuando se puede detectar el formato de su página.

### 5.3 `Tic Toc`: bloquear contenido de Tic Toc

Misma tarjeta de editor que el editor de vídeo de la plataforma, pero con etiquetas específicas de Tic Toc:- Tipos de contenido: vídeos cortos, vídeos, páginas de perfil.
- Autores: identificadores de Tic Toc (`@handle`) o URL de perfil.
- La ocultación del feed oculta las tarjetas coincidentes en las páginas de Tic Toc mientras el grupo está activo.

### 5.4 `Feisbuk`: bloquear contenido de Feisbuk

- Tipos de contenido: Reels, videos, posts.
- Autores: nombre de la página (`page.name`), URL del perfil o formulario `profile.php?id=...` (la identificación numérica se conserva como `id:<number>`).
- La ocultación de feeds oculta las tarjetas de feeds coincidentes en Feisbuk.

### 5.5 `Instagran` — bloquear contenido de Instagran

- Tipos de contenido: Reels, videos, posts.
- Autores: identificadores de Instagran o URL de perfil.
- Las rutas reservadas como `/reel/`, `/p/`, `/tv/`, `/explore/` no se tratan como autores.
- La ocultación del feed oculta tarjetas coincidentes en Instagran.

### 5.6 `Tüich`: bloquear contenido de Tüich

- Tipos de contenido: clips, transmisiones/VOD, páginas de canales.
- Autores: nombres de canales o URL de canales.
- Las rutas reservadas como `/directory`, `/videos`, `/settings`, etc. no se tratan como nombres de canales.
- La ocultación del feed oculta tarjetas coincidentes en Tüich.

### 5.7 `Rédit`: bloquear Rédit o subreddits específicos

- **Subreddits**: un subreddit por línea. La lista vacía significa que el grupo se aplica a todo Rédit. Se aceptan tanto `productivity` como `r/productivity`.

### 5.8 `Custom`: bloqueo mediante lenguaje de guiones controlado por eventos

Escribe una función de lenguaje de guiones que **registra controladores** para eventos como apertura de página, cambio de URL, latidos de página, finalización del temporizador y sus propios eventos personalizados. La función se ejecuta una vez por clic en Ejecutar; los controladores registrados permanecen activos en todas las navegaciones hasta que presione Ejecutar nuevamente, deshabilite el grupo o lo elimine.

Los grupos `Custom` no muestran: comportamiento de bloqueo, sitios bloqueados, minutos permitidos, intervalo de reinicio, días programados o ventanas de tiempo. Mantienen el editor de **Reglas de bloqueo** además de controles estándar de congelación/posposición. También hay un botón **Plantillas** que abre un navegador preestablecido con reglas iniciales parametrizadas; La aplicación de un ajuste preestablecido reemplaza la regla actual después de la confirmación.

Consulte la **Sección 11** para obtener la referencia completa de reglas personalizadas y la API de ayuda.

---

## 6. Comportamiento de bloqueo

Para la mayoría de los tipos de grupos, usted elige uno de los tres modos.

### 6.1 Bloquear inmediatamente

La regla está activa siempre que el grupo está activo, el horario lo permite y (para grupos de plataforma) la página coincide.

Para los grupos `Default`, esto utiliza el bloqueo nativo de navegador Cromo. Para los grupos de plataformas, utiliza la lógica de superposición/salida en la página.

### 6.2 Bloquear después de varios minutos

Este es un presupuesto de uso.

- **Minutos permitidos antes del bloque** (decimal): cuántos minutos te permites por período. Ejemplo: `15`, `0.5`, `90`.
- **Intervalo de reinicio del temporizador (horas)** (decimal): con qué frecuencia se reinicia el presupuesto. Ejemplo: `24` por día, `1` por hora, `0.25` por cada 15 minutos.

Si bien le queda tiempo, la página funciona normalmente y muestra el temporizador superpuesto. Cuando el presupuesto llega a cero, la página se bloquea por el resto del período y la superposición muestra `0:00`, luego la pestaña intenta salir.

La extensión es por grupo, por período:

- Cada grupo tiene su propio presupuesto.
- El tiempo dedicado a cualquier página que coincida con el grupo cuenta para el presupuesto de ese grupo.
- Varias pestañas del mismo grupo comparten el presupuesto. Sus temporizadores permanecen sincronizados; cambiar a otra pestaña también fuerza una actualización para que muestre el tiempo compartido actual inmediatamente.

Si se aplican varios grupos de tiempo limitado a la misma página, gana el más estricto.

### 6.3 Temporizador (cuenta regresiva y luego bloqueo)

Este modo muestra un temporizador de cuenta atrás y se bloquea una vez que llega a `0:00`.

- **Intervalo de reinicio del temporizador (horas)** (decimal): tanto la duración del temporizador como la frecuencia de reinicio. Ejemplo: `24` por día, `1` por hora, `0.25` por cada 15 minutos.

A diferencia de **Bloquear después de varios minutos**, este modo **no** tiene un campo separado "Minutos permitidos antes del bloqueo". El temporizador simplemente comienza en el intervalo de reinicio, cuenta atrás mientras las páginas coincidentes están abiertas y luego se bloquea hasta el siguiente reinicio.Las cuentas regresivas del grupo predeterminado y los temporizadores del grupo personalizado (consulte **Sección 11.3.1**) **sólo avanzan mientras la pestaña está visible**. Cambiar de pestaña, minimizar la ventana o bloquear la pantalla detiene la cuenta regresiva automáticamente.

---

## 7. Horario

En la tarjeta **Programación** puedes restringir cuándo un grupo está activo:

- **Días a bloquear**: elige los días que aplica el grupo. Los días no marcados significan que el grupo está inactivo ese día.
- **Ventanas de tiempo**: lista de formato libre, una ventana por línea en formato `HHMM-HHMM`, por ejemplo:

  ```
  0900-1000
  1200-1300
  ```

  El grupo está activo sólo dentro de esas ventanas. Lista vacía significa todo el día.

Esto se aplica a todos los tipos de grupos excepto `Custom`. (Las reglas personalizadas pueden implementar su propia programación usando `ev.time.dayName` / `ev.time.hour`; consulte **Sección 11.4**).

---

## 8. Congelar (antimanipulación)

La congelación hace que sea difícil desactivar a un grupo por impulso.

En la tarjeta **Congelar** eliges:

- **Congelado**: no puedes editar ni eliminar el grupo, y no puedes desmarcar su palanca de activación. Para cambiar algo, debes ejecutar el ritual de descongelación (ver más abajo).
- **Congelación estricta**: igual que Congelada, pero permanece bloqueada durante la cantidad de horas que elijas (decimal, hasta 72). Hasta que expire ese temporizador, ni siquiera el ritual de descongelación estará disponible.

Cuando un grupo congelado se puede desbloquear, aparece el botón **Descongelar**. Al hacer clic en él se inicia el **ritual de 20 pasos**:

- El modal muestra un mensaje de autodisciplina.
- Debes hacer clic en `Confirm` 20 veces.
- Hay una espera forzada de 5 segundos entre clics.
- Si cancelas en algún momento, deberás reiniciar desde el paso 1.
- Los 20 mensajes rotan para que realmente los leas.

Si el grupo también está marcado como "sin repetición" (consulte la siguiente sección), tampoco podrá posponerlo mientras esté congelado.

El estado de congelación se muestra en la línea meta de la tarjeta del grupo, incluido el tiempo restante para la congelación estricta.

---

## 9. Posponer (desactivar temporalmente)

Posponer desactiva temporalmente un grupo sin descongelarlo. Admite activación retrasada, tiempo de reutilización posterior a la repetición, pasos de confirmación y un total acumulado del tiempo de repetición.

En la tarjeta **Posponer**:

- **Permitir posponer para este grupo**: si está desactivado, este grupo no se puede posponer en absoluto (incluso mientras está congelado).
- **Posponer durante (minutos)** — decimal, cuánto dura la repetición.
- **Retraso de activación (minutos)** — decimal `>= 0`. Después de confirmar la repetición, el grupo continúa bloqueándose hasta que pase este retraso; sólo entonces se activa la repetición de alarma.
- **Enfriamiento después de la repetición (minutos)**: decimal de `0` a `5`. Una vez finalizada la repetición, no podrás iniciar otra repetición para este grupo hasta que finalice el tiempo de reutilización.
- **Horas de confirmación** — entero `>= 0`. Si es `0`, la repetición se programa inmediatamente. De lo contrario, al iniciar la repetición se inicia un ritual de confirmación con exactamente esa misma cantidad de pasos.

Cada paso de confirmación de repetición tiene una **espera de 5 segundos** forzada antes de que se permita el siguiente clic. El modal te dice esto explícitamente y muestra la cuenta regresiva en vivo en el botón.

Si el grupo está congelado, la configuración de repetición se bloquea en los valores elegidos antes de la congelación. Aún puedes posponerlo, siempre que esté permitido, pero debes usar la configuración guardada de retraso/enfriamiento/confirmación.

La tarjeta Posponer también muestra **Tiempo total de repetición** para ese grupo. Este total cuenta la duración total de la repetición activa incluso si se puede acceder al sitio por algún otro motivo durante ese período.

Cuando termina una repetición, la regla vuelve inmediatamente. Si el grupo aún no estaba congelado, la extensión lo congela automáticamente nuevamente al finalizar la repetición.

Un mensaje de estado confirma la repetición. Cuando termina la repetición, el grupo vuelve automáticamente a la normalidad.

También puedes finalizar una repetición antes de tiempo con el botón **Finalizar repetición**.

Para grupos personalizados, al presionar **Iniciar repetición** también se envía un evento `snoozePress` a la regla (consulte la tabla de eventos en la **Sección 11**), por lo que una regla personalizada puede registrar la prensa, registrar una justificación o activar eventos de seguimiento. La regla **no tiene API de repetición programática**: puede reaccionar a la prensa, pero no puede cancelarla ni extenderla.

---

## 10. Acciones masivas- **Eliminar todo** elimina todos los grupos.
  - Siempre pide confirmación.
  - Si al menos un grupo está congelado, se requiere el mismo ritual de 20 pasos que para descongelar.
  - Si algún grupo está estrictamente congelado y aún bloqueado, **Eliminar todo** está deshabilitado.

---

## 11. Grupos personalizados: referencia basada en eventos (v1.1+)

A partir de la versión 1.1, las reglas personalizadas están **basadas en eventos**. Su regla ya no es una función por latido cuyo valor de retorno bloquea la página. En cambio, el cuerpo de la regla es una secuencia de comandos que **registra controladores** para eventos específicos (apertura de página, cambio de URL, latidos de página, eventos personalizados,…). Los controladores permanecen registrados a través de la navegación de páginas y los cambios de pestañas y viven dentro de una **zona de pruebas fuera de la pantalla** de larga duración.

El cuerpo de la regla se ejecuta **una vez por clic en Ejecutar** (o una vez cuando el grupo está habilitado y ya existe una fuente activa). Para volver a cargar los controladores, haga clic en **Ejecutar** en el editor. La ventana emergente muestra un recordatorio que le pide que vuelva a cargar cualquier página ya abierta para que la nueva regla se aplique allí también.

### 11.1 Firma de regla

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Dos argumentos:

- `event`: el **registro de eventos** para este grupo. Úselo para registrar, anular, enumerar, contar o cancelar el registro de controladores y para eventos personalizados `post(...)`.
- `helpers`: el paquete de ayuda (consulte **11.3**).

**No** se espera que la función devuelva un valor. La decisión de bloquear o permitir se toma más tarde, cuando se activa un evento y uno de sus controladores registrados llama a `ev.preventDefault()` y/o `ev.setResult(...)`.

### 11.2 Ciclo de vida

- **Ejecutar** (botón por grupo en el editor): el motor primero borra todos los controladores que fueron etiquetados previamente con este grupo, luego vuelve a ejecutar el cuerpo de la regla en el entorno limitado fuera de la pantalla. Esta es la única forma de volver a registrarse después de editar la fuente.
- **Desactivar grupo**: todos los controladores etiquetados con este grupo se eliminan. La fuente del grupo se mantiene almacenada pero deja de responder a los eventos.
- **Reactivar grupo**: el motor vuelve a ejecutar automáticamente la fuente activa para este grupo.
- **Eliminar grupo**: igual que desactivar; todos los controladores etiquetados con el grupo se eliminan.
- **Volver a registrar con el mismo `(eventType, id)`**: anula silenciosamente el registro anterior.

La zona de pruebas fuera de la pantalla es compartida por **todos** los grupos personalizados. Allí coexisten controladores de diferentes grupos, cada uno etiquetado internamente con su ID de grupo propietario para que "Ejecutar", deshabilitar o eliminar solo toque el grupo correcto.

Si una regla personalizada no se comporta correctamente (bucle infinito síncrono, spam de registros descontrolados, etc.), el sandbox la pone en cuarentena: el grupo se desactiva automáticamente y el error se registra para que pueda verlo en el panel Registro. Para volver a habilitar una regla en cuarentena, corrija la fuente y haga clic en **Ejecutar**: el motor borra el motivo de la cancelación y vuelve a cargar la regla.

### 11.2.1 El registro de eventos (`event`)

Métodos genéricos:

- `event.register(type, id, handler, options?)`: registra un controlador para un tipo de evento arbitrario. `id` es su propia elección. `options.priority` (predeterminado `0`): las ejecuciones superiores primero. `options.intervalMs`: solo para `tickEvent`; acelerar este controlador específico en relación con el tick global. Volver a registrarse con las mismas anulaciones `(type, id)`.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })`: activa un evento personalizado. `scope: "global"` llega a todos los grupos; El valor predeterminado `scope: "group"` solo llega a los controladores en el **mismo** grupo.

Azúcar por tipo de evento (un conjunto de métodos por tipo integrado):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Misma forma para `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Tipos de eventos integrados

| Tipo | Cuando se dispara | Carga útil `ev.data` |
|---|---|---|
| `tickEvent` | Tic de 1 segundo compartido globalmente en todo el navegador. Se dispara independientemente de la visibilidad de la pestaña. Utilice esto para una lógica de estilo reloj que debe seguir ejecutándose incluso cuando no hay ninguna pestaña enfocada. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | ~ 250 ms de latido desde la pestaña **activa**, **visible**. Impulsa toda la lógica que tiene en cuenta la visibilidad de las pestañas, incluida la marca automática integrada en `getOrCreateTimer({ scope })`. **No** se activa desde pestañas en segundo plano o mientras la pantalla está bloqueada. | `{ elapsedMs }` |
| `openWebEvent` | Se crea una nueva pestaña O una nueva navegación llega a una URL que el motor aún no ha visto para esa pestaña. **No** se vuelve a activar para pestañas ya abiertas después de hacer clic en Ejecutar. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Una pestaña está cerrada. | `{ reason, nextUrl }` |
| `switchWebEvent` | La URL **cambia** dentro de la misma pestaña: atrás/adelante, cambio de ruta SPA o una navegación que llega a una URL diferente a la anterior. **No** se activa con una recarga simple (misma URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | El cambio de URL cruza un límite de nombre de host (por ejemplo, `youtube.com` → `wikipedia.org`). Dispara junto a `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | La página (re)carga de cualquier manera: abrir, cambiar, actualizar el historial de SPA, **o una recarga simple que mantiene la misma URL**. Este es el gancho confiable "la página cambió, reevalúe todo". Se activa junto con `openWebEvent` / `switchWebEvent` / `switchDomainEvent` y es el único que se activa para recargas de la misma URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` donde `transition` es `"tabCreated"`, `"commit"` o `"history"` |
| `timerEnded` | Un temporizador gestionado por el grupo llega a `currentMs === 0`. Sólo se entrega al grupo propietario. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | El usuario presionó **Iniciar repetición** en la ventana emergente de este grupo **personalizado**. Evento de notificación pura: el controlador puede ejecutar código arbitrario (registrar, redirigir, activar otros eventos) pero las reglas personalizadas **no tienen API de repetición programática**. Los registros producidos aquí aparecen como brindis en la pestaña activa. Sólo se entrega al grupo prensado. | `{ triggeredAt }` |

Las URL en `ev.url` y en los datos de eventos están **normalizadas** para eventos: la página Nueva pestaña de navegador Cromo (que muestra la superficie "Buscar en Google o escribir URL"), `about:blank` y esquemas de nueva pestaña equivalentes se exponen como la cadena vacía `""`. Por lo tanto, un temporizador cuyo alcance es `ev.url === ""` solo funciona mientras estás en la página de nueva pestaña. Las URL `google.com` habituales no se modifican.

### 11.2.3 El objeto de evento (`ev`)

Cada controlador se invoca como `(ev, helpers) => void`. `ev` lleva:

- `ev.type`: el tipo de evento enviado.
- `ev.groupId`: ID del grupo receptor.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname`: contexto del evento.
- `ev.time` — Instantánea de `{ now, month, dayOfMonth, dayName, hour, minute }` en el momento del envío. `dayName` es `"Sunday"`..`"Saturday"`.
- `ev.data`: carga útil específica del evento (consulte la tabla anterior).

Métodos:

- `ev.preventDefault()`: marca el envío como "bloqueado". El script de contenido del host saldrá de la página (o seguirá `setRedirectLink`) a menos que un controlador de mayor prioridad establezca posteriormente `setResult(1)`.
- `ev.stopPropagation()`: detenga este envío inmediatamente. **No se invocan más controladores en ningún grupo** para este evento.
- `ev.setResult(value)`: establece el resultado del envío. `value` puede ser un **número** en `[-255, 255]` (bloque `-1`, `0` neutral, `1` permitido; otros números enteros se conservan para su propia lógica de depuración), o una **cadena** (interpretada como una URL de redireccionamiento). Gana la última llamada `setResult` entre todos los controladores. Un `1` numérico anula cualquier `preventDefault` anterior.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()`: la URL a la que debe navegar el host cuando el envío finaliza como bloqueado. Esta es la **única** forma de redirigir desde reglas personalizadas; el editor ya no muestra el campo "Redireccionar URL cuando está bloqueado" para grupos personalizados.
- `ev.post(type, data, { scope })`: activa un evento de seguimiento desde dentro de un controlador.

Además, `ev` es un Proxy: cualquier campo que establezca en él (por ejemplo, `ev.foo = 42`) se almacena en un mapa `custom` y se puede leer desde el mismo controlador o desde controladores posteriores en el mismo despacho.### 11.3 El objeto `helpers`

Cada llamada del controlador obtiene un paquete `helpers` nuevo cuyo ámbito es el grupo receptor y la URL del evento. Campos constantes:

- `helpers.now`: milisegundos de época en el momento del envío.
- `helpers.currentUrl`: la URL del evento, después de la normalización de nueva pestaña/espacio en blanco.
- `helpers.groupId`: ID del grupo receptor.

Accesos directos convenientes (dirigen a las mismas funciones compatibles con el acumulador utilizadas por los ayudantes a continuación, por lo que el resultado aún llega al panel Registro):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Métodos de acceso:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. La producción tiene una velocidad limitada y un límite por envío para evitar que reglas incontroladas congelen la ventana emergente.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`): inspección de URL (consulte **11.3.5**).
- `helpers.getTimerHelper()` — temporizadores de alcance grupal (cuenta regresiva / cuenta ascendente); El estado persiste después de reiniciar el navegador.
- `helpers.getPersistenceHelper()`: almacén de claves/valores JSON con alcance para el grupo.
- `helpers.getRedirectionHelper()`: `setRedirectLink(url)` / `getRedirectLink()` (y alias `set` / `get`) más `createMessageUrl(message)` que devuelve una URL `chrome-extension://...` que muestra el mensaje proporcionado.
- `helpers.getPlatformHelper()`: intents DOM por plataforma (consulte **11.3.6**).
- `helpers.getDOMHelper()`: intenciones DOM genéricas: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Las operaciones se agrupan y aplican después de que regresa el controlador.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Los efectos se aplican a la pestaña de donde proviene el evento.
- `helpers.getStorageHelper()`: superconjunto de `getPersistenceHelper` más ganchos asíncronos `requestAsyncGet(key)` / `requestAsyncSet(key, value)` para almacenamiento entre extensiones (los resultados llegan como un evento personalizado de seguimiento).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` frente a una instantánea incluida con el evento.

Todos los métodos auxiliares son seguros: los parámetros incorrectos devuelven `null`, `false` o un valor vacío en lugar de arrojarlo.

#### 11.3.1 `getTimerHelper()`

Temporizadores por grupo. Cada temporizador se identifica mediante una cadena `id` que usted elija; La identidad tiene como ámbito el grupo, por lo que dos grupos pueden usar el ID `"yt-shorts"` sin colisionar. El estado persiste después de reiniciar el navegador.

El estado persistente de un temporizador es exactamente: `id`, `displayName`, `direction` (`"forward"` o `"backward"`), `isPaused` y `currentMs`. No hay una "duración inicial" almacenada: `isExpired` es solo `currentMs === 0`. Los temporizadores de avance funcionan para siempre y nunca caducan por sí solos. Los temporizadores hacia atrás dejan de funcionar en `0` (sin valores negativos).

Hay dos métodos de construcción. Elija aquel cuya semántica coincida con lo que desea:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })`: **siempre (re)crea** el temporizador con los valores de inicio proporcionados, sobrescribiendo cualquier estado existente, incluido `currentMs`. Utilice esto cuando quiera decir "empezar de nuevo", p. dentro de una rama de reinicio de un solo disparo.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotente**. Si ya existe un temporizador con ese `id`, es posible que se actualicen sus `displayName` y `direction`, pero se conserva el `currentMs`. De lo contrario, se crea con los valores de inicio proporcionados. Esto es lo que desea para el patrón común "asegúrese de que mi temporizador exista y luego déjelo funcionar".

Ambos métodos aceptan dos funciones de predicado que el motor recuerda durante la vida útil de la regla (sobreviven a través de latidos y reevaluaciones de `webChangedEvent`, pero **nunca persisten** en el almacenamiento):- `scope: (url) => boolean`: cuando `true` es la URL visible actual en cada `pageHeartbeatEvent`, el temporizador avanza automáticamente según el intervalo de latido (~250 ms). El ayudante nunca bloquea; solo actualiza `currentMs`. Como máximo un tick automático por latido y por temporizador.
- `domain: (url) => boolean`: cuando `true` es la URL visible actual, el temporizador se representa en la superposición de la página (arriba a la izquierda). Cuando se omite `domain`, el motor vuelve a `scope` para su visualización, por lo que también aparece un temporizador de "marca en /cortos/páginas" sin cableado adicional. Proporcione `domain` explícitamente si desea una puerta de visualización diferente (por ejemplo, marque solo en `/shorts/`, pero muestre el tiempo restante en todo `youtube.com`).

> **Importante: un temporizador nunca se bloquea por sí solo.** Cuando un temporizador hacia atrás llega a cero, simplemente se detiene en cero y dispara `timerEnded` una vez. Bloquear realmente la página depende de un controlador `openWebEvent` / `switchWebEvent` separado que llama a `ev.preventDefault()` después de verificar `helpers.getTimerHelper().isExpired(id)`. Esta separación le permite crear temporizadores de "sólo advertencia", rastreadores de conteo, empujones suaves o bloques duros; la misma primitiva, usted elige.

Otros métodos:

- `delete(id)`, `pause(id)`, `resume(id)`: ciclo de vida estándar. La pausa congela `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)`: mutadores directos (la mayoría de las reglas no los necesitan; deja que los latidos del corazón marquen el cronómetro por ti).
- `setDisplayName(id, name)` — volver a etiquetar.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` y si `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` o `null`.
- `list()`: cada temporizador que posee este grupo, como una matriz de objetos de estado.

#### 11.3.2 `getPersistenceHelper()`

Almacenamiento similar a un mapa con alcance para su grupo. Los valores deben ser serializables en JSON.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Límites flexibles: alrededor de 200 claves por grupo, 16 KB por valor.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)`: escriba en el panel **Registro** en la ventana emergente (el paquete auxiliar aún los enruta a través del mismo acumulador sin importar qué despacho los haya producido). Cada línea tiene el prefijo `[CustomBlocker:groupId]`.
- El asistente tiene límites estrictos: aproximadamente **200 entradas de registro por envío** y una longitud máxima de cadena por entrada. Las entradas sobrantes se descartan y cuentan en `accumulator.logsDropped`. Esto es lo que protege la ventana emergente de una fuga de `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Cuando el **modo de depuración** está desactivado (predeterminado), las entradas de nivel de seguimiento que emite el propio motor (inicio de envío/temporización del controlador) se suprimen en todas partes: no se muestran en el panel Registro y no se imprimen en la consola. Sus propias llamadas `log` / `warn` / `error` siempre se realizan.

#### 11.3.4 `getRedirectionHelper()`

Inspeccione/anule la URL de redireccionamiento que utilizará el script de contenido si la página actual termina bloqueada.

- `get()`: devuelve la URL de redireccionamiento efectiva actual para este envío. Inicialmente, esta es la URL alternativa configurada del grupo integrado (si la hay); de lo contrario, `""`.
- `set(url)`: anula la URL de redireccionamiento para este envío. Devuelve `true` en caso de éxito, `false` para entradas que no sean cadenas. Pasar `""` borra la anulación de redireccionamiento y vuelve al comportamiento de salida predeterminado normal.
- `createMessageUrl(message)`: devuelve una URL `chrome-extension://<id>/message-page.html?msg=...` que, cuando se navega, muestra el mensaje centrado en una página limpia. Útil para redirigir a los usuarios a una pantalla "Ir a trabajar"/"Tomar un descanso" después de que finaliza el cronómetro. Ejemplo: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Al igual que los demás efectos secundarios de las reglas personalizadas, este estado se comparte entre todas las reglas del envío actual. Debido a que las reglas se ejecutan de abajo hacia arriba, gana la regla superior para llamar a `set(...)`.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

Ayudantes de inspección de URL. No hay `normalize()` porque las URL entrantes ya están normalizadas con nuevas pestañas.

Centro:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()`: cada uno devuelve `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Filtrado de URL y ayudantes de sección:

- `isEmptyStartPage(url)` — `true` para la página de nueva pestaña y equivalentes (las URL que se muestran como `""` para los controladores).
- `matchesAny(url, patterns)`: `patterns` puede ser una expresión regular, una expresión regular de cadena o una matriz de ambas.
- `pathStartsWith(url, path)`: reconocimiento de límites (`pathStartsWith("/r/", "/r")` es verdadero; `"/results/"` no lo es).
- `queryHas(url, key, value?)`, `queryGet(url, key)`: inspección de cadenas de consulta.
- `isSearchPage(url)`: reconoce las búsquedas de Google / Bing / DuckDuckGo / Yutub / Rédit / Tuiter / X.
- `isInfiniteFeedUrl(url)`: reconoce las superficies de alimentación algorítmica de Yutub, Tic Toc, Instagran, Feisbuk, Rédit, X.
- `sameSection(a, b)`: mismo nombre de host Y mismo primer segmento de ruta.

#### 11.3.6 `getPlatformHelper()`

Intenciones DOM por plataforma y temporizadores de subsecciones, además de inspección. Cada `helpers.getPlatformHelper().<platform>()` devuelve un objeto cuyo conjunto de métodos está **regulado por la plataforma**; los métodos que no tienen sentido en una plataforma determinada simplemente están ausentes, por lo que llamarlos arroja `TypeError: ... is not a function` en lugar de no operar silenciosamente. Por ejemplo, `twitch().hidePosts` no existe (Tüich no tiene publicaciones) y `tiktok().hideShortButton` no existe (toda la experiencia de Tic Toc ya _es_ un video de formato corto). Utilice `helpers.getPlatformHelper().hasMethod(platform, name)` o `.listMethods(platform)` para realizar una introspección en tiempo de ejecución.

Matriz de métodos por plataforma:

| método | youtube | tik tok | Instagran | facebook | contracción |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (chat) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Los nombres nativos de la plataforma (`hideReels`, `hideClips`, `hideStreams`) NO son depósitos separados de `hideShorts`/`hideVideos`: la ranura de almacenamiento es la misma; sólo el nombre visible para el usuario sigue la terminología de cada plataforma.

> **Regla de vida útil y ranura única del predicado.** Cada uno de `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` posee **un** predicado persistente por `(group, platform, slot)`. El predicado **no** tiene como alcance el evento actual; una vez que lo configura, permanece activo en cada carga de página y en cada envío hasta que se llama al `show*()` coincidente o se descarga el grupo. Llamar nuevamente al mismo método con una nueva función **reemplaza** la anterior: el motor nunca combina OR múltiples predicados dentro de un solo grupo. Para combinar condiciones, escriba un predicado que combine usted mismo, p. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. En grupos **diferentes**, cada grupo aporta su propio predicado y un elemento se oculta si el predicado de algún grupo coincide.

Los métodos de inspección toman su valor en el momento del envío a partir de una instantánea incluida con el evento; su disponibilidad está determinada por la matriz anterior.

Los clasificadores de URL siempre se vuelven a exponer independientemente de la plataforma: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Los temporizadores de subsección registran el temporizador en el grupo persistente y, cuando tienen alcance, solo marcan las URL que coinciden con esa subsección. Los métodos de temporizador aceptan `{ id, direction, currentMs, displayName }` y siguen la misma sincronización por plataforma.

Para los métodos de predicado, el predicado se llama por tarjeta coincidente con un `item`: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }` normalizado. Cualquier campo puede ser `null`; "inocente hasta que se demuestre lo contrario": devuelve `false` cuando falta el campo que necesitas.

### 11.4 Ejemplos

**Fácil**: bloquea las páginas de Yutub Shorts las mañanas de los días laborables:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Medio**: presupuesto diario de 30 minutos para cortos de Yutub. El temporizador marca automáticamente los `pageHeartbeatEvent` mientras la URL de Shorts está visible; un controlador separado impone el bloqueo cuando el temporizador llega a cero.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Más difícil**: oculta cortos de Yutub individuales cuyo identificador de autor sea demasiado largo e inyecta un CSS que diga "este corto está oculto":

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Más difícil**: transmite un evento personalizado de un controlador a otros:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Plantillas

Cada grupo personalizado tiene un selector **Plantillas** que abre un navegador preestablecido con capacidad de búsqueda. La biblioteca ahora incluye **más de 50 plantillas** organizadas en nueve categorías para que puedas navegar en lugar de escribir reglas desde cero:

| Categoría | Ejemplos |
|---|---|
| **Temporizadores** | Presupuesto de tiempo del sitio (cuenta regresiva + bloqueo), rastreador de tiempo del sitio (cuenta ascendente), límite de cortos de Yutub, límite de feed de Tic Toc, límite de carretes de Instagran, límite de carretes de Feisbuk, límite de clips de Tüich, presupuesto de distracción universal, rastreador diario de trabajo profundo |
| **Horario** | Bloque de horas de trabajo entre semana, sitios solo los fines de semana, cierre antes de acostarse, permitir solo una hora, noticias solo durante el almuerzo, comenzar de nuevo los lunes, permitir los primeros N minutos de cada hora, bloque estricto de trabajo profundo |
| **Alimentación / Cortos** | Bloquee las URL de cortos de Yutub, oculte tarjetas de cortos, oculte cortos por palabra clave, oculte el feed de inicio/comentarios/tendencias de Yutub, bloquee Tic Toc FYP, oculte cortos de Tic Toc, bloquee las URL de Instagran Reels, oculte el feed de Instagran Reels, oculte el feed/Reels de Feisbuk, oculte la página de inicio de Rédit/Tuiter/LinkedIn |
| **Redirigir** | Distracciones → página de enfoque, Cortos → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, nueva pestaña → lista de tareas |
| **Enfoque** | Sesión de enfoque solo para lista blanca, Pomodoro 25/5, bloqueo durante la reunión, bloqueo después de N visitas hoy, bloqueo en racha de pérdidas |
| **Empujar** | Registra cada visita de distracción, advierte sobre cada visita de Shorts, cuenta las visitas diarias a un sitio |
| **Persistencia** | Límite de visitas mensuales, alternancia de prohibición semanal, seguimiento de los canales de Discor visitados |
| **Ajustes DOM** | Ocultar alternancia de reproducción automática de Yutub, ocultar Tuiter / X "Qué está pasando", genérico "ocultar selectores en un sitio" |
| **Depurar** | Cuenta atrás de demostración (3 s), registra cada evento personalizado |

Los chips de filtro en la parte superior del selector reducen la lista por categoría (`Timer`, `Schedule`, `Feed`,…) y plataforma (`Yutub`, `Tic Toc`, `Instagran`,…). Seleccionar una plantilla:

1. Carga sus entradas de parámetros (URL, minutos, rangos de horas, etc.) en un formulario pequeño.
2. **Aplicar ajuste preestablecido** muestra una vista previa de la fuente generada.
3. Después de confirmar **¿Reemplazar la regla personalizada actual con este ajuste preestablecido?**, la fuente se escribe en el editor.
4. Luego haga clic en **Ejecutar** para registrar los controladores de la regla en el entorno limitado fuera de la pantalla.

Las plantillas se definen en `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`,…). Cada archivo llama a `CB_REGISTER_TEMPLATES([...])` en el momento de la carga y la ventana emergente consume la lista combinada. Agregar una nueva plantilla significa escribir una entrada en el archivo apropiado, ninguna otra plomería.

---

## 13. Comportamiento de varias páginas- Todas las pestañas abiertas en el mismo grupo comparten el mismo temporizador.
- Cuando cambias a una pestaña en el mismo grupo, su superposición se actualiza inmediatamente para mostrar el tiempo compartido actual.
- Los temporizadores de reglas personalizadas marcan solo en la pestaña **activa visible**, impulsada por `pageHeartbeatEvent`. Las pestañas en segundo plano y las ventanas minimizadas no las hacen avanzar. Esto coincide con la cuenta atrás predeterminada del grupo de bloques.
- Cuando se agrega una nueva regla, cada página abierta detecta el cambio y la reevalúa en una fracción de segundo; **pero** los controladores recién registrados no "abren" retroactivamente pestañas ya abiertas. La ventana emergente muestra un recordatorio de recarga después de cada ejecución por ese motivo.
- Cuando una regla expira, las tarjetas de alimentación y los botones de navegación ocultos se restauran en la siguiente actualización.

---

## 14. Configuración

Abra el cuadro de diálogo **Configuración** mediante el ícono de ajustes en la barra superior.

- **Intervalo de latido**: con qué frecuencia el script de contenido informa el tiempo de tabulación y controla `pageHeartbeatEvent`. Predeterminado 250 ms. Los valores más bajos responden mejor pero utilizan más CPU.
- **Intervalo de tic**: con qué frecuencia se activa el `tickEvent` global. Predeterminado 1000 ms.
- **Modo de depuración** — *desactivado* de forma predeterminada. Cuando *está activado*, el motor emite entradas de nivel de seguimiento al panel de Registro (`[trace] dispatchEvent`, `[trace] N handler(s)`) y líneas `[CustomBlocker:trace]` a la consola del navegador. Déjelo apagado en el uso diario; enciéndalo mientras diagnostica una regla que se comporta mal. `pageHeartbeatEvent` está excluido del registro de seguimiento incluso cuando el modo de depuración está activado, porque se activa cuatro veces por segundo y ahogaría el resto.

---

## 15. Internacionalización

Toda la interfaz de usuario está traducida. Utilice el selector **Idioma** en la parte superior derecha.

Los idiomas admitidos incluyen inglés, chino (simplificado), español, japonés, coreano, además de cobertura parcial para hindi, árabe, bengalí, portugués, ruso, punjabi, alemán, francés, turco, vietnamita, italiano, tailandés, holandés, polaco, indonesio, urdu y persa. Los idiomas con cobertura parcial recurren al inglés cuando faltan cadenas.

El propio manual de instrucciones carga el archivo de rebajas que coincide con el idioma seleccionado, con el inglés como alternativa.

---

## 16. Mensajes de estado

Los mensajes de estado aparecen como un brindis centrado que desaparece después de unos dos segundos:

- "Cambios guardados".
- "Creado \"Nombre del grupo\"."
- "Regla personalizada cargada: N controladores activos. Para aplicar esta regla en pestañas que ya has abierto, vuelve a cargarlas".
- Errores de validación como "Los minutos permitidos deben ser un número mayor que 0".
- "Los minutos de repetición deben ser un número mayor que 0".
- "Los grupos congelados no se pueden cambiar".

Para los campos de entrada con requisitos de formato, el mensaje también aparece junto al botón correspondiente (para posponer).

---

## 17. Privacidad y almacenamiento

- Todo se almacena localmente en `chrome.storage.local`. No se envían datos a ninguna parte.
- Los elementos almacenados incluyen: sus grupos, temporizadores de uso, horas de último reinicio, registros de repetición de alarma, temporizadores personalizados y valores persistentes personalizados.
- La extensión no lee el contenido de la página más allá de lo necesario para detectar el tipo de página (ruta/nombre de host/marcadores DOM conocidos para sitios de videos) y evaluar predicados escritos por el usuario. No lee sus mensajes, publicaciones, comentarios o contenido privado.

---

## 18. Permisos

- `storage` — para los datos anteriores.
- `declarativeNetRequest`: para bloqueo nativo de grupos `Default`.
- `alarms`: para programar transiciones de reglas de manera eficiente.
- `tabs`, `webNavigation`: para detectar la creación de pestañas, cambios de URL y latidos de página para que se puedan enviar eventos.
- `offscreen`: para alojar el entorno limitado de reglas personalizadas de larga duración.
- `host_permissions: <all_urls>`: para que el script de contenido pueda mostrar la superposición del temporizador y detectar el contexto de la plataforma en cualquier página.

---

## 19. Solución de problemas- **Un grupo que agregué no hace nada.** Asegúrese de que el grupo esté habilitado, que el programa lo permita ahora, que no haya ninguna repetición activa y (para los grupos de plataforma) que la página realmente coincida con el tipo de contenido y el filtro de autor elegidos.
- **Un temporizador está atascado o incorrecto en una pestaña.** Alejarse y retroceder, o enfocar la pestaña, lo que activa una actualización forzada desde el temporizador compartido.
- **Las tarjetas de feed reaparecen después de que creo que deberían ocultarse.** La ocultación de feeds solo se ejecuta mientras la regla está bloqueando activamente. Si tiene una regla `after-minutes`, la ocultación del feed se activa una vez que su tiempo llega a cero.
- **Un botón de navegación de Yutub que esperaba que estuviera oculto todavía está allí.** La ocultación de navegación requiere que la regla esté configurada en "no filtrar por autor" y que el tipo de contenido sean Cortos o publicaciones de Yutub. Con los filtros de autor, la ocultación es solo por tarjeta.
- **La regla personalizada no hizo nada o se lanzó en silencio.** Abra Configuración → habilite **Modo de depuración**, luego haga clic en **Ejecutar** nuevamente y observe el panel Registro. Las líneas con el prefijo `[trace]` muestran cada despacho y manejador. Utilice `helpers.getLogHelper().log(...)` para agregar sus propios puntos de seguimiento. Si una regla que no funciona correctamente sigue siendo puesta en cuarentena automática, corrija la fuente y haga clic en Ejecutar; Ejecutar borra el motivo de la cancelación.
- **Mi nueva regla personalizada no afecta las pestañas ya abiertas.** Vuelva a cargarlas. Las reglas personalizadas se adjuntan a eventos de página *futuros*; la ventana emergente muestra un recordatorio para recargar después de cada ejecución.
- **Mi temporizador de cuenta regresiva no avanza.** Los temporizadores de reglas personalizadas solo marcan la pestaña **activo visible** a través de `pageHeartbeatEvent`. Las pestañas en segundo plano, las ventanas minimizadas y las pantallas bloqueadas las pausan por diseño: el mismo comportamiento que la cuenta regresiva predeterminada del grupo de bloques.
- **No puedo eliminar un grupo.** Probablemente esté congelado. Los grupos estrictamente congelados no se pueden eliminar en absoluto hasta que expire su bloqueo; Los grupos congelados no estrictos se pueden eliminar mediante el ritual de descongelación.
- **La ventana emergente muestra "En ejecución..." para siempre.** Una regla personalizada probablemente entró en un bucle cerrado. El motor lo interrumpe después de un tiempo de espera difícil y pone la regla en cuarentena. Abra el panel Registro para el motivo de la cancelación; corrija la regla y haga clic en Ejecutar.

---

## 20. Glosario

- **Grupo de bloques**: un conjunto de reglas con su propio tipo, comportamiento, programación y congelación/posposición.
- **Bloqueo instantáneo**: la regla se bloquea inmediatamente cada vez que está activa.
- **Bloqueo después de los minutos**: la regla comienza a bloquearse solo después de que se agota el presupuesto de tiempo para el período.
- **Intervalo de reinicio**: con qué frecuencia se reinicia el presupuesto después de minutos.
- **Horario**: días + períodos de tiempo durante los cuales un grupo está activo.
- **Congelación / Congelación estricta**: estados antimanipulación.
- **Posponer**: desactivación temporal con un ritual de confirmación configurable.
- **Filtro de autor**: para grupos de plataformas, restringe la regla a ciertos creadores de contenido.
- **Tipo de contenido**: para grupos de plataformas, restringe la regla a ciertas formas de contenido (breve, larga, publicación).
- **Ayudantes**: utilidades pasadas al controlador de una regla personalizada.
- **Plataforma**: una de `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Cada uno tiene su propio tipo de grupo y lógica de ocultación de feeds.
- **Heartbeat**: el `pageHeartbeatEvent` de ~250 ms enviado desde la pestaña visible activa.
- **Marque**: el 1 s `tickEvent` compartido globalmente (independiente de la visibilidad).
- **Modo de depuración**: una configuración que muestra el registro de seguimiento interno en el panel Registro y en la consola del navegador.
- **Cuarentena**: deshabilitación automática de una regla personalizada que excedió un límite de seguridad de tiempo de ejecución (fecha límite, registro de spam,...). Se borra en la siguiente ejecución.

---

## 21. Limitaciones- La ocultación del feed depende del DOM actual de cada plataforma. Si la plataforma cambia su diseño, es posible que sea necesario actualizar los selectores ocultos.
- La detección de contexto de plataforma para sitios que no son de Yutub se basa principalmente en URL, por lo que es más confiable en URL de contenido canónico.
- Los temporizadores de reglas personalizadas funcionan con una resolución de latido (~250 ms). No confíe en ellos para tiempos inferiores a un segundo.
- Los predicados pasados ​​a `hideShorts` / `hideVideos` / `hidePosts` se evalúan de forma sincrónica por tarjeta de alimentación. La lógica pesada en un predicado puede ralentizar el desplazamiento del feed; mantenerlos baratos.
- Dos pestañas que editan el mismo temporizador por grupo simultáneamente utilizan una estrategia de "la última escritura gana". Para un uso típico, esto está bien; Si depende de una contabilidad exacta, espere pequeñas variaciones ocasionales.
- El navegador puede suspender el trabajador del servicio en segundo plano cuando está inactivo. La extensión lo reanuda tan pronto como una llamada o alarma lo necesita; Los presupuestos de uso del sitio/cronometrados siguen contando a través de la repetición de latidos.

## Nota de v1.2

El editor de reglas personalizadas ahora colorea la sintaxis lenguaje de guiones, y el navegador de plantillas usa los mismos colores en las vistas previas de código. La acción masiva de grupos se llama **Vaciar**.

