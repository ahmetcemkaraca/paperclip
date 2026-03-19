import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  DraftTextarea,
  Field,
  help,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function KiroCliConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Working Directory" hint={help.cwd}>
        <div className="flex items-center gap-2">
          <DraftInput
            value={
              isCreate
                ? values!.cwd
                : eff("adapterConfig", "cwd", String(config.cwd ?? ""))
            }
            onCommit={(value) =>
              isCreate ? set!({ cwd: value }) : mark("adapterConfig", "cwd", value || undefined)
            }
            immediate
            className={inputClass}
            placeholder="/absolute/path/to/repo"
          />
          <ChoosePathButton />
        </div>
      </Field>
      <Field label="Command" hint={help.localCommand}>
        <DraftInput
          value={
            isCreate
              ? values!.command || "kiro-cli"
              : eff("adapterConfig", "command", String(config.command ?? "kiro-cli"))
          }
          onCommit={(value) =>
            isCreate ? set!({ command: value }) : mark("adapterConfig", "command", value || undefined)
          }
          immediate
          className={inputClass}
          placeholder="kiro-cli"
        />
      </Field>
      <Field label="Prompt Template" hint={help.promptTemplate}>
        <DraftTextarea
          value={
            isCreate
              ? values!.promptTemplate
              : eff("adapterConfig", "promptTemplate", String(config.promptTemplate ?? ""))
          }
          onCommit={(value) =>
            isCreate ? set!({ promptTemplate: value }) : mark("adapterConfig", "promptTemplate", value ?? "")
          }
          minRows={5}
        />
      </Field>
    </>
  );
}
