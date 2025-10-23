# Build script for Rust + WASM

# Build for Node.js (WASI target)
build-node:
	cargo build --target wasm32-wasi --release
	@echo "Node.js WASM built: target/wasm32-wasi/release/daebug.wasm"

# Build for Browser (using wasm-pack)
build-browser:
	wasm-pack build --target web --out-dir js/pkg
	@echo "Browser WASM built: js/pkg/"

# Build both targets
build-all: build-node build-browser

# Development checks
check:
	cargo check
	cargo clippy

# Run tests
test:
	cargo test

# Clean build artifacts
clean:
	cargo clean
	rm -rf js/pkg

# Install prerequisites
install-deps:
	cargo install wasm-pack
	rustup target add wasm32-wasi

.PHONY: build-node build-browser build-all check test clean install-deps
