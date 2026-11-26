interface BrandMarkProps {
  onClick?: () => void;
}

export function BrandMark({ onClick }: BrandMarkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/60 rounded-lg px-1 py-1 transition-colors duration-150"
      aria-label="Third Man — return to Index"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        {/* Minimalist single-stroke pitch touchline corner */}
        <path
          d="M2.5 17.5V2.5H17.5"
          stroke="#EDEDED"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Third-man off-ball diagonal run line */}
        <path
          d="M5.5 15.5L11.5 8.5L17 11"
          stroke="#10B981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="11" r="1.75" fill="#10B981" />
      </svg>
      <span className="font-editorial text-[18px] font-medium tracking-[-0.01em] text-[#EDEDED] group-hover:text-white transition-colors duration-150 leading-none">
        Third Man
      </span>
    </button>
  );
}
