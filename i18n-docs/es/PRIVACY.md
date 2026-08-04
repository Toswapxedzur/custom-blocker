# Política de privacidad: bloqueador web personalizado

_Última actualización: 2026-08-04_

Esta página explica exactamente qué datos recopila la extensión de navegador **bloqueador web personalizado**, adónde van y por qué se solicita cada permiso del navegador. En resumen: no guardamos tus reglas ni tus datos personales de navegación. La recopilación y la clasificación opcionales de Vault Classifier permanecen bajo tu control y usan el puente local autenticado. Una integración opcional e independiente de IA local (MCP) también está desactivada de forma predeterminada y solo expone datos a un asistente que tú mismo conectes y apruebes.

## Resumen

- **Tu configuración permanece en tu navegador.** Los grupos de bloqueo, los horarios, las reglas personalizadas, los registros, los temporizadores y las preferencias se conservan únicamente en el almacenamiento local de la extensión de Chrome (`chrome.storage.local`).
- **Vault Classifier es solo local.** Si activas explícitamente la integración opcional con Vault Classifier, la evidencia visible de tarjetas o páginas de YouTube (como un título, la descripción visible, las etiquetas mostradas y los ID públicos de creador/vídeo) se enruta únicamente a través del puente local autenticado de Vault hacia Vault Classifier en tu Mac. No se envía a nuestro sitio web, a un proveedor de modelos, a la API de datos de YouTube ni a ningún otro servidor.
- **La recopilación es una aceptación aparte.** Vault Classifier solicita a la extensión metadatos de YouTube renderizados y sin anuncios solo después de que actives la recopilación de YouTube en su espacio de trabajo de datos de clasificación. Cuando está desactivada, la extensión no envía ningún título ni metadato de creador para la recopilación. Cuando está activada, los campos locales conservados pueden incluir un título visible, el nombre/identificador del creador, el tipo de vídeo, la duración, el texto visible de suscriptores/visualizaciones/fecha de publicación y la URL canónica.
- **Integración opcional de IA local (MCP).** Si la activas y conectas tu propio asistente de IA, ese asistente puede —bajo tu indicación explícita— leer datos seleccionados (tu configuración, actividad, uso de tiempo, las URL de las pestañas activas/abiertas, el contenido visible de las páginas en los sitios que hayas configurado y cualquier evidencia de Classifier) a través de un servidor local de Vault en tu dispositivo. Está desactivada de forma predeterminada, cada conexión la apruebas tú, y las contraseñas y las claves de API nunca se pueden leer a través de ella. Consulta «Integración opcional de IA local (MCP)» más abajo.
- **No hay analítica, perfiles publicitarios, telemetría ni informes de fallos.**
- **Sin seguimiento** de la actividad de navegación más allá de lo estrictamente necesario para aplicar las reglas de bloqueo que tú mismo configuraste.

## Qué se almacena localmente

La extensión almacena lo siguiente en el almacenamiento local de la extensión de tu navegador para poder cumplir su función entre sesiones:

- Los grupos de bloqueo que creas: sus nombres, tipos de regla, listas de sitios bloqueados, horarios, ajustes de posposición (snooze), estado de congelación y cualquier JavaScript de regla personalizada que escribas.
- El estado de ejecución por grupo necesario para aplicar los límites (p. ej., cuántos minutos de un presupuesto de asignación diferida quedan hoy, cuándo termina una posposición, cuándo finaliza un periodo de congelación estricta).
- Tus propias preferencias establecidas en **Configuración** (frecuencia de actualización, retardo de guardado automático, duración de posposición predeterminada, URL alternativa predeterminada, interruptor de modo de depuración, idioma de la interfaz elegido).
- Las entradas del registro de actividad que se muestran en el panel **Registro** de la aplicación, que puedes borrar desde la interfaz.
- Cuando activas explícitamente Vault Classifier, su aplicación local mantiene una caché local, acotada por el usuario, de la evidencia visible, las puntuaciones locales, las decisiones y las correcciones necesarias para clasificar y explicar las entradas. Esta caché permanece en tu Mac y no forma parte del tráfico habitual entre la extensión y el servidor.

