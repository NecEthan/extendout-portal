"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { getErrorMessage } from "@/lib/errorMessage";

export default function SearchPage() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"current" | "historical">("current");
  const search = useSearchQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    search.mutate({ question: question.trim(), mode });
  }

  const result = search.data ?? null;
  const unauthorized = search.error instanceof ApiError && search.error.status === 401;
  const error = unauthorized
    ? null
    : getErrorMessage(search, "Something went wrong. Please try again.", {
        503: "The AI service is temporarily unavailable. Please try again later.",
      });

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-4 gap-8">
      <div className="w-full max-w-2xl">
        <span className="text-2xl font-semibold">Search knowledge base</span>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is the annual leave policy?"
              />
            </div>

            <div className="flex gap-2" role="group" aria-label="Version mode">
              <Button
                type="button"
                variant={mode === "current" ? "default" : "outline"}
                onClick={() => setMode("current")}
                aria-pressed={mode === "current"}
              >
                Current
              </Button>
              <Button
                type="button"
                variant={mode === "historical" ? "default" : "outline"}
                onClick={() => setMode("historical")}
                aria-pressed={mode === "historical"}
              >
                Historical
              </Button>
            </div>

            <Button type="submit" disabled={search.isPending || !question.trim()}>
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="w-full max-w-2xl">
        <ErrorAlert message={error} />
      </div>

      {result && (
        <>
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{result.answer}</p>
            </CardContent>
          </Card>

          {result.citations.length > 0 ? (
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {result.citations.map((citation, i) => (
                    <li key={i} className="border rounded p-3">
                      <p className="font-medium">{citation.document_title}</p>
                      <p className="text-sm text-muted-foreground">
                        Version {citation.version_number} &middot; {citation.status}{" "}
                        &middot;{" "}
                        {new Date(citation.updated_at).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full max-w-2xl">
              <CardContent className="pt-6">
                <p className="text-muted-foreground">No relevant information found.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
