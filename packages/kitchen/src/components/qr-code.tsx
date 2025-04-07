import QRCode from "qrcode-svg";

export default function QrCodeImage(props: {
  content: string;
  class?: string;
}) {
  return (
    <div
      class={props.class}
      innerHTML={new QRCode({
        content: props.content,
        width: 256,
        height: 256,
        color: "#000000",
        background: "#ffffff",
        ecl: "M",
      }).svg()}
    />
  );
}
