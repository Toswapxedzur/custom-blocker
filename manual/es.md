# Manual de usuario de la extensión de navegador Vault

Vault controla sitios web y contenido de plataformas compatibles en el perfil del navegador donde está instalado. Abra su editor desde el botón de la extensión en la barra de herramientas. Mac Vault o Windows Vault proporciona etiquetado local y Actividad cuando está conectado; la extensión aplica los objetivos del navegador.

## Grupos de bloqueo

Un **grupo de bloqueo** aplica una política de bloqueo. Un **grupo del Clasificador** asigna etiquetas al contenido; por sí mismo no bloquea nada.

1. Añada un grupo de bloqueo y asígnele un nombre.
2. Elija objetivos en **Se aplica a**.
3. Elija cuándo se aplica el bloqueo y configure los horarios o el tiempo permitido necesarios.
4. Active el grupo. Sus objetivos comparten la política del grupo.

Los cambios habituales se guardan automáticamente. Un error significa que el cambio no se ha aceptado; corrija el campo e inténtelo de nuevo. Desactive un grupo para detener su política y conservar su configuración. **Eliminar grupo** lo elimina. Arrastre los grupos para reordenarlos. Varios grupos pueden aplicarse a un objetivo; posponer uno no levanta el bloqueo de otro.

**Exportar** copia la configuración de un grupo. **Importar** sustituye la configuración del grupo seleccionado tras la confirmación.

### Tiempo permitido y horario

**Bloquear inmediatamente** se aplica siempre que el grupo activado coincida y su horario esté activo. **Bloquear al agotar el tiempo permitido** permite el uso correspondiente hasta que se agota el tiempo disponible.

Configure el tiempo permitido en minutos y el intervalo de restablecimiento en horas. Un límite móvil cuenta el uso dentro de la ventana anterior. Restablecer a medianoche inicia un nuevo período a la medianoche local, también con un límite móvil.

Elija los días activos de la semana y, opcionalmente, intervalos de hora local, uno por línea, como **09:00-12:00**. Una lista de intervalos vacía se aplica durante todo el día en los días seleccionados. Un intervalo debe terminar después de empezar en el mismo día; divida un horario nocturno entre días separados.

### Posponer

Configure la opción de posponer en cada grupo de bloqueo. **Pausar bloqueo** suspende la política de ese grupo durante la duración de la pausa. **Añadir al tiempo permitido** añade minutos utilizables a un grupo con límite de tiempo. Solo el tiempo adicional consumido cuenta como tiempo pospuesto. El tiempo adicional sin usar caduca en el siguiente restablecimiento; con un límite móvil, después de una ventana, o antes a medianoche si esa opción está activada.

**Retraso de activación** retrasa la pausa mientras continúa el bloqueo. **Tiempo de espera** es la espera tras finalizar la pausa antes de otra solicitud. **Confirmaciones requeridas** establece el número de pasos de confirmación. Posponer está disponible en un grupo congelado solo si se permitió antes de congelarlo.

### Congelación y PIN

**Congelar** impide los cambios habituales. Descongelar requiere diez confirmaciones separadas por cinco segundos, además de la espera configurada y el PIN de seis dígitos, si existen. **Espera antes de descongelar** acepta 0–72 horas; 0 no añade espera.

Mientras el grupo está congelado, se puede ampliar la espera y añadir un PIN si no existe ninguno. Estas condiciones no se pueden debilitar hasta descongelar el grupo. La eliminación también respeta la espera restante y el PIN.

### Grupos vinculados

Use **Vincular** para conectar grupos seleccionados explícitamente en otros programas Vault. Los grupos vinculados comparten nombre, ajustes de política compatibles, objetivos, uso y condiciones de congelación. Cada programa edita y aplica los tipos de objetivo que admite; las demás entradas siguen disponibles para los programas vinculados. Al desvincular, cada grupo y sus ajustes se conservan.

Si un miembro vinculado está desconectado, la edición puede no estar disponible. Abra la aplicación Vault de escritorio y el navegador vinculado para reconectarlos. Una política guardada localmente puede seguir aplicándose mientras un miembro está desconectado.

## Obtener ayuda

Pulse la pequeña **i** junto a un campo para ver su explicación. Pulse fuera o presione Escape para cerrarla. Las listas permanecen en cuadros desplazables; desplácese dentro del cuadro para acceder a más entradas. La búsqueda filtra la lista visible sin eliminar entradas.

Las reglas personalizadas tienen su propio [Manual de código](../code-manual/es.md). Explica el editor, la activación, los registros, el acceso a archivos y la API compatible.

## Sitios web y contenido de plataformas

