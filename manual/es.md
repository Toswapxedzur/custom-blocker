# Referencia funcional de la extensión de Vault

## Propósito y estado

Esta es la especificación funcional autorizada para la extensión del navegador Vault. Documenta el contrato del producto: los datos que un usuario puede configurar, los comportamientos exactos que produce la configuración, el lenguaje público de reglas personalizadas y los límites que se le aplican.

Deliberadamente no es una guía de inicio rápido. El tutorial del sitio web es el camino de aprendizaje. Este documento está dirigido a personas que necesitan configurar, probar, mantener, auditar o reproducir el comportamiento visible del usuario de Vault.

El código es la verdad canónica cuando este documento y el producto no están de acuerdo. Los nombres en este documento utilizan el vocabulario público/almacenado del producto cuando sea práctico. Una palabra como "devoluciones" significa el valor de devolución puesto a disposición de una regla personalizada; no promete un resultado a nivel del navegador si el navegador o la página rechaza la acción solicitada.

## 1. Límite del producto

Vault es una WebExtension de control de enfoque. Su unidad de configuración es un **grupo de bloques**. Un grupo puede:

- decidir que se debe bloquear un sitio web de alto nivel, una página de plataforma, un creador, una comunidad, un servidor, un canal o una cuenta;
- ocultar superficies de plataforma configuradas o tarjetas de alimentación coincidentes;
- medir el tiempo invertido en un ámbito coincidente;
- aplicar un horario, protección contra congelamiento o repetición temporal cuando ese tipo de grupo lo admita;
- ejecutar una regla de JavaScript personalizada con una API de eventos;
- mostrar un temporizador, panel, mensaje o registro de página en la página;
- redirigir, navegar, cerrar una pestaña del navegador o mantener una lista de bloqueo de sitios creada por reglas solo para sesión;
- Opcionalmente, participe en un clúster de puente Vault conectado localmente.

Vault actúa solo dentro del perfil del navegador donde está instalado y solo donde el navegador permite que se ejecute su secuencia de comandos de contenido. No lo hace:

- instalar una aplicación nativa o una extensión del navegador;
- bloquear aplicaciones del sistema operativo;
- omitir las solicitudes de permiso del navegador, las restricciones de navegación privada o el propio modelo de seguridad de un sitio web;
- garantizar el ocultamiento basado en selectores cuando una plataforma de terceros cambia su DOM;
- hacer que el estado de la regla personalizada sea portátil entre perfiles a menos que el usuario lo exporte/configure por separado;
- proporcionar un firewall de red, un proxy, control de cuentas o un servicio de supervisión parental.

La siguiente terminología se utiliza en todo momento:

| Término | Significado |
| --- | --- |
| Grupo | Un objeto de configuración con nombre independiente. Los nombres deben ser únicos dentro de la extensión, ignorando mayúsculas y minúsculas. |
| Grupo de sitios | Un grupo normal cuya lista de dominios es su principal condición de coincidencia. |
| Grupo de plataformas | Un grupo normal especializado en YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord o Twitter/X. |
| Grupo personalizado | Un grupo que posee una regla de JavaScript y sus registros de eventos. Su regla decide su comportamiento. |
| Partido | La página, el elemento del feed o la superficie de la plataforma satisface las condiciones configuradas de un grupo. |
| Activo | El grupo está habilitado, es elegible para su programación y actualmente no está pospuesto. Los grupos personalizados no se rigen por la interfaz de usuario de programación normal. |
| Bloquear | Evite que la página actual de nivel superior siga siendo utilizable, normalmente redirigiendo a su destino alternativo. |
| Ocultar | Elimina u oculta un elemento/tarjeta en la página representada actualmente. Ocultarse no es un bloqueo de red. |
| URL alternativa | Un objetivo de redireccionamiento específico del grupo. Si está en blanco, se utiliza el respaldo global. |
| Efecto de permiso/excepción | Un veredicto de tarjeta de plataforma que rescata el contenido coincidente de reglas de ocultación de menor prioridad. No es una lista general de sitios web permitidos. |

## 2. Modelo de grupo y ciclo de vida común

Cada grupo almacenado tiene una identificación estable, un nombre, un tipo, una bandera habilitada y campos de política comunes. Un nuevo grupo normal está habilitado de forma predeterminada. Se puede seleccionar un grupo, guardarlo mediante el comportamiento de guardado automático del editor, reordenarlo, exportarlo, importarlo, congelarlo, descongelarlo, posponerlo, deshabilitarlo o eliminarlo.

### 2.1 Ordenamiento y superposición

Más de un grupo puede coincidir con la misma página. Vault evalúa los grupos almacenados desde el final de la lista mostrada hacia el principio. Trate los elementos inferiores de la lista como coincidencias posteriores o de mayor prioridad al diseñar reglas superpuestas.

Para el bloqueo normal de sitios de nivel superior, cualquier grupo de bloqueo aplicable puede hacer que la página no esté disponible. Para el filtrado de tarjetas de alimentación, la cascada de la plataforma utiliza el orden y el efecto de cada grupo coincidente: un permiso/excepción coincidente posterior puede rescatar un elemento de predicados de bloqueo de menor prioridad. Este comportamiento de excepción se limita a la superficie de filtrado de la tarjeta de plataforma; no deshace un bloqueo normal de un sitio de página completa.

### 2.2 Estado habilitado

Los grupos deshabilitados se conservan, pero no participan en las coincidencias normales, los temporizadores, los horarios ni las operaciones normales de repetición de alarma. Al deshabilitar un grupo personalizado también se descargan sus registros activos. Volver a habilitarlo no convierte el texto no guardado en una regla personalizada activa; ejecute la regla para cargar la fuente guardada.

### 2.3 Campos comunes

| Campo | Significado y limitaciones |
| --- | --- |
| Nombre | No vacío, recortado y único sin distinguir entre mayúsculas y minúsculas dentro de este punto final. El puente también identifica los grupos vinculables por nombre y tipo, por lo que los nombres estables son importantes. |
| Habilitado | Activa o desactiva la coincidencia normal. |
| Comportamiento | Bloqueo instantáneo, bloqueo después de una asignación o temporizador/cuenta atrás. Los grupos personalizados utilizan su propia regla en lugar de este selector de comportamiento normal. |
| Minutos permitidos | Número positivo utilizado por el comportamiento de bloqueo después de la asignación. Los grupos nuevos tienen una duración predeterminada de 15 minutos. |
| Restablecer horas de intervalo | Número positivo utilizado por grupos normales cronometrados. Los grupos nuevos tienen una duración predeterminada de 24 horas. |
| Días activos | De lunes a domingo. Un grupo normal está inactivo cuando no se selecciona el día de la semana local actual. |
| Ventanas de tiempo | Cero o más ventanas de hora local, una por línea, escritas como HHMM-HHMM. |
| Modo de congelación | Ninguno, Congelado, Congelado estricto o Congelado parental. |
| Política de repetición de alarma | Si el grupo permite posponer, con controles de duración/retraso/enfriamiento/confirmación para grupos normales. |
| URL alternativa | Destino utilizado si el grupo bloquea una página. |
| Saltar al siguiente | Cuando se proporciona en el editor, solicita al flujo de bloqueo normal que pase más allá del objetivo bloqueado en lugar de permanecer en él. |

### 2.4 Comportamientos normales del grupo

El editor normal ofrece tres comportamientos:

