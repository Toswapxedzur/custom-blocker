# Extensión de bóveda

La extensión Vault es una herramienta de enfoque de Manifest V3 para navegadores Chromium. Su editor actual administra grupos de bloqueo de sitios web, grupos de plataformas compatibles, grupos de JavaScript personalizados, horarios, controles de congelación y repetición, y enlaces puente de aplicaciones web opcionales.

El código fuente es el contrato del producto. El manual en inglés de la aplicación en [manual/en.md](manual/en.md) explica los controles enviados; reemplaza los manuales anteriores copiados y traducidos automáticamente.

## Capacidades actuales

- Grupos de sitios web predeterminados con comportamiento de lista bloqueada o lista permitida, redireccionamiento opcional, bloqueo inmediato, asignación de tiempo o cuenta regresiva.
- Grupos dedicados para YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord y Twitter/X.
- Filtros específicos de la plataforma y controles opcionales de elementos ocultos cuando el perfil de plataforma actual los admita.
- Grupos de JavaScript personalizados con verificación de sintaxis, plantillas, controles de ejecución, tiempo de ejecución controlado y alimentación de registros.
- Horarios por grupo, modos de congelación, controles de repetición, importación/exportación y guardado automático.
- Acceso opcional a carpetas locales para operaciones admitidas de texto de reglas personalizadas, CSV y JSON.
- Conexión opcional a un centro de puente nativo de Vault para grupos vinculados explícitamente.

## Ejecutar localmente

1. Abra `chrome://extensions` en un navegador Chromium.
2. Habilite el **modo de desarrollador**.
3. Seleccione **Cargar descomprimido** y elija esta carpeta del repositorio.
4. Abra la extensión Vault y cree un grupo.

El manifiesto requiere Chrome 116 o posterior para sus API de reglas y fuera de pantalla actuales.

## Controles de desarrollo

Ejecute el conjunto de pruebas de extensión desde esta carpeta:

```bash
./tests/run.sh
```

La suite ejercita el comportamiento del asistente, los perfiles de la plataforma, la representación de Markdown y la auditoría del catálogo de traducción.

## Manuales localizados y traducciones

Los documentos ingleses siguen siendo la fuente canónica. La extensión envía sus manuales localizados junto a `manual/en.md`, y las copias localizadas de otros documentos mantenidos se encuentran en `i18n-docs/<locale>/`.

Los catálogos de UI en `translation/*.json` están completos para cada configuración regional compatible. Verificar los catálogos y documentos localizados con:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Alcance

La extensión Vault solo actúa en el perfil del navegador donde está instalada y en las páginas a las que el navegador le otorga acceso. No instala aplicaciones nativas, no cambia los permisos del sistema ni sincroniza grupos a menos que el usuario conecte explícitamente un puente y vincule grupos coincidentes.
