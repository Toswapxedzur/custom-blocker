# Custom Web Blocker — Manual de instrucciones

Este es el manual de referencia completo de la extensión. Empieza con los flujos más sencillos y comunes, y avanza gradualmente hacia temas avanzados como reglas de bloqueo personalizadas con JavaScript y la API de helpers.

Si eres totalmente nuevo, solo lee **Inicio rápido** y **Resumen de grupos de bloqueo**. Todo lo demás es opcional, según lo que quieras hacer.

---

## 1. Qué hace esta extensión

Custom Web Blocker te permite bloquear sitios web y distracciones en línea según reglas definidas por ti. Puedes:

- Bloquear sitios de inmediato con el bloqueo de red nativo del navegador (el mismo tipo de bloqueo que produce `ERR_BLOCKED_BY_CLIENT`).
- Permitirte un cierto número de minutos por día en un sitio y bloquearlo cuando superes ese límite.
- Bloquear tipos específicos de contenido en YouTube, TikTok, Facebook, Instagram, Twitch y Reddit (no todo el sitio).
- Ocultar contenido bloqueado en los feeds de las plataformas compatibles, en lugar de solo bloquear páginas individuales.
- Programar cuándo está activa una regla por día de la semana y por ventanas horarias `HHMM-HHMM`.
- Congelar una regla para que no puedas cambiarla fácilmente. El congelamiento estricto la bloquea durante un número específico de horas y exige un ritual de confirmación de 20 pasos para deshacerlo.
- Poner una regla en snooze temporalmente, pero solo después de escribir una justificación suficientemente larga.
- Escribir reglas de bloqueo personalizadas con JavaScript usando helpers para temporizadores, almacenamiento persistente, detección de plataforma, coincidencia de dominios y registros.
- Usar la extensión en más de 20 idiomas.

La extensión es una extensión de Chrome Manifest V3, con una página de editor (el popup), un service worker en segundo plano y un content script que se ejecuta en cada página.

---

## 2. Recorrido de la interfaz

Cuando haces clic en el icono de la extensión, el editor se abre como una página web completa (no como un popup pequeño). La página tiene estas áreas:

- **Barra superior**
  - Botón **Instruction Manual** (este documento)
  - Selector de **Language**
- **Panel izquierdo — Block Groups**
  - Lista de tus grupos de bloqueo. Cada tarjeta muestra el nombre del grupo, una línea de resumen y una casilla de activar/desactivar.
  - El botón **Add** crea un grupo nuevo. El desplegable de al lado elige el tipo.
  - **Delete All** elimina todos los grupos, con confirmaciones extra si hay grupos congelados.
  - Puedes arrastrar el controlador `::` de una tarjeta hacia arriba o abajo para reordenar grupos.
  - Puedes arrastrar el divisor vertical para cambiar el tamaño de este panel.
- **Panel derecho — Editor**
  - Edita el grupo seleccionado: nombre, comportamiento de bloqueo, listas de bloqueo, filtros por tipo, programación, freeze, snooze.
  - Todos los cambios se guardan automáticamente una fracción de segundo después de que dejas de escribir o interactuar.
- **Toast** (popup centrado que se desvanece)
  - Muestra mensajes de estado como "Saved changes" o errores de entrada.

Mientras una página está siendo bloqueada o tiene un temporizador activo, aparece una superposición en su esquina superior izquierda que muestra todas las restricciones de tiempo que la afectan, en formato `hh:mm:ss` (o `mm:ss`). Varias restricciones se apilan en varias líneas.

---

## 3. Inicio rápido

