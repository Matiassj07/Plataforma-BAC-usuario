export default function MensajesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-52 bg-gray-200 rounded" />
      <div className="h-4 w-64 bg-gray-100 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
