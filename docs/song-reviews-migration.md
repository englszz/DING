# Activar opiniones de canciones y top 3 por cuenta

En Supabase, abre el proyecto de DING → SQL Editor → New query. Copia y ejecuta el archivo completo `supabase/migrations/20260917_song_reviews_and_top_three.sql`.

La actualización copia los comentarios de canciones a opiniones personales, conservando texto, autor, canción y fechas. Los originales permanecen en `track_comments` y `track_reviews`. Si ambas tablas contienen un texto para la misma persona y canción, tiene prioridad `track_comments`; el otro texto sigue conservado en su tabla original. No combina ediciones distintas de un álbum.

La última consulta muestra `original_comments`, `comments_with_review` e `identical_texts`. En una primera ejecución sin reseñas nuevas previas deben coincidir. Al repetirla, una opinión que haya sido editada o quitada no se sobrescribe con el texto antiguo, por lo que `identical_texts` puede ser menor. Si aparece un error, no continúes con consultas parciales: comparte el mensaje para revisarlo.

Después, recarga el álbum de BULLY desde tu perfil: los textos aparecerán bajo las canciones. Comprueba también el perfil con otra cuenta pública. Los textos nuevos se guardan en `song_reviews`; la conversación se guarda aparte en `song_review_comments`.

El top 3 previo está guardado en el navegador donde se eligió. Al abrir ese álbum desde tu propia cuenta en ese mismo navegador, se importa automáticamente a tu cuenta si aún no hay una selección en Supabase. Nunca sustituye un top 3 ya guardado en la cuenta. La copia del navegador se conserva.

Sin aplicar la actualización, la aplicación puede mostrar los comentarios anteriores como opiniones, pero mantiene desactivada su edición y la sincronización del top 3. No es necesario compartir contraseñas ni claves administrativas.
