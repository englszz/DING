# Revisión de seguridad y publicación de DING

Revisión del código, esquema versionado, dependencias y HTML público de https://ding-pearl.vercel.app. No se ha ejecutado una prueba de intrusión contra producción ni se dispone de acceso administrativo al proyecto de Supabase/Vercel. Las políticas activas, usuarios administradores, copias de seguridad y reglas del firewall requieren verificación en sus paneles.

## Hallazgos corregidos en el código local

- **Crítico: permisos del perfil.** El esquema otorgaba edición del propio perfil sin excluir `is_admin`. La nueva migración limita las columnas editables y añade un trigger que impide cambiar privilegios o identidad desde una sesión de usuario. Revisar en Supabase qué usuarios tienen actualmente `is_admin=true`; esta revisión no prueba que nadie haya aprovechado el permiso.
- **Alto: privacidad incompleta.** Las políticas `USING(true)` de notas, historial, perfiles y comentarios permitían consultar datos privados por la API directamente. Se añaden políticas restrictivas que también limitan las antiguas políticas `FOR ALL`, y pruebas de lectura anónima, propietario y otro usuario. Los perfiles públicos y sus reseñas siguen siendo públicos por diseño.
- **Alto: escritura del catálogo.** Las RPC de importación aceptaban metadatos enviados por cualquier cuenta autenticada. Se revoca su acceso desde clientes y se añade una entrada exclusiva del servidor. El servidor verifica al usuario y obtiene los metadatos del proveedor; el navegador no recibe credenciales privilegiadas. Se mantiene la lectura pública del catálogo.
- **Dependencias.** `npm audit` detectó avisos críticos en Next.js 16.3.2 (GHSA-p293-qw3h-jr36 y GHSA-2xp9-vwfh-vxw4). Actualizado Next y eslint-config-next a 16.3.5; la instalación completa reportó cero vulnerabilidades conocidas. Eso no equivale a ausencia absoluta de vulnerabilidades.
- **Abuso.** Límites compartidos en PostgreSQL: 60 búsquedas por minuto y cuenta, 40 operaciones de importación/portadas por minuto y cuenta, 120 escrituras de contenido por minuto y cuenta. Los cuerpos JSON de las rutas editadas se limitan a 8 KB incluso sin Content-Length. Se limitan también textos en la base de datos.
- **Entradas y archivos.** Literales de búsqueda escapados para PostgREST; enlaces de perfil limitados a HTTP/HTTPS tanto al guardar como al mostrar; avatar restringido a PNG/JPEG/WebP, 2 MB, decodificado y convertido en el servidor, con límite de píxeles y restricciones adicionales en Storage.
- **Navegador.** Se añaden cabeceras contra inclusión en marcos, interpretación incorrecta de tipos, uso de cámara/micrófono/geolocalización y carga de objetos. La CSP aplicada es parcial, no una CSP estricta de scripts; implementar nonces requiere validar el inicio de sesión y la hidratación completa antes de activarlos.

## Activación pendiente en tu infraestructura

1. Guarda una copia de seguridad antes de aplicar cambios de permisos.
2. En Supabase SQL Editor ejecuta completo `supabase/migrations/20260918_privacy_and_permissions.sql`. Es transaccional y repetible; no borra reseñas. La búsqueda de la nueva web utiliza la función `ding_allow_search` incluida aquí.
3. Configura `SUPABASE_SERVICE_ROLE_KEY` como variable privada del servidor, tanto en `.env.local` como en Vercel. Obténla en el panel de tu proyecto de Supabase. No uses `NEXT_PUBLIC_`, no la subas a GitHub ni la pegues en el chat. Esta credencial solo se usa en `lib/supabase/catalog-admin.ts`, protegido con `server-only`, para la RPC de catálogo.
4. Con el código correspondiente y esa variable preparados, ejecuta completo `supabase/migrations/20260918_server_catalog.sql`. Las versiones antiguas de la web dejarán de poder importar álbumes nuevos después de este paso: coordinarlo con el despliegue del nuevo código. No impide leer los álbumes ya importados.
5. Publica el nuevo código cuando apruebes la revisión. Ninguno de estos cambios ha sido desplegado por esta tarea. Mientras producción siga con el código anterior, el top 3 puede seguir siendo solo del navegador.
6. Comprueba Security Advisor de Supabase, administradores existentes, RLS y permisos activos; no vuelvas a ejecutar el `schema.sql` antiguo después de las migraciones porque contiene permisos anteriores.
7. Activa MFA para las cuentas administrativas de Supabase, GitHub y Vercel; configura protección contra abuso de registro/login y reglas de firewall de Vercel para `/api/*` y `/_next/image`, con límites acordes al tráfico real. Las rutas públicas de imágenes aún pueden consumir recursos; los límites por usuario no detienen ataques distribuidos o múltiples cuentas.
8. Verifica OAuth Redirect URLs exactas (dominio público y localhost de desarrollo), límites de gasto, alertas y restauración de copias de seguridad. Mantén acceso público a `/opengraph-image` para los rastreadores de redes sociales.

