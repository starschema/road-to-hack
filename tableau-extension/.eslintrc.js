module.exports = {
    'parser': 'babel-eslint',
    'env': {
        'browser': true,
        'es6': true,
        'node': true,
        'mocha': true,
    },
    "globals": {
        "tableau": false,
        "mapboxgl": false,
        "DataViz": false,
        "defaults": false,
        "settingKeys": false,
    },
    // 'plugins': [
    //     'flowtype'
    // ],
    'extends': [
        'eslint:recommended',
        // 'plugin:flowtype/recommended'
    ],
    'parserOptions': {
        'sourceType': 'module'
    },
    'rules': {
        'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
        'no-console' : 'warn',
        'indent': [
            'error',
            4
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'never'
        ]
    }
}
