export default function PoweredByBadge() {
  return (
    <div
      role="note"
      aria-label="Powered by ForTech Digital"
      className="pointer-events-auto fixed bottom-3 left-3 z-30 inline-flex flex-col gap-1 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 backdrop-blur-sm"
    >
      <span className="text-[9px] font-semibold leading-none tracking-wide text-white/40">
        Powered by
      </span>
      <a
        href="https://fortechdigital.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="aspect-[1536/572] w-20">
          <img
            className="block size-full object-contain object-left opacity-80 transition-opacity hover:opacity-100"
            src="/logo_fortech.png"
            alt="ForTech Digital"
          />
        </div>
      </a>
    </div>
  );
}
