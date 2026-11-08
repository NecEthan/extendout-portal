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

/** Ask questions answered only from this project's documents. */
export function ProjectSearch({ projectId }: { projectId: number }) {
  const [question, setQuestion] = useState("");
  const {
    mutate,
    data,
    error: searchError,
    isError,
    isPending,
  } = useSearchQuery();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    mutate({ question: question.trim(), project_id: projectId });
  }

  const result = data ?? null;
  const unauthorized =
    searchError instanceof ApiError && searchError.status === 401;
  const error = unauthorized
    ? null
    : getErrorMessage(
        { isError, error: searchError },
        "Something went wrong. Please try again.",
        {
          429: "Too many questions in a short time. Wait a minute and try again.",
          503: "The AI service is temporarily unavailable. Please try again later.",
        }
      );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
          <p className="text-sm text-muted-foreground">
            Answers come only from this project&apos;s documents, citing the
            file and version.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What U-value is specified for the rooflights?"
              />
            </div>

            <Button type="submit" disabled={isPending || !question.trim()}>
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <ErrorAlert message={error} />

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{result.answer}</p>
            </CardContent>
          </Card>

          {result.citations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {result.citations.map((citation, i) => (
                    <li key={i} className="border rounded p-3">
                      <p className="font-medium">{citation.document_title}</p>
                      <p className="text-sm text-muted-foreground">
                        Version {citation.version_number} &middot;{" "}
                        {citation.status} &middot;{" "}
                        {new Date(citation.updated_at).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  No relevant information found.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
