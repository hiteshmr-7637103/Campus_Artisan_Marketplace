// Fire-and-forget notification, rendered by <Layout>.
export function showToast(message, icon = "✨") {
  window.dispatchEvent(new CustomEvent("campcraft_toast", { detail: { message, icon } }));
}
