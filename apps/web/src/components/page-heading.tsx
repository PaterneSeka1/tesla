export function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-tesla-bordeaux">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