| Comportamiento | Resultado funcional |
| --- | --- |
| Bloquear inmediatamente | Una vez que el grupo está activo y coincide, la decisión normal de bloquear la página es inmediata. |
| Bloquear después de varios minutos | El tiempo de coincidencia de páginas visibles se acumula para la asignación configurada. Cuando se agota la asignación, el grupo normal se bloquea hasta que se restablece su período de uso o hasta que el grupo queda inactivo/pospuesto. |
| Temporizador (cuenta atrás, sin bloqueo) | El tiempo de página visible coincidente se registra y se puede mostrar. Este modo nunca se bloquea simplemente porque su temporizador alcanza un valor. |

El uso cronometrado se basa en el tiempo de página visible. No pretende cobrar tiempo mientras una página está oculta en una pestaña en segundo plano. El intervalo de reinicio es un intervalo de política continuo para el grupo cronometrado normal. Los temporizadores normales son independientes por grupo.

### 2.5 Horarios

Horarios aplican para grupos normales. Un grupo personalizado no tiene una interfaz de usuario de programación normal y se considera activo a efectos de su JavaScript; la regla debe imponer por sí misma cualquier condición de tiempo deseada.

La política de días activos se evalúa utilizando la hora local:

1. Si no se selecciona el día de la semana actual, el grupo normal está inactivo.
2. Si no se proporcionan ventanas de tiempo válidas, un día activo significa el día completo.
3. Si se proporcionan ventanas válidas, la hora local actual debe estar en al menos una ventana.

Cada ventana tiene la forma exacta HHMM-HHMM, por ejemplo 0900-1200. El horario debe ser de 00 a 23, minutos de 00 a 59 y el inicio debe ser antes del final del mismo día. Una ventana incluye su inicio y excluye su final. Las ventanas de medianoche, como 23:00-01:00, no son válidas. Las líneas vacías se ignoran y las ventanas duplicadas se contraen.

### 2.6 Posponer

Para un grupo normal, la repetición es un estado inactivo temporal con hasta tres fases:

| Fase | Resultado |
| --- | --- |
| Pendiente | La repetición solicitada existe pero no se ha iniciado debido a su retraso en la activación. El grupo sigue activo. |
| Activo | El grupo está temporalmente inactivo durante el tiempo de repetición. |
| Enfriamiento | La repetición ha finalizado, el grupo está activo nuevamente y no se puede iniciar otra repetición hasta que expire el tiempo de reutilización. |

Los campos de configuración del grupo normal son:

| Campo | Regla |
| --- | --- |
| Permitir posponer | Si está desactivado, no se puede iniciar la repetición normal. |
| Duración de la repetición | Minutos positivos. Un nuevo grupo normal toma el valor predeterminado global, inicialmente 30. |
| Retraso de activación | Cero o más minutos. En blanco significa cero. |
| Enfriamiento | De cero a cinco minutos. En blanco significa cero. |
| Confirmaciones | Un número entero no negativo. El producto requiere muchas interacciones de confirmación antes de aceptar la solicitud. |

Un grupo Personalizado trata el botón Posponer como un evento de entrada únicamente. Vault emite el evento personalizado denominado snoozePress para ese grupo; no aplica el respaldo de duración/retraso/enfriamiento normal en nombre de la regla. Una regla personalizada puede usar el evento, su propia persistencia, un panel, un temporizador o ninguna acción.

### 2.7 Congelar

La congelación protege a un grupo de los cambios de configuración habituales y de los cambios normales de repetición de alarma. Elegir un modo de congelación en el selector no congela el grupo por sí solo; la acción de congelación aplica el modo elegido.

| Modo | Contrato funcional |
| --- | --- |
| Congelado | El grupo está bloqueado hasta que se completa el flujo normal de confirmación de descongelación del producto. |
| Congelado estricto | El grupo no se puede descongelar hasta que haya transcurrido el período de congelación estricta. La duración deberá ser mayor a cero y no mayor a 72 horas; un nuevo grupo tiene por defecto 24 horas. |
| Congelado parental | Se requiere una contraseña de guardián para la gestión de congelación/descongelación. El cuadro de diálogo de configuración utiliza una contraseña de seis dígitos. |

Los grupos congelados no se pueden editar a través de campos comunes. Un clúster vinculado por puente con un miembro fuera de línea también puede bloquear los controles de congelación porque Vault no puede coordinar de forma segura el estado congelado en todo el clúster. Freeze es protección contra operaciones normales de la interfaz de usuario; no convierte un perfil de navegador en un límite de seguridad inmutable.

### 2.8 Importar, exportar, borrar y restablecer

Exportar produce una representación compatible del grupo seleccionado. La importación valida y normaliza los datos del grupo compatible antes de agregarlos. Los nombres de los grupos importados deben seguir siendo únicos. Eliminar grupo elimina ese grupo y su uso normal/estado de repetición. Borrar elimina todos los grupos después de la confirmación.

Restablecer los valores predeterminados es una operación de **configuración global**. Descarta las preferencias de toda la extensión; no es un sustituto de las importaciones o exportaciones y debe tratarse como destructivo.

## 3. Tipos de grupo y contrato coincidente

### 3.1 Grupo de sitios web predeterminado

Un grupo de sitios posee una lista de sitios web separados por líneas. Las entradas se normalizan en formato de host/dominio. Una entrada de host coincide con ese host y todos sus subdominios.

| Configuración | Resultado |
| --- | --- |
| Bloquear todo excepto estos sitios | La lista es una lista de bloqueo. Un host coincidente está bloqueado. |
| Bloquee todo excepto estos sitios en | La lista es una lista de permitidos. Todos los hosts que no están en la lista están bloqueados. Por lo tanto, una lista de permitidos vacía es un bloqueo intencional de toda la web. |
| Bloquear página de inicio | Aplica la política del grupo a la superficie de inicio/inicio del navegador configurado donde ese control está disponible. |
| URL alternativa | Destino de redirección para un bloque. Un valor de grupo en blanco vuelve al valor predeterminado global. |

La lista normal de dominios del grupo de sitios es la única lista declarativa de todo el sitio expuesta por el editor. En su lugar, los grupos de plataformas coinciden con su propia plataforma y con las condiciones de plataforma configuradas.

### 3.2 Grupos de plataformas de vídeo

YouTube, TikTok, Facebook, Instagram y Twitch son grupos de plataformas de vídeo. Cada uno está limitado a su propia plataforma host. Un grupo puede apuntar al formulario del contenido, al alcance del autor/cuenta, al feed de inicio de la plataforma y a controles opcionales de elementos ocultos.

Los modos de autor generales son:

| Modo | Resultado |
| --- | --- |
| Todo | No restringir por autor; otros ejes configurados deciden el partido. |
| Incluir | Haga coincidir solo los creadores/cuentas normalizados enumerados. |
| Excluir | Haga coincidir todos los creadores/cuentas detectados excepto las entradas enumeradas. |
| Nadie | No coincide con ningún autor. Este es un eje deliberado de autor que no coincide. |
| Etiqueta incluida | Haga coincidir a los creadores con cualquier etiqueta listada cuando Vault pueda clasificarlos. Los creadores desconocidos/no clasificados no se abren. |
| Etiqueta excluir | Haga coincidir a los creadores sin las etiquetas configuradas cuando Vault pueda clasificarlos. Los creadores desconocidos/no clasificados no se abren. |

Las opciones de forma de contenido son específicas de la plataforma:

