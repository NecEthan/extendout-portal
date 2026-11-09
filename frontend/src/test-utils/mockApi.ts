import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { api } from "@/lib/api/client";

/**
 * Replaces the axios transport on the shared `api` instance, so requests go
 * through the real config and interceptors but never hit the network.
 * Queue a response per request with `respond(status, data)`; read what was
 * sent from `lastRequest()`.
 */
const adapter = jest.fn<Promise<AxiosResponse>, [InternalAxiosRequestConfig]>();
api.defaults.adapter = adapter;

beforeEach(() => adapter.mockReset());

export function respond(status: number, data?: unknown): void {
  adapter.mockImplementationOnce(async (config) => {
    const response: AxiosResponse = {
      data,
      status,
      statusText: "",
      headers: {},
      config,
    };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response
    );
  });
}

export function networkError(): void {
  adapter.mockImplementationOnce(async (config) => {
    throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
  });
}

export function lastRequest(): InternalAxiosRequestConfig {
  const calls = adapter.mock.calls;
  if (calls.length === 0) throw new Error("No request was sent");
  return calls[calls.length - 1][0];
}
