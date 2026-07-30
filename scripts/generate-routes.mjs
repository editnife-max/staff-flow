import { Generator, getConfig } from '../node_modules/@tanstack/router-generator/dist/esm/index.js'

const config = getConfig({}, process.cwd())
const generator = new Generator({ config, root: process.cwd() })
await generator.run()
console.log('Route tree generated.')