| Plataforma | Formularios de contenido |
| --- | --- |
| Youtube | Todas las páginas, Shorts, videos largos, publicaciones. |
| Tiktok | Todas las páginas, videos cortos. |
| Facebook | Todas las páginas, Reels, videos, publicaciones. |
| Instagram | Todas las páginas, Reels, videos, publicaciones. |
| Contracción nerviosa | Todas las páginas, clips, transmisiones/VOD, páginas de canales. |

Vault normaliza la entrada del autor. El editor acepta el formulario de identificador/canal/página normal de la plataforma y las URL de perfil admitidas. Puede rechazar entradas con formato incorrecto o mostrarlas como no válidas en lugar de convertirlas silenciosamente en un objetivo diferente.

Las opciones para ocultar la superficie son independientes del bloqueo de nivel superior. Afectan únicamente a la interfaz de usuario de la plataforma actual y pueden dejar de funcionar cuando la plataforma cambia su marcado.

| Plataforma | Opciones de elementos ocultos enviados |
| --- | --- |
| Youtube | Navegación/estanterías/tarjetas de cortos, superficies publicitarias/promocionadas en el feed de inicio y comentarios. La opción relacionada con anuncios presenta una advertencia porque ocultar anuncios puede entrar en conflicto con los términos de una plataforma. |
| Tiktok | Explora la navegación. |
| Facebook | Navegación de carretes y superficies de carretes. |
| Instagram | Carretes y Explorar navegación/superficies. |
| Contracción nerviosa | Explorar la navegación. |

La coincidencia de etiquetas de creador de YouTube utiliza clasificaciones de canales locales/disponibles. Una clasificación faltante no se convierte en un bloque simplemente porque se seleccionó un modo de etiqueta.

### 3.3 Reddit

Un grupo de Reddit solo se aplica en Reddit. Su entidad es un subreddit. La entrada del subreddit acepta el formulario comunitario ordinario y lo normaliza antes de hacer coincidir.

Los modos de subreddit son:

| Modo | Resultado |
| --- | --- |
| Todo | Postúlate a Reddit sin restricciones de lista de subreddit. |
| Incluir | Aplicar a los subreddits enumerados. |
| Excluir | Aplicar a todos excepto a los subreddits enumerados. |
| Nadie | No aplicar a ningún subreddit. |

La opción de ocultar superficie incluida oculta la navegación Popular/Toda. El comportamiento de la tarjeta de alimentación depende de la estructura de tarjeta actualmente detectable de Reddit.

### 3.4 Discordia

Un grupo de Discord se aplica solo en las páginas de Discord/Discordapp. Su objetivo es una identificación de servidor o un par de servidor/canal. El editor de destino acepta valores normalizados de ruta de canal de Discord.

| Modo | Resultado |
| --- | --- |
| Todo | Aplicar a Discord sin restricción de lista de objetivos. |
| Incluir | Se aplica únicamente a los destinos de servidor o de canal/servidor enumerados. |
| Excluir | Se aplica a todos excepto a los objetivos enumerados. |
| Nadie | Aplicar a ningún objetivo. |

Actualmente, Discord no tiene ninguna opción de ocultar elementos en el perfil de plataforma normal.

### 3.5 Twitter/X

Se aplica un grupo Twitter/X en X/Twitter. Puede aplicarse a todas las cuentas o utilizar los modos de cuenta generales descritos para plataformas de vídeo, con entrada de identificador/enlace de perfil normalizada.

Las opciones de elementos ocultos enviadas son Explorar, Mensajes, Grok, Tendencias y elementos de noticias promocionados. Como ocurre con todos los controles de superficie basados ​​en selectores, un cambio en el marcado X puede afectar su funcionamiento.

### 3.6 Campos declarativos de grupos personalizados

Un grupo personalizado ejecuta principalmente su fuente JavaScript. No utiliza el selector de comportamiento normal ni la interfaz de usuario de programación normal. No obstante, puede llevar una lista de dominios cuando se importa o configura a través de datos compatibles:

- una lista de bloqueo personalizada no vacía puede participar en la decisión ordinaria del sitio de toda la página;
- una lista de permitidos personalizada puede participar incluso cuando está vacía, lo que produce un bloqueo declarativo de toda la web;
- un grupo personalizado no configurado no bloquea páginas accidentalmente simplemente porque tiene una regla;
- Los temporizadores personalizados nunca se bloquean solos; una regla decide explícitamente si se bloquea cuando expira un temporizador.

## 4. Configuración global

La configuración global se aplica a la extensión en lugar de a un grupo.

| Configuración | Predeterminado | Comportamiento |
| --- | --- | --- |
| Tasa de ticks | 1000 ms | Frecuencia del tickEvent personalizado compartido. El rango válido es de 250 a 60.000 ms. Los valores más bajos pueden hacer que las reglas basadas en eventos tengan más capacidad de respuesta pero utilicen más CPU. |
| Rebote de guardado automático | 400 ms | Retraso después del último cambio del editor antes de que persista la configuración normal. El máximo es 5.000 ms. |
| Modo de depuración | Apagado | Habilita la salida detallada de seguimiento de reglas personalizadas y la superposición del registro de depuración en la página. No controla si las llamadas de registro ordinarias de una regla llegan al registro emergente. |
| Mostrar registros de reglas personalizadas en páginas web | En | Controla los brindis de registros de páginas normales. Los autores de reglas aún pueden solicitar explícitamente resultados solo en pantalla o solo en ventanas emergentes. |
| Duración predeterminada de la repetición | 30 minutos | Semilla utilizada al crear nuevos grupos normales. Los grupos existentes conservan su propia duración. |
| URL de reserva predeterminada | acerca de:en blanco | Se utiliza cuando un grupo de bloqueo no tiene una URL alternativa específica del grupo. |
| Ayuda a clasificar a los creadores | Apagado | Opción explícita. Envía los identificadores de canales de YouTube encontrados solo al servicio de clasificación configurado; no envía títulos ni historial de visualización. |
| Carpeta de archivos locales | Ninguno | Capacidad de carpeta opcional para reglas personalizadas. Ver sección 9. |

### 4.1 Interfaz del editor y superficies de retroalimentación

El editor de extensiones tiene una lista de grupos persistentes y un editor de grupos seleccionados. La lista de grupos proporciona el selector de tipo de grupo, Agregar, Borrar, selección, habilitar alternancia y orden de arrastre. Su divisor es redimensionable. El editor de grupos seleccionados proporciona campos específicos del grupo y las acciones de Exportación/Importación del grupo.

El editor guarda automáticamente los cambios de campo ordinarios después del período de rebote global. Los errores de validación se informan como comentarios de estado/brindis; los valores normales no válidos no se convierten silenciosamente en configuraciones no relacionadas. Un grupo congelado desactiva sus controles de edición habituales.

La extensión también tiene estas superficies de comentarios visibles para el usuario:

| Superficie | Propósito funcional |
| --- | --- |
| Manual de instrucciones | Abre esta referencia en la extensión. |
| Selector de idioma | Elige el idioma de la interfaz de extensión. |
| Configuración | Abre la configuración global descrita anteriormente. |
| Comentarios sobre el estado/brindis | Los informes guardan, importan, validan y resultados de acciones. |
| Superposición de temporizador en la página | Muestra elementos activos de temporizador normal/cuenta regresiva y temporizadores personalizados que se encuentran en su alcance de visualización. Pueden coexistir varios elementos. |
| Superficie de registro en la página | Recibe llamadas de registro, advertencia y error personalizadas cuando lo permite la configuración global. |
| Registro personalizado | Un registro de actividad en vivo para entradas visibles en ventanas emergentes creadas por reglas. Se puede borrar y descargar. |

