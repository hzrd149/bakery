import { ParentProps } from "solid-js";

export default function Panel({
  label,
  children,
  ...props
}: ParentProps<{ label?: string }>) {
  return (
    <div class="border-1 rounded-lg p-4 flex flex-col" {...props}>
      <div class="flex justify-between">
        <h3 class="text-sm">{label}</h3>
      </div>
      {children}
    </div>
  );
}
