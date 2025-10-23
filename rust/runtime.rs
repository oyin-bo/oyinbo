// Runtime context disambiguation for WASM module
//
// The same WASM binary runs in three contexts:
// - Node.js: Full server orchestration
// - Page: Browser REPL client
// - Worker: Isolated worker REPL

use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeContext {
    Node,
    Page,
    Worker,
}

static mut RUNTIME_CONTEXT: Option<RuntimeContext> = None;

/// Initialize the runtime context (called by JS bootstrap)
#[wasm_bindgen]
pub fn init_runtime(context: &str) -> Result<(), JsValue> {
    let ctx = match context {
        "node" => RuntimeContext::Node,
        "page" => RuntimeContext::Page,
        "worker" => RuntimeContext::Worker,
        _ => return Err(JsValue::from_str(&format!("Unknown runtime context: {}", context))),
    };
    
    unsafe {
        RUNTIME_CONTEXT = Some(ctx);
    }
    
    #[cfg(target_family = "wasm")]
    {
        web_sys::console::log_1(&format!("👾Daebug WASM initialized in {:?} context", ctx).into());
    }
    
    Ok(())
}

/// Get the current runtime context
pub fn get_runtime_context() -> RuntimeContext {
    unsafe {
        RUNTIME_CONTEXT.unwrap_or(RuntimeContext::Node)
    }
}

/// Check if running in Node.js context
pub fn is_node() -> bool {
    get_runtime_context() == RuntimeContext::Node
}

/// Check if running in browser page context
pub fn is_page() -> bool {
    get_runtime_context() == RuntimeContext::Page
}

/// Check if running in worker context
pub fn is_worker() -> bool {
    get_runtime_context() == RuntimeContext::Worker
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_context() {
        // Default is Node
        assert_eq!(get_runtime_context(), RuntimeContext::Node);
    }
}
