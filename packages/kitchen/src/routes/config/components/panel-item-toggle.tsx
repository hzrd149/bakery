import { Component } from "solid-js";

interface PanelItemToggleProps {
  label?: string;
  value: boolean;
  onChange: () => void;
  class?: string;
}

const PanelItemToggle: Component<PanelItemToggleProps> = (props) => {
  return (
    <div class={`flex items-center justify-between ${props.class || ""}`}>
      <label class="label">{props.label}</label>
      <input
        type="checkbox"
        class="toggle"
        checked={props.value}
        onChange={props.onChange}
      />
    </div>
  );
};

export default PanelItemToggle;
