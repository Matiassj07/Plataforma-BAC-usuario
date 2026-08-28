export default function RiesgosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-gray-100 rounded-lg" />
          <div className="h-10 w-20 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-gray-100 rounded-xl" />
    </div>
  );
}
