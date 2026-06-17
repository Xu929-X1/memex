pub mod models;
pub mod queries;
pub mod schema;

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use std::path::Path;
use std::sync::Mutex;

// Bakes the migrations/ dir into the binary so prod runs them without the CLI.
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

// SqliteConnection is !Sync; one Mutex-guarded connection is enough for a
// single-user desktop app. Swap for an r2d2 Pool if concurrency grows.
pub struct Db(Mutex<SqliteConnection>);

type BoxError = Box<dyn std::error::Error + Send + Sync>;

impl Db {
    pub fn open(path: &Path) -> Result<Self, BoxError> {
        let url = path.to_str().ok_or("db path is not valid UTF-8")?;
        let mut conn = SqliteConnection::establish(url)?;
        conn.batch_execute(
            "PRAGMA journal_mode = WAL; \
             PRAGMA synchronous = NORMAL; \
             PRAGMA foreign_keys = ON; \
             PRAGMA busy_timeout = 5000;",
        )?;
        conn.run_pending_migrations(MIGRATIONS)?;
        println!("db ready at {}", path.display());
        Ok(Self(Mutex::new(conn)))
    }

    pub fn lock(&self) -> std::sync::MutexGuard<'_, SqliteConnection> {
        self.0.lock().expect("db mutex poisoned")
    }
}
