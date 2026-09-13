mod commands;
#[cfg(desktop)]
mod desktop;
mod error;
#[cfg(mobile)]
mod mobile;
mod models;
mod path;

pub use error::ScopedStorageError;
pub use models::*;

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(desktop)]
pub use desktop::ScopedStorage;
#[cfg(mobile)]
pub use mobile::ScopedStorage;

/// Access the managed `ScopedStorage` from any Tauri `Manager`
/// (`AppHandle`, `App`, `Window`). Mirrors `PdfRenderExt` in
/// `vendor/tauri-plugin-pdf-render`.
pub trait ScopedStorageExt<R: Runtime> {
    fn scoped_storage(&self) -> &ScopedStorage<R>;
}

impl<R: Runtime, T: Manager<R>> ScopedStorageExt<R> for T {
    fn scoped_storage(&self) -> &ScopedStorage<R> {
        self.state::<ScopedStorage<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("scoped-storage")
        .setup(|app, api| {
            #[cfg(mobile)]
            let storage = mobile::init(app, api)?;
            #[cfg(desktop)]
            let storage = desktop::init(app, api)?;

            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder,
            commands::forget_folder,
            commands::list_folders,
            commands::get_folder_info,
            commands::read_dir,
            commands::stat,
            commands::exists,
            commands::read_file,
            commands::write_file,
            commands::read_text_file,
            commands::read_text_file_lines,
            commands::write_text_file,
            commands::append_file,
            commands::mkdir,
            commands::remove_file,
            commands::remove_dir,
            commands::copy,
            commands::mv,
            commands::rename,
            commands::truncate,
            commands::warm_folder,
            commands::warm_status,
        ])
        .build()
}