1. Haz clic en el icono de la extensión. El editor se abre como página completa.
2. En el panel **Block Groups**, elige un tipo de grupo en el desplegable:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` o `Custom`.
3. Haz clic en **Add**. Aparece un grupo nuevo y el editor lo abre.
4. Ponle un nombre.
5. Completa los campos específicos del tipo (para `Default`, eso significa la lista **Blocked websites**).
6. Asegúrate de que la casilla del grupo en el panel izquierdo esté activada.
7. Visita uno de los sitios listados. El bloqueo debería aplicarse inmediatamente.

Ese es todo el flujo principal. El resto de este manual son opciones adicionales sobre esa base.

---

## 4. Resumen de grupos de bloqueo

Todo en esta extensión se organiza en **grupos de bloqueo**. Un grupo de bloqueo es un conjunto de reglas:

- Tiene nombre, tipo y estado activado/desactivado.
- Tiene un comportamiento de bloqueo (inmediato o después de cierto número de minutos).
- Tiene programación opcional (días + ventanas horarias) y controles opcionales de freeze/snooze.
- Según el tipo, tiene campos adicionales como lista de sitios, filtros de creadores de YouTube, nombres de subreddit o una función JavaScript.

Puedes tener cualquier número de grupos. Varios grupos pueden aplicarse a la misma página; en ese caso gana la regla **más estricta**:

- "Block immediately" supera a "block after some time".
- Un grupo con menos tiempo restante supera a uno con más tiempo restante.

Así que añadir más grupos solo puede hacer que una página se bloquee antes, nunca después.

Puedes arrastrar grupos con su controlador `::` para reordenarlos. El orden no cambia qué regla es más estricta, pero sí controla cómo se lee la lista de arriba hacia abajo.

---

## 5. Tipos de grupo

### 5.1 `Default` — bloquear sitios web normales

Para bloquear dominios específicos (el caso de uso típico).

- **Blocked websites**: un sitio por línea. Tanto `facebook.com` como `https://www.facebook.com/somepage` funcionan; la extensión extrae y normaliza el hostname.
- Una regla de sitio se aplica a ese hostname y a todos sus subdominios.
- Este tipo de grupo usa el bloqueo de red nativo de Chrome, similar a `ERR_BLOCKED_BY_CLIENT`. Eso significa que la navegación a una URL bloqueada se detiene antes de que cargue la página.

### 5.2 `YouTube` — bloquear YouTube y sitios de video similares

Añade una sección **Filters** al editor:

- **Content type**:
  - `Apply to all YouTube pages` — cuenta cualquier página de YouTube.
  - `Apply to Shorts` — solo cuentan páginas de Shorts.
  - `Apply to long videos` — solo `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to YouTube posts` — publicaciones de comunidad (`/post/...`, pestañas community/posts del canal).
- **Author filter**:
  - `Do not filter by author` — la identidad del autor no importa.
  - `Apply to certain authors` — solo los autores listados activan este grupo.
  - `Apply to all except certain authors` — los autores listados quedan exentos.
- **Authors**: un autor por línea. Acepta `@handle`, URLs completas, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: mientras este grupo está bloqueando activamente, se ocultan las tarjetas que coinciden en los feeds de YouTube. Cuando el bloqueo deja de estar activo, vuelven tras la siguiente actualización.

Para tipos de contenido Shorts y Posts, cuando no hay filtro de autor y el grupo está bloqueando, la extensión también oculta entradas de navegación relevantes (entrada Shorts en la barra lateral, pestañas Community/Posts del canal) y estanterías coincidentes como "Latest YouTube posts".

La detección de short vs long también se extiende a otros sitios de video como TikTok, Vimeo, clips/VODs de Twitch y Dailymotion cuando se puede detectar la forma de la página.

### 5.3 `TikTok` — bloquear contenido de TikTok

La misma tarjeta de editor que el editor de video por plataforma, pero con etiquetas específicas de TikTok:

- Tipos de contenido: videos cortos, videos, páginas de perfil.
- Autores: handles de TikTok (`@handle`) o URLs de perfil.
- El ocultado de feed oculta tarjetas coincidentes en páginas de TikTok mientras el grupo está activo.

### 5.4 `Facebook` — bloquear contenido de Facebook

- Tipos de contenido: Reels, videos, posts.
- Autores: nombre de página (`page.name`), URL de perfil o formato `profile.php?id=...` (el id numérico se conserva como `id:<number>`).
- El ocultado de feed oculta tarjetas coincidentes en Facebook.

### 5.5 `Instagram` — bloquear contenido de Instagram

- Tipos de contenido: Reels, videos, posts.
- Autores: handles de Instagram o URLs de perfil.
- Rutas reservadas como `/reel/`, `/p/`, `/tv/`, `/explore/` no se tratan como autores.
- El ocultado de feed oculta tarjetas coincidentes en Instagram.

