import type { UIAdapterModule } from "../types";
import { parseStdoutLine, buildConfig } from "@paperclipai/adapter-kiro-cli/ui";
import { KiroCliConfigFields } from "./config-fields";

export const kiroCliUIAdapter: UIAdapterModule = {
  type: "kiro_cli",
  label: "Kiro CLI",
  parseStdoutLine,
  ConfigFields: KiroCliConfigFields,
  buildAdapterConfig: buildConfig,
};
