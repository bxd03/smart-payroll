import { getDatabase } from "@netlify/database";
export const pool = () => getDatabase({ connectionString: process.env.NETLIFY_DB_URL }).pool;
function compile(sql: string) {
  let i = 0;
  const ignore = /INSERT OR IGNORE/i.test(sql);
  let result = sql
    .replace(/INSERT OR IGNORE/i, "INSERT")
    .replace(/\?/g, () => "$" + ++i)
    .replace(/AS createdAt/g, 'AS "createdAt"')
    .replace(/COUNT\(\*\) AS count/g, "COUNT(*)::int AS count");
  if (ignore) result += " ON CONFLICT DO NOTHING";
  return result;
}
class Statement {
  values: any[] = [];
  constructor(public query: string) {}
  bind(...values: any[]) {
    this.values = values;
    return this;
  }
  async first(): Promise<any> {
    return (
      (await pool().query(compile(this.query), this.values)).rows[0] || null
    );
  }
  async all(): Promise<{ results: any[] }> {
    return {
      results: (await pool().query(compile(this.query), this.values)).rows,
    };
  }
  async run() {
    const r = await pool().query(compile(this.query), this.values);
    return { meta: { changes: r.rowCount || 0 } };
  }
}
export const env = {
  get SMARTPAYROLL_OWNER_EMAIL() {
    return process.env.SMARTPAYROLL_OWNER_EMAIL;
  },
  DB: {
    prepare(query: string) {
      return new Statement(query);
    },
    async batch(statements: Statement[]) {
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        let changed = 0;
        const results = [];
        for (const s of statements) {
          if (s.query.includes("changes()=1") && !changed) {
            results.push({ meta: { changes: 0 } });
            continue;
          }
          const query = s.query.replace(" WHERE changes()=1", "");
          const r = await client.query(compile(query), s.values);
          changed = r.rowCount || 0;
          results.push({ meta: { changes: changed } });
        }
        await client.query("COMMIT");
        return results;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  },
  BUCKET: {
    async put(id: string, body: ArrayBuffer, _options?: unknown) {
      await pool().query("INSERT INTO sp_file_blobs(id,body) VALUES($1,$2)", [
        id,
        Buffer.from(body),
      ]);
    },
    async get(id: string) {
      const r = await pool().query(
        "SELECT body FROM sp_file_blobs WHERE id=$1",
        [id],
      );
      return r.rows[0] ? { body: new Uint8Array(r.rows[0].body) } : null;
    },
  },
};