Para grupos personalizados, el campo Reglas almacena el texto fuente. Ejecutar primero realiza la verificación previa de la sintaxis de la regla y solo carga el código fuente cuando se realiza correctamente. El editor también realiza linting de fuentes locales a medida que cambia el texto. El control visible **Let AI Code** abre un campo de solicitud y copia un paquete de generación de código que contiene la solicitud del usuario, la regla actual y una referencia generada a la API de regla personalizada actual. No se pone en contacto con un servicio de IA ni cambia automáticamente la regla.

El control Plantillas abre el navegador de plantillas. Una plantilla, cuando se envía, tiene un título, descripción, etiquetas, parámetros y vista previa generada. Su aplicación reemplaza el texto de Reglas actual después de la confirmación. El catálogo de plantillas enviado actualmente está vacío; el navegador permanece disponible para futuras plantillas seleccionadas y no debe tratarse como una fuente de reglas activas.

## 5. Idioma de reglas personalizadas

### 5.1 Formularios fuente de reglas

La fuente de un grupo personalizado es JavaScript. Al **Ejecutar**, Vault elimina los registros anteriores del grupo y el estado creado por la fuente activa anterior y luego carga la nueva fuente.

La fuente puede ser:

1. a function expression accepting events and helpers; or
2. declaraciones simples que utilizan los eventos proporcionados (o eventos heredados) y variables auxiliares.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Run realiza la verificación previa/sintaxis de JavaScript y, solo cuando tiene éxito, activa la fuente actual. Guardar texto y ejecutar texto son intencionalmente diferentes: una regla se puede guardar sin convertirse en la fuente activa del evento.

La fuente activa se descarga cuando el grupo personalizado se vuelve a ejecutar, se desactiva, se elimina o se detiene explícitamente. La nueva ejecución borra los controladores, temporizadores, paneles, depósito de persistencia y predicados de plataforma creados por reglas de la regla antes de que comience el registro. Una recuperación de espacio aislado puede recargar la fuente activa; Por lo tanto, los autores de reglas deben hacer que el registro sea idempotente.

### 5.2 Modelo de ejecución y supuestos seguros

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Cada manejador recibe:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Controladores para un evento ejecutado con prioridad numérica descendente; Orden de registro de usos de igual prioridad. Un controlador se puede reemplazar registrando nuevamente el mismo tipo de evento e identificación. Hay un máximo de 1000 controladores registrados para un grupo personalizado.

Vault limita el trabajo activo de un controlador a aproximadamente un segundo. Tres incumplimientos de plazos para el mismo grupo en un minuto ponen en cuarentena la regla: Vault la desactiva en lugar de ejecutar repetidamente un controlador problemático. No utilice esperas ocupadas, bucles ilimitados, sondeos sincrónicos o una gran cantidad de mutaciones/registros por evento.

Por envío, Vault acepta como máximo:

| Artículo | Máximo |
| --- | --- |
| Entradas del registro de reglas | 200 |
| Eventos publicados | 64 |
| Operaciones DOM | 256 |
| Acción/intenciones | 256 |
| Paneles por grupo | 24 |
| Controles en un solo panel | 32 |
| Opciones en select/radio control | 64 |

Se pueden eliminar el exceso de entradas de registros, eventos publicados, operaciones DOM e intenciones. Una regla personalizada no debe depender de la entrega de entradas excedentes.

### 5.3 Tipos de eventos integrados

Las siguientes cadenas de tipo evento están integradas. Una regla también puede usar su propia cadena de tipo no vacía, siempre que no comience con un guión bajo.

| Tipo de evento | Cuando se envía | Datos importantes |
| --- | --- | --- |
| tickEvento | Tick ​​periódico compartido en la configuración de tasa de tick global. | Contexto de página/pestaña actual cuando esté disponible. Utilice la opción de registro de intervaloM para limitar la velocidad de un controlador individual. |
| openWebEvent | Una página de nivel superior pasa a estar disponible para la regla. | URL, nombre de host, ID de pestaña/página, hora. |
| cerrarEventoWeb | Se cierra una página/pestaña de nivel superior. | Contexto de URL/nombre de host cuando esté disponible. |
| webChangedEvent | Una navegación comprometida de nivel superior, incluidas recargas de la misma URL. | los datos llevan URL/nombre de host anterior y indicadores de navegación como isFirstLoad, isReload y SameDomain. |
| temporizadorfinalizado | Un temporizador personalizado cambia a su estado caducado. | datos: timerId, displayName, dirección, currentMs. Se entrega únicamente al grupo propietario del temporizador. |
| posponerPresionar | El usuario presiona Iniciar repetición para este grupo personalizado. | La regla es dueña de la respuesta; no se realiza ninguna repetición de repetición normal. |
| panelEvento | Un panel personalizado renderizado tiene una interacción. | Los campos de datos y conveniencia incluyen información de panel/control/evento/valor. |
| evento de archivo local | Se completa una acción de archivo local solicitada. | Los campos de datos y de conveniencia incluyen requestId, ruta, resultado, bytes, entradas y error. |
| páginaHeartbeatEvent | Un latido de página visible, aproximadamente cada 250 ms mientras la pestaña está visible. | elapsedMs es el tiempo transcurrido de la página visible. Los temporizadores personalizados con alcance lo usan automáticamente incluso sin un controlador registrado. |

### 5.4 API de registro de eventos

El primer argumento para una fuente de estilo de función es el registro de eventos. En la fuente simple, tanto los eventos como el evento se refieren a este registro.

| Método | Contrato |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

El objeto de opciones del controlador opcional admite:

| Opción | Significado |
| --- | --- |
| prioridad | Orden numérico. Los valores más altos se ejecutan antes que los valores más bajos. Predeterminado 0. |
| intervaloMs | Número positivo. Solo para tickEvent, suprime las llamadas hasta que haya transcurrido este tiempo desde la llamada anterior del controlador. |

Los eventos sintéticos tienen de forma predeterminada el alcance del grupo: solo los reciben los controladores que pertenecen al grupo emisor. Utilice {scope: "global" } para enviar el evento a cada regla que registró el mismo tipo. No utilice un guión bajo al principio del nombre de un evento; esta reservado.

### 5.5 Objeto de evento

Cada controlador recibe un objeto de evento mutable con campos comunes:

| Campo/método | Contrato |
| --- | --- |
| tipo | Cadena de tipo de evento. |
| ID de grupo | ID del grupo personalizado del destinatario. |
| tabId, páginaId | Identificadores del navegador cuando estén disponibles; de lo contrario nulo. |
| URL, nombre de host | URL de nivel superior actual y nombre de host, o cadenas vacías. |
| tiempo | Copia del objeto de tiempo de despacho, o nulo. |
| datos | Carga útil específica del evento o nula. |
| prevenirDefault() | Marca el envío como una acción de bloqueo de página. La página se redirige al enlace/resultado de redireccionamiento actual, si existe; de lo contrario, Vault utiliza la ruta de salida/retroceso normal. |
| detenerPropagación() | Detiene los controladores posteriores para el envío del evento actual. |
| establecerResultado(valor) | Almacena un resultado numérico o de cadena. Una cadena que no esté vacía se trata como un destino de redireccionamiento; El resultado 1 suprime un resultado preventDefault que de otro modo se acumularía. |
| obtenerResultado() | Devuelve el resultado establecido por este objeto de evento, o nulo. |
| post(tipo, datos, opciones) | Ponga en cola un evento sintético, con las mismas reglas de alcance que Events.post. |
| setRedirectLink(url) | Establezca la URL de redireccionamiento para este envío. Devuelve falso solo para una entrada que no sea una cadena. |
| getRedirectLink() | Lea la URL de redireccionamiento de este envío o una cadena vacía. |
| cerrar(identificación) | Solicitar cerrar una pestaña. Un número es una identificación de pestaña, una cadena identifica una URL y un valor omitido apunta a la pestaña activa. |
| bloque (identificación) | Agregue un patrón de bloqueo de sitio dinámico de solo sesión. Sin una identificación de cadena, use el nombre de host del evento. |
| desbloquear(identificación) | Elimine un patrón de bloqueo de sitio dinámico de solo sesión. Sin una identificación de cadena, use el nombre de host del evento. |
| abierto() | No operativo en la extensión del navegador. No puede iniciar aplicaciones. |

