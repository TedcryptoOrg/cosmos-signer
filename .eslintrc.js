module.exports = {
    overrides: [
        {
            files: ['*.js', '*.jsx', '*.ts', '*.tsx'],
            extends: 'love',
            "rules": {
                "@typescript-eslint/no-var-requires": "off"
            }
        }
    ],
    ignorePatterns: [
        'jest.config.ts',
        '.eslintrc.js',
        'babel.config.js',
        'node_modules/',
        'tests/',
        'dist/',
        'lib/'
    ],
}