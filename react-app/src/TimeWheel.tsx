import WheelPicker from "./WheelPicker";
const pad = (n: number) => String(n).padStart(2, "0");
const hours = Array.from({ length: 24 }, (_, n) => ({ value: pad(n), label: pad(n) }));
const minutes = Array.from({ length: 60 }, (_, n) => ({ value: pad(n), label: pad(n) }));

export default function TimeWheel({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [hour, minute] = value.split(":");
  return <div className="time-wheel" role="group" aria-label="提醒时间">
    <div><span className="time-wheel-label">时</span><WheelPicker options={hours} value={hour}
      ariaLabel="小时" disabled={disabled} onChange={next => onChange(`${next}:${minute}`)} /></div>
    <span className="time-wheel-colon" aria-hidden="true">:</span>
    <div><span className="time-wheel-label">分</span><WheelPicker options={minutes} value={minute}
      ariaLabel="分钟" disabled={disabled} onChange={next => onChange(`${hour}:${next}`)} /></div>
  </div>;
}