### 5.6 `Twitch` — bloquear contenido de Twitch

- Tipos de contenido: clips, streams/VODs, páginas de canal.
- Autores: nombres de canal o URLs de canal.
- Rutas reservadas como `/directory`, `/videos`, `/settings`, etc. no se tratan como nombres de canal.
- El ocultado de feed oculta tarjetas coincidentes en Twitch.

### 5.7 `Reddit` — bloquear Reddit o subreddits específicos

- **Subreddits**: un subreddit por línea. Una lista vacía significa que el grupo se aplica a todo Reddit. Se aceptan tanto `productivity` como `r/productivity`.

### 5.8 `Custom` — bloquear con función JavaScript

Escribes una función JavaScript. La extensión la llama aproximadamente cada segundo y usa lo que devuelve como lista de bloqueo actual.

Los grupos `Custom` no muestran: comportamiento de bloqueo, sitios bloqueados, minutos permitidos, intervalo de reinicio, días de programación ni ventanas horarias. Solo tienen una entrada grande — la función **Blocking Rules** — más los controles estándar de freeze/snooze.

Consulta la **Sección 11** para la referencia completa de reglas custom y la API de helpers.

---

## 6. Comportamiento de bloqueo

Para la mayoría de tipos de grupo eliges uno de dos modos:

### 6.1 Bloquear de inmediato

La regla está activa cuando el grupo está activado, la programación lo permite y (en grupos de plataforma) la página coincide.

Para grupos `Default` esto usa bloqueo nativo de Chrome. Para grupos de plataforma usa lógica de superposición/salida en página.

### 6.2 Bloquear después de cierto número de minutos

Esto es un presupuesto de uso.

- **Allowed minutes before block** (decimal): cuántos minutos te permites por periodo. Ejemplo: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (decimal): cada cuánto se reinicia el presupuesto. Ejemplo: `24` para diario, `1` para cada hora, `0.25` para cada 15 minutos.

Mientras te quede tiempo, la página funciona normal y muestra la superposición del temporizador. Cuando el presupuesto llega a cero, la página se bloquea durante el resto del periodo y la superposición muestra `0:00`; luego la pestaña intenta salir.

La extensión funciona por grupo y por periodo:

- Cada grupo tiene su propio presupuesto.
- El tiempo gastado en cualquier página que coincida con el grupo cuenta para ese presupuesto.
- Varias pestañas en el mismo grupo comparten el presupuesto. Sus temporizadores se mantienen sincronizados; cambiar a otra pestaña también fuerza una actualización para mostrar el tiempo compartido actual de inmediato.

Si varios grupos con límite de tiempo aplican a la misma página, gana el más estricto.

---

## 7. Programación

En la tarjeta **Schedule** puedes restringir cuándo un grupo está activo:

- **Days to block**: elige los días en que aplica el grupo. Días sin marcar significan que el grupo está inactivo ese día.
- **Time windows**: lista de formato libre, una ventana por línea en formato `HHMM-HHMM`, por ejemplo:

  ```
  0900-1000
  1200-1300
  ```

  El grupo está activo solo dentro de esas ventanas. Lista vacía significa todo el día.

Esto aplica a todos los tipos de grupo excepto `Custom`.

---

## 8. Freeze (anti-manipulación)

Congelar hace que un grupo sea difícil de desactivar por impulso.

En la tarjeta **Freeze** eliges:

- **Frozen** — no puedes editar ni borrar el grupo y no puedes desmarcar su interruptor de activación. Para cambiar algo debes ejecutar el ritual de descongelado (ver abajo).
- **Strict frozen** — igual que Frozen, pero permanece bloqueado por un número de horas que eliges (decimal, hasta 72). Hasta que ese temporizador expire, incluso el ritual de descongelado no está disponible.

Cuando un grupo congelado es desbloqueable, aparece el botón **Unfreeze**. Al hacer clic empieza el **ritual de 20 pasos**:

- El modal muestra un mensaje de autodisciplina.
- Debes hacer clic en `Confirm` 20 veces.
- Hay una espera forzada de 5 segundos entre clics.
- Si cancelas en cualquier punto, debes reiniciar desde el paso 1.
- Los 20 mensajes rotan para que realmente los leas.

