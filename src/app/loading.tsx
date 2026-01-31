import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <div className="relative flex size-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Spinner className="size-10 text-primary" />
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/5" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          AiRA
        </h3>
        <p className="text-sm text-muted-foreground animate-pulse">
          Initializing Workspace...
        </p>
      </div>
    </div>
  );
}
