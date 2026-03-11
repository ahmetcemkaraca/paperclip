#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const srcPath = path.join(__dirname, "src", "migrations");
const destPath = path.join(__dirname, "dist", "migrations");

if (fs.existsSync(srcPath)) {
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }
  fs.cpSync(srcPath, destPath, { recursive: true, force: true });
  console.log(`✓ Copied migrations from ${srcPath} to ${destPath}`);
} else {
  console.warn(`⚠ Migrations source directory not found: ${srcPath}`);
}
