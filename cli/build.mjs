#!/usr/bin/env node
import esbuild from "esbuild";
import config from "./esbuild.config.mjs";
import { platform } from "os";
import { execSync } from "child_process";

await esbuild.build(config);

if (platform() !== "win32") {
  try {
    execSync("chmod +x dist/index.js");
  } catch (err) {
    console.warn("Warning: Failed to chmod dist/index.js", err.message);
  }
}

console.log("✓ CLI built successfully");