Un controlador puede adjuntar propiedades adicionales arbitrarias al evento. Léalos a través de event.custom o directamente por el nombre asignado mientras ese objeto de evento esté activo. No son estados persistentes ni almacenamiento de eventos cruzados.

Para panelEvent, se agregan estos campos de conveniencia: panelId, controlId, eventName, valor, valores, clave, código y keyInfo.

Para localFileEvent, se agregan estos campos convenientes: nombre del evento, acción, ruta, ruta del directorio, ID de solicitud, ok, texto, valor, entradas, existe, bytes y error.

### 5.6 Puntos de entrada del ayudante

El objeto de ayuda tiene estas propiedades directas:

| Punto de entrada | Significado |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Referencia de ayuda personalizada

### 6.1 Asistente de dominio

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Método | Retorno y comportamiento |
| --- | --- |
| nombre de host de (url) | Host normalizado en minúsculas sin www. inicial, o nulo para una URL no válida. |
| nombrerutaDe(url) | Nombre de ruta de la URL o / cuando la URL no se puede analizar. |
| coincidencias (nombre de host, sitio) | Verdadero cuando el nombre de host es igual al sitio o es su subdominio. |
| obtenerPlataforma(url) | youtube, tiktok, instagram, facebook, twitch o null. |
| isYouTubeHost(anfitrión), isTikTokHost(anfitrión), isInstagramHost(anfitrión), isFacebookHost(anfitrión), isTwitchHost(anfitrión), isRedditHost(anfitrión), isDiscordHost(anfitrión) | Clasificadores de anfitriones. |
| youtube(), tiktok(), instagram(), facebook(), contracción nerviosa() | Devuelve el objeto clasificador de URL de esa plataforma. |
| isEmptyStartPage(url) | Verdadero para las URL en blanco/nueva pestaña/página de inicio admitidas por el navegador. |
| coincide con Cualquiera (url, patrones) | Haga coincidir una URL con una RegExp, una matriz RegExp o cadenas compiladas como expresiones regulares. Se ignoran los patrones de cadena no válidos. |
| rutaStartsWith(url, ruta) | Verdadero para una ruta exacta o un descendiente de una ruta. Se proporciona una barra diagonal inicial que falta. |
| queryHas(url, clave, valor) | Verdadero si existe una clave de consulta; cuando se proporciona el valor, también debe ser igual al valor de la cadena. |
| consultaObtener(url, clave) | Valor de consulta o nulo. |
| esPáginadebúsqueda(url) | Detecta URL de búsqueda compatibles con Google, Bing, DuckDuckGo, YouTube, Reddit y X/Twitter. |
| esInfiniteFeedUrl(url) | Detecta superficies admitidas de alimentación infinita. |
| mismaSección(a, b) | Verdadero solo cuando ambas URL comparten un host y el primer segmento de nombre de ruta. |

Cada objeto clasificador de URL de plataforma expone isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) y extractVideoId(url). Un método puede devolver falso/nulo cuando la URL es válida pero no identifica ese tipo de contenido.

### 6.2 Asistente del temporizador

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Crear/obtener opciones:

| Opción | Significado |
| --- | --- |
| identificación | ID de temporizador no vacío requerido. |
| nombre para mostrar | Etiqueta superpuesta legible por humanos. |
| dirección | adelante para contar; cualquier otro valor se vuelve hacia atrás/cuenta regresiva. |
| señora actual | Milisegundos iniciales, fijados a cero y acotados si existen límites. |
| minMs, maxMs | Límites mínimo/máximo positivos opcionales. |
| pasos | Paso de cuantificación positiva opcional para ticks transcurridos. |
| estilo de superposición | Cadenas opcionales para color, fondo, tamaño de fuente, peso de fuente, borde, radio del borde, relleno, opacidad e icono. Las piezas no admitidas o no válidas se descartan. |
| alcance(url) | Predicado que decide dónde se acumula el tiempo de página visible. |
| dominio(url) | Predicado que decide dónde aparece el temporizador en la superposición; El valor predeterminado es el alcance. |
| acumularCuando(url) | Predicado adicional opcional. El tiempo se acumula solo cuando tanto el alcance como el tiempo acumulado son verdaderos. |

| Método | Comportamiento |
| --- | --- |
| crear(opciones) | Crea/reemplaza un temporizador y restablece su estado. Devuelve identificación o nulo. |
| getOrCreateTimer(opciones) | Crear sólo si está ausente. El estado actual permanece sin cambios. Devuelve identificación o nulo. |
| eliminar (identificación) | Elimine el temporizador y sus predicados de alcance/visualización. |
| pausa(id), reanudar(id) | Cambiar el estado de pausa. Devuelve verdadero solo cuando es posible un cambio de estado. |
| setDirection(id, dirección) | Establecer hacia adelante o hacia atrás. |
| setCurrentMs(id, ms) | Establecer un recuento absoluto y hacer cumplir los límites. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Ajustar el conteo, haciendo cumplir los límites. |
| setBounds(id, minMs, maxMs) | Establecer límites positivos; pase null para un enlace que lo elimine. |
| setStep(id, pasoMs) | Establezca una cuantificación de tick positiva. Pase nulo o cero para borrarlo. |
| setOverlayStyle(id, estilo) | Reemplazar/borrar estilos de superposición permitidos. |
| setDisplayName(id, nombre) | Establecer etiqueta de superposición. |
| getCurrentMs(id) | Número, cero para un cronómetro ausente. |
| está caducado (identificación) | Verdadero solo cuando existe un temporizador y currentMs es cero. |
| está en pausa (id) | Booleano. |
| getDirection(id), getDisplayName(id) | Dirección/nombre o nulo. |
| existe (identificación) | Booleano. |
| getState(id) | Instantánea del temporizador serializable o nula. |
| lista() | Matriz serializable de instantáneas del temporizador. |

Los predicados de alcance se recuerdan mientras la fuente personalizada permanece cargada. Vault avanza los temporizadores coincidentes durante los ciclos visibles de pageHeartbeatEvent, un tick por temporizador por envío. Un temporizador hacia atrás se detiene en cero y emite timerEnded en la transición a cero. Permanece cero hasta que la regla lo cambia/restablece. Utilice un controlador finalizado por temporizador para decidir si un temporizador expirado debe llamar a preventDefault, establecer una redirección o realizar otra acción.

