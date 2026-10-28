export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="size-10 animate-spin rounded-full border-4 border-tesla-sable border-t-tesla-bordeaux" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