Si el grupo también está marcado como "no snooze" (ver la siguiente sección), tampoco puedes ponerlo en snooze mientras esté congelado.

El estado de freeze se muestra en la línea meta de la tarjeta del grupo, incluyendo el tiempo restante para strict freeze.

---

## 9. Snooze (desactivación temporal)

Snooze desactiva temporalmente un grupo sin descongelarlo, pero solo con una justificación escrita.

En la tarjeta **Snooze**:

- **Allow snooze for this group** — si está apagado, este grupo no puede ponerse en snooze en absoluto (incluyendo cuando está congelado).
- **Snooze for (minutes)** — decimal, cuánto dura el snooze.
- **Reason** — debe tener **al menos 100 caracteres y más de 20 palabras**. El botón Start permanece deshabilitado hasta cumplir ambas condiciones. Si falla, aparece una advertencia en línea junto al botón.

Si el grupo está congelado, los minutos de snooze quedan bloqueados con el valor elegido antes del freeze. Aun así puedes ponerlo en snooze, siempre que esté permitido y la razón cumpla las reglas.

Un mensaje de estado confirma el snooze. Cuando termina, el grupo vuelve automáticamente al estado normal.

También puedes terminar un snooze antes con el botón **End Snooze**.

---

## 10. Acciones masivas

- **Delete All** elimina todos los grupos.
  - Siempre pide confirmación.
  - Si al menos un grupo está congelado, requiere el mismo ritual de 20 pasos que descongelar.
  - Si algún grupo está strict-frozen y aún bloqueado, **Delete All** se desactiva.

---

## 11. Grupos Custom (referencia completa)

Un grupo `Custom` ejecuta una función JavaScript en el service worker en segundo plano. La función se llama aproximadamente cada segundo, y la extensión usa lo que devuelve para decidir qué dominios deben bloquearse ahora mismo.

### 11.1 Firma de la función

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parámetros:

- `month` — `1` a `12`.
- `dayOfMonth` — `1` a `31`.
- `dayName` — por ejemplo `"Monday"`.
- `hour` — `0` a `23`.
- `minute` — `0` a `59`.
- `blockedDomains` — la lista en curso de dominios que otras reglas ya produjeron. Puedes añadir, reemplazarla o ignorarla.
- `helpers` — un conjunto de objetos helper (ver abajo).

Valor de retorno:

- Un arreglo de strings de dominio que deben bloquearse ahora mismo, O
- nada (en ese caso la extensión usa aquello a lo que hayas mutado `blockedDomains`).

La función se valida al guardar. Los errores de sintaxis producen una advertencia de estado, y la regla no se usa hasta que la corrijas. Si tu función lanza una excepción en tiempo de ejecución, la extensión la captura, la registra en la consola de fondo y vuelve al resultado anterior.

### 11.2 Programación adaptativa

Las reglas custom normalmente se ejecutan aproximadamente cada segundo. Si tu regla tarda demasiado, la extensión desacelera automáticamente el bucle (hasta aproximadamente cada 5 segundos). No tienes que gestionarlo tú.

### 11.3 El objeto `helpers`

Dentro de la función, `helpers` expone varios sub-helpers. Cada uno tiene nombre largo y alias corto. También hay métodos getter explícitos:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — tiempo epoch actual en milisegundos.

Todos los métodos helper están diseñados para ser seguros: parámetros inválidos devuelven `null`, `false` o un valor vacío en lugar de lanzar excepciones.

#### 11.3.1 `timerHelper`

Gestiona temporizadores de cuenta regresiva asociados a un dominio. Los temporizadores persisten entre reinicios del navegador. Cada temporizador pertenece al grupo custom que lo creó.

- `createTimer(domain, durationMs, displayName?)` — crea y devuelve un id único de temporizador, o `null` si no es válido. Ejemplo: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Mientras el usuario esté en una página que coincida con ese dominio, la superposición mostrará `Timer1: 30:00` y contará hacia abajo.
- `deleteTimer(id)` — elimina el temporizador. Devuelve `true` en éxito.
- `pauseTimer(id)` — pausa la cuenta regresiva.
- `continueTimer(id)` / `resumeTimer(id)` — reanuda un temporizador pausado.
- `resetTimer(id, durationMs?)` — reinicia el temporizador. Sin `durationMs`, reutiliza el original.
- `addMs(id, ms)` — añade milisegundos (o resta con valores negativos).
- `remainingMs(id)` — milisegundos restantes.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleanos.
- `getDomain(id)` / `getDisplayName(id)` — lee información del temporizador.
- `findByDomain(domain)` — arreglo de ids de temporizador para ese dominio.
- `list()` — arreglo de `{ id, domain, displayName, durationMs, remainingMs, isPaused }` para todos los temporizadores que posee este grupo.

