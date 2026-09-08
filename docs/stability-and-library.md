# Biblioteca y estabilidad (septiembre de 2026)

## Base de datos

Migración: `supabase/migrations/20260908_library_and_stability.sql`. Ejecutar completa en SQL Editor. Es repetible y conserva el catálogo, las canciones y las reseñas existentes.

- Guardados privados protegidos con RLS y escritura mediante `ding_save_album`.
- Una puntuación de álbum retira el guardado mediante un trigger, aunque no tenga reseña escrita.
- Los comentarios por canción siguen la privacidad del perfil y solo su autor puede editarlos o borrarlos.
- Importaciones con reserva temporal compartida en Supabase y transacción atómica. Las ediciones anteriores y sus identificadores se reutilizan.

## Rendimiento

La cola de MusicBrainz separa los inicios 1,1 segundos y admite dos peticiones activas y hasta ocho pendientes por proceso. No mantiene ocupada la cola durante toda una respuesta o sus reintentos. Se agrupan peticiones idénticas, se almacenan resultados una hora y se cancelan las búsquedas que todavía no han empezado cuando el usuario cambia la consulta.

El primer intento tiene un límite de 12 segundos y el segundo de 8. La espera en cola está limitada a 7 segundos. La importación tiene un presupuesto de consultas musicales de 45 segundos. Una búsqueda nueva sigue dependiendo de la latencia/disponibilidad de MusicBrainz; esto no garantiza respuestas instantáneas. Con varias instancias en una misma IP debe evaluarse un limitador distribuido.

Los guardados usan solo metadatos: no importan canciones. Las fotos de artistas cargan al aparecer en pantalla, después de los resultados.

## Diagnóstico

En los registros de Vercel buscar `music_search`, `album_import`, `musicbrainz_request_failed` y `album_import_failed`. Los dos primeros incluyen duración; las respuestas de búsqueda también incluyen `Server-Timing`. Correlacionar la hora exacta del incidente con estos eventos y con los registros de Supabase. No se pudo confirmar la causa histórica de la interrupción de seis o siete minutos.

En la prueba local del 8 de septiembre hubo un timeout de MusicBrainz y el siguiente intento encontró UTOPIA. Las consultas de comprobación de las cuatro tablas devolvieron HTTP 200. No interpretar una prueba local como un ensayo de carga de producción.

## Verificación

`npm test` incluye pruebas PostgreSQL locales con PGlite: repetición de la migración, privacidad entre dos usuarios, eliminación del guardado al calificar, importación atómica y protección de comentarios. También comprueba puntuación 10, errores de guardado, caché, deduplicación, cancelación y aislamiento de peticiones lentas.

Antes de publicar: revisión del usuario en localhost y comprobación de las variables públicas de Supabase en Vercel. La descarga de variables de Vercel devolvió valores vacíos durante esta sesión; la configuración local fue restablecida con la URL y clave pública facilitadas por el propietario. No se modificó la configuración de producción.

## Respaldo iTunes

Segunda migración: `supabase/migrations/20260908_itunes_fallback.sql` (ejecutar después de la primera). Los identificadores externos se guardan como texto y con proveedor explícito; nunca se inventan MBIDs para datos de iTunes. Las referencias originales y todas las calificaciones permanecen intactas. Solo se reutiliza automáticamente una coincidencia única de título, artista, año, canciones ordenadas y duración compatible.

Las búsquedas concretas ya presentes se resuelven desde Supabase. Para el resto, MusicBrainz dispone de 2,5 segundos antes de consultar iTunes. El circuito evita insistir durante un minuto en un proveedor que no responde; una respuesta posterior correcta restablece el servicio principal. El respaldo tiene caché de una hora y un límite conservador de 18 consultas/minuto por proceso. Con varias instancias, evaluar límites compartidos; ambos proveedores tienen capacidad finita.

iTunes aporta datos, canciones y portadas del CDN de Apple, acompañadas del distintivo oficial enlazado al álbum. La tercera migración, `20260908_itunes_artwork.sql`, completa las imágenes ausentes sin sobrescribir las existentes ni tocar calificaciones o canciones. La biblioteca recupera imágenes de guardados antiguos en segundo plano mediante consultas agrupadas. No se incorporan previews de audio. Los filtros del respaldo se aproximan con las etiquetas de los títulos (EP, Single, Live, etc.); no hay equivalencia completa con las clasificaciones de MusicBrainz. La discografía de respaldo está limitada a 200 resultados.

La prueba con una caída simulada del principal y consultas reales a iTunes recuperó UTOPIA y sus 19 canciones en 898 ms. Es una medición puntual, no una garantía de tiempo de respuesta. Las pruebas de base de datos comprueban la migración repetida, el cruce entre ambos proveedores y la separación de tracklists distintos.
