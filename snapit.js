import fs from 'fs'
import cac from 'cac'

const cli = cac()

cli.option('--type <pkg>', 'Choose executable type to hook up')
cli.option('--file <file>', 'Choose a file to patch')

cli.version('1.0.0')
cli.help()

const parsed = cli.parse()

if (
  !parsed.options.file ||
  !fs.existsSync(parsed.options.file)
) {
  throw new Error('Failed to find the file to patch!')
}

const file = fs.readFileSync(parsed.options.file, 'binary')

switch (cli.options.type) {
  case 'pkg': {
    const mod = await import('./hookers/pkg.js')

    if (!mod.isSupported(file)) {
      throw new Error('The given binary is not supported!')
    }

    const patched = mod.patch(file)

    fs.writeFileSync(parsed.options.file + '.patched', patched, 'binary')

    break
  }
}
