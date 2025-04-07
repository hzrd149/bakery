import { createSignal, type Component } from "solid-js";
import { CheckIcon, CopyToClipboardIcon } from "./icons";

type CopyIconButtonProps = {
  value: string | undefined | (() => string);
  icon?: Component;
  class?: string;
  "aria-label"?: string;
};

export function CopyIconButton(props: CopyIconButtonProps) {
  const [copied, setCopied] = createSignal(false);

  const handleClick = () => {
    const v: string | undefined =
      typeof props.value === "function" ? props.value() : props.value;

    if (v && navigator.clipboard && !copied()) {
      navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      class={`btn btn-square btn-ghost ${props.class || ""}`}
      onClick={handleClick}
      aria-label={props["aria-label"]}
    >
      {copied() ? (
        <CheckIcon class="w-5 h-5" />
      ) : (
        <CopyToClipboardIcon class="w-5 h-5" />
      )}
    </button>
  );
}
