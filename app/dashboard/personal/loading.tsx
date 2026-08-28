export default function PersonalLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-36 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-10 w-44 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
}
