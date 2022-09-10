export const statics = {
  // All copyrights are reserved to vercel/pkg authors.
  // > https://github.com/vercel/pkg/blob/main/prelude/bootstrap.js
  prelude: `// /////////////////////////////////////////////////////////////////
// PATCH CHILD_PROCESS /////////////////////////////////////////////
// /////////////////////////////////////////////////////////////////

(function () {
  var childProcess = require('child_process');
  var ancestor = {};
  ancestor.spawn = childProcess.spawn;
  ancestor.spawnSync = childProcess.spawnSync;
  ancestor.execFile = childProcess.execFile;
  ancestor.execFileSync = childProcess.execFileSync;
  ancestor.exec = childProcess.exec;
  ancestor.execSync = childProcess.execSync;

  function setOptsEnv (args) {
    var pos = args.length - 1;
    if (typeof args[pos] === 'function') pos -= 1;
    if (typeof args[pos] !== 'object' || Array.isArray(args[pos])) {
      pos += 1;
      args.splice(pos, 0, {});
    }
    var opts = args[pos];
    if (!opts.env) opts.env = require('util')._extend({}, process.env);
    if (opts.env.PKG_EXECPATH === 'PKG_INVOKE_NODEJS') return;
    opts.env.PKG_EXECPATH = EXECPATH;
  }

  function startsWith2 (args, index, name, impostor) {
    var qsName = '"' + name + ' ';
    if (args[index].slice(0, qsName.length) === qsName) {
      args[index] = '"' + impostor + ' ' + args[index].slice(qsName.length);
      return true;
    }
    var sName = name + ' ';
    if (args[index].slice(0, sName.length) === sName) {
      args[index] = impostor + ' ' + args[index].slice(sName.length);
      return true;
    }
    if (args[index] === name) {
      args[index] = impostor;
      return true;
    }
    return false;
  }

  function startsWith (args, index, name) {
    var qName = '"' + name + '"';
    var qEXECPATH = '"' + EXECPATH + '"';
    var jsName = JSON.stringify(name);
    var jsEXECPATH = JSON.stringify(EXECPATH);
    return startsWith2(args, index, name, EXECPATH) ||
           startsWith2(args, index, qName, qEXECPATH) ||
           startsWith2(args, index, jsName, jsEXECPATH);
  }

  function modifyLong (args, index) {
    if (!args[index]) return;
    return (startsWith(args, index, 'node') ||
            startsWith(args, index, ARGV0) ||
            startsWith(args, index, ENTRYPOINT) ||
            startsWith(args, index, EXECPATH));
  }

  function modifyShort (args) {
    if (!args[0]) return;
    if (!Array.isArray(args[1])) {
      args.splice(1, 0, []);
    }
    if (args[0] === 'node' ||
        args[0] === ARGV0 ||
        args[0] === ENTRYPOINT ||
        args[0] === EXECPATH) {
      args[0] = EXECPATH;
      if (NODE_VERSION_MAJOR === 0) {
        args[1] = args[1].filter(function (a) {
          return (a.slice(0, 13) !== '--debug-port=');
        });
      }
    } else {
      for (var i = 1; i < args[1].length; i += 1) {
        var mbc = args[1][i - 1];
        if (mbc === '-c' || mbc === '/c') {
          modifyLong(args[1], i);
        }
      }
    }
  }

  childProcess.spawn = function () {
    var args = cloneArgs(arguments);
    setOptsEnv(args);
    modifyShort(args);
    return ancestor.spawn.apply(childProcess, args);
  };

  childProcess.spawnSync = function () {
    var args = cloneArgs(arguments);
    setOptsEnv(args);
    modifyShort(args);
    return ancestor.spawnSync.apply(childProcess, args);
  };

  childProcess.execFile = function () {
    var args = cloneArgs(arguments);
    setOptsEnv(args);
    modifyShort(args);
    return ancestor.execFile.apply(childProcess, args);
  };

  childProcess.execFileSync = function () {
    var args = cloneArgs(arguments);
    setOptsEnv(args);
    modifyShort(args);
    return ancestor.execFileSync.apply(childProcess, args);
  };

  childProcess.exec = function () {
    var args = cloneArgs(arguments);
    setOptsEnv(args);
    modifyLong(args, 0);
    return ancestor.exec.apply(childProcess, args);
  };

  childProcess.execSync = function () {
    var args = cloneArgs(arguments);
    setOptsEnv(args);
    modifyLong(args, 0);
    return ancestor.execSync.apply(childProcess, args);
  };
}());`,
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
