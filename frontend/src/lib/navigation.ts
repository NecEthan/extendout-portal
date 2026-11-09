/** Full-page navigation (outside React, so no Next router). Mocked in tests. */
export function navigateTo(path: string): void {
  window.location.assign(path);
}