Añada dominios o URLs completas, uno por entrada. Un dominio incluye sus subdominios. Una ruta limita la coincidencia a esa ruta y sus descendientes. **Bloquear todo excepto estos sitios** convierte la lista en una lista de permitidos.

Puede añadir el mismo sitio web varias veces. Cada entrada tiene su propio filtro y controles de página; por ejemplo, una entrada de YouTube puede bloquear Shorts y otra a un creador. Las entradas coincidentes se combinan dentro del grupo y comparten horario, tiempo permitido y opción de posponer.

Un objetivo puede cubrir una página coincidente o pausarla primero y ofrecer Continuar tras una cuenta atrás. Un objetivo de bloqueo tiene prioridad sobre uno de pausa en el mismo grupo. **Al bloquear: dirección de redirección o mensaje** acepta una dirección web o un mensaje para la cubierta; déjelo vacío para cubrir la página en su lugar. Una pausa nunca redirige.

Los objetivos de plataformas usan **Creadores** para plataformas de vídeo, **Cuentas** para Twitter / X, **Comunidades** para Reddit e IDs de servidor/canal para Discord. Los controles se aplican donde Vault puede identificar la fuente y el tipo de contenido. Los controles de contenido ocultan elementos compatibles de la página, como anuncios o tarjetas de vídeo. Los permisos del navegador y los cambios del sitio web pueden afectar a estos controles.

### Filtros de etiquetas de contenido

La conexión con el Clasificador y la corrección de etiquetas están disponibles en navegadores Chromium compatibles, como Chrome y Edge, y en Safari Vault en macOS.

Conecte Mac Vault o Windows Vault y configure su Clasificador para obtener etiquetas. El filtro de etiquetas de un grupo de bloqueo elige qué cubrir u ocultar. No inicia ni pausa el etiquetado; use los ajustes del Clasificador de la aplicación de escritorio o el control de pausa del grupo del Clasificador correspondiente.

Cada entrada de sitio web tiene un filtro **Aplicar a**: todo el contenido, creadores seleccionados, todos excepto los creadores seleccionados, etiquetas seleccionadas o todo excepto las etiquetas seleccionadas. Añada otra entrada del mismo sitio cuando necesite un filtro diferente.

Elija ciertas etiquetas o todo excepto ciertas etiquetas. Una regla puede combinar etiquetas (**Gaming + Drama**), exigir confianza (**Gaming @3**) o crear una excepción (**!Tutorial**). **Cubrir contenido** mantiene disponible la corrección de etiquetas. **Ocultar contenido** elimina el elemento coincidente.

**Bloquear también contenido sin etiquetas con suficiente confianza** incluye resultados completos sin etiqueta en el umbral de confianza predeterminado, incluidos los resultados con baja confianza. Primero se comprueban las reglas enumeradas explícitamente. **Sin etiqueta** significa que el etiquetado terminó sin etiquetas; **Etiquetando** significa que hay un resultado pendiente. La opción independiente de contenido pendiente controla la cubierta hasta que termina el etiquetado.

### Corregir etiquetas

Pulse **+ etiqueta** junto a las etiquetas de un elemento para abrir el selector de corrección. Busque entre las etiquetas existentes del Clasificador y elija una para añadirla. Pulse el control de eliminación de una etiqueta seleccionada, o selecciónela y presione Supr una vez, para eliminarla. Las correcciones se envían a la aplicación de escritorio conectada y se usan en futuros etiquetados. Una consulta no disponible muestra **Sin etiqueta** y se puede reintentar automáticamente; esta indicación no crea una etiqueta en el Clasificador.

## Ajustes y conexión

**Mostrar el + de adición rápida** añade un pequeño botón a las páginas compatibles. Seleccione un grupo en la lista como destino; su elección se recuerda al reabrir Vault. Use el botón de la página para añadirla a su lista de sitios web. En una lista de permitidos, esto permite la página. Los grupos congelados no aceptan adiciones rápidas.

La conexión con el Clasificador informa sobre el servicio Vault local de escritorio. Configure los grupos del Clasificador, las descargas de modelos, Conocimiento, el consentimiento de investigación y los proveedores de API en la aplicación de escritorio conectada.

Si faltan etiquetas, compruebe que la aplicación Vault de escritorio esté abierta, la conexión establecida, el etiquetado activado, el grupo del Clasificador correspondiente reanudado y su fuente de plataforma registrada. Compruebe el estado de la descarga del modelo en la aplicación de escritorio. Si no se aplica el bloqueo, compruebe la activación, los objetivos, el horario, el tiempo permitido y el estado de posposición del grupo.