La duración máxima del temporizador es de aproximadamente 30 días.

#### 11.3.2 `persistenceHelper`

Almacenamiento tipo mapa con alcance de tu grupo. Los valores deben ser serializables en JSON. Útil para recordar estado entre llamadas.

- `set(key, value)` — guarda cualquier valor JSON. Devuelve `true` en éxito.
- `get(key, defaultValue?)` — devuelve el valor guardado, o `defaultValue` si falta.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Límites blandos: aproximadamente 200 claves por grupo, 16 KB por valor.

#### 11.3.3 `domainHelper`

- `normalize(value)` — devuelve el dominio canónico como `youtube.com`, o `null`.
- `matches(hostname, site)` — `true` si `hostname` pertenece a `site` (maneja subdominios).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — escriben en la consola de fondo.

Para ver estos mensajes: `chrome://extensions` → activa Developer Mode → haz clic en el enlace "service worker" de la extensión.

#### 11.3.5 `platformHelper`

Inspecciona plataformas sociales/de video compatibles.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — devuelve el nombre canónico de plataforma, o `null`.
- `normalizeAuthor(author, platform)` — normaliza un identificador de autor (handle, URL, etc.) para una plataforma específica, o `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — devuelve `{ platform, hostname, pathname, type, authors, url }`, o `null`.
  - `type` es `"short" | "long" | "post" | "unknown"`.
  - `authors` es la lista de autores normalizados detectables desde esa URL.
- `getType(urlOrHost)` — acceso rápido a `detect(...).type`.
- `getPlatform(urlOrHost)` — acceso rápido a `detect(...).platform`.
- `getAuthors(urlOrHost)` — acceso rápido a `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — devuelve `true` si la URL está en esa plataforma y uno de los autores dados coincide.

### 11.4 Ejemplos

Fácil: bloquear redes sociales en mañanas de días laborables.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Intermedio: 30 minutos de YouTube por sesión del navegador, con cuenta regresiva visible.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

