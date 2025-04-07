import { from, ParentProps } from "solid-js";
import bakery$ from "../services/connection";
import { bakeryUrl } from "../services/settings";
import { Navigate } from "@solidjs/router";

export default function RequireConnection(props: ParentProps) {
  const bakery = from(bakery$);
  const url = from(bakeryUrl);

  // Require setup
  if (!url()) return <Navigate href="/connect" />;

  // Wait for connection
  if (!bakery()) {
    return (
      <main class="flex flex-col items-center justify-center min-h-screen p-4">
        <div class="flex flex-col items-center gap-4">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="text-lg">Connecting...</p>
          <p class="text-sm text-base-content/60 text-center break-all">
            {url()}
          </p>
          <a href="/connect" class="btn btn-ghost">
            Connect to different bakery
          </a>
        </div>
      </main>
    );
  }

  return <>{props.children}</>;
}
