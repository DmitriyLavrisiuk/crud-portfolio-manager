module.exports = {
  root: true,
  ignorePatterns: ["dist", "node_modules"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      plugins: ["react", "react-hooks", "react-refresh"],
      extends: [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended"
      ],
      rules: {
        "react-refresh/only-export-components": "off",
        "react/react-in-jsx-scope": "off",
        "react/jsx-uses-react": "off"
      },
      settings: {
        react: {
          version: "detect"
        }
      },
      env: {
        browser: true
      }
    },
    {
      files: ["apps/api/**/*.ts"],
      env: {
        node: true
      }
    }
  ]
}