### 6.3 Almacenamiento persistente y asíncrono

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Método | Comportamiento |
| --- | --- |
| get(clave, valor predeterminado) | Leer un valor clonado o defaultValue. |
| establecer (clave, valor) | Almacene un clon seguro para JSON. Devuelve falso para clave/valor no válido o agotamiento del límite de clave. |
| eliminar (clave) | Eliminar clave existente; devuelve si existió. |
| tiene (clave) | Booleano. |
| claves() | Conjunto de claves. |
| entradas() | Matriz de pares [clave, valor] clonados. |
| claro() | Elimine toda la persistencia de reglas para este grupo. |
| tamaño() | Número de llaves. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Método | Comportamiento |
| --- | --- |
| solicitudAsyncGet(clave) | Solicite una lectura de almacenamiento asíncrona. Devuelve verdadero cuando está en cola. Utilice un evento posterior/su propio flujo de estado para responder; no es un captador sincrónico. |
| requestAsyncSet(clave, valor) | Solicite un almacén asincrónico seguro para JSON. Devuelve verdadero cuando está en cola. |

La persistencia de la regla se borra al ejecutar porque una nueva fuente activa comienza con un estado de regla personalizada limpio.

### 6.4 Ayudante de registro

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Método | Destino |
| --- | --- |
| registro, advertencia, error | Registro de actividad emergente; brindis de página cuando los brindis de registro de página global están habilitados. |
| logScreen, warnScreen, errorScreen | Página tostada/superficie de depuración únicamente; excluido del registro emergente. |
| logPopup, warnPopup, errorPopup | Registro de actividad emergente únicamente; excluido del brindis de página. |

Los registros también intentan llegar a la consola del navegador con un prefijo de grupo CustomBlocker. Este es un resultado de diagnóstico, no una API de persistencia. Utilice el asistente de persistencia para el estado.

### 6.5 Ayudante de redireccionamiento

Get it with helpers.getRedirectionHelper().

| Método | Comportamiento |
| --- | --- |
| get(), getRedirectLink() | Devuelve la URL de redireccionamiento de envío actual o una cadena vacía. |
| establecer(url), establecerRedirectLink(url) | Establezca la URL de redireccionamiento para el envío actual. |
| crearUrlMensaje(mensaje) | Cree una URL de página de mensaje local de extensión que muestre el mensaje proporcionado. |

Configurar una redirección por sí sola no fuerza la navegación. Emparéjelo con event.preventDefault(), o establezca una cadena no vacía a través de event.setResult(), de acuerdo con el flujo de reglas deseado.

### 6.6 Ayudante DOM

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Método | Acción solicitada |
| --- | --- |
| ocultar(selector), mostrar(selector) | Ocultar/mostrar elementos coincidentes. |
| addClass(selector, className), removeClass(selector, className) | Mutar clase CSS. |
| setText(selector, texto) | Reemplazar contenido de texto. |
| hacer clic (selector) | Haga clic en el elemento coincidente. |
| inyectarCss(css, id) | Agregue un bloque CSS identificado. |
| eliminarInjectedCss(id) | Elimina un bloque CSS inyectado previamente identificado. |
| desplazarse a (selector) | Desplazar un elemento coincidente a la vista. |

Las acciones DOM no proporcionan secuencias de comandos de página sin restricciones. Son una superficie de acción limitada y deben ser idempotentes cuando se usan desde controladores de latidos/tictacs.

### 6.7 Navegación, pestañas y asistente de ventana del navegador

Get navigation with helpers.getNavigationHelper().

| Método | Acción solicitada |
| --- | --- |
| atrás() | Navega hacia atrás en la pestaña actual. |
| adelante() | Navega hacia adelante en la pestaña actual. |
| recargar() | Recargar la pestaña actual. |
| ir a (url) | Navegue por la pestaña actual hasta la URL. |
| cerrarTab() | Cerrar la pestaña actual. |

Get a snapshot helper with helpers.getTabHelper().

| Método | Regreso/acción |
| --- | --- |
| lista() | Copia de la instantánea de la pestaña actual. |
| getActiveTab() | Instantánea de la pestaña activa o nula. |
| getById(identificación) | Instantánea de pestaña coincidente o nula. |
| contarOpen() | Número de pestañas en la instantánea. |
| solicitudRefresh() | Solicite una instantánea de una nueva pestaña para trabajar con reglas más adelante. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Método | Comportamiento |
| --- | --- |
| actual() | Objeto de pestaña activo actual: id, url, nombre de host, título, isBrowser. |
| todos() | Matriz de objetos de pestaña con identificación, URL, nombre de host, título, activo. |
| cerrar(idOrUrl) | Cierra por ID de pestaña numérica, cadena de URL exacta o pestaña activa cuando se omite. |
| cerrarTab() | Cerrar pestaña activa. |
| bloque (patrón) | Agregue un bloque de dominio normalizado de solo sesión y aplíquelo. |
| desbloquear (patrón) | Eliminar un bloqueo de dominio normalizado de solo sesión. |
| está bloqueado (url o nombre de host) | Consulta la lista de bloqueo de sesiones creadas por reglas. |
| obtenerBloqueado() | Enumere los patrones creados en la sesión actual. |

Los patrones de bloques creados por reglas normalizan http/https, llevando a www. y las rutas a un patrón de host. Coinciden exactamente con el host y los subdominios. Esta lista de bloqueo dinámica es memoria de sesión, no un grupo de sitios normal guardado.

### 6.8 Ayudante de carpeta de archivos local

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Método | Comportamiento |
| --- | --- |
| está disponible() | Informa que la superficie API existe; no prueba que una carpeta esté actualmente autorizada. |
| solicitudLeer(ruta) | Solicitar lectura de texto. |
| requestWrite(ruta, texto) | Solicitar escritura de texto. |
| requestAppend(ruta, texto) | Solicitar texto adjunto. |
| lista de solicitudes(ruta = "") | Solicite un listado del directorio. |
| solicitudExiste(ruta) | Solicitar prueba de existencia. |
| requestReadJson(ruta) | Solicitar lectura JSON; la ruta debe terminar en .json. |
| requestWriteJson(ruta, valor) | Solicitar escritura JSON; la ruta debe terminar en .json y el valor debe ser seguro para JSON. |

Las rutas siempre son relativas a la raíz seleccionada. No pueden ser absolutos, calificados para unidades, tener prefijos de punto ni contener archivos . o... segmentos. Solo se aceptan archivos .txt, .csv y .json para operaciones con archivos. La selección de carpeta se puede revocar en cualquier momento; una solicitud fallida informa ok false y una cadena de error en localFileEvent.

### 6.9 Ayudante de plataforma

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Todas las API de plataforma sin formato exponen:

| Método | Comportamiento |
| --- | --- |
| ocultar(predicado, opciones) | Establezca el mismo predicado por elemento para cada ranura para tarjeta de alimentación en esa plataforma. |
| ocultar(ranura, predicado, opciones) | Establezca un predicado por elemento. El predicado recibe el elemento/instantánea de la plataforma proporcionado por esa plataforma. |
| permitir(predicado, opciones), permitir(ranura, predicado, opciones) | Igual que ocultar pero crea un veredicto de permiso/excepción. |
| mostrar(), mostrar(ranura) | Borre todas o una ranura de predicado instalada. |
| superficie(nombre, "ocultar" o "mostrar") | Ocultar/mostrar una región completa de la plataforma. home es el nombre público de la página de inicio. |
| temporizador(ranura, opciones) | Configure un temporizador de subsección de plataforma. Devuelve options.id cuando se proporciona; de lo contrario, es nulo. |
| volver a escanear() | Vuelva a evaluar las tarjetas de alimentación ya escaneadas después de cambios de estado de reglas externas. |
| instantánea() | Devuelve la instantánea de la plataforma actual o nula. |
| ranuras(), superficies(), timerSlots() | Devuelve los nombres admitidos para esta plataforma. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | Asistentes de URL para esa plataforma. |

