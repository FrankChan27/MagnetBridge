import { createFileRoute } from "@tanstack/react-router";
import { MagnetApp } from "@/components/magnet/app-shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MagnetApp />;
}
