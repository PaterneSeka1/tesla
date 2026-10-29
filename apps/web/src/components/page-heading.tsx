/** Titre de page ; la description est réservée aux règles qui préviennent une erreur. */
export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
