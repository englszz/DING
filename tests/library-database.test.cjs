/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const userA = "00000000-0000-4000-8000-000000000001",
  userB = "00000000-0000-4000-8000-000000000002";
const release = "00000000-0000-4000-8000-000000000003",
  group = "00000000-0000-4000-8000-000000000004";
test("migration runs twice; private saves, rating transition, atomic imports and comment visibility", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon;`,
    );
    const base = fs
      .readFileSync("supabase/schema.sql", "utf8")
      .split("-- AUTOMATIC PROFILE CREATION TRIGGER")[0]
      .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', "")
      .replaceAll("uuid_generate_v4()", "gen_random_uuid()");
    await db.exec(base);
    const migration = fs.readFileSync(
      "supabase/migrations/20260908_library_and_stability.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const fallbackMigration = fs.readFileSync(
      "supabase/migrations/20260908_itunes_fallback.sql",
      "utf8",
    );
    await db.exec(fallbackMigration);
    await db.exec(fallbackMigration);
    const artworkMigration=fs.readFileSync("supabase/migrations/20260908_itunes_artwork.sql","utf8");
    await db.exec(artworkMigration);await db.exec(artworkMigration);
    await db.exec(
      `INSERT INTO auth.users VALUES ('${userA}'),('${userB}');INSERT INTO profiles(id,username) VALUES ('${userA}','alice'),('${userB}','bob'); GRANT SELECT ON profiles TO anon,authenticated; GRANT INSERT,SELECT ON album_ratings TO authenticated;`,
    );
    async function asUser(id) {
      await db.exec(
        `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
      );
    }
    await asUser(userA);
    const args = [group, "release-group", "Test album", "Artist"];
    assert.equal(
      (await db.query("SELECT ding_save_album($1,$2,$3,$4) AS saved", args))
        .rows[0].saved,
      true,
    );
    assert.equal((await db.query("SELECT * FROM saved_albums")).rows.length, 1);
    await asUser(userB);
    assert.equal((await db.query("SELECT * FROM saved_albums")).rows.length, 0);
    await db.exec("DELETE FROM saved_albums");
    await asUser(userA);
    assert.equal((await db.query("SELECT * FROM saved_albums")).rows.length, 1);
    const key = "release-group:" + group;
    const token = (
      await db.query("SELECT ding_claim_import($1) AS token", [key])
    ).rows[0].token;
    await asUser(userB);
    assert.equal(
      (await db.query("SELECT ding_claim_import($1) AS token", [key])).rows[0]
        .token,
      null,
    );
    await assert.rejects(
      db.query("SELECT ding_finish_import($1,$2,$3,$4,$5)", [
        key,
        token,
        release,
        group,
        null,
      ]),
      /lease expired/,
    );
    await asUser(userA);
    const details = {
      title: "Test album",
      artist: "Artist",
      year: "2026",
      tracks: [{ title: "Song", position: 1, durationMs: 120000 }],
    };
    const album = (
      await db.query("SELECT ding_finish_import($1,$2,$3,$4,$5) AS id", [
        key,
        token,
        release,
        group,
        JSON.stringify(details),
      ])
    ).rows[0].id;
    await db.query(
      "INSERT INTO album_ratings(user_id,album_id,rating) VALUES ($1,$2,10)",
      [userA, album],
    );
    assert.equal((await db.query("SELECT * FROM saved_albums")).rows.length, 0);
    assert.equal(
      (await db.query("SELECT ding_save_album($1,$2,$3,$4) AS saved", args))
        .rows[0].saved,
      false,
    );
    await db.exec("RESET ROLE");
    const track = (await db.query("SELECT id FROM tracks")).rows[0].id;
    await asUser(userA);
    await db.query(
      "INSERT INTO track_comments(user_id,track_id,content) VALUES($1,$2,$3)",
      [userA, track, "Great song"],
    );
    await asUser(userB);
    assert.equal(
      (await db.query("SELECT * FROM track_comments")).rows.length,
      1,
    );
    await db.exec("UPDATE track_comments SET content='Tampered'");
    assert.equal(
      (await db.query("SELECT content FROM track_comments")).rows[0].content,
      "Great song",
    );
    await db.exec(
      `RESET ROLE; UPDATE profiles SET privacy='private' WHERE id='${userA}';`,
    );
    await asUser(userB);
    assert.equal(
      (await db.query("SELECT * FROM track_comments")).rows.length,
      0,
    );
    await asUser(userA);
    assert.equal(
      (await db.query("SELECT * FROM track_comments")).rows.length,
      1,
    );
    const reused = (
      await db.query("SELECT ding_import_itunes($1,$2) AS id", [
        "1708274558",
        JSON.stringify(details),
      ])
    ).rows[0].id;
    assert.equal(
      reused,
      album,
      "Matching edition preserves the album id and ratings",
    );
    assert.equal(
      (
        await db.query("SELECT ding_save_album($1,$2,$3,$4) AS saved", [
          "1708274558",
          "itunes",
          "Test album",
          "Artist",
        ])
      ).rows[0].saved,
      false,
    );
    const alternate = {
      ...details,
      tracks: [{ title: "Different song", position: 1, durationMs: 110000 }],
    };
    const alternateId = (
      await db.query("SELECT ding_import_itunes($1,$2) AS id", [
        "12345",
        JSON.stringify(alternate),
      ])
    ).rows[0].id;
    assert.notEqual(
      alternateId,
      album,
      "Different tracklists must never be merged",
    );
    await db.query("SELECT ding_save_album($1,$2,$3,$4)", [
      "12345",
      "itunes",
      "Test album",
      "Artist",
    ]);
    await db.query(
      "INSERT INTO album_ratings(user_id,album_id,rating) VALUES($1,$2,9)",
      [userA, alternateId],
    );
    assert.equal((await db.query("SELECT * FROM saved_albums")).rows.length, 0);
    const artwork='https://is1-ssl.mzstatic.com/image/thumb/Music/test/600x600bb.jpg';
    await db.query('SELECT ding_set_itunes_artwork($1,$2)',['12345',artwork]);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT cover_url FROM albums WHERE id=$1',[alternateId])).rows[0].cover_url,artwork);
    const trackIds=(await db.query('SELECT id FROM tracks WHERE album_id=$1',[alternateId])).rows.map(t=>t.id);
    await asUser(userA);
    await db.query('SELECT ding_set_itunes_artwork($1,$2)',['12345','https://is1-ssl.mzstatic.com/image/different.jpg']);
    await assert.rejects(db.query('SELECT ding_set_itunes_artwork($1,$2)',['12345','https://untrusted.example/cover.jpg']),/Invalid artwork/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT cover_url FROM albums WHERE id=$1',[alternateId])).rows[0].cover_url,artwork);
    assert.deepEqual((await db.query('SELECT id FROM tracks WHERE album_id=$1',[alternateId])).rows.map(t=>t.id),trackIds);
    assert.equal((await db.query('SELECT rating FROM album_ratings WHERE user_id=$1 AND album_id=$2',[userA,alternateId])).rows[0].rating,'9.0');
    await asUser(userA);
    // The reverse direction (iTunes first, MusicBrainz later) also preserves identity.
    const futureRelease = "00000000-0000-4000-8000-000000000009";
    const futureKey = "release:" + futureRelease;
    const futureToken = (
      await db.query("SELECT ding_claim_import($1) AS token", [futureKey])
    ).rows[0].token;
    assert.equal(
      (
        await db.query("SELECT ding_finish_import($1,$2,$3,$4,$5) AS id", [
          futureKey,
          futureToken,
          futureRelease,
          null,
          JSON.stringify(alternate),
        ])
      ).rows[0].id,
      alternateId,
    );
    // An invalid track must roll back the entire catalog import, not leave a partial album.
    const release2 = "00000000-0000-4000-8000-000000000005",
      key2 = "release:" + release2;
    const token2 = (
      await db.query("SELECT ding_claim_import($1) AS token", [key2])
    ).rows[0].token;
    await assert.rejects(
      db.query("SELECT ding_finish_import($1,$2,$3,$4,$5)", [
        key2,
        token2,
        release2,
        null,
        JSON.stringify({
          ...details,
          tracks: [{ title: "Invalid", position: "bad" }],
        }),
      ]),
      /integer/,
    );
    await db.exec("RESET ROLE");
    assert.equal(
      (await db.query("SELECT id FROM albums WHERE external_id=$1", [release2]))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
