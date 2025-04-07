import { Navigate, RouteSectionProps } from "@solidjs/router";
import { from } from "solid-js";

import { bakeryUrl } from "../services/settings";

export default function RequireSetup(props: RouteSectionProps) {
  const url = from(bakeryUrl);

  if (!url()) return <Navigate href="/connect" />;
  else return <>{props.children}</>;
}
