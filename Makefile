# Build script for Rust + WASM - unified module for Node/Page/Worker

# Build unified WASM module (single binary for all three contexts)
build-wasm:
	cargo build --lib --target wasm32-unknown-unknown --release --no-default-features
	cp target/wasm32-unknown-unknown/release/daebug.wasm rust/daebug.wasm
	@echo "✅ Unified WASM built: rust/daebug.wasm"
	@ls -lh rust/daebug.wasm

# Development checks
check:
	cargo check
	cargo check --target wasm32-unknown-unknown --no-default-features

# Run tests
test:
	cargo test

# Clean build artifacts
clean:
	cargo clean
	rm -f rust/daebug.wasm

# Install prerequisites
install-deps:
	rustup target add wasm32-unknown-unknown

.PHONY: build-wasm check test clean install-deps
