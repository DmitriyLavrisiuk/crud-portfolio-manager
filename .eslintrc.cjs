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
        "plugin:react-hooks/recommended",
        "plugin:react-refresh/recommended"
      ],
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