Tu configuración, el estado de ejecución y el registro de actividad permanecen en tu dispositivo y nuestro servicio no los guarda. Según la compilación del navegador y las funciones que actives, pueden ser procesados por la extensión, por su aplicación complementaria local de Safari o por un puente local de Vault explícitamente vinculado.

## Lo que NO se recopila ni se transmite

Esto describe cómo se comporta la extensión por sí misma. La única excepción es la integración opcional de IA local (MCP) que puedes activar y conectar tú mismo, descrita en la siguiente sección.

- El historial de navegación no lo registra, resume ni transmite la extensión por sí misma; solo se usa para aplicar las reglas que configuraste.
- La extensión por sí misma no extrae, captura ni registra el contenido de las páginas.
- La evidencia de Vault Classifier no la transmite la extensión fuera del dispositivo. La procesan el puente local emparejado y la aplicación únicamente cuando activas explícitamente esa integración.
- La extensión nunca lee lo que introduces en formularios ni las contraseñas; las contraseñas y las claves de API tampoco se pueden leer a través de la integración de IA local (MCP).
- No se transmite ningún identificador de extensión, de cuenta ni de dispositivo, ni tu configuración de reglas, para la aplicación normal de las reglas.

## Integración opcional de IA local (MCP)

La extensión puede, opcionalmente, responder a solicitudes de un **servidor MCP de Vault** local que se ejecuta dentro de las aplicaciones de escritorio de Vault en tu propio dispositivo, para que puedas conectar tu propio asistente de IA (un «cliente MCP») y hacer que lea tu configuración de Vault o actúe sobre ella por ti. Esta integración está **desactivada de forma predeterminada** y no cambia nada a menos que la actives deliberadamente.

- **Tú la inicias.** No se expone nada hasta que actives la integración y conectes un cliente MCP, y cada conexión de un cliente la apruebas tú. Al desactivarla, se revoca el acceso de inmediato.
- **El servidor es local.** Los datos que proporciona la extensión se entregan, a través del mismo puente autenticado del dispositivo, a un servidor MCP de Vault en tu Mac, no a nuestro sitio web ni a ningún servidor de Vault. La extensión en sí no envía tus datos a terceros.
- **Después decide tu asistente.** Una vez que un cliente MCP conectado recibe datos a petición tuya, lo que ocurra con ellos se rige por **ese cliente** y sus propios términos de privacidad. Si el asistente que elegiste se apoya en un servicio remoto, ese asistente puede transmitir tus datos bajo tu indicación, igual que cuando pegas información en cualquier herramienta de IA. Elige un cliente en el que confíes.
- **Qué se puede exponer.** Bajo tu indicación, un asistente conectado puede leer tus grupos de bloqueo, horarios, reglas personalizadas, el registro de actividad, los contadores de uso de tiempo, las URL de la pestaña activa o de las pestañas abiertas, el contenido visible de las páginas en los sitios que hayas configurado y cualquier evidencia y decisión de Vault Classifier. Las acciones que cambian el estado (editar grupos, iniciar una posposición, ejecutar una regla guardada, activar una clasificación) se confirman individualmente.
- **Los secretos siguen siendo secretos.** Las contraseñas (como una contraseña de control parental) y las claves de API de proveedores son de **solo escritura** a través de esta integración: se pueden establecer, pero ningún asistente puede volver a leerlas.
- **Solo Chromium.** Al igual que el puente de Classifier, esta integración existe únicamente en navegadores Chromium con el host local del dispositivo; Firefox y Safari no la exponen.

## Por qué se solicita cada permiso

