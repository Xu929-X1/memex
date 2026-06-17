use super::schema::{session, settings, user_info};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

// `check_for_backend` makes the compiler verify every field maps to a real
// column of the right SQL type — schema drift becomes a build error.

#[derive(Debug, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = session)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Session {
    pub id: i32,
    pub token: String,
    pub saved_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = user_info)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub username: Option<String>,
}

#[derive(Debug, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Setting {
    pub key: String,
    pub value: String,
}
