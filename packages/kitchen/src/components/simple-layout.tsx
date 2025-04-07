import { JSX, ParentProps } from "solid-js";
import { HamburgerIcon } from "./icons";
import { NavigationDrawer } from "./nav-drawer";

export default function SimpleLayout(
  props: ParentProps<{ title: string; actions?: JSX.Element }>,
) {
  return (
    <div class="drawer flex-1 overflow-hidden lg:drawer-open">
      <input id="drawer" type="checkbox" class="drawer-toggle" />

      <div class="drawer-content flex-1 overflow-hidden flex flex-col">
        {/* Top navbar */}
        <div class="navbar bg-base-100 lg:hidden">
          <label for="drawer" class="btn btn-square btn-ghost drawer-button">
            <HamburgerIcon />
          </label>
          <h1 class="text-xl font-semibold px-4">{props.title}</h1>

          {props.actions}
        </div>

        {/* Main content */}
        <main class="flex-1 p-4 overflow-y-auto">
          <h1 class="text-2xl font-bold hidden lg:block mb-6">{props.title}</h1>
          {props.children}
        </main>
      </div>

      <NavigationDrawer />
    </div>
  );
}
