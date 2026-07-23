# Política de privacidad: bloqueador web personalizado

_Última actualización: 2026-07-13_

Esta página explica exactamente qué datos el navegador **Bloqueador web personalizado**
La extensión recopila, adónde va y por qué cada permiso del navegador es
solicitado. En resumen: no guardamos sus reglas ni sus datos personales de
navegación. Las reglas de etiquetas pueden consultar identificadores públicos
de canales de YouTube, pero esas consultas no se conservan ni se vinculan a usted.

## Resumen

- **Su configuración permanece en el navegador.** Los grupos, horarios, reglas,
  registros, temporizadores y preferencias solo se guardan en `chrome.storage.local`.
- **Las consultas contienen únicamente ID públicos de canales.** No incluyen URL,
  título del vídeo, búsqueda, hora, cuenta ni ajustes de la extensión.
- **Las consultas no se guardan.** El endpoint es de solo lectura, no incorpora
  canales desconocidos a la base de datos ni asocia la solicitud a una persona.
- **No hay analítica, telemetría, publicidad ni informes de fallos.**
- **Sin seguimiento** de la actividad de navegación más allá de lo estrictamente necesario
  para aplicar las reglas de bloqueo que usted mismo configuró.

## Qué se almacena localmente

La extensión almacena lo siguiente en la extensión local de su navegador
almacenamiento para que pueda hacer su trabajo entre sesiones:

- Los grupos de bloques que creas: sus nombres, tipos de reglas, listas de
  sitios bloqueados, horarios, configuraciones de repetición de alarma, estado de congelación y cualquier
  JavaScript de regla personalizada que escriba.
- Estado de tiempo de ejecución por grupo necesario para hacer cumplir los límites (por ejemplo, cuántos
  Hoy quedan minutos de un presupuesto de subsidios retrasados, cuando una siesta
  termina, cuando finaliza un período de congelación estricta).
- Tus propias preferencias configuradas en **Configuración** (tasa de ticks, guardado automático)
  antirrebote, duración predeterminada de la repetición de alarma, URL alternativa predeterminada, modo de depuración
  alternar, idioma de interfaz de usuario elegido).
- Las entradas del registro de actividad se muestran en el panel **Registro** de la aplicación, que puedes
  claro de la interfaz de usuario.

Estos datos son leídos y escritos únicamente por los propios scripts de la extensión, únicamente
en su dispositivo, y sólo dentro de su propio perfil de navegador.

## Lo que NO se recoge ni se transmite

- El historial de navegación no se registra, resume ni transmite.
- El contenido de la página no se extrae, no se captura ni se registra.
- Los formularios, contraseñas e información personal nunca se leen.
- No se envía información sobre usted, su dispositivo o su uso al
  autor de la extensión o cualquier tercero.

## Por qué se solicita cada permiso

| Permiso | Para qué se utiliza |
| --- | --- |
| `storage` | Guarde y cargue sus grupos de bloques, configuraciones y estado de tiempo de ejecución únicamente en su navegador. |
| `favicon` | Muestra junto a las reglas los iconos de sitios almacenados en la caché del navegador en Chromium. No envía el historial ni hace solicitudes a nuestro servicio. |
| `nativeMessaging` | En Chromium, solicita una prueba de Native Messaging local al dispositivo para el puente autenticado de Vault Classifier; en Safari, reenvía las solicitudes del entorno aislado de reglas personalizadas a la aplicación local del dispositivo. No es un transporte en la nube. |
| `alarms` | Active al trabajador del servicio en segundo plano según lo programado para actualizar los límites basados ​​en el tiempo y actualizar el estado de la regla cuando finalice una ventana de repetición, congelación o programación. |
| `offscreen` | Ejecute JavaScript con reglas personalizadas en un espacio aislado en un documento fuera de la pantalla para que no pueda escapar de la extensión ni tocar sus páginas directamente. |
| `tabs` | Abra el editor como una pestaña completa al hacer clic en el ícono de la barra de herramientas, busque la URL de la pestaña activa para evaluar las reglas del grupo y vuelva a cargar las pestañas después de un cambio de regla que realizó en el editor. |
| `webNavigation` | Detecte cambios de URL de SPA (navegación de estado push) para que los ocultadores de feeds por plataforma y las reglas basadas en eventos puedan reaccionar a la navegación en la página, no solo a las cargas de página completa. |
| `<all_urls>` acceso al host | Aplique sus reglas de bloqueo y ocultadores de feeds por plataforma en los sitios que elija bloquear. La extensión lee/modifica páginas solo en las URL para las que ha configurado activamente una regla y solo para aplicar esa regla. |

