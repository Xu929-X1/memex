use super::models::UserInfo;
use super::schema::{session, settings, user_info};
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

// ---- session (single row, id = 1) ----

pub fn save_session(conn: &mut SqliteConnection, token: &str, saved_at: i64) -> QueryResult<()> {
    diesel::insert_into(session::table)
        .values((
            session::id.eq(1),
            session::token.eq(token),
            session::saved_at.eq(saved_at),
        ))
        .on_conflict(session::id)
        .do_update()
        .set((session::token.eq(token), session::saved_at.eq(saved_at)))
        .execute(conn)?;
    Ok(())
}

pub fn get_token(conn: &mut SqliteConnection) -> QueryResult<Option<String>> {
    session::table
        .find(1)
        .select(session::token)
        .first::<String>(conn)
        .optional()
}

pub fn clear_session(conn: &mut SqliteConnection) -> QueryResult<()> {
    diesel::delete(session::table).execute(conn)?;
    Ok(())
}

// ---- user_info ----

pub fn save_user(conn: &mut SqliteConnection, user: &UserInfo) -> QueryResult<()> {
    diesel::insert_into(user_info::table)
        .values(user)
        .on_conflict(user_info::id)
        .do_update()
        .set((
            user_info::email.eq(&user.email),
            user_info::username.eq(&user.username),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn get_user(conn: &mut SqliteConnection) -> QueryResult<Option<UserInfo>> {
    user_info::table
        .select(UserInfo::as_select())
        .first(conn)
        .optional()
}

pub fn clear_users(conn: &mut SqliteConnection) -> QueryResult<()> {
    diesel::delete(user_info::table).execute(conn)?;
    Ok(())
}

// ---- settings (key/value) ----

pub fn set_setting(conn: &mut SqliteConnection, key: &str, value: &str) -> QueryResult<()> {
    diesel::insert_into(settings::table)
        .values((settings::key.eq(key), settings::value.eq(value)))
        .on_conflict(settings::key)
        .do_update()
        .set(settings::value.eq(value))
        .execute(conn)?;
    Ok(())
}

pub fn get_setting(conn: &mut SqliteConnection, key: &str) -> QueryResult<Option<String>> {
    settings::table
        .find(key)
        .select(settings::value)
        .first::<String>(conn)
        .optional()
}