Una ranura posee un predicado para un grupo/plataforma. Una llamada posterior a ocultar/permitir para el mismo espacio reemplaza el predicado anterior; no es un OR implícito. El objeto de opciones opcionales reconoce:

| Opción | Efecto |
| --- | --- |
| blockPageOnVisit | Cuando se visita una tarjeta/página coincidente, solicite un bloqueo de página en lugar de simplemente ocultar la tarjeta. |
| efecto | bloquear (predeterminado) o permitir. Los conjuntos de ayudas permitidas lo permiten automáticamente. |

Llame a una nueva exploración siempre que un predicado dependa del estado que cambió después de que las tarjetas se evaluaron por primera vez, como una casilla de verificación del panel, una cuota o un umbral de tiempo.

Matriz de soporte de plataforma sin formato:

| Plataforma | Ranuras de predicado | Nombres de superficies | Ranuras de temporizador |
| --- | --- | --- | --- |
| Youtube | cortos, videos, publicaciones, comentarios, en vivo | inicio, shortButton, comentarios, en vivo | cortos, vídeos, publicaciones |
| Tiktok | vídeos, comentarios, en directo | inicio, comentarios, en vivo | vídeos |
| Instagram | cortos, publicaciones, comentarios | inicio, comentarios | cortos, publicaciones |
| Facebook | cortos, videos, publicaciones, comentarios, en vivo | inicio, comentarios, en vivo | cortos, vídeos, publicaciones |
| Contracción nerviosa | cortos, transmisiones, videos, en vivo | inicio, comentarios, en vivo | cortos, transmisiones, vídeos |

El asistente de plataforma personalizada sin formato no expone Reddit, Discord o Twitter/X. Utilice URL generales, DOM, temporizador, panel y capacidades de navegación para un trabajo personalizado en esos sitios.

## 7. Paneles personalizados

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### API del panel 7.1

| Método | Comportamiento |
| --- | --- |
| crear(configuración) | Crear o reemplazar un panel. Devuelve la identificación del panel normalizada o nula. |
| getOrCreatePanel(config) | Crear sólo cuando esté ausente; devuelve identificación o nulo. |
| actualización (id, parche) | Reemplace los campos del panel especificados después de la validación. |
| eliminar (identificación) | Elimine un panel y sus controladores en línea registrados. |
| mostrar (identificación), ocultar (identificación) | Cambiar visibilidad. |
| setValue(ID de panel, ID de control, valor) | Establezca un valor de control grabable después de la validación. |
| updateControl(ID del panel, ID del control, parche) | Reemplazar los campos permitidos de un control. |
| deshabilitar (Id del panel, Id de control), habilitar (Id del panel, Id de control) | Alternar control de disponibilidad. |
| setOptions(ID de panel, ID de control, opciones) | Reemplace las opciones de selección/radio. |
| setText(ID del panel, ID de control, texto) | Actualice la etiqueta de un botón, texto/texto de sección u otra etiqueta de control. |
| setTheme(ID del panel, tema) | Reemplazar el tema del panel. |
| setTitle(panelId, título), setDescription(panelId, descripción) | Actualizar texto. |
| getValue(Id. del panel, Id. del control) | Devuelve un valor clonado o indefinido. |
| getValues(ID del panel) | Devuelve todos los valores grabables codificados por la identificación del control. |
| getState(id) | Devuelve una instantánea del panel serializable o nula. |
| lista() | Devuelve instantáneas serializables de todos los paneles. |
| aviso(config) | Cree un panel de estado compacto en la parte inferior derecha con mensaje/texto opcional. |
| confirmar (configuración) | Cree un cuadro de diálogo centrado con botones de confirmación y cancelación generados. |
| lista de verificación (config) | Cree un panel de elementos de casilla de verificación. |
| formulario(config) | Cree un panel de diseño de formulario a partir de campos. |

### 7.2 Configuración del panel

| Campo | Valores/comportamientos aceptados |
| --- | --- |
| identificación | Requerido. Normalizado a letras, dígitos, guión bajo, guión; máximo 80 caracteres. |
| título | Título del panel, máximo 240 caracteres. |
| descripción o cuerpo | Descripción, máximo 1.000 caracteres. |
| posición | arriba a la izquierda, arriba a la derecha, abajo a la izquierda, abajo a la derecha o centro. Predeterminado abajo a la derecha. |
| alinear | izquierda, centro o derecha. Por defecto a la izquierda. |
| diseño | vertical, compacto, cómodo, espacioso, en línea, en fila, envuelto, en dos columnas, en cuadrícula, dividido, en forma, en barra de herramientas o en pila. Vertical por defecto. |
| prioridad | Orden de visualización numérico, fijado entre -1000 y 1000. Los paneles superiores se muestran primero. |
| ancho | Pequeño, mediano, grande o de 180 a 520 px. |
| Tamaño del texto/Tamaño de la fuente | De 10 a 32 px, o de 0,65 a 2 rem/em. |
| ariaLabel/a11yLabel | Etiqueta accesible. |
| papel | región, cuadro de diálogo, alerta, estado, formulario o grupo. |
| enfoque automático | Booleano. |
| tema/colores | fondo, primer plano, acento, borde, silenciado, tamaño de fuente/tamaño de texto, tamaño de título. |
| controles | Matriz de hasta 32 controles, con secciones anidadas de hasta tres niveles. |
| visibles | Falso oculta el panel. |
| alcance(url), dominio(url) | Funciones que controlan la disponibilidad/visualización. el dominio tiene prioridad; sin dominio, se muestran los controles de alcance. |

Los campos del controlador en línea del panel pueden aparecer en el panel o en el control individual: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey y onKeyDown. Cada uno recibe los parámetros normales (evento, ayudantes). Un controlador en línea se reemplaza cuando ese panel se recrea/actualiza con definiciones de control.

### 7.3 Controles

Los tipos de control disponibles son texto, casilla de verificación, selección, entrada de texto, área de texto, botón, sección, temporizador, entrada numérica, rango, alternar, radio, fecha, hora, color, pin y html. La entrada de alias, el menú desplegable, el grupo, el número, el control deslizante, el interruptor, el formato sin formato y el marcado se normalizan a su tipo correspondiente.

Todos los controles aceptan identificación, tipo, etiqueta, valor, deshabilitado, prioridad y, cuando sea relevante, diseño, alineación, ariaLabel/a11yLabel, enfoque automático, ancho, alto y filas.

| Tipo | Campos importantes y contrato de valor |
| --- | --- |
| texto | texto (o etiqueta) representado como texto sin entrada. |
| casilla de verificación, alternar | Valor booleano. |
| seleccionar, radio | opciones como cadenas u objetos {valor, etiqueta}; máximo 64. El valor es una cadena corta. |
| entrada de texto, área de texto | Valor de cadena, máximo 2000 caracteres; marcador de posición opcional. |
| botón | etiqueta/texto; acción opcional enviar, cancelar o cerrar. |
| sección | texto/descripción, rol y controles anidados. |
| temporizador | timerId o instantánea del temporizador; formato ms, ss, mm:ss o hh:mm:ss; showExpired valores predeterminados verdaderos. |
| númeroEntrada, rango | Valor numérico fijado al mínimo/máximo suministrado; paso positivo opcional. |
| fecha | Solo valor AAAA-MM-DD. |
| tiempo | Valor HH:MM o HH:MM:SS únicamente. |
| color | Valor de entrada #RRGGBB de seis dígitos. |
| alfiler | Solo dígitos, longitud de 3 a 12, enmascarado de forma predeterminada, envío automático opcional. |
| HTML | Marcado desinfectado. Bloques de script, atributos de eventos en línea y javascript: se eliminan las URL. |

