import { onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import QrScanner from "qr-scanner";

import { ChevronLeftIcon } from "../../components/icons";

function ConnectScanView() {
  const navigate = useNavigate();
  let videoRef: HTMLVideoElement | undefined;
  let qrScanner: QrScanner | undefined;

  const startQrScanner = async () => {
    if (!videoRef) return;

    try {
      qrScanner = new QrScanner(
        videoRef,
        (result) => {
          qrScanner!.stop();
          qrScanner!.destroy();
          navigate("/", { state: { data: result.data }, replace: true });
        },
        {
          returnDetailedScanResult: true,
        },
      );

      await qrScanner.start();
    } catch (error) {
      console.error("Error initializing the QR scanner: ", error);
    }
  };

  onMount(() => {
    startQrScanner();
  });

  onCleanup(() => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
    }
  });

  return (
    <>
      <main class="flex-grow overflow-hidden flex flex-col items-center justify-center">
        <video
          ref={videoRef}
          class="w-full h-full object-cover"
          autoplay
          playsinline
        ></video>
      </main>
      <footer class="btm-nav bg-primary text-primary-content">
        <button
          class="btn btn-ghost"
          onClick={() => navigate(-1)}
          aria-label="back"
        >
          <ChevronLeftIcon />
        </button>
      </footer>
    </>
  );
}

export default ConnectScanView;
