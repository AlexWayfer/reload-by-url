import multiInput from 'rollup-plugin-multi-input'
import resolve from '@rollup/plugin-node-resolve'

export default {
	input: ['scripts/src/**/*.js'],
	output: {
		format: 'es',
		dir: 'scripts/'
	},
	plugins: [
		// https://github.com/alfredosalzillo/rollup-plugin-multi-input/issues/61
		multiInput.default({ relative: 'scripts/src/' }),
		resolve({
			browser: true,
			// It doesn't allow to require `punycode`
			preferBuiltins: false,
			isRequire: true
		})
	]
}