## Reglas personalizadas

Si escribe reglas de JavaScript personalizadas, ese código:

- Se ejecuta en un documento fuera de pantalla en un espacio aislado; no puede llegar directamente al
  red, sus páginas u otras extensiones.
- Se comunica con scripts de contenido solo a través de un puente de mensajes fijo
  definido por la API auxiliar de la extensión.
- Se pone en cuarentena automáticamente (se desactiva con una entrada de registro) si
  excede los límites integrados de CPU, registro, mensaje posterior o mutación DOM.

Tus reglas personalizadas se almacenan localmente con el resto de tu configuración.
y nunca se transmiten fuera del dispositivo.

## Estadísticas del sitio web y del servicio de etiquetas de creador

Esta sección trata sobre el **sitio web y el servicio de etiquetas de creador**.
La extensión puede consultar ID públicos de canales en modo de solo lectura;
esas consultas no se guardan. El sitio web publica una pequeña **Estadística**
panel, y para completarlo, el servidor mantiene algunos recuentos agregados:

- **Recuentos de descargas**: cuántas veces se activó el botón de descarga de cada producto.
  en el que se hizo clic (macOS, Windows, extensión del navegador, Safari).
- **Creadores clasificados**: cuántos creadores de YouTube han sido etiquetados.
- **Cuentas**: cuántas cuentas existen.
- **Actividad de preguntas y respuestas**: el número total de publicaciones y comentarios en el foro.

Una vez por hora el servidor registra el valor actual de cada uno de estos conteos y
nada más. No hay registros por evento, ni secuencias de clics ni sesión
historia.

- **Totalmente anónimo/anonimizado.** Estos son totales corrientes simples. ellos
  **no** están vinculados a su nombre, cuenta, correo electrónico, dirección IP, dispositivo o cualquier
  otro identificador: no hay forma de atribuir un conteo regresivo a una persona.
- **Nunca comercial.** Estos datos existen sólo para mostrar al público Estadísticas
  panel. **Nunca se vende, se comparte con terceros, se utiliza con fines publicitarios,
  o utilizado para cualquier otro propósito comercial.**
- **Contribuciones opcionales de ID de canal.** Si, y solo si, optas por participar, el
  La extensión/sitio web puede compartir **ID de canal** de YouTube (nunca títulos de vídeo,
  ver historial o cualquier contenido personal) para ayudar a clasificar a los creadores para todos.
- **Contribuciones manuales.** Si un usuario identificado envía canales desde el
  sitio, la relación correo-ID se conserva solo durante la cuota móvil de 24 horas
  y una limpieza horaria elimina los registros vencidos.
- **Cola pública.** Puede mostrar el ID público y el estado de clasificación,
  pero no la hora de envío ni quién lo proporcionó.

## niños

La extensión es una herramienta de productividad de uso general. no lo es
dirigido a niños, no recopila deliberadamente datos de nadie, y
no muestra publicidad.

## Cambios a esta política

Si las prácticas de datos alguna vez cambian en una versión futura, este archivo
actualizarse y el cambio se resumirá en las notas de la versión para
esa liberación.

## Contacto

Preguntas, inquietudes o informes de errores: abra un problema en
repositorio de origen de la extensión, o utilice el correo electrónico de soporte que figura en la
Listado de Chrome Web Store.
