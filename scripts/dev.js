const { build } = require('esbuild')
const minimist = require('minimist') // 用来解析命令行参数
const { resolve } = require('path')

const args = minimist(process.argv.slice(2))

console.log(args)

const target = args['_'][0] || 'reactivity'
const format = args['f'] || 'global'

const pkg = require(resolve(__dirname, `../packages/${target}/package.json`))

const outputFormat = format.startsWith('global')
  ? 'iife' // 立即执行函数
  : format === 'cjs'
  ? 'cjs' // commonJS
  : 'esm' // esModule

const outfile = resolve(
  __dirname,
  `../packages/${target}/dist/${target}.${format}.js`
)

// 天生就支持 TS
build({
  entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
  outfile,
  bundle: true, // 把所有的包全部打到一起
  sourcemap: true,
  format: outputFormat, // 输出格式
  globalName: pkg.buildOptions?.name,
  platform: format === 'cjs' ? 'node' : 'browser',
  watch: {
    onRebuild(error) {
      if (!error) {
        console.log('rebuilt...')
      }
    },
  },
}).then(() => {
  console.log('watching...')
})
