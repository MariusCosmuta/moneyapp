import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const SQL_DIR = new URL("../../supabase/", import.meta.url);
const FISIERE = ["01_schema.sql", "02_logica.sql", "03_audit.sql", "04_securitate.sql"];
export const MEMBRU = "marius@test.ro";
export const STRAIN = "strain@test.ro";

// Emulează ce oferă Supabase: rolurile anon/authenticated, auth.jwt(), auth.uid(), privilegiile implicite.
const SUPABASE_STUB = `
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant execute on all functions in schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

export async function bazaNoua() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of FISIERE) await db.exec(readFileSync(new URL(f, SQL_DIR), "utf8"));
  await db.exec(`insert into public.membri (email) values ('${MEMBRU}')`);
  return db;
}

function uuid(email) {
  return email === MEMBRU ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002";
}

// Rulează o interogare ca un anumit utilizator (null = anonim).
export async function ca(db, email, sql, params = []) {
  return db.transaction(async (tx) => {
    if (email === null) {
      await tx.exec("set local role anon");
    } else {
      await tx.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: uuid(email), email })]);
      await tx.exec("set local role authenticated");
    }
    return (await tx.query(sql, params)).rows;
  });
}
