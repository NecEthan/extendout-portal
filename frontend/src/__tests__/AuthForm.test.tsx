import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthForm } from "@/components/auth/AuthForm";
import { lastRequest, respond } from "@/test-utils/mockApi";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthForm />
    </QueryClientProvider>
  );
}

async function sendCodeTo(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  respond(202, { detail: "sent" });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByText("Check your email");
}

describe("AuthForm", () => {
  beforeEach(() => {
    push.mockReset();
    window.history.pushState({}, "", "/login");
    respond(401, { detail: "Not authenticated" }); // not logged in yet
  });

  it("asks for an email, then the emailed code, then signs in", async () => {
    renderForm();
    expect(screen.queryByLabelText(/password/i)).toBeNull();

    await sendCodeTo(" sam@example.com ");
    expect(JSON.parse(lastRequest().data)).toEqual({
      email: "sam@example.com",
    });
    expect(screen.getByText("sam@example.com")).toBeInTheDocument();

    const signIn = screen.getByRole("button", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "48 29-1" },
    });
    expect(signIn).toBeDisabled(); // only digits kept: "48291"
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "482913" },
    });

    respond(200, { id: "1", email: "sam@example.com", role: "builder" });
    fireEvent.click(signIn);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(lastRequest().url).toBe("/auth/verify-code");
    expect(JSON.parse(lastRequest().data)).toEqual({
      email: "sam@example.com",
      code: "482913",
    });
  });

  it("shows the backend's message for a wrong code and stays on the form", async () => {
    renderForm();
    await sendCodeTo("sam@example.com");
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: "000000" },
    });
    respond(401, { detail: "That code is wrong or has expired." });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("That code is wrong or has expired.")
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("can send a new code or go back to change the email", async () => {
    renderForm();
    await sendCodeTo("sam@example.com");

    respond(202, { detail: "sent" });
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "New code sent"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Use a different email" })
    );
    expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
    expect(screen.getByLabelText("Email")).toHaveValue("sam@example.com");
  });
});
