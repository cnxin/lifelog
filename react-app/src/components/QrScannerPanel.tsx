import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createQrBarcodeDetector, isQrCodeDetectionSupported } from "../utils/qrCodeReader";
import SheetPrimitive from "./motion/SheetPrimitive";

interface QrScannerPanelProps {
  open: boolean;
  title?: string;
  onDetected: (text: string) => void;
  onClose: () => void;
}

export default function QrScannerPanel({
  open,
  title = "扫描二维码",
  onDetected,
  onClose
}: QrScannerPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("准备打开相机…");

  useEffect(() => {
    if (!open) return;
    let active = true;
    let frameHandle = 0;
    let detector: ReturnType<typeof createQrBarcodeDetector> | null = null;

    async function startScanner() {
      if (!isQrCodeDetectionSupported()) {
        setStatus("当前 WebView 不支持直接扫码，请改用粘贴分享链接。");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("当前环境无法打开相机，请改用粘贴分享链接。");
        return;
      }

      try {
        detector = createQrBarcodeDetector();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("请将 LifeLog 分享二维码放入取景框。");
        scanFrame();
      } catch (error) {
        setStatus(error instanceof Error && error.name === "NotAllowedError"
          ? "相机权限未授权，请授权后重试，或改用粘贴分享链接。"
          : "相机打开失败，请改用粘贴分享链接。");
      }
    }

    async function scanFrame() {
      if (!active || !detector) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const value = codes.find((code) => code.rawValue)?.rawValue?.trim();
          if (value) {
            onDetected(value);
            onClose();
            return;
          }
        } catch {
          setStatus("扫码识别失败，请调整距离或光线。");
        }
      }
      frameHandle = window.setTimeout(scanFrame, 350);
    }

    void startScanner();

    return () => {
      active = false;
      window.clearTimeout(frameHandle);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, onClose, onDetected]);

  if (!open) return null;

  return (
    <SheetPrimitive open onDismissRequest={onClose} className="qr-scanner-sheet" ariaLabel={title}>
        <div className="sheet-handle" data-sheet-drag-handle />
        <div className="sheet-header">
          <div>
            <h2>{title}</h2>
            <p>扫描 LifeLog 分享二维码后会进入导入预览。</p>
          </div>
          <button className="sheet-close pressable" aria-label="关闭" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="qr-scanner-frame" data-no-sheet-drag>
          <video ref={videoRef} muted playsInline />
          <span className="qr-scanner-corners" aria-hidden="true" />
          <div className="qr-scanner-placeholder">
            <Camera />
          </div>
        </div>
        <p className="qr-scanner-status">{status}</p>
    </SheetPrimitive>
  );
}
