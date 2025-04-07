import { from, createSignal, createEffect, createMemo } from "solid-js";
import { useNavigate } from "@solidjs/router";

import { ChevronLeftIcon, QrCodeIcon } from "../../components/icons";
import { bakeryUrl } from "../../services/settings";
import { bakeryConnected } from "../../services/connection";

function ConnectView() {
  const navigate = useNavigate();

  const [submitted, setSubmitted] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");

  const connected = from(bakeryConnected);
  const url = from(bakeryUrl);

  // redirect once connected
  createEffect(() => {
    if (connected() && submitted()) navigate("/", { replace: true });
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!inputValue()) return;
    setSubmitted(true);
    bakeryUrl.next(inputValue());
  };

  const isLoading = createMemo(() => !connected() && submitted());

  return (
    <main class="flex flex-col justify-center h-full p-4 mx-auto max-w-md">
      {connected() && (
        <div class="w-full text-center mb-8">
          <p class="mb-1">Currently connected to:</p>
          <p class="text-primary font-medium break-all">{url()}</p>
        </div>
      )}
      <form class="w-full space-y-4" onSubmit={handleSubmit}>
        <div class="join w-full">
          <input
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            type="url"
            placeholder="Enter bakery URL"
            class="input input-bordered join-item flex-1"
            required
            disabled={isLoading()}
          />
          <button
            type="button"
            class="btn btn-primary join-item"
            onClick={() => navigate("/connect/scan")}
            aria-label="Scan QR code"
            disabled={isLoading()}
          >
            <QrCodeIcon />
          </button>
        </div>
        <div class="join w-full">
          {url() && (
            <button
              type="button"
              class="btn btn-ghost join-item"
              onClick={() => navigate(-1)}
              aria-label="back"
            >
              <ChevronLeftIcon />
            </button>
          )}
          <button
            type="submit"
            class="btn btn-primary join-item flex-1"
            disabled={isLoading()}
          >
            {isLoading() ? (
              <span class="loading loading-spinner"></span>
            ) : (
              "Connect"
            )}
          </button>
        </div>
      </form>
    </main>
  );
}

export default ConnectView;
