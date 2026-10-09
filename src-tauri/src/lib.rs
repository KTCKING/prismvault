pub mod engine;
pub mod commands;
pub mod utils;

use std::sync::Arc;
use std::sync::Mutex;

pub struct AppState {
    pub engine: Arc<Mutex<engine::Engine>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            engine: Arc::new(Mutex::new(engine::Engine::new())),
        }
    }
}