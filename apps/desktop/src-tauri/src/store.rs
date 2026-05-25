use std::path::Path;

use anyhow::{anyhow, Context};
use rusqlite::{params, Connection};

pub struct Store {
    conn: Connection,
}

#[derive(Debug, Clone)]
pub struct SectionRow {
    pub id: i64,
    pub document_id: String,
    pub content: String,
    pub kind: String,
    pub page_start: Option<i64>,
    pub page_end: Option<i64>,
    pub updated_at: String,
    pub sim_vector: Vec<f32>,
}

impl Store {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let conn = Connection::open(path).with_context(|| format!("open {}", path.display()))?;

        unsafe {
            sqlite_vec::sqlite3_vec_init();
        }

        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sections (
                id           INTEGER PRIMARY KEY,
                document_id  TEXT NOT NULL,
                content      TEXT NOT NULL,
                kind         TEXT NOT NULL,
                page_start   INTEGER,
                page_end     INTEGER,
                updated_at   TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sections_doc ON sections(document_id);
            CREATE INDEX IF NOT EXISTS idx_sections_updated ON sections(updated_at);

            CREATE VIRTUAL TABLE IF NOT EXISTS sections_vec USING vec0(
                embedding float[384]
            );

            CREATE TABLE IF NOT EXISTS meta (
                k TEXT PRIMARY KEY,
                v TEXT NOT NULL
            );
            "#,
        )?;

        Ok(Self { conn })
    }

    pub fn count(&self) -> anyhow::Result<i64> {
        let n: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM sections", [], |r| r.get(0))?;
        Ok(n)
    }

    pub fn upsert_batch(&mut self, rows: &[SectionRow]) -> anyhow::Result<()> {
        let tx = self.conn.transaction()?;
        {
            let mut stmt_sec = tx.prepare(
                r#"INSERT INTO sections (id, document_id, content, kind, page_start, page_end, updated_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                   ON CONFLICT(id) DO UPDATE SET
                     document_id=excluded.document_id,
                     content=excluded.content,
                     kind=excluded.kind,
                     page_start=excluded.page_start,
                     page_end=excluded.page_end,
                     updated_at=excluded.updated_at"#,
            )?;

            let mut stmt_del_vec = tx.prepare("DELETE FROM sections_vec WHERE rowid = ?1")?;
            let mut stmt_ins_vec = tx.prepare(
                "INSERT INTO sections_vec(rowid, embedding) VALUES (?1, ?2)",
            )?;

            for r in rows {
                stmt_sec.execute(params![
                    r.id,
                    r.document_id,
                    r.content,
                    r.kind,
                    r.page_start,
                    r.page_end,
                    r.updated_at,
                ])?;

                if r.sim_vector.len() != 384 {
                    return Err(anyhow!(
                        "section {} sim_vector dim {} != 384",
                        r.id,
                        r.sim_vector.len()
                    ));
                }

                let bytes: Vec<u8> = r
                    .sim_vector
                    .iter()
                    .flat_map(|f| f.to_le_bytes())
                    .collect();

                stmt_del_vec.execute(params![r.id])?;
                stmt_ins_vec.execute(params![r.id, bytes])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn set_meta(&self, k: &str, v: &str) -> anyhow::Result<()> {
        self.conn.execute(
            "INSERT INTO meta(k, v) VALUES(?1, ?2) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
            params![k, v],
        )?;
        Ok(())
    }

    pub fn get_meta(&self, k: &str) -> anyhow::Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT v FROM meta WHERE k = ?1")?;
        let mut rows = stmt.query(params![k])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }
}
