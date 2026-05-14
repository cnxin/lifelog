export default function Ingot({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ingot-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFC700" />
          <stop offset="100%" stopColor="#DAA520" />
        </linearGradient>
      </defs>

      {/* 金元宝主体 - 马蹄形 */}
      <path
        d="M12 32 Q12 24 16 20 L20 16 L28 16 L32 20 Q36 24 36 32 Q36 36 32 38 L28 40 L20 40 L16 38 Q12 36 12 32 Z"
        fill="url(#ingot-gradient)"
        stroke="#8B4513"
        strokeWidth="1.5"
      />

      {/* 中间凹陷弧线 */}
      <path
        d="M20 16 Q24 20 28 16"
        fill="none"
        stroke="#DAA520"
        strokeWidth="1.5"
      />

      {/* 左侧翘起 */}
      <path
        d="M12 32 L10 28 L12 24"
        fill="none"
        stroke="#8B4513"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 右侧翘起 */}
      <path
        d="M36 32 L38 28 L36 24"
        fill="none"
        stroke="#8B4513"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* 高光 */}
      <ellipse
        cx="26"
        cy="26"
        rx="5"
        ry="3"
        fill="white"
        opacity="0.4"
      />

      {/* 底部厚度 */}
      <path
        d="M16 38 L20 40 L28 40 L32 38"
        fill="#B8860B"
        opacity="0.6"
      />
    </svg>
  );
}
