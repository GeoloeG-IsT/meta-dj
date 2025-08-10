## Analyzer

Audio analysis pipeline.

- JS placeholder: `packages/analyzer/src/index.js`
- Rust analyzer (preferred when installed): `packages/analyzer-rs`

### Local Rust install

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
cargo install --path packages/analyzer-rs --force
```

### Usage

- Core CLI auto-detects Rust binary `meta-dj-analyzer-rs` when available:

```bash
node packages/core/src/cli.js analyze        # auto
DJ_ANALYZER=rust node packages/core/src/cli.js analyze
DJ_ANALYZER=js node packages/core/src/cli.js analyze
```



