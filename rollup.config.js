import typescript from 'rollup-plugin-typescript';
//import tslint from 'rollup-plugin-tslint';
import resolve from 'rollup-plugin-node-resolve';
import { uglify } from 'rollup-plugin-uglify';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "umd",
    sourcemap: true,
    banner: "#!/usr/bin/env/node"
  },
  plugins: [
    resolve(),
    /*tslint({
      throwOnError: true
    }),*/
    typescript({ lib: ["es5", "es6"], target: "es5" }),
    production && uglify()
  ]
}