Cada interacción renderizada genera panelEvent. El objeto de valores del evento contiene los controles de escritura del panel, excluyendo botones, texto y controles de temporizador. Una acción de cierre oculta el panel antes de que los controladores observen el evento.

## 8. Recetas de acciones de reglas personalizadas

Los siguientes ejemplos son especificaciones de composición pública, no un tutorial.

### 8.1 Redirigir una página de apertura

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Cuenta regresiva del tiempo visible con bloqueo explícito

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Cambiar un predicado de feed desde un panel

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Se deben escribir predicados para los valores de elementos/instantáneas de la plataforma proporcionados por la superficie de la plataforma activa. Si una plataforma no puede identificar un campo de manera confiable, el predicado debería fallar al abrirse en lugar de asumir que un valor es verdadero.

## 9. Protocolo de solicitud de carpeta local

Las operaciones de carpeta local no son E/S de archivos inmediatas. La secuencia funcional completa es:

1. El usuario selecciona una carpeta en Configuración global.
2. La regla pone en cola una solicitud y recibe una identificación de solicitud.
3. Vault solicita a la capacidad de la carpeta autorizada que realice la operación.
4. Vault envía localFileEvent al mismo grupo personalizado.
5. El controlador correlaciona event.requestId con la identificación de la solicitud original.

La lectura exitosa se completa con texto para archivos de texto o valor para JSON. La lista devuelve entradas. Existe devoluciones existe. Escribir/añadir proporciona bytes cuando corresponda. El error proporciona ok falso y error. Las reglas nunca deben asumir que una carpeta seleccionada permanece autorizada después de una recarga, un reinicio del navegador o una revocación de permiso.

## 10. Semántica de fallas y seguridad de reglas personalizadas

### 10.1 Errores de compilación y ejecución

Verifique el error de compilación de informes de sintaxis. Run también puede informar un error de tiempo de ejecución durante el registro. Si una fuente similar a una función tiene un error de sintaxis, Vault no vuelve a tratarla silenciosamente como declaraciones simples e inofensivas.

Una fuente vacía no tiene controladores. Es válida como regla personalizada inactiva, pero no realiza ninguna acción personalizada configurada.

### 10.2 Errores del controlador

Una excepción de un controlador se aísla del envío general de eventos. Es un resultado de diagnóstico; no hace que los manejadores posteriores tengan éxito mágicamente. Utilice controladores limitados y registre errores procesables.

### 10.3 Cuarentena

Vault puede poner en cuarentena un grupo personalizado después de repetidos incumplimientos de plazos o de un incumplimiento durante el registro. La cuarentena deshabilita el grupo y registra su motivo de cancelación. Corrija la fuente, guárdela y ejecútela explícitamente nuevamente para restaurar los registros activos.

### 10.4 Límites de navegador/página

Ninguna regla personalizada recibe API de extensión sin restricciones. En particular:

- un selector DOM no puede encontrar nada en una plataforma que haya cambiado;
- la navegación, el cierre de pestañas y las acciones de pantalla siguen estando sujetas a las capacidades del navegador;
- una extensión no puede abrir aplicaciones nativas;
- las operaciones de carpeta local requieren una carpeta otorgada por el usuario y los tipos de archivos admitidos;
- un controlador de eventos no puede confiar en que una página invisible continúe produciendo latidos en tiempo visible;
- una página puede recargar, navegar, ser descartada o invalidar un script de contenido independientemente de la regla;
- Los bloques de sitios dinámicos creados por reglas son acciones de estado de sesión, no ediciones permanentes de grupos de sitios.

## 11. Puente de aplicación web

La extensión del navegador inicia automáticamente su conexión con el centro Vault local compatible en ws://127.0.0.1:8787. No hay un interruptor de conexión para el usuario y se requiere compatibilidad de protocolo.

Vault prueba primero rápidamente y luego continúa con intentos de reconexión más lentos mientras se ejecuta la extensión. El transporte automático no fusiona grupos por sí solo; vincularlos y desvincularlos sigue siendo explícito.

### 11.1 Vinculación de grupos

Los grupos se pueden vincular solo cuando su nombre y tipo coinciden y son elegibles para vincularse. El usuario selecciona/vincula explícitamente los programas participantes. Un grupo vinculado forma un cluster. La desconexión deja intactos los datos del grupo local; detiene la sincronización en vivo.

El puente sincroniza la política escalar compartida para los grupos vinculados admitidos, incluido el modo de bloqueo normal, los valores permitidos/restablecidos, la configuración de repetición de alarma, los días/ventanas activos, el estado/elección/duración de la congelación, la política de la página de inicio, la configuración de la lista de permitidos, la URL alternativa y la política de saltar al siguiente. También coordina el uso y el estado de repetición de alarma para los miembros del clúster.

El puente no promete que cada campo específico del producto, selector de plataforma, texto fuente personalizado o capacidad específica del navegador sea transferible a un programa diferente. Un grupo puede permanecer local y desvinculado incluso mientras el puente está conectado.

Los grupos de puentes congelados requieren que todos los miembros relevantes estén en línea para acciones de estado congelado que necesitan una mutación coordinada. Una conexión es transporte local, no una copia de seguridad en la nube o un canal de control remoto.

## 12. Lista de verificación de verificación para mantenedores

Utilice esta lista de verificación cuando audite una publicación o reproduzca un comportamiento:

1. Confirme que el grupo tenga un nombre único que no esté vacío, un tipo correcto, un estado habilitado y una lista/orden previstos.
2. Para grupos normales, confirme el día de la semana activo, la ventana de hora local válida, la ausencia de repetición activa y el estado de edición no congelado.
3. Para un grupo de sitios, pruebe el host exacto, el subdominio y (para la lista de permitidos) un host fuera de la lista.
4. Para un grupo de plataformas, pruebe por separado la coincidencia a nivel de página, la coincidencia de elemento/tarjeta de destino, el modo de autor, el modo de formulario de contenido y cada ocultación de superficie habilitada.
5. Para grupos normales cronometrados, verifique la acumulación de páginas visibles, el vencimiento de la asignación o el comportamiento sin bloqueo del conteo y restablezca el intervalo.
6. Para reglas personalizadas, ejecute la verificación de sintaxis, Ejecute, inspeccione el recuento/los registros del controlador, pruebe cada evento integrado registrado y luego pruebe una recarga/navegación.
7. Pruebe cada temporizador personalizado en los límites del alcance y en cero; Verifique que cualquier bloque sea explícito en la regla.
8. Pruebe los paneles con cada valor de control, estado deshabilitado, acción de envío/cancelación/cierre y controlador de panelEvent.
9. Pruebe el error de la carpeta local antes del éxito: no hay carpeta seleccionada, permiso revocado, ruta no válida, extensión no compatible y luego lectura/escritura autorizada.
10. Pruebe el inicio automático del transporte, los grupos vinculados/desvinculados y un miembro del clúster fuera de línea antes de confiar en la sincronización o la coordinación de congelación.

## 13. Regla de versiones

Este archivo en inglés es el manual fuente mantenido. Los manuales localizados son traducciones de los mismos y pueden requerir regeneración después de una actualización de la documentación funcional. La fuente del producto sigue siendo la verdad canónica para la ambigüedad a nivel de implementación.
