import { QrCodeIcon } from "../../../components/icons";
import { createSignal, type ParentProps } from "solid-js";
import { CopyIconButton } from "../../../components/copy-icon-button";
import QrCodeImage from "../../../components/qr-code";

interface PanelItemStringProps {
  label: string;
  value?: string;
  qr?: boolean;
  isLoading?: boolean;
}

export default function PanelItemString(
  props: ParentProps<PanelItemStringProps>,
) {
  const [showQR, setShowQR] = createSignal(false);

  return (
    <div class="form-control w-full">
      <label class="label">
        <span class="label-text">{props.label}</span>
      </label>
      <div class="flex gap-2">
        {props.isLoading ? (
          "Loading..."
        ) : (
          <>
            <pre class="font-mono select-all overflow-auto p-1 bg-base-200 rounded-lg flex-1">
              {props.value}
            </pre>
            <div class="btn-group">
              <CopyIconButton
                value={props.value}
                class="btn btn-ghost btn-sm"
                aria-label="Copy value"
              />
              {props.qr && (
                <button
                  class="btn btn-ghost btn-sm"
                  onClick={() => setShowQR(!showQR())}
                  aria-label="show qrcode"
                >
                  <QrCodeIcon class="w-5 h-5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {props.value && showQR() && (
        <QrCodeImage content={props.value} class="max-w-32 mt-2" />
      )}
      {props.children}
    </div>
  );
}