Más difícil: bloquear una sesión de TikTok solo si es video corto Y el autor está en tu lista de distractores. Usa `platformHelper`.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` es solo un marcador de ejemplo: normalmente usarás `platformHelper` según tu propia lógica, no según la ubicación del worker, porque el worker de fondo no tiene una URL real de página.)

El más difícil: rotar un "sitio del día" con tope diario, persistente entre reinicios.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. Comportamiento en múltiples páginas

- Todas las pestañas abiertas del mismo grupo comparten el mismo temporizador.
- Cuando cambias a una pestaña del mismo grupo, su superposición se actualiza al instante para mostrar el tiempo compartido actual.
- Cuando se añade una regla nueva, cada página abierta detecta el cambio y se actualiza en una fracción de segundo; no necesitas recargar pestañas manualmente.
- Cuando una regla expira, las tarjetas de feed ocultas y los botones de navegación se restauran en la siguiente actualización.

---

## 13. Internacionalización

Toda la interfaz está completamente traducida. Usa el selector **Language** arriba a la derecha.

Los idiomas compatibles incluyen inglés, chino (simplificado), español, japonés y coreano, además de cobertura parcial para hindi, árabe, bengalí, portugués, ruso, panyabí, alemán, francés, turco, vietnamita, italiano, tailandés, neerlandés, polaco, indonesio, urdu y persa. Los idiomas con cobertura parcial vuelven al inglés para cadenas faltantes.

El propio manual carga el archivo markdown que corresponde a tu idioma seleccionado, con inglés como fallback.

---

## 14. Mensajes de estado

Los mensajes de estado aparecen como un toast centrado que se desvanece después de unos dos segundos:

- "Saved changes."
- "Created \"Group name\"."
- Errores de validación como "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

En campos de entrada con requisitos de formato, el mensaje también aparece junto al botón relevante (para snooze).

---

## 15. Privacidad y almacenamiento

- Todo se guarda localmente en `chrome.storage.local`. No se envía ningún dato a ningún sitio.
- Los elementos almacenados incluyen: tus grupos, temporizadores de uso, últimas horas de reinicio, registros de snooze, temporizadores custom y valores persistentes custom.
- La extensión no lee contenido de páginas más allá de lo necesario para detectar el tipo de página (ruta/hostname/marcadores DOM conocidos de sitios de video). No lee tus mensajes, posts, comentarios ni contenido privado.

---

## 16. Permisos

- `storage` — para los datos anteriores.
- `declarativeNetRequest` — para bloqueo nativo de grupos `Default`.
- `alarms` — para programar transiciones de reglas de manera eficiente.
- `host_permissions: <all_urls>` — para que el content script pueda mostrar la superposición del temporizador y detectar contexto de plataforma en cualquier página.

---

## 17. Solución de problemas

- **Un grupo que agregué no hace nada.** Asegúrate de que el grupo esté habilitado, que la programación lo permita ahora, que no haya snooze activo y (en grupos de plataforma) que la página coincida realmente con el tipo de contenido y filtro de autor elegidos.
- **Un temporizador está atascado o incorrecto en una pestaña.** Cambia de pestaña y vuelve, o enfoca la pestaña; eso dispara una actualización forzada desde el temporizador compartido.
- **Las tarjetas de feed reaparecen cuando creo que deberían seguir ocultas.** El ocultado de feed solo se ejecuta mientras la regla bloquea activamente. Si tienes una regla `after-minutes`, el ocultado empieza cuando tu tiempo llega a cero.
- **Un botón de navegación de YouTube que esperaba ocultar sigue ahí.** El ocultado de navegación requiere que la regla esté en "do not filter by author" y que el tipo de contenido sea Shorts o YouTube posts. Con filtros de autor, el ocultado es solo por tarjeta.
- **La regla custom no hizo nada o falló en silencio.** Abre `chrome://extensions`, activa Developer Mode, haz clic en el enlace "service worker" de la extensión y revisa la consola. Usa `helpers.logHelper.log(...)` para rastrear tu regla.
- **No puedo borrar un grupo.** Probablemente está congelado. Los grupos strict-frozen no se pueden borrar hasta que expire su bloqueo; los congelados no estrictos se pueden borrar mediante el ritual de descongelado.

---

## 18. Glosario

- **Block group** — un conjunto de reglas con su propio tipo, comportamiento, programación y freeze/snooze.
- **Instant block** — la regla bloquea inmediatamente siempre que está activa.
- **After-minutes block** — la regla empieza a bloquear solo después de agotar el presupuesto de tiempo del periodo.
- **Reset interval** — cada cuánto se reinicia el presupuesto de after-minutes.
- **Schedule** — días + ventanas horarias durante los cuales un grupo está activo.
- **Freeze / Strict freeze** — estados anti-manipulación.
- **Snooze** — desactivación temporal con justificación escrita.
- **Author filter** — en grupos de plataforma, restringe la regla a ciertos creadores de contenido.
- **Content type** — en grupos de plataforma, restringe la regla a ciertas formas de contenido (short, long, post).
- **Helpers** — utilidades pasadas a la función de una regla custom.
- **Platform** — uno de `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Cada uno tiene su propio tipo de grupo y lógica de ocultado de feed.

---

## 19. Limitaciones

- El ocultado de feed depende del DOM actual de cada plataforma. Si la plataforma cambia su diseño, puede que haya que actualizar los selectores de ocultado.
- La detección de contexto de plataforma para sitios no YouTube es mayormente basada en URL, así que es más confiable en URLs canónicas de contenido.
- Los bucles de reglas custom ocurren en el worker de fondo, no en páginas, así que la información a nivel DOM no está disponible dentro de la función. Usa `platformHelper.detect(url)` con una cadena URL en su lugar.
- El navegador puede suspender el service worker cuando está inactivo. La extensión lo reanudará en cuanto una página o alarma lo necesite; los temporizadores de uso no perderán precisión por esto.
