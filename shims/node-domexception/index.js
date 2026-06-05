// In modern Node.js environments (v18+), DOMException is built-in natively on globalThis.
// This local shim replaces the deprecated `node-domexception` package to silences warnings.
module.exports = globalThis.DOMException;