Los avatares están en un bucket público: tener un perfil privado no vuelve secreta la URL de una imagen ya publicada. No subir documentos ni información confidencial como avatar. Pasar el bucket a privado requeriría cambiar el producto y sus URLs, y no se ha hecho aquí.

## Twitter y top 3

La respuesta real a Twitterbot carecía de `og:image` y `twitter:image`; llevaba una tarjeta `summary`. Se añade una imagen PNG 1200×630 y `summary_large_image` con dominio absoluto. Se verifica la imagen local; comprobar de nuevo el HTML público después del despliegue. Las plataformas pueden conservar vistas previas anteriores en caché.

La captura de la migración anterior muestra 19 originales, 19 destinos y 19 textos idénticos: copia correcta. Esa migración también crea `album_top_three`; no necesitas otra tabla para el top. La versión local guarda en Supabase y recupera la selección previa del navegador. Se corrige una carrera de revalidación que podía dejar la selección cargando, se desactivan selectores durante el guardado y se conserva un borrador local ante fallos. Las ediciones distintas de un álbum mantienen selecciones distintas.

## Fuentes y validación

- Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase: https://supabase.com/docs/guides/database/functions
- Next.js: documentación de la versión instalada, metadata, Open Graph y cabeceras.
- npm: auditoría actual del árbol de dependencias instalado.

Pruebas automatizadas con PostgreSQL embebido (PGlite): migración repetible sin pérdida de textos, privacidad, rechazo de elevación de privilegios, bloqueo de RPC a clientes, importación por servidor y límite de escrituras. Pruebas de interfaz: persistencia y revalidación del top 3, opiniones visibles y recuperación ante fallos. Compilación de producción verificada. La verificación de usuarios reales en producción queda pendiente del despliegue y de las migraciones.

## Seguimiento del informe exportado de Security Advisor

El CSV entregado contiene siete avisos WARN. Se añade `20260918_advisor_permissions.sql` para retirar el listado general de avatares, la ejecución directa de la función de trigger `ding_remove_rated_saved` para anon/authenticated y la concesión explícita a anon de `ding_save_album`. Revocar PUBLIC no basta si hay un GRANT directo a anon; este caso se reproduce en las pruebas. Las imágenes públicas por URL y la actualización del avatar por su propietario se conservan.

Se mantienen intencionadamente `ding_save_album` y `ding_allow_search` para authenticated. Ambas usan auth.uid(), tienen search_path fijo y operan sobre el usuario actual; la primera guarda su lista privada y la segunda contabiliza su límite de búsquedas. Su aviso SECURITY DEFINER exige revisión, pero no demuestra por sí solo acceso indebido. No cambiar a SECURITY INVOKER ni revocar estos permisos sin rediseñar el flujo.

El aviso de protección de contraseñas filtradas requiere configuración de Supabase Auth y está disponible en Pro o superior según https://supabase.com/docs/guides/auth/password-security. No es un fallo que arregle esta migración SQL. La protección se refiere a contraseñas gestionadas por Supabase, no a la contraseña de la cuenta de Google utilizada mediante OAuth.

Tras ejecutar el archivo completo en SQL Editor, la verificación debe devolver false, true, false, false. Volver a ejecutar Security Advisor: deberían desaparecer los cuatro avisos de permisos mencionados si no existen otras concesiones o políticas adicionales. Las pruebas locales no sustituyen esa comprobación en el proyecto real.
