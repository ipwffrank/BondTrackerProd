// @alteri/ui — Axle brand component library
// Barrel export — uses direct assignments so Rollup/CommonJS can statically
// detect the named exports (AxleLogo, Button, tokens).

var t = require('./src/tokens.js');
exports.tokens   = t.tokens;
exports.AxleLogo = require('./src/AxleLogo.jsx');
exports.Button   = require('./src/Button.jsx');
