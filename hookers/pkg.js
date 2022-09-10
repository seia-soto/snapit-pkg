import * as patcher from '../utils/patcher.js'

export const statics = {
  // All copyrights are reserved to vercel/pkg authors.
  // > https://github.com/vercel/pkg/blob/main/prelude/bootstrap.js
  prelude: `// /////////////////////////////////////////////////////////////////
// PATCH PROCESS ///////////////////////////////////////////////////
// /////////////////////////////////////////////////////////////////
(() => {
  const ancestor = {
    dlopen: process.dlopen,
  };

  function revertMakingLong(f) {
    if (/^\\\\\\\\\\?\\\\/.test(f)) return f.slice(4);
    return f;
  }

  process.dlopen = function dlopen() {
    const args = cloneArgs(arguments);
    const modulePath = revertMakingLong(args[1]);
    const moduleBaseName = path.basename(modulePath);
    const moduleFolder = path.dirname(modulePath);

    if (insideSnapshot(modulePath)) {
      const moduleContent = fs.readFileSync(modulePath);

      // Node addon files and .so cannot be read with fs directly, they are loaded with process.dlopen which needs a filesystem path
      // we need to write the file somewhere on disk first and then load it
      // the hash is needed to be sure we reload the module in case it changes
      const hash = createHash('sha256').update(moduleContent).digest('hex');

      // Example: /tmp/pkg/<hash>
      const tmpFolder = path.join(tmpdir(), 'pkg', hash);

      createDirRecursively(tmpFolder);

      // Example: moduleFolder = /snapshot/appname/node_modules/sharp/build/Release
      const parts = moduleFolder.split(path.sep);
      const mIndex = parts.indexOf('node_modules') + 1;

      let newPath;

      // it's a node addon file contained in node_modules folder
      // we copy the entire module folder in tmp folder
      if (mIndex > 0) {
        // Example: modulePackagePath = sharp/build/Release
        const modulePackagePath = parts.slice(mIndex).join(path.sep);
        // Example: modulePkgFolder = /snapshot/appname/node_modules/sharp
        const modulePkgFolder = parts.slice(0, mIndex + 1).join(path.sep);

        // here we copy all files from the snapshot module folder to temporary folder
        // we keep the module folder structure to prevent issues with modules that are statically
        // linked using relative paths (Fix #1075)
        copyFolderRecursiveSync(modulePkgFolder, tmpFolder);

        // Example: /tmp/pkg/<hash>/sharp/build/Release/sharp.node
        newPath = path.join(tmpFolder, modulePackagePath, moduleBaseName);
      } else {
        const tmpModulePath = path.join(tmpFolder, moduleBaseName);

        if (!fs.existsSync(tmpModulePath)) {
          fs.copyFileSync(modulePath, tmpModulePath);
        }

        // load the copied file in the temporary folder
        newPath = tmpModulePath;
      }

      // replace the path with the new module path
      args[1] = newPath;
    }

    return ancestor.dlopen.apply(process, args);
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
    && payload.indexOf('process.versions.pkg = \'5') >= 0
}

export const patch = (payload) => patcher.patch
