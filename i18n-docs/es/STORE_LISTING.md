# Fuente de listado de Chrome Web Store

Esta es la fuente en inglés de la extensión Manifest V3 actual. Verifíquelo con `manifest.json` antes de publicar una nueva compilación de tienda.

## Nombre de la extensión

```text
Adamancia Vault
```

## Breve descripción

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Descripción detallada

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Explicaciones de permisos

| Permiso | Propósito actual |
| --- | --- |
| `storage` | Guarde grupos, configuraciones y el estado del editor local. |
| `alarms` | Programe verificaciones de antecedentes y actualizaciones grupales basadas en el tiempo. |
| `offscreen` | Ejecute el tiempo de ejecución controlado de reglas personalizadas donde Chromium requiere un documento fuera de pantalla. |
| `tabs` | Lea el contexto de la pestaña activa necesario para aplicar un grupo y mostrar el estado. |
| `webNavigation` | Vuelva a evaluar los grupos aplicables después de la navegación. |
| `favicon` | Muestre los íconos del sitio web en el editor cuando estén disponibles. |
| `<all_urls>` | Aplique reglas de plataforma y sitio web creadas por el usuario a las páginas que el usuario elija controlar. |

## Liberar controles

1. Ejecute `./tests/run.sh`.
2. Actualice la versión del manifiesto solo para la confirmación de lanzamiento.
3. Revisar el manual en inglés y el resultado de la auditoría de traducción.
4. Cree el artefacto de carga a partir de la confirmación revisada.
5. No incluya notas fuente, accesorios de prueba ni archivos de desarrollo privados en el artefacto de carga.
