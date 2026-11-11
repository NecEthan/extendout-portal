import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applicationRoutes } from "@/utils/applicationRoutes";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button
            className="w-full"
            render={<Link href={applicationRoutes.home} />}
          >
            Back to ExtendOut Portal
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
