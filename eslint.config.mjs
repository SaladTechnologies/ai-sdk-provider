import eslint from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsConfig from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import vitestPlugin from "eslint-plugin-vitest";

export default [
  eslint.configs.recommended,
  {
    languageOptions: {
      parser: tsConfig,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      import: importPlugin,
      vitest: vitestPlugin,
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc" },
          groups: [
            ["builtin"],
            ["external"],
            ["internal"],
            ["parent", "sibling", "index"],
            ["type"],
          ],
        },
      ],
      "no-console": "error",
      "no-eval": "error",
      "no-unused-vars": "off",
      "import/no-unresolved": "off",
      "import/no-internal-module": "off",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsConfig,
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.base.json"],
        tsconfigRootDir: process.cwd(),
      },
      globals: {
        process: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      import: importPlugin,
      vitest: vitestPlugin,
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc" },
          groups: [
            ["builtin"],
            ["external"],
            ["internal"],
            ["parent", "sibling", "index"],
            ["type"],
          ],
        },
      ],
      "no-console": "error",
      "no-eval": "error",
      "no-unused-vars": "off",
      "import/no-unresolved": "off",
      "import/no-internal-module": "off",
    },
  },
];