| Permiso | Para qué se utiliza |
| --- | --- |
| `storage` | Guardar y cargar tus grupos de bloqueo, ajustes y estado de ejecución únicamente en tu navegador. |
| `favicon` | Mostrar junto a las reglas los iconos de sitios almacenados en la caché del navegador en Chromium. Esto no envía el historial de navegación ni realiza solicitudes a nuestro servicio. |
| `nativeMessaging` | En Chromium, solicitar una prueba de Native Messaging local del dispositivo para el puente autenticado de Vault Classifier; en Safari, reenviar las solicitudes del entorno aislado de reglas personalizadas a la aplicación contenedora local del dispositivo. No es un transporte en la nube. |
| `alarms` | Activar el service worker en segundo plano según lo programado para actualizar los límites basados en el tiempo y el estado de las reglas cuando termina una ventana de posposición, congelación u horario. |
| `offscreen` | Ejecutar el JavaScript de reglas personalizadas en un entorno aislado dentro de un documento fuera de pantalla, de modo que no pueda escapar de la extensión ni tocar tus páginas directamente. |
| `tabs` | Abrir el editor como una pestaña completa cuando haces clic en el icono de la barra de herramientas, consultar la URL de la pestaña activa para evaluar las reglas de grupo y recargar las pestañas tras un cambio de regla que hayas hecho en el editor. |
| `webNavigation` | Detectar los cambios de URL de las SPA (navegación con push-state) para que los ocultadores de feeds por plataforma y las reglas basadas en eventos puedan reaccionar a la navegación dentro de la página, no solo a las cargas de página completa. |
| Acceso de host `<all_urls>` | Aplicar tus reglas de bloqueo y los ocultadores de feeds por plataforma en los sitios que elijas bloquear. La extensión lee/modifica páginas únicamente en las URL para las que has configurado activamente una regla, y solo para aplicar esa regla; el adaptador opcional de Vault Classifier está restringido a YouTube. |

## Reglas personalizadas

Si escribes reglas de JavaScript personalizadas, ese código:

- Se ejecuta en un documento fuera de pantalla en un entorno aislado; no puede acceder directamente a la red, a tus páginas ni a otras extensiones.
- Se comunica con los scripts de contenido únicamente a través de un puente de mensajes fijo definido por la API auxiliar de la extensión.
- Se pone en cuarentena automáticamente (se desactiva con una entrada de registro) si supera los límites integrados de CPU, de registro, de mensajes o de mutaciones del DOM.

Tus reglas personalizadas se almacenan localmente junto con el resto de tu configuración y nunca se transmiten fuera del dispositivo.

## Estadísticas del sitio web

Esta sección trata sobre el **sitio web**. El sitio web publica un pequeño panel de **Estadísticas** y, para rellenarlo, el servidor mantiene unos pocos recuentos agregados:

- **Recuentos de descargas**: cuántas veces se hizo clic en el botón de descarga de cada producto (macOS, Windows, extensión de navegador, Safari).
- **Cuentas**: cuántas cuentas existen.
- **Actividad de preguntas y respuestas**: el número total de publicaciones y comentarios del foro.

Una vez por hora, el servidor registra el valor actual de cada recuento agregado. Estas instantáneas no contienen ningún evento por visitante, secuencia de clics ni historial de sesión.

- **Totalmente anónimo/anonimizado.** Son simples totales acumulados. **No** están vinculados a tu nombre, cuenta, correo electrónico, dirección IP, dispositivo ni ningún otro identificador: no hay forma de atribuir un recuento a una persona.
- **Nunca comercial.** Estos datos existen únicamente para mostrar el panel público de Estadísticas. **Nunca se venden, se comparten con terceros, se usan para publicidad ni para ningún otro fin comercial.**

## Menores

La extensión es una herramienta de productividad de uso general. No está dirigida a menores, no recopila datos de nadie de forma consciente y no muestra publicidad.

## Cambios en esta política

Si las prácticas de datos cambian en una versión futura, este archivo se actualizará y el cambio se resumirá en las notas de versión de esa publicación.

## Contacto

Preguntas, inquietudes o informes de errores: abre una incidencia en el repositorio de origen de la extensión o usa el correo de soporte que figura en la ficha de Chrome Web Store.
