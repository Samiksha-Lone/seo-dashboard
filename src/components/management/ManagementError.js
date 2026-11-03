export default function ManagementError({ item }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <h2 className="font-semibold">{item} data is unavailable</h2>
      <p className="mt-1 text-sm text-rose-800">
        We couldn&apos;t load this information from the database. Check the database connection and try again.
      </p>
    </div>
  );
}
