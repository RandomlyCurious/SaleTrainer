export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Template prêt</h1>
      <p className="max-w-md text-sm text-gray-500">
        Écris la spec dans <code>docs/specs/</code>, puis le premier test rouge.
        Cette page est un placeholder : remplace-la par la première feature.
      </p>
    </main>
  );
}
