export default function LiveReactionsOverlay({ reactions }) {
  if (!reactions?.length) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {reactions.map((item) => (
        <div
          key={item.id}
          className="live-reaction-burst absolute bottom-6 flex flex-col items-center"
          style={{ left: `${item.left}%` }}
        >
          <span className="text-3xl sm:text-4xl drop-shadow-lg leading-none">{item.emoji}</span>
          {item.name ? (
            <span className="mt-1 max-w-[7rem] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
              {item.name}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}
