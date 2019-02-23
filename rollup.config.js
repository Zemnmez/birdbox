import typescript from 'rollup-plugin-typescript';
//import tslint from 'rollup-plugin-tslint';
import resolve from 'rollup-plugin-node-resolve';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "iife",
    sourcemap: true,
    banner: "#!/usr/bin/env/node"
  },
  plugins: [
    resolve(),
    /*tslint({
      throwOnError: true
    }),*/
    typescript({ lib: ["esNext", "DOM", "DOM.Iterable", "ScriptHost"], target: "esNext" })
  ]
}
