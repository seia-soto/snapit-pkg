import * as patcher from '../utils/patcher.js'

export const statics = {
  // All copyrights are reserved to vercel/pkg authors.
  // > https://github.com/vercel/pkg/blob/main/prelude/bootstrap.js
  prelude: `// /////////////////////////////////////////////////////////////////
  // PATCH PROCESS ///////////////////////////////////////////////////
  // /////////////////////////////////////////////////////////////////
  (() => {
    const fs = require('fs');
    var ancestor = {};
    ancestor.dlopen = process.dlopen;
  
    function revertMakingLong(f) {
      if (/^\\\\\\\\\\?\\\\/.test(f)) return f.slice(4);
      return f;
    }
  
    process.dlopen = function dlopen() {
      const args = cloneArgs(arguments);
      const modulePath = revertMakingLong(args[1]);
      const moduleDirname = require('path').dirname(modulePath);
      if (insideSnapshot(modulePath)) {
        // Node addon files and .so cannot be read with fs directly, they are loaded with process.dlopen which needs a filesystem path
        // we need to write the file somewhere on disk first and then load it
        const moduleContent = fs.readFileSync(modulePath);
        const moduleBaseName = require('path').basename(modulePath);
        const hash = require('crypto')
          .createHash('sha256')
          .update(moduleContent)
          .digest('hex');
        const tmpModulePath = \`\${require('os').tmpdir()}/\${hash}_\${moduleBaseName}\`;
        try {
          fs.statSync(tmpModulePath);
        } catch (e) {
          // Most likely this means the module is not on disk yet
          fs.writeFileSync(tmpModulePath, moduleContent, { mode: 0o444 });
        }
        args[1] = tmpModulePath;
      }
  
      const unknownModuleErrorRegex = /([^:]+): cannot open shared object file: No such file or directory/;
      const tryImporting = function tryImporting(previousErrorMessage) {
        try {
          const res = ancestor.dlopen.apply(process, args);
          return res;
        } catch (e) {
          if (e.message === previousErrorMessage) {
            // we already tried to fix this and it didn't work, give up
            throw e;
          }
          if (e.message.match(unknownModuleErrorRegex)) {
            // some modules are packaged with dynamic linking and needs to open other files that should be in
            // the same directory, in this case, we write this file in the same /tmp directory and try to
            // import the module again
            const moduleName = e.message.match(unknownModuleErrorRegex)[1];
            const importModulePath = \`\${moduleDirname}/\${moduleName}\`;
            const moduleContent = fs.readFileSync(importModulePath);
            const moduleBaseName = require('path').basename(importModulePath);
            const tmpModulePath = \`\${require('os').tmpdir()}/\${moduleBaseName}\`;
            try {
              fs.statSync(tmpModulePath);
            } catch (err) {
              fs.writeFileSync(tmpModulePath, moduleContent, { mode: 0o444 });
            }
            return tryImporting(e.message);
          }
          throw e;
        }
      };
      tryImporting();
    };
  })();`,
  hook: `(async function installHooker() {
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
})();
`
}

/**
 * Check if the hooker is able to inject extraction script.
 * @param {string} payload The raw binary
 */
 export const isSupported = async (payload) => {
    // https://github.com/vercel/pkg/blob/main/prelude/diagnostic.js#L57
    return payload.indexOf('------------------------------- virtual file system') >= 0
      && payload.indexOf('process.versions.pkg = \'4') >= 0
  }

export const patch = (payload) => patcher.patch
