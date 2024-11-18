module.exports = (async function config() {
    const { default: love } = await import('eslint-config-love')

    return [
        {
            ...love,
            files: ['**/*.js', '**/*.ts'],
            rules: {
                ...love.rules,
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/no-magic-numbers': 'off',
                '@typescript-eslint/no-unsafe-assignment': 'off',
                '@typescript-eslint/no-unsafe-member-access': 'off',
                '@typescript-eslint/no-unsafe-argument': 'off',
                '@typescript-eslint/strict-boolean-expressions': 'off',
                '@typescript-eslint/no-unsafe-return': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/prefer-destructuring': 'off',
                '@typescript-eslint/ban-ts-comment': 'off',
                '@typescript-eslint/class-methods-use-this': 'off',
                '@typescript-eslint/max-params': 'off',
                '@typescript-eslint/no-unsafe-call': 'off',
                '@typescript-eslint/naming-convention': 'off',
            },
            ignores: [
                'jest.config.ts',
                '.eslintrc.js',
                'babel.config.js',
                'node_modules/',
                'tests/**/*.ts',
            ]
        },
    ]
})()