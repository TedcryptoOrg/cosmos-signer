module.exports = [
    {
        ...require('eslint-config-love'),
        files: ['*.js', '*.jsx', '*.ts', '*.tsx'],
        rules: {
            "@typescript-eslint/no-var-requires": "off"
        },
        ignores: [
            'jest.config.ts',
            '.eslintrc.js',
            'babel.config.js',
            'node_modules/',
            'tests/',
            'dist/',
            'lib/'
        ],
    }
]