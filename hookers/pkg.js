export const statics = {
  // All copyrights are reserved to vercel/pkg authors.
  // > https://github.com/vercel/pkg/blob/main/prelude/diagnostic.js
  prelude: `/* eslint-disable global-require */
/* eslint-disable no-console */
/* global DICT */

'use strict';

(function installDiagnostic() {
  const fs = require('fs');
  const path = require('path');
  const win32 = process.platform === 'win32';

  if (process.env.DEBUG_PKG === '2') {
    console.log(Object.entries(DICT));
  }
  function dumpLevel(filename, level, tree) {
    let totalSize = 0;
    const d = fs.readdirSync(filename);
    for (let j = 0; j < d.length; j += 1) {
      const f = path.join(filename, d[j]);
      const realPath = fs.realpathSync(f);
      const isSymbolicLink2 = f !== realPath;

      const s = fs.statSync(f);
      totalSize += s.size;

      if (s.isDirectory() && !isSymbolicLink2) {
        const tree1 = [];
        totalSize += dumpLevel(f, level + 1, tree1);
        const str =
          (' '.padStart(level * 2, ' ') + d[j]).padEnd(40, ' ') +
          (totalSize.toString().padStart(10, ' ') +
            (isSymbolicLink2 ? \`=> \${realPath}\` : ' '));
        tree.push(str);
        tree1.forEach((x) => tree.push(x));
      } else {
        const str =
          (' '.padStart(level * 2, ' ') + d[j]).padEnd(40, ' ') +
          (s.size.toString().padStart(10, ' ') +
            (isSymbolicLink2 ? \`=> \${realPath}\` : ' '));
        tree.push(str);
      }
    }
    return totalSize;
  }
  function wrap(obj, name) {
    const f = fs[name];
    obj[name] = (...args) => {
      const args1 = Object.values(args);
      console.log(
        \`fs.\${name}\`,
        args1.filter((x) => typeof x === 'string')
      );
      return f.apply(this, args1);
    };
  }
  if (process.env.DEBUG_PKG) {
    console.log('------------------------------- virtual file system');
    const startFolder = win32 ? 'C:\\\\snapshot' : '/snapshot';
    console.log(startFolder);

    const tree = [];
    const totalSize = dumpLevel(startFolder, 1, tree);
    console.log(tree.join('\\n'));

    console.log('Total size = ', totalSize);
    if (process.env.DEBUG_PKG === '2') {
      wrap(fs, 'openSync');
      wrap(fs, 'open');
      wrap(fs, 'readSync');
      wrap(fs, 'read');
      wrap(fs, 'writeSync');
      wrap(fs, 'write');
      wrap(fs, 'closeSync');
      wrap(fs, 'readFileSync');
      wrap(fs, 'close');
      wrap(fs, 'readFile');
      wrap(fs, 'readdirSync');
      wrap(fs, 'readdir');
      wrap(fs, 'realpathSync');
      wrap(fs, 'realpath');
      wrap(fs, 'statSync');
      wrap(fs, 'stat');
      wrap(fs, 'lstatSync');
      wrap(fs, 'lstat');
      wrap(fs, 'fstatSync');
      wrap(fs, 'fstat');
      wrap(fs, 'existsSync');
      wrap(fs, 'exists');
      wrap(fs, 'accessSync');
      wrap(fs, 'access');
    }
  }
})();
`,
  hook: `(async function installHooker() {
  const fs = require('fs')
  const path = require('path')
  const win32 = process.platform === 'win32'
  const base = win32 ? 'C:\\\\snapshot' : '/snapshot'

  const dump = async (root = base) => {
    const files = fs.readdirSync(root)

    for (let i = 0; i < files.length; i++) {
      const file = path.join(root, files[i])

      if (fs.statSync(file).isDirectory()) {
        await dump(file)
      } else {
        const out = path.join(process.cwd(), 'snapit-pkg', path.relative(base, file))

        console.log(\`copying \${file} to \${out}...\`)

        fs.mkdirSync(path.dirname(out), { recursive:true })
        fs.writeFileSync(out, fs.readFileSync(file), 'utf-8')
      }
    }
  }

  await dump()
  process.exit(0)
})();//
`
}

/**
 * Check if the hooker is able to inject extraction script.
 * @param {string} payload The raw binary
 */
export const isSupported = async (payload) => {
  // https://github.com/vercel/pkg/blob/main/prelude/diagnostic.js#L57
  return payload.indexOf('------------------------------- virtual file system') >= 0
}

/**
 *
 * @param {string} payload The raw binary
 */
export const patch = (payload) => {
  const findHookingIndex = () => {
    const index = payload.indexOf(statics.prelude)

    if (index < 0) {
      throw new Error('Failed to find a valid hooking point!')
    }

    return index
  }

  const hookingIndex = findHookingIndex()
  const fragments = {
    pre: payload.slice(0, hookingIndex - 1),
    inject: statics.hook,
    post: payload.slice(hookingIndex + statics.prelude.length)
  }

  if (fragments.inject.length > statics.prelude.length) {
    // If the length of injectable script is longer than original script,
    // the binary will likely to fail to launch.
    throw new Error('The length of hook is longer than original script!')
  }

  if (fragments.inject.length < statics.prelude.length) {
    for (; fragments.inject.length <= statics.prelude.length;) {
      fragments.inject += ' '
    }
  }

  return fragments.pre + fragments.inject + fragments.post
}
