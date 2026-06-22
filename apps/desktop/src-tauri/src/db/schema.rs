// @generated automatically by Diesel CLI.
// Regenerate after a new migration: `diesel migration run` (updates this file).

diesel::table! {
    settings (key) {
        key -> Text,
        value -> Text,
    }
}

diesel::table! {
    user_info (id) {
        id -> Text,
        email -> Text,
        username -> Nullable<Text>,
    }
}

diesel::allow_tables_to_appear_in_same_query!(settings, user_info);
