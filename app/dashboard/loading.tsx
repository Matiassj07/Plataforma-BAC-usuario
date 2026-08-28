export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-bac-gray-alt rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-bac-gray-alt rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-bac-gray-alt rounded-xl" />
    </div>
  );
}
